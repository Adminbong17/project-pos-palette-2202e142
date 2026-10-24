import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  CalendarDays,
  FileText,
  FlaskConical,
  LogOut,
  Receipt,
  Loader2,
  HeartPulse,
  ShieldCheck,
  Phone,
  ArrowRight,
  Lock,
  Activity,
  CheckCircle2,
  Sparkles,
  Stethoscope,
  ChevronRight,
  Languages,
  Plus,
  Calendar,
  Building2,
  Clock,
  User,
  Download,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { fmtDate as formatDate } from "@/lib/format-date";
import {
  getPatientDashboard,
  loginPatientByPhone,
  getAvailableDoctors,
  type AvailableDoctor,
} from "@/lib/patient-portal.functions";
import {
  DoctorCard,
  DoctorBookingModal,
} from "@/components/patient-doctor-booking";
import { PatientSmartPrescription } from "@/components/patient-smart-prescription";
import { PatientSmartLabReport } from "@/components/patient-smart-lab-report";
import { downloadTokenAsJpg } from "@/lib/token-jpg";
import { SHEIKH_PHARMA_DETAILS } from "@/lib/sheikh-pharma-letterhead";
import { SHEIKH_PHARMA_LOGO_BASE64 } from "@/lib/sheikh-pharma-logo.base64";
import { cn } from "@/lib/utils";

const KEY = "patient-portal-token";
const LANG_KEY = "patient-portal-lang";

type Lang = "bn" | "en";

export const Route = createFileRoute("/patient")({
  head: () => ({
    meta: [
      { title: "রোগী সেবা পোর্টাল — শেখ ফার্মা | Patient Care Portal" },
      {
        name: "description",
        content:
          "শেখ ফার্মা পেশেন্ট পোর্টাল। আপনার মোবাইল নম্বর দিয়ে লগইন করে প্রেসক্রিপশন, ল্যাব রিপোর্ট, ডাক্তারের সিরিয়াল ও বিলের হিসাব দেখুন। অনলাইনে সরাসরি ডাক্তারের সিরিয়াল বুকিং করুন।",
      },
      { property: "og:title", content: "রোগী সেবা পোর্টাল — শেখ ফার্মা" },
      {
        property: "og:description",
        content:
          "ডাক্তার তালিকা, সিরিয়াল বুকিং, প্রেসক্রিপশন, ল্যাব টেস্ট রিপোর্ট ও বিলের হিসাব এক ঠিকানায়।",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PatientPage,
});

/* -------------------------------------------------------------------------- */
/*                                TRANSLATIONS                                */
/* -------------------------------------------------------------------------- */
const t = {
  bn: {
    brandName: "শেখ ফার্মা",
    brandSubtitle: "ডিজিটাল স্বাস্থ্যসেবা ও পেশেন্ট পোর্টাল",
    helpline: "হেল্পলাইন",
    heroBadge: "স্মার্ট পেশেন্ট সার্ভিস • ২৪/৭ রেকর্ড অ্যাক্সেস",
    heroTitle: "আপনার প্রেসক্রিপশন, সিরিয়াল ও মেডিকেল রেকর্ড",
    heroSubtitle:
      "অনলাইনে অভিজ্ঞ ডাক্তারদের তালিকা দেখুন, সরাসরি সিরিয়াল বুকিং করুন, প্রেসক্রিপশন ও ল্যাব টেস্টের রিপোর্ট পান ঘরে বসেই।",
    liveRecord: "লাইভ রেকর্ড সিঙ্ক",
    verifiedNetwork: "শেখ ফার্মা ভেরিফাইড ক্লিনিক ও ফার্মেসি নেটওয়ার্ক",
    features: [
      {
        title: "ডাক্তারের সিরিয়াল বুকিং",
        desc: "চেম্বারে না গিয়ে ঘরে বসেই ডাক্তার বেছে নিয়ে তাৎক্ষণিক সিরিয়াল নম্বর সংগ্রহ করুন।",
        badge: "অনলাইন বুকিং",
        icon: CalendarDays,
        color: "text-blue-600 dark:text-blue-400",
        bg: "bg-blue-500/10 border-blue-500/20",
      },
      {
        title: "ডিজিটাল প্রেসক্রিপশন",
        desc: "ডাক্তারের ব্যবস্থাপত্র ও ওষুধের ডোজের সঠিক নিয়মাবলী সংরক্ষিত থাকবে সবসময়।",
        badge: "তাত্ক্ষণিক ভিউ",
        icon: FileText,
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-500/10 border-emerald-500/20",
      },
      {
        title: "ল্যাব টেস্ট রিপোর্ট",
        desc: "রক্ত পরীক্ষা ও সকল ডায়াগনস্টিক টেস্টের নির্ভুল ফলাফল ডিজিটাল ফরম্যাটে।",
        badge: "ডাউনলোড ও প্রিন্ট",
        icon: FlaskConical,
        color: "text-cyan-600 dark:text-cyan-400",
        bg: "bg-cyan-500/10 border-cyan-500/20",
      },
      {
        title: "স্বচ্ছ বিল ও পেমেন্ট",
        desc: "ফার্মেসির ওষুধের বিল, কিস্তি ও বকেয়ার পরিষ্কার হিসাব যেকোনো সময় দেখুন।",
        badge: "স্বচ্ছ হিসাব",
        icon: Receipt,
        color: "text-teal-600 dark:text-teal-400",
        bg: "bg-teal-500/10 border-teal-500/20",
      },
    ],
    cardTitle: "রোগী লগইন",
    cardSubtitle:
      "ডাক্তার বা ফার্মেসিতে দেওয়া আপনার ১১ ডিজিটের মোবাইল নম্বরটি লিখুন।",
    phoneLabel: "নিবন্ধিত মোবাইল নম্বর",
    phonePlaceholder: "০১৭১২-৩৪৫৬৭৮",
    phoneHint: "১১ ডিজিটের বাংলাদেশি মোবাইল নম্বর দিন",
    phoneError: "সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)",
    loginBtn: "পোর্টাল এ প্রবেশ করুন",
    verifying: "যাচাই করা হচ্ছে...",
    trustEncrypted: "১০০% নিরাপদ ও এনক্রিপ্টেড",
    trustPasswordless: "কোনো পাসওয়ার্ডের প্রয়োজন নেই",
    trustInstant: "তাত্ক্ষণিক মোবাইল ভেরিফিকেশন",
    helpNeed: "কোনো সমস্যা বা তথ্যের জন্য কল করুন:",
    callNow: "এখনই কল করুন",
    footerAddress: "দোকান নং ১৩, আরব প্যারাডাইস মার্কেট, নতুন বাজার, মুক্তাগাছা, ময়মনসিংহ।",
    footerText: "© শেখ ফার্মা ডিজিটাল হেলথ প্ল্যাটফর্ম • সর্বস্বত্ব সংরক্ষিত",

    // Doctor Directory
    doctorDirectoryBadge: "অনলাইন অ্যাপয়েন্টমেন্ট",
    doctorDirectoryTitle: "আমাদের বিশেষজ্ঞ ডাক্তারগণ",
    doctorDirectorySubtitle:
      "অভিজ্ঞ ডাক্তার নির্বাচন করুন এবং আপনার সুবিধাজনক তারিখে সরাসরি সিরিয়াল বুকিং করুন।",
    loadingDoctors: "ডাক্তার তালিকা লোড হচ্ছে...",
    noDoctors: "বর্তমানে কোনো ডাক্তার তালিকাভুক্ত নেই। প্রয়োজনে হেল্পলাইনে কল করুন।",
    bookSerialBtn: "সিরিয়াল নিন",
    newSerialBtn: "নতুন সিরিয়াল নিন",
    quickBookHeroBtn: "সরাসরি সিরিয়াল বুকিং",

    // Dashboard
    myDashboard: "আমার ড্যাশবোর্ড",
    logout: "লগআউট",
    statPrescriptions: "প্রেসক্রিপশন",
    statReports: "ল্যাব রিপোর্ট",
    statAppointments: "আসন্ন সিরিয়াল",
    statDue: "মোট বকেয়া",
    tabRx: "আমার প্রেসক্রিপশন",
    tabLab: "আমার রিপোর্ট",
    tabAppt: "সিরিয়াল ও বুকিং",
    tabBill: "বিল ও পেমেন্ট",
    empty: "কোনো রেকর্ড পাওয়া যায়নি",
    nextVisit: "পরবর্তী ভিজিট",
    installment: "কিস্তি",
    paid: "পরিশোধিত",
    due: "বকেয়া",
    treatmentPlan: "ট্রিটমেন্ট প্ল্যান",
    serialNo: "সিরিয়াল নং",
    diagnosis: "রোগের লক্ষণ (Dx):",
    advice: "ডাক্তারের পরামর্শ:",
    logoutTitle: "লগআউট করবেন?",
    logoutDesc: "আপনি কি নিশ্চিত যে পোর্টাল থেকে লগআউট করতে চান?",
    logoutCancel: "না, থাকুন",
    logoutConfirm: "হ্যাঁ, লগআউট",
    myAppointmentsTitle: "আপনার অ্যাপয়েন্টমেন্ট ও সিরিয়াল তালিকা",
    myAppointmentsDesc: "চেম্বারের লাইভ সিরিয়াল স্ট্যাটাস ট্র্যাক করুন ও টোকেন সেভ করে সঙ্গে রাখুন।",
    noAppointmentsHint: "বর্তমানে আপনার কোনো সিরিয়াল বুক করা নেই। নতুন সিরিয়াল নিতে নিচের বাটনে ক্লিক করুন।",
    saveTokenBtn: "টোকেন সেভ",
  },
  en: {
    brandName: "Sheikh Pharma",
    brandSubtitle: "Digital Healthcare & Patient Portal",
    helpline: "Helpline",
    heroBadge: "Smart Patient Portal • 24/7 Record Access",
    heroTitle: "Your Prescriptions, Serials & Medical Records",
    heroSubtitle:
      "Explore experienced doctors, book your appointment serials online, and access diagnostic findings & prescriptions anytime.",
    liveRecord: "Live Record Sync",
    verifiedNetwork: "Sheikh Pharma Verified Clinic & Pharmacy Network",
    features: [
      {
        title: "Doctor Appointments",
        desc: "Book consultation queue serials from home without waiting in lines.",
        badge: "Online Booking",
        icon: CalendarDays,
        color: "text-blue-600 dark:text-blue-400",
        bg: "bg-blue-500/10 border-blue-500/20",
      },
      {
        title: "Digital Prescriptions",
        desc: "Instant access to your doctor prescriptions, medication dosage, and dietary advice.",
        badge: "Instant View",
        icon: FileText,
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-500/10 border-emerald-500/20",
      },
      {
        title: "Lab Test Reports",
        desc: "Accurate pathological findings and diagnostic reports organized chronologically.",
        badge: "Download & Print",
        icon: FlaskConical,
        color: "text-cyan-600 dark:text-cyan-400",
        bg: "bg-cyan-500/10 border-cyan-500/20",
      },
      {
        title: "Billing & Invoices",
        desc: "Transparent breakdown of pharmacy receipts, installments, and due balances.",
        badge: "Transparent",
        icon: Receipt,
        color: "text-teal-600 dark:text-teal-400",
        bg: "bg-teal-500/10 border-teal-500/20",
      },
    ],
    cardTitle: "Patient Sign In",
    cardSubtitle:
      "Enter the 11-digit mobile number provided at the clinic or pharmacy.",
    phoneLabel: "Registered Mobile Number",
    phonePlaceholder: "01XXXXXXXXX",
    phoneHint: "Enter 11-digit Bangladeshi mobile number",
    phoneError: "Please enter a valid 11-digit mobile number (e.g. 017XXXXXXXX)",
    loginBtn: "Access Patient Portal",
    verifying: "Verifying...",
    trustEncrypted: "100% Encrypted & Private",
    trustPasswordless: "No Password Required",
    trustInstant: "Instant Phone-Based Session",
    helpNeed: "Need help? Call pharmacy helpline:",
    callNow: "Call Support",
    footerAddress:
      "Shop 13, Arab Paradise Market, Natun Bazar, Muktagacha, Mymensingh.",
    footerText:
      "© Sheikh Pharma Digital Health Platform • All rights reserved",

    // Doctor Directory
    doctorDirectoryBadge: "Online Appointments",
    doctorDirectoryTitle: "Our Specialist Doctors",
    doctorDirectorySubtitle:
      "Select an experienced specialist and book your consultation serial online.",
    loadingDoctors: "Loading doctors...",
    noDoctors: "No doctors currently listed. Please contact our helpline.",
    bookSerialBtn: "Book Serial",
    newSerialBtn: "Book New Serial",
    quickBookHeroBtn: "Book Appointment",

    // Dashboard
    myDashboard: "Patient Dashboard",
    logout: "Sign Out",
    statPrescriptions: "Prescriptions",
    statReports: "Lab Reports",
    statAppointments: "Upcoming Visits",
    statDue: "Total Due",
    tabRx: "My Prescription",
    tabLab: "My Reports",
    tabAppt: "Appointments",
    tabBill: "Bills & Plans",
    empty: "No records found",
    nextVisit: "Next Visit",
    installment: "Installment",
    paid: "Paid",
    due: "Due",
    treatmentPlan: "Treatment Plan",
    serialNo: "Serial No",
    diagnosis: "Diagnosis (Dx):",
    advice: "Doctor's Advice:",
    logoutTitle: "Sign out?",
    logoutDesc: "Are you sure you want to sign out from your patient portal?",
    logoutCancel: "Stay Logged In",
    logoutConfirm: "Yes, Sign Out",
    myAppointmentsTitle: "Your Appointments & Queue Serials",
    myAppointmentsDesc: "Track live serial status and save chamber tokens.",
    noAppointmentsHint: "You currently have no booked serials. Click below to book a doctor appointment.",
    saveTokenBtn: "Save Token",
  },
};

/* -------------------------------------------------------------------------- */
/*                               PHONE HELPERS                                */
/* -------------------------------------------------------------------------- */
function normalizeBDPhoneInput(raw: string): string {
  const bn = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  let s = String(raw ?? "");
  for (let i = 0; i < 10; i++) {
    s = s.replaceAll(bn[i], String(i));
  }
  let p = s.replace(/[^\d+]/g, "");
  if (p.startsWith("+880")) p = p.slice(4);
  else if (p.startsWith("880")) p = p.slice(3);
  else if (p.startsWith("+88")) p = p.slice(3);
  else if (p.startsWith("88")) p = p.slice(2);

  if (p.length === 10 && p.startsWith("1")) {
    p = `0${p}`;
  }
  return p;
}

/* -------------------------------------------------------------------------- */
/*                              LANGUAGE SWITCHER                             */
/* -------------------------------------------------------------------------- */
function LanguageToggle({
  lang,
  onToggle,
}: {
  lang: Lang;
  onToggle: (l: Lang) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Language selector"
      className="inline-flex items-center rounded-full bg-card/90 p-0.5 sm:p-1 border border-border/80 shadow-sm backdrop-blur-md shrink-0"
    >
      <Languages className="ml-1.5 mr-1 h-3 w-3 text-muted-foreground hidden xs:inline" />
      <button
        type="button"
        onClick={() => onToggle("bn")}
        className={cn(
          "flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs font-semibold rounded-full transition-all duration-200 cursor-pointer",
          lang === "bn"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <span>বাংলা</span>
      </button>
      <button
        type="button"
        onClick={() => onToggle("en")}
        className={cn(
          "flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs font-semibold rounded-full transition-all duration-200 cursor-pointer",
          lang === "en"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <span>English</span>
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               MAIN PAGE                                    */
/* -------------------------------------------------------------------------- */
function PatientPage() {
  const [token, setToken] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>("bn");

  useEffect(() => {
    const savedToken = localStorage.getItem(KEY);
    if (savedToken) setToken(savedToken);
    const savedLang = localStorage.getItem(LANG_KEY) as Lang | null;
    if (savedLang === "bn" || savedLang === "en") {
      setLang(savedLang);
    }
  }, []);

  const handleLangToggle = (newLang: Lang) => {
    setLang(newLang);
    localStorage.setItem(LANG_KEY, newLang);
  };

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-background text-foreground font-sans flex flex-col justify-between selection:bg-primary/20">
      {/* ================= BACKGROUND GRAPHICS & AMBIENT GLOWS ================= */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-primary/20 blur-[100px] animate-pulse [animation-duration:8s]" />
      <div className="pointer-events-none absolute -bottom-48 -right-48 h-[34rem] w-[34rem] rounded-full bg-teal-500/15 blur-[120px] animate-pulse [animation-duration:10s]" />
      <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-cyan-500/10 blur-[110px]" />

      {/* Subtle Clinical Dot Matrix Grid */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.03] dark:opacity-[0.06]"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id="medical-grid-dots"
            width="28"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="2" r="1.5" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#medical-grid-dots)" />
      </svg>

      {/* Translucent Medical Background Icons */}
      <div
        className="pointer-events-none absolute top-16 right-12 text-primary/[0.04] dark:text-primary/[0.07] rotate-12"
        aria-hidden="true"
      >
        <ShieldCheck className="h-44 w-44" />
      </div>
      <div
        className="pointer-events-none absolute bottom-24 left-10 text-teal-500/[0.04] dark:text-teal-500/[0.07] -rotate-12"
        aria-hidden="true"
      >
        <HeartPulse className="h-56 w-56" />
      </div>

      {token ? (
        <Dashboard
          token={token}
          lang={lang}
          onLangToggle={handleLangToggle}
          onLogout={() => {
            localStorage.removeItem(KEY);
            setToken(null);
          }}
        />
      ) : (
        <Login
          lang={lang}
          onLangToggle={handleLangToggle}
          onLogin={(t) => {
            localStorage.setItem(KEY, t);
            setToken(t);
          }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               LOGIN COMPONENT                              */
/* -------------------------------------------------------------------------- */
function Login({
  lang,
  onLangToggle,
  onLogin,
}: {
  lang: Lang;
  onLangToggle: (l: Lang) => void;
  onLogin: (t: string) => void;
}) {
  const login = useServerFn(loginPatientByPhone);
  const fetchDoctors = useServerFn(getAvailableDoctors);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const curr = t[lang];

  // Doctors Query
  const doctorsQ = useQuery({
    queryKey: ["available-doctors"],
    queryFn: () => fetchDoctors(),
  });

  // Booking Modal State
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);

  const go = async () => {
    const clean = normalizeBDPhoneInput(phone);
    if (!/^01\d{9}$/.test(clean)) {
      toast.error(curr.phoneError);
      return;
    }
    setBusy(true);
    try {
      const r = await login({ data: { phone: clean } });
      onLogin(r.token);
    } catch (e: any) {
      toast.error(e.message || curr.phoneError);
    } finally {
      setBusy(false);
    }
  };

  const handleOpenBooking = (docId?: string) => {
    setSelectedDoctorId(docId || null);
    setIsBookingOpen(true);
  };

  return (
    <div className="relative z-10 flex min-h-[100dvh] flex-col justify-between">
      {/* ================= TOP NAVIGATION BAR ================= */}
      <header className="w-full border-b border-border/40 bg-card/60 backdrop-blur-md sticky top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-primary/30 bg-card shadow-md shadow-primary/10 transition-transform duration-300 hover:scale-105">
              <img
                src={SHEIKH_PHARMA_LOGO_BASE64}
                alt="Sheikh Pharma Logo"
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-tight text-foreground text-base sm:text-lg">
                  {curr.brandName}
                </span>
                <span className="hidden sm:inline-flex rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  PORTAL
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground hidden sm:block">
                {curr.brandSubtitle}
              </p>
            </div>
          </div>

          {/* Right Header: Fast Book Button, Helpline & Language Switcher */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenBooking()}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full border-primary/30 text-primary hover:bg-primary/10 font-semibold text-xs cursor-pointer"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>{curr.quickBookHeroBtn}</span>
            </Button>

            <a
              href={`tel:${SHEIKH_PHARMA_DETAILS.phonesRaw[0]}`}
              className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-secondary/80 px-3 py-1 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
            >
              <Phone className="h-3.5 w-3.5 text-primary" />
              <span>{SHEIKH_PHARMA_DETAILS.phonesRaw[0]}</span>
            </a>
            <LanguageToggle lang={lang} onToggle={onLangToggle} />
          </div>
        </div>
      </header>

      {/* ================= MAIN CONTENT (PC SPLIT + MOBILE RESPONSIVE) ================= */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 lg:py-12 space-y-12">
        <div className="grid w-full items-center gap-10 lg:grid-cols-12 lg:gap-14">
          {/* ----------------- LEFT HERO COLUMN (DESKTOP) ----------------- */}
          <div className="hidden flex-col space-y-6 lg:col-span-7 lg:flex">
            {/* Pill Tag */}
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary shadow-sm">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{curr.heroBadge}</span>
            </div>

            {/* Display Headline */}
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl xl:text-5xl leading-tight">
              <span className="bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent">
                {curr.heroTitle}
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base text-muted-foreground sm:text-lg max-w-xl leading-relaxed">
              {curr.heroSubtitle}
            </p>

            {/* Live ECG Rhythm Card Graphic */}
            <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card/80 p-4 shadow-lg backdrop-blur-md">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                  </span>
                  <span className="text-xs font-bold text-foreground">
                    {curr.liveRecord}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground font-mono">
                  SHEIKH PHARMA SYNC
                </span>
              </div>

              {/* Animated ECG Pulse Line */}
              <div className="relative h-10 w-full overflow-hidden flex items-center">
                <svg
                  viewBox="0 0 600 50"
                  preserveAspectRatio="none"
                  className="w-full h-full stroke-primary fill-none opacity-85"
                >
                  <path
                    d="M0,25 L80,25 L95,25 L105,8 L115,42 L125,5 L135,38 L145,20 L155,25 L240,25 L255,25 L265,8 L275,42 L285,5 L295,38 L305,20 L315,25 L400,25 L415,25 L425,8 L435,42 L445,5 L455,38 L465,20 L475,25 L560,25 L575,25 L585,8 L595,42 L600,25"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-card to-transparent" />
              </div>
            </div>

            {/* 4 Feature Showcase Grid (2x2) */}
            <div className="grid grid-cols-2 gap-3.5 pt-2">
              {curr.features.map((feat, idx) => (
                <div
                  key={idx}
                  className="group relative rounded-xl border border-border/70 bg-card/70 p-3.5 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-primary/40 hover:bg-card hover:shadow-md"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg border",
                        feat.bg
                      )}
                    >
                      <feat.icon className={cn("h-4 w-4", feat.color)} />
                    </div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/60 px-1.5 py-0.5 rounded">
                      {feat.badge}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-foreground">
                    {feat.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {feat.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* Trust Signals Footer */}
            <div className="flex items-center gap-6 pt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>{curr.trustPasswordless}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-primary" />
                <span>{curr.trustEncrypted}</span>
              </div>
            </div>
          </div>

          {/* ----------------- RIGHT COLUMN (LOGIN & BOOKING CARD) ----------------- */}
          <div className="w-full max-w-md mx-auto lg:col-span-5">
            <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-card/90 p-6 sm:p-8 shadow-2xl shadow-primary/10 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />

              {/* Card Header & Brand Pill */}
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="relative">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-primary/30 bg-primary/10 shadow-inner">
                    <img
                      src={SHEIKH_PHARMA_LOGO_BASE64}
                      alt="Sheikh Pharma"
                      className="h-12 w-12 object-cover rounded-full"
                    />
                  </div>
                  <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
                    <HeartPulse className="h-3.5 w-3.5" />
                  </span>
                </div>

                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-foreground">
                    {curr.cardTitle}
                  </h2>
                  <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-xs">
                    {curr.cardSubtitle}
                  </p>
                </div>
              </div>

              {/* Mobile Phone Input Form */}
              <div className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>{curr.phoneLabel}</span>
                    <span className="text-[11px] text-muted-foreground font-normal">
                      🇧🇩 BD Mobile
                    </span>
                  </label>

                  <div className="relative flex items-center rounded-xl border border-input bg-input/40 shadow-inner transition-all duration-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25 focus-within:bg-card">
                    <div className="flex items-center gap-1.5 border-r border-border/80 px-3.5 py-3 text-sm font-semibold text-foreground select-none bg-muted/40 rounded-l-xl">
                      <span className="text-base" role="img" aria-label="Bangladesh Flag">
                        🇧🇩
                      </span>
                      <span>+880</span>
                    </div>

                    <Input
                      type="tel"
                      inputMode="tel"
                      placeholder={curr.phonePlaceholder}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && go()}
                      className="h-12 border-0 bg-transparent px-3 text-base font-medium shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/60"
                    />

                    {phone && (
                      <button
                        type="button"
                        onClick={() => setPhone("")}
                        className="mr-3 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                        aria-label="Clear input"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 px-1">
                    <Activity className="h-3 w-3 text-primary" />
                    <span>{curr.phoneHint}</span>
                  </p>
                </div>

                <Button
                  className="w-full h-12 text-base font-bold shadow-lg shadow-primary/25 rounded-xl cursor-pointer transition-all duration-200 hover:scale-[1.01] active:scale-[0.98]"
                  disabled={busy}
                  onClick={go}
                >
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {curr.verifying}
                    </>
                  ) : (
                    <>
                      <span>{curr.loginBtn}</span>
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>

                {/* Direct Serial Booking Shortcut Button */}
                <div className="pt-2">
                  <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-border/60" />
                    <span className="flex-shrink mx-3 text-[11px] text-muted-foreground uppercase font-semibold">
                      {lang === "bn" ? "অথবা" : "OR"}
                    </span>
                    <div className="flex-grow border-t border-border/60" />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenBooking()}
                    className="w-full h-11 rounded-xl font-bold border-primary/30 text-primary hover:bg-primary/10 gap-2 cursor-pointer shadow-sm"
                  >
                    <Calendar className="h-4 w-4" />
                    <span>{curr.quickBookHeroBtn}</span>
                  </Button>
                </div>

                {/* Security Trust Note */}
                <div className="rounded-xl bg-secondary/50 p-3 text-center border border-border/50">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Lock className="h-3.5 w-3.5 text-primary" />
                    <span>{curr.trustPasswordless}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                    {curr.trustEncrypted}
                  </p>
                </div>

                {/* Helpline Assistance */}
                <div className="pt-2 text-center text-xs text-muted-foreground">
                  <p>{curr.helpNeed}</p>
                  <a
                    href={`tel:${SHEIKH_PHARMA_DETAILS.phonesRaw[0]}`}
                    className="mt-1 inline-flex items-center gap-1 font-bold text-primary hover:underline"
                  >
                    <Phone className="h-3 w-3" />
                    <span>{SHEIKH_PHARMA_DETAILS.phonesRaw[0]}</span>
                    <span className="text-muted-foreground font-normal">/ {SHEIKH_PHARMA_DETAILS.phonesRaw[1]}</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Mobile Feature Chips */}
            <div className="mt-8 space-y-3 lg:hidden">
              <div className="text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {curr.brandName} • {curr.heroBadge}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {curr.features.map((feat, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col rounded-xl border border-border/60 bg-card/80 p-3 shadow-sm backdrop-blur-sm"
                  >
                    <div
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-md mb-1.5",
                        feat.bg
                      )}
                    >
                      <feat.icon className={cn("h-3.5 w-3.5", feat.color)} />
                    </div>
                    <span className="text-xs font-bold text-foreground">
                      {feat.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      {feat.badge}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ================= DOCTOR DIRECTORY SECTION ================= */}
        <section className="w-full border-t border-border/50 pt-10">
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary mb-2">
                  <Stethoscope className="h-3.5 w-3.5" />
                  <span>{curr.doctorDirectoryBadge}</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                  {curr.doctorDirectoryTitle}
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xl">
                  {curr.doctorDirectorySubtitle}
                </p>
              </div>

              <div className="text-xs text-muted-foreground hidden sm:block">
                <span>{curr.brandName} • {curr.verifiedNetwork}</span>
              </div>
            </div>

            {doctorsQ.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">{curr.loadingDoctors}</span>
              </div>
            ) : (doctorsQ.data ?? []).length === 0 ? (
              <div className="text-center py-10 rounded-2xl border border-dashed border-border/70 bg-card/60 p-6">
                <Stethoscope className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm font-semibold text-foreground">{curr.noDoctors}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {curr.helpNeed} {SHEIKH_PHARMA_DETAILS.phonesRaw[0]}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(doctorsQ.data ?? []).map((doc) => (
                  <DoctorCard
                    key={doc.id}
                    doctor={doc}
                    lang={lang}
                    onBook={(d) => handleOpenBooking(d.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* ================= FOOTER ================= */}
      <footer className="w-full border-t border-border/40 bg-card/40 py-4 text-center text-xs text-muted-foreground backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>{curr.footerAddress}</span>
          <span>{curr.footerText}</span>
        </div>
      </footer>

      {/* Doctor Serial Booking Modal */}
      <DoctorBookingModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        doctors={doctorsQ.data ?? []}
        initialDoctorId={selectedDoctorId}
        patientPhone={phone}
        lang={lang}
        onBookingComplete={(res) => {
          if (res?.token) {
            onLogin(res.token);
          }
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                DASHBOARD                                   */
/* -------------------------------------------------------------------------- */
const tk = (n: unknown) => `৳${Number(n ?? 0).toLocaleString("en-IN")}`;

function Dashboard({
  token,
  lang,
  onLangToggle,
  onLogout,
}: {
  token: string;
  lang: Lang;
  onLangToggle: (l: Lang) => void;
  onLogout: () => void;
}) {
  const qc = useQueryClient();
  const fetchData = useServerFn(getPatientDashboard);
  const fetchDoctors = useServerFn(getAvailableDoctors);
  const curr = t[lang];

  const q = useQuery({
    queryKey: ["patient-dashboard", token],
    queryFn: () => fetchData({ data: { token } }),
    retry: false,
  });

  const doctorsQ = useQuery({
    queryKey: ["available-doctors"],
    queryFn: () => fetchDoctors(),
  });

  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [selectedPatientUid, setSelectedPatientUid] = useState<string>("all");

  useEffect(() => {
    if (q.error && /log in/i.test(String((q.error as Error).message))) onLogout();
  }, [q.error, onLogout]);

  if (q.isLoading)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{curr.verifying}</p>
      </div>
    );

  if (q.error || !q.data)
    return (
      <div className="p-8 text-center">
        <div className="mx-auto max-w-md rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-destructive">
          <p className="font-semibold">{String((q.error as Error)?.message ?? "Error")}</p>
          <Button variant="outline" className="mt-4 cursor-pointer" onClick={onLogout}>
            {curr.logout}
          </Button>
        </div>
      </div>
    );

  const d = q.data;
  const due = d.bills.reduce(
    (s: number, b: any) => s + Math.max(0, Number(b.total) - Number(b.paid)),
    0
  );
  const upcoming = d.appointments.filter(
    (a: any) => a.appt_date >= new Date().toISOString().slice(0, 10)
  );

  // Filter lists by selected family member / patient UID
  const filteredAppointments = selectedPatientUid === "all"
    ? d.appointments
    : d.appointments.filter((a: any) => (a.patient_code === selectedPatientUid) || (a.patient_name?.toLowerCase() === selectedPatientUid.toLowerCase()));

  const filteredPrescriptions = selectedPatientUid === "all"
    ? d.prescriptions
    : d.prescriptions.filter((r: any) => (r.patient_code === selectedPatientUid) || (r.patient_name?.toLowerCase() === selectedPatientUid.toLowerCase()));

  const filteredLabReports = selectedPatientUid === "all"
    ? d.labReports
    : d.labReports.filter((l: any) => (l.patient_code === selectedPatientUid) || (l.patient_name?.toLowerCase() === selectedPatientUid.toLowerCase()));

  const stats = [
    {
      label: curr.statPrescriptions,
      value: filteredPrescriptions.length,
      icon: FileText,
      color: "text-emerald-500",
    },
    {
      label: curr.statReports,
      value: filteredLabReports.length,
      icon: FlaskConical,
      color: "text-cyan-500",
    },
    {
      label: curr.statAppointments,
      value: upcoming.length,
      icon: CalendarDays,
      color: "text-blue-500",
    },
    {
      label: curr.statDue,
      value: tk(due),
      icon: Receipt,
      color: "text-teal-500",
    },
  ];

  const handleOpenBooking = (docId?: string) => {
    setSelectedDoctorId(docId || null);
    setIsBookingOpen(true);
  };

  return (
    <div className="relative z-10 mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-6 lg:p-8">
      {/* Dashboard Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-border/80 bg-card/85 p-3.5 sm:p-5 shadow-lg backdrop-blur-md">
        <div className="flex items-center justify-between gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 overflow-hidden shadow-sm shrink-0">
              <img
                src={SHEIKH_PHARMA_LOGO_BASE64}
                alt="Sheikh Pharma"
                className="h-9 w-9 sm:h-10 sm:w-10 object-cover rounded-full"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-base sm:text-xl font-bold tracking-tight text-foreground">
                  {d.name || curr.myDashboard}
                </h1>
                <Badge variant="secondary" className="text-[10px] sm:text-xs px-1.5 py-0">
                  {curr.brandName}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                📞 {d.phone}
              </p>
            </div>
          </div>

          {/* Mobile Right Controls: Language Switcher + Logout Icon Button */}
          <div className="flex items-center gap-1.5 sm:hidden shrink-0">
            <LanguageToggle lang={lang} onToggle={onLangToggle} />

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-full cursor-pointer hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 transition-colors"
                  title={curr.logout}
                  aria-label={curr.logout}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{curr.logoutTitle}</AlertDialogTitle>
                  <AlertDialogDescription>{curr.logoutDesc}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{curr.logoutCancel}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onLogout}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
                  >
                    {curr.logoutConfirm}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Action Controls: New Serial Button + Desktop Language & Logout */}
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Button
            size="sm"
            onClick={() => handleOpenBooking()}
            className="w-full sm:w-auto h-10 sm:h-9 rounded-xl font-bold gap-1.5 shadow-sm shadow-primary/20 cursor-pointer text-xs sm:text-sm"
          >
            <Plus className="h-4 w-4" />
            <span>{curr.newSerialBtn}</span>
          </Button>

          {/* Desktop Only: Language & Logout with label */}
          <div className="hidden sm:flex items-center gap-2">
            <LanguageToggle lang={lang} onToggle={onLangToggle} />

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 cursor-pointer hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{curr.logout}</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{curr.logoutTitle}</AlertDialogTitle>
                  <AlertDialogDescription>{curr.logoutDesc}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{curr.logoutCancel}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onLogout}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
                  >
                    {curr.logoutConfirm}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* Family Member / Patient UID Filter Bar */}
      {d.patients && d.patients.length > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 sm:p-3.5 rounded-2xl border border-border/80 bg-card/75 backdrop-blur-md shadow-sm">
          <div className="space-y-2">
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary" />
              <span>{lang === "bn" ? "রোগী নির্বাচন (এক নম্বরে একাধিক রোগী):" : "Select Patient Profile:"}</span>
            </span>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedPatientUid("all")}
                className={cn(
                  "px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer",
                  selectedPatientUid === "all"
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background text-foreground border-border hover:bg-muted"
                )}
              >
                👥 {lang === "bn" ? "সকল রোগী" : "All Members"} ({d.patients.length})
              </button>

              {d.patients.map((p: any) => (
                <button
                  key={p.uid}
                  type="button"
                  onClick={() => setSelectedPatientUid(p.uid)}
                  className={cn(
                    "px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5",
                    selectedPatientUid === p.uid
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background text-foreground border-border hover:bg-muted"
                  )}
                >
                  <span>👤 {p.name}</span>
                  <span className="font-mono text-[10px] opacity-80">({p.uid})</span>
                </button>
              ))}
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenBooking()}
            className="w-full sm:w-auto rounded-xl h-8 text-xs font-bold gap-1 border-primary/30 text-primary hover:bg-primary/5 cursor-pointer mt-1 sm:mt-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{lang === "bn" ? "নতুন রোগীর সিরিয়াল" : "New Patient Serial"}</span>
          </Button>
        </div>
      )}

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-4">
        {stats.map((s, idx) => (
          <Card
            key={idx}
            className="border-border/80 bg-card/85 shadow-sm backdrop-blur-md transition-all duration-200 hover:shadow-md"
          >
            <CardContent className="p-3 sm:p-5">
              <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                <s.icon className={cn("h-4 w-4 sm:h-5 sm:w-5", s.color)} />
              </div>
              <div className="text-lg sm:text-2xl font-bold tracking-tight text-foreground truncate">
                {s.value}
              </div>
              <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                {s.label}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs Navigation for Patient Records - Mobile Responsive 2x2 Grid / Desktop 4 Columns */}
      <Tabs defaultValue="appt" className="w-full">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full h-auto p-1.5 gap-1.5 sm:gap-2 rounded-2xl bg-muted/80 border border-border/80 shadow-inner">
          <TabsTrigger
            value="appt"
            className="h-11 sm:h-10 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all cursor-pointer whitespace-normal text-center"
          >
            <CalendarDays className="h-4 w-4 shrink-0 text-blue-500 data-[state=active]:text-inherit" />
            <span className="truncate">{curr.tabAppt}</span>
          </TabsTrigger>
          <TabsTrigger
            value="rx"
            className="h-11 sm:h-10 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all cursor-pointer whitespace-normal text-center"
          >
            <FileText className="h-4 w-4 shrink-0 text-emerald-500 data-[state=active]:text-inherit" />
            <span className="truncate">{curr.tabRx}</span>
          </TabsTrigger>
          <TabsTrigger
            value="lab"
            className="h-11 sm:h-10 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all cursor-pointer whitespace-normal text-center"
          >
            <FlaskConical className="h-4 w-4 shrink-0 text-cyan-500 data-[state=active]:text-inherit" />
            <span className="truncate">{curr.tabLab}</span>
          </TabsTrigger>
          <TabsTrigger
            value="bill"
            className="h-11 sm:h-10 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all cursor-pointer whitespace-normal text-center"
          >
            <Receipt className="h-4 w-4 shrink-0 text-teal-500 data-[state=active]:text-inherit" />
            <span className="truncate">{curr.tabBill}</span>
          </TabsTrigger>
        </TabsList>

        {/* APPOINTMENTS & SERIALS TAB */}
        <TabsContent value="appt" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-primary" />
                <span>{curr.myAppointmentsTitle}</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {curr.myAppointmentsDesc}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => handleOpenBooking()}
              className="rounded-xl font-bold gap-1.5 shadow-sm shadow-primary/20 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>{curr.newSerialBtn}</span>
            </Button>
          </div>

          {filteredAppointments.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-border/80 bg-card/60">
              <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-semibold text-foreground">{curr.empty}</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {curr.noAppointmentsHint}
              </p>
              <Button
                onClick={() => handleOpenBooking()}
                className="mt-4 rounded-xl font-bold gap-1.5 shadow-sm shadow-primary/20 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>{curr.newSerialBtn}</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAppointments.map((a: any) => (
                <Card key={a.id} className="border-border/80 bg-card/90 shadow-sm backdrop-blur-md overflow-hidden">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-base font-bold text-foreground">
                            {a.doctor_name || "চিকিৎসক"}
                          </h4>
                          {a.doctor_qualification && (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                              ({a.doctor_qualification})
                            </span>
                          )}
                        </div>

                        {/* Patient Name & UID */}
                        <div className="flex items-center gap-2 flex-wrap text-xs pt-0.5">
                          {a.patient_name && (
                            <span className="font-semibold text-foreground">
                              রোগী: {a.patient_name}
                            </span>
                          )}
                          {a.patient_code && (
                            <Badge variant="secondary" className="font-mono text-[10px] text-primary border-primary/20">
                              UID: {a.patient_code}
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-0.5">
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <CalendarDays className="h-3.5 w-3.5 text-primary" />
                            <span>{formatDate(a.appt_date)}</span>
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{a.chamber_name || a.clinic || "শেখ ফার্মা চেম্বার"}</span>
                          </span>
                          {a.fee_amount != null && (
                            <>
                              <span>•</span>
                              <span className="font-semibold text-foreground">ফি: ৳{a.fee_amount}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                        <div className="text-center rounded-xl bg-primary/10 border border-primary/25 px-3.5 py-1.5">
                          <span className="text-[10px] text-muted-foreground font-semibold block uppercase">
                            {curr.serialNo}
                          </span>
                          <span className="text-xl font-black text-primary">
                            #{a.serial_no ?? "—"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-semibold text-xs py-1",
                              a.status === "completed"
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                : a.status === "in_progress"
                                ? "bg-blue-500/10 text-blue-600 border-blue-500/30"
                                : "bg-amber-500/10 text-amber-600 border-amber-500/30"
                            )}
                          >
                            {a.status === "completed"
                              ? lang === "bn"
                                ? "সম্পন্ন"
                                : "Completed"
                              : a.status === "in_progress"
                              ? lang === "bn"
                                ? "চলমান"
                                : "In Progress"
                              : lang === "bn"
                              ? "অপেক্ষমান"
                              : "Waiting"}
                          </Badge>

                          {/* Save as JPG Image Button */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              const ok = await downloadTokenAsJpg({
                                clinicName: "শেখ ফার্মা ও ডায়াগনস্টিক",
                                doctorName: a.doctor_name,
                                doctorQualification: a.doctor_qualification,
                                serialNo: a.serial_no,
                                patientCode: a.patient_code,
                                fee: a.fee_amount,
                                patientType: a.patient_type === "new" ? "New patient" : a.patient_type === "old" ? "Old patient" : "Report",
                                patientName: a.patient_name || d.name,
                                phone: d.phone,
                                location: a.chamber_name || a.clinic,
                                date: a.appt_date,
                              });
                              if (ok) {
                                toast.success(lang === "bn" ? "🎉 টোকেনটি সফলভাবে সেভ হয়েছে!" : "🎉 Token saved successfully!");
                              }
                            }}
                            className="rounded-xl h-9 px-3 font-semibold gap-1.5 text-xs cursor-pointer border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 shadow-sm"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>{curr.saveTokenBtn || (lang === "bn" ? "টোকেন সেভ" : "Save Token")}</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* PRESCRIPTIONS TAB (আমার প্রেসক্রিপশন - সহজ ভাষায় বিশ্লেষণ) */}
        <TabsContent value="rx" className="mt-4 space-y-4">
          {filteredPrescriptions.length === 0 && <Empty message={curr.empty} />}
          {filteredPrescriptions.map((r: any) => (
            <PatientSmartPrescription key={r.id} prescription={r} />
          ))}
        </TabsContent>

        {/* LAB REPORTS TAB (আমার রিপোর্ট - সহজ ভাষায় বিশ্লেষণ) */}
        <TabsContent value="lab" className="mt-4 space-y-4">
          {filteredLabReports.length === 0 && <Empty message={curr.empty} />}
          {filteredLabReports.map((r: any) => (
            <PatientSmartLabReport key={r.id} report={r} />
          ))}
        </TabsContent>

        {/* BILLING & INVOICES TAB */}
        <TabsContent value="bill" className="mt-4 space-y-3">
          {d.bills.length === 0 && d.plans.length === 0 && (
            <Empty message={curr.empty} />
          )}

          {d.bills.map((b: any) => {
            const left = Number(b.total) - Number(b.paid);
            return (
              <Card key={b.id} className="border-border/80 bg-card/90 shadow-sm backdrop-blur-md">
                <CardContent className="flex items-center justify-between p-4 sm:p-5">
                  <div>
                    <div className="font-bold text-foreground font-mono">
                      {b.invoice_no || "Invoice"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(b.sale_date)} · {b.clinic}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-bold text-foreground">
                      {tk(b.total)}
                    </div>
                    {left > 0 ? (
                      <div className="text-xs font-semibold text-destructive">
                        {curr.due}: {tk(left)}
                      </div>
                    ) : (
                      <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        {curr.paid}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {d.plans.map((p: any) => (
            <Card key={p.id} className="border-border/80 bg-card/90 shadow-sm backdrop-blur-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold">
                  {curr.treatmentPlan} —{" "}
                  {tk(Number(p.total_amount) - Number(p.discount))}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {formatDate(p.start_date)} · {p.clinic} · {p.status}
                </p>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm pt-1">
                {(p.clinic_plan_installments ?? [])
                  .sort((a: any, b: any) => a.seq - b.seq)
                  .map((i: any) => (
                    <div
                      key={i.seq}
                      className="flex justify-between border-t border-border/50 pt-1.5"
                    >
                      <span className="text-muted-foreground">
                        {curr.installment} {i.seq} · {formatDate(i.due_date)}
                      </span>
                      <span
                        className={
                          i.status === "paid"
                            ? "text-emerald-600 dark:text-emerald-400 font-medium"
                            : "font-semibold text-foreground"
                        }
                      >
                        {tk(i.amount)} {i.status === "paid" ? "✓" : ""}
                      </span>
                    </div>
                  ))}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Doctor Serial Booking Modal inside Dashboard */}
      <DoctorBookingModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        doctors={doctorsQ.data ?? []}
        initialDoctorId={selectedDoctorId}
        patientPhone={d.phone}
        patientName={d.name}
        lang={lang}
        onBookingComplete={() => {
          qc.invalidateQueries({ queryKey: ["patient-dashboard", token] });
        }}
      />
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
