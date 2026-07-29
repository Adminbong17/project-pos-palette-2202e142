import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { Button } from "@/components/ui/button";
import { Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { DateTextInput } from "@/components/date-text-input";

export const Route = createFileRoute("/_authenticated/purchases/$id/edit")({
  component: EditPurchasePage,
});

type Line = {
  product_id: string;
  variation_id: string;
  name: string;
  quantity: string;
  purchase_price: string;
  line_total: string;
  expire_date: string;
  previous_purchase_price: number | null;
  unit: "pcs" | "box";
  pack_size: string;
  original_pack_size: number;
};


function EditPurchasePage() {
  const qc = useQueryClient();
  const { id } = Route.useParams();
  const { data: business } = useCurrentBusiness();
  const navigate = useNavigate();

  const [locationId, setLocationId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [refNo, setRefNo] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [status, setStatus] = useState<"received" | "pending" | "ordered">("received");
  const [notes, setNotes] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [vatMode, setVatMode] = useState<"amount" | "percent">("amount");
  const [vatValue, setVatValue] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);

  const { data: refs } = useQuery({
    queryKey: ["purchase-new-refs", business?.id],
    enabled: !!business?.id,
    queryFn: async () => {
      const [locs, suppliers] = await Promise.all([
        supabase.from("business_locations").select("id, name").eq("business_id", business!.id).eq("is_active", true),
        supabase.from("brands").select("id, name").eq("business_id", business!.id).order("name"),
      ]);
      return { locations: locs.data ?? [], suppliers: suppliers.data ?? [] };
    },
  });

  const { data: existing, isFetching: fetchingExisting } = useQuery({
    queryKey: ["purchase-edit", id],
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data: tx } = await supabase.from("transactions").select("*").eq("id", id).maybeSingle();
      const { data: ls } = await supabase
        .from("transaction_purchase_lines")
        .select("product_id, variation_id, quantity, purchase_price, expire_date, product:products(name), variation:variations(name, pack_size)")
        .eq("transaction_id", id);
      return { tx, lines: ls ?? [] };
    },
  });


  useEffect(() => {
    if (!existing?.tx || fetchingExisting || loaded) return;

    const t: any = existing.tx;
    setLocationId(t.location_id ?? "");
    setRefNo(t.ref_no ?? "");
    setDate(new Date(t.transaction_date).toISOString().slice(0, 16));
    setStatus(t.status);
    setNotes(t.additional_notes ?? "");
    setAmountPaid(String(t.total_paid ?? ""));
    setLines(
      existing.lines.map((l: any) => {
        const qty = Number(l.quantity ?? 0);
        const pp = Number(l.purchase_price ?? 0);
        const ps = Math.max(1, Math.floor(Number(l.variation?.pack_size ?? 1)));
        return {
          product_id: l.product_id,
          variation_id: l.variation_id,
          name: `${l.product?.name ?? ""}${l.variation?.name && l.variation.name !== "DUMMY" ? ` (${l.variation.name})` : ""}`,
          quantity: String(l.quantity ?? ""),
          purchase_price: String(l.purchase_price ?? ""),
          line_total: qty > 0 && pp > 0 ? (qty * pp).toFixed(2) : "",
          expire_date: l.expire_date ?? "",
          previous_purchase_price: null,
          unit: "pcs" as const,
          pack_size: String(ps),
          original_pack_size: ps,
        };
      }),
    );

    setLoaded(true);
    // Resolve current supplier name from contact_id
    if (t.contact_id) {
      supabase.from("contacts").select("name").eq("id", t.contact_id).maybeSingle().then(({ data }) => {
        if (data?.name) setSupplierName(data.name);
      });
    }
  }, [existing, fetchingExisting, loaded]);

  const { data: searchResults = [] } = useQuery({
    queryKey: ["purchase-product-search", business?.id, search],
    enabled: !!business?.id && search.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, variations(id, name, default_purchase_price)")
        .eq("business_id", business!.id)
        .or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function addLine(product: any, variation: any) {
    const prev = Number(variation.default_purchase_price ?? 0);
    const { data: v } = await supabase.from("variations").select("pack_size").eq("id", variation.id).maybeSingle();
    const ps = Math.max(1, Math.floor(Number((v as any)?.pack_size ?? 1)));
    setLines((prev2) => [
      ...prev2,
      {
        product_id: product.id,
        variation_id: variation.id,
        name: `${product.name}${variation.name && variation.name !== "DUMMY" ? ` (${variation.name})` : ""}`,
        quantity: "",
        purchase_price: "",
        line_total: "",
        expire_date: "",
        previous_purchase_price: prev > 0 ? prev : null,
        unit: ps > 1 ? "box" : "pcs",
        pack_size: String(ps),
        original_pack_size: ps,
      },
    ]);
    setSearch("");
  }


  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function setQty(idx: number, v: string) {
    const qty = Number(v || 0);
    setLines((prev) => prev.map((l, i) => {
      if (i !== idx) return l;
      const lt = Number(l.line_total || 0);
      if (qty > 0 && lt > 0) return { ...l, quantity: v, purchase_price: (lt / qty).toFixed(4).replace(/\.?0+$/, "") };
      const pp = Number(l.purchase_price || 0);
      if (qty > 0 && pp > 0) return { ...l, quantity: v, line_total: (qty * pp).toFixed(2) };
      return { ...l, quantity: v };
    }));
  }
  function setPrice(idx: number, v: string) {
    const pp = Number(v || 0);
    setLines((prev) => prev.map((l, i) => {
      if (i !== idx) return l;
      const qty = Number(l.quantity || 0);
      return { ...l, purchase_price: v, line_total: qty > 0 && pp > 0 ? (qty * pp).toFixed(2) : l.line_total };
    }));
  }
  function setLineTotal(idx: number, v: string) {
    const lt = Number(v || 0);
    setLines((prev) => prev.map((l, i) => {
      if (i !== idx) return l;
      const qty = Number(l.quantity || 0);
      return { ...l, line_total: v, purchase_price: qty > 0 && lt > 0 ? (lt / qty).toFixed(4).replace(/\.?0+$/, "") : l.purchase_price };
    }));
  }
  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  const total = useMemo(
    () => lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.purchase_price || 0), 0),
    [lines],
  );

  const totalPcs = useMemo(
    () =>
      lines.reduce((s, l) => {
        const ps = Math.max(1, Math.floor(Number(l.pack_size || 1)));
        return s + Number(l.quantity || 0) * (l.unit === "box" ? ps : 1);
      }, 0),
    [lines],
  );

  const vatAmount = useMemo(() => {
    const v = Number(vatValue || 0);
    if (!v) return 0;
    return vatMode === "percent" ? (total * v) / 100 : v;
  }, [vatValue, vatMode, total]);

  const vatPerPcs = totalPcs > 0 ? vatAmount / totalPcs : 0;
  const grandTotal = total + vatAmount;


  const save = useMutation({
    mutationFn: async () => {
      if (!locationId) throw new Error("Select a location");
      if (lines.length === 0) throw new Error("Add at least one product");

      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (!refreshed.session) throw new Error("Session expired — please log in again and retry.");
      }

      let contactId: string | null = null;
      const name = supplierName.trim();
      if (name && business) {
        const { data: found } = await supabase
          .from("contacts")
          .select("id")
          .eq("business_id", business.id)
          .ilike("name", name)
          .in("type", ["supplier", "both"])
          .maybeSingle();
        if (found?.id) {
          contactId = found.id;
        } else {
          const { data: inserted, error: insErr } = await supabase
            .from("contacts")
            .insert({ business_id: business.id, name, type: "supplier" })
            .select("id")
            .single();
          if (insErr) {
            const { data: any1 } = await supabase
              .from("contacts")
              .select("id")
              .eq("business_id", business.id)
              .ilike("name", name)
              .maybeSingle();
            contactId = any1?.id ?? null;
            if (!contactId) toast.warning("Supplier could not be saved, purchase saved without supplier link.");
          } else {
            contactId = inserted.id;
          }
        }
      }


      // Persist any changed pack_size values back to variations

      const packUpdates = lines
        .map((l) => ({ id: l.variation_id, ps: Math.max(1, Math.floor(Number(l.pack_size || 1))) }))
        .filter((x, i, arr) => x.ps !== lines[i].original_pack_size && arr.findIndex((y) => y.id === x.id) === i);
      for (const u of packUpdates) {
        await supabase.from("variations").update({ pack_size: u.ps }).eq("id", u.id);
      }

      const { data, error } = await supabase.rpc("update_purchase" as any, {
        _id: id,
        _payload: {
          location_id: locationId,
          contact_id: contactId,
          ref_no: refNo || null,
          transaction_date: new Date(date).toISOString(),
          status,
          additional_notes: notes || null,
          amount_paid: Number(amountPaid || 0),
          payment_method: paymentMethod,
          lines: lines.map((l) => {
            const ps = Math.max(1, Math.floor(Number(l.pack_size || 1)));
            const mult = l.unit === "box" ? ps : 1;
            const perPcs = (mult > 1 ? Number(l.purchase_price) / mult : Number(l.purchase_price)) + vatPerPcs;
            return {
              product_id: l.product_id,
              variation_id: l.variation_id,
              quantity: Number(l.quantity) * mult,
              purchase_price: perPcs,
              expire_date: l.expire_date || null,
            };
          }),

        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Purchase updated");
      qc.invalidateQueries();
      navigate({ to: "/purchases/$id", params: { id } });
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
        <h1 className="text-xl sm:text-2xl font-semibold truncate">Edit Purchase</h1>
        <Button onClick={() => save.mutate()} disabled={save.isPending} size="sm" className="shrink-0">
          <Save className="h-4 w-4 mr-1" /> {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5 grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className={labelCls}>Supplier</span>
          <input
            className={inputCls}
            list="supplier-options-edit"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            placeholder="Search or type supplier name…"
            autoComplete="off"
          />
          <datalist id="supplier-options-edit">
            {refs?.suppliers.map((s: any) => <option key={s.id} value={s.name} />)}
          </datalist>
        </label>
        <label className="block">
          <span className={labelCls}>Location *</span>
          <select className={inputCls} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">— Select —</option>
            {refs?.locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Reference No.</span>
          <input className={inputCls} value={refNo} onChange={(e) => setRefNo(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelCls}>Purchase date</span>
          <input type="datetime-local" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelCls}>Status</span>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as any)}>
            <option value="received">Received (updates stock)</option>
            <option value="pending">Pending</option>
            <option value="ordered">Ordered</option>
          </select>
        </label>
        <label className="block sm:col-span-3">
          <span className={labelCls}>Notes</span>
          <textarea className="w-full min-h-[60px] rounded-lg border border-border bg-input px-3 py-2 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold">Products</h3>
        <div className="relative">
          <input className={inputCls} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product by name or SKU…" />
          {search.trim().length >= 2 && searchResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-full max-h-72 overflow-auto rounded-lg border border-border bg-popover shadow-lg">
              {searchResults.flatMap((p: any) =>
                (p.variations ?? []).map((v: any) => (
                  <button type="button" key={`${p.id}-${v.id}`} onClick={() => addLine(p, v)} className="block w-full text-left px-3 py-2 text-sm hover:bg-muted/50">
                    <div className="font-medium">{p.name}{v.name && v.name !== "DUMMY" ? ` — ${v.name}` : ""}</div>
                    <div className="text-xs text-muted-foreground">SKU: {p.sku}</div>
                  </button>
                )),
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          {lines.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No lines yet.</div>
          ) : (
            lines.map((l, idx) => {
              const ps = Math.max(1, Math.floor(Number(l.pack_size || 1)));
              const totalPcs = Number(l.quantity || 0) * (l.unit === "box" ? ps : 1);
              return (
              <div key={idx} className="rounded-lg border border-border/60 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium min-w-0 break-words">{l.name}</div>
                  <button onClick={() => removeLine(idx)} className="text-destructive hover:bg-destructive/10 rounded p-1 shrink-0"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button type="button" onClick={() => updateLine(idx, { unit: "pcs" })} className={`flex-1 h-8 rounded border ${l.unit === "pcs" ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>Pcs</button>
                  <button type="button" onClick={() => updateLine(idx, { unit: "box" })} className={`flex-1 h-8 rounded border ${l.unit === "box" ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>Box</button>
                  <label className="flex items-center gap-1">
                    <span className="text-muted-foreground">Pcs/Box</span>
                    <input type="number" min="1" step="1" className="w-16 h-8 rounded border border-border bg-input px-2 text-xs" value={l.pack_size} onChange={(e) => updateLine(idx, { pack_size: e.target.value })} />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className={labelCls}>Qty ({l.unit})</span>
                    <input type="number" step="any" className={inputCls} value={l.quantity} onChange={(e) => setQty(idx, e.target.value)} />
                  </label>
                  <label className="block">
                    <span className={labelCls}>Total price</span>
                    <input type="number" step="any" className={inputCls + " font-semibold"} value={l.line_total} onChange={(e) => setLineTotal(idx, e.target.value)} />
                  </label>
                </div>
                {l.unit === "box" && Number(l.quantity) > 0 && (
                  <div className="text-[11px] text-muted-foreground">= {totalPcs} pcs total</div>
                )}
                <label className="block">
                  <span className={labelCls}>Per {l.unit} price</span>
                  <div className="rounded-lg border border-primary/40 bg-primary/5 p-1">
                    <input type="number" step="any" className="w-full h-8 rounded-md bg-transparent px-2 text-sm font-semibold" value={l.purchase_price} onChange={(e) => setPrice(idx, e.target.value)} />
                  </div>
                  {l.unit === "box" && Number(l.purchase_price) > 0 && (
                    <div className="text-[11px] text-muted-foreground mt-1">{fmt(Number(l.purchase_price) / ps)} / pcs</div>
                  )}
                </label>
                <label className="block">
                  <span className={labelCls}>Expire date</span>
                  <DateTextInput className={inputCls} value={l.expire_date} onChange={(v) => updateLine(idx, { expire_date: v })} />
                </label>
                {l.previous_purchase_price != null && (
                  <div className="text-[11px] text-muted-foreground flex gap-2 flex-wrap">
                    <button type="button" className="underline hover:text-foreground" onClick={() => setPrice(idx, String(l.previous_purchase_price))}>Prev: {fmt(l.previous_purchase_price)}</button>
                    {Number(l.purchase_price) > 0 && (
                      <button type="button" className="underline hover:text-foreground" onClick={() => setPrice(idx, ((Number(l.purchase_price) + Number(l.previous_purchase_price!)) / 2).toFixed(2))}>Avg: {fmt((Number(l.purchase_price) + Number(l.previous_purchase_price)) / 2)}</button>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between text-sm border-t border-border/60 pt-2">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-semibold">{fmt(Number(l.quantity) * Number(l.purchase_price))}</span>
                </div>
              </div>
              );
            })

          )}
          {lines.length > 0 && (
            <div className="flex items-center justify-between text-sm border-t pt-2 font-semibold">
              <span>Total</span><span>{fmt(total)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5 grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className={labelCls}>Amount paid</span>
          <input type="number" step="any" className={inputCls} value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelCls}>Payment method</span>
          <select className={inputCls} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="cash">Cash</option><option value="card">Card</option><option value="bank_transfer">Bank transfer</option><option value="cheque">Cheque</option><option value="other">Other</option>
          </select>
        </label>
        <div className="text-sm self-end">
          <div className="text-muted-foreground text-xs">Due</div>
          <div className="font-semibold">{fmt(Math.max(0, total - Number(amountPaid || 0)))}</div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate({ to: "/purchases/$id", params: { id } })}>Cancel</Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="h-4 w-4 mr-1" />{save.isPending ? "Saving…" : "Save"}</Button>
      </div>
    </div>
  );
}
