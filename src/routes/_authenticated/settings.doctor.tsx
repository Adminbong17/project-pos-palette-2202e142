import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  formatDoctorDisplayName,
  splitDoctorQualification,
  combineDoctorQualification,
  shouldShowClinicHeader,
} from "@/lib/doctor-format";
import { toast } from "sonner";
import { Stethoscope, CheckCircle2, Sparkles, Eye, FileText, Heart, Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/doctor")({
  head: () => ({
    meta: [
      { title: "Doctor & Rx Profile Settings — QweekPOS" },
      { name: "description", content: "Customize doctor name, qualifications, designation, and prescription pad layout." },
    ],
  }),
  component: DoctorSettingsPage,
});

function DoctorSettingsPage() {
  const { data: business } = useCurrentBusiness();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [degree, setDegree] = useState("");
  const [designation, setDesignation] = useState("");
  const [bmdc, setBmdc] = useState("");
  const [chamberInfo, setChamberInfo] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch current user's profile
  const profileQuery = useQuery({
    queryKey: ["my-doctor-profile-settings"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("id, doctor_name, doctor_qualification, first_name, last_name, phone")
        .eq("id", uid)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (profileQuery.data && !isInitialized) {
      const p = profileQuery.data as any;
      const initialName =
        p.doctor_name || [p.first_name, p.last_name].filter(Boolean).join(" ");
      setName(initialName || "");

      const rawQual = (p.doctor_qualification || "").trim();
      const { degree: d, designation: des } = splitDoctorQualification(rawQual);

      // Check if BMDC is embedded
      const lines = rawQual.split("\n");
      const bmdcLine = lines.find((l: string) => /bmdc/i.test(l));
      if (bmdcLine) {
        setBmdc(bmdcLine.trim());
      }

      setDegree(d.replace(/bmdc.*$/i, "").trim());
      setDesignation(des.replace(/bmdc.*$/i, "").trim());
      setIsInitialized(true);
    }
  }, [profileQuery.data, isInitialized]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("ব্যবহারকারী লগইন পাওয়া যায়নি");

      // Format doctor name cleanly (e.g. "Dr. Mehedi Hasan")
      const formattedName = formatDoctorDisplayName(name);

      // Build qualification + designation + optional BMDC
      const parts: string[] = [];
      if (degree.trim()) parts.push(degree.trim());
      if (designation.trim()) parts.push(designation.trim());
      if (bmdc.trim()) parts.push(bmdc.trim());
      if (chamberInfo.trim()) parts.push(chamberInfo.trim());

      const combinedQualification = parts.join("\n");

      const { error } = await supabase
        .from("profiles")
        .update({
          doctor_name: formattedName || null,
          doctor_qualification: combinedQualification || null,
        } as any)
        .eq("id", uid);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ডাক্তার প্রোফাইল ও পদবি সফলভাবে সংরক্ষিত হয়েছে!");
      qc.invalidateQueries({ queryKey: ["my-doctor-profile-settings"] });
      qc.invalidateQueries({ queryKey: ["my-doctor-profile"] });
      qc.invalidateQueries({ queryKey: ["business-members"] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "প্রোফাইল সংরক্ষণ করা যায়নি");
    },
  });

  const previewDisplayName = formatDoctorDisplayName(name) || "Dr. আপনার নাম";
  const clinicName = business?.name || "";
  const showClinic = shouldShowClinicHeader(clinicName, previewDisplayName);
  const bizPhone = business?.notify_phone || (business as any)?.mobile || "";
  const bizAddr = (business as any)?.address || "";

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-teal-600" />
          <span>ডাক্তার ও প্রেসক্রিপশন প্রোফাইল (Doctor Profile & Designation)</span>
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          প্রেসক্রিপশন প্যাডের শীর্ষে আপনার নাম, অর্জিত ডিগ্রি, বর্তমান পদবি ও চেম্বারের তথ্য যেভাবে ছাপা হবে তা এখানে সাজান।
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Inputs */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>ডাক্তারের পরিচয় ও পদবি তথ্য</span>
              </CardTitle>
              <CardDescription className="text-xs">
                এখানে তথ্য লিখলে স্বয়ংক্রিয়ভাবে প্রেসক্রিপশন ও রিপোর্টে সুন্দর কালার স্টাইলে প্রদর্শিত হবে।
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Doctor Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  ডাক্তারের নাম (Doctor Name) *
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="যেমন: Mehedi Hasan বা Dr. Mehedi Hasan"
                  className="h-10 text-sm font-medium"
                />
                <p className="text-[11px] text-muted-foreground">
                  "Dr." বা "ডাঃ" না লিখলেও সিস্টেম স্বয়ংক্রিয়ভাবে সম্মানজনকভাবে নাম সাজাবে।
                </p>
              </div>

              {/* Degrees / Qualification */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-teal-700">
                  শিক্ষাগত যোগ্যতা ও ডিগ্রি (Degrees / Qualifications)
                </Label>
                <Input
                  value={degree}
                  onChange={(e) => setDegree(e.target.value)}
                  placeholder="যেমন: MBBS (DMC), BCS (Health), FCPS, MD"
                  className="h-10 text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  আপনার অর্জিত ডিগ্রি বা শিক্ষাগত যোগ্যতাসমূহ কমা দিয়ে লিখুন।
                </p>
              </div>

              {/* Designation / Speciality */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-cyan-700">
                  পদবি ও বিশেষজ্ঞ বিবরণ (Designation / Specialty)
                </Label>
                <Textarea
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  rows={2}
                  placeholder="যেমন: সহকারী অধ্যাপক ও কনসালট্যান্ট, মেডিসিন ও ডায়াবেটিস বিশেষজ্ঞ"
                  className="text-sm resize-none"
                />
                <p className="text-[11px] text-muted-foreground">
                  আপনার বর্তমান পদবি, কর্মস্থল বা বিশেষজ্ঞ ক্ষেত্র এখানে লিখুন।
                </p>
              </div>

              {/* BMDC Registration No */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  বিএমডিসি রেজি নং (BMDC Reg No.) — ঐচ্ছিক
                </Label>
                <Input
                  value={bmdc}
                  onChange={(e) => setBmdc(e.target.value)}
                  placeholder="যেমন: BMDC Reg No: A-12345"
                  className="h-9 text-xs"
                />
              </div>

              {/* Chamber & Schedule */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  রোগী দেখার সময় / চেম্বার সূচি (Visiting Hours) — ঐচ্ছিক
                </Label>
                <Input
                  value={chamberInfo}
                  onChange={(e) => setChamberInfo(e.target.value)}
                  placeholder="যেমন: রুম নং ২০৪, প্রতিদিন বিকাল ৫টা - রাত ৯টা (শুক্রবার বন্ধ)"
                  className="h-9 text-xs"
                />
              </div>

              <div className="pt-2">
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || profileQuery.isLoading}
                  className="w-full h-10 bg-teal-600 hover:bg-teal-700 text-white font-medium shadow-sm gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{saveMutation.isPending ? "সংরক্ষণ হচ্ছে…" : "প্রোফাইল ও পদবি সংরক্ষণ করুন"}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Visual Preview */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-teal-600" />
              <span>প্রেসক্রিপশন প্যাড লাইভ প্রিভিউ (Live Pad Preview)</span>
            </span>
            <span className="text-[11px] text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
              A4 ও প্রিন্ট ফরম্যাট
            </span>
          </div>

          <div className="rounded-2xl border-2 border-teal-500/30 bg-white text-slate-900 p-5 shadow-lg relative overflow-hidden">
            {/* Top decorative gradient bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-teal-600 via-sky-600 to-indigo-600 rounded-full mb-4" />

            {/* Faint Medical Watermark in background */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.035]">
              <span className="text-[140px] font-serif font-black text-teal-800">℞</span>
            </div>

            {/* Header Content */}
            <div className="relative text-center pb-3 border-b-2 border-teal-600/80 mb-3 space-y-1">
              {showClinic && clinicName && (
                <div className="text-xs font-bold uppercase tracking-wider text-teal-700">
                  {clinicName}
                </div>
              )}

              <h3 className="text-xl font-extrabold tracking-tight text-slate-900">
                {previewDisplayName}
              </h3>

              {degree.trim() ? (
                <div className="text-xs font-semibold text-sky-700 tracking-wide">
                  {degree.trim()}
                </div>
              ) : (
                <div className="text-xs italic text-muted-foreground/60">
                  (শিক্ষাগত যোগ্যতা / ডিগ্রি এখানে আসবে)
                </div>
              )}

              {designation.trim() ? (
                <div className="text-xs font-medium text-teal-800 whitespace-pre-wrap">
                  {designation.trim()}
                </div>
              ) : (
                <div className="text-xs italic text-muted-foreground/60">
                  (পদবি ও বিশেষজ্ঞ তথ্য এখানে আসবে)
                </div>
              )}

              {bmdc.trim() && (
                <div className="text-[11px] font-medium text-slate-600">
                  {bmdc.trim()}
                </div>
              )}

              {(chamberInfo.trim() || bizPhone || bizAddr) && (
                <div className="text-[11px] text-slate-500 pt-0.5 flex flex-wrap justify-center gap-x-2">
                  {chamberInfo.trim() && <span>{chamberInfo.trim()}</span>}
                  {bizPhone && <span>📞 সিরিয়াল: {bizPhone}</span>}
                  {bizAddr && <span>📍 {bizAddr}</span>}
                </div>
              )}
            </div>

            {/* Sample Patient Box */}
            <div className="rounded-lg border border-teal-100 bg-gradient-to-r from-teal-50/50 to-slate-50 p-2.5 text-xs text-slate-700 mb-3 border-l-4 border-l-teal-600">
              <div className="flex justify-between font-semibold">
                <span>রোগীর নাম: মোঃ রফিকুল ইসলাম (৩৫ বছর / পুরুষ)</span>
                <span className="text-teal-700 font-mono">Rx #2026-0042</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 mt-0.5">
                <span>মোবাইল: 01712XXXXXX</span>
                <span>তারিখ: {new Date().toLocaleDateString("en-GB")}</span>
              </div>
            </div>

            {/* Sample Prescription Body (Small Mock) */}
            <div className="grid grid-cols-12 gap-2 text-xs py-2 border-t border-slate-100 min-h-[90px]">
              <div className="col-span-4 border-r border-slate-200 pr-2 space-y-1.5">
                <div className="font-bold text-sky-800 text-[11px] border-b border-sky-100 pb-0.5">
                  C/C &amp; Vitals
                </div>
                <div className="text-[10px] text-slate-600">1. Fever (3 days)</div>
                <div className="text-[10px] text-slate-600">BP: 120/80 mmHg</div>
              </div>
              <div className="col-span-8 pl-2 space-y-1">
                <div className="text-lg font-serif font-black text-teal-600 leading-none">℞</div>
                <div className="text-[11px] font-bold text-slate-900">
                  1. Tab. Paracetamol 500mg
                </div>
                <div className="text-[10px] text-sky-700 pl-3">১+১+১ — ৩ দিন (খাবারের পর)</div>
              </div>
            </div>

            {/* Upgraded Eye-Touching Footer Ribbon */}
            <div className="mt-4 pt-3 border-t border-dashed border-teal-200 space-y-2">
              <div className="mx-auto w-fit rounded-full bg-gradient-to-r from-teal-50 to-sky-50 border border-teal-200/80 px-3 py-1 text-center shadow-xs">
                <span className="text-xs font-semibold text-teal-800 flex items-center gap-1.5">
                  <span>🌿</span>
                  <span>দ্রুত সুস্থ হয়ে উঠুন • Wishing You Good Health</span>
                </span>
              </div>

              {/* Signature Area */}
              <div className="text-right pt-2">
                <div className="inline-block text-center min-w-[170px]">
                  <div className="border-b border-dashed border-teal-600 pb-1 text-[10px] text-slate-500">
                    চিকিৎসকের স্বাক্ষর ও সিল
                  </div>
                  <div className="text-xs font-bold text-slate-900 mt-1">
                    {previewDisplayName}
                  </div>
                  {designation.trim() && (
                    <div className="text-[10px] text-teal-800">
                      {designation.trim().split("\n")[0]}
                    </div>
                  )}
                </div>
              </div>

              <div className="text-[10px] text-center text-slate-400 pt-1">
                Digital Rx • Powered by QweekRx Health
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
