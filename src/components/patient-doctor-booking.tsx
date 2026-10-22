import { useState } from "react";
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
  Printer,
  Sparkles,
  ArrowRight,
  Loader2,
  ChevronRight,
  Building2,
  ShieldCheck,
  AlertCircle,
  Receipt,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  type AvailableDoctor,
} from "@/lib/patient-portal.functions";
import { printPatientToken } from "@/lib/token-print";
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

            {primaryChamber && (
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="font-semibold text-foreground">{primaryChamber.name}</span>
                </div>
                {primaryChamber.address && (
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="line-clamp-1">{primaryChamber.address}</span>
                  </div>
                )}
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

  const dates = getAvailableDates(lang);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(
    initialDoctorId || (doctors[0]?.id ?? "")
  );
  const [selectedDate, setSelectedDate] = useState<string>(dates[0]?.value ?? "");
  const [name, setName] = useState(patientName);
  const [phone, setPhone] = useState(patientPhone);
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("Male");
  const [patientType, setPatientType] = useState<"new" | "old" | "report">("new");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [successData, setSuccessData] = useState<any | null>(null);

  const currentDoctor = doctors.find((d) => d.id === selectedDoctorId) || doctors[0];
  const primaryChamber = currentDoctor?.chambers?.[0];

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
          chamber_id: primaryChamber?.id || null,
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
            ? `আপনি ইতিমধ্যে এই ডাক্তারের জন্য সিরিয়াল নিয়েছেন (নং #${res.serial_no})`
            : `You already have serial #${res.serial_no} for this doctor`
        );
      } else {
        toast.success(
          isBn
            ? `🎉 সিরিয়াল সফলভাবে নিশ্চিত হয়েছে! সিরিয়াল নং: #${res.serial_no}`
            : `🎉 Serial confirmed! Serial #${res.serial_no}`
        );
      }
    } catch (err: any) {
      toast.error(err.message || (isBn ? "সিরিয়াল বুকিং করা যায়নি" : "Failed to book serial"));
    } finally {
      setBusy(false);
    }
  };

  const handlePrintSlip = () => {
    if (!successData) return;
    printPatientToken(
      {
        clinicName: "Sheikh Pharma",
        doctorName: successData.doctor_name,
        doctorQualification: successData.doctor_qualification,
        serialNo: successData.serial_no,
        patientCode: successData.patient_code,
        fee: successData.fee_amount,
        patientType: patientType === "new" ? "New patient" : patientType === "old" ? "Old patient" : "Report",
        patientName: successData.patient_name,
        age: age ? `${age} Y` : undefined,
        gender: gender,
        phone: successData.phone,
        location: successData.chamber_name,
        date: successData.appt_date,
      },
      "80mm"
    );
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
      ? primaryChamber?.fee_old || 300
      : primaryChamber?.fee_new || 500;

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
                    {isBn ? "ডাক্তারের সিরিয়াল বুকিং" : "Book Doctor Appointment"}
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
                    <span>{isBn ? "ডাক্তার নির্বাচন" : "Select Doctor"}</span>
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

                {/* 2. Date Picker (Pills) */}
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

                {/* 3. Patient Name & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-primary" />
                      <span>{isBn ? "রোগীর পুরো নাম *" : "Patient Name *"}</span>
                    </Label>
                    <Input
                      placeholder={isBn ? "যেমন: মোহাম্মদ আলী" : "e.g. John Doe"}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-10 rounded-xl"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-primary" />
                      <span>{isBn ? "মোবাইল নম্বর *" : "Mobile Number *"}</span>
                    </Label>
                    <Input
                      type="tel"
                      placeholder="01XXXXXXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="h-10 rounded-xl font-mono"
                      required
                    />
                  </div>
                </div>

                {/* 4. Age, Gender & Patient Type */}
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

                {/* 5. Chamber & Fee Estimate Banner */}
                {primaryChamber && (
                  <div className="rounded-xl border border-border/80 bg-muted/40 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-foreground block">
                          {primaryChamber.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground line-clamp-1">
                          {primaryChamber.address || "শেখ ফার্মা, মুক্তাগাছা"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 pl-2">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                        {isBn ? "আনুমানিক ফি" : "Fee"}
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
                      <span>{isBn ? "সিরিয়াল কনফার্ম করা হচ্ছে..." : "Confirming Serial..."}</span>
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
                    ? "নিচের টোকেনটি সংরক্ষণ করুন বা প্রিন্ট করে চেম্বারে নিয়ে আসুন।"
                    : "Save or print this token slip for your chamber visit."}
                </p>
              </div>

              {/* Digital Token Slip Card */}
              <div className="relative mx-auto max-w-sm rounded-2xl border-2 border-dashed border-primary/30 bg-muted/30 p-5 text-left shadow-sm">
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

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={handlePrintSlip}
                  className="flex-1 rounded-xl h-11 font-semibold gap-1.5 cursor-pointer hover:bg-muted"
                >
                  <Printer className="h-4 w-4" />
                  <span>{isBn ? "টোকেন প্রিন্ট / স্লিপ" : "Print Token Slip"}</span>
                </Button>
                <Button
                  onClick={handleFinish}
                  className="flex-1 rounded-xl h-11 font-bold shadow-md shadow-primary/20 cursor-pointer"
                >
                  <span>{isBn ? "ড্যাশবোর্ডে দেখুন" : "View in Dashboard"}</span>
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
