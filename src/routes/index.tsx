import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { isRxMode, isPatientHost } from "@/lib/rx-mode";
import { supabase } from "@/integrations/supabase/client";
import { SHEIKH_PHARMA_DETAILS } from "@/lib/sheikh-pharma-letterhead";
import { SHEIKH_PHARMA_LOGO_BASE64 } from "@/lib/sheikh-pharma-logo.base64";

import {
  ShoppingCart,
  Package,
  BarChart3,
  Users,
  ShieldCheck,
  ArrowRight,
  Zap,
  Printer,
  Stethoscope,
  CheckCircle2,
  Phone,
  QrCode,
  Laptop,
  Smartphone,
  CreditCard,
  ChevronRight,
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
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 selection:bg-emerald-600 selection:text-white relative overflow-x-hidden font-sans">
      {/* Subtle Clean Background Wash */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[620px] bg-gradient-to-b from-emerald-50/90 via-teal-50/30 to-transparent" />

      {/* ================= 1. COMPACT ECOSYSTEM TOP BAR ================= */}
      <div className="border-b border-slate-200/80 bg-white/95 text-xs backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2 sm:px-6">
          {/* Ecosystem Switcher */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <span className="hidden md:inline text-slate-500 font-medium">শেখ ফার্মা ইকোসিস্টেম:</span>
            <div className="inline-flex items-center rounded-full bg-slate-100 p-0.5 border border-slate-200/80 text-[11px] font-semibold">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-700 px-2.5 py-1 text-white font-semibold shadow-xs whitespace-nowrap">
                <ShoppingCart className="h-3 w-3 shrink-0" />
                <span>পিওএস <span className="hidden xs:inline">(Sell)</span></span>
              </span>
              <Link
                to="/rx"
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-white transition whitespace-nowrap"
              >
                <Stethoscope className="h-3 w-3 text-teal-600 shrink-0" />
                <span>ডাক্তার <span className="hidden xs:inline">(Rx)</span></span>
              </Link>
              <Link
                to="/patient"
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-white transition whitespace-nowrap"
              >
                <Users className="h-3 w-3 text-sky-600 shrink-0" />
                <span>রোগী সেবা <span className="hidden xs:inline">(Pt)</span></span>
              </Link>
            </div>
          </div>

          {/* Quick Helpline Phone */}
          <a
            href={`tel:${SHEIKH_PHARMA_DETAILS.phonesRaw[0]}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/70 px-2.5 py-1 text-slate-700 hover:bg-emerald-100/70 transition whitespace-nowrap"
          >
            <Phone className="h-3 w-3 text-emerald-700 shrink-0" />
            <span className="hidden sm:inline text-slate-500">হেল্পলাইন:</span>
            <span className="font-bold text-emerald-900">{SHEIKH_PHARMA_DETAILS.phonesRaw[0]}</span>
          </a>
        </div>
      </div>

      {/* ================= 2. MAIN HEADER NAVIGATION ================= */}
      <header className="relative z-40 border-b border-slate-200/60 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-emerald-200 bg-white p-1 shadow-xs">
              <img
                src={SHEIKH_PHARMA_LOGO_BASE64}
                alt="Sheikh Pharma Logo"
                className="h-full w-full object-contain rounded-lg"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 truncate">
                  শেখ ফার্মা <span className="text-emerald-700">POS</span>
                </span>
                <span className="hidden xs:inline-flex items-center rounded-md bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 whitespace-nowrap">
                  PHARMACY ERP
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                স্মার্ট ফার্মেসি ও রিটেইল ক্যাশ কাউন্টার সিস্টেম
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 lg:flex">
            <a href="#ecosystem" className="hover:text-emerald-700 transition">ইকোসিস্টেম</a>
            <a href="#features" className="hover:text-emerald-700 transition">মডিউলসমূহ</a>
            <a href="#hardware" className="hover:text-emerald-700 transition">প্রিন্টার ও হার্ডওয়্যার</a>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/auth"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all duration-150 active:scale-95 whitespace-nowrap"
            >
              <span>লগইন করুন</span>
              <ArrowRight className="h-4 w-4 shrink-0" />
            </Link>
          </div>
        </div>
      </header>

      {/* ================= 3. HERO SECTION (SPLIT DESKTOP + CLEAN MOBILE) ================= */}
      <section className="relative mx-auto max-w-7xl px-4 pt-8 pb-12 sm:px-6 lg:pt-14 lg:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* Left Column: Value Proposition */}
          <div className="lg:col-span-5 space-y-5 text-left pt-2">
            <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200/80 px-3 py-1.5 text-xs font-semibold text-emerald-800">
              <ShoppingCart className="h-3.5 w-3.5 text-emerald-700" />
              <span>ফার্মেসি ও রিটেইল ব্যবসার পূর্ণাঙ্গ ডিজিটাল ক্যাশ কাউন্টার</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-bold leading-[1.22] tracking-tight text-slate-900">
              দ্রুততম বিলিং, নির্ভুল স্টক ও{" "}
              <span className="text-emerald-700 underline decoration-emerald-300/80 decoration-wavy underline-offset-4">
                ওয়্যারলেস থার্মাল রসিদ
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
              কিবোর্ড শর্টকাট ও বারকোড স্ক্যানারে চোখের পলকে সেলস,{" "}
              <strong className="font-semibold text-slate-800">PT-220 ও MX04 Cat Printer</strong> ব্লুটুথ রসিদ, ওষুধের মেয়াদ ট্র্যাকিং এবং স্বয়ংক্রিয় বাকি খাতা — সবকিছু এক প্ল্যাটফর্মে।
            </p>

            {/* Primary & Secondary CTAs */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Link
                to="/auth"
                className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-6 py-3.5 text-base font-semibold text-white shadow-md shadow-emerald-900/10 transition-all hover:shadow-lg active:scale-[0.99]"
              >
                <ShoppingCart className="h-5 w-5 shrink-0" />
                <span>ক্যাশ কাউন্টারে প্রবেশ করুন</span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </Link>
              <Link
                to="/rx"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-5 py-3.5 text-sm font-semibold text-slate-700 transition"
              >
                <Stethoscope className="h-4 w-4 text-teal-700 shrink-0" />
                <span>ডাক্তার চেম্বার (Rx)</span>
              </Link>
            </div>

            {/* Key Highlights */}
            <div className="pt-4 border-t border-slate-200/80 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-white p-3 border border-slate-200/80 shadow-2xs">
                <div className="text-lg sm:text-xl font-bold text-emerald-700">&lt; ৩ সেকেন্ড</div>
                <div className="text-[11px] text-slate-500 mt-0.5">রসিদ প্রিন্ট ও চেকআউট</div>
              </div>
              <div className="rounded-xl bg-white p-3 border border-slate-200/80 shadow-2xs">
                <div className="text-lg sm:text-xl font-bold text-slate-900">১০০% ক্লাউড</div>
                <div className="text-[11px] text-slate-500 mt-0.5">অটো ব্যাকআপ ও সিঙ্ক</div>
              </div>
              <div className="rounded-xl bg-white p-3 border border-slate-200/80 shadow-2xs">
                <div className="text-lg sm:text-xl font-bold text-teal-700">ড্রাইভারলেস</div>
                <div className="text-[11px] text-slate-500 mt-0.5">ব্লুটুথ প্রিন্টার সাপোর্ট</div>
              </div>
            </div>
          </div>

          {/* Right Column: REALISTIC POS COUNTER & THERMAL RECEIPT PREVIEW */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-slate-300/90 bg-white shadow-xl shadow-slate-900/5 overflow-hidden">
              {/* Top Window Bar */}
              <div className="bg-slate-900 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <span className="font-semibold tracking-wide text-slate-200">
                    SHEIKH PHARMA LIVE POS COUNTER
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
                  <Printer className="h-3 w-3" />
                  PT-220 &amp; MX04 Bluetooth Ready
                </span>
              </div>

              <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-12 gap-4 bg-slate-50/60">
                {/* Left 7 cols: Live Cart & Search */}
                <div className="md:col-span-7 space-y-3">
                  {/* Search Bar Mockup */}
                  <div className="flex items-center gap-2 rounded-xl bg-white border border-slate-300 px-3.5 py-2.5 text-sm shadow-2xs">
                    <Search className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="text-slate-900 font-semibold truncate">Napa Extend 665mg</span>
                    <span className="ml-auto rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] text-emerald-800 font-mono font-bold shrink-0">
                      ENTER ↵
                    </span>
                  </div>

                  {/* Items List Mockup */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2.5 shadow-2xs">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider pb-1.5 border-b border-slate-100 flex justify-between">
                      <span>ওষুধের নাম ও পরিমাণ</span>
                      <span>মূল্য (৳)</span>
                    </div>
                    <div className="flex items-center justify-between text-xs py-1">
                      <div>
                        <span className="font-bold text-slate-900">১. Tab. Becoral DX</span>
                        <span className="text-slate-500 ml-2 font-normal">১০ পাতা × ১৪.৫০</span>
                      </div>
                      <span className="font-mono font-bold text-slate-900">৳ ১৪৫.০০</span>
                    </div>
                    <div className="flex items-center justify-between text-xs py-1 border-t border-slate-100">
                      <div>
                        <span className="font-bold text-slate-900">২. Tab. Bilista 20mg</span>
                        <span className="text-slate-500 ml-2 font-normal">১০ পাতা × ১৩.৫০</span>
                      </div>
                      <span className="font-mono font-bold text-slate-900">৳ ১৩৫.০০</span>
                    </div>
                    <div className="flex items-center justify-between text-xs py-1 border-t border-slate-100">
                      <div>
                        <span className="font-bold text-slate-900">৩. Lulizol Lotion 50g</span>
                        <span className="text-slate-500 ml-2 font-normal">১ পিস × ৩৯০.০০</span>
                      </div>
                      <span className="font-mono font-bold text-slate-900">৳ ৩৯০.০০</span>
                    </div>
                  </div>

                  {/* Daily Summary Mini Cards */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-xl bg-white p-2.5 border border-slate-200">
                      <div className="text-slate-500 text-[10px]">আজকের বিক্রয়</div>
                      <div className="text-sm font-bold text-emerald-700 font-mono mt-0.5">৳ ২৪,৫০০</div>
                    </div>
                    <div className="rounded-xl bg-white p-2.5 border border-slate-200">
                      <div className="text-slate-500 text-[10px]">নগদ আদায়</div>
                      <div className="text-sm font-bold text-slate-900 font-mono mt-0.5">৳ ১৮,২০০</div>
                    </div>
                    <div className="rounded-xl bg-white p-2.5 border border-slate-200">
                      <div className="text-slate-500 text-[10px]">বাকি আদায়</div>
                      <div className="text-sm font-bold text-teal-700 font-mono mt-0.5">৳ ৬,৩০০</div>
                    </div>
                  </div>
                </div>

                {/* Right 5 cols: Authentic Paper Thermal Receipt Preview */}
                <div className="md:col-span-5 rounded-xl border border-slate-300 bg-white p-4 font-mono text-xs text-slate-800 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="text-center font-bold text-sm text-slate-950">SHEIKH PHARMA</div>
                    <div className="text-center text-[10px] text-slate-500">Muktagacha · 01712472839</div>
                    <div className="border-b border-dashed border-slate-300 my-2" />
                    <div className="flex justify-between text-[11px] text-slate-600">
                      <span>INV: #SKP-208</span>
                      <span>06/11/2026</span>
                    </div>
                    <div className="border-b border-dashed border-slate-300 my-2" />
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <span>1. Becoral DX (10)</span>
                        <span className="font-bold">145.00</span>
                      </div>
                      <div className="flex justify-between">
                        <span>2. Bilista 20mg (10)</span>
                        <span className="font-bold">135.00</span>
                      </div>
                      <div className="flex justify-between">
                        <span>3. Lulizol 50g (1)</span>
                        <span className="font-bold">390.00</span>
                      </div>
                    </div>
                    <div className="border-b border-slate-800 my-2" />
                    <div className="flex justify-between text-sm font-bold text-slate-950">
                      <span>NET TOTAL:</span>
                      <span>Tk 670.00</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-emerald-700 font-bold mt-1">
                      <span>PAID (CASH):</span>
                      <span>Tk 670.00</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-dashed border-slate-300 text-center text-[10px] text-emerald-700 font-sans font-bold flex items-center justify-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>থার্মাল প্রিন্ট সম্পন্ন (58mm/80mm)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 4. THE THREE ECOSYSTEM PILLARS ================= */}
      <section id="ecosystem" className="bg-white border-y border-slate-200/80 py-14 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              সম্পূর্ণ স্বাস্থ্যসেবা ইকোসিস্টেম
            </span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900">
              এক প্ল্যাটফর্মে ফার্মেসি, ডাক্তার চেম্বার ও রোগী সেবা
            </h2>
            <p className="mt-2 text-slate-600 text-sm sm:text-base font-normal">
              শেখ ফার্মার ৩টি আলাদা পোর্টাল একে অপরের সাথে রিয়েল-টাইমে সংযুক্ত।
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Pillar 1: POS */}
            <div className="relative rounded-2xl border-2 border-emerald-600/40 bg-emerald-50/30 p-6 shadow-xs">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-700 text-white mb-4">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <span className="absolute top-6 right-6 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                বর্তমান পোর্টাল
              </span>
              <h3 className="text-lg font-bold text-slate-900">১. ফার্মেসি ও রিটেইল পিওএস</h3>
              <p className="mt-2 text-sm text-slate-600 font-normal leading-relaxed">
                ক্যাশ কাউন্টার বিলিং, ওষুধের মেয়াদ ট্র্যাকিং, বারকোড স্ক্যানার, ডুয়াল থার্মাল প্রিন্টিং ও দৈনিক লাভ-ক্ষতি হিসাব।
              </p>
              <div className="mt-5 pt-4 border-t border-slate-200/80 flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-emerald-800">sell.sheikhpharma.shop</span>
                <Link to="/auth" className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1">
                  লগইন করুন <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Pillar 2: Doctor Rx */}
            <div className="relative rounded-2xl border border-slate-200 bg-[#F8FAFC] p-6 hover:border-teal-300 transition">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-teal-700 text-white mb-4">
                <Stethoscope className="h-5 w-5" />
              </div>
              <span className="absolute top-6 right-6 rounded-full bg-teal-50 px-2.5 py-0.5 text-[10px] font-bold text-teal-800 border border-teal-200">
                ডাক্তার চেম্বার
              </span>
              <h3 className="text-lg font-bold text-slate-900">২. স্মার্ট প্রেসক্রিপশন (Rx)</h3>
              <p className="mt-2 text-sm text-slate-600 font-normal leading-relaxed">
                ডাক্তারদের জন্য ৩০ সেকেন্ডে ডিজিটাল প্রেসক্রিপশন তৈরি, চেম্বার কিউ ও টোকেন প্রিন্টিং এবং A4/PDF/JPG প্রিন্টিং।
              </p>
              <div className="mt-5 pt-4 border-t border-slate-200/80 flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-teal-800">rx.sheikhpharma.shop</span>
                <Link to="/rx" className="text-xs font-bold text-teal-700 hover:underline flex items-center gap-1">
                  ভিজিট করুন <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Pillar 3: Patient Portal */}
            <div className="relative rounded-2xl border border-slate-200 bg-[#F8FAFC] p-6 hover:border-sky-300 transition">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-sky-700 text-white mb-4">
                <Users className="h-5 w-5" />
              </div>
              <span className="absolute top-6 right-6 rounded-full bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold text-sky-800 border border-sky-200">
                পেশেন্ট পোর্টাল
              </span>
              <h3 className="text-lg font-bold text-slate-900">৩. রোগী সেবা পোর্টাল (Pt)</h3>
              <p className="mt-2 text-sm text-slate-600 font-normal leading-relaxed">
                রোগীরা মোবাইল নম্বর ও PID দিয়ে লগইন করে প্রেসক্রিপশন, ল্যাব রিপোর্ট এবং অনলাইনে ডাক্তারের সিরিয়াল বুক করতে পারবেন।
              </p>
              <div className="mt-5 pt-4 border-t border-slate-200/80 flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-sky-800">pt.sheikhpharma.shop</span>
                <Link to="/patient" className="text-xs font-bold text-sky-700 hover:underline flex items-center gap-1">
                  ভিজিট করুন <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 5. CORE FEATURES GRID ================= */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            শক্তিশালী মডিউলসমূহ
          </span>
          <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900">
            একটি ফার্মেসি সফলভাবে পরিচালনার প্রতিটি টুল
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs hover:border-emerald-300 transition">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 mb-4 border border-emerald-200/60">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">সুপারফাস্ট কাউন্টার বিলিং</h3>
            <p className="mt-1.5 text-sm text-slate-600 font-normal leading-relaxed">
              বারকোড স্ক্যানার এবং স্মার্ট কিবোর্ড শর্টকাট (Enter ফ্লো) দিয়ে মাউস ছাড়াই দ্রুতগতিতে ওষুধ বিক্রয় সম্পন্ন করুন।
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs hover:border-emerald-300 transition">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700 mb-4 border border-teal-200/60">
              <Printer className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">ডুয়াল ব্লুটুথ থার্মাল প্রিন্টিং</h3>
            <p className="mt-1.5 text-sm text-slate-600 font-normal leading-relaxed">
              উইন্ডোজ ড্রাইভার ছাড়াই PT-220 ও MX04 Cat Printer-এ সরাসরি ওয়েব ব্লুটুথ দিয়ে ৩ সেকেন্ডে ঝকঝকে রসিদ প্রিন্ট হয়।
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs hover:border-emerald-300 transition">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700 mb-4 border border-sky-200/60">
              <Package className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">মেডিসিন এক্সপায়ারি ও স্টক</h3>
            <p className="mt-1.5 text-sm text-slate-600 font-normal leading-relaxed">
              ওষুধের মেয়াদ শেষ হওয়ার আগেই সতর্কবার্তা এবং পাতা, বক্স ও একক পিস অনুযায়ী স্বয়ংক্রিয় স্টক সমন্বয়।
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs hover:border-emerald-300 transition">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 mb-4 border border-amber-200/60">
              <CreditCard className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">ডিজিটাল বাকি খাতা (Due Ledger)</h3>
            <p className="mt-1.5 text-sm text-slate-600 font-normal leading-relaxed">
              কাস্টমারদের বকেয়া হিসাব, আংশিক আদায় এন্ট্রি এবং এক ক্লিকে ডিউ কালেকশন ভাউচার প্রিন্ট সুবিধা।
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs hover:border-emerald-300 transition">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700 mb-4 border border-purple-200/60">
              <BarChart3 className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">লাভ-ক্ষতি ও ব্যাকডেটেড এন্ট্রি</h3>
            <p className="mt-1.5 text-sm text-slate-600 font-normal leading-relaxed">
              প্রতিদিনের কেনাবেচা, নিট প্রফিট রিপোর্ট এবং পূর্ববর্তী দিনের বিক্রয় হিসাব মেলানোর ব্যাকডেটেড সেলস সুবিধা।
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs hover:border-emerald-300 transition">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 mb-4 border border-emerald-200/60">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">স্টাফ প্রাইভেসি ও ক্লাউড নিরাপত্তা</h3>
            <p className="mt-1.5 text-sm text-slate-600 font-normal leading-relaxed">
              সেলসম্যানদের কাছ থেকে কেনা দাম ও লাভ গোপন রাখার সুবিধা এবং শতভাগ নিরাপদ ক্লাউড ডাটাবেজ।
            </p>
          </div>
        </div>
      </section>

      {/* ================= 6. HARDWARE SUPPORT ================= */}
      <section id="hardware" className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 shadow-xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6 space-y-3 text-left">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                ডিভাইস ও প্রিন্টার সাপোর্ট
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                কম্পিউটার, ট্যাবলেট বা মোবাইল — সব ডিভাইসে সচল
              </h2>
              <p className="text-slate-600 text-sm font-normal leading-relaxed">
                কোনো ভারী সফটওয়্যার বা ড্রাইভার ইন্সটল ছাড়াই সরাসরি ব্রাউজার থেকে পিসি এবং মোবাইলে সমান গতিতে কাজ করে।
              </p>
              <div className="grid grid-cols-2 gap-2.5 pt-2 text-xs font-semibold text-slate-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>PT-220 58mm ব্লুটুথ প্রিন্টার</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>MX04 Cat পকেট প্রিন্টার</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>80mm POS ডেস্কটপ প্রিন্টার</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>USB ও ওয়্যারলেস বারকোড স্ক্যানার</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 grid grid-cols-2 gap-3.5">
              <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4 text-center">
                <Laptop className="h-7 w-7 text-emerald-700 mx-auto mb-2" />
                <div className="font-bold text-slate-900 text-sm">ডেস্কটপ ও ল্যাপটপ</div>
                <div className="text-xs text-slate-500 mt-0.5 font-normal">কিবোর্ড শর্টকাট কাউন্টার</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4 text-center">
                <Smartphone className="h-7 w-7 text-teal-700 mx-auto mb-2" />
                <div className="font-bold text-slate-900 text-sm">ট্যাবলেট ও মোবাইল</div>
                <div className="text-xs text-slate-500 mt-0.5 font-normal">টাচ-ফ্রেন্ডলি বিলিং</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4 text-center">
                <Printer className="h-7 w-7 text-sky-700 mx-auto mb-2" />
                <div className="font-bold text-slate-900 text-sm">ড্রাইভারলেস প্রিন্ট</div>
                <div className="text-xs text-slate-500 mt-0.5 font-normal">সরাসরি ওয়েব ব্লুটুথ</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4 text-center">
                <QrCode className="h-7 w-7 text-amber-700 mx-auto mb-2" />
                <div className="font-bold text-slate-900 text-sm">বারকোড স্ক্যান</div>
                <div className="text-xs text-slate-500 mt-0.5 font-normal">লেজার ও ক্যামেরা স্ক্যানার</div>
              </div>
            </div>
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
                <span className="text-base font-bold text-slate-900">শেখ ফার্মা (Sheikh Pharma)</span>
              </div>
              <p className="text-xs text-slate-500 max-w-md font-normal leading-relaxed">
                {SHEIKH_PHARMA_DETAILS.address}
              </p>
              <div className="text-xs text-slate-700 font-semibold">
                হেল্পলাইন: {SHEIKH_PHARMA_DETAILS.phones} · ইমেইল: {SHEIKH_PHARMA_DETAILS.email}
              </div>
            </div>

            <div className="md:col-span-3 space-y-2">
              <div className="font-bold text-slate-900 text-xs uppercase tracking-wider">ইকোসিস্টেম পোর্টাল</div>
              <ul className="space-y-1.5 text-xs font-medium">
                <li>
                  <Link to="/" className="text-emerald-700 font-bold">
                    ফার্মেসি পিওএস (sell.sheikhpharma.shop)
                  </Link>
                </li>
                <li>
                  <Link to="/rx" className="text-slate-600 hover:text-teal-700 transition">
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
              <div className="font-bold text-slate-900 text-xs uppercase tracking-wider">দ্রুত অ্যাক্সেস</div>
              <ul className="space-y-1.5 text-xs font-medium">
                <li>
                  <Link to="/auth" className="text-slate-600 hover:text-emerald-700 transition">
                    স্টাফ ও অ্যাডমিন লগইন
                  </Link>
                </li>
                <li>
                  <a href={`tel:${SHEIKH_PHARMA_DETAILS.phonesRaw[0]}`} className="text-slate-600 hover:text-emerald-700 transition">
                    সাপোর্ট ও হেল্পলাইন
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400">
            <div>© {new Date().getFullYear()} শেখ ফার্মা ডিজিটাল হেলথ প্ল্যাটফর্ম · সর্বস্বত্ব সংরক্ষিত।</div>
            <div className="mt-1 sm:mt-0">Powered by Sheikh Pharma Cloud POS</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
