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

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("business_users").delete().eq("user_id", data.user_id);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
