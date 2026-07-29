import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { useCurrentRole } from "@/hooks/use-current-role";
import { Wallet } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchAll, fetchAllIn } from "@/lib/fetch-all";

export const Route = createFileRoute("/_authenticated/reports/profit")({
  head: () => ({ meta: [{ title: "Profit Report — QweekPOS" }] }),
  component: ProfitReportPage,
});

function fmt(n: number) {
  return (n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

function ProfitReportPage() {
  const { data: business } = useCurrentBusiness();
  const { isAdmin, isLoading: roleLoading } = useCurrentRole();
  const businessId = business?.id;
  const [range, setRange] = useState<"today" | "7d" | "30d" | "all" | "custom">("30d");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const { fromDate, toDate } = useMemo(() => {
    const now = new Date();
    if (range === "today") return { fromDate: startOfDay(now) as Date | null, toDate: null as Date | null };
    if (range === "7d") { const d = startOfDay(now); d.setDate(d.getDate() - 6); return { fromDate: d as Date | null, toDate: null as Date | null }; }
    if (range === "30d") { const d = startOfDay(now); d.setDate(d.getDate() - 29); return { fromDate: d as Date | null, toDate: null as Date | null }; }
    if (range === "custom") {
      const f = customFrom ? startOfDay(new Date(customFrom)) : null;
      const t = customTo ? (() => { const x = new Date(customTo); x.setHours(23, 59, 59, 999); return x; })() : null;
      return { fromDate: f as Date | null, toDate: t as Date | null };
    }
    return { fromDate: null as Date | null, toDate: null as Date | null };
  }, [range, customFrom, customTo]);

  const { data: sales = [] } = useQuery({
    queryKey: ["profit-sales", businessId, range, customFrom, customTo],
    enabled: !!businessId,
    queryFn: async () =>
      fetchAll(() => {
        let q = supabase.from("transactions")
          .select("id, invoice_no, ref_no, transaction_date, discount_amount, final_total, contact:contacts(name)")
          .eq("business_id", businessId!).eq("type", "sell")
          .order("transaction_date", { ascending: false });
        if (fromDate) q = q.gte("transaction_date", fromDate.toISOString());
        if (toDate) q = q.lte("transaction_date", toDate.toISOString());
        return q;
      }),
  });

  const { data: sellLines = [] } = useQuery({
    queryKey: ["profit-lines", businessId, range, sales.length],
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

  const productIds = useMemo(
    () => Array.from(new Set((sellLines as any[]).map((l) => l.product_id).filter(Boolean))),
    [sellLines],
  );
  const variationIds = useMemo(
    () => Array.from(new Set((sellLines as any[]).map((l) => l.variation_id).filter(Boolean))),
    [sellLines],
  );

  const { data: products = [] } = useQuery({
    queryKey: ["profit-products", businessId, productIds],
    enabled: !!businessId && productIds.length > 0,
    queryFn: async () =>
      fetchAllIn(
        (chunk) => supabase.from("products")
          .select("id, name, default_purchase_price")
          .eq("business_id", businessId!)
          .in("id", chunk),
        productIds,
      ),
  });

  const { data: variations = [] } = useQuery({
    queryKey: ["profit-variations", businessId, variationIds],
    enabled: !!businessId && variationIds.length > 0,
    queryFn: async () =>
      fetchAllIn(
        (chunk) => supabase.from("variations")
          .select("id, product_id, default_purchase_price")
          .in("id", chunk),
        variationIds,
      ),
  });

  const profit = useMemo(() => {
    const varCostById = new Map(variations.map((v: any) => [v.id, Number(v.default_purchase_price || 0)]));
    const productCostFallback = new Map(products.map((p: any) => [p.id, Number(p.default_purchase_price || 0)]));
    const nameById = new Map(products.map((p: any) => [p.id, p.name]));
    const invoiceNoById = new Map((sales as any[]).map((s) => [s.id, s.invoice_no ?? s.ref_no ?? "—"]));
    const map = new Map<string, { qty: number; revenue: number; cost: number; invoices: Set<string> }>();
    const byInvoice = new Map<string, { revenue: number; cost: number }>();
    for (const l of sellLines as any[]) {
      const cur = map.get(l.product_id) || { qty: 0, revenue: 0, cost: 0, invoices: new Set<string>() };
      cur.invoices.add(String(invoiceNoById.get(l.transaction_id) ?? "—"));
      const qty = Number(l.quantity || 0);
      const unitCost = varCostById.has(l.variation_id)
        ? Number(varCostById.get(l.variation_id) || 0)
        : Number(productCostFallback.get(l.product_id) || 0);
      const rev = qty * Number(l.unit_price || 0);
      const cost = qty * unitCost;
      cur.qty += qty; cur.revenue += rev; cur.cost += cost;
      map.set(l.product_id, cur);
      const inv = byInvoice.get(l.transaction_id) || { revenue: 0, cost: 0 };
      inv.revenue += rev; inv.cost += cost;
      byInvoice.set(l.transaction_id, inv);
    }
    const rows = [...map.entries()].map(([pid, v]) => ({
      pid, name: nameById.get(pid) || "—",
      invoices: [...v.invoices],
      qty: v.qty, revenue: v.revenue, cost: v.cost,
      profit: v.revenue - v.cost,
      margin: v.revenue > 0 ? ((v.revenue - v.cost) / v.revenue) * 100 : 0,
    })).sort((a, b) => b.profit - a.profit);
    const invoiceRows = (sales as any[]).map((s) => {
      const v = byInvoice.get(s.id) || { revenue: 0, cost: 0 };
      const discount = Number(s.discount_amount || 0);
      const profit = v.revenue - v.cost - discount;
      return {
        id: s.id,
        date: s.transaction_date,
        invoice: s.invoice_no ?? s.ref_no ?? "—",
        customer: s.contact?.name ?? "Walk-in",
        revenue: v.revenue, cost: v.cost, discount, profit,
        margin: v.revenue > 0 ? (profit / v.revenue) * 100 : 0,
      };
    });
    const totalRevenue = rows.reduce((a, r) => a + r.revenue, 0);
    const totalCost = rows.reduce((a, r) => a + r.cost, 0);
    const totalDiscount = sales.reduce((a: number, s: any) => a + Number(s.discount_amount || 0), 0);
    const grossProfit = totalRevenue - totalCost;
    const netProfit = grossProfit - totalDiscount;
    return { rows, invoiceRows, totalRevenue, totalCost, grossProfit, netProfit, totalDiscount };
  }, [sellLines, products, variations, sales]);

  if (!roleLoading && !isAdmin) {
    return <div className="p-8 text-sm text-muted-foreground">Only Admins can view profit data.</div>;
  }
  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
            <Wallet className="h-6 w-6 text-emerald-600" /> Profit Report
          </h1>
          <p className="text-sm text-muted-foreground">Revenue, cost and profit per product.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-card p-1">
            {(["today", "7d", "30d", "all", "custom"] as const).map((r) => (
              <button key={r} onClick={() => setRange(r)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}>
                {r === "today" ? "Today" : r === "7d" ? "7 days" : r === "30d" ? "30 days" : r === "all" ? "All" : "Custom"}
              </button>
            ))}
          </div>
          {range === "custom" && (
            <div className="flex items-center gap-2">
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-md border border-border/60 bg-card px-2 py-1 text-xs" />
              <span className="text-xs text-muted-foreground">to</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-md border border-border/60 bg-card px-2 py-1 text-xs" />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Revenue", value: fmt(profit.totalRevenue), color: "text-foreground" },
          { label: "Cost (COGS)", value: fmt(profit.totalCost), color: "text-foreground" },
          { label: "Gross Profit", value: fmt(profit.grossProfit), color: profit.grossProfit >= 0 ? "text-emerald-600" : "text-destructive" },
          { label: "Net Profit (after discount)", value: fmt(profit.netProfit), color: profit.netProfit >= 0 ? "text-emerald-600" : "text-destructive" },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-border/60 bg-card p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</div>
            <div className={`mt-2 font-display text-2xl font-semibold ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Invoice No</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Profit</TableHead>
              <TableHead className="text-right">Margin %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profit.rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">No sales in this period.</TableCell></TableRow>
            )}
            {profit.rows.map((r) => (
              <TableRow key={r.pid}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground max-w-[220px]">
                  {r.invoices.join(", ")}
                </TableCell>
                <TableCell className="text-right">{r.qty}</TableCell>
                <TableCell className="text-right">{fmt(r.revenue)}</TableCell>
                <TableCell className="text-right text-muted-foreground">{fmt(r.cost)}</TableCell>
                <TableCell className={`text-right font-semibold ${r.profit >= 0 ? "text-emerald-600" : "text-destructive"}`}>{fmt(r.profit)}</TableCell>
                <TableCell className="text-right">{r.margin.toFixed(1)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="px-4 py-3 text-[11px] text-muted-foreground border-t">
          Cost uses each product's default purchase price. Net profit = Gross profit − total invoice discount.
        </p>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card">
        <div className="px-4 py-3 border-b text-sm font-semibold">Profit per invoice</div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Margin %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profit.invoiceRows.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">No sales in this period.</TableCell></TableRow>
              )}
              {profit.invoiceRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{new Date(r.date).toLocaleDateString("en-GB")}</TableCell>
                  <TableCell className="font-mono text-xs">{r.invoice}</TableCell>
                  <TableCell>{r.customer}</TableCell>
                  <TableCell className="text-right">{fmt(r.revenue)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{fmt(r.cost)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{fmt(r.discount)}</TableCell>
                  <TableCell className={`text-right font-semibold ${r.profit >= 0 ? "text-emerald-600" : "text-destructive"}`}>{fmt(r.profit)}</TableCell>
                  <TableCell className={`text-right ${r.margin >= 0 ? "text-emerald-600" : "text-destructive"}`}>{r.margin.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
