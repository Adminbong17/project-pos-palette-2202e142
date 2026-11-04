import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { assertSuperAdmin } from "@/lib/super-admin-auth";

export type UserBizMembership = {
  business_id: string;
  business_name: string;
  sections: string[] | null;
  role: string | null;
};

export type SuperAdminUser = {
  id: string;
  email: string;
  username: string | null;
  name: string;
  doctor_name: string | null;
  doctor_qualification?: string | null;
  phone: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  managed_password: string | null;
  businesses: string[];
  roles: string[];
  disabled: boolean;
  business_memberships: UserBizMembership[];
  primary_business_id?: string | null;
  primary_role?: string | null;
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

    // Deduplicate auth users by email so multiple ghost/duplicate IDs for the same email don't duplicate rows
    const usersByEmail = new Map<string, any>();
    for (const u of authUsers) {
      const email = String(u.email ?? "").toLowerCase().trim();
      if (!email) {
        usersByEmail.set(u.id, u);
        continue;
      }
      const existing = usersByEmail.get(email);
      if (!existing) {
        usersByEmail.set(email, u);
      } else {
        const existingTime = new Date(existing.last_sign_in_at || existing.created_at || 0).getTime();
        const currentTime = new Date(u.last_sign_in_at || u.created_at || 0).getTime();
        if (currentTime > existingTime) {
          usersByEmail.set(email, u);
        }
      }
    }
    const distinctAuthUsers = Array.from(usersByEmail.values());

    const [{ data: profiles }, { data: members }, { data: businesses }, { data: roles }, { data: userRoles }] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("id, email, username, first_name, last_name, doctor_name, doctor_qualification, phone, current_business_id"),
        supabaseAdmin.from("business_users").select("user_id, business_id, is_active"),
        supabaseAdmin.from("businesses").select("id, name"),
        supabaseAdmin.from("roles").select("id, name"),
        supabaseAdmin.from("user_roles").select("user_id, role_id, business_id, allowed_sections"),
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

    const membershipsByUser = new Map<string, UserBizMembership[]>();
    for (const m of members ?? []) {
      if ((m as any).is_active === false) continue;
      const ur = (userRoles ?? []).find(
        (r: any) => r.user_id === m.user_id && r.business_id === m.business_id,
      );
      const list = membershipsByUser.get(m.user_id) ?? [];
      const roleStr = ur?.role_id ? (roleName.get(ur.role_id) ?? null) : null;
      list.push({
        business_id: m.business_id,
        business_name: bizName.get(m.business_id) ?? m.business_id,
        sections: (ur?.allowed_sections as string[] | null) ?? null,
        role: roleStr ? String(roleStr).split("#")[0] : null,
      });
      membershipsByUser.set(m.user_id, list);
    }

    return distinctAuthUsers
      .map((u) => {
        const p: any = profileById.get(u.id) ?? {};
        const name =
          [p.first_name, p.last_name].filter(Boolean).join(" ") ||
          (u.user_metadata?.first_name
            ? [u.user_metadata?.first_name, u.user_metadata?.last_name].filter(Boolean).join(" ")
            : "") ||
          "—";
        const mems = membershipsByUser.get(u.id) ?? [];
        const primaryBizId = p.current_business_id || mems[0]?.business_id || null;
        const userRolesList = rolesByUser.get(u.id) ? Array.from(rolesByUser.get(u.id)!) : [];
        const primaryRole = userRolesList[0] || mems[0]?.role || null;

        return {
          id: u.id,
          email: u.email ?? p.email ?? "—",
          username: p.username ?? null,
          name,
          doctor_name: p.doctor_name ?? null,
          doctor_qualification: p.doctor_qualification ?? null,
          phone: p.phone ?? u.phone ?? null,
          created_at: u.created_at ?? null,
          last_sign_in_at: u.last_sign_in_at ?? null,
          // Only visible when an admin set it through this panel.
          managed_password: (u.user_metadata?.managed_password as string | undefined) ?? null,
          businesses: [...(bizByUser.get(u.id) ?? [])],
          roles: userRolesList,
          disabled: !!(u.banned_until && new Date(u.banned_until as string).getTime() > Date.now()),
          business_memberships: mems,
          primary_business_id: primaryBizId,
          primary_role: primaryRole,
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

/**
 * Super Admin: Get simple list of all businesses for dropdown selection.
 */
export const listAllSimpleBusinesses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("businesses")
      .select("id, name")
      .order("name");
    return (data ?? []) as { id: string; name: string }[];
  });

/**
 * Super Admin: Edit user account details (Email, Username, Name, Phone, Business, Role).
 */
export const updateSuperAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      user_id: string;
      email?: string;
      username?: string;
      name?: string;
      doctor_qualification?: string;
      phone?: string;
      business_id?: string;
      role?: string;
    }) => {
      if (!data?.user_id) throw new Error("user_id required");
      return data;
    }
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Email update
    if (data.email && data.email.trim()) {
      const cleanEmail = data.email.trim().toLowerCase();
      try {
        const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
          email: cleanEmail,
          email_confirm: true,
        });
        if (authErr) throw authErr;
      } catch (err: any) {
        throw new Error(`ইমেইল আপডেট করা যায়নি: ${err?.message || err}`);
      }

      await supabaseAdmin
        .from("profiles")
        .update({ email: cleanEmail })
        .eq("id", data.user_id);
    }

    // 2. Username update
    if (data.username !== undefined) {
      const cleanUsername = data.username.trim() || null;
      await supabaseAdmin
        .from("profiles")
        .update({ username: cleanUsername })
        .eq("id", data.user_id);

      try {
        await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
          user_metadata: { username: cleanUsername },
        });
      } catch {}
    }

    // 3. Name & Phone update
    const profUpdates: any = {};
    if (data.name !== undefined) {
      const cleanName = data.name.trim();
      const parts = cleanName.split(/\s+/);
      const firstName = parts[0] || "";
      const lastName = parts.slice(1).join(" ") || "";
      profUpdates.first_name = firstName;
      profUpdates.last_name = lastName;
      profUpdates.doctor_name = cleanName;

      try {
        await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
          user_metadata: {
            first_name: firstName,
            last_name: lastName,
            name: cleanName,
            doctor_name: cleanName,
          },
        });
      } catch {}
    }

    if (data.doctor_qualification !== undefined) {
      const cleanQual = data.doctor_qualification.trim() || null;
      profUpdates.doctor_qualification = cleanQual;
      try {
        await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
          user_metadata: { doctor_qualification: cleanQual },
        });
      } catch {}
    }

    if (data.phone !== undefined) {
      profUpdates.phone = data.phone.trim() || null;
      try {
        if (data.phone.trim()) {
          await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
            phone: data.phone.trim(),
          });
        }
      } catch {}
    }

    if (Object.keys(profUpdates).length > 0) {
      await supabaseAdmin
        .from("profiles")
        .update(profUpdates)
        .eq("id", data.user_id);
    }

    // 4. Business update
    let targetBizId = data.business_id;

    if (targetBizId) {
      await supabaseAdmin
        .from("business_users")
        .update({ is_active: false })
        .eq("user_id", data.user_id)
        .neq("business_id", targetBizId);

      await supabaseAdmin
        .from("business_users")
        .upsert(
          { business_id: targetBizId, user_id: data.user_id, is_active: true },
          { onConflict: "business_id,user_id" },
        );

      await supabaseAdmin
        .from("profiles")
        .update({ current_business_id: targetBizId })
        .eq("id", data.user_id);
    } else {
      const { data: curBiz } = await supabaseAdmin
        .from("business_users")
        .select("business_id")
        .eq("user_id", data.user_id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (curBiz?.business_id) {
        targetBizId = curBiz.business_id;
      }
    }

    // 5. Role update
    if (targetBizId && data.role && data.role.trim()) {
      const cleanRole = data.role.trim();

      let { data: roleRow } = await supabaseAdmin
        .from("roles")
        .select("id")
        .eq("business_id", targetBizId)
        .ilike("name", `${cleanRole}%`)
        .limit(1)
        .maybeSingle();

      if (!roleRow) {
        const { data: newRole } = await supabaseAdmin
          .from("roles")
          .insert({
            business_id: targetBizId,
            name: cleanRole,
            is_default: false,
          })
          .select("id")
          .single();
        roleRow = newRole;
      }

      if (roleRow?.id) {
        const { data: existingUr } = await supabaseAdmin
          .from("user_roles")
          .select("id")
          .eq("business_id", targetBizId)
          .eq("user_id", data.user_id)
          .maybeSingle();

        if (existingUr) {
          await supabaseAdmin
            .from("user_roles")
            .update({ role_id: roleRow.id })
            .eq("id", existingUr.id);
        } else {
          await supabaseAdmin
            .from("user_roles")
            .insert({
              business_id: targetBizId,
              user_id: data.user_id,
              role_id: roleRow.id,
              allowed_sections: null,
            });
        }
      }
    }

    return { ok: true };
  });
