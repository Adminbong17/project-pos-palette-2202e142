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
      // Deduplicate members by user_id and email so duplicate rows never appear for the same member.
      const seenUserIds = new Set<string>();
      const seenEmails = new Set<string>();
      const rows = (members ?? []).filter((m: any) => {
        if (m.business_id !== b.id || m.is_active === false) return false;
        if (!profileById.has(m.user_id)) return false;
        if (seenUserIds.has(m.user_id)) return false;
        seenUserIds.add(m.user_id);
        const p: any = profileById.get(m.user_id);
        const email = String(p?.email ?? "").toLowerCase().trim();
        if (email && email !== "—") {
          if (seenEmails.has(email)) return false;
          seenEmails.add(email);
        }
        return true;
      });

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

/** Remove a member from a business, with optional account deletion. */
export const removeMemberFromBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { business_id: string; user_id: string; deleteAccount?: boolean }) => {
    if (!data?.business_id || !data?.user_id) throw new Error("business_id and user_id required");
    return data;
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Remove user_roles for this business
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("business_id", data.business_id)
      .eq("user_id", data.user_id);

    // Remove business_users for this business
    await supabaseAdmin
      .from("business_users")
      .delete()
      .eq("business_id", data.business_id)
      .eq("user_id", data.user_id);

    if (data.deleteAccount) {
      if (data.user_id === context.userId) {
        throw new Error("You cannot delete your own super admin account");
      }
      // Reassign business ownership if they own any business
      await supabaseAdmin
        .from("businesses")
        .update({ owner_id: context.userId } as never)
        .eq("owner_id", data.user_id);

      await supabaseAdmin.from("profiles").delete().eq("id", data.user_id);
      await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    }

    return { ok: true };
  });

/**
 * Scan the database and purge duplicate / ghost auth accounts and duplicate business memberships.
 */
export const purgeGhostAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const report: string[] = [];

    // 1. Fetch all auth users
    const authUsers: any[] = [];
    for (let page = 1; page <= 40; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) break;
      authUsers.push(...(data.users ?? []));
      if ((data.users ?? []).length < 200) break;
    }

    // 2. Find duplicate emails in auth users
    const usersByEmail = new Map<string, any[]>();
    for (const u of authUsers) {
      const email = String(u.email ?? "").toLowerCase().trim();
      if (!email) continue;
      const list = usersByEmail.get(email) ?? [];
      list.push(u);
      usersByEmail.set(email, list);
    }

    for (const [email, list] of usersByEmail.entries()) {
      if (list.length > 1) {
        // Sort to keep the active one
        const sorted = [...list].sort((a, b) => {
          const aTime = new Date(a.last_sign_in_at || a.created_at || 0).getTime();
          const bTime = new Date(b.last_sign_in_at || b.created_at || 0).getTime();
          return bTime - aTime;
        });
        const primary = sorted[0];

        for (let i = 1; i < sorted.length; i++) {
          const dup = sorted[i];
          try {
            await supabaseAdmin.from("business_users").update({ user_id: primary.id }).eq("user_id", dup.id);
            await supabaseAdmin.from("user_roles").update({ user_id: primary.id }).eq("user_id", dup.id);
            await supabaseAdmin.from("businesses").update({ owner_id: primary.id }).eq("owner_id", dup.id);
            await supabaseAdmin.from("profiles").delete().eq("id", dup.id);
            await supabaseAdmin.auth.admin.deleteUser(dup.id);
            report.push(`Deleted duplicate auth account for ${email} (ID: ${dup.id})`);
          } catch (e: any) {
            console.error("Purge duplicate user error:", e);
          }
        }
      }
    }

    // 3. Remove duplicate business_users rows (same business_id and user_id)
    const { data: allBU } = await supabaseAdmin.from("business_users").select("id, business_id, user_id");
    const seenBU = new Set<string>();
    let buCleaned = 0;
    for (const bu of allBU ?? []) {
      const key = `${bu.business_id}:${bu.user_id}`;
      if (seenBU.has(key)) {
        await supabaseAdmin.from("business_users").delete().eq("id", bu.id);
        buCleaned++;
      } else {
        seenBU.add(key);
      }
    }
    if (buCleaned > 0) {
      report.push(`Cleaned ${buCleaned} duplicate business_users records`);
    }

    return {
      ok: true,
      report,
      message: report.length ? report.join("; ") : "No ghost accounts or duplicates found.",
    };
  });
