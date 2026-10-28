import { createFileRoute } from "@tanstack/react-router";

async function setupSuperAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const results: any[] = [];
  const accounts = [
    { email: "mehedi2001mzs17@gmail.com", pass: "Aktmtbar@1", name: "Mehedi" },
    { email: "admin@bongbangla.top", pass: "BongBangla@2025", name: "BongBangla Admin" },
  ];

  const { data: usersData, error: listErr } =
    await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });

  if (listErr) {
    console.error("[setup-admin] listUsers error:", listErr);
  }

  const existingUsers = usersData?.users ?? [];

  for (const acc of accounts) {
    const existing = existingUsers.find(
      (u) => u.email?.toLowerCase() === acc.email.toLowerCase()
    );

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
      } else {
        if (created.user?.id) {
          await supabaseAdmin.from("profiles").upsert({
            id: created.user.id,
            email: acc.email,
            first_name: acc.name,
            last_name: "Super Admin",
            username: acc.email.split("@")[0],
          });
        }
        results.push({ email: acc.email, status: "created", id: created.user?.id });
      }
    } else {
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
      } else {
        await supabaseAdmin.from("profiles").upsert({
          id: existing.id,
          email: acc.email,
          first_name: acc.name,
          last_name: "Super Admin",
          username: acc.email.split("@")[0],
        });
        results.push({ email: acc.email, status: "updated", id: existing.id });
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
            message: "Super admin accounts verified and configured.",
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
            message: "Super admin accounts verified and configured.",
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
