import { supabase } from "@/integrations/supabase/client";

export type MasterKind = "cc" | "investigation" | "frequency" | "instruction" | "advice" | "medicine";

export type NamedOption = { id: string; name: string };

/**
 * Shared (super-admin curated) prescription library. Rows live in the master
 * business and are exposed to every signed-in doctor/clinic through the
 * `rx_master_options` security-definer function — so a brand new doctor
 * account still gets the full C/C, investigation, frequency, instruction,
 * advice and medicine lists.
 */
export async function fetchMasterOptions(
  kind: MasterKind,
  limit = 3000,
  search?: string,
): Promise<NamedOption[]> {
  const { data, error } = await (supabase as any).rpc("rx_master_options", {
    _kind: kind,
    _limit: limit,
    _search: (search ?? "").trim() || null,
  });
  if (error) return [];
  return ((data ?? []) as NamedOption[]).filter((r) => !!r?.name);
}

/** Merge business-owned rows with the shared master library (no duplicates). */
export function mergeByName(...lists: NamedOption[][]): NamedOption[] {
  const seen = new Set<string>();
  const out: NamedOption[] = [];
  for (const list of lists) {
    for (const r of list) {
      const k = r.name.trim().toLowerCase();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(r);
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
