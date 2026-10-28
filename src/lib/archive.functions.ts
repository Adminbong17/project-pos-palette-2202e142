// Archive controls + live reads of archived (vault) data.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertSuperAdmin as checkSuperAdmin } from "@/lib/super-admin-auth";

type Grp = "sales" | "prescriptions" | "lab_reports" | "appointments" | "expenses";
const GROUPS: Grp[] = ["sales", "prescriptions", "lab_reports", "appointments", "expenses"];

async function assertSuperAdmin(supabase: any, userId: string, context?: any) {
  if (context) {
    await checkSuperAdmin(context);
    return;
  }
  const { data } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (!data) throw new Error("Only the super admin can manage archives");
}

/** Any business member: read archived rows straight from the vault. */
export const getArchivedRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { business_id: string; grp: Grp; from?: string | null; to?: string | null; key?: string | null }) => {
    if (!GROUPS.includes(d.grp)) throw new Error("Invalid group");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { data: ok } = await (context.supabase as any).rpc("is_business_member", {
      _user_id: context.userId,
      _business_id: data.business_id,
    });
    if (!ok) throw new Error("Forbidden");
    const { fetchArchivedRows } = await import("./archive.server");
    return fetchArchivedRows({
      businessId: data.business_id,
      grp: data.grp,
      from: data.from,
      to: data.to,
      key: data.key,
    });
  });

export const archiveList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId, context);
    const { data, error } = await (context.supabase as any)
      .from("archive_chunks")
      .select("id, business_id, grp, period_month, row_count, bytes, status, created_at, businesses(name)")
      .order("period_month", { ascending: false })
      .limit(500);
    if (error) throw error;
    return data ?? [];
  });

export const archiveRunNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { force?: boolean } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId, context);
    const { runArchive } = await import("./archive.server");
    return runArchive({ force: !!data.force });
  });

export const archiveRestore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { restoreChunk } = await import("./archive.server");
    return restoreChunk(data.id);
  });
