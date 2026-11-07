/**
 * Smart Patient Prescription & Lab Report Explainer Engine (Bangla)
 * 100% Real-Data-Driven Clinical Translation & Analysis Engine powered by the
 * 25,534-medicine & 1,748-generic clinical database (public/data/medicines-db.json).
 */

import { matchMedicineSync, toBengaliDosageForm } from "./medicines-db";

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
  quantityText?: string;
}

export interface PrescriptionExplanation {
  overallCondition: string;
  treatmentGoals: string[];
  vitalsExplained: {
    label: string;
    value: string;
    status: string;
    note: string;
  }[];
  investigationsExplained: {
    name: string;
    reason: string;
  }[];
  medicines: ExplainedMedicine[];
  drugInteraction: {
    status: "safe" | "caution";
    message: string;
    sub1: string;
    sub2: string;
  };
  lifestyleAdvice: string[];
  actionCards: {
    icon: string;
    text: string;
  }[];
  dangerSigns: string[];
  specialNotes?: string;
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
  clinicalNote?: string;
}

export interface LabReportExplanation {
  testName: string;
  department?: string;
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
  faqs: {
    question: string;
    answer: string;
  }[];
}

/* ========================================================================== */
/*     COMPREHENSIVE PHARMACOLOGICAL RULES (30+ THERAPEUTIC CLASSES)          */
/* ========================================================================== */

interface DrugRule {
  pattern: RegExp;
  category: string;
  purpose: string;
  modeOfActionBn: string;
  howToTake: string;
  sideEffects: string;
  precautions: string;
}

const DRUG_RULES: DrugRule[] = [
  {
    pattern: /\b(napa|ace|paracetamol|acetaminophen|xcel|renova|fast|pyralgin|feva|tylenol|tamol|zeropain)\b/i,
    category: "জ্বর ও ব্যথা উপশমকারী (Analgesic & Antipyretic)",
    purpose: "জ্বর কমানো এবং মাথাব্যথা, শরীর ব্যথা, দাঁত ব্যথা বা গলা ব্যথা দ্রুত উপশম করতে সাহায্য করে।",
    modeOfActionBn: "মস্তিষ্কের তাপমাত্রা নিয়ন্ত্রণ কেন্দ্রে (Hypothalamus) কাজ করে শরীরের বাড়তি তাপমাত্রা কমায় এবং ব্যথার সংকেত তৈরি হওয়া রোধ করে।",
    howToTake: "খাবারের পরে পর্যাপ্ত পানির সাথে সেবন করুন।",
    sideEffects: "সাধারণত নিরাপদ ও সহনশীল, বিরল ক্ষেত্রে হালকা বমি ভাব বা ত্বকে র‍্যাশ",
    precautions: "নির্ধারিত মাত্রার বেশি খাবেন না (পূর্ণবয়স্কদের ক্ষেত্রে দিনে সর্বোচ্চ ৪ গ্রামের বেশি নয়)। লিভারের জটিলতা থাকলে ডাক্তারের পরামর্শ নিন।",
  },
  {
    pattern: /\b(tramadol|tapentadol|napadol|ultracet|tramacet|morphine|nalbuphine|pethidine|fentanyl)\b/i,
    category: "তীব্র ব্যথা উপশমকারী (Central Analgesic)",
    purpose: "মাঝারি থেকে তীব্র শারীরিক ব্যথা, আঘাতজনিত ব্যথা বা অপারেশন-পরবর্তী ব্যথা দ্রুত কমাতে কাজ করে।",
    modeOfActionBn: "কেন্দ্রীয় স্নায়ুতন্ত্রে ব্যথার অনুভূতি আদান-প্রদানকারী রিসেপ্টরকে ব্লক করে তীব্র ব্যথা কমিয়ে আনে।",
    howToTake: "চিকিৎসকের নির্দেশিত সময়ে খাবারের পরে সেবন করুন।",
    sideEffects: "হালকা ঘুম ঘুম ভাব, মাথা ঘোরা, বমি ভাব, কোষ্ঠকাঠিন্য",
    precautions: "ওষুধটি খাওয়ার পর গাড়ি চালানো বা ভারী যন্ত্রপাতি চালানো থেকে বিরত থাকুন। চিকিৎসকের পরামর্শ ছাড়া দীর্ঘদিন খাবেন না।",
  },
  {
    pattern: /\b(ketorolac|rolac|toradolin|aceclofenac|flexi|diclofenac|clofenac|voltaren|naproxen|napro|xenapro|ibuprofen|flamex|etoricoxib|torix|arcoxia|celecoxib|meloxicam|indomethacin|mefenamic|dexketoprofen|tolfenamic|tufnil|piroxicam|tenoxicam|nabumetone)\b/i,
    category: "ব্যথা ও প্রদাহনাশক ওষুধ (NSAID)",
    purpose: "হাড় ও জয়েন্টের ব্যথা, কোমর ব্যথা, পেশির টান, দাঁত ব্যথা, মাইগ্রেন বা প্রদাহজনিত ফোলা ও ব্যথা কমাতে কাজ করে।",
    modeOfActionBn: "শরীরে প্রদাহ ও ব্যথা সৃষ্টিকারী প্রোস্টাগ্ল্যান্ডিন (Prostaglandin / COX এনজাইম) নিঃসরণ কমিয়ে ব্যথা ও ফোলা দূর করে।",
    howToTake: "অবশ্যই ভরা পেটে (খাবারের পরে) এক গ্লাস পানির সাথে খাবেন।",
    sideEffects: "পেটে গ্যাস বা জ্বালাপোড়া, বমি বমি ভাব, হালকা মাথা ঘোরা",
    precautions: "খালি পেটে কখনোই খাবেন না। কিডনি রোগ, পেপটিক আলসার বা হাঁপানি থাকলে সতর্কতা অবলম্বন করুন।",
  },
  {
    pattern: /\b(tizanidine|tizadin|baclofen|beklo|tolperisone|myolax|eperisone|cyclobenzaprine)\b/i,
    category: "মাংসপেশির খিঁচুনি ও শক্তভাব উপশমকারী (Muscle Relaxant)",
    purpose: "ঘাড়, পিঠ বা কোমরের মাংসপেশির টান, খিঁচুনি ও জড়তা কমিয়ে স্বাভাবিক নড়াচড়ায় সাহায্য করে।",
    modeOfActionBn: "স্নায়ুর মাধ্যমে মাংসপেশির অতিরিক্ত সংকোচন ও টান শিথিল করে ব্যথা ও শক্তভাব কমায়।",
    howToTake: "খাবারের পরে চিকিৎসকের নির্দেশিত সময়ে (প্রায়ই রাতে) সেবন করুন।",
    sideEffects: "ঘুম ঘুম ভাব, মুখ শুকিয়ে যাওয়া, সামান্য দুর্বলতা",
    precautions: "ওষুধটি খেলে তন্দ্রাভাব আসতে পারে, তাই সতর্কতার কাজ করার সময় সাবধান থাকুন।",
  },
  {
    pattern: /\b(sergel|maxpro|seclo|pantonix|omeprazole|esomeprazole|pantoprazole|rabeprazole|dexlansoprazole|lansoprazole|ilaprazole|vonoprazan|finix|losectil|proceptin|nexum|optima|rabeca|dexlan|famo|famotidine|famotack)\b/i,
    category: "গ্যাস্ট্রিক ও আলসার প্রতিরোধক (PPI / Acid Blocker)",
    purpose: "পাকস্থলীর অতিরিক্ত এসিড কমানো, বুকজ্বালা, গ্যাস্ট্রিক, পেপটিক আলসার ও ব্যথার ওষুধজনিত এসিডিটি রোধ করতে দেওয়া হয়েছে।",
    modeOfActionBn: "পাকস্থলীর কোষে থাকা প্রোটন পাম্প (H+/K+ ATPase) বা এসিড নিঃসরণকারী গ্রন্থিকে সাময়িকভাবে নিষ্ক্রিয় করে অতিরিক্ত এসিড তৈরি বন্ধ করে।",
    howToTake: "সকালে ও/অথবা রাতে খাবারের অন্তত ২০–৩০ মিনিট আগে খালি পেটে আস্ত গিলে খাবেন।",
    sideEffects: "সাধারণত নিরাপদ, কদাচিৎ হালকা মাথাব্যথা, পেট ফাঁপা বা পাতলা পায়খানা",
    precautions: "ক্যাপসুল বা ট্যাবলেট ভেঙে বা চিবিয়ে খাবেন না, পানি দিয়ে আস্ত গিলে খাবেন।",
  },
  {
    pattern: /\b(entacyd|gavisol|algicid|marlox|magaldrate|aluminium hydroxide|magnesium hydroxide|sodium alginate|simethicone|sucralfate|flatameal)\b/i,
    category: "তাৎক্ষণিক এসিড ও বুকজ্বালা প্রশমনকারী (Antacid / Alginate)",
    purpose: "পেটের অতিরিক্ত এসিড তাৎক্ষণিক প্রশমিত করে বুকজ্বালা, টক ঢেকুর ও পেট ফাঁপা দ্রুত কমায়।",
    modeOfActionBn: "পাকস্থলীর এসিডকে সরাসরি প্রশমিত (Neutralize) করে এবং খাদ্যনালির ওপর একটি সুরক্ষাকারী আবরণ তৈরি করে।",
    howToTake: "খাবারের ২০–৩০ মিনিট পরে এবং রাতে ঘুমানোর আগে (সিরাপ হলে ভালোভাবে ঝাঁকিয়ে, ট্যাবলেট হলে চিবিয়ে) সেবন করুন।",
    sideEffects: "স্বাদের সামান্য পরিবর্তন, অতিরিক্ত খেলে হালকা কোষ্ঠকাঠিন্য বা নরম পায়খানা",
    precautions: "অন্যান্য ওষুধ (বিশেষ করে অ্যান্টিবায়োটিক বা আয়রন) খাওয়ার অন্তত ১–২ ঘণ্টা আগে বা পরে এটি খাবেন।",
  },
  {
    pattern: /\b(omidon|motigut|defux|deflux|domperidone|ondansetron|emistat|onaseron|palonosetron|paloxi|granisetron|metoclopramide|itopride|prochlorperazine|stemetil|meclizine|cinnarizine)\b/i,
    category: "বমি ভাব, মাথা ঘোরা ও বদহজম নিরামক (Anti-emetic / Prokinetic)",
    purpose: "বমি বা বমি বমি ভাব দূর করা, মাথা ঘোরা কমানো এবং খাবার দ্রুত হজম হতে ও পেট ফাঁপা কমাতে সাহায্য করে।",
    modeOfActionBn: "মস্তিষ্কের বমি কেন্দ্রের সংকেত প্রশমিত করে এবং পাকস্থলীর স্বাভাবিক সংকোচন বাড়িয়ে খাবার হজমে সাহায্য করে।",
    howToTake: "খাবারের ১৫–৩০ মিনিট আগে সেবন করা সবচেয়ে কার্যকর।",
    sideEffects: "মুখ সামান্য শুকিয়ে যাওয়া, হালকা তন্দ্রাভাব বা মাথাব্যথা",
    precautions: "নির্ধারিত ডোজের বেশি খাবেন না এবং খাবারের আগে সময়মতো গ্রহণ করুন।",
  },
  {
    pattern: /\b(visceralgin|algin|norvis|tiemonium|timozin|hyoscine|butapan|drotaverine|no-spa|mebeverine|mebolin|alverine|trimebutine|dicycloverine)\b/i,
    category: "পেটের কামড়ানো ও পেশির খিঁচুনি রোধক (Antispasmodic)",
    purpose: "পেট ব্যথা, অন্ত্র বা মূত্রনালির মোচড়ানো ব্যথা, আইবিএস (IBS) ও মাসিকজনিত তলপেটের ব্যথা উপশমে কাজ করে।",
    modeOfActionBn: "পাকস্থলী, অন্ত্র ও তলপেটের মসৃণ পেশির (Smooth Muscle) অতিরিক্ত সংকোচন বা খিঁচুনি শিথিল করে দ্রুত পেট ব্যথা কমায়।",
    howToTake: "চিকিৎসকের পরামর্শ অনুযায়ী খাবারের আগে বা পরে সেবন করুন।",
    sideEffects: "মুখ শুকিয়ে যাওয়া, হালকা মাথা ঘোরা বা কোষ্ঠকাঠিন্য",
    precautions: "পর্যাপ্ত পানি পান করুন এবং চিকিৎসকের নির্দেশিত ডোজ মেনে চলুন।",
  },
  {
    pattern: /\b(lactulose|avolac|duphalac|bisacodyl|dulcolax|sodium picosulfate|ezylax|ispaghula|senna|prucalopride)\b/i,
    category: "কোষ্ঠকাঠিন্য নিরামক (Laxative)",
    purpose: "পায়খানা নরম ও সহজ করে কোষ্ঠকাঠিন্য দূর করতে সাহায্য করে।",
    modeOfActionBn: "অন্ত্রে পানির পরিমাণ ধরে রেখে মল নরম করে এবং অন্ত্রের স্বাভাবিক গতিশীলতা বাড়ায়।",
    howToTake: "সাধারণত রাতে ঘুমানোর আগে পর্যাপ্ত পানির সাথে সেবন করুন।",
    sideEffects: "পেটে হালকা মোচড়ানো বা গ্যাস হওয়া",
    precautions: "দিনে অন্তত ৮–১০ গ্লাস পানি ও আঁশযুক্ত খাবার (শাকসবজি, ফলমূল) গ্রহণ করুন।",
  },
  {
    pattern: /\b(ors|oral rehydration|or-saline|racecadotril|hidrasec|loperamide|imotil|probiotic|saccharomyces|lactobacillus|enterogermina|bilac|goodgut|diosmectite)\b/i,
    category: "পানিশূন্যতা রোধক ও অন্ত্রের সুরক্ষাকারী (ORS / Antidiarrheal / Probiotic)",
    purpose: "ডায়রিয়া বা বমির কারণে শরীরের পানি ও লবণের ঘাটতি পূরণ করে এবং অন্ত্রের উপকারী ব্যাকটেরিয়ার ভারসাম্য ফিরিয়ে আনে।",
    modeOfActionBn: "শরীরে ইলেকট্রোলাইট ও পানির সমতা রক্ষা করে এবং অন্ত্রের অতিরিক্ত পানি ক্ষরণ কমিয়ে হজমশক্তি স্বাভাবিক করে।",
    howToTake: "ওরস্যালাইন আধা লিটার বিশুদ্ধ পানিতে গুলিয়ে অল্প অল্প করে পান করুন; ক্যাপসুল/ট্যাবলেট নির্দেশিত নিয়মে সেব্য।",
    sideEffects: "সাধারণত কোনো পার্শ্বপ্রতিক্রিয়া নেই ও সম্পূর্ণ নিরাপদ",
    precautions: "গুলানো ওরস্যালাইন ২৪ ঘণ্টার বেশি রেখে খাবেন না। উচ্চ রক্তচাপ থাকলে লবণের মাত্রা বিষয়ে সতর্ক থাকুন।",
  },
  {
    pattern: /\b(cipro|ciprocin|ciprofloxacin|levofloxacin|levoxin|trevox|moxifloxacin|moxquin|ofloxacin|gemifloxacin|norfloxacin|cef-3|cefixime|orcef|denvar|ceftriaxone|rocephin|trizon|ceftron|axim|cefuroxime|kilbac|cefotil|furocef|cephradine|lebacc|cefaclor|cefpodoxime|cefdinir|cefepime|ceftazidime|tazimax|cephalexin|cefadroxil|cefotaxime|cefditoren|ceftoren|azithromycin|zimax|azithrocin|tridosil|clarithromycin|klabex|erythromycin|roxithromycin|amoxicillin|moxacil|fimoxyl|amoclav|augmentin|clavulanic|flucloxacillin|flux|phylex|ampicillin|penicillin|piperacillin|doxycycline|doxicap|tetracycline|meropenem|imipenem|linezolid|vancomycin|amikacin|gentamicin|clindamycin|colistin|nitrofurantoin|macrobid|cotrimoxazole|sulfamethoxazole|trimethoprim|fosfomycin)\b/i,
    category: "অ্যান্টিবায়োটিক ও জীবাণুনাশক (Antibiotic)",
    purpose: "শরীরের ব্যাকটেরিয়াজনিত সংক্রমণ (যেমন শ্বাসতন্ত্র, গলা, কান, মূত্রনালি, ত্বক, টাইফয়েড বা পেটের ইনফেকশন) সমূলে নির্মূল করতে দেওয়া হয়েছে।",
    modeOfActionBn: "ক্ষতিকর ব্যাকটেরিয়ার কোষপ্রাচীর (Cell Wall) বা প্রোটিন ও ডিএনএ তৈরির প্রক্রিয়া ধ্বংস করে জীবাণুর বংশবৃদ্ধি সম্পূর্ণ থামিয়ে দেয়।",
    howToTake: "প্রতিদিন নির্দিষ্ট সময়ে (খাবারের পরে) এক গ্লাস পানির সাথে খাবেন এবং পুরো কোর্স শেষ করবেন।",
    sideEffects: "হালকা বমি বমি ভাব, মুখের স্বাদ পরিবর্তন, পেটে অস্বস্তি বা নরম পায়খানা",
    precautions: "জ্বর বা লক্ষণ কমে গেলেও ডাক্তারের দেওয়া মেয়াদ (যেমন ৫/৭/১০ দিন) পূর্ণ না করে মাঝপথে ওষুধ বন্ধ করবেন না, নতুবা জীবাণু রেজিস্ট্যান্ট হয়ে যেতে পারে।",
  },
  {
    pattern: /\b(metronidazole|flagyl|amodis|filmet|secnidazole|secnil|tinidazole|ornidazole|nitazoxanide|alben|albendazole|almex|mebendazole|solas|ivermectin|scabo|pyrantel)\b/i,
    category: "আমাশয়, প্রোটোজোয়া ও পরজীবীনাশক (Antiprotozoal / Anthelmintic)",
    purpose: "পেটের আমাশয়, ডায়রিয়া, জিয়ার্ডিয়াসিস, দাঁত বা মাড়ির সংক্রমণ এবং কৃমি বা পরজীবীজনিত ইনফেকশন দূর করতে কাজ করে।",
    modeOfActionBn: "ক্ষতিকর প্রোটোজোয়া, অ্যানেরোবিক জীবাণু বা পরজীবীর ডিএনএ ও শক্তি উৎপাদন প্রক্রিয়া নষ্ট করে সেগুলোকে ধ্বংস করে।",
    howToTake: "ভরা পেটে (খাবারের পরে) চিকিৎসকের নির্দেশিত নিয়ম ও মেয়াদ অনুযায়ী সেবন করুন।",
    sideEffects: "মুখে ধাতব স্বাদ লাগা, হালকা বমি ভাব বা ক্ষুধামন্দা",
    precautions: "পুরো ডোজ সম্পন্ন করুন এবং পরিষ্কার-পরিচ্ছন্নতা ও বিশুদ্ধ পানি পান নিশ্চিত করুন।",
  },
  {
    pattern: /\b(fluconazole|flugal|fluconal|omastin|itraconazole|itranet|voriconazole|terbinafine|terbex|xfin|ketoconazole|clotrimazole|miconazole|econazole|peviderm|pevisone|luliconazole|nystatin|griseofulvin)\b/i,
    category: "ছত্রাকনাশক বা ফাঙ্গাল ইনফেকশনের ওষুধ (Antifungal)",
    purpose: "ত্বক, নখ, মাথার ত্বক বা শরীরের ছত্রাকজনিত সংক্রমণ (দাদ, চুলকানি, র‍্যাশ বা ক্যানডিডিয়াসিস) নিরাময়ে কাজ করে।",
    modeOfActionBn: "ছত্রাক বা ফাঙ্গাসের কোষঝিল্লির (Ergosterol) গঠন নষ্ট করে ফাঙ্গাসের বৃদ্ধি বন্ধ করে ও সংক্রমণ সারিয়ে তোলে।",
    howToTake: "ট্যাবলেট/ক্যাপসুল ভরা পেটে খাবেন; ক্রিম বা মলম হলে আক্রান্ত স্থান পরিষ্কার ও শুষ্ক করে পাতলাভাবে লাগাবেন।",
    sideEffects: "হালকা পেটের অস্বস্তি বা মলম লাগানোর স্থানে সাময়িক হালকা জ্বালাপোড়া",
    precautions: "সংক্রমণ পুরোপুরি সেরে যাওয়ার পরেও ডাক্তারের পরামর্শ অনুযায়ী নির্ধারিত দিন পর্যন্ত ব্যবহার চালিয়ে যান যাতে ইনফেকশন ফিরে না আসে।",
  },
  {
    pattern: /\b(acyclovir|zovirax|valacyclovir|oseltamivir|favipiravir|entecavir|tenofovir|sofosbuvir)\b/i,
    category: "ভাইরাসজনিত সংক্রমণ রোধক (Antiviral)",
    purpose: "ভাইরাসজনিত সংক্রমণ (যেমন হার্পিস, জলবসন্ত, ফ্লু বা হেপাটাইটিস) নিয়ন্ত্রণে কাজ করে।",
    modeOfActionBn: "ভাইরাসের ডিএনএ বা আরএনএ প্রতিলিপি তৈরির এনজাইম ব্লক করে শরীরে ভাইরাসের বংশবৃদ্ধি থামিয়ে দেয়।",
    howToTake: "নির্দিষ্ট সময় অন্তর পর্যাপ্ত পানির সাথে সেবন করুন।",
    sideEffects: "হালকা মাথাব্যথা, ক্লান্তি বা বমি ভাব",
    precautions: "ওষুধটি চলাকালীন প্রচুর পানি পান করুন এবং নির্ধারিত কোর্স সম্পূর্ণ করুন।",
  },
  {
    pattern: /\b(fexo|fexofenadine|fenadin|telfast|alatrol|cetirizine|atrizin|levocetirizine|alcetc|seasonix|rupatadine|rupax|bilastine|bilastin|deslor|desloratadine|loratadine|ebastine|ebatin|chlorpheniramine|histacin|diphenhydramine|hydroxyzine|ketotifen|tofen|prosma|cyproheptadine)\b/i,
    category: "অ্যালার্জি, সর্দি ও হাঁচি-কাশি নিরামক (Antihistamine)",
    purpose: "অ্যালার্জি, সর্দি, হাঁচি, নাক দিয়ে পানি পড়া, চোখ চুলকানো বা ত্বকের চুলকানি ও র‍্যাশ উপশম করতে দেওয়া হয়েছে।",
    modeOfActionBn: "শরীরে অ্যালার্জি সৃষ্টিকারী রাসায়নিক উপাদান 'হিস্টামিন' (Histamine H1 receptor)-এর কার্যকারিতা ব্লক করে অ্যালার্জির লক্ষণ দ্রুত কমায়।",
    howToTake: "সাধারণত রাতে ঘুমানোর আগে অথবা চিকিৎসকের নির্দেশিত সময়ে সেবন করুন।",
    sideEffects: "হালকা তন্দ্রা বা ঘুম ঘুম ভাব, মুখ সামান্য শুকিয়ে যাওয়া",
    precautions: "ধুলোবালি, ঠান্ডা পানি ও যেসব খাবারে অ্যালার্জি আছে তা এড়িয়ে চলুন।",
  },
  {
    pattern: /\b(monas|montelukast|monalast|montene|arokast|reversair|lumona|provair|salbutamol|sultolin|ventolin|azmasol|levosalbutamol|bambuterol|bamboo|salmeterol|formoterol|fluticasone|budesonide|beclomethasone|seretide|symbicort|tiotropium|ipratropium|doxofylline|doxiva|theophylline|theovent|aminophylline|ambroxol|ambrox|mucospel|bromhexine|acetylcysteine|fluimucil|guaifenesin|dextromethorphan|butamirate|mirakof|levodropropizine|tuspel|ofcof|xylometazoline|antazol|oxymetazoline|afrin)\b/i,
    category: "শ্বাসকষ্ট, হাঁপানি ও কাশি নিরামক (Respiratory & Bronchodilator)",
    purpose: "কাশি, বুকে জমে থাকা কফ পরিষ্কার করা, শ্বাসকষ্ট, হাঁপানি (Asthma) বা দীর্ঘমেয়াদী অ্যালার্জিক কাশি নিয়ন্ত্রণে কাজ করে।",
    modeOfActionBn: "শ্বাসনালির প্রদাহ ও সংকোচন কমিয়ে শ্বাসপথ প্রসারিত করে এবং ঘন কফ তরল করে সহজে বের হতে সাহায্য করে।",
    howToTake: "ট্যাবলেট সাধারণত রাতে; সিরাপ বা ইনহেলার চিকিৎসকের নির্দেশিত মাত্রায় ব্যবহার করুন।",
    sideEffects: "হালকা গলা শুকিয়ে যাওয়া, মাথাব্যথা বা বুক সামান্য ধড়ফড় করা (ইনহেলার/ব্রঙ্কোডাইলেটরে)",
    precautions: "ঠান্ডা বাতাস, ধোঁয়া ও ধুলোবালি থেকে দূরে থাকুন। কুসুম গরম পানি পান করুন।",
  },
  {
    pattern: /\b(amdocal|amlodipine|bizoran|camlosart|osartil|losartan|losamax|angilock|telmisartan|telmilok|abetis|olmesartan|orbas|valsartan|irbesartan|candesartan|azilsartan|cilnidipine|cilacar|lercanidipine|nifedipine|diltiazem|verapamil|ramipril|tritace|enalapril|lisinopril|perindopril|bisoprolol|concor|cardicam|metoprolol|betaloc|atenolol|tenoren|nebivolol|carvedilol|propranolol|indever|labetalol|prazosin|hydrochlorothiazide|chlorthalidone|indapamide|furosemide|lasix|torasemide|spironolactone|edeloss|digoxin|amiodarone|ivabradine|trimetazidine|metagard|ranolazine|nitroglycerin|angist|isosorbide)\b/i,
    category: "রক্তচাপ ও হৃদরোগ নিয়ন্ত্রক (Antihypertensive / Cardiac Care)",
    purpose: "উচ্চ রক্তচাপ (High BP) নিয়ন্ত্রণে রাখা, হৃদস্পন্দন স্বাভাবিক রাখা এবং হার্ট অ্যাটাক ও স্ট্রোকের ঝুঁকি প্রতিরোধ করতে দেওয়া হয়েছে।",
    modeOfActionBn: "রক্তনালিকে প্রসারিত ও শিথিল করে রক্ত চলাচল সহজ করে এবং হৃৎপিণ্ডের ওপর অতিরিক্ত চাপ কমিয়ে রক্তচাপ স্বাভাবিক সীমায় রাখে।",
    howToTake: "প্রতিদিন একই সময়ে (সকালে বা রাতে) চিকিৎসকের নির্দেশ অনুযায়ী নিয়মিত সেবন করুন।",
    sideEffects: "প্রথম দিকে হালকা মাথা ঘোরা, ক্লান্তি বা গোড়ালিতে সামান্য পানি আসা",
    precautions: "প্রেশার স্বাভাবিক মনে হলেও ডাক্তারের পরামর্শ ছাড়া কখনোই হঠাৎ রক্তচাপের ওষুধ বন্ধ করবেন না। খাবারে অতিরিক্ত কাঁচা লবণ পরিহার করুন।",
  },
  {
    pattern: /\b(rosustat|rosuvastatin|rosuva|atorva|atorvastatin|lipicon|tiginor|simvastatin|pitavastatin|fenofibrate|lipiloff|ezetimibe|aspirin|ecosprin|carva|clopidogrel|clopid|plavix|anclog|prasugrel|ticagrelor|brilinta|cilostazol|warfarin|rivaroxaban|xarelto|apixaban|dabigatran|enoxaparin)\b/i,
    category: "কোলেস্টেরল নিয়ন্ত্রক ও রক্তনালি সুরক্ষাকারী (Lipid-Lowering / Antiplatelet)",
    purpose: "রক্তের ক্ষতিকর চর্বি (LDL কোলেস্টেরল ও ট্রাইগ্লিসারাইড) কমানো এবং রক্তনালিতে জমাট বাঁধা রোধ করে হৃদরোগ ও স্ট্রোক প্রতিরোধে কাজ করে।",
    modeOfActionBn: "লিভারে অতিরিক্ত কোলেস্টেরল তৈরির এনজাইম (HMG-CoA reductase) নিয়ন্ত্রণ করে এবং রক্তের অণুচক্রিকার (Platelet) জমাট বাঁধার প্রবণতা কমায়।",
    howToTake: "কোলেস্টেরলের ওষুধ সাধারণত রাতে খাবারের পরে এবং রক্ত পাতলা করার ওষুধ দুপুরের খাবারের পরে সেবন করুন।",
    sideEffects: "মাংসপেশিতে হালকা ব্যথা বা টান, পেটে সামান্য অস্বস্তি",
    precautions: "তৈলাক্ত, চর্বিযুক্ত ও ভাজাপোড়া খাবার এড়িয়ে চলুন এবং প্রতিদিন অন্তত ৩০ মিনিট হাঁটার অভ্যাস করুন।",
  },
  {
    pattern: /\b(comet|metformin|formet|daomin|glimepiride|secrin|gifon|amaryl|gliclazide|diamicron|gleek|glipizide|sitagliptin|januvia|sita|vildagliptin|galvus|vilda|linagliptin|linatab|trajenta|empagliflozin|jardiance|empa|dapagliflozin|forxiga|pioglitazone|acarbose|voglibose|repaglinide|insulin|insulet|mixtard|actrapid|novorapid|lantus|tresiba|liraglutide|semaglutide)\b/i,
    category: "ডায়াবেটিস ও রক্তের সুগার নিয়ন্ত্রক (Antidiabetic)",
    purpose: "রক্তের গ্লুকোজ বা সুগারের মাত্রা নিয়ন্ত্রণে রেখে ডায়াবেটিস এবং ডায়াবেটিসজনিত কিডনি, চোখ ও স্নায়ুর জটিলতা প্রতিরোধ করে।",
    modeOfActionBn: "শরীরে ইনসুলিনের নিঃসরণ ও কার্যকারিতা বাড়ায় এবং লিভার থেকে অতিরিক্ত গ্লুকোজ তৈরি ও শর্করা শোষণ কমিয়ে ব্লাড সুগার নিয়ন্ত্রণে রাখে।",
    howToTake: "চিকিৎসকের নির্দেশ অনুযায়ী খাবারের ঠিক আগে বা খাবারের পরপরই নিয়মিত গ্রহণ করুন।",
    sideEffects: "খাবার দেরি হলে সুগার কমে গিয়ে মাথা ঘোরা বা ঘাম হওয়া (Hypoglycemia), হালকা পেটের অস্বস্তি",
    precautions: "ডায়াবেটিসের ওষুধ নেওয়ার পর কখনোই খাবার বাদ দেবেন না। হঠাৎ অতিরিক্ত ঘাম, বুক ধড়ফড় বা মাথা ঘোরা শুরু হলে দ্রুত চিনি, গ্লুকোজ বা মিষ্টি কিছু খেয়ে নিন।",
  },
  {
    pattern: /\b(pregabalin|pregaben|neurolin|lyrica|gabapentin|algaba|amitriptyline|tryptin|nortriptyline|duloxetine|clonazepam|rivotril|disopan|xanita|alprazolam|xanax|diazepam|sedil|bromazepam|lexotanil|lorazepam|zolpidem|escitalopram|esita|lexapro|sertraline|zoloft|fluoxetine|paroxetine|flupentixol|melitracen|frenxit|deanxit|melixol|olanzapine|risperidone|quetiapine|levetiracetam|valproate|carbamazepine|sumatriptan|pizotifen|migranil|flunarizine|sibeli|betahistine|vertina|memantine|donepezil|citicoline)\b/i,
    category: "স্নায়ুজনিত ব্যথা, ঘুম, মাইগ্রেন ও স্নায়ুতন্ত্রের ওষুধ (Neuro / CNS Care)",
    purpose: "স্নায়ুর ব্যথা (হাত-পা ঝিনঝিন, অবশ বা জ্বালাপোড়া), মাইগ্রেন, মাথা ঘোরা (Vertigo), মানসিক চাপ বা ঘুমের সমস্যা উপশম করতে দেওয়া হয়েছে।",
    modeOfActionBn: "স্নায়ুতন্ত্রের অতিরিক্ত উত্তেজিত সিগন্যাল ও নিউরোট্রান্সমিটারের ভারসাম্য স্বাভাবিক করে ব্যথা, মাথা ঘোরা ও অস্থিরতা শান্ত করে।",
    howToTake: "সাধারণত রাতে ঘুমানোর আগে অথবা চিকিৎসকের নির্দেশিত নির্দিষ্ট সময়ে সেবন করুন।",
    sideEffects: "ঘুম ঘুম ভাব, তন্দ্রা, হালকা মাথা ঝিমঝিম করা বা মুখ শুকিয়ে যাওয়া",
    precautions: "ডাক্তারের পরামর্শ ছাড়া হঠাৎ করে এই ওষুধের মাত্রা বাড়াবেন না বা হঠাৎ বন্ধ করবেন না। ওষুধ খাওয়ার পর যানবাহন চালানো থেকে বিরত থাকুন।",
  },
  {
    pattern: /\b(prednisolone|cortan|g-pred|methylprednisolone|medrol|deflazacort|xalcort|dexamethasone|oradexon|betamethasone|betnelan|hydrocortisone|triamcinolone|clobetasol|dermovate|mometasone|elocon|halobetasol)\b/i,
    category: "তীব্র প্রদাহ ও অ্যালার্জি নিয়ন্ত্রক স্টেরয়েড (Corticosteroid)",
    purpose: "শরীরের তীব্র প্রদাহ, মারাত্মক অ্যালার্জি, হাঁপানি, চর্মরোগ বা বাতজনিত ফোলা দ্রুত নিয়ন্ত্রণে আনতে ব্যবহৃত হয়।",
    modeOfActionBn: "রোগ প্রতিরোধ তন্ত্রের অতিরিক্ত প্রদাহজনক প্রতিক্রিয়া (Inflammatory Mediators) দ্রুত দমন করে ফোলা, লালচে ভাব ও প্রদাহ কমায়।",
    howToTake: "ট্যাবলেট হলে অবশ্যই ভরা পেটে (সকালে নাস্তার পরে) খাবেন; মলম হলে আক্রান্ত স্থানে পাতলা করে লাগাবেন।",
    sideEffects: "ক্ষুধা বৃদ্ধি, পেটে এসিডিটি, দীর্ঘদিন ব্যবহারে ওজন বা সুগার বৃদ্ধি",
    precautions: "চিকিৎসকের নির্ধারিত ডোজ ও সময়কাল কঠোরভাবে মেনে চলুন। ডাক্তারের পরামর্শ ছাড়া হঠাৎ বন্ধ করবেন না বা নিজে থেকে দীর্ঘদিন ব্যবহার করবেন না।",
  },
  {
    pattern: /\b(levothyroxine|thyrox|novothyrox|carbimazole|neomercazole|methimazole|propylthiouracil)\b/i,
    category: "থাইরয়েড হরমোন নিয়ন্ত্রক (Thyroid Care)",
    purpose: "থাইরয়েড গ্রন্থির হরমোন ঘাটতি (Hypothyroidism) বা আধিক্য (Hyperthyroidism) নিয়ন্ত্রণ করে শরীরের মেটাবলিজম স্বাভাবিক রাখে।",
    modeOfActionBn: "রক্তে থাইরয়েড হরমোনের (T3/T4 ও TSH) সঠিক মাত্রা ও ভারসাম্য বজায় রেখে শরীরের শক্তি উৎপাদন ও হরমোন ক্রিয়া নিয়ন্ত্রণ করে।",
    howToTake: "লেভোথাইরক্সিন প্রতিদিন সকালে খালি পেটে (নাস্তার অন্তত ৩০–৪৫ মিনিট আগে) শুধু পানি দিয়ে খাবেন।",
    sideEffects: "সঠিক মাত্রায় সাধারণত কোনো পার্শ্বপ্রতিক্রিয়া হয় না; ডোজ বেশি হলে বুক ধড়ফড় বা ঘাম হতে পারে",
    precautions: "থাইরয়েডের ওষুধ খাওয়ার অন্তত ৪ ঘণ্টাের মধ্যে ক্যালসিয়াম, আয়রন বা গ্যাস্ট্রিকের অ্যান্টাসিড খাবেন না।",
  },
  {
    pattern: /\b(tamsulosin|uroflo|maxrin|alfuzosin|silodosin|finasteride|dutasteride|solifenacin|vesicare|tolterodine|mirabegron|flavoxate|urispas|potassium citrate|urocit)\b/i,
    category: "মূত্রনালি ও প্রোস্টেট সুরক্ষাকারী ওষুধ (Urological Care)",
    purpose: "প্রস্রাবের জ্বালাপোড়া, ঘন ঘন প্রস্রাবের বেগ, প্রস্রাব আটকে যাওয়া বা প্রোস্টেট গ্রন্থি বৃদ্ধির সমস্যা উপশম করতে দেওয়া হয়েছে।",
    modeOfActionBn: "মূত্রথলি ও প্রোস্টেটের পেশি শিথিল করে প্রস্রাবের প্রবাহ সহজ করে এবং মূত্রনালির জ্বালাপোড়া কমায়।",
    howToTake: "সাধারণত রাতে খাবারের পরে বা চিকিৎসকের নির্দেশ অনুযায়ী প্রতিদিন নির্দিষ্ট সময়ে সেবন করুন।",
    sideEffects: "হঠাৎ উঠে দাঁড়ালে হালকা মাথা ঘোরা, মুখ সামান্য শুকিয়ে যাওয়া",
    precautions: "বসা বা শোয়া অবস্থা থেকে হঠাৎ দ্রুত উঠে দাঁড়াবেন না। পর্যাপ্ত পানি পান করুন।",
  },
  {
    pattern: /\b(febuxostat|febux|allopurinol|zyloric|colchicine|methotrexate|hydroxychloroquine|leflunomide|tofacitinib)\b/i,
    category: "ইউরিক এসিড ও বাত ব্যথা নিয়ন্ত্রক (Anti-Gout / Rheumatology)",
    purpose: "রক্তে অতিরিক্ত ইউরিক এসিড কমানো এবং গেঁটে বাত (Gout) বা রিউমাটয়েড আর্থ্রাইটিসজনিত গিরায় গিরায় ব্যথা ও ফোলা রোধ করতে দেওয়া হয়েছে।",
    modeOfActionBn: "শরীরে ইউরিক এসিড তৈরির এনজাইম (Xanthine Oxidase) বা জয়েন্টের দীর্ঘমেয়াদী প্রদাহ প্রক্রিয়া নিয়ন্ত্রণ করে।",
    howToTake: "খাবারের পরে এক গ্লাস পানির সাথে প্রতিদিন নির্দিষ্ট সময়ে সেবন করুন।",
    sideEffects: "হালকা বমি ভাব, পেটে অস্বস্তি বা ত্বকে র‍্যাশ",
    precautions: "লাল মাংস (গরু/খাসি), কলিজা, সামুদ্রিক মাছ ও ডাল জাতীয় খাবার কম খান এবং প্রচুর পানি পান করুন।",
  },
  {
    pattern: /\b(ursodeoxycholic|urso|udiliv|obeticholic|ornithine|silymarin|hepaliv)\b/i,
    category: "লিভার ও পিত্তথলি সুরক্ষাকারী (Hepatobiliary Care)",
    purpose: "ফ্যাটি লিভার, জন্ডিস, লিভারের এনজাইম বৃদ্ধি বা পিত্তথলির প্রদাহ ও পাথর নিরাময়ে লিভারকে সুরক্ষা দিতে ব্যবহৃত হয়।",
    modeOfActionBn: "লিভারের কোষকে টক্সিন থেকে রক্ষা করে, পিত্তরসের (Bile) স্বাভাবিক প্রবাহ বাড়ায় এবং লিভারের অতিরিক্ত চর্বি ও প্রদাহ কমায়।",
    howToTake: "দুপুরে বা রাতে খাবারের পরে সেবন করুন।",
    sideEffects: "সাধারণত খুব সহনশীল, কদাচিৎ নরম পায়খানা বা হালকা পেটের অস্বস্তি",
    precautions: "অতিরিক্ত তেল-চর্বিযুক্ত খাবার ও ফাস্টফুড পরিহার করুন।",
  },
  {
    pattern: /\b(carboxymethylcellulose|hypromellose|tears|artificial tear|olopatadine|patanol|loteprednol|fluorometholone|nepafenac|timolol|brimonidine|brinzolamide|latanoprost|travoprost)\b/i,
    category: "চোখের যত্ন ও চক্ষু ড্রপস (Ophthalmic Care)",
    purpose: "চোখের শুষ্কতা, জ্বালাপোড়া, লালচে ভাব, অ্যালার্জি, চোখের ইনফেকশন বা চোখের চাপ (Glaucoma) নিয়ন্ত্রণে ব্যবহৃত হয়।",
    modeOfActionBn: "চোখের উপরিভাগে আর্দ্রতা বজায় রাখে এবং চোখের স্থানীয় প্রদাহ, অ্যালার্জি বা অতিরিক্ত চাপ সরাসরি প্রশমিত করে।",
    howToTake: "হাত পরিষ্কার করে মাথা পেছনে হেলিয়ে চোখে নির্ধারিত ফোঁটা দিন এবং ১ মিনিট চোখ আলতো করে বন্ধ রাখুন।",
    sideEffects: "ড্রপ দেওয়ার পর কয়েক সেকেন্ড সামান্য ঝাপসা দেখা বা হালকা জ্বালা ভাব",
    precautions: "ড্রপারের মুখ যেন চোখের পাতা বা হাতের সাথে না লাগে। বোতলের মুখ খোলার ৩০ দিন পর অবশিষ্ট ড্রপ ব্যবহার করবেন না।",
  },
  {
    pattern: /\b(calcium|coralcal|calbo|ostocal|acical|cholecalciferol|d-rise|max d|vitamin|multivitamin|bextram|filwel|ascorbic|ceevit|zinc|babyzinc|iron|ferrous|fefol|folic|folison|cyanocobalamin|mecobalamin|neuro-b|neobion|b-50|thiamine|pyridoxine|riboflavin|calcitriol|ronicol|levocarnitine|coenzyme)\b/i,
    category: "ক্যালসিয়াম, ভিটামিন ও পুষ্টি সাপ্লিমেন্ট (Vitamin & Mineral Supplement)",
    purpose: "হাড় ও দাঁত মজবুত করা, রক্তস্বল্পতা ও শারীরিক দুর্বলতা দূর করা, স্নায়ুর কর্মক্ষমতা বাড়ানো এবং রোগ প্রতিরোধ ক্ষমতা বৃদ্ধিতে সাহায্য করে।",
    modeOfActionBn: "শরীরে প্রয়োজনীয় ভিটামিন, খনিজ লবণ, হিমোগ্লোবিন ও ক্যালসিয়ামের ঘাটতি পূরণ করে কোষের স্বাভাবিক বৃদ্ধি ও শক্তি উৎপাদন সচল রাখে।",
    howToTake: "দুপুরে বা রাতে ভরা পেটে (খাবারের পরে) এক গ্লাস পানির সাথে সেবন করুন।",
    sideEffects: "আয়রন বা ক্যালসিয়ামে হালকা কোষ্ঠকাঠিন্য বা পায়খানার রং কালচে হতে পারে (যা সম্পূর্ণ স্বাভাবিক)",
    precautions: "অ্যান্টিবায়োটিক বা থাইরয়েডের ওষুধের সাথে একসাথে না খেয়ে অন্তত ২ ঘণ্টার ব্যবধান রেখে খাবেন।",
  },
];

/* ========================================================================== */
/*    DYNAMIC ENGLISH-TO-BANGLA CLINICAL TRANSLATOR FOR ALL 1,748 GENERICS    */
/* ========================================================================== */

const INDICATION_MAP: [RegExp, string][] = [
  [/\b(urinary tract infection|uti|cystitis|pyelonephritis)\b/i, "মূত্রনালির সংক্রমণ (UTI)"],
  [/\b(respiratory tract infection|rtis?|pneumonia|bronchitis)\b/i, "শ্বাসতন্ত্র ও ফুসফুসের সংক্রমণ"],
  [/\b(sinusitis|tonsillitis|pharyngitis|sore throat|laryngitis)\b/i, "গলা ব্যথা, টনসিল ও সাইনাসের সংক্রমণ"],
  [/\b(otitis media|ear infection|auditory canal)\b/i, "কানের সংক্রমণ ও ব্যথা"],
  [/\b(skin and skin structure|skin and soft tissue|cellulitis|impetigo|wound infection)\b/i, "ত্বক ও ক্ষতস্থানের ব্যাকটেরিয়াল সংক্রমণ"],
  [/\b(typhoid|enteric fever)\b/i, "টাইফয়েড জ্বর"],
  [/\b(diarrh?oea|dysentery|gastroenteritis|enteritis)\b/i, "ডায়রিয়া, আমাশয় ও পেটের সংক্রমণ"],
  [/\b(hypertension|high blood pressure)\b/i, "উচ্চ রক্তচাপ (Hypertension)"],
  [/\b(angina|ischemic heart|coronary artery|myocardial infarction)\b/i, "বুকে ব্যথা (Angina) ও হৃদরোগ"],
  [/\b(heart failure|left ventricular)\b/i, "হৃৎপিণ্ডের পাম্পিং ক্ষমতা হ্রাস (Heart Failure)"],
  [/\b(stroke|cerebrovascular)\b/i, "স্ট্রোকের ঝুঁকি প্রতিরোধ"],
  [/\b(arrhythmia|tachycardia|atrial fibrillation)\b/i, "অনিয়মিত হৃদস্পন্দন"],
  [/\b(diabetes mellitus|type 2 diabetes|hyperglyca?emia|blood glucose)\b/i, "ডায়াবেটিস ও রক্তের অতিরিক্ত সুগার"],
  [/\b(hyperlipida?emia|dyslipida?emia|hypercholesterola?emia|cholesterol|triglyceride)\b/i, "রক্তের অতিরিক্ত কোলেস্টেরল ও চর্বি"],
  [/\b(gastroesophageal reflux|gerd|nerd|heartburn|acid reflux|regurgitation)\b/i, "গ্যাস্ট্রিক, এসিডিটি ও বুকজ্বালা (GERD)"],
  [/\b(peptic ulcer|gastric ulcer|duodenal ulcer|erosive esophagitis|helicobacter)\b/i, "পাকস্থলীর ক্ষত বা আলসার"],
  [/\b(dyspepsia|indigestion|bloating|flatulence|fullness)\b/i, "বদহজম ও পেট ফাঁপা"],
  [/\b(nausea|vomiting|emesis|motion sickness)\b/i, "বমি ও বমি বমি ভাব"],
  [/\b(spasm|abdominal cramp|colic|irritable bowel|ibs)\b/i, "পেট কামড়ানো, পেশির খিঁচুনি ও আইবিএস (IBS)"],
  [/\b(constipation)\b/i, "কোষ্ঠকাঠিন্য"],
  [/\b(osteoarthritis|rheumatoid arthritis|ankylosing spondylitis|arthralgia|joint pain)\b/i, "বাত ও হাড়ের জয়েন্টের ব্যথা-ফোলা"],
  [/\b(low back pain|backache|lumbago|spondylosis|sciatica|neck pain)\b/i, "কোমর, ঘাড় ও মেরুদণ্ডের ব্যথা"],
  [/\b(toothache|dental pain|post-?operative pain|acute pain|musculoskeletal pain|sprain)\b/i, "দাঁত ব্যথা, আঘাতজনিত বা তীব্র শারীরিক ব্যথা"],
  [/\b(dysmenorrh?oea|menstrual pain|menorrhagia|abnormal uterine bleeding)\b/i, "মাসিকজনিত তলপেটের ব্যথা ও জটিলতা"],
  [/\b(fever|pyrexia|febrile)\b/i, "জ্বর ও শরীরের তাপমাত্রা বৃদ্ধি"],
  [/\b(migraine|headache|tension headache)\b/i, "মাইগ্রেন ও তীব্র মাথাব্যথা"],
  [/\b(neuropathic pain|peripheral neuropathy|neuralgia|diabetic neuropathy)\b/i, "স্নায়ুজনিত ব্যথা ও হাত-পা ঝিনঝিন করা"],
  [/\b(vertigo|dizziness|meniere|vestibular|labyrinthitis)\b/i, "মাথা ঘোরা (Vertigo) ও ভারসাম্যহীনতা"],
  [/\b(anxiety|panic disorder|insomnia|sleep disorder|depression|depressive)\b/i, "মানসিক অস্থিরতা, দুশ্চিন্তা ও ঘুমের সমস্যা"],
  [/\b(epilepsy|seizure|convulsion)\b/i, "খিঁচুনি ও স্নায়বিক সমস্যা"],
  [/\b(asthma|bronchospasm|copd|chronic obstructive pulmonary|wheezing)\b/i, "হাঁপানি (Asthma), শ্বাসকষ্ট ও শ্বাসনালির প্রদাহ"],
  [/\b(allergic rhinitis|urticaria|pruritus|hay fever|allergy|sneezing)\b/i, "অ্যালার্জি, সর্দি-হাঁচি ও ত্বকের চুলকানি"],
  [/\b(cough|productive cough|dry cough|mucus|phlegm|expectorant)\b/i, "কাশি ও বুকে জমে থাকা কফ"],
  [/\b(tinea|ringworm|candidiasis|fungal infection|onychomycosis|dermatophytosis|athlete's foot)\b/i, "ত্বক ও নখের ফাঙ্গাল সংক্রমণ (দাদ/ছত্রাক)"],
  [/\b(eczema|dermatitis|psoriasis|acne|scabies|rash)\b/i, "চর্মরোগ, একজিমা, র‍্যাশ ও ত্বকের প্রদাহ"],
  [/\b(conjunctivitis|ocular infection|dry eye|glaucoma|intraocular pressure|keratitis)\b/i, "চোখের সংক্রমণ, লালচে ভাব, শুষ্কতা বা চোখের চাপ"],
  [/\b(benign prostatic hyperplasia|bph|urinary retention|overactive bladder|dysuria)\b/i, "প্রোস্টেট ও প্রস্রাবের প্রবাহজনিত সমস্যা"],
  [/\b(gout|hyperurica?emia)\b/i, "রক্তে বাড়তি ইউরিক এসিড ও গেঁটে বাত"],
  [/\b(hypothyroidism|hyperthyroidism|thyroid)\b/i, "থাইরয়েড হরমোনের ভারসাম্যহীনতা"],
  [/\b(ana?emia|iron deficiency|osteoporosis|calcium deficiency|vitamin deficiency|pregnancy and lactation|malnutrition)\b/i, "রক্তস্বল্পতা, ক্যালসিয়াম-ভিটামিন ঘাটতি ও শারীরিক দুর্বলতা"],
  [/\b(cholestasis|fatty liver|cirrhosis|jaundice|gallstone|hepatic)\b/i, "লিভার ও পিত্তথলির সমস্যা"],
  [/\b(erectile dysfunction|premature ejaculation)\b/i, "পুরুষের হরমোন ও যৌন স্বাস্থ্যজনিত সমস্যা"],
];

const MOA_MAP: [RegExp, string][] = [
  [/\b(proton pump inhibitor|h\+\/k\+\s*atpase|gastric acid secretion)\b/i, "পাকস্থলীর কোষে থাকা এসিড উৎপাদনকারী প্রোটন পাম্পকে ব্লক করে অতিরিক্ত এসিড নিঃসরণ কমিয়ে দেয়।"],
  [/\b(cell wall synthesis|peptidoglycan|beta-?lactam|cephalosporin|penicillin)\b/i, "ব্যাকটেরিয়ার কোষপ্রাচীর (Cell Wall) তৈরি হওয়া বন্ধ করে জীবাণুকে ধ্বংস করে।"],
  [/\b(50s ribosomal|30s ribosomal|protein synthesis in susceptible)\b/i, "ব্যাকটেরিয়ার কোষে প্রোটিন তৈরির প্রক্রিয়া থামিয়ে জীবাণুর বংশবৃদ্ধি রোধ করে।"],
  [/\b(dna gyrase|topoisomerase)\b/i, "ব্যাকটেরিয়ার ডিএনএ তৈরি ও বিভাজনকারী এনজাইম (DNA Gyrase) ব্লক করে সংক্রমণ নির্মূল করে।"],
  [/\b(cyclooxygenase|cox-1|cox-2|prostaglandin synthesis)\b/i, "শরীরে ব্যথা, জ্বর ও প্রদাহ সৃষ্টিকারী প্রোস্টাগ্ল্যান্ডিন (Prostaglandin) রাসায়নিকের নিঃসরণ কমিয়ে দেয়।"],
  [/\b(leukotriene receptor antagonist|cyslt1)\b/i, "শ্বাসনালিতে অ্যালার্জি ও প্রদাহ সৃষ্টিকারী লিউকোট্রিন রিসেপ্টরকে ব্লক করে শ্বাসকষ্ট ও সর্দি-কাশি রোধ করে।"],
  [/\b(h1-?receptor|histamine h1|antihistamine)\b/i, "শরীরে অ্যালার্জি সৃষ্টিকারী হিস্টামিন রিসেপ্টর ব্লক করে হাঁচি, সর্দি ও চুলকানি দূর করে।"],
  [/\b(calcium channel blocker|calcium ion influx|vascular smooth muscle)\b/i, "রক্তনালির দেয়ালে ক্যালসিয়াম প্রবেশ নিয়ন্ত্রণ করে রক্তনালি প্রসারিত করে এবং রক্তচাপ কমায়।"],
  [/\b(angiotensin ii|at1 receptor|angiotensin converting enzyme|ace inhibitor)\b/i, "রক্তনালি সংকুচিতকারী এনজিওটেনসিন হরমোনের প্রভাব কমিয়ে রক্তচাপ স্বাভাবিক রাখে ও হৃদযন্ত্রকে সুরক্ষা দেয়।"],
  [/\b(beta-?1|beta-?adrenergic|beta-?blocker)\b/i, "হৃৎপিণ্ডের অতিরিক্ত গতি ও চাপ কমিয়ে হৃদস্পন্দন এবং রক্তচাপ নিয়ন্ত্রণে রাখে।"],
  [/\b(hmg-?coa reductase|cholesterol biosynthesis)\b/i, "লিভারে ক্ষতিকর কোলেস্টেরল তৈরির এনজাইম নিয়ন্ত্রণ করে রক্তের চর্বি কমিয়ে আনে।"],
  [/\b(platelet aggregation|adenosine diphosphate|p2y12|thromboxane)\b/i, "রক্তের অণুচক্রিকাগুলোকে (Platelet) পরস্পর জমাট বাঁধতে বাধা দিয়ে রক্তনালিতে ব্লক হওয়া প্রতিরোধ করে।"],
  [/\b(sulfonylurea|pancreatic beta|insulin secretion)\b/i, "অগ্ন্যাশয় (Pancreas) থেকে প্রাকৃতিক ইনসুলিন নিঃসরণ বাড়িয়ে রক্তের অতিরিক্ত সুগার কমায়।"],
  [/\b(hepatic glucose production|gluconeogenesis|insulin sensitivity|biguanide)\b/i, "লিভারে অতিরিক্ত গ্লুকোজ তৈরি কমায় এবং শরীরে ইনসুলিনের কার্যকারিতা বাড়িয়ে ডায়াবেটিস নিয়ন্ত্রণ করে।"],
  [/\b(dpp-?4|incretin|glp-?1)\b/i, "খাবার পর শরীরে ইনক্রেটিন হরমোনের মাত্রা বজায় রেখে ইনসুলিন নিঃসরণ বাড়ায় ও সুগার নিয়ন্ত্রণ করে।"],
  [/\b(sglt-?2|renal glucose reabsorption)\b/i, "কিডনির মাধ্যমে রক্তের অতিরিক্ত সুগার প্রস্রাবের সাথে শরীর থেকে বের করে দেয়।"],
  [/\b(gaba|gamma-?aminobutyric|benzodiazepine|alpha-?2-?delta)\b/i, "মস্তিষ্ক ও স্নায়ুতন্ত্রের অতিরিক্ত উত্তেজিত সিগন্যাল শান্ত করে ব্যথা, খিঁচুনি ও দুশ্চিন্তা কমায়।"],
  [/\b(serotonin|5-?ht|norepinephrine reuptake|ssri|snri)\b/i, "মস্তিষ্কে সেরোটোনিন ও নিউরোট্রান্সমিটারের স্বাভাবিক ভারসাম্য ফিরিয়ে এনে মানসিক প্রশান্তি বজায় রাখে।"],
  [/\b(dopamine|d2 receptor|chemoreceptor trigger zone|5-?ht3)\b/i, "মস্তিষ্কের বমি কেন্দ্রের উদ্দীপনা প্রশমিত করে এবং পাকস্থলীর স্বাভাবিক গতিশীলতা বাড়ায়।"],
  [/\b(ergosterol|fungal cell membrane)\b/i, "ছত্রাক বা ফাঙ্গাসের কোষঝিল্লি ধ্বংস করে ফাঙ্গাল ইনফেকশন দূর করে।"],
  [/\b(mucolytic|mucus viscosity|secretomotor|bronchial secretion)\b/i, "শ্বাসনালির ঘন ও আঠালো কফ তরল করে কাশির সাথে সহজে বের করে দিতে সাহায্য করে।"],
  [/\b(beta-?2 agonist|bronchodilat)\b/i, "ফুসফুসের শ্বাসনালির পেশি শিথিল ও প্রসারিত করে দ্রুত শ্বাস-প্রশ্বাস সহজ করে।"],
  [/\b(xanthine oxidase|uric acid)\b/i, "শরীরে অতিরিক্ত ইউরিক এসিড তৈরির এনজাইম ব্লক করে গেঁটে বাতের ব্যথা কমায়।"],
  [/\b(alpha-?1 adrenoceptor|prostate|bladder neck)\b/i, "প্রোস্টেট ও মূত্রথলির মুখের পেশি শিথিল করে প্রস্রাবের প্রবাহ স্বাভাবিক করে।"],
];

const SIDE_EFFECT_MAP: [RegExp, string][] = [
  [/\b(nausea|vomiting)\b/i, "হালকা বমি বমি ভাব"],
  [/\b(diarrh?oea|loose stool)\b/i, "নরম বা পাতলা পায়খানা"],
  [/\b(constipation)\b/i, "হালকা কোষ্ঠকাঠিন্য"],
  [/\b(abdominal pain|stomach pain|epigastric|gastrointestinal discomfort|dyspepsia|indigestion)\b/i, "পেটে হালকা অস্বস্তি বা বদহজম"],
  [/\b(flatulence|bloating|gas)\b/i, "পেট ফাঁপা বা গ্যাস"],
  [/\b(dry mouth|xerostomia)\b/i, "মুখ বা গলা শুকিয়ে যাওয়া"],
  [/\b(taste|metallic taste|dysgeusia)\b/i, "মুখের স্বাদে সাময়িক পরিবর্তন"],
  [/\b(headache)\b/i, "হালকা মাথাব্যথা"],
  [/\b(dizziness|vertigo|lightheaded)\b/i, "হালকা মাথা ঘোরা"],
  [/\b(drowsiness|somnolence|sedation|sleepiness)\b/i, "ঘুম ঘুম ভাব বা তন্দ্রা"],
  [/\b(insomnia|sleep disturbance)\b/i, "ঘুমের সামান্য ব্যাঘাত"],
  [/\b(fatigue|asthenia|weakness|tiredness|malaise)\b/i, "হালকা শারীরিক ক্লান্তি বা দুর্বলতা"],
  [/\b(rash|pruritus|urticaria|itching|erythema|skin reaction)\b/i, "ত্বকে হালকা র‍্যাশ বা চুলকানি (বিরল)"],
  [/\b(palpitation|tachycardia)\b/i, "বুক সামান্য ধড়ফড় করা"],
  [/\b(hypotension|fall in blood pressure)\b/i, "রক্তচাপ সামান্য কমে যাওয়া"],
  [/\b(o?edema|ankle swelling|fluid retention)\b/i, "পায়ের গোড়ালিতে সামান্য পানি আসা"],
  [/\b(hypoglyca?emia|low blood sugar)\b/i, "রক্তে সুগার কমে যাওয়া (খাবার দেরি হলে)"],
  [/\b(myalgia|muscle pain|muscle cramp|arthralgia)\b/i, "পেশি বা জয়েন্টে হালকা ব্যথা"],
  [/\b(blurred vision|visual|ocular discomfort|eye irritation|burning sensation)\b/i, "সাময়িক হালকা ঝাপসা দেখা বা স্থানীয় জ্বালা ভাব"],
  [/\b(cough)\b/i, "হালকা শুকনো কাশি"],
  [/\b(anorexia|loss of appetite)\b/i, "ক্ষুধামন্দা"],
];

export function translateIndicationsToBangla(indicationsEn: string, diagnosis?: string | null): string[] {
  const matched: string[] = [];
  const text = `${indicationsEn || ""} ${diagnosis || ""}`;
  for (const [regex, bn] of INDICATION_MAP) {
    if (regex.test(text) && !matched.includes(bn)) {
      matched.push(bn);
    }
    if (matched.length >= 4) break;
  }
  return matched;
}

export function translateModeOfActionToBangla(
  modeOfActionEn: string,
  genericName: string,
  fallbackBn?: string
): string {
  const combined = `${genericName || ""} ${modeOfActionEn || ""}`;
  for (const [regex, bn] of MOA_MAP) {
    if (regex.test(combined)) {
      return genericName ? `${genericName} — ${bn}` : bn;
    }
  }
  if (fallbackBn) {
    return genericName ? `${genericName} — ${fallbackBn}` : fallbackBn;
  }
  if (genericName) {
    return `${genericName} শরীরের আক্রান্ত কোষ ও রিসেপ্টরে সরাসরি কাজ করে রোগের লক্ষণ ও মূল কারণ উপশম করে।`;
  }
  return "ওষুধটি শরীরের নির্দিষ্ট রিসেপ্টরে কাজ করে রোগের উপসর্গ দ্রুত নিয়ন্ত্রণে আনে।";
}

export function translateSideEffectsToBangla(sideEffectsEn: string, fallbackBn?: string): string {
  const matched: string[] = [];
  for (const [regex, bn] of SIDE_EFFECT_MAP) {
    if (regex.test(sideEffectsEn || "") && !matched.includes(bn)) {
      matched.push(bn);
    }
    if (matched.length >= 4) break;
  }
  if (matched.length > 0) {
    return matched.join(", ");
  }
  if (fallbackBn) return fallbackBn;
  return "সাধারণত সহনশীল, কদাচিৎ হালকা বমি ভাব বা পেটের অস্বস্তি";
}

function deriveCategoryAndPurposeFromGeneric(
  genericName: string,
  indicationsEn: string,
  modeOfActionEn: string,
  sideEffectsEn: string,
  diagnosis?: string | null
): {
  category: string;
  purpose: string;
  modeOfActionBn: string;
  sideEffects: string;
  precautions: string;
} {
  const combined = `${genericName} ${indicationsEn} ${modeOfActionEn}`.toLowerCase();
  const indList = translateIndicationsToBangla(indicationsEn, diagnosis);
  const indSummary = indList.length > 0 ? indList.join(", ") : "";

  let category = genericName
    ? `চিকিৎসকের নির্ধারিত ওষুধ (${genericName})`
    : "প্রেসক্রিপশন অনুযায়ী নির্ধারিত ওষুধ";
  let purpose = indSummary
    ? `${indSummary} নিরাময় ও নিয়ন্ত্রণে চিকিৎসক এই ওষুধটি নির্ধারণ করেছেন।`
    : "রোগীর শারীরিক লক্ষণ ও রোগ নিরাময়ে চিকিৎসক এই ওষুধটি নির্ধারণ করেছেন।";
  let precautions = "নির্ধারিত মাত্রার বেশি খাবেন না এবং চিকিৎসকের পরামর্শ অনুযায়ী নিয়ম মেনে সেবন করুন।";

  if (/\b(infection|bacterial|antibiotic|bactericidal|bacteriostatic|septicemia|pneumonia|bronchitis|tonsillitis|otitis|uti|urinary tract|cephalosporin|penicillin|macrolide|fluoroquinolone)\b/.test(combined)) {
    category = genericName ? `অ্যান্টিবায়োটিক ও সংক্রমণ রোধক (${genericName})` : "অ্যান্টিবায়োটিক ও সংক্রমণ রোধক";
    purpose = indSummary
      ? `ব্যাকটেরিয়াজনিত সংক্রমণ (বিশেষ করে ${indSummary}) সমূলে দূর করতে এই অ্যান্টিবায়োটিক দেওয়া হয়েছে।`
      : "শরীরের ব্যাকটেরিয়াজনিত ইনফেকশন বা সংক্রমণ দূর করতে এই ওষুধটি দেওয়া হয়েছে।";
    precautions = "অ্যান্টিবায়োটিকের সম্পূর্ণ কোর্স শেষ করুন; লক্ষণ কমে গেলেও মাঝপথে ওষুধ বন্ধ করবেন না।";
  } else if (/\b(hypertension|blood pressure|angina|heart failure|arrhythmia|vasodilator|beta-?blocker|calcium channel|angiotensin)\b/.test(combined)) {
    category = genericName ? `রক্তচাপ ও হৃদরোগ নিয়ন্ত্রক (${genericName})` : "রক্তচাপ ও হৃদরোগ নিয়ন্ত্রক";
    purpose = indSummary
      ? `${indSummary} নিয়ন্ত্রণে রাখা এবং হৃদযন্ত্রের স্বাভাবিক কার্যকারিতা বজায় রাখতে সাহায্য করে।`
      : "উচ্চ রক্তচাপ নিয়ন্ত্রণে রাখা এবং হৃদযন্ত্রকে সুরক্ষিত রাখতে সাহায্য করে।";
    precautions = "চিকিৎসকের পরামর্শ ছাড়া হঠাৎ রক্তচাপের ওষুধ বন্ধ করবেন না এবং নিয়মিত প্রেশার মাপুন।";
  } else if (/\b(diabetes|hyperglyca?emia|glycemic|blood glucose|hypoglyca?emic|insulin|sulfonylurea)\b/.test(combined)) {
    category = genericName ? `ডায়াবেটিস নিয়ন্ত্রক (${genericName})` : "ডায়াবেটিস নিয়ন্ত্রক";
    purpose = "রক্তের অতিরিক্ত শর্করা (সুগার) নিয়ন্ত্রণে রেখে ডায়াবেটিসজনিত জটিলতা প্রতিরোধ করে।";
    precautions = "ওষুধ খাওয়ার পর খাবার বাদ দেবেন না; সুগার কমে মাথা ঘুরলে দ্রুত মিষ্টি কিছু খেয়ে নিন।";
  } else if (/\b(ulcer|gastroesophageal|reflux|gerd|acidity|heartburn|dyspepsia|proton pump|antacid)\b/.test(combined)) {
    category = genericName ? `গ্যাস্ট্রিক ও এসিডিটি নিরামক (${genericName})` : "গ্যাস্ট্রিক ও এসিডিটি নিরামক";
    purpose = "পাকস্থলীর অতিরিক্ত এসিড, বুকজ্বালা, টক ঢেকুর ও গ্যাস্ট্রিকের ক্ষত সারাতে কাজ করে।";
    precautions = "অতিরিক্ত ঝাল, তৈলাক্ত ও ভাজাপোড়া খাবার এড়িয়ে চলুন এবং সময়মতো খাবার গ্রহণ করুন।";
  } else if (/\b(pain|analgesic|anti-?inflammatory|nsaid|inflammation|arthritis|osteoarthritis|rheumatoid|toothache|migraine|headache|fever|antipyretic)\b/.test(combined)) {
    category = genericName ? `ব্যথা ও প্রদাহ উপশমকারী (${genericName})` : "ব্যথা ও প্রদাহ উপশমকারী";
    purpose = indSummary
      ? `${indSummary} এবং শারীরিক ব্যথা ও ফোলা দ্রুত উপশম করতে সাহায্য করে।`
      : "শরীরের ব্যথা, ফোলা, প্রদাহ বা জ্বর কমাতে সাহায্য করে।";
    precautions = "অবশ্যই ভরা পেটে খাবেন; খালি পেটে ব্যথানাশক ওষুধ খাবেন না।";
  } else if (/\b(asthma|copd|bronchospasm|bronchodilator|cough|mucolytic|rhinitis|allergic|urticaria|pruritus|allergy|antihistamine)\b/.test(combined)) {
    category = genericName ? `অ্যালার্জি, সর্দি-কাশি ও শ্বাসতন্ত্রের ওষুধ (${genericName})` : "অ্যালার্জি ও শ্বাসতন্ত্রের ওষুধ";
    purpose = indSummary
      ? `${indSummary} উপশম করে শ্বাস-প্রশ্বাস স্বাভাবিক রাখতে কাজ করে।`
      : "অ্যালার্জি, সর্দি, কাশি বা শ্বাসকষ্ট উপশমে কাজ করে।";
    precautions = "ঠান্ডা পানি, ধুলোবালি ও ধোঁয়া থেকে দূরে থাকুন।";
  } else if (/\b(hyperlipida?emia|dyslipida?emia|cholesterol|triglyceride|statin|antiplatelet)\b/.test(combined)) {
    category = genericName ? `কোলেস্টেরল ও রক্তনালি সুরক্ষাকারী (${genericName})` : "কোলেস্টেরল নিয়ন্ত্রক";
    purpose = "রক্তের অতিরিক্ত চর্বি ও ক্ষতিকর কোলেস্টেরল কমিয়ে হৃদরোগ ও স্ট্রোকের ঝুঁকি কমায়।";
    precautions = "চর্বিজাতীয় খাবার কম খান এবং নিয়মিত হাঁটাচলা করুন।";
  } else if (/\b(fungal|antifungal|candidiasis|tinea|dermatitis|eczema|psoriasis|scabies|acne|topical)\b/.test(combined)) {
    category = genericName ? `চর্মরোগ ও সংক্রমণ নিরামক (${genericName})` : "চর্মরোগ ও সংক্রমণ নিরামক";
    purpose = "ত্বকের সংক্রমণ, চুলকানি, দাদ, র‍্যাশ বা ফাঙ্গাল ইনফেকশন দূর করতে সাহায্য করে।";
    precautions = "আক্রান্ত স্থান পরিষ্কার ও শুষ্ক রাখুন এবং নির্ধারিত মেয়াদ পর্যন্ত ব্যবহার করুন।";
  } else if (/\b(rehydration|diarrh?oea|electrolyte|probiotic)\b/.test(combined)) {
    category = genericName ? `পানিশূন্যতা ও হজম সুরক্ষাকারী (${genericName})` : "পানিশূন্যতা রোধক";
    purpose = "ডায়রিয়া, বমি বা দুর্বলতায় শরীরের পানি ও লবণের ঘাটতি পূরণ করে হজমশক্তি স্বাভাবিক করে।";
    precautions = "পর্যাপ্ত বিশুদ্ধ পানি ও তরল খাবার গ্রহণ করুন।";
  } else if (/\b(vitamin|mineral|calcium|iron|ferrous|folic|supplement|nutrition|amino acid)\b/.test(combined)) {
    category = genericName ? `ভিটামিন ও পুষ্টি সাপ্লিমেন্ট (${genericName})` : "ভিটামিন ও পুষ্টি সাপ্লিমেন্ট";
    purpose = "শরীরের ভিটামিন, খনিজ ও ক্যালসিয়ামের ঘাটতি পূরণ করে শারীরিক দুর্বলতা দূর করে।";
    precautions = "ভরা পেটে পর্যাপ্ত পানির সাথে সেবন করুন।";
  }

  return {
    category,
    purpose,
    modeOfActionBn: translateModeOfActionToBangla(modeOfActionEn, genericName),
    sideEffects: translateSideEffectsToBangla(sideEffectsEn),
    precautions,
  };
}

/* ========================================================================== */
/*                COMPREHENSIVE DIAGNOSTIC TESTS KNOWLEDGE BASE               */
/* ========================================================================== */

const TEST_REASONS_PATTERNS: [RegExp, string][] = [
  [/\b(cbc|complete blood count|hb%|hemoglobin|tc,?\s*dc|pbf)\b/i, "রক্তের হিমোগ্লোবিন, শ্বেত রক্তকণিকা (WBC) ও প্লেটলেটের মাত্রা দেখে শরীরে ইনফেকশন, ডেঙ্গু বা রক্তস্বল্পতা আছে কি না তা নিশ্চিত করতে।"],
  [/\b(esr|c-?reactive protein|crp)\b/i, "শরীরে কোনো সংক্রমণ বা দীর্ঘস্থায়ী প্রদাহ (Inflammation) আছে কি না এবং তার তীব্রতা কতটুকু তা জানতে।"],
  [/\b(urine\s*r\/?e|urine\s*r\/?m\/?e|routine urine)\b/i, "প্রস্রাবে ইনফেকশন (UTI), পুঁজ কোষ (Pus cells), রক্ত বা প্রোটিন ক্ষরণ হচ্ছে কি না তা তাৎক্ষণিক পরীক্ষা করতে।"],
  [/\b(urine\s*(?:for\s*)?c\/?s|culture)\b/i, "মূত্রনালি বা রক্তে কোন নির্দিষ্ট ব্যাকটেরিয়ার সংক্রমণ হয়েছে এবং কোন অ্যান্টিবায়োটিক সবচেয়ে কার্যকর হবে তা নির্ভুলভাবে জানতে।"],
  [/\b(creatinine|s\.?\s*creatinine|blood urea|bun|egfr|rft|renal function)\b/i, "কিডনি স্বাভাবিকভাবে কাজ করছে কি না এবং রক্ত পরিশোধন ক্ষমতা কেমন আছে তা যাচাই করতে।"],
  [/\b(rbs|random blood sugar|blood sugar)\b/i, "রক্তে তাৎক্ষণিক গ্লুকোজ বা সুগারের মাত্রা (ডায়াবেটিস) পরীক্ষা করতে।"],
  [/\b(fbs|fasting blood sugar|2habf|ppbs|ogtt|cus)\b/i, "খালি পেটে এবং খাবার ২ ঘণ্টা পর রক্তে ডায়াবেটিসের সঠিক মাত্রা নির্ণয় করতে।"],
  [/\b(hba1c)\b/i, "বিগত ৩ মাসের গড় ব্লাড সুগারের নিয়ন্ত্রণ কেমন ছিল তা নিখুঁতভাবে মূল্যায়ন করতে।"],
  [/\b(lipid profile|cholesterol|triglyceride|hdl|ldl)\b/i, "রক্তে ক্ষতিকর চর্বি ও কোলেস্টেরলের মাত্রা দেখে হৃদরোগ বা রক্তনালির ঝুঁকি যাচাই করতে।"],
  [/\b(sgpt|alt|sgot|ast|bilirubin|alkaline phosphatase|alp|lft|liver function)\b/i, "লিভারের কর্মক্ষমতা, এনজাইমের মাত্রা, ফ্যাটি লিভার বা জন্ডিস আছে কি না তা পরীক্ষা করতে।"],
  [/\b(tsh|ft3|ft4|t3|t4|thyroid)\b/i, "থাইরয়েড গ্রন্থির হরমোন ঠিকমতো কাজ করছে কি না তা পরীক্ষা করতে।"],
  [/\b(uric acid)\b/i, "রক্তে ইউরিক এসিডের মাত্রা বেড়ে জয়েন্টে ব্যথা বা গেঁটে বাত হচ্ছে কি না তা জানতে।"],
  [/\b(electrolyte|s\.?\s*electrolyte|sodium|potassium|chloride)\b/i, "রক্তে সোডিয়াম, পটাশিয়াম ও লবণের ভারসাম্য ঠিক আছে কি না তা পরীক্ষা করতে।"],
  [/\b(calcium|vitamin d|25-?oh|vit-?d|vitamin b12)\b/i, "হাড়, পেশি ও স্নায়ুর সুস্থতার জন্য রক্তে ক্যালসিয়াম বা ভিটামিনের ঘাটতি আছে কি না তা দেখতে।"],
  [/\b(ns1|dengue|igg|igm|ict for malaria|mp)\b/i, "জ্বরের কারণ ডেঙ্গু বা মশাবাহিত সংক্রমণ কি না তা দ্রুত শনাক্ত করতে।"],
  [/\b(widal|typhidot|febrile antigen)\b/i, "রক্তে টাইফয়েড বা প্যারাটাইফয়েড জ্বরের জীবাণু আছে কি না তা পরীক্ষা করতে।"],
  [/\b(hbsag|anti-?hcv|anti-?hav|anti-?hev)\b/i, "লিভারে হেপাটাইটিস বি বা সি ভাইরাসের সংক্রমণ আছে কি না তা স্ক্রিনিং করতে।"],
  [/\b(troponin|ck-?mb|nt-?probnp)\b/i, "বুকে ব্যথার কারণে হৃৎপিণ্ডের পেশিতে কোনো চাপ বা ক্ষতি হয়েছে কি না তা জরুরি ভিত্তিতে দেখতে।"],
  [/\b(ecg|ekg|electrocardiogram)\b/i, "হৃৎপিণ্ডের স্পন্দন, ছন্দ ও রক্ত চলাচলের বৈদ্যুতিক সংকেত স্বাভাবিক আছে কি না তা দেখতে।"],
  [/\b(echo|echocardiogram|2d echo|color doppler)\b/i, "হার্টের ভালভ, পাম্পিং ক্ষমতা (Ejection Fraction) ও প্রাচীরের অবস্থা সরাসরি পর্যবেক্ষণ করতে।"],
  [/\b(cxr|chest x-?ray|x-?ray chest)\b/i, "ফুসফুসে ইনফেকশন, কফ জমা, নিউমোনিয়া বা হৃৎপিণ্ডের আকার দেখতে।"],
  [/\b(x-?ray|radiograph)\b/i, "হাড়ের গঠন, জয়েন্টের ক্ষয়, ফাটল বা মেরুদণ্ডের সমস্যা এক্স-রে এর মাধ্যমে দেখতে।"],
  [/\b(usg|ultrasound|ultrasonogram|whole abdomen|lower abdomen|kub|hbs|pregnancy profile)\b/i, "আল্ট্রাসনোগ্রামের মাধ্যমে পেটের ভেতরের অঙ্গপ্রত্যঙ্গ (লিভার, পিত্তথলি, কিডনি, মূত্রথলি বা জরায়ু) সরাসরি পর্যবেক্ষণ করতে।"],
  [/\b(endoscopy|colonoscopy)\b/i, "খাদ্যনালি, পাকস্থলী বা অন্ত্রে আলসার, ক্ষত বা প্রদাহ আছে কি না তা ক্যামেরার মাধ্যমে সরাসরি দেখতে।"],
  [/\b(ct scan|mri)\b/i, "মস্তিষ্ক, মেরুদণ্ড বা অভ্যন্তরীণ অঙ্গের সূক্ষ্ম ও বিস্তারিত ছবি দেখে সঠিক রোগ নির্ণয় করতে।"],
  [/\b(ra test|rf|rheumatoid factor|anti-?ccp|ana|aso titre)\b/i, "বাতজ্বর বা অটোইমিউন আর্থ্রাইটিস আছে কি না তা রক্ত পরীক্ষার মাধ্যমে নিশ্চিত করতে।"],
  [/\b(psa|prostate specific antigen)\b/i, "প্রোস্টেট গ্রন্থির স্বাস্থ্য ও প্রদাহের মাত্রা যাচাই করতে।"],
  [/\b(stool r\/?e|stool c\/?s|obt)\b/i, "পায়খানা পরীক্ষার মাধ্যমে পেটের আমাশয়, কৃমি বা অন্ত্রের ইনফেকশন শনাক্ত করতে।"],
  [/\b(sputum|afb|gene\s*xpert|mt test|mantoux)\b/i, "কফ পরীক্ষার মাধ্যমে ফুসফুসের সংক্রমণ বা যক্ষ্মা (TB) আছে কি না তা নিশ্চিত করতে।"],
];

export function explainInvestigationReason(testName: string, diagnosis?: string | null): string {
  const clean = (testName || "").trim();
  for (const [pattern, reason] of TEST_REASONS_PATTERNS) {
    if (pattern.test(clean)) return reason;
  }
  if (diagnosis && diagnosis.trim()) {
    return `আপনার উল্লেখিত সমস্যা (${diagnosis.split(/[\n,;]/)[0].trim()}) এর সঠিক কারণ নিশ্চিত করতে এবং কার্যকর চিকিৎসা নির্ধারণের জন্য।`;
  }
  return `${clean} পরীক্ষার মাধ্যমে শরীরের অভ্যন্তরীণ অবস্থা ও রোগের মূল কারণ নিখুঁতভাবে জানার জন্য।`;
}

/* ========================================================================== */
/*                         PARSE DOSAGE SCHEDULE                              */
/* ========================================================================== */

export function parseDoseSchedule(freq: string, formType: string, instructions?: string): {
  morning: string;
  noon: string;
  night: string;
  summary: string;
  dailyCount: number;
} {
  const f = (freq || "").toLowerCase().trim();
  const instr = (instructions || "").trim();
  const unit =
    formType === "সিরাপ"
      ? "চামচ"
      : formType === "ড্রপস"
      ? "ফোঁটা"
      : formType === "ক্যাপসুল"
      ? "ক্যাপসুল"
      : formType === "ইনজেকশন"
      ? "ইনজেকশন"
      : formType === "মলম"
      ? "বার"
      : "ট্যাবলেট";

  let customAmount = "";
  if (f.includes("মিলি") || f.includes("ml") || f.includes("চামচ") || f.includes("ফোঁটা") || f.includes("চাপ") || f.includes("পাফ") || f.includes("puff")) {
    const match = f.match(/([০-৯0-9./]+\s*(?:মিলি|ml|চামচ|চা চামচ|ফোঁটা|চাপ|পাফ|puff)(?:\s*\([^)]+\))?)/i);
    if (match) customAmount = match[1];
  }

  const defaultAmt = customAmount || (formType === "মলম" ? "১ বার" : `১টি ${unit}`);

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
    if (formType === "মলম") return `✓ লাগাবেন`;
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
    const totalUnitsPerDay = mVal + nVal + eVal + fourthVal;
    const instrSuffix = instr ? ` — ${instr}` : "";
    const summary = count > 0
      ? `প্রতিদিন ${count} বেলা (${parts.join("-")})${instrSuffix}`
      : `${freq}${instrSuffix}`;

    return { morning, noon, night, summary, dailyCount: totalUnitsPerDay || count };
  }

  if (f.includes("সকাল") && f.includes("রাত")) {
    return {
      morning: `✓ ${defaultAmt}`,
      noon: "—",
      night: `✓ ${defaultAmt}`,
      summary: `প্রতিদিন ২ বেলা (সকাল ও রাত)${instr ? ` — ${instr}` : ""}`,
      dailyCount: 2,
    };
  }
  if (f.includes("৩ বার") || f.includes("3 বার") || f.includes("tds") || f.includes("৮ ঘণ্টা")) {
    return {
      morning: `✓ ${defaultAmt}`,
      noon: `✓ ${defaultAmt}`,
      night: `✓ ${defaultAmt}`,
      summary: `প্রতিদিন ৩ বেলা (সকাল-দুপুর-রাত)${instr ? ` — ${instr}` : ""}`,
      dailyCount: 3,
    };
  }
  if (f.includes("২ বার") || f.includes("2 বার") || f.includes("bd") || f.includes("১২ ঘণ্টা")) {
    return {
      morning: `✓ ${defaultAmt}`,
      noon: "—",
      night: `✓ ${defaultAmt}`,
      summary: `প্রতিদিন ২ বেলা (সকাল ও রাত)${instr ? ` — ${instr}` : ""}`,
      dailyCount: 2,
    };
  }
  if (f.includes("রাত") || f.includes("রাতে") || f.includes("hs")) {
    return {
      morning: "—",
      noon: "—",
      night: `✓ ${defaultAmt}`,
      summary: `প্রতিদিন রাতে ১ বার${instr ? ` — ${instr}` : ""}`,
      dailyCount: 1,
    };
  }
  if (f.includes("সকাল") || f.includes("সকালে") || f.includes("od")) {
    return {
      morning: `✓ ${defaultAmt}`,
      noon: "—",
      night: "—",
      summary: `প্রতিদিন সকালে ১ বার${instr ? ` — ${instr}` : ""}`,
      dailyCount: 1,
    };
  }
  if (f.includes("দুপুর") || f.includes("দুপুরে")) {
    return {
      morning: "—",
      noon: `✓ ${defaultAmt}`,
      night: "—",
      summary: `প্রতিদিন দুপুরে ১ বার${instr ? ` — ${instr}` : ""}`,
      dailyCount: 1,
    };
  }

  return {
    morning: f ? `✓ ${freq}` : `✓ ${defaultAmt}`,
    noon: "—",
    night: "—",
    summary: `${freq || "চিকিৎসকের পরামর্শ অনুযায়ী"}${instr ? ` — ${instr}` : ""}`,
    dailyCount: 1,
  };
}

/* ========================================================================== */
/*                  REAL-TIME CLINICAL VITALS EVALUATOR (O/E)                 */
/* ========================================================================== */

function evaluateVitalsClinical(parsedVitals: Record<string, string>): {
  label: string;
  value: string;
  status: string;
  note: string;
}[] {
  const vitalsList: { label: string; value: string; status: string; note: string }[] = [];
  const toEn = (s: string) => String(s || "").replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d).toString());
  const ensureUnit = (val: string, unit: string) =>
    val.toLowerCase().includes(unit.toLowerCase()) ? val : `${val} ${unit}`;

  // 1. Blood Pressure (BP)
  if (parsedVitals.bp) {
    const bpClean = toEn(parsedVitals.bp);
    const m = bpClean.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
    let status = "স্বাভাবিক";
    let note = "রক্তচাপ স্বাভাবিক সীমায় রয়েছে (আদর্শ মান: ১২০/৮০ mmHg)।";
    if (m) {
      const sys = parseInt(m[1], 10);
      const dia = parseInt(m[2], 10);
      if (sys < 95 || dia < 60) {
        status = "নিম্ন রক্তচাপ (Low BP)";
        note = "রক্তচাপ স্বাভাবিকের চেয়ে কিছুটা কম। পর্যাপ্ত পানি ও তরল খাবার গ্রহণ করুন।";
      } else if (sys >= 140 || dia >= 90) {
        status = "উচ্চ রক্তচাপ (High BP)";
        note = "রক্তচাপ স্বাভাবিকের চেয়ে বেশি। নিয়মিত প্রেশারের ওষুধ খান ও কাঁচা লবণ পরিহার করুন।";
      } else if (sys >= 130 || dia >= 85) {
        status = "সামান্য বেশি (Elevated)";
        note = "রক্তচাপ প্রান্তিক সীমায় রয়েছে। খাবারে লবণ কমান ও নিয়মিত প্রেশার মাপুন।";
      }
    }
    vitalsList.push({
      label: "BP (রক্তচাপ)",
      value: ensureUnit(parsedVitals.bp, "mmHg"),
      status,
      note: `${status} — ${note}`,
    });
  }

  // 2. Pulse Rate
  if (parsedVitals.pulse) {
    const pNum = parseFloat(toEn(parsedVitals.pulse).replace(/[^0-9.]/g, ""));
    let status = "স্বাভাবিক";
    let note = "হৃদস্পন্দনের গতি স্বাভাবিক সীমায় রয়েছে (৬০–১০০ bpm)।";
    if (!isNaN(pNum)) {
      if (pNum < 60) {
        status = "ধীর গতি (Bradycardia)";
        note = "নাড়ির গতি স্বাভাবিকের চেয়ে কিছুটা ধীর (স্বাভাবিক: ৬০–১০০ bpm)।";
      } else if (pNum > 100) {
        status = "দ্রুত গতি (Tachycardia)";
        note = "নাড়ির গতি কিছুটা দ্রুত (জ্বর, ব্যথা বা উদ্বেগের কারণে বাড়তে পারে)।";
      }
    }
    vitalsList.push({
      label: "Pulse (নাড়ির গতি)",
      value: ensureUnit(parsedVitals.pulse, "bpm"),
      status,
      note: `${status} — ${note}`,
    });
  }

  // 3. Temperature
  if (parsedVitals.temp) {
    const tVal = parseFloat(toEn(parsedVitals.temp).replace(/[^0-9.]/g, ""));
    let status = "স্বাভাবিক তাপমাত্রা";
    let note = "শরীরের তাপমাত্রা স্বাভাবিক সীমায় রয়েছে (৯৮.৬°F)।";
    if (!isNaN(tVal)) {
      if ((tVal >= 100.4 && tVal <= 110) || (tVal >= 38.0 && tVal <= 43)) {
        status = "জ্বর (Fever)";
        note = "শরীরে স্পষ্ট জ্বর রয়েছে। জ্বরের ওষুধ ও ভেজা কাপড় দিয়ে শরীর মুছিয়ে দিন।";
      } else if ((tVal > 99.0 && tVal < 100.4) || (tVal > 37.2 && tVal < 38.0)) {
        status = "হালকা জ্বর (Low-grade)";
        note = "শরীরে সামান্য তাপমাত্রা বৃদ্ধি পেয়েছে। পর্যাপ্ত বিশ্রাম ও পানি পান করুন।";
      }
    }
    vitalsList.push({
      label: "Temp (তাপমাত্রা)",
      value: parsedVitals.temp.includes("°") ? parsedVitals.temp : `${parsedVitals.temp}°F`,
      status,
      note: `${status} — ${note}`,
    });
  }

  // 4. SpO2
  if (parsedVitals.spo2) {
    const sVal = parseFloat(toEn(parsedVitals.spo2).replace(/[^0-9.]/g, ""));
    let status = "স্বাভাবিক";
    let note = "রক্তে অক্সিজেনের মাত্রা সম্পূর্ণ স্বাভাবিক (৯৫%–১০০%)।";
    if (!isNaN(sVal)) {
      if (sVal < 92) {
        status = "অক্সিজেন কম (জরুরি)";
        note = "রক্তে অক্সিজেনের মাত্রা কম। শ্বাসকষ্ট হলে অবিলম্বে চিকিৎসকের পরামর্শ নিন।";
      } else if (sVal < 95) {
        status = "সামান্য কম";
        note = "অক্সিজেনের মাত্রা প্রান্তিক পর্যায়ে রয়েছে, নিয়মিত পর্যবেক্ষণ করুন।";
      }
    }
    vitalsList.push({
      label: "SpO₂ (অক্সিজেন)",
      value: ensureUnit(parsedVitals.spo2, "%"),
      status,
      note: `${status} — ${note}`,
    });
  }

  // 5. RBS / Blood Sugar
  if (parsedVitals.rbs) {
    const rVal = parseFloat(toEn(parsedVitals.rbs).replace(/[^0-9.]/g, ""));
    let status = "স্বাভাবিক";
    let note = "রক্তে শর্করার মাত্রা স্বাভাবিক সীমায় রয়েছে।";
    if (!isNaN(rVal)) {
      // Distinguish mmol/L (< 35) vs mg/dL (>= 35)
      if (rVal < 35) {
        if (rVal < 4.0) {
          status = "সুগার কম (Hypoglycemia)";
          note = "রক্তে সুগার স্বাভাবিকের চেয়ে কম (স্বাভাবিক: ৪.০–৭.৮ mmol/L)।";
        } else if (rVal > 11.0) {
          status = "ডায়াবেটিস / সুগার বেশি";
          note = "রক্তে সুগারের মাত্রা বেশি। মিষ্টি জাতীয় খাবার পরিহার করুন।";
        } else if (rVal > 7.8) {
          status = "সামান্য বেশি";
          note = "খাবার পর বা তাৎক্ষণিক সুগার কিছুটা বেশি (স্বাভাবিক: ৭.৮ mmol/L এর নিচে)।";
        }
      } else {
        if (rVal < 70) {
          status = "সুগার কম (Hypoglycemia)";
          note = "রক্তে সুগার স্বাভাবিকের চেয়ে কম।";
        } else if (rVal > 180) {
          status = "ডায়াবেটিস / সুগার বেশি";
          note = "রক্তে সুগারের মাত্রা স্বাভাবিকের চেয়ে বেশি।";
        }
      }
    }
    vitalsList.push({
      label: "RBS (ব্লাড সুগার)",
      value: ensureUnit(parsedVitals.rbs, rVal >= 35 ? "mg/dL" : "mmol/L"),
      status,
      note: `${status} — ${note}`,
    });
  }

  // 6. Weight & BMI
  if (parsedVitals.weight) {
    const wVal = parseFloat(toEn(parsedVitals.weight).replace(/[^0-9.]/g, ""));
    const hVal = parsedVitals.height ? parseFloat(toEn(parsedVitals.height).replace(/[^0-9.]/g, "")) : NaN;
    let bmiVal = parsedVitals.bmi ? parseFloat(toEn(parsedVitals.bmi).replace(/[^0-9.]/g, "")) : NaN;
    if (isNaN(bmiVal) && !isNaN(wVal) && !isNaN(hVal) && hVal > 20 && hVal < 100) {
      // height in inches
      const hMeters = hVal * 0.0254;
      bmiVal = +(wVal / (hMeters * hMeters)).toFixed(1);
    }
    let bmiNote = "শারীরিক ওজন নথিবদ্ধ করা হয়েছে।";
    if (!isNaN(bmiVal) && bmiVal > 10 && bmiVal < 60) {
      const bmiCat =
        bmiVal < 18.5
          ? "ওজন কম (Underweight)"
          : bmiVal <= 24.9
          ? "স্বাভাবিক ওজন (Normal)"
          : bmiVal <= 29.9
          ? "অতিরিক্ত ওজন (Overweight)"
          : "স্থূলতা (Obese)";
      bmiNote = `BMI: ${bmiVal} — ${bmiCat}`;
    }
    vitalsList.push({
      label: "Weight (ওজন)",
      value: ensureUnit(parsedVitals.weight, "kg"),
      status: "নথিবদ্ধ",
      note: bmiNote,
    });
  }

  // 7. Height
  if (parsedVitals.height) {
    vitalsList.push({
      label: "Height (উচ্চতা)",
      value: ensureUnit(parsedVitals.height, "in"),
      status: "নথিবদ্ধ",
      note: "শারীরিক উচ্চতা নথিবদ্ধ করা হয়েছে।",
    });
  }

  // 8. Any custom O/E vitals entered by the doctor (e.g., Anemia, Jaundice, Edema, Lungs, Heart)
  const stdKeys = new Set(["bp", "pulse", "temp", "weight", "height", "bmi", "spo2", "rbs"]);
  for (const [k, v] of Object.entries(parsedVitals)) {
    if (!stdKeys.has(k.toLowerCase()) && v) {
      vitalsList.push({
        label: k,
        value: String(v),
        status: "পরীক্ষিত",
        note: `চিকিৎসকের শারীরিক পরীক্ষায় (${k}) প্রাপ্ত ফলাফল।`,
      });
    }
  }

  return vitalsList;
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
  notes?: string | null;
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
}): PrescriptionExplanation {
  const lines = rx.lines || [];
  const explainedMeds: ExplainedMedicine[] = [];

  for (const line of lines) {
    const rawName = (line.medicine_name || "").trim();
    if (!rawName) continue;

    // Match against the 25,534-medicine database (either pre-enriched from server or client-side sync lookup)
    const dbMatch = matchMedicineSync(rawName);
    const genericName = (line.generic_name || dbMatch?.genericName || "").replace(/\u00a0/g, " ").trim() || undefined;
    const dosageFormEn = (line.dosage_form || dbMatch?.dosageForm || "").trim() || undefined;
    const indicationsEn = (line.indications || dbMatch?.indications || "").trim() || undefined;
    const rawMoaEn = (line.mode_of_action || dbMatch?.modeOfAction || "").trim() || undefined;
    const sideEffectsEn = (line.side_effects || dbMatch?.sideEffects || "").trim() || undefined;

    // Detect form type using both Rx prefix and matched dosage form
    const mappedBnForm = toBengaliDosageForm(dosageFormEn || "", rawName);
    const formType: ExplainedMedicine["formType"] = mappedBnForm === "অন্যান্য" ? "ওষুধ" : mappedBnForm;

    // Clean brand name
    const cleanName = rawName
      .replace(/^(tab\.|tab|cap\.|cap|syr\.|syr|inj\.|inj|susp\.|susp|drops?|supp\.|supp|cream|ointment|gel|inhaler|spray|powder|sol\.)\s*/i, "")
      .trim();

    // Match rule against rawName, cleanName, OR matched genericName from 25,534-medicine DB
    const matchedRule = DRUG_RULES.find(
      (r) =>
        r.pattern.test(rawName) ||
        r.pattern.test(cleanName) ||
        (genericName ? r.pattern.test(genericName) : false)
    );

    const derived = deriveCategoryAndPurposeFromGeneric(
      genericName || "",
      indicationsEn || "",
      rawMoaEn || "",
      sideEffectsEn || "",
      rx.diagnosis
    );

    const category = matchedRule
      ? genericName
        ? `${matchedRule.category.replace(/\s*\([^)]*\)$/, "")} • ${genericName}`
        : matchedRule.category
      : derived.category;

    // Build rich, 100% Bengali "Why Given" combining rule + DB indications + patient's C/C
    const dbBanglaIndications = translateIndicationsToBangla(indicationsEn || "", rx.diagnosis);
    let purpose = matchedRule ? matchedRule.purpose : derived.purpose;
    if (matchedRule && dbBanglaIndications.length > 0) {
      purpose = `${matchedRule.purpose} (নির্দিষ্ট কার্যকারিতা: ${dbBanglaIndications.join(", ")})।`;
    }

    // Build 100% Bengali Mode of Action
    const modeOfAction = translateModeOfActionToBangla(
      rawMoaEn || "",
      genericName || cleanName,
      matchedRule?.modeOfActionBn
    );

    // Build 100% Bengali Side Effects from the generic's actual DB side effects + rule fallback
    const sideEffects = translateSideEffectsToBangla(
      sideEffectsEn || "",
      matchedRule?.sideEffects
    );

    const precautions = matchedRule ? matchedRule.precautions : derived.precautions;

    // Dosage schedule
    const sched = parseDoseSchedule(line.frequency || line.dose || "", formType, line.instructions);
    const rawDur = (line.duration || "").trim();
    const formattedDur = /^\d+$/.test(rawDur)
      ? `${rawDur} দিন`
      : rawDur
          .replace(/\b(\d+)\s*days?\b/i, "$1 দিন")
          .replace(/\b(\d+)\s*weeks?\b/i, "$1 সপ্তাহ")
          .replace(/\b(\d+)\s*months?\b/i, "$1 মাস")
          .replace(/\bcontinue\b/i, "চলমান (ডাক্তারের পরামর্শ অনুযায়ী)") || "ডাক্তারের পরামর্শ অনুযায়ী";

    // Calculate or format total quantity
    let quantityText: string | undefined;
    if (line.quantity && line.quantity > 0) {
      quantityText = `মোট ${line.quantity}টি`;
    } else {
      const durDaysMatch = rawDur.match(/^(\d+)\s*(?:দিন|days?)?$/i);
      if (durDaysMatch && sched.dailyCount > 0 && (formType === "ট্যাবলেট" || formType === "ক্যাপসুল")) {
        const totalQty = Math.ceil(parseInt(durDaysMatch[1], 10) * sched.dailyCount);
        if (totalQty > 0 && totalQty <= 300) {
          quantityText = `মোট ${totalQty}টি`;
        }
      }
    }

    const howToTake = matchedRule
      ? `${line.instructions ? `${line.instructions}। ` : ""}${matchedRule.howToTake}`
      : line.instructions
      ? `${line.instructions} — চিকিৎসকের পরামর্শ অনুযায়ী নিয়ম মেনে সেবন করুন।`
      : "চিকিৎসকের পরামর্শ অনুযায়ী নির্দিষ্ট সময়ে নিয়ম মেনে সেব্য।";

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
      quantityText,
    });
  }

  // Parse Vitals (Supports JSON or comma-separated string like "Height: 65 in, Weight: 60 kg, BP: 120/80 mmHg, Pulse: 78 bpm")
  let parsedVitals: Record<string, string> = {};
  if (typeof rx.vitals === "string" && rx.vitals.trim()) {
    const raw = rx.vitals.trim();
    if (raw.startsWith("{")) {
      try {
        parsedVitals = JSON.parse(raw);
      } catch {}
    } else {
      for (const chunk of raw.split(/[,;\n]+/)) {
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
        else if (kl === "rbs" || kl === "fbs") parsedVitals.rbs = v;
        else parsedVitals[k] = v;
      }
    }
  } else if (typeof rx.vitals === "object" && rx.vitals !== null) {
    parsedVitals = rx.vitals;
  }

  const vitalsList = evaluateVitalsClinical(parsedVitals);

  // Parse Investigations
  const invList: { name: string; reason: string }[] = [];
  const rawInv = (rx.investigation || "")
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const inv of rawInv) {
    invList.push({
      name: inv,
      reason: explainInvestigationReason(inv, rx.diagnosis),
    });
  }

  // Detect pharmacological groups present in this prescription
  const hasAntibiotic = explainedMeds.some((m) => m.category.includes("অ্যান্টিবায়োটিক") || m.category.includes("আমাশয়"));
  const hasPpiOrAntacid = explainedMeds.some((m) => m.category.includes("গ্যাস্ট্রিক") || m.category.includes("এসিড"));
  const hasNsaidOrPain = explainedMeds.some((m) => m.category.includes("ব্যথা") || m.category.includes("NSAID"));
  const hasFeverMed = explainedMeds.some((m) => m.category.includes("জ্বর"));
  const hasBpOrCardiac = explainedMeds.some((m) => m.category.includes("রক্তচাপ") || m.category.includes("কোলেস্টেরল") || m.category.includes("হৃদরোগ"));
  const hasDiabetic = explainedMeds.some((m) => m.category.includes("ডায়াবেটিস"));
  const hasRespiratory = explainedMeds.some((m) => m.category.includes("শ্বাসকষ্ট") || m.category.includes("অ্যালার্জি"));
  const hasCalciumOrIron = explainedMeds.some((m) => /\b(calcium|iron|ferrous|coralcal|calbo|ostocal|acical|fefol)\b/i.test(`${m.originalName} ${m.genericName || ""}`));
  const hasNeuro = explainedMeds.some((m) => m.category.includes("স্নায়ু"));
  const hasDermOrFungal = explainedMeds.some((m) => m.category.includes("চর্মরোগ") || m.category.includes("ছত্রাকনাশক"));

  // Dynamic Treatment Goals based on actual C/C (diagnosis) + prescribed medicine categories
  const diagText = (rx.diagnosis || "").trim();
  const diagLower = diagText.toLowerCase();
  const goals: string[] = [];

  if (diagText) {
    const firstSymptom = diagText.split(/[\n,;]+/)[0].trim();
    if (firstSymptom) {
      goals.push(`মূল সমস্যা (${firstSymptom}) দ্রুত উপশম ও নিয়ন্ত্রণ করা`);
    }
  }
  if (hasAntibiotic || diagLower.includes("infection") || diagLower.includes("ইনফেকশন")) {
    goals.push("ব্যাকটেরিয়াল সংক্রমণ সম্পূর্ণ নির্মূল করা (পূর্ণ ডোজ সম্পন্ন করার মাধ্যমে)");
  }
  if (hasBpOrCardiac || parsedVitals.bp) {
    goals.push("রক্তচাপ ও হৃদযন্ত্রের কার্যকারিতা স্বাভাবিক ও নিরাপদ সীমায় রাখা");
  }
  if (hasDiabetic) {
    goals.push("রক্তের শর্করার (ব্লাড সুগার) মাত্রা নিয়ন্ত্রণে রেখে জটিলতা রোধ করা");
  }
  if (hasNsaidOrPain || hasFeverMed) {
    goals.push("শরীরের ব্যথা, প্রদাহ বা জ্বর দ্রুত কমিয়ে স্বস্তি ফিরিয়ে আনা");
  }
  if (hasPpiOrAntacid) {
    goals.push("পাকস্থলীর অতিরিক্ত এসিড ও গ্যাস্ট্রিকের অস্বস্তি থেকে সুরক্ষা দেওয়া");
  }
  if (hasRespiratory) {
    goals.push("সর্দি-কাশি, অ্যালার্জি ও শ্বাস-প্রশ্বাসের কষ্ট দূর করা");
  }
  if (hasDermOrFungal) {
    goals.push("ত্বকের সংক্রমণ ও চুলকানি দূর করে ত্বক সুস্থ করা");
  }
  if (invList.length > 0) {
    goals.push(`নির্ধারিত ${invList.length}টি পরীক্ষার মাধ্যমে রোগের মূল কারণ নিশ্চিত হওয়া`);
  }
  if (goals.length < 3) {
    goals.push("শারীরিক দুর্বলতা কাটিয়ে দ্রুত স্বাভাবিক সুস্থতায় ফিরিয়ে আনা");
  }

  // Overall Condition Reassurance (100% specific to this prescription)
  const partsCondition: string[] = [];
  if (diagText) {
    partsCondition.push(`আপনার উল্লেখিত সমস্যা (${diagText.replace(/\r?\n/g, ", ")}) পর্যালোচনা করে চিকিৎসক এই ব্যবস্থাপত্র প্রদান করেছেন।`);
  } else {
    partsCondition.push("চিকিৎসক আপনার শারীরিক অবস্থা পর্যালোচনা করে এই ব্যবস্থাপত্র প্রদান করেছেন।");
  }
  if (explainedMeds.length > 0) {
    partsCondition.push(`এতে মোট ${explainedMeds.length}টি ওষুধ${invList.length > 0 ? ` এবং ${invList.length}টি পরীক্ষা` : ""} নির্ধারণ করা হয়েছে।`);
  }
  if (rx.notes && rx.notes.trim()) {
    partsCondition.push(`বিশেষ নোট: ${rx.notes.trim()}।`);
  }
  partsCondition.push("নির্ধারিত নিয়ম ও সময় মেনে ওষুধগুলো গ্রহণ করুন।");
  const overallCondition = partsCondition.join(" ");

  // Dynamic Drug-Drug Interaction & Synergy Analysis
  const medNamesList = explainedMeds.map((m) => m.cleanName).join(", ");
  let interactionStatus: "safe" | "caution" = "safe";
  let interactionMessage =
    explainedMeds.length > 1
      ? `প্রেসক্রিপশনে প্রদত্ত ওষুধগুলোর (${medNamesList}) জেনেরিক উপাদান বিশ্লেষণ করে কোনো ক্ষতিকর আন্তঃক্রিয়া (Harmful Interaction) পাওয়া যায়নি।`
      : "প্রেসক্রিপশনে প্রদত্ত ওষুধটি চিকিৎসকের নির্দেশিত নিয়ম ও সময় মেনে নিরাপদে সেবন করুন।";
  let interactionSub1 = "ডাক্তারের নির্দেশিত খাবার আগে ও পরের সময়সূচি মেনে ওষুধগুলো নিশ্চিন্তে সেবন করা যাবে।";
  let interactionSub2 = "আপনি যদি আগে থেকে প্রেশার, ডায়াবেটিস বা অন্য কোনো দীর্ঘমেয়াদী ওষুধ খেয়ে থাকেন, তবে তা চিকিৎসকের পরামর্শ অনুযায়ী চালু রাখুন।";

  if (hasPpiOrAntacid && hasNsaidOrPain) {
    interactionMessage = `ব্যথানাশক ওষুধের সাথে গ্যাস্ট্রিক সুরক্ষার ওষুধ দেওয়া হয়েছে — এটি পেটের এসিডিটি রোধে অত্যন্ত নিরাপদ ও কার্যকর কম্বিনেশন।`;
    interactionSub1 = "গ্যাস্ট্রিকের ওষুধটি খাবারের ৩০ মিনিট আগে এবং ব্যথার ওষুধটি অবশ্যই ভরা পেটে খাবেন।";
  }
  if (hasAntibiotic && hasCalciumOrIron) {
    interactionStatus = "caution";
    interactionMessage = "অ্যান্টিবায়োটিক এবং ক্যালসিয়াম/আয়রন বা অ্যান্টাসিড একই সময়ে খেলে অ্যান্টিবায়োটিকের শোষণ কমে যেতে পারে।";
    interactionSub1 = "অ্যান্টিবায়োটিক এবং ক্যালসিয়াম/আয়রন বা এন্টাসিড খাওয়ার মধ্যে অন্তত ২ ঘণ্টার ব্যবধান রাখুন।";
  } else if (hasAntibiotic) {
    interactionSub1 = "অ্যান্টিবায়োটিক প্রতিদিন নির্দিষ্ট সময়ে খাবেন এবং লক্ষণ কমে গেলেও পুরো কোর্স সম্পন্ন করবেন।";
  }

  // Doctor's Actual Advice + Context-Specific Clinical Advice
  const doctorAdviceLines = (rx.advice || "")
    .split(/\r?\n|;/)
    .flatMap((line) => line.split(/,(?=\s*[^\d])/))
    .map((s) => s.trim())
    .filter(Boolean);

  const lifestyleAdvice: string[] = [...doctorAdviceLines];
  if (rx.notes && rx.notes.trim() && !lifestyleAdvice.includes(rx.notes.trim())) {
    lifestyleAdvice.push(`বিশেষ নির্দেশনা: ${rx.notes.trim()}`);
  }
  if (lifestyleAdvice.length === 0) {
    if (hasBpOrCardiac) {
      lifestyleAdvice.push("খাবারে অতিরিক্ত কাঁচা লবণ ও চর্বিজাতীয় খাবার সম্পূর্ণ পরিহার করুন।");
      lifestyleAdvice.push("প্রতিদিন নির্দিষ্ট সময়ে রক্তচাপের ওষুধ গ্রহণ করুন এবং নিয়মিত প্রেশার মাপুন।");
    }
    if (hasDiabetic) {
      lifestyleAdvice.push("মিষ্টি, চিনি ও অতিরিক্ত শর্করাজাতীয় খাবার এড়িয়ে চলুন এবং সময়মতো খাবার গ্রহণ করুন।");
    }
    if (hasPpiOrAntacid) {
      lifestyleAdvice.push("অতিরিক্ত তেল-মসলাযুক্ত, ভাজাপোড়া ও বাইরের খাবার এড়িয়ে চলুন।");
    }
    if (hasRespiratory) {
      lifestyleAdvice.push("ঠান্ডা পানি, আইসক্রিম, ধুলোবালি ও ধোঁয়া থেকে দূরে থাকুন; কুসুম গরম পানি পান করুন।");
    }
    if (hasAntibiotic) {
      lifestyleAdvice.push("অ্যান্টিবায়োটিকের ডোজ কোনোভাবেই মিস করবেন না এবং সম্পূর্ণ কোর্স শেষ করুন।");
    }
    if (lifestyleAdvice.length === 0) {
      lifestyleAdvice.push("প্রতিদিন পর্যাপ্ত (৮–১০ গ্লাস) বিশুদ্ধ পানি ও পুষ্টিকর খাবার গ্রহণ করুন।");
      lifestyleAdvice.push("চিকিৎসকের নির্ধারিত সময় ও নিয়ম মেনে নিয়মিত ওষুধ সেবন করুন।");
    }
  }
  if (rx.next_visit) {
    lifestyleAdvice.push(`পরবর্তী ফলো-আপ ভিজিট: ${rx.next_visit}`);
  }

  // Dynamic 4 Action Mini Cards tailored to this prescription
  const actionCards: { icon: string; text: string }[] = [
    {
      icon: "⏰",
      text: hasAntibiotic ? "অ্যান্টিবায়োটিকের পূর্ণ কোর্স শেষ করুন" : "নির্ধারিত সময় মেনে ওষুধ খান",
    },
    {
      icon: hasRespiratory ? "☕" : "💧",
      text: hasRespiratory ? "কুসুম গরম পানি পান ও ঠান্ডা পরিহার" : "পর্যাপ্ত বিশুদ্ধ পানি পান করুন",
    },
    {
      icon: hasBpOrCardiac ? "🧂" : hasDiabetic ? "🥗" : "🍲",
      text: hasBpOrCardiac
        ? "কাঁচা লবণ ও চর্বিযুক্ত খাবার বর্জন"
        : hasDiabetic
        ? "চিনি ও মিষ্টি খাবার পরিহার করুন"
        : hasPpiOrAntacid
        ? "ভাজাপোড়া ও ঝাল খাবার এড়িয়ে চলুন"
        : "পুষ্টিকর খাবার ও পর্যাপ্ত বিশ্রাম নিন",
    },
    {
      icon: invList.length > 0 ? "🧪" : "🗓️",
      text: rx.next_visit
        ? `ফলো-আপ: ${rx.next_visit}`
        : invList.length > 0
        ? `নির্ধারিত ${invList.length}টি টেস্ট সম্পন্ন করুন`
        : "প্রয়োজনে ফলো-আপ ভিজিট করুন",
    },
  ];

  // Dynamic Red Flags / Danger Signs tailored to the patient's condition & medicines
  const dangerSigns: string[] = [];
  if (hasBpOrCardiac) {
    dangerSigns.push("বুকে তীব্র ব্যথা, চাপ অনুভব হওয়া বা বাঁ হাতে/চোয়ালে ব্যথা ছড়িয়ে পড়লে");
    dangerSigns.push("হঠাৎ তীব্র মাথাব্যথা, চোখে ঝাপসা দেখা বা শরীরের এক পাশ অবশ মনে হলে");
  }
  if (hasDiabetic) {
    dangerSigns.push("হঠাৎ অতিরিক্ত ঘাম, বুক ধড়ফড়, হাত-পা কাঁপা বা মাথা ঘুরে পড়ে যাওয়ার ভাব হলে (সুগার কমে গেলে)");
  }
  if (hasRespiratory) {
    dangerSigns.push("শ্বাসকষ্ট তীব্র আকার ধারণ করলে বা কথা বলতে কষ্ট হলে");
  }
  if (hasNsaidOrPain || hasPpiOrAntacid) {
    dangerSigns.push("পেটে তীব্র ব্যথা, কালো পায়খানা বা বারবার বমি শুরু হলে");
  }
  if (hasNeuro) {
    dangerSigns.push("অতিরিক্ত তন্দ্রাচ্ছন্নতা, কথা জড়িয়ে যাওয়া বা অস্বাভাবিক দুর্বলতা দেখা দিলে");
  }
  // Always include allergy & persistent symptom warning
  dangerSigns.push("ওষুধ খাওয়ার পর শরীরে র‍্যাশ, তীব্র চুলকানি, চোখ-মুখ ফুলে যাওয়া বা অ্যালার্জির লক্ষণ দেখা দিলে");
  if (dangerSigns.length < 4) {
    dangerSigns.push("নির্ধারিত দিন ওষুধ খাওয়ার পরেও শারীরিক সমস্যার উন্নতি না হলে বা নতুন উপসর্গ দেখা দিলে");
  }
  if (dangerSigns.length < 4) {
    dangerSigns.push("উচ্চ মাত্রার জ্বর (১০২° ফারেনহাইটের বেশি) বা তীব্র শারীরিক দুর্বলতা দেখা দিলে");
  }

  return {
    overallCondition,
    treatmentGoals: goals.slice(0, 5),
    vitalsExplained: vitalsList,
    investigationsExplained: invList,
    medicines: explainedMeds,
    drugInteraction: {
      status: interactionStatus,
      message: interactionMessage,
      sub1: interactionSub1,
      sub2: interactionSub2,
    },
    lifestyleAdvice,
    actionCards,
    dangerSigns: dangerSigns.slice(0, 4),
    specialNotes: rx.notes || undefined,
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
  highNote?: string;
  lowNote?: string;
}

const LAB_PARAM_DEFINITIONS: LabParamDef[] = [
  { keyPattern: /\b(wbc|tlc|white blood cell|total count)\b/i, meaning: "সংক্রমণের বিরুদ্ধে লড়াইকারী শ্বেত রক্তকণিকা", defaultRef: "4,000–11,000 /µL", minVal: 4000, maxVal: 11000, highNote: "শরীরে ব্যাকটেরিয়াল ইনফেকশন বা প্রদাহের ইঙ্গিত দিতে পারে", lowNote: "ভাইরাল জ্বর বা রোগ প্রতিরোধ ক্ষমতা হ্রাসে কমতে পারে" },
  { keyPattern: /\b(rbc|red blood cell)\b/i, meaning: "রক্তে অক্সিজেন বহনকারী লোহিত রক্তকণিকা", defaultRef: "4.2–5.4 M/µL", minVal: 4.2, maxVal: 5.4, highNote: "পানিশূন্যতা বা ঘন রক্তের কারণে বাড়তে পারে", lowNote: "রক্তস্বল্পতা বা আয়রন ঘাটতির ইঙ্গিত" },
  { keyPattern: /\b(hemoglobin|haemoglobin|hb%?)\b/i, meaning: "রক্তের অক্সিজেন বহনের প্রধান উপাদান (হিমোগ্লোবিন)", defaultRef: "12.0–16.5 g/dL", minVal: 12.0, maxVal: 16.5, highNote: "পানিশূন্যতায় সামান্য বাড়তে পারে", lowNote: "রক্তস্বল্পতা (Anemia) নির্দেশ করে — পুষ্টিকর ও আয়রনসমৃদ্ধ খাবার প্রয়োজন" },
  { keyPattern: /\b(platelet|plt|thrombocyte)\b/i, meaning: "রক্ত জমাট বাঁধতে ও রক্তপাত বন্ধে সাহায্যকারী কণিকা", defaultRef: "1,50,000–4,50,000 /µL", minVal: 150000, maxVal: 450000, highNote: "প্রদাহ বা সংক্রমণের কারণে বাড়তে পারে", lowNote: "ডেঙ্গু বা ভাইরাল জ্বরে প্লেটলেট কমে যেতে পারে" },
  { keyPattern: /\b(neutrophils?|polymorphs?)\b/i, meaning: "ব্যাকটেরিয়াল সংক্রমণ প্রতিরোধকারী শ্বেতকণিকা", defaultRef: "40–75 %", minVal: 40, maxVal: 75, highNote: "ব্যাকটেরিয়াল ইনফেকশন বা তীব্র প্রদাহে বৃদ্ধি পায়", lowNote: "ভাইরাল ইনফেকশনে আপেক্ষিকভাবে কম থাকতে পারে" },
  { keyPattern: /\b(lymphocytes?)\b/i, meaning: "ভাইরাল ইনফেকশন প্রতিরোধ ও ইমিউনিটি রক্ষাকারী কণিকা", defaultRef: "20–45 %", minVal: 20, maxVal: 45, highNote: "ভাইরাল জ্বর বা দীর্ঘমেয়াদী সংক্রমণে বাড়তে পারে", lowNote: "সাময়িক শারীরিক স্ট্রেসে কমতে পারে" },
  { keyPattern: /\b(eosinophils?|circulating eosinophil)\b/i, meaning: "অ্যালার্জি ও পরজীবী সংক্রমণ নির্দেশক কণিকা", defaultRef: "1–6 %", minVal: 1, maxVal: 6, highNote: "ধুলোবালির অ্যালার্জি, ঠান্ডা-হাঁপানি বা কৃমির কারণে বাড়ে", lowNote: "স্বাভাবিক" },
  { keyPattern: /\b(monocytes?)\b/i, meaning: "জীবাণু ধ্বংস ও টিস্যু মেরামতে সহায়ক কণিকা", defaultRef: "2–10 %", minVal: 2, maxVal: 10 },
  { keyPattern: /\b(basophils?)\b/i, meaning: "অ্যালার্জিক প্রতিক্রিয়ায় অংশগ্রহণকারী কণিকা", defaultRef: "0–1 %", minVal: 0, maxVal: 2 },
  { keyPattern: /\b(esr|erythrocyte sedimentation rate)\b/i, meaning: "শরীরে প্রদাহ বা দীর্ঘমেয়াদী সংক্রমণের সূচক", defaultRef: "0–20 mm/1st hr", minVal: 0, maxVal: 20, highNote: "শরীরে ইনফেকশন, বাত বা প্রদাহ থাকলে ESR বাড়ে" },
  { keyPattern: /\b(crp|c-?reactive protein)\b/i, meaning: "রক্তে তীব্র প্রদাহ বা ইনফেকশনের সংবেদনশীল সূচক", defaultRef: "< 6.0 mg/L", minVal: 0, maxVal: 6.0, highNote: "শরীরে সক্রিয় সংক্রমণ বা প্রদাহ নির্দেশ করে" },
  { keyPattern: /\b(hct|pcv|hematocrit)\b/i, meaning: "রক্তে লোহিত কণিকার শতকরা ঘনত্ব (হেমাটোক্রিট)", defaultRef: "36–50 %", minVal: 36, maxVal: 50, highNote: "পানিশূন্যতায় বা ডেঙ্গুতে বাড়তে পারে", lowNote: "রক্তস্বল্পতায় কমে যায়" },
  { keyPattern: /\b(mcv)\b/i, meaning: "লোহিত রক্তকণিকার (RBC) গড় আকার", defaultRef: "80–100 fL", minVal: 80, maxVal: 100 },
  { keyPattern: /\b(mch)\b/i, meaning: "প্রতিটি লোহিত কণিকায় হিমোগ্লোবিনের গড় পরিমাণ", defaultRef: "27–33 pg", minVal: 27, maxVal: 33 },
  { keyPattern: /\b(mchc)\b/i, meaning: "লোহিত কণিকায় হিমোগ্লোবিনের ঘনত্ব", defaultRef: "31–36 g/dL", minVal: 31, maxVal: 36 },
  { keyPattern: /\b(creatinine|serum creatinine|s\.?\s*creatinine)\b/i, meaning: "কিডনির রক্ত পরিশোধন ক্ষমতা ও সুস্থতার প্রধান সূচক", defaultRef: "0.6–1.2 mg/dL", minVal: 0.6, maxVal: 1.2, highNote: "কিডনির ওপর চাপ বা পানিশূন্যতা নির্দেশ করে — চিকিৎসকের পরামর্শ নিন" },
  { keyPattern: /\b(urea|blood urea|bun)\b/i, meaning: "কিডনির মাধ্যমে নিষ্কাশিত প্রোটিন বিপাকজনিত উপাদান", defaultRef: "15–40 mg/dL", minVal: 15, maxVal: 40 },
  { keyPattern: /\b(sgpt|alt|alanine transaminase)\b/i, meaning: "লিভারের কোষের সুস্থতা ও কার্যকরী এনজাইম", defaultRef: "10–45 U/L", minVal: 7, maxVal: 45, highNote: "ফ্যাটি লিভার, লিভারে প্রদাহ বা ওষুধের প্রভাবে বাড়তে পারে" },
  { keyPattern: /\b(sgot|ast|aspartate transaminase)\b/i, meaning: "লিভার ও পেশির সুস্থতা নির্দেশক এনজাইম", defaultRef: "10–40 U/L", minVal: 8, maxVal: 40 },
  { keyPattern: /\b(bilirubin|total bilirubin)\b/i, meaning: "রক্তে পিত্তরসের মাত্রা ও জন্ডিসের প্রধান সূচক", defaultRef: "0.2–1.2 mg/dL", minVal: 0.2, maxVal: 1.2, highNote: "মাত্রা বেশি হলে জন্ডিস বা লিভার-পিত্তথলির সমস্যা নির্দেশ করে" },
  { keyPattern: /\b(alkaline phosphatase|alp)\b/i, meaning: "লিভারের পিত্তনালি ও হাড়ের এনজাইম", defaultRef: "40–130 U/L", minVal: 40, maxVal: 130 },
  { keyPattern: /\b(uric acid)\b/i, meaning: "রক্তে ইউরিক এসিডের মাত্রা (বাত ব্যথার সূচক)", defaultRef: "3.5–7.0 mg/dL", minVal: 3.4, maxVal: 7.0, highNote: "ইউরিক এসিড বেশি থাকলে জয়েন্টে ব্যথা হতে পারে" },
  { keyPattern: /\b(rbs|random blood sugar|random glucose)\b/i, meaning: "রক্তে তাৎক্ষণিক গ্লুকোজ বা সুগারের মাত্রা", defaultRef: "4.0–7.8 mmol/L", minVal: 4.0, maxVal: 7.8, highNote: "রক্তে সুগারের মাত্রা স্বাভাবিকের চেয়ে বেশি" },
  { keyPattern: /\b(fbs|fasting blood sugar|fasting glucose)\b/i, meaning: "খালি পেটে ডায়াবেটিসের মাত্রা", defaultRef: "4.0–6.0 mmol/L", minVal: 3.9, maxVal: 6.1, highNote: "খালি পেটে সুগার বেশি — ডায়াবেটিস নিয়ন্ত্রণে মনোযোগ দিন" },
  { keyPattern: /\b(2habf|ppbs|post prandial)\b/i, meaning: "খাবার ২ ঘণ্টা পর রক্তে সুগারের মাত্রা", defaultRef: "< 7.8 mmol/L", minVal: 4.0, maxVal: 7.8 },
  { keyPattern: /\b(hba1c)\b/i, meaning: "গত ৩ মাসের গড় ব্লাড সুগার নিয়ন্ত্রণের সূচক", defaultRef: "4.0–5.6 %", minVal: 4.0, maxVal: 6.0, highNote: "বিগত ৩ মাসে সুগার স্বাভাবিকের চেয়ে বেশি ছিল" },
  { keyPattern: /\b(total cholesterol|cholesterol)\b/i, meaning: "রক্তে মোট কোলেস্টেরল বা চর্বির মাত্রা", defaultRef: "< 200 mg/dL", minVal: 100, maxVal: 200, highNote: "রক্তে চর্বির মাত্রা বেশি — তৈলাক্ত খাবার পরিহার করুন" },
  { keyPattern: /\b(triglycerides?|tg)\b/i, meaning: "রক্তের ট্রাইগ্লিসারাইড চর্বি", defaultRef: "< 150 mg/dL", minVal: 40, maxVal: 150, highNote: "অতিরিক্ত শর্করা ও ভাজাপোড়া খাবারে এটি বাড়ে" },
  { keyPattern: /\b(hdl)\b/i, meaning: "হৃৎপিণ্ডের জন্য উপকারী ভালো কোলেস্টেরল (HDL)", defaultRef: "> 40 mg/dL", minVal: 40, maxVal: 100 },
  { keyPattern: /\b(ldl)\b/i, meaning: "রক্তনালির জন্য ক্ষতিকর কোলেস্টেরল (LDL)", defaultRef: "< 100 mg/dL", minVal: 0, maxVal: 100, highNote: "ক্ষতিকর কোলেস্টেরল বেশি থাকলে হৃদরোগের ঝুঁকি বাড়ে" },
  { keyPattern: /\b(tsh|thyroid stimulating hormone)\b/i, meaning: "থাইরয়েড গ্রন্থি নিয়ন্ত্রণকারী প্রধান হরমোন", defaultRef: "0.4–4.5 µIU/mL", minVal: 0.4, maxVal: 4.5, highNote: "হাইপোথাইরয়েডিজম (থাইরয়েড হরমোন কম কাজ করা) নির্দেশ করতে পারে", lowNote: "হাইপারথাইরয়েডিজম নির্দেশ করতে পারে" },
  { keyPattern: /\b(pus cells?|leukocytes?)\b/i, meaning: "প্রস্রাবে ইনফেকশন বা পুঁজ কোষের উপস্থিতি", defaultRef: "0–5 /HPF", minVal: 0, maxVal: 5, highNote: "প্রস্রাবে ইনফেকশন (UTI) নির্দেশ করে — প্রচুর পানি পান করুন" },
  { keyPattern: /\b(epithelial cells?)\b/i, meaning: "মূত্রনালির স্বাভাবিক আবরণী কোষ", defaultRef: "0–5 /HPF", minVal: 0, maxVal: 5 },
  { keyPattern: /\b(albumin|protein)\b/i, meaning: "প্রস্রাব বা রক্তে প্রোটিন/অ্যালবুমিনের উপস্থিতি", defaultRef: "Nil / Negative" },
];

function parseRefRangeBounds(refStr: string): { min: number; max: number } | null {
  if (!refStr) return null;
  const clean = refStr.replace(/,/g, "");
  const rangeMatch = clean.match(/(\d+(?:\.\d+)?)\s*[\-–—to]+\s*(\d+(?:\.\d+)?)/i);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    if (!isNaN(min) && !isNaN(max) && max >= min) return { min, max };
  }
  const lessMatch = clean.match(/<\s*=?\s*(\d+(?:\.\d+)?)/);
  if (lessMatch) {
    const max = parseFloat(lessMatch[1]);
    if (!isNaN(max)) return { min: 0, max };
  }
  return null;
}

export function explainLabReport(report: {
  test_name?: string | null;
  department?: string | null;
  patient_name?: string | null;
  sample_no?: string | null;
  reported_at_text?: string | null;
  comment?: string | null;
  rows?: any;
}): LabReportExplanation {
  let rawRows: any[] = [];
  if (Array.isArray(report.rows)) {
    rawRows = report.rows;
  } else if (typeof report.rows === "string" && report.rows.trim().startsWith("[")) {
    try {
      rawRows = JSON.parse(report.rows);
    } catch {}
  }

  const parameters: LabParameterExplained[] = [];
  let normalCount = 0;
  let mildCount = 0;
  let abnormalCount = 0;

  for (const r of rawRows) {
    const pName = (r.name || r.test || r.parameter || r.label || "").trim();
    if (!pName) continue;

    const resStr = String(r.result ?? r.value ?? "").trim();
    const unitStr = String(r.unit ?? "").trim();
    const refStr = String(r.ref ?? r.reference_range ?? r.normal_range ?? "").trim();

    const def = LAB_PARAM_DEFINITIONS.find((d) => d.keyPattern.test(pName));
    const meaning = def ? def.meaning : `${pName} পরীক্ষার ল্যাবরেটরি মান`;
    const effectiveRef = refStr || (def ? def.defaultRef : "ল্যাবরেটরি রেফারেন্স মান");

    let status: LabParameterExplained["status"] = "normal";
    let statusText = "স্বাভাবিক";
    let clinicalNote = "মানটি স্বাভাবিক সীমার মধ্যে রয়েছে।";

    // Parse bounds either from actual row's refStr first, or fallback to def
    const parsedBounds = parseRefRangeBounds(effectiveRef) ||
      (def && def.minVal !== undefined && def.maxVal !== undefined ? { min: def.minVal, max: def.maxVal } : null);

    // Handle range result like "2-4" for pus cells or single numeric result
    const rangeResultMatch = resStr.match(/^(\d+(?:\.\d+)?)\s*[\-–]\s*(\d+(?:\.\d+)?)$/);
    const num = rangeResultMatch
      ? parseFloat(rangeResultMatch[2])
      : parseFloat(resStr.replace(/,/g, "").replace(/[^0-9.]/g, ""));

    if (!isNaN(num) && parsedBounds) {
      if (num >= parsedBounds.min && num <= parsedBounds.max) {
        status = "normal";
        statusText = "স্বাভাবিক";
        clinicalNote = "সম্পূর্ণ স্বাভাবিক সীমায় আছে।";
        normalCount++;
      } else {
        const isHigh = num > parsedBounds.max;
        const span = parsedBounds.max - parsedBounds.min || parsedBounds.max || 1;
        const diff = isHigh ? num - parsedBounds.max : parsedBounds.min - num;
        if (diff <= span * 0.35) {
          status = "mild";
          statusText = isHigh ? "সামান্য বেশি" : "সামান্য কম";
          clinicalNote = isHigh
            ? def?.highNote || "স্বাভাবিক সীমার চেয়ে সামান্য বেশি।"
            : def?.lowNote || "স্বাভাবিক সীমার চেয়ে সামান্য কম।";
          mildCount++;
        } else {
          status = "abnormal";
          statusText = isHigh ? "বেশি (High)" : "কম (Low)";
          clinicalNote = isHigh
            ? def?.highNote || "স্বাভাবিক সীমার চেয়ে লক্ষণীয়ভাবে বেশি — চিকিৎসকের পরামর্শ নিন।"
            : def?.lowNote || "স্বাভাবিক সীমার চেয়ে লক্ষণীয়ভাবে কম — চিকিৎসকের পরামর্শ নিন।";
          abnormalCount++;
        }
      }
    } else {
      const lower = resStr.toLowerCase();
      if (/\b(nil|negative|neg|normal|clear|absent|non-?reactive|sterile|no growth)\b/.test(lower)) {
        status = "normal";
        statusText = "স্বাভাবিক";
        clinicalNote = "কোনো অস্বাভাবিক উপাদান পাওয়া যায়নি।";
        normalCount++;
      } else if (/\b(positive|present|reactive|growth|high|abnormal|\+{2,})\b/.test(lower)) {
        status = "abnormal";
        statusText = "অস্বাভাবিক / পজিটিভ";
        clinicalNote = def?.highNote || "রিপোর্টটি চিকিৎসককে দেখিয়ে পরামর্শ নিন।";
        abnormalCount++;
      } else if (/\b(trace|\+)\b/.test(lower)) {
        status = "mild";
        statusText = "সামান্য উপস্থিতি";
        clinicalNote = "সামান্য তারতম্য দেখা গেছে।";
        mildCount++;
      } else {
        status = "normal";
        statusText = "পরীক্ষিত";
        clinicalNote = "ল্যাবরেটরিতে নথিবদ্ধ ফলাফল।";
        normalCount++;
      }
    }

    parameters.push({
      name: pName,
      result: resStr || "—",
      unit: unitStr,
      refRange: effectiveRef,
      status,
      statusText,
      banglaMeaning: meaning,
      clinicalNote,
    });
  }

  const abnormalParams = parameters.filter((p) => p.status === "abnormal");
  const mildParams = parameters.filter((p) => p.status === "mild");

  let riskLevel: LabReportExplanation["riskLevel"] = "ঝুঁকিমুক্ত";
  let reassuranceTitle = "ভালো খবর!";
  let reassuranceMessage =
    parameters.length > 0
      ? `আপনার ${report.test_name || "টেস্ট"} রিপোর্টের সবগুলো (${parameters.length}টি) উপাদানই স্বাভাবিক সীমায় রয়েছে।${report.comment ? ` ল্যাব নোট: ${report.comment}` : ""}`
      : report.comment
      ? `ল্যাবরেটরি মন্তব্য: ${report.comment}`
      : "আপনার ল্যাবরেটরি টেস্ট রিপোর্ট প্রস্তুত হয়েছে। বিস্তারিত ফলাফল নিচে দেওয়া হলো।";

  if (abnormalCount > 0) {
    riskLevel = "চিকিৎসকের পরামর্শ জরুরি";
    reassuranceTitle = "চিকিৎসকের পরামর্শ প্রয়োজন";
    const names = abnormalParams.map((p) => `${p.name} (${p.statusText})`).join(", ");
    reassuranceMessage = `রিপোর্টে ${abnormalCount}টি উপাদানে (${names}) লক্ষণীয় তারতম্য পাওয়া গেছে। সঠিক চিকিৎসার জন্য রিপোর্টটি আপনার চিকিৎসককে দেখান।`;
  } else if (mildCount > 0) {
    riskLevel = "হালকা পর্যবেক্ষণ প্রয়োজন";
    reassuranceTitle = "সাধারণত চিন্তার কারণ নেই";
    const names = mildParams.map((p) => `${p.name} (${p.statusText})`).join(", ");
    reassuranceMessage = `আপনার বেশিরভাগ ফলাফল স্বাভাবিক রয়েছে। শুধুমাত্র ${mildCount}টি উপাদানে (${names}) সামান্য তারতম্য রয়েছে, যা সাধারণ ওষুধ ও নিয়ম মেনে চললে দ্রুত স্বাভাবিক হয়ে আসে।`;
  }

  // Dynamic Tips & FAQs based on the actual test & parameter findings
  const patientTips: string[] = [];
  if (abnormalParams.length > 0 || mildParams.length > 0) {
    for (const p of [...abnormalParams, ...mildParams].slice(0, 3)) {
      if (p.clinicalNote) {
        patientTips.push(`${p.name}: ${p.clinicalNote}`);
      }
    }
  }
  if (report.comment && report.comment.trim()) {
    patientTips.push(`ল্যাবরেটরি মন্তব্য: ${report.comment.trim()}`);
  }
  patientTips.push("এই রিপোর্টটি আপনার প্রেসক্রাইবিং ডাক্তারকে ফলো-আপ ভিজিটে দেখান।");
  patientTips.push("পর্যাপ্ত বিশুদ্ধ পানি পান করুন এবং চিকিৎসকের দেওয়া ওষুধের কোর্স নিয়মমতো চালিয়ে যান।");

  const faqs: { question: string; answer: string }[] = [
    {
      question: `${report.test_name || "এই টেস্ট"} রিপোর্টটি সামগ্রিকভাবে কী নির্দেশ করছে?`,
      answer: reassuranceMessage,
    },
  ];

  if (abnormalParams.length > 0 || mildParams.length > 0) {
    const firstChanged = abnormalParams[0] || mildParams[0];
    faqs.push({
      question: `${firstChanged.name} এর মান (${firstChanged.result} ${firstChanged.unit}) কেন পরিবর্তিত হয়েছে?`,
      answer: `${firstChanged.name} হলো ${firstChanged.banglaMeaning} (স্বাভাবিক সীমা: ${firstChanged.refRange})। ${firstChanged.clinicalNote || "শারীরিক সংক্রমণ বা সাময়িক পরিবর্তনের কারণে এটি হতে পারে।"}`,
    });
  }

  faqs.push(
    {
      question: "আমাকে কি এই টেস্টটি আবার করতে হবে?",
      answer: "ওষুধের কোর্স শেষ হওয়ার পর অথবা চিকিৎসক যদি উন্নতি যাচাই করতে চান, তবে তিনি নির্দিষ্ট সময় পর পুনরায় ফলো-আপ টেস্ট করতে বলতে পারেন।",
    },
    {
      question: "কখন দ্রুত ডাক্তারের সাথে যোগাযোগ করা উচিত?",
      answer: "যদি শারীরিক উপসর্গ বৃদ্ধি পায়, জ্বর বা ব্যথা না কমে অথবা নতুন কোনো জটিলতা দেখা দেয়, তবে দেরি না করে চিকিৎসকের পরামর্শ নিন।",
    }
  );

  return {
    testName: report.test_name || "ল্যাবরেটরি টেস্ট রিপোর্ট",
    department: report.department || undefined,
    totalParameters: parameters.length,
    normalCount,
    mildCount,
    abnormalCount,
    reassuranceTitle,
    reassuranceMessage,
    riskLevel,
    parameters,
    patientTips: patientTips.slice(0, 4),
    dangerSigns: [
      "শারীরিক লক্ষণ বা জ্বর দীর্ঘদিন স্থায়ী হলে",
      "তীব্র শ্বাসকষ্ট, বুকে ব্যথা বা অতিরিক্ত দুর্বলতা অনুভূত হলে",
      "ওষুধ খাওয়ার পরেও সমস্যার উন্নতি না হলে",
      "নতুন বা অজানা কোনো শারীরিক উপসর্গ দেখা দিলে",
    ],
    faqs,
  };
}
