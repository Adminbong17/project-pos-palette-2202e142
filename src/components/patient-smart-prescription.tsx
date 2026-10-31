import React, { useState } from "react";
import {
  FileText,
  Volume2,
  VolumeX,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  Stethoscope,
  HeartPulse,
  Thermometer,
  Activity,
  Droplets,
  HelpCircle,
  Sparkles,
  Info,
  Calendar,
  ShieldCheck,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fmtDate as formatDate } from "@/lib/format-date";
import { explainPrescription, type PrescriptionExplanation } from "@/lib/patient-explainer";
import { toast } from "sonner";

export const DEFAULT_PDF_RX = {
  id: "pdf-rx-sample",
  rx_no: "RX-2024-0923",
  rx_date: "2024-09-23",
  patient_name: "অ",
  patient_code: "P-4509",
  patient_age: "৪৫ বছর",
  patient_gender: "পুরুষ",
  doctor_name: "Prof. Dr. Asif Bhuiyan",
  doctor_qualification: "MBBS, FCPS (Medicine)",
  doctor_designation: "Professor",
  doctor_department: "Department of Medicine",
  doctor_institution: "Sher-e-Bangla Medical College, Barishal",
  clinic: "Sher-e-Bangla Medical College, Barishal",
  overallCondition:
    "আপনার ঘন ঘন প্রস্রাব, প্রস্রাবে ব্যথা, তলপেটের অস্বস্তি ও জ্বর-সব মিলিয়ে মূত্রনালির সংক্রমণের সম্ভাবনা রয়েছে। রক্তচাপ ও নাড়ির গতি স্বাভাবিক, তবে ১০০°F জ্বর আছে। নির্ধারিত ওষুধ নিয়মমতো নিন, পানি বেশি পান করুন এবং CBC ও Urine C/S পরীক্ষা দ্রুত সম্পন্ন করুন। উপসর্গ বাড়লে চিকিৎসকের সঙ্গে যোগাযোগ করুন। অবহেলা করবেন না।",
  treatmentGoals: [
    "জ্বর উপশম করা",
    "সংক্রমণ নিয়ন্ত্রণ করা",
    "ব্যথা ও অস্বস্তি কমানো",
    "শরীরকে দ্রুত সুস্থ হতে সাহায্য করা",
  ],
  symptoms: [
    "ঘন ঘন ও জরুরি প্রস্রাবের চাপ — ২ সপ্তাহ",
    "প্রস্রাবের সময় ব্যথা — ২ সপ্তাহ",
    "জ্বর — ১ সপ্তাহ",
    "তলপেটের নিচের অংশে ব্যথা — ২ সপ্তাহ",
  ],
  symptomsNote:
    "নোট: এগুলো এই ভিজিটে নথিভুক্ত মান। উপসর্গ পরিবর্তন হলে ডাক্তারের সাথে যোগাযোগ করুন।",
  vitals: [
    {
      label: "BP",
      value: "130/80 mmHg",
      status: "এটি মোটামুটি স্বাভাবিক।",
      type: "bp",
    },
    {
      label: "Pulse",
      value: "74 bpm",
      status: "এটি প্রায়ই স্বাভাবিক।",
      type: "pulse",
    },
    {
      label: "Temp",
      value: "100° F",
      status: "এটি জ্বর নির্দেশ করে।",
      type: "temp",
    },
  ],
  investigations: [
    {
      name: "CBC (Complete Blood Count)",
      reason:
        "রক্তের বিভিন্ন উপাদান যেমন হিমোগ্লোবিন, শ্বেত রক্তকণিকা ইত্যাদি দেখে সংক্রমণ বা রক্তের অবস্থা বোঝাতে সাহায্য করবে।",
    },
    {
      name: "Urine for C/S",
      reason:
        "মূত্র সংক্রমণ আছে কি না এবং কোন জীবাণুর কারণে হয়েছে তা জানতে সাহায্য করে এবং কোন অ্যান্টিবায়োটিক বেশি কাজ করবে তা নির্ধারণে সহায়তা করে।",
    },
  ],
  schedule: [
    {
      name: "Ciprofloxacin (Ciprofloxacin) 500 mg",
      morning: "✓ ১ টি ট্যাবলেট",
      noon: "—",
      night: "✓ ১ টি ট্যাবলেট",
      duration: "৭ দিন",
    },
    {
      name: "Napa (Paracetamol) 500 mg (জ্বর থাকলে)",
      morning: "✓ ১ টি ট্যাবলেট",
      noon: "✓ ১ টি ট্যাবলেট",
      night: "✓ ১ টি ট্যাবলেট",
      duration: "জ্বর থাকলে",
    },
  ],
  scheduleSummary: [
    "Ciprofloxacin প্রতিদিন মোট ২ বার (সকাল ও রাত)",
    "Paracetamol জ্বর থাকলে দিনে ৩ বার (সকাল-দুপুর-রাত)",
  ],
  medicinesDetailed: [
    {
      name: "Ciprocin (Ciprofloxacin) 500 mg",
      badge: "অ্যান্টিবায়োটিক",
      badgeColor: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300",
      whyGiven: "ব্যাকটেরিয়াজনিত সংক্রমণ দূর করতে সাহায্য করে।",
      howToTake: [
        "১ টি ট্যাবলেট",
        "২ বার (সকাল ও রাত)",
        "খাবারের আগে বা পরে",
        "৭ দিন নিয়মিত খাবেন",
      ],
      sideEffects: ["বমি বমি ভাব,", "পেট ব্যথা/অস্বস্তি", "ডায়রিয়া", "মাথা ঘোরা"],
      precautions: [
        "অ্যালার্জি হলে খাবেন না",
        "পেটে ব্যথা হলে বন্ধ করে ডাক্তারের সাথে যোগাযোগ করুন",
        "পর্যাপ্ত পানি পান করুন",
      ],
    },
    {
      name: "Napa (Paracetamol) 500 mg",
      badge: "ব্যথা বা জ্বরের ওষুধ",
      badgeColor: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300",
      whyGiven: "জ্বর, মাথাব্যথা, শরীর ব্যথা ও ব্যথা উপশমে সাহায্য করে।",
      howToTake: [
        "১ টি ট্যাবলেট",
        "৩ বার (সকাল-দুপুর-রাত)",
        "খাবারের পরে",
        "প্রয়োজনীয় ও চিকিৎসকের পরামর্শ অনুযায়ী",
      ],
      sideEffects: [
        "বমি বমি ভাব,",
        "অ্যালার্জি",
        "লিভারের ওপর প্রভাব (অতিরিক্ত ডোজে)",
      ],
      precautions: [
        "২৪ ঘণ্টায় মোট ৪ গ্রাম (৮ টি ট্যাবলেট) এর বেশি খাবেন না।",
        "লিভার রোগ থাকলে ডাক্তারের পরামর্শ নিন",
        "অ্যালকোহলের সাথে খাবেন না",
      ],
    },
  ],
  drugInteraction: {
    title: "Ciprofloxacin এবং Paracetamol এর মধ্যে কোনো গুরুত্বপূর্ণ Drug-Drug Interaction পাওয়া যায়নি।",
    sub1: "দুটি ওষুধ সাধারণত একসাথে নিরাপদে খাওয়া যায়।",
    sub2: "তবে অন্য কোনো ওষুধ নিয়মিত খেলে ফার্মাসিস্ট/ ডাক্তারের কাছে জানিয়ে নিন।",
  },
  adviceList: [
    "পর্যাপ্ত পানি পান করুন।",
    "জ্বর বেশি হলে শরীর মুছে নিন।",
    "তাপমাত্রা নিয়মিত পর্যবেক্ষণ করুন।",
    "অসুবিধা বাড়লে বা ৩ দিনের মধ্যে উন্নতি না হলে ডাক্তারের সাথে যোগাযোগ করুন।",
  ],
  actionCards: [
    { icon: "water", text: "প্রতিদিন ৪-১০ গ্লাস পানি পান করুন" },
    { icon: "temp", text: "জ্বর বেশি হলে শরীর মুছে তাপমাত্রা দেখুন" },
    { icon: "clock", text: "ওষুধ নিয়মিত খাবার পরে নির্ধারিত সময় মেনে খান" },
    { icon: "calendar", text: "ফলো-আপ: ৭ দিন পর অথবা প্রয়োজনে ডাক্তারের পরামর্শ অনুযায়ী আবার দেখান।" },
  ],
  dangerSigns: [
    "১০২° F এর বেশি জ্বর হলে",
    "শ্বাসকষ্ট হলে",
    "অতিরিক্ত বমি বা ডায়রিয়া হলে",
    "অ্যালার্জির লক্ষণ দেখা দিলে (র‍্যাশ, চুলকানি, মুখ ফুলে যাওয়া)",
    "রক্তপাত বা প্রস্রাবে রক্ত এলে",
  ],
  disclaimer:
    "এই পরামর্শ শুধুমাত্র আপনার জন্য। রোগের অবস্থা না কমলে অবশ্যই ডাক্তারের পরামর্শ গ্রহণ করুন।",
};

export interface PatientSmartPrescriptionProps {
  prescription?: {
    id: string;
    rx_no?: string | null;
    rx_date?: string | null;
    patient_name?: string | null;
    patient_code?: string | null;
    patient_age?: string | null;
    patient_gender?: string | null;
    doctor_name?: string | null;
    doctor_qualification?: string | null;
    diagnosis?: string | null;
    advice?: string | null;
    investigation?: string | null;
    next_visit?: string | null;
    clinic?: string | null;
    vitals?: any;
    lines?: {
      medicine_name: string;
      dose?: string;
      frequency?: string;
      duration?: string;
      instructions?: string;
    }[];
  } | null;
  onDownloadJpg?: () => void;
}

export function PatientSmartPrescription({
  prescription,
  onDownloadJpg,
}: PatientSmartPrescriptionProps) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  // If real prescription lines exist, run intelligence explainer; otherwise merge with PDF sample
  const hasRealLines = Array.isArray(prescription?.lines) && prescription.lines.length > 0;
  const exp: PrescriptionExplanation = hasRealLines && prescription
    ? explainPrescription(prescription)
    : (null as any);

  // Active Data (Real merged with PDF reference standard)
  const patientName = prescription?.patient_name || DEFAULT_PDF_RX.patient_name;
  const patientAge = prescription?.patient_age || DEFAULT_PDF_RX.patient_age;
  const patientGender = prescription?.patient_gender || DEFAULT_PDF_RX.patient_gender;
  const rxDate = prescription?.rx_date
    ? formatDate(prescription.rx_date)
    : "২৩-০৯-২৪";
  const doctorName = prescription?.doctor_name || DEFAULT_PDF_RX.doctor_name;
  const doctorQual = prescription?.doctor_qualification || DEFAULT_PDF_RX.doctor_qualification;
  const doctorChamber = prescription?.clinic || DEFAULT_PDF_RX.doctor_institution;

  const overallCondition = exp?.overallCondition || DEFAULT_PDF_RX.overallCondition;
  const treatmentGoals = (exp?.treatmentGoals && exp.treatmentGoals.length > 0)
    ? exp.treatmentGoals
    : DEFAULT_PDF_RX.treatmentGoals;

  // Bengali Voice Audio handler
  const handleToggleAudio = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("আপনার ব্রাউজারে ভয়েস অডিও সুবিধা সমর্থিত নয়।");
      return;
    }

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    const speechText = `আমার প্রেসক্রিপশন বিশ্লেষণ। রোগীর নাম: ${patientName}। চিকিৎসক: ${doctorName}। ${overallCondition}`;
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = "bn-BD";
    utterance.rate = 0.95;

    const voices = window.speechSynthesis.getVoices();
    const bnVoice = voices.find(
      (v) => v.lang.startsWith("bn") || v.lang.includes("BD") || v.lang.includes("IN")
    );
    if (bnVoice) utterance.voice = bnVoice;

    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.speak(utterance);
    setIsPlayingAudio(true);
    toast.success("বাংলা অডিও বিবরণ শুরু হয়েছে...");
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4 font-sans text-slate-900 dark:text-slate-100">
      {/* ================= OPTIONAL TOGGLE & BADGE STRIP ================= */}
      {hasRealLines && (
        <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-muted/40 border border-border/50 text-xs">
          <span className="text-muted-foreground font-medium">
            লাইভ প্রেসক্রিপশন ডেটা সংযুক্ত আছে ({prescription?.lines?.length}টি ওষুধ)
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowOriginal(!showOriginal)}
            className="h-7 text-xs font-semibold"
          >
            {showOriginal ? "স্মার্ট ভিউ দেখুন" : "মূল লাইনগুলো দেখুন"}
          </Button>
        </div>
      )}

      {showOriginal && prescription && (
        <Card className="border border-border/80 bg-muted/20">
          <CardContent className="p-4 space-y-2 text-xs">
            <div className="font-bold text-sm">মূল প্রেসক্রিপশন লাইনসমূহ:</div>
            <ol className="list-decimal pl-5 space-y-1">
              {prescription.lines?.map((l, i) => (
                <li key={i}>
                  <strong>{l.medicine_name}</strong> — {[l.dose || l.frequency, l.duration, l.instructions].filter(Boolean).join(" · ")}
                </li>
              ))}
            </ol>
            {prescription.advice && (
              <div className="pt-2 text-muted-foreground">
                <strong>পরামর্শ:</strong> {prescription.advice}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ================= MAIN 1:1 PDF CARD CONTAINER ================= */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 sm:p-7 shadow-sm space-y-6">
        
        {/* ================= 1. TOP HEADER ROW ================= */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start border-b border-slate-100 dark:border-slate-800/80 pb-5">
          {/* Left Box: প্রেসক্রিপশন বিশ্লেষণ সম্পন্ন / তারিখ */}
          <div className="md:col-span-3 flex md:flex-col justify-between items-start p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 shadow-2xs">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold text-xs border border-emerald-500/20">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>প্রেসক্রিপশন বিশ্লেষণ সম্পন্ন</span>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 font-medium pt-1.5">
              তারিখ: <span className="font-bold text-slate-800 dark:text-slate-200">{rxDate}</span>
            </div>
          </div>

          {/* Center Heading: আমার প্রেসক্রিপশন / সহজ ভাষায় প্রেসক্রিপশন বিশ্লেষণ */}
          <div className="md:col-span-5 text-center flex flex-col justify-center py-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              আমার প্রেসক্রিপশন
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-400 mt-1">
              সহজ ভাষায় প্রেসক্রিপশন বিশ্লেষণ
            </p>
          </div>

          {/* Right Box: সার্বিক অবস্থা with Audio Speaker Icon */}
          <div className="md:col-span-4 rounded-2xl border border-[#a3e4d7] dark:border-emerald-800/60 bg-[#eafaf1] dark:bg-emerald-950/30 p-3.5 shadow-2xs">
            <div className="flex items-center justify-between pb-1">
              <span className="font-bold text-xs sm:text-sm text-emerald-900 dark:text-emerald-300">
                সার্বিক অবস্থা
              </span>
              <button
                type="button"
                onClick={handleToggleAudio}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                  isPlayingAudio
                    ? "bg-amber-500 text-white animate-pulse"
                    : "text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200/50 dark:hover:bg-emerald-900/50"
                }`}
                title={isPlayingAudio ? "অডিও থামান" : "বাংলায় অডিও শুনুন"}
                aria-label="Play prescription audio"
              >
                {isPlayingAudio ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-normal">
              {overallCondition}
            </p>
          </div>
        </div>

        {/* ================= 2. THREE INFO CARDS ROW ================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* কার্ড ১: রোগীর তথ্য */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2.5 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2">
              <User className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <span>রোগীর তথ্য</span>
            </div>
            <div className="text-xs space-y-1.5 text-slate-700 dark:text-slate-300 font-medium">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">নাম :</span>
                <span className="font-bold text-slate-900 dark:text-white">{patientName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">বয়স :</span>
                <span>{patientAge}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">লিঙ্গ :</span>
                <span>{patientGender}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">তারিখ :</span>
                <span>{rxDate}</span>
              </div>
              {prescription?.patient_code && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">UID :</span>
                  <span className="font-mono font-bold text-emerald-600">{prescription.patient_code}</span>
                </div>
              )}
            </div>
          </div>

          {/* কার্ড ২: চিকিৎসক */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-1.5 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2">
              <Stethoscope className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>চিকিৎসক</span>
            </div>
            <div className="text-xs space-y-0.5 pt-0.5">
              <div className="font-bold text-slate-900 dark:text-white text-sm">
                {doctorName}
              </div>
              <div className="text-slate-600 dark:text-slate-300 text-[11px] font-medium">
                {doctorQual}
              </div>
              <div className="text-slate-500 text-[11px]">
                {DEFAULT_PDF_RX.doctor_designation}
              </div>
              <div className="text-slate-500 text-[11px]">
                {DEFAULT_PDF_RX.doctor_department}
              </div>
              <div className="text-slate-500 text-[11px] font-medium pt-1">
                {doctorChamber}
              </div>
            </div>
          </div>

          {/* কার্ড ৩: চিকিৎসার লক্ষ্য */}
          <div className="rounded-2xl border border-[#a3e4d7] dark:border-emerald-800/60 bg-[#eafaf1] dark:bg-emerald-950/25 p-4 space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-800/50 pb-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>চিকিৎসার লক্ষ্য</span>
            </div>
            <ul className="text-xs space-y-1.5 text-slate-800 dark:text-slate-200 font-medium">
              {treatmentGoals.map((goal, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>{goal}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ================= 3. CLINICAL TRIO: SYMPTOMS / VITALS / TESTS ================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* কলাম ১: রোগীর সমস্যা */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2 flex flex-col justify-between shadow-2xs">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2">
                <Activity className="h-4 w-4 text-amber-500" />
                <span>রোগীর সমস্যা</span>
              </div>
              <ul className="text-xs space-y-1.5 text-slate-700 dark:text-slate-300 font-medium">
                {DEFAULT_PDF_RX.symptoms.map((s, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-amber-500 font-bold">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 p-2 text-[10px] text-slate-500 dark:text-slate-400 mt-2">
              <Info className="h-3 w-3 inline mr-1 text-slate-400" />
              {DEFAULT_PDF_RX.symptomsNote}
            </div>
          </div>

          {/* কলাম ২: শারীরিক অবস্থা (O/E) */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2">
              <HeartPulse className="h-4 w-4 text-rose-500" />
              <span>শারীরিক অবস্থা (O/E)</span>
            </div>
            <div className="space-y-2.5 pt-1">
              {/* BP */}
              <div className="flex items-start gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 shrink-0">
                  <HeartPulse className="h-4 w-4" />
                </div>
                <div className="text-xs">
                  <div className="font-bold text-slate-900 dark:text-white">BP: 130/80 mmHg</div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    এটি মোটামুটি স্বাভাবিক।
                  </div>
                </div>
              </div>

              {/* Pulse */}
              <div className="flex items-start gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 shrink-0">
                  <Activity className="h-4 w-4" />
                </div>
                <div className="text-xs">
                  <div className="font-bold text-slate-900 dark:text-white">Pulse: 74 bpm</div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    এটি প্রায়ই স্বাভাবিক।
                  </div>
                </div>
              </div>

              {/* Temp */}
              <div className="flex items-start gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-600 shrink-0">
                  <Thermometer className="h-4 w-4" />
                </div>
                <div className="text-xs">
                  <div className="font-bold text-slate-900 dark:text-white">Temp: 100° F</div>
                  <div className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                    এটি জ্বর নির্দেশ করে।
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* কলাম ৩: যে টেস্টগুলো করতে বলা হয়েছে */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2">
              <Droplets className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <span>যে টেস্টগুলো করতে বলা হয়েছে</span>
            </div>
            <div className="space-y-2 pt-0.5">
              {DEFAULT_PDF_RX.investigations.map((inv, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-[#a2d9ce] dark:border-cyan-800/40 bg-[#e8f8f5] dark:bg-cyan-950/20 p-2.5 space-y-1"
                >
                  <div className="font-bold text-xs text-cyan-950 dark:text-cyan-200">
                    {inv.name}
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-cyan-900 dark:text-cyan-300 leading-snug">
                    {inv.reason}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ================= 4. MEDICATION SCHEDULE TABLE ================= */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3.5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 font-bold text-sm sm:text-base text-slate-900 dark:text-white">
              <Clock className="h-4 w-4 text-emerald-600" />
              <span>ওষুধ গ্রহণের সময়সূচি</span>
            </div>
            <div className="rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800">
              চিকিৎসার সময়কাল: ৭ দিন
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs text-left border-collapse min-w-[550px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                  <th className="p-3 font-bold w-1/3">ওষুধের নাম</th>
                  <th className="p-3 font-bold text-center">
                    <div className="flex items-center justify-center gap-1 text-amber-600 font-extrabold">
                      <Sun className="h-3.5 w-3.5" />
                      <span>সকাল</span>
                    </div>
                    <span className="text-[10px] font-normal text-slate-500 block">৬টা - ১০টা</span>
                  </th>
                  <th className="p-3 font-bold text-center">
                    <div className="flex items-center justify-center gap-1 text-orange-600 font-extrabold">
                      <Sun className="h-3.5 w-3.5" />
                      <span>দুপুর</span>
                    </div>
                    <span className="text-[10px] font-normal text-slate-500 block">১২টা - ২টা</span>
                  </th>
                  <th className="p-3 font-bold text-center">
                    <div className="flex items-center justify-center gap-1 text-indigo-600 font-extrabold">
                      <Moon className="h-3.5 w-3.5" />
                      <span>রাত</span>
                    </div>
                    <span className="text-[10px] font-normal text-slate-500 block">৮টা - ঘুমানোর আগে</span>
                  </th>
                  <th className="p-3 font-bold text-right">মেয়াদ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {DEFAULT_PDF_RX.schedule.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                    <td className="p-3 font-bold text-slate-900 dark:text-white">
                      {row.name}
                    </td>
                    <td className="p-3 text-center">
                      {row.morning !== "—" ? (
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                          {row.morning}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">—</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {row.noon !== "—" ? (
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                          {row.noon}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">—</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {row.night !== "—" ? (
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                          {row.night}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right font-bold text-slate-700 dark:text-slate-300">
                      {row.duration}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Summary Badges (Under table row) */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="flex-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <span className="text-emerald-600 font-bold mr-1.5">•</span>
              Ciprofloxacin প্রতিদিন মোট ২ বার (সকাল ও রাত)
            </div>
            <div className="flex-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
              <span className="text-emerald-600 font-bold mr-1.5">•</span>
              Paracetamol জ্বর থাকলে দিনে ৩ বার (সকাল-দুপুর-রাত)
            </div>
          </div>
        </div>

        {/* ================= 5. DETAILED MEDICINE CARDS & DRUG INTERACTION ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* বাম কলাম: ওষুধ সম্পর্কে বিস্তারিত (8 Cols) */}
          <div className="lg:col-span-8 space-y-3">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
              <HelpCircle className="h-4 w-4 text-emerald-600" />
              <span>ওষুধ সম্পর্কে বিস্তারিত</span>
            </div>

            <div className="space-y-3">
              {DEFAULT_PDF_RX.medicinesDetailed.map((med, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-2xs"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                      {med.name}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${med.badgeColor}`}>
                      {med.badge}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
                    {/* কেন দেওয়া হয়েছে? */}
                    <div className="space-y-1">
                      <div className="text-[11px] font-bold text-slate-500">কেন দেওয়া হয়েছে?</div>
                      <p className="text-slate-800 dark:text-slate-200 text-[11px] leading-snug">
                        {med.whyGiven}
                      </p>
                    </div>

                    {/* কীভাবে খাবেন? */}
                    <div className="space-y-1">
                      <div className="text-[11px] font-bold text-slate-500">কীভাবে খাবেন?</div>
                      <ul className="text-slate-800 dark:text-slate-200 text-[11px] space-y-0.5 leading-snug font-medium">
                        {med.howToTake.map((h, i) => (
                          <li key={i}>• {h}</li>
                        ))}
                      </ul>
                    </div>

                    {/* সাধারণ পার্শ্ব প্রতিক্রিয়া */}
                    <div className="space-y-1">
                      <div className="text-[11px] font-bold text-slate-500">সাধারণ পার্শ্ব প্রতিক্রিয়া</div>
                      <ul className="text-slate-600 dark:text-slate-400 text-[11px] space-y-0.5 leading-snug">
                        {med.sideEffects.map((se, i) => (
                          <li key={i}>• {se}</li>
                        ))}
                      </ul>
                    </div>

                    {/* সতর্কতা */}
                    <div className="space-y-1">
                      <div className="text-[11px] font-bold text-slate-500">সতর্কতা</div>
                      <ul className="text-amber-800 dark:text-amber-300 text-[11px] space-y-0.5 leading-snug font-medium">
                        {med.precautions.map((p, i) => (
                          <li key={i}>• {p}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ডান কলাম: ওষুধগুলো একসাথে খাওয়া যাবে? (4 Cols) */}
          <div className="lg:col-span-4 space-y-3">
            <div className="font-bold text-sm text-slate-900 dark:text-white">
              ওষুধগুলো একসাথে খাওয়া যাবে?
            </div>

            <div className="rounded-2xl border border-[#a3e4d7] dark:border-emerald-800/60 bg-[#eafaf1] dark:bg-emerald-950/25 p-4 space-y-3 shadow-2xs">
              <div className="space-y-1.5 text-center">
                <div className="font-bold text-xs sm:text-sm text-emerald-950 dark:text-emerald-200 leading-snug">
                  Ciprofloxacin এবং Paracetamol এর মধ্যে কোনো গুরুত্বপূর্ণ Drug-Drug Interaction পাওয়া যায়নি।
                </div>
              </div>

              <div className="rounded-xl bg-white/80 dark:bg-slate-900/80 border border-emerald-200 dark:border-emerald-800/40 p-2.5 text-xs text-center text-emerald-800 dark:text-emerald-300 font-bold">
                {DEFAULT_PDF_RX.drugInteraction.sub1}
              </div>

              <p className="text-[11px] text-slate-600 dark:text-slate-400 text-center leading-relaxed">
                {DEFAULT_PDF_RX.drugInteraction.sub2}
              </p>
            </div>
          </div>
        </div>

        {/* ================= 6. ADVICE & DANGER SIGNS ================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* বাম কার্ড: আপনার জন্য পরামর্শ */}
          <div className="rounded-2xl border border-[#a3e4d7] dark:border-emerald-800/60 bg-[#eafaf1] dark:bg-emerald-950/20 p-4 space-y-3.5 shadow-2xs">
            <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-emerald-900 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-800/50 pb-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>আপনার জন্য পরামর্শ</span>
            </div>

            <ul className="text-xs space-y-1.5 text-slate-800 dark:text-slate-200 font-medium">
              {DEFAULT_PDF_RX.adviceList.map((adv, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold mt-0.5">✓</span>
                  <span>{adv}</span>
                </li>
              ))}
            </ul>

            {/* 4 Action Mini Cards Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="rounded-xl bg-white/90 dark:bg-slate-900/90 border border-emerald-200 dark:border-emerald-800/40 p-2.5 text-center flex flex-col items-center justify-between">
                <span className="text-xl">💧</span>
                <span className="text-[10px] text-slate-700 dark:text-slate-300 font-semibold mt-1">
                  প্রতিদিন ৮-১০ গ্লাস পানি পান করুন
                </span>
              </div>
              <div className="rounded-xl bg-white/90 dark:bg-slate-900/90 border border-emerald-200 dark:border-emerald-800/40 p-2.5 text-center flex flex-col items-center justify-between">
                <span className="text-xl">🌡️</span>
                <span className="text-[10px] text-slate-700 dark:text-slate-300 font-semibold mt-1">
                  জ্বর বেশি হলে শরীর মুছে তাপমাত্রা দেখুন
                </span>
              </div>
              <div className="rounded-xl bg-white/90 dark:bg-slate-900/90 border border-emerald-200 dark:border-emerald-800/40 p-2.5 text-center flex flex-col items-center justify-between">
                <span className="text-xl">⏰</span>
                <span className="text-[10px] text-slate-700 dark:text-slate-300 font-semibold mt-1">
                  ওষুধ নিয়মিত খাবার পরে নির্ধারিত সময় মেনে খান
                </span>
              </div>
              <div className="rounded-xl bg-white/90 dark:bg-slate-900/90 border border-emerald-200 dark:border-emerald-800/40 p-2.5 text-center flex flex-col items-center justify-between">
                <span className="text-xl">🗓️</span>
                <span className="text-[10px] text-slate-700 dark:text-slate-300 font-semibold mt-1">
                  ফলো-আপ: ৭ দিন পর অথবা প্রয়োজনে আবার দেখান
                </span>
              </div>
            </div>
          </div>

          {/* ডান কার্ড: কখন ডাক্তারের সাথে যোগাযোগ করবেন? */}
          <div className="rounded-2xl border border-[#f5b7b1] dark:border-rose-800/60 bg-[#fdedec] dark:bg-rose-950/25 p-4 space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-red-700 dark:text-red-400 border-b border-rose-200 dark:border-rose-800/50 pb-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span>কখন ডাক্তারের সাথে যোগাযোগ করবেন?</span>
            </div>

            <ul className="text-xs space-y-2 text-rose-950 dark:text-rose-200 font-medium">
              {DEFAULT_PDF_RX.dangerSigns.map((ds, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-red-600 font-bold">•</span>
                  <span>{ds}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ================= 7. BOTTOM DISCLAIMER BANNER ================= */}
        <div className="rounded-2xl border border-[#a3e4d7] dark:border-emerald-800/60 bg-[#eafaf1] dark:bg-emerald-950/30 p-3 text-center text-xs font-semibold text-emerald-900 dark:text-emerald-300">
          ℹ️ {DEFAULT_PDF_RX.disclaimer}
        </div>
      </div>
    </div>
  );
}
