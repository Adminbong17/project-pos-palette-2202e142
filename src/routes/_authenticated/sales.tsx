import { formatDate } from "@/lib/utils";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { Button } from "@/components/ui/button";
import { Plus, Receipt, Printer, Trash2, Pencil } from "lucide-react";
import { printReceiptInWhitePage, type ReceiptSale } from "@/lib/receipt-print";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchAllIn } from "@/lib/fetch-all";
import { useCurrentRole } from "@/hooks/use-current-role";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({ meta: [{ title: "Sales — QweekPOS" }] }),
  component: SalesPage,
});

type SaleRow = {
  id: string;
  invoice_no: string | null;
  ref_no: string | null;
  transaction_date: string;
  status: string;
  payment_status: string;
  final_total: number;
  total_paid: number;
  contact: { name: string | null } | null;
  location: { name: string | null } | null;
};

type RangeKey = "today" | "7d" | "30d" | "all" | "custom";

function SalesPage() {
  const { data: business } = useCurrentBusiness();
  const { isAdmin, isLoading: roleLoading } = useCurrentRole();
  const qc = useQueryClient();
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [printWidth, setPrintWidth] = useState<"58" | "80" | "A4">("80");
  const [range, setRange] = useState<RangeKey>("30d");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [search, setSearch] = useState("");

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<SaleRow | null>(null);
  const [editForm, setEditForm] = useState({ invoice_no: "", transaction_date: "", total_paid: "", additional_notes: "" });
  const [editSaving, setEditSaving] = useState(false);

  async function handleDelete(r: SaleRow) {
    if (!confirm(`Delete invoice ${r.invoice_no ?? r.ref_no ?? ""}? This will restore stock.`)) return;
    setDeletingId(r.id);
    try {
      const { error } = await supabase.rpc("delete_sale" as any, { _id: r.id });
      if (error) throw error;
      toast.success("Sale deleted, stock restored");
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["pos-products"] });
    } catch (e: any) {
      toast.error(e.message ?? "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  function openEdit(r: SaleRow) {
    setEditRow(r);
    setEditForm({
      invoice_no: r.invoice_no ?? "",
      transaction_date: new Date(r.transaction_date).toISOString().slice(0, 16),
      total_paid: String(r.total_paid ?? 0),
      additional_notes: "",
    });
    // fetch notes
    supabase.from("transactions").select("additional_notes").eq("id", r.id).single().then(({ data }) => {
      if (data) setEditForm((f) => ({ ...f, additional_notes: (data as any).additional_notes ?? "" }));
    });
  }

  async function saveEdit() {
    if (!editRow) return;
    setEditSaving(true);
    try {
      const paid = Number(editForm.total_paid || 0);
      const final_total = Number(editRow.final_total || 0);
      const payment_status = paid >= final_total ? "paid" : paid > 0 ? "partial" : "due";
      const { error } = await supabase
        .from("transactions")
        .update({
          invoice_no: editForm.invoice_no || null,
          transaction_date: new Date(editForm.transaction_date).toISOString(),
          total_paid: Math.min(paid, final_total),
          payment_status,
          additional_notes: editForm.additional_notes || null,
        })
        .eq("id", editRow.id);
      if (error) throw error;
      toast.success("Sale updated");
      setEditRow(null);
      qc.invalidateQueries({ queryKey: ["sales"] });
    } catch (e: any) {
      toast.error(e.message ?? "Update failed");
    } finally {
      setEditSaving(false);
    }
  }


  const { fromISO, toISO } = useMemo(() => {
    const now = new Date();
    const end = new Date(now); end.setHours(23, 59, 59, 999);
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    if (range === "today") return { fromISO: start.toISOString(), toISO: end.toISOString() };
    if (range === "7d") { const s = new Date(start); s.setDate(s.getDate() - 6); return { fromISO: s.toISOString(), toISO: end.toISOString() }; }
    if (range === "30d") { const s = new Date(start); s.setDate(s.getDate() - 29); return { fromISO: s.toISOString(), toISO: end.toISOString() }; }
    if (range === "custom" && customFrom && customTo) {
      const s = new Date(customFrom); s.setHours(0, 0, 0, 0);
      const e = new Date(customTo); e.setHours(23, 59, 59, 999);
      return { fromISO: s.toISOString(), toISO: e.toISOString() };
    }
    return { fromISO: null as string | null, toISO: null as string | null };
  }, [range, customFrom, customTo]);


  async function reprint(saleId: string) {
    if (!business) return;
    setPrintingId(saleId);
    try {
      const [txRes, linesRes, bizRes] = await Promise.all([
        supabase.from("transactions").select("id, invoice_no, ref_no, transaction_date, final_total, discount_amount, total_paid, location_id, contact:contacts(name), location:business_locations(name, landmark, city, state, country, zip_code, mobile, alternate_number)").eq("id", saleId).single(),
        supabase.from("transaction_sell_lines").select("quantity, unit_price, product:products(name), variation:variations(name, sub_sku)").eq("transaction_id", saleId),
        supabase.from("businesses").select("name").eq("id", business.id).single(),
      ]);
      if (txRes.error) throw txRes.error;
      if (linesRes.error) throw linesRes.error;
      const tx: any = txRes.data;
      const lines = (linesRes.data ?? []).map((l: any) => {
        const qty = Number(l.quantity);
        const price = Number(l.unit_price);
        const vname = l.variation?.name && l.variation.name !== "DUMMY" ? ` (${l.variation.name})` : "";
        return { name: `${l.product?.name ?? ""}${vname}`, quantity: qty, unit_price: price, total_amount: qty * price };
      });
      const subtotal = lines.reduce((s, l) => s + l.total_amount, 0);
      const discount = Number(tx.discount_amount || 0);
      const total = Number(tx.final_total || 0);
      const paid = Number(tx.total_paid || 0);
      const loc = tx.location;
      const address = loc ? [loc.landmark, loc.city, loc.state, loc.zip_code, loc.country].filter(Boolean).join(", ") : "";
      const mobile = loc ? [loc.mobile, loc.alternate_number].filter(Boolean).join(" / ") : "";
      const sale: ReceiptSale = {
        invoice_no: tx.invoice_no ?? tx.ref_no ?? "—",
        lines, subtotal, discount, total, paid,
        change: paid - total,
        payment_method: "cash",
        customer_name: tx.contact?.name ?? null,
        date: new Date(tx.transaction_date).toLocaleString(),
      };
      printReceiptInWhitePage(sale, printWidth, {
        businessName: bizRes.data?.name ?? "",
        businessAddress: address,
        businessMobile: mobile,
      });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to reprint");
    } finally {
      setPrintingId(null);
    }
  }


  const term = search.trim();
  const searching = term.length > 0;

  const { data: allRows = [], isLoading } = useQuery({
    queryKey: ["sales", business?.id, searching ? "search" : fromISO, searching ? "search" : toISO],
    enabled: !!business?.id,
    queryFn: async () => {
      let q = supabase
        .from("transactions")
        .select(
          "id, invoice_no, ref_no, transaction_date, status, payment_status, final_total, total_paid, contact:contacts(name), location:business_locations(name)"
        )
        .eq("business_id", business!.id)
        .eq("type", "sell");
      // When searching, look across all time so old invoices are findable.
      if (!searching && fromISO && toISO) q = q.gte("transaction_date", fromISO).lte("transaction_date", toISO);
      const { data, error } = await q.order("transaction_date", { ascending: false }).limit(2000);
      if (error) throw error;
      return (data ?? []) as unknown as SaleRow[];
    },
  });

  const rows = useMemo(() => {
    if (!searching) return allRows;
    const t = term.toLowerCase();
    return allRows.filter((r) =>
      [r.invoice_no, r.ref_no, r.contact?.name, r.location?.name]
        .some((v) => (v ?? "").toLowerCase().includes(t)),
    );
  }, [allRows, searching, term]);


  const saleIds = useMemo(() => rows.map((r) => r.id), [rows]);


  const { data: profitByInvoice = {} } = useQuery({
    queryKey: ["sales-profit", business?.id, saleIds.length],
    enabled: !!business?.id && saleIds.length > 0 && isAdmin,
    queryFn: async () => {
      const lines = await fetchAllIn<any>(
        (chunk) => supabase.from("transaction_sell_lines")
          .select("transaction_id, product_id, variation_id, quantity, unit_price")
          .in("transaction_id", chunk),
        saleIds,
      );
      const varIds = Array.from(new Set(lines.map((l) => l.variation_id).filter(Boolean)));
      const prodIds = Array.from(new Set(lines.map((l) => l.product_id).filter(Boolean)));
      const [vars, prods] = await Promise.all([
        varIds.length ? fetchAllIn<any>((chunk) => supabase.from("variations").select("id, default_purchase_price").in("id", chunk), varIds) : Promise.resolve([]),
        prodIds.length ? fetchAllIn<any>((chunk) => supabase.from("products").select("id, default_purchase_price").eq("business_id", business!.id).in("id", chunk), prodIds) : Promise.resolve([]),
      ]);
      const vc = new Map(vars.map((v: any) => [v.id, Number(v.default_purchase_price || 0)]));
      const pc = new Map(prods.map((p: any) => [p.id, Number(p.default_purchase_price || 0)]));
      const map: Record<string, { revenue: number; cost: number }> = {};
      for (const l of lines) {
        const q = Number(l.quantity || 0);
        const cost = q * (vc.get(l.variation_id) ?? pc.get(l.product_id) ?? 0);
        const rev = q * Number(l.unit_price || 0);
        const cur = map[l.transaction_id] || { revenue: 0, cost: 0 };
        cur.revenue += rev; cur.cost += cost;
        map[l.transaction_id] = cur;
      }
      return map;
    },
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: "BDT", maximumFractionDigits: 2 }).format(n || 0);

  const totals = rows.reduce(
    (a, r) => {
      a.total += Number(r.final_total || 0);
      a.paid += Number(r.total_paid || 0);
      const p = (profitByInvoice as any)[r.id];
      if (p) { a.revenue += p.revenue; a.cost += p.cost; }
      return a;
    },
    { total: 0, paid: 0, revenue: 0, cost: 0 }
  );
  const totalProfit = totals.revenue - totals.cost;
  const totalMargin = totals.revenue > 0 ? (totalProfit / totals.revenue) * 100 : 0;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Receipt className="h-6 w-6" /> Sales
          </h1>
          <p className="text-sm text-muted-foreground">All sales transactions from POS.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={printWidth} onChange={(e) => setPrintWidth(e.target.value as "58" | "80" | "A4")}
            className="h-9 rounded-lg border border-border bg-input px-2 text-sm">
            <option value="80">80mm</option>
            <option value="58">58mm</option>
            <option value="A4">A4</option>
          </select>
          <Button asChild>
            <Link to="/pos">
              <Plus className="h-4 w-4 mr-1" /> New Sale
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {([
          ["today", "Today"],
          ["7d", "7 days"],
          ["30d", "30 days"],
          ["all", "All time"],
          ["custom", "Custom"],
        ] as [RangeKey, string][]).map(([k, label]) => (
          <Button key={k} size="sm" variant={range === k ? "default" : "outline"} onClick={() => setRange(k)}>
            {label}
          </Button>
        ))}
        {range === "custom" && (
          <div className="flex items-center gap-2">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
              className="h-9 rounded-lg border border-border bg-input px-2 text-sm" />
            <span className="text-sm text-muted-foreground">to</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
              className="h-9 rounded-lg border border-border bg-input px-2 text-sm" />
          </div>
        )}
      </div>



      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card label="Total Sales" value={rows.length.toString()} />
        <Card label="Total Amount" value={fmt(totals.total)} />
        <Card label="Total Paid" value={fmt(totals.paid)} />
        <Card label="Total Due" value={fmt(totals.total - totals.paid)} />
        {isAdmin && <Card label="Total Profit" value={fmt(totalProfit)} />}
        {isAdmin && <Card label="Avg Margin" value={`${totalMargin.toFixed(1)}%`} />}
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-3">Date</th>
              <th className="text-left p-3">Invoice</th>
              <th className="text-left p-3">Customer</th>
              <th className="text-left p-3">Location</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Payment</th>
              <th className="text-right p-3">Total</th>
              <th className="text-right p-3">Paid</th>
              <th className="text-right p-3">Due</th>
              {isAdmin && <th className="text-right p-3">Profit</th>}
              {isAdmin && <th className="text-right p-3">Margin</th>}
              <th className="text-right p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={isAdmin ? 12 : 10} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={isAdmin ? 12 : 10} className="p-6 text-center text-muted-foreground">No sales yet.</td></tr>
            ) : (
              rows.map((r) => {
                const due = Number(r.final_total || 0) - Number(r.total_paid || 0);
                const p = (profitByInvoice as any)[r.id];
                const profit = p ? p.revenue - p.cost : null;
                const margin = p && p.revenue > 0 ? (profit! / p.revenue) * 100 : null;
                return (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 whitespace-nowrap">{formatDate(r.transaction_date)}</td>
                    <td className="p-3 font-mono text-xs">{r.invoice_no ?? r.ref_no ?? "—"}</td>
                    <td className="p-3">{r.contact?.name ?? "Walk-in"}</td>
                    <td className="p-3">{r.location?.name ?? "—"}</td>
                    <td className="p-3 capitalize">{r.status}</td>
                    <td className="p-3 capitalize">{r.payment_status}</td>
                    <td className="p-3 text-right">{fmt(Number(r.final_total))}</td>
                    <td className="p-3 text-right">{fmt(Number(r.total_paid))}</td>
                    <td className="p-3 text-right">{fmt(due)}</td>
                    {isAdmin && <td className={`p-3 text-right font-semibold ${profit === null ? "text-muted-foreground" : profit >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                      {profit === null ? "…" : fmt(profit)}
                    </td>}
                    {isAdmin && <td className={`p-3 text-right ${margin === null ? "text-muted-foreground" : margin >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                      {margin === null ? "…" : `${margin.toFixed(1)}%`}
                    </td>}
                    <td className="p-3 text-right">
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="outline" disabled={printingId === r.id} onClick={() => reprint(r.id)} title="Print">
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button asChild size="sm" variant="outline" title="Edit">
                          <Link to="/sales/$id/edit" params={{ id: r.id }}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button size="sm" variant="destructive" disabled={deletingId === r.id} onClick={() => handleDelete(r)} title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Sale</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Invoice No</Label>
              <Input value={editForm.invoice_no} onChange={(e) => setEditForm({ ...editForm, invoice_no: e.target.value })} />
            </div>
            <div>
              <Label>Date & Time</Label>
              <Input type="datetime-local" value={editForm.transaction_date} onChange={(e) => setEditForm({ ...editForm, transaction_date: e.target.value })} />
            </div>
            <div>
              <Label>Amount Paid</Label>
              <Input type="number" step="0.01" value={editForm.total_paid} onChange={(e) => setEditForm({ ...editForm, total_paid: e.target.value })} />
              <p className="text-xs text-muted-foreground mt-1">Total: {fmt(Number(editRow?.final_total || 0))}</p>
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={editForm.additional_notes} onChange={(e) => setEditForm({ ...editForm, additional_notes: e.target.value })} />
            </div>
            <p className="text-xs text-muted-foreground">To edit line items, delete this sale and create a new one from POS.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Cancel</Button>
            <Button disabled={editSaving} onClick={saveEdit}>{editSaving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
