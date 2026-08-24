import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Lets any business / clinic / doctor account send a test SMS with its own
 * Sender ID, so they can confirm the ID is approved at the gateway.
 */
export const sendBusinessTestSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { businessId: string; phone: string; message?: string }) => {
    const phone = String(input?.phone ?? "").replace(/[^\d+]/g, "");
    if (phone.replace(/\D/g, "").length < 11) throw new Error("Enter a valid 11-digit phone number");
    return {
      businessId: String(input?.businessId ?? ""),
      phone,
      message: String(input?.message ?? "").trim() || "Test SMS from your account.",
    };
  })
  .handler(async ({ data, context }) => {
    // The caller must belong to the business (RLS-scoped read).
    const { data: biz, error } = await context.supabase
      .from("businesses")
      .select("id, sms_sender_id")
      .eq("id", data.businessId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!biz) throw new Error("Business not found");

    const { sendSms } = await import("./sms.server");
    const res = await sendSms(data.phone, data.message, (biz as any).sms_sender_id);
    return { ...res, senderId: String((biz as any).sms_sender_id ?? "") || null };
  });
