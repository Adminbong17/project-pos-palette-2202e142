import { createFileRoute } from "@tanstack/react-router";

async function setupSuperAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const results: any[] = [];
  const accounts = [
    { email: "mehedi2001mzs17@gmail.com", pass: "Aktmtbar@1", name: "Mehedi" },
  ];

  const { data: usersData, error: listErr } =
    await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });

  if (listErr) {
    console.error("[setup-admin] listUsers error:", listErr);
  }

  const existingUsers = usersData?.users ?? [];

  // 1. Detect and clean up duplicate accounts for admin@bongbangla.top
  const bongbanglaUsers = existingUsers.filter(
    (u) => u.email?.toLowerCase() === "admin@bongbangla.top"
  );

  let primaryBongbanglaId: string | null = null;
  if (bongbanglaUsers.length > 0) {
    // Sort to keep the account with the most recent sign-in or creation
    const sorted = [...bongbanglaUsers].sort((a, b) => {
      const aTime = new Date(a.last_sign_in_at || a.created_at || 0).getTime();
      const bTime = new Date(b.last_sign_in_at || b.created_at || 0).getTime();
      return bTime - aTime;
    });

    const primary = sorted[0];
    primaryBongbanglaId = primary.id;

    // Ensure is_super_admin: false on the store admin
    await supabaseAdmin.auth.admin.updateUserById(primary.id, {
      user_metadata: {
        ...(primary.user_metadata ?? {}),
        is_super_admin: false,
      },
    });
    results.push({ email: primary.email, status: "primary_bongbangla_retained", id: primary.id });

    // Remove duplicate/ghost auth accounts if more than one exists
    for (let i = 1; i < sorted.length; i++) {
      const dup = sorted[i];
      try {
        await supabaseAdmin
          .from("business_users")
          .update({ user_id: primary.id })
          .eq("user_id", dup.id);
        await supabaseAdmin
          .from("user_roles")
          .update({ user_id: primary.id })
          .eq("user_id", dup.id);
        await supabaseAdmin
          .from("businesses")
          .update({ owner_id: primary.id })
          .eq("owner_id", dup.id);
        await supabaseAdmin.from("profiles").delete().eq("id", dup.id);
        await supabaseAdmin.auth.admin.deleteUser(dup.id);
        results.push({ email: dup.email, status: "duplicate_auth_deleted", id: dup.id });
      } catch (err: any) {
        console.error("Error deleting duplicate user:", err);
      }
    }
  }

  // 2. Primary business on platform
  const { data: primaryBiz } = await supabaseAdmin
    .from("businesses")
    .select("id, name")
    .limit(1)
    .maybeSingle();

  // 3. Admin role on platform
  const { data: adminRole } = await supabaseAdmin
    .from("roles")
    .select("id")
    .eq("name", "Admin")
    .limit(1)
    .maybeSingle();

  // 4. Deduplicate business_users table (ensure no user has multiple rows in the same business)
  const { data: allBU } = await supabaseAdmin
    .from("business_users")
    .select("id, business_id, user_id, is_active");

  const seenBU = new Map<string, string>();
  const buToDelete: string[] = [];
  for (const bu of allBU ?? []) {
    const key = `${bu.business_id}:${bu.user_id}`;
    if (seenBU.has(key)) {
      buToDelete.push(bu.id);
    } else {
      seenBU.set(key, bu.id);
    }
  }
  if (buToDelete.length > 0) {
    for (const id of buToDelete) {
      await supabaseAdmin.from("business_users").delete().eq("id", id);
    }
    results.push({ status: "cleaned_duplicate_business_users", count: buToDelete.length });
  }

  // 5. Restore full access for admin@bongbangla.top in their store so they are not Locked
  if (primaryBongbanglaId && primaryBiz?.id) {
    await supabaseAdmin
      .from("user_roles")
      .update({ allowed_sections: null }) // null = full store access
      .eq("user_id", primaryBongbanglaId)
      .eq("business_id", primaryBiz.id);
    results.push({ email: "admin@bongbangla.top", status: "unlocked_full_store_access" });
  }

  // 6. Ensure Sole Super Admin (Mehedi) is provisioned
  for (const acc of accounts) {
    const existing = existingUsers.find(
      (u) => u.email?.toLowerCase() === acc.email.toLowerCase()
    );

    let uid: string | null = null;

    if (!existing) {
      const { data: created, error: createErr } =
        await supabaseAdmin.auth.admin.createUser({
          email: acc.email,
          password: acc.pass,
          email_confirm: true,
          user_metadata: {
            first_name: acc.name,
            last_name: "Super Admin",
            managed_password: acc.pass,
            is_super_admin: true,
          },
        });

      if (createErr) {
        results.push({ email: acc.email, status: "error", error: createErr.message });
        continue;
      }
      uid = created.user?.id ?? null;
      results.push({ email: acc.email, status: "created", id: uid });
    } else {
      uid = existing.id;
      const { error: updateErr } =
        await supabaseAdmin.auth.admin.updateUserById(existing.id, {
          password: acc.pass,
          email_confirm: true,
          user_metadata: {
            ...(existing.user_metadata ?? {}),
            managed_password: acc.pass,
            is_super_admin: true,
          },
        });

      if (updateErr) {
        results.push({ email: acc.email, status: "error", error: updateErr.message });
        continue;
      }
      results.push({ email: acc.email, status: "updated", id: uid });
    }

    if (uid) {
      await supabaseAdmin.from("profiles").upsert({
        id: uid,
        email: acc.email,
        first_name: acc.name,
        last_name: "Super Admin",
        username: acc.email.split("@")[0],
        current_business_id: primaryBiz?.id ?? null,
      });

      if (primaryBiz?.id) {
        await supabaseAdmin.from("business_users").upsert({
          business_id: primaryBiz.id,
          user_id: uid,
          is_active: true,
        });

        if (adminRole?.id) {
          await supabaseAdmin.from("user_roles").upsert({
            business_id: primaryBiz.id,
            user_id: uid,
            role_id: adminRole.id,
          });
        }
      }
    }
  }

  return results;
}

export const Route = createFileRoute("/api/public/setup-admin")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const results = await setupSuperAdmin();
          return Response.json({
            ok: true,
            message: "Database deduplication and Sole Super Admin verified.",
            results,
          });
        } catch (e: any) {
          console.error("[setup-admin] handler failed:", e);
          return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
        }
      },
      POST: async () => {
        try {
          const results = await setupSuperAdmin();
          return Response.json({
            ok: true,
            message: "Database deduplication and Sole Super Admin verified.",
            results,
          });
        } catch (e: any) {
          console.error("[setup-admin] handler failed:", e);
          return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
        }
      },
    },
  },
});
