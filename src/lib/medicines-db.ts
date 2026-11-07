/**
 * Unified 25,534-Medicine Clinical Knowledge Database Matcher
 * Matches Rx database medicine names (e.g., "Tab. Rosustat 10 mg", "Inj. Trizon 250 mg/vial")
 * with the 25,534-medicine clinical dataset (Generic Name, Dosage Form, Indications, Mode of Action, Side Effects).
 */

import { useEffect, useState } from "react";

export interface MatchedMedicineRecord {
  rxName: string;
  genericName: string;
  dosageForm: string;
  dosageFormBn: "ট্যাবলেট" | "ক্যাপসুল" | "সিরাপ" | "ইনজেকশন" | "ড্রপস" | "মলম" | "অন্যান্য";
  indications: string;
  modeOfAction: string;
  sideEffects: string;
}

interface RawMedicineDbPayload {
  forms: string[];
  generics: [string, string, string, string][]; // [genericName, indications, modeOfAction, sideEffects]
  meds: [string, number, number][]; // [rxName, genericIdx, formIdx]
}

interface CompiledMedicineDb {
  all: MatchedMedicineRecord[];
  byExactRx: Map<string, MatchedMedicineRecord>;
  byNormCore: Map<string, MatchedMedicineRecord>;
  byNormNoUnits: Map<string, MatchedMedicineRecord>;
  byFormAndNoUnits: Map<string, MatchedMedicineRecord>;
  byFormAndBrand: Map<string, MatchedMedicineRecord>;
  byBrandPhrase: Map<string, MatchedMedicineRecord>;
  byFirstWord: Map<string, MatchedMedicineRecord>;
  byGenericLower: Map<string, MatchedMedicineRecord>;
  byGenericBase: Map<string, MatchedMedicineRecord>;
}

let compiledCache: CompiledMedicineDb | null = null;
let loadingPromise: Promise<CompiledMedicineDb | null> | null = null;
const listeners = new Set<() => void>();

export function detectExplicitFormFromPrefix(raw: string): {
  formEn: string;
  formBn: MatchedMedicineRecord["dosageFormBn"];
} | null {
  const s = (raw || "").trim().toLowerCase();
  if (/^(tab\.|tab\b|tablet\b)/.test(s)) return { formEn: "Tablet", formBn: "ট্যাবলেট" };
  if (/^(cap\.|cap\b|capsule\b)/.test(s)) return { formEn: "Capsule", formBn: "ক্যাপসুল" };
  if (/^(syr\.|syr\b|syrup\b)/.test(s)) return { formEn: "Syrup", formBn: "সিরাপ" };
  if (/^(susp\.|susp\b|suspension\b)/.test(s)) return { formEn: "Suspension", formBn: "সিরাপ" };
  if (/^(sol\.|soln\.|solution\b)/.test(s)) return { formEn: "Solution", formBn: "সিরাপ" };
  if (/^(inj\.|inj\b|injection\b)/.test(s)) return { formEn: "Injection", formBn: "ইনজেকশন" };
  if (/^(drops?\b|eye\s+drop|ear\s+drop|nasal\s+drop)/.test(s)) return { formEn: "Drops", formBn: "ড্রপস" };
  if (/^(cream\b|ointment\b|gel\b|lotion\b)/.test(s)) return { formEn: "Cream / Ointment", formBn: "মলম" };
  if (/^(inhaler\b|spray\b|nebulizer\b|respules?\b|rotacap\b|cozycap\b)/.test(s)) return { formEn: "Inhaler / Spray", formBn: "অন্যান্য" };
  if (/^(supp\.|supp\b|suppository\b)/.test(s)) return { formEn: "Suppository", formBn: "অন্যান্য" };
  if (/^(powder\b|sachet\b|ors\b)/.test(s)) return { formEn: "Powder / Sachet", formBn: "অন্যান্য" };
  return null;
}

function getFormPriority(form: string, rxName: string): number {
  const f = `${form} ${rxName}`.toLowerCase();
  if (f.includes("tablet") || /^tab\./.test(f)) return 10;
  if (f.includes("capsule") || /^cap\./.test(f)) return 9;
  if (f.includes("syrup") || /^syr\./.test(f)) return 8;
  if (f.includes("suspension") || /^susp\./.test(f)) return 7;
  if (f.includes("solution") || /^sol\./.test(f)) return 6;
  if (f.includes("drop")) return 5;
  if (f.includes("inhaler") || f.includes("spray")) return 4;
  if (f.includes("cream") || f.includes("ointment") || f.includes("gel")) return 3;
  if (f.includes("powder")) return 2;
  if (f.includes("injection") || /^inj\./.test(f)) return 1;
  if (f.includes("suppository") || /^supp\./.test(f)) return 0;
  return 5;
}

export function normalizeRxCore(raw: string): string {
  return (raw || "")
    .toLowerCase()
    .replace(
      /^(tab\.|tab|cap\.|cap|syr\.|syr|inj\.|inj|susp\.|susp|drops?|supp\.|supp|powder|cream|ointment|gel|spray|inhaler|sol\.|soln\.|solution)\s+/i,
      ""
    )
    .replace(
      /\s+(?:dispersible\s+tablets?|chewable\s+tablets?|tablets?|capsules?(?:\s*\([^)]+\))?|(?:im|iv|sc|im\/iv|iv\/im)\s+injection|injection|powder\s+for\s+suspension|oral\s+suspension|suspension|syrup|(?:pediatric|eye|ear|nasal|eye\/ear|oral|ophthalmic)\s+drops?|drops?|(?:vaginal|rectal)\s+suppositor(?:y|ies)|suppositor(?:y|ies)|(?:vaginal|topical)\s+cream|cream|(?:ophthalmic|topical|eye)\s+ointment|ointment|(?:topical|ophthalmic|oral)\s+gel|gel|metered-dose\s+inhaler\s*(?:\(mdi\))?|dry\s+powder\s+inhaler\s*(?:\(dpi\))?|inhaler|(?:nasal|topical|ocular|oral)\s+spray|spray|oral\s+powder|powder|(?:oral|ophthalmic|topical)\s+solution|solution)$/i,
      ""
    )
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Unit-insensitive core normalizer so that:
 * - "Tab. Napa 500" -> "napa500" === "Tab. Napa 500 mg" -> "napa500"
 * - "Cap. Sergel 20" -> "sergel20" === "Cap. Sergel 20 mg" -> "sergel20"
 * - "Tab. Bizoran 5/20" -> "bizoran520" === "Tab. Bizoran 5 mg+20 mg" -> "bizoran520"
 */
export function normalizeRxNoUnits(raw: string): string {
  return (raw || "")
    .toLowerCase()
    .replace(
      /^(tab\.|tab|cap\.|cap|syr\.|syr|inj\.|inj|susp\.|susp|drops?|supp\.|supp|powder|cream|ointment|gel|spray|inhaler|sol\.|soln\.|solution)\s+/i,
      ""
    )
    .replace(/\([^)]*\)/g, " ")
    .replace(
      /\b(?:mg|gm|g|mcg|ug|iu|ml|vial|ampoule|amp|sachet|tablets?|capsules?|syrup|suspension|injection|drops?|cream|ointment|gel|inhaler|spray|powder|solution|iv|im|sc|infusion|enteric|coated|extended|release|mups|xr|sr|er|cr)\b/gi,
      " "
    )
    .replace(/[^a-z0-9]/g, "");
}

export function normalizeGenericBase(rawGeneric: string): string {
  return (rawGeneric || "")
    .toLowerCase()
    .replace(/\[[^\]]*\]|\([^)]*\)/g, " ")
    .replace(
      /\b(?:sodium|potassium|calcium|magnesium|hydrochloride|hcl|dihydrate|trihydrate|monohydrate|anhydrous|maleate|fumarate|besilate|besylate|medoxomil|tromethamine|sulphate|sulfate|phosphate|tartrate|succinate|mesylate|acetate|citrate|nitrate|bromide|chloride|propionate|valerate|acetonide|furoate|pivalate|pivoxil|axetil|proxetil|cilexetil|palmitate|stearate|carbonate|orotate|gluconate|lactate|salicylate|hydrate)\b/gi,
      " "
    )
    .replace(/[^a-z0-9+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractBrandPhrase(raw: string): string {
  const stripped = (raw || "")
    .toLowerCase()
    .replace(
      /^(tab\.|tab|cap\.|cap|syr\.|syr|inj\.|inj|susp\.|susp|drops?|supp\.|supp|powder|cream|ointment|gel|spray|inhaler|sol\.|soln\.|solution)\s+/i,
      ""
    )
    .trim();
  const m = stripped.match(/^([a-z][a-z\s-]*?)(?:\s+\d|\s*\(|$)/);
  return (m ? m[1] : stripped).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function extractFirstBrandWord(raw: string): string {
  const stripped = (raw || "")
    .toLowerCase()
    .replace(
      /^(tab\.|tab|cap\.|cap|syr\.|syr|inj\.|inj|susp\.|susp|drops?|supp\.|supp|powder|cream|ointment|gel|spray|inhaler|sol\.|soln\.|solution)\s+/i,
      ""
    )
    .trim();
  const m = stripped.match(/^([a-z0-9]+)/);
  return m ? m[1] : stripped;
}

export function toBengaliDosageForm(
  form: string,
  rxName?: string
): MatchedMedicineRecord["dosageFormBn"] {
  const explicit = rxName ? detectExplicitFormFromPrefix(rxName) : null;
  if (explicit) return explicit.formBn;

  const f = (form || "").toLowerCase();
  const n = (rxName || "").toLowerCase();
  if (f.includes("syrup") || f.includes("suspension") || f.includes("solution") || /\b(syr\.|syrup|susp\.|suspension|sol\.)\b/.test(n)) {
    return "সিরাপ";
  }
  if (f.includes("capsule") || /\b(cap\.|capsule)\b/.test(n)) {
    return "ক্যাপসুল";
  }
  if (f.includes("injection") || /\b(inj\.|injection)\b/.test(n)) {
    return "ইনজেকশন";
  }
  if (f.includes("drop") || /\b(drops?)\b/.test(n)) {
    return "ড্রপস";
  }
  if (f.includes("ointment") || f.includes("cream") || f.includes("gel") || /\b(ointment|cream|gel)\b/.test(n)) {
    return "মলম";
  }
  if (f.includes("tablet") || /\b(tab\.|tablet)\b/.test(n)) {
    return "ট্যাবলেট";
  }
  return "ট্যাবলেট";
}

const BRAND_FALLBACK_ALIASES: Record<string, string> = {
  rocephin: "ceftriaxone",
  concor: "bisoprolol",
  atorva: "atorvastatin",
  visceralgin: "tiemonium",
  fefol: "ferrous",
  ipil: "levonorgestrel",
  disprin: "aspirin",
  flagyl: "metronidazole",
  entacyd: "aluminium hydroxide + magnesium hydroxide",
};

function compilePayload(payload: RawMedicineDbPayload): CompiledMedicineDb {
  const all: MatchedMedicineRecord[] = [];
  const byExactRx = new Map<string, MatchedMedicineRecord>();
  const byNormCore = new Map<string, MatchedMedicineRecord>();
  const byNormNoUnits = new Map<string, MatchedMedicineRecord>();
  const byFormAndNoUnits = new Map<string, MatchedMedicineRecord>();
  const byFormAndBrand = new Map<string, MatchedMedicineRecord>();
  const byBrandPhrase = new Map<string, MatchedMedicineRecord>();
  const byFirstWord = new Map<string, MatchedMedicineRecord>();
  const byGenericLower = new Map<string, MatchedMedicineRecord>();
  const byGenericBase = new Map<string, MatchedMedicineRecord>();

  const shouldReplace = (existing: MatchedMedicineRecord | undefined, candidate: MatchedMedicineRecord): boolean => {
    if (!existing) return true;
    return getFormPriority(candidate.dosageForm, candidate.rxName) > getFormPriority(existing.dosageForm, existing.rxName);
  };

  for (const [rxName, gIdx, fIdx] of payload.meds) {
    const gTuple = payload.generics[gIdx] || ["", "", "", ""];
    const form = payload.forms[fIdx] || "";
    const record: MatchedMedicineRecord = {
      rxName,
      genericName: (gTuple[0] || "").replace(/\u00a0/g, " ").trim(),
      dosageForm: form,
      dosageFormBn: toBengaliDosageForm(form, rxName),
      indications: gTuple[1] || "",
      modeOfAction: gTuple[2] || "",
      sideEffects: gTuple[3] || "",
    };

    all.push(record);

    const exactKey = rxName.toLowerCase().trim();
    if (!byExactRx.has(exactKey)) byExactRx.set(exactKey, record);

    const normKey = normalizeRxCore(rxName);
    if (normKey && shouldReplace(byNormCore.get(normKey), record)) {
      byNormCore.set(normKey, record);
    }

    const noUnitsKey = normalizeRxNoUnits(rxName);
    if (noUnitsKey && shouldReplace(byNormNoUnits.get(noUnitsKey), record)) {
      byNormNoUnits.set(noUnitsKey, record);
    }

    const formBn = record.dosageFormBn;
    if (noUnitsKey) {
      const fk = `${formBn}:${noUnitsKey}`;
      if (!byFormAndNoUnits.has(fk)) byFormAndNoUnits.set(fk, record);
    }

    const phraseKey = extractBrandPhrase(rxName);
    if (phraseKey) {
      const fbk = `${formBn}:${phraseKey}`;
      if (!byFormAndBrand.has(fbk)) byFormAndBrand.set(fbk, record);
      if (shouldReplace(byBrandPhrase.get(phraseKey), record)) {
        byBrandPhrase.set(phraseKey, record);
      }
    }

    const firstWord = extractFirstBrandWord(rxName);
    if (firstWord && firstWord.length >= 3) {
      const fwk = `${formBn}:${firstWord}`;
      if (!byFormAndBrand.has(fwk)) byFormAndBrand.set(fwk, record);
      if (shouldReplace(byFirstWord.get(firstWord), record)) {
        byFirstWord.set(firstWord, record);
      }
    }

    if (record.genericName) {
      const gKey = record.genericName.toLowerCase().trim();
      if (shouldReplace(byGenericLower.get(gKey), record)) {
        byGenericLower.set(gKey, record);
      }
      const gBase = normalizeGenericBase(record.genericName);
      if (gBase && shouldReplace(byGenericBase.get(gBase), record)) {
        byGenericBase.set(gBase, record);
      }
    }
  }

  return {
    all,
    byExactRx,
    byNormCore,
    byNormNoUnits,
    byFormAndNoUnits,
    byFormAndBrand,
    byBrandPhrase,
    byFirstWord,
    byGenericLower,
    byGenericBase,
  };
}

export async function loadMedicinesDb(): Promise<CompiledMedicineDb | null> {
  if (compiledCache) return compiledCache;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      // Server-side Node environment: read directly from disk if available
      if (typeof window === "undefined") {
        const fs = await import("fs");
        const path = await import("path");
        const filePath = path.join(process.cwd(), "public", "data", "medicines-db.json");
        if (fs.existsSync(filePath)) {
          const raw = fs.readFileSync(filePath, "utf8");
          const parsed = JSON.parse(raw) as RawMedicineDbPayload;
          compiledCache = compilePayload(parsed);
          return compiledCache;
        }
      } else {
        // Browser environment: fetch from static public asset
        const res = await fetch("/data/medicines-db.json");
        if (res.ok) {
          const parsed = (await res.json()) as RawMedicineDbPayload;
          compiledCache = compilePayload(parsed);
          listeners.forEach((cb) => cb());
          return compiledCache;
        }
      }
    } catch (err) {
      console.error("[medicines-db] Failed to load medicines-db.json:", err);
    } finally {
      loadingPromise = null;
    }
    return null;
  })();

  return loadingPromise;
}

function applyExplicitPrefixOverride(
  record: MatchedMedicineRecord,
  rawName: string
): MatchedMedicineRecord {
  const explicit = detectExplicitFormFromPrefix(rawName);
  if (!explicit) return record;
  return {
    ...record,
    dosageForm: explicit.formEn,
    dosageFormBn: explicit.formBn,
  };
}

/**
 * Synchronously match a medicine name against the compiled 25,534-medicine database.
 * Returns null if the database is not yet loaded or no match is found.
 */
export function matchMedicineSync(rawName: string): MatchedMedicineRecord | null {
  if (!compiledCache || !rawName) return null;
  const trimmed = rawName.trim();
  if (!trimmed) return null;

  const explicitForm = detectExplicitFormFromPrefix(trimmed);

  // 1. Exact Rx name match (e.g. "Tab. Rosustat 10 mg")
  const exact = compiledCache.byExactRx.get(trimmed.toLowerCase());
  if (exact) return exact;

  // 2. Normalized alphanumeric core match (e.g. "rosustat10mg")
  const norm = normalizeRxCore(trimmed);
  if (norm) {
    const byNorm = compiledCache.byNormCore.get(norm);
    if (byNorm) return applyExplicitPrefixOverride(byNorm, trimmed);
  }

  // 3. Unit-insensitive match (e.g. "Tab. Napa 500" -> "napa500", "Tab. Bizoran 5/20" -> "bizoran520")
  const noUnits = normalizeRxNoUnits(trimmed);
  if (noUnits) {
    if (explicitForm) {
      const byFormNoUnits = compiledCache.byFormAndNoUnits.get(`${explicitForm.formBn}:${noUnits}`);
      if (byFormNoUnits) return byFormNoUnits;
    }
    const byNoUnits = compiledCache.byNormNoUnits.get(noUnits);
    if (byNoUnits) return applyExplicitPrefixOverride(byNoUnits, trimmed);
  }

  // 4. Brand phrase match (respecting dosage form prefix if provided)
  const phrase = extractBrandPhrase(trimmed);
  if (phrase) {
    if (explicitForm) {
      const byFormPhrase = compiledCache.byFormAndBrand.get(`${explicitForm.formBn}:${phrase}`);
      if (byFormPhrase) return byFormPhrase;
    }
    const byPhrase = compiledCache.byBrandPhrase.get(phrase);
    if (byPhrase) return applyExplicitPrefixOverride(byPhrase, trimmed);
  }

  // 5. First brand word match (e.g. "acical" for "Tab. Acical-MX")
  const firstWord = extractFirstBrandWord(trimmed);
  if (firstWord && firstWord.length >= 3) {
    if (explicitForm) {
      const byFormFw = compiledCache.byFormAndBrand.get(`${explicitForm.formBn}:${firstWord}`);
      if (byFormFw) return byFormFw;
    }
    const byFw = compiledCache.byFirstWord.get(firstWord);
    if (byFw) return applyExplicitPrefixOverride(byFw, trimmed);

    // Check curated brand alias
    const aliasGeneric = BRAND_FALLBACK_ALIASES[firstWord];
    if (aliasGeneric) {
      const byAlias = compiledCache.byGenericBase.get(aliasGeneric) || compiledCache.byGenericLower.get(aliasGeneric);
      if (byAlias) return applyExplicitPrefixOverride(byAlias, trimmed);
    }
  }

  // 6. Generic name match (exact or salt-stripped base generic)
  const lower = trimmed.toLowerCase().replace(/^(tab\.|cap\.|syr\.|inj\.|susp\.|drops?)\s+/i, "").trim();
  const byGen = compiledCache.byGenericLower.get(lower);
  if (byGen) return applyExplicitPrefixOverride(byGen, trimmed);

  const gBase = normalizeGenericBase(lower);
  if (gBase) {
    const byBase = compiledCache.byGenericBase.get(gBase);
    if (byBase) return applyExplicitPrefixOverride(byBase, trimmed);
  }

  return null;
}

export async function matchMedicineAsync(rawName: string): Promise<MatchedMedicineRecord | null> {
  await loadMedicinesDb();
  return matchMedicineSync(rawName);
}

/**
 * Search across all 25,534 medicines by brand name, Rx name, or generic name.
 */
export function searchMedicinesSync(query: string, limit = 40): MatchedMedicineRecord[] {
  if (!compiledCache) return [];
  const q = (query || "").toLowerCase().trim();
  if (q.length < 2) return [];

  const qCore = q.replace(/^(tab\.|tab|cap\.|cap|syr\.|syr|inj\.|inj|susp\.|susp|drops?)\s+/i, "").trim();
  const scored: { rec: MatchedMedicineRecord; score: number }[] = [];

  for (const rec of compiledCache.all) {
    const rxLower = rec.rxName.toLowerCase();
    const coreLower = rxLower.replace(/^(tab\.|cap\.|syr\.|inj\.|susp\.|drops|supp\.|cream|ointment|gel|inhaler|spray|powder|sol\.)\s+/i, "");
    const genLower = rec.genericName.toLowerCase();

    let score = -1;
    if (coreLower === qCore || rxLower === q) {
      score = 1000;
    } else if (coreLower.startsWith(qCore)) {
      score = 850 + Math.max(0, 40 - coreLower.length);
    } else if (rxLower.startsWith(q)) {
      score = 780 + Math.max(0, 40 - rxLower.length);
    } else if (genLower.startsWith(qCore)) {
      score = 720;
    } else if (coreLower.includes(qCore)) {
      score = 550;
    } else if (genLower.includes(qCore)) {
      score = 450;
    }

    if (score > 0) {
      scored.push({ rec, score });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.rec.rxName.localeCompare(b.rec.rxName));
  return scored.slice(0, limit).map((s) => s.rec);
}

export function getLoadedMedicinesList(): MatchedMedicineRecord[] {
  return compiledCache?.all ?? [];
}

/**
 * React hook that ensures the 25,534-medicine database is loaded in the browser
 * and triggers a re-render once ready.
 */
export function useMedicinesDbReady(): boolean {
  const [ready, setReady] = useState<boolean>(!!compiledCache);

  useEffect(() => {
    if (compiledCache) {
      setReady(true);
      return;
    }
    const onLoaded = () => setReady(true);
    listeners.add(onLoaded);
    loadMedicinesDb();
    return () => {
      listeners.delete(onLoaded);
    };
  }, []);

  return ready;
}
