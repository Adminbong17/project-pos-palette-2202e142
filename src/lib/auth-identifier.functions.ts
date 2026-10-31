import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { SUPER_ADMIN_EMAILS } from "@/lib/super-admin-auth";
import { normalizeStaffUsername, STAFF_EMAIL_DOMAIN } from "@/lib/rx-staff";

/**
 * Resolves a username, phone number, or email prefix entered in the login form
 * to the actual registered Supabase email address.
 */
export const resolveLoginIdentifier = createServerFn({ method: "POST" })
  .inputValidator((d: { identifier: string }) =>
    z.object({ identifier: z.string().min(1).max(200) }).parse(d)
  )
  .handler(async ({ data }) => {
    const raw = (data.identifier ?? "").trim();
    if (!raw) return { email: "" };
    if (raw.includes("@")) return { email: raw.toLowerCase() };

    const clean = raw.toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Check Super Admin email prefix (e.g. mehedi2001mzs17 -> mehedi2001mzs17@gmail.com)
    for (const saEmail of SUPER_ADMIN_EMAILS) {
      const saLower = saEmail.toLowerCase();
      if (saLower.startsWith(`${clean}@`) || clean === "admin" || clean === "superadmin") {
        return { email: saLower };
      }
    }

    // 2. Check profiles table by username (case-insensitive)
    try {
      const { data: profileByUsername } = await supabaseAdmin
        .from("profiles")
        .select("email, username")
        .ilike("username", clean)
        .limit(1);

      if (profileByUsername?.[0]?.email) {
        return { email: profileByUsername[0].email.toLowerCase() };
      }
    } catch {
      // ignore
    }

    // 3. Check rx_staff table by username (e.g. staff created with a username)
    try {
      const { data: staffByUsername } = await supabaseAdmin
        .from("rx_staff")
        .select("username, user_id")
        .ilike("username", clean)
        .limit(1);

      if (staffByUsername?.[0]) {
        if (staffByUsername[0].user_id) {
          const { data: p } = await supabaseAdmin
            .from("profiles")
            .select("email")
            .eq("id", staffByUsername[0].user_id)
            .maybeSingle();
          if (p?.email) return { email: p.email.toLowerCase() };
        }
        return {
          email: `${normalizeStaffUsername(staffByUsername[0].username)}@${STAFF_EMAIL_DOMAIN}`,
        };
      }
    } catch {
      // ignore
    }

    // 4. Check profiles table by email prefix (e.g. username matches prefix before @ in gmail/etc)
    try {
      const { data: profileByPrefix } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .ilike("email", `${clean}@%`)
        .limit(1);

      if (profileByPrefix?.[0]?.email) {
        return { email: profileByPrefix[0].email.toLowerCase() };
      }
    } catch {
      // ignore
    }

    // 5. Check phone number in profiles and rx_staff
    const phoneClean = raw.replace(/\D/g, "");
    if (phoneClean.length >= 10) {
      try {
        const { data: profileByPhone } = await supabaseAdmin
          .from("profiles")
          .select("email")
          .ilike("phone", `%${phoneClean.slice(-10)}%`)
          .limit(1);

        if (profileByPhone?.[0]?.email) {
          return { email: profileByPhone[0].email.toLowerCase() };
        }

        const { data: staffByPhone } = await supabaseAdmin
          .from("rx_staff")
          .select("username, user_id")
          .ilike("phone", `%${phoneClean.slice(-10)}%`)
          .limit(1);

        if (staffByPhone?.[0]) {
          if (staffByPhone[0].user_id) {
            const { data: p } = await supabaseAdmin
              .from("profiles")
              .select("email")
              .eq("id", staffByPhone[0].user_id)
              .maybeSingle();
            if (p?.email) return { email: p.email.toLowerCase() };
          }
          return {
            email: `${normalizeStaffUsername(staffByPhone[0].username)}@${STAFF_EMAIL_DOMAIN}`,
          };
        }
      } catch {
        // ignore
      }
    }

    // 6. Direct auth.users listUsers match (fallback)
    try {
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 100 });
      const matched = usersData?.users?.find((u) => {
        const uEmail = (u.email ?? "").toLowerCase();
        if (uEmail.startsWith(`${clean}@`)) return true;
        const metaUser = String(u.user_metadata?.username ?? "").toLowerCase();
        if (metaUser === clean) return true;
        const uPhone = (u.phone ?? "").replace(/\D/g, "");
        if (phoneClean.length >= 10 && uPhone.endsWith(phoneClean.slice(-10))) return true;
        return false;
      });
      if (matched?.email) {
        return { email: matched.email.toLowerCase() };
      }
    } catch (e) {
      console.warn("[resolveLoginIdentifier] auth.users fallback check error:", e);
    }

    // 7. Fallback to default staff domain email
    return { email: `${normalizeStaffUsername(raw)}@${STAFF_EMAIL_DOMAIN}` };
  });
