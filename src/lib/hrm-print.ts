// Simple A4 report print for HRM pages.
// Builds an offscreen printable node and shows the shared print preview modal.
import { showPrintPreview } from "@/lib/print-preview";
import { isSheikhPharma, getSheikhPharmaHeaderHtml, getSheikhPharmaFooterHtml } from "@/lib/sheikh-pharma-letterhead";

export function printHrmReport(opts: {
  title: string;
  subtitle?: string;
  business?: { name?: string | null } | null;
  columns: { label: string; align?: "left" | "right" | "center" }[];
  rows: (string | number)[][];
  footer?: (string | number)[][];
  filename?: string;
  size?: "A4" | "80mm" | "58mm";
}) {
  const { title, subtitle, business, columns, rows, footer = [], filename, size = "A4" } = opts;
  const pageSize = size === "A4" ? "A4" : size === "80mm" ? "80mm auto" : "58mm auto";
  const pageMargin = size === "A4" ? "12mm" : "3mm 2mm";
  const width = size === "A4" ? "210mm" : size === "80mm" ? "80mm" : "58mm";
  const fontSize = size === "A4" ? "12px" : size === "80mm" ? "10px" : "9px";

  const styleId = "hrm-print-style";
  document.getElementById(styleId)?.remove();
  const st = document.createElement("style");
  st.id = styleId;
  st.textContent = `
    #hrm-print-page { display:none; }
    @media print {
      @page { size: ${pageSize}; margin: ${pageMargin}; }
      body * { visibility: hidden !important; }
      #hrm-print-page, #hrm-print-page * { visibility: visible !important; }
      #hrm-print-page { display:block !important; position:absolute; left:0; top:0; width:100%; background:#fff; color:#000; }
    }
    .receipt-preview-clone.hrm-report { display:block !important; width: ${width}; font-family: ui-sans-serif, system-ui, Arial, sans-serif; color:#000; }
    .receipt-preview-clone.hrm-report table { width:100%; border-collapse: collapse; font-size: ${fontSize}; }
    .receipt-preview-clone.hrm-report th, .receipt-preview-clone.hrm-report td { border:1px solid #000; padding: 3px 4px; }
    .receipt-preview-clone.hrm-report th { background:#eee; text-align:left; }
  `;
  document.head.appendChild(st);

  const page = document.createElement("div");
  page.id = "hrm-print-page";
  page.className = "hrm-report";
  page.style.cssText = `font-family:ui-sans-serif,system-ui,Arial,sans-serif;color:#000;background:#fff;padding:8px;width:${width};font-size:${fontSize};`;

  const align = (a?: string) => a === "right" ? "right" : a === "center" ? "center" : "left";
  const esc = (s: any) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));

  const useLetterhead = size === "A4" && isSheikhPharma(business?.name);
  const printedDate = new Date().toLocaleString("en-GB");

  const tableHtml = `
    <table>
      <thead><tr>${columns.map((c) => `<th style="text-align:${align(c.align)}">${esc(c.label)}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows.map((r) => `<tr>${r.map((cell, i) => `<td style="text-align:${align(columns[i]?.align)}">${esc(cell)}</td>`).join("")}</tr>`).join("")}
        ${footer.map((r) => `<tr>${r.map((cell, i) => `<td style="text-align:${align(columns[i]?.align)};font-weight:700;background:#f4f4f4;">${esc(cell)}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table>
  `;

  if (useLetterhead) {
    page.innerHTML = `
      <div style="display:flex; flex-direction:column; justify-content:space-between; min-height:265mm;">
        <div>
          ${getSheikhPharmaHeaderHtml({ title, subtitle, metaRight: `Printed: ${printedDate}` })}
          <div style="margin-top:10px;">
            ${tableHtml}
          </div>
        </div>
        ${getSheikhPharmaFooterHtml()}
      </div>
    `;
  } else {
    page.innerHTML = `
      <div style="text-align:center;margin-bottom:8px;">
        <div style="font-size:18px;font-weight:800;">${esc(business?.name ?? "")}</div>
        <div style="font-size:14px;font-weight:700;">${esc(title)}</div>
        ${subtitle ? `<div style="font-size:11px;">${esc(subtitle)}</div>` : ""}
        <div style="font-size:10px;">Printed: ${printedDate}</div>
      </div>
      ${tableHtml}
    `;
  }

  document.body.appendChild(page);

  const cleanup = () => { page.remove(); };
  window.addEventListener("afterprint", cleanup, { once: true });

  showPrintPreview({ printPage: page, cleanup, filename: filename ?? title.toLowerCase().replace(/\s+/g, "-") });
}
