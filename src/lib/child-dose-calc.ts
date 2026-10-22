/**
 * Clinical Pediatric Dose Calculation Engine for Sheikh Pharma
 * Designed for Bangladeshi clinical practice & international BNFc / WHO guidelines.
 */

export interface PediatricDrugFormulation {
  name: string;
  type: "syrup" | "suspension" | "drops" | "tablet";
  mg: number;
  ml: number; // e.g. 120mg in 5ml -> mg=120, ml=5
  dropEquivalentMl?: number; // for drops
}

export interface PediatricDrugRule {
  id: string;
  name: string;
  genericName: string;
  category: "antipyretic" | "antibiotic" | "antiemetic" | "antihistamine" | "respiratory" | "gi" | "supplements" | "other";
  defaultDoseRate: number; // in mg/kg/dose or mg/kg/day
  doseType: "per_dose" | "per_day";
  recommendedDoseRange: { min: number; max: number };
  maxDailyDoseMgPerKg?: number;
  maxDailyDoseAbsoluteMg?: number;
  formulations: PediatricDrugFormulation[];
  defaultFrequency: string; // e.g. "১+১+১"
  defaultDuration: string;  // e.g. "৩ দিন"
  defaultInstructions: string; // e.g. "ভরা পেটে সেব্য"
  clinicalTips?: string;
}

/** Pre-populated database of most commonly prescribed pediatric medicines in Bangladesh. */
export const PEDIATRIC_DRUGS: PediatricDrugRule[] = [
  {
    id: "paracetamol",
    name: "Paracetamol (Napa / Ace / Renova)",
    genericName: "Paracetamol",
    category: "antipyretic",
    defaultDoseRate: 15, // 15 mg/kg/dose
    doseType: "per_dose",
    recommendedDoseRange: { min: 10, max: 15 },
    maxDailyDoseMgPerKg: 60,
    maxDailyDoseAbsoluteMg: 4000,
    formulations: [
      { name: "Syrup (120 mg / 5 ml)", type: "syrup", mg: 120, ml: 5 },
      { name: "Forte Suspension (250 mg / 5 ml)", type: "suspension", mg: 250, ml: 5 },
      { name: "Paediatric Drops (80 mg / 0.8 ml)", type: "drops", mg: 80, ml: 0.8 },
      { name: "Suspension (125 mg / 5 ml)", type: "suspension", mg: 125, ml: 5 },
    ],
    defaultFrequency: "১+১+১ (জ্বর আসলে)",
    defaultDuration: "৩ দিন",
    defaultInstructions: "জ্বর বা ব্যথার জন্য, ভরা পেটে সেব্য (৪-৬ ঘণ্টা পর পর)",
    clinicalTips: "প্রতি ৬ ঘণ্টা পর পর জ্বর আসলে সেব্য। ২৪ ঘণ্টায় ৪ বারের বেশি নয়।",
  },
  {
    id: "amoxicillin",
    name: "Amoxicillin (Moxacil / Fimoxyl / Tycil)",
    genericName: "Amoxicillin",
    category: "antibiotic",
    defaultDoseRate: 40, // 40 mg/kg/day divided into 3 doses
    doseType: "per_day",
    recommendedDoseRange: { min: 25, max: 50 },
    maxDailyDoseMgPerKg: 90,
    formulations: [
      { name: "Dry Syrup (125 mg / 5 ml)", type: "syrup", mg: 125, ml: 5 },
      { name: "Forte Suspension (250 mg / 5 ml)", type: "suspension", mg: 250, ml: 5 },
      { name: "Drops (100 mg / 1.25 ml)", type: "drops", mg: 100, ml: 1.25 },
    ],
    defaultFrequency: "১+১+১",
    defaultDuration: "৭ দিন",
    defaultInstructions: "ভরা পেটে সেব্য, কোর্স সম্পন্ন করুন",
    clinicalTips: "তীব্র কান বা বুকের সংক্রমণে (Otitis/Pneumonia) ডোজ ৪৫-৮০ mg/kg/day হতে পারে।",
  },
  {
    id: "amoxiclav",
    name: "Amoxicillin + Clavulanic Acid (Augmentin / Klavocin / Moxaclav)",
    genericName: "Amoxicillin + Clavulanic Acid",
    category: "antibiotic",
    defaultDoseRate: 35, // 35 mg/kg/day (Amox component)
    doseType: "per_day",
    recommendedDoseRange: { min: 25, max: 45 },
    formulations: [
      { name: "Suspension (156.25 mg / 5 ml)", type: "suspension", mg: 125, ml: 5 },
      { name: "Forte (312.5 mg / 5 ml)", type: "suspension", mg: 250, ml: 5 },
      { name: "Duo (228.5 mg / 5 ml)", type: "suspension", mg: 200, ml: 5 },
      { name: "Duo Forte (457 mg / 5 ml)", type: "suspension", mg: 400, ml: 5 },
    ],
    defaultFrequency: "১+০+১ (প্রতি ১২ ঘণ্টা পর পর)",
    defaultDuration: "৭ দিন",
    defaultInstructions: "খাবারের শুরুতে সেব্য, পেটের অস্বস্তি কমাবে",
    clinicalTips: "Duo প্রিপারেশন দিনে ২ বার (q12h) এবং স্ট্যান্ডার্ড দিনে ৩ বার (q8h)।",
  },
  {
    id: "cefixime",
    name: "Cefixime (Cef-3 / Triocim / Denvar)",
    genericName: "Cefixime",
    category: "antibiotic",
    defaultDoseRate: 8, // 8 mg/kg/day
    doseType: "per_day",
    recommendedDoseRange: { min: 8, max: 12 },
    formulations: [
      { name: "Dry Syrup (100 mg / 5 ml)", type: "syrup", mg: 100, ml: 5 },
      { name: "Forte Suspension (200 mg / 5 ml)", type: "suspension", mg: 200, ml: 5 },
      { name: "Paediatric Drops (100 mg / 1.25 ml)", type: "drops", mg: 100, ml: 1.25 },
    ],
    defaultFrequency: "১+০+১ (প্রতি ১২ ঘণ্টা পর পর)",
    defaultDuration: "৭ দিন",
    defaultInstructions: "খাবারের পর সেব্য, কোর্স সম্পন্ন করুন",
    clinicalTips: "দিনে ১ বার অথবা ২ ভাগে ভাগ করে দিনে ২ বার (প্রতি ১২ ঘণ্টায়) দেওয়া যায়।",
  },
  {
    id: "azithromycin",
    name: "Azithromycin (Zithrin / Azyth / Zimax / Rozith)",
    genericName: "Azithromycin",
    category: "antibiotic",
    defaultDoseRate: 10, // 10 mg/kg/day once daily
    doseType: "per_day",
    recommendedDoseRange: { min: 10, max: 12 },
    formulations: [
      { name: "Dry Syrup (200 mg / 5 ml)", type: "syrup", mg: 200, ml: 5 },
      { name: "Paediatric Suspension (100 mg / 5 ml)", type: "suspension", mg: 100, ml: 5 },
    ],
    defaultFrequency: "১+০+০ (দিনে ১ বার)",
    defaultDuration: "৫ দিন",
    defaultInstructions: "খাওয়ার ১ ঘণ্টা আগে অথবা ২ ঘণ্টা পরে খালি পেটে সেব্য",
    clinicalTips: "দিনে ১ বার নির্দিষ্ট সময়ে খাওয়াতে হবে। সাধারণ মেয়া ৩ থেকে ৫ দিন।",
  },
  {
    id: "cefuroxime",
    name: "Cefuroxime Axetil (Kilbac / Cerox-A / Cetil)",
    genericName: "Cefuroxime",
    category: "antibiotic",
    defaultDoseRate: 25, // 20-30 mg/kg/day divided in 2
    doseType: "per_day",
    recommendedDoseRange: { min: 20, max: 30 },
    formulations: [
      { name: "Suspension (125 mg / 5 ml)", type: "suspension", mg: 125, ml: 5 },
      { name: "Suspension (250 mg / 5 ml)", type: "suspension", mg: 250, ml: 5 },
    ],
    defaultFrequency: "১+০+১ (প্রতি ১২ ঘণ্টা পর পর)",
    defaultDuration: "৭ দিন",
    defaultInstructions: "খাবারের সাথে বা ভরা পেটে সেব্য",
  },
  {
    id: "ibuprofen",
    name: "Ibuprofen (Flam-X / Ibu)",
    genericName: "Ibuprofen",
    category: "antipyretic",
    defaultDoseRate: 10, // 5-10 mg/kg/dose
    doseType: "per_dose",
    recommendedDoseRange: { min: 5, max: 10 },
    maxDailyDoseMgPerKg: 30,
    formulations: [
      { name: "Syrup (100 mg / 5 ml)", type: "syrup", mg: 100, ml: 5 },
    ],
    defaultFrequency: "১+১+১",
    defaultDuration: "৩ দিন",
    defaultInstructions: "অবশ্যই ভরা পেটে সেব্য (খালি পেটে নয়)",
    clinicalTips: "৬ মাসের কম বয়সী শিশুদের ক্ষেত্রে এবং পানিশূন্যতা থাকলে পরিহার করুন।",
  },
  {
    id: "domperidone",
    name: "Domperidone (Motigut / Deflux / Omidon)",
    genericName: "Domperidone",
    category: "antiemetic",
    defaultDoseRate: 0.3, // 0.25 - 0.4 mg/kg/dose
    doseType: "per_dose",
    recommendedDoseRange: { min: 0.2, max: 0.4 },
    formulations: [
      { name: "Suspension (5 mg / 5 ml - 1mg/ml)", type: "suspension", mg: 5, ml: 5 },
      { name: "Paediatric Drops (5 mg / 1 ml)", type: "drops", mg: 5, ml: 1 },
    ],
    defaultFrequency: "১+১+১",
    defaultDuration: "৫ দিন",
    defaultInstructions: "খাবার ১৫-৩০ মিনিট পূর্বে সেব্য",
  },
  {
    id: "ondansetron",
    name: "Ondansetron (Emistat / Onset)",
    genericName: "Ondansetron",
    category: "antiemetic",
    defaultDoseRate: 0.15, // 0.1 - 0.15 mg/kg/dose
    doseType: "per_dose",
    recommendedDoseRange: { min: 0.1, max: 0.15 },
    formulations: [
      { name: "Syrup (4 mg / 5 ml)", type: "syrup", mg: 4, ml: 5 },
    ],
    defaultFrequency: "১+১+১ (বমি হলে)",
    defaultDuration: "৩ দিন",
    defaultInstructions: "বমি প্রতিরোধে খাবারের ২০ মিনিট আগে সেব্য",
  },
  {
    id: "metronidazole",
    name: "Metronidazole (Filmet / Amodis / Flamyd)",
    genericName: "Metronidazole",
    category: "gi",
    defaultDoseRate: 35, // 30-50 mg/kg/day divided in 3
    doseType: "per_day",
    recommendedDoseRange: { min: 30, max: 45 },
    formulations: [
      { name: "Suspension (200 mg / 5 ml)", type: "suspension", mg: 200, ml: 5 },
    ],
    defaultFrequency: "১+১+১",
    defaultDuration: "৫ দিন",
    defaultInstructions: "ভরা পেটে সেব্য",
  },
  {
    id: "cetirizine",
    name: "Cetirizine (Cetriz / Alatrol / Atrizin)",
    genericName: "Cetirizine",
    category: "antihistamine",
    defaultDoseRate: 0.25, // 0.25 mg/kg/dose or age-based
    doseType: "per_dose",
    recommendedDoseRange: { min: 0.2, max: 0.3 },
    formulations: [
      { name: "Syrup (5 mg / 5 ml)", type: "syrup", mg: 5, ml: 5 },
      { name: "Drops (2.5 mg / 1 ml)", type: "drops", mg: 2.5, ml: 1 },
    ],
    defaultFrequency: "০+০+১ (রাতে ১ বার)",
    defaultDuration: "৭ দিন",
    defaultInstructions: "রাতে ঘুমানোর পূর্বে সেব্য",
  },
  {
    id: "fexofenadine",
    name: "Fexofenadine (Fexo / Fenadin / Fexoral)",
    genericName: "Fexofenadine",
    category: "antihistamine",
    defaultDoseRate: 2.5, // 2-3 mg/kg/dose
    doseType: "per_dose",
    recommendedDoseRange: { min: 2, max: 3 },
    formulations: [
      { name: "Suspension (30 mg / 5 ml)", type: "suspension", mg: 30, ml: 5 },
    ],
    defaultFrequency: "১+০+১",
    defaultDuration: "৭ দিন",
    defaultInstructions: "খাবারের সাথে বা পরে সেব্য",
  },
  {
    id: "salbutamol",
    name: "Salbutamol (Ventolin / Sultolin)",
    genericName: "Salbutamol",
    category: "respiratory",
    defaultDoseRate: 0.12, // 0.1 - 0.15 mg/kg/dose
    doseType: "per_dose",
    recommendedDoseRange: { min: 0.1, max: 0.15 },
    formulations: [
      { name: "Syrup (2 mg / 5 ml)", type: "syrup", mg: 2, ml: 5 },
    ],
    defaultFrequency: "১+১+১ (কাশি বা শ্বাসকষ্টে)",
    defaultDuration: "৫ দিন",
    defaultInstructions: "খাবার পর সেব্য",
  },
  {
    id: "zinc",
    name: "Zinc Sulphate (Baby Zinc / Zif-CI)",
    genericName: "Zinc Sulphate",
    category: "supplements",
    defaultDoseRate: 1.5,
    doseType: "per_dose",
    recommendedDoseRange: { min: 1, max: 2 },
    formulations: [
      { name: "Syrup (10 mg / 5 ml)", type: "syrup", mg: 10, ml: 5 },
      { name: "Dispersible Tab (20 mg)", type: "tablet", mg: 20, ml: 1 },
    ],
    defaultFrequency: "১+০+০ (দিনে ১ বার)",
    defaultDuration: "১৪ দিন",
    defaultInstructions: "ডায়রিয়ার চিকিৎসায় একটানা ১০ থেকে ১৪ দিন নিয়মিত খাওয়াতে হবে",
    clinicalTips: "৬ মাসের কম বয়সে ১০ mg (১ চামচ) এবং ৬ মাসের বেশি হলে ২০ mg (২ চামচ বা ১টি ট্যাবলেট পানিতে গুলিয়ে)।",
  },
];

/**
 * Estimate standard child weight (kg) from age string or number.
 * Uses WHO / Advanced Paediatric Life Support (APLS) growth formulas.
 */
export function estimateWeightFromAge(ageStrOrYears: string | number): {
  weightKg: number;
  isEstimate: boolean;
  explanation: string;
} {
  let ageYears = 0;
  let isMonths = false;

  if (typeof ageStrOrYears === "number") {
    ageYears = ageStrOrYears;
  } else {
    const raw = String(ageStrOrYears || "").trim().toLowerCase();
    if (raw.includes("m") || raw.includes("মাস") || raw.includes("month")) {
      isMonths = true;
      const num = parseFloat(raw.replace(/[^0-9.]/g, "")) || 0;
      ageYears = num / 12;
    } else {
      const num = parseFloat(raw.replace(/[^0-9.]/g, "")) || 0;
      ageYears = num;
    }
  }

  if (ageYears <= 0) {
    return { weightKg: 10, isEstimate: true, explanation: "ডিফল্ট আনুমানিক ওজন (১০ কেজি)" };
  }

  // < 1 year (Months formula: (Months + 9) / 2)
  if (ageYears < 1) {
    const months = Math.max(1, Math.round(ageYears * 12));
    const wt = Math.round(((months + 9) / 2) * 10) / 10;
    return {
      weightKg: Math.min(wt, 10),
      isEstimate: true,
      explanation: `${months} মাস বয়সী শিশুর আনুমানিক ওজন (${wt} কেজি)`,
    };
  }

  // 1 to 5 years: (Age + 5) * 2
  if (ageYears <= 5) {
    const wt = Math.round((ageYears + 5) * 2 * 10) / 10;
    return {
      weightKg: wt,
      isEstimate: true,
      explanation: `${Math.round(ageYears)} বছর বয়সী শিশুর আনুমানিক ওজন (${wt} কেজি)`,
    };
  }

  // 6 to 12 years: (Age * 3) + 7
  if (ageYears <= 12) {
    const wt = Math.round((ageYears * 3 + 7) * 10) / 10;
    return {
      weightKg: wt,
      isEstimate: true,
      explanation: `${Math.round(ageYears)} বছর বয়সী শিশুর আনুমানিক ওজন (${wt} কেজি)`,
    };
  }

  // Above 12 years
  const wt = Math.round((40 + (ageYears - 12) * 2.5) * 10) / 10;
  return {
    weightKg: Math.min(wt, 60),
    isEstimate: true,
    explanation: `${Math.round(ageYears)} বছর বয়সী কিশোর/কিশোরীর আনুমানিক ওজন (${wt} কেজি)`,
  };
}

/**
 * Format milliliters into intuitive Bengali & English teaspoon description.
 * 5 ml = 1 tsp
 */
export function formatTeaspoon(ml: number): { bn: string; en: string } {
  if (ml <= 0) return { bn: "০ মিলি", en: "0 ml" };

  const tsp = ml / 5;

  let tspStrBn = "";
  let tspStrEn = "";

  if (Math.abs(tsp - 0.25) < 0.05) {
    tspStrBn = "১/৪ চামচ";
    tspStrEn = "1/4 tsp";
  } else if (Math.abs(tsp - 0.5) < 0.05) {
    tspStrBn = "আধা চামচ (১/২)";
    tspStrEn = "1/2 tsp";
  } else if (Math.abs(tsp - 0.75) < 0.05) {
    tspStrBn = "৩/৪ চামচ";
    tspStrEn = "3/4 tsp";
  } else if (Math.abs(tsp - 1.0) < 0.05) {
    tspStrBn = "১ চা চামচ";
    tspStrEn = "1 tsp";
  } else if (Math.abs(tsp - 1.25) < 0.05) {
    tspStrBn = "১ ও ১/৪ চামচ";
    tspStrEn = "1.25 tsp";
  } else if (Math.abs(tsp - 1.5) < 0.05) {
    tspStrBn = "দেড় চামচ (১.৫)";
    tspStrEn = "1.5 tsp";
  } else if (Math.abs(tsp - 1.75) < 0.05) {
    tspStrBn = "১ ও ৩/৪ চামচ";
    tspStrEn = "1.75 tsp";
  } else if (Math.abs(tsp - 2.0) < 0.05) {
    tspStrBn = "২ চা চামচ";
    tspStrEn = "2 tsp";
  } else if (Math.abs(tsp - 2.5) < 0.05) {
    tspStrBn = "আড়াই চামচ (২.৫)";
    tspStrEn = "2.5 tsp";
  } else if (Math.abs(tsp - 3.0) < 0.05) {
    tspStrBn = "৩ চা চামচ";
    tspStrEn = "3 tsp";
  } else {
    tspStrBn = `${tsp.toFixed(1)} চামচ`;
    tspStrEn = `${tsp.toFixed(1)} tsp`;
  }

  return {
    bn: `${ml.toFixed(1)} মিলি (${tspStrBn})`,
    en: `${ml.toFixed(1)} ml (${tspStrEn})`,
  };
}

export interface DoseCalculationResult {
  drugName: string;
  formulationName: string;
  weightKg: number;
  doseRateMgPerKg: number;
  mgPerDose: number;
  totalDailyMg: number;
  mlPerDose: number;
  totalDailyMl: number;
  teaspoonText: { bn: string; en: string };
  frequency: string;
  duration: string;
  instructions: string;
  bottlesNeededEstimate: number;
  prescriptionLineText: {
    medicineName: string;
    frequency: string;
    duration: string;
    instructions: string;
    quantity: number;
  };
  warning?: string;
}

/**
 * Calculate accurate pediatric dosage based on drug, weight, formulation, and custom options.
 */
export function calculateChildDose(params: {
  drug: PediatricDrugRule;
  formulation: PediatricDrugFormulation;
  weightKg: number;
  doseRate?: number; // overrides defaultDoseRate if provided
  frequencyOverride?: string;
  durationOverride?: string;
  instructionsOverride?: string;
}): DoseCalculationResult {
  const { drug, formulation, weightKg } = params;
  const wt = Math.max(0.5, weightKg);
  const doseRate = params.doseRate ?? drug.defaultDoseRate;

  // Determine doses per day from frequency string
  let dosesPerDay = 3;
  const freq = (params.frequencyOverride ?? drug.defaultFrequency).trim();
  if (freq.includes("১+০+০") || freq.includes("০+০+১") || freq.includes("দিনে ১ বার") || freq.includes("1+0+0") || freq.includes("0+0+1")) {
    dosesPerDay = 1;
  } else if (freq.includes("১+০+১") || freq.includes("দিনে ২ বার") || freq.includes("1+0+1")) {
    dosesPerDay = 2;
  } else if (freq.includes("১+১+১+১") || freq.includes("দিনে ৪ বার") || freq.includes("1+1+1+1")) {
    dosesPerDay = 4;
  } else {
    dosesPerDay = 3;
  }

  let mgPerDose = 0;
  let totalDailyMg = 0;

  if (drug.doseType === "per_dose") {
    mgPerDose = wt * doseRate;
    totalDailyMg = mgPerDose * dosesPerDay;
  } else {
    // per_day: divided by dosesPerDay
    totalDailyMg = wt * doseRate;
    mgPerDose = totalDailyMg / Math.max(1, dosesPerDay);
  }

  // Calculate volume in ml
  // formulation: formulation.mg in formulation.ml -> mg/ml ratio
  const concentrationMgPerMl = formulation.mg / formulation.ml;
  const mlPerDose = mgPerDose / concentrationMgPerMl;
  const totalDailyMl = mlPerDose * dosesPerDay;

  // Bottle count estimation (assuming standard 60ml or 100ml syrup bottle)
  let durationDays = 5;
  const dur = (params.durationOverride ?? drug.defaultDuration).trim();
  const matchDays = dur.match(/\d+/);
  if (matchDays) durationDays = parseInt(matchDays[0], 10);
  const totalCourseMl = totalDailyMl * durationDays;
  const bottlesNeeded = Math.max(1, Math.ceil(totalCourseMl / 80));

  const teaspoon = formatTeaspoon(Math.round(mlPerDose * 10) / 10);

  // Safety Warning checks
  let warning: string | undefined;
  if (drug.maxDailyDoseMgPerKg && totalDailyMg / wt > drug.maxDailyDoseMgPerKg) {
    warning = `সতর্কতা: দৈনিক মোট মাত্রা ${drug.maxDailyDoseMgPerKg} mg/kg সীমা ছাড়িয়ে গেছে!`;
  } else if (drug.maxDailyDoseAbsoluteMg && totalDailyMg > drug.maxDailyDoseAbsoluteMg) {
    warning = `সতর্কতা: দৈনিক মোট মাত্রা ${drug.maxDailyDoseAbsoluteMg} mg সীমা ছাড়িয়ে গেছে!`;
  }

  const finalInstructions = params.instructionsOverride ?? drug.defaultInstructions;
  const finalDuration = params.durationOverride ?? drug.defaultDuration;
  const finalFrequency = params.frequencyOverride ?? drug.defaultFrequency;

  // Clean Medicine line formatted for doctors
  const formattedMedName = `${formulation.type === "drops" ? "Drops" : "Syr."} ${drug.genericName} (${formulation.name})`;
  const formattedFrequency = `${teaspoon.bn} করে ${finalFrequency}`;

  return {
    drugName: drug.name,
    formulationName: formulation.name,
    weightKg: wt,
    doseRateMgPerKg: doseRate,
    mgPerDose: Math.round(mgPerDose * 10) / 10,
    totalDailyMg: Math.round(totalDailyMg * 10) / 10,
    mlPerDose: Math.round(mlPerDose * 10) / 10,
    totalDailyMl: Math.round(totalDailyMl * 10) / 10,
    teaspoonText: teaspoon,
    frequency: finalFrequency,
    duration: finalDuration,
    instructions: finalInstructions,
    bottlesNeededEstimate: bottlesNeeded,
    prescriptionLineText: {
      medicineName: formattedMedName,
      frequency: formattedFrequency,
      duration: finalDuration,
      instructions: finalInstructions,
      quantity: bottlesNeeded,
    },
    warning,
  };
}
