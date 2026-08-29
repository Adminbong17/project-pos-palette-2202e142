import { formatDate, formatDateTime } from "@/lib/utils";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { Building2, Users, Package, ShoppingCart, BarChart3, AlertTriangle, TrendingUp } from "lucide-react";
import { FoldTable } from "@/components/fold-table";
import { fetchMostSelling, dhakaMonthRange } from "@/lib/most-selling";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — QweekPOS" }] }),
  component: Dashboard,
});

function daysLeft(d: string) {
  const t = new Date(d).getTime() - Date.now();
  return Math.ceil(t / (1000 * 60 * 60 * 24));
}

function Dashboard() {
  const { data: business, isLoading } = useCurrentBusiness();
  const navigate = useNavigate();
  const businessId = business?.id;

  useEffect(() => {
    if (!isLoading && !business) navigate({ to: "/setup" });
  }, [isLoading, business, navigate]);

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const [sales, productsCount, customersCount, locationsCount] = await Promise.all([
        supabase.from("transactions")
          .select("final_total")
          .eq("business_id", businessId!).eq("type", "sell"),
        supabase.from("products").select("*", { count: "exact", head: true })
          .eq("business_id", businessId!),
        supabase.from("contacts").select("*", { count: "exact", head: true })
          .eq("business_id", businessId!),
        supabase.from("business_locations").select("*", { count: "exact", head: true })
          .eq("business_id", businessId!),
      ]);
      const totalSales = (sales.data ?? []).reduce((a: number, r: any) => a + Number(r.final_total || 0), 0);
      return {
        totalSales,
        products: productsCount.count ?? 0,
        customers: customersCount.count ?? 0,
        locations: locationsCount.count ?? 0,
      };
    },
  });

  const { data: expiryBatches = [] } = useQuery({
    queryKey: ["dashboard-expiry", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data } = await supabase
        .from("transaction_purchase_lines")
        .select("id, lot_no, expire_date, quantity, product_id, transaction:transactions!inner(business_id), product:products(name, sku)")
        .eq("transaction.business_id", businessId!)
        .not("expire_date", "is", null)
        .order("expire_date", { ascending: true })
        .limit(20);
      return data ?? [];
    },
  });

  if (isLoading || !business) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }

  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Welcome back</h1>
        <p className="text-sm text-muted-foreground">{business.name}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Sales", value: stats ? `${fmt(stats.totalSales)} BDT` : "…", icon: ShoppingCart, color: "bg-primary/15 text-primary" },
          { label: "Products", value: stats ? fmt(stats.products) : "…", icon: Package, color: "bg-chart-2/15 text-chart-2" },
          { label: "Customers", value: stats ? fmt(stats.customers) : "…", icon: Users, color: "bg-chart-3/15 text-chart-3" },
          { label: "Locations", value: stats ? fmt(stats.locations) : "…", icon: Building2, color: "bg-chart-4/15 text-chart-4" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border/60 bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</span>
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.color}`}>
                <s.icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 font-display text-3xl font-semibold">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h2 className="font-semibold">Batches expiring soon</h2>
          </div>
          <Link to="/reports/expiry" className="text-xs underline text-muted-foreground hover:text-foreground">View all →</Link>
        </div>
        {expiryBatches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No batches with expiry dates yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <FoldTable className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-2">Product</th>
                  <th className="text-left p-2">Batch</th>
                  <th className="text-right p-2">Qty</th>
                  <th className="text-left p-2">Expire date</th>
                  <th className="text-right p-2">Days left</th>
                </tr>
              </thead>
              <tbody>
                {expiryBatches.map((b: any) => {
                  const dl = daysLeft(b.expire_date);
                  const cls = dl < 0 ? "text-destructive" : dl <= 30 ? "text-amber-600" : "text-muted-foreground";
                  return (
                    <tr key={b.id} className="border-t">
                      <td className="p-2 text-base md:text-lg font-bold text-red-600">{b.product?.name ?? "—"}</td>
                      <td className="p-2 font-mono text-xs">{b.lot_no ?? "—"}</td>
                      <td className="p-2 text-right">{Number(b.quantity)}</td>
                      <td className="p-2">{formatDate(b.expire_date)}</td>
                      <td className={`p-2 text-right font-medium ${cls}`}>{dl < 0 ? `${Math.abs(dl)}d ago` : `${dl}d`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </FoldTable>
            <div className="mt-3 flex justify-center">
              <Link to="/reports/expiry" className="rounded-lg border border-border bg-background px-4 py-2 text-sm hover:bg-accent">Load more</Link>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-6">

        <div className="flex items-start gap-4">
          <BarChart3 className="h-8 w-8 text-muted-foreground" />
          <div className="flex-1">
            <h2 className="font-semibold">Quick links</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Jump into common tasks.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to="/pos" className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs hover:bg-accent">POS</Link>
              <Link to="/products" className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs hover:bg-accent">Products</Link>
              <Link to="/purchases" className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs hover:bg-accent">Purchases</Link>
              <Link to="/reports" className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs hover:bg-accent">Reports</Link>
              <Link to="/settings/business" className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs hover:bg-accent">Settings</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
