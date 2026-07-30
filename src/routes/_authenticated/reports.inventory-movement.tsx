import { FloatingSearch } from "@/components/floating-search";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { fetchAll, fetchAllIn } from "@/lib/fetch-all";
import { formatDate } from "@/lib/utils";
import { ArrowDownCircle, ArrowUpCircle, Boxes, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/reports/inventory-movement")({
  head: () => ({ meta: [{ title: "Inventory Movement — QweekPOS" }] }),
  component: InventoryMovementPage,
});

type Movement = {
  date: string;
  kind: "purchase" | "sale" | "adjustment_add" | "adjustment_remove";
  product_id: string;
  product_name: string;
  sku: string | null;
  qty: number; // signed: + in, - out
  ref: string | null;
  note?: string | null;
};

function InventoryMovementPage() {
  const { data: business } = useCurrentBusiness();
  const businessId = business?.id;
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "in" | "out">("all");

  const { data: products = [] } = useQuery({
    queryKey: ["im-products", businessId],
    enabled: !!businessId,
    queryFn: async () =>
      fetchAll(() => supabase.from("products").select("id, name, sku").eq("business_id", businessId!)),
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ["im-purchases", businessId],
    enabled: !!businessId,
    queryFn: async () =>
      fetchAll(() =>
        supabase
          .from("transactions")
          .select("id, ref_no, transaction_date")
          .eq("business_id", businessId!)
          .eq("type", "purchase")
          .eq("status", "received")
      ),
  });

  const { data: sales = [] } = useQuery({
    queryKey: ["im-sales", businessId],
    enabled: !!businessId,
    queryFn: async () =>
      fetchAll(() =>
        supabase
          .from("transactions")
          .select("id, invoice_no, transaction_date")
          .eq("business_id", businessId!)
          .eq("type", "sell")
      ),
  });

  const { data: purchaseLines = [] } = useQuery({
    queryKey: ["im-purchase-lines", businessId, purchases.length],
    enabled: !!businessId && purchases.length > 0,
    queryFn: async () =>
      fetchAllIn(
        (chunk) =>
          supabase
            .from("transaction_purchase_lines")
            .select("transaction_id, product_id, quantity")
            .in("transaction_id", chunk),
        purchases.map((p: any) => p.id),
      ),
  });

  const { data: sellLines = [] } = useQuery({
    queryKey: ["im-sell-lines", businessId, sales.length],
    enabled: !!businessId && sales.length > 0,
    queryFn: async () =>
      fetchAllIn(
        (chunk) =>
          supabase
            .from("transaction_sell_lines")
            .select("transaction_id, product_id, quantity")
            .in("transaction_id", chunk),
        sales.map((s: any) => s.id),
      ),
  });

  const { data: adjustments = [] } = useQuery({
    queryKey: ["im-adjustments", businessId],
    enabled: !!businessId,
    queryFn: async () =>
      fetchAll(() =>
        supabase
          .from("stock_adjustments")
          .select("id, ref_no, adjustment_type, adjustment_date, reason")
          .eq("business_id", businessId!)
      ),
  });

  const { data: adjustmentLines = [] } = useQuery({
    queryKey: ["im-adjustment-lines", businessId, adjustments.length],
    enabled: !!businessId && adjustments.length > 0,
    queryFn: async () =>
      fetchAllIn(
        (chunk) =>
          supabase
            .from("stock_adjustment_lines")
            .select("stock_adjustment_id, product_id, quantity")
            .in("stock_adjustment_id", chunk),
        adjustments.map((a: any) => a.id),
      ),
  });

  const movements: Movement[] = useMemo(() => {
    const productById = new Map(products.map((p: any) => [p.id, p]));
    const purchaseById = new Map(purchases.map((p: any) => [p.id, p]));
    const saleById = new Map(sales.map((s: any) => [s.id, s]));
    const adjById = new Map(adjustments.map((a: any) => [a.id, a]));
    const out: Movement[] = [];

    for (const l of purchaseLines as any[]) {
      const p: any = purchaseById.get(l.transaction_id);
      const prod: any = productById.get(l.product_id);
      if (!p || !prod) continue;
      out.push({
        date: p.transaction_date,
        kind: "purchase",
        product_id: l.product_id,
        product_name: prod.name,
        sku: prod.sku,
        qty: Number(l.quantity || 0),
        ref: p.ref_no,
      });
    }

    for (const l of sellLines as any[]) {
      const s: any = saleById.get(l.transaction_id);
      const prod: any = productById.get(l.product_id);
      if (!s || !prod) continue;
      out.push({
        date: s.transaction_date,
        kind: "sale",
        product_id: l.product_id,
        product_name: prod.name,
        sku: prod.sku,
        qty: -Number(l.quantity || 0),
        ref: s.invoice_no,
      });
    }

    for (const l of adjustmentLines as any[]) {
      const a: any = adjById.get(l.stock_adjustment_id);
      const prod: any = productById.get(l.product_id);
      if (!a || !prod) continue;
      const q = Number(l.quantity || 0);
      const isAdd = q >= 0 && a.adjustment_type !== "abnormal" ? true : q > 0;
      // stock_adjustment_lines.quantity is signed by our schema (positive add, negative remove)
      out.push({
        date: a.adjustment_date,
        kind: q >= 0 ? "adjustment_add" : "adjustment_remove",
        product_id: l.product_id,
        product_name: prod.name,
        sku: prod.sku,
        qty: q,
        ref: a.ref_no,
        note: a.reason,
      });
    }

    out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return out;
  }, [products, purchases, sales, adjustments, purchaseLines, sellLines, adjustmentLines]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return movements.filter((m) => {
      if (kindFilter === "in" && m.qty <= 0) return false;
      if (kindFilter === "out" && m.qty >= 0) return false;
      if (!q) return true;
      return (
        m.product_name.toLowerCase().includes(q) ||
        (m.sku ?? "").toLowerCase().includes(q) ||
        (m.ref ?? "").toLowerCase().includes(q)
      );
    });
  }, [movements, search, kindFilter]);

  const totals = useMemo(() => {
    let inQty = 0, outQty = 0;
    for (const m of filtered) {
      if (m.qty >= 0) inQty += m.qty;
      else outQty += -m.qty;
    }
    return { inQty, outQty, net: inQty - outQty, count: filtered.length };
  }, [filtered]);

  const kindLabel = (k: Movement["kind"]) =>
    k === "purchase" ? "Purchase"
    : k === "sale" ? "Sale"
    : k === "adjustment_add" ? "Stock Adjust (+)"
    : "Stock Adjust (−)";

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
          <Boxes className="h-6 w-6" /> Inventory Movement
        </h1>
        <p className="text-sm text-muted-foreground">
          Every stock-in and stock-out event per product — purchases, sales and adjustments.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border bg-card p-4">
          <div className="text-[11px] uppercase text-muted-foreground">Total In</div>
          <div className="mt-2 font-display text-2xl font-bold text-emerald-500">+{totals.inQty}</div>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <div className="text-[11px] uppercase text-muted-foreground">Total Out</div>
          <div className="mt-2 font-display text-2xl font-bold text-rose-500">−{totals.outQty}</div>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <div className="text-[11px] uppercase text-muted-foreground">Net Change</div>
          <div className="mt-2 font-display text-2xl font-bold">{totals.net >= 0 ? `+${totals.net}` : totals.net}</div>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <div className="text-[11px] uppercase text-muted-foreground">Movements</div>
          <div className="mt-2 font-display text-2xl font-bold">{totals.count}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <FloatingSearch spacer={44}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search product, SKU or reference…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </FloatingSearch>
        <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
          {(["all", "in", "out"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKindFilter(k)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                kindFilter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {k === "all" ? "All" : k === "in" ? "Stock In" : "Stock Out"}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card overflow-x-auto">
        <Table className="min-w-[820px]">
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">Qty</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                  No movements found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.slice(0, 1000).map((m, i) => (
                <TableRow key={i}>
                  <TableCell className="whitespace-nowrap">{formatDate(m.date)}</TableCell>
                  <TableCell className="font-medium">{m.product_name}</TableCell>
                  <TableCell className="text-muted-foreground">{m.sku ?? "—"}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px]">
                      {m.qty >= 0 ? (
                        <ArrowUpCircle className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <ArrowDownCircle className="h-3 w-3 text-rose-500" />
                      )}
                      {kindLabel(m.kind)}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{m.ref ?? "—"}</TableCell>
                  <TableCell
                    className={`text-right font-semibold ${m.qty >= 0 ? "text-emerald-500" : "text-rose-500"}`}
                  >
                    {m.qty >= 0 ? `+${m.qty}` : m.qty}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {filtered.length > 1000 && (
          <div className="p-3 text-center text-xs text-muted-foreground">
            Showing latest 1000 of {filtered.length} movements. Use search to narrow.
          </div>
        )}
      </div>
    </div>
  );
}
