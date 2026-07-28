import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Trash2, ScanLine, Upload, Loader2, X } from "lucide-react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { vaultUpload } from "@/lib/vault.functions";

type Variation = {
  id?: string;
  name: string;
  sub_sku: string;
  barcode: string;
  default_purchase_price: number;
  mrp: number;
  pack_size: number;
};

type Props = { productId?: string };

const productTypes = [
  { value: "single", label: "Single" },
  { value: "variable", label: "Variable" },
  { value: "combo", label: "Combo" },
];

export function ProductForm({ productId }: Props) {
  const { data: business } = useCurrentBusiness();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: existing } = useQuery({
    queryKey: ["product", productId],
    queryFn: async () => {
      if (!productId) return null;
      const { data, error } = await supabase
        .from("products")
        .select("*, variations(*)")
        .eq("id", productId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!productId,
  });

  const { data: refs } = useQuery({
    queryKey: ["product-form-refs", business?.id],
    queryFn: async () => {
      if (!business) return null;
      const [cats, brands, units, taxes] = await Promise.all([
        supabase.from("categories").select("id, name").eq("business_id", business.id),
        supabase.from("brands").select("id, name").eq("business_id", business.id),
        supabase.from("units").select("id, actual_name, short_name").eq("business_id", business.id),
        supabase.from("tax_rates").select("id, name, amount").eq("business_id", business.id),
      ]);
      return {
        categories: cats.data ?? [],
        brands: brands.data ?? [],
        units: units.data ?? [],
        taxes: taxes.data ?? [],
      };
    },
    enabled: !!business,
  });

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [type, setType] = useState<"single" | "variable" | "combo">("single");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [taxId, setTaxId] = useState("");
  const [alertQty, setAlertQty] = useState<string>("");
  const [enableStock, setEnableStock] = useState(true);
  const [notForSelling, setNotForSelling] = useState(false);
  const [description, setDescription] = useState("");
  const [purchasePrice, setPurchasePrice] = useState<string>("");
  const [mrp, setMrp] = useState<string>("");
  const [packSize, setPackSize] = useState<string>("");
  const [barcode, setBarcode] = useState<string>("");
  const [scanTarget, setScanTarget] = useState<null | { kind: "main" } | { kind: "variation"; idx: number }>(null);
  const [variations, setVariations] = useState<Variation[]>([
    { name: "DUMMY", sub_sku: "", barcode: "", default_purchase_price: 0, mrp: 0, pack_size: 1 },
  ]);
  const [image, setImage] = useState<string>("");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const uploadFn = useServerFn(vaultUpload);
  const uploadImg = useMutation({
    mutationFn: async (file: File) => {
      if (!business) throw new Error("No business");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("business_id", business.id);
      fd.append("entity_type", "product-image");
      if (productId) fd.append("entity_id", productId);
      const row: any = await uploadFn({ data: fd });
      const token = row?.share_token;
      if (!token) throw new Error("Vault did not return a share token");
      return `https://api.bongbangla.top/vault-api/share.php?t=${token}`;
    },
    onSuccess: (url) => { setImage(url); toast.success("Image uploaded"); },
    onError: (e: any) => toast.error(e.message ?? "Upload failed"),
  });

  useEffect(() => {
    if (!existing) return;
    setName(existing.name ?? "");
    setSku(existing.sku ?? "");
    setType((existing.type as any) ?? "single");
    setCategoryId(existing.category_id ?? "");
    setBrandId(existing.brand_id ?? "");
    setUnitId(existing.unit_id ?? "");
    setTaxId(existing.tax_id ?? "");
    setAlertQty(existing.alert_quantity != null ? String(existing.alert_quantity) : "");
    setEnableStock(!!existing.enable_stock);
    setNotForSelling(!!existing.not_for_selling);
    setDescription(existing.description ?? "");
    setPurchasePrice(existing.default_purchase_price != null ? String(existing.default_purchase_price) : "");
    const mrpVal = existing.mrp ?? existing.default_sell_price;
    setMrp(mrpVal != null ? String(mrpVal) : "");
    setPackSize(existing.variations?.[0]?.pack_size != null ? String(existing.variations[0].pack_size) : "");
    setBarcode((existing as any).barcode ?? "");
    setImage((existing as any).image ?? "");
    if (existing.variations?.length) {
      setVariations(existing.variations.map((v: any) => ({
        id: v.id,
        name: v.name ?? "DUMMY",
        sub_sku: v.sub_sku ?? "",
        barcode: v.barcode ?? "",
        default_purchase_price: Number(v.default_purchase_price ?? 0),
        mrp: Number(v.mrp ?? v.default_sell_price ?? 0),
        pack_size: Number(v.pack_size ?? 1) || 1,
      })));
    }
  }, [existing]);

  // Auto-generate SKU on create
  useEffect(() => {
    if (productId || sku) return;
    if (!business) return;
    const prefix = business.sku_prefix ?? "";
    setSku(`${prefix}${Date.now().toString().slice(-6)}`);
  }, [business, productId, sku]);

  const showVariations = type === "variable";

  function addVariation() {
    setVariations((v) => [...v, { name: "", sub_sku: "", barcode: "", default_purchase_price: 0, mrp: 0, pack_size: 1 }]);
  }
  function removeVariation(idx: number) {
    setVariations((v) => v.filter((_, i) => i !== idx));
  }
  function updateVariation(idx: number, patch: Partial<Variation>) {
    setVariations((v) => v.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!business) throw new Error("No business");
      const payload = {
        business_id: business.id,
        name,
        sku,
        type,
        category_id: categoryId || null,
        brand_id: brandId || null,
        unit_id: unitId || null,
        tax_id: taxId || null,
        alert_quantity: alertQty ? Number(alertQty) : null,
        enable_stock: enableStock,
        not_for_selling: notForSelling,
        description: description || null,
        default_purchase_price: Number(purchasePrice) || 0,
        default_sell_price: Number(mrp) || 0,
        mrp: Number(mrp) || 0,
        barcode: barcode || null,
        image: image || null,
      };

      let pid = productId;
      if (pid) {
        const { error } = await supabase.from("products").update(payload).eq("id", pid);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("products").insert(payload).select("id").single();
        if (error) throw error;
        pid = data.id;
      }

      // Variations
      const rows = showVariations
        ? variations
        : [{ ...(variations[0] ?? { name: "DUMMY", sub_sku: "", barcode: "", pack_size: 1 }), name: "DUMMY", sub_sku: sku, barcode: barcode || "", default_purchase_price: Number(purchasePrice) || 0, mrp: Number(mrp) || 0, pack_size: Math.max(1, Number(packSize) || 1) }];
      // delete removed
      if (productId) {
        const keepIds = rows.filter((v) => v.id).map((v) => v.id!);
        const { data: oldVars } = await supabase.from("variations").select("id").eq("product_id", pid!);
        const toDelete = (oldVars ?? []).filter((v) => !keepIds.includes(v.id)).map((v) => v.id);
        if (toDelete.length) {
          await supabase.from("variations").delete().in("id", toDelete);
        }
      }
      for (const v of rows) {
        const vPayload = {
          product_id: pid!,
          name: v.name || "DUMMY",
          sub_sku: v.sub_sku || null,
          barcode: v.barcode || null,
          default_purchase_price: v.default_purchase_price,
          dpp_inc_tax: v.default_purchase_price,
          default_sell_price: v.mrp,
          sell_price_inc_tax: v.mrp,
          mrp: v.mrp,
          pack_size: Math.max(1, Math.floor(Number(v.pack_size || 1))),
          profit_percent: v.default_purchase_price > 0
            ? ((v.mrp - v.default_purchase_price) / v.default_purchase_price) * 100
            : 0,
        };
        if (v.id) {
          await supabase.from("variations").update(vPayload).eq("id", v.id);
        } else {
          await supabase.from("variations").insert(vPayload);
        }
      }
    },
    onSuccess: () => {
      toast.success(productId ? "Product updated" : "Product created");
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product", productId] });
      navigate({ to: "/products" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Name is required");
    if (!sku.trim()) return toast.error("SKU is required");
    save.mutate();
  }

  const inputCls = "w-full h-9 rounded-lg border border-border bg-input px-3 text-sm";
  const labelCls = "block text-xs font-medium text-muted-foreground mb-1.5";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
        <h3 className="text-sm font-semibold">Basic Info</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelCls}>Product name <span className="text-destructive">*</span></span>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="block">
            <span className={labelCls}>SKU <span className="text-destructive">*</span></span>
            <input className={inputCls} value={sku} onChange={(e) => setSku(e.target.value)} required />
          </label>
          <label className="block">
            <span className={labelCls}>Barcode (optional)</span>
            <div className="flex gap-2">
              <input className={inputCls} value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Scan or type barcode" />
              <button type="button" onClick={() => setScanTarget({ kind: "main" })} className="inline-flex items-center gap-1 px-3 rounded-lg border border-border/60 hover:bg-accent text-sm" title="Scan barcode">
                <ScanLine className="h-4 w-4" /> Scan
              </button>
            </div>
          </label>
          <label className="block">
            <span className={labelCls}>Product type</span>
            <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as any)}>
              {productTypes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Unit</span>
            <select className={inputCls} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              <option value="">— Select —</option>
              {refs?.units.map((u) => <option key={u.id} value={u.id}>{u.actual_name} ({u.short_name})</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Category</span>
            <select className={inputCls} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">— Select —</option>
              {refs?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Brand</span>
            <select className={inputCls} value={brandId} onChange={(e) => setBrandId(e.target.value)}>
              <option value="">— Select —</option>
              {refs?.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Applicable tax</span>
            <select className={inputCls} value={taxId} onChange={(e) => setTaxId(e.target.value)}>
              <option value="">— None —</option>
              {refs?.taxes.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.amount}%)</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Alert quantity</span>
            <input className={inputCls} type="number" step="any" value={alertQty} onChange={(e) => setAlertQty(e.target.value)} />
          </label>
          <label className="block">
            <span className={labelCls}>Purchase price</span>
            <input className={inputCls} type="number" step="any" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
          </label>
          <label className="block">
            <span className={labelCls}>MRP</span>
            <input className={inputCls} type="number" step="any" value={mrp} onChange={(e) => setMrp(e.target.value)} />
          </label>
          <label className="block">
            <span className={labelCls}>Pcs per box</span>
            <input
              className={inputCls}
              type="number"
              min="1"
              step="1"
              value={packSize}
              onChange={(e) => setPackSize(e.target.value)}
              placeholder="1"
            />
          </label>

        </div>
        <div className="flex flex-wrap gap-6 pt-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enableStock} onChange={(e) => setEnableStock(e.target.checked)} className="h-4 w-4" />
            Manage stock
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={notForSelling} onChange={(e) => setNotForSelling(e.target.checked)} className="h-4 w-4" />
            Not for selling
          </label>
        </div>
        <label className="block">
          <span className={labelCls}>Description</span>
          <textarea className="w-full min-h-[80px] rounded-lg border border-border bg-input px-3 py-2 text-sm" value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div>
          <span className={labelCls}>Product image</span>
          <div className="flex items-center gap-3">
            {image ? (
              <div className="relative">
                <img src={image} alt="Product" className="h-20 w-20 rounded-lg border object-cover" />
                <button type="button" onClick={() => setImage("")} className="absolute -top-2 -right-2 rounded-full bg-destructive text-destructive-foreground p-0.5" title="Remove">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="h-20 w-20 rounded-lg border border-dashed border-border/60 grid place-items-center text-xs text-muted-foreground">No image</div>
            )}
            <div>
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploadImg.isPending || !business}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                {uploadImg.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {image ? "Replace image" : "Upload image"}
              </button>
              <p className="text-[11px] text-muted-foreground mt-1">Stored securely in Vault.</p>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadImg.mutate(f);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {showVariations && (
      <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{showVariations ? "Variations" : "Pricing"}</h3>
          {showVariations && (
            <button type="button" onClick={addVariation} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add variation
            </button>
          )}
        </div>

        <div className="space-y-3">
          {(showVariations ? variations : variations.slice(0, 1)).map((v, idx) => (
            <div key={idx} className="grid gap-3 sm:grid-cols-12 items-end rounded-xl border border-border/60 p-3">
              {showVariations && (
                <label className="block sm:col-span-3">
                  <span className={labelCls}>Variation name</span>
                  <input className={inputCls} value={v.name} onChange={(e) => updateVariation(idx, { name: e.target.value })} placeholder="e.g. Red - Large" />
                </label>
              )}
              <label className={`block ${showVariations ? "sm:col-span-2" : "sm:col-span-3"}`}>
                <span className={labelCls}>Sub-SKU</span>
                <input className={inputCls} value={v.sub_sku} onChange={(e) => updateVariation(idx, { sub_sku: e.target.value })} />
              </label>
              {showVariations && (
                <label className="block sm:col-span-2">
                  <span className={labelCls}>Barcode</span>
                  <div className="flex gap-1">
                    <input className={inputCls} value={v.barcode ?? ""} onChange={(e) => updateVariation(idx, { barcode: e.target.value })} />
                    <button type="button" onClick={() => setScanTarget({ kind: "variation", idx })} className="inline-flex items-center px-2 rounded-lg border border-border/60 hover:bg-accent" title="Scan">
                      <ScanLine className="h-4 w-4" />
                    </button>
                  </div>
                </label>
              )}
              <label className={`block ${showVariations ? "sm:col-span-2" : "sm:col-span-3"}`}>
                <span className={labelCls}>Purchase price</span>
                <input className={inputCls} type="number" step="any" value={v.default_purchase_price} onChange={(e) => updateVariation(idx, { default_purchase_price: Number(e.target.value) })} />
              </label>
              <label className={`block ${showVariations ? "sm:col-span-3" : "sm:col-span-3"}`}>
                <span className={labelCls}>MRP</span>
                <input className={inputCls} type="number" step="any" value={v.mrp} onChange={(e) => updateVariation(idx, { mrp: Number(e.target.value) })} />
              </label>
              <label className="block sm:col-span-2">
                <span className={labelCls}>Pcs / box</span>
                <input className={inputCls} type="number" min="1" step="1" value={v.pack_size} onChange={(e) => updateVariation(idx, { pack_size: Math.max(1, Number(e.target.value) || 1) })} />
              </label>
              {showVariations && variations.length > 1 && (
                <button type="button" onClick={() => removeVariation(idx)} className="sm:col-span-12 inline-flex items-center justify-center h-9 rounded-lg text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      )}

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={() => navigate({ to: "/products" })} className="rounded-lg border border-border bg-background px-4 py-2 text-sm">Cancel</button>
        <button type="submit" disabled={save.isPending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          {save.isPending ? "Saving…" : productId ? "Update Product" : "Create Product"}
        </button>
      </div>

      <BarcodeScanner
        open={scanTarget !== null}
        onClose={() => setScanTarget(null)}
        onDetected={(code) => {
          const c = code.trim();
          if (scanTarget?.kind === "main") setBarcode(c);
          else if (scanTarget?.kind === "variation") updateVariation(scanTarget.idx, { barcode: c });
          setScanTarget(null);
          toast.success(`Barcode captured: ${c}`);
        }}
      />
    </form>
  );
}
