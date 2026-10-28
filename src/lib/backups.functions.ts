import { checkIsSuperAdmin } from "@/lib/super-admin-auth";
// Super-admin backup controls. All heavy lifting lives in backup.server.ts
// and is imported inside the handlers so it never reaches the client bundle.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(context: any) {
  const isSuper = await checkIsSuperAdmin(context);
  if (!isSuper) throw new Error("Only the super admin can manage backups");
}

export const backupRunNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { business_id?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { runFullBackup } = await import("./backup.server");
    return runFullBackup(data.business_id);
  });

export const backupRestore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { run_id: string; tables?: string[] | null; user_id?: string | null }) => d)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { rehydrateFromVault } = await import("./backup.server");
    await rehydrateFromVault(data.run_id);
    const { data: result, error } = await (context.supabase as any).rpc("backup_restore", {
      _run_id: data.run_id,
      _tables: data.tables ?? null,
      _user_id: data.user_id ?? null,
    });
    if (error) throw error;
    return result;
  });

export const backupPurgeNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { purgeExpiredBackups } = await import("./backup.server");
    return { purged: await purgeExpiredBackups() };
  });

export const backupGetSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { data, error } = await (context.supabase as any).rpc("backup_settings");
    if (error) throw error;
    const { cron_secret: _omit, ...safe } = (data ?? {}) as any;
    const { data: size } = await (context.supabase as any).rpc("backup_db_size");
    return { ...safe, db_size_bytes: Number(size ?? 0) };
  });

export const backupSaveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { app_base_url?: string; retention_days?: number; vault_threshold_mb?: number }) => d)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { error } = await (context.supabase as any).rpc("backup_settings_update", {
      _app_base_url: data.app_base_url ?? null,
      _retention_days: data.retention_days ?? null,
      _vault_threshold_mb: data.vault_threshold_mb ?? null,
    });
    if (error) throw error;
    return { ok: true };
  });

/** Download a run's JSON (pulls it back from FileVault first if needed). */
export const backupDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { run_id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { rehydrateFromVault } = await import("./backup.server");
    await rehydrateFromVault(data.run_id);
    const { data: row, error } = await (context.supabase as any)
      .from("backup_runs")
      .select("file_name, payload")
      .eq("id", data.run_id)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Backup not found");
    return { file_name: row.file_name ?? `backup-${data.run_id}.json`, json: JSON.stringify(row.payload) };
  });
