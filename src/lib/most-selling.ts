// Shared "most selling items" aggregation for the POS dashboard and the
// /most-selling report page. Handles PostgREST's 1000-row cap via fetchAll
// and large id lists via fetchAllIn.

import { supabase } from "@/integrations/supabase/client";
import { fetchAll, fetchAllIn } from "@/lib/fetch-all";

export type MostSellingItem = {
  productId: string;
  name: string;
  sku: string | null;
  qty: number;
  revenue: number;
};

/** Dhaka (UTC+6) calendar range helpers — the business operates in Bangladesh. */
export function dhakaMonthRange(offsetMonths = 0): { fromISO: string; toISO: string; label: string } {
  const shifted = new Date(Date.now() + 6 * 3600 * 1000);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth() + 1 + offsetMonths; // 1-12 relative
  const base = new Date(Date.UTC(y, m - 1, 1));
  const next = new Date(Date.UTC(y, m, 1));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return {
    fromISO: `${fmt(base)}T00:00:00.000+06:00`,
    toISO: `${fmt(next)}T00:00:00.000+06:00`,
    label: base.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" }),
  };
}

export function dhakaDayRange(dateStr: string): { fromISO: string; toISO: string } {
  const d = new Date(`${dateStr}T00:00:00.000+06:00`);
  const next = new Date(d.getTime() + 24 * 3600 * 1000);
  return {
    fromISO: `${dateStr}T00:00:00.000+06:00`,
    toISO: next.toISOString(),
  };
}

export async function fetchMostSelling(
  businessId: string,
  fromISO: string,
  toISO: string,
  limit: number,
): Promise<MostSellingItem[]> {
  const txs = await fetchAll<{ id: string }>(() =>
    supabase
      .from("transactions")
      .select("id")
      .eq("business_id", businessId)
      .eq("type", "sell")
      .eq("status", "final")
      .gte("created_at", fromISO)
      .lt("created_at", toISO),
  );
  const ids = txs.map((t) => t.id);
  if (ids.length === 0) return [];

  const lines = await fetchAllIn<{
    product_id: string;
    quantity: number;
    unit_price: number;
    unit_price_inc_tax: number;
  }>(
    (chunk) =>
      supabase
        .from("transaction_sell_lines")
        .select("product_id, quantity, unit_price, unit_price_inc_tax")
        .in("transaction_id", chunk),
    ids,
  );
  if (lines.length === 0) return [];

  const products = await fetchAllIn<{ id: string; name: string; sku: string | null }>(
    (chunk) => supabase.from("products").select("id, name, sku").in("id", chunk),
    lines.map((l) => l.product_id),
  );
  const pMap = new Map(products.map((p) => [p.id, p]));

  const agg = new Map<string, MostSellingItem>();
  for (const l of lines) {
    const p = pMap.get(l.product_id);
    if (!p) continue;
    const cur = agg.get(l.product_id) ?? {
      productId: p.id,
      name: p.name,
      sku: p.sku,
      qty: 0,
      revenue: 0,
    };
    cur.qty += Number(l.quantity || 0);
    cur.revenue += Number(l.quantity || 0) * Number(l.unit_price_inc_tax ?? l.unit_price ?? 0);
    agg.set(l.product_id, cur);
  }

  return Array.from(agg.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit);
}
