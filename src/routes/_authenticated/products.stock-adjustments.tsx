import { FloatingSearch } from "@/components/floating-search";
import { formatDate, formatDateTime } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { toast } from "sonner";
import { Eye, Pencil, Plus, Printer, Trash2, X } from "lucide-react";
import { PrintSizeButton } from "@/components/print-size-select";
import { fetchAll } from "@/lib/fetch-all";

export const Route = createFileRoute("/_authenticated/products/stock-adjustments")({
  component: StockAdjustments,
});

type Line = { variation_id: string; product_id: string; quantity: number | string; unit_price: number | string };
type ProductPick = {
  productId: string;
  variationId: string;
  label: string;
  code: string;
  purchasePrice: number;
  searchText: string;
};

function StockAdjustments() {
  const { data: business } = useCurrentBusiness();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<any | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["stock-adjustments", business?.id],
    queryFn: async () => {
      if (!business) return [];
      const { data, error } = await supabase
        .from("stock_adjustments")
        .select("*, location:business_locations(name)")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!business,
  });

  const del = useMutation({
    mutationFn: async (row: any) => {
      const { error } = await supabase.rpc("delete_stock_adjustment", { _id: row.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Adjustment deleted");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Stock Adjustments</h2>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
          <Plus className="h-3.5 w-3.5" /> New Adjustment
        </button>
      </div>

      {(showForm || editRow) && (
        <AdjustmentForm
          key={editRow?.id ?? "new"}
          editRow={editRow}
          onClose={() => { setShowForm(false); setEditRow(null); }}
          onSaved={() => qc.invalidateQueries({ queryKey: ["stock-adjustments"] })}
        />
      )}

      <div className="rounded-2xl border border-border/60 bg-card overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Ref No</th>
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-left px-4 py-3 font-medium">Location</th>
              <th className="text-left px-4 py-3 font-medium">Type</th>
              <th className="text-right px-4 py-3 font-medium">Total Amount</th>
              <th className="text-left px-4 py-3 font-medium">Reason</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No adjustments yet.</td></tr>
            ) : rows.map((r: any) => (
              <tr key={r.id} className="hover:bg-muted/20">
                <td className="px-4 py-3 font-mono text-xs">{r.ref_no}</td>
                <td className="px-4 py-3">{formatDate(r.adjustment_date)}</td>
                <td className="px-4 py-3">{r.location?.name ?? "—"}</td>
                <td className="px-4 py-3 capitalize">{r.adjustment_type === "normal" ? "Add" : r.adjustment_type === "abnormal" ? "Minus" : r.adjustment_type}</td>
                <td className="px-4 py-3 text-right">{Number(r.total_amount).toFixed(2)}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.reason ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setViewId(r.id)} title="View" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-muted/50">
                      <Eye className="h-4 w-4" />
                    </button>
                    <button onClick={() => { setShowForm(false); setEditRow(r); }} title="Edit" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-muted/50">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <PrintSizeButton label="" onPrint={(size) => printAdjustment(r.id, size)} />
                    <button
                      onClick={() => { if (confirm(`Delete adjustment ${r.ref_no}? Stock will be reversed.`)) del.mutate(r); }}
                      title="Delete"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewId && <ViewAdjustmentDialog id={viewId} onClose={() => setViewId(null)} />}
    </div>
  );
}

async function fetchAdjustmentDetail(id: string) {
  const { data: header, error } = await supabase
    .from("stock_adjustments")
    .select("*, location:business_locations(name), business:businesses(name)")
    .eq("id", id)
    .single();
  if (error) throw error;
  const { data: lines } = await supabase
    .from("stock_adjustment_lines")
    .select("product_id, variation_id, quantity, unit_price, product:products(name, sku), variation:variations(name, sub_sku)")
    .eq("stock_adjustment_id", id);
  return { header, lines: lines ?? [] };
}

function ViewAdjustmentDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ["stock-adjustment-detail", id],
    queryFn: () => fetchAdjustmentDetail(id),
  });
  if (!data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="rounded-2xl bg-card p-6 text-sm">Loading…</div>
      </div>
    );
  }
  const { header, lines } = data;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border border-border/60 bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
          <h3 className="text-sm font-semibold">Adjustment {header.ref_no}</h3>
          <div className="flex items-center gap-2">
            <PrintSizeButton onPrint={(size) => printAdjustment(id, size)} />
            <button onClick={onClose} className="inline-flex h-7 w-7 items-center justify-center rounded-lg hover:bg-muted/50"><X className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Date: </span>{formatDateTime(header.adjustment_date)}</div>
            <div><span className="text-muted-foreground">Location: </span>{header.location?.name ?? "—"}</div>
            <div><span className="text-muted-foreground">Type: </span><span className="capitalize">{header.adjustment_type === "normal" ? "Add" : header.adjustment_type === "abnormal" ? "Minus" : header.adjustment_type}</span></div>
            <div><span className="text-muted-foreground">Total: </span>{Number(header.total_amount).toFixed(2)}</div>
            {header.reason && <div className="col-span-2"><span className="text-muted-foreground">Reason: </span>{header.reason}</div>}
          </div>
          <div className="rounded-xl border border-border/60 overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Product</th>
                  <th className="text-right px-3 py-2 font-medium">Qty</th>
                  <th className="text-right px-3 py-2 font-medium">Unit Price</th>
                  <th className="text-right px-3 py-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {lines.map((l: any, i: number) => {
                  const name = `${l.product?.name ?? ""}${l.variation?.name && l.variation.name !== "DUMMY" ? ` — ${l.variation.name}` : ""}`;
                  const code = l.variation?.sub_sku || l.product?.sku || "";
                  return (
                    <tr key={i}>
                      <td className="px-3 py-2">
                        <div>{name}</div>
                        {code && <div className="text-xs text-muted-foreground font-mono">{code}</div>}
                      </td>
                      <td className="px-3 py-2 text-right">{Number(l.quantity).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{Number(l.unit_price).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{(Number(l.quantity) * Number(l.unit_price)).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

async function printAdjustment(id: string, size: "A4" | "80mm" | "58mm" = "A4") {
  try {
    const { header, lines } = await fetchAdjustmentDetail(id);
    const typeLabel = header.adjustment_type === "normal" ? "Add (+)" : header.adjustment_type === "abnormal" ? "Minus (-)" : header.adjustment_type;
    const rowsHtml = lines.map((l: any) => {
      const name = `${l.product?.name ?? ""}${l.variation?.name && l.variation.name !== "DUMMY" ? ` — ${l.variation.name}` : ""}`;
      const code = l.variation?.sub_sku || l.product?.sku || "";
      return `<tr>
        <td>${escapeHtml(name)}${code ? `<div style="font-size:11px;color:#555">${escapeHtml(code)}</div>` : ""}</td>
        <td style="text-align:right">${Number(l.quantity).toFixed(2)}</td>
        <td style="text-align:right">${Number(l.unit_price).toFixed(2)}</td>
        <td style="text-align:right">${(Number(l.quantity) * Number(l.unit_price)).toFixed(2)}</td>
      </tr>`;
    }).join("");

    const bodyHtml = `
      <h1>${escapeHtml(header.business?.name ?? "Stock Adjustment")}</h1>
      <h2 style="font-size:16px;margin:16px 0 0">Stock Adjustment</h2>
      <div class="meta">
        <div><b>Ref:</b> ${escapeHtml(header.ref_no)}</div>
        <div><b>Date:</b> ${escapeHtml(formatDateTime(header.adjustment_date))}</div>
        <div><b>Location:</b> ${escapeHtml(header.location?.name ?? "—")}</div>
        <div><b>Type:</b> ${escapeHtml(typeLabel)}</div>
        ${header.reason ? `<div style="grid-column:1/-1"><b>Reason:</b> ${escapeHtml(header.reason)}</div>` : ""}
      </div>
      <table>
        <thead><tr><th>Product</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div class="total">Total: ${Number(header.total_amount).toFixed(2)}</div>`;

    const printId = "adj-print-page";
    const styleId = "adj-print-style";
    document.getElementById(printId)?.remove();
    document.getElementById(styleId)?.remove();

    const style = document.createElement("style");
    style.id = styleId;
    const pageSize = size === "A4" ? "A4" : size === "80mm" ? "80mm auto" : "58mm auto";
    const pageMargin = size === "A4" ? "12mm" : "3mm 2mm";
    const width = size === "A4" ? "210mm" : size === "80mm" ? "80mm" : "58mm";
    const fs = size === "A4" ? "13px" : size === "80mm" ? "11px" : "10px";
    style.textContent = `
      #${printId} { font-family: system-ui, -apple-system, Arial, sans-serif; color:#000; background:#fff; padding:${size === "A4" ? "24px" : "6px"}; width:${width}; max-width:100%; box-sizing:border-box; font-size:${fs}; }
      #${printId} * { box-sizing: border-box; }
      #${printId} h1 { font-size:${size === "A4" ? "20px" : "14px"}; margin:0 0 4px; }
      #${printId} table { width:100%; border-collapse: collapse; margin-top:12px; font-size:${fs}; }
      #${printId} th, #${printId} td { border-bottom:1px solid #ddd; padding:${size === "A4" ? "6px 8px" : "3px 4px"}; text-align:left; color:#000; background:#fff; }
      #${printId} th { background:#f4f4f4 !important; }
      #${printId} .meta { margin-top:8px; display:grid; grid-template-columns: ${size === "A4" ? "1fr 1fr" : "1fr"}; gap:4px; font-size:${fs}; }
      #${printId} .total { margin-top:12px; text-align:right; font-weight:700; font-size:14px; }
      @page { size: ${pageSize}; margin: ${pageMargin}; }
      @media print {
        html, body { background:#fff !important; color:#000 !important; margin:0 !important; padding:0 !important; }
        body > *:not(#${printId}) { display:none !important; visibility:hidden !important; }
        #${printId} { position:static !important; padding:0 !important; }
      }
    `;
    const printPage = document.createElement("div");
    printPage.id = printId;
    printPage.innerHTML = bodyHtml;
    printPage.style.cssText = "position:fixed;left:0;top:0;z-index:-1;opacity:0;pointer-events:none;";
    document.head.appendChild(style);
    document.body.appendChild(printPage);

    const cleanup = () => {
      printPage.remove();
      style.remove();
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    const { showPrintPreview } = await import("@/lib/print-preview");
    showPrintPreview({ printPage, cleanup, filename: `adjustment-${header.ref_no}` });

  } catch (e: any) {
    toast.error(e.message ?? "Print failed");
  }
}

function escapeHtml(s: string) {
  return String(s).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]!));
}


function AdjustmentForm({ editRow, onClose, onSaved }: { editRow?: any | null; onClose: () => void; onSaved: () => void }) {
  const { data: business } = useCurrentBusiness();
  const qc = useQueryClient();
  const [locationId, setLocationId] = useState(editRow?.location_id ?? "");
  const [type, setType] = useState<"normal" | "abnormal">((editRow?.adjustment_type as any) ?? "normal");
  const [reason, setReason] = useState(editRow?.reason ?? "");
  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState("");
  const [loadedEdit, setLoadedEdit] = useState(!editRow);

  useQuery({
    queryKey: ["stock-adjustment-edit", editRow?.id],
    enabled: !!editRow?.id,
    queryFn: async () => {
      const { lines: existing } = await fetchAdjustmentDetail(editRow.id);
      setLines(
        (existing as any[]).map((l) => ({
          variation_id: l.variation_id ?? "",
          product_id: l.product_id ?? "",
          quantity: String(Number(l.quantity)),
          unit_price: String(Number(l.unit_price)),
        })),
      );
      setLoadedEdit(true);
      return existing;
    },
  });


  const { data: locations = [] } = useQuery({
    queryKey: ["locations", business?.id],
    queryFn: async () => {
      const { data } = await supabase.from("business_locations").select("id, name").eq("business_id", business!.id);
      return data ?? [];
    },
    enabled: !!business,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-with-variations", business?.id],
    queryFn: async () => {
      return fetchAll<any>(() =>
        supabase
          .from("products")
          .select("id, name, sku, barcode, variations(id, name, sub_sku, barcode, default_purchase_price)")
          .eq("business_id", business!.id)
          .order("name", { ascending: true }),
      );
    },
    enabled: !!business,
  });

  function addLine() {
    setLines((l) => [...l, { variation_id: "", product_id: "", quantity: "", unit_price: "" }]);
  }
  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((l) => l.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }
  function removeLine(idx: number) {
    setLines((l) => l.filter((_, i) => i !== idx));
  }
  function pickVariation(idx: number, variationId: string) {
    for (const p of products) {
      const v = (p as any).variations?.find((v: any) => v.id === variationId);
      if (v) {
        updateLine(idx, { variation_id: variationId, product_id: p.id, unit_price: v.default_purchase_price ? String(v.default_purchase_price) : "" });
        return;
      }
    }
  }

  const productPicks: ProductPick[] = products.flatMap((p: any) =>
    (p.variations ?? []).map((v: any) => {
      const label = `${p.name}${v.name && v.name !== "DUMMY" ? ` — ${v.name}` : ""}`;
      const code = v.sub_sku || p.sku || v.barcode || p.barcode || "No SKU";
      return {
        productId: p.id,
        variationId: v.id,
        label,
        code,
        purchasePrice: Number(v.default_purchase_price ?? 0),
        searchText: `${label} ${code} ${p.sku ?? ""} ${p.barcode ?? ""} ${v.barcode ?? ""}`.toLowerCase(),
      };
    }),
  );

  const searchQuery = search.trim().toLowerCase();
  const filteredProductPicks = productPicks
    .filter((item) => !searchQuery || item.searchText.includes(searchQuery))
    .slice(0, 80);

  function getSelectProductPicks(selectedVariationId: string) {
    if (!selectedVariationId || filteredProductPicks.some((item) => item.variationId === selectedVariationId)) {
      return filteredProductPicks;
    }
    const selected = productPicks.find((item) => item.variationId === selectedVariationId);
    return selected ? [selected, ...filteredProductPicks] : filteredProductPicks;
  }

  function addProductPick(item: ProductPick) {
    setLines((current) => {
      const existingIndex = current.findIndex((line) => line.variation_id === item.variationId);
      if (existingIndex >= 0) {
        return current.map((line, index) =>
          index === existingIndex ? { ...line, quantity: Number(line.quantity || 0) + 1 } : line,
        );
      }
      return [
        ...current,
        {
          variation_id: item.variationId,
          product_id: item.productId,
          quantity: "",
          unit_price: item.purchasePrice ? String(item.purchasePrice) : "",
        },
      ];
    });
    setSearch("");
  }

  const total = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0);

  const save = useMutation({
    mutationFn: async () => {
      if (!business) throw new Error("No business");
      if (!locationId) throw new Error("Pick a location");
      if (lines.length === 0) throw new Error("Add at least one line");

      const invalidLine = lines.find((line) => !line.product_id || !line.variation_id || !(Number(line.quantity) > 0));
      if (invalidLine) throw new Error("Select a product and enter a quantity greater than zero");

      if (editRow?.id) {
        const { error: delErr } = await supabase.rpc("delete_stock_adjustment", { _id: editRow.id });
        if (delErr) throw delErr;
      }

      const { error } = await supabase.rpc("create_stock_adjustment", {
        _payload: {
          business_id: business.id,
          location_id: locationId,
          ref_no: editRow?.ref_no ?? `SA${Date.now().toString().slice(-8)}`,
          adjustment_type: type,
          reason: reason || null,
          lines: lines.map((l) => ({ ...l, quantity: Number(l.quantity) || 0, unit_price: Number(l.unit_price) || 0 })),
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editRow?.id ? "Adjustment updated and stock re-applied" : "Adjustment saved and stock updated");
      qc.invalidateQueries();
      onSaved();
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const inputCls = "w-full h-9 rounded-lg border border-border bg-input px-3 text-sm";
  const labelCls = "block text-xs font-medium text-muted-foreground mb-1.5";

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
      <h3 className="text-sm font-semibold">{editRow?.id ? `Edit Adjustment ${editRow.ref_no}` : "New Stock Adjustment"}</h3>
      {!loadedEdit && <p className="text-xs text-muted-foreground">Loading lines…</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className={labelCls}>Location *</span>
          <select className={inputCls} value={locationId} onChange={(e) => setLocationId(e.target.value)} required>
            <option value="">— Select —</option>
            {locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Type</span>
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="normal">Add</option>
            <option value="abnormal">Minus</option>
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Reason</span>
          <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">Lines</h4>
          <FloatingSearch spacer={40} className="max-w-[calc(100vw-24px)]">
            <input
              type="search"
              placeholder="Search product then click Add…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-input px-3 text-sm"
            />
          </FloatingSearch>
          <button type="button" onClick={addLine} className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs">
            <Plus className="h-3 w-3" /> Add line
          </button>
        </div>
        {searchQuery && (
          <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-background">
            {filteredProductPicks.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">No products found.</div>
            ) : (
              filteredProductPicks.map((item) => (
                <button
                  key={item.variationId}
                  type="button"
                  onClick={() => addProductPick(item)}
                  className="flex w-full items-center justify-between gap-3 border-b border-border/60 px-3 py-2 text-left last:border-b-0 hover:bg-muted/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-destructive">{item.label}</span>
                    <span className="block text-xs text-muted-foreground">SKU/Barcode: {item.code}</span>
                  </span>
                  <span className="shrink-0 rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">Add</span>
                </button>
              ))
            )}
          </div>
        )}
        {lines.length === 0 && <p className="text-xs text-muted-foreground">No lines yet.</p>}
        {lines.map((l, idx) => (
          <div key={idx} className="grid gap-2 sm:grid-cols-12 items-end">
            <label className="block sm:col-span-6">
              <span className={labelCls}>Product</span>
              <select className={inputCls} value={l.variation_id} onChange={(e) => pickVariation(idx, e.target.value)} required>
                <option value="">— Select —</option>
                {getSelectProductPicks(l.variation_id).map((item) => (
                  <option key={item.variationId} value={item.variationId}>
                    {item.label} ({item.code})
                  </option>
                ))}

              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className={labelCls}>Qty</span>
              <input className={inputCls} type="number" step="any" value={l.quantity} placeholder="0" onChange={(e) => updateLine(idx, { quantity: e.target.value })} />
            </label>
            <label className="block sm:col-span-3">
              <span className={labelCls}>Unit price</span>
              <input className={inputCls} type="number" step="any" value={l.unit_price} placeholder="0.00" onChange={(e) => updateLine(idx, { unit_price: e.target.value })} />
            </label>
            <button type="button" onClick={() => removeLine(idx)} className="sm:col-span-1 inline-flex h-9 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-border/60 pt-3">
        <div className="text-sm">Total: <span className="font-semibold">{total.toFixed(2)}</span></div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm">Cancel</button>
          <button type="submit" disabled={save.isPending || !loadedEdit} className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
            {save.isPending ? "Saving…" : editRow?.id ? "Update" : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
}
