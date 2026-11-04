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
  Clock,
  Sparkles,
  Phone,
  CheckCircle2,
  ShoppingCart,
  CalendarDays,
  FileSpreadsheet,
  ChevronRight,
  Activity,
  Award,
  Download,
  Share2,
  Lock,
} from "lucide-react";

export const Route = createFileRoute("/rx")({
  head: () => ({
    meta: [
      { title: "শেখ ফার্মা আরএক্স — ডাক্তারদের জন্য স্মার্ট প্রেসক্রিপশন ও চেম্বার সফটওয়্যার | Sheikh Pharma Rx" },
      {
        name: "description",
        content:
          "৩০ সেকেন্ডে ডিজিটাল প্রেসক্রিপশন তৈরি, চেম্বার কিউ ও টোকেন প্রিন্টিং, নিজস্ব ড্রাগ ও ইনভেস্টিগেশন প্রিসেট এবং A4 ও থার্মাল স্লিপ প্রিন্টিং — শেখ ফার্মা আরএক্স।",
      },
      { property: "og:title", content: "শেখ ফার্মা আরএক্স — আধুনিক প্রেসক্রিপশন সফটওয়্যার" },
      {
        property: "og:description",
        content:
          "ডাক্তারদের জন্য তৈরি স্মার্ট প্রেসক্রিপশন প্যাড: রোগী সিরিয়াল, টোকেন প্রিন্ট, ড্রাগ প্রিসেট ও A4/58mm/80mm প্রিন্টিং।",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RxLanding,
});

function RxLanding() {
  const [activeSpecialty, setActiveSpecialty] = useState<"general" | "peds" | "gynae">("general");

  return (
    <div className="min-h-screen bg-[#031518] text-slate-100 selection:bg-teal-400 selection:text-slate-950 relative overflow-hidden font-sans">
      {/* Background Ambient Glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[1100px] rounded-full bg-teal-500/10 blur-[140px]" />
      <div className="pointer-events-none absolute top-[700px] -left-48 h-[550px] w-[550px] rounded-full bg-emerald-500/10 blur-[130px]" />
      <div className="pointer-events-none absolute top-[1300px] -right-48 h-[600px] w-[600px] rounded-full bg-cyan-500/10 blur-[150px]" />

      {/* ================= 1. TOP ECOSYSTEM BAR ================= */}
      <div className="border-b border-white/5 bg-[#031518]/90 text-xs backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 sm:px-6">
          {/* Ecosystem Switcher */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="hidden sm:inline text-slate-400 font-medium">শেখ ফার্মা ইকোসিস্টেম:</span>
            <div className="inline-flex rounded-full bg-white/5 p-0.5 border border-white/10 text-[11px] font-semibold">
              <Link
                to="/"
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-slate-300 hover:text-white hover:bg-white/10 transition"
              >
                <ShoppingCart className="h-3 w-3 text-emerald-400" />
                <span>পিওএস (Sell)</span>
              </Link>
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-400 px-2.5 py-0.5 text-slate-950 font-bold shadow-sm">
                <Stethoscope className="h-3 w-3" />
                <span>ডাক্তার (Rx)</span>
              </span>
              <Link
                to="/patient"
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-slate-300 hover:text-white hover:bg-white/10 transition"
              >
                <Users className="h-3 w-3 text-cyan-400" />
                <span>রোগী সেবা (Pt)</span>
              </Link>
            </div>
          </div>

          {/* Quick Helpline */}
          <div className="flex items-center gap-3">
            <a
              href={`tel:${SHEIKH_PHARMA_DETAILS.phonesRaw[0]}`}
              className="inline-flex items-center gap-1.5 text-slate-300 hover:text-teal-400 transition"
            >
              <Phone className="h-3.5 w-3.5 text-teal-400" />
              <span className="hidden xs:inline">ডাক্তার সাপোর্ট:</span>
              <span className="font-bold text-white">{SHEIKH_PHARMA_DETAILS.phonesRaw[0]}</span>
            </a>
          </div>
        </div>
      </div>

      {/* ================= 2. MAIN HEADER NAVIGATION ================= */}
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-teal-400/40 bg-white p-0.5 shadow-lg shadow-teal-500/10 transition hover:scale-105">
            <img
              src={SHEIKH_PHARMA_LOGO_BASE64}
              alt="Sheikh Pharma Logo"
              className="h-full w-full object-contain rounded-full"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                শেখ ফার্মা <span className="text-teal-400">Rx</span>
              </span>
              <span className="rounded-md border border-teal-500/30 bg-teal-500/10 px-1.5 py-0.5 text-[10px] font-bold text-teal-300">
                DOCTOR SUITE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              স্মার্ট চেম্বার ও ডিজিটাল প্রেসক্রিপশন প্ল্যাটফর্ম
            </p>
          </div>
        </div>

        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-300 md:flex">
          <a href="#features" className="hover:text-teal-400 transition">চেম্বার ফিচারসমূহ</a>
          <a href="#preview" className="hover:text-teal-400 transition">প্যাড প্রিভিউ</a>
          <a href="#formats" className="hover:text-teal-400 transition">প্রিন্টিং ফরম্যাট</a>
          <a href="#ecosystem" className="hover:text-teal-400 transition">ইকোসিস্টেম</a>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-400 to-emerald-400 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-teal-500/20 transition-all duration-200 hover:scale-[1.03] hover:shadow-teal-500/30 active:scale-95"
          >
            <span>ডাক্তার সাইন ইন</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* ================= 3. HERO SECTION ================= */}
      <section className="relative mx-auto max-w-7xl px-4 pt-10 pb-16 text-center sm:px-6 lg:pt-14 lg:pb-24">
        {/* Pill Tag */}
        <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-4 py-1.5 text-xs font-semibold text-teal-300 backdrop-blur-md shadow-sm">
          <Clock className="h-3.5 w-3.5 text-teal-400" />
          <span>৩০ সেকেন্ডেই নির্ভুল ডিজিটাল প্রেসক্রিপশন প্রস্তুত</span>
        </div>

        {/* Display Title */}
        <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-extrabold leading-[1.12] text-white sm:text-5xl md:text-6xl tracking-tight">
          আপনার চেম্বারকে করুন সম্পূর্ণ ডিজিটাল ও{" "}
          <span className="bg-gradient-to-r from-teal-300 via-emerald-300 to-cyan-300 bg-clip-text text-transparent">
            স্মার্ট প্রেসক্রিপশন সমৃদ্ধ
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mt-6 max-w-2xl text-base text-slate-300 sm:text-lg leading-relaxed">
          রোগীর ভিড়ে চেম্বারের সময় বাঁচান — ওষুধ সার্চ করলেই স্বয়ংক্রিয় ডোজ ও খাবারের নিয়ম, কাস্টম কমপ্লেন ও ইনভেস্টিগেশন প্রিসেট, সহকারী টোকেন প্রিন্টিং এবং A4 প্যাড ও থার্মাল স্লিপ।
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
          <Link
            to="/auth"
            className="inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-teal-400 to-emerald-400 px-7 py-3.5 text-base font-extrabold text-slate-950 shadow-xl shadow-teal-500/25 transition-all duration-200 hover:scale-[1.03] hover:shadow-teal-500/35 active:scale-95"
          >
            <FileText className="h-5 w-5" />
            <span>প্রেসক্রিপশন লেখা শুরু করুন</span>
          </Link>
          <Link
            to="/patient"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3.5 text-base font-semibold text-white backdrop-blur-md transition hover:bg-white/10 hover:border-white/30"
          >
            <Users className="h-4 w-4 text-cyan-400" />
            <span>রোগী সেবা পোর্টাল ও সিরিয়াল</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3.5 text-base font-semibold text-white backdrop-blur-md transition hover:bg-white/10 hover:border-white/30"
          >
            <ShoppingCart className="h-4 w-4 text-emerald-400" />
            <span>ফার্মেসি পিওএস কাউন্টার</span>
          </Link>
        </div>

        {/* ================= 4. INTERACTIVE DIGITAL RX PAD PREVIEW ================= */}
        <div id="preview" className="relative mx-auto mt-12 max-w-5xl rounded-2xl border border-teal-500/20 bg-slate-900/90 p-4 sm:p-6 shadow-2xl backdrop-blur-xl text-left">
          {/* Top Window Bar */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 rounded-full bg-rose-500/80" />
              <span className="flex h-3 w-3 rounded-full bg-amber-500/80" />
              <span className="flex h-3 w-3 rounded-full bg-emerald-500/80" />
              <span className="ml-2 font-mono text-xs text-slate-400">SHEIKH PHARMA SMART RX ENGINE</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-teal-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-teal-400 border border-teal-500/30 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
                লাইভ কিউ: রোগী ৪ জন অপেক্ষমাণ
              </span>
            </div>
          </div>

          {/* Rx Pad Canvas Visual Mockup */}
          <div className="rounded-xl border border-white/10 bg-slate-950 p-4 sm:p-6 space-y-4 shadow-inner">
            {/* Pad Doctor Letterhead Header */}
            <div className="flex flex-col sm:flex-row justify-between pb-3 border-b border-white/10 gap-2">
              <div>
                <h4 className="text-base sm:text-lg font-bold text-white">ডাঃ মোহাম্মদ আরিফুল ইসলাম</h4>
                <p className="text-xs text-teal-400">MBBS, BCS (Health), FCPS (Medicine)</p>
                <p className="text-[11px] text-slate-400">মেডিসিন ও ডায়াবেটিস বিশেষজ্ঞ · BMDC Reg: A-12345</p>
              </div>
              <div className="sm:text-right text-[11px] text-slate-400">
                <div className="font-bold text-white">শেখ ফার্মা কনসালটেশন চেম্বার</div>
                <div>দোকান ১৩, আরব প্যারাডাইস মার্কেট, মুক্তাগাছা</div>
                <div className="text-teal-400 font-mono">সিরিয়াল হেল্পলাইন: ০১৭১২-৪৭২৮৩৯</div>
              </div>
            </div>

            {/* Patient Meta Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-lg bg-white/5 p-2.5 text-xs text-slate-300 font-mono">
              <div><span className="text-slate-400">রোগী:</span> <span className="text-white font-bold">রহিম মিয়া</span></div>
              <div><span className="text-slate-400">বয়স/লিঙ্গ:</span> ৪২ বছর / পুরুষ</div>
              <div><span className="text-slate-400">বিপি / পালস:</span> 120/80 mmHg (74 bpm)</div>
              <div><span className="text-slate-400">তারিখ:</span> ০৪/১১/২০২৬</div>
            </div>

            {/* Pad Main Body (2 Columns Layout) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-2">
              {/* Left Column: Complaints & Tests */}
              <div className="md:col-span-4 space-y-3 border-r border-white/5 pr-0 md:pr-4 text-xs">
                <div>
                  <span className="font-bold text-teal-400 uppercase tracking-wider block mb-1">C/C (রোগের লক্ষণ):</span>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                    <li>Fever with body ache (3 days)</li>
                    <li>Loss of appetite</li>
                  </ul>
                </div>
                <div>
                  <span className="font-bold text-teal-400 uppercase tracking-wider block mb-1">O/E (শারীরিক পরীক্ষা):</span>
                  <div className="text-slate-300">BP: 120/80 · Pulse: 74 · Temp: 101°F</div>
                </div>
                <div>
                  <span className="font-bold text-teal-400 uppercase tracking-wider block mb-1">ইনভেস্টিগেশন:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                    <li>CBC with ESR</li>
                    <li>Serum Creatinine</li>
                    <li>RBS</li>
                  </ul>
                </div>
              </div>

              {/* Right Column: Rx Drugs */}
              <div className="md:col-span-8 space-y-3 text-xs">
                <span className="text-xl font-serif font-bold text-teal-400 italic">Rx</span>
                <div className="space-y-2.5">
                  <div className="rounded-lg bg-white/5 p-2 border border-white/5">
                    <div className="font-bold text-white text-sm">১. Tab. Becoral DX 100mg</div>
                    <div className="text-slate-300 text-xs mt-0.5 flex justify-between">
                      <span className="text-teal-300">১ + ০ + ১ (খাবারের পর)</span>
                      <span className="text-slate-400">১০ দিন (মোট ২০টি)</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/5 p-2 border border-white/5">
                    <div className="font-bold text-white text-sm">২. Tab. Bilista 20mg</div>
                    <div className="text-slate-300 text-xs mt-0.5 flex justify-between">
                      <span className="text-teal-300">০ + ০ + ১ (রাতে শোবার আগে)</span>
                      <span className="text-slate-400">১৪ দিন (মোট ১৪টি)</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/5 p-2 border border-white/5">
                    <div className="font-bold text-white text-sm">৩. Cap. Losectil 20mg</div>
                    <div className="text-slate-300 text-xs mt-0.5 flex justify-between">
                      <span className="text-teal-300">১ + ০ + ১ (খাবারের ৩০ মিনিট আগে)</span>
                      <span className="text-slate-400">১৪ দিন (মোট ২৮টি)</span>
                    </div>
                  </div>
                </div>

                {/* Advice & Follow Up */}
                <div className="pt-2 border-t border-white/5 flex flex-col sm:flex-row justify-between text-xs text-slate-400 gap-2">
                  <div><strong className="text-slate-300">পরামর্শ:</strong> প্রচুর পানি পান করুন ও বিশ্রাম নিন।</div>
                  <div className="text-teal-400 font-bold">পরবর্তী সাক্ষাত: ১৫ দিন পর</div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Print Action Bar */}
          <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="rounded bg-teal-500/20 text-teal-300 px-2 py-1 font-mono">A4 ফুল প্যাড</span>
              <span className="rounded bg-white/10 text-slate-300 px-2 py-1 font-mono">টপ মার্জিন টগল</span>
              <span className="rounded bg-white/10 text-slate-300 px-2 py-1 font-mono">58mm/80mm থার্মাল</span>
              <span className="rounded bg-white/10 text-slate-300 px-2 py-1 font-mono">পিডিএফ ডাউনলোড</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <CheckCircle2 className="h-4 w-4" />
              <span>এক ক্লিকে প্রিন্ট ও রোগীকে এসএমএস লিংক পাঠানো রেডি</span>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 5. CORE BENEFITS BENTO GRID ================= */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 border-t border-white/5">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-teal-400 bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/20">
            চেম্বারের জন্য তৈরি
          </span>
          <h2 className="mt-4 text-3xl font-extrabold text-white sm:text-4xl">
            ডাক্তারদের সময় বাঁচাতে বিশেষ সুবিধাসমূহ
          </h2>
          <p className="mt-3 text-slate-400 text-sm sm:text-base">
            সহজ ইন্টারফেস, যাতে কম্পিউটার ব্যবহারের জটিলতা ছাড়াই নিমেষেই প্রেসক্রিপশন লেখা যায়।
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1 */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md hover:border-teal-500/40 transition">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 mb-4">
              <FileText className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-white">স্মার্ট ড্রাগ সার্চ ও অটো ডোজ</h3>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              হাজারো ওষুধের তালিকা থেকে টাইপ করলেই সাজেস্ট করে। ১+০+১ লিখলেই মোট ওষুধের পিস স্বয়ংক্রিয়ভাবে হিসাব হয়ে যায়।
            </p>
          </div>

          {/* Card 2 */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md hover:border-emerald-500/40 transition">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-4">
              <ClipboardList className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-white">নিজস্ব প্রিসেট ও টেমপ্লেট লাইব্রেরি</h3>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              ঘন ঘন ব্যবহৃত Chief Complaints, টেস্ট ও উপদেশগুলো নিজস্ব তালিকায় সংরক্ষণ করুন এবং এক ক্লিকেই প্রেসক্রিপশনে যুক্ত করুন।
            </p>
          </div>

          {/* Card 3 */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md hover:border-cyan-500/40 transition">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mb-4">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-white">সহকারী ও রোগী কিউ ম্যানেজমেন্ট</h3>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              সহকারী চেম্বারে রোগীর নাম ও ফি এন্ট্রি করবেন, সিরিয়াল টোকেন প্রিন্ট হবে এবং ডাক্তারের স্ক্রিনে লাইভ কিউ চলে আসবে।
            </p>
          </div>

          {/* Card 4 */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md hover:border-amber-500/40 transition">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-4">
              <Printer className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-white">লেটারহেড প্যাড ও থার্মাল প্রিন্টিং</h3>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              ডাক্তারের নিজস্ব প্রিন্টেড প্যাড থাকলে ওপরের অংশ খালি রেখে প্রিন্ট করার টগল রয়েছে। এছাড়াও থার্মাল স্লিপ ও পিডিএফ সাপোর্ট আছে।
            </p>
          </div>

          {/* Card 5 */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md hover:border-blue-500/40 transition">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 mb-4">
              <Activity className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-white">পেশেন্ট হিস্ট্রি ও আগের প্রেসক্রিপশন</h3>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              রোগীর মোবাইল নম্বর বা আইডি সার্চ করলেই আগের ভিজিটের হিস্ট্রি, ব্যবহৃত ওষুধ ও টেস্ট রিপোর্ট চোখের সামনে চলে আসে।
            </p>
          </div>

          {/* Card 6 */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md hover:border-purple-500/40 transition">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 mb-4">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-white">১০০% ডাক্তারের প্রাইভেসি ও নিরাপত্তা</h3>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              প্রতিটি ডাক্তারের ডাটা সম্পূর্ণ ব্যক্তিগত। অন্য কোনো ডাক্তার বা চেম্বার আপনার রোগীদের প্রেসক্রিপশন বা নোট দেখতে পারবে না।
            </p>
          </div>
        </div>
      </section>

      {/* ================= 6. SPECIALTY SELECTION ================= */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 border-t border-white/5">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-bold uppercase tracking-wider text-teal-400 bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/20">
            স্পেশালিটি কাস্টমাইজেশন
          </span>
          <h2 className="mt-3 text-3xl font-extrabold text-white">
            যেকোনো বিশেষত্বের ডাক্তারদের জন্য উপযোগী
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-5 hover:border-teal-500/30 transition">
            <div className="text-2xl mb-2">🩺</div>
            <div className="font-bold text-white text-sm">মেডিসিন ও ডায়াবেটিস</div>
            <div className="text-xs text-slate-400 mt-1">ল্যাব টেস্ট ও দীর্ঘমেয়াদী ফলোআপ</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-5 hover:border-teal-500/30 transition">
            <div className="text-2xl mb-2">👶</div>
            <div className="font-bold text-white text-sm">শিশু রোগ বিশেষজ্ঞ</div>
            <div className="text-xs text-slate-400 mt-1">ওজন ভিত্তিক সিরাপ ও ড্রপস ডোজ</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-5 hover:border-teal-500/30 transition">
            <div className="text-2xl mb-2">🤰</div>
            <div className="font-bold text-white text-sm">গাইনী ও প্রসূতি</div>
            <div className="text-xs text-slate-400 mt-1">আল্ট্রাসনোগ্রাম ও এএনসি ফলোআপ</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-5 hover:border-teal-500/30 transition">
            <div className="text-2xl mb-2">🦷</div>
            <div className="font-bold text-white text-sm">ডেন্টাল ও অন্যান্য</div>
            <div className="text-xs text-slate-400 mt-1">প্রসিডিউর নোট ও ইনজেকশন চার্ট</div>
          </div>
        </div>
      </section>

      {/* ================= 7. CTA BANNER ================= */}
      <section className="mx-auto max-w-5xl px-4 pb-24 text-center sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-teal-500/30 bg-gradient-to-b from-teal-950/60 via-slate-900 to-slate-950 p-10 sm:p-14 shadow-2xl backdrop-blur-xl">
          <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-96 rounded-full bg-teal-500/20 blur-3xl" />
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl md:text-5xl tracking-tight">
            আজই আপনার চেম্বারকে স্মার্ট করুন
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-slate-300">
            নিবন্ধন করুন এবং চেম্বারের সময় বাঁচিয়ে রোগীদের আরও স্বাচ্ছন্দ্যে চিকিৎসা দিন।
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-400 to-emerald-400 px-8 py-4 text-base font-extrabold text-slate-950 shadow-xl shadow-teal-500/25 transition hover:scale-[1.03]"
            >
              <span>ডাক্তার সাইন ইন করুন</span>
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ================= 8. FOOTER ================= */}
      <footer className="border-t border-white/10 bg-slate-950 py-12 text-sm text-slate-400">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-8 border-b border-white/5">
            <div className="md:col-span-6 space-y-3">
              <div className="flex items-center gap-2.5">
                <img
                  src={SHEIKH_PHARMA_LOGO_BASE64}
                  alt="Sheikh Pharma Logo"
                  className="h-8 w-8 object-contain rounded-full bg-white p-0.5"
                />
                <span className="text-lg font-bold text-white">শেখ ফার্মা আরএক্স (Sheikh Pharma Rx)</span>
              </div>
              <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                {SHEIKH_PHARMA_DETAILS.address}
              </p>
              <div className="text-xs text-slate-300 font-mono">
                চেম্বার সাপোর্ট হেল্পলাইন: {SHEIKH_PHARMA_DETAILS.phones}
              </div>
            </div>

            <div className="md:col-span-3 space-y-2">
              <div className="font-bold text-white text-xs uppercase tracking-wider">ইকোসিস্টেম পোর্টাল</div>
              <ul className="space-y-1.5 text-xs">
                <li>
                  <Link to="/" className="text-emerald-400 hover:underline">
                    ফার্মেসি পিওএস (sell.sheikhpharma.shop)
                  </Link>
                </li>
                <li>
                  <Link to="/rx" className="text-teal-400 font-semibold hover:underline">
                    ডাক্তার প্রেসক্রিপশন (rx.sheikhpharma.shop)
                  </Link>
                </li>
                <li>
                  <Link to="/patient" className="text-cyan-400 hover:underline">
                    রোগী সেবা পোর্টাল (pt.sheikhpharma.shop)
                  </Link>
                </li>
              </ul>
            </div>

            <div className="md:col-span-3 space-y-2">
              <div className="font-bold text-white text-xs uppercase tracking-wider">ডাক্তারদের জন্য</div>
              <ul className="space-y-1.5 text-xs">
                <li>
                  <Link to="/auth" className="hover:text-white transition">
                    প্রেসক্রিপশন প্যাড লগইন
                  </Link>
                </li>
                <li>
                  <a href={`tel:${SHEIKH_PHARMA_DETAILS.phonesRaw[0]}`} className="hover:text-white transition">
                    চেম্বার সেটআপ সহায়তা
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
            <div>© {new Date().getFullYear()} শেখ ফার্মা আরএক্স · সর্বস্বত্ব সংরক্ষিত।</div>
            <div className="mt-2 sm:mt-0 font-mono text-[11px]">Powered by Sheikh Pharma Digital Health</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
