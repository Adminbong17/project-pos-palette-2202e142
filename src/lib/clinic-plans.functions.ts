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

/**
 * Sends a "plan created" summary SMS to the clinic's notification number
 * (clinic admin) as soon as a treatment plan + schedule is created.
 * Includes patient ID, patient name, doctor, services, discount and payable.
 */
export const sendPlanCreatedSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { plan_id: string }) => {
    const plan_id = String(input?.plan_id ?? "");
    if (!plan_id) throw new Error("Plan is required");
    return { plan_id };
  })
  .handler(async ({ data, context }) => {
    const { data: plan, error } = await context.supabase
      .from("clinic_treatment_plans")
      .select(
        "id, business_id, doctor_id, patient_name, patient_code, patient_phone, total_amount, discount, installment_count, installment_interval_days, start_date",
      )
      .eq("id", data.plan_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!plan) throw new Error("Plan not found");
    const p = plan as any;

    const { data: lines } = await context.supabase
      .from("clinic_plan_lines")
      .select("name, quantity")
      .eq("plan_id", p.id);
    const serviceText =
      (lines ?? [])
        .map((l: any) => (Number(l.quantity || 1) > 1 ? `${l.name} x${l.quantity}` : l.name))
        .join(", ") || "-";

    let doctorName = "-";
    if (p.doctor_id) {
      const { data: doc } = await context.supabase
        .from("profiles")
        .select("full_name")
        .eq("id", p.doctor_id)
        .maybeSingle();
      doctorName = (doc as any)?.full_name || "-";
    }

    const { data: biz } = await context.supabase
      .from("businesses")
      .select("name, notify_phone, sms_sender_id")
      .eq("id", p.business_id)
      .maybeSingle();

    const discount = Number(p.discount ?? 0);
    const payable = Math.max(0, Number(p.total_amount ?? 0) - discount);
    const clinicName = (biz as any)?.name ?? "Clinic";

    const message =
      `${clinicName} - new treatment plan.` +
      ` Patient ID: ${p.patient_code ?? "-"}.` +
      ` Patient: ${p.patient_name ?? "-"}.` +
      ` Doctor: ${doctorName}.` +
      ` Service: ${serviceText}.` +
      ` Discount: Tk ${discount.toFixed(0)}.` +
      ` Total payable: Tk ${payable.toFixed(0)}` +
      ` in ${Number(p.installment_count ?? 1)} instalments from ${p.start_date}.`;

    const clinicPhone = digits((biz as any)?.notify_phone);
    if (clinicPhone.replace(/\D/g, "").length < 11) return { status: "no_phone", message };
    const ok = await sendSms(clinicPhone, message, (biz as any)?.sms_sender_id);
    return { status: ok ? "sent" : "failed", message };
  });
