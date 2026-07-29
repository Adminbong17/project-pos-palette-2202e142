import { formatDate, formatDateTime } from "@/lib/utils";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { fetchAll } from "@/lib/fetch-all";
import {
  BarChart3, TrendingUp, Package, Users, Receipt, Wallet, Boxes, AlertTriangle,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/reports/")({
  head: () => ({ meta: [{ title: "Reports — QweekPOS" }] }),
  component: ReportsPage,
});

function fmt(n: number, currency = "") {
  return `${currency}${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

function ReportsPage() {
  const { data: business } = useCurrentBusiness();
  const businessId = business?.id;

  const [range, setRange] = useState<"today" | "7d" | "30d" | "all" | "custom">("30d");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const { fromDate, toDate } = useMemo(() => {
    const now = new Date();
    if (range === "today") return { fromDate: startOfDay(now), toDate: null as Date | null };
    if (range === "7d") { const d = startOfDay(now); d.setDate(d.getDate() - 6); return { fromDate: d, toDate: null as Date | null }; }
    if (range === "30d") { const d = startOfDay(now); d.setDate(d.getDate() - 29); return { fromDate: d, toDate: null as Date | null }; }
    if (range === "custom") {
      const f = customFrom ? startOfDay(new Date(customFrom)) : null;
      let t: Date | null = null;
      if (customTo) { t = new Date(customTo); t.setHours(23, 59, 59, 999); }
      return { fromDate: f, toDate: t };
    }
    return { fromDate: null as Date | null, toDate: null as Date | null };
  }, [range, customFrom, customTo]);

  // Sales (transactions type=sell)
  const { data: sales = [] } = useQuery({
    queryKey: ["reports-sales", businessId, range, fromDate?.toISOString() ?? null, toDate?.toISOString() ?? null],
    enabled: !!businessId,
    queryFn: async () => {
      let q = supabase
        .from("transactions")
        .select("id, invoice_no, transaction_date, final_total, discount_amount, tax_amount, contact_id, status")
        .eq("business_id", businessId!)
        .eq("type", "sell")
        .order("transaction_date", { ascending: false });
      if (fromDate) q = q.gte("transaction_date", fromDate.toISOString());
      if (toDate) q = q.lte("transaction_date", toDate.toISOString());
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: sellLines = [] } = useQuery({
    queryKey: ["reports-sell-lines", businessId, range, sales.length, sales[0]?.id ?? null],
    enabled: !!businessId && sales.length > 0,
    queryFn: async () => {
      const ids = sales.map((s: any) => s.id);
      return await fetchAll(() =>
        supabase
          .from("transaction_sell_lines")
          .select("transaction_id, product_id, variation_id, quantity, unit_price")
          .in("transaction_id", ids),
      );
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["reports-products", businessId],
    enabled: !!businessId,
    queryFn: async () =>
      await fetchAll(() =>
        supabase
          .from("products")
          .select("id, name, sku, alert_quantity, default_purchase_price, default_sell_price")
          .eq("business_id", businessId!),
      ),
  });

  const { data: stockRows = [] } = useQuery({
    queryKey: ["reports-stock", businessId],
    enabled: !!businessId,
    queryFn: async () =>
      await fetchAll(() =>
        supabase
          .from("variation_location_details")
          .select("product_id, variation_id, location_id, qty_available"),
      ),
  });

  const totals = useMemo(() => {
    const total = sales.reduce((a: number, s: any) => a + Number(s.final_total || 0), 0);
    const discount = sales.reduce((a: number, s: any) => a + Number(s.discount_amount || 0), 0);
    const tax = sales.reduce((a: number, s: any) => a + Number(s.tax_amount || 0), 0);
    return { total, discount, tax, count: sales.length };
  }, [sales]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { qty: number; revenue: number }>();
    for (const l of sellLines as any[]) {
      const cur = map.get(l.product_id) || { qty: 0, revenue: 0 };
      cur.qty += Number(l.quantity || 0);
      cur.revenue += Number(l.quantity || 0) * Number(l.unit_price || 0);
      map.set(l.product_id, cur);
    }
    const nameById = new Map(products.map((p: any) => [p.id, p.name]));
    return [...map.entries()]
      .map(([pid, v]) => ({ pid, name: nameById.get(pid) || "—", ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [sellLines, products]);

  const stockSummary = useMemo(() => {
    const byProduct = new Map<string, number>();
    for (const r of stockRows as any[]) {
      byProduct.set(r.product_id, (byProduct.get(r.product_id) || 0) + Number(r.qty_available || 0));
    }
    const rows = products.map((p: any) => ({
      id: p.id, name: p.name, sku: p.sku,
      qty: byProduct.get(p.id) || 0,
      alert: Number(p.alert_quantity || 0),
    }));
    const lowStock = rows.filter((r) => r.qty <= Math.max(r.alert, 10));
    return { rows, lowStock };
  }, [stockRows, products]);





  const cards = [
    { label: "Total Sales", value: fmt(totals.total), icon: Receipt, color: "bg-primary/15 text-primary" },
    { label: "Invoices", value: String(totals.count), icon: BarChart3, color: "bg-chart-2/15 text-chart-2" },
    { label: "Discount Given", value: fmt(totals.discount), icon: TrendingUp, color: "bg-chart-3/15 text-chart-3" },
    { label: "Tax Collected", value: fmt(totals.tax), icon: Wallet, color: "bg-chart-4/15 text-chart-4" },
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Reports</h1>
          <p className="text-sm text-muted-foreground">Sales, products and stock at a glance.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-card p-1">
            {(["today", "7d", "30d", "all", "custom"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r === "today" ? "Today" : r === "7d" ? "7 days" : r === "30d" ? "30 days" : r === "all" ? "All" : "Custom"}
              </button>
            ))}
          </div>
          {range === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-md border border-border/60 bg-card px-2 py-1.5 text-xs"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-md border border-border/60 bg-card px-2 py-1.5 text-xs"
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border/60 bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</span>
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.color}`}>
                <s.icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 font-display text-2xl font-semibold">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {isAdmin && <Link
          to="/reports/analytics"
          className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-5 hover:bg-accent transition"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15 text-violet-500">
              <BarChart3 className="h-5 w-5" />
            </span>
            <div>
              <div className="font-semibold">Business Analytics</div>
              <div className="text-xs text-muted-foreground">Inventory value, dues, losses, net profit →</div>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">Open</span>
        </Link>}
        {isAdmin && <Link
          to="/reports/profit"
          className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-5 hover:bg-accent transition"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600">
              <Wallet className="h-5 w-5" />
            </span>
            <div>
              <div className="font-semibold">Profit Report</div>
              <div className="text-xs text-muted-foreground">Revenue, cost, gross & net profit per product →</div>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">Open</span>
        </Link>}
        <Link
          to="/reports/inventory-movement"
          className="flex items-center justify-between rounded-2xl border border-border/60 bg-card p-5 hover:bg-accent transition"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600">
              <Boxes className="h-5 w-5" />
            </span>
            <div>
              <div className="font-semibold">Inventory Movement</div>
              <div className="text-xs text-muted-foreground">Per-product purchase, sale and adjustment history →</div>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">Open</span>
        </Link>

      </div>

      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales"><Receipt className="mr-1.5 h-3.5 w-3.5" />Sales</TabsTrigger>
          <TabsTrigger value="top"><TrendingUp className="mr-1.5 h-3.5 w-3.5" />Top Products</TabsTrigger>
          <TabsTrigger value="stock"><Boxes className="mr-1.5 h-3.5 w-3.5" />Stock</TabsTrigger>
          <TabsTrigger value="low"><AlertTriangle className="mr-1.5 h-3.5 w-3.5" />Low Stock</TabsTrigger>
        </TabsList>




        <TabsContent value="sales">
          <div className="rounded-2xl border border-border/60 bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No sales in this period.</TableCell></TableRow>
                )}
                {sales.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.invoice_no}</TableCell>
                    <TableCell>{formatDateTime(s.transaction_date)}</TableCell>
                    <TableCell><span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">{s.status}</span></TableCell>
                    <TableCell className="text-right">{fmt(Number(s.discount_amount))}</TableCell>
                    <TableCell className="text-right">{fmt(Number(s.tax_amount))}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(Number(s.final_total))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="top">
          <div className="rounded-2xl border border-border/60 bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty Sold</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">No data.</TableCell></TableRow>
                )}
                {topProducts.map((p) => (
                  <TableRow key={p.pid}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-right">{p.qty}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(p.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="stock">
          <div className="rounded-2xl border border-border/60 bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">In Stock</TableHead>
                  <TableHead className="text-right">Alert Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockSummary.rows.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">No products.</TableCell></TableRow>
                )}
                {stockSummary.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.sku}</TableCell>
                    <TableCell className="text-right">{r.qty}</TableCell>
                    <TableCell className="text-right">{r.alert || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="low">
          <div className="rounded-2xl border border-border/60 bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">In Stock</TableHead>
                  <TableHead className="text-right">Alert Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockSummary.lowStock.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">All products are above alert quantity. 🎉</TableCell></TableRow>
                )}
                {stockSummary.lowStock.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.sku}</TableCell>
                    <TableCell className="text-right text-destructive font-semibold">{r.qty}</TableCell>
                    <TableCell className="text-right">{r.alert}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <div className="text-xs text-muted-foreground">
        Need more? <Link to="/pos" className="underline">Go to POS</Link> ·{" "}
        <Link to="/products" className="underline">Manage products</Link>
      </div>
    </div>
  );
}
