import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  MapPin,
  Search,
  Calendar,
  Clock,
  Stethoscope,
  Users,
  Globe,
  Building2,
  ChevronDown,
  ChevronUp,
  Printer,
  Phone,
  User,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  UserPlus,
  ArrowRight,
  ShieldCheck,
  CreditCard,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { useCurrentRole } from "@/hooks/use-current-role";
import { useMyStaffChamber } from "@/hooks/use-my-staff-chamber";
import { useBusinessDoctors } from "@/hooks/use-business-doctors";
import { dhakaToday } from "@/lib/appointments";
import { AppointmentQueue, useChambers } from "@/components/appointment-queue";
import { patientTypeLabel, printPatientToken, type TokenSize } from "@/lib/token-print";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FoldTable } from "@/components/fold-table";

export const Route = createFileRoute("/_authenticated/rx-appointments")({
  head: () => ({
    meta: [
      { title: "রোগী সিরিয়াল ও রিসেপশন ডেস্ক — Sheikh Pharma" },
      {
        name: "description",
        content:
          "ডাক্তার ও স্টাফদের জন্য লাইভ রোগী সিরিয়াল ম্যানেজমেন্ট, দ্রুত কাউন্টার এন্ট্রি ও ইনস্ট্যান্ট টোকেন প্রিন্টিং।",
      },
      { property: "og:title", content: "রোগী সিরিয়াল ও রিসেপশন ডেস্ক — Sheikh Pharma" },
      {
        property: "og:description",
        content: "লাইভ রোগী সিরিয়াল ও চেম্বার কাউন্টার ডেস্ক।",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AppointmentsPage,
});

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function AppointmentsPage() {
  const { data: business } = useCurrentBusiness();
  const businessId = business?.id;
  const qc = useQueryClient();

  const { isAssistant, role, isAdmin, isDoctor } = useCurrentRole();
  const isClinicStaff = !!role?.startsWith("Clinic Staff");
  const chambers = useChambers(businessId);
  const chamberList = chambers.data ?? [];
  const myStaff = useMyStaffChamber(businessId);
  const staffAccess = myStaff.data;

  // If assistant has specific chambers assigned, filter chamber list to those; otherwise show all
  const availableChambers = useMemo(() => {
    if (!isAssistant || !staffAccess) return chamberList;
    if (staffAccess.isAllLocations || staffAccess.assignedChamberIds.length === 0) {
      return chamberList;
    }
    return chamberList.filter((c) => staffAccess.assignedChamberIds.includes(c.id));
  }, [isAssistant, staffAccess, chamberList]);

  const doctorsQ = useBusinessDoctors(businessId);
  const doctorList = doctorsQ.data ?? [];
  const needsDoctorPick = doctorList.length > 1;

  const todayStr = dhakaToday();
  const [date, setDate] = useState(todayStr);
  const [chamberId, setChamberId] = useState<string>("");
  const [viewFilter, setViewFilter] = useState<"assigned" | "all">("assigned");
  const [doctorId, setDoctorId] = useState<string>("");
  const [autoPrintToken, setAutoPrintToken] = useState(true);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isChamberSettingsOpen, setIsChamberSettingsOpen] = useState(false);

  const [newChamber, setNewChamber] = useState({
    name: "",
    address: "",
    fee_new: "",
    fee_old: "",
    fee_medical: "",
    doctor_id: "",
  });
  const [history, setHistory] = useState("");

  const [form, setForm] = useState({
    patient_name: "",
    patient_age: "",
    patient_gender: "Male",
    patient_phone: "",
    appt_time: "",
    patient_type: "new",
    custom_fee: "",
  });

  // Keep live time in Dhaka
  const [currentTime, setCurrentTime] = useState("");
  useEffect(() => {
    const updateTime = () => {
      const now = new Date(Date.now() + 6 * 3600 * 1000);
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "UTC",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (availableChambers.length > 0) {
      if (!chamberId || !availableChambers.some((c) => c.id === chamberId)) {
        setChamberId(availableChambers[0].id);
      }
    }
  }, [availableChambers, chamberId]);

  // Current selected chamber details
  const activeChamber = useMemo(() => {
    return availableChambers.find((c) => c.id === chamberId) || availableChambers[0] || chamberList[0];
  }, [availableChambers, chamberId, chamberList]);

  // Target doctor for this appointment
  const targetDoctorId = useMemo(() => {
    return (
      (doctorId && !isAssistant
        ? doctorId
        : activeChamber?.doctor_id || doctorList[0]?.user_id) || null
    );
  }, [doctorId, isAssistant, activeChamber, doctorList]);

  // Dynamic next serial number for selected date & doctor
  const todayApptsQ = useQuery({
    queryKey: ["rx-appointments-preview", businessId, date],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rx_appointments")
        .select("id, serial_no, patient_phone, patient_name, patient_age, patient_gender, doctor_id, chamber_id")
        .eq("business_id", businessId!)
        .eq("appt_date", date);
      if (error) throw error;
      return data ?? [];
    },
  });

  const nextSerial = useMemo(() => {
    const rows = todayApptsQ.data ?? [];
    const filtered = targetDoctorId
      ? rows.filter((r: any) => r.doctor_id === targetDoctorId)
      : rows;
    if (!filtered.length) return 1;
    const maxSerial = Math.max(...filtered.map((r: any) => Number(r.serial_no) || 0));
    return maxSerial + 1;
  }, [todayApptsQ.data, targetDoctorId]);

  // Auto-calculated fee preview based on patient type & chamber
  const calculatedFee = useMemo(() => {
    if (form.custom_fee.trim() !== "") return Number(form.custom_fee) || 0;
    if (!activeChamber) return form.patient_type === "old" ? 300 : 500;
    if (form.patient_type === "report") return 0;
    if (form.patient_type === "medical") return Number(activeChamber.fee_medical) || 0;
    if (form.patient_type === "old")
      return Number(activeChamber.fee_old) || Number(activeChamber.fee_new) || 300;
    return Number(activeChamber.fee_new) || 500;
  }, [activeChamber, form.patient_type, form.custom_fee]);

  // Fast Phone Match from past patients
  const [matchedPatient, setMatchedPatient] = useState<any | null>(null);
  useEffect(() => {
    const cleanPhone = form.patient_phone.replace(/\D/g, "");
    if (cleanPhone.length >= 11 && !form.patient_name.trim()) {
      supabase
        .from("rx_appointments")
        .select("patient_name, patient_age, patient_gender, patient_code")
        .eq("business_id", businessId!)
        .ilike("patient_phone", `%${cleanPhone.slice(-10)}%`)
        .order("appt_date", { ascending: false })
        .limit(1)
        .then(({ data }) => {
          if (data?.[0]) {
            setMatchedPatient(data[0]);
          } else {
            setMatchedPatient(null);
          }
        });
    } else {
      setMatchedPatient(null);
    }
  }, [form.patient_phone, businessId]);

  const applyMatchedPatient = (p: any) => {
    setForm((s) => ({
      ...s,
      patient_name: p.patient_name || s.patient_name,
      patient_age: p.patient_age || s.patient_age,
      patient_gender: p.patient_gender || s.patient_gender,
      patient_type: "old",
    }));
    setMatchedPatient(null);
    toast.success(`রোগী "${p.patient_name}"-এর তথ্য স্বয়ংক্রিয়ভাবে যুক্ত হয়েছে`);
  };

  // Chamber Management Mutations
  const addChamber = useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error("No business");
      if (!newChamber.name.trim()) throw new Error("চেম্বারের নাম লিখুন");
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("rx_chambers").insert({
        business_id: businessId,
        name: newChamber.name.trim(),
        address: newChamber.address.trim() || null,
        fee_new: Number(newChamber.fee_new) || 0,
        fee_old: Number(newChamber.fee_old) || 0,
        fee_medical: Number(newChamber.fee_medical) || 0,
        doctor_id: newChamber.doctor_id || null,
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("চেম্বার লোকেশন যুক্ত হয়েছে");
      setNewChamber({
        name: "",
        address: "",
        fee_new: "",
        fee_old: "",
        fee_medical: "",
        doctor_id: "",
      });
      qc.invalidateQueries({ queryKey: ["rx-chambers"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateChamberDoctor = useMutation({
    mutationFn: async (v: { id: string; doctor_id: string | null }) => {
      const { error } = await supabase
        .from("rx_chambers")
        .update({ doctor_id: v.doctor_id })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("চেম্বারে ডাক্তার নিযুক্ত করা হয়েছে");
      qc.invalidateQueries({ queryKey: ["rx-chambers"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delChamber = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rx_chambers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("চেম্বার মুছে ফেলা হয়েছে");
      qc.invalidateQueries({ queryKey: ["rx-chambers"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveFees = useMutation({
    mutationFn: async (v: { id: string; fee_new: number; fee_old: number; fee_medical: number }) => {
      const { error } = await supabase
        .from("rx_chambers")
        .update({ fee_new: v.fee_new, fee_old: v.fee_old, fee_medical: v.fee_medical })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ভিজিট ফি আপডেট হয়েছে");
      qc.invalidateQueries({ queryKey: ["rx-chambers"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Patient History Search
  const historyQ = useQuery({
    queryKey: ["patient-history", businessId, history],
    enabled: !!businessId && history.trim().length >= 2,
    queryFn: async () => {
      const term = history.trim();
      const { data, error } = await supabase
        .from("rx_appointments")
        .select(
          "id, patient_code, patient_name, patient_age, patient_gender, patient_phone, appt_date, serial_no, chamber_id, fee_amount, is_new_patient, patient_type, prescription_id, doctor_id",
        )
        .eq("business_id", businessId!)
        .or(
          `patient_code.ilike.%${term}%,patient_name.ilike.%${term}%,patient_phone.ilike.%${term}%`,
        )
        .order("appt_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Add Patient Mutation
  const addPatient = useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error("ক্লিনিক বা ফার্মেসি অ্যাকাউন্ট পাওয়া যায়নি");
      if (!form.patient_name.trim()) throw new Error("রোগীর নাম লিখুন");
      if (needsDoctorPick && !isAssistant && !doctorId) {
        throw new Error("কোন ডাক্তারের অধীনে সিরিয়াল হবে তা নির্বাচন করুন");
      }

      const assignedChamber = chamberId || activeChamber?.id || null;

      // Dynamic consecutive serial number for targetDoctorId on this date
      let nextSerialToUse = 1;
      try {
        let q = supabase
          .from("rx_appointments")
          .select("serial_no")
          .eq("business_id", businessId)
          .eq("appt_date", date);
        if (targetDoctorId) {
          q = q.eq("doctor_id", targetDoctorId);
        }
        const { data: existingRows } = await q;
        if (existingRows && existingRows.length > 0) {
          const maxS = Math.max(
            0,
            ...existingRows.map((r: any) => Number(r.serial_no) || 0)
          );
          nextSerialToUse = maxS + 1;
        }
      } catch (err) {
        console.warn("[rx-appointments] Error calculating next serial:", err);
      }

      const { data: auth } = await supabase.auth.getUser();

      const { data: inserted, error } = await supabase
        .from("rx_appointments")
        .insert({
          business_id: businessId,
          chamber_id: assignedChamber,
          serial_no: nextSerialToUse,
          patient_name: form.patient_name.trim(),
          patient_age: form.patient_age.trim() || null,
          patient_gender: form.patient_gender || null,
          patient_phone: form.patient_phone.trim() || null,
          appt_date: date,
          appt_time: form.appt_time || null,
          patient_type: form.patient_type || "new",
          fee_amount: calculatedFee,
          status: "waiting",
          notes: "[কাউন্টার এন্ট্রি] রিসেপশন ডেস্ক থেকে বুকড",
          doctor_id: targetDoctorId,
          created_by: auth.user?.id ?? null,
        } as never)
        .select(
          "id, serial_no, patient_code, appt_date, appt_time, patient_name, patient_phone, patient_age, patient_gender, fee_amount, status, doctor_id, chamber_id"
        )
        .single();

      if (error) throw error;
      return inserted;
    },
    onSuccess: (inserted: any) => {
      toast.success(`🎉 সিরিয়াল #${inserted.serial_no ?? ""} নিশ্চিত হয়েছে!`);

      // Auto-print token if enabled
      if (autoPrintToken && inserted) {
        const doc = doctorList.find((d) => d.user_id === inserted.doctor_id);
        const ch = chamberList.find((c) => c.id === inserted.chamber_id);
        printPatientToken(
          {
            clinicName: business?.clinic_mode ? business?.name ?? null : null,
            doctorName: doc?.name ? `Dr. ${doc.name}` : null,
            serialNo: inserted.serial_no,
            patientCode: inserted.patient_code ?? null,
            fee: inserted.fee_amount,
            isNewPatient: form.patient_type === "new",
            patientType: form.patient_type,
            patientName: inserted.patient_name,
            age: inserted.patient_age,
            gender: inserted.patient_gender,
            phone: inserted.patient_phone,
            location: ch?.name ?? null,
            date: formatDate(inserted.appt_date),
            time: inserted.appt_time ? inserted.appt_time.slice(0, 5) : null,
          },
          "80mm"
        );
      }

      setForm({
        patient_name: "",
        patient_age: "",
        patient_gender: "Male",
        patient_phone: "",
        appt_time: "",
        patient_type: "new",
        custom_fee: "",
      });
      setMatchedPatient(null);

      qc.invalidateQueries({ queryKey: ["rx-appointments"] });
      qc.invalidateQueries({ queryKey: ["rx-appointment-stats"] });
      qc.invalidateQueries({ queryKey: ["rx-appointments-preview"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Effective chamberId to pass to AppointmentQueue:
  // If staff has selected "all" view, pass undefined so all chamber & online serials are shown!
  const effectiveChamberId =
    viewFilter === "all" ? undefined : chamberId || undefined;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* 1. Header & Live Reception Desk Bar */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/5 p-5 md:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-xs">
                <Building2 className="h-5 w-5" />
              </span>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                রোগী সিরিয়াল ও রিসেপশন ডেস্ক
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                লাইভ সিঙ্ক চালু
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground flex flex-wrap items-center gap-2">
              <span>লাইভ সিরিয়াল ট্র্যাকিং, রোগী কাউন্টার এন্ট্রি ও ইনস্ট্যান্ট স্লিপ প্রিন্টিং</span>
              {currentTime && (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 font-mono font-medium text-foreground bg-muted/60 px-2 py-0.5 rounded-md">
                    <Clock className="h-3 w-3 text-primary" /> {currentTime} (ঢাকা)
                  </span>
                </>
              )}
            </p>
          </div>

          {/* Quick Desk Badges */}
          <div className="flex flex-wrap items-center gap-2">
            {isAssistant ? (
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary gap-1.5 py-1 px-3 text-xs">
                <MapPin className="h-3.5 w-3.5" />
                <span>
                  {availableChambers.length === 1
                    ? `চেম্বার: ${availableChambers[0]?.name}`
                    : staffAccess?.isAllLocations
                    ? `সব চেম্বার (${chamberList.length}টি সক্রিয়)`
                    : `অ্যাসাইন করা চেম্বার (${availableChambers.length}টি)`}
                </span>
              </Badge>
            ) : chamberList.length > 0 ? (
              <Badge variant="outline" className="border-border/60 bg-muted/50 gap-1.5 py-1 px-3 text-xs">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <span>{chamberList.length}টি চেম্বার সক্রিয়</span>
              </Badge>
            ) : null}

            <Badge variant="secondary" className="gap-1.5 py-1 px-3 text-xs font-medium">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>{isAssistant ? "কাউন্টার স্টাফ" : isDoctor ? "চিকিৎসক" : "অ্যাডমিন ডেস্ক"}</span>
            </Badge>
          </div>
        </div>

        {/* Date Selector & View Filter Strip */}
        <div className="mt-5 pt-4 border-t border-border/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground mr-1">তারিখ নির্বাচন:</span>
            <button
              onClick={() => setDate(todayStr)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                date === todayStr
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-background border border-border text-foreground hover:bg-muted"
              }`}
            >
              আজ
            </button>
            <button
              onClick={() => setDate(addDays(todayStr, 1))}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                date === addDays(todayStr, 1)
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-background border border-border text-foreground hover:bg-muted"
              }`}
            >
              আগামীকাল
            </button>
            <button
              onClick={() => setDate(addDays(todayStr, 2))}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                date === addDays(todayStr, 2)
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-background border border-border text-foreground hover:bg-muted"
              }`}
            >
              পরশু
            </button>
            <div className="relative">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value || todayStr)}
                className="h-8 w-36 text-xs font-medium"
              />
            </div>
          </div>

          {/* Chamber View Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">তালিকা ভিউ:</span>
            <div className="inline-flex rounded-lg border border-border bg-background p-0.5 text-xs">
              <button
                onClick={() => setViewFilter("assigned")}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  viewFilter === "assigned"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                আমার চেম্বার ও অনলাইন
              </button>
              <button
                onClick={() => setViewFilter("all")}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  viewFilter === "all"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                সকল চেম্বার ও অনলাইন
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top Queue KPI Stats Strip */}
      <QueueStats businessId={businessId} date={date} />

      {/* 3. Fast Walk-in Patient Entry Card */}
      <div className="rounded-2xl border border-border/60 bg-card p-4 md:p-5 shadow-xs">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserPlus className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-semibold text-foreground">সরাসরি আসা রোগীর সিরিয়াল এন্ট্রি (Walk-in Counter)</h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600 animate-spin" />
              পরবর্তী সিরিয়াল: #{nextSerial}
            </span>
          </div>
        </div>

        {/* Matched Past Patient Suggestion Pill */}
        {matchedPatient && (
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-600" />
              <span>
                পূর্ববর্তী রোগী পাওয়া গেছে: <strong>{matchedPatient.patient_name}</strong> (
                {matchedPatient.patient_age ? `${matchedPatient.patient_age}y` : "বয়স নেই"} /{" "}
                {matchedPatient.patient_gender || "লিঙ্গ নেই"})
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-amber-500/40 bg-background text-amber-800 dark:text-amber-100 hover:bg-amber-500/20"
              onClick={() => applyMatchedPatient(matchedPatient)}
            >
              অটো-ফিল করুন
            </Button>
          </div>
        )}

        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label className="mb-1 block text-xs font-medium text-foreground">রোগীর নাম *</Label>
            <Input
              value={form.patient_name}
              onChange={(e) => setForm((s) => ({ ...s, patient_name: e.target.value }))}
              placeholder="যেমন: মোঃ জাহিদ হাসান"
              className="h-9"
            />
          </div>

          <div>
            <Label className="mb-1 block text-xs font-medium text-foreground">মোবাইল নম্বর</Label>
            <Input
              value={form.patient_phone}
              onChange={(e) => setForm((s) => ({ ...s, patient_phone: e.target.value }))}
              placeholder="017XXXXXXXX"
              className="h-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="mb-1 block text-xs font-medium text-foreground">বয়স</Label>
              <Input
                value={form.patient_age}
                onChange={(e) => setForm((s) => ({ ...s, patient_age: e.target.value }))}
                placeholder="যেমন: ৩২"
                className="h-9"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium text-foreground">লিঙ্গ</Label>
              <select
                value={form.patient_gender}
                onChange={(e) => setForm((s) => ({ ...s, patient_gender: e.target.value }))}
                className="h-9 w-full rounded-lg border border-border bg-input px-2 text-xs"
              >
                <option value="Male">পুরুষ (Male)</option>
                <option value="Female">মহিলা (Female)</option>
                <option value="Other">অন্যান্য (Other)</option>
              </select>
            </div>
          </div>

          <div>
            <Label className="mb-1 block text-xs font-medium text-foreground">রোগীর ধরন</Label>
            <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setForm((s) => ({ ...s, patient_type: "new" }))}
                className={`rounded py-1 text-center text-[11px] font-semibold transition-colors ${
                  form.patient_type === "new"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                নতুন
              </button>
              <button
                type="button"
                onClick={() => setForm((s) => ({ ...s, patient_type: "old" }))}
                className={`rounded py-1 text-center text-[11px] font-semibold transition-colors ${
                  form.patient_type === "old"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                পুরাতন
              </button>
              <button
                type="button"
                onClick={() => setForm((s) => ({ ...s, patient_type: "report" }))}
                className={`rounded py-1 text-center text-[11px] font-semibold transition-colors ${
                  form.patient_type === "report"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                রিপোর্ট
              </button>
            </div>
          </div>

          {/* Location & Doctor Row */}
          <div>
            <Label className="mb-1 block text-xs font-medium text-foreground">চেম্বার লোকেশন</Label>
            {isAssistant && availableChambers.length <= 1 ? (
              <div className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 text-xs">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                <span className="truncate">
                  {availableChambers[0]?.name ?? "নির্ধারিত চেম্বার"}
                </span>
              </div>
            ) : (
              <select
                value={chamberId}
                onChange={(e) => setChamberId(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-input px-3 text-xs font-medium"
              >
                {availableChambers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {needsDoctorPick && !isAssistant && (
            <div>
              <Label className="mb-1 block text-xs font-medium text-foreground">ডাক্তার *</Label>
              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-input px-3 text-xs"
              >
                <option value="">— ডাক্তার নির্বাচন করুন —</option>
                {doctorList.map((d) => (
                  <option key={d.user_id} value={d.user_id}>
                    ডা. {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <Label className="mb-1 block text-xs font-medium text-foreground">সময় / স্লট (ঐচ্ছিক)</Label>
            <Input
              type="time"
              value={form.appt_time}
              onChange={(e) => setForm((s) => ({ ...s, appt_time: e.target.value }))}
              className="h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Label className="mb-1 block text-xs font-medium text-foreground">ভিজিট ফি (৳)</Label>
              <Input
                inputMode="numeric"
                value={form.custom_fee !== "" ? form.custom_fee : String(calculatedFee)}
                onChange={(e) =>
                  setForm((s) => ({ ...s, custom_fee: e.target.value.replace(/[^0-9]/g, "") }))
                }
                placeholder="৳ ফি"
                className="h-9 font-semibold text-emerald-700 dark:text-emerald-400"
              />
            </div>
            <div className="pt-5">
              <Button
                type="button"
                className="h-9 px-5 font-semibold gap-1.5"
                onClick={() => addPatient.mutate()}
                disabled={addPatient.isPending}
              >
                <Plus className="h-4 w-4" />
                <span>{addPatient.isPending ? "যুক্ত হচ্ছে…" : "সিরিয়াল নিন"}</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border/40 pt-2.5">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoPrintToken}
              onChange={(e) => setAutoPrintToken(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
            />
            <span>সিরিয়াল যুক্ত করার সাথে সাথেই স্বয়ংক্রিয়ভাবে টোকেন প্রিন্ট করুন</span>
          </label>
          <span className="text-[11px] text-muted-foreground">
            * অনলাইন পোর্টাল থেকে দেওয়া সিরিয়ালগুলো স্বয়ংক্রিয়ভাবে কিউতে যুক্ত হবে
          </span>
        </div>
      </div>

      {/* 4. Complete Appointment Queue Component with Tabs & Realtime */}
      <AppointmentQueue
        businessId={businessId}
        date={date}
        chamberId={effectiveChamberId}
        chambers={chamberList}
        clinicName={business?.clinic_mode ? business?.name ?? null : null}
        allowDelete
        allowEdit
        allowStart={!isAssistant}
      />

      {/* 5. Patient History & Lookup Directory (Collapsible) */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setIsHistoryOpen((s) => !s)}
          className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-muted/30"
        >
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">রোগী অনুসন্ধান ও পূর্ববর্তী ভিজিট হিস্ট্রি</h2>
          </div>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            {isHistoryOpen ? "সংকুচিত করুন" : "খুঁজতে ক্লিক করুন"}
            {isHistoryOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </button>

        {isHistoryOpen && (
          <div className="p-4 pt-0 border-t border-border/50">
            <div className="mt-3">
              <Input
                placeholder="রোগীর আইডি (যেমন: JOY123456), নাম অথবা মোবাইল নম্বর লিখুন…"
                value={history}
                onChange={(e) => setHistory(e.target.value)}
                className="h-10"
              />
            </div>

            {history.trim().length >= 2 && (
              <div className="mt-3 overflow-x-auto">
                {historyQ.isLoading ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">খোঁজা হচ্ছে…</p>
                ) : !historyQ.data?.length ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">কোনো পূর্ববর্তী রেকর্ড পাওয়া যায়নি।</p>
                ) : (
                  <FoldTable className="w-full text-xs">
                    <thead className="bg-muted/40 text-muted-foreground">
                      <tr className="border-b border-border/60 text-left">
                        <th className="py-2 px-3">তারিখ</th>
                        <th className="py-2 px-3">আইডি</th>
                        <th className="py-2 px-3">নাম</th>
                        <th className="py-2 px-3">বয়স / লিঙ্গ</th>
                        <th className="py-2 px-3">মোবাইল</th>
                        <th className="py-2 px-3">চেম্বার</th>
                        <th className="py-2 px-3">সিরিয়াল</th>
                        <th className="py-2 px-3">ধরন</th>
                        <th className="py-2 px-3">ফি</th>
                        <th className="py-2 px-3 text-right">অ্যাকশন</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {historyQ.data.map((h: any) => (
                        <tr key={h.id} className="hover:bg-muted/20">
                          <td className="py-2 px-3 whitespace-nowrap font-mono">{h.appt_date}</td>
                          <td className="py-2 px-3 font-mono font-medium text-foreground">
                            {h.patient_code ?? "—"}
                          </td>
                          <td className="py-2 px-3 font-medium text-foreground">{h.patient_name}</td>
                          <td className="py-2 px-3">
                            {h.patient_age ?? "—"}
                            {h.patient_gender ? ` / ${h.patient_gender}` : ""}
                          </td>
                          <td className="py-2 px-3 font-mono">{h.patient_phone ?? "—"}</td>
                          <td className="py-2 px-3">
                            {chamberList.find((c) => c.id === h.chamber_id)?.name ?? "—"}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold">#{h.serial_no ?? "—"}</td>
                          <td className="py-2 px-3">
                            {patientTypeLabel(h.patient_type, h.is_new_patient !== false)}
                          </td>
                          <td className="py-2 px-3 font-medium text-emerald-600">
                            {h.fee_amount != null ? `৳ ${Number(h.fee_amount).toFixed(0)}` : "—"}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={() => {
                                setForm((s) => ({
                                  ...s,
                                  patient_name: h.patient_name || "",
                                  patient_phone: h.patient_phone || "",
                                  patient_age: h.patient_age || "",
                                  patient_gender: h.patient_gender || "Male",
                                  patient_type: "old",
                                }));
                                window.scrollTo({ top: 0, behavior: "smooth" });
                                toast.info("ফর্ম অটোফিল হয়েছে। তারিখ ও ফি যাচাই করে সিরিয়াল নিন।");
                              }}
                            >
                              <Plus className="h-3 w-3" /> আজকের সিরিয়াল
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </FoldTable>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 6. Chamber & Fee Configuration (For Doctors / Admins) */}
      {!isAssistant && !isClinicStaff && (
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <button
            type="button"
            onClick={() => setIsChamberSettingsOpen((s) => !s)}
            className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-muted/30"
          >
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">চেম্বার লোকেশন ও ফি কনফিগারেশন</h2>
            </div>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              {isChamberSettingsOpen ? "সংকুচিত করুন" : "কনফিগারেশন খুলুন"}
              {isChamberSettingsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          </button>

          {isChamberSettingsOpen && (
            <div className="p-4 pt-0 border-t border-border/50">
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto_auto_auto_auto]">
                <Input
                  placeholder="চেম্বারের নাম (যেমন: প্রধান শাখা)"
                  value={newChamber.name}
                  onChange={(e) => setNewChamber((s) => ({ ...s, name: e.target.value }))}
                />
                <Input
                  placeholder="ঠিকানা (যেমন: মুক্তাগাছা)"
                  value={newChamber.address}
                  onChange={(e) => setNewChamber((s) => ({ ...s, address: e.target.value }))}
                />
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 py-1 text-xs"
                  value={newChamber.doctor_id}
                  onChange={(e) => setNewChamber((s) => ({ ...s, doctor_id: e.target.value }))}
                >
                  <option value="">সকল ডাক্তার / All Doctors</option>
                  {doctorList.map((d) => (
                    <option key={d.user_id} value={d.user_id}>
                      ডাক্তার: {d.name}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="নতুন ফি ৳"
                  className="w-24"
                  inputMode="numeric"
                  value={newChamber.fee_new}
                  onChange={(e) =>
                    setNewChamber((s) => ({ ...s, fee_new: e.target.value.replace(/[^0-9.]/g, "") }))
                  }
                />
                <Input
                  placeholder="পুরাতন ফি ৳"
                  className="w-24"
                  inputMode="numeric"
                  value={newChamber.fee_old}
                  onChange={(e) =>
                    setNewChamber((s) => ({ ...s, fee_old: e.target.value.replace(/[^0-9.]/g, "") }))
                  }
                />
                <Input
                  placeholder="মেডিকেল ৳"
                  className="w-24"
                  inputMode="numeric"
                  value={newChamber.fee_medical}
                  onChange={(e) =>
                    setNewChamber((s) => ({ ...s, fee_medical: e.target.value.replace(/[^0-9.]/g, "") }))
                  }
                />
                <Button onClick={() => addChamber.mutate()} disabled={addChamber.isPending}>
                  <Plus className="mr-1 h-4 w-4" /> যোগ করুন
                </Button>
              </div>

              {chamberList.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {chamberList.map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/20 p-2.5 text-xs"
                    >
                      <span className="font-semibold text-foreground">{c.name}</span>
                      {c.address && <span className="text-muted-foreground">({c.address})</span>}
                      <select
                        className="h-7 rounded border border-border bg-background px-2 text-[11px]"
                        value={c.doctor_id || ""}
                        onChange={(e) =>
                          updateChamberDoctor.mutate({ id: c.id, doctor_id: e.target.value || null })
                        }
                      >
                        <option value="">সকল ডাক্তার / All Doctors</option>
                        {doctorList.map((d) => (
                          <option key={d.user_id} value={d.user_id}>
                            ডাক্তার: {d.name}
                          </option>
                        ))}
                      </select>
                      <span className="ml-auto flex flex-wrap items-center gap-1.5">
                        <span className="text-muted-foreground">নতুন:</span>
                        <Input
                          className="h-7 w-16 text-xs"
                          inputMode="numeric"
                          defaultValue={String(c.fee_new ?? 0)}
                          onBlur={(e) =>
                            saveFees.mutate({
                              id: c.id,
                              fee_new: Number(e.target.value) || 0,
                              fee_old: Number(c.fee_old ?? 0),
                              fee_medical: Number(c.fee_medical ?? 0),
                            })
                          }
                        />
                        <span className="text-muted-foreground">পুরাতন:</span>
                        <Input
                          className="h-7 w-16 text-xs"
                          inputMode="numeric"
                          defaultValue={String(c.fee_old ?? 0)}
                          onBlur={(e) =>
                            saveFees.mutate({
                              id: c.id,
                              fee_new: Number(c.fee_new ?? 0),
                              fee_old: Number(e.target.value) || 0,
                              fee_medical: Number(c.fee_medical ?? 0),
                            })
                          }
                        />
                        <span className="text-muted-foreground">মেডিকেল:</span>
                        <Input
                          className="h-7 w-16 text-xs"
                          inputMode="numeric"
                          defaultValue={String(c.fee_medical ?? 0)}
                          onBlur={(e) =>
                            saveFees.mutate({
                              id: c.id,
                              fee_new: Number(c.fee_new ?? 0),
                              fee_old: Number(c.fee_old ?? 0),
                              fee_medical: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </span>
                      <button
                        className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-muted"
                        onClick={() => {
                          if (confirm(`চেম্বার "${c.name}" মুছে ফেলতে চান?`)) delChamber.mutate(c.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** QueueStats: 5 vibrant Glassmorphic KPI cards */
function QueueStats({ businessId, date }: { businessId?: string; date: string }) {
  const stats = useQuery({
    queryKey: ["rx-appointment-stats", businessId, date],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rx_appointments")
        .select("id, status, prescription_id, notes, fee_amount")
        .eq("business_id", businessId!)
        .eq("appt_date", date);
      if (error) throw error;
      const rows = data ?? [];

      const online = rows.filter((r: any) => {
        const n = (r.notes || "").toLowerCase();
        return n.includes("পোর্টাল") || n.includes("portal") || n.includes("অনলাইন");
      }).length;

      const totalFee = rows.reduce((sum: number, r: any) => sum + (Number(r.fee_amount) || 0), 0);

      return {
        total: rows.length,
        online,
        waiting: rows.filter(
          (r: any) => !r.prescription_id && r.status !== "done" && r.status !== "cancelled"
        ).length,
        inProgress: rows.filter((r: any) => !!r.prescription_id || r.status === "in_progress").length,
        done: rows.filter((r: any) => r.status === "done" || r.status === "completed").length,
        totalFee,
      };
    },
  });

  const s = stats.data ?? { total: 0, online: 0, waiting: 0, inProgress: 0, done: 0, totalFee: 0 };

  const cards = [
    {
      label: "আজকের মোট সিরিয়াল",
      value: s.total,
      icon: Users,
      color: "bg-primary/10 text-primary border-primary/20",
      textColor: "text-foreground",
    },
    {
      label: "অনলাইন পোর্টাল বুকিং",
      value: s.online,
      icon: Globe,
      color: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
      textColor: "text-sky-600 dark:text-sky-400",
    },
    {
      label: "অপেক্ষমান রোগী",
      value: s.waiting,
      icon: Clock,
      color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      textColor: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "ডাক্তারের রুমে",
      value: s.inProgress,
      icon: Stethoscope,
      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      textColor: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "পরামর্শ সম্পন্ন",
      value: s.done,
      icon: CheckCircle2,
      color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      textColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "আজকের সংগৃহীত ফি",
      value: `৳ ${s.totalFee.toLocaleString()}`,
      icon: CreditCard,
      color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      textColor: "text-purple-600 dark:text-purple-400",
    },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`rounded-2xl border p-3.5 bg-card transition-all hover:shadow-xs ${c.color}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">{c.label}</span>
            <c.icon className="h-4 w-4 opacity-80" />
          </div>
          <p className={`mt-2 font-display text-xl sm:text-2xl font-bold ${c.textColor}`}>
            {c.value}
          </p>
        </div>
      ))}
    </div>
  );
}
