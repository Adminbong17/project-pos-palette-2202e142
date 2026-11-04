import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { isRxMode, isPatientHost } from "@/lib/rx-mode";
import { supabase } from "@/integrations/supabase/client";
import { SHEIKH_PHARMA_DETAILS } from "@/lib/sheikh-pharma-letterhead";
import { SHEIKH_PHARMA_LOGO_BASE64 } from "@/lib/sheikh-pharma-logo.base64";

import {
  ShoppingCart,
  Package,
  BarChart3,
  Users,
  Receipt,
  ShieldCheck,
  ArrowRight,
  Zap,
  Globe,
  Printer,
  CalendarDays,
  Stethoscope,
  CheckCircle2,
  Sparkles,
  Phone,
  QrCode,
  Laptop,
  Smartphone,
  CreditCard,
  Layers,
  ChevronRight,
  TrendingUp,
  Clock,
  Search,
} from "lucide-react";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (isPatientHost()) {
      throw redirect({ to: "/patient" });
    }
  },
  head: () => {
    if (typeof window !== "undefined" && isPatientHost()) {
      return {
        meta: [
          { title: "রোগী সেবা পোর্টাল — শেখ ফার্মা | Patient Care Portal" },
          {
            name: "description",
            content:
              "শেখ ফার্মা পেশেন্ট পোর্টাল। আপনার মোবাইল নম্বর দিয়ে লগইন করে প্রেসক্রিপশন, ল্যাব রিপোর্ট, ডাক্তারের সিরিয়াল ও বিলের হিসাব দেখুন।",
          },
          { property: "og:title", content: "রোগী সেবা পোর্টাল — শেখ ফার্মা" },
          {
            property: "og:description",
            content:
              "প্রেসক্রিপশন, ল্যাব টেস্ট রিপোর্ট, ডাক্তারের সিরিয়াল ও বিলের হিসাব এক ঠিকানায়।",
          },
          { property: "og:type", content: "website" },
          { name: "twitter:card", content: "summary" },
        ],
      };
    }
    return {
      meta: [
        { title: "শেখ ফার্মা পিওএস — আধুনিক ফার্মেসি ও রিটেইল পিওএস সফটওয়্যার | Sheikh Pharma POS" },
        {
          name: "description",
          content:
            "সুপারফাস্ট বারকোড বিলিং, ব্লুটুথ থার্মাল প্রিন্টিং (PT-220 ও MX04 Cat Printer), মেডিসিন এক্সপায়ারি ও স্টক ম্যানেজমেন্ট, বাকি খাতা ও প্রফিট রিপোর্ট — শেখ ফার্মা পিওএস।",
        },
        { property: "og:title", content: "শেখ ফার্মা পিওএস — স্মার্ট ফার্মেসি ও রিটেইল সল্যুশন" },
        {
          property: "og:description",
          content: "দ্রুততম ক্যাশ কাউন্টার বিলিং, ওয়্যারলেস রসিদ ও স্বয়ংক্রিয় বাকি খাতা ম্যানেজমেন্ট।",
        },
      ],
    };
  },
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"pos" | "inventory" | "ledger">("pos");

  useEffect(() => {
    if (isPatientHost()) {
      navigate({ to: "/patient", replace: true });
      return;
    }
    if (!isRxMode()) return;
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) navigate({ to: "/prescriptions", search: { rx: undefined }, replace: true });
      else navigate({ to: "/rx", replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (typeof window !== "undefined" && isPatientHost()) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-slate-950 relative overflow-hidden font-sans">
      {/* Dynamic Background Glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[1100px] rounded-full bg-emerald-500/10 blur-[130px]" />
      <div className="pointer-events-none absolute top-[600px] -left-48 h-[550px] w-[550px] rounded-full bg-teal-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute top-[1200px] -right-48 h-[600px] w-[600px] rounded-full bg-cyan-500/10 blur-[140px]" />

      {/* ================= 1. TOP ECOSYSTEM BAR ================= */}
      <div className="border-b border-white/5 bg-slate-950/90 text-xs backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 sm:px-6">
          {/* Ecosystem Switcher */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="hidden sm:inline text-slate-400 font-medium">শেখ ফার্মা ইকোসিস্টেম:</span>
            <div className="inline-flex rounded-full bg-white/5 p-0.5 border border-white/10 text-[11px] font-semibold">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-0.5 text-slate-950 font-bold shadow-sm">
                <ShoppingCart className="h-3 w-3" />
                <span>পিওএস (Sell)</span>
              </span>
              <Link
                to="/rx"
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-slate-300 hover:text-white hover:bg-white/10 transition"
              >
                <Stethoscope className="h-3 w-3 text-teal-400" />
                <span>ডাক্তার (Rx)</span>
              </Link>
              <Link
                to="/patient"
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-slate-300 hover:text-white hover:bg-white/10 transition"
              >
                <Users className="h-3 w-3 text-cyan-400" />
                <span>রোগী সেবা (Pt)</span>
              </Link>
            </div>
          </div>

          {/* Quick Helpline Phone */}
          <div className="flex items-center gap-3">
            <a
              href={`tel:${SHEIKH_PHARMA_DETAILS.phonesRaw[0]}`}
              className="inline-flex items-center gap-1.5 text-slate-300 hover:text-emerald-400 transition"
            >
              <Phone className="h-3.5 w-3.5 text-emerald-400" />
              <span className="hidden xs:inline">হেল্পলাইন:</span>
              <span className="font-bold text-white">{SHEIKH_PHARMA_DETAILS.phonesRaw[0]}</span>
            </a>
          </div>
        </div>
      </div>

      {/* ================= 2. MAIN HEADER NAVIGATION ================= */}
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-emerald-500/40 bg-white p-0.5 shadow-lg shadow-emerald-500/10 transition hover:scale-105">
            <img
              src={SHEIKH_PHARMA_LOGO_BASE64}
              alt="Sheikh Pharma Logo"
              className="h-full w-full object-contain rounded-full"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                শেখ ফার্মা <span className="text-emerald-400">POS</span>
              </span>
              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                PRO 3.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              স্মার্ট ফার্মেসি ও রিটেইল ক্যাশ কাউন্টার ইআরপি
            </p>
          </div>
        </div>

        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-300 md:flex">
          <a href="#features" className="hover:text-emerald-400 transition">ফিচারসমূহ</a>
          <a href="#hardware" className="hover:text-emerald-400 transition">প্রিন্টার ও হার্ডওয়্যার</a>
          <a href="#ecosystem" className="hover:text-emerald-400 transition">ইকোসিস্টেম</a>
          <a href="#stats" className="hover:text-emerald-400 transition">পারফরম্যান্স</a>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition-all duration-200 hover:scale-[1.03] hover:shadow-emerald-500/30 active:scale-95"
          >
            <span>লগইন করুন</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* ================= 3. HERO SECTION ================= */}
      <section className="relative mx-auto max-w-7xl px-4 pt-10 pb-16 text-center sm:px-6 lg:pt-14 lg:pb-24">
        {/* Pill Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300 backdrop-blur-md shadow-sm">
          <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
          <span>ফার্মেসি ও রিটেইল ব্যবসার পূর্ণাঙ্গ ডিজিটাল ক্যাশ কাউন্টার</span>
        </div>

        {/* Display Title */}
        <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-extrabold leading-[1.12] text-white sm:text-5xl md:text-6xl tracking-tight">
          দ্রুততম বিলিং, নির্ভুল স্টক ও{" "}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            আধুনিক ডিজিটাল পিওএস
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mt-6 max-w-2xl text-base text-slate-300 sm:text-lg leading-relaxed">
          বারকোড স্ক্যানার দিয়ে চোখের পলকে সেলস, PT-220 ও Cat Printer ব্লুটুথ ওয়্যারলেস রসিদ, ওষুধের এক্সপায়ারি ও স্টক ট্র্যাকিং এবং স্বয়ংক্রিয় বাকি খাতা — সবকিছু এখন এক প্ল্যাটফর্মে।
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
          <Link
            to="/auth"
            className="inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-7 py-3.5 text-base font-extrabold text-slate-950 shadow-xl shadow-emerald-500/25 transition-all duration-200 hover:scale-[1.03] hover:shadow-emerald-500/35 active:scale-95"
          >
            <ShoppingCart className="h-5 w-5" />
            <span>সরাসরি শুরু করুন (Free Access)</span>
          </Link>
          <Link
            to="/rx"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3.5 text-base font-semibold text-white backdrop-blur-md transition hover:bg-white/10 hover:border-white/30"
          >
            <Stethoscope className="h-4 w-4 text-teal-400" />
            <span>ডাক্তার চেম্বার (Rx)</span>
          </Link>
          <Link
            to="/patient"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3.5 text-base font-semibold text-white backdrop-blur-md transition hover:bg-white/10 hover:border-white/30"
          >
            <Users className="h-4 w-4 text-cyan-400" />
            <span>রোগী সেবা পোর্টাল</span>
          </Link>
        </div>

        {/* ================= 4. INTERACTIVE POS MOCKUP DISPLAY ================= */}
        <div className="relative mx-auto mt-12 max-w-5xl rounded-2xl border border-white/10 bg-slate-900/80 p-3 sm:p-5 shadow-2xl backdrop-blur-xl">
          {/* Mockup Top Window Controls */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-rose-500/80" />
              <div className="h-3 w-3 rounded-full bg-amber-500/80" />
              <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
              <span className="ml-2 font-mono text-xs text-slate-400">SHEIKH PHARMA CLOUD POS TERMINAL</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/30">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ব্লুটুথ প্রিন্টার কানেক্টেড (PT-220 &amp; MX04)
              </span>
            </div>
          </div>

          {/* POS Terminal Visual Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-left">
            {/* Left 7 cols: Live Cart & Search */}
            <div className="md:col-span-7 space-y-3">
              {/* Search Bar Mockup */}
              <div className="flex items-center gap-2 rounded-xl bg-slate-950/70 border border-white/10 px-3.5 py-2.5 text-sm text-slate-400">
                <Search className="h-4 w-4 text-emerald-400" />
                <span className="text-white font-medium">Napa Extra 500mg</span>
                <span className="text-xs text-slate-500">(Paracetamol + Caffeine)</span>
                <span className="ml-auto rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300 font-mono">
                  BARCODE READY
                </span>
              </div>

              {/* Items List Mockup */}
              <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3 space-y-2">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-white/5 flex justify-between">
                  <span>ওষুধের নাম ও পরিমাণ</span>
                  <span>মূল্য (Tk)</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1">
                  <div>
                    <span className="font-bold text-white">1. Tab Becoral DX</span>
                    <span className="text-slate-400 ml-2">10 পাতা x 14.50</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-400">Tk 145.00</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1 border-t border-white/5">
                  <div>
                    <span className="font-bold text-white">2. Tab Bilista 20mg</span>
                    <span className="text-slate-400 ml-2">10 পাতা x 13.50</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-400">Tk 135.00</span>
                </div>
                <div className="flex items-center justify-between text-xs py-1 border-t border-white/5">
                  <div>
                    <span className="font-bold text-white">3. Lulizol Lotion 50g</span>
                    <span className="text-slate-400 ml-2">1 পিস x 390.00</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-400">Tk 390.00</span>
                </div>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-white/5 p-2 border border-white/5">
                  <div className="text-slate-400 text-[10px]">আজকের বিক্রয়</div>
                  <div className="text-base font-extrabold text-emerald-400 font-mono">Tk 24,500</div>
                </div>
                <div className="rounded-lg bg-white/5 p-2 border border-white/5">
                  <div className="text-slate-400 text-[10px]">ক্যাশ আদায়</div>
                  <div className="text-base font-extrabold text-teal-400 font-mono">Tk 18,200</div>
                </div>
                <div className="rounded-lg bg-white/5 p-2 border border-white/5">
                  <div className="text-slate-400 text-[10px]">বাকি আদায়</div>
                  <div className="text-base font-extrabold text-cyan-400 font-mono">Tk 6,300</div>
                </div>
              </div>
            </div>

            {/* Right 5 cols: Instant Thermal Receipt Slip Preview */}
            <div className="md:col-span-5 rounded-xl border border-white/10 bg-slate-950 p-4 font-mono text-xs shadow-inner flex flex-col justify-between">
              <div>
                <div className="text-center font-bold text-sm text-white">Sheikh pharma</div>
                <div className="text-center text-[10px] text-slate-400">Muktagacha, Mymensingh · 01712472839</div>
                <div className="text-center text-slate-500 my-1">--------------------------------</div>
                <div className="flex justify-between text-[11px]">
                  <span>Bill No: SKP-202608</span>
                  <span>Date: 04/11/2026</span>
                </div>
                <div className="text-center text-slate-500 my-1">--------------------------------</div>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span>1. Tab Becoral DX</span>
                    <span>145.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>2. Tab Bilista 20mg</span>
                    <span>135.00</span>
                  </div>
                </div>
                <div className="text-center text-slate-500 my-1">================================</div>
                <div className="flex justify-between text-sm font-bold text-emerald-400">
                  <span>NET TOTAL:</span>
                  <span>Tk 502.00</span>
                </div>
                <div className="text-center text-slate-500 my-1">--------------------------------</div>
                <div className="flex justify-between text-[11px] text-slate-300">
                  <span>Paid (CASH):</span>
                  <span>502.00</span>
                </div>
                <div className="text-center text-slate-500 my-1">================================</div>
              </div>
              <div className="text-center text-[10px] text-emerald-400 font-bold mt-2 pt-2 border-t border-white/5 flex items-center justify-center gap-1.5">
                <Printer className="h-3.5 w-3.5" />
                <span>ওয়াইয়ারলেস থার্মাল প্রিন্ট কমপ্লিট (3 Sec)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 5. THE THREE SISTER ECOSYSTEM PILLARS ================= */}
      <section id="ecosystem" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 border-t border-white/5">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            সম্পূর্ণ স্বাস্থ্যসেবা প্ল্যাটফর্ম
          </span>
          <h2 className="mt-4 text-3xl font-extrabold text-white sm:text-4xl">
            এক প্ল্যাটফর্মে ফার্মেসি, ডাক্তার চেম্বার ও রোগী সেবা
          </h2>
          <p className="mt-3 text-slate-400 text-sm sm:text-base">
            শেখ ফার্মার ৩টি আলাদা পোর্টাল একে অপরের সাথে রিয়েল-টাইমে সংযুক্ত।
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: POS (Current) */}
          <div className="relative rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-b from-emerald-950/40 to-slate-900/60 p-6 shadow-xl backdrop-blur-sm">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20 mb-4">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <span className="absolute top-6 right-6 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
              আপনি এখানে আছেন
            </span>
            <h3 className="text-xl font-bold text-white">১. ফার্মেসি ও রিটেইল পিওএস</h3>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              ক্যাশ কাউন্টার বিলিং, ওষুধের মেয়াদ ট্র্যাকিং, বারকোড স্ক্যানার, ডুয়াল থার্মাল প্রিন্টিং ও দৈনিক লাভ-ক্ষতি হিসাব।
            </p>
            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
              <span className="text-xs font-mono text-emerald-400">sell.sheikhpharma.shop</span>
              <Link to="/auth" className="text-xs font-bold text-white hover:text-emerald-400 flex items-center gap-1">
                লগইন করুন <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 2: Doctor Rx */}
          <div className="group relative rounded-2xl border border-white/10 bg-slate-900/50 p-6 shadow-lg backdrop-blur-sm transition-all duration-200 hover:border-teal-500/40 hover:bg-slate-900/80">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/20 mb-4">
              <Stethoscope className="h-6 w-6" />
            </div>
            <span className="absolute top-6 right-6 rounded-full bg-teal-500/10 px-2 py-0.5 text-[10px] font-bold text-teal-300 border border-teal-500/20">
              ডাক্তার চেম্বার
            </span>
            <h3 className="text-xl font-bold text-white">২. স্মার্ট প্রেসক্রিপশন (Rx)</h3>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              ডাক্তারদের জন্য ৩০ সেকেন্ডে ডিজিটাল প্রেসক্রিপশন তৈরি, চেম্বার কিউ ও টোকেন প্রিন্টিং এবং নিজস্ব ড্রাগ প্রিসেট।
            </p>
            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
              <span className="text-xs font-mono text-teal-400">rx.sheikhpharma.shop</span>
              <Link to="/rx" className="text-xs font-bold text-teal-400 hover:text-teal-300 flex items-center gap-1">
                ভিজিট করুন <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Card 3: Patient Care */}
          <div className="group relative rounded-2xl border border-white/10 bg-slate-900/50 p-6 shadow-lg backdrop-blur-sm transition-all duration-200 hover:border-cyan-500/40 hover:bg-slate-900/80">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20 mb-4">
              <Users className="h-6 w-6" />
            </div>
            <span className="absolute top-6 right-6 rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-500/20">
              পেশেন্ট পোর্টাল
            </span>
            <h3 className="text-xl font-bold text-white">৩. রোগী সেবা পোর্টাল (Pt)</h3>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              রোগীরা অনলাইনে ডাক্তারের সিরিয়াল বুকিং করতে পারবেন, প্রেসক্রিপশন দেখতে পারবেন এবং ল্যাব রিপোর্ট ডাউনলোড করবেন।
            </p>
            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
              <span className="text-xs font-mono text-cyan-400">pt.sheikhpharma.shop</span>
              <Link to="/patient" className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                ভিজিট করুন <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 6. CORE FEATURES BENTO GRID ================= */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            শক্তিশালী মডিউলসমূহ
          </span>
          <h2 className="mt-4 text-3xl font-extrabold text-white sm:text-4xl">
            একটি ফার্মেসি সফলভাবে পরিচালনার প্রতিটি টুল
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Feature 1 */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md hover:border-emerald-500/30 transition">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-4">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-white">সুপারফাস্ট কাউন্টার বিলিং</h3>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              যেকোনো ইউএসবি বা ওয়্যারলেস বারকোড স্ক্যানার দিয়ে চোখের পলকে আইটেম কার্ট এ যোগ করুন। কিবোর্ড শর্টকাট থাকায় মাউস ছাড়া দ্রুত বিক্রি সম্পন্ন হয়।
            </p>
          </div>

          {/* Feature 2 */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md hover:border-teal-500/30 transition">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 mb-4">
              <Printer className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-white">ডুয়াল ব্লুটুথ থার্মাল প্রিন্টিং</h3>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              উইন্ডোজ ড্রাইভারের ঝামেলা ছাড়াই PT-220 ও MX04 Cat Printer-এ সরাসরি ওয়েব ব্লুটুথ দিয়ে ৩ সেকেন্ডে ঝকঝকে বাংলা/ইংরেজি রসিদ প্রিন্ট হয়।
            </p>
          </div>

          {/* Feature 3 */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md hover:border-cyan-500/30 transition">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mb-4">
              <Package className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-white">মেডিসিন এক্সপায়ারি ও স্টক ট্র্যাকিং</h3>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              ওষুধের মেয়াদ শেষ হওয়ার আগেই কালার-কোডেড অ্যালার্ট। পাতা, বক্স ও একক পিস হিসাব স্বয়ংক্রিয়ভাবে স্টক থেকে মাইনাস হয়।
            </p>
          </div>

          {/* Feature 4 */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md hover:border-amber-500/30 transition">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-4">
              <CreditCard className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-white">ডিজিটাল বাকি খাতা ও এসএমএস</h3>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              কাস্টমারদের নাম ও মোবাইল নম্বর দিয়ে বাকি হিসাব রাখুন। বকেয়া পরিশোধ করলে স্বয়ংক্রিয় ভাউচার প্রিন্ট এবং মোবাইল এসএমএস চলে যায়।
            </p>
          </div>

          {/* Feature 5 */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md hover:border-blue-500/30 transition">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 mb-4">
              <BarChart3 className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-white">রিয়েল-টাইম লাভ-ক্ষতি ও সেলস রিপোর্ট</h3>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              প্রতিদিনের কেনাবেচা, নিট প্রফিট, সর্বোচ্চ বিক্রিত ওষুধ, সেলসম্যান পারফরম্যান্স ও সাপ্লায়ারদের বকেয়া হিসাব এক ক্লিকে এক্সেল বা পিডিএফ ডাউনলোড।
            </p>
          </div>

          {/* Feature 6 */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-md hover:border-purple-500/30 transition">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 mb-4">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-white">১০০% ক্লাউড সিকিউরিটি ও ব্যাকআপ</h3>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              আপনার দোকানের সমস্ত ডাটা ক্লাউডে সুরক্ষিত ও স্বয়ংক্রিয় ব্যাকআপ হয়। কম্পিউটার নষ্ট হলেও মোবাইল বা নতুন ল্যাপটপ থেকে সব হিসাব তৎক্ষণাৎ পাওয়া যাবে।
            </p>
          </div>
        </div>
      </section>

      {/* ================= 7. HARDWARE COMPATIBILITY ================= */}
      <section id="hardware" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 border-t border-white/5">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-8 sm:p-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6 space-y-4 text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                হার্ডওয়্যার ও প্রিন্টার সাপোর্ট
              </span>
              <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
                যেকোনো ডিভাইস ও থার্মাল প্রিন্টারের সাথে শতভাগ উপযোগী
              </h2>
              <p className="text-slate-300 text-sm leading-relaxed">
                উইন্ডোজ পিসি, ম্যাক, ল্যাপটপ, ট্যাবলেট বা অ্যান্ড্রয়েড মোবাইল — যেকোনো ডিভাইস থেকে কোনো বাড়তি সফটওয়্যার ইন্সটল ছাড়াই গুগল ক্রোম বা এজ ব্রাউজারের মাধ্যমে সরাসরি কাজ করে।
              </p>
              <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-medium text-slate-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>PT-220 58mm ব্লুটুথ থার্মাল</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>MX04 Cat Ear পকেট প্রিন্টার</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>80mm POS ডেস্কটপ প্রিন্টার</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>১D / ২D বারকোড স্ক্যানার</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/10 bg-slate-950/80 p-5 text-center">
                <Laptop className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                <div className="font-bold text-white text-sm">ডেস্কটপ ও ল্যাপটপ</div>
                <div className="text-xs text-slate-400 mt-1">পূর্ণাঙ্গ কিবোর্ড শর্টকাট ও বড় স্ক্রিন লেআউট</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950/80 p-5 text-center">
                <Smartphone className="h-8 w-8 text-teal-400 mx-auto mb-2" />
                <div className="font-bold text-white text-sm">ট্যাবলেট ও মোবাইল</div>
                <div className="text-xs text-slate-400 mt-1">টাচ-ফ্রেন্ডলি মোবাইল ক্যাশ কাউন্টার</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950/80 p-5 text-center">
                <Printer className="h-8 w-8 text-cyan-400 mx-auto mb-2" />
                <div className="font-bold text-white text-sm">ডুয়াল থার্মাল ব্লুটুথ</div>
                <div className="text-xs text-slate-400 mt-1">জিরো ড্রাইভার ওয়েব ব্লুটুথ সংযোগ</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950/80 p-5 text-center">
                <QrCode className="h-8 w-8 text-amber-400 mx-auto mb-2" />
                <div className="font-bold text-white text-sm">বারকোড ও কিউআর স্ক্যান</div>
                <div className="text-xs text-slate-400 mt-1">মোবাইল ক্যামেরা বা ইউএসবি স্ক্যানার</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 8. STATS SECTION ================= */}
      <section id="stats" className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-4 rounded-3xl border border-white/10 bg-slate-900/60 p-8 md:grid-cols-4 backdrop-blur-md">
          <div className="text-center">
            <div className="text-3xl font-extrabold text-emerald-400 sm:text-4xl font-mono">10,000+</div>
            <div className="mt-1 text-xs text-slate-400">দৈনিক সফল লেনদেন</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-extrabold text-teal-400 sm:text-4xl font-mono">99.99%</div>
            <div className="mt-1 text-xs text-slate-400">ক্লাউড সার্ভার আপটাইম</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-extrabold text-cyan-400 sm:text-4xl font-mono">&lt; 3 Sec</div>
            <div className="mt-1 text-xs text-slate-400">গড় চেকআউট ও রসিদ প্রিন্ট</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-extrabold text-emerald-400 sm:text-4xl font-mono">100%</div>
            <div className="mt-1 text-xs text-slate-400">এনক্রিপ্টেড ডাটা সুরক্ষা</div>
          </div>
        </div>
      </section>

      {/* ================= 9. FINAL CTA BANNER ================= */}
      <section className="mx-auto max-w-5xl px-4 pb-24 text-center sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/60 via-slate-900 to-slate-950 p-10 sm:p-14 shadow-2xl backdrop-blur-xl">
          <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl md:text-5xl tracking-tight">
            আপনার ব্যবসাকে আজই করুন স্মার্ট ও সম্পূর্ণ ক্যাশলেস
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-slate-300">
            যেকোনো ডিভাইস থেকে বিনামূল্যে লগইন করুন। কোনো ক্রেডিট কার্ডের প্রয়োজন নেই।
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-4 text-base font-extrabold text-slate-950 shadow-xl shadow-emerald-500/25 transition hover:scale-[1.03]"
            >
              <span>ক্যাশ কাউন্টার লগইন করুন</span>
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ================= 10. FOOTER ================= */}
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
                <span className="text-lg font-bold text-white">শেখ ফার্মা (Sheikh Pharma)</span>
              </div>
              <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                {SHEIKH_PHARMA_DETAILS.address}
              </p>
              <div className="text-xs text-slate-300 font-mono">
                হেল্পলাইন: {SHEIKH_PHARMA_DETAILS.phones} · ইমেইল: {SHEIKH_PHARMA_DETAILS.email}
              </div>
            </div>

            <div className="md:col-span-3 space-y-2">
              <div className="font-bold text-white text-xs uppercase tracking-wider">ইকোসিস্টেম পোর্টাল</div>
              <ul className="space-y-1.5 text-xs">
                <li>
                  <Link to="/" className="text-emerald-400 font-semibold hover:underline">
                    ফার্মেসি পিওএস (sell.sheikhpharma.shop)
                  </Link>
                </li>
                <li>
                  <Link to="/rx" className="text-teal-400 hover:underline">
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
              <div className="font-bold text-white text-xs uppercase tracking-wider">দ্রুত অ্যাক্সেস</div>
              <ul className="space-y-1.5 text-xs">
                <li>
                  <Link to="/auth" className="hover:text-white transition">
                    স্টাফ ও ডাক্তার সাইন ইন
                  </Link>
                </li>
                <li>
                  <a href={`tel:${SHEIKH_PHARMA_DETAILS.phonesRaw[0]}`} className="hover:text-white transition">
                    কাস্টমার সাপোর্ট ও হেল্প
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
            <div>© {new Date().getFullYear()} শেখ ফার্মা ডিজিটাল হেলথ প্ল্যাটফর্ম · সর্বস্বত্ব সংরক্ষিত।</div>
            <div className="mt-2 sm:mt-0 font-mono text-[11px]">Powered by Sheikh Pharma Cloud POS</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
