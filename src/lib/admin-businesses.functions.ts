import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { assertSuperAdmin } from "@/lib/super-admin-auth";

export type BizMember = {
  user_id: string;
  name: string;
  email: string;
  role: string | null;
  sections: string[] | null;
  is_active: boolean;
};

export type BizRow = {
  id: string;
  name: string;
  kind: string;
  clinic_mode: boolean;
  owner_id: string | null;
  owner_email: string | null;
  members: BizMember[];
};

/** Every business on the platform with its members and module grants. */
export const listBusinessesWithMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BizRow[]> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: businesses }, { data: members }, { data: profiles }, { data: roles }, { data: userRoles }] =
      await Promise.all([
        supabaseAdmin.from("businesses").select("id, name, biz_kind, clinic_mode, owner_id").order("name"),
        supabaseAdmin.from("business_users").select("user_id, business_id, is_active"),
        supabaseAdmin.from("profiles").select("id, email, first_name, last_name, doctor_name"),
        supabaseAdmin.from("roles").select("id, name, business_id"),
        supabaseAdmin.from("user_roles").select("user_id, role_id, business_id, allowed_sections"),
      ]);

    const profileById = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const roleById = new Map((roles ?? []).map((r: any) => [r.id, String(r.name ?? "").split("#")[0]]));

    return (businesses ?? []).map((b: any) => {
      // Removed / revoked members (is_active = false) and members whose account
      // no longer exists must not show up in the super-admin views.
      const rows = (members ?? []).filter(
        (m: any) => m.business_id === b.id && m.is_active !== false && profileById.has(m.user_id),
      );
      const memberList: BizMember[] = rows.map((m: any) => {
        const p: any = profileById.get(m.user_id) ?? {};
        const ur: any = (userRoles ?? []).find(
          (r: any) => r.user_id === m.user_id && r.business_id === b.id,
        );
        return {
          user_id: m.user_id,
          name:
            p.doctor_name ||
            [p.first_name, p.last_name].filter(Boolean).join(" ") ||
            p.email ||
            "—",
          email: p.email ?? "—",
          role: ur?.role_id ? (roleById.get(ur.role_id) ?? null) : null,
          sections: (ur?.allowed_sections as string[] | null) ?? null,
          is_active: !!m.is_active,
        };
      });
      const owner: any = b.owner_id ? profileById.get(b.owner_id) : null;
      return {
        id: b.id,
        name: b.name,
        kind: b.biz_kind ?? "pos",
        clinic_mode: !!b.clinic_mode,
        owner_id: b.owner_id ?? null,
        owner_email: owner?.email ?? null,
        members: memberList.sort((a, z) => a.name.localeCompare(z.name)),
      };
    });
  });

/** Replace the module list of one member (null = full access, [] = no access, string[] = exact modules). */
export const setMemberSections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { business_id: string; user_id: string; sections: string[] | null }) => {
    if (!data?.business_id || !data?.user_id) throw new Error("business_id and user_id required");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Clean up sections list: null = full access; array = strictly that set
    const cleanedSections = Array.isArray(data.sections)
      ? Array.from(new Set(data.sections.filter((s): s is string => typeof s === "string" && s.trim().length > 0)))
      : null;

    // Check if user_role row exists
    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("business_id", data.business_id)
      .eq("user_id", data.user_id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .update({ allowed_sections: cleanedSections })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      // Find role for this business
      const { data: role } = await supabaseAdmin
        .from("roles")
        .select("id")
        .eq("business_id", data.business_id)
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();

      let roleId = role?.id;
      if (!roleId) {
        const { data: newRole, error: roleErr } = await supabaseAdmin
          .from("roles")
          .insert({
            business_id: data.business_id,
            name: "Member",
            is_default: true,
          })
          .select("id")
          .single();
        if (roleErr) throw new Error(roleErr.message);
        roleId = newRole.id;
      }

      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({
          business_id: data.business_id,
          user_id: data.user_id,
          role_id: roleId,
          allowed_sections: cleanedSections,
        });
      if (error) throw new Error(error.message);
    }

    // Ensure user is in business_users if not already active
    await supabaseAdmin
      .from("business_users")
      .upsert(
        { business_id: data.business_id, user_id: data.user_id, is_active: true },
        { onConflict: "business_id,user_id" },
      );

    return { ok: true };
  });

/** Give the same module list to every member of a business. */
export const setBusinessSections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { business_id: string; sections: string[] | null }) => {
    if (!data?.business_id) throw new Error("business_id required");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const cleanedSections = Array.isArray(data.sections)
      ? Array.from(new Set(data.sections.filter((s): s is string => typeof s === "string" && s.trim().length > 0)))
      : null;

    // 1. Update all existing user_roles for this business
    await supabaseAdmin
      .from("user_roles")
      .update({ allowed_sections: cleanedSections })
      .eq("business_id", data.business_id);

    // 2. Fetch all members in business_users for this business
    const { data: members } = await supabaseAdmin
      .from("business_users")
      .select("user_id")
      .eq("business_id", data.business_id)
      .eq("is_active", true);

    const { data: existingRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("business_id", data.business_id);

    const existingUserIds = new Set((existingRoles ?? []).map((r) => r.user_id));
    const missingMembers = (members ?? []).filter((m) => !existingUserIds.has(m.user_id));

    if (missingMembers.length > 0) {
      const { data: role } = await supabaseAdmin
        .from("roles")
        .select("id")
        .eq("business_id", data.business_id)
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();

      let roleId = role?.id;
      if (!roleId) {
        const { data: newRole } = await supabaseAdmin
          .from("roles")
          .insert({
            business_id: data.business_id,
            name: "Member",
            is_default: true,
          })
          .select("id")
          .single();
        roleId = newRole?.id;
      }

      if (roleId) {
        const rowsToInsert = missingMembers.map((m) => ({
          business_id: data.business_id,
          user_id: m.user_id,
          role_id: roleId!,
          allowed_sections: cleanedSections,
        }));
        await supabaseAdmin.from("user_roles").insert(rowsToInsert);
      }
    }

    // 3. Update the default role allowed_sections as well
    await supabaseAdmin
      .from("roles")
      .update({ allowed_sections: cleanedSections })
      .eq("business_id", data.business_id)
      .eq("is_default", true);

    return { ok: true };
  });

/** Move a doctor (and the assistants under them) into their own business. */
export const moveDoctorToOwnBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string; business_name?: string }) => {
    if (!data?.user_id) throw new Error("user_id required");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    // The SQL function checks auth.uid() itself, so it must run as the caller.
    const { data: biz, error } = await context.supabase.rpc("move_doctor_to_own_business", {
      _user_id: data.user_id,
      _business_name: data.business_name?.trim() || undefined,
    } as any);
    if (error) throw new Error(error.message);
    return { business_id: biz as unknown as string };
  });

/**
 * Permanently remove a business/clinic/doctor workspace that is no longer used.
 * Deletes its billing rows, credit links/orders, memberships and roles, then the
 * business itself, so stale entries stop showing up on the admin pages.
 */
export const deleteBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { business_id: string }) => {
    if (!input?.business_id) throw new Error("business_id required");
    return { business_id: input.business_id };
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const id = data.business_id;

    // Credit ledger hangs off billing accounts, so clear it first.
    const { data: accounts } = await supabaseAdmin
      .from("rx_billing_accounts")
      .select("id")
      .eq("business_id", id);
    const accountIds = ((accounts ?? []) as any[]).map((a) => a.id as string);
    if (accountIds.length) {
      await supabaseAdmin.from("rx_credit_ledger").delete().in("account_id", accountIds);
    }

    for (const table of [
      "rx_credit_orders",
      "rx_credit_links",
      "rx_bills",
      "rx_billing_accounts",
      "rx_staff",
      "rx_appointments",
      "rx_chambers",
      "business_users",
      "user_roles",
      "roles",
    ]) {
      await supabaseAdmin.from(table as never).delete().eq("business_id", id);
    }

    const { error } = await supabaseAdmin.from("businesses").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
