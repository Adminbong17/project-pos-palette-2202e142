import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Trash2, Stethoscope, Pencil, Printer } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/utils";
import {
  startPrescriptionFromAppointment,
  type Appointment,
  type Chamber,
} from "@/lib/appointments";
import { printPatientToken, patientTypeLabel, type TokenSize } from "@/lib/token-print";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type EditState = {
  id: string;
  patient_name: string;
  patient_age: string;
  patient_gender: string;
  patient_phone: string;
  appt_date: string;
  appt_time: string;
  chamber_id: string;
  serial_no: string;
  status: string;
  notes: string;
  patient_type: string;
};

export function AppointmentQueue({
  businessId,
  date,
  chamberId,
  chambers,
  allowDelete = false,
  allowEdit = false,
  allowStart = true,
  clinicName,
}: {
  businessId?: string;
  date: string;
  chamberId?: string;
  chambers: Chamber[];
  allowDelete?: boolean;
  allowEdit?: boolean;
  /** Assistants only print tokens — the doctor starts the prescription. */
  allowStart?: boolean;
  clinicName?: string | null;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [tokenSize, setTokenSize] = useState<TokenSize>("80mm");


  const list = useQuery({
    queryKey: ["rx-appointments", businessId, date, chamberId ?? "all"],
    enabled: !!businessId,
    queryFn: async () => {
      let q = supabase
        .from("rx_appointments")
        .select(
          "id, chamber_id, patient_name, patient_age, patient_phone, patient_gender, appt_date, appt_time, serial_no, status, notes, prescription_id, patient_code, is_new_patient, patient_type, fee_amount, doctor_id",
        )
        .eq("business_id", businessId!)
        .eq("appt_date", date)
        .order("serial_no", { ascending: true });
      if (chamberId) q = q.eq("chamber_id", chamberId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Appointment[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rx_appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["rx-appointments"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async (e: EditState) => {
      if (!e.patient_name.trim()) throw new Error("Patient name is required");
      const { error } = await supabase
        .from("rx_appointments")
        .update({
          patient_name: e.patient_name.trim(),
          patient_age: e.patient_age.trim() || null,
          patient_gender: e.patient_gender || null,
          patient_phone: e.patient_phone.trim() || null,
          appt_date: e.appt_date,
          appt_time: e.appt_time || null,
          chamber_id: e.chamber_id || null,
          serial_no: e.serial_no ? Number(e.serial_no) : null,
          status: e.status || "waiting",
          notes: e.notes.trim() || null,
          patient_type: e.patient_type || "new",
          fee_amount: null,
        })
        .eq("id", e.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Patient updated");
      setEdit(null);
      qc.invalidateQueries({ queryKey: ["rx-appointments"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rowsForDoctors = list.data ?? [];
  const doctorIds = Array.from(
    new Set(rowsForDoctors.map((a) => a.doctor_id).filter(Boolean) as string[]),
  );
  const doctors = useQuery({
    queryKey: ["queue-doctors", doctorIds.sort().join(",")],
    enabled: doctorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, doctor_name, doctor_qualification, first_name, last_name")
        .in("id", doctorIds);
      if (error) throw error;
      const map: Record<string, { name: string; qualification: string }> = {};
      for (const p of (data ?? []) as any[]) {
        map[p.id] = {
          name:
            (p.doctor_name ?? "").trim() ||
            [p.first_name, p.last_name].filter(Boolean).join(" "),
          qualification: (p.doctor_qualification ?? "").trim(),
        };
      }
      return map;
    },
  });

  const chamberName = (id: string | null) => chambers.find((c) => c.id === id)?.name ?? "—";

  const printToken = (a: Appointment) => {
    const doc = a.doctor_id ? doctors.data?.[a.doctor_id] : undefined;
    const chamber = chambers.find((c) => c.id === a.chamber_id);
    const type = (a.patient_type ?? (a.is_new_patient === false ? "old" : "new")).toLowerCase();
    const fee =
      a.fee_amount ??
      (type === "medical" ? 0 : type === "old" ? chamber?.fee_old ?? null : chamber?.fee_new ?? null);
    printPatientToken(
      {
        clinicName: clinicName ?? null,
        doctorName: doc?.name ?? null,
        doctorQualification: doc?.qualification ?? null,
        serialNo: a.serial_no,
        patientCode: a.patient_code ?? null,
        fee,
        isNewPatient: type === "new",
        patientType: type,
        patientName: a.patient_name,
        age: a.patient_age,
        gender: a.patient_gender,
        phone: a.patient_phone,
        location: chamber?.name ?? null,
        date: formatDate(a.appt_date),
        time: a.appt_time ? a.appt_time.slice(0, 5) : null,
      },
      tokenSize,
    );
  };

  const start = async (a: Appointment) => {
    if (!businessId) return;
    setBusy(a.id);
    try {
      const rxId = await startPrescriptionFromAppointment(a, businessId);
      qc.invalidateQueries({ queryKey: ["rx-appointments"] });
      qc.invalidateQueries({ queryKey: ["prescriptions"] });
      navigate({ to: "/prescriptions", search: { rx: rxId } as any });
    } catch (e: any) {
      toast.error(e.message ?? "Could not start prescription");
    } finally {
      setBusy(null);
    }
  };

  const rows = list.data ?? [];

  return (
    <div className="rounded-2xl border border-border/60 bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Patient queue · {formatDate(date)}</h2>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
            Token
            <select
              value={tokenSize}
              onChange={(e) => setTokenSize(e.target.value as TokenSize)}
              className="h-7 rounded-md border border-border bg-input px-1.5 text-[11px]"
            >
              <option value="58mm">58mm</option>
              <option value="80mm">80mm</option>
              <option value="A5">Half A4</option>
            </select>
          </label>
          <span className="text-xs text-muted-foreground">{rows.length} patient(s)</span>
        </div>
      </div>

      {list.isLoading ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">No patients listed for this day.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {rows.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 text-sm">
              <span className="flex h-7 min-w-7 items-center justify-center rounded-md bg-primary/15 px-1.5 font-mono text-xs font-semibold text-primary">
                {a.serial_no ?? "—"}
              </span>
              <span className="font-medium">{a.patient_name}</span>
              {a.patient_code && (
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold">
                  {a.patient_code}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {a.patient_age ? `${a.patient_age}y` : ""} {a.patient_gender ?? ""}
              </span>
              {a.patient_phone && <span className="text-xs text-muted-foreground">{a.patient_phone}</span>}
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                {patientTypeLabel(a.patient_type, a.is_new_patient !== false)}
              </span>
              {a.fee_amount != null && (
                <span className="text-xs font-medium">৳ {Number(a.fee_amount).toFixed(0)}</span>
              )}
              <span className="text-xs text-muted-foreground">{chamberName(a.chamber_id)}</span>
              {a.doctor_id && doctors.data?.[a.doctor_id]?.name && (
                <span className="text-xs text-muted-foreground">
                  Dr. {doctors.data[a.doctor_id]!.name}
                </span>
              )}
              {a.appt_time && (
                <span className="font-mono text-[11px] text-muted-foreground">{a.appt_time.slice(0, 5)}</span>
              )}
              {a.prescription_id ? (
                <Badge variant="outline" className="text-[10px]">Rx started</Badge>
              ) : null}
              <div className="ml-auto flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  title="Print patient token"
                  onClick={() => printToken(a)}
                >
                  <Printer className="mr-1 h-3.5 w-3.5" /> Token
                </Button>
                {allowStart && (
                  <Button size="sm" disabled={busy === a.id} onClick={() => start(a)} className="h-8 text-xs">
                    <FileText className="mr-1 h-3.5 w-3.5" />
                    {a.prescription_id ? "Open prescription" : "Start prescription"}
                  </Button>
                )}
                {allowEdit && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    title="Edit patient"
                    onClick={() =>
                      setEdit({
                        id: a.id,
                        patient_name: a.patient_name ?? "",
                        patient_age: a.patient_age ?? "",
                        patient_gender: a.patient_gender ?? "",
                        patient_phone: a.patient_phone ?? "",
                        appt_date: a.appt_date ?? date,
                        appt_time: a.appt_time ? a.appt_time.slice(0, 5) : "",
                        chamber_id: a.chamber_id ?? "",
                        serial_no: a.serial_no != null ? String(a.serial_no) : "",
                        status: a.status ?? "waiting",
                        notes: (a as any).notes ?? "",
                        patient_type:
                          (a.patient_type ?? (a.is_new_patient === false ? "old" : "new")) as string,
                      })
                    }
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                {allowDelete && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => { if (confirm("Remove this patient?")) del.mutate(a.id); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit patient</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="mb-1.5 block text-xs">Patient name *</Label>
                <Input
                  value={edit.patient_name}
                  onChange={(e) => setEdit({ ...edit, patient_name: e.target.value })}
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Age</Label>
                <Input value={edit.patient_age} onChange={(e) => setEdit({ ...edit, patient_age: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Gender</Label>
                <select
                  value={edit.patient_gender}
                  onChange={(e) => setEdit({ ...edit, patient_gender: e.target.value })}
                  className="h-9 w-full rounded-lg border border-border bg-input px-3 text-sm"
                >
                  <option value="">—</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Phone</Label>
                <Input value={edit.patient_phone} onChange={(e) => setEdit({ ...edit, patient_phone: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Patient type</Label>
                <select
                  value={edit.patient_type}
                  onChange={(e) => setEdit({ ...edit, patient_type: e.target.value })}
                  className="h-9 w-full rounded-lg border border-border bg-input px-3 text-sm"
                >
                  <option value="new">New patient</option>
                  <option value="old">Old patient</option>
                  <option value="medical">Medical person</option>
                </select>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Serial no</Label>
                <Input
                  inputMode="numeric"
                  value={edit.serial_no}
                  onChange={(e) => setEdit({ ...edit, serial_no: e.target.value.replace(/[^0-9]/g, "") })}
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Date</Label>
                <Input type="date" value={edit.appt_date} onChange={(e) => setEdit({ ...edit, appt_date: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Time</Label>
                <Input type="time" value={edit.appt_time} onChange={(e) => setEdit({ ...edit, appt_time: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Location</Label>
                <select
                  value={edit.chamber_id}
                  onChange={(e) => setEdit({ ...edit, chamber_id: e.target.value })}
                  className="h-9 w-full rounded-lg border border-border bg-input px-3 text-sm"
                >
                  <option value="">— No location —</option>
                  {chambers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">Status</Label>
                <select
                  value={edit.status}
                  onChange={(e) => setEdit({ ...edit, status: e.target.value })}
                  className="h-9 w-full rounded-lg border border-border bg-input px-3 text-sm"
                >
                  <option value="waiting">Waiting</option>
                  <option value="in_progress">In progress</option>
                  <option value="done">Done</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <Label className="mb-1.5 block text-xs">Notes</Label>
                <Input value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
            <Button disabled={save.isPending} onClick={() => edit && save.mutate(edit)}>
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Chambers (locations) + appointments of a business, for reuse across pages. */
export function useChambers(businessId?: string) {
  return useQuery({
    queryKey: ["rx-chambers", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rx_chambers")
        .select("id, name, address, is_active, fee_new, fee_old")
        .eq("business_id", businessId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Chamber[];
    },
  });
}
