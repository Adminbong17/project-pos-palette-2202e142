import { formatDate, formatDateTime } from "@/lib/utils";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { Button } from "@/components/ui/button";
import { Pencil, ArrowLeft, Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/purchases/$id")({
  component: PurchaseIdRoute,
});

type PrintSize = "a4" | "80mm" | "58mm";

function PurchaseIdRoute() {
  const { id } = Route.useParams();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== `/purchases/${id}`) return <Outlet />;
  return <ViewPurchasePage />;
}

function ViewPurchasePage() {
  const { id } = Route.useParams();
  const [size, setSize] = useState<PrintSize>("80mm");
  const { data: business } = useCurrentBusiness();

  const { data, isLoading } = useQuery({
    queryKey: ["purchase", id],
    queryFn: async () => {
      const { data: tx, error } = await supabase
        .from("transactions")
        .select(
          "id, ref_no, transaction_date, status, payment_status, final_total, total_paid, additional_notes, contact:contacts(name), location:business_locations(name, landmark, city, state, country, zip_code, mobile, alternate_number, email)"
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      const { data: lines, error: le } = await supabase
        .from("transaction_purchase_lines")
        .select("id, quantity, purchase_price, product:products(name, sku), variation:variations(name)")
        .eq("transaction_id", id);
      if (le) throw le;
      return { tx, lines: lines ?? [] };
    },
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: "BDT", maximumFractionDigits: 2 }).format(n || 0);

  function doPrint(next: PrintSize) {
    setSize(next);
    if (!data?.tx) return;
    const loc: any = (data.tx as any).location;
    const header = {
      businessName: business?.name ?? "",
      businessAddress: loc ? [loc.landmark, loc.city, loc.state, loc.zip_code, loc.country].filter(Boolean).join(", ") : "",
      businessMobile: loc ? [loc.mobile, loc.alternate_number].filter(Boolean).join(" / ") : "",
      businessEmail: loc?.email ?? "",
    };
    printPurchaseInWhitePage(data.tx, data.lines, next, header);
  }

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!data?.tx) return <div className="p-6">Not found.</div>;
  const tx: any = data.tx;
  const due = Number(tx.final_total || 0) - Number(tx.total_paid || 0);

  return (
    <div className={`p-4 sm:p-6 space-y-4 max-w-4xl`} id="purchase-print-root">


      <div className="flex items-center justify-between gap-2 flex-wrap no-print">
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm"><Link to="/purchases"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link></Button>
          <h1 className="text-xl sm:text-2xl font-semibold">Purchase {tx.ref_no ? `#${tx.ref_no}` : ""}</h1>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={size}
            onChange={(e) => setSize(e.target.value as PrintSize)}
            className="h-9 rounded-md border border-border bg-input px-2 text-sm"
          >
            <option value="a4">A4</option>
            <option value="80mm">POS 80mm</option>
            <option value="58mm">POS 58mm</option>
          </select>
          <Button size="sm" variant="outline" onClick={() => doPrint(size)}>
            <Printer className="h-4 w-4 mr-1" />Print
          </Button>
          <Button asChild size="sm">
            <Link to="/purchases/$id/edit" params={{ id }}><Pencil className="h-4 w-4 mr-1" />Edit</Link>
          </Button>
        </div>
      </div>

      <div className="hidden print:block mb-2 text-center">
        <div className="font-semibold text-base">Purchase {tx.ref_no ? `#${tx.ref_no}` : ""}</div>
        <div className="text-xs">{formatDateTime(tx.transaction_date)}</div>
      </div>

      <div className="card-box rounded-2xl border bg-card p-4 grid gap-3 sm:grid-cols-3 text-sm">
        <div><div className="text-xs text-muted-foreground">Date</div><div>{formatDateTime(tx.transaction_date)}</div></div>
        <div><div className="text-xs text-muted-foreground">Supplier</div><div>{tx.contact?.name ?? "—"}</div></div>
        <div><div className="text-xs text-muted-foreground">Location</div><div>{tx.location?.name ?? "—"}</div></div>
        <div><div className="text-xs text-muted-foreground">Status</div><div className="capitalize">{tx.status}</div></div>
        <div><div className="text-xs text-muted-foreground">Payment</div><div className="capitalize">{tx.payment_status}</div></div>
        <div><div className="text-xs text-muted-foreground">Ref No</div><div className="font-mono text-xs">{tx.ref_no ?? "—"}</div></div>
        {tx.additional_notes && <div className="sm:col-span-3"><div className="text-xs text-muted-foreground">Notes</div><div>{tx.additional_notes}</div></div>}
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left p-3">Product</th>
              <th className="text-right p-3">Qty</th>
              <th className="text-right p-3 thermal-hide">Price</th>
              <th className="text-right p-3">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((l: any) => (
              <tr key={l.id} className="border-t">
                <td className="p-3">
                  {l.product?.name}
                  {l.variation?.name && l.variation.name !== "DUMMY" ? ` (${l.variation.name})` : ""}
                  <div className="text-xs text-muted-foreground thermal-hide">SKU: {l.product?.sku}</div>
                </td>
                <td className="p-3 text-right">
                  {Number(l.quantity)}
                  {(() => {
                    const ps = Math.max(1, Math.floor(Number(l.variation?.pack_size ?? 1)));
                    const qty = Number(l.quantity);
                    if (ps > 1 && qty > 0 && qty % ps === 0)
                      return <div className="text-xs text-muted-foreground">{qty / ps} box × {ps} pcs</div>;
                    return null;
                  })()}
                </td>
                <td className="p-3 text-right thermal-hide">{fmt(Number(l.purchase_price))}</td>
                <td className="p-3 text-right">{fmt(Number(l.quantity) * Number(l.purchase_price))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card-box rounded-2xl border bg-card p-4 grid gap-2 sm:grid-cols-3 text-sm">
        <div className="flex justify-between sm:block"><span className="text-muted-foreground">Total</span><div className="font-semibold">{fmt(Number(tx.final_total))}</div></div>
        <div className="flex justify-between sm:block"><span className="text-muted-foreground">Paid</span><div className="font-semibold">{fmt(Number(tx.total_paid))}</div></div>
        <div className="flex justify-between sm:block"><span className="text-muted-foreground">Due</span><div className="font-semibold">{fmt(due)}</div></div>
      </div>
    </div>
  );
}

type PrintHeader = { businessName: string; businessAddress: string; businessMobile: string; businessEmail: string };

function printPurchaseInWhitePage(tx: any, lines: any[], size: PrintSize, header: PrintHeader) {
  const printId = "purchase-white-print-page";
  const styleId = "purchase-white-print-style";
  const pageSize = size === "a4" ? "A4" : size === "80mm" ? "80mm auto" : "58mm auto";
  const margin = size === "a4" ? "12mm" : size === "80mm" ? "3mm 2mm" : "3mm 2mm";
  const fontSize = size === "a4" ? "12px" : size === "80mm" ? "11px" : "10px";

  document.getElementById(printId)?.remove();
  document.getElementById(styleId)?.remove();

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    @page { size: ${pageSize}; margin: ${margin}; }
    @media print {
      :root, html, body, #root {
        color-scheme: only light !important;
        background: #ffffff !important;
        background-color: #ffffff !important;
        color: #000000 !important;
        forced-color-adjust: none !important;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: auto !important;
        min-height: 0 !important;
        overflow: visible !important;
      }
      body > *:not(#${printId}) {
        display: none !important;
        visibility: hidden !important;
      }
      #${printId} {
        display: block !important;
        visibility: visible !important;
        position: static !important;
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-sizing: border-box !important;
        color: #000000 !important;
        background: #ffffff !important;
        background-color: #ffffff !important;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
        font-size: ${fontSize} !important;
        line-height: 1.35 !important;
        box-shadow: none !important;
        text-shadow: none !important;
        filter: none !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        forced-color-adjust: none !important;
      }
      #${printId}, #${printId} * {
        visibility: visible !important;
        color: #000000 !important;
        background: #ffffff !important;
        background-color: #ffffff !important;
        box-shadow: none !important;
        text-shadow: none !important;
        filter: none !important;
        border-color: #000000 !important;
        box-sizing: border-box !important;
        overflow-wrap: anywhere !important;
        word-break: break-word !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        forced-color-adjust: none !important;
      }
      #${printId} .line, #${printId} tr { page-break-inside: avoid !important; break-inside: avoid !important; }
      #${printId} .center { text-align: center !important; }
      #${printId} .bold { font-weight: 700 !important; }
      #${printId} .muted { font-size: 0.9em !important; }
      #${printId} .sep { border-top: 1px dashed #000000 !important; margin: 5px 0 !important; }
      #${printId} .row { display: flex !important; justify-content: space-between !important; gap: 8px !important; }
      #${printId} table { width: 100% !important; border-collapse: collapse !important; }
      #${printId} th, #${printId} td { padding: 3px 2px !important; border-bottom: 1px solid #000000 !important; vertical-align: top !important; }
      #${printId} th { font-weight: 700 !important; text-align: left !important; }
      #${printId} .right { text-align: right !important; }
      ${size === "a4" ? "" : `#${printId} .thermal-hide { display: none !important; }`}
    }
  `;

  const printPage = document.createElement("div");
  printPage.id = printId;
  printPage.innerHTML = purchaseHtml(tx, lines, size, header);
  printPage.style.position = "fixed";
  printPage.style.inset = "0 auto auto 0";
  printPage.style.zIndex = "2147483647";
  printPage.style.width = size === "a4" ? "210mm" : size === "80mm" ? "80mm" : "58mm";
  printPage.style.maxWidth = printPage.style.width;
  printPage.style.boxSizing = "border-box";
  printPage.style.padding = "0";
  printPage.style.margin = "0";
  printPage.style.background = "#ffffff";
  printPage.style.backgroundColor = "#ffffff";
  printPage.style.color = "#000000";
  printPage.style.colorScheme = "only light";
  printPage.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  printPage.style.fontSize = fontSize;
  printPage.style.lineHeight = "1.35";

  const previousBodyBackground = document.body.style.background;
  const previousBodyColor = document.body.style.color;
  const previousBodyColorScheme = document.body.style.colorScheme;
  document.body.style.background = "#ffffff";
  document.body.style.color = "#000000";
  document.body.style.colorScheme = "only light";
  document.head.appendChild(style);
  document.body.appendChild(printPage);

  const cleanup = () => {
    printPage.remove();
    style.remove();
    document.body.style.background = previousBodyBackground;
    document.body.style.color = previousBodyColor;
    document.body.style.colorScheme = previousBodyColorScheme;
    window.removeEventListener("afterprint", cleanup);
  };

  window.addEventListener("afterprint", cleanup);
  import("@/lib/print-preview").then(({ showPrintPreview }) => {
    showPrintPreview({ printPage, cleanup, filename: `purchase-${tx?.ref_no ?? tx?.id ?? "doc"}` });
  });
}


function purchaseHtml(tx: any, lines: any[], size: PrintSize, header: PrintHeader) {
  const due = Number(tx.final_total || 0) - Number(tx.total_paid || 0);
  const itemRows = lines.map((l: any) => {
    const productName = `${l.product?.name ?? ""}${l.variation?.name && l.variation.name !== "DUMMY" ? ` (${l.variation.name})` : ""}`;
    const subtotal = Number(l.quantity || 0) * Number(l.purchase_price || 0);
    return `
      <tr>
        <td>${escapeHtml(productName)}<div class="muted thermal-hide">SKU: ${escapeHtml(l.product?.sku ?? "")}</div></td>
        <td class="right">${Number(l.quantity || 0)}</td>
        <td class="right thermal-hide">${formatMoney(Number(l.purchase_price || 0))}</td>
        <td class="right">${formatMoney(subtotal)}</td>
      </tr>
    `;
  }).join("");

  return `
    ${header.businessName ? `<div class="center bold" style="font-size:1.15em">${escapeHtml(header.businessName)}</div>` : ""}
    ${header.businessAddress ? `<div class="center muted">${escapeHtml(header.businessAddress)}</div>` : ""}
    ${header.businessMobile ? `<div class="center muted">Mob: ${escapeHtml(header.businessMobile)}</div>` : ""}
    ${header.businessEmail ? `<div class="center muted">${escapeHtml(header.businessEmail)}</div>` : ""}
    <div class="sep"></div>
    <div class="center bold">Purchase ${tx.ref_no ? `#${escapeHtml(tx.ref_no)}` : ""}</div>
    <div class="center muted">${escapeHtml(formatDateTime(tx.transaction_date))}</div>
    <div class="sep"></div>
    <div class="row"><span>Supplier</span><span>${escapeHtml(tx.contact?.name ?? "—")}</span></div>
    <div class="row"><span>Location</span><span>${escapeHtml(tx.location?.name ?? "—")}</span></div>
    <div class="row"><span>Status</span><span>${escapeHtml(tx.status ?? "—")}</span></div>
    <div class="row"><span>Payment</span><span>${escapeHtml(tx.payment_status ?? "—")}</span></div>
    ${tx.additional_notes ? `<div class="line"><span>Notes: </span>${escapeHtml(tx.additional_notes)}</div>` : ""}
    <div class="sep"></div>
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th class="right">Qty</th>
          <th class="right thermal-hide">Price</th>
          <th class="right">Subtotal</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div class="sep"></div>
    <div class="row bold"><span>Total</span><span>${formatMoney(Number(tx.final_total || 0))}</span></div>
    <div class="row"><span>Paid</span><span>${formatMoney(Number(tx.total_paid || 0))}</span></div>
    <div class="row"><span>Due</span><span>${formatMoney(due)}</span></div>
    ${size === "a4" ? `<div class="sep"></div><div class="center muted">Printed purchase copy</div>` : ""}
  `;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "BDT", maximumFractionDigits: 2 }).format(n || 0);
}

function escapeHtml(value: string) {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  };
  return value.replace(/[&<>'"]/g, (char) => entities[char] ?? char);
}
