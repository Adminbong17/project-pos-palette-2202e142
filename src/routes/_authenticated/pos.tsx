import { FloatingSearch } from "@/components/floating-search";
import { formatDate, formatDateTime } from "@/lib/utils";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { toast } from "sonner";
import { Search, Plus, Minus, Trash2, ShoppingCart, X, ScanLine, Smartphone, ScanText } from "lucide-react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { PhoneScanDialog } from "@/components/PhoneScanDialog";
import { OcrScanner } from "@/components/OcrScanner";
import { useAutosaveDraft } from "@/hooks/use-autosave-draft";

export const Route = createFileRoute("/_authenticated/pos")({
  head: () => ({ meta: [{ title: "POS — QweekPOS" }] }),
  component: PosScreen,
});

type CartLine = {
  variation_id: string;
  product_id: string;
  name: string;
  sub_sku: string;
  original_price: number;
  unit_price: number;
  quantity: number;
  total_amount: number;
};

type SaleSnapshot = {
  invoice_no: string;
  lines: CartLine[];
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  change: number;
  payment_method: string;
  customer_name: string | null;
  date: string;
};

function PosScreen() {
  const { data: business } = useCurrentBusiness();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [locationId, setLocationId] = useState<string>("");
  const [contactId, setContactId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [scanOpen, setScanOpen] = useState(false);
  const [phoneScanOpen, setPhoneScanOpen] = useState(false);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [lastSale, setLastSale] = useState<SaleSnapshot | null>(null);
  const [printWidth, setPrintWidth] = useState<"58" | "80" | "A4">("80");
  // Auto-save the in-progress cart so a power cut does not lose it.
  const { clearDraft: clearPosDraft } = useAutosaveDraft(
    business?.id ? `pos:${business.id}` : null,
    { cart, discount, paymentMethod, amountPaid, contactId },
    (d) => {
      if (d.cart?.length) setCart(d.cart);
      if (d.discount) setDiscount(d.discount);
      if (d.paymentMethod) setPaymentMethod(d.paymentMethod);
      if (d.amountPaid) setAmountPaid(d.amountPaid);
      if (d.contactId) setContactId(d.contactId);
    },
    { isEmpty: (d) => !d.cart?.length, restoreMessage: "Unsaved cart restored" },
  );

  const cartScrollRef = useRef<HTMLDivElement>(null);
  const lastLineRef = useRef<HTMLDivElement>(null);
  const prevCartLen = useRef(0);

  useEffect(() => {
    if (cart.length > prevCartLen.current) {
      lastLineRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    prevCartLen.current = cart.length;
  }, [cart.length]);


  // Locations — auto-pick first
  const { data: locations = [] } = useQuery({
    queryKey: ["locations", business?.id],
    queryFn: async () => {
      const { data } = await supabase.from("business_locations").select("id, name, landmark, city, state, country, zip_code, mobile, alternate_number, email").eq("business_id", business!.id);
      const list = data ?? [];
      if (list.length && !locationId) setLocationId(list[0].id);
      return list;
    },
    enabled: !!business,
  });
  const currentLocation = locations.find((l: any) => l.id === locationId) as any;
  const locAddress = currentLocation ? [currentLocation.landmark, currentLocation.city, currentLocation.state, currentLocation.zip_code, currentLocation.country].filter(Boolean).join(", ") : "";
  const locMobile = currentLocation ? [currentLocation.mobile, currentLocation.alternate_number].filter(Boolean).join(" / ") : "";

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts-customers", business?.id],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("id, name, mobile").eq("business_id", business!.id).in("type", ["customer", "both"]).eq("is_active", true);
      return data ?? [];
    },
    enabled: !!business,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["pos-products", business?.id, locationId],
    queryFn: async () => {
      const PAGE = 1000;
      const all: any[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("products")
          .select(`
            id, name, sku, image, barcode,
            variations:variations!variations_product_id_fkey(
              id, name, sub_sku, barcode, default_sell_price, mrp,
              variation_location_details(qty_available, location_id)
            )
          `)
          .eq("business_id", business!.id)
          .eq("is_inactive", false)
          .eq("not_for_selling", false)
          .order("id", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) {
          toast.error(`Load products: ${error.message}`);
          return all;
        }
        const batch = data ?? [];
        all.push(...batch);
        if (batch.length < PAGE) break;
      }
      return all;
    },

    enabled: !!business,
  });

  type FlatItem = { variation_id: string; product_id: string; name: string; variant_label: string | null; sub_sku: string; barcode: string; price: number; stock: number; image: string | null };


  const items: FlatItem[] = useMemo(() => {
    const out: FlatItem[] = [];
    for (const p of products as any[]) {
      for (const v of p.variations ?? []) {
        const vld = (v.variation_location_details ?? []).find((d: any) => d.location_id === locationId);
        const hasVariant = v.name && v.name !== "DUMMY";
        out.push({
          variation_id: v.id,
          product_id: p.id,
          name: p.name ?? "Unnamed product",
          variant_label: hasVariant ? v.name : null,
          sub_sku: v.sub_sku || p.sku || "",
          barcode: (v.barcode || p.barcode || "") as string,
          price: Number(v.mrp ?? v.default_sell_price ?? 0),
          stock: vld ? Number(vld.qty_available) : 0,
          image: p.image,
        });
      }
    }
    const q = search.trim().toLowerCase();
    if (!q) return out;
    return out.filter((i) => i.name.toLowerCase().includes(q) || i.sub_sku.toLowerCase().includes(q) || (i.barcode && i.barcode.toLowerCase().includes(q)));
  }, [products, locationId, search]);

  function addToCart(item: FlatItem) {
    setCart((c) => {
      const idx = c.findIndex((l) => l.variation_id === item.variation_id);
      if (idx >= 0) return c;
      return [...c, {
        variation_id: item.variation_id,
        product_id: item.product_id,
        name: item.variant_label ? `${item.name} — ${item.variant_label}` : item.name,
        sub_sku: item.sub_sku,
        original_price: item.price,
        unit_price: 0,
        quantity: 0,
        total_amount: 0,
      }];
    });
  }
  function updateQty(variation_id: string, q: number) {
    setCart((c) => c.map((l) => {
      if (l.variation_id !== variation_id) return l;
      const qty = Math.max(0, q);
      const unit_price = qty > 0 && l.total_amount > 0 ? l.total_amount / qty : l.unit_price;
      return { ...l, quantity: qty, unit_price };
    }));
  }

  function updateTotal(variation_id: string, t: number) {
    setCart((c) => c.map((l) => {
      if (l.variation_id !== variation_id) return l;
      const total_amount = Math.max(0, t);
      const unit_price = l.quantity > 0 ? total_amount / l.quantity : 0;
      return { ...l, total_amount, unit_price };
    }));
  }
  function removeLine(variation_id: string) {
    setCart((c) => c.filter((l) => l.variation_id !== variation_id));
  }

  const subtotal = cart.reduce((s, l) => s + l.quantity * l.original_price, 0);
  const lineDiscount = cart.reduce((s, l) => s + Math.max(0, l.quantity * l.original_price - l.total_amount), 0);
  const totalDiscount = lineDiscount + discount;
  const total = Math.max(0, subtotal - totalDiscount);
  const paidNum = amountPaid ? Number(amountPaid) : total;
  const change = paidNum - total;


  const save = useMutation({
    mutationFn: async (draft: boolean) => {
      if (!business) throw new Error("No business");
      if (!locationId) throw new Error("Select a location");
      if (cart.length === 0) throw new Error("Cart is empty");

      const d = new Date();
      const datePart = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
      const rand = Math.floor(10000 + Math.random() * 90000);
      const invoiceNo = `SKP-${datePart}-${rand}`;
      const paid = draft ? 0 : Math.min(paidNum, total);
      const payment_status = draft ? "due" : paid >= total ? "paid" : paid > 0 ? "partial" : "due";

      const { data: tx, error } = await supabase.from("transactions").insert({
        business_id: business.id,
        location_id: locationId,
        type: "sell",
        status: draft ? "draft" : "final",
        payment_status,
        contact_id: contactId || null,
        invoice_no: invoiceNo,
        total_before_tax: subtotal,
        discount_amount: totalDiscount,
        final_total: total,
        total_paid: paid,
      }).select("id").single();
      if (error) throw error;

      const lines = cart.map((l) => ({
        transaction_id: tx.id,
        product_id: l.product_id,
        variation_id: l.variation_id,
        quantity: l.quantity,
        unit_price: l.unit_price,
        unit_price_inc_tax: l.unit_price,
      }));
      const { error: lerr } = await supabase.from("transaction_sell_lines").insert(lines);
      if (lerr) throw lerr;

      if (!draft && paid > 0) {
        await supabase.from("transaction_payments").insert({
          transaction_id: tx.id,
          business_id: business.id,
          amount: paid,
          method: paymentMethod,
        });
      }

      // Decrement stock
      if (!draft) {
        for (const l of cart) {
          const { data: existing } = await supabase
            .from("variation_location_details")
            .select("id, qty_available")
            .eq("variation_id", l.variation_id)
            .eq("location_id", locationId)
            .maybeSingle();
          if (existing) {
            await supabase.from("variation_location_details").update({
              qty_available: Number(existing.qty_available) - l.quantity,
            }).eq("id", existing.id);
          } else {
            await supabase.from("variation_location_details").insert({
              product_id: l.product_id,
              variation_id: l.variation_id,
              location_id: locationId,
              qty_available: -l.quantity,
            });
          }
        }
      }

      const snapshot: SaleSnapshot | null = draft ? null : {
        invoice_no: invoiceNo,
        lines: cart,
        subtotal,
        discount: totalDiscount,
        total,
        paid,
        change: paid - total,
        payment_method: paymentMethod,
        customer_name: contacts.find((c: any) => c.id === contactId)?.name ?? null,
        date: formatDateTime(new Date()),
      };
      return { id: tx.id, snapshot };
    },
    onSuccess: ({ snapshot }) => {
      toast.success("Sale recorded");
      if (snapshot) setLastSale(snapshot);
      clearPosDraft();
      setCart([]);
      setDiscount(0);
      setAmountPaid("");
      setContactId("");
      queryClient.invalidateQueries({ queryKey: ["pos-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [pickerMatches, setPickerMatches] = useState<FlatItem[]>([]);
  const [pickerCode, setPickerCode] = useState("");

  const handleScannedCode = (code: string) => {
    const c = code.trim().toLowerCase();
    const matches = items.filter((i) => (i.barcode && i.barcode.toLowerCase() === c) || i.sub_sku.toLowerCase() === c);
    if (matches.length === 1) {
      addToCart(matches[0]);
      toast.success(`Added: ${matches[0].name}`);
    } else if (matches.length > 1) {
      setPickerCode(code);
      setPickerMatches(matches);
    } else {
      setSearch(code);
      toast.message(`No product for "${code}"`);
    }
  };

  const handleOcrText = (raw: string) => {
    const clean = raw.replace(/[^a-zA-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
    if (!clean) { toast.error("No readable text"); return; }
    const words = clean.split(" ").filter((w) => w.length >= 3);
    // Score every product; keep top-3 so user picks the correct one
    const scored: { item: any; score: number }[] = [];
    for (const it of items) {
      const nameWords = it.name.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w: string) => w.length >= 3);
      if (!nameWords.length) continue;
      let hits = 0;
      for (const nw of nameWords) if (words.some((w) => w.includes(nw) || nw.includes(w))) hits++;
      const score = hits / nameWords.length;
      if (score > 0) scored.push({ item: it, score });
    }
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 3).map((s) => s.item);
    if (top.length === 0) {
      setSearch(words.slice(0, 3).join(" "));
      toast.message(`No match. Showing results for "${words.slice(0, 3).join(" ")}"`);
      return;
    }
    setPickerCode(words.slice(0, 4).join(" "));
    setPickerMatches(top);
  };


  if (!business) return null;

  return (
    <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-3rem)]">
      {/* PRODUCT GRID */}
      <div className="flex-1 flex flex-col border-r border-border/60 min-h-0">
        <div className="p-4 border-b border-border/60 space-y-3">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-lg font-semibold">Point of Sale</h1>
            <select className="ml-auto h-9 rounded-lg border border-border bg-input px-3 text-sm" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">— Location —</option>
              {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="relative space-y-2 sm:space-y-0 sm:flex sm:flex-wrap sm:gap-2">
          <FloatingSearch spacer={48}>
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Search by name or SKU…"
                className="w-full h-10 rounded-lg border border-border bg-input pl-9 pr-3 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </FloatingSearch>
            <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-2">
              <button
                type="button"
                onClick={() => setScanOpen(true)}
                className="h-10 px-2 rounded-lg border border-border bg-input hover:bg-accent flex items-center justify-center gap-1 text-sm min-w-0"
                title="Scan with this device's camera"
              >
                <ScanLine className="h-4 w-4 shrink-0" /> <span className="truncate">Scan</span>
              </button>
              <button
                type="button"
                onClick={() => setPhoneScanOpen(true)}
                className="h-10 px-2 rounded-lg border border-border bg-input hover:bg-accent flex items-center justify-center gap-1 text-sm min-w-0"
                title="Use your phone as a wireless scanner"
              >
                <Smartphone className="h-4 w-4 shrink-0" /> <span className="truncate">Phone</span>
              </button>
              <button
                type="button"
                onClick={() => setOcrOpen(true)}
                className="h-10 px-2 rounded-lg border border-border bg-input hover:bg-accent flex items-center justify-center gap-1 text-sm min-w-0"
                title="Read product name from packet (OCR)"
              >
                <ScanText className="h-4 w-4 shrink-0" /> <span className="truncate">OCR</span>
              </button>
            </div>
            {search.trim() && (
              <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-80 overflow-auto rounded-lg border border-border bg-popover shadow-lg">
                {items.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No matches</div>
                ) : items.slice(0, 20).map((i) => (
                  <button
                    key={i.variation_id}
                    onClick={() => { addToCart(i); setSearch(""); }}
                    className="w-full text-left px-3 py-3 hover:bg-red-50 flex items-center gap-3 border-b border-border/40 last:border-0"
                  >
                    <div className="h-12 w-12 rounded bg-muted/40 grid place-items-center text-base shrink-0">
                      {i.image ? <img src={i.image} alt="" className="h-full w-full object-cover rounded" /> : "📦"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-lg font-bold text-red-600 truncate">{i.name}{i.variant_label ? ` — ${i.variant_label}` : ""}</div>
                      <div className="text-xs text-muted-foreground font-mono">{i.sub_sku} · Stock: {i.stock}</div>
                    </div>
                    <div className="text-base font-semibold text-primary">{i.price.toFixed(2)}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="lg:flex-1 lg:overflow-auto p-4">
          <div className="text-center text-sm text-muted-foreground py-12">
            Search products by name or SKU above to add them to the cart.
          </div>
        </div>
      </div>

      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetected={(code) => handleScannedCode(code)}
      />

      <PhoneScanDialog
        open={phoneScanOpen}
        onClose={() => setPhoneScanOpen(false)}
        onDetected={(code) => handleScannedCode(code)}
      />

      <OcrScanner
        open={ocrOpen}
        onClose={() => setOcrOpen(false)}
        onText={handleOcrText}
      />

      {pickerMatches.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setPickerMatches([])}>
          <div className="bg-background rounded-lg w-full max-w-md p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">
                {pickerMatches.length} products match "{pickerCode}"
              </h3>
              <button onClick={() => setPickerMatches([])} className="p-1 rounded hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Select the correct product:</p>
            <div className="max-h-[60vh] overflow-auto space-y-1">
              {pickerMatches.map((m) => (
                <button
                  key={m.variation_id}
                  onClick={() => {
                    addToCart(m);
                    toast.success(`Added: ${m.name}`);
                    setPickerMatches([]);
                  }}
                  className="w-full text-left rounded-lg border border-border p-3 hover:bg-accent"
                >
                  <div className="font-medium text-sm">{m.name}{m.variant_label ? ` — ${m.variant_label}` : ""}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    SKU: {m.sub_sku} · Stock: {m.stock} · ৳{m.price.toFixed(2)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CART */}
      <div className="w-full lg:w-[400px] flex flex-col bg-muted/10">
        <div className="p-4 border-b border-border/60 space-y-2">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            <h2 className="font-semibold text-sm">Current Sale ({cart.length})</h2>
          </div>
          <select className="w-full h-9 rounded-lg border border-border bg-input px-3 text-sm" value={contactId} onChange={(e) => setContactId(e.target.value)}>
            <option value="">Walk-in customer</option>
            {contacts.map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.mobile ? ` (${c.mobile})` : ""}</option>)}
          </select>
        </div>

        <div ref={cartScrollRef} className="lg:flex-1 lg:overflow-auto p-2 space-y-1">
          {cart.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-12">Click a product to add it.</div>
          ) : cart.map((l, i) => (
            <div key={l.variation_id} ref={i === cart.length - 1 ? lastLineRef : undefined} className="rounded-lg bg-card border border-border/60 p-2.5">

              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium leading-tight truncate">{l.name}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{l.sub_sku}</div>
                </div>
                <button onClick={() => removeLine(l.variation_id)} className="text-muted-foreground hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center justify-between mt-2 gap-2">
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(l.variation_id, l.quantity - 1)} className="h-6 w-6 grid place-items-center rounded border border-border bg-background">
                    <Minus className="h-3 w-3" />
                  </button>
                  <input
                    type="number"
                    value={l.quantity === 0 ? "" : l.quantity}
                    onChange={(e) => updateQty(l.variation_id, e.target.value === "" ? 0 : Number(e.target.value))}
                    className="w-12 h-6 text-center rounded border border-border bg-input text-xs"
                  />
                  <button onClick={() => updateQty(l.variation_id, l.quantity + 1)} className="h-6 w-6 grid place-items-center rounded border border-border bg-background">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  @ {l.unit_price > 0 ? l.unit_price.toFixed(2) : `MRP ${l.original_price.toFixed(2)}`}
                </div>
              </div>
              <div className="flex items-center justify-between mt-2 gap-2">
                <label className="text-[10px] text-muted-foreground">Total Amount</label>
                <input
                  type="number"
                  step="any"
                  value={l.total_amount === 0 ? "" : l.total_amount}
                  onChange={(e) => updateTotal(l.variation_id, e.target.value === "" ? 0 : Number(e.target.value))}
                  className="w-24 h-7 text-right rounded border border-border bg-input px-2 text-sm font-semibold"
                />
              </div>
              {l.quantity * l.original_price - l.total_amount > 0.0001 && (
                <div className="flex justify-between text-[10px] text-emerald-600 mt-1">
                  <span>Discount</span>
                  <span>-{(l.quantity * l.original_price - l.total_amount).toFixed(2)}</span>
                </div>
              )}
            </div>

          ))}
        </div>

        <div className="p-4 border-t border-border/60 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{subtotal.toFixed(2)}</span></div>
          {lineDiscount > 0.0001 && (
            <div className="flex justify-between text-emerald-600">
              <span>Item Discount (auto)</span><span>-{lineDiscount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Extra Discount</span>
            <input type="number" step="any" value={discount} onChange={(e) => setDiscount(Number(e.target.value) || 0)} className="w-24 h-7 text-right rounded border border-border bg-input px-2 text-xs" />
          </div>
          <div className="flex justify-between text-base font-semibold border-t border-border/60 pt-2">
            <span>Total</span><span>{total.toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <select className="h-9 rounded-lg border border-border bg-input px-2 text-xs" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
              <option value="other">Other</option>
            </select>
            <input
              type="number"
              step="any"
              placeholder={`Paid (${total.toFixed(2)})`}
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              className="h-9 rounded-lg border border-border bg-input px-2 text-xs"
            />
          </div>
          {amountPaid && change !== 0 && (
            <div className={`flex justify-between text-xs ${change >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              <span>{change >= 0 ? "Change" : "Due"}</span><span>{Math.abs(change).toFixed(2)}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button onClick={() => save.mutate(true)} disabled={save.isPending || cart.length === 0}
              className="h-10 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted">
              Save Draft
            </button>
            <button onClick={() => save.mutate(false)} disabled={save.isPending || cart.length === 0}
              className="h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90">
              {save.isPending ? "Saving…" : "Finalize Sale"}
            </button>
          </div>
        </div>
      </div>

      {lastSale && (
        <ReceiptModal
          sale={lastSale}
          width={printWidth}
          businessName={business.name ?? "Receipt"}
          businessAddress={locAddress}
          businessMobile={locMobile}
          businessEmail={currentLocation?.email ?? ""}
          onWidthChange={setPrintWidth}
          onClose={() => setLastSale(null)}
        />
      )}
    </div>
  );
}

function ReceiptModal({
  sale, width, businessName, businessAddress, businessMobile, businessEmail, onWidthChange, onClose,
}: {
  sale: SaleSnapshot;
  width: "58" | "80" | "A4";
  businessName: string;
  businessAddress: string;
  businessMobile: string;
  businessEmail: string;
  onWidthChange: (w: "58" | "80" | "A4") => void;
  onClose: () => void;
}) {
  const mm = width === "58" ? "58mm" : width === "80" ? "80mm" : "210mm";
  const fontSize = width === "58" ? "13px" : width === "80" ? "15px" : "14px";
  const handlePrint = () => printReceiptInWhitePage(sale, width, { businessName, businessAddress, businessMobile, businessEmail });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4">


      <div className="bg-card rounded-2xl border border-border w-full max-w-sm overflow-hidden print:hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-sm">Print Receipt</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <button onClick={() => onWidthChange("58")} className={`flex-1 h-9 rounded-lg border text-sm ${width === "58" ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>58 mm</button>
            <button onClick={() => onWidthChange("80")} className={`flex-1 h-9 rounded-lg border text-sm ${width === "80" ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>80 mm</button>
            <button onClick={() => onWidthChange("A4")} className={`flex-1 h-9 rounded-lg border text-sm ${width === "A4" ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>A4</button>
          </div>
          <div className="rounded-lg border border-border bg-white text-black p-3 max-h-80 overflow-auto" style={{ width: width === "A4" ? "100%" : mm, fontSize, fontFamily: "ui-monospace, monospace", margin: "0 auto" }}>
            <Receipt sale={sale} businessName={businessName} businessAddress={businessAddress} businessMobile={businessMobile} businessEmail={businessEmail} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onClose} className="h-10 rounded-lg border border-border text-sm">Skip</button>
            <button onClick={handlePrint} className="h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">Print</button>
          </div>
        </div>
      </div>

      <div id="receipt-print" className="hidden" style={{ width: mm, fontSize, fontFamily: "ui-monospace, monospace", color: "#000", background: "#fff", padding: "4px" }}>

        <Receipt sale={sale} businessName={businessName} businessAddress={businessAddress} businessMobile={businessMobile} businessEmail={businessEmail} />
      </div>
    </div>
  );
}

import { printReceiptInWhitePage as sharedPrintReceipt, receiptHtml as sharedReceiptHtml, receiptCss, type ReceiptSale as SharedReceiptSale } from "@/lib/receipt-print";

function toSharedSale(sale: SaleSnapshot): SharedReceiptSale {
  return {
    invoice_no: sale.invoice_no,
    lines: sale.lines.map((l) => ({ name: l.name, quantity: l.quantity, unit_price: l.unit_price, total_amount: l.total_amount })),
    subtotal: sale.subtotal,
    discount: sale.discount,
    total: sale.total,
    paid: sale.paid,
    change: sale.change,
    payment_method: sale.payment_method,
    customer_name: sale.customer_name,
    date: sale.date,
  };
}

function printReceiptInWhitePage(sale: SaleSnapshot, width: "58" | "80" | "A4", header: { businessName: string; businessAddress: string; businessMobile: string; businessEmail: string }) {
  sharedPrintReceipt(toSharedSale(sale), width, { businessName: header.businessName, businessAddress: header.businessAddress, businessMobile: header.businessMobile });
}

function Receipt({ sale, businessName, businessAddress, businessMobile }: { sale: SaleSnapshot; businessName: string; businessAddress: string; businessMobile: string; businessEmail: string }) {
  const html = sharedReceiptHtml(toSharedSale(sale), { businessName, businessAddress, businessMobile });
  const css = receiptCss(".receipt-preview-clone", "13px", "100%");
  return (
    <>
      <style>{css}</style>
      <div className="receipt-preview-clone" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}


