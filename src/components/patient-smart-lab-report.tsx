import React, { useState } from "react";
import {
  FlaskConical,
  Volume2,
  VolumeX,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  Info,
  Calendar,
  Building2,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fmtDate as formatDate } from "@/lib/format-date";
import { explainLabReport, type LabReportExplanation } from "@/lib/patient-explainer";
import { toast } from "sonner";

export interface PatientSmartLabReportProps {
  report: {
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
  };
}

export function PatientSmartLabReport({ report }: PatientSmartLabReportProps) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);

  // Compute plain-Bangla intelligent explanation
  const exp: LabReportExplanation = explainLabReport(report);

  // Audio Speech Synthesis in Bengali
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

    const textParts = [
      `আমার ল্যাব রিপোর্ট বিশ্লেষণ।`,
      `টেস্টের নাম: ${exp.testName}।`,
      `মোট প্যারামিটার: ${exp.totalParameters}টি। এর মধ্যে ${exp.normalCount}টি মান সম্পূর্ণ স্বাভাবিক।`,
      exp.reassuranceMessage,
    ];

    if (exp.mildCount > 0) {
      textParts.push(`সামান্য তারতম্য রয়েছে এমন উপাদানগুলো হলো:`);
      exp.parameters
        .filter((p) => p.status === "mild" || p.status === "abnormal")
        .forEach((p) => {
          textParts.push(`${p.name}: ফলাফল ${p.result} ${p.unit}।`);
        });
    }

    const fullSpeech = textParts.join(" ");
    const utterance = new SpeechSynthesisUtterance(fullSpeech);
    utterance.lang = "bn-BD";
    utterance.rate = 0.95;

    const voices = window.speechSynthesis.getVoices();
    const bnVoice = voices.find((v) => v.lang.startsWith("bn") || v.lang.includes("BD") || v.lang.includes("IN"));
    if (bnVoice) utterance.voice = bnVoice;

    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.speak(utterance);
    setIsPlayingAudio(true);
    toast.success("বাংলা অডিও বিবরণ শুরু হয়েছে...");
  };

  return (
    <div className="space-y-4 text-foreground animate-in fade-in duration-300">
      {/* ================= TOP ACTION BAR ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-2xl bg-gradient-to-r from-teal-500/10 via-emerald-500/5 to-cyan-500/10 border border-teal-500/25">
        <div className="flex items-center gap-2">
          <Badge className="bg-teal-600 text-white font-bold text-xs gap-1 py-1">
            <FlaskConical className="h-3.5 w-3.5" />
            <span>ল্যাব টেস্ট রিপোর্ট বিশ্লেষণ</span>
          </Badge>
          <span className="text-xs text-muted-foreground font-medium">
            তারিখ: {report.reported_at_text || formatDate(report.created_at)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleToggleAudio}
            className={`h-8 text-xs font-bold gap-1.5 cursor-pointer ${
              isPlayingAudio
                ? "bg-amber-500 text-white border-amber-500 hover:bg-amber-600"
                : "border-teal-500/30 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/20"
            }`}
          >
            {isPlayingAudio ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            <span>{isPlayingAudio ? "অডিও থামান" : "অডিও শুনুন"}</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowOriginal(!showOriginal)}
            className="h-8 text-xs font-medium cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5 mr-1" />
            <span>{showOriginal ? "স্মার্ট ভিউ" : "মূল রিপোর্ট"}</span>
          </Button>
        </div>
      </div>

      {/* ================= RAW ORIGINAL TABLE TOGGLE ================= */}
      {showOriginal && (
        <Card className="border-border/80 bg-muted/20">
          <CardContent className="p-4 space-y-2 text-xs">
            <div className="font-bold text-sm text-foreground">মূল ল্যাব রিপোর্ট টেবিল:</div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-1">Parameter</th>
                    <th className="py-1">Result</th>
                    <th className="py-1">Unit</th>
                    <th className="py-1">Ref. Range</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows?.map((row: any, i: number) => (
                    <tr key={i} className="border-b border-border/30">
                      <td className="py-1 font-semibold">{row.name || row.test}</td>
                      <td className="py-1">{row.result}</td>
                      <td className="py-1">{row.unit}</td>
                      <td className="py-1 text-muted-foreground">{row.ref || row.reference_range}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ================= MAIN SMART LAB HERO CARD ================= */}
      <Card className="border-border/80 bg-card/95 shadow-md overflow-hidden rounded-3xl">
        <CardContent className="p-4 sm:p-6 space-y-5">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                আমার রিপোর্ট
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-teal-600 dark:text-teal-400">
                সহজ ভাষায় ল্যাব রিপোর্ট বিশ্লেষণ ও স্বাস্থ্য পর্যালোচনা
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 font-semibold text-foreground">
                <FlaskConical className="h-3.5 w-3.5 text-primary" />
                <span>{exp.testName}</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                <span>{report.clinic || "শেখ ফার্মা ডায়াগনস্টিক ল্যাব"}</span>
              </span>
            </div>
          </div>

          {/* ================= SUMMARY STATS COUNTERS & REASSURANCE ================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* Stat Counters (5 Cols) */}
            <div className="lg:col-span-5 grid grid-cols-3 gap-2.5">
              {/* স্বাভাবিক */}
              <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/10 p-3.5 text-center flex flex-col justify-center shadow-xs">
                <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-200 uppercase tracking-wider">
                  স্বাভাবিক
                </span>
                <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 my-1">
                  {exp.normalCount}
                </span>
                <span className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 font-medium">
                  প্যারামিটার
                </span>
              </div>

              {/* সামান্য তারতম্য */}
              <div className="rounded-2xl border-2 border-amber-500/40 bg-amber-500/10 p-3.5 text-center flex flex-col justify-center shadow-xs">
                <span className="text-[11px] font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wider">
                  সামান্য তারতম্য
                </span>
                <span className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 my-1">
                  {exp.mildCount}
                </span>
                <span className="text-[10px] text-amber-700/80 dark:text-amber-300/80 font-medium">
                  প্যারামিটার
                </span>
              </div>

              {/* অস্বাভাবিক */}
              <div className="rounded-2xl border-2 border-rose-500/30 bg-rose-500/10 p-3.5 text-center flex flex-col justify-center shadow-xs">
                <span className="text-[11px] font-bold text-rose-800 dark:text-rose-200 uppercase tracking-wider">
                  অস্বাভাবিক
                </span>
                <span className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 my-1">
                  {exp.abnormalCount}
                </span>
                <span className="text-[10px] text-rose-700/80 dark:text-rose-300/80 font-medium">
                  প্যারামিটার
                </span>
              </div>
            </div>

            {/* Reassurance Banner (7 Cols) */}
            <div className="lg:col-span-7 rounded-2xl bg-gradient-to-br from-teal-500/15 via-card to-emerald-500/10 border border-teal-500/30 p-4 flex flex-col justify-center shadow-sm">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-500/20 text-teal-600">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <h3 className="font-bold text-sm sm:text-base text-foreground">
                  {exp.reassuranceTitle}
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-foreground/90 font-medium leading-relaxed">
                {exp.reassuranceMessage}
              </p>
            </div>
          </div>

          {/* ================= DETAILED PARAMETERS TABLE ================= */}
          <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-teal-600" />
                <h3 className="font-bold text-sm sm:text-base text-foreground">
                  টেস্টের বিস্তারিত ফলাফল ও সহজ ব্যাখ্যা
                </h3>
              </div>
              <Badge variant="outline" className="font-semibold text-xs border-primary/30 text-primary">
                মোট {exp.totalParameters}টি পরিমাপ
              </Badge>
            </div>

            {/* Parameter Rows Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground bg-muted/30">
                    <th className="p-2.5 font-bold">প্যারামিটার</th>
                    <th className="p-2.5 font-bold">ফলাফল</th>
                    <th className="p-2.5 font-bold">স্বাভাবিক সীমা</th>
                    <th className="p-2.5 font-bold text-center">অবস্থা</th>
                    <th className="p-2.5 font-bold">সহজ বাংলা ব্যাখ্যা</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-medium">
                  {exp.parameters.map((p, idx) => (
                    <tr key={idx} className="hover:bg-muted/30 transition">
                      <td className="p-2.5 font-bold text-foreground">
                        <span>{idx + 1}. </span>
                        <span>{p.name}</span>
                      </td>
                      <td className="p-2.5 font-bold text-foreground whitespace-nowrap">
                        <span className="text-sm">{p.result}</span>
                        {p.unit && <span className="text-[11px] text-muted-foreground ml-1">{p.unit}</span>}
                      </td>
                      <td className="p-2.5 text-muted-foreground whitespace-nowrap">
                        {p.refRange}
                      </td>
                      <td className="p-2.5 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold px-2 py-0.5 whitespace-nowrap ${
                            p.status === "normal"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                              : p.status === "mild"
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                              : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30"
                          }`}
                        >
                          {p.statusText}
                        </Badge>
                      </td>
                      <td className="p-2.5 text-foreground/80 font-normal">
                        {p.banglaMeaning}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ================= SUMMARY & RISK CARD ================= */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* স্বাভাবিক ফলাফল কার্ড */}
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 space-y-1.5">
              <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                <span>স্বাভাবিক ফলাফল ({exp.normalCount}টি)</span>
              </div>
              <p className="text-xs text-foreground font-medium">
                বেশিরভাগ গুরুত্বপূর্ণ মান সম্পূর্ণ স্বাভাবিক সীমার মধ্যে রয়েছে।
              </p>
            </div>

            {/* সামান্য তারতম্য কার্ড */}
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-1.5">
              <div className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                <span>সামান্য তারতম্য ({exp.mildCount}টি)</span>
              </div>
              <p className="text-xs text-foreground font-medium">
                সাধারণত হালকা এলার্জি, সাময়িক ইনফেকশন বা পানি কম পানে মৃদু তারতম্য দেখা যেতে পারে।
              </p>
            </div>

            {/* ঝুঁকির স্তর */}
            <div className="rounded-2xl border border-border/80 bg-muted/20 p-3.5 space-y-1.5">
              <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Info className="h-4 w-4 text-primary" />
                <span>ঝুঁকির স্তর: <strong className="text-primary">{exp.riskLevel}</strong></span>
              </div>
              <p className="text-xs text-muted-foreground font-medium">
                এই রিপোর্টে কোনো তাৎক্ষণিক বিপজ্জনক সংকেত পাওয়া যায়নি।
              </p>
            </div>
          </div>

          {/* ================= PATIENT ACTION & DANGER SIGNS ================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border/60 pt-4">
            {/* রোগীর করণীয় */}
            <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground border-b border-border/50 pb-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>রোগীর করণীয় (Patient Next Steps)</span>
              </div>
              <ul className="text-xs space-y-1.5 text-foreground font-medium">
                {exp.patientTips.map((tip, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-0.5">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* কখন দ্রুত ডাক্তারকে জানাবেন */}
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-400 border-b border-rose-500/20 pb-2">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                <span>কখন দ্রুত ডাক্তারকে জানাবেন?</span>
              </div>
              <ul className="text-xs space-y-1.5 text-rose-950 dark:text-rose-200 font-medium">
                {exp.dangerSigns.map((sign, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-rose-500 font-bold mt-0.5">⚠</span>
                    <span>{sign}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ================= INTERACTIVE FAQS SECTION ================= */}
          <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-primary" />
              <span>আপনার সাধারণ প্রশ্ন ও উত্তর (FAQs)</span>
            </h3>

            <div className="space-y-2">
              {exp.faqs.map((faq, idx) => {
                const isOpen = activeFaq === idx;
                return (
                  <div
                    key={idx}
                    className="rounded-xl border border-border/60 bg-muted/20 overflow-hidden transition"
                  >
                    <button
                      type="button"
                      onClick={() => setActiveFaq(isOpen ? null : idx)}
                      className="w-full flex items-center justify-between p-3 text-left text-xs font-bold text-foreground hover:bg-muted/40 cursor-pointer"
                    >
                      <span>💬 {faq.question}</span>
                      {isOpen ? <ChevronUp className="h-4 w-4 text-primary shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </button>
                    {isOpen && (
                      <div className="p-3 pt-0 text-xs text-muted-foreground font-medium leading-relaxed border-t border-border/40 mt-1 bg-background/50 animate-in fade-in">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ================= FOOTER DISCLAIMER ================= */}
          <div className="p-3 rounded-xl bg-muted/30 border border-border/60 text-center text-[11px] text-muted-foreground">
            এই রিপোর্ট ব্যাখ্যা কৃত্রিম বুদ্ধিমত্তা ও ক্লিনিক্যাল ডাটাবেসের সহায়তায় রোগীর সাধারণ ধারণার জন্য তৈরি। চূড়ান্ত চিকিৎসার জন্য অবশ্যই ডাক্তারের পরামর্শ নিন।
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
