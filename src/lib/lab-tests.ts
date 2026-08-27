// Standard lab test catalogue: each test is a headline with its analyte rows
// (parameter, unit, reference range, method). Only the patient result is blank,
// so a report is ready as soon as results are typed in.

export type LabAnalyte = {
  name: string;
  unit?: string;
  ref?: string;
  method?: string;
};

export type LabTest = {
  id: string;
  name: string;
  department: string;
  specimen?: string;
  analytes: LabAnalyte[];
};

export const LAB_TESTS: LabTest[] = [
  {
    id: "cbc",
    name: "Complete Blood Count (CBC) with ESR",
    department: "Haematology",
    specimen: "Whole blood (EDTA)",
    analytes: [
      { name: "Haemoglobin (Hb)", unit: "g/dL", ref: "M 13.0-17.0, F 12.0-15.0", method: "Photometric" },
      { name: "Total WBC Count", unit: "/cumm", ref: "4,000 - 11,000", method: "Impedance" },
      { name: "Neutrophils", unit: "%", ref: "40 - 75", method: "Microscopy" },
      { name: "Lymphocytes", unit: "%", ref: "20 - 45", method: "Microscopy" },
      { name: "Monocytes", unit: "%", ref: "2 - 10", method: "Microscopy" },
      { name: "Eosinophils", unit: "%", ref: "1 - 6", method: "Microscopy" },
      { name: "Basophils", unit: "%", ref: "0 - 1", method: "Microscopy" },
      { name: "RBC Count", unit: "million/cumm", ref: "M 4.5-5.5, F 3.8-4.8", method: "Impedance" },
      { name: "Haematocrit (PCV)", unit: "%", ref: "M 40-50, F 36-46", method: "Calculated" },
      { name: "MCV", unit: "fL", ref: "83 - 101", method: "Calculated" },
      { name: "MCH", unit: "pg", ref: "27 - 32", method: "Calculated" },
      { name: "MCHC", unit: "g/dL", ref: "31.5 - 34.5", method: "Calculated" },
      { name: "Platelet Count", unit: "/cumm", ref: "150,000 - 450,000", method: "Impedance" },
      { name: "ESR (1st hour)", unit: "mm", ref: "M 0-10, F 0-20", method: "Westergren" },
    ],
  },
  {
    id: "esr",
    name: "ESR (Erythrocyte Sedimentation Rate)",
    department: "Haematology",
    specimen: "Whole blood (EDTA)",
    analytes: [{ name: "ESR (1st hour)", unit: "mm", ref: "M 0-10, F 0-20", method: "Westergren" }],
  },
  {
    id: "rbs",
    name: "Blood Glucose (Random / Fasting / 2h ABF)",
    department: "Biochemistry",
    specimen: "Plasma (Fluoride)",
    analytes: [
      { name: "Glucose (Fasting)", unit: "mmol/L", ref: "3.9 - 6.1", method: "GOD-POD" },
      { name: "Glucose (2 hours ABF)", unit: "mmol/L", ref: "< 7.8", method: "GOD-POD" },
      { name: "Glucose (Random)", unit: "mmol/L", ref: "3.9 - 7.8", method: "GOD-POD" },
    ],
  },
  {
    id: "hba1c",
    name: "HbA1c (Glycated Haemoglobin)",
    department: "Biochemistry",
    specimen: "Whole blood (EDTA)",
    analytes: [
      { name: "HbA1c", unit: "%", ref: "Normal < 5.7, Pre-diabetes 5.7-6.4, Diabetes >= 6.5", method: "HPLC" },
      { name: "Estimated Average Glucose", unit: "mmol/L", ref: "-", method: "Calculated" },
    ],
  },
  {
    id: "lipid",
    name: "Lipid Profile (Fasting)",
    department: "Biochemistry",
    specimen: "Serum",
    analytes: [
      { name: "Total Cholesterol", unit: "mg/dL", ref: "Desirable < 200", method: "CHOD-PAP" },
      { name: "Triglyceride", unit: "mg/dL", ref: "Normal < 150", method: "GPO-PAP" },
      { name: "HDL Cholesterol", unit: "mg/dL", ref: "M > 40, F > 50", method: "Direct" },
      { name: "LDL Cholesterol", unit: "mg/dL", ref: "Optimal < 100", method: "Calculated" },
      { name: "VLDL Cholesterol", unit: "mg/dL", ref: "< 30", method: "Calculated" },
      { name: "Total Cholesterol / HDL Ratio", unit: "", ref: "< 5.0", method: "Calculated" },
    ],
  },
  {
    id: "lft",
    name: "Liver Function Test (LFT)",
    department: "Biochemistry",
    specimen: "Serum",
    analytes: [
      { name: "Bilirubin (Total)", unit: "mg/dL", ref: "0.2 - 1.2", method: "DPD" },
      { name: "Bilirubin (Direct)", unit: "mg/dL", ref: "0.0 - 0.3", method: "DPD" },
      { name: "ALT (SGPT)", unit: "U/L", ref: "M up to 41, F up to 33", method: "IFCC-UV" },
      { name: "AST (SGOT)", unit: "U/L", ref: "M up to 40, F up to 32", method: "IFCC-UV" },
      { name: "Alkaline Phosphatase", unit: "U/L", ref: "40 - 129", method: "IFCC-PNP" },
      { name: "Total Protein", unit: "g/dL", ref: "6.4 - 8.3", method: "Biuret" },
      { name: "Albumin", unit: "g/dL", ref: "3.5 - 5.2", method: "BCG" },
      { name: "Prothrombin Time (PT)", unit: "sec", ref: "11 - 15", method: "Coagulometry" },
    ],
  },
  {
    id: "rft",
    name: "Renal Function Test (RFT)",
    department: "Biochemistry",
    specimen: "Serum",
    analytes: [
      { name: "Urea", unit: "mg/dL", ref: "15 - 45", method: "Urease-GLDH" },
      { name: "Creatinine", unit: "mg/dL", ref: "M 0.7-1.3, F 0.6-1.1", method: "Jaffe kinetic" },
      { name: "eGFR", unit: "mL/min/1.73m2", ref: "> 90", method: "CKD-EPI" },
      { name: "Uric Acid", unit: "mg/dL", ref: "M 3.5-7.2, F 2.6-6.0", method: "Uricase" },
      { name: "Sodium (Na+)", unit: "mmol/L", ref: "136 - 145", method: "ISE" },
      { name: "Potassium (K+)", unit: "mmol/L", ref: "3.5 - 5.1", method: "ISE" },
      { name: "Chloride (Cl-)", unit: "mmol/L", ref: "98 - 107", method: "ISE" },
    ],
  },
  {
    id: "electrolytes",
    name: "Serum Electrolytes",
    department: "Biochemistry",
    specimen: "Serum",
    analytes: [
      { name: "Sodium (Na+)", unit: "mmol/L", ref: "136 - 145", method: "ISE" },
      { name: "Potassium (K+)", unit: "mmol/L", ref: "3.5 - 5.1", method: "ISE" },
      { name: "Chloride (Cl-)", unit: "mmol/L", ref: "98 - 107", method: "ISE" },
      { name: "Total CO2 (TCO2)", unit: "mmol/L", ref: "22 - 29", method: "Calculated" },
    ],
  },
  {
    id: "tft",
    name: "Thyroid Function Test (TSH, FT3, FT4)",
    department: "Immunology",
    specimen: "Serum",
    analytes: [
      { name: "TSH", unit: "mIU/L", ref: "0.35 - 4.94", method: "CLIA" },
      { name: "FT3", unit: "pmol/L", ref: "2.63 - 5.70", method: "CLIA" },
      { name: "FT4", unit: "pmol/L", ref: "9.01 - 19.05", method: "CLIA" },
    ],
  },
  {
    id: "crp",
    name: "C-Reactive Protein (CRP)",
    department: "Immunology",
    specimen: "Serum",
    analytes: [{ name: "CRP", unit: "mg/L", ref: "< 6.0", method: "Immunoturbidimetry" }],
  },
  {
    id: "hbsag",
    name: "HBs Ag (Hepatitis B Surface Antigen)",
    department: "Immunology",
    specimen: "Serum",
    analytes: [{ name: "HBs Ag", unit: "", ref: "Non-reactive", method: "CLIA / ICT" }],
  },
  {
    id: "antihcv",
    name: "Anti HCV (Hepatitis C Antibody)",
    department: "Immunology",
    specimen: "Serum",
    analytes: [{ name: "Anti HCV", unit: "", ref: "Non-reactive", method: "CLIA / ICT" }],
  },
  {
    id: "widal",
    name: "Widal Test",
    department: "Serology",
    specimen: "Serum",
    analytes: [
      { name: "S. typhi 'O'", unit: "titre", ref: "< 1:80", method: "Slide agglutination" },
      { name: "S. typhi 'H'", unit: "titre", ref: "< 1:80", method: "Slide agglutination" },
      { name: "S. paratyphi 'AH'", unit: "titre", ref: "< 1:80", method: "Slide agglutination" },
      { name: "S. paratyphi 'BH'", unit: "titre", ref: "< 1:80", method: "Slide agglutination" },
    ],
  },
  {
    id: "dengue",
    name: "Dengue Profile (NS1, IgM, IgG)",
    department: "Serology",
    specimen: "Serum",
    analytes: [
      { name: "Dengue NS1 Antigen", unit: "", ref: "Negative", method: "ICT" },
      { name: "Dengue IgM", unit: "", ref: "Negative", method: "ICT" },
      { name: "Dengue IgG", unit: "", ref: "Negative", method: "ICT" },
    ],
  },
  {
    id: "urine-re",
    name: "Urine R/M/E (Routine & Microscopic)",
    department: "Clinical Pathology",
    specimen: "Urine (midstream)",
    analytes: [
      { name: "Colour", unit: "", ref: "Pale yellow", method: "Visual" },
      { name: "Appearance", unit: "", ref: "Clear", method: "Visual" },
      { name: "Specific Gravity", unit: "", ref: "1.005 - 1.030", method: "Strip" },
      { name: "pH", unit: "", ref: "5.0 - 8.0", method: "Strip" },
      { name: "Protein", unit: "", ref: "Nil", method: "Strip" },
      { name: "Glucose", unit: "", ref: "Nil", method: "Strip" },
      { name: "Ketone", unit: "", ref: "Nil", method: "Strip" },
      { name: "Bilirubin", unit: "", ref: "Nil", method: "Strip" },
      { name: "Blood", unit: "", ref: "Nil", method: "Strip" },
      { name: "Pus Cell", unit: "/HPF", ref: "0 - 4", method: "Microscopy" },
      { name: "RBC", unit: "/HPF", ref: "Nil", method: "Microscopy" },
      { name: "Epithelial Cell", unit: "/HPF", ref: "Few", method: "Microscopy" },
      { name: "Cast / Crystal", unit: "", ref: "Nil", method: "Microscopy" },
    ],
  },
  {
    id: "stool-re",
    name: "Stool R/M/E",
    department: "Clinical Pathology",
    specimen: "Stool",
    analytes: [
      { name: "Colour", unit: "", ref: "Brown", method: "Visual" },
      { name: "Consistency", unit: "", ref: "Semi-solid", method: "Visual" },
      { name: "Mucus", unit: "", ref: "Absent", method: "Visual" },
      { name: "Pus Cell", unit: "/HPF", ref: "Nil", method: "Microscopy" },
      { name: "RBC", unit: "/HPF", ref: "Nil", method: "Microscopy" },
      { name: "Ova / Cyst / Parasite", unit: "", ref: "Not found", method: "Microscopy" },
      { name: "Occult Blood", unit: "", ref: "Negative", method: "Chemical" },
    ],
  },
  {
    id: "calcium",
    name: "Serum Calcium",
    department: "Biochemistry",
    specimen: "Serum",
    analytes: [
      { name: "Calcium (Total)", unit: "mg/dL", ref: "8.6 - 10.2", method: "Arsenazo III" },
      { name: "Ionized Calcium", unit: "mmol/L", ref: "1.12 - 1.32", method: "ISE" },
    ],
  },
  {
    id: "uric-acid",
    name: "Serum Uric Acid",
    department: "Biochemistry",
    specimen: "Serum",
    analytes: [{ name: "Uric Acid", unit: "mg/dL", ref: "M 3.5-7.2, F 2.6-6.0", method: "Uricase" }],
  },
  {
    id: "vitd",
    name: "Vitamin D (25-OH)",
    department: "Immunology",
    specimen: "Serum",
    analytes: [
      { name: "25-OH Vitamin D", unit: "ng/mL", ref: "Sufficient 30-100, Insufficient 20-29, Deficient < 20", method: "CLIA" },
    ],
  },
  {
    id: "pregnancy",
    name: "Pregnancy Test (Urine hCG)",
    department: "Clinical Pathology",
    specimen: "Urine",
    analytes: [{ name: "Urine hCG", unit: "", ref: "Negative", method: "ICT" }],
  },
];

export function findLabTest(id: string) {
  return LAB_TESTS.find((t) => t.id === id) ?? null;
}
