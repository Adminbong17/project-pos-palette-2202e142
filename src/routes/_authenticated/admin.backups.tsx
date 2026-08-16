import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  backupRunNow,
  backupRestore,
  backupPurgeNow,
  backupGetSettings,
  backupSaveSettings,
  backupDownload,
} from "@/lib/backups.functions";
import { toast } from "sonner";
import { useIsSuperAdmin } from "@/hooks/use-super-admin";
import { Input } from "@/components/ui/input";
import { DatabaseBackup, Download, History, Loader2, RefreshCw, Trash2, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/backups")({
  head: () => ({
    meta: [
      { title: "Backups & Restore — QweekPOS Admin" },
      {
        name: "description",
        content:
          "Nightly automatic backups of every business, user-wise restore points and 30-day retention for QweekPOS super admins.",
      },
      { property: "og:title", content: "Backups & Restore — QweekPOS Admin" },
      {
        property: "og:description",
        content: "Automatic 11:58 PM backups, user-wise restore and FileVault offloading.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BackupsPage,
});

function fmtBytes(n: number) {
  if (!n) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function fmtDhaka(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function BackupsPage() {
  const { isSuperAdmin, isLoading: superLoading } = useIsSuperAdmin();
  const qc = useQueryClient();
  const runNow = useServerFn(backupRunNow);
  const restore = useServerFn(backupRestore);
  const purge = useServerFn(backupPurgeNow);
  const getSettings = useServerFn(backupGetSettings);
  const saveSettings = useServerFn(backupSaveSettings);
  const download = useServerFn(backupDownload);
  if (superLoading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!isSuperAdmin)
    return <div className="p-8 text-sm text-muted-foreground">Only the super admin can access this page.</div>;

  const [selected, setSelected] = useState<string | null>(null);
  const [restoreUser, setRestoreUser] = useState<string>("");
  const [search, setSearch] = useState("");

  const settings = useQuery({
    queryKey: ["backup-settings"],
    queryFn: () => getSettings({ data: undefined as never }),
  });

  const runs = useQuery({
    queryKey: ["backup-runs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("backup_runs")
        .select(
          "id, business_id, business_name, status, storage, size_bytes, db_size_bytes, table_counts, user_counts, share_token, file_name, error, created_at, expires_at",
        )
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const profiles = useQuery({
    queryKey: ["backup-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, first_name, email");
      return data ?? [];
    },
  });
  const userName = (id: string) => {
    const p = (profiles.data ?? []).find((x: any) => x.id === id) as any;
    return p ? (p.first_name || p.email || id.slice(0, 8)) : id.slice(0, 8);
  };

  const runMut = useMutation({
    mutationFn: () => runNow({ data: {} }),
    onSuccess: (r: any) => {
      toast.success(`Backup done — ${r.runs?.length ?? 0} business, ${r.storage === "vault" ? "FileVault" : "database"}`);
      qc.invalidateQueries({ queryKey: ["backup-runs"] });
      qc.invalidateQueries({ queryKey: ["backup-settings"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Backup failed"),
  });

  const restoreMut = useMutation({
    mutationFn: (v: { run_id: string; user_id?: string | null }) =>
      restore({ data: { run_id: v.run_id, user_id: v.user_id ?? null } }),
    onSuccess: (r: any) => {
      const failed = Object.keys(r?.failed ?? {});
      toast.success(
        `Restored ${Object.keys(r?.restored ?? {}).length} tables${failed.length ? ` · ${failed.length} skipped` : ""}`,
      );
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message ?? "Restore failed"),
  });

  const purgeMut = useMutation({
    mutationFn: () => purge({ data: undefined as never }),
    onSuccess: (r: any) => {
      toast.success(`${r.purged} old backup(s) removed`);
      qc.invalidateQueries({ queryKey: ["backup-runs"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Purge failed"),
  });

  const settingsMut = useMutation({
    mutationFn: (v: { app_base_url?: string; retention_days?: number; vault_threshold_mb?: number }) =>
      saveSettings({ data: v }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["backup-settings"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  const downloadMut = useMutation({
    mutationFn: (run_id: string) => download({ data: { run_id } }),
    onSuccess: (r: any) => {
      const blob = new Blob([r.json], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = r.file_name;
      a.click();
      URL.revokeObjectURL(a.href);
    },
    onError: (e: any) => toast.error(e.message ?? "Download failed"),
  });

  const s = settings.data as any;
  const current = (runs.data ?? []).find((r) => r.id === selected);

  const filteredRuns = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = runs.data ?? [];
    if (!q) return list;
    return list.filter((r) =>
      [
        fmtDhaka(r.created_at),
        r.business_name,
        r.status,
        r.storage === "vault" ? "FileVault" : "Database",
        fmtBytes(Number(r.size_bytes ?? 0)),
        fmtDhaka(r.expires_at),
        r.error,
      ]
        .map((v) => String(v ?? "").toLowerCase())
        .join(" ")
        .includes(q),
    );
  }, [runs.data, search]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Backups &amp; Restore</h1>
          <p className="text-sm text-muted-foreground">
            Automatic full backup every night at 11:58 PM (Dhaka). Kept {s?.retention_days ?? 30} days, then deleted.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => runMut.mutate()}
            disabled={runMut.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {runMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <DatabaseBackup className="h-4 w-4" />}
            Backup now
          </button>
          <button
            onClick={() => purgeMut.mutate()}
            disabled={purgeMut.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" /> Purge old
          </button>
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["backup-runs"] })}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* settings */}
      <div className="grid gap-3 rounded-2xl border border-border/60 bg-card p-4 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="text-xs text-muted-foreground">App address (used by the nightly job)</label>
          <input
            defaultValue={s?.app_base_url ?? ""}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== s?.app_base_url) settingsMut.mutate({ app_base_url: v });
            }}
            placeholder="https://pos.qweekbd.com"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Keep for (days)</label>
          <input
            type="number"
            defaultValue={s?.retention_days ?? 30}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (v > 0 && v !== s?.retention_days) settingsMut.mutate({ retention_days: v });
            }}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">FileVault above (MB)</label>
          <input
            type="number"
            defaultValue={s?.vault_threshold_mb ?? 300}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (v > 0 && v !== s?.vault_threshold_mb) settingsMut.mutate({ vault_threshold_mb: v });
            }}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-4">
          Database size now: <strong>{fmtBytes(Number(s?.db_size_bytes ?? 0))}</strong> · Scheduler:{" "}
          {s?.cron_enabled ? "in-database (pg_cron) active" : "not available — use an external cron"} · Storage target:{" "}
          {Number(s?.db_size_bytes ?? 0) > (s?.vault_threshold_mb ?? 300) * 1024 * 1024 ? "FileVault" : "database"}
        </p>
      </div>

      {/* runs */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search backups…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Time (Dhaka)</th>
              <th className="px-3 py-2">Business</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Where</th>
              <th className="px-3 py-2">Size</th>
              <th className="px-3 py-2">Deletes on</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {runs.isLoading ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : (runs.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  No backups yet — press “Backup now”.
                </td>
              </tr>
            ) : filteredRuns.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  No match
                </td>
              </tr>
            ) : (
              filteredRuns.map((r) => (
                <tr key={r.id} className="border-t border-border/60">
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDhaka(r.created_at)}</td>
                  <td className="px-3 py-2">{r.business_name ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className={r.status === "success" ? "text-emerald-600" : "text-destructive"}>
                      {r.status}
                    </span>
                    {r.error ? <span className="block text-xs text-muted-foreground">{r.error}</span> : null}
                  </td>
                  <td className="px-3 py-2">{r.storage === "vault" ? "FileVault" : "Database"}</td>
                  <td className="px-3 py-2">{fmtBytes(Number(r.size_bytes ?? 0))}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDhaka(r.expires_at)}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => downloadMut.mutate(r.id)}
                        className="rounded-md p-1.5 hover:bg-muted"
                        title="Download JSON"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelected(r.id);
                          setRestoreUser("");
                        }}
                        className="rounded-md p-1.5 hover:bg-muted"
                        title="Restore from this point"
                      >
                        <History className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* restore panel */}
      {current ? (
        <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
          <div>
            <h2 className="font-medium">
              Restore — {current.business_name} · {fmtDhaka(current.created_at)}
            </h2>
            <p className="text-sm text-muted-foreground">
              Rows are written back by id (existing rows updated, deleted rows re-created). Nothing is removed.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Restore only this user’s records</label>
              <select
                value={restoreUser}
                onChange={(e) => setRestoreUser(e.target.value)}
                className="mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">Everyone (full business)</option>
                {Object.entries(current.user_counts ?? {}).map(([uid, count]) => (
                  <option key={uid} value={uid}>
                    {userName(uid)} ({count as number} rows)
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => {
                if (!confirm("Restore data from this backup point?")) return;
                restoreMut.mutate({ run_id: current.id, user_id: restoreUser || null });
              }}
              disabled={restoreMut.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {restoreMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
              Restore
            </button>
            <button
              onClick={() => setSelected(null)}
              className="rounded-lg border border-border px-3 py-2 text-sm"
            >
              Close
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 text-xs">
            {Object.entries(current.table_counts ?? {})
              .filter(([, n]) => (n as number) > 0)
              .map(([t, n]) => (
                <span key={t} className="rounded-md bg-muted px-2 py-1">
                  {t}: {n as number}
                </span>
              ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
