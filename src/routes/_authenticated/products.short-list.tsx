import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, PackageOpen } from "lucide-react";
import { fetchAll } from "@/lib/fetch-all";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/products/short-list")({
  component: ShortListPage,
});

type PrintSize = "a4" | "80mm" | "58mm";

type ShortRow = {
  id: string;
  name: string;
  sku: string | null;
  stock: number;
  alert: number;
  neededPcs: number; // editable
};

function ShortListPage() {
  const { data: business } = useCurrentBusiness();
  const [size, setSize] = useState<PrintSize>("a4");
  const [edits, setEdits] = useState<Record<string, number>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["short-list", business?.id],
    enabled: !!business,
    queryFn: async () => {
      return fetchAll<any>(() =>
        supabase
          .from("products")
          .select(
            "id, name, sku, alert_quantity, unit:units(short_name), variations(name, pack_size, variation_location_details(qty_available))"
          )
          .eq("business_id", business!.id)
          .eq("enable_stock", true)
          .eq("is_inactive", false)
          .order("name", { ascending: true })
      );
    },
  });

  const rows: ShortRow[] = useMemo(() => {
    const out: ShortRow[] = [];
    for (const p of data ?? []) {
      const variations = p.variations ?? [];
      const stock = variations.reduce(
        (s: number, v: any) =>
          s + (v.variation_location_details ?? []).reduce((ss: number, d: any) => ss + Number(d.qty_available ?? 0), 0),
        0
      );
      const alert = Number(p.alert_quantity ?? 0);
      const isShort = stock <= 0 || (alert > 0 && stock <= alert);
      if (!isShort) continue;
      const defaultNeeded = Math.max(alert > 0 ? alert * 2 - stock : 1, 1);
      out.push({ id: p.id, name: p.name, sku: p.sku, stock, alert, neededPcs: Math.ceil(defaultNeeded) });
    }
    return out;
  }, [data]);

  const effective = rows.map((r) => ({ ...r, neededPcs: edits[r.id] ?? r.neededPcs }));

  function label(r: ShortRow) {
    return `${Math.max(0, Math.round(r.neededPcs))} pcs`;
  }

  function doPrint() {
    printShortList(
      effective.map((r) => ({ name: r.name, stock: r.stock, qty: label(r) })),
      size,
      business?.name ?? ""
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/products">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
          <h2 className="font-display text-lg font-semibold">Short Product List</h2>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={size}
            onChange={(e) => setSize(e.target.value as PrintSize)}
            className="h-9 rounded-md border border-border bg-input px-2 text-sm"
          >
            <option value="a4">A4</option>
            <option value="80mm">POS 80mm</option>
            <option value="58mm">POS 58mm</option>
          </select>
          <Button size="sm" onClick={doPrint} disabled={effective.length === 0}>
            <Printer className="h-4 w-4 mr-1" />
            Print
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Products that are out of stock or at/below their alert quantity. Edit the needed quantity (pieces) before printing.
      </p>

      <div className="rounded-2xl border border-border/60 bg-card overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium w-10">#</th>
              <th className="text-left px-4 py-3 font-medium">Product</th>
              <th className="text-right px-4 py-3 font-medium">In Stock</th>
              <th className="text-right px-4 py-3 font-medium">Needed (pcs)</th>
              <th className="text-left px-4 py-3 font-medium">Order</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : effective.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-12 text-center text-muted-foreground">
                  <PackageOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  No short products — everything is in stock.
                </td>
              </tr>
            ) : (
              effective.map((r, i) => (
                <tr key={r.id} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium">
                    {r.name}
                    {r.sku && <div className="text-xs text-muted-foreground font-mono">SKU: {r.sku}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    <span className={r.stock <= 0 ? "text-destructive font-semibold" : ""}>{r.stock}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <input
                      type="number"
                      min={0}
                      value={r.neededPcs}
                      onChange={(e) =>
                        setEdits((s) => ({ ...s, [r.id]: Math.max(0, Number(e.target.value) || 0) }))
                      }
                      className="h-8 w-24 rounded-md border border-border bg-input px-2 text-right text-sm tabular-nums"
                    />
                  </td>
                  <td className="px-4 py-2.5 font-medium">{label(r)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function printShortList(
  items: { name: string; stock: number; qty: string }[],
  size: PrintSize,
  businessName: string
) {
  const printId = "short-list-print-page";
  const styleId = "short-list-print-style";
  const pageSize = size === "a4" ? "A4" : size === "80mm" ? "80mm auto" : "58mm auto";
  const margin = size === "a4" ? "12mm" : "3mm 2mm";
  const fontSize = size === "a4" ? "12px" : size === "80mm" ? "11px" : "10px";

  document.getElementById(printId)?.remove();
  document.getElementById(styleId)?.remove();

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    @page { size: ${pageSize}; margin: ${margin}; }
    @media print {
      :root, html, body, #root { color-scheme: only light !important; background: #fff !important; color: #000 !important; }
      body > *:not(#${printId}) { display: none !important; visibility: hidden !important; }
      #${printId}, #${printId} * {
        visibility: visible !important; color: #000 !important; background: #fff !important;
        box-shadow: none !important; text-shadow: none !important; border-color: #000 !important;
        box-sizing: border-box !important; overflow-wrap: anywhere !important;
      }
      #${printId} { display: block !important; position: static !important; width: 100% !important; }
      #${printId} .center { text-align: center !important; }
      #${printId} .bold { font-weight: 700 !important; }
      #${printId} .muted { font-size: 0.9em !important; }
      #${printId} .sep { border-top: 1px dashed #000 !important; margin: 5px 0 !important; }
      #${printId} table { width: 100% !important; border-collapse: collapse !important; }
      #${printId} th, #${printId} td { padding: 3px 2px !important; border-bottom: 1px solid #000 !important; vertical-align: top !important; }
      #${printId} th { font-weight: 700 !important; text-align: left !important; }
      #${printId} .right { text-align: right !important; }
      #${printId} tr { page-break-inside: avoid !important; }
    }
  `;

  const esc = (s: string) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

  const rows = items
    .map(
      (it, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(it.name)}</td>
        <td class="right bold">${esc(it.qty)}</td>
      </tr>`
    )
    .join("");

  const printPage = document.createElement("div");
  printPage.id = printId;
  printPage.innerHTML = `
    ${businessName ? `<div class="center bold" style="font-size:1.15em">${esc(businessName)}</div>` : ""}
    <div class="center bold">Short Product List</div>
    <div class="center muted">${esc(formatDate(new Date().toISOString()))}</div>
    <div class="sep"></div>
    <table>
      <thead><tr><th style="width:24px">#</th><th>Product</th><th class="right">Qty</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="sep"></div>
    <div class="muted">Total items: ${items.length}</div>
  `;
  printPage.style.cssText = `position:fixed;left:0;top:0;z-index:-1;opacity:0;pointer-events:none;width:${
    size === "a4" ? "210mm" : size === "80mm" ? "80mm" : "58mm"
  };background:#fff;color:#000;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:${fontSize};line-height:1.35;`;

  document.head.appendChild(style);
  document.body.appendChild(printPage);

  const cleanup = () => {
    printPage.remove();
    style.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  import("@/lib/print-preview").then(({ showPrintPreview }) => {
    showPrintPreview({ printPage, cleanup, filename: `short-list-${Date.now()}` });
  });
}
