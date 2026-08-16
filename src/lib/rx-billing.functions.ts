import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Sends a 6-digit verification code to the doctor's billing phone number.
 * If no SMS gateway is configured yet, the code is still stored and returned
 * so the admin can pass it on manually.
 */
export const sendRxBillingOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phone: string }) => {
    const phone = String(input?.phone ?? "").replace(/[^\d+]/g, "");
    if (phone.replace(/\D/g, "").length < 11) throw new Error("Enter a valid 11-digit phone number");
    return { phone };
  })
  .handler(async ({ data, context }) => {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const { error } = await context.supabase.from("rx_phone_otps").insert({
      user_id: context.userId,
      phone: data.phone,
      code,
    } as never);
    if (error) throw new Error(error.message);

    const url = process.env["SMS_API_URL"];
    const key = process.env["SMS_API_KEY"];
    const sender = process.env["SMS_SENDER_ID"];
    if (url && key) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: key,
            senderid: sender ?? undefined,
            number: data.phone,
            message: `QweekRx verification code: ${code}`,
          }),
        });
        if (res.ok) return { delivered: true as const };
      } catch {
        /* fall through to manual delivery */
      }
    }
    return { delivered: false as const, code };
  });

/** Verifies the code and stores the phone on the doctor's billing account. */
export const verifyRxBillingOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phone: string; code: string; businessId: string }) => ({
    phone: String(input?.phone ?? "").replace(/[^\d+]/g, ""),
    code: String(input?.code ?? "").trim(),
    businessId: String(input?.businessId ?? ""),
  }))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("rx_phone_otps")
      .select("id, code, expires_at, verified_at")
      .eq("user_id", context.userId)
      .eq("phone", data.phone)
      .is("verified_at", null)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    const otp = rows?.[0] as { id: string; code: string; expires_at: string } | undefined;
    if (!otp) throw new Error("No pending code — send a new one");
    if (new Date(otp.expires_at).getTime() < Date.now()) throw new Error("Code expired");
    if (otp.code !== data.code) throw new Error("Wrong code");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("rx_phone_otps")
      .update({ verified_at: new Date().toISOString() } as never)
      .eq("id", otp.id);

    const { data: existing } = await supabaseAdmin
      .from("rx_billing_accounts")
      .select("id")
      .eq("business_id", data.businessId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (existing?.id) {
      await supabaseAdmin
        .from("rx_billing_accounts")
        .update({ phone: data.phone, phone_verified_at: new Date().toISOString() } as never)
        .eq("id", existing.id);
    } else {
      await supabaseAdmin.from("rx_billing_accounts").insert({
        business_id: data.businessId,
        user_id: context.userId,
        phone: data.phone,
        phone_verified_at: new Date().toISOString(),
      } as never);
    }
    return { ok: true as const };
  });
