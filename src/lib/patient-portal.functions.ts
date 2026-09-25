import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Bangladeshi mobile → "01XXXXXXXXX" (11 digits) or "" if invalid. */
function localPhone(raw: string) {
  let p = String(raw ?? "").replace(/\D/g, "");
  if (p.startsWith("880")) p = p.slice(2);
  else if (p.startsWith("88")) p = p.slice(2);
  if (p.length === 10 && p.startsWith("1")) p = `0${p}`;
  return /^01\d{9}$/.test(p) ? p : "";
}

async function sign(payload: string) {
  const { createHmac } = await import("crypto");
  const secret = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
  return createHmac("sha256", `patient-portal:${secret}`).update(payload).digest("hex");
}

async function verifyToken(token: string): Promise<string> {
  const [phone, exp, sig] = String(token ?? "").split(".");
  if (!phone || !exp || !sig) throw new Error("Please log in again");
  if (Number(exp) < Date.now()) throw new Error("Session expired — please log in again");
  const expected = await sign(`${phone}.${exp}`);
  const { timingSafeEqual } = await import("crypto");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Please log in again");
  return phone;
}

export const requestPatientCode = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string }) => z.object({ phone: z.string().max(20) }).parse(d))
  .handler(async ({ data }) => {
    const phone = localPhone(data.phone);
    if (!phone) throw new Error("সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("patient_login_codes" as never)
      .select("id", { count: "exact", head: true })
      .eq("phone", phone)
      .gte("created_at", since);
    if ((count ?? 0) > 0) throw new Error("১ মিনিট পর আবার চেষ্টা করুন");
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const { error } = await supabaseAdmin
      .from("patient_login_codes" as never)
      .insert({ phone, code } as never);
    if (error) throw new Error(error.message);
    const { sendSms } = await import("./sms.server");
    const res = await sendSms(phone, `Your patient login code: ${code}`);
    if (!res.ok) throw new Error("SMS পাঠানো যায়নি, পরে আবার চেষ্টা করুন");
    return { sent: true };
  });

export const verifyPatientCode = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string; code: string }) =>
    z.object({ phone: z.string().max(20), code: z.string().max(10) }).parse(d),
  )
  .handler(async ({ data }) => {
    const phone = localPhone(data.phone);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("patient_login_codes" as never)
      .select("id, code, attempts, expires_at, used_at")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = (rows as any[] | null)?.[0];
    if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now() || row.attempts >= 5)
      throw new Error("কোডের মেয়াদ শেষ — নতুন কোড নিন");
    if (row.code !== data.code.trim()) {
      await supabaseAdmin
        .from("patient_login_codes" as never)
        .update({ attempts: row.attempts + 1 } as never)
        .eq("id", row.id);
      throw new Error("কোড সঠিক নয়");
    }
    await supabaseAdmin
      .from("patient_login_codes" as never)
      .update({ used_at: new Date().toISOString() } as never)
      .eq("id", row.id);
    const exp = Date.now() + 30 * 24 * 3600 * 1000;
    return { token: `${phone}.${exp}.${await sign(`${phone}.${exp}`)}`, phone };
  });

export const getPatientDashboard = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string().max(200) }).parse(d))
  .handler(async ({ data }) => {
    const phone = await verifyToken(data.token);
    const like = `%${phone.slice(1)}`; // matches 01…, +8801…, 8801…
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

    const [rx, labs, appts, sales, plans] = await Promise.all([
      db.from("prescriptions")
        .select("id, rx_no, rx_date, patient_name, doctor_name, doctor_qualification, diagnosis, advice, investigation, next_visit, vitals, business_id")
        .ilike("patient_phone", like).order("rx_date", { ascending: false }).limit(100),
      db.from("lab_reports")
        .select("id, test_name, department, patient_name, sample_no, reported_at_text, comment, rows, created_at, business_id")
        .ilike("phone_no", like).order("created_at", { ascending: false }).limit(100),
      db.from("rx_appointments")
        .select("id, appt_date, appt_time, serial_no, status, patient_name, fee_amount, business_id")
        .ilike("patient_phone", like).order("appt_date", { ascending: false }).limit(100),
      db.from("clinic_sales")
        .select("id, invoice_no, sale_date, total, paid, discount_amount, business_id")
        .ilike("patient_phone", like).order("sale_date", { ascending: false }).limit(100),
      db.from("clinic_treatment_plans")
        .select("id, start_date, status, total_amount, discount, installment_count, notes, business_id, clinic_plan_installments(seq, due_date, amount, paid_amount, status)")
        .ilike("patient_phone", like).order("start_date", { ascending: false }).limit(50),
    ]);

    const rxIds = (rx.data ?? []).map((r) => r.id);
    const lines = rxIds.length
      ? (await db.from("prescription_lines")
          .select("prescription_id, medicine_name, dose, frequency, duration, instructions, sort_order")
          .in("prescription_id", rxIds).order("sort_order")).data ?? []
      : [];

    const bizIds = Array.from(new Set([
      ...(rx.data ?? []), ...(labs.data ?? []), ...(appts.data ?? []), ...(sales.data ?? []), ...(plans.data ?? []),
    ].map((r: any) => r.business_id)));
    const businesses = bizIds.length
      ? (await db.from("businesses").select("id, name").in("id", bizIds)).data ?? []
      : [];
    const bizName: Record<string, string> = Object.fromEntries(businesses.map((b: any) => [b.id, b.name]));
    const withBiz = <T extends { business_id: string }>(arr: T[] | null) =>
      (arr ?? []).map(({ business_id, ...r }) => ({ ...r, clinic: bizName[business_id] ?? "" }));

    const name =
      rx.data?.[0]?.patient_name || appts.data?.[0]?.patient_name || labs.data?.[0]?.patient_name || "";

    return {
      phone,
      name,
      prescriptions: withBiz(rx.data as any).map((r: any) => ({
        ...r,
        lines: lines.filter((l: any) => l.prescription_id === r.id),
      })),
      labReports: withBiz(labs.data as any),
      appointments: withBiz(appts.data as any),
      bills: withBiz(sales.data as any),
      plans: withBiz(plans.data as any),
    };
  });
