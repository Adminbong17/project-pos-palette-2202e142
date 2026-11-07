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
  Info,
  Sun,
  Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fmtDate as formatDate } from "@/lib/format-date";
import { explainPrescription, type PrescriptionExplanation } from "@/lib/patient-explainer";
import { splitDoctorQualification } from "@/lib/doctor-format";
import { useMedicinesDbReady } from "@/lib/medicines-db";
import { toast } from "sonner";

export const DEFAULT_PDF_RX = {
  id: "pdf-rx-sample",
  rx_no: "RX-2024-0923",
  rx_date: "2024-09-23",
  patient_name: "নমুনা রোগী",
  patient_code: "P-4509",
  patient_age: "৪৫ বছর",
  patient_gender: "পুরুষ",
  doctor_name: "Prof. Dr. Asif Bhuiyan",
  doctor_qualification: "MBBS, FCPS (Medicine)",
  doctor_designation: "Professor",
  doctor_department: "Department of Medicine",
  doctor_institution: "Sher-e-Bangla Medical College, Barishal",
  clinic: "শেখ ফার্মা চেম্বার",
  overallCondition:
    "চিকিৎসক আপনার শারীরিক সমস্যাগুলো পর্যালোচনা করে এই ব্যবস্থাপত্র দিয়েছেন। নির্ধারিত ওষুধ নিয়মমতো নিন, পানি বেশি পান করুন এবং প্রয়োজনীয় পরীক্ষা সম্পন্ন করুন।",
  treatmentGoals: [
    "জ্বর উপশম করা",
    "সংক্রমণ নিয়ন্ত্রণ করা",
    "ব্যথা ও অস্বস্তি কমানো",
    "শরীরকে দ্রুত সুস্থ হতে সাহায্য করা",
  ],
  symptoms: [
    "জ্বর ও শরীর ব্যথা",
    "শারীরিক দুর্বলতা",
  ],
  symptomsNote:
    "নোট: এগুলো এই ভিজিটে নথিভুক্ত লক্ষণ। উপসর্গ পরিবর্তন হলে ডাক্তারের সাথে যোগাযোগ করুন।",
  vitals: [
    {
      label: "BP (রক্তচাপ)",
      value: "120/80 mmHg",
      status: "স্বাভাবিক",
      note: "রক্তচাপের নথিবদ্ধ মাত্রা।",
    },
    {
      label: "Pulse (নাড়ির গতি)",
      value: "74 bpm",
      status: "স্বাভাবিক",
      note: "হৃদস্পন্দনের নথিবদ্ধ গতি।",
    },
  ],
  investigations: [
    {
      name: "CBC (Complete Blood Count)",
      reason:
        "রক্তের বিভিন্ন উপাদান যেমন হিমোগ্লোবিন, শ্বেত রক্তকণিকা ইত্যাদি দেখে সংক্রমণ বা রক্তের অবস্থা বোঝাতে সাহায্য করবে।",
    },
  ],
  schedule: [
    {
      name: "Napa (Paracetamol) 500 mg",
      morning: "✓ ১টি ট্যাবলেট",
      noon: "✓ ১টি ট্যাবলেট",
      night: "✓ ১টি ট্যাবলেট",
      duration: "৫ দিন",
      instructions: "ভরা পেটে",
    },
  ],
  scheduleSummary: [
    "Napa 500 mg: প্রতিদিন ৩ বার (সকাল-দুপুর-রাত) — ভরা পেটে",
  ],
  medicinesDetailed: [
    {
      name: "Napa (Paracetamol) 500 mg",
      badge: "ব্যথা বা জ্বরের ওষুধ",
      badgeColor: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300",
      whyGiven: "জ্বর, মাথাব্যথা, শরীর ব্যথা ও ব্যথা উপশমে সাহায্য করে।",
      howToTake: [
        "সকাল: ✓ ১টি ট্যাবলেট | দুপুর: ✓ ১টি ট্যাবলেট | রাত: ✓ ১টি ট্যাবলেট",
        "ভরা পেটে",
        "মেয়াদ: ৫ দিন",
      ],
      sideEffects: [
        "বমি বমি ভাব",
        "অ্যালার্জি (বিরল)",
      ],
      precautions: [
        "নির্ধারিত মাত্রার বেশি খাবেন না",
        "লিভার রোগ থাকলে ডাক্তারের পরামর্শ নিন",
      ],
    },
  ],
  drugInteraction: {
    title: "প্রেসক্রিপশনের ওষুধগুলোর মধ্যে কোনো ক্ষতিকর Drug-Drug Interaction পাওয়া যায়নি।",
    sub1: "চিকিৎসকের নির্দেশিত নিয়ম ও সময় অনুযায়ী ওষুধগুলো নিরাপদে সেবন করা যাবে।",
    sub2: "তবে অন্য কোনো ওষুধ নিয়মিত খেলে ডাক্তার বা ফার্মাসিস্টকে জানিয়ে নিন।",
  },
  adviceList: [
    "পর্যাপ্ত পানি পান করুন।",
    "ওষুধ নিয়মিত নির্ধারিত সময় মেনে খান।",
    "অসুবিধা বাড়লে ডাক্তারের সাথে যোগাযোগ করুন।",
  ],
  dangerSigns: [
    "১০২° F এর বেশি জ্বর হলে বা না কমলে",
    "তীব্র শ্বাসকষ্ট বা বুকে ব্যথা হলে",
    "অতিরিক্ত বমি বা ডায়রিয়া হলে",
    "অ্যালার্জির লক্ষণ দেখা দিলে (র‍্যাশ, চুলকানি, মুখ ফুলে যাওয়া)",
  ],
  disclaimer:
    "এই বিবরণটি আপনার প্রেসক্রিপশন অনুযায়ী তৈরি। রোগের অবস্থা পরিবর্তন হলে অবশ্যই চিকিৎসকের পরামর্শ গ্রহণ করুন।",
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
      quantity?: number;
      generic_name?: string | null;
      dosage_form?: string | null;
      indications?: string | null;
      mode_of_action?: string | null;
      side_effects?: string | null;
    }[];
  } | null;
  onDownloadJpg?: () => void;
}

export function PatientSmartPrescription({
  prescription,
}: PatientSmartPrescriptionProps) {
  useMedicinesDbReady();
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  const isRealPrescription = Boolean(prescription && prescription.id);
  const exp: PrescriptionExplanation | null = isRealPrescription && prescription
    ? explainPrescription(prescription)
    : null;

  // 1. Patient & Doctor Info (100% from real prescription when present)
  const patientName = isRealPrescription
    ? (prescription?.patient_name || "রোগী")
    : DEFAULT_PDF_RX.patient_name;
  const patientAge = isRealPrescription
    ? (prescription?.patient_age || "উল্লেখ নেই")
    : DEFAULT_PDF_RX.patient_age;
  const patientGender = isRealPrescription
    ? (prescription?.patient_gender || "উল্লেখ নেই")
    : DEFAULT_PDF_RX.patient_gender;
  const rxDate = isRealPrescription
    ? (prescription?.rx_date ? formatDate(prescription.rx_date) : "—")
    : "২৩-০৯-২৪";
  const nextVisitText = isRealPrescription && prescription?.next_visit
    ? formatDate(prescription.next_visit)
    : null;

  const doctorName = isRealPrescription
    ? (prescription?.doctor_name || "চিকিৎসক")
    : DEFAULT_PDF_RX.doctor_name;
  const rawDoctorQual = isRealPrescription
    ? (prescription?.doctor_qualification || "")
    : DEFAULT_PDF_RX.doctor_qualification;
  const { degree: doctorDegree, designation: doctorDesignation } = splitDoctorQualification(rawDoctorQual);
  const doctorChamber = isRealPrescription
    ? (prescription?.clinic || "শেখ ফার্মা চেম্বার")
    : DEFAULT_PDF_RX.doctor_institution;

  // 2. Overall Condition & Goals
  const overallCondition = exp ? exp.overallCondition : DEFAULT_PDF_RX.overallCondition;
  const treatmentGoals = exp && exp.treatmentGoals.length > 0
    ? exp.treatmentGoals
    : DEFAULT_PDF_RX.treatmentGoals;

  // 3. Chief Complaints / Symptoms (Diagnosis field from prescription)
  const realSymptoms = isRealPrescription
    ? (prescription?.diagnosis || "")
        .split(/\r?\n|,|;/)
        .map((s) => s.trim())
        .filter(Boolean)
    : DEFAULT_PDF_RX.symptoms;

  // 4. Vitals (O/E)
  const realVitals = exp
    ? exp.vitalsExplained
    : DEFAULT_PDF_RX.vitals;

  // 5. Investigations (Tests)
  const realInvestigations = exp
    ? exp.investigationsExplained
    : DEFAULT_PDF_RX.investigations;

  // 6. Medication Schedule & Detailed Cards (100% from prescription.lines)
  const realSchedule = exp
    ? exp.medicines.map((m, idx) => {
        const rawLine = prescription?.lines?.[idx];
        return {
          name: m.originalName,
          genericName: m.genericName || "",
          dosageForm: m.dosageFormEn || m.formType || "",
          morning: m.morningDose,
          noon: m.noonDose,
          night: m.nightDose,
          duration: m.durationText,
          instructions: rawLine?.instructions || "",
          rawFrequency: rawLine?.frequency || rawLine?.dose || "",
        };
      })
    : DEFAULT_PDF_RX.schedule;

  const realScheduleSummary = exp
    ? exp.medicines.map((m) => `${m.originalName}: ${m.summaryFrequency} (${m.durationText})`)
    : DEFAULT_PDF_RX.scheduleSummary;

  const realMedicinesDetailed = exp
    ? exp.medicines.map((m, idx) => {
        const rawLine = prescription?.lines?.[idx];
        const doseParts: string[] = [];
        if (rawLine?.frequency || rawLine?.dose) {
          doseParts.push(`ডোজ: ${rawLine.frequency || rawLine.dose}`);
        }
        doseParts.push(m.summaryFrequency);
        if (rawLine?.instructions) {
          doseParts.push(`নিয়ম: ${rawLine.instructions}`);
        }
        if (m.durationText) {
          doseParts.push(`মেয়াদ: ${m.durationText}`);
        }

        const isAntibiotic = m.category.includes("অ্যান্টিবায়োটিক");
        const isPainOrFever = m.category.includes("জ্বর") || m.category.includes("ব্যথা");
        const badgeColor = isAntibiotic
          ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300"
          : isPainOrFever
          ? "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300"
          : "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300";

        return {
          name: m.originalName,
          genericName: m.genericName || "",
          dosageForm: m.dosageFormEn || m.formType || "",
          modeOfAction: m.modeOfAction || "",
          badge: m.category,
          badgeColor,
          whyGiven: m.purpose,
          howToTake: doseParts,
          sideEffects: m.sideEffects.split(/,|;/).map((s) => s.trim()).filter(Boolean),
          precautions: m.precautions.split(/।|;/).map((s) => s.trim()).filter(Boolean),
        };
      })
    : DEFAULT_PDF_RX.medicinesDetailed;

  // 7. Drug Interaction & Advice
  const interactionTitle = exp
    ? exp.drugInteraction.message
    : DEFAULT_PDF_RX.drugInteraction.title;

  const adviceList = exp
    ? exp.lifestyleAdvice
    : DEFAULT_PDF_RX.adviceList;

  const dangerSigns = exp
    ? exp.dangerSigns
    : DEFAULT_PDF_RX.dangerSigns;

  // Primary treatment duration badge
  const primaryDuration = exp && exp.medicines.length > 0
    ? exp.medicines[0].durationText
    : "৭ দিন";

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

    const medsSpeech = realScheduleSummary.join("। ");
    const speechText = `আমার প্রেসক্রিপশন বিশ্লেষণ। রোগীর নাম: ${patientName}। চিকিৎসক: ${doctorName}। ${overallCondition}। ওষুধের তালিকা: ${medsSpeech}`;
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
      {isRealPrescription && (
        <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 text-xs">
          <span className="text-emerald-900 dark:text-emerald-300 font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              ডাক্তারের দেওয়া আসল প্রেসক্রিপশন ({prescription?.lines?.length ?? 0}টি ওষুধ)
              {prescription?.rx_no ? ` · Rx: ${prescription.rx_no}` : ""}
            </span>
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowOriginal(!showOriginal)}
            className="h-7 text-xs font-semibold rounded-lg border-emerald-300 text-emerald-800 hover:bg-emerald-100 cursor-pointer"
          >
            {showOriginal ? "স্মার্ট ভিউ দেখুন" : "মূল লাইনগুলো দেখুন"}
          </Button>
        </div>
      )}

      {showOriginal && prescription && (
        <Card className="border border-emerald-200 bg-white dark:bg-slate-900 shadow-xs">
          <CardContent className="p-4 space-y-2.5 text-xs">
            <div className="font-bold text-sm text-slate-900 dark:text-white border-b border-slate-100 pb-2">
              ডাক্তারের মূল প্রেসক্রিপশন নোট:
            </div>
            {prescription.diagnosis && (
              <div>
                <strong className="text-teal-800 dark:text-teal-400">রোগের লক্ষণ (C/C):</strong>{" "}
                <span>{prescription.diagnosis}</span>
              </div>
            )}
            {prescription.vitals && (
              <div>
                <strong className="text-teal-800 dark:text-teal-400">শারীরিক পরীক্ষা (O/E):</strong>{" "}
                <span>{String(prescription.vitals)}</span>
              </div>
            )}
            {prescription.investigation && (
              <div>
                <strong className="text-teal-800 dark:text-teal-400">টেস্ট (Investigation):</strong>{" "}
                <span>{prescription.investigation}</span>
              </div>
            )}
            <div className="pt-1">
              <strong className="text-teal-800 dark:text-teal-400 block mb-1">ওষুধের তালিকা (Rx):</strong>
              <ol className="list-decimal pl-5 space-y-1.5">
                {prescription.lines?.map((l, i) => (
                  <li key={i} className="text-slate-800 dark:text-slate-200">
                    <strong className="font-bold">{l.medicine_name}</strong> —{" "}
                    {[l.frequency || l.dose, l.instructions, l.duration ? `${l.duration}` : ""]
                      .filter(Boolean)
                      .join(" · ")}
                  </li>
                ))}
              </ol>
            </div>
            {prescription.advice && (
              <div className="pt-2 border-t border-slate-100 text-slate-700 dark:text-slate-300">
                <strong className="text-teal-800 dark:text-teal-400">পরামর্শ:</strong> {prescription.advice}
              </div>
            )}
            {nextVisitText && (
              <div className="text-emerald-700 dark:text-emerald-400 font-bold">
                পরবর্তী সাক্ষাৎ: {nextVisitText}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ================= MAIN PRESCRIPTION CARD CONTAINER ================= */}
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
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              আমার প্রেসক্রিপশন
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-400 mt-1">
              ডাক্তারের প্রদত্ত ব্যবস্থাপত্র ও সহজ বাংলা নির্দেশিকা
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
              {(prescription?.patient_code || prescription?.rx_no) && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">পেশেন্ট আইডি (PID) :</span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                    {prescription.patient_code || prescription.rx_no}
                  </span>
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
            <div className="text-xs space-y-1 pt-0.5">
              <div className="font-bold text-slate-900 dark:text-white text-sm">
                {doctorName}
              </div>
              {doctorDegree && (
                <div className="text-teal-700 dark:text-teal-400 text-xs font-semibold">
                  {doctorDegree}
                </div>
              )}
              {doctorDesignation && (
                <div className="text-slate-600 dark:text-slate-300 text-[11px] font-medium">
                  {doctorDesignation}
                </div>
              )}
              {!doctorDegree && !doctorDesignation && rawDoctorQual && (
                <div className="text-slate-600 dark:text-slate-300 text-[11px] font-medium">
                  {rawDoctorQual}
                </div>
              )}
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
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>{goal}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ================= 3. CLINICAL TRIO: SYMPTOMS / VITALS / TESTS ================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* কলাম ১: রোগীর সমস্যা (C/C) */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2 flex flex-col justify-between shadow-2xs">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2">
                <Activity className="h-4 w-4 text-amber-500" />
                <span>রোগীর সমস্যা (C/C)</span>
              </div>
              {realSymptoms.length > 0 ? (
                <ul className="text-xs space-y-1.5 text-slate-700 dark:text-slate-300 font-medium">
                  {realSymptoms.map((s, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-amber-500 font-bold">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400 italic py-2">
                  নির্দিষ্ট কোনো লক্ষণ উল্লেখ করা হয়নি।
                </p>
              )}
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
              <span>শারীরিক পরীক্ষা (O/E)</span>
            </div>
            {realVitals.length > 0 ? (
              <div className="space-y-2.5 pt-1">
                {realVitals.map((v, idx) => {
                  const isTemp = v.label.toLowerCase().includes("temp");
                  const isBp = v.label.toLowerCase().includes("bp");
                  return (
                    <div key={idx} className="flex items-start gap-2.5">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-lg shrink-0 ${
                          isBp
                            ? "bg-rose-500/10 text-rose-600"
                            : isTemp
                            ? "bg-amber-500/10 text-amber-600"
                            : "bg-teal-500/10 text-teal-600"
                        }`}
                      >
                        {isBp ? (
                          <HeartPulse className="h-4 w-4" />
                        ) : isTemp ? (
                          <Thermometer className="h-4 w-4" />
                        ) : (
                          <Activity className="h-4 w-4" />
                        )}
                      </div>
                      <div className="text-xs">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {v.label}: {v.value}
                        </div>
                        <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-normal">
                          {v.note || v.status}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic py-2">
                এই ভিজিটে আলাদা কোনো ভাইটাল সাইন নথিবদ্ধ করা হয়নি।
              </p>
            )}
          </div>

          {/* কলাম ৩: যে টেস্টগুলো করতে বলা হয়েছে */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2">
              <Droplets className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <span>যে টেস্টগুলো করতে বলা হয়েছে</span>
            </div>
            {realInvestigations.length > 0 ? (
              <div className="space-y-2 pt-0.5">
                {realInvestigations.map((inv, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-[#a2d9ce] dark:border-cyan-800/40 bg-[#e8f8f5] dark:bg-cyan-950/20 p-2.5 space-y-1"
                  >
                    <div className="font-bold text-xs text-cyan-950 dark:text-cyan-200">
                      {idx + 1}. {inv.name}
                    </div>
                    <p className="text-[10px] sm:text-[11px] text-cyan-900 dark:text-cyan-300 leading-snug font-normal">
                      {inv.reason}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic py-2">
                এই ভিজিটে কোনো ল্যাব টেস্ট দেওয়া হয়নি।
              </p>
            )}
          </div>
        </div>

        {/* ================= 4. MEDICATION SCHEDULE TABLE ================= */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3.5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 font-bold text-sm sm:text-base text-slate-900 dark:text-white">
              <Clock className="h-4 w-4 text-emerald-600" />
              <span>ওষুধ গ্রহণের সময়সূচি ({realSchedule.length}টি ওষুধ)</span>
            </div>
            <div className="rounded-full border border-slate-300 dark:border-slate-700 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800">
              মেয়াদ: {primaryDuration}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs text-left border-collapse min-w-[550px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                  <th className="p-3 font-bold w-1/3">ওষুধের নাম ও নিয়ম</th>
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
                {realSchedule.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                    <td className="p-3">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {idx + 1}. {row.name}
                      </div>
                      {row.genericName && (
                        <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                          জেনেরিক: {row.genericName}
                          {row.dosageForm ? ` · ${row.dosageForm}` : ""}
                        </div>
                      )}
                      {row.instructions && (
                        <div className="text-[11px] text-teal-700 dark:text-teal-400 font-normal mt-0.5">
                          নিয়ম: {row.instructions}
                        </div>
                      )}
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

          {/* Table Summary Badges (Dynamic from real medicines) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {realScheduleSummary.map((sumText, idx) => (
              <div
                key={idx}
                className="rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                <span className="text-emerald-600 font-bold mr-1.5">•</span>
                {sumText}
              </div>
            ))}
          </div>
        </div>

        {/* ================= 5. DETAILED MEDICINE CARDS & DRUG INTERACTION ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* বাম কলাম: ওষুধ সম্পর্কে বিস্তারিত (8 Cols) */}
          <div className="lg:col-span-8 space-y-3">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
              <HelpCircle className="h-4 w-4 text-emerald-600" />
              <span>ওষুধ সম্পর্কে বিস্তারিত ও খাওয়ার নিয়ম</span>
            </div>

            <div className="space-y-3">
              {realMedicinesDetailed.map((med: any, idx: number) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-2xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <div>
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                        {idx + 1}. {med.name}
                      </h3>
                      {med.genericName && (
                        <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">
                          জেনেরিক নাম: {med.genericName}
                          {med.dosageForm ? ` • ডোজেজ ফর্ম: ${med.dosageForm}` : ""}
                        </div>
                      )}
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${med.badgeColor}`}>
                      {med.badge}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
                    {/* কেন দেওয়া হয়েছে? */}
                    <div className="space-y-1">
                      <div className="text-[11px] font-bold text-slate-500">কেন দেওয়া হয়েছে? (কাজ)</div>
                      <p className="text-slate-800 dark:text-slate-200 text-[11px] leading-snug font-normal">
                        {med.whyGiven}
                      </p>
                    </div>

                    {/* কীভাবে খাবেন? */}
                    <div className="space-y-1">
                      <div className="text-[11px] font-bold text-slate-500">কীভাবে খাবেন?</div>
                      <ul className="text-slate-800 dark:text-slate-200 text-[11px] space-y-0.5 leading-snug font-medium">
                        {med.howToTake.map((h: string, i: number) => (
                          <li key={i}>• {h}</li>
                        ))}
                      </ul>
                    </div>

                    {/* সাধারণ পার্শ্ব প্রতিক্রিয়া */}
                    <div className="space-y-1">
                      <div className="text-[11px] font-bold text-slate-500">সাধারণ পার্শ্ব প্রতিক্রিয়া</div>
                      <ul className="text-slate-600 dark:text-slate-400 text-[11px] space-y-0.5 leading-snug font-normal">
                        {med.sideEffects.map((se: string, i: number) => (
                          <li key={i}>• {se}</li>
                        ))}
                      </ul>
                    </div>

                    {/* সতর্কতা */}
                    <div className="space-y-1">
                      <div className="text-[11px] font-bold text-slate-500">সতর্কতা</div>
                      <ul className="text-amber-800 dark:text-amber-300 text-[11px] space-y-0.5 leading-snug font-medium">
                        {med.precautions.map((p: string, i: number) => (
                          <li key={i}>• {p}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {med.modeOfAction && (
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 p-2.5 text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                      <span className="font-bold text-slate-700 dark:text-slate-200">মোড অফ অ্যাকশন (কীভাবে কাজ করে): </span>
                      {med.modeOfAction}
                    </div>
                  )}
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
                  {interactionTitle}
                </div>
              </div>

              <div className="rounded-xl bg-white/80 dark:bg-slate-900/80 border border-emerald-200 dark:border-emerald-800/40 p-2.5 text-xs text-center text-emerald-800 dark:text-emerald-300 font-bold">
                {DEFAULT_PDF_RX.drugInteraction.sub1}
              </div>

              <p className="text-[11px] text-slate-600 dark:text-slate-400 text-center leading-relaxed font-normal">
                {DEFAULT_PDF_RX.drugInteraction.sub2}
              </p>
            </div>
          </div>
        </div>

        {/* ================= 6. ADVICE & DANGER SIGNS ================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* বাম কার্ড: আপনার জন্য পরামর্শ (Doctor's Real Advice) */}
          <div className="rounded-2xl border border-[#a3e4d7] dark:border-emerald-800/60 bg-[#eafaf1] dark:bg-emerald-950/20 p-4 space-y-3.5 shadow-2xs">
            <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-emerald-900 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-800/50 pb-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>ডাক্তারের পরামর্শ ও করণীয়</span>
            </div>

            <ul className="text-xs space-y-1.5 text-slate-800 dark:text-slate-200 font-medium">
              {adviceList.map((adv, idx) => (
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
                  পর্যাপ্ত বিশুদ্ধ পানি পান করুন
                </span>
              </div>
              <div className="rounded-xl bg-white/90 dark:bg-slate-900/90 border border-emerald-200 dark:border-emerald-800/40 p-2.5 text-center flex flex-col items-center justify-between">
                <span className="text-xl">⏰</span>
                <span className="text-[10px] text-slate-700 dark:text-slate-300 font-semibold mt-1">
                  নির্ধারিত সময় মেনে ওষুধ খান
                </span>
              </div>
              <div className="rounded-xl bg-white/90 dark:bg-slate-900/90 border border-emerald-200 dark:border-emerald-800/40 p-2.5 text-center flex flex-col items-center justify-between">
                <span className="text-xl">🥗</span>
                <span className="text-[10px] text-slate-700 dark:text-slate-300 font-semibold mt-1">
                  পুষ্টিকর খাবার ও বিশ্রাম নিন
                </span>
              </div>
              <div className="rounded-xl bg-white/90 dark:bg-slate-900/90 border border-emerald-200 dark:border-emerald-800/40 p-2.5 text-center flex flex-col items-center justify-between">
                <span className="text-xl">🗓️</span>
                <span className="text-[10px] text-slate-700 dark:text-slate-300 font-semibold mt-1">
                  {nextVisitText ? `ফলো-আপ: ${nextVisitText}` : "প্রয়োজনে ফলো-আপ ভিজিট করুন"}
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
              {dangerSigns.map((ds, idx) => (
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
