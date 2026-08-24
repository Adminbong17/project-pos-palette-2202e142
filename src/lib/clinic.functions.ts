import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { staffUsernameToEmail, normalizeStaffUsername } from "@/lib/rx-staff";
import { SUPABASE_PUBLIC_URL, SUPABASE_PUBLIC_KEY } from "@/integrations/supabase/public-config";

type CreateDoctorInput = {
  business_id: string;
  name: string;
  /** Email, or a plain username that gets a derived login email. */
  login: string;
  password: string;
  phone?: string;
  qualification?: string;
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

/** A clinic admin creates a doctor account inside their own clinic. */
export const createClinicDoctor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: CreateDoctorInput) => {
    if (!data?.business_id) throw new Error("business_id required");
    if (!data?.name?.trim()) throw new Error("Doctor name is required");
    const raw = (data.login ?? "").trim();
    if (!raw) throw new Error("Login email or username is required");
    const email = raw.includes("@") ? raw.toLowerCase() : staffUsernameToEmail(normalizeStaffUsername(raw));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid login");
    if (!data?.password || data.password.length < 6)
      throw new Error("Password must be at least 6 characters");
    return { ...data, email };
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
    if (!member) throw new Error("You are not a member of this clinic");

    const name = data.name.trim();
    let doctorUserId: string | null = null;

    if (hasServiceRole()) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { first_name: name },
      });
      if (cErr) {
        const { data: existing } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("email", data.email)
          .maybeSingle();
        if (!existing) throw new Error(cErr.message);
        doctorUserId = existing.id;
      } else {
        doctorUserId = created.user!.id;
      }
    } else {
      const anon = publicServerClient();
      const { data: signed, error: sErr } = await anon.auth.signUp({
        email: data.email,
        password: data.password,
        options: { data: { first_name: name } },
      });
      if (sErr) {
        if (/already/i.test(sErr.message))
          throw new Error("This login is already taken. Choose another one.");
        throw new Error(sErr.message);
      }
      doctorUserId = signed.user?.id ?? null;
      if (!doctorUserId) throw new Error("Could not create the doctor login. Try another one.");
    }

    const { error: pErr } = await supabase.rpc("provision_clinic_doctor", {
      _business_id: data.business_id,
      _user_id: doctorUserId,
      _email: data.email,
      _name: name,
      _phone: data.phone?.trim() || "",
      _qualification: data.qualification?.trim() || "",
    });
    if (pErr) throw new Error(pErr.message);

    return { user_id: doctorUserId, email: data.email };
  });

/** Reset the password of a doctor that belongs to the caller's clinic. */
export const setClinicDoctorPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { business_id: string; user_id: string; password: string }) => {
    if (!data?.business_id || !data?.user_id) throw new Error("business_id and user_id required");
    if (!data?.password || data.password.length < 6)
      throw new Error("Password must be at least 6 characters");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase
      .from("business_users")
      .select("id")
      .eq("business_id", data.business_id)
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    if (!me) throw new Error("You are not a member of this clinic");

    const { data: target } = await supabase
      .from("business_users")
      .select("id")
      .eq("business_id", data.business_id)
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (!target) throw new Error("This doctor is not part of your clinic");

    if (!hasServiceRole())
      throw new Error("Password change needs the service-role key on this deployment.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Update a clinic doctor's display name, qualification and phone. */
export const updateClinicDoctor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      business_id: string;
      user_id: string;
      name: string;
      qualification?: string;
      phone?: string;
    }) => {
      if (!data?.business_id || !data?.user_id) throw new Error("business_id and user_id required");
      if (!data?.name?.trim()) throw new Error("Doctor name is required");
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase
      .from("business_users")
      .select("id")
      .eq("business_id", data.business_id)
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    if (!me) throw new Error("You are not a member of this clinic");

    const { data: target } = await supabase
      .from("business_users")
      .select("id")
      .eq("business_id", data.business_id)
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (!target) throw new Error("This doctor is not part of your clinic");

    const patch: Record<string, string | null> = {
      doctor_name: data.name.trim(),
      first_name: data.name.trim(),
      doctor_qualification: data.qualification?.trim() || null,
    };
    if (data.phone !== undefined) patch["phone"] = data.phone?.trim() || null;

    const { error } = await supabase.from("profiles").update(patch as any).eq("id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Remove a doctor from the clinic (login stays, clinic access is revoked). */
export const removeClinicDoctor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { business_id: string; user_id: string }) => {
    if (!data?.business_id || !data?.user_id) throw new Error("business_id and user_id required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.user_id === userId) throw new Error("You cannot remove your own account");

    const { data: me } = await supabase
      .from("business_users")
      .select("id")
      .eq("business_id", data.business_id)
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    if (!me) throw new Error("You are not a member of this clinic");

    // Drop assistants working under this doctor first.
    const { data: staff } = await supabase
      .from("rx_staff")
      .select("id")
      .eq("business_id", data.business_id)
      .eq("doctor_id", data.user_id);
    for (const s of staff ?? []) {
      await supabase.rpc("deactivate_rx_staff", { _staff_id: s.id });
    }

    await supabase
      .from("user_roles")
      .delete()
      .eq("business_id", data.business_id)
      .eq("user_id", data.user_id);

    const { error } = await supabase
      .from("business_users")
      .update({ is_active: false })
      .eq("business_id", data.business_id)
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
