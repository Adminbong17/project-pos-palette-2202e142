import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { staffUsernameToEmail, normalizeStaffUsername } from "@/lib/rx-staff";
import { SUPABASE_PUBLIC_URL, SUPABASE_PUBLIC_KEY } from "@/integrations/supabase/public-config";

type CreateStaffInput = {
  business_id: string;
  name: string;
  username: string;
  password: string;
  phone?: string;
  chamber_id?: string | null;
};

function hasServiceRole() {
  return !!(process.env["SUPABASE_SERVICE_ROLE_KEY"] || process.env["SERVICE_ROLE_KEY"]);
}

function publicServerClient() {
  const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || SUPABASE_PUBLIC_URL;
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    SUPABASE_PUBLIC_KEY;
  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const createRxStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: CreateStaffInput) => {
    if (!data?.business_id) throw new Error("business_id required");
    if (!data?.name?.trim()) throw new Error("Staff name is required");
    const username = normalizeStaffUsername(data.username);
    if (!/^[a-z0-9._-]{3,32}$/.test(username))
      throw new Error("Username must be 3-32 chars: letters, numbers, . _ -");
    if (!data?.password || data.password.length < 6)
      throw new Error("Password must be at least 6 characters");
    return { ...data, username };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: member, error: mErr } = await supabase
      .from("business_users")
      .select("id")
      .eq("business_id", data.business_id)
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!member) throw new Error("You are not a member of this business");

    const email = staffUsernameToEmail(data.username);
    const name = data.name.trim();

    let staffUserId: string | null = null;

    if (hasServiceRole()) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
        user_metadata: { first_name: name },
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
    } else {
      // No service-role key available (e.g. self-hosted deploy): sign the staff
      // account up with the public key instead, then wire it up via RPC.
      const anon = publicServerClient();
      const { data: signed, error: sErr } = await anon.auth.signUp({
        email,
        password: data.password,
        options: { data: { first_name: name } },
      });
      if (sErr) {
        if (/already/i.test(sErr.message))
          throw new Error("This username is already taken. Choose another one.");
        throw new Error(sErr.message);
      }
      staffUserId = signed.user?.id ?? null;
      if (!staffUserId) throw new Error("Could not create the staff login. Try another username.");
    }

    const { error: pErr } = await supabase.rpc("provision_rx_staff", {
      _business_id: data.business_id,
      _user_id: staffUserId,
      _email: email,
      _name: name,
      _phone: data.phone?.trim() || "",
      _username: data.username,
      _chamber_id: data.chamber_id || null,
    });
    if (pErr) throw new Error(pErr.message);

    return { user_id: staffUserId, email };
  });


export const setRxStaffPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { staff_id: string; password: string }) => {
    if (!data?.staff_id) throw new Error("staff_id required");
    if (!data?.password || data.password.length < 6)
      throw new Error("Password must be at least 6 characters");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { data: staff, error } = await context.supabase
      .from("rx_staff")
      .select("id, user_id")
      .eq("id", data.staff_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!staff?.user_id) throw new Error("Staff not found or not accessible");

    if (!hasServiceRole())
      throw new Error(
        "Password change needs the SUPABASE_SERVICE_ROLE_KEY on this deployment. Ask the staff member to use \"Forgot password\", or remove and re-create the account with a new password.",
      );

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: uErr } = await supabaseAdmin.auth.admin.updateUserById(staff.user_id, {
      password: data.password,
    });
    if (uErr) throw new Error(uErr.message);
    return { ok: true };
  });

export const removeRxStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { staff_id: string }) => {
    if (!data?.staff_id) throw new Error("staff_id required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("deactivate_rx_staff", {
      _staff_id: data.staff_id,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

