import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { SHEIKH_PHARMA_DETAILS } from "@/lib/sheikh-pharma-letterhead";
import { SHEIKH_PHARMA_LOGO_BASE64 } from "@/lib/sheikh-pharma-logo.base64";

import {
  Stethoscope,
  FileText,
  Users,
  Printer,
  ClipboardList,
  ShieldCheck,
  ArrowRight,
  Phone,
  CheckCircle2,
  ShoppingCart,
  ChevronRight,
  Activity,
  Download,
  UserCheck,
  HeartHandshake,
  QrCode,
  Sparkles,
  Clock,
  Layers,
} from "lucide-react";

export const Route = createFileRoute("/rx")({
  head: () => ({
    meta: [
      { title: "শেখ ফার্মা আরএক্স — ডাক্তারদের স্মার্ট চেম্বার ও প্রেসক্রিপশন সফটওয়্যার | Sheikh Pharma Rx" },
      {
        name: "description",
        content:
          "৩০ সেকেন্ডে ডিজিটাল প্রেসক্রিপশন তৈরি, চেম্বার কিউ ও টোকেন প্রিন্টিং, নিজস্ব ড্রাগ ও ইনভেস্টিগেশন প্রিসেট এবং A4 ও থার্মাল স্লিপ প্রিন্টিং — শেখ ফার্মা আরএক্স।",
      },
      { property: "og:title", content: "শেখ ফার্মা আরএক্স — আধুনিক প্রেসক্রিপশন ও চেম্বার সফটওয়্যার" },
      {
        property: "og:description",
        content:
          "ডাক্তারদের জন্য তৈরি স্মার্ট প্রেসক্রিপশন প্যাড: রোগী সিরিয়াল, টোকেন প্রিন্ট, ড্রাগ প্রিসেট ও A4/JPG/PDF প্রিন্টিং।",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RxLanding,
});

const SPECIALTY_TABS = [
  {
    id: "medicine",
    label: "মেডিসিন ও ডায়াবেটিস",
    doctor: "ডাঃ মোহাম্মদ আরিফুল ইসলাম",
    degree: "MBBS, BCS (Health), FCPS (Medicine)",
    designation: "কনসালটেন্ট (মেডিসিন ও ডায়াবেটিস) · BMDC: A-48219",
    patient: { name: "মোঃ আব্দুল করিম", age: "৪৮ বছর / পুরুষ", bp: "130/85 mmHg", pulse: "76 bpm", weight: "68 kg", pid: "PID-10482" },
    complaints: ["জ্বর ও শরীর ব্যথা (৪ দিন)", "খাবারে অরুচি ও দুর্বলতা", "ডায়াবেটিস ফলোআপ"],
    investigations: ["CBC with ESR", "FBS & 2h ABF", "Serum Creatinine", "Lipid Profile"],
    drugs: [
      { name: "Tab. Napa Extend 665mg", dose: "১ + ১ + ১ (ভরা পেটে)", duration: "৫ দিন" },
      { name: "Tab. Comet XR 500mg", dose: "০ + ০ + ১ (রাতের খাবারের পর)", duration: "চলবে" },
      { name: "Cap. Maxpro 20mg", dose: "১ + ০ + ১ (খাবারের ৩০ মি. আগে)", duration: "১৪ দিন" },
      { name: "Tab. Neuro-B", dose: "০ + ১ + ০ (দুপুরে খাবারের পর)", duration: "৩০ দিন" },
    ],
    advice: "মিষ্টি ও শর্করা জাতীয় খাবার পরিহার করুন। প্রতিদিন ৩০ মিনিট হাঁটুন।",
  },
  {
    id: "peds",
    label: "শিশু ও নবজাতক",
    doctor: "ডাঃ ফারজানা রহমান",
    degree: "MBBS, DCH, MD (Pediatrics)",
    designation: "শিশু ও নবজাতক রোগ বিশেষজ্ঞ · BMDC: A-53910",
    patient: { name: "আয়াত ইসলাম (শিশু)", age: "৩ বছর ৬ মাস", bp: "N/A", pulse: "98 bpm", weight: "14.5 kg", pid: "PID-10941" },
    complaints: ["সর্দি-কাশি ও শ্বাসকষ্ট (২ দিন)", "হালকা জ্বর (100.4°F)", "রাতের বেলা কাশি বাড়ে"],
    investigations: ["CBC", "Chest X-Ray P/A View"],
    drugs: [
      { name: "Syp. Ace 120mg/5ml", dose: "১.৫ চামচ (৭.৫ মিলি) — জ্বর হলে ৬ ঘণ্টা পরপর", duration: "৩ দিন" },
      { name: "Syp. Monas 4mg", dose: "১ চামচ করে শুধুমাত্র রাতে", duration: "১৪ দিন" },
      { name: "Nasal Drop Antazol 0.05%", dose: "২ ফোঁটা করে উভয় নাকে দিনে ৩ বার", duration: "৫ দিন" },
    ],
    advice: "শিশুকে ঠান্ডা বাতাস ও ধুলাবালি থেকে দূরে রাখুন। কুসুম গরম পানি পান করান।",
  },
  {
    id: "gynae",
    label: "গাইনী ও প্রসূতি",
    doctor: "ডাঃ নুসরাত জাহান চৌধুরী",
    degree: "MBBS, FCPS (Obs & Gynae)",
    designation: "গাইনী, প্রসূতি ও বন্ধ্যাত্ব বিশেষজ্ঞ · BMDC: A-39104",
    patient: { name: "শারমিন আক্তার", age: "২৬ বছর / মহিলা", bp: "110/70 mmHg", pulse: "80 bpm", weight: "57 kg", pid: "PID-11028" },
    complaints: ["নিয়মিত গর্ভকালীন চেকআপ (24 Weeks)", "হালকা কোমর ব্যথা ও দুর্বলতা"],
    investigations: ["USG of Pregnancy Profile", "Hb% & Blood Grouping", "Urine R/M/E"],
    drugs: [
      { name: "Cap. Conceive Plus / Korion Iron", dose: "০ + ০ + ১ (রাতে খাবারের পর)", duration: "৩০ দিন" },
      { name: "Tab. Ostocal D 500mg", dose: "০ + ১ + ০ (দুপুরে খাবারের পর)", duration: "৩০ দিন" },
      { name: "Tab.Becoral DX", dose: "১ + ০ + ০ (সকালে নাস্তার পর)", duration: "৩০ দিন" },
    ],
    advice: "ভারী কাজ নিষেধ। প্রচুর সবুজ শাক-সবজি, দুধ ও ডিম খাবেন। বাম কাত হয়ে শোবেন।",
  },
] as const;

function RxLanding() {
  const [selectedTab, setSelectedTab] = useState<(typeof SPECIALTY_TABS)[number]["id"]>("medicine");
  const activeMock = SPECIALTY_TABS.find((s) => s.id === selectedTab) ?? SPECIALTY_TABS[0];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 selection:bg-teal-600 selection:text-white relative overflow-x-hidden font-sans">
      {/* Subtle Clean Background Wash */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-gradient-to-b from-teal-50/90 via-emerald-50/30 to-transparent" />

      {/* ================= 1. COMPACT ECOSYSTEM TOP BAR ================= */}
      <div className="border-b border-slate-200/80 bg-white/95 text-xs backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2 sm:px-6">
          {/* Ecosystem Switcher */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <span className="hidden md:inline text-slate-500 font-medium">শেখ ফার্মা ইকোসিস্টেম:</span>
            <div className="inline-flex items-center rounded-full bg-slate-100 p-0.5 border border-slate-200/80 text-[11px] font-semibold">
              <Link
                to="/"
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-white transition whitespace-nowrap"
              >
                <ShoppingCart className="h-3 w-3 text-emerald-600 shrink-0" />
                <span>পিওএস <span className="hidden xs:inline">(Sell)</span></span>
              </Link>
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-700 px-2.5 py-1 text-white font-semibold shadow-xs whitespace-nowrap">
                <Stethoscope className="h-3 w-3 shrink-0" />
                <span>ডাক্তার <span className="hidden xs:inline">(Rx)</span></span>
              </span>
              <Link
                to="/patient"
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-white transition whitespace-nowrap"
              >
                <Users className="h-3 w-3 text-sky-600 shrink-0" />
                <span>রোগী সেবা <span className="hidden xs:inline">(Pt)</span></span>
              </Link>
            </div>
          </div>

          {/* Quick Helpline */}
          <a
            href={`tel:${SHEIKH_PHARMA_DETAILS.phonesRaw[0]}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-200/70 px-2.5 py-1 text-slate-700 hover:bg-teal-100/70 transition whitespace-nowrap"
          >
            <Phone className="h-3 w-3 text-teal-700 shrink-0" />
            <span className="hidden sm:inline text-slate-500">চেম্বার সাপোর্ট:</span>
            <span className="font-bold text-teal-900">{SHEIKH_PHARMA_DETAILS.phonesRaw[0]}</span>
          </a>
        </div>
      </div>

      {/* ================= 2. MAIN NAVIGATION HEADER ================= */}
      <header className="relative z-40 border-b border-slate-200/60 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-teal-200 bg-white p-1 shadow-xs">
              <img
                src={SHEIKH_PHARMA_LOGO_BASE64}
                alt="Sheikh Pharma Logo"
                className="h-full w-full object-contain rounded-lg"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 truncate">
                  শেখ ফার্মা <span className="text-teal-700">Rx</span>
                </span>
                <span className="hidden xs:inline-flex items-center rounded-md bg-teal-50 border border-teal-200 px-1.5 py-0.5 text-[10px] font-semibold text-teal-800 whitespace-nowrap">
                  DOCTOR CHAMBER
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                ডিজিটাল প্রেসক্রিপশন ও চেম্বার ম্যানেজমেন্ট সিস্টেম
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 lg:flex">
            <a href="#rx-preview" className="hover:text-teal-700 transition">লাইভ প্রেসক্রিপশন প্যাড</a>
            <a href="#workflow" className="hover:text-teal-700 transition">চেম্বার ওয়ার্কফ্লো</a>
            <a href="#features" className="hover:text-teal-700 transition">বিশেষ সুবিধাসমূহ</a>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/auth"
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all duration-150 active:scale-95 whitespace-nowrap"
            >
              <span>ডাক্তার লগইন</span>
              <ArrowRight className="h-4 w-4 shrink-0" />
            </Link>
          </div>
        </div>
      </header>

      {/* ================= 3. HERO SECTION (SPLIT DESKTOP + CLEAN MOBILE) ================= */}
      <section className="relative mx-auto max-w-7xl px-4 pt-8 pb-12 sm:px-6 lg:pt-14 lg:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* Left Column: Clear Clinical Value Proposition */}
          <div className="lg:col-span-5 space-y-5 text-left pt-2">
            <div className="inline-flex items-center gap-2 rounded-lg bg-teal-50 border border-teal-200/80 px-3 py-1.5 text-xs font-semibold text-teal-800">
              <Stethoscope className="h-3.5 w-3.5 text-teal-700" />
              <span>বিএমডিসি রেজিস্টার্ড ডাক্তার ও চেম্বার স্যুট</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-bold leading-[1.22] tracking-tight text-slate-900">
              রোগীর ভিড়ে চেম্বারের সময় বাঁচান, তৈরি করুন{" "}
              <span className="text-teal-700 underline decoration-teal-300/80 decoration-wavy underline-offset-4">
                নির্ভুল ডিজিটাল প্রেসক্রিপশন
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
              টাইপ করার ঝামেলা ছাড়াই ক্লিক করেই ওষুধের ডোজ, খাবারের নিয়ম, লক্ষণ ও টেস্ট যুক্ত করুন। প্রিন্ট করুন{" "}
              <strong className="font-semibold text-slate-800">সিঙ্গেল-পেজ A4 প্যাডে</strong> অথবা সরাসরি পাঠান রোগীর মোবাইলে।
            </p>

            {/* Primary & Secondary CTAs — Clean, well-proportioned */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Link
                to="/auth"
                className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 px-6 py-3.5 text-base font-semibold text-white shadow-md shadow-teal-900/10 transition-all hover:shadow-lg active:scale-[0.99]"
              >
                <FileText className="h-5 w-5 shrink-0" />
                <span>প্রেসক্রিপশন প্যাডে প্রবেশ করুন</span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </Link>
              <Link
                to="/patient"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-700 transition"
              >
                <Users className="h-4 w-4 text-teal-700 shrink-0" />
                <span>রোগী সিরিয়াল ও পোর্টাল</span>
              </Link>
            </div>

            {/* Key Clinical Highlights */}
            <div className="pt-4 border-t border-slate-200/80 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-white p-3 border border-slate-200/80 shadow-2xs">
                <div className="text-lg sm:text-xl font-bold text-teal-700">৩০ সেকেন্ড</div>
                <div className="text-[11px] text-slate-500 mt-0.5">গড় প্রেসক্রিপশন সময়</div>
              </div>
              <div className="rounded-xl bg-white p-3 border border-slate-200/80 shadow-2xs">
                <div className="text-lg sm:text-xl font-bold text-slate-900">A4 + JPG</div>
                <div className="text-[11px] text-slate-500 mt-0.5">১ পাতায় প্রিন্ট ও ডাউনলোড</div>
              </div>
              <div className="rounded-xl bg-white p-3 border border-slate-200/80 shadow-2xs">
                <div className="text-lg sm:text-xl font-bold text-emerald-700">PID লগইন</div>
                <div className="text-[11px] text-slate-500 mt-0.5">রোগীর অনলাইন রেকর্ড</div>
              </div>
            </div>
          </div>

          {/* Right Column: REALISTIC WHITE A4 PRESCRIPTION PAD PREVIEW */}
          <div id="rx-preview" className="lg:col-span-7">
            {/* Specialty Selector Tabs above Pad */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-teal-600" />
                ডেমো প্রেসক্রিপশন প্রিভিউ (বিভাগ পরিবর্তন করে দেখুন):
              </span>
              <div className="inline-flex rounded-xl bg-slate-200/80 p-1 text-xs font-semibold">
                {SPECIALTY_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedTab(tab.id)}
                    className={`rounded-lg px-3 py-1.5 transition cursor-pointer ${
                      selectedTab === tab.id
                        ? "bg-white text-teal-800 shadow-xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Paper Prescription Sheet Container */}
            <div className="rounded-2xl border border-slate-300/90 bg-white shadow-xl shadow-slate-900/5 overflow-hidden">
              {/* Top Utility Bar */}
              <div className="bg-slate-900 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-teal-500/20 border border-teal-400/30 px-2 py-0.5 text-[11px] font-medium text-teal-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
                    লাইভ চেম্বার কিউ: ৪ জন অপেক্ষমাণ
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-300">
                  <span className="rounded bg-white/10 px-2 py-0.5">A4 Single-Page</span>
                  <span className="rounded bg-white/10 px-2 py-0.5">PDF / JPG</span>
                </div>
              </div>

              {/* Doctor Letterhead Header */}
              <div className="border-b-2 border-teal-700 bg-gradient-to-r from-teal-50/60 via-white to-emerald-50/40 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-teal-950">{activeMock.doctor}</h3>
                  <p className="text-xs font-semibold text-teal-700 mt-0.5">{activeMock.degree}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{activeMock.designation}</p>
                </div>
                <div className="sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200/70">
                  <div className="flex sm:justify-end items-center gap-1.5">
                    <img
                      src={SHEIKH_PHARMA_LOGO_BASE64}
                      alt="Sheikh Pharma"
                      className="h-5 w-5 rounded-full object-contain border border-teal-200"
                    />
                    <span className="text-sm font-bold text-slate-900">শেখ ফার্মা কনসালটেশন চেম্বার</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">দোকান ১৩, আরব প্যারাডাইস মার্কেট, মুক্তাগাছা</p>
                  <p className="text-[11px] font-semibold text-teal-800 mt-0.5">
                    সিরিয়াল: {SHEIKH_PHARMA_DETAILS.phonesRaw[0]}
                  </p>
                </div>
              </div>

              {/* Patient Info Bar */}
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">রোগীর নাম:</span>{" "}
                  <strong className="text-slate-900">{activeMock.patient.name}</strong>
                </div>
                <div>
                  <span className="text-slate-500">বয়স:</span>{" "}
                  <strong className="text-slate-800">{activeMock.patient.age}</strong>
                </div>
                <div>
                  <span className="text-slate-500">ওজন/BP:</span>{" "}
                  <strong className="text-slate-800">{activeMock.patient.weight} · {activeMock.patient.bp}</strong>
                </div>
                <div className="sm:text-right">
                  <span className="inline-flex items-center rounded bg-teal-100/80 px-2 py-0.5 font-mono text-[11px] font-bold text-teal-900">
                    {activeMock.patient.pid}
                  </span>
                </div>
              </div>

              {/* Main 2-Column Prescription Body */}
              <div className="grid grid-cols-1 md:grid-cols-12 min-h-[310px]">
                {/* Left Column: Clinical Notes */}
                <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50/40 p-4 space-y-4 text-xs">
                  <div>
                    <div className="font-bold text-teal-900 uppercase tracking-wider text-[11px] mb-1.5 border-b border-slate-200 pb-1">
                      C/C (রোগের বিবরণ)
                    </div>
                    <ul className="space-y-1 text-slate-700 font-normal list-disc list-inside">
                      {activeMock.complaints.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <div className="font-bold text-teal-900 uppercase tracking-wider text-[11px] mb-1.5 border-b border-slate-200 pb-1">
                      O/E (ভাইটাল সাইন)
                    </div>
                    <div className="space-y-1 text-slate-700 font-normal">
                      <div>BP: <strong className="text-slate-900">{activeMock.patient.bp}</strong></div>
                      <div>Pulse: <strong className="text-slate-900">{activeMock.patient.pulse}</strong></div>
                      <div>Weight: <strong className="text-slate-900">{activeMock.patient.weight}</strong></div>
                    </div>
                  </div>

                  <div>
                    <div className="font-bold text-teal-900 uppercase tracking-wider text-[11px] mb-1.5 border-b border-slate-200 pb-1">
                      Investigations (পরীক্ষা)
                    </div>
                    <ul className="space-y-1 text-slate-700 font-normal list-disc list-inside">
                      {activeMock.investigations.map((inv, i) => (
                        <li key={i}>{inv}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Right Column: Rx Medications */}
                <div className="md:col-span-8 p-5 flex flex-col justify-between bg-white">
                  <div>
                    {/* Classic Rx Symbol */}
                    <div className="text-2xl font-serif font-bold text-teal-800 mb-3 select-none">
                      ℞
                    </div>

                    {/* Medicine List */}
                    <div className="space-y-3">
                      {activeMock.drugs.map((drug, idx) => (
                        <div key={idx} className="border-b border-slate-100 pb-2.5 last:border-b-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-bold text-slate-900 text-sm">
                              {idx + 1}. {drug.name}
                            </span>
                            <span className="text-xs font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded shrink-0">
                              {drug.duration}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 mt-1 pl-4 font-normal">
                            • {drug.dose}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Advice & Signature Row */}
                  <div className="mt-5 pt-3 border-t border-slate-200 space-y-3">
                    <div className="rounded-lg bg-amber-50/70 border border-amber-200/70 px-3 py-2 text-xs text-slate-700 font-normal">
                      <strong className="font-bold text-slate-900">পরামর্শ:</strong> {activeMock.advice}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <div>
                        পোর্টাল লগইন: <strong className="text-teal-800">pt.sheikhpharma.shop</strong> ({activeMock.patient.pid})
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-slate-800 border-t border-slate-400 pt-0.5 px-2">
                          চিকিৎসকের স্বাক্ষর
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 4. CHAMBER WORKFLOW (3 SIMPLE STEPS) ================= */}
      <section id="workflow" className="bg-white border-y border-slate-200/80 py-14 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
              সহজ ৩ ধাপে চেম্বার পরিচালনা
            </span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900">
              সিরিয়াল এন্ট্রি থেকে প্রেসক্রিপশন প্রিন্ট — সম্পূর্ণ অটোমেটেড
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-6 relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-700 text-white font-bold text-base shadow-sm">
                  ১
                </div>
                <span className="text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-full">
                  রিসেপশন / অনলাইন
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">রোগীর সিরিয়াল ও টোকেন</h3>
              <p className="mt-2 text-sm text-slate-600 font-normal leading-relaxed">
                সহকারী রোগীর নাম, বয়স ও মোবাইল নম্বর এন্ট্রি দিলেই সিরিয়াল টোকেন প্রিন্ট হবে এবং ডাক্তারের স্ক্রিনে লাইভ কিউতে যুক্ত হবে।
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-6 relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-700 text-white font-bold text-base shadow-sm">
                  ২
                </div>
                <span className="text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-full">
                  ডাক্তার চেম্বার
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">১-ক্লিকে স্মার্ট প্রেসক্রিপশন</h3>
              <p className="mt-2 text-sm text-slate-600 font-normal leading-relaxed">
                নিজস্ব প্রিসেট ও অটো-সাজেশন থেকে ওষুধ, ডোজ (১+০+১), টেস্ট ও পরামর্শ সিলেক্ট করুন। মাত্র ৩০ সেকেন্ডে প্রেসক্রিপশন প্রস্তুত।
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-6 relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-700 text-white font-bold text-base shadow-sm">
                  ৩
                </div>
                <span className="text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-full">
                  প্রিন্ট ও পেশেন্ট পোর্টাল
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">A4 প্রিন্ট, PDF/JPG ও পোর্টাল</h3>
              <p className="mt-2 text-sm text-slate-600 font-normal leading-relaxed">
                ১ পাতায় ঝকঝকে A4 প্রিন্ট করুন অথবা PDF/JPG ডাউনলোড করুন। রোগী পরবর্তীতে PID দিয়ে অনলাইনে প্রেসক্রিপশন দেখতে পারবেন।
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 5. CORE DOCTOR CHAMBER FEATURES ================= */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
            ডাক্তারদের জন্য বিশেষায়িত
          </span>
          <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900">
            চেম্বারের প্রতিটি প্রয়োজন এখন একটি আধুনিক সফটওয়্যারে
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs hover:border-teal-300 transition">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700 mb-4 border border-teal-200/60">
              <FileText className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">অটো ডোজ ও ওষুধের ডাটাবেজ</h3>
            <p className="mt-1.5 text-sm text-slate-600 font-normal leading-relaxed">
              ওষুধের নামের কয়েক অক্ষর লিখলেই ব্র্যান্ড ও জেনেরিক নাম চলে আসে। ডোজ ও দিন সিলেক্ট করলে মোট পরিমাণ স্বয়ংক্রিয়ভাবে হিসাব হয়।
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs hover:border-teal-300 transition">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 mb-4 border border-emerald-200/60">
              <ClipboardList className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">কাস্টম প্রিসেট ও টেমপ্লেট</h3>
            <p className="mt-1.5 text-sm text-slate-600 font-normal leading-relaxed">
              আপনার নিয়মিত ব্যবহৃত C/C, ইনভেস্টিগেশন এবং বাংলা উপদেশগুলো সেভ করে রাখুন। বারবার টাইপ করার প্রয়োজন নেই।
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs hover:border-teal-300 transition">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700 mb-4 border border-sky-200/60">
              <Printer className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">সিঙ্গেল-পেজ A4 ও নিজস্ব প্যাড মোড</h3>
            <p className="mt-1.5 text-sm text-slate-600 font-normal leading-relaxed">
              ডিজিটাল লেটারহেডে প্রিন্ট করুন অথবা আপনার ছাপানো প্যাডের ওপরের অংশ খালি রেখে প্রিন্ট করার টপ-মার্জিন অপশন ব্যবহার করুন।
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs hover:border-teal-300 transition">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 mb-4 border border-amber-200/60">
              <Download className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">PDF ও JPG ডাউনলোড (রোগীর নামে)</h3>
            <p className="mt-1.5 text-sm text-slate-600 font-normal leading-relaxed">
              হোয়াটসঅ্যাপ বা ইমেইলে পাঠানোর জন্য এক ক্লিকেই রোগীর নাম ও PID সহ হাই-রেজোলিউশন PDF এবং JPG ছবি ডাউনলোড করুন।
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs hover:border-teal-300 transition">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700 mb-4 border border-purple-200/60">
              <Activity className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">পূর্ববর্তী প্রেসক্রিপশন ও হিস্ট্রি</h3>
            <p className="mt-1.5 text-sm text-slate-600 font-normal leading-relaxed">
              রোগীর মোবাইল নম্বর বা PID দিয়ে সার্চ করলেই আগের ভিজিটের প্রেসক্রিপশন, ওষুধ ও রিপোর্ট সাথে সাথে সামনে চলে আসে।
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs hover:border-teal-300 transition">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700 mb-4 border border-teal-200/60">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">সম্পূর্ণ ব্যক্তিগত ও সুরক্ষিত ডাটা</h3>
            <p className="mt-1.5 text-sm text-slate-600 font-normal leading-relaxed">
              প্রতিটি ডাক্তারের নিজস্ব প্রোফাইল, ডিগ্রি, পদবি এবং রোগীদের রেকর্ড শতভাগ আলাদা ও ক্লাউডে এনক্রিপ্টেড থাকে।
            </p>
          </div>
        </div>
      </section>

      {/* ================= 6. CLEAN BOTTOM CTA ================= */}
      <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        <div className="rounded-3xl bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-800 p-8 sm:p-12 text-center text-white shadow-xl">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            আপনার চেম্বারের প্রেসক্রিপশন লেখা শুরু করুন এখনই
          </h2>
          <p className="mx-auto mt-2.5 max-w-xl text-sm sm:text-base text-teal-100 font-normal">
            ডাক্তার অ্যাকাউন্টে সাইন ইন করুন অথবা নতুন চেম্বার সেটআপের জন্য আমাদের সাপোর্ট নম্বরে যোগাযোগ করুন।
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm sm:text-base font-bold text-teal-900 shadow-md transition hover:bg-teal-50"
            >
              <span>ডাক্তার সাইন ইন করুন</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href={`tel:${SHEIKH_PHARMA_DETAILS.phonesRaw[0]}`}
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3.5 text-sm sm:text-base font-semibold text-white hover:bg-white/20 transition"
            >
              <Phone className="h-4 w-4" />
              <span>হেল্পলাইন: {SHEIKH_PHARMA_DETAILS.phonesRaw[0]}</span>
            </a>
          </div>
        </div>
      </section>

      {/* ================= 7. FOOTER ================= */}
      <footer className="border-t border-slate-200 bg-white py-10 text-sm text-slate-600">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 border-b border-slate-100">
            <div className="md:col-span-6 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <img
                  src={SHEIKH_PHARMA_LOGO_BASE64}
                  alt="Sheikh Pharma Logo"
                  className="h-8 w-8 object-contain rounded-lg border border-slate-200 p-0.5"
                />
                <span className="text-base font-bold text-slate-900">
                  শেখ ফার্মা আরএক্স (Sheikh Pharma Rx)
                </span>
              </div>
              <p className="text-xs text-slate-500 max-w-md font-normal leading-relaxed">
                {SHEIKH_PHARMA_DETAILS.address}
              </p>
              <div className="text-xs text-slate-700 font-semibold">
                চেম্বার সাপোর্ট: {SHEIKH_PHARMA_DETAILS.phones}
              </div>
            </div>

            <div className="md:col-span-3 space-y-2">
              <div className="font-bold text-slate-900 text-xs uppercase tracking-wider">ইকোসিস্টেম পোর্টাল</div>
              <ul className="space-y-1.5 text-xs font-medium">
                <li>
                  <Link to="/" className="text-slate-600 hover:text-emerald-700 transition">
                    ফার্মেসি পিওএস (sell.sheikhpharma.shop)
                  </Link>
                </li>
                <li>
                  <Link to="/rx" className="text-teal-700 font-bold">
                    ডাক্তার প্রেসক্রিপশন (rx.sheikhpharma.shop)
                  </Link>
                </li>
                <li>
                  <Link to="/patient" className="text-slate-600 hover:text-sky-700 transition">
                    রোগী সেবা পোর্টাল (pt.sheikhpharma.shop)
                  </Link>
                </li>
              </ul>
            </div>

            <div className="md:col-span-3 space-y-2">
              <div className="font-bold text-slate-900 text-xs uppercase tracking-wider">দ্রুত লিংক</div>
              <ul className="space-y-1.5 text-xs font-medium">
                <li>
                  <Link to="/auth" className="text-slate-600 hover:text-teal-700 transition">
                    ডাক্তার ও সহকারী লগইন
                  </Link>
                </li>
                <li>
                  <Link to="/patient" className="text-slate-600 hover:text-teal-700 transition">
                    অনলাইন সিরিয়াল বুকিং
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400">
            <div>© {new Date().getFullYear()} শেখ ফার্মা আরএক্স · সর্বস্বত্ব সংরক্ষিত।</div>
            <div className="mt-1 sm:mt-0">Sheikh Pharma Digital Healthcare Ecosystem</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
