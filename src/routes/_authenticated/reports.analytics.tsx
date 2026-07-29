import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { useCurrentRole } from "@/hooks/use-current-role";
import { fetchAll, fetchAllIn } from "@/lib/fetch-all";
import {
  Briefcase, PackageOpen, ShoppingCart, TrendingUp, Coins, HandCoins,
  CreditCard, PlusCircle, Layers, Gem, FileMinus, ReceiptText, Boxes, ArrowLeftRight,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports/analytics")({
  head: () => ({ meta: [{ title: "Business Analytics — QweekPOS" }] }),
  component: AnalyticsPage,
});

type RangeKey = "1m" | "6m" | "1y" | "all";

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function monthsAgo(n: number) { const d = startOfDay(new Date()); d.setMonth(d.getMonth() - n); return d; }

function AnalyticsPage() {
  const { data: business } = useCurrentBusiness();
  const { isAdmin, isLoading: roleLoading } = useCurrentRole();
  const businessId = business?.id;
  const currency = "BDT";

  const [range, setRange] = useState<RangeKey>("6m");
  const fromDate = useMemo(() => {
    if (range === "1m") return monthsAgo(1);
    if (range === "6m") return monthsAgo(6);
    if (range === "1y") return monthsAgo(12);
    return null;
  }, [range]);

  // Sales (sell transactions)
  const { data: sales = [] } = useQuery({
    queryKey: ["an-sales", businessId, range],
    enabled: !!businessId,
    queryFn: async () =>
      fetchAll(() => {
        let q = supabase.from("transactions")
          .select("id, transaction_date, final_total, total_paid, discount_amount")
          .eq("business_id", businessId!).eq("type", "sell");
        if (fromDate) q = q.gte("transaction_date", fromDate.toISOString());
        return q;
      }),
  });

  const { data: sellLines = [] } = useQuery({
    queryKey: ["an-sell-lines", businessId, sales.length],
    enabled: !!businessId && sales.length > 0,
    queryFn: async () => {
      const ids = sales.map((s: any) => s.id);
      return fetchAllIn(
        (chunk) => supabase.from("transaction_sell_lines")
          .select("transaction_id, product_id, variation_id, quantity, unit_price")
          .in("transaction_id", chunk),
        ids,
      );
    },
  });

  const { data: variations = [] } = useQuery({
    queryKey: ["an-variations", businessId],
    enabled: !!businessId,
    queryFn: async () =>
      fetchAll(() => supabase.from("variations")
        .select("id, product_id, default_purchase_price, default_sell_price")),
  });

  const { data: stockRows = [] } = useQuery({
    queryKey: ["an-stock", businessId],
    enabled: !!businessId,
    queryFn: async () =>
      fetchAll(() => supabase.from("variation_location_details")
        .select("variation_id, qty_available")),
  });

  const { data: adjustments = [] } = useQuery({
    queryKey: ["an-adjustments", businessId, range],
    enabled: !!businessId,
    queryFn: async () =>
      fetchAll(() => {
        let q = supabase.from("stock_adjustments")
          .select("id, adjustment_type, adjustment_date, total_amount, total_amount_recovered")
          .eq("business_id", businessId!);
        if (fromDate) q = q.gte("adjustment_date", fromDate.toISOString());
        return q;
      }),
  });

  const { data: productCount = 0 } = useQuery({
    queryKey: ["an-product-count", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { count } = await supabase.from("products").select("*", { count: "exact", head: true })
        .eq("business_id", businessId!);
      return count ?? 0;
    },
  });

  const m = useMemo(() => {
    // Inventory value by variation
    const varById = new Map(variations.map((v: any) => [v.id, v]));
    let invCost = 0, invSell = 0;
    for (const r of stockRows as any[]) {
      const v: any = varById.get(r.variation_id);
      if (!v) continue;
      const q = Number(r.qty_available || 0);
      invCost += q * Number(v.default_purchase_price || 0);
      invSell += q * Number(v.default_sell_price || 0);
    }

    // Sales aggregates
    const totalSales = sales.reduce((a: number, s: any) => a + Number(s.final_total || 0), 0);
    const totalPaid = sales.reduce((a: number, s: any) => a + Number(s.total_paid || 0), 0);
    const totalDue = Math.max(0, sales.reduce((a: number, s: any) => a + (Number(s.final_total || 0) - Number(s.total_paid || 0)), 0));

    // Cost per sale invoice (for paid-portion profit)
    const costByTx = new Map<string, number>();
    const revByTx = new Map<string, number>();
    for (const l of sellLines as any[]) {
      const v: any = varById.get(l.variation_id);
      const cost = Number(v?.default_purchase_price || 0) * Number(l.quantity || 0);
      const rev = Number(l.unit_price || 0) * Number(l.quantity || 0);
      costByTx.set(l.transaction_id, (costByTx.get(l.transaction_id) || 0) + cost);
      revByTx.set(l.transaction_id, (revByTx.get(l.transaction_id) || 0) + rev);
    }
    const totalCost = [...costByTx.values()].reduce((a, b) => a + b, 0);
    const salesProfit = totalSales - totalCost;

    // Profit on paid portion: per-invoice profit * (paid/final_total)
    let paidProfit = 0;
    for (const s of sales as any[]) {
      const ft = Number(s.final_total || 0);
      const paid = Number(s.total_paid || 0);
      const cost = costByTx.get(s.id) || 0;
      const profit = ft - cost;
      const ratio = ft > 0 ? Math.min(1, paid / ft) : 0;
      paidProfit += profit * ratio;
    }

    // Losses (abnormal stock adjustments)
    const totalLoss = adjustments.reduce((a: number, x: any) => {
      if (x.adjustment_type !== "abnormal") return a;
      return a + (Number(x.total_amount || 0) - Number(x.total_amount_recovered || 0));
    }, 0);

    const totalExpenses = 0; // no expenses table yet
    const pureNet = salesProfit - totalLoss - totalExpenses - totalDue;

    return {
      invCost, invSell,
      totalSales, totalPaid, totalDue,
      salesProfit, paidProfit,
      totalLoss, totalExpenses, pureNet,
      txCount: sales.length + adjustments.length,
      itemCount: productCount,
    };
  }, [variations, stockRows, sales, sellLines, adjustments, productCount]);

  const fmt = (n: number) => `${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`;

  const cards: Array<{ label: string; sub?: string; value: number; icon: any; tint: string; valueClass?: string }> = [
    { label: "Current Business Values", value: m.invCost + m.totalDue, icon: Briefcase, tint: "bg-violet-500/15 text-violet-400" },
    { label: "Current Product Value", value: m.invSell, icon: PackageOpen, tint: "bg-emerald-500/15 text-emerald-400" },
    { label: "Total Sales Balance", value: m.totalSales, icon: ShoppingCart, tint: "bg-blue-500/15 text-blue-400" },
    { label: "Total Sales Profit", value: m.salesProfit, icon: TrendingUp, tint: "bg-cyan-500/15 text-cyan-400" },
    { label: "Pure Net Profit", sub: "(without Exp, Loss & Due)", value: m.pureNet, icon: Coins, tint: "bg-teal-500/15 text-teal-400" },
    { label: "Total Due Balance", value: m.totalDue, icon: HandCoins, tint: "bg-amber-500/15 text-amber-400" },
    { label: "Total Current Sales Profit", sub: "(without dues)", value: m.paidProfit, icon: CreditCard, tint: "bg-emerald-500/15 text-emerald-400", valueClass: "text-emerald-400" },
    { label: "Profit", sub: "(Without Losses)", value: m.salesProfit - m.totalExpenses, icon: PlusCircle, tint: "bg-sky-500/15 text-sky-400" },
    { label: "Profit", sub: "(Without Expenses)", value: m.salesProfit - m.totalLoss, icon: Layers, tint: "bg-indigo-500/15 text-indigo-400" },
    { label: "Sales Profit", sub: "(without Expenses and losses)", value: m.salesProfit - m.totalExpenses - m.totalLoss, icon: Gem, tint: "bg-pink-500/15 text-pink-400" },
    { label: "Total Loss Balance", value: m.totalLoss, icon: FileMinus, tint: "bg-rose-500/15 text-rose-400", valueClass: "text-rose-400" },
    { label: "Total Expenses Balance", value: m.totalExpenses, icon: ReceiptText, tint: "bg-orange-500/15 text-orange-400" },
    { label: "Total Items", value: m.itemCount, icon: Boxes, tint: "bg-purple-500/15 text-purple-400" },
    { label: "Total Transactions", value: m.txCount, icon: ArrowLeftRight, tint: "bg-cyan-500/15 text-cyan-400" },
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Business Analytics Dashboard</h1>
        <p className="text-sm text-muted-foreground">Real-time performance metrics and business health insights</p>
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card p-2 w-fit">
        {([
          ["1m", "1 Month"],
          ["6m", "6 Months"],
          ["1y", "1 Year"],
          ["all", "All"],
        ] as const).map(([k, lbl]) => (
          <button key={k} onClick={() => setRange(k)}
            className={`rounded-lg px-4 py-1.5 text-xs font-medium transition ${
              range === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}>{lbl}</button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <div key={c.label + (c.sub || "")} className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{c.label}</div>
                {c.sub && <div className="text-[11px] text-muted-foreground/80">{c.sub}</div>}
              </div>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${c.tint}`}>
                <c.icon className="h-4 w-4" />
              </span>
            </div>
            <div className={`mt-3 font-display text-2xl font-bold ${c.valueClass || ""}`}>
              {typeof c.value === "number" && c.label.toLowerCase().includes("items") ||
               c.label.toLowerCase().includes("transactions")
                ? c.value.toLocaleString()
                : fmt(c.value)}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Inventory value uses each variation's purchase / sell price. Losses use abnormal stock adjustments.
        Expenses tracking is not yet enabled.
      </p>
    </div>
  );
}
