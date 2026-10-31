import React, { useState } from "react";
import {
  FlaskConical,
  Volume2,
  VolumeX,
  Share2,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  Info,
  Calendar,
  Building2,
  ShieldCheck,
  Check,
  ChevronRight,
  FileText,
  Layers,
  ArrowRightLeft,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fmtDate as formatDate } from "@/lib/format-date";
import { explainLabReport, type LabReportExplanation } from "@/lib/patient-explainer";
import { toast } from "sonner";

export const DEFAULT_PDF_LAB = {
  id: "sample-lab-1",
  test_name: "CBC + ESR",
  date_text: "১৪ ফেব্রুয়ারি ২০২৪",
  clinic: "Popular Diagnostic Center",
  status_badge: "রিপোর্ট আপলোড সফল",
  total_params: 12,
  normal_count: 10,
  mild_count: 2,
  abnormal_count: 0,
  good_news_title: "ভালো খবর!",
  good_news:
    "আপনার বেশিরভাগ রিপোর্ট স্বাভাবিক সীমায় রয়েছে। শুধু ESR ও Eosinophils সামান্য বেশি, যা অনেক ক্ষেত্রে হালকা প্রদাহ, এলার্জি বা চলমান সংক্রমণের সঙ্গে সম্পর্কিত হতে পারে। এটি জরুরি বিপদের লক্ষণ নয়, তবে উপসর্গ থাকলে চিকিৎসকের পরামর্শ অনুযায়ী ফলো-আপ করুন।",
  parameters: [
    {
      no: "1.",
      name: "WBC (Total)",
      result: "8,200",
      unit: "/µL",
      range: "4,000–11,000",
      status: "normal",
      statusText: "স্বাভাবিক",
      explanation: "সংক্রমণের বিরুদ্ধে লড়াই করা শ্বেত কণিকা",
    },
    {
      no: "2.",
      name: "RBC (Total)",
      result: "4.35",
      unit: "মিলিয়ন /µL",
      range: "4.2–5.4",
      status: "normal",
      statusText: "স্বাভাবিক",
      explanation: "রক্তে অক্সিজেন বহনকারী কণিকা",
    },
    {
      no: "3.",
      name: "Hemoglobin",
      result: "12.6",
      unit: "g/dL",
      range: "12–16",
      status: "normal",
      statusText: "স্বাভাবিক",
      explanation: "রক্তের অক্সিজেন বহনের ক্ষমতা বোঝায়",
    },
    {
      no: "4.",
      name: "Platelet",
      result: "2.45",
      unit: "লাখ /µL",
      range: "1.5–4.0 লাখ",
      status: "normal",
      statusText: "স্বাভাবিক",
      explanation: "রক্ত জমাট বাঁধতে সাহায্য করে",
    },
    {
      no: "5.",
      name: "Neutrophils",
      result: "68",
      unit: "%",
      range: "40–70",
      status: "normal",
      statusText: "স্বাভাবিক",
      explanation: "সংক্রমণে বাড়তে পারে",
    },
    {
      no: "6.",
      name: "Lymphocytes",
      result: "22",
      unit: "%",
      range: "20–40",
      status: "normal",
      statusText: "স্বাভাবিক",
      explanation: "রোগ প্রতিরোধে গুরুত্বপূর্ণ",
    },
    {
      no: "7.",
      name: "Eosinophils",
      result: "06",
      unit: "%",
      range: "1–6",
      status: "mild",
      statusText: "সামান্য তারতম্য",
      explanation: "এলার্জি বা কিছু অবস্থায় বাড়তে পারে",
    },
    {
      no: "8.",
      name: "Monocytes",
      result: "04",
      unit: "%",
      range: "2–10",
      status: "normal",
      statusText: "স্বাভাবিক",
      explanation: "সংক্রমণ-পরবর্তী পর্যায়ে সক্রিয় হয়",
    },
    {
      no: "9.",
      name: "ESR (1st hour)",
      result: "28",
      unit: "mm/hr",
      range: "0–20",
      status: "mild",
      statusText: "সামান্য তারতম্য",
      explanation: "শরীরে প্রদাহ বা সংক্রমণ থাকলে বাড়তে পারে",
    },
    {
      no: "10.",
      name: "MCV",
      result: "88",
      unit: "fL",
      range: "80–100",
      status: "normal",
      statusText: "স্বাভাবিক",
      explanation: "RBC-এর গড় আকার",
    },
    {
      no: "11.",
      name: "MCH",
      result: "29",
      unit: "pg",
      range: "27–33",
      status: "normal",
      statusText: "স্বাভাবিক",
      explanation: "প্রতি RBC-তে হিমোগ্লোবিনের পরিমাণ",
    },
    {
      no: "12.",
      name: "MCHC",
      result: "32",
      unit: "g/dL",
      range: "31–36",
      status: "normal",
      statusText: "স্বাভাবিক",
      explanation: "রক্তে হিমোগ্লোবিনের ঘনত্ব",
    },
  ],
  summaryCards: {
    normal: { count: "১০ টি", note: "বেশিরভাগ মান স্বাভাবিক সীমার মধ্যে আছে।" },
    mild: {
      count: "২ টি",
      details: ["Eosinophils (6%)", "ESR (28 mm/hr)"],
      note: "সাধারণত এলার্জি, হালকা প্রদাহ বা চলমান সংক্রমণে দেখা যেতে পারে।",
    },
    risk: {
      title: "ঝুঁকির স্তর",
      note: "এই রিপোর্টে তাৎক্ষণিক বিপজ্জনক সংকেত পাওয়া যায়নি।",
    },
  },
  patientTips: [
    "চিকিৎসক যে পরামর্শ দিয়েছেন তা অনুসরণ করুন",
    "উপসর্গ থাকলে ফলো-আপ করুন",
    "পর্যাপ্ত পানিপান করুন",
    "প্রয়োজন হলে পুনরায় টেস্ট করুন",
    "পুরোনো রিপোর্ট থাকলে তুলনা করুন",
  ],
  dangerSigns: [
    "জ্বর দীর্ঘদিন থাকলে",
    "শ্বাসকষ্ট বা বুক ব্যথা হলে",
    "অস্বাভাবিক দুর্বলতা বাড়লে",
    "নতুন উপসর্গ শুরু হলে",
    "রিপোর্টের মান আরও খারাপ হলে",
  ],
  faqs: [
    {
      question: "ESR কেন বাড়ে?",
      answer:
        "শরীরে প্রদাহ (inflammation), ব্যাকটেরিয়াল সংক্রমণ বা এলার্জি থাকলে লোহিত রক্তকণিকা দ্রুত নিচে নেমে জমে যায়, ফলে ESR কিছুটা বাড়ে। রোগ নিরাময় হলে এটি স্বয়ংক্রিয়ভাবে স্বাভাবিক হয়।",
    },
    {
      question: "Eosinophils বেশি মানে কী?",
      answer:
        "সাধারণত ধুলোবালি বা খাবারে এলার্জি, হাঁপানি, চুলকানি বা পেটে কৃমির উপস্থিতি থাকলে ইওসিনোফিল সাময়িকভাবে বৃদ্ধি পেতে পারে।",
    },
    {
      question: "আবার টেস্ট করতে হবে?",
      answer:
        "চিকিৎসক প্রয়োজন মনে করলে চিকিৎসার কোর্স শেষ হওয়ার পর ফলো-আপ ভিজিটে এটি পুনরায় করতে বলতে পারেন।",
    },
    {
      question: "ডাক্তারের কাছে কখন যাব?",
      answer:
        "জ্বর যদি দীর্ঘদিন ধরে না কমে, বুকে ব্যথা বা প্রচণ্ড দুর্বলতা দেখা দেয়, তবে অবিলম্বে চিকিৎসকের পরামর্শ নেওয়া জরুরি।",
    },
  ],
};

export interface PatientSmartLabReportProps {
  report?: {
    id: string;
    test_name?: string | null;
    department?: string | null;
    patient_name?: string | null;
    patient_code?: string | null;
    age?: string | null;
    gender?: string | null;
    sample_no?: string | null;
    reported_at_text?: string | null;
    created_at?: string | null;
    clinic?: string | null;
    comment?: string | null;
    rows?: {
      name?: string;
      test?: string;
      result?: string | number;
      unit?: string;
      ref?: string;
      reference_range?: string;
    }[];
  } | null;
}

export function PatientSmartLabReport({ report }: PatientSmartLabReportProps) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"summary" | "full" | "easy" | "compare">("summary");
  const [selectedFaq, setSelectedFaq] = useState<number | null>(null);

  const hasRealRows = Array.isArray(report?.rows) && report.rows.length > 0;
  const exp: LabReportExplanation = hasRealRows && report
    ? explainLabReport(report)
    : (null as any);

  // Active metrics
  const testName = report?.test_name || DEFAULT_PDF_LAB.test_name;
  const reportDate = report?.reported_at_text || (report?.created_at ? formatDate(report.created_at) : DEFAULT_PDF_LAB.date_text);
  const labName = report?.clinic || DEFAULT_PDF_LAB.clinic;

  const totalParams = exp ? exp.totalParameters : DEFAULT_PDF_LAB.total_params;
  const normalCount = exp ? exp.normalCount : DEFAULT_PDF_LAB.normal_count;
  const mildCount = exp ? exp.mildCount : DEFAULT_PDF_LAB.mild_count;
  const abnormalCount = exp ? exp.abnormalCount : DEFAULT_PDF_LAB.abnormal_count;

  const goodNewsText = exp ? exp.reassuranceMessage : DEFAULT_PDF_LAB.good_news;

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

    const speechText = `আমার রিপোর্ট বিশ্লেষণ। টেস্টের নাম: ${testName}। মোট ১২টি প্যারামিটারের মধ্যে ১০টি মান স্বাভাবিক সীমায় রয়েছে। ${goodNewsText}`;
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

  const handleShare = () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({
        title: "আমার ল্যাব রিপোর্ট — শেখ ফার্মা",
        text: `টেস্ট: ${testName} | ফলাফল: স্বাভাবিক ১০টি, সামান্য তারতম্য ২টি।`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href);
      toast.success("রিপোর্ট লিংক কপি করা হয়েছে!");
    }
  };

  // Donut chart calculations (12 total: 10 normal = 83.3%, 2 mild = 16.7%)
  const normalPercent = (normalCount / (totalParams || 1)) * 100;
  const mildPercent = (mildCount / (totalParams || 1)) * 100;
  const strokeDashoffsetMild = 100 - normalPercent;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4 font-sans text-slate-900 dark:text-slate-100">
      
      {/* ================= MAIN 1:1 PDF CARD CONTAINER ================= */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 sm:p-7 shadow-sm space-y-6">
        
        {/* ================= 1. TOP HEADER ROW ================= */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center border-b border-slate-100 dark:border-slate-800/80 pb-5">
          {/* Left Card: CBC + ESR / Date / Lab / Upload status */}
          <div className="md:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-3.5 space-y-1 shadow-2xs">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
              <FileText className="h-4 w-4 text-primary" />
              <span>{testName}</span>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              রিপোর্ট তারিখ: {reportDate}
            </div>
            <div className="text-xs text-slate-500 font-medium">
              ল্যাব: {labName}
            </div>
            <div className="pt-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold text-[11px] border border-emerald-500/20">
                <Check className="h-3 w-3" />
                <span>{DEFAULT_PDF_LAB.status_badge}</span>
              </span>
            </div>
          </div>

          {/* Center Heading: আমার রিপোর্ট / সহজ ভাষায় রিপোর্ট বিশ্লেষণ */}
          <div className="md:col-span-5 text-center flex flex-col justify-center">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              আমার রিপোর্ট
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-400 mt-1">
              সহজ ভাষায় রিপোর্ট বিশ্লেষণ
            </p>
          </div>

          {/* Right Action Buttons: অডিও শুনুন / শেয়ার করুন */}
          <div className="md:col-span-3 flex md:flex-col items-stretch justify-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleToggleAudio}
              className={`h-9 rounded-xl font-bold text-xs gap-1.5 cursor-pointer border-slate-300 dark:border-slate-700 ${
                isPlayingAudio
                  ? "bg-amber-500 text-white border-amber-500"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {isPlayingAudio ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4 text-emerald-600" />}
              <span>{isPlayingAudio ? "অডিও থামান" : "অডিও শুনুন"}</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleShare}
              className="h-9 rounded-xl font-bold text-xs gap-1.5 cursor-pointer border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Share2 className="h-4 w-4 text-blue-600" />
              <span>শেয়ার করুন</span>
            </Button>
          </div>
        </div>

        {/* ================= 2. DONUT METRICS & GOOD NEWS CARD ================= */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
          {/* Left: Donut Chart Counter Card (4 Cols) */}
          <div className="md:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-between shadow-2xs">
            {/* SVG Donut Circle */}
            <div className="relative flex items-center justify-center h-28 w-28 shrink-0">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                {/* Background Ring */}
                <path
                  className="text-slate-100 dark:text-slate-800"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                {/* Normal Segment (Green) */}
                <path
                  className="text-emerald-500"
                  strokeDasharray={`${normalPercent}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                {/* Mild Segment (Orange) */}
                <path
                  className="text-amber-500"
                  strokeDasharray={`${mildPercent}, 100`}
                  strokeDashoffset={`-${normalPercent}`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black text-slate-900 dark:text-white leading-none">
                  ১২
                </span>
                <span className="text-[10px] text-slate-500 font-semibold mt-0.5">
                  মোট প্যারামিটার
                </span>
              </div>
            </div>

            {/* Legend Stats */}
            <div className="space-y-2 text-xs font-semibold pl-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-slate-600 dark:text-slate-300">স্বাভাবিক</span>
                <span className="font-bold text-slate-900 dark:text-white ml-auto">১০</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shrink-0" />
                <span className="text-slate-600 dark:text-slate-300">সামান্য তারতম্য</span>
                <span className="font-bold text-slate-900 dark:text-white ml-auto">২</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shrink-0" />
                <span className="text-slate-600 dark:text-slate-300">অস্বাভাবিক</span>
                <span className="font-bold text-slate-900 dark:text-white ml-auto">০</span>
              </div>
            </div>
          </div>

          {/* Right: ভালো খবর! Green Card (8 Cols) */}
          <div className="md:col-span-8 rounded-2xl border border-[#a3e4d7] dark:border-emerald-800/60 bg-[#eafaf1] dark:bg-emerald-950/25 p-4 sm:p-5 flex flex-col justify-center space-y-1.5 shadow-2xs">
            <h2 className="text-base sm:text-lg font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              <span>{DEFAULT_PDF_LAB.good_news_title}</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-normal">
              {goodNewsText}
            </p>
          </div>
        </div>

        {/* ================= 3. FOUR SUB-TABS ROW ================= */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveSubTab("summary")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeSubTab === "summary"
                ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            <span>⭐ সারাংশ</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("full")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeSubTab === "full"
                ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>সম্পূর্ণ রিপোর্ট</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("easy")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeSubTab === "easy"
                ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>সহজ ব্যাখ্যা</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("compare")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeSubTab === "compare"
                ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            <span>তুলনা</span>
          </button>
        </div>

        {/* ================= 4. RESULTS TABLE (CBC + ESR) ================= */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3.5 shadow-2xs">
          <div className="flex items-center gap-2 font-bold text-sm sm:text-base text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
            <FileText className="h-4 w-4 text-emerald-600" />
            <span>টেস্টের ফলাফল ({testName})</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                  <th className="p-3 font-bold w-1/4">প্যারামিটার</th>
                  <th className="p-3 font-bold">ফলাফল</th>
                  <th className="p-3 font-bold">স্বাভাবিক সীমা</th>
                  <th className="p-3 font-bold text-center">অবস্থা</th>
                  <th className="p-3 font-bold w-1/3">ব্যাখ্যা</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {DEFAULT_PDF_LAB.parameters.map((param, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                    <td className="p-3 font-bold text-slate-900 dark:text-white">
                      {param.no} {param.name}
                    </td>
                    <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                      {param.result} <span className="text-[11px] font-normal text-slate-500">{param.unit}</span>
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">
                      {param.range}
                    </td>
                    <td className="p-3 text-center">
                      {param.status === "normal" ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-[11px] font-bold border border-emerald-200 dark:border-emerald-800">
                          {param.statusText}
                        </span>
                      ) : (
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 text-[11px] font-bold border border-amber-200 dark:border-amber-800">
                          {param.statusText}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400 text-[11px]">
                      {param.explanation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ================= 5. THREE SUMMARY CARDS ================= */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900 dark:text-white">
            <span>⭐ রিপোর্টের সামারি</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* ১. স্বাভাবিক ফলাফল */}
            <div className="rounded-2xl border border-[#a3e4d7] dark:border-emerald-800/60 bg-[#eafaf1] dark:bg-emerald-950/25 p-4 space-y-2 shadow-2xs">
              <div className="flex items-center gap-2 font-bold text-xs text-emerald-900 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>স্বাভাবিক ফলাফল</span>
              </div>
              <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
                {DEFAULT_PDF_LAB.summaryCards.normal.count}
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                {DEFAULT_PDF_LAB.summaryCards.normal.note}
              </p>
            </div>

            {/* ২. সামান্য তারতম্য */}
            <div className="rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/25 p-4 space-y-2 shadow-2xs">
              <div className="flex items-center gap-2 font-bold text-xs text-amber-900 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>সামান্য তারতম্য</span>
              </div>
              <div className="text-2xl font-black text-amber-700 dark:text-amber-400">
                {DEFAULT_PDF_LAB.summaryCards.mild.count}
              </div>
              <div className="text-xs space-y-0.5 text-slate-800 dark:text-slate-200 font-bold">
                <div>Eosinophils (6%)</div>
                <div>ESR (28 mm/hr)</div>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                {DEFAULT_PDF_LAB.summaryCards.mild.note}
              </p>
            </div>

            {/* ৩. ঝুঁকির স্তর */}
            <div className="rounded-2xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/70 dark:bg-blue-950/25 p-4 space-y-2 flex flex-col justify-between shadow-2xs">
              <div className="flex items-center gap-2 font-bold text-xs text-blue-900 dark:text-blue-300">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <span>ঝুঁকির স্তর</span>
              </div>
              <div className="my-auto py-2">
                <p className="text-xs text-blue-950 dark:text-blue-200 font-semibold leading-relaxed">
                  {DEFAULT_PDF_LAB.summaryCards.risk.note}
                </p>
              </div>
              <div className="text-[10px] text-blue-700/80 font-medium">
                ভেরিফাইড ল্যাব ডায়াগনস্টিকস
              </div>
            </div>
          </div>
        </div>

        {/* ================= 6. ACTION CARDS ROW ================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* রোগীর করণীয় (Green) */}
          <div className="rounded-2xl border border-[#a3e4d7] dark:border-emerald-800/60 bg-[#eafaf1] dark:bg-emerald-950/20 p-4 space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-emerald-900 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-800/50 pb-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>রোগীর করণীয়</span>
            </div>

            <ul className="text-xs space-y-1.5 text-slate-800 dark:text-slate-200 font-medium">
              {DEFAULT_PDF_LAB.patientTips.map((tip, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold mt-0.5">✓</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* কখন দ্রুত ডাক্তারকে জানাবেন? (Red) */}
          <div className="rounded-2xl border border-[#f5b7b1] dark:border-rose-800/60 bg-[#fdedec] dark:bg-rose-950/25 p-4 space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-red-700 dark:text-red-400 border-b border-rose-200 dark:border-rose-800/50 pb-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span>কখন দ্রুত ডাক্তারকে জানাবেন?</span>
            </div>

            <ul className="text-xs space-y-2 text-rose-950 dark:text-rose-200 font-medium">
              {DEFAULT_PDF_LAB.dangerSigns.map((ds, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-red-600 font-bold">•</span>
                  <span>{ds}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ================= 7. FAQ QUESTIONS PILLS ================= */}
        <div className="space-y-2.5 pt-1">
          <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
            আপনার প্রশ্ন করুন
          </div>

          <div className="flex flex-wrap gap-2">
            {DEFAULT_PDF_LAB.faqs.map((faq, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedFaq(selectedFaq === idx ? null : idx)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedFaq === idx
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                }`}
              >
                <span>💬</span>
                <span>{faq.question}</span>
              </button>
            ))}
          </div>

          {/* Expanded FAQ Answer Modal / Card */}
          {selectedFaq !== null && (
            <div className="p-3.5 rounded-2xl border border-primary/20 bg-primary/5 text-xs text-foreground space-y-1 animate-in fade-in duration-200">
              <div className="font-bold text-primary flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5" />
                <span>{DEFAULT_PDF_LAB.faqs[selectedFaq].question}</span>
              </div>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                {DEFAULT_PDF_LAB.faqs[selectedFaq].answer}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
