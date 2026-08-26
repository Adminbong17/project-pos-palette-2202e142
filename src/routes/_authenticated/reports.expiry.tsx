import { formatDate, formatDateTime } from "@/lib/utils";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { fetchAll } from "@/lib/fetch-all";
import { AlertTriangle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FoldTable } from "@/components/fold-table";

export const Route = createFileRoute("/_authenticated/reports/expiry")({
  head: () => ({ meta: [{ title: "Expiring Batches — QweekPOS" }] }),
  component: ExpiryPage,
});

function daysLeft(d: string) {
  const t = new Date(d).getTime() - Date.now();
  return Math.ceil(t / (1000 * 60 * 60 * 24));
}

function ExpiryPage() {
  const { data: business } = useCurrentBusiness();
  const businessId = business?.id;
  const [search, setSearch] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["expiry-batches-full", businessId],
    enabled: !!businessId,
    queryFn: async () =>
      fetchAll(() => supabase
        .from("transaction_purchase_lines")
        .select("id, lot_no, expire_date, quantity, purchase_price, product:products(name, sku), transaction:transactions!inner(business_id, transaction_date, ref_no)")
        .eq("transaction.business_id", businessId!)
        .not("expire_date", "is", null)
        .order("expire_date", { ascending: true })),
  });

  const q = search.trim().toLowerCase();
  const filteredRows = useMemo(() => {
    if (!q) return rows;
    return (rows as any[]).filter((b) => {
      const dl = daysLeft(b.expire_date);
      return [
        b.product?.name,
        b.product?.sku,
        b.lot_no,
        b.quantity,
        b.transaction?.transaction_date,
        b.expire_date,
        dl,
      ].some((v) => String(v ?? "").toLowerCase().includes(q));
    });
  }, [rows, q]);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <h1 className="font-display text-2xl font-semibold">Expiring Batches</h1>
        </div>
        <Link to="/reports" className="text-xs underline text-muted-foreground hover:text-foreground">← Back to Reports</Link>
      </div>
      <p className="text-sm text-muted-foreground">Showing all batches, sorted by nearest expiry.</p>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search batches…"
          className="pl-9"
        />
      </div>

      <div className="rounded-2xl border border-border/60 bg-card overflow-x-auto">
        <FoldTable className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-2">Product</th>
              <th className="text-left p-2">SKU</th>
              <th className="text-left p-2">Batch</th>
              <th className="text-right p-2">Qty</th>
              <th className="text-left p-2">Purchased</th>
              <th className="text-left p-2">Expire date</th>
              <th className="text-right p-2">Days left</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
            )}
            {!isLoading && filteredRows.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">{q ? "No match." : "No batches with expiry dates."}</td></tr>
            )}
            {filteredRows.map((b: any) => {
              const dl = daysLeft(b.expire_date);
              const cls = dl < 0 ? "text-destructive" : dl <= 30 ? "text-amber-600" : "text-muted-foreground";
              return (
                <tr key={b.id} className="border-t">
                  <td className="p-2">{b.product?.name ?? "—"}</td>
                  <td className="p-2 text-muted-foreground">{b.product?.sku ?? "—"}</td>
                  <td className="p-2 font-mono text-xs">{b.lot_no ?? "—"}</td>
                  <td className="p-2 text-right">{Number(b.quantity)}</td>
                  <td className="p-2">{formatDate(b.transaction?.transaction_date) || "—"}</td>
                  <td className="p-2">{formatDate(b.expire_date)}</td>
                  <td className={`p-2 text-right font-medium ${cls}`}>{dl < 0 ? `${Math.abs(dl)}d ago` : `${dl}d`}</td>
                </tr>
              );
            })}
          </tbody>
        </FoldTable>
      </div>
    </div>
  );
}
