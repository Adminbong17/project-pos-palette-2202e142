import { useState, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  User,
  Phone,
  Stethoscope,
  MapPin,
  CheckCircle2,
  Download,
  Sparkles,
  ArrowRight,
  Loader2,
  Building2,
  ShieldCheck,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  bookPatientAppointment,
  getPatientsByPhone,
  type AvailableDoctor,
} from "@/lib/patient-portal.functions";
import { downloadTokenAsJpg, getTokenDataUrl } from "@/lib/token-jpg";
import { cn } from "@/lib/utils";

type Lang = "bn" | "en";

export interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctors: AvailableDoctor[];
  initialDoctorId?: string | null;
  patientPhone?: string;
  patientName?: string;
  lang: Lang;
  onBookingComplete?: (result: any) => void;
}

/** Formats dates into Bengali or English display strings. */
export function getAvailableDates(lang: Lang) {
  const dates: { value: string; label: string; badge?: string }[] = [];
  const bnDays = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
  const bnMonths = ["জানু", "ফেব্রু", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টে", "অক্টো", "নভে", "ডিসে"];
  const enDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const enMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const now = new Date();

  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dayNum = String(d.getDate()).padStart(2, "0");
    const iso = `${y}-${m}-${dayNum}`;

    if (i === 0) {
      dates.push({
        value: iso,
        label: lang === "bn" ? `আজ (${dayNum} ${bnMonths[d.getMonth()]})` : `Today (${dayNum} ${enMonths[d.getMonth()]})`,
        badge: lang === "bn" ? "আজ" : "Today",
      });
    } else if (i === 1) {
      dates.push({
        value: iso,
        label: lang === "bn" ? `আগামীকাল (${dayNum} ${bnMonths[d.getMonth()]})` : `Tomorrow (${dayNum} ${enMonths[d.getMonth()]})`,
        badge: lang === "bn" ? "আগামীকাল" : "Tomorrow",
      });
    } else {
      const dayName = lang === "bn" ? bnDays[d.getDay()] : enDays[d.getDay()];
      const monthName = lang === "bn" ? bnMonths[d.getMonth()] : enMonths[d.getMonth()];
      dates.push({
        value: iso,
        label: `${dayName}, ${dayNum} ${monthName}`,
      });
    }
  }
  return dates;
}

/** Clean 11-digit BD mobile numbers. */
function cleanPhone(raw: string) {
  let p = String(raw ?? "").replace(/\D/g, "");
  if (p.startsWith("880")) p = p.slice(3);
  else if (p.startsWith("+88")) p = p.slice(3);
  else if (p.startsWith("88")) p = p.slice(2);
  if (p.length === 10 && p.startsWith("1")) p = `0${p}`;
  return p;
}

/* -------------------------------------------------------------------------- */
/*                       DOCTOR CARD (FOR DIRECTORY VIEW)                     */
/* -------------------------------------------------------------------------- */
export function DoctorCard({
  doctor,
  lang,
  onBook,
}: {
  doctor: AvailableDoctor;
  lang: Lang;
  onBook: (doctor: AvailableDoctor) => void;
}) {
  const primaryChamber = doctor.chambers[0];
  const isBn = lang === "bn";

  return (
    <Card className="group relative overflow-hidden rounded-2xl border border-border/80 bg-card/90 p-5 shadow-sm backdrop-blur-md transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:-translate-y-0.5">
      {/* Top Accent Gradient on Hover */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        {/* Doctor Identity */}
        <div className="flex items-start gap-3.5">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-primary/25 bg-gradient-to-br from-primary/10 to-teal-500/10 shadow-inner">
            <Stethoscope className="h-7 w-7 text-primary" />
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-card" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-bold text-foreground tracking-tight">
                {doctor.name}
              </h3>
              {doctor.today_queue > 0 && (
                <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                  {isBn ? `আজকের সিরিয়াল: ${doctor.today_queue} জন` : `Today's Queue: ${doctor.today_queue}`}
                </Badge>
              )}
            </div>

            <p className="mt-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {doctor.qualification}
            </p>

            {/* Doctor Sitting Locations */}
            {doctor.chambers.length > 0 && (
              <div className="mt-2.5 space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>
                    {doctor.chambers.length === 1
                      ? doctor.chambers[0].name
                      : isBn
                      ? `${doctor.chambers.length}টি চেম্বার / লোকেশন`
                      : `${doctor.chambers.length} Sitting Locations`}
                  </span>
                </div>
                {doctor.chambers.map((c, i) => (
                  <div key={c.id || i} className="text-[11px] pl-5 text-muted-foreground flex items-center justify-between">
                    <span className="line-clamp-1">{c.name} {c.address ? `(${c.address})` : ""}</span>
                    <span className="shrink-0 font-semibold text-foreground ml-2">৳{c.fee_new || 500}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Button & Fee Column */}
        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-border/50">
          {primaryChamber && (
            <div className="text-left sm:text-right">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                {isBn ? "পরামর্শ ফি" : "Visit Fee"}
              </span>
              <span className="text-base font-extrabold text-foreground">
                ৳{primaryChamber.fee_new || 500}
              </span>
            </div>
          )}

          <Button
            size="sm"
            onClick={() => onBook(doctor)}
            className="rounded-xl px-4 font-semibold shadow-sm shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            <Calendar className="mr-1.5 h-3.5 w-3.5" />
            <span>{isBn ? "সিরিয়াল নিন" : "Book Serial"}</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*                         BOOKING DIALOG MODAL                               */
/* -------------------------------------------------------------------------- */
export function DoctorBookingModal({
  isOpen,
  onClose,
  doctors,
  initialDoctorId,
  patientPhone = "",
  patientName = "",
  lang,
  onBookingComplete,
}: BookingModalProps) {
  const isBn = lang === "bn";
  const bookFn = useServerFn(bookPatientAppointment);
  const fetchPatientsFn = useServerFn(getPatientsByPhone);

  const dates = getAvailableDates(lang);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(
    initialDoctorId || (doctors[0]?.id ?? "")
  );
  const [selectedDate, setSelectedDate] = useState<string>(dates[0]?.value ?? "");
  const [selectedChamberId, setSelectedChamberId] = useState<string>("");
  const [name, setName] = useState(patientName);
  const [phone, setPhone] = useState(patientPhone);
  const [patientCode, setPatientCode] = useState<string>("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("Male");
  const [patientType, setPatientType] = useState<"new" | "old" | "report">("new");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [isSavingJpg, setIsSavingJpg] = useState(false);
  const [successData, setSuccessData] = useState<any | null>(null);

  // Multiple patients under single phone
  const [familyMembers, setFamilyMembers] = useState<{ uid: string; name: string; age?: string; gender?: string }[]>([]);
  const [isNewMemberMode, setIsNewMemberMode] = useState(false);

  const currentDoctor = doctors.find((d) => d.id === selectedDoctorId) || doctors[0];
  
  // Set default chamber when doctor changes
  useEffect(() => {
    if (currentDoctor?.chambers?.length) {
      setSelectedChamberId(currentDoctor.chambers[0].id || "");
    }
  }, [currentDoctor]);

  const activeChamber =
    currentDoctor?.chambers?.find((c) => c.id === selectedChamberId) ||
    currentDoctor?.chambers?.[0];

  // Fetch registered patients whenever 11 digits phone is entered
  useEffect(() => {
    const clean = cleanPhone(phone);
    if (clean.length === 11) {
      fetchPatientsFn({ data: { phone: clean } })
        .then((res) => {
          const pts = res?.patients || [];
          setFamilyMembers(pts);
          if (pts.length > 0 && !name.trim()) {
            // Pre-select first family member if name not typed yet
            const first = pts[0];
            setName(first.name);
            setPatientCode(first.uid);
            if (first.age) setAge(first.age);
            if (first.gender) setGender(first.gender);
            setPatientType("old");
            setIsNewMemberMode(false);
          }
        })
        .catch(() => {});
    } else {
      setFamilyMembers([]);
    }
  }, [phone]);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentDoctor) {
      toast.error(isBn ? "ডাক্তার নির্বাচন করুন" : "Please select a doctor");
      return;
    }
    if (!name.trim()) {
      toast.error(isBn ? "রোগীর নাম লিখুন" : "Please enter patient name");
      return;
    }
    const normalizedPhone = cleanPhone(phone);
    if (!/^01\d{9}$/.test(normalizedPhone)) {
      toast.error(isBn ? "সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)" : "Please enter a valid 11-digit mobile number");
      return;
    }

    setBusy(true);
    try {
      const res = await bookFn({
        data: {
          doctor_id: currentDoctor.id,
          chamber_id: activeChamber?.id || null,
          patient_code: patientCode.trim() || null,
          patient_name: name.trim(),
          phone: normalizedPhone,
          patient_age: age.trim() || null,
          patient_gender: gender || null,
          appt_date: selectedDate,
          patient_type: patientType,
          notes: notes.trim() || null,
        },
      });

      setSuccessData(res);
      if (res.already_booked) {
        toast.info(
          isBn
            ? `এই রোগীর জন্য আজকের সিরিয়াল ইতিমধ্যে নেওয়া রয়েছে (নং #${res.serial_no})`
            : `Serial #${res.serial_no} is already booked for this patient today`
        );
      } else {
        toast.success(
          isBn
            ? `🎉 সিরিয়াল নিশ্চিত হয়েছে! সিরিয়াল নং: #${res.serial_no}`
            : `🎉 Serial confirmed! Serial #${res.serial_no}`
        );
      }
    } catch (err: any) {
      toast.error(err.message || (isBn ? "সিরিয়াল বুকিং করা যায়নি" : "Failed to book serial"));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveTokenJpg = async () => {
    if (!successData) return;
    setIsSavingJpg(true);
    try {
      const ok = await downloadTokenAsJpg({
        clinicName: "শেখ ফার্মা ও ডায়াগনস্টিক",
        doctorName: successData.doctor_name,
        doctorQualification: successData.doctor_qualification,
        serialNo: successData.serial_no,
        patientCode: successData.patient_code || patientCode,
        fee: successData.fee_amount,
        patientType: patientType === "new" ? "New patient" : patientType === "old" ? "Old patient" : "Report",
        patientName: successData.patient_name,
        age: age ? `${age} Y` : undefined,
        gender: gender,
        phone: successData.phone,
        location: successData.chamber_name,
        date: successData.appt_date,
      });
      if (ok) {
        toast.success(isBn ? "🎉 টোকেনটি সফলভাবে সেভ হয়েছে!" : "🎉 Token saved successfully!");
      }
    } catch (err: any) {
      toast.error(isBn ? "ছবি সেভ করতে সমস্যা হয়েছে" : "Failed to save token image");
    } finally {
      setIsSavingJpg(false);
    }
  };

  const handleOpenImage = () => {
    if (!successData) return;
    try {
      const dataUrl = getTokenDataUrl({
        clinicName: "শেখ ফার্মা ও ডায়াগনস্টিক",
        doctorName: successData.doctor_name,
        doctorQualification: successData.doctor_qualification,
        serialNo: successData.serial_no,
        patientCode: successData.patient_code || patientCode,
        fee: successData.fee_amount,
        patientType: patientType === "new" ? "New patient" : patientType === "old" ? "Old patient" : "Report",
        patientName: successData.patient_name,
        age: age ? `${age} Y` : undefined,
        gender: gender,
        phone: successData.phone,
        location: successData.chamber_name,
        date: successData.appt_date,
      });
      const win = window.open();
      if (win) {
        win.document.write(`<title>টোকেন #${successData.serial_no}</title><style>body{margin:0;display:flex;justify-content:center;align-items:center;background:#0f172a;min-height:100vh;padding:12px;box-sizing:border-box;}img{max-width:100%;max-height:95vh;box-shadow:0 10px 40px rgba(0,0,0,0.5);border-radius:16px;}</style><img src="${dataUrl}" alt="টোকেন"/>`);
      }
    } catch (_) {}
  };

  const handleFinish = () => {
    if (successData && onBookingComplete) {
      onBookingComplete(successData);
    }
    setSuccessData(null);
    onClose();
  };

  const estimatedFee =
    patientType === "report"
      ? 0
      : patientType === "old"
      ? activeChamber?.fee_old || 300
      : activeChamber?.fee_new || 500;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden rounded-3xl border border-primary/20 bg-card shadow-2xl">
        {/* Top Header Accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

        <div className="p-6">
          {!successData ? (
            /* ================= BOOKING FORM ================= */
            <>
              <DialogHeader className="text-left mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Calendar className="h-4 w-4" />
                  </span>
                  <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                    {isBn ? "সিরিয়াল বুকিং করুন" : "Book Doctor Appointment"}
                  </DialogTitle>
                </div>
                <DialogDescription className="text-xs text-muted-foreground">
                  {isBn
                    ? "সঠিক তথ্য দিন যাতে চেম্বার থেকে সিরিয়াল যাচাই করা যায়।"
                    : "Fill in patient information to confirm your queue token."}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleBook} className="space-y-4">
                {/* 1. Doctor Picker */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center justify-between">
                    <span>{isBn ? "চিকিৎসক নির্বাচন" : "Select Doctor"}</span>
                    {currentDoctor && (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        {currentDoctor.qualification}
                      </span>
                    )}
                  </Label>
                  <Select
                    value={selectedDoctorId}
                    onValueChange={(val) => setSelectedDoctorId(val)}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-muted/40 font-medium">
                      <SelectValue placeholder={isBn ? "ডাক্তার বেছে নিন" : "Choose Doctor"} />
                    </SelectTrigger>
                    <SelectContent>
                      {doctors.map((d) => (
                        <SelectItem key={d.id} value={d.id} className="cursor-pointer">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{d.name}</span>
                            <span className="text-xs text-muted-foreground">({d.qualification})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 2. Doctor Sitting Locations (Chambers) */}
                {currentDoctor && currentDoctor.chambers.length > 1 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      <span>{isBn ? "চেম্বার / বসার স্থান নির্বাচন করুন *" : "Select Sitting Location *"}</span>
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {currentDoctor.chambers.map((ch) => {
                        const fee = patientType === "old" ? ch.fee_old : ch.fee_new;
                        const isSelected = (selectedChamberId || currentDoctor.chambers[0]?.id) === ch.id;
                        return (
                          <div
                            key={ch.id}
                            onClick={() => setSelectedChamberId(ch.id || "")}
                            className={cn(
                              "flex items-start justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all",
                              isSelected
                                ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary shadow-sm"
                                : "border-border/70 hover:bg-muted/40 text-muted-foreground"
                            )}
                          >
                            <div className="space-y-0.5 pr-2">
                              <span className="font-bold text-foreground block">{ch.name}</span>
                              {ch.address && (
                                <span className="text-[10px] text-muted-foreground line-clamp-1 block">
                                  {ch.address}
                                </span>
                              )}
                            </div>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                              ৳{fee}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Date Picker (Pills) */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    <span>{isBn ? "সিরিয়ালের তারিখ" : "Appointment Date"}</span>
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {dates.slice(0, 6).map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => setSelectedDate(d.value)}
                        className={cn(
                          "flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer",
                          selectedDate === d.value
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border-border/60"
                        )}
                      >
                        <span>{d.badge || d.label.split(",")[0]}</span>
                        <span className="text-[10px] opacity-80">{d.label.split("(")[1]?.replace(")", "") || d.label.split(",")[1]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Mobile Number */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-primary" />
                      {isBn ? "মোবাইল নম্বর *" : "Mobile Number *"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">১১ ডিজিট</span>
                  </Label>
                  <Input
                    type="tel"
                    placeholder="01XXXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-10 rounded-xl font-mono text-sm"
                    required
                  />
                </div>

                {/* 5. Multiple Patients Under Same Mobile (Family Members Picker) */}
                {familyMembers.length > 0 && (
                  <div className="space-y-2 p-3 rounded-2xl bg-muted/40 border border-border/80">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-primary" />
                        {isBn ? "কার জন্য সিরিয়াল নিচ্ছেন?" : "Who is this serial for?"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">এক নম্বরে একাধিক রোগী</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {familyMembers.map((fm) => {
                        const isSelected =
                          !isNewMemberMode &&
                          (patientCode === fm.uid || name.trim().toLowerCase() === fm.name.trim().toLowerCase());
                        return (
                          <button
                            key={fm.uid}
                            type="button"
                            onClick={() => {
                              setName(fm.name);
                              setPatientCode(fm.uid);
                              if (fm.age) setAge(fm.age);
                              if (fm.gender) setGender(fm.gender);
                              setPatientType("old");
                              setIsNewMemberMode(false);
                            }}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer",
                              isSelected
                                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                : "bg-card text-foreground border-border hover:bg-muted"
                            )}
                          >
                            <span>👤 {fm.name}</span>
                            <span className="text-[10px] opacity-80 font-mono">({fm.uid})</span>
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => {
                          setName("");
                          setPatientCode("");
                          setAge("");
                          setPatientType("new");
                          setIsNewMemberMode(true);
                        }}
                        className={cn(
                          "flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border border-dashed transition-all cursor-pointer",
                          isNewMemberMode
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-card text-primary border-primary/40 hover:bg-primary/5"
                        )}
                      >
                        <Plus className="h-3 w-3" />
                        <span>{isBn ? "নতুন সদস্য / রোগী" : "New Member"}</span>
                      </button>
                    </div>

                    {patientCode && !isNewMemberMode && (
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium pt-0.5 flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                        <span>{isBn ? `রোগীর আইডি (UID): ${patientCode}` : `Patient UID: ${patientCode}`}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* 6. Patient Name & UID */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-primary" />
                      <span>{isBn ? "রোগীর পুরো নাম *" : "Patient Name *"}</span>
                    </Label>
                    {patientCode ? (
                      <Badge variant="outline" className="font-mono text-[10px] text-primary border-primary/30">
                        UID: {patientCode}
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">নতুন UID তৈরি হবে</span>
                    )}
                  </div>
                  <Input
                    placeholder={isBn ? "যেমন: মোহাম্মদ আলী" : "e.g. John Doe"}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-10 rounded-xl"
                    required
                  />
                </div>

                {/* 7. Age, Gender & Patient Type */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold">{isBn ? "বয়স" : "Age"}</Label>
                    <Input
                      placeholder={isBn ? "২৮" : "28"}
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      className="h-10 rounded-xl"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold">{isBn ? "লিঙ্গ" : "Gender"}</Label>
                    <Select value={gender} onValueChange={setGender}>
                      <SelectTrigger className="h-10 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">{isBn ? "পুরুষ" : "Male"}</SelectItem>
                        <SelectItem value="Female">{isBn ? "মহিলা" : "Female"}</SelectItem>
                        <SelectItem value="Other">{isBn ? "অন্যান্য" : "Other"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold">{isBn ? "ধরণ" : "Type"}</Label>
                    <Select
                      value={patientType}
                      onValueChange={(v: any) => setPatientType(v)}
                    >
                      <SelectTrigger className="h-10 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">{isBn ? "নতুন রোগী" : "New Patient"}</SelectItem>
                        <SelectItem value="old">{isBn ? "পুরাতন" : "Old Patient"}</SelectItem>
                        <SelectItem value="report">{isBn ? "রিপোর্ট" : "Report"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 8. Chamber & Fee Estimate Banner */}
                {activeChamber && (
                  <div className="rounded-xl border border-border/80 bg-muted/40 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-foreground block">
                          {activeChamber.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground line-clamp-1">
                          {activeChamber.address || "শেখ ফার্মা, মুক্তাগাছা"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 pl-2">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                        {isBn ? "পরামর্শ ফি" : "Fee"}
                      </span>
                      <span className="text-sm font-bold text-foreground">
                        {estimatedFee > 0 ? `৳${estimatedFee}` : isBn ? "ফ্রি / ০৳" : "Free"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Submit Action Button */}
                <Button
                  type="submit"
                  disabled={busy}
                  className="w-full h-12 rounded-xl text-base font-bold shadow-lg shadow-primary/20 cursor-pointer"
                >
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span>{isBn ? "সিরিয়াল নিশ্চিত করা হচ্ছে..." : "Confirming Serial..."}</span>
                    </>
                  ) : (
                    <>
                      <span>{isBn ? "সিরিয়াল কনফার্ম করুন" : "Confirm Serial"}</span>
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </>
          ) : (
            /* ================= SUCCESS CONFIRMATION TOKEN ================= */
            <div className="space-y-5 text-center py-2 animate-in fade-in duration-300">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 ring-8 ring-emerald-500/5">
                <CheckCircle2 className="h-10 w-10" />
              </div>

              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
                  {successData.already_booked
                    ? isBn
                      ? "ইতিমধ্যে সিরিয়াল রয়েছে"
                      : "Already Booked!"
                    : isBn
                    ? "🎉 সিরিয়াল নিশ্চিত হয়েছে!"
                    : "🎉 Serial Confirmed!"}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isBn
                    ? "নিচের টোকেনটি সেভ করে চেম্বারে নিয়ে আসুন।"
                    : "Save this token slip for your chamber visit."}
                </p>
              </div>

              {/* Digital Token Slip Card Preview */}
              <div className="relative mx-auto max-w-sm rounded-2xl border-2 border-dashed border-primary/30 bg-card p-5 text-left shadow-sm">
                <div className="flex items-center justify-between border-b border-border/80 pb-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                      {isBn ? "শেখ ফার্মা ডিজিটাল টোকেন" : "Sheikh Pharma Token"}
                    </span>
                    <h4 className="text-base font-bold text-foreground">
                      {successData.doctor_name}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {successData.doctor_qualification}
                    </p>
                  </div>
                  <div className="text-center rounded-xl bg-primary px-3.5 py-1.5 text-primary-foreground shadow-md">
                    <span className="text-[9px] uppercase tracking-wider block font-medium">
                      {isBn ? "সিরিয়াল নং" : "Serial No"}
                    </span>
                    <span className="text-2xl font-black">
                      #{successData.serial_no}
                    </span>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>{isBn ? "রোগীর নাম:" : "Patient:"}</span>
                    <span className="font-semibold text-foreground">{successData.patient_name}</span>
                  </div>
                  {successData.patient_code && (
                    <div className="flex justify-between">
                      <span>{isBn ? "রোগীর আইডি (UID):" : "Patient UID:"}</span>
                      <span className="font-mono font-bold text-primary">{successData.patient_code}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>{isBn ? "তারিখ:" : "Date:"}</span>
                    <span className="font-semibold text-foreground font-mono">{successData.appt_date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{isBn ? "মোবাইল:" : "Mobile:"}</span>
                    <span className="font-mono">{successData.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{isBn ? "চেম্বার:" : "Chamber:"}</span>
                    <span className="text-foreground">{successData.chamber_name}</span>
                  </div>
                  {successData.fee_amount != null && (
                    <div className="flex justify-between border-t border-border/50 pt-1.5 font-bold text-foreground">
                      <span>{isBn ? "পরামর্শ ফি:" : "Fee:"}</span>
                      <span>৳{successData.fee_amount}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons: Save JPG instead of Print */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button
                  variant="default"
                  onClick={handleSaveTokenJpg}
                  disabled={isSavingJpg}
                  className="flex-1 rounded-xl h-11 font-bold gap-2 cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20 hover:from-emerald-700 hover:to-teal-700"
                >
                  {isSavingJpg ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  <span>{isBn ? "টোকেন সেভ করুন" : "Save Token"}</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={handleFinish}
                  className="flex-1 rounded-xl h-11 font-semibold cursor-pointer hover:bg-muted"
                >
                  <span>{isBn ? "ড্যাশবোর্ডে দেখুন" : "View in Dashboard"}</span>
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={handleOpenImage}
                  className="text-xs text-muted-foreground hover:text-primary transition underline cursor-pointer"
                >
                  {isBn ? "টোকেনের পূর্ণাঙ্গ স্লিপ দেখতে এখানে ক্লিক করুন" : "Click here to view full token slip"}
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
