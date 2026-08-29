import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { fetchMostSelling, dhakaMonthRange, dhakaDayRange } from "@/lib/most-selling";
import { TrendingUp, ArrowLeft } from "lucide-react";
import { FoldTable } from "@/components/fold-table";

export const Route = createFileRoute("/_authenticated/most-selling")({
  head: () => ({
    meta: [
      { title: "Most Selling Items — QweekPOS" },
      { name: "description", content: "Top selling products by quantity with day-wise filtering." },
      { property: "og:title", content: "Most Selling Items — QweekPOS" },
      { property: "og:description", content: "Top selling products by quantity with day-wise filtering." },
    ],
  }),
  component: MostSellingPage,
});

type Preset = "today" | "yesterday" | "thisMonth" | "lastMonth" | "custom";

function todayDhaka(offsetDays = 0): string {
  const shifted = new Date(Date.now() + (6 * 3600 + offsetDays * 86400) * 1000);
  return shifted.toISOString().slice(0, 10);
}

function MostSellingPage() {
  const { data: business, isLoading: bizLoading } = useCurrentBusiness();
  const businessId = business?.id;

  const [preset, setPreset] = useState<Preset>("thisMonth");
  const [fromDate, setFromDate] = useState(todayDhaka());
  const [toDate, setToDate] = useState(todayDhaka());
  const [search, setSearch] = useState("");

  const range = useMemo(() => {
    switch (preset) {
      case "today":
        return { ...dhakaDayRange(todayDhaka()), label: "Today" };
      case "yesterday":
        return { ...dhakaDayRange(todayDhaka(-1)), label: "Yesterday" };
      case "thisMonth":
        return dhakaMonthRange(0);
      case "lastMonth":
        return dhakaMonthRange(-1);
      case "custom":
        return {
          fromISO: dhakaDayRange(fromDate).fromISO,
          toISO: dhakaDayRange(toDate).toISO,
          label: `${fromDate} → ${toDate}`,
        };
    }
  }, [preset, fromDate, toDate]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["most-selling", businessId, range.fromISO, range.toISO],
    enabled: !!businessId,
    queryFn: () => fetchMostSelling(businessId!, range.fromISO, range.toISO, 1000),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q) || (i.sku ?? "").toLowerCase().includes(q));
  }, [items, search]);

  const totalQty = filtered.reduce((a, i) => a + i.qty, 0);
  const totalRevenue = filtered.reduce((a, i) => a + i.revenue, 0);
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

  if (bizLoading || !business) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }

  const presets: { key: Preset; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "thisMonth", label: "This Month" },
    { key: "lastMonth", label: "Last Month" },
    { key: "custom", label: "Custom Range" },
  ];

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/dashboard" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          <div>
            <h1 className="font-display text-2xl font-semibold">Most Selling Items</h1>
            <p className="text-sm text-muted-foreground">{range.label} · top {Math.min(filtered.length, 1000)} of 1000 items</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {presets.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
              preset === p.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-accent"
            }`}
          >
            {p.label}
          </button>
        ))}
        {preset === "custom" && (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-lg border border-border bg-background px-2 py-1.5"
            />
            <span className="text-muted-foreground">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-lg border border-border bg-background px-2 py-1.5"
            />
          </div>
        )}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search product or SKU…"
          className="ml-auto rounded-lg border border-border bg-background px-3 py-1.5 text-xs w-56"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Items sold</div>
          <div className="mt-1 font-display text-2xl font-semibold">{filtered.length}</div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Total quantity</div>
          <div className="mt-1 font-display text-2xl font-semibold">{fmt(totalQty)}</div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Total revenue</div>
          <div className="mt-1 font-display text-2xl font-semibold">{fmt(totalRevenue)} BDT</div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sales found for this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <FoldTable className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-2">#</th>
                  <th className="text-left p-2">Product</th>
                  <th className="text-left p-2">SKU</th>
                  <th className="text-right p-2">Qty sold</th>
                  <th className="text-right p-2">Revenue (BDT)</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i, idx) => (
                  <tr key={i.productId} className="border-t">
                    <td className="p-2 text-muted-foreground">{idx + 1}</td>
                    <td className="p-2 font-medium">{i.name}</td>
                    <td className="p-2 font-mono text-xs">{i.sku ?? "—"}</td>
                    <td className="p-2 text-right font-semibold">{fmt(i.qty)}</td>
                    <td className="p-2 text-right">{fmt(i.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </FoldTable>
          </div>
        )}
      </div>
    </div>
  );
}
