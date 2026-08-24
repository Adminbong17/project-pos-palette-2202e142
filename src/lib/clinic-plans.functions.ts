import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function digits(v: unknown) {
  return String(v ?? "").replace(/[^\d+]/g, "");
}

async function sendSms(phone: string, message: string, senderId?: string | null) {
  const { sendSms: send } = await import("./sms.server");
  return (await send(phone, message, senderId)).ok;
}

/**
 * Sends the instalment payment receipt by SMS to the patient and to the
 * clinic's notification number. Runs as the signed-in user, so RLS keeps
 * one clinic's plans out of another clinic's reach.
 */
export const sendPlanPaymentSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { payment_id: string }) => {
    const payment_id = String(input?.payment_id ?? "");
    if (!payment_id) throw new Error("Payment is required");
    return { payment_id };
  })
  .handler(async ({ data, context }) => {
    const { data: pay, error } = await context.supabase
      .from("clinic_plan_payments")
      .select("id, business_id, plan_id, amount, pay_date, method")
      .eq("id", data.payment_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!pay) throw new Error("Payment not found");

    const { data: plan } = await context.supabase
      .from("clinic_treatment_plans")
      .select("patient_name, patient_phone, patient_code, total_amount, discount")
      .eq("id", (pay as any).plan_id)
      .maybeSingle();

    const { data: paidRows } = await context.supabase
      .from("clinic_plan_payments")
      .select("amount")
      .eq("plan_id", (pay as any).plan_id);
    const paid = (paidRows ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
    const net = Number((plan as any)?.total_amount ?? 0) - Number((plan as any)?.discount ?? 0);
    const due = Math.max(0, net - paid);

    const { data: biz } = await context.supabase
      .from("businesses")
      .select("name, notify_phone, sms_sender_id")
      .eq("id", (pay as any).business_id)
      .maybeSingle();

    const clinicName = (biz as any)?.name ?? "Clinic";
    const message =
      `${clinicName}: payment received Tk ${Number((pay as any).amount).toFixed(0)} on ${(pay as any).pay_date}` +
      ` for ${(plan as any)?.patient_name ?? "patient"}` +
      ((plan as any)?.patient_code ? ` (${(plan as any).patient_code})` : "") +
      `. Paid Tk ${paid.toFixed(0)} of Tk ${net.toFixed(0)}, due Tk ${due.toFixed(0)}.`;

    const targets: string[] = [];
    const patientPhone = digits((plan as any)?.patient_phone);
    const clinicPhone = digits((biz as any)?.notify_phone);
    if (patientPhone.replace(/\D/g, "").length >= 11) targets.push(patientPhone);
    if (clinicPhone.replace(/\D/g, "").length >= 11 && clinicPhone !== patientPhone)
      targets.push(clinicPhone);

    let sent = 0;
    for (const t of targets) {
      if (await sendSms(t, message, (biz as any)?.sms_sender_id)) sent += 1;
    }

    const status =
      targets.length === 0 ? "no_phone" : sent === 0 ? "failed" : sent === targets.length ? "sent" : "partial";

    await context.supabase
      .from("clinic_plan_payments")
      .update({ sms_sent_at: sent > 0 ? new Date().toISOString() : null, sms_status: status } as never)
      .eq("id", data.payment_id);

    return { status, sent, targets: targets.length, message };
  });
