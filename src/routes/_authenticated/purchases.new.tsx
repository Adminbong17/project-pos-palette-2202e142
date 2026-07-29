import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Save, ScanLine, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { DateTextInput } from "@/components/date-text-input";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { PhoneScanDialog } from "@/components/PhoneScanDialog";
import { useAutosaveDraft } from "@/hooks/use-autosave-draft";

export const Route = createFileRoute("/_authenticated/purchases/new")({
  component: NewPurchasePage,
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
  mrp: string;
  original_mrp: number;
};


function NewPurchasePage() {
  const { data: business } = useCurrentBusiness();
  const navigate = useNavigate();
  const qc = useQueryClient();

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
  const [vatPercent, setVatPercent] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState("");

  // Auto-save this purchase draft (power cut / accidental close safe).
  const { clearDraft: clearPurchaseDraft } = useAutosaveDraft(
    business?.id ? `purchase-new:${business.id}` : null,
    { locationId, supplierName, refNo, date, status, notes, amountPaid, paymentMethod, vatMode, vatValue, vatPercent, lines },
    (d) => {
      if (d.locationId) setLocationId(d.locationId);
      if (d.supplierName) setSupplierName(d.supplierName);
      if (d.refNo) setRefNo(d.refNo);
      if (d.date) setDate(d.date);
      if (d.status) setStatus(d.status);
      if (d.notes) setNotes(d.notes);
      if (d.amountPaid) setAmountPaid(d.amountPaid);
      if (d.paymentMethod) setPaymentMethod(d.paymentMethod);
      if (d.vatMode) setVatMode(d.vatMode);
      if (d.vatValue) setVatValue(d.vatValue);
      if (d.vatPercent) setVatPercent(d.vatPercent);
      if (d.lines?.length) setLines(d.lines);
    },
    { isEmpty: (d) => !d.lines?.length && !d.supplierName && !d.refNo && !d.notes, restoreMessage: "Unsaved purchase restored" },
  );

  const [scanOpen, setScanOpen] = useState(false);
  const [phoneScanOpen, setPhoneScanOpen] = useState(false);

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

  useEffect(() => {
    if (!locationId && refs?.locations?.[0]) setLocationId(refs.locations[0].id);
  }, [refs, locationId]);

  const { data: searchResults = [] } = useQuery({
    queryKey: ["purchase-product-search", business?.id, search],
    enabled: !!business?.id && search.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, variations(id, name, default_purchase_price, pack_size, mrp)")
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
    let lastPrice: number | null = prev > 0 ? prev : null;
    try {
      const { data } = await supabase
        .from("transaction_purchase_lines")
        .select("purchase_price, transaction:transactions!inner(transaction_date, business_id)")
        .eq("variation_id", variation.id)
        .eq("transaction.business_id", business!.id)
        .order("transaction(transaction_date)", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.purchase_price != null) lastPrice = Number(data.purchase_price);
    } catch {}
    const ps = Number(variation.pack_size ?? 1) || 1;
    const mrpVal = Number(variation.mrp ?? 0) || 0;
    setLines((prev) => [
      ...prev,
      {
        product_id: product.id,
        variation_id: variation.id,
        name: `${product.name}${variation.name && variation.name !== "DUMMY" ? ` (${variation.name})` : ""}`,
        quantity: "",
        purchase_price: "",
        line_total: "",
        expire_date: "",
        previous_purchase_price: lastPrice,
        unit: ps > 1 ? "box" : "pcs",
        pack_size: String(ps),
        original_pack_size: ps,
        mrp: mrpVal ? String(mrpVal) : "",
        original_mrp: mrpVal,
      },
    ]);
    setSearch("");
  }

  async function handleScanned(code: string) {
    const trimmed = code.trim();
    if (!trimmed || !business) return;
    const { data, error } = await supabase
      .from("products")
      .select("id, name, sku, variations(id, name, default_purchase_price, pack_size, mrp)")
      .eq("business_id", business.id)
      .or(`barcode.eq.${trimmed},sku.eq.${trimmed}`)
      .limit(1);
    if (error) { toast.error(error.message); return; }
    const p = data?.[0];
    const v = p?.variations?.[0];
    if (!p || !v) {
      toast.error(`No product for code ${trimmed}`);
      return;
    }
    const existing = lines.findIndex((l) => l.variation_id === v.id);
    if (existing >= 0) {
      setQty(existing, String(Number(lines[existing].quantity || 0) + 1));
      toast.success(`+1 ${p.name}`);
    } else {
      await addLine(p, v);
      toast.success(`Added ${p.name}`);
    }
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

  const vatPct = Math.max(0, Number(vatPercent || 0));

  const vatAmount = useMemo(() => {
    if (vatPct > 0) return (total * vatPct) / 100;
    const v = Number(vatValue || 0);
    if (!v) return 0;
    return vatMode === "percent" ? (total * v) / 100 : v;
  }, [vatValue, vatMode, total, vatPct]);

  const vatPerPcs = vatPct > 0 ? 0 : totalPcs > 0 ? vatAmount / totalPcs : 0;
  const grandTotal = total + vatAmount;
  // VAT-inclusive effective cost that will actually be saved to the product
  const withVatPerPcs = (basePerPcs: number) => basePerPcs * (1 + vatPct / 100) + vatPerPcs;



  const save = useMutation({
    mutationFn: async () => {
      if (!business) throw new Error("No business");
      if (!locationId) throw new Error("Select a location");
      if (lines.length === 0) throw new Error("Add at least one product");

      // Make sure the login session is still valid — an expired session makes
      // every write fail with a row-level-security error.
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (!refreshed.session) throw new Error("Session expired — please log in again and retry.");
      }

      // Ensure a contact row exists for the chosen supplier name so it shows up in the list
      let contactId: string | null = null;
      const name = supplierName.trim();
      if (name) {
        const { data: existing } = await supabase
          .from("contacts")
          .select("id")
          .eq("business_id", business.id)
          .ilike("name", name)
          .in("type", ["supplier", "both"])
          .maybeSingle();
        if (existing?.id) {
          contactId = existing.id;
        } else {
          const { data: inserted, error: insErr } = await supabase
            .from("contacts")
            .insert({ business_id: business.id, name, type: "supplier" })
            .select("id")
            .single();
          if (insErr) {
            // Fall back to any existing contact with this name (maybe a customer),
            // otherwise save the purchase without linking a supplier record.
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

      // Persist any changed MRP values back to variations
      const mrpUpdates = lines
        .map((l) => ({ id: l.variation_id, mrp: Number(l.mrp || 0) }))
        .filter((x, i, arr) => x.mrp !== lines[i].original_mrp && arr.findIndex((y) => y.id === x.id) === i);
      for (const u of mrpUpdates) {
        await supabase.from("variations").update({ mrp: u.mrp }).eq("id", u.id);
      }

      // Sync latest purchase price + MRP back to products and variations so that
      // the Products list (which reads from products.mrp / default_purchase_price)
      // stays in sync with the most recent purchase.
      const seenProducts = new Set<string>();
      const seenVariations = new Set<string>();
      for (const l of lines) {
        const ps = Math.max(1, Math.floor(Number(l.pack_size || 1)));
        const mult = l.unit === "box" ? ps : 1;
        // Per-piece cost WITH VAT included, so the product price stays accurate.
        const basePerPcs = Number(l.purchase_price || 0) / (mult || 1);
        const perPcsPrice = basePerPcs > 0 ? basePerPcs * (1 + vatPct / 100) + vatPerPcs : 0;
        const mrpVal = Number(l.mrp || 0);
        if (!seenVariations.has(l.variation_id) && perPcsPrice > 0) {
          seenVariations.add(l.variation_id);
          await supabase
            .from("variations")
            .update({ default_purchase_price: perPcsPrice, dpp_inc_tax: perPcsPrice })
            .eq("id", l.variation_id);
        }
        if (!seenProducts.has(l.product_id)) {
          seenProducts.add(l.product_id);
          const patch: { default_purchase_price?: number; mrp?: number } = {};
          if (perPcsPrice > 0) patch.default_purchase_price = perPcsPrice;
          if (mrpVal > 0) patch.mrp = mrpVal;
          if (Object.keys(patch).length > 0) {
            await supabase.from("products").update(patch).eq("id", l.product_id);
          }
        }
      }

      const { data, error } = await supabase.rpc("create_purchase" as any, {
        _payload: {
          business_id: business.id,
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
            const base = mult > 1 ? Number(l.purchase_price) / mult : Number(l.purchase_price);
            const perPcs = base * (1 + vatPct / 100) + vatPerPcs;
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
      toast.success("Purchase saved");
      clearPurchaseDraft();
      qc.invalidateQueries();
      navigate({ to: "/purchases" });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save purchase"),
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: "BDT", maximumFractionDigits: 2 }).format(n || 0);

  const inputCls = "w-full h-9 rounded-lg border border-border bg-input px-3 text-sm";
  const labelCls = "block text-xs font-medium text-muted-foreground mb-1.5";

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-full overflow-x-hidden">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-semibold truncate">Add Purchase</h1>
        <Button onClick={() => save.mutate()} disabled={save.isPending} size="sm" className="shrink-0">
          <Save className="h-4 w-4 mr-1" /> {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5 grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className={labelCls}>Supplier</span>
          <input
            className={inputCls}
            list="supplier-options"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            placeholder="Search or type supplier name…"
            autoComplete="off"
          />
          <datalist id="supplier-options">
            {refs?.suppliers.map((s: any) => <option key={s.id} value={s.name} />)}
          </datalist>
        </label>
        <label className="block">
          <span className={labelCls}>Location <span className="text-destructive">*</span></span>
          <select className={inputCls} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">— Select —</option>
            {refs?.locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Reference No.</span>
          <input className={inputCls} value={refNo} onChange={(e) => setRefNo(e.target.value)} placeholder="Auto" />
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
        <label className="block">
          <span className={labelCls}>VAT %  (purchase price-এ অটো যোগ হবে)</span>
          <input
            type="number"
            step="any"
            min="0"
            placeholder="e.g. 15"
            className={inputCls}
            value={vatPercent}
            onChange={(e) => {
              setVatPercent(e.target.value);
              if (Number(e.target.value || 0) > 0) setVatValue("");
            }}
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            {vatPct > 0 ? `প্রতিটি প্রোডাক্টের দামে +${vatPct}% যোগ হবে` : "খালি রাখলে নিচের VAT বক্স ব্যবহার হবে"}
          </span>
        </label>
        <label className="block sm:col-span-3">
          <span className={labelCls}>Notes</span>
          <textarea className="w-full min-h-[60px] rounded-lg border border-border bg-input px-3 py-2 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-semibold">Products</h3>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setScanOpen(true)}>
              <ScanLine className="h-4 w-4 mr-1" /> Scan
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setPhoneScanOpen(true)}>
              <Smartphone className="h-4 w-4 mr-1" /> Phone
            </Button>
          </div>
        </div>
        <div className="relative">
          <input
            className={inputCls}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product by name, SKU or barcode…"
          />
          {search.trim().length >= 2 && searchResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-full max-h-72 overflow-auto rounded-lg border border-border bg-popover shadow-lg">
              {searchResults.flatMap((p: any) =>
                (p.variations ?? []).map((v: any) => (
                  <button
                    type="button"
                    key={`${p.id}-${v.id}`}
                    onClick={() => addLine(p, v)}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-muted/50"
                  >
                    <div className="font-medium">
                      {p.name}{v.name && v.name !== "DUMMY" ? ` — ${v.name}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">SKU: {p.sku} · Cost: {fmt(Number(v.default_purchase_price ?? 0))}</div>
                  </button>
                )),
              )}
            </div>
          )}
        </div>
        <BarcodeScanner open={scanOpen} onClose={() => setScanOpen(false)} onDetected={(c) => handleScanned(c)} />
        <PhoneScanDialog open={phoneScanOpen} onClose={() => setPhoneScanOpen(false)} onDetected={(c) => handleScanned(c)} />


        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-2">Product</th>
                <th className="text-right p-2 w-24">Qty</th>
                <th className="text-right p-2 w-32">Total price</th>
                <th className="text-right p-2 w-32">Unit price</th>

                <th className="text-left p-2 w-36">Expire date</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No lines yet. Search above to add products.</td></tr>
              ) : (
                lines.map((l, idx) => {
                  const ps = Math.max(1, Math.floor(Number(l.pack_size || 1)));
                  const totalPcs = Number(l.quantity || 0) * (l.unit === "box" ? ps : 1);
                  return (
                  <tr key={idx} className="border-t align-top">
                    <td className="p-2">
                      <div>{l.name}</div>
                      <div className="mt-1 flex items-center gap-1 text-[11px]">
                        <button type="button" onClick={() => updateLine(idx, { unit: "pcs" })} className={`px-2 py-0.5 rounded border ${l.unit === "pcs" ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>Pcs</button>
                        <button type="button" onClick={() => updateLine(idx, { unit: "box" })} className={`px-2 py-0.5 rounded border ${l.unit === "box" ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>Box</button>
                        <span className="text-muted-foreground ml-1">Pcs/Box</span>
                        <input type="number" min="1" step="1" className="w-14 h-6 rounded border border-border bg-input px-1 text-xs" value={l.pack_size} onChange={(e) => updateLine(idx, { pack_size: e.target.value })} />
                        {l.unit === "box" && Number(l.quantity) > 0 && (
                          <span className="text-muted-foreground">= {totalPcs} pcs</span>
                        )}
                      </div>
                      <div className="mt-1 inline-flex items-center gap-1 rounded border border-red-500 bg-red-500/10 px-1.5 py-0.5 text-[11px]">
                        <span className="font-semibold text-red-600 dark:text-red-400">MRP</span>
                        <input
                          type="number"
                          step="any"
                          placeholder="0.00"
                          className="w-20 h-6 bg-transparent px-1 text-xs text-right font-semibold text-red-600 dark:text-red-400 outline-none"
                          value={l.mrp}
                          onChange={(e) => updateLine(idx, { mrp: e.target.value })}
                        />
                      </div>
                    </td>
                    <td className="p-2">
                      <input type="number" step="any" placeholder="Qty" className={inputCls + " text-right"} value={l.quantity} onChange={(e) => setQty(idx, e.target.value)} />
                    </td>
                    <td className="p-2">
                      <input type="number" step="any" placeholder="0.00" className={inputCls + " text-right font-semibold"} value={l.line_total} onChange={(e) => setLineTotal(idx, e.target.value)} />
                    </td>
                    <td className="p-2">
                      <div className="rounded-lg border border-primary/40 bg-primary/5 p-1">
                        <input type="number" step="any" placeholder="0.00" className="w-full h-8 rounded-md bg-transparent px-2 text-sm text-right font-semibold" value={l.purchase_price} onChange={(e) => setPrice(idx, e.target.value)} />
                      </div>
                      <div className="text-[11px] text-muted-foreground text-right mt-1">per {l.unit === "box" ? "box" : "pcs"}{l.unit === "box" && Number(l.purchase_price) > 0 ? ` · ${fmt(Number(l.purchase_price) / ps)}/pcs` : ""}</div>
                      {(vatPct > 0 || vatPerPcs > 0) && Number(l.purchase_price) > 0 && (
                        <div className="text-[11px] text-right mt-1 font-medium text-primary">
                          VAT সহ: {fmt(withVatPerPcs(Number(l.purchase_price) / (l.unit === "box" ? ps : 1)))} / pcs
                          {l.unit === "box" ? ` · ${fmt(withVatPerPcs(Number(l.purchase_price) / ps) * ps)} / box` : ""}
                        </div>
                      )}

                      {l.previous_purchase_price != null && (
                        <div className="text-[11px] text-muted-foreground text-right mt-1 flex gap-2 justify-end flex-wrap">
                          <button type="button" className="underline hover:text-foreground" onClick={() => setPrice(idx, String((l.previous_purchase_price ?? 0) * (l.unit === "box" ? ps : 1)))}>Prev: {fmt((l.previous_purchase_price ?? 0) * (l.unit === "box" ? ps : 1))}</button>
                          {Number(l.purchase_price) > 0 && (
                            <button type="button" className="underline hover:text-foreground" onClick={() => setPrice(idx, ((Number(l.purchase_price) + (l.previous_purchase_price ?? 0) * (l.unit === "box" ? ps : 1)) / 2).toFixed(2))}>Avg: {fmt((Number(l.purchase_price) + (l.previous_purchase_price ?? 0) * (l.unit === "box" ? ps : 1)) / 2)}</button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-2">
                      <DateTextInput className={inputCls} value={l.expire_date} onChange={(v) => updateLine(idx, { expire_date: v })} />
                    </td>
                    <td className="p-2 text-right">
                      <button onClick={() => removeLine(idx)} className="text-destructive hover:bg-destructive/10 rounded p-1">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                  );
                })

              )}
            </tbody>
            <tfoot>
              <tr className="border-t font-semibold">
                <td className="p-2" colSpan={5}>Total</td>
                <td className="p-2 text-right">{fmt(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>


        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {lines.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No lines yet. Search above to add products.</div>
          ) : (
            lines.map((l, idx) => {
              const ps = Math.max(1, Math.floor(Number(l.pack_size || 1)));
              const totalPcs = Number(l.quantity || 0) * (l.unit === "box" ? ps : 1);
              return (
              <div key={idx} className="rounded-lg border border-border/60 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium min-w-0 break-words">{l.name}</div>
                  <button onClick={() => removeLine(idx)} className="text-destructive hover:bg-destructive/10 rounded p-1 shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-1 rounded border border-red-500 bg-red-500/10 px-2 py-1 text-xs">
                  <span className="font-semibold text-red-600 dark:text-red-400">MRP</span>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    className="flex-1 h-7 bg-transparent px-1 text-right font-semibold text-red-600 dark:text-red-400 outline-none"
                    value={l.mrp}
                    onChange={(e) => updateLine(idx, { mrp: e.target.value })}
                  />
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
                    <input type="number" step="any" placeholder="Qty" className={inputCls} value={l.quantity} onChange={(e) => setQty(idx, e.target.value)} />
                  </label>
                  <label className="block">
                    <span className={labelCls}>Total price</span>
                    <input type="number" step="any" placeholder="0.00" className={inputCls + " font-semibold"} value={l.line_total} onChange={(e) => setLineTotal(idx, e.target.value)} />
                  </label>
                </div>
                {l.unit === "box" && Number(l.quantity) > 0 && (
                  <div className="text-[11px] text-muted-foreground">= {totalPcs} pcs total</div>
                )}
                <label className="block">
                  <span className={labelCls}>Per {l.unit} price</span>
                  <div className="rounded-lg border border-primary/40 bg-primary/5 p-1">
                    <input type="number" step="any" placeholder="0.00" className="w-full h-8 rounded-md bg-transparent px-2 text-sm font-semibold" value={l.purchase_price} onChange={(e) => setPrice(idx, e.target.value)} />
                  </div>
                  {l.unit === "box" && Number(l.purchase_price) > 0 && (
                    <div className="text-[11px] text-muted-foreground mt-1">{fmt(Number(l.purchase_price) / ps)} / pcs</div>
                  )}
                  {(vatPct > 0 || vatPerPcs > 0) && Number(l.purchase_price) > 0 && (
                    <div className="text-[11px] mt-1 font-medium text-primary">
                      VAT সহ: {fmt(withVatPerPcs(Number(l.purchase_price) / (l.unit === "box" ? ps : 1)))} / pcs
                      {l.unit === "box" ? ` · ${fmt(withVatPerPcs(Number(l.purchase_price) / ps) * ps)} / box` : ""}
                    </div>
                  )}

                </label>

                <label className="block">
                  <span className={labelCls}>Expire date</span>
                  <DateTextInput className={inputCls} value={l.expire_date} onChange={(v) => updateLine(idx, { expire_date: v })} />
                </label>
                {l.previous_purchase_price != null && (
                  <div className="text-[11px] text-muted-foreground flex gap-2 flex-wrap">
                    <button type="button" className="underline hover:text-foreground" onClick={() => setPrice(idx, String((l.previous_purchase_price ?? 0) * (l.unit === "box" ? ps : 1)))}>Prev: {fmt((l.previous_purchase_price ?? 0) * (l.unit === "box" ? ps : 1))}</button>
                    {Number(l.purchase_price) > 0 && (
                      <button type="button" className="underline hover:text-foreground" onClick={() => setPrice(idx, ((Number(l.purchase_price) + (l.previous_purchase_price ?? 0) * (l.unit === "box" ? ps : 1)) / 2).toFixed(2))}>Avg: {fmt((Number(l.purchase_price) + (l.previous_purchase_price ?? 0) * (l.unit === "box" ? ps : 1)) / 2)}</button>
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
            <div className="space-y-1 border-t pt-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{fmt(total)}</span>
              </div>
              {vatAmount > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">VAT{vatPct > 0 ? ` (${vatPct}%)` : ""}</span>
                    <span>{fmt(vatAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{vatPct > 0 ? "প্রতিটি দামে +% যোগ হচ্ছে" : "VAT per pcs (added to purchase price)"}</span>
                    <span>{vatPct > 0 ? `+${vatPct}%` : fmt(vatPerPcs)}</span>
                  </div>
                </>
              )}
              <div className="flex items-center justify-between font-semibold">
                <span>Total</span>
                <span>{fmt(grandTotal)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5 grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className={labelCls}>VAT ({vatMode === "percent" ? "%" : "amount"})</span>
          <div className="flex gap-2">
            <input type="number" step="any" placeholder={vatPct > 0 ? "—" : "0.00"} disabled={vatPct > 0} className={inputCls + (vatPct > 0 ? " opacity-50" : "")} value={vatPct > 0 ? "" : vatValue} onChange={(e) => setVatValue(e.target.value)} />
            <select className="h-9 rounded-lg border border-border bg-input px-2 text-sm" disabled={vatPct > 0} value={vatMode} onChange={(e) => setVatMode(e.target.value as any)}>
              <option value="amount">৳</option>
              <option value="percent">%</option>
            </select>
          </div>
          <span className="mt-1 block text-[11px] text-muted-foreground">
            {vatPct > 0
              ? `উপরে VAT ${vatPct}% দেওয়া আছে — এই বক্স বন্ধ`
              : vatAmount > 0 && totalPcs > 0
                ? `${fmt(vatAmount)} → ${fmt(vatPerPcs)} / pcs (${totalPcs} pcs)`
                : "VAT মোট পিসের সাথে সমান ভাগে purchase price-এ যোগ হবে"}
          </span>
        </label>
        <label className="block">
          <span className={labelCls}>Amount paid</span>
          <input type="number" step="any" placeholder="0.00" className={inputCls} value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelCls}>Payment method</span>
          <select className={inputCls} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="cheque">Cheque</option>
            <option value="other">Other</option>
          </select>
        </label>
        <div className="text-sm self-end">
          <div className="text-muted-foreground text-xs">Due</div>
          <div className="font-semibold">{fmt(Math.max(0, grandTotal - Number(amountPaid || 0)))}</div>
        </div>
      </div>


      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate({ to: "/purchases" })}>Cancel</Button>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Plus className="h-4 w-4 mr-1" /> {save.isPending ? "Saving…" : "Save Purchase"}
        </Button>
      </div>
    </div>
  );
}
