import { FloatingSearch } from "@/components/floating-search";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { Button } from "@/components/ui/button";
import { Trash2, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sales_/$id/edit")({
  component: EditSalePage,
});

type Line = {
  product_id: string;
  variation_id: string;
  name: string;
  quantity: string;
  unit_price: string;
  line_total: string;
};

function EditSalePage() {
  const { id } = Route.useParams();
  const { data: business } = useCurrentBusiness();
  const navigate = useNavigate();

  const [invoiceNo, setInvoiceNo] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState("0");
  const [paid, setPaid] = useState("0");
  const [contactId, setContactId] = useState<string>("");
  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);

  const { data: existing, isFetching: fetchingExisting } = useQuery({
    queryKey: ["sale-edit", id],
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data: tx } = await supabase.from("transactions").select("*").eq("id", id).maybeSingle();
      const { data: ls } = await supabase
        .from("transaction_sell_lines")
        .select("product_id, variation_id, quantity, unit_price, product:products(name), variation:variations(name)")
        .eq("transaction_id", id);
      return { tx, lines: ls ?? [] };
    },
  });

  useEffect(() => {
    if (!existing?.tx || fetchingExisting || loaded) return;

    const t: any = existing.tx;
    setInvoiceNo(t.invoice_no ?? "");
    setDate(new Date(t.transaction_date).toISOString().slice(0, 16));
    setNotes(t.additional_notes ?? "");
    setDiscount(String(t.discount_amount ?? 0));
    setPaid(String(t.total_paid ?? 0));
    setContactId(t.contact_id ?? "");
    setLines(
      existing.lines.map((l: any) => {
        const qty = Number(l.quantity ?? 0);
        const pp = Number(l.unit_price ?? 0);
        return {
          product_id: l.product_id,
          variation_id: l.variation_id,
          name: `${l.product?.name ?? ""}${l.variation?.name && l.variation.name !== "DUMMY" ? ` (${l.variation.name})` : ""}`,
          quantity: String(qty),
          unit_price: String(pp),
          line_total: qty > 0 && pp > 0 ? (qty * pp).toFixed(2) : "",
        };
      }),
    );
    setLoaded(true);
  }, [existing, fetchingExisting, loaded]);

  const { data: searchResults = [] } = useQuery({
    queryKey: ["sale-edit-product-search", business?.id, search],
    enabled: !!business?.id && search.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, variations(id, name, default_sell_price, mrp)")
        .eq("business_id", business!.id)
        .or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  function addLine(product: any, variation: any) {
    const price = Number(variation.mrp ?? variation.default_sell_price ?? 0);
    setLines((prev) => [
      ...prev,
      {
        product_id: product.id,
        variation_id: variation.id,
        name: `${product.name}${variation.name && variation.name !== "DUMMY" ? ` (${variation.name})` : ""}`,
        quantity: "1",
        unit_price: String(price),
        line_total: price > 0 ? price.toFixed(2) : "",
      },
    ]);
    setSearch("");
  }

  function setQty(idx: number, v: string) {
    const qty = Number(v || 0);
    setLines((prev) => prev.map((l, i) => {
      if (i !== idx) return l;
      const pp = Number(l.unit_price || 0);
      return { ...l, quantity: v, line_total: qty > 0 && pp > 0 ? (qty * pp).toFixed(2) : l.line_total };
    }));
  }
  function setPrice(idx: number, v: string) {
    const pp = Number(v || 0);
    setLines((prev) => prev.map((l, i) => {
      if (i !== idx) return l;
      const qty = Number(l.quantity || 0);
      return { ...l, unit_price: v, line_total: qty > 0 && pp > 0 ? (qty * pp).toFixed(2) : l.line_total };
    }));
  }
  function setLineTotal(idx: number, v: string) {
    const lt = Number(v || 0);
    setLines((prev) => prev.map((l, i) => {
      if (i !== idx) return l;
      const qty = Number(l.quantity || 0);
      return { ...l, line_total: v, unit_price: qty > 0 && lt > 0 ? (lt / qty).toFixed(4).replace(/\.?0+$/, "") : l.unit_price };
    }));
  }
  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unit_price || 0), 0),
    [lines],
  );
  const total = Math.max(subtotal - Number(discount || 0), 0);

  const save = useMutation({
    mutationFn: async () => {
      if (lines.length === 0) throw new Error("Add at least one product");
      const { error } = await supabase.rpc("update_sale" as any, {
        _id: id,
        _payload: {
          invoice_no: invoiceNo || null,
          transaction_date: new Date(date).toISOString(),
          contact_id: contactId || null,
          additional_notes: notes || null,
          discount_amount: Number(discount || 0),
          total_paid: Number(paid || 0),
          lines: lines.map((l) => ({
            product_id: l.product_id,
            variation_id: l.variation_id,
            quantity: Number(l.quantity),
            unit_price: Number(l.unit_price),
          })),
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sale updated");
      navigate({ to: "/sales" });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to update"),
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: "BDT", maximumFractionDigits: 2 }).format(n || 0);

  const inputCls = "w-full h-9 rounded-lg border border-border bg-input px-3 text-sm";
  const labelCls = "block text-xs font-medium text-muted-foreground mb-1.5";

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-full overflow-x-hidden">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-semibold truncate">Edit Sale</h1>
        <Button onClick={() => save.mutate()} disabled={save.isPending} size="sm" className="shrink-0">
          <Save className="h-4 w-4 mr-1" /> {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5 grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className={labelCls}>Invoice No.</span>
          <input className={inputCls} value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelCls}>Date & time</span>
          <input type="datetime-local" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelCls}>Discount</span>
          <input type="number" step="any" className={inputCls} value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelCls}>Amount paid</span>
          <input type="number" step="any" className={inputCls} value={paid} onChange={(e) => setPaid(e.target.value)} />
        </label>
        <label className="block sm:col-span-2">
          <span className={labelCls}>Notes</span>
          <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold">Products</h3>
        <FloatingSearch
          spacer={48}
          className="max-w-[calc(100vw-24px)]"
          results={
            search.trim().length >= 2 && searchResults.length > 0 ? (
              <div className="mt-1 max-h-72 overflow-auto rounded-lg border border-border bg-popover shadow-lg">
                {searchResults.flatMap((p: any) =>
                  (p.variations ?? []).map((v: any) => (
                    <button type="button" key={`${p.id}-${v.id}`} onClick={() => addLine(p, v)} className="block w-full text-left px-3 py-2 text-sm hover:bg-muted/50">
                      <div className="font-medium">{p.name}{v.name && v.name !== "DUMMY" ? ` — ${v.name}` : ""}</div>
                      <div className="text-xs text-muted-foreground">SKU: {p.sku}</div>
                    </button>
                  )),
                )}
              </div>
            ) : null
          }
        >
          <input className={inputCls} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product by name, SKU or barcode…" />
        </FloatingSearch>

        <div className="space-y-2">
          {lines.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No lines yet.</div>
          ) : (
            lines.map((l, idx) => (
              <div key={idx} className="rounded-lg border border-border/60 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium min-w-0 break-words">{l.name}</div>
                  <button onClick={() => removeLine(idx)} className="text-destructive hover:bg-destructive/10 rounded p-1 shrink-0"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <label className="block">
                    <span className={labelCls}>Qty</span>
                    <input type="number" step="any" className={inputCls} value={l.quantity} onChange={(e) => setQty(idx, e.target.value)} />
                  </label>
                  <label className="block">
                    <span className={labelCls}>Unit price</span>
                    <input type="number" step="any" className={inputCls} value={l.unit_price} onChange={(e) => setPrice(idx, e.target.value)} />
                  </label>
                  <label className="block">
                    <span className={labelCls}>Line total</span>
                    <input type="number" step="any" className={inputCls + " font-semibold"} value={l.line_total} onChange={(e) => setLineTotal(idx, e.target.value)} />
                  </label>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-col items-end gap-1 pt-3 border-t text-sm">
          <div>Subtotal: <span className="font-semibold">{fmt(subtotal)}</span></div>
          <div>Discount: <span className="font-semibold">{fmt(Number(discount || 0))}</span></div>
          <div className="text-base">Total: <span className="font-bold">{fmt(total)}</span></div>
        </div>
      </div>
    </div>
  );
}
