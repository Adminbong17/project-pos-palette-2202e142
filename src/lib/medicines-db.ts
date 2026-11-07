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
  byBrandPhrase: Map<string, MatchedMedicineRecord>;
  byFirstWord: Map<string, MatchedMedicineRecord>;
  byGenericLower: Map<string, MatchedMedicineRecord>;
}

let compiledCache: CompiledMedicineDb | null = null;
let loadingPromise: Promise<CompiledMedicineDb | null> | null = null;
const listeners = new Set<() => void>();

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

function compilePayload(payload: RawMedicineDbPayload): CompiledMedicineDb {
  const all: MatchedMedicineRecord[] = [];
  const byExactRx = new Map<string, MatchedMedicineRecord>();
  const byNormCore = new Map<string, MatchedMedicineRecord>();
  const byBrandPhrase = new Map<string, MatchedMedicineRecord>();
  const byFirstWord = new Map<string, MatchedMedicineRecord>();
  const byGenericLower = new Map<string, MatchedMedicineRecord>();

  for (const [rxName, gIdx, fIdx] of payload.meds) {
    const gTuple = payload.generics[gIdx] || ["", "", "", ""];
    const form = payload.forms[fIdx] || "";
    const record: MatchedMedicineRecord = {
      rxName,
      genericName: gTuple[0] || "",
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
    if (normKey && !byNormCore.has(normKey)) byNormCore.set(normKey, record);

    const phraseKey = extractBrandPhrase(rxName);
    if (phraseKey && !byBrandPhrase.has(phraseKey)) byBrandPhrase.set(phraseKey, record);

    const firstWord = extractFirstBrandWord(rxName);
    if (firstWord && firstWord.length >= 3 && !byFirstWord.has(firstWord)) {
      byFirstWord.set(firstWord, record);
    }

    if (record.genericName) {
      const gKey = record.genericName.toLowerCase().trim();
      if (!byGenericLower.has(gKey)) byGenericLower.set(gKey, record);
    }
  }

  return {
    all,
    byExactRx,
    byNormCore,
    byBrandPhrase,
    byFirstWord,
    byGenericLower,
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

/**
 * Synchronously match a medicine name against the compiled 25,534-medicine database.
 * Returns null if the database is not yet loaded or no match is found.
 */
export function matchMedicineSync(rawName: string): MatchedMedicineRecord | null {
  if (!compiledCache || !rawName) return null;
  const trimmed = rawName.trim();
  if (!trimmed) return null;

  // 1. Exact Rx name match (e.g. "Tab. Rosustat 10 mg")
  const exact = compiledCache.byExactRx.get(trimmed.toLowerCase());
  if (exact) return exact;

  // 2. Normalized alphanumeric core match (e.g. "rosustat10mg" matches both "Tab. Rosustat 10 mg" and "Rosustat 10 mg tablets")
  const norm = normalizeRxCore(trimmed);
  if (norm) {
    const byNorm = compiledCache.byNormCore.get(norm);
    if (byNorm) return byNorm;
  }

  // 3. Brand phrase match (e.g. "abetis plus" or "rosustat")
  const phrase = extractBrandPhrase(trimmed);
  if (phrase) {
    const byPhrase = compiledCache.byBrandPhrase.get(phrase);
    if (byPhrase) return byPhrase;
  }

  // 4. First brand word match (e.g. "acical" for "Tab. Acical-MX")
  const firstWord = extractFirstBrandWord(trimmed);
  if (firstWord && firstWord.length >= 3) {
    const byFw = compiledCache.byFirstWord.get(firstWord);
    if (byFw) return byFw;
  }

  // 5. Generic name match
  const byGen = compiledCache.byGenericLower.get(trimmed.toLowerCase());
  if (byGen) return byGen;

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
