import { supabase } from "@/integrations/supabase/client";

export type Chamber = {
  id: string;
  name: string;
  address: string | null;
  is_active: boolean;
  fee_new?: number | null;
  fee_old?: number | null;
  fee_medical?: number | null;
};

export type Appointment = {
  id: string;
  chamber_id: string | null;
  patient_name: string;
  patient_age: string | null;
  patient_phone: string | null;
  patient_gender: string | null;
  appt_date: string;
  appt_time: string | null;
  serial_no: number | null;
  status: string;
  notes: string | null;
  prescription_id: string | null;
  patient_code?: string | null;
  is_new_patient?: boolean | null;
  patient_type?: string | null;
  fee_amount?: number | null;
  doctor_id?: string | null;
};

/** Dhaka-local date as YYYY-MM-DD. */
export function dhakaToday(): string {
  return new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Rx number: DDMMYYYY-XXXXXX (same shape as the prescriptions page). */
function genRxNo(): string {
  const d = new Date(Date.now() + 6 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = `${pad(d.getUTCDate())}${pad(d.getUTCMonth() + 1)}${d.getUTCFullYear()}`;
  const rand = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
  return `${day}-${rand}`;
}

/** Create a prescription straight from a queued patient and link them together. */
export async function startPrescriptionFromAppointment(
  appointment: Appointment,
  businessId: string,
): Promise<string> {
  if (appointment.prescription_id) return appointment.prescription_id;

  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id ?? null;

  // An assistant starting a prescription must create it for their doctor,
  // otherwise it never shows up on the doctor's dashboard.
  let ownerId = uid;
  if (uid) {
    const { data: staff } = await supabase
      .from("rx_staff")
      .select("doctor_id")
      .eq("user_id", uid)
      .eq("business_id", businessId)
      .maybeSingle();
    if (staff?.doctor_id) ownerId = staff.doctor_id;
  }

  let doctorName = "";
  let doctorQualification = "";
  if (ownerId) {
    const { data: p } = await supabase
      .from("profiles")
      .select("doctor_name, doctor_qualification, first_name, last_name")
      .eq("id", ownerId)
      .maybeSingle();
    if (p) {
      doctorName =
        ((p as any).doctor_name ?? "").trim() ||
        [p.first_name, p.last_name].filter(Boolean).join(" ");
      doctorQualification = ((p as any).doctor_qualification ?? "").trim();
    }
  }

  const { data: rx, error } = await supabase
    .from("prescriptions")
    .insert({
      business_id: businessId,
      rx_no: genRxNo(),
      patient_name: appointment.patient_name,
      patient_age: appointment.patient_age,
      patient_phone: appointment.patient_phone,
      patient_gender: appointment.patient_gender,
      patient_code: appointment.patient_code ?? null,
      doctor_name: doctorName || null,
      doctor_qualification: doctorQualification || null,
      created_by: ownerId,
    })
    .select("id")
    .single();
  if (error) throw error;

  await supabase
    .from("rx_appointments")
    .update({ status: "in_progress", prescription_id: rx.id })
    .eq("id", appointment.id);

  return rx.id;
}
