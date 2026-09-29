// Server-only archive engine.
// When the database grows past the backup threshold (default 300 MB), every
// month older than 6 months is packed per business + group into one JSON file
// in FileVault, indexed in public.archive_chunks, then deleted from the DB.
// Reads call fetchArchivedRows(), which pulls the file straight from the
// vault (with a short in-memory cache) so old data shows up live.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getBackupSettings } from "./backup.server";

const VAULT_BASE = "https://api.bongbangla.top/vault-api";
export const ARCHIVE_MONTHS = 6;
export type ArchiveGroup = "sales" | "prescriptions" | "lab_reports" | "appointments" | "expenses";

const MAIN_TABLE: Record<ArchiveGroup, string> = {
  sales: "transactions",
  prescriptions: "prescriptions",
  lab_reports: "lab_reports",
  appointments: "rx_appointments",
  expenses: "expenses",
};

const db = supabaseAdmin as any;

function cutoffDate() {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - ARCHIVE_MONTHS);
  d.setUTCDate(1);
  return d.toISOString().slice(0, 10);
}

async function uploadJson(fileName: string, json: string) {
  const token = process.env["VAULT_TOKEN"];
  if (!token) throw new Error("VAULT_TOKEN is not configured");
  const fd = new FormData();
  fd.append("file", new Blob([json], { type: "application/json" }), fileName);
  const res = await fetch(`${VAULT_BASE}/upload.php`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Vault upload failed [${res.status}]`);
  const parsed = JSON.parse(text);
  const vf: any = parsed?.file ?? parsed?.data ?? parsed;
  const share = vf?.share_token ?? vf?.shareToken ?? vf?.token ?? null;
  if (!share) throw new Error("Vault did not return a share token");
  return { vault_file_id: String(vf?.id ?? vf?.file_id ?? ""), share_token: String(share) };
}

// ---- cache (per worker instance) ----
const cache = new Map<string, { at: number; data: any }>();
const TTL = 10 * 60 * 1000;

async function downloadChunk(shareToken: string) {
  const hit = cache.get(shareToken);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  const res = await fetch(`${VAULT_BASE}/share.php?t=${encodeURIComponent(shareToken)}`);
  if (!res.ok) throw new Error(`Vault download failed [${res.status}]`);
  const data = await res.json();
  cache.set(shareToken, { at: Date.now(), data });
  if (cache.size > 50) cache.delete(cache.keys().next().value!);
  return data;
}

function buildKeyIndex(grp: ArchiveGroup, payload: any) {
  const rows: any[] = payload?.[MAIN_TABLE[grp]] ?? [];
  const keys = new Set<string>();
  for (const r of rows) {
    for (const k of ["invoice_no", "ref_no", "patient_phone", "contact_id"]) {
      if (r?.[k]) keys.add(String(r[k]).toLowerCase());
    }
  }
  return { keys: Array.from(keys).slice(0, 5000) };
}

/** Archive old months when the DB is over the threshold (or when forced). */
export async function runArchive(opts: { force?: boolean; businessId?: string } = {}) {
  const settings = await getBackupSettings();
  const { data: sizeRaw } = await db.rpc("backup_db_size");
  const size = Number(sizeRaw ?? 0);
  const threshold = (settings.vault_threshold_mb ?? 300) * 1024 * 1024;
  if (!opts.force && size <= threshold) {
    return { skipped: true, db_size_bytes: size, archived: [] as any[] };
  }

  const { data: cands, error } = await db.rpc("archive_candidates", { _cutoff: cutoffDate() });
  if (error) throw error;
  const archived: any[] = [];
  for (const c of (cands ?? []) as any[]) {
    if (opts.businessId && c.business_id !== opts.businessId) continue;
    try {
      const { data: payload, error: cErr } = await db.rpc("archive_collect", {
        _business_id: c.business_id,
        _grp: c.grp,
        _month: c.period_month,
      });
      if (cErr) throw cErr;
      const grp = c.grp as ArchiveGroup;
      const newRows: any[] = payload?.[MAIN_TABLE[grp]] ?? [];
      if (!newRows.length) continue;

      // Merge with an existing chunk for the same month (late-arriving rows).
      const { data: existing } = await db
        .from("archive_chunks")
        .select("id, share_token")
        .eq("business_id", c.business_id).eq("grp", grp).eq("period_month", c.period_month)
        .maybeSingle();
      let merged = payload;
      if (existing?.share_token) {
        const old = await downloadChunk(existing.share_token);
        merged = { ...old };
        for (const [t, list] of Object.entries(payload ?? {})) {
          const ids = new Set(((old?.[t] ?? []) as any[]).map((r) => r.id));
          merged[t] = [...(old?.[t] ?? []), ...(list as any[]).filter((r) => !ids.has(r.id))];
        }
      }

      const json = JSON.stringify(merged);
      const fileName = `archive-${grp}-${c.period_month}-${String(c.business_id).slice(0, 8)}.json`;
      const up = await uploadJson(fileName, json);

      // Verify the file is readable before deleting anything.
      cache.delete(up.share_token);
      const check = await downloadChunk(up.share_token);
      if ((check?.[MAIN_TABLE[grp]] ?? []).length !== (merged?.[MAIN_TABLE[grp]] ?? []).length) {
        throw new Error("Vault verification failed");
      }

      const row = {
        business_id: c.business_id,
        grp,
        period_month: c.period_month,
        vault_file_id: up.vault_file_id,
        share_token: up.share_token,
        file_name: fileName,
        row_count: (merged?.[MAIN_TABLE[grp]] ?? []).length,
        bytes: new TextEncoder().encode(json).length,
        key_index: buildKeyIndex(grp, merged),
        status: "archived",
      };
      const { error: upErr } = await db
        .from("archive_chunks")
        .upsert(row, { onConflict: "business_id,grp,period_month" });
      if (upErr) throw upErr;

      const { data: deleted, error: dErr } = await db.rpc("archive_delete", {
        _business_id: c.business_id,
        _grp: grp,
        _month: c.period_month,
      });
      if (dErr) throw dErr;
      archived.push({ ...c, rows: row.row_count, deleted });
    } catch (e: any) {
      archived.push({ ...c, error: String(e?.message ?? e).slice(0, 300) });
    }
  }
  return { skipped: false, db_size_bytes: size, archived };
}

/** Read archived rows for a business, filtered by date range and/or search key. */
export async function fetchArchivedRows(args: {
  businessId: string;
  grp: ArchiveGroup;
  from?: string | null;
  to?: string | null;
  key?: string | null;
}) {
  let q = db
    .from("archive_chunks")
    .select("id, period_month, share_token, key_index")
    .eq("business_id", args.businessId)
    .eq("grp", args.grp)
    .eq("status", "archived");
  if (args.from) q = q.gte("period_month", args.from.slice(0, 7) + "-01");
  if (args.to) q = q.lte("period_month", args.to.slice(0, 10));
  const { data: chunks, error } = await q.order("period_month", { ascending: false }).limit(24);
  if (error) throw error;
  const key = args.key?.trim().toLowerCase() || null;

  const out: Record<string, any[]> = {};
  for (const ch of (chunks ?? []) as any[]) {
    if (key) {
      const keys: string[] = ch.key_index?.keys ?? [];
      if (!keys.some((k) => k.includes(key))) continue;
    }
    const data = await downloadChunk(ch.share_token);
    for (const [t, list] of Object.entries(data ?? {})) {
      (out[t] ??= []).push(...((list as any[]) ?? []));
    }
  }
  return out;
}

/** Put an archived month back into the live database. */
export async function restoreChunk(chunkId: string) {
  const { data: ch, error } = await db.from("archive_chunks").select("*").eq("id", chunkId).maybeSingle();
  if (error) throw error;
  if (!ch) throw new Error("Archive not found");
  const payload = { ...(await downloadChunk(ch.share_token)) };
  if (Array.isArray(payload.prescriptions)) {
    const txIds = payload.prescriptions.map((p: any) => p.transaction_id).filter(Boolean);
    const live = new Set<string>();
    if (txIds.length) {
      const { data } = await db.from("transactions").select("id").in("id", txIds);
      for (const r of data ?? []) live.add(r.id);
    }
    payload.prescriptions = payload.prescriptions.map((p: any) =>
      p.transaction_id && !live.has(p.transaction_id) ? { ...p, transaction_id: null } : p,
    );
  }
  if (Array.isArray(payload.rx_appointments)) {
    const ids = payload.rx_appointments.map((a: any) => a.prescription_id).filter(Boolean);
    const live = new Set<string>();
    if (ids.length) {
      const { data } = await db.from("prescriptions").select("id").in("id", ids);
      for (const r of data ?? []) live.add(r.id);
    }
    payload.rx_appointments = payload.rx_appointments.map((a: any) =>
      a.prescription_id && !live.has(a.prescription_id) ? { ...a, prescription_id: null } : a,
    );
  }
  const { data: res, error: rErr } = await db.rpc("archive_restore", { _payload: payload });
  if (rErr) throw rErr;
  await db.from("archive_chunks").update({ status: "restored" }).eq("id", chunkId);
  return res;
}
