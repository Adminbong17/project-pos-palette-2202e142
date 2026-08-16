// Server-only backup engine.
// Takes a per-business JSON snapshot of every table that has a business_id,
// stores it inline in public.backup_runs when the database is small, and
// offloads it to FileVault once the database grows past the configured
// threshold (default 300 MB). Old runs are purged by retention_days.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const VAULT_BASE = "https://api.bongbangla.top/vault-api";

export type BackupSettings = {
  app_base_url: string;
  cron_secret: string;
  retention_days: number;
  vault_threshold_mb: number;
};

export async function getBackupSettings(): Promise<BackupSettings> {
  const { data, error } = await (supabaseAdmin as any).rpc("backup_settings");
  if (error) throw error;
  return (data as BackupSettings) ?? {
    app_base_url: "",
    cron_secret: "",
    retention_days: 30,
    vault_threshold_mb: 300,
  };
}

async function dbSizeBytes(): Promise<number> {
  const { data } = await (supabaseAdmin as any).rpc("backup_db_size");
  return Number(data ?? 0);
}

async function uploadToVault(fileName: string, json: string) {
  const token = process.env["VAULT_TOKEN"];
  if (!token) throw new Error("VAULT_TOKEN is not configured on the server");
  const fd = new FormData();
  fd.append("file", new Blob([json], { type: "application/json" }), fileName);
  const res = await fetch(`${VAULT_BASE}/upload.php`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Vault upload failed [${res.status}]: ${text.slice(0, 200)}`);
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Vault returned non-JSON: ${text.slice(0, 200)}`);
  }
  const vf: any = parsed?.file ?? parsed?.data ?? parsed;
  return {
    vault_file_id: String(vf?.id ?? vf?.file_id ?? vf?.fileId ?? ""),
    share_token: vf?.share_token ?? vf?.shareToken ?? vf?.token ?? null,
  };
}

export async function purgeExpiredBackups() {
  const { data, error } = await (supabaseAdmin as any).rpc("backup_purge_expired");
  if (error) throw error;
  const removed = (data as any[]) ?? [];
  const token = process.env["VAULT_TOKEN"];
  if (token) {
    for (const r of removed) {
      if (!r?.vault_file_id) continue;
      const fid = String(r.vault_file_id);
      try {
        await fetch(`${VAULT_BASE}/delete.php?id=${encodeURIComponent(fid)}&file_id=${encodeURIComponent(fid)}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ id: fid, file_id: fid, fileId: fid }).toString(),
        });
      } catch {
        // best effort — the log row is already gone
      }
    }
  }
  return removed.length;
}

/** Run a full backup: one run row per business. */
export async function runFullBackup(businessId?: string) {
  const settings = await getBackupSettings();
  const size = await dbSizeBytes();
  const thresholdBytes = (settings.vault_threshold_mb ?? 300) * 1024 * 1024;
  const useVault = size > thresholdBytes;

  let q = supabaseAdmin.from("businesses").select("id, name");
  if (businessId) q = q.eq("id", businessId);
  const { data: businesses, error } = await q;
  if (error) throw error;

  const results: any[] = [];
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

  for (const biz of businesses ?? []) {
    try {
      const { data: payload, error: snapErr } = await (supabaseAdmin as any).rpc("backup_business_snapshot", {
        _business_id: biz.id,
      });
      if (snapErr) throw snapErr;

      const json = JSON.stringify(payload ?? {});
      const { data: stats } = await (supabaseAdmin as any).rpc("backup_snapshot_stats", {
        _payload: payload as any,
      });
      const statsObj = (stats as any) ?? {};

      const row: any = {
        business_id: biz.id,
        business_name: biz.name,
        scope: "business",
        status: "success",
        storage: useVault ? "vault" : "db",
        size_bytes: new TextEncoder().encode(json).length,
        db_size_bytes: size,
        table_counts: statsObj.tables ?? {},
        user_counts: statsObj.users ?? {},
        expires_at: new Date(
          Date.now() + (settings.retention_days ?? 30) * 86400000,
        ).toISOString(),
      };

      const fileName = `backup-${(biz.name ?? "business").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}-${stamp}.json`;
      if (useVault) {
        const up = await uploadToVault(fileName, json);
        row.vault_file_id = up.vault_file_id;
        row.share_token = up.share_token;
        row.file_name = fileName;
      } else {
        row.payload = payload;
        row.file_name = fileName;
      }

      const { data: inserted, error: insErr } = await (supabaseAdmin as any)
        .from("backup_runs")
        .insert(row)
        .select("id, business_name, storage, size_bytes")
        .single();
      if (insErr) throw insErr;
      results.push(inserted);
    } catch (e: any) {
      await (supabaseAdmin as any).from("backup_runs").insert({
        business_id: biz.id,
        business_name: biz.name,
        status: "failed",
        storage: useVault ? "vault" : "db",
        error: String(e?.message ?? e).slice(0, 1000),
      });
      results.push({ business_id: biz.id, status: "failed", error: String(e?.message ?? e) });
    }
  }

  const purged = await purgeExpiredBackups();
  return { db_size_bytes: size, storage: useVault ? "vault" : "db", runs: results, purged };
}

/** Pull a vault-stored snapshot back into the run row so it can be restored. */
export async function rehydrateFromVault(runId: string) {
  const { data: run, error } = await (supabaseAdmin as any)
    .from("backup_runs")
    .select("id, share_token, payload")
    .eq("id", runId)
    .maybeSingle();
  if (error) throw error;
  if (!run) throw new Error("Backup not found");
  if (run.payload) return { ok: true, already: true };
  if (!run.share_token) throw new Error("This backup has no downloadable file");

  const res = await fetch(`${VAULT_BASE}/share.php?t=${run.share_token}`);
  if (!res.ok) throw new Error(`Vault download failed [${res.status}]`);
  const payload = await res.json();
  const { error: upErr } = await (supabaseAdmin as any)
    .from("backup_runs")
    .update({ payload })
    .eq("id", runId);
  if (upErr) throw upErr;
  return { ok: true, already: false };
}
