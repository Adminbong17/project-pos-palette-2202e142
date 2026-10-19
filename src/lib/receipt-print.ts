export type ReceiptLine = {
  name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
};

export type ReceiptSale = {
  invoice_no: string;
  lines: ReceiptLine[];
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  change: number;
  payment_method: string;
  customer_name: string | null;
  date: string;
  served_by?: string | null;
  counter_id?: string | null;
  vat?: number;
};

export type ReceiptHeader = {
  businessName: string;
  businessAddress: string;
  businessMobile: string;
  vatReg?: string;
};

function escapeHtml(value: string) {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" };
  return value.replace(/[&<>'"]/g, (c) => entities[c] ?? c);
}

function splitDateTime(input: string): { date: string; time: string } {
  if (!input) return { date: "", time: "" };
  // Try common formats: "dd/mm/yyyy hh:mm AM", "7/13/2026, 9:21:37 PM"
  const commaIdx = input.indexOf(",");
  if (commaIdx > -1) return { date: input.slice(0, commaIdx).trim(), time: input.slice(commaIdx + 1).trim() };
  const parts = input.trim().split(/\s+/);
  if (parts.length >= 2) {
    // If last token looks like AM/PM, take last two as time
    const tail = parts[parts.length - 1].toUpperCase();
    if (tail === "AM" || tail === "PM") {
      const time = parts.slice(-2).join(" ");
      const date = parts.slice(0, -2).join(" ");
      return { date, time };
    }
    return { date: parts[0], time: parts.slice(1).join(" ") };
  }
  return { date: input, time: "" };
}

export function receiptHtml(sale: ReceiptSale, header: ReceiptHeader, width: "58" | "80" | "A4" = "80") {
  const is58 = width === "58";
  const { date, time } = splitDateTime(sale.date);
  const netQty = sale.lines.reduce((s, l) => s + Number(l.quantity || 0), 0);
  const isCard = sale.payment_method?.toLowerCase() === "card";
  const payLabel = isCard ? "CARD" : sale.payment_method ? sale.payment_method.toUpperCase() : "CASH";

  // Items table: for 58mm, 2-line layout prevents side cut-off on narrow 48mm thermal heads.
  // For 80mm & A4, clean 5-column layout with fixed percentages.
  const itemsTableHtml = is58
    ? `
      <table class="items items-58">
        <thead>
          <tr>
            <th class="l" style="width:65%;">Item / Qty × Rate</th>
            <th class="r" style="width:35%;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${sale.lines.map((l, i) => `
            <tr class="item-head">
              <td class="l top item-name" colspan="2"><b>${i + 1}.</b> ${escapeHtml(l.name)}</td>
            </tr>
            <tr class="item-detail">
              <td class="l item-calc">${l.quantity} × ${l.unit_price.toFixed(2)}</td>
              <td class="r item-tot"><b>${l.total_amount.toFixed(2)}</b></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `
    : `
      <table class="items items-80">
        <thead>
          <tr>
            <th class="c" style="width:8%;">No.</th>
            <th class="l" style="width:48%;">Item</th>
            <th class="c" style="width:14%;">Qty</th>
            <th class="r" style="width:15%;">Price</th>
            <th class="r" style="width:15%;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${sale.lines.map((l, i) => `
            <tr>
              <td class="c top">${i + 1}</td>
              <td class="l top">${escapeHtml(l.name)}</td>
              <td class="c top">${l.quantity}</td>
              <td class="r top">${l.unit_price.toFixed(2)}</td>
              <td class="r top">${l.total_amount.toFixed(2)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

  const metaHtml = is58
    ? `
      <div class="meta meta-58">
        <div class="meta-row"><span><b>Bill No:</b></span><span class="bold">${escapeHtml(sale.invoice_no)}</span></div>
        <div class="meta-row"><span>Date:</span><span>${escapeHtml(date)} ${escapeHtml(time)}</span></div>
        ${sale.served_by || sale.counter_id ? `<div class="meta-row"><span>Cashier:</span><span>${escapeHtml(sale.served_by ?? "")}${sale.counter_id ? ` (${escapeHtml(sale.counter_id)})` : ""}</span></div>` : ""}
        ${sale.customer_name ? `<div class="meta-row"><span>Customer:</span><span>${escapeHtml(sale.customer_name)}</span></div>` : ""}
      </div>
    `
    : `
      <div class="meta meta-80">
        <div class="two"><span><b>Bill No</b> : <b>${escapeHtml(sale.invoice_no)}</b></span><span>Date : ${escapeHtml(date)} ${escapeHtml(time)}</span></div>
        <div class="two"><span>Cashier : ${escapeHtml(sale.served_by ?? "")}</span><span>Counter : ${escapeHtml(sale.counter_id ?? "")}</span></div>
        ${sale.customer_name ? `<div class="two"><span>Customer : ${escapeHtml(sale.customer_name)}</span><span></span></div>` : ""}
      </div>
    `;

  const totalsHtml = is58
    ? `
      <div class="totals totals-58">
        <div class="row"><span>Subtotal:</span><span>${sale.subtotal.toFixed(2)}</span></div>
        ${sale.vat ? `<div class="row"><span>VAT:</span><span>${sale.vat.toFixed(2)}</span></div>` : ""}
        ${sale.discount > 0 ? `<div class="row"><span>Discount:</span><span>-${sale.discount.toFixed(2)}</span></div>` : ""}
        <div class="row"><span>Total Qty:</span><span>${netQty}</span></div>
        <div class="row net"><span>Net Total:</span><span>${sale.total.toFixed(2)}</span></div>
      </div>
    `
    : `
      <div class="totals totals-80">
        <div class="row"><span>Total Amount :</span><span>${sale.subtotal.toFixed(2)}</span></div>
        ${sale.vat ? `<div class="row"><span>VAT :</span><span>${sale.vat.toFixed(2)}</span></div>` : ""}
        ${sale.discount > 0 ? `<div class="row"><span>Discount :</span><span>${sale.discount.toFixed(2)}</span></div>` : ""}
        <div class="row net"><span>Net Qty : ${netQty}</span><span>Net Total : ${sale.total.toFixed(2)}</span></div>
      </div>
    `;

  return `
    <header class="receipt-header">
      <div class="brand">${escapeHtml(header.businessName)}</div>
      ${header.businessAddress ? `<div class="addr">${escapeHtml(header.businessAddress)}</div>` : ""}
      ${header.businessMobile ? `<div class="addr">Phone : ${escapeHtml(header.businessMobile)}</div>` : ""}
      ${header.vatReg ? `<div class="addr">GST Reg No : ${escapeHtml(header.vatReg)}</div>` : ""}
    </header>

    ${metaHtml}

    ${itemsTableHtml}

    ${totalsHtml}

    <div class="paybox">
      <div class="row big"><span>Paid (${escapeHtml(payLabel)})</span><span>${sale.paid.toFixed(2)}</span></div>
      <div class="row sep"><span>Amount Tendered</span><span>${sale.paid.toFixed(2)}</span></div>
      <div class="row"><span>${sale.change < 0 ? "Due" : "Change Due"}</span><span>${Math.abs(sale.change).toFixed(2)}</span></div>
    </div>

    <div class="thanks">Thank You Very Much For Your Business!</div>
    <div class="note">Store In A Cool, Dry Place Below 25 Deg Celsius. Refrigerate After Opening Goods Sold Are Not Returnable</div>
  `;
}

export function receiptCss(scope: string, fontSize: string, widthCss: string) {
  return baseReceiptCss(scope, fontSize, widthCss);
}

function baseReceiptCss(scope: string, fontSize: string, widthCss: string) {
  const is58 = widthCss === "48mm";
  return `
    ${scope}, ${scope} * { color:#000 !important; background:#fff !important; box-shadow:none !important; text-shadow:none !important; filter:none !important; border-color:#000 !important; box-sizing:border-box !important; overflow-wrap:anywhere !important; word-break:break-word !important; font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important; }
    ${scope} { font-size:${fontSize} !important; line-height:1.3 !important; width:${widthCss} !important; max-width:${widthCss} !important; margin:0 auto !important; padding:${is58 ? "0 1mm" : "0 2mm"} !important; }
    ${scope} .receipt-header { display:block !important; width:100% !important; text-align:center !important; margin:0 auto !important; }
    ${scope} .brand { display:block !important; width:100% !important; text-align:center !important; font-weight:700 !important; font-size:1.25em !important; letter-spacing:0.3px !important; margin:0 auto 2px !important; line-height:1.2 !important; }
    ${scope} .addr { display:block !important; width:100% !important; text-align:center !important; font-size:0.9em !important; margin:0 auto !important; line-height:1.25 !important; }
    ${scope} .meta { margin:5px 0 4px !important; border-top:1px dashed #000 !important; border-bottom:1px dashed #000 !important; padding:3px 0 !important; }
    ${scope} .meta .two { display:flex !important; justify-content:space-between !important; flex-wrap:wrap !important; gap:2px 6px !important; }
    ${scope} .meta .meta-row { display:flex !important; justify-content:space-between !important; gap:4px !important; padding:1px 0 !important; font-size:0.95em !important; }
    ${scope} table.items { width:100% !important; border-collapse:collapse !important; margin:0 0 4px !important; table-layout:fixed !important; }
    ${scope} table.items thead th { border-bottom:1px dashed #000 !important; padding:3px 1px !important; font-weight:700 !important; font-size:0.95em !important; }
    ${scope} table.items tbody td { padding:1px 1px !important; vertical-align:top !important; }
    ${scope} table.items tbody td.top { padding-top:2px !important; }
    ${scope} table.items .l { text-align:left !important; }
    ${scope} table.items .c { text-align:center !important; }
    ${scope} table.items .r { text-align:right !important; }
    ${scope} table.items .item-name { font-weight:700 !important; font-size:1em !important; }
    ${scope} table.items .item-calc { font-size:0.92em !important; padding-left:4px !important; color:#222 !important; }
    ${scope} table.items .item-tot { font-size:1em !important; font-weight:700 !important; }
    ${scope} .totals { border-top:1px dashed #000 !important; padding-top:2px !important; }
    ${scope} .totals .row, ${scope} .paybox .row { display:flex !important; justify-content:space-between !important; padding:1px 0 !important; }
    ${scope} .totals .row.net { font-weight:700 !important; font-size:1.1em !important; border-top:1px solid #000 !important; margin-top:3px !important; padding-top:3px !important; }
    ${scope} .paybox { border:1px solid #000 !important; padding:3px 4px !important; margin:4px 0 !important; border-radius:2px !important; }
    ${scope} .paybox .row.big { font-weight:700 !important; font-size:1.05em !important; padding-bottom:6px !important; }
    ${scope} .paybox .row.sep { border-top:1px dashed #000 !important; padding-top:2px !important; margin-top:2px !important; }
    ${scope} .thanks { text-align:center !important; margin-top:5px !important; font-size:0.9em !important; font-weight:600 !important; }
    ${scope} .note { text-align:center !important; font-size:0.8em !important; margin-top:2px !important; color:#333 !important; }
  `;
}


export function printReceiptInWhitePage(sale: ReceiptSale, width: "58" | "80" | "A4", header: ReceiptHeader) {
  const isA4 = width === "A4";
  const is58 = width === "58";
  
  // Standard 58mm thermal rolls have 48mm printable head width.
  // Standard 80mm thermal rolls have 72mm printable head width.
  const contentWidth = is58 ? "48mm" : width === "80" ? "72mm" : "190mm";
  const pageSize = isA4 ? "A4" : is58 ? "58mm auto" : "80mm auto";
  
  // Zero-margin @page for thermal rolls avoids browser margin clipping.
  const pageMargin = isA4 ? "10mm" : "0mm";
  const fontSize = is58 ? "11px" : width === "80" ? "13px" : "13px";
  const printId = "pos-white-receipt-print-page";
  const styleId = "pos-white-receipt-print-style";
  document.getElementById(printId)?.remove();
  document.getElementById(styleId)?.remove();

  const style = document.createElement("style");
  style.id = styleId;
  const receiptRules = baseReceiptCss(`#${printId}`, fontSize, contentWidth) + baseReceiptCss(`.receipt-preview-clone`, fontSize, contentWidth);
  style.textContent = `
    @page { size: ${pageSize}; margin: ${pageMargin}; }
    ${receiptRules}
    @media print {
      :root, html, body, #root { color-scheme: only light !important; background:#fff !important; color:#000 !important; forced-color-adjust: none !important; }
      html, body { margin:0 !important; padding:0 !important; }
      body > *:not(#${printId}) { display:none !important; visibility:hidden !important; }
      #${printId} { display:block !important; visibility:visible !important; position:static !important; width:${contentWidth} !important; max-width:${contentWidth} !important; margin:0 auto !important; padding:${is58 ? "0 1mm" : "0 2mm"} !important; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
    }
  `;

  const printPage = document.createElement("div");
  printPage.id = printId;
  printPage.innerHTML = receiptHtml(sale, header, width);
  printPage.style.cssText = `position:fixed;left:-10000px;top:0;z-index:-1;width:${contentWidth};max-width:${contentWidth};margin:0 auto;background:#fff;color:#000;box-sizing:border-box;`;

  const prevBg = document.body.style.background;
  const prevColor = document.body.style.color;
  document.body.style.background = "#fff";
  document.body.style.color = "#000";
  document.head.appendChild(style);
  document.body.appendChild(printPage);

  const cleanup = () => {
    printPage.remove();
    style.remove();
    document.body.style.background = prevBg;
    document.body.style.color = prevColor;
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  import("./print-preview").then(({ showPrintPreview }) => {
    showPrintPreview({ printPage, cleanup, filename: `receipt-${sale.invoice_no}` });
  });
}
