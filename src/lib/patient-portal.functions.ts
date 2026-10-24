import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Bangladeshi mobile → "01XXXXXXXXX" (11 digits) or "" if invalid. */
function localPhone(raw: string) {
  let p = String(raw ?? "").replace(/\D/g, "");
  if (p.startsWith("880")) p = p.slice(3);
  else if (p.startsWith("+88")) p = p.slice(3);
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
        .select("id, rx_no, rx_date, patient_name, patient_code, patient_age, patient_gender, doctor_name, doctor_qualification, diagnosis, advice, investigation, next_visit, vitals, business_id")
        .ilike("patient_phone", like).order("rx_date", { ascending: false }).limit(100),
      db.from("lab_reports")
        .select("id, test_name, department, patient_name, patient_code, age, gender, sample_no, reported_at_text, comment, rows, created_at, business_id")
        .ilike("phone_no", like).order("created_at", { ascending: false }).limit(100),
      db.from("rx_appointments")
        .select("id, appt_date, appt_time, serial_no, status, patient_name, fee_amount, business_id, doctor_id, chamber_id, patient_type, patient_code")
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

    // Query doctor profiles and chambers for appointment enrichment
    const docIds = Array.from(new Set((appts.data ?? []).map((a: any) => a.doctor_id).filter(Boolean)));
    const chamberIds = Array.from(new Set((appts.data ?? []).map((a: any) => a.chamber_id).filter(Boolean)));

    const [docProfiles, chRows] = await Promise.all([
      docIds.length
        ? (await db.from("profiles").select("id, doctor_name, first_name, last_name, doctor_qualification").in("id", docIds)).data ?? []
        : [],
      chamberIds.length
        ? (await db.from("rx_chambers").select("id, name, address").in("id", chamberIds)).data ?? []
        : [],
    ]);

    const docNameMap: Record<string, string> = Object.fromEntries(
      (docProfiles ?? []).map((p: any) => [
        p.id,
        p.doctor_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "ডাক্তার",
      ])
    );
    const docQualMap: Record<string, string> = Object.fromEntries(
      (docProfiles ?? []).map((p: any) => [p.id, p.doctor_qualification || ""])
    );
    const chamberNameMap: Record<string, string> = Object.fromEntries(
      (chRows ?? []).map((c: any) => [c.id, c.name || ""])
    );

    const withBiz = <T extends { business_id: string }>(arr: T[] | null) =>
      (arr ?? []).map(({ business_id, ...r }) => ({ ...r, clinic: bizName[business_id] ?? "" }));

    const name =
      rx.data?.[0]?.patient_name || appts.data?.[0]?.patient_name || labs.data?.[0]?.patient_name || "";

    // Extract unique individual patients under this family mobile number
    const patientMap = new Map<string, {
      uid: string;
      name: string;
      age?: string;
      gender?: string;
      count: number;
    }>();

    const registerPatient = (code?: string | null, pName?: string | null, age?: string | null, gender?: string | null) => {
      const trimmedName = (pName || "").trim();
      if (!trimmedName) return;
      const trimmedCode = (code || "").trim();
      const key = (trimmedCode || trimmedName).toLowerCase();
      const existing = patientMap.get(key);
      if (existing) {
        existing.count += 1;
        if (!existing.age && age) existing.age = String(age);
        if (!existing.gender && gender) existing.gender = String(gender);
        if (!existing.uid && trimmedCode) existing.uid = trimmedCode;
      } else {
        patientMap.set(key, {
          uid: trimmedCode || `PAT-${Math.floor(100000 + Math.random() * 900000)}`,
          name: trimmedName,
          age: age ? String(age) : undefined,
          gender: gender ? String(gender) : undefined,
          count: 1,
        });
      }
    };

    for (const a of (appts.data ?? []) as any[]) {
      registerPatient(a.patient_code, a.patient_name, a.patient_age, a.patient_gender);
    }
    for (const r of (rx.data ?? []) as any[]) {
      registerPatient(r.patient_code, r.patient_name, (r as any).patient_age, (r as any).patient_gender);
    }
    for (const l of (labs.data ?? []) as any[]) {
      registerPatient(l.patient_code, l.patient_name, (l as any).patient_age, (l as any).patient_gender);
    }

    const enrichedAppointments = (appts.data ?? []).map((a: any) => {
      const rawDoc = (docNameMap[a.doctor_id] || "").trim();
      // Clean doctor name - do not add redundant "ডা." or "Dr."
      const doctor_name = rawDoc && rawDoc !== "ডাক্তার" ? rawDoc : "চিকিৎসক";
      return {
        ...a,
        clinic: bizName[a.business_id] ?? "",
        doctor_name,
        doctor_qualification: docQualMap[a.doctor_id] || "",
        chamber_name: chamberNameMap[a.chamber_id] || "শেখ ফার্মা চেম্বার",
      };
    });

    return {
      phone,
      name,
      patients: Array.from(patientMap.values()),
      prescriptions: withBiz(rx.data as any).map((r: any) => ({
        ...r,
        doctor_name: (r.doctor_name || "").trim() || "চিকিৎসক",
        lines: lines.filter((l: any) => l.prescription_id === r.id),
      })),
      labReports: withBiz(labs.data as any),
      appointments: enrichedAppointments,
      bills: withBiz(sales.data as any),
      plans: withBiz(plans.data as any),
    };
  });

/** Phone-only login (no SMS code) — issues a session token for the number. */
export const loginPatientByPhone = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string }) => z.object({ phone: z.string().max(20) }).parse(d))
  .handler(async ({ data }) => {
    const phone = localPhone(data.phone);
    if (!phone) throw new Error("সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন");
    const exp = Date.now() + 30 * 24 * 3600 * 1000;
    return { token: `${phone}.${exp}.${await sign(`${phone}.${exp}`)}`, phone };
  });

/* -------------------------------------------------------------------------- */
/*                 DOCTOR LIST & SELF-BOOKING FOR PATIENTS                     */
/* -------------------------------------------------------------------------- */

export type AvailableDoctor = {
  id: string;
  name: string;
  qualification: string;
  email?: string;
  business_id: string;
  business_name: string;
  chambers: {
    id: string | null;
    name: string;
    address: string;
    fee_new: number;
    fee_old: number;
    fee_medical: number;
  }[];
  today_queue: number;
};

/** Get the list of all active doctors & chambers for patient serial booking. */
export const getAvailableDoctors = createServerFn({ method: "GET" }).handler(
  async () => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

    // 1. Fetch active businesses
    const { data: businesses } = await db
      .from("businesses")
      .select("id, name, owner_id")
      .order("name");

    const activeBizIds = (businesses ?? []).map((b) => b.id);
    const defaultBizId = activeBizIds[0] ?? "";
    const bizMap = new Map((businesses ?? []).map((b) => [b.id, b.name]));

    // 2. Fetch chambers
    const { data: chambers } = await db
      .from("rx_chambers")
      .select("id, name, address, business_id, doctor_id, fee_new, fee_old, fee_medical, is_active")
      .eq("is_active", true);

    // 3. Fetch doctor profiles
    const [rolesRes, userRolesRes, profilesRes] = await Promise.all([
      activeBizIds.length
        ? db.from("roles").select("id, name, business_id").in("business_id", activeBizIds)
        : { data: [] },
      activeBizIds.length
        ? db.from("user_roles").select("user_id, role_id, business_id").in("business_id", activeBizIds)
        : { data: [] },
      db.from("profiles").select("id, email, first_name, last_name, doctor_name, doctor_qualification"),
    ]);

    const roleById = new Map((rolesRes.data ?? []).map((r: any) => [r.id, String(r.name ?? "")]));
    const doctorUserIds = new Set<string>();

    for (const ur of (userRolesRes.data ?? []) as any[]) {
      const rName = (roleById.get(ur.role_id) ?? "").toLowerCase();
      if (rName.includes("doctor")) {
        doctorUserIds.add(ur.user_id);
      }
    }

    for (const p of (profilesRes.data ?? []) as any[]) {
      if (p.doctor_name || p.doctor_qualification) {
        doctorUserIds.add(p.id);
      }
    }

    for (const c of (chambers ?? []) as any[]) {
      if (c.doctor_id) {
        doctorUserIds.add(c.doctor_id);
      }
    }

    // Fallback if no specific doctor flags found
    if (doctorUserIds.size === 0) {
      for (const b of (businesses ?? []) as any[]) {
        if (b.owner_id) doctorUserIds.add(b.owner_id);
      }
      if (doctorUserIds.size === 0) {
        for (const p of ((profilesRes.data ?? []) as any[]).slice(0, 5)) {
          doctorUserIds.add(p.id);
        }
      }
    }

    // 4. Get today's queue count per doctor
    const today = new Date().toISOString().slice(0, 10);
    const { data: todayAppts } = await db
      .from("rx_appointments")
      .select("doctor_id, status")
      .eq("appt_date", today)
      .in("status", ["waiting", "in_progress", "completed"]);

    const todayCountByDoc: Record<string, number> = {};
    for (const a of (todayAppts ?? []) as any[]) {
      if (a.doctor_id) {
        todayCountByDoc[a.doctor_id] = (todayCountByDoc[a.doctor_id] ?? 0) + 1;
      }
    }

    // Fallback default chamber if none is configured
    const defaultChamber = {
      id: null,
      name: "শেখ ফার্মা কনসালটেশন চেম্বার",
      address: "দোকান নং ১৩, আরব প্যারাডাইস মার্কেট, নতুন বাজার, মুক্তাগাছা, ময়মনসিংহ",
      fee_new: 500,
      fee_old: 300,
      fee_medical: 0,
    };

    const doctorsList: AvailableDoctor[] = ((profilesRes.data ?? []) as any[])
      .filter((p) => doctorUserIds.has(p.id))
      .map((p) => {
        // Specific chambers assigned to this doctor
        const specificChambers = ((chambers ?? []) as any[]).filter(
          (c) => c.doctor_id === p.id
        );
        // General chambers with no doctor specified
        const generalChambers = ((chambers ?? []) as any[]).filter(
          (c) => !c.doctor_id
        );

        const assignedChambers = specificChambers.length > 0 ? specificChambers : generalChambers;

        const rawName = (
          p.doctor_name ||
          [p.first_name, p.last_name].filter(Boolean).join(" ") ||
          p.email?.split("@")[0] ||
          ""
        ).trim();

        // Clean name - DO NOT force prefix "ডা." or "Dr."
        const name = rawName && rawName !== "ডাক্তার" ? rawName : "চিকিৎসক";

        const chList =
          assignedChambers.length > 0
            ? assignedChambers.map((c) => ({
                id: c.id,
                name: c.name,
                address: c.address ?? "শেখ ফার্মা, মুক্তাগাছা",
                fee_new: Number(c.fee_new) || 500,
                fee_old: Number(c.fee_old) || 300,
                fee_medical: Number(c.fee_medical) || 0,
              }))
            : [defaultChamber];

        const bizId = assignedChambers[0]?.business_id || defaultBizId;

        return {
          id: p.id,
          name,
          qualification: p.doctor_qualification || "এমবিবিএস (MBBS)",
          email: p.email ?? "",
          business_id: bizId,
          business_name: bizMap.get(bizId) ?? "শেখ ফার্মা",
          chambers: chList,
          today_queue: todayCountByDoc[p.id] ?? 0,
        };
      });

    return doctorsList;
  }
);

/** Fetch existing patients/family members registered under this mobile number. */
export const getPatientsByPhone = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string }) => z.object({ phone: z.string().max(20) }).parse(d))
  .handler(async ({ data }) => {
    const phone = localPhone(data.phone);
    if (!phone) return { patients: [] };
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const like = `%${phone.slice(1)}`;

    const [appts, rx, labs] = await Promise.all([
      db.from("rx_appointments")
        .select("patient_name, patient_code, patient_age, patient_gender, created_at")
        .ilike("patient_phone", like)
        .order("created_at", { ascending: false })
        .limit(50),
      db.from("prescriptions")
        .select("patient_name, patient_code, patient_age, patient_gender, created_at")
        .ilike("patient_phone", like)
        .order("created_at", { ascending: false })
        .limit(50),
      db.from("lab_reports")
        .select("patient_name, patient_code, patient_age, patient_gender, created_at")
        .ilike("phone_no", like)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const patientMap = new Map<string, {
      uid: string;
      name: string;
      age?: string;
      gender?: string;
    }>();

    for (const row of [...(appts.data ?? []), ...(rx.data ?? []), ...(labs.data ?? [])] as any[]) {
      const name = String(row.patient_name ?? "").trim();
      const code = String(row.patient_code ?? "").trim();
      if (!name) continue;
      const key = (code || name).toLowerCase();
      if (!patientMap.has(key)) {
        patientMap.set(key, {
          uid: code || `PAT-${Math.floor(100000 + Math.random() * 900000)}`,
          name,
          age: row.patient_age || "",
          gender: row.patient_gender || "",
        });
      }
    }

    return { patients: Array.from(patientMap.values()) };
  });

/** Book an appointment/serial directly from the patient portal. */
export const bookPatientAppointment = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      token?: string;
      phone?: string;
      doctor_id: string;
      chamber_id?: string | null;
      patient_code?: string | null;
      patient_name: string;
      patient_age?: string | null;
      patient_gender?: string | null;
      appt_date: string;
      patient_type?: "new" | "old" | "report";
      notes?: string | null;
    }) =>
      z
        .object({
          token: z.string().max(200).optional(),
          phone: z.string().max(20).optional(),
          doctor_id: z.string().uuid("সঠিক ডাক্তার আইডি দিন"),
          chamber_id: z.string().uuid().optional().nullable(),
          patient_code: z.string().max(50).optional().nullable(),
          patient_name: z.string().min(2, "রোগীর নাম দিন").max(100),
          patient_age: z.string().max(20).optional().nullable(),
          patient_gender: z.string().max(20).optional().nullable(),
          appt_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "সঠিক তারিখ দিন"),
          patient_type: z.enum(["new", "old", "report"]).default("new"),
          notes: z.string().max(500).optional().nullable(),
        })
        .parse(d)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

    // 1. Resolve phone
    let phone = "";
    if (data.token) {
      phone = await verifyToken(data.token);
    } else if (data.phone) {
      phone = localPhone(data.phone);
    }
    if (!phone || !/^01\d{9}$/.test(phone)) {
      throw new Error("সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)");
    }

    // 2. Resolve Doctor Profile
    const { data: docProfile, error: docErr } = await db
      .from("profiles")
      .select("id, doctor_name, first_name, last_name, doctor_qualification")
      .eq("id", data.doctor_id)
      .single();

    if (docErr || !docProfile) {
      throw new Error("নির্বাচিত ডাক্তার খুঁজে পাওয়া যায়নি");
    }

    const rawDocName = (
      docProfile.doctor_name ||
      [docProfile.first_name, docProfile.last_name].filter(Boolean).join(" ") ||
      ""
    ).trim();
    // Clean name - DO NOT force prefix "ডা." or "Dr."
    const doctorName = rawDocName && rawDocName !== "ডাক্তার" ? rawDocName : "চিকিৎসক";

    // 3. Resolve Business
    const { data: bizUsers } = await db
      .from("business_users")
      .select("business_id")
      .eq("user_id", data.doctor_id)
      .eq("is_active", true)
      .limit(1);

    let businessId = bizUsers?.[0]?.business_id;
    if (!businessId) {
      const { data: anyBiz } = await db
        .from("businesses")
        .select("id")
        .limit(1);
      businessId = anyBiz?.[0]?.id;
    }
    if (!businessId) throw new Error("ক্লিনিক বা ফার্মেসি অ্যাকাউন্ট পাওয়া যায়নি");

    // 4. Resolve Chamber & Fee
    let chamberId = data.chamber_id || null;
    let chamberName = "শেখ ফার্মা চেম্বার";
    let feeAmount = 0;

    if (chamberId) {
      const { data: ch } = await db
        .from("rx_chambers")
        .select("id, name, fee_new, fee_old")
        .eq("id", chamberId)
        .single();
      if (ch) {
        chamberName = ch.name;
        feeAmount =
          data.patient_type === "old"
            ? Number(ch.fee_old) || Number(ch.fee_new) || 300
            : Number(ch.fee_new) || 500;
      }
    } else {
      const { data: defCh } = await db
        .from("rx_chambers")
        .select("id, name, fee_new, fee_old")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .limit(1);
      if (defCh?.[0]) {
        chamberId = defCh[0].id;
        chamberName = defCh[0].name;
        feeAmount =
          data.patient_type === "old"
            ? Number(defCh[0].fee_old) || Number(defCh[0].fee_new) || 300
            : Number(defCh[0].fee_new) || 500;
      } else {
        feeAmount = data.patient_type === "old" ? 300 : 500;
      }
    }

    if (data.patient_type === "report") {
      feeAmount = 0;
    }

    // Resolve UID (patient_code)
    let patientCode = (data.patient_code || "").trim().toUpperCase();
    if (!patientCode) {
      const alpha = data.patient_name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "PAT";
      const pad = alpha.padEnd(3, "X");
      const rand = Math.floor(100000 + Math.random() * 900000);
      patientCode = `${pad}${rand}`;
    }

    // 5. Duplicate Check: Same Doctor + Same Date + Same Patient Phone + (Same Patient Code OR Same Patient Name)
    let dupQuery = db
      .from("rx_appointments")
      .select("id, serial_no, appt_date, patient_name, patient_code, status, fee_amount, chamber_id")
      .eq("business_id", businessId)
      .eq("doctor_id", data.doctor_id)
      .eq("appt_date", data.appt_date)
      .ilike("patient_phone", `%${phone.slice(1)}`)
      .in("status", ["waiting", "in_progress"]);

    if (data.patient_code?.trim()) {
      dupQuery = dupQuery.eq("patient_code", data.patient_code.trim().toUpperCase());
    } else {
      dupQuery = dupQuery.ilike("patient_name", data.patient_name.trim());
    }

    const { data: existing } = await dupQuery.limit(1);

    const exp = Date.now() + 30 * 24 * 3600 * 1000;
    const sessionToken = `${phone}.${exp}.${await sign(`${phone}.${exp}`)}`;

    if (existing && existing.length > 0) {
      const row = existing[0];
      return {
        success: true,
        already_booked: true,
        id: row.id,
        serial_no: row.serial_no,
        patient_code: row.patient_code || patientCode,
        appt_date: row.appt_date,
        patient_name: row.patient_name,
        doctor_name: doctorName,
        doctor_qualification: docProfile.doctor_qualification || "",
        chamber_name: chamberName,
        fee_amount: row.fee_amount ?? feeAmount,
        status: row.status,
        token: sessionToken,
        phone,
      };
    }

    // 6. Insert Appointment (Serial trigger automatically assigns serial_no)
    const { data: inserted, error: insErr } = await db
      .from("rx_appointments")
      .insert({
        business_id: businessId,
        doctor_id: data.doctor_id,
        chamber_id: chamberId,
        patient_code: patientCode,
        patient_name: data.patient_name.trim(),
        patient_phone: phone,
        patient_age: data.patient_age?.trim() || null,
        patient_gender: data.patient_gender || null,
        appt_date: data.appt_date,
        patient_type: data.patient_type || "new",
        is_new_patient: data.patient_type !== "old",
        fee_amount: feeAmount,
        status: "waiting",
        notes: data.notes?.trim()
          ? `[পেশেন্ট পোর্টাল বুকিং] ${data.notes.trim()}`
          : "পেশেন্ট পোর্টাল থেকে বুকড",
      } as never)
      .select("id, serial_no, patient_code, appt_date, appt_time, patient_name, patient_phone, fee_amount, status")
      .single();

    if (insErr || !inserted) {
      console.error("Booking error:", insErr);
      throw new Error(insErr?.message || "সিরিয়াল বুকিং সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।");
    }

    return {
      success: true,
      already_booked: false,
      id: inserted.id,
      serial_no: inserted.serial_no,
      patient_code: inserted.patient_code || patientCode,
      appt_date: inserted.appt_date,
      patient_name: inserted.patient_name,
      doctor_name: doctorName,
      doctor_qualification: docProfile.doctor_qualification || "",
      chamber_name: chamberName,
      fee_amount: inserted.fee_amount,
      status: inserted.status,
      token: sessionToken,
      phone,
    };
  });
