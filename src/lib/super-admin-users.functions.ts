import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SUPER_ADMIN_EMAIL = "admin@bongbangla.top";

async function assertSuperAdmin(context: any) {
  let email = String((context?.claims as any)?.email ?? "").toLowerCase();
  if (!email) {
    const { data } = await context.supabase.auth.getUser();
    email = String(data?.user?.email ?? "").toLowerCase();
  }
  if (email !== SUPER_ADMIN_EMAIL) throw new Error("Only the super admin can do this");
}

export type SuperAdminUser = {
  id: string;
  email: string;
  username: string | null;
  name: string;
  doctor_name: string | null;
  phone: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  managed_password: string | null;
  businesses: string[];
  roles: string[];
  disabled: boolean;
};

export const listAllUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SuperAdminUser[]> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Auth users (paged)
    const authUsers: any[] = [];
    for (let page = 1; page <= 40; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      authUsers.push(...(data.users ?? []));
      if ((data.users ?? []).length < 200) break;
    }

    const [{ data: profiles }, { data: members }, { data: businesses }, { data: roles }, { data: userRoles }] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("id, email, username, first_name, last_name, doctor_name"),
        supabaseAdmin.from("business_users").select("user_id, business_id, is_active"),
        supabaseAdmin.from("businesses").select("id, name"),
        supabaseAdmin.from("roles").select("id, name"),
        supabaseAdmin.from("user_roles").select("user_id, role_id, business_id"),
      ]);

    const profileById = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const bizName = new Map((businesses ?? []).map((b: any) => [b.id, b.name]));
    const roleName = new Map((roles ?? []).map((r: any) => [r.id, r.name]));

    const bizByUser = new Map<string, Set<string>>();
    for (const m of members ?? []) {
      if ((m as any).is_active === false) continue; // revoked membership
      const set = bizByUser.get(m.user_id) ?? new Set<string>();
      set.add(bizName.get(m.business_id) ?? m.business_id);
      bizByUser.set(m.user_id, set);
    }
    const rolesByUser = new Map<string, Set<string>>();
    for (const ur of userRoles ?? []) {
      const set = rolesByUser.get(ur.user_id) ?? new Set<string>();
      const n = roleName.get(ur.role_id);
      if (n) set.add(String(n).split("#")[0]);
      rolesByUser.set(ur.user_id, set);
    }

    return authUsers
      .map((u) => {
        const p: any = profileById.get(u.id) ?? {};
        const name =
          [p.first_name, p.last_name].filter(Boolean).join(" ") ||
          (u.user_metadata?.first_name
            ? [u.user_metadata?.first_name, u.user_metadata?.last_name].filter(Boolean).join(" ")
            : "") ||
          "—";
        return {
          id: u.id,
          email: u.email ?? p.email ?? "—",
          username: p.username ?? null,
          name,
          doctor_name: p.doctor_name ?? null,
          phone: u.phone ?? null,
          created_at: u.created_at ?? null,
          last_sign_in_at: u.last_sign_in_at ?? null,
          // Only visible when an admin set it through this panel.
          managed_password: (u.user_metadata?.managed_password as string | undefined) ?? null,
          businesses: [...(bizByUser.get(u.id) ?? [])],
          roles: [...(rolesByUser.get(u.id) ?? [])],
          disabled: !!(u.banned_until && new Date(u.banned_until as string).getTime() > Date.now()),
        };
      })
      .sort((a, b) => a.email.localeCompare(b.email));
  });

export const setUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string; password: string }) => {
    if (!data?.user_id) throw new Error("user_id required");
    if (!data?.password || data.password.length < 6) throw new Error("Password must be at least 6 characters");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: current } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.password,
      user_metadata: { ...(current?.user?.user_metadata ?? {}), managed_password: data.password },
    });
    if (error) throw new Error(error.message);
    return { ok: true, password: data.password };
  });

export const setUserDisabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string; disabled: boolean }) => {
    if (!data?.user_id) throw new Error("user_id required");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    if (data.user_id === context.userId) throw new Error("You cannot disable your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      // 100 years = effectively disabled; "none" re-enables.
      ban_duration: data.disabled ? "876000h" : "none",
    } as any);
    if (error) throw new Error(error.message);

    // Also flag business memberships so app-side checks match.
    await supabaseAdmin
      .from("business_users")
      .update({ is_active: !data.disabled })
      .eq("user_id", data.user_id);

    const { error: staffErr } = await supabaseAdmin
      .from("rx_staff")
      .update({ is_active: !data.disabled } as never)
      .or(`user_id.eq.${data.user_id},doctor_id.eq.${data.user_id}`);
    if (staffErr) throw new Error(staffErr.message);

    return { ok: true, disabled: data.disabled };
  });

export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { user_id: string }) => {
    if (!data?.user_id) throw new Error("user_id required");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    if (data.user_id === context.userId) throw new Error("You cannot delete your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const cleanupResults = await Promise.all([
      supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id),
      supabaseAdmin.from("business_users").delete().eq("user_id", data.user_id),
      supabaseAdmin.from("rx_staff").delete().eq("user_id", data.user_id),
      supabaseAdmin.from("rx_staff").delete().eq("doctor_id", data.user_id),
      supabaseAdmin.from("rx_user_option_settings").delete().eq("user_id", data.user_id),
      supabaseAdmin.from("rx_presets").delete().eq("user_id", data.user_id),
      supabaseAdmin.from("rx_phone_otps").delete().eq("user_id", data.user_id),
      supabaseAdmin.from("rx_billing_accounts").delete().eq("user_id", data.user_id),
      supabaseAdmin.from("rx_bills").delete().eq("user_id", data.user_id),
    ]);
    for (const result of cleanupResults) {
      if (result.error) throw new Error(result.error.message);
    }

    const detachResults = await Promise.all([
      supabaseAdmin.from("rx_appointments").update({ doctor_id: null } as never).eq("doctor_id", data.user_id),
      supabaseAdmin.from("prescriptions").update({ doctor_id: null } as never).eq("doctor_id", data.user_id),
      supabaseAdmin.from("prescriptions").update({ created_by: null } as never).eq("created_by", data.user_id),
      supabaseAdmin.from("clinic_sales").update({ doctor_id: null } as never).eq("doctor_id", data.user_id),
      supabaseAdmin.from("clinic_sales").update({ created_by: null } as never).eq("created_by", data.user_id),
      supabaseAdmin.from("clinic_treatment_plans").update({ doctor_id: null } as never).eq("doctor_id", data.user_id),
      supabaseAdmin.from("clinic_treatment_plans").update({ created_by: null } as never).eq("created_by", data.user_id),
      supabaseAdmin.from("rx_credit_links").update({ user_id: null } as never).eq("user_id", data.user_id),
      supabaseAdmin.from("rx_credit_orders").update({ user_id: null } as never).eq("user_id", data.user_id),
      supabaseAdmin.from("rx_credit_orders").update({ approved_by: null } as never).eq("approved_by", data.user_id),
    ]);
    for (const result of detachResults) {
      if (result.error) throw new Error(result.error.message);
    }

    // businesses.owner_id is NOT NULL with ON DELETE RESTRICT — hand ownership
    // to the super admin doing the deletion so the auth user can be removed.
    await supabaseAdmin
      .from("businesses")
      .update({ owner_id: context.userId } as never)
      .eq("owner_id", data.user_id);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    // Already gone (e.g. a previous partial delete) — clean up leftovers and succeed.
    if (error && !/not found/i.test(error.message)) throw new Error(error.message);
    const { error: profileErr } = await supabaseAdmin.from("profiles").delete().eq("id", data.user_id);
    if (profileErr) throw new Error(profileErr.message);
    return { ok: true };
  });
