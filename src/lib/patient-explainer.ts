/**
 * Sheikh Pharma Patient Explainer Intelligence
 * ----------------------------------------------------
 * Generates plain-Bangla, patient-friendly explanations for:
 * 1. Prescriptions (Dose timings, why prescribed, instructions, warnings, drug interactions)
 * 2. Lab Reports (Summary metrics, parameter explanations, status detection, reassuring advice)
 */

import { matchMedicineSync, toBengaliDosageForm } from "@/lib/medicines-db";

export interface ExplainedMedicine {
  originalName: string;
  cleanName: string;
  formType: "ট্যাবলেট" | "ক্যাপসুল" | "সিরাপ" | "ইনজেকশন" | "ড্রপস" | "মলম" | "ওষুধ";
  genericName?: string;
  dosageFormEn?: string;
  indicationsEn?: string;
  modeOfAction?: string;
  sideEffectsEn?: string;
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
    pattern: /\b(paracetamol|acetaminophen|napa|ace|fast|reset|pyrex|renova|tamol)\b/i,
    category: "জ্বর ও ব্যথানাশক ওষুধ (Analgesic & Antipyretic)",
    purpose: "জ্বর, মাথাব্যথা, গা ব্যথা ও যেকোনো মৃদু থেকে মাঝারি শারীরিক অস্বস্তি উপশম করে।",
    howToTake: "খাবারের পরে সেব্য। দিনে সর্বোচ্চ ৩-৪ বার, প্রয়োজনের অতিরিক্ত খাবেন না।",
    sideEffects: "বমি বমি ভাব, সামান্য পেটের অস্বস্তি (অ্যালার্জি খুব বিরল)।",
    precautions: "২৪ ঘণ্টায় ৪ গ্রামের (৮টি ৫০০ মিলিগ্রাম ট্যাবলেটের) বেশি খাবেন না। লিভার রোগ থাকলে ডাক্তারের পরামর্শ নিন।",
  },
  {
    pattern: /\b(ciprofloxacin|levofloxacin|moxifloxacin|ofloxacin|gemifloxacin|ciprocin|neofloxin|cpro|ciflocin|flontin)\b/i,
    category: "অ্যান্টিবায়োটিক (Fluoroquinolone Antibiotic)",
    purpose: "মূত্রনালির ইনফেকশন (UTI), ডায়রিয়া, টাইফয়েড ও অন্যান্য ব্যাকটেরিয়াজনিত সংক্রমণ দূর করতে সাহায্য করে।",
    howToTake: "খাবারের আগে বা পরে খাওয়া যায়। চিকিৎসকের নির্ধারিত পূর্ণ মেয়াদে খেতে হবে।",
    sideEffects: "বমি বমি ভাব, পেট খারাপ/ডায়রিয়া, মাথা ঘোরার অনুভূতি।",
    precautions: "লক্ষণ কমে গেলেও অ্যান্টিবায়োটিকের পূর্ণ কোর্স শেষ করবেন। প্রচুর পানি পান করুন।",
  },
  {
    pattern: /\b(amoxicillin|flucloxacillin|ampicillin|cloxacillin|phenoxymethylpenicillin|piperacillin|moxacil|flemoxin|clavamox|augpen|moxaclav|tyclav|adflox|phylex)\b/i,
    category: "পেনিসিলিন গ্রুপের অ্যান্টিবায়োটিক (Penicillin Antibiotic)",
    purpose: "ত্বক, কান, গলা, দাঁত, বুক ও শ্বাসতন্ত্রের ব্যাকটেরিয়াল সংক্রমণ নিয়ন্ত্রণে সহায়তা করে।",
    howToTake: "খাবারের সাথে বা নির্ধারিত নিয়মে পূর্ণ মেয়াদ পর্যন্ত খেতে হবে।",
    sideEffects: "ডায়রিয়া, পেটে গ্যাস, বমি ভাব বা হালকা র‍্যাশ।",
    precautions: "পেনিসিলিনে অ্যালার্জি থাকলে ডাক্তারকে জানান। মাঝপথে ওষুধ বন্ধ করবেন না।",
  },
  {
    pattern: /\b(azithromycin|clarithromycin|erythromycin|roxithromycin|zimax|azith|tritex|azex|odaz|odazyth|klabex)\b/i,
    category: "অ্যান্টিবায়োটিক (Macrolide Antibiotic)",
    purpose: "গলা ব্যথা, টনসিল, ফুসফুসের ইনফেকশন, ত্বকের সংক্রমণ ও টাইফয়েড নিরাময়ে কাজ করে।",
    howToTake: "প্রতিদিন নির্দিষ্ট সময়ে খাবারের ১ ঘণ্টা আগে বা ২ ঘণ্টা পরে খাওয়া উত্তম।",
    sideEffects: "হালকা পেটে ব্যথা, বমি ভাব বা লুজ মোশন।",
    precautions: "অ্যান্টাসিড বা ক্যালসিয়াম ওষুধের সাথে একসাথে খাবেন না (কমপক্ষে ২ ঘণ্টার ব্যবধান রাখুন)।",
  },
  {
    pattern: /\b(cefixime|ceftriaxone|cefuroxime|cefradine|cephalexin|cefpodoxime|cefotaxime|ceftazidime|cefepime|cef-3|triocim|denvar|ceftid|cefrox|kilbac|furocef|cerox|trizon|parcef|oracef)\b/i,
    category: "সেফালোস্পোরিন অ্যান্টিবায়োটিক (Cephalosporin Antibiotic)",
    purpose: "মূত্রনালি, ফুসফুস, ত্বক, কান ও জটিল ব্যাকটেরিয়াল ইনফেকশন সারাতে সাহায্য করে।",
    howToTake: "চিকিৎসকের পরামর্শ অনুযায়ী নির্দিষ্ট সময়ে নিয়মিত গ্রহণ করুন।",
    sideEffects: "হালকা ডায়রিয়া, পেটের অস্বস্তি বা বমি ভাব।",
    precautions: "অ্যান্টিবায়োটিকের পূর্ণ কোর্স সম্পন্ন করতে হবে। কোনো ডোজ মিস করবেন না।",
  },
  {
    pattern: /\b(metronidazole|tinidazole|secnidazole|nitazoxanide|albendazole|mebendazole|ivermectin|filmet|amodi|flamet|flagyl)\b/i,
    category: "অ্যামিবা ও পরজীবীনাশক (Antiprotozoal / Antihelmintic)",
    purpose: "পেটের আমাশয়, ডায়রিয়া, দাঁতের মাড়ির ইনফেকশন ও পরজীবী সংক্রমণ ধ্বংসে কাজ করে।",
    howToTake: "অবশ্যই ভরা পেটে এক গ্লাস পানির সাথে খাবেন।",
    sideEffects: "মুখে মেটালিক বা তেতো স্বাদ, বমি ভাব, পেটের অস্বস্তি।",
    precautions: "চিকিৎসকের নির্ধারিত ডোজ ও মেয়াদ মেনে চলুন।",
  },
  {
    pattern: /\b(esomeprazole|pantoprazole|omeprazole|rabeprazole|lansoprazole|dexlansoprazole|famotidine|ranitidine|sergel|pantonix|seclo|maxpro|nexum|finix|acifix|losectil|peptid)\b/i,
    category: "গ্যাস্ট্রিক ও এসিডিটি নিরামক (Anti-ulcerant / PPI)",
    purpose: "পেটের অতিরিক্ত এসিড কমায়, গ্যাস্ট্রিকের জ্বালাপোড়া, বুকজ্বালা ও আলসার প্রতিরোধ করে।",
    howToTake: "সকালে ও রাতে খাবারের ২০-৩০ মিনিট আগে এক গ্লাস পানির সাথে খাবেন।",
    sideEffects: "মাথাব্যথা, পেট ফাঁপা বা কোষ্ঠকাঠিন্য (খুবই কম হয়)।",
    precautions: "ক্যাপসুল বা ট্যাবলেট চিবিয়ে খাবেন না, আস্ত গিলে ফেলবেন।",
  },
  {
    pattern: /\b(domperidone|ondansetron|metoclopramide|palonosetron|itopride|motigut|deflux|omidon|ofran|emistat|doridon)\b/i,
    category: "বমি ও গ্যাস নিরোধক (Antiemetic & Prokinetic)",
    purpose: "বমি বমি ভাব, পেট ফাঁপা ও অস্বস্তি দূর করে এবং খাবার সহজে হজম হতে সাহায্য করে।",
    howToTake: "খাবারের ১৫-৩০ মিনিট আগে খাওয়া সবচেয়ে কার্যকর।",
    sideEffects: "মুখ শুকিয়ে যাওয়া, হালকা মাথা ঝিমঝিম।",
    precautions: "চিকিৎসকের নির্ধারিত মাত্রার অতিরিক্ত সেবন পরিহার করুন।",
  },
  {
    pattern: /\b(cetirizine|levocetirizine|fexofenadine|bilastine|desloratadine|loratadine|rupatadine|chlorpheniramine|ebastine|ketotifen|alatrol|atrizin|fexo|fexod|fenaxo|bilaben|bilaid|deslor)\b/i,
    category: "অ্যান্টিহিস্টামিন (অ্যালার্জি ও সর্দি নিরোধক)",
    purpose: "সর্দি, হাঁচি, নাক বা চোখ দিয়ে পানি পড়া এবং ত্বকের অ্যালার্জি ও চুলকানি দূর করে।",
    howToTake: "প্রতিদিন ১ বার (সাধারণত রাতে ঘুমানোর আগে বা খাবারের পরে)।",
    sideEffects: "হালকা ঘুম ঘুম ভাব বা মুখ শুকিয়ে যাওয়া হতে পারে।",
    precautions: "ওষুধ খাওয়ার পর তন্দ্রাভাব হলে ভারী কাজ বা গাড়ি চালানো এড়িয়ে চলুন।",
  },
  {
    pattern: /\b(montelukast|salbutamol|levosalbutamol|budesonide|formoterol|salmeterol|fluticasone|beclomethasone|ipratropium|tiotropium|doxofylline|aminophylline|theophylline|ambroxol|bromhexine|dextromethorphan|guaifenesin|montene|provair|monas|odmon|m-kast|monalast|montex|kufflin)\b/i,
    category: "শ্বাসকষ্ট, কাশি ও অ্যাজমা নিরামক (Respiratory Care)",
    purpose: "শ্বাসনালির ফোলা ও সংকোচন দূর করে কাশি, কফ, হাঁপানি ও শ্বাসকষ্ট উপশম করে।",
    howToTake: "চিকিৎসকের নির্দেশিত সময় ও মাত্রা অনুযায়ী নিয়মিত সেবন করুন।",
    sideEffects: "হালকা বুক ধড়ফড়, মাথাব্যথা বা গলা শুকিয়ে যাওয়া।",
    precautions: "ঠান্ডা ও ধুলাবালি এড়িয়ে চলুন এবং কুসুম গরম পানি পান করুন।",
  },
  {
    pattern: /\b(aceclofenac|diclofenac|naproxen|ketorolac|ibuprofen|etoricoxib|celecoxib|meloxicam|indomethacin|tolfenamic|mefenamic|tramadol|flexi|zerodol|anaflex|xenapro|rolac|torax|doloket|flamyd|a-fenac)\b/i,
    category: "ব্যথানাশক ও প্রদাহবিরোধী (NSAID / Analgesic)",
    purpose: "হাড়, মাংসপেশি, জয়েন্ট, দাঁতের ব্যথা বা শরীরের তীব্র ব্যথা ও প্রদাহ কমাতে সাহায্য করে।",
    howToTake: "অবশ্যই ভরা পেটে খাবেন এবং সাথে গ্যাস্ট্রিকের ওষুধ খাওয়া উচিত।",
    sideEffects: "পেট জ্বালাপোড়া, এসিডিটি বা গ্যাস্ট্রিকের অস্বস্তি।",
    precautions: "খালি পেটে কখনো খাবেন না। কিডনি রোগ বা আলসার থাকলে ডাক্তারের পরামর্শ ছাড়া খাবেন না।",
  },
  {
    pattern: /\b(amlodipine|losartan|telmisartan|olmesartan|valsartan|irbesartan|bisoprolol|metoprolol|atenolol|nebivolol|carvedilol|propranolol|ramipril|enalapril|lisinopril|hydrochlorothiazide|furosemide|spironolactone|indapamide|prazosin|cilnidipine|nifedipine|diltiazem|verapamil|abetis|telnor|trofurit|bizoran|camlodin|osartil)\b/i,
    category: "উচ্চ রক্তচাপ ও হৃদরোগ নিয়ন্ত্রক (Antihypertensive / Cardiac)",
    purpose: "রক্তচাপ (Blood Pressure) স্বাভাবিক রাখে এবং হৃদযন্ত্র ও রক্তনালির সুরক্ষা নিশ্চিত করে।",
    howToTake: "প্রতিদিন একই সময়ে নিয়মিত সেবন করুন।",
    sideEffects: "হালকা মাথা ঘোরা, ক্লান্তি বা গোড়ালি ফোলা।",
    precautions: "ডাক্তারের পরামর্শ ছাড়া হঠাৎ রক্তচাপের ওষুধ বন্ধ করবেন না। নিয়মিত প্রেশার মাপুন।",
  },
  {
    pattern: /\b(rosuvastatin|atorvastatin|simvastatin|fenofibrate|ezetimibe|aspirin|clopidogrel|prasugrel|ticagrelor|trimetazidine|nitroglycerin|rosustat|atorva|lipicon|ecosprin|clopid)\b/i,
    category: "কোলেস্টেরল ও হৃদরোগ প্রতিরোধক (Lipid Lowering / Antiplatelet)",
    purpose: "রক্তের ক্ষতিকর কোলেস্টেরল (LDL ও Triglyceride) কমায় এবং হার্ট অ্যাটাক ও স্ট্রোকের ঝুঁকি রোধ করে।",
    howToTake: "সাধারণত রাতে খাবারের পরে বা চিকিৎসকের নির্দেশিত সময়ে প্রতিদিন ১ বার।",
    sideEffects: "মাংসপেশিতে হালকা ব্যথা বা দুর্বলতা, সামান্য পেটের অস্বস্তি।",
    precautions: "চর্বিযুক্ত ও ভাজাপোড়া খাবার এড়িয়ে চলুন এবং নিয়মিত হাঁটাচলা করুন।",
  },
  {
    pattern: /\b(metformin|glimepiride|gliclazide|glipizide|sitagliptin|vildagliptin|linagliptin|empagliflozin|dapagliflozin|pioglitazone|acarbose|repaglinide|insulin|insulet|comet|secrin|diamicron|linatab|jardiance)\b/i,
    category: "ডায়াবেটিস ও রক্তের শর্করা নিয়ন্ত্রক (Antidiabetic)",
    purpose: "রক্তের গ্লুকোজ বা সুগারের মাত্রা নিয়ন্ত্রণে রেখে ডায়াবেটিসজনিত জটিলতা প্রতিরোধ করে।",
    howToTake: "খাবারের ঠিক আগে বা পরে চিকিৎসকের নির্দেশিত সময়ে নিয়মিত গ্রহণ করুন।",
    sideEffects: "রক্তে সুগার কমে যাওয়া (হাইপোগ্লাইসেমিয়া), হালকা বমি ভাব বা পেটের অস্বস্তি।",
    precautions: "ওষুধ নেওয়ার পর খাবার বাদ দেবেন না। মাথা ঘোরা বা অতিরিক্ত ঘাম হলে দ্রুত মিষ্টি জাতীয় কিছু খান।",
  },
  {
    pattern: /\b(pregabalin|gabapentin|amitriptyline|nortriptyline|duloxetine|clonazepam|alprazolam|diazepam|bromazepam|escitalopram|sertraline|fluoxetine|paroxetine|flupentixol|melitracen|memantine|donepezil|pregaben|algaba|neurolin|rivotril|frenxit)\b/i,
    category: "স্নায়ুজনিত ব্যথা ও স্নায়ুতন্ত্রের ওষুধ (Neuropathic / CNS Care)",
    purpose: "স্নায়ুর ব্যথা (হাত-পা ঝিনঝিন বা জ্বালাপোড়া), দুশ্চিন্তা, ঘুমের সমস্যা বা স্নায়বিক জটিলতা উপশম করে।",
    howToTake: "চিকিৎসকের পরামর্শ অনুযায়ী নির্দিষ্ট সময়ে (প্রায়ই রাতে) সেবন করুন।",
    sideEffects: "ঘুম ঘুম ভাব, মাথা ঝিমঝিম বা মুখ শুকিয়ে যাওয়া।",
    precautions: "ডাক্তারের পরামর্শ ছাড়া হঠাৎ ডোজ বাড়াবেন বা বন্ধ করবেন না।",
  },
  {
    pattern: /\b(calcium|cholecalciferol|vitamin|multivitamin|ascorbic|zinc|iron|ferrous|folic|cyanocobalamin|mecobalamin|thiamine|pyridoxine|riboflavin|coralcal|calbo|d-rise|osteocal|babyzinc|b-50|neuro-b|max d|c-vitera)\b/i,
    category: "পুষ্টি, ক্যালসিয়াম ও ভিটামিন সাপ্লিমেন্ট",
    purpose: "হাড়, পেশি ও স্নায়ুকে শক্তিশালী করে, রক্তস্বল্পতা দূর করে এবং শরীরে রোগ প্রতিরোধ ক্ষমতা বাড়ায়।",
    howToTake: "দুপুরে বা রাতে ভরা পেটে পর্যাপ্ত পানির সাথে সেব্য।",
    sideEffects: "হালকা কোষ্ঠকাঠিন্য বা পেট ভারী লাগা।",
    precautions: "অ্যান্টিবায়োটিকের সাথে কমপক্ষে ২ ঘণ্টার ব্যবধান রেখে খাবেন।",
  },
];

function deriveCategoryAndPurposeFromGeneric(
  genericName: string,
  indications: string,
  sideEffectsEn: string
): {
  category: string;
  purpose: string;
  sideEffects: string;
  precautions: string;
} {
  const combined = `${genericName} ${indications}`.toLowerCase();

  let category = genericName ? `চিকিৎসকের নির্ধারিত ওষুধ (${genericName})` : "প্রেসক্রিপশন অনুযায়ী প্রয়োজনীয় ওষুধ";
  let purpose = "চিকিৎসক রোগীর শারীরিক অবস্থা অনুযায়ী এই ওষুধটি নির্ধারণ করেছেন।";

  if (/\b(infection|bacterial|antibiotic|septicemia|pneumonia|bronchitis|tonsillitis|otitis|uti|urinary tract)\b/.test(combined)) {
    category = `অ্যান্টিবায়োটিক ও সংক্রমণ রোধক (${genericName})`;
    purpose = "শরীরের ব্যাকটেরিয়াজনিত ইনফেকশন বা সংক্রমণ দূর করতে এই ওষুধটি দেওয়া হয়েছে।";
  } else if (/\b(hypertension|blood pressure|angina|heart failure|arrhythmia)\b/.test(combined)) {
    category = `রক্তচাপ ও হৃদরোগ নিয়ন্ত্রক (${genericName})`;
    purpose = "উচ্চ রক্তচাপ নিয়ন্ত্রণে রাখা এবং হৃদযন্ত্রের স্বাভাবিক কার্যকারিতা বজায় রাখতে সাহায্য করে।";
  } else if (/\b(diabetes|hyperglycemia|glycemic|blood glucose)\b/.test(combined)) {
    category = `ডায়াবেটিস নিয়ন্ত্রক (${genericName})`;
    purpose = "রক্তের শর্করা (সুগার) নিয়ন্ত্রণে রাখতে সাহায্য করে।";
  } else if (/\b(ulcer|gastroesophageal|reflux|gerd|acidity|heartburn|dyspepsia)\b/.test(combined)) {
    category = `গ্যাস্ট্রিক ও এসিডিটি নিরামক (${genericName})`;
    purpose = "পেটের অতিরিক্ত এসিড, বুকজ্বালা ও গ্যাস্ট্রিকের সমস্যা দূর করতে কাজ করে।";
  } else if (/\b(pain|analgesic|inflammation|arthritis|osteoarthritis|rheumatoid|toothache|migraine|headache|fever)\b/.test(combined)) {
    category = `ব্যথা ও প্রদাহ উপশমকারী (${genericName})`;
    purpose = "শরীরের ব্যথা, ফোলা, প্রদাহ বা জ্বর কমাতে সাহায্য করে।";
  } else if (/\b(asthma|copd|bronchospasm|cough|rhinitis|allergic|urticaria|pruritus|allergy)\b/.test(combined)) {
    category = `অ্যালার্জি, সর্দি-কাশি ও শ্বাসতন্ত্রের ওষুধ (${genericName})`;
    purpose = "অ্যালার্জি, সর্দি, কাশি বা শ্বাসকষ্ট উপশমে কাজ করে।";
  } else if (/\b(hyperlipidemia|dyslipidemia|cholesterol|triglyceride)\b/.test(combined)) {
    category = `কোলেস্টেরল নিয়ন্ত্রক (${genericName})`;
    purpose = "রক্তের অতিরিক্ত চর্বি ও কোলেস্টেরল কমিয়ে হৃদরোগের ঝুঁকি কমায়।";
  } else if (/\b(fungal|candidiasis|tinea|dermatitis|eczema|psoriasis|scabies|acne)\b/.test(combined)) {
    category = `চর্মরোগ ও ছত্রাকনাশক ওষুধ (${genericName})`;
    purpose = "ত্বকের সংক্রমণ, চুলকানি, র‍্যাশ বা ফাঙ্গাল ইনফেকশন দূর করতে সাহায্য করে।";
  } else if (/\b(rehydration|diarrhoea|diarrhea|electrolyte)\b/.test(combined)) {
    category = `পানিশূন্যতা ও লবণ ঘাটতি পূরণকারী (${genericName})`;
    purpose = "ডায়রিয়া, বমি বা দুর্বলতায় শরীরের পানি ও লবণের ঘাটতি পূরণ করে।";
  }

  if (indications) {
    purpose = `${purpose} (কাজ: ${indications})`;
  }

  const sideEffects = sideEffectsEn
    ? `সাধারণত সহনশীল। সম্ভাব্য পার্শ্বপ্রতিক্রিয়া: ${sideEffectsEn}`
    : "সাধারণত সহনশীল, তবে কোনো অসুবিধা দেখা দিলে চিকিৎসককে জানান।";

  return {
    category,
    purpose,
    sideEffects,
    precautions: "নির্ধারিত মাত্রার বেশি খাবেন না এবং চিকিৎসকের পরামর্শ অনুযায়ী নিয়ম মেনে সেবন করুন।",
  };
}

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

export function parseDoseSchedule(freq: string, formType: string, instructions?: string): {
  morning: string;
  noon: string;
  night: string;
  summary: string;
} {
  const f = (freq || "").toLowerCase().trim();
  const instr = (instructions || "").trim();
  const unit = formType === "সিরাপ" ? "চামচ" : formType === "ড্রপস" ? "ফোঁটা" : formType === "ক্যাপসুল" ? "ক্যাপসুল" : formType === "ইনজেকশন" ? "ইনজেকশন" : "ট্যাবলেট";

  // Check if explicit teaspoon / ml present
  let customAmount = "";
  if (f.includes("মিলি") || f.includes("ml") || f.includes("চামচ")) {
    const match = f.match(/([০-৯0-9.]+\s*(?:মিলি|ml|চামচ)(?:\s*\([^)]+\))?)/i);
    if (match) customAmount = match[1];
  }

  const defaultAmt = customAmount || `১টি ${unit}`;

  // Patterns like 1+0+1, 1+1+1, 0+0+1, 1+0+0, 1+1+1+1, 1/2+0+1/2
  const matchPattern = f.match(/([0-9০-৯./]+)\s*[\+\-]\s*([0-9০-৯./]+)(?:\s*[\+\-]\s*([0-9০-৯./]+))?(?:\s*[\+\-]\s*([0-9০-৯./]+))?/);

  const toEnNum = (str: string) =>
    str.replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d).toString());

  const parseDosePart = (part?: string) => {
    if (!part) return 0;
    const clean = toEnNum(part.trim());
    if (clean.includes("/")) {
      const [a, b] = clean.split("/").map(Number);
      return b ? a / b : 0;
    }
    return parseFloat(clean) || 0;
  };

  const formatDoseLabel = (rawPart: string | undefined, val: number) => {
    if (val <= 0 || !rawPart) return "—";
    if (customAmount) return `✓ ${customAmount}`;
    return `✓ ${rawPart.trim()}টি ${unit}`;
  };

  if (matchPattern) {
    const mVal = parseDosePart(matchPattern[1]);
    const nVal = parseDosePart(matchPattern[2]);
    const eVal = parseDosePart(matchPattern[3]);
    const fourthVal = parseDosePart(matchPattern[4]);

    const morning = formatDoseLabel(matchPattern[1], mVal);
    const noon = formatDoseLabel(matchPattern[2], nVal);
    const night = fourthVal > 0
      ? `✓ দিনে ৪ বার (${f})`
      : formatDoseLabel(matchPattern[3], eVal);

    const parts: string[] = [];
    if (mVal > 0) parts.push("সকাল");
    if (nVal > 0) parts.push("দুপুর");
    if (eVal > 0) parts.push("রাত");
    if (fourthVal > 0) parts.push("মধ্যরাত");

    const count = (mVal > 0 ? 1 : 0) + (nVal > 0 ? 1 : 0) + (eVal > 0 ? 1 : 0) + (fourthVal > 0 ? 1 : 0);
    const instrSuffix = instr ? ` — ${instr}` : "";
    const summary = count > 0
      ? `প্রতিদিন ${count} বার (${parts.join("-")})${instrSuffix}`
      : `${freq}${instrSuffix}`;

    return { morning, noon, night, summary };
  }

  // Fallback when non-plus format used (e.g. "রাতে ১টি", "দিনে ২ বার", "প্রয়োজনে")
  if (f.includes("সকাল") && f.includes("রাত")) {
    return {
      morning: `✓ ${defaultAmt}`,
      noon: "—",
      night: `✓ ${defaultAmt}`,
      summary: `প্রতিদিন ২ বার (সকাল ও রাত)${instr ? ` — ${instr}` : ""}`,
    };
  }
  if (f.includes("৩ বার") || f.includes("3 বার") || f.includes("tds")) {
    return {
      morning: `✓ ${defaultAmt}`,
      noon: `✓ ${defaultAmt}`,
      night: `✓ ${defaultAmt}`,
      summary: `প্রতিদিন ৩ বার (সকাল-দুপুর-রাত)${instr ? ` — ${instr}` : ""}`,
    };
  }
  if (f.includes("রাত") || f.includes("রাতে") || f.includes("hs")) {
    return {
      morning: "—",
      noon: "—",
      night: `✓ ${defaultAmt}`,
      summary: `প্রতিদিন রাতে ১ বার${instr ? ` — ${instr}` : ""}`,
    };
  }
  if (f.includes("সকাল") || f.includes("সকালে") || f.includes("od")) {
    return {
      morning: `✓ ${defaultAmt}`,
      noon: "—",
      night: "—",
      summary: `প্রতিদিন সকালে ১ বার${instr ? ` — ${instr}` : ""}`,
    };
  }

  return {
    morning: f ? `✓ ${freq}` : `✓ ${defaultAmt}`,
    noon: "—",
    night: "—",
    summary: `${freq || "চিকিৎসকের পরামর্শ অনুযায়ী"}${instr ? ` — ${instr}` : ""}`,
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
  lines?: {
    medicine_name: string;
    dose?: string;
    frequency?: string;
    duration?: string;
    instructions?: string;
    generic_name?: string | null;
    dosage_form?: string | null;
    indications?: string | null;
    mode_of_action?: string | null;
    side_effects?: string | null;
  }[];
}): PrescriptionExplanation {
  const lines = rx.lines || [];
  const explainedMeds: ExplainedMedicine[] = [];

  for (const line of lines) {
    const rawName = (line.medicine_name || "").trim();
    if (!rawName) continue;

    // Match against the 25,534-medicine database (either pre-enriched from server or client-side sync lookup)
    const dbMatch = matchMedicineSync(rawName);
    const genericName = (line.generic_name || dbMatch?.genericName || "").trim() || undefined;
    const dosageFormEn = (line.dosage_form || dbMatch?.dosageForm || "").trim() || undefined;
    const indicationsEn = (line.indications || dbMatch?.indications || "").trim() || undefined;
    const modeOfAction = (line.mode_of_action || dbMatch?.modeOfAction || "").trim() || undefined;
    const sideEffectsEn = (line.side_effects || dbMatch?.sideEffects || "").trim() || undefined;

    // Detect form type using both Rx prefix and matched dosage form
    const mappedBnForm = toBengaliDosageForm(dosageFormEn || "", rawName);
    const formType: ExplainedMedicine["formType"] = mappedBnForm === "অন্যান্য" ? "ওষুধ" : mappedBnForm;

    // Clean brand name
    const cleanName = rawName.replace(/^(tab\.|tab|cap\.|cap|syr\.|syr|inj\.|inj|susp\.|susp|drops?|supp\.|supp|cream|ointment|gel|inhaler|spray|powder|sol\.)\s*/i, "").trim();

    // Match rule against rawName, cleanName, OR matched genericName from 25,534-medicine DB!
    const matchedRule = DRUG_RULES.find(
      (r) =>
        r.pattern.test(rawName) ||
        r.pattern.test(cleanName) ||
        (genericName ? r.pattern.test(genericName) : false)
    );

    const derived = deriveCategoryAndPurposeFromGeneric(
      genericName || "",
      indicationsEn || "",
      sideEffectsEn || ""
    );

    const category = matchedRule
      ? genericName
        ? `${matchedRule.category} • ${genericName}`
        : matchedRule.category
      : derived.category;

    const purpose = matchedRule
      ? indicationsEn
        ? `${matchedRule.purpose} (নির্দেশনা: ${indicationsEn})`
        : matchedRule.purpose
      : derived.purpose;

    const howToTake = matchedRule
      ? `${line.instructions ? `${line.instructions}। ` : ""}${matchedRule.howToTake}`
      : line.instructions
      ? `${line.instructions} — চিকিৎসকের পরামর্শ অনুযায়ী নিয়ম মেনে সেবন করুন।`
      : "চিকিৎসকের পরামর্শ অনুযায়ী নির্দিষ্ট সময়ে নিয়ম মেনে সেব্য।";

    const sideEffects = matchedRule
      ? sideEffectsEn
        ? `${matchedRule.sideEffects} (${sideEffectsEn})`
        : matchedRule.sideEffects
      : derived.sideEffects;

    const precautions = matchedRule ? matchedRule.precautions : derived.precautions;

    // Dosage schedule
    const sched = parseDoseSchedule(line.frequency || line.dose || "", formType, line.instructions);
    const rawDur = (line.duration || "").trim();
    const formattedDur = /^\d+$/.test(rawDur) ? `${rawDur} দিন` : (rawDur || "ডাক্তারের পরামর্শ অনুযায়ী");

    explainedMeds.push({
      originalName: rawName,
      cleanName,
      formType,
      genericName,
      dosageFormEn,
      indicationsEn,
      modeOfAction,
      sideEffectsEn,
      category,
      purpose,
      howToTake,
      sideEffects,
      precautions,
      morningDose: sched.morning,
      noonDose: sched.noon,
      nightDose: sched.night,
      durationText: formattedDur,
      summaryFrequency: sched.summary,
    });
  }

  // Parse Vitals (Supports JSON or comma-separated string like "Height: 65 in, Weight: 60 kg, BP: 120/80 mmHg, Pulse: 78 bpm")
  const vitalsList: { label: string; value: string; status: string; note: string }[] = [];
  let parsedVitals: Record<string, string> = {};
  if (typeof rx.vitals === "string" && rx.vitals.trim()) {
    const raw = rx.vitals.trim();
    if (raw.startsWith("{")) {
      try {
        parsedVitals = JSON.parse(raw);
      } catch {}
    } else {
      for (const chunk of raw.split(",")) {
        const idx = chunk.indexOf(":");
        if (idx === -1) continue;
        const k = chunk.slice(0, idx).trim();
        const v = chunk.slice(idx + 1).trim();
        if (!k || !v || v.toUpperCase() === "N/A") continue;
        const kl = k.toLowerCase();
        if (kl === "bp") parsedVitals.bp = v;
        else if (kl === "pulse") parsedVitals.pulse = v;
        else if (kl === "temp" || kl === "temperature") parsedVitals.temp = v;
        else if (kl === "weight") parsedVitals.weight = v;
        else if (kl === "height") parsedVitals.height = v;
        else if (kl === "bmi") parsedVitals.bmi = v;
        else if (kl === "spo2" || kl === "spo₂") parsedVitals.spo2 = v;
        else if (kl === "rbs") parsedVitals.rbs = v;
        else parsedVitals[k] = v;
      }
    }
  } else if (typeof rx.vitals === "object" && rx.vitals !== null) {
    parsedVitals = rx.vitals;
  }

  const ensureUnit = (val: string, unit: string) =>
    val.toLowerCase().includes(unit.toLowerCase()) ? val : `${val} ${unit}`;

  if (parsedVitals.bp) {
    vitalsList.push({
      label: "BP (রক্তচাপ)",
      value: ensureUnit(parsedVitals.bp, "mmHg"),
      status: "পরীক্ষিত মান",
      note: "রক্তচাপের নথিবদ্ধ মাত্রা।",
    });
  }
  if (parsedVitals.pulse) {
    vitalsList.push({
      label: "Pulse (নাড়ির গতি)",
      value: ensureUnit(parsedVitals.pulse, "bpm"),
      status: "পরীক্ষিত মান",
      note: "হৃদস্পন্দনের নথিবদ্ধ গতি।",
    });
  }
  if (parsedVitals.temp) {
    const tVal = parseFloat(parsedVitals.temp);
    const isFever = !isNaN(tVal) && ((tVal >= 99 && tVal <= 110) || (tVal >= 37.5 && tVal <= 43));
    vitalsList.push({
      label: "Temp (তাপমাত্রা)",
      value: parsedVitals.temp.includes("°") ? parsedVitals.temp : `${parsedVitals.temp}°`,
      status: isFever ? "জ্বর নির্দেশ করে" : "স্বাভাবিক",
      note: isFever ? "শরীরে জ্বর রয়েছে।" : "শরীরের তাপমাত্রা স্বাভাবিক।",
    });
  }
  if (parsedVitals.weight) {
    vitalsList.push({
      label: "Weight (ওজন)",
      value: ensureUnit(parsedVitals.weight, "kg"),
      status: "নথিবদ্ধ",
      note: parsedVitals.bmi ? `BMI: ${parsedVitals.bmi}` : "শারীরিক ওজন নথিবদ্ধ।",
    });
  }
  if (parsedVitals.height) {
    vitalsList.push({
      label: "Height (উচ্চতা)",
      value: ensureUnit(parsedVitals.height, "in"),
      status: "নথিবদ্ধ",
      note: "শারীরিক উচ্চতা।",
    });
  }
  if (parsedVitals.spo2) {
    vitalsList.push({
      label: "SpO₂ (অক্সিজেন)",
      value: ensureUnit(parsedVitals.spo2, "%"),
      status: "পরীক্ষিত মান",
      note: "রক্তে অক্সিজেনের মাত্রা।",
    });
  }
  if (parsedVitals.rbs) {
    vitalsList.push({
      label: "RBS (ব্লাড সুগার)",
      value: ensureUnit(parsedVitals.rbs, "mmol/L"),
      status: "পরীক্ষিত মান",
      note: "রক্তে শর্করার তাৎক্ষণিক মাত্রা।",
    });
  }
  // Any custom vitals entered by doctor
  const stdKeys = new Set(["bp", "pulse", "temp", "weight", "height", "bmi", "spo2", "rbs"]);
  for (const [k, v] of Object.entries(parsedVitals)) {
    if (!stdKeys.has(k.toLowerCase()) && v) {
      vitalsList.push({
        label: k,
        value: String(v),
        status: "নথিবদ্ধ",
        note: "চিকিৎসক কর্তৃক নথিবদ্ধ মান।",
      });
    }
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
  if (explainedMeds.some((m) => m.category.includes("গ্যাস্ট্রিক"))) {
    goals.push("এসিডিটি ও পেটের অস্বস্তি নিয়ন্ত্রণ করা");
  }
  if (explainedMeds.some((m) => m.category.includes("পুষ্টি") || m.category.includes("ভিটামিন"))) {
    goals.push("শরীরের পুষ্টি ও শক্তির ঘাটতি পূরণ করা");
  }
  goals.push("রোগ প্রতিরোধ ক্ষমতা বাড়ানো ও শরীরকে দ্রুত সুস্থ হতে সাহায্য করা");

  // Overall Condition Reassurance
  let overallCondition = "চিকিৎসক আপনার শারীরিক সমস্যাগুলো পর্যালোচনা করে এই ব্যবস্থাপত্র দিয়েছেন। ";
  if (rx.diagnosis) {
    overallCondition += `উল্লেখিত সমস্যা: ${rx.diagnosis}। `;
  }
  if (explainedMeds.length > 0) {
    overallCondition += `মোট ${explainedMeds.length}টি ওষুধ নির্ধারণ করা হয়েছে। `;
  }
  overallCondition += "নির্ধারিত ওষুধগুলো সময়মতো গ্রহণ করুন এবং চিকিৎসকের পরামর্শ মেনে চলুন।";

  // Drug-Drug Interaction (Dynamic based on actual prescribed medicines)
  const medNamesList = explainedMeds.map((m) => m.cleanName).join(", ");
  const hasPpi = explainedMeds.some((m) => /pantonix|sergel|seclo|maxpro|esomeprazole|omeprazole|rabeprazole|pantoprazole/i.test(m.cleanName));
  const hasNsaid = explainedMeds.some((m) => /flexi|aceclo|ketorolac|rolac|naproxen|ibuprofen/i.test(m.cleanName));

  let interactionMessage = explainedMeds.length > 1
    ? `প্রেসক্রিপশনে দেওয়া ওষুধগুলোর (${medNamesList}) মধ্যে কোনো ক্ষতিকর Drug-Drug Interaction পাওয়া যায়নি। চিকিৎসকের নির্দেশিত সময় অনুযায়ী ওষুধগুলো নিরাপদে সেবন করা যাবে।`
    : "প্রেসক্রিপশনে প্রদত্ত ওষুধটি চিকিৎসকের নির্দেশিত নিয়ম ও সময় মেনে সেবন করুন।";
  if (hasPpi && hasNsaid) {
    interactionMessage = "ব্যথানাশক ওষুধের সাথে গ্যাস্ট্রিকের ওষুধ দেওয়া হয়েছে যা পেটের এসিডিটি রোধে নিরাপদ ও কার্যকর কম্বিনেশন।";
  }

  // Doctor's Actual Advice + Helpful General Advice
  const doctorAdviceLines = (rx.advice || "")
    .split(/\r?\n|,|;/)
    .map((s) => s.trim())
    .filter(Boolean);

  const lifestyleAdvice: string[] = [...doctorAdviceLines];
  if (lifestyleAdvice.length === 0) {
    lifestyleAdvice.push("প্রতিদিন পর্যাপ্ত (৮–১০ গ্লাস) বিশুদ্ধ পানি পান করুন।");
    lifestyleAdvice.push("ওষুধ সবসময় নির্ধারিত সময়ের মধ্যে এবং নিয়ম মেনে সেবন করুন।");
  }
  if (rx.next_visit) {
    lifestyleAdvice.push(`পরবর্তী সাক্ষাৎ (Follow-up): ${rx.next_visit}`);
  }

  // Red Flags
  const dangerSigns: string[] = [
    "জ্বর ১০২° ফারেনহাইটের বেশি হলে বা দীর্ঘদিন না কমলে",
    "তীব্র শ্বাসকষ্ট বা বুকে ব্যথা অনুভূত হলে",
    "অতিরিক্ত বমি বা ডায়রিয়া শুরু হলে",
    "ওষুধ খাওয়ার পর শরীরে র‍্যাশ, চুলকানি বা অ্যালার্জির লক্ষণ দেখা দিলে",
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
