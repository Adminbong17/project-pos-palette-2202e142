import { createServerFn } from "@tanstack/react-start";
import { isSuperAdminEmail } from "@/lib/super-admin-auth";

export const ensureSuperAdminCredentials = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; password?: string }) => d)
  .handler(async ({ data }) => {
    const email = data.email?.trim().toLowerCase();
    if (!isSuperAdminEmail(email)) {
      return { ok: false, error: "Not a designated super admin email" };
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const targetPass = data.password || "Aktmtbar@1";

      // 1. List users to check if user already exists
      const { data: usersData, error: listErr } =
        await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });

      if (listErr) {
        console.error("[ensureSuperAdmin] listUsers error:", listErr);
      }

      const existing = usersData?.users?.find(
        (u) => u.email?.toLowerCase() === email
      );

      let targetUserId: string | null = null;

      if (!existing) {
        // Create user with confirmed email
        const { data: created, error: createErr } =
          await supabaseAdmin.auth.admin.createUser({
            email,
            password: targetPass,
            email_confirm: true,
            user_metadata: {
              first_name: "Mehedi",
              last_name: "Super Admin",
              managed_password: targetPass,
              is_super_admin: true,
            },
          });

        if (createErr) {
          console.error("[ensureSuperAdmin] createUser error:", createErr);
          return { ok: false, error: createErr.message };
        }
        targetUserId = created.user?.id ?? null;
      } else {
        targetUserId = existing.id;
        // User already exists: update their password and ensure email is confirmed
        const { error: updateErr } =
          await supabaseAdmin.auth.admin.updateUserById(existing.id, {
            password: targetPass,
            email_confirm: true,
            user_metadata: {
              ...(existing.user_metadata ?? {}),
              managed_password: targetPass,
              is_super_admin: true,
            },
          });

        if (updateErr) {
          console.error("[ensureSuperAdmin] updateUser error:", updateErr);
          return { ok: false, error: updateErr.message };
        }
      }

      if (targetUserId) {
        // Find primary business (e.g. Sheikh Pharma)
        const { data: firstBiz } = await supabaseAdmin
          .from("businesses")
          .select("id")
          .limit(1)
          .maybeSingle();

        const currentBizId = firstBiz?.id ?? null;

        await supabaseAdmin.from("profiles").upsert({
          id: targetUserId,
          email,
          first_name: "Mehedi",
          last_name: "Super Admin",
          username: "mehedi_admin",
          current_business_id: currentBizId,
        });

        if (currentBizId) {
          await supabaseAdmin.from("business_users").upsert({
            business_id: currentBizId,
            user_id: targetUserId,
            is_active: true,
          });

          const { data: adminRole } = await supabaseAdmin
            .from("roles")
            .select("id")
            .eq("name", "Admin")
            .limit(1)
            .maybeSingle();

          if (adminRole?.id) {
            await supabaseAdmin.from("user_roles").upsert({
              business_id: currentBizId,
              user_id: targetUserId,
              role_id: adminRole.id,
            });
          }
        }
      }

      return { ok: true, userId: targetUserId };
    } catch (e: any) {
      console.error("[ensureSuperAdmin] unexpected error:", e);
      return { ok: false, error: String(e?.message ?? e) };
    }
  });
