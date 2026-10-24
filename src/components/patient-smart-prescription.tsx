import React, { useState } from "react";
import {
  FileText,
  Volume2,
  VolumeX,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  User,
  Stethoscope,
  HeartPulse,
  Thermometer,
  Activity,
  Droplets,
  HelpCircle,
  Share2,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fmtDate as formatDate } from "@/lib/format-date";
import { explainPrescription, type PrescriptionExplanation } from "@/lib/patient-explainer";
import { toast } from "sonner";

export interface PatientSmartPrescriptionProps {
  prescription: {
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
  };
  onDownloadJpg?: () => void;
}

export function PatientSmartPrescription({
  prescription,
  onDownloadJpg,
}: PatientSmartPrescriptionProps) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  // Compute plain-Bangla intelligent explanation
  const exp: PrescriptionExplanation = explainPrescription(prescription);

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

    // Build speech text
    const textParts = [
      `আমার প্রেসক্রিপশন বিশ্লেষণ।`,
      `রোগীর নাম: ${prescription.patient_name || "সম্মানিত রোগী"}।`,
      `চিকিৎসক: ${prescription.doctor_name || "ডাক্তার"}।`,
      exp.overallCondition,
      `আপনার জন্য ${exp.medicines.length}টি ওষুধ নির্ধারণ করা হয়েছে।`,
    ];

    exp.medicines.forEach((m, idx) => {
      textParts.push(
        `${idx + 1}. ${m.cleanName}। এটি ${m.category}। ${m.summaryFrequency}। ${m.howToTake}`
      );
    });

    if (exp.lifestyleAdvice.length > 0) {
      textParts.push(`পরামর্শ: ${exp.lifestyleAdvice.join(" ")}`);
    }

    const fullSpeech = textParts.join(" ");
    const utterance = new SpeechSynthesisUtterance(fullSpeech);
    utterance.lang = "bn-BD";
    utterance.rate = 0.95;

    // Try finding Bengali voice
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-cyan-500/10 border border-emerald-500/25">
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-600 text-white font-bold text-xs gap-1 py-1">
            <Sparkles className="h-3.5 w-3.5" />
            <span>প্রেসক্রিপশন বিশ্লেষণ সম্পন্ন</span>
          </Badge>
          <span className="text-xs text-muted-foreground font-medium">
            তারিখ: {formatDate(prescription.rx_date)}
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
                : "border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
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
            <span>{showOriginal ? "স্মার্ট ভিউ" : "মূল প্রেসক্রিপশন"}</span>
          </Button>
        </div>
      </div>

      {/* ================= RAW ORIGINAL VIEW TOGGLE ================= */}
      {showOriginal && (
        <Card className="border-border/80 bg-muted/20">
          <CardContent className="p-4 space-y-2 text-xs">
            <div className="font-bold text-sm text-foreground">মূল প্রেসক্রিপশন লাইনসমূহ:</div>
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

      {/* ================= MAIN SMART HERO CARD ================= */}
      <Card className="border-border/80 bg-card/95 shadow-md overflow-hidden rounded-3xl">
        <CardContent className="p-4 sm:p-6 space-y-5">
          {/* Header & Overall Summary Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start border-b border-border/60 pb-5">
            <div className="lg:col-span-7 space-y-1">
              <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                <span>আমার প্রেসক্রিপশন</span>
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                সহজ ভাষায় প্রেসক্রিপশন বিশ্লেষণ ও ওষুধ সেবনের নিয়ম
              </p>
              <p className="text-xs text-muted-foreground pt-1">
                রোগীর বোঝার সুবিধার্থে প্রেসক্রিপশনের জটিল মেডিকেল পরিভাষাকে সহজ বাংলায় উপস্থাপন করা হয়েছে।
              </p>
            </div>

            {/* সার্বিক অবস্থা Card */}
            <div className="lg:col-span-5 rounded-2xl bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-teal-500/10 border border-emerald-500/30 p-3.5 shadow-sm">
              <div className="flex items-center gap-2 font-bold text-xs text-emerald-700 dark:text-emerald-300 uppercase tracking-wider mb-1">
                <HeartPulse className="h-3.5 w-3.5" />
                <span>সার্বিক অবস্থা</span>
              </div>
              <p className="text-xs text-foreground leading-relaxed font-medium">
                {exp.overallCondition}
              </p>
            </div>
          </div>

          {/* ================= 3-COLUMN INFO ROW ================= */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* 1. রোগীর তথ্য */}
            <div className="rounded-2xl border border-border/80 bg-muted/20 p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground border-b border-border/50 pb-1.5">
                <User className="h-3.5 w-3.5 text-primary" />
                <span>রোগীর তথ্য</span>
              </div>
              <div className="text-xs space-y-1 font-medium">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">নাম:</span>
                  <span className="font-bold text-foreground">{prescription.patient_name || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">বয়স:</span>
                  <span>{prescription.patient_age || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">লিঙ্গ:</span>
                  <span>{prescription.patient_gender || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">তারিখ:</span>
                  <span>{formatDate(prescription.rx_date)}</span>
                </div>
                {prescription.patient_code && (
                  <div className="flex justify-between pt-1 border-t border-border/40">
                    <span className="text-muted-foreground">UID:</span>
                    <Badge variant="secondary" className="font-mono text-[10px] text-primary">
                      {prescription.patient_code}
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            {/* 2. চিকিৎসক */}
            <div className="rounded-2xl border border-border/80 bg-muted/20 p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground border-b border-border/50 pb-1.5">
                <Stethoscope className="h-3.5 w-3.5 text-primary" />
                <span>চিকিৎসক</span>
              </div>
              <div className="text-xs space-y-1">
                <div className="font-bold text-foreground text-sm">
                  {prescription.doctor_name || "চিকিৎসক"}
                </div>
                <div className="text-muted-foreground">
                  {prescription.doctor_qualification || "অভিজ্ঞ চিকিৎসক"}
                </div>
                <div className="text-muted-foreground text-[11px] pt-1 border-t border-border/40">
                  {prescription.clinic || "শেখ ফার্মা চেম্বার ও ডায়াগনস্টিক"}
                </div>
              </div>
            </div>

            {/* 3. চিকিৎসার লক্ষ্য */}
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 border-b border-emerald-500/20 pb-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>চিকিৎসার লক্ষ্য</span>
              </div>
              <ul className="text-xs space-y-1 text-foreground font-medium">
                {exp.treatmentGoals.map((g, idx) => (
                  <li key={idx} className="flex items-center gap-1.5">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓</span>
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ================= SYMPTOMS, VITALS & INVESTIGATIONS ================= */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* রোগীর সমস্যা */}
            <div className="rounded-2xl border border-border/80 bg-card p-3.5 space-y-2">
              <div className="text-xs font-bold text-foreground border-b border-border/50 pb-1 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-amber-500" />
                <span>রোগীর সমস্যা (Diagnosis / Symptoms)</span>
              </div>
              <div className="text-xs space-y-1.5 pt-1">
                {prescription.diagnosis ? (
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-800 dark:text-amber-200 font-semibold">
                    • {prescription.diagnosis}
                  </div>
                ) : (
                  <p className="text-muted-foreground italic text-[11px]">কোনো নির্দিষ্ট ডায়াগনোসিস উল্লেখ নেই।</p>
                )}
                <p className="text-[10px] text-muted-foreground">
                  উপসর্গ পরিবর্তন হলে বা অস্বস্তি বাড়লে চিকিৎসকের সাথে যোগাযোগ করুন।
                </p>
              </div>
            </div>

            {/* শারীরিক অবস্থা (O/E) */}
            <div className="rounded-2xl border border-border/80 bg-card p-3.5 space-y-2">
              <div className="text-xs font-bold text-foreground border-b border-border/50 pb-1 flex items-center gap-1.5">
                <HeartPulse className="h-3.5 w-3.5 text-rose-500" />
                <span>শারীরিক অবস্থা (O/E)</span>
              </div>
              <div className="space-y-1.5 text-xs pt-1">
                {exp.vitalsExplained.length > 0 ? (
                  exp.vitalsExplained.map((v, idx) => (
                    <div key={idx} className="flex items-center justify-between p-1.5 rounded-lg bg-muted/40">
                      <div>
                        <span className="font-bold text-foreground">{v.value}</span>
                        <span className="text-[10px] text-muted-foreground block">{v.label}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-medium">
                        {v.status}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-[11px] italic">ভাইটালস রেকর্ড করা নেই।</p>
                )}
              </div>
            </div>

            {/* যে টেস্টগুলো করতে বলা হয়েছে */}
            <div className="rounded-2xl border border-border/80 bg-card p-3.5 space-y-2">
              <div className="text-xs font-bold text-foreground border-b border-border/50 pb-1 flex items-center gap-1.5">
                <Droplets className="h-3.5 w-3.5 text-cyan-500" />
                <span>যে টেস্টগুলো করতে বলা হয়েছে</span>
              </div>
              <div className="space-y-2 text-xs pt-1">
                {exp.investigationsExplained.length > 0 ? (
                  exp.investigationsExplained.map((inv, idx) => (
                    <div key={idx} className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                      <div className="font-bold text-cyan-900 dark:text-cyan-200">{inv.name}</div>
                      <div className="text-[11px] text-cyan-800/80 dark:text-cyan-300/80 mt-0.5">{inv.reason}</div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-[11px] italic">বর্তমানে কোনো নতুন টেস্ট দেওয়া হয়নি।</p>
                )}
              </div>
            </div>
          </div>

          {/* ================= MEDICATION SCHEDULE TABLE ================= */}
          <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-sm sm:text-base text-foreground">
                  ওষুধ গ্রহণের সময়সূচি
                </h3>
              </div>
              <Badge variant="secondary" className="font-semibold text-xs">
                চিকিৎসার সময়কাল: {prescription.lines?.[0]?.duration || "৭ দিন"}
              </Badge>
            </div>

            {/* Schedule Table (Desktop) / Cards (Mobile) */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground bg-muted/30">
                    <th className="p-2.5 font-bold">ওষুধের নাম</th>
                    <th className="p-2.5 font-bold text-center">
                      <span className="block text-amber-500 font-extrabold">🌅 সকাল</span>
                      <span className="text-[10px] font-normal text-muted-foreground">৬টা - ১০টা</span>
                    </th>
                    <th className="p-2.5 font-bold text-center">
                      <span className="block text-orange-500 font-extrabold">☀️ দুপুর</span>
                      <span className="text-[10px] font-normal text-muted-foreground">১২টা - ২টা</span>
                    </th>
                    <th className="p-2.5 font-bold text-center">
                      <span className="block text-indigo-500 font-extrabold">🌙 রাত</span>
                      <span className="text-[10px] font-normal text-muted-foreground">৮টা - শোবার আগে</span>
                    </th>
                    <th className="p-2.5 font-bold text-right">মেয়াদ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-medium">
                  {exp.medicines.map((m, i) => (
                    <tr key={i} className="hover:bg-muted/30 transition">
                      <td className="p-2.5 font-bold text-foreground">
                        <div className="flex items-center gap-1.5">
                          <span>{m.cleanName}</span>
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-primary/30 text-primary">
                            {m.formType}
                          </Badge>
                        </div>
                        <span className="text-[11px] font-normal text-muted-foreground block">{m.category}</span>
                      </td>
                      <td className="p-2.5 text-center font-bold text-foreground">
                        {m.morningDose !== "—" ? (
                          <span className="inline-block px-2 py-1 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                            ✓ {m.morningDose}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center font-bold text-foreground">
                        {m.noonDose !== "—" ? (
                          <span className="inline-block px-2 py-1 rounded-md bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/20">
                            ✓ {m.noonDose}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center font-bold text-foreground">
                        {m.nightDose !== "—" ? (
                          <span className="inline-block px-2 py-1 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                            ✓ {m.nightDose}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="p-2.5 text-right font-bold text-foreground">
                        {m.durationText}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary Highlights Strip */}
            <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60 text-xs flex flex-wrap gap-x-4 gap-y-1 font-semibold text-foreground">
              {exp.medicines.map((m, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="text-primary">•</span>
                  <span><strong>{m.cleanName}:</strong> {m.summaryFrequency}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ================= DETAILED MEDICINE CARDS & DRUG INTERACTION ================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Detailed Cards (8 Cols) */}
            <div className="lg:col-span-8 space-y-3">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-primary" />
                <span>ওষুধ সম্পর্কে বিস্তারিত তথ্য (Patient Drug Guide)</span>
              </h3>

              <div className="space-y-3">
                {exp.medicines.map((m, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-border/80 bg-card p-3.5 space-y-2.5 shadow-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                          {idx + 1}
                        </span>
                        <h4 className="font-bold text-sm text-foreground">
                          {m.cleanName}
                        </h4>
                      </div>
                      <Badge variant="secondary" className="text-xs font-semibold">
                        {m.category}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      <div className="space-y-1">
                        <span className="font-bold text-muted-foreground block text-[11px]">কেন দেওয়া হয়েছে?</span>
                        <p className="text-foreground font-medium">{m.purpose}</p>
                      </div>

                      <div className="space-y-1">
                        <span className="font-bold text-muted-foreground block text-[11px]">কীভাবে খাবেন?</span>
                        <p className="text-emerald-700 dark:text-emerald-300 font-semibold">{m.howToTake}</p>
                      </div>

                      <div className="space-y-1">
                        <span className="font-bold text-muted-foreground block text-[11px]">সাধারণ পার্শ্বপ্রতিক্রিয়া</span>
                        <p className="text-muted-foreground">{m.sideEffects}</p>
                      </div>

                      <div className="space-y-1">
                        <span className="font-bold text-muted-foreground block text-[11px]">সতর্কতা</span>
                        <p className="text-amber-700 dark:text-amber-400 font-medium">{m.precautions}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Drug Interaction & Safety Card (4 Cols) */}
            <div className="lg:col-span-4 space-y-3">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>ওষুধগুলো একসাথে খাওয়া যাবে?</span>
              </h3>

              <div className="rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-card to-teal-500/10 p-4 space-y-3 shadow-sm">
                <div className="text-center space-y-1 border-b border-emerald-500/20 pb-3">
                  <div className="flex justify-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600">
                      <CheckCircle2 className="h-6 w-6" />
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-foreground">
                    নিরাপদ ও অনুমোদিত কম্বিনেশন
                  </h4>
                  <p className="text-[11px] text-muted-foreground">Drug-Drug Interaction Analysis</p>
                </div>

                <div className="text-xs text-foreground font-medium leading-relaxed bg-background/80 p-3 rounded-xl border border-emerald-500/20">
                  {exp.drugInteraction.message}
                </div>

                <div className="text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded-xl">
                  💡 <strong>পরামর্শ:</strong> অন্য কোনো দীর্ঘমেয়াদি ওষুধ (যেমন প্রেশার, ডায়াবেটিস) নিয়মিত খেলে আপনার চিকিৎসক বা ফার্মাসিস্টকে আগে থেকে জানিয়ে রাখুন।
                </div>
              </div>
            </div>
          </div>

          {/* ================= BOTTOM ADVICE & RED FLAGS ================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border/60 pt-4">
            {/* আপনার জন্য পরামর্শ */}
            <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground border-b border-border/50 pb-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>আপনার জন্য পরামর্শ (Doctor Advice & Lifestyle)</span>
              </div>
              <ul className="text-xs space-y-1.5 text-foreground font-medium">
                {exp.lifestyleAdvice.map((a, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-primary font-bold mt-0.5">•</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* কখন ডাক্তারের সাথে যোগাযোগ করবেন */}
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-400 border-b border-rose-500/20 pb-2">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                <span>কখন দ্রুত চিকিৎসকের সাথে যোগাযোগ করবেন? (Red Flags)</span>
              </div>
              <ul className="text-xs space-y-1.5 text-rose-950 dark:text-rose-200 font-medium">
                {exp.dangerSigns.map((s, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-rose-500 font-bold mt-0.5">⚠</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ================= FOOTER DISCLAIMER ================= */}
          <div className="p-3 rounded-xl bg-muted/30 border border-border/60 text-center text-[11px] text-muted-foreground">
            এই বিশ্লেষণ শুধুমাত্র আপনার ওষুধ সেবনের সুবিধার্থে সহজ ভাষায় তৈরি। যেকোনো জটিলতায় সবসময় রেজিস্টার্ড চিকিৎসকের প্রত্যক্ষ পরামর্শ মেনে চলুন।
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
