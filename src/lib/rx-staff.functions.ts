import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STAFF_EMAIL_DOMAIN = "staff.qweekpos.app";

export function staffUsernameToEmail(username: string) {
  return `${username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "")}@${STAFF_EMAIL_DOMAIN}`;
}

type CreateStaffInput = {
  business_id: string;
  name: string;
  username: string;
  password: string;
  phone?: string;
};

type SetPasswordInput = { staff_id: string; password: string };
type RemoveStaffInput = { staff_id: string };

/** Caller must be a Doctor or Admin of the business. Returns the role id for assistants. */
async function assertDoctorOrAdmin(
  supabase: any,
  businessId: string,
): Promise<void> {
  const { data: member, error: mErr } = await supabase
    .from("business_users")
    .select("id")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .maybeSingle();
  if (mErr) throw new Error(mErr.message);
  if (!member) throw new Error("You are not a member of this business");
}

export const createRxStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: CreateStaffInput) => {
    if (!data?.business_id) throw new Error("business_id required");
    if (!data?.name?.trim()) throw new Error("Staff name is required");
    const username = (data.username ?? "").trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,32}$/.test(username))
      throw new Error("Username must be 3-32 chars: letters, numbers, . _ -");
    if (!data?.password || data.password.length < 6)
      throw new Error("Password must be at least 6 characters");
    return { ...data, username };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertDoctorOrAdmin(supabase, data.business_id);

    const email = staffUsernameToEmail(data.username);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let staffUserId: string | null = null;
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { first_name: data.name.trim() },
    });
    if (cErr) {
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (!existing) throw new Error(cErr.message);
      staffUserId = existing.id;
    } else {
      staffUserId = created.user!.id;
    }

    await supabaseAdmin.from("profiles").upsert(
      { id: staffUserId, email, first_name: data.name.trim() },
      { onConflict: "id" },
    );

    const { error: buErr } = await supabaseAdmin.from("business_users").upsert(
      {
        business_id: data.business_id,
        user_id: staffUserId,
        access_all_locations: true,
        is_active: true,
      },
      { onConflict: "business_id,user_id" },
    );
    if (buErr) throw new Error(buErr.message);

    // Assistant role (queue only)
    const { data: roleRow } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("business_id", data.business_id)
      .ilike("name", "Assistant")
      .maybeSingle();

    let roleId = roleRow?.id ?? null;
    if (!roleId) {
      const { data: newRole, error: nrErr } = await supabaseAdmin
        .from("roles")
        .insert({
          business_id: data.business_id,
          name: "Assistant",
          is_default: false,
          allowed_sections: ["rx-queue"],
        })
        .select("id")
        .single();
      if (nrErr) throw new Error(nrErr.message);
      roleId = newRole.id;
    }

    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", staffUserId)
      .eq("business_id", data.business_id);

    const { error: urErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: staffUserId,
      role_id: roleId,
      business_id: data.business_id,
      allowed_sections: ["rx-queue"],
    });
    if (urErr) throw new Error(urErr.message);

    const { error: sErr } = await supabaseAdmin.from("rx_staff").upsert(
      {
        business_id: data.business_id,
        doctor_id: userId,
        user_id: staffUserId,
        name: data.name.trim(),
        phone: data.phone?.trim() || null,
        username: data.username,
        is_active: true,
      },
      { onConflict: "business_id,username" },
    );
    if (sErr) throw new Error(sErr.message);

    return { user_id: staffUserId, email };
  });

export const setRxStaffPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: SetPasswordInput) => {
    if (!data?.staff_id) throw new Error("staff_id required");
    if (!data?.password || data.password.length < 6)
      throw new Error("Password must be at least 6 characters");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: staff, error } = await supabase
      .from("rx_staff")
      .select("id, user_id, business_id")
      .eq("id", data.staff_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!staff?.user_id) throw new Error("Staff not found or not accessible");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: uErr } = await supabaseAdmin.auth.admin.updateUserById(staff.user_id, {
      password: data.password,
    });
    if (uErr) throw new Error(uErr.message);
    return { ok: true };
  });

export const removeRxStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: RemoveStaffInput) => {
    if (!data?.staff_id) throw new Error("staff_id required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: staff, error } = await supabase
      .from("rx_staff")
      .select("id, user_id, business_id")
      .eq("id", data.staff_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!staff) throw new Error("Staff not found or not accessible");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (staff.user_id) {
      await supabaseAdmin
        .from("business_users")
        .update({ is_active: false })
        .eq("business_id", staff.business_id)
        .eq("user_id", staff.user_id);
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("business_id", staff.business_id)
        .eq("user_id", staff.user_id);
    }
    const { error: dErr } = await supabaseAdmin.from("rx_staff").delete().eq("id", staff.id);
    if (dErr) throw new Error(dErr.message);
    return { ok: true };
  });
