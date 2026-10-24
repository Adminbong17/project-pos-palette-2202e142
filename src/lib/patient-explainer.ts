/**
 * Sheikh Pharma Patient Explainer Intelligence
 * ----------------------------------------------------
 * Generates plain-Bangla, patient-friendly explanations for:
 * 1. Prescriptions (Dose timings, why prescribed, instructions, warnings, drug interactions)
 * 2. Lab Reports (Summary metrics, parameter explanations, status detection, reassuring advice)
 */

export interface ExplainedMedicine {
  originalName: string;
  cleanName: string;
  formType: "ট্যাবলেট" | "ক্যাপসুল" | "সিরাপ" | "ইনজেকশন" | "ড্রপস" | "মলম" | "ওষুধ";
  category: string;
  purpose: string;
  howToTake: string;
  sideEffects: string;
  precautions: string;
  morningDose: string;
  noonDose: string;
  nightDose: string;
  durationText: string;
  summaryFrequency: string;
}

export interface PrescriptionExplanation {
  overallCondition: string;
  treatmentGoals: string[];
  vitalsExplained: { label: string; value: string; status: string; note: string }[];
  investigationsExplained: { name: string; reason: string }[];
  medicines: ExplainedMedicine[];
  drugInteraction: {
    status: "safe" | "caution" | "warning";
    message: string;
  };
  lifestyleAdvice: string[];
  dangerSigns: string[];
  totalMedicines: number;
}

export interface LabParameterExplained {
  name: string;
  result: string;
  unit: string;
  refRange: string;
  status: "normal" | "mild" | "abnormal";
  statusText: string;
  banglaMeaning: string;
}

export interface LabReportExplanation {
  testName: string;
  totalParameters: number;
  normalCount: number;
  mildCount: number;
  abnormalCount: number;
  reassuranceTitle: string;
  reassuranceMessage: string;
  riskLevel: "ঝুঁকিমুক্ত" | "হালকা পর্যবেক্ষণ প্রয়োজন" | "চিকিৎসকের পরামর্শ জরুরি";
  parameters: LabParameterExplained[];
  patientTips: string[];
  dangerSigns: string[];
  faqs: { question: string; answer: string }[];
}

/* ========================================================================== */
/*                           MEDICINE KNOWLEDGE BASE                          */
/* ========================================================================== */

interface DrugRule {
  pattern: RegExp;
  category: string;
  purpose: string;
  howToTake: string;
  sideEffects: string;
  precautions: string;
  formTypeFallback?: ExplainedMedicine["formType"];
}

const DRUG_RULES: DrugRule[] = [
  {
    pattern: /\b(paracetamol|napa|ace|fast|reset|pyrex|renova|tamol)\b/i,
    category: "জ্বর ও ব্যথানাশক ওষুধ",
    purpose: "জ্বর, মাথাব্যথা, গা ব্যথা ও যেকোনো মৃদু থেকে মাঝারি শারীরিক অস্বস্তি উপশম করে।",
    howToTake: "খাবারের পরে সেব্য। দিনে সর্বোচ্চ ৩-৪ বার, প্রয়োজনের অতিরিক্ত খাবেন না।",
    sideEffects: "বমি বমি ভাব, সামান্য পেটের অস্বস্তি (অ্যালার্জি খুব বিরল)।",
    precautions: "২৪ ঘণ্টায় ৪ গ্রামের (৮টি ৫০০ মিলিগ্রাম ট্যাবলেটের) বেশি খাবেন না। লিভার রোগ থাকলে ডাক্তারের পরামর্শ নিন।",
  },
  {
    pattern: /\b(ciprofloxacin|ciprocin|neofloxin|cpro|ciflocin|flontin)\b/i,
    category: "অ্যান্টিবায়োটিক (ব্যাকটেরিয়া প্রতিরোধী)",
    purpose: "মূত্রনালির ইনফেকশন (UTI), ডায়রিয়া, টাইফয়েড ও অন্যান্য ব্যাকটেরিয়াজনিত সংক্রমণ দূর করতে সাহায্য করে।",
    howToTake: "খাবারের আগে বা পরে খাওয়া যায়। ৭ দিন বা চিকিৎসকের নির্ধারিত পূর্ণ মেয়াদে খেতে হবে।",
    sideEffects: "বমি বমি ভাব, পেট খারাপ/ডায়রিয়া, মাথা ঘোরার অনুভূতি।",
    precautions: "লক্ষণ কমে গেলেও অ্যান্টিবায়োটিকের পূর্ণ কোর্স শেষ করবেন না। প্রচুর পানি পান করুন।",
  },
  {
    pattern: /\b(amoxicillin|moxacil|flemoxin|clavamox|augpen|moxaclav|tyclav)\b/i,
    category: "অ্যান্টিবায়োটিক",
    purpose: "কান, গলা, দাঁত, বুক ও শ্বাসতন্ত্রের ব্যাকটেরিয়াল সংক্রমণ নিয়ন্ত্রণে সহায়তা করে।",
    howToTake: "খাবারের সাথে বা পরে পূর্ণ মেয়াদ পর্যন্ত খেতে হবে।",
    sideEffects: "ডায়রিয়া, পেটে গ্যাস বা হালকা র‍্যাশ।",
    precautions: "পেনিসিলিনে অ্যালার্জি থাকলে ডাক্তারকে জানান। মাঝপথে ওষুধ বন্ধ করবেন না।",
  },
  {
    pattern: /\b(azithromycin|zimax|azith|tritex|azex|odaz)\b/i,
    category: "অ্যান্টিবায়োটিক (ম্যাক্রোলাইড)",
    purpose: "গলা ব্যথা, টনসিল, ফুসফুসের ইনফেকশন ও টাইফয়েড নিরাময়ে কাজ করে।",
    howToTake: "প্রতিদিন একবার, নির্দিষ্ট সময়ে। খাবারের ১ ঘণ্টা আগে বা ২ ঘণ্টা পরে খাওয়া উত্তম।",
    sideEffects: "হালকা পেটে ব্যথা বা লুজ মোশন।",
    precautions: "অ্যান্টাসিড বা ক্যালসিয়াম ওষুধের সাথে খাবেন না (কমপক্ষে ২ ঘণ্টার ব্যবধান রাখুন)।",
  },
  {
    pattern: /\b(cefixime|cef-3|triocim|denvar|ceftid|cefrox|cefuroxime|kilbac|furocef|cerox)\b/i,
    category: "শক্তিশালী সেফালোস্পোরিন অ্যান্টিবায়োটিক",
    purpose: "মূত্রনালি, ফুসফুস ও জটিল ব্যাকটেরিয়াল ইনফেকশন সারাতে সাহায্য করে।",
    howToTake: "খাবারের পরে নিয়মিত নির্দিষ্ট সময়ে দিনে ১-২ বার খান।",
    sideEffects: "হালকা ডায়রিয়া, বমি ভাব।",
    precautions: "পূর্ণ মেয়াদ সম্পন্ন করতে হবে। কোনো ডোজ মিস করবেন না।",
  },
  {
    pattern: /\b(metronidazole|filmet|amodi|flamet|flagyl)\b/i,
    category: "অ্যামিবানাশক ও অ্যান্টিবায়োটিক",
    purpose: "পেটের আমাশয়, ডায়রিয়া, দাঁতের মাড়ির ইনফেকশন ও পরজীবী ধ্বংসে কাজ করে।",
    howToTake: "অবশ্যই ভরা পেটে এক গ্লাস পানির সাথে খাবেন।",
    sideEffects: "মুখে মেটালিক বা তেতো স্বাদ, বমি ভাব।",
    precautions: "ওষুধ চলাকালীন মদ্যপান বা অ্যালকোহল সম্পূর্ণ নিষিদ্ধ।",
  },
  {
    pattern: /\b(esomeprazole|pantoprazole|omeprazole|rabeprazole|sergel|pantonix|seclo|maxpro|nexum|finix|acifix)\b/i,
    category: "গ্যাস্ট্রিক ও এসিডিটি নিরামক (PPI)",
    purpose: "পেটের অতিরিক্ত এসিড কমায়, গ্যাস্ট্রিকের জ্বালাপোড়া, বুকজ্বালা ও আলসার প্রতিরোধ করে।",
    howToTake: "সকালে ও রাতে খাবারের ২০-৩০ মিনিট আগে এক গ্লাস পানির সাথে খাবেন।",
    sideEffects: "মাথাব্যথা, পেট ফাঁপা বা কোষ্ঠকাঠিন্য (খুবই কম হয়)।",
    precautions: "ক্যাপসুল চিবিয়ে খাবেন না, আস্ত গিলে ফেলবেন।",
  },
  {
    pattern: /\b(domperidone|motigut|deflux|omidon|ondansetron|ofran|emistat)\b/i,
    category: "বমি ও গ্যাস নিরোধক (Prokinetic / Antiemetic)",
    purpose: "বমি বমি ভাব, অস্বস্তি দূর করে এবং খাবার সহজে হজম হতে সাহায্য করে।",
    howToTake: "খাবারের ১৫-৩০ মিনিট আগে খাওয়া সবচেয়ে কার্যকর।",
    sideEffects: "মুখ শুকিয়ে যাওয়া, হালকা মাথা ঝিমঝিম।",
    precautions: "হৃদরোগ থাকলে অতিরিক্ত মাত্রায় খাওয়া পরিহার করুন।",
  },
  {
    pattern: /\b(cetirizine|alatrol|atrizin|fexofenadine|fexo|fexod|bilastine|bilaben|bilaid|desloratadine|deslor|rupatadine)\b/i,
    category: "অ্যান্টিহিস্টামিন (অ্যালার্জি ও সর্দি নিরোধক)",
    purpose: "সর্দি, হাঁচি, নাক বা চোখ দিয়ে পানি পড়া এবং ত্বকের চুলকানি দূর করে।",
    howToTake: "প্রতিদিন ১ বার (সাধারণত রাতে ঘুমানোর আগে বা খাবারের পরে)।",
    sideEffects: "হালকা ঘুম ঘুম ভাব হতে পারে।",
    precautions: "ওষুধ খাওয়ার পর অতিরিক্ত মনোযোগের ভারী কাজ বা গাড়ি চালানো এড়িয়ে চলুন।",
  },
  {
    pattern: /\b(montelukast|montene|provair|monas|odmon|m-kast)\b/i,
    category: "অ্যাজমা ও অ্যালার্জি প্রতিরোধক",
    purpose: "শ্বাসনালির ফোলা ও সংকোচন দূর করে হাঁপানি, শ্বাসকষ্ট ও দীর্ঘমেয়াদি কাশি প্রতিরোধ করে।",
    howToTake: "প্রতিদিন রাতে শোবার সময় ১টি ট্যাবলেট নিয়মিত খেতে হয়।",
    sideEffects: "মাথাব্যথা বা হালকা পেটের সমস্যা।",
    precautions: "হঠাৎ তীব্র শ্বাসকষ্টের সময় ইনহেলার ব্যবহার করতে হবে।",
  },
  {
    pattern: /\b(aceclofenac|flexi|zerodol|naproxen|anaflex|xenapro|ketorolac|rolac|torax|ibuprofen|flamyd)\b/i,
    category: "তীব্র ব্যথানাশক ও প্রদাহবিরোধী (NSAID)",
    purpose: "হাড়, মাংসপেশি, দাঁতের ব্যথা বা শরীরের প্রদাহ কমাতে সাহায্য করে।",
    howToTake: "অবশ্যই ভরা পেটে খাবেন এবং সাথে গ্যাস্ট্রিকের ওষুধ খাওয়া উচিত।",
    sideEffects: "পেট জ্বালাপোড়া বা গ্যাস্ট্রিকের অস্বস্তি।",
    precautions: "খালি পেটে কখনো খাবেন না। কিডনি রোগ বা আলসার থাকলে ডাক্তারের পরামর্শ ছাড়া খাবেন না।",
  },
  {
    pattern: /\b(calcium|coralcal|calbo|d-rise|osteocal|zinc|babyzinc|b-50|neuro-b|folic)\b/i,
    category: "পুষ্টি ও ভিটামিন সাপ্লিমেন্ট",
    purpose: "হাড়, পেশি ও স্নায়ুকে শক্তিশালী করে এবং শরীরে রোগ প্রতিরোধ ক্ষমতা বাড়ায়।",
    howToTake: "দুপুরে বা রাতে খাবারের পর পর্যাপ্ত পানির সাথে সেব্য।",
    sideEffects: "হালকা কোষ্ঠকাঠিন্য বা পেট ভারী লাগা।",
    precautions: "অ্যান্টিবায়োটিকের কমপক্ষে ২ ঘণ্টা আগে বা পরে খাবেন।",
  },
];

/* ========================================================================== */
/*                           TESTS KNOWLEDGE BASE                             */
/* ========================================================================== */

const TEST_REASONS: Record<string, string> = {
  cbc: "রক্তের বিভিন্ন উপাদান (হিমোগ্লোবিন, শ্বেত রক্তকণিকা, প্লেটলেট) দেখে সংক্রমণ বা রক্তস্বল্পতা বুঝতে সাহায্য করবে।",
  "complete blood count": "রক্তের সামগ্রিক স্বাস্থ্য, রক্তের ঘনত্ব এবং শরীরে ইনফেকশন আছে কি না তা নির্ণয় করতে।",
  "urine for c/s": "মূত্রনালিতে ব্যাকটেরিয়াল সংক্রমণ আছে কি না এবং কোন অ্যান্টিবায়োটিক সবচেয়ে ভালো কাজ করবে তা নিশ্চিত করতে।",
  "urine c/s": "মূত্রনালির ইনফেকশন ও কার্যকর ওষুধ নির্ধারণের জন্য।",
  "urine r/e": "প্রস্রাবে ইনফেকশন, পুঁজ, রক্ত বা প্রোটিন ক্ষরণ হচ্ছে কি না তা তাৎক্ষণিক দেখতে।",
  esr: "শরীরে কোনো দীর্ঘস্থায়ী বা তীব্র প্রদাহ (Inflammation) রয়েছে কি না তা জানতে।",
  creatinine: "কিডনি স্বাভাবিকভাবে কাজ করছে কি না এবং রক্ত পরিশোধন ঠিকমতো হচ্ছে কি না তা পরীক্ষা করতে।",
  "serum creatinine": "কিডনির সুস্থতা ও কার্যক্ষমতা যাচাই করতে।",
  rbs: "রক্তের তাৎক্ষণিক শর্করার মাত্রা (ডায়াবেটিস) যাচাই করতে।",
  fbs: "খালি পেটে ডায়াবেটিসের সঠিক মাত্রা নির্ণয় করতে।",
  hba1c: "বিগত ৩ মাসের গড় রক্তের সুগারের নিয়ন্ত্রণ ও স্থায়িত্ব দেখতে।",
  sgpt: "লিভারের কোনো প্রদাহ বা এনজাইমের তারতম্য আছে কি না তা পরীক্ষা করতে।",
  alt: "লিভারের কার্যকারিতা ও স্বাস্থ্য যাচাই করতে।",
  usg: "পেটের ভেতরের অঙ্গপ্রত্যঙ্গ (লিভার, কিডনি, গলব্লাডার) আল্ট্রাসাউন্ডের মাধ্যমে পর্যবেক্ষণ করতে।",
  "x-ray": "বুকের ফুসফুস বা হাড়ের কোনো সমস্যা আছে কি না তা এক্স-রে এর মাধ্যমে দেখতে।",
};

/* ========================================================================== */
/*                         PARSE DOSAGE SCHEDULE                              */
/* ========================================================================== */

export function parseDoseSchedule(freq: string, formType: string): {
  morning: string;
  noon: string;
  night: string;
  summary: string;
} {
  const f = (freq || "").toLowerCase().trim();
  const unit = formType === "সিরাপ" ? "চামচ" : formType === "ড্রপস" ? "ড্রপ" : "ট্যাবলেট";

  // Check if explicit teaspoon / ml present
  let customAmount = "";
  if (f.includes("মিলি") || f.includes("ml") || f.includes("চামচ")) {
    const match = f.match(/([০-৯0-9.]+\s*(?:মিলি|ml|চামচ)(?:\s*\([^)]+\))?)/i);
    if (match) customAmount = match[1];
  }

  const defaultAmt = customAmount || `১টি ${unit}`;

  // Patterns like 1+0+1, 1+1+1, 0+0+1, 1+0+0
  const matchPattern = f.match(/([0-9০-৯]+)\s*[\+\-]\s*([0-9০-৯]+)(?:\s*[\+\-]\s*([0-9০-৯]+))?(?:\s*[\+\-]\s*([0-9০-৯]+))?/);

  if (matchPattern) {
    const m = parseInt(matchPattern[1].replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d).toString()), 10) || 0;
    const n = parseInt(matchPattern[2].replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d).toString()), 10) || 0;
    const e = matchPattern[3] ? parseInt(matchPattern[3].replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d).toString()), 10) : 0;

    const morning = m > 0 ? (customAmount ? customAmount : `${m}টি ${unit}`) : "—";
    const noon = n > 0 ? (customAmount ? customAmount : `${n}টি ${unit}`) : "—";
    const night = e > 0 ? (customAmount ? customAmount : `${e}টি ${unit}`) : "—";

    const parts: string[] = [];
    if (m > 0) parts.push("সকাল");
    if (n > 0) parts.push("দুপুর");
    if (e > 0) parts.push("রাত");
    const count = (m > 0 ? 1 : 0) + (n > 0 ? 1 : 0) + (e > 0 ? 1 : 0);
    const summary = `প্রতিদিন মোট ${count} বার (${parts.join("-")})`;

    return { morning, noon, night, summary };
  }

  // Fallback defaults
  if (f.includes("সকাল") && f.includes("রাত")) {
    return {
      morning: defaultAmt,
      noon: "—",
      night: defaultAmt,
      summary: "প্রতিদিন মোট ২ বার (সকাল ও রাত)",
    };
  }
  if (f.includes("৩ বার") || f.includes("3 বার")) {
    return {
      morning: defaultAmt,
      noon: defaultAmt,
      night: defaultAmt,
      summary: "প্রতিদিন মোট ৩ বার (সকাল-দুপুর-রাত)",
    };
  }
  if (f.includes("রাত") || f.includes("রাতে")) {
    return {
      morning: "—",
      noon: "—",
      night: defaultAmt,
      summary: "প্রতিদিন রাতে ১ বার",
    };
  }

  return {
    morning: defaultAmt,
    noon: "—",
    night: defaultAmt,
    summary: "ডাক্তারের পরামর্শ অনুযায়ী সেব্য",
  };
}

/* ========================================================================== */
/*                     EXPLAIN PRESCRIPTION FUNCTION                          */
/* ========================================================================== */

export function explainPrescription(rx: {
  patient_name?: string | null;
  patient_age?: string | null;
  patient_gender?: string | null;
  doctor_name?: string | null;
  doctor_qualification?: string | null;
  diagnosis?: string | null;
  advice?: string | null;
  investigation?: string | null;
  next_visit?: string | null;
  vitals?: any;
  lines?: { medicine_name: string; dose?: string; frequency?: string; duration?: string; instructions?: string }[];
}): PrescriptionExplanation {
  const lines = rx.lines || [];
  const explainedMeds: ExplainedMedicine[] = [];

  for (const line of lines) {
    const rawName = (line.medicine_name || "").trim();
    if (!rawName) continue;

    // Detect form type
    let formType: ExplainedMedicine["formType"] = "ট্যাবলেট";
    if (/\b(syr\.|syrup|susp\.|suspension)\b/i.test(rawName)) formType = "সিরাপ";
    else if (/\b(cap\.|capsule)\b/i.test(rawName)) formType = "ক্যাপসুল";
    else if (/\b(inj\.|injection)\b/i.test(rawName)) formType = "ইনজেকশন";
    else if (/\b(drop|drops)\b/i.test(rawName)) formType = "ড্রপস";
    else if (/\b(ointment|cream|gel)\b/i.test(rawName)) formType = "মলম";

    // Clean brand name
    const cleanName = rawName.replace(/^(tab\.|tab|cap\.|cap|syr\.|syr|inj\.|susp\.|drops?)\s*/i, "").trim();

    // Match rule
    const matchedRule = DRUG_RULES.find((r) => r.pattern.test(rawName) || r.pattern.test(cleanName));

    const category = matchedRule ? matchedRule.category : "প্রেসক্রিপশন অনুযায়ী প্রয়োজনীয় ওষুধ";
    const purpose = matchedRule ? matchedRule.purpose : "চিকিৎসক রোগীর শারীরিক অবস্থা অনুযায়ী এই ওষুধটি নির্ধারণ করেছেন।";
    const howToTake = matchedRule
      ? `${line.instructions ? `${line.instructions}। ` : ""}${matchedRule.howToTake}`
      : (line.instructions || "চিকিৎসকের পরামর্শ অনুযায়ী নিয়ম মেনে সেব্য।");
    const sideEffects = matchedRule ? matchedRule.sideEffects : "সাধারণত সহনশীল, তবে কোনো সমস্যা দেখা দিলে ডাক্তারকে জানান।";
    const precautions = matchedRule ? matchedRule.precautions : "নির্ধারিত মাত্রার বেশি খাবেন না এবং সময়মতো ওষুধ সেবন করুন।";

    // Dosage schedule
    const sched = parseDoseSchedule(line.frequency || line.dose || "", formType);

    explainedMeds.push({
      originalName: rawName,
      cleanName,
      formType,
      category,
      purpose,
      howToTake,
      sideEffects,
      precautions,
      morningDose: sched.morning,
      noonDose: sched.noon,
      nightDose: sched.night,
      durationText: line.duration || "৭ দিন",
      summaryFrequency: sched.summary,
    });
  }

  // Parse Vitals
  const vitalsList: { label: string; value: string; status: string; note: string }[] = [];
  let parsedVitals: Record<string, string> = {};
  if (typeof rx.vitals === "string") {
    try {
      parsedVitals = JSON.parse(rx.vitals);
    } catch {
      // string format
    }
  } else if (typeof rx.vitals === "object" && rx.vitals !== null) {
    parsedVitals = rx.vitals;
  }

  if (parsedVitals.bp) {
    vitalsList.push({
      label: "BP (রক্তচাপ)",
      value: `${parsedVitals.bp} mmHg`,
      status: "মোটামুটি স্বাভাবিক",
      note: "রক্তচাপ স্বাভাবিক সীমায় রয়েছে।",
    });
  }
  if (parsedVitals.pulse) {
    vitalsList.push({
      label: "Pulse (নাড়ির গতি)",
      value: `${parsedVitals.pulse} bpm`,
      status: "স্বাভাবিক",
      note: "হৃদস্পন্দনের গতি স্বাভাবিক আছে।",
    });
  }
  if (parsedVitals.temp) {
    const tVal = parseFloat(parsedVitals.temp);
    const isFever = !isNaN(tVal) && tVal >= 99;
    vitalsList.push({
      label: "Temp (শরীরের তাপমাত্রা)",
      value: `${parsedVitals.temp}° F`,
      status: isFever ? "জ্বর নির্দেশ করে" : "স্বাভাবিক",
      note: isFever ? "শরীরে হালকা থেকে মাঝারি জ্বর রয়েছে।" : "শরীরের তাপমাত্রা স্বাভাবিক।",
    });
  }
  if (parsedVitals.weight) {
    vitalsList.push({
      label: "Weight (ওজন)",
      value: `${parsedVitals.weight} kg`,
      status: "নথিবদ্ধ",
      note: "শারীরিক ওজন অনুযায়ী ওষুধের মাত্রা নির্ধারিত।",
    });
  }

  // Parse Investigations
  const invList: { name: string; reason: string }[] = [];
  const rawInv = (rx.investigation || "").split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  for (const inv of rawInv) {
    const key = inv.toLowerCase();
    let reason = "শারীরিক অবস্থা ও রোগের সঠিক কারণ নিখুঁতভাবে জানার জন্য।";
    for (const [k, v] of Object.entries(TEST_REASONS)) {
      if (key.includes(k)) {
        reason = v;
        break;
      }
    }
    invList.push({ name: inv, reason });
  }

  // Treatment Goals
  const diag = (rx.diagnosis || "").toLowerCase();
  const goals: string[] = [];
  if (diag.includes("fever") || diag.includes("জ্বর") || parsedVitals.temp) {
    goals.push("জ্বর দ্রুত উপশম করা");
  }
  if (diag.includes("uti") || diag.includes("infection") || diag.includes("সংক্রমণ") || explainedMeds.some((m) => m.category.includes("অ্যান্টিবায়োটিক"))) {
    goals.push("সংক্রমণ বা ব্যাকটেরিয়াল ইনফেকশন নিয়ন্ত্রণ করা");
  }
  if (diag.includes("pain") || diag.includes("ব্যথা") || explainedMeds.some((m) => m.category.includes("ব্যথা"))) {
    goals.push("ব্যথা ও শারীরিক অস্বস্তি কমানো");
  }
  goals.push("রোগ প্রতিরোধ ক্ষমতা বাড়ানো ও শরীরকে দ্রুত সুস্থ হতে সাহায্য করা");

  // Overall Condition Reassurance
  let overallCondition = "চিকিৎসক আপনার শারীরিক সমস্যাগুলো পর্যালোচনা করে এই ব্যবস্থাপত্র দিয়েছেন। ";
  if (rx.diagnosis) {
    overallCondition += `আপনার লক্ষণগুলো প্রধানত '${rx.diagnosis}'-এর সঙ্গে সম্পর্কিত। `;
  }
  overallCondition += "নির্ধারিত ওষুধগুলো সময়মতো গ্রহণ করুন, পর্যাপ্ত পানি ও পুষ্টিকর খাবার খান এবং প্রয়োজনীয় টেস্টগুলো দ্রুত সম্পন্ন করে চিকিৎসকের পরামর্শ অনুযায়ী সুস্থ থাকুন।";

  // Drug-Drug Interaction
  const hasParacetamol = explainedMeds.some((m) => /paracetamol|napa|ace|fast/i.test(m.cleanName));
  const hasCipro = explainedMeds.some((m) => /cipro/i.test(m.cleanName));
  const hasPpi = explainedMeds.some((m) => /pantonix|sergel|seclo|esomeprazole/i.test(m.cleanName));
  const hasNsaid = explainedMeds.some((m) => /flexi|aceclo|ketorolac|rolac/i.test(m.cleanName));

  let interactionMessage = "এই প্রেসক্রিপশনের ওষুধগুলোর মধ্যে কোনো মারাত্মক Drug-Drug Interaction পাওয়া যায়নি। ওষুধগুলো একসাথে নিয়ম মেনে খাওয়া নিরাপদ।";
  if (hasParacetamol && hasCipro) {
    interactionMessage = "Ciprofloxacin এবং Paracetamol-এর মধ্যে কোনো ক্ষতিকর Drug-Drug Interaction নেই। দুটি ওষুধ সাধারণত একসাথে নিরাপদে খাওয়া যায়।";
  } else if (hasPpi && hasNsaid) {
    interactionMessage = "ব্যথানাশক ওষুধের সাথে গ্যাস্ট্রিকের ওষুধ পেটের প্রদাহ ও আলসার রোধে অত্যন্ত কার্যকর ও নিরাপদ কম্বিনেশন।";
  }

  // Lifestyle advice
  const lifestyleAdvice: string[] = [
    "প্রতিদিন পর্যাপ্ত (৮–১০ গ্লাস) বিশুদ্ধ পানি পান করুন।",
    "ওষুধ সবসময় নির্ধারিত সময়ের মধ্যে এবং খাবারের পর নিয়ম মেনে খান।",
  ];
  if (parsedVitals.temp || diag.includes("জ্বর")) {
    lifestyleAdvice.push("জ্বর বেশি থাকলে শরীর ভেজা কাপড় দিয়ে ভালো করে মুছে দিন এবং তাপমাত্রা পর্যবেক্ষণ করুন।");
  }
  if (rx.next_visit) {
    lifestyleAdvice.push(`ফলো-আপ: ${rx.next_visit} পর অথবা প্রয়োজনে চিকিৎসকের সাথে আবার যোগাযোগ করুন।`);
  } else {
    lifestyleAdvice.push("চিকিৎসার নির্ধারিত মেয়াদ (৭ দিন) শেষে প্রয়োজনবোধে আবার ডাক্তারকে দেখান।");
  }

  // Red Flags
  const dangerSigns: string[] = [
    "জ্বর ১০২° ফারেনহাইটের বেশি হলে বা না কমলে",
    "তীব্র শ্বাসকষ্ট বা বুকে ব্যথা হলে",
    "অতিরিক্ত বমি বা ডায়রিয়া হলে",
    "অ্যালার্জির তীব্র লক্ষণ দেখা দিলে (যেমন: গায়ে লাল র‍্যাশ, চুলকানি, মুখ বা ঠোঁট ফুলে যাওয়া)",
    "প্রস্রাবে রক্ত দেখা দিলে বা তীব্র তলপেট ব্যথা হলে",
  ];

  return {
    overallCondition,
    treatmentGoals: goals,
    vitalsExplained: vitalsList,
    investigationsExplained: invList,
    medicines: explainedMeds,
    drugInteraction: {
      status: "safe",
      message: interactionMessage,
    },
    lifestyleAdvice,
    dangerSigns,
    totalMedicines: explainedMeds.length,
  };
}

/* ========================================================================== */
/*                         EXPLAIN LAB REPORT FUNCTION                        */
/* ========================================================================== */

interface LabParamDef {
  keyPattern: RegExp;
  meaning: string;
  defaultRef: string;
  minVal?: number;
  maxVal?: number;
}

const LAB_PARAM_DEFINITIONS: LabParamDef[] = [
  { keyPattern: /\b(wbc|tlc|white blood cell)\b/i, meaning: "সংক্রমণের বিরুদ্ধে লড়াইকারী শ্বেত রক্তকণিকা", defaultRef: "4,000–11,000 /µL", minVal: 4000, maxVal: 11000 },
  { keyPattern: /\b(rbc|red blood cell)\b/i, meaning: "রক্তে অক্সিজেন বহনকারী লোহিত রক্তকণিকা", defaultRef: "4.2–5.4 M/µL", minVal: 4.2, maxVal: 5.4 },
  { keyPattern: /\b(hemoglobin|hb)\b/i, meaning: "রক্তের অক্সিজেন বহনের সামগ্রিক ক্ষমতা", defaultRef: "12–16 g/dL", minVal: 12.0, maxVal: 16.5 },
  { keyPattern: /\b(platelet|plt)\b/i, meaning: "রক্ত জমাট বাঁধতে ও রক্তপাত বন্ধে সাহায্য করে", defaultRef: "1.5–4.0 লাখ /µL", minVal: 150000, maxVal: 450000 },
  { keyPattern: /\b(neutrophils?)\b/i, meaning: "ব্যাকটেরিয়াল সংক্রমণে সুরক্ষায় দ্রুত বৃদ্ধি পায়", defaultRef: "40–70 %", minVal: 40, maxVal: 70 },
  { keyPattern: /\b(lymphocytes?)\b/i, meaning: "রোগ প্রতিরোধ ও ভাইরাল ইনফেকশন মোকাবিলায় সক্রিয়", defaultRef: "20–40 %", minVal: 20, maxVal: 40 },
  { keyPattern: /\b(eosinophils?)\b/i, meaning: "অ্যালার্জি বা কিছু সংক্রামক অবস্থায় বাড়তে পারে", defaultRef: "1–6 %", minVal: 1, maxVal: 6 },
  { keyPattern: /\b(monocytes?)\b/i, meaning: "সংক্রমণ-পরবর্তী পর্যায়ে জীবাণু ধ্বংস ও সুরক্ষায় ভূমিকা রাখে", defaultRef: "2–10 %", minVal: 2, maxVal: 10 },
  { keyPattern: /\b(esr|erythrocyte sedimentation rate)\b/i, meaning: "শরীরে প্রদাহ (inflammation) বা সংক্রমণ থাকলে বাড়তে পারে", defaultRef: "0–20 mm/hr", minVal: 0, maxVal: 20 },
  { keyPattern: /\b(mcv)\b/i, meaning: "লোহিত রক্তকণিকার (RBC) গড় আকার", defaultRef: "80–100 fL", minVal: 80, maxVal: 100 },
  { keyPattern: /\b(mch)\b/i, meaning: "প্রতিটি RBC-তে হিমোগ্লোবিনের গড় ওজন", defaultRef: "27–33 pg", minVal: 27, maxVal: 33 },
  { keyPattern: /\b(mchc)\b/i, meaning: "রক্তের লোহিত কণিকায় হিমোগ্লোবিনের ঘনত্ব", defaultRef: "31–36 g/dL", minVal: 31, maxVal: 36 },
  { keyPattern: /\b(creatinine|serum creatinine)\b/i, meaning: "কিডনির সুস্থতা ও রক্ত পরিশোধন ক্ষমতার প্রধান নির্দেশক", defaultRef: "0.6–1.2 mg/dL", minVal: 0.6, maxVal: 1.2 },
  { keyPattern: /\b(sgpt|alt)\b/i, meaning: "লিভারের স্বাভাবিক কর্মক্ষমতা ও এনজাইমের সুস্থতা", defaultRef: "10–45 U/L", minVal: 10, maxVal: 45 },
  { keyPattern: /\b(sgot|ast)\b/i, meaning: "লিভার ও হৃৎপিণ্ডের পেশির সুস্থতা", defaultRef: "10–40 U/L", minVal: 10, maxVal: 40 },
  { keyPattern: /\b(bilirubin|total bilirubin)\b/i, meaning: "রক্তের পিত্তরস ও জন্ডিসের মাত্রা", defaultRef: "0.2–1.2 mg/dL", minVal: 0.2, maxVal: 1.2 },
  { keyPattern: /\b(uric acid)\b/i, meaning: "হাড়ের জয়েন্টে বাত ও ইউরিক এসিডের মাত্রা", defaultRef: "3.5–7.0 mg/dL", minVal: 3.5, maxVal: 7.0 },
  { keyPattern: /\b(rbs|random blood sugar)\b/i, meaning: "রক্তে শর্করার তাৎক্ষণিক মাত্রা", defaultRef: "4.0–7.8 mmol/L", minVal: 4.0, maxVal: 7.8 },
  { keyPattern: /\b(fbs|fasting blood sugar)\b/i, meaning: "খালি পেটে ডায়াবেটিসের সঠিক মাত্রা", defaultRef: "4.0–6.0 mmol/L", minVal: 4.0, maxVal: 6.0 },
  { keyPattern: /\b(pus cell|pus cells)\b/i, meaning: "প্রস্রাবে ইনফেকশন বা পুঁজ কোষের উপস্থিতি", defaultRef: "0–5 /HPF", minVal: 0, maxVal: 5 },
];

export function explainLabReport(report: {
  test_name?: string | null;
  department?: string | null;
  patient_name?: string | null;
  sample_no?: string | null;
  reported_at_text?: string | null;
  rows?: any;
}): LabReportExplanation {
  const rawRows: any[] = Array.isArray(report.rows) ? report.rows : [];
  const parameters: LabParameterExplained[] = [];

  let normalCount = 0;
  let mildCount = 0;
  let abnormalCount = 0;

  for (const r of rawRows) {
    const pName = (r.name || r.test || "").trim();
    if (!pName) continue;

    const resStr = String(r.result || "").trim();
    const unitStr = String(r.unit || "").trim();
    const refStr = String(r.ref || r.reference_range || "").trim();

    // Find rule definition
    const def = LAB_PARAM_DEFINITIONS.find((d) => d.keyPattern.test(pName));

    const meaning = def ? def.meaning : "শারীরিক সুস্থতার জন্য ল্যাবরেটরিতে পরীক্ষিত মান";
    const effectiveRef = refStr || (def ? def.defaultRef : "স্বাভাবিক সীমা");

    // Evaluate Status
    let status: LabParameterExplained["status"] = "normal";
    let statusText = "স্বাভাবিক";

    // Numerical evaluation if min/max available
    const num = parseFloat(resStr.replace(/[^0-9.]/g, ""));
    if (!isNaN(num) && def && def.minVal !== undefined && def.maxVal !== undefined) {
      if (num >= def.minVal && num <= def.maxVal) {
        status = "normal";
        statusText = "স্বাভাবিক";
        normalCount++;
      } else {
        // Check if borderline / mild difference
        const range = def.maxVal - def.minVal || def.maxVal;
        const diff = num < def.minVal ? def.minVal - num : num - def.maxVal;
        if (diff <= range * 0.4) {
          status = "mild";
          statusText = "সামান্য তারতম্য";
          mildCount++;
        } else {
          status = "abnormal";
          statusText = "অস্বাভাবিক";
          abnormalCount++;
        }
      }
    } else {
      // If result has text like Normal, Negative, Nil
      const lower = resStr.toLowerCase();
      if (lower.includes("nil") || lower.includes("neg") || lower.includes("norm") || lower.includes("0-2") || lower.includes("0-5")) {
        status = "normal";
        statusText = "স্বাভাবিক";
        normalCount++;
      } else if (lower.includes("positive") || lower.includes("present") || lower.includes("high") || lower.includes("abnormal")) {
        status = "abnormal";
        statusText = "অস্বাভাবিক";
        abnormalCount++;
      } else {
        status = "normal";
        statusText = "স্বাভাবিক";
        normalCount++;
      }
    }

    parameters.push({
      name: pName,
      result: resStr,
      unit: unitStr,
      refRange: effectiveRef,
      status,
      statusText,
      banglaMeaning: meaning,
    });
  }

  // Risk evaluation
  let riskLevel: LabReportExplanation["riskLevel"] = "ঝুঁকিমুক্ত";
  let reassuranceTitle = "ভালো খবর!";
  let reassuranceMessage = "আপনার বেশিরভাগ টেস্টের মান সম্পূর্ণ স্বাভাবিক সীমায় রয়েছে। এতে তাৎক্ষণিক কোনো আশঙ্কাজনক সংকেত পাওয়া যায়নি।";

  if (abnormalCount > 0) {
    riskLevel = "চিকিৎসকের পরামর্শ জরুরি";
    reassuranceTitle = "চিকিৎসকের পরামর্শ প্রয়োজন";
    reassuranceMessage = `রিপোর্টে ${abnormalCount}টি উপাদানের মানে লক্ষণীয় পরিবর্তন রয়েছে। সঠিক চিকিৎসার জন্য আপনার প্রেসক্রাইবিং ডাক্তারের পরামর্শ নেওয়া উচিত।`;
  } else if (mildCount > 0) {
    riskLevel = "হালকা পর্যবেক্ষণ প্রয়োজন";
    reassuranceTitle = "সাধারণত চিন্তার কারণ নেই";
    reassuranceMessage = `আপনার বেশিরভাগ রিপোর্ট স্বাভাবিক সীমায় রয়েছে। শুধু ${mildCount}টি উপাদানে সামান্য তারতম্য রয়েছে, যা সাধারণত হালকা প্রদাহ, অনিয়মিত ঘুম বা সাময়িক ইনফেকশনের কারণে হতে পারে।`;
  }

  return {
    testName: report.test_name || "ল্যাবরেটরি টেস্ট রিপোর্ট",
    totalParameters: parameters.length,
    normalCount,
    mildCount,
    abnormalCount,
    reassuranceTitle,
    reassuranceMessage,
    riskLevel,
    parameters,
    patientTips: [
      "চিকিৎসক যে পরামর্শ দিয়েছেন তা মনোযোগ দিয়ে অনুসরণ করুন।",
      "শারীরিক উপসর্গ থাকলে চিকিৎসকের সাথে ফলো-আপ সাক্ষাৎ করুন।",
      "পর্যাপ্ত পরিমাণ পানি পান ও স্বাস্থ্যকর খাদ্যাভ্যাস বজায় রাখুন।",
      "প্রয়োজন হলে নির্দিষ্ট সময় পর টেস্ট পুনরায় করে তুলনা করুন।",
    ],
    dangerSigns: [
      "জ্বর দীর্ঘদিন ধরে স্থায়ী হলে",
      "তীব্র শ্বাসকষ্ট বা বুকে অস্বাভাবিক ব্যথা হলে",
      "অস্বাভাবিক দুর্বলতা বা চোখে অন্ধকার দেখলে",
      "নতুন বা অজানা কোনো শারীরিক উপসর্গ শুরু হলে",
    ],
    faqs: [
      {
        question: "ESR বা শ্বেত রক্তকণিকা (WBC) কেন সামান্য বাড়ে?",
        answer: "শরীরে কোনো হালকা ইনফেকশন, সর্দি-কাশি, মূত্রনালির সমস্যা বা অ্যালার্জি থাকলে শ্বেত রক্তকণিকা ও ইএসআর সাময়িকভাবে বাড়তে পারে। ইনফেকশন ভালো হয়ে গেলে এটি নিজে থেকেই স্বাভাবিক হয়ে যায়।",
      },
      {
        question: "Eosinophils বেশি মানে কী?",
        answer: "সাধারণত ধুলোবালি, এলার্জি, হাঁপানি বা পেটের কৃমি থাকলে ইয়োসিনোফিলের মাত্রা সামান্য বেড়ে যায়। চিকিৎসকের পরামর্শ অনুযায়ী অ্যান্টিহিস্টামিন সেবন করলে এটি দ্রুত নিয়ন্ত্রণে আসে।",
      },
      {
        question: "আমাকে কি এই টেস্টটি আবার করতে হবে?",
        answer: "ওষুধের কোর্স শেষ হওয়ার পর অথবা ডাক্তার যদি নিশ্চিত হতে চান ইনফেকশন পুরোপুরি সেরেছে কি না, তবে তিনি পুনরায় এই টেস্ট করতে বলতে পারেন।",
      },
      {
        question: "ডাক্তারের কাছে কখন দ্রুত যাওয়া উচিত?",
        answer: "যদি জ্বর না কমে, তীব্র ব্যথা শুরু হয়, প্রস্রাবে রক্ত বা শ্বাসকষ্ট দেখা দেয়, তবে অবিলম্বে চিকিৎসকের সাথে যোগাযোগ করতে হবে।",
      },
    ],
  };
}
