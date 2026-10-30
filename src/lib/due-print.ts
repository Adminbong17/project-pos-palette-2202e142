import { showPrintPreview } from "@/lib/print-preview";
import { isSheikhPharma, getSheikhPharmaHeaderHtml, getSheikhPharmaFooterHtml, SHEIKH_PHARMA_DETAILS } from "@/lib/sheikh-pharma-letterhead";

export type DueVoucherData = {
  voucherNo: string;
  invoiceNo: string;
  date: string;
  customerName: string;
  customerMobile?: string | null;
  customerAddress?: string | null;
  totalBill: number;
  previouslyPaid: number;
  amountPaidNow: number;
  remainingDue: number;
  paymentMethod: string;
  note?: string | null;
  servedBy?: string | null;
  business?: { name?: string | null; address?: string | null; notify_phone?: string | null } | null;
};

export function printDueVoucher(data: DueVoucherData, width: "58" | "80" | "A4" = "80") {
  const isA4 = width === "A4";
  const is58 = width === "58";
  const contentWidth = is58 ? "48mm" : width === "80" ? "72mm" : "190mm";
  const pageSize = isA4 ? "A4" : is58 ? "58mm auto" : "80mm auto";
  const pageMargin = isA4 ? "12mm" : "0mm";
  const fontSize = is58 ? "11px" : width === "80" ? "12px" : "13px";

  const bizName = data.business?.name ?? SHEIKH_PHARMA_DETAILS.nameEnglish;
  const bizAddr = data.business?.address ?? SHEIKH_PHARMA_DETAILS.address;
  const bizPhone = data.business?.notify_phone ?? SHEIKH_PHARMA_DETAILS.phones;

  const styleId = "due-voucher-print-style";
  document.getElementById(styleId)?.remove();
  const st = document.createElement("style");
  st.id = styleId;
  st.textContent = `
    #due-voucher-print-page { display:none; }
    @media print {
      @page { size: ${pageSize}; margin: ${pageMargin}; }
      body * { visibility: hidden !important; }
      #due-voucher-print-page, #due-voucher-print-page * { visibility: visible !important; }
      #due-voucher-print-page { display:block !important; position:absolute; left:0; top:0; width:100%; background:#fff; color:#000; }
    }
    .receipt-preview-clone.due-voucher { display:block !important; width:${contentWidth}; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color:#000; background:#fff; margin:0 auto; padding:${is58 ? "2px 1mm" : "6px 2mm"}; box-sizing:border-box; font-size:${fontSize}; }
    .receipt-preview-clone.due-voucher table { width:100%; border-collapse:collapse; margin:6px 0; }
    .receipt-preview-clone.due-voucher td { padding:3px 2px; }
  `;
  document.head.appendChild(st);

  const page = document.createElement("div");
  page.id = "due-voucher-print-page";
  page.className = "due-voucher";
  page.style.cssText = `font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color:#000; background:#fff; padding:${is58 ? "2px 1mm" : "8px 4mm"}; width:${contentWidth}; max-width:${contentWidth}; margin:0 auto; box-sizing:border-box; font-size:${fontSize};`;

  const money = (n: number) => `৳ ${(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const bodyContent = `
    <div style="text-align:center; border-bottom:1px dashed #000; padding-bottom:6px; margin-bottom:6px;">
      <div style="font-size:1.25em; font-weight:800; letter-spacing:0.3px;">${bizName}</div>
      <div style="font-size:0.9em; margin-top:2px;">${bizAddr}</div>
      ${bizPhone ? `<div style="font-size:0.85em;">Phone: ${bizPhone}</div>` : ""}
      <div style="display:inline-block; margin-top:6px; padding:2px 10px; border:1px solid #000; border-radius:3px; font-weight:800; font-size:1em; text-transform:uppercase;">
        বকেয়া আদায় রশিদ / Due Voucher
      </div>
    </div>

    <div style="border-bottom:1px dashed #000; padding-bottom:6px; margin-bottom:6px; font-size:0.95em; line-height:1.4;">
      <div style="display:flex; justify-content:space-between; gap:4px;">
        <span><b>রশিদ নং:</b> ${data.voucherNo}</span>
        <span><b>তারিখ:</b> ${data.date}</span>
      </div>
      <div style="display:flex; justify-content:space-between; gap:4px; margin-top:2px;">
        <span><b>মূল চালান:</b> ${data.invoiceNo}</span>
        <span><b>মাধ্যম:</b> ${(data.paymentMethod || "cash").toUpperCase()}</span>
      </div>
      <div style="margin-top:3px; padding-top:3px; border-top:1px dotted #ccc;">
        <div><b>গ্রাহক:</b> ${data.customerName || "Walk-in Customer"}</div>
        ${data.customerMobile ? `<div><b>মোবাইল:</b> ${data.customerMobile}</div>` : ""}
        ${data.customerAddress ? `<div><b>ঠিকানা:</b> ${data.customerAddress}</div>` : ""}
      </div>
    </div>

    <table style="width:100%; border-collapse:collapse; margin-bottom:8px; font-size:0.95em;">
      <tbody>
        <tr style="border-bottom:1px dotted #ddd;">
          <td style="padding:4px 0; color:#333;">মূল চালানের মোট বিল:</td>
          <td style="padding:4px 0; text-align:right; font-family:monospace;">${money(data.totalBill)}</td>
        </tr>
        <tr style="border-bottom:1px dotted #ddd;">
          <td style="padding:4px 0; color:#333;">পূর্বে পরিশোধিত টাকা:</td>
          <td style="padding:4px 0; text-align:right; font-family:monospace;">${money(data.previouslyPaid)}</td>
        </tr>
        <tr style="border-bottom:1px dotted #ddd;">
          <td style="padding:4px 0; color:#555;">আজকের পূর্বের বকেয়া:</td>
          <td style="padding:4px 0; text-align:right; font-family:monospace;">${money(Math.max(0, data.totalBill - data.previouslyPaid))}</td>
        </tr>
        <tr style="background:#f4f4f4; font-weight:800; font-size:1.05em; border-top:1px solid #000; border-bottom:1px solid #000;">
          <td style="padding:6px 4px;">আজকে আদায়কৃত টাকা:</td>
          <td style="padding:6px 4px; text-align:right; font-family:monospace; color:#000;">${money(data.amountPaidNow)}</td>
        </tr>
        <tr style="font-weight:700; border-bottom:1px dashed #000;">
          <td style="padding:5px 0; color:${data.remainingDue > 0 ? '#b91c1c' : '#15803d'};">
            ${data.remainingDue > 0 ? "বর্তমান অবশিষ্ট বকেয়া:" : "পরিশোধ স্ট্যাটাস:"}
          </td>
          <td style="padding:5px 0; text-align:right; font-family:monospace; color:${data.remainingDue > 0 ? '#b91c1c' : '#15803d'};">
            ${data.remainingDue > 0 ? money(data.remainingDue) : "পরিশোধিত (Cleared)"}
          </td>
        </tr>
      </tbody>
    </table>

    ${data.note ? `<div style="font-size:0.85em; font-style:italic; margin-bottom:8px;">মন্তব্য: ${data.note}</div>` : ""}

    <div style="margin-top:24px; padding-top:6px; display:flex; justify-content:space-between; align-items:flex-end; font-size:0.85em;">
      <div style="text-align:center; width:45%; border-top:1px dashed #000; padding-top:3px;">
        গ্রাহকের স্বাক্ষর
      </div>
      <div style="text-align:center; width:45%; border-top:1px dashed #000; padding-top:3px;">
        আদায়কারীর স্বাক্ষর
      </div>
    </div>

    <div style="text-align:center; font-size:0.8em; color:#555; margin-top:14px; border-top:1px dotted #ccc; padding-top:6px;">
      শেখ ফার্মার সাথে থাকার জন্য ধন্যবাদ!
    </div>
  `;

  if (isA4 && isSheikhPharma(bizName)) {
    page.innerHTML = `
      <div style="display:flex; flex-direction:column; justify-content:space-between; min-height:265mm;">
        <div>
          ${getSheikhPharmaHeaderHtml({ title: "বকেয়া আদায় রশিদ / Due Voucher", metaRight: `তারিখ: ${data.date}` })}
          <div style="max-width:550px; margin:20px auto; border:1px solid #000; padding:16px; border-radius:6px;">
            ${bodyContent}
          </div>
        </div>
        ${getSheikhPharmaFooterHtml()}
      </div>
    `;
  } else {
    page.innerHTML = bodyContent;
  }

  document.body.appendChild(page);
  const cleanup = () => { page.remove(); };
  window.addEventListener("afterprint", cleanup, { once: true });
  showPrintPreview({ printPage: page, cleanup, filename: `due-voucher-${data.voucherNo}` });
}
