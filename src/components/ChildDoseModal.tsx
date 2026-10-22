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
  onAddMedicine,
}: ChildDoseModalProps) {
  // 1. Weight & Age State
  const [weightInput, setWeightInput] = useState<string>("10");
  const [isEstimatedWeight, setIsEstimatedWeight] = useState(false);
  const [estimationNote, setEstimationNote] = useState("");

  // 2. Selected Drug & Formulation
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDrugId, setSelectedDrugId] = useState<string>("paracetamol");
  const [selectedFormulationIdx, setSelectedFormulationIdx] = useState<number>(0);

  // 3. Custom Overrides
  const [customDoseRate, setCustomDoseRate] = useState<number | undefined>(undefined);
  const [customFreq, setCustomFreq] = useState<string>("");
  const [customDuration, setCustomDuration] = useState<string>("");
  const [customInstructions, setCustomInstructions] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // 4. Custom Manual Drug Mode
  const [isManualDrugMode, setIsManualDrugMode] = useState(false);
  const [manualDrugName, setManualDrugName] = useState("");
  const [manualMgPerKg, setManualMgPerKg] = useState("10");
  const [manualStrengthMg, setManualStrengthMg] = useState("120");
  const [manualStrengthMl, setManualStrengthMl] = useState("5");

  // Sync with patient data on open
  useEffect(() => {
    if (isOpen) {
      const wtNum = parseFloat(patientWeight || "");
      if (!isNaN(wtNum) && wtNum > 0) {
        setWeightInput(wtNum.toFixed(1));
        setIsEstimatedWeight(false);
        setEstimationNote("ভাইটালস থেকে প্রাপ্ত রোগীর ওজন");
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

      // Reset drug selection overrides
      setSelectedDrugId("paracetamol");
      setSelectedFormulationIdx(0);
      setCustomDoseRate(undefined);
      setCustomFreq("");
      setCustomDuration("");
      setCustomInstructions("");
      setIsManualDrugMode(false);
    }
  }, [isOpen, patientAge, patientWeight]);

  // Current active drug rule
  const currentDrug = useMemo<PediatricDrugRule>(() => {
    return PEDIATRIC_DRUGS.find((d) => d.id === selectedDrugId) || PEDIATRIC_DRUGS[0];
  }, [selectedDrugId]);

  // Current active formulation
  const currentFormulation = useMemo<PediatricDrugFormulation>(() => {
    if (isManualDrugMode) {
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
  }, [currentDrug, selectedFormulationIdx, isManualDrugMode, manualStrengthMg, manualStrengthMl]);

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
    }
    setIsManualDrugMode(false);
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
  const calculation = useMemo<DoseCalculationResult>(() => {
    if (isManualDrugMode) {
      const drugMock: PediatricDrugRule = {
        id: "manual",
        name: manualDrugName || "Custom Medicine",
        genericName: manualDrugName || "Custom Medicine",
        category: "other",
        defaultDoseRate: parseFloat(manualMgPerKg) || 10,
        doseType: "per_dose",
        recommendedDoseRange: { min: 5, max: 20 },
        formulations: [currentFormulation],
        defaultFrequency: customFreq || "১+১+১",
        defaultDuration: customDuration || "৩ দিন",
        defaultInstructions: customInstructions || "ভরা পেটে সেব্য",
      };
      return calculateChildDose({
        drug: drugMock,
        formulation: currentFormulation,
        weightKg,
        doseRate: parseFloat(manualMgPerKg) || 10,
        frequencyOverride: customFreq,
        durationOverride: customDuration,
        instructionsOverride: customInstructions,
      });
    }

    return calculateChildDose({
      drug: currentDrug,
      formulation: currentFormulation,
      weightKg,
      doseRate: customDoseRate,
      frequencyOverride: customFreq || undefined,
      durationOverride: customDuration || undefined,
      instructionsOverride: customInstructions || undefined,
    });
  }, [
    isManualDrugMode,
    manualDrugName,
    manualMgPerKg,
    currentDrug,
    currentFormulation,
    weightKg,
    customDoseRate,
    customFreq,
    customDuration,
    customInstructions,
  ]);

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
                    Auto Pediatric Dosing
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  ওজন ও বয়স অনুযায়ী শিশুদের সঠিক মিলিলিটার (ml) ও চামচের ডোজ অটো-ক্যালকুলেশন।
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
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 space-y-5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-track]:bg-transparent">
          {/* ================= 1. PATIENT WEIGHT & AGE BAR ================= */}
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

          {/* ================= 2. DRUG SELECTION TABS & PILLS ================= */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-primary" />
                <span>ওষুধ নির্বাচন করুন (Common Pediatric Medicines)</span>
              </Label>
              <button
                type="button"
                onClick={() => setIsManualDrugMode(!isManualDrugMode)}
                className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Sliders className="h-3 w-3" />
                <span>{isManualDrugMode ? "কমন প্রিসেট তালিকা" : "অন্যান্য / কাস্টম ওষুধ"}</span>
              </button>
            </div>

            {!isManualDrugMode ? (
              <>
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto p-1 border rounded-xl border-border/60 bg-muted/20">
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
              </>
            ) : (
              /* Custom Manual Drug Fields */
              <div className="rounded-xl border border-dashed border-primary/40 bg-muted/30 p-3 space-y-3 animate-in fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[11px] font-semibold">ওষুধের নাম (Medicine Name)</Label>
                    <Input
                      placeholder="e.g. Syr. Clavamox"
                      value={manualDrugName}
                      onChange={(e) => setManualDrugName(e.target.value)}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold">ডোজ রেট (mg / kg)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      placeholder="e.g. 15"
                      value={manualMgPerKg}
                      onChange={(e) => setManualMgPerKg(e.target.value)}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold">ঘনত্ব / স্ট্রেন্থ (mg in ml)</Label>
                    <div className="flex items-center gap-1 mt-1">
                      <Input
                        type="number"
                        placeholder="120"
                        value={manualStrengthMg}
                        onChange={(e) => setManualStrengthMg(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <span className="text-xs">mg/</span>
                      <Input
                        type="number"
                        placeholder="5"
                        value={manualStrengthMl}
                        onChange={(e) => setManualStrengthMl(e.target.value)}
                        className="h-8 text-xs w-16"
                      />
                      <span className="text-xs">ml</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ================= 3. AUTO-CALCULATION DISPLAY CARD ================= */}
          <div className="rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-card to-teal-500/10 p-4 sm:p-5 shadow-md">
            <div className="flex items-center justify-between border-b border-border/80 pb-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h4 className="font-bold text-sm sm:text-base text-foreground">
                  {calculation.drugName}
                </h4>
              </div>
              <Badge variant="outline" className="font-semibold text-xs border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                {calculation.formulationName}
              </Badge>
            </div>

            {/* Main Calculated Values */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3.5 text-center">
              <div className="rounded-xl bg-background/80 p-2.5 border border-border/60 shadow-xs">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  প্রতি বারের মাত্রা
                </span>
                <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">
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
                  আনুমানিক প্রয়োজন
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
                <span className="text-emerald-700 dark:text-emerald-300 font-medium">{calculation.instructions}</span>
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

          {/* ================= 4. CUSTOMIZE PANEL (TOGGLEABLE) ================= */}
          <div className="border border-border/70 rounded-2xl p-3.5 space-y-3 bg-muted/10">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between text-xs font-bold text-foreground cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-primary" />
                <span>ডাক্তারের কাস্টমাইজেশন (স্ট্রেন্থ, mg/kg, ডোজ শিডিউল পরিবর্তন করুন)</span>
              </div>
              <span className="text-primary text-[11px] font-semibold underline">
                {showAdvanced ? "লুকান (Hide)" : "এডিট করুন (Customize)"}
              </span>
            </button>

            {showAdvanced && (
              <div className="space-y-3 pt-2 border-t border-border/60 animate-in fade-in">
                {/* Available Formulations of this drug */}
                {!isManualDrugMode && currentDrug.formulations.length > 1 && (
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold">সিরাপের শক্তি / প্রিপারেশন নির্বাচন:</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {currentDrug.formulations.map((f, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedFormulationIdx(idx)}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                            selectedFormulationIdx === idx
                              ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                              : "bg-background text-foreground border-border hover:bg-muted"
                          }`}
                        >
                          {f.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* mg/kg Custom Input */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <Label className="text-[11px] font-semibold">ডোজ রেট (mg / kg)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={customDoseRate ?? currentDrug.defaultDoseRate}
                      onChange={(e) => setCustomDoseRate(parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs mt-1 font-bold"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] font-semibold">সেবনবিধি (Frequency)</Label>
                    <Input
                      value={customFreq || currentDrug.defaultFrequency}
                      onChange={(e) => setCustomFreq(e.target.value)}
                      className="h-8 text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] font-semibold">মেয়াদ (Duration)</Label>
                    <Input
                      value={customDuration || currentDrug.defaultDuration}
                      onChange={(e) => setCustomDuration(e.target.value)}
                      className="h-8 text-xs mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-[11px] font-semibold">নির্দেশনা (Instructions)</Label>
                  <Input
                    value={customInstructions || currentDrug.defaultInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    className="h-8 text-xs mt-1"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ================= 5. MODAL FOOTER & ACTION BUTTONS ================= */}
        <div className="p-4 border-t border-border/80 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <div className="text-[11px] text-muted-foreground w-full sm:w-auto text-center sm:text-left">
            প্রেসক্রিপশনে যুক্ত হবে: <strong className="text-foreground">{calculation.prescriptionLineText.medicineName}</strong>
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
              className="flex-1 sm:flex-initial h-10 font-bold text-xs gap-1.5 cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20 hover:from-emerald-700 hover:to-teal-700"
            >
              <Plus className="h-4 w-4" />
              <span>+ প্রেসক্রিপশনে যোগ করুন</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
