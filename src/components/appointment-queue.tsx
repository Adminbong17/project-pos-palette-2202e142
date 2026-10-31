import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FileText,
  Trash2,
  Stethoscope,
  Pencil,
  Printer,
  Globe,
  Building2,
  Clock,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";

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
  fee_amount: string;
};

export function AppointmentQueue({
  businessId,
  date,
  chamberId,
  chambers,
  doctorId,
  allowDelete = false,
  allowEdit = false,
  allowStart = true,
  clinicName,
}: {
  businessId?: string;
  date: string;
  chamberId?: string;
  chambers: Chamber[];
  doctorId?: string | null;
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
  const [filter, setFilter] = useState<"all" | "online" | "waiting" | "in_progress" | "done">("all");

  // Real-time listener: instantly reflect online portal bookings & status changes
  useEffect(() => {
    if (!businessId) return;
    const channel = supabase
      .channel(`rx-appts-realtime-${businessId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rx_appointments",
          filter: `business_id=eq.${businessId}`,
        },
        (payload: any) => {
          qc.invalidateQueries({ queryKey: ["rx-appointments"] });
          qc.invalidateQueries({ queryKey: ["rx-appointment-stats"] });
          if (payload.eventType === "INSERT") {
            const row = payload.new;
            if (row?.appt_date === date) {
              const isOnline =
                (row.notes || "").toLowerCase().includes("পোর্টাল") ||
                (row.notes || "").toLowerCase().includes("portal") ||
                (row.notes || "").toLowerCase().includes("অনলাইন");
              toast.info(
                `🔔 নতুন সিরিয়াল #${row.serial_no ?? "—"}: ${row.patient_name || "রোগী"} ${
                  isOnline ? "(অনলাইন পোর্টাল থেকে)" : ""
                }`,
              );
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, date, qc]);

  const list = useQuery({
    queryKey: ["rx-appointments", businessId, date, chamberId ?? "all", doctorId ?? "all"],
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
      if (chamberId && chamberId !== "all") {
        // Also show unassigned/portal appointments so staff never miss patient portal bookings!
        q = q.or(`chamber_id.eq.${chamberId},chamber_id.is.null`);
      }
      if (doctorId) {
        q = q.eq("doctor_id", doctorId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Appointment[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("rx_appointments").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("স্ট্যাটাস আপডেট হয়েছে");
      qc.invalidateQueries({ queryKey: ["rx-appointments"] });
      qc.invalidateQueries({ queryKey: ["rx-appointment-stats"] });
    },
    onError: (e: any) => toast.error(e.message),
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
          fee_amount: e.fee_amount.trim() === "" ? null : Number(e.fee_amount),
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
      (type === "medical"
        ? chamber?.fee_medical ?? 0
        : type === "old"
          ? chamber?.fee_old ?? null
          : chamber?.fee_new ?? null);
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

  const allRows = list.data ?? [];

  const counts = useMemo(() => {
    let online = 0;
    let waiting = 0;
    let inProgress = 0;
    let done = 0;
    for (const a of allRows) {
      const isOnline =
        (a.notes || "").toLowerCase().includes("পোর্টাল") ||
        (a.notes || "").toLowerCase().includes("portal") ||
        (a.notes || "").toLowerCase().includes("অনলাইন");
      if (isOnline) online++;
      const st = a.status || (a.prescription_id ? "in_progress" : "waiting");
      if (st === "waiting") waiting++;
      else if (st === "in_progress") inProgress++;
      else if (st === "done") done++;
    }
    return { all: allRows.length, online, waiting, inProgress, done };
  }, [allRows]);

  const rows = useMemo(() => {
    return allRows.filter((a) => {
      const isOnline =
        (a.notes || "").toLowerCase().includes("পোর্টাল") ||
        (a.notes || "").toLowerCase().includes("portal") ||
        (a.notes || "").toLowerCase().includes("অনলাইন");
      if (filter === "online") return isOnline;
      const st = a.status || (a.prescription_id ? "in_progress" : "waiting");
      if (filter === "waiting") return st === "waiting";
      if (filter === "in_progress") return st === "in_progress";
      if (filter === "done") return st === "done";
      return true;
    });
  }, [allRows, filter]);

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-xs overflow-hidden">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Stethoscope className="h-4 w-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">সিরিয়াল তালিকা · {formatDate(date)}</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                লাইভ
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              মোট {allRows.length} জন রোগী নথিবদ্ধ • {counts.waiting} জন অপেক্ষমান
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground bg-background rounded-lg border border-border px-2 py-1">
            <Printer className="h-3.5 w-3.5 text-muted-foreground" />
            <span>টোকেন সাইজ:</span>
            <select
              value={tokenSize}
              onChange={(e) => setTokenSize(e.target.value as TokenSize)}
              className="bg-transparent font-medium text-foreground text-xs focus:outline-hidden"
            >
              <option value="58mm">58mm POS</option>
              <option value="80mm">80mm POS</option>
              <option value="A5">Half A4</option>
            </select>
          </label>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-border/60 bg-muted/30 px-3 py-2 overflow-x-auto">
        <button
          onClick={() => setFilter("all")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            filter === "all"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          সকল রোগী ({counts.all})
        </button>
        <button
          onClick={() => setFilter("online")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            filter === "online"
              ? "bg-sky-600 text-white shadow-xs"
              : "text-sky-600 dark:text-sky-400 hover:bg-sky-500/10"
          }`}
        >
          <Globe className="h-3.5 w-3.5" />
          অনলাইন বুকিং ({counts.online})
        </button>
        <button
          onClick={() => setFilter("waiting")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            filter === "waiting"
              ? "bg-amber-600 text-white shadow-xs"
              : "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          অপেক্ষমান ({counts.waiting})
        </button>
        <button
          onClick={() => setFilter("in_progress")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            filter === "in_progress"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
          }`}
        >
          <Stethoscope className="h-3.5 w-3.5" />
          ডাক্তারের রুমে ({counts.inProgress})
        </button>
        <button
          onClick={() => setFilter("done")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            filter === "done"
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          সম্পন্ন ({counts.done})
        </button>
      </div>

      {list.isLoading ? (
        <div className="flex flex-col items-center justify-center p-10 text-muted-foreground">
          <RotateCcw className="h-6 w-6 animate-spin mb-2" />
          <p className="text-sm">সিরিয়াল তালিকা লোড হচ্ছে…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <Stethoscope className="h-10 w-10 text-muted-foreground/30 mb-2" />
          <p className="text-sm font-medium text-foreground">
            {filter === "online"
              ? "আজ কোনো অনলাইন বুকিং পাওয়া যায়নি"
              : filter === "waiting"
              ? "বর্তমানে কোনো অপেক্ষমান রোগী নেই"
              : filter === "done"
              ? "পরামর্শ সম্পন্ন হওয়া রোগী নেই"
              : "এই দিনের জন্য কোনো রোগীর সিরিয়াল নথিবদ্ধ নেই"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            নতুন রোগী যোগ করতে ওপরের কাউন্টার এন্ট্রি ফর্ম ব্যবহার করুন।
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {rows.map((a) => {
            const isOnline =
              (a.notes || "").toLowerCase().includes("পোর্টাল") ||
              (a.notes || "").toLowerCase().includes("portal") ||
              (a.notes || "").toLowerCase().includes("অনলাইন");
            const currentStatus = a.status || (a.prescription_id ? "in_progress" : "waiting");

            return (
              <li
                key={a.id}
                className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 p-3.5 text-sm transition-colors hover:bg-muted/30 ${
                  isOnline ? "bg-sky-500/5 dark:bg-sky-500/[0.03]" : ""
                }`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  {/* Serial Number Badge */}
                  <span className="flex h-9 min-w-9 items-center justify-center rounded-xl bg-primary/15 font-mono text-sm font-bold text-primary shadow-2xs">
                    #{a.serial_no ?? "—"}
                  </span>

                  {/* Patient Name & Details */}
                  <div className="flex flex-col">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground text-sm">{a.patient_name}</span>
                      {a.patient_code && (
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
                          {a.patient_code}
                        </span>
                      )}
                      {/* Booking Origin Badge */}
                      {isOnline ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-400">
                          <Globe className="h-3 w-3" /> অনলাইন পোর্টাল
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          <Building2 className="h-3 w-3" /> কাউন্টার
                        </span>
                      )}
                    </div>

                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      {(a.patient_age || a.patient_gender) && (
                        <span>
                          {[a.patient_age ? `${a.patient_age} বছর` : null, a.patient_gender]
                            .filter(Boolean)
                            .join(" / ")}
                        </span>
                      )}
                      {a.patient_phone && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-xs">{a.patient_phone}</span>
                        </>
                      )}
                      {a.chamber_id && (
                        <>
                          <span>•</span>
                          <span>{chamberName(a.chamber_id)}</span>
                        </>
                      )}
                      {a.doctor_id && doctors.data?.[a.doctor_id]?.name && (
                        <>
                          <span>•</span>
                          <span className="text-primary font-medium">
                            ডা. {doctors.data[a.doctor_id]!.name}
                          </span>
                        </>
                      )}
                      {a.appt_time && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-[11px]">{a.appt_time.slice(0, 5)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right badges & Actions */}
                <div className="flex flex-wrap items-center gap-2 ml-auto">
                  {/* Patient Type */}
                  <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {patientTypeLabel(a.patient_type, a.is_new_patient !== false)}
                  </span>

                  {/* Fee amount */}
                  {a.fee_amount != null && (
                    <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      ৳ {Number(a.fee_amount).toFixed(0)}
                    </span>
                  )}

                  {/* Status Dropdown */}
                  <select
                    value={currentStatus}
                    onChange={(e) => updateStatus.mutate({ id: a.id, status: e.target.value })}
                    className={`h-7 rounded-md border text-xs font-medium px-2 py-0 focus:outline-hidden ${
                      currentStatus === "done"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : currentStatus === "in_progress"
                        ? "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400"
                        : currentStatus === "cancelled"
                        ? "border-destructive/40 bg-destructive/10 text-destructive"
                        : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    }`}
                  >
                    <option value="waiting">⏳ অপেক্ষমান</option>
                    <option value="in_progress">🩺 ডাক্তারের রুমে</option>
                    <option value="done">✅ সম্পন্ন</option>
                    <option value="cancelled">❌ বাতিল</option>
                  </select>

                  {/* Token Print Button */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-xs"
                    title="প্রিন্ট টোকেন"
                    onClick={() => printToken(a)}
                  >
                    <Printer className="h-3.5 w-3.5 text-primary" />
                    <span>টোকেন</span>
                  </Button>

                  {/* Prescription Action */}
                  {allowStart &&
                    (a.prescription_id ? (
                      <Button size="sm" disabled className="h-8 text-xs gap-1" title="প্রেসক্রিপশন তৈরি হয়েছে">
                        <FileText className="h-3.5 w-3.5" /> Rx প্রস্তুত
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={busy === a.id}
                        onClick={() => start(a)}
                        className="h-8 text-xs gap-1"
                      >
                        <FileText className="h-3.5 w-3.5" /> প্রেসক্রিপশন
                      </Button>
                    ))}

                  {/* Edit Patient */}
                  {allowEdit && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      title="তথ্য সংশোধন"
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
                          fee_amount: a.fee_amount != null ? String(a.fee_amount) : "",
                        })
                      }
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}

                  {/* Delete Patient */}
                  {allowDelete && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      title="মুছে ফেলুন"
                      onClick={() => {
                        if (confirm(`রোগী "${a.patient_name}"-এর সিরিয়াল বাতিল করবেন?`)) {
                          del.mutate(a.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                <Label className="mb-1.5 block text-xs">Visit fee (৳)</Label>
                <Input
                  inputMode="numeric"
                  placeholder="From location fee setup"
                  value={edit.fee_amount}
                  onChange={(e) => setEdit({ ...edit, fee_amount: e.target.value.replace(/[^0-9.]/g, "") })}
                />
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
        .select("id, name, address, is_active, fee_new, fee_old, fee_medical, doctor_id")
        .eq("business_id", businessId!)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Chamber[];
    },
  });
}
