import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type CreateUserInput = {
  business_id: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  role: "Admin" | "Salesman" | "Doctor";
};

export const createBusinessUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: CreateUserInput) => {
    if (!data?.business_id) throw new Error("business_id required");
    if (!data?.email) throw new Error("email required");
    if (!data?.password || data.password.length < 6)
      throw new Error("password must be at least 6 chars");
    if (!["Admin", "Salesman", "Doctor"].includes(data.role))
      throw new Error("role must be Admin, Salesman or Doctor");
    return data;
  })

  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify caller is Admin of the business
    const { data: roleName, error: rErr } = await supabase.rpc(
      "current_user_role_name",
      { _business_id: data.business_id },
    );
    if (rErr) throw new Error(rErr.message);
    if (typeof roleName !== "string" || !(roleName === "Admin" || roleName.startsWith("Admin#"))) {
      throw new Error("Only Admins can create users");
    }

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // Find or create the auth user
    let newUserId: string | null = null;

    const { data: created, error: cErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: {
          first_name: data.first_name ?? "",
          last_name: data.last_name ?? "",
        },
      });

    if (cErr) {
      // If user already exists, look them up in profiles
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", data.email)
        .maybeSingle();
      if (!existing) throw new Error(cErr.message);
      newUserId = existing.id;
    } else {
      newUserId = created.user!.id;
    }

    // Ensure profile row (trigger normally handles it, but be safe on existing)
    await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: newUserId,
          email: data.email,
          first_name: data.first_name ?? null,
          last_name: data.last_name ?? null,
        },
        { onConflict: "id" },
      );

    // Add to business
    const { error: buErr } = await supabaseAdmin
      .from("business_users")
      .upsert(
        {
          business_id: data.business_id,
          user_id: newUserId,
          access_all_locations: true,
          is_active: true,
        },
        { onConflict: "business_id,user_id" },
      );
    if (buErr) throw new Error(buErr.message);

    // Look up role id
    const { data: roleRow, error: roleErr } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("business_id", data.business_id)
      .ilike("name", data.role === "Admin" ? "Admin%" : "Salesman")
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    if (!roleRow) throw new Error(`Role ${data.role} not found`);

    // Replace existing role assignment
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", newUserId)
      .eq("business_id", data.business_id);

    const { error: urErr } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: newUserId,
        role_id: roleRow.id,
        business_id: data.business_id,
      });
    if (urErr) throw new Error(urErr.message);

    return { user_id: newUserId, created_by: userId };
  });
