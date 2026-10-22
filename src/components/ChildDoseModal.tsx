import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Calculator,
  Baby,
  Plus,
  Check,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Search,
  Scale,
  Calendar,
  Layers,
  Clock,
  RotateCcw,
  Sliders,
  CheckCircle2,
} from "lucide-react";
import {
  PEDIATRIC_DRUGS,
  PediatricDrugRule,
  PediatricDrugFormulation,
  calculateChildDose,
  estimateWeightFromAge,
  DoseCalculationResult,
} from "@/lib/child-dose-calc";

export interface ChildDoseModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientAge?: string | null;
  patientWeight?: string | null;
  initialMode?: "auto" | "manual";
  onAddMedicine: (med: {
    medicine_name: string;
    frequency: string;
    duration: string;
    instructions: string;
    quantity: number;
  }) => void;
}

export function ChildDoseModal({
  isOpen,
  onClose,
  patientAge,
  patientWeight,
  initialMode = "auto",
  onAddMedicine,
}: ChildDoseModalProps) {
  // Mode: "auto" (Clinical guideline auto calculation) vs "manual" (Doctor custom override)
  const [mode, setMode] = useState<"auto" | "manual">(initialMode);

  // 1. Weight & Age State
  const [weightInput, setWeightInput] = useState<string>("10");
  const [isEstimatedWeight, setIsEstimatedWeight] = useState(false);
  const [estimationNote, setEstimationNote] = useState("");

  // 2. Selected Drug & Formulation
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDrugId, setSelectedDrugId] = useState<string>("paracetamol");
  const [selectedFormulationIdx, setSelectedFormulationIdx] = useState<number>(0);

  // 3. Custom Overrides for Manual Mode
  const [customDoseRate, setCustomDoseRate] = useState<number | undefined>(undefined);
  const [customFreq, setCustomFreq] = useState<string>("");
  const [customDuration, setCustomDuration] = useState<string>("");
  const [customInstructions, setCustomInstructions] = useState<string>("");
  const [manualMedicineName, setManualMedicineName] = useState<string>("");
  const [manualStrengthMg, setManualStrengthMg] = useState("120");
  const [manualStrengthMl, setManualStrengthMl] = useState("5");
  const [manualPerDoseMl, setManualPerDoseMl] = useState<string>("");
  const [manualSpoonText, setManualSpoonText] = useState<string>("");

  // Sync with patient data on open
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode || "auto");
      const wtNum = parseFloat(patientWeight || "");
      if (!isNaN(wtNum) && wtNum > 0) {
        setWeightInput(wtNum.toFixed(1));
        setIsEstimatedWeight(false);
        setEstimationNote("ভাইটালস থেকে সরাসরি প্রাপ্ত ওজন");
      } else if (patientAge) {
        const est = estimateWeightFromAge(patientAge);
        setWeightInput(est.weightKg.toString());
        setIsEstimatedWeight(est.isEstimate);
        setEstimationNote(est.explanation);
      } else {
        setWeightInput("10");
        setIsEstimatedWeight(true);
        setEstimationNote("ডিফল্ট প্রাক্কলিত ওজন (১০ কেজি)");
      }

      // Reset drug selection
      setSelectedDrugId("paracetamol");
      setSelectedFormulationIdx(0);
      const defaultDrug = PEDIATRIC_DRUGS[0];
      setCustomDoseRate(defaultDrug.defaultDoseRate);
      setCustomFreq(defaultDrug.defaultFrequency);
      setCustomDuration(defaultDrug.defaultDuration);
      setCustomInstructions(defaultDrug.defaultInstructions);
      setManualMedicineName(`Syr. ${defaultDrug.name}`);
      setManualStrengthMg("120");
      setManualStrengthMl("5");
      setManualPerDoseMl("");
      setManualSpoonText("");
    }
  }, [isOpen, patientAge, patientWeight, initialMode]);

  // Current active drug rule
  const currentDrug = useMemo<PediatricDrugRule>(() => {
    return PEDIATRIC_DRUGS.find((d) => d.id === selectedDrugId) || PEDIATRIC_DRUGS[0];
  }, [selectedDrugId]);

  // Current active formulation
  const currentFormulation = useMemo<PediatricDrugFormulation>(() => {
    if (mode === "manual" && manualMedicineName && manualStrengthMg) {
      return {
        name: `Custom (${manualStrengthMg}mg / ${manualStrengthMl}ml)`,
        type: "syrup",
        mg: parseFloat(manualStrengthMg) || 120,
        ml: parseFloat(manualStrengthMl) || 5,
      };
    }
    return (
      currentDrug.formulations[selectedFormulationIdx] ||
      currentDrug.formulations[0]
    );
  }, [currentDrug, selectedFormulationIdx, mode, manualMedicineName, manualStrengthMg, manualStrengthMl]);

  // When drug changes, reset formulation index and overrides
  const handleSelectDrug = (drugId: string) => {
    setSelectedDrugId(drugId);
    setSelectedFormulationIdx(0);
    const d = PEDIATRIC_DRUGS.find((x) => x.id === drugId);
    if (d) {
      setCustomDoseRate(d.defaultDoseRate);
      setCustomFreq(d.defaultFrequency);
      setCustomDuration(d.defaultDuration);
      setCustomInstructions(d.defaultInstructions);
      setManualMedicineName(`Syr. ${d.name}`);
      const f = d.formulations[0];
      if (f) {
        setManualStrengthMg(f.mg.toString());
        setManualStrengthMl(f.ml.toString());
      }
      setManualPerDoseMl("");
      setManualSpoonText("");
    }
  };

  // Filtered drugs list based on search
  const filteredDrugs = useMemo(() => {
    if (!searchQuery.trim()) return PEDIATRIC_DRUGS;
    const q = searchQuery.toLowerCase();
    return PEDIATRIC_DRUGS.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.genericName.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Weight parsed
  const weightKg = useMemo(() => {
    const w = parseFloat(weightInput);
    return isNaN(w) || w <= 0 ? 10 : w;
  }, [weightInput]);

  // Execute Dose Calculation
  const autoCalculation = useMemo<DoseCalculationResult>(() => {
    return calculateChildDose({
      drug: currentDrug,
      formulation: currentFormulation,
      weightKg,
      doseRate: currentDrug.defaultDoseRate,
      frequencyOverride: undefined,
      durationOverride: undefined,
      instructionsOverride: undefined,
    });
  }, [currentDrug, currentFormulation, weightKg]);

  // Manual Calculation Result
  const manualCalculation = useMemo<DoseCalculationResult>(() => {
    const effectiveDrug: PediatricDrugRule = {
      id: "manual",
      name: manualMedicineName.trim() || currentDrug.name,
      genericName: manualMedicineName.trim() || currentDrug.genericName,
      category: currentDrug.category,
      defaultDoseRate: customDoseRate ?? currentDrug.defaultDoseRate,
      doseType: currentDrug.doseType,
      recommendedDoseRange: currentDrug.recommendedDoseRange,
      formulations: [currentFormulation],
      defaultFrequency: customFreq || currentDrug.defaultFrequency,
      defaultDuration: customDuration || currentDrug.defaultDuration,
      defaultInstructions: customInstructions || currentDrug.defaultInstructions,
    };

    const res = calculateChildDose({
      drug: effectiveDrug,
      formulation: currentFormulation,
      weightKg,
      doseRate: customDoseRate,
      frequencyOverride: customFreq || undefined,
      durationOverride: customDuration || undefined,
      instructionsOverride: customInstructions || undefined,
    });

    // If doctor gave explicit manual ml or spoon
    if (manualPerDoseMl || manualSpoonText) {
      const spoon = manualSpoonText ? `(${manualSpoonText})` : res.teaspoonText.bn;
      const ml = manualPerDoseMl ? `${manualPerDoseMl} মিলি` : `${res.mlPerDose} মিলি`;
      const freq = customFreq || res.frequency;
      const instr = customInstructions || res.instructions;
      return {
        ...res,
        mlPerDose: parseFloat(manualPerDoseMl) || res.mlPerDose,
        prescriptionLineText: {
          ...res.prescriptionLineText,
          medicineName: manualMedicineName.trim() || res.prescriptionLineText.medicineName,
          frequency: `${ml} ${spoon} করে ${freq} (${instr})`.trim(),
          duration: customDuration || res.duration,
          instructions: instr,
        },
      };
    }

    return res;
  }, [
    manualMedicineName,
    currentDrug,
    customDoseRate,
    currentFormulation,
    customFreq,
    customDuration,
    customInstructions,
    weightKg,
    manualPerDoseMl,
    manualSpoonText,
  ]);

  // Active calculation depending on mode
  const calculation = mode === "auto" ? autoCalculation : manualCalculation;

  // Adjust weight helper
  const adjustWeight = (delta: number) => {
    const next = Math.max(1, Math.round((weightKg + delta) * 10) / 10);
    setWeightInput(next.toString());
    setIsEstimatedWeight(false);
  };

  // Add to prescription action
  const handleAddToPrescription = (closeAfter = true) => {
    onAddMedicine(calculation.prescriptionLineText);
    if (closeAfter) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[96vw] sm:w-full max-w-2xl p-0 overflow-hidden rounded-2xl sm:rounded-3xl border border-primary/25 bg-card shadow-2xl max-h-[92vh] flex flex-col">
        {/* Accent Bar */}
        <div className="h-2 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 shrink-0" />

        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-border/60 shrink-0 text-left bg-muted/20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-inner">
                <Baby className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                  <span>শিশু ডোজ ক্যালকুলেটর</span>
                  <Badge variant="outline" className="text-[10px] font-semibold border-primary/40 text-primary">
                    Pediatric Dose Calculator
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  বাচ্চার বয়স ও ওজন অনুযায়ী সঠিক মিলিগ্রাম, মিলিলিটার (ml) ও চামচের ডোজ হিসাব।
                </DialogDescription>
              </div>
            </div>

            {patientAge && (
              <Badge variant="secondary" className="font-mono text-xs px-2.5 py-1 gap-1">
                <Calendar className="h-3 w-3 text-primary" />
                <span>রোগীর বয়স: {patientAge}</span>
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 space-y-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-track]:bg-transparent">
          {/* ================= 1. PROMINENT MODE TOGGLE & CONFIRMATION ================= */}
          <div className="rounded-2xl border-2 p-3 sm:p-4 bg-card shadow-sm transition-all duration-200 border-border/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">ক্যালকুলেশন মোড:</span>
                  <Badge
                    className={`text-xs font-bold px-2.5 py-0.5 transition-all ${
                      mode === "auto"
                        ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                        : "bg-blue-600 hover:bg-blue-600 text-white"
                    }`}
                  >
                    {mode === "auto" ? "⚡ অটোমেটিক মোড (Auto)" : "✍️ ম্যানুয়াল মোড (Manual)"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {mode === "auto"
                    ? "ক্লিনিক্যাল গাইডলাইন অনুযায়ী ডোজ, মিলি ও চামচ স্বয়ংক্রিয়ভাবে হিসাব হচ্ছে।"
                    : "ডাক্তার নিজের ইচ্ছামতো যে কোনো ওষুধ, ডোজ, চামচ ও খাওয়ার নিয়ম কাস্টমাইজ করতে পারবেন।"}
                </p>
              </div>

              {/* Segmented Toggle Control */}
              <div className="flex items-center p-1 rounded-xl bg-muted/80 border border-border shadow-inner shrink-0 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setMode("auto")}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    mode === "auto"
                      ? "bg-emerald-600 text-white shadow-md scale-102"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>অটোমেটিক (Auto)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("manual")}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    mode === "manual"
                      ? "bg-blue-600 text-white shadow-md scale-102"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Sliders className="h-3.5 w-3.5" />
                  <span>ম্যানুয়াল (Manual)</span>
                </button>
              </div>
            </div>

            {/* LIVE CONFIRMATION BANNER */}
            <div
              className={`mt-3 p-2.5 rounded-xl border text-xs flex items-center gap-2 transition-all ${
                mode === "auto"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200 font-medium"
                  : "bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-200 font-medium"
              }`}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 font-bold" />
              <span>
                {mode === "auto"
                  ? `কনফার্মড: অটোমেটিক সিস্টেম সক্রিয়। বাচ্চার বয়স (${patientAge || "৩ বছর"}) ও ওজন (${weightKg} কেজি) অনুযায়ী ডোজ, প্রতি বারের মিলি, চামচের মাপ এবং খাওয়ার নিয়ম ১০০% স্বয়ংক্রিয়ভাবে ক্লিনিক্যাল ফর্মুলায় হিসাব করা হচ্ছে।`
                  : `কনফার্মড: ম্যানুয়াল মোড সক্রিয়। ডাক্তার নিজের ক্লিনিক্যাল প্রয়োজন অনুযায়ী যে কোনো ওষুধের নাম, ডোজ (mg/kg), প্রতি বারের মিলি, চামচ, খাওয়ার সময় (১+১+১) ও দিন সংখ্যা সরাসরি কাস্টমাইজ করতে পারবেন।`}
              </span>
            </div>
          </div>

          {/* ================= 2. PATIENT WEIGHT & AGE BAR ================= */}
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-background p-3.5 sm:p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Scale className="h-3.5 w-3.5 text-primary" />
                  <span>বাচ্চার শারীরিক ওজন (Weight in kg)</span>
                  {isEstimatedWeight && (
                    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                      আনুমানিক
                    </Badge>
                  )}
                </Label>
                <p className="text-[11px] text-muted-foreground">{estimationNote}</p>
              </div>

              {/* Weight Input & Adjusters */}
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => adjustWeight(-1)}
                  className="h-8 px-2 text-xs font-bold"
                >
                  -১ kg
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => adjustWeight(-0.5)}
                  className="h-8 px-2 text-xs font-bold"
                >
                  -০.৫
                </Button>
                <div className="relative w-24">
                  <Input
                    type="number"
                    step="0.1"
                    min="1"
                    max="100"
                    value={weightInput}
                    onChange={(e) => {
                      setWeightInput(e.target.value);
                      setIsEstimatedWeight(false);
                    }}
                    className="h-8 text-center font-bold text-base bg-background border-primary/40 focus:border-primary pr-6"
                  />
                  <span className="absolute right-2 top-1.5 text-xs font-medium text-muted-foreground pointer-events-none">
                    kg
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => adjustWeight(0.5)}
                  className="h-8 px-2 text-xs font-bold"
                >
                  +০.৫
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => adjustWeight(1)}
                  className="h-8 px-2 text-xs font-bold"
                >
                  +১ kg
                </Button>
              </div>
            </div>
          </div>

          {/* ================= 3. DRUG SELECTION (AUTO OR MANUAL PRESETS) ================= */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-primary" />
                <span>ওষুধের তালিকা (Common Pediatric Medicines)</span>
              </Label>
              {mode === "auto" && (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> ১-ক্লিকে সিলেক্ট করুন
                </span>
              )}
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="ওষুধ খুঁজুন (যেমন: Napa, Moxacil, Cef-3, Azithromycin)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-muted/40"
              />
            </div>

            {/* Drug Pills Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto p-1 border rounded-xl border-border/60 bg-muted/20">
              {filteredDrugs.map((d) => {
                const isSelected = d.id === selectedDrugId;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => handleSelectDrug(d.id)}
                    className={`text-left p-2 rounded-lg text-xs transition border cursor-pointer ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-sm font-bold"
                        : "bg-background hover:bg-muted text-foreground border-border/80 font-medium"
                    }`}
                  >
                    <div className="truncate">{d.genericName}</div>
                    <div
                      className={`text-[10px] truncate ${
                        isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                      }`}
                    >
                      {d.name.split("(")[1]?.replace(")", "") || d.category}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ================= 4. MANUAL MODE DIRECT CUSTOMIZATIONS ================= */}
          {mode === "manual" && (
            <div className="rounded-2xl border-2 border-blue-500/40 bg-blue-500/5 p-4 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-blue-500/20 pb-2">
                <div className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="font-bold text-sm text-foreground">ম্যানুয়াল কাস্টমাইজেশন ফিল্ডস</span>
                </div>
                <Badge variant="outline" className="text-xs border-blue-500/40 text-blue-600 dark:text-blue-400">
                  Doctor Override
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <Label className="text-[11px] font-semibold">ওষুধের নাম (Medicine Name)</Label>
                  <Input
                    value={manualMedicineName}
                    onChange={(e) => setManualMedicineName(e.target.value)}
                    placeholder="e.g. Syr. Napa / Syr. Cef-3"
                    className="h-8 text-xs mt-1 bg-background"
                  />
                </div>

                <div>
                  <Label className="text-[11px] font-semibold">সিরাপের স্ট্রেন্থ (Strength)</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <Input
                      type="number"
                      placeholder="120"
                      value={manualStrengthMg}
                      onChange={(e) => setManualStrengthMg(e.target.value)}
                      className="h-8 text-xs bg-background"
                    />
                    <span className="text-xs">mg /</span>
                    <Input
                      type="number"
                      placeholder="5"
                      value={manualStrengthMl}
                      onChange={(e) => setManualStrengthMl(e.target.value)}
                      className="h-8 text-xs w-16 bg-background"
                    />
                    <span className="text-xs">ml</span>
                  </div>
                </div>

                <div>
                  <Label className="text-[11px] font-semibold">প্রতি বারের মাত্রা (ml / চামচ)</Label>
                  <div className="grid grid-cols-2 gap-1.5 mt-1">
                    <Input
                      placeholder="e.g. 5"
                      value={manualPerDoseMl}
                      onChange={(e) => setManualPerDoseMl(e.target.value)}
                      className="h-8 text-xs bg-background"
                    />
                    <Input
                      placeholder="১ চামচ / আধ চামচ"
                      value={manualSpoonText}
                      onChange={(e) => setManualSpoonText(e.target.value)}
                      className="h-8 text-xs bg-background"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-[11px] font-semibold">ডোজ রেট (mg / kg)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={customDoseRate ?? currentDrug.defaultDoseRate}
                    onChange={(e) => setCustomDoseRate(parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs mt-1 bg-background font-bold"
                  />
                </div>

                <div>
                  <Label className="text-[11px] font-semibold">সেবনবিধি (Frequency)</Label>
                  <Input
                    value={customFreq || currentDrug.defaultFrequency}
                    onChange={(e) => setCustomFreq(e.target.value)}
                    placeholder="e.g. ১+১+১ বা ১+০+১"
                    className="h-8 text-xs mt-1 bg-background"
                  />
                </div>

                <div>
                  <Label className="text-[11px] font-semibold">মেয়াদ (Duration)</Label>
                  <Input
                    value={customDuration || currentDrug.defaultDuration}
                    onChange={(e) => setCustomDuration(e.target.value)}
                    placeholder="e.g. ৩ দিন বা ৭ দিন"
                    className="h-8 text-xs mt-1 bg-background"
                  />
                </div>
              </div>

              <div>
                <Label className="text-[11px] font-semibold">নির্দেশনা (Instructions)</Label>
                <Input
                  value={customInstructions || currentDrug.defaultInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="e.g. ভরা পেটে সেব্য / জ্বর আসলে"
                  className="h-8 text-xs mt-1 bg-background"
                />
              </div>
            </div>
          )}

          {/* ================= 5. LIVE CALCULATION RESULT CARD ================= */}
          <div
            className={`rounded-2xl border-2 p-4 sm:p-5 shadow-md transition-all ${
              mode === "auto"
                ? "border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-card to-teal-500/10"
                : "border-blue-500/40 bg-gradient-to-br from-blue-500/10 via-card to-indigo-500/10"
            }`}
          >
            <div className="flex items-center justify-between border-b border-border/80 pb-2.5">
              <div className="flex items-center gap-2">
                {mode === "auto" ? (
                  <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Sliders className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                )}
                <h4 className="font-bold text-sm sm:text-base text-foreground">
                  {calculation.drugName}
                </h4>
              </div>
              <Badge
                variant="outline"
                className={`font-semibold text-xs ${
                  mode === "auto"
                    ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                    : "border-blue-500/40 text-blue-600 dark:text-blue-400"
                }`}
              >
                {calculation.formulationName}
              </Badge>
            </div>

            {/* Main Calculated Values */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3.5 text-center">
              <div className="rounded-xl bg-background/80 p-2.5 border border-border/60 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  প্রতি বারের মাত্রা
                </span>
                <span
                  className={`text-lg sm:text-xl font-black ${
                    mode === "auto" ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400"
                  }`}
                >
                  {calculation.mlPerDose} ml
                </span>
                <span className="text-[11px] text-foreground font-semibold block mt-0.5">
                  {calculation.teaspoonText.bn.split("(")[1]?.replace(")", "") || ""}
                </span>
              </div>

              <div className="rounded-xl bg-background/80 p-2.5 border border-border/60 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  মিলিগ্রাম (Per Dose)
                </span>
                <span className="text-lg sm:text-xl font-black text-foreground">
                  {calculation.mgPerDose} mg
                </span>
                <span className="text-[11px] text-muted-foreground block mt-0.5">
                  ({calculation.doseRateMgPerKg} mg/kg)
                </span>
              </div>

              <div className="rounded-xl bg-background/80 p-2.5 border border-border/60 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  দৈনিক মোট মাত্রা
                </span>
                <span className="text-lg sm:text-xl font-black text-foreground">
                  {calculation.totalDailyMl} ml
                </span>
                <span className="text-[11px] text-muted-foreground block mt-0.5">
                  ({calculation.totalDailyMg} mg/day)
                </span>
              </div>

              <div className="rounded-xl bg-background/80 p-2.5 border border-border/60 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  আনুমানিক বোতল
                </span>
                <span className="text-lg sm:text-xl font-black text-primary">
                  {calculation.bottlesNeededEstimate} বোতল
                </span>
                <span className="text-[11px] text-muted-foreground block mt-0.5">
                  ({calculation.duration} মেয়াদে)
                </span>
              </div>
            </div>

            {/* Frequency & Instructions Summary */}
            <div className="rounded-xl bg-background/90 p-3 border border-border/60 text-xs space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-semibold">সেবনবিধি (Frequency):</span>
                <span className="font-bold text-foreground text-sm">{calculation.frequency}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-semibold">মেয়াদ (Duration):</span>
                <span className="font-bold text-foreground">{calculation.duration}</span>
              </div>
              <div className="flex justify-between items-center border-t border-border/40 pt-1">
                <span className="text-muted-foreground font-semibold">নির্দেশনা (Instructions):</span>
                <span className="font-medium text-foreground">{calculation.instructions}</span>
              </div>
            </div>

            {/* Overdose / Clinical Warning if any */}
            {calculation.warning && (
              <div className="mt-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 p-2 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5 font-medium">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                <span>{calculation.warning}</span>
              </div>
            )}
          </div>
        </div>

        {/* ================= 6. MODAL FOOTER & ACTION BUTTONS ================= */}
        <div className="p-4 border-t border-border/80 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <div className="text-[11px] text-muted-foreground w-full sm:w-auto text-center sm:text-left truncate max-w-sm">
            প্রেসক্রিপশনে যাবে: <strong className="text-foreground">{calculation.prescriptionLineText.medicineName}</strong>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 sm:flex-initial h-10 text-xs font-semibold cursor-pointer"
            >
              বাতিল
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={() => handleAddToPrescription(true)}
              className={`flex-1 sm:flex-initial h-10 font-bold text-xs gap-1.5 cursor-pointer text-white shadow-md ${
                mode === "auto"
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-500/20 hover:from-emerald-700 hover:to-teal-700"
                  : "bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700"
              }`}
            >
              <Plus className="h-4 w-4" />
              <span>
                {mode === "auto" ? "⚡ অটো-ডোজ প্রেসক্রিপশনে যোগ করুন" : "✍️ ম্যানুয়াল ডোজ প্রেসক্রিপশনে যোগ করুন"}
              </span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
