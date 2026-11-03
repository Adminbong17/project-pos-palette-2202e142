/**
 * Bluetooth & Serial Thermal Printer Driver (58mm / 80mm ESC/POS)
 * Supports:
 * 1. Web Bluetooth API (GATT BLE) - Direct zero-driver wireless connection
 * 2. Web Serial API (Bluetooth Virtual COM / USB) - Windows Bluetooth SPP pairing (Baud: 115200)
 * 3. Pure 2D Canvas ESC/POS Rasterization (GS v 0) - Zero CSS / oklch dependency, 100% reliable
 * 4. html-to-image fallback for custom DOM elements
 */

import type { ReceiptSale, ReceiptHeader } from "./receipt-print";
import type { DueVoucherData } from "./due-print";
import { canvasToCatPrinterPackets, renderCatTestSlipCanvas } from "./cat-printer-driver";

export type PrinterConnectionType = "bluetooth" | "serial";
export type PrinterDriverType = "escpos" | "cat_printer";

export interface ConnectedPrinterInfo {
  name: string;
  type: PrinterConnectionType;
  driver?: PrinterDriverType;
  id?: string;
  connectedAt: number;
}

// Known GATT service UUIDs used by mobile thermal printers (PT-220, MTP-II, POS-58, MX04 Cat, etc.)
const KNOWN_PRINTER_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb", // Standard mobile printer service (PT-220, MTP-II)
  "0000ffe0-0000-1000-8000-00805f9b34fb", // Common Chinese BLE POS
  "0000ff00-0000-1000-8000-00805f9b34fb", // Cat Printer / MX04 / GT01 primary service
  "0000ae30-0000-1000-8000-00805f9b34fb", // Cat Printer alternate service
  "0000fee7-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC Transparent UART
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART
];

export type ReceiptFontSize = "normal" | "large" | "xlarge";

export function renderReceiptToCanvas(
  sale: ReceiptSale,
  header: ReceiptHeader,
  targetWidth = 384,
  fontSizeMode: ReceiptFontSize = "large"
): HTMLCanvasElement {
  const pad = 8;
  const contentWidth = targetWidth - pad * 2; // 368px for 58mm

  // Measurement canvas to calculate dynamic height accurately
  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d")!;

  const wrap = (text: string, font: string, maxW: number): string[] => {
    mctx.font = font;
    const words = text.split(" ");
    const lines: string[] = [];
    let cur = "";
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (!cur) {
        cur = w;
        continue;
      }
      const test = cur + " " + w;
      if (mctx.measureText(test).width <= maxW) {
        cur = test;
      } else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  };

  // Font presets: 'large' is default for crisp, easily readable receipts on 203 DPI 58mm heads
  const cfg = {
    normal: {
      title: "bold 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      titleLineH: 30,
      sub: "bold 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      subLineH: 22,
      meta: "bold 18px 'Courier New', Consolas, monospace",
      metaLineH: 24,
      tableHead: "bold 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      tableHeadLineH: 24,
      itemName: "bold 19px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      itemNameLineH: 25,
      itemCalc: "bold 18px 'Courier New', Consolas, monospace",
      itemCalcLineH: 24,
      totals: "bold 18px 'Courier New', Consolas, monospace",
      totalsLineH: 24,
      netTotalLabel: "bold 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      netTotalVal: "bold 28px 'Courier New', Consolas, monospace",
      netTotalLineH: 34,
      box: "bold 18px 'Courier New', Consolas, monospace",
      boxH: 80,
      footer: "bold 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      footerLineH: 22,
      footerSub: "bold 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      footerSubLineH: 19,
    },
    large: {
      title: "bold 28px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      titleLineH: 35,
      sub: "bold 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      subLineH: 25,
      meta: "bold 20px 'Courier New', Consolas, monospace",
      metaLineH: 26,
      tableHead: "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      tableHeadLineH: 26,
      itemName: "bold 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      itemNameLineH: 28,
      itemCalc: "bold 20px 'Courier New', Consolas, monospace",
      itemCalcLineH: 26,
      totals: "bold 20px 'Courier New', Consolas, monospace",
      totalsLineH: 26,
      netTotalLabel: "bold 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      netTotalVal: "bold 32px 'Courier New', Consolas, monospace",
      netTotalLineH: 38,
      box: "bold 20px 'Courier New', Consolas, monospace",
      boxH: 88,
      footer: "bold 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      footerLineH: 24,
      footerSub: "bold 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      footerSubLineH: 20,
    },
    xlarge: {
      title: "bold 32px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      titleLineH: 38,
      sub: "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      subLineH: 27,
      meta: "bold 22px 'Courier New', Consolas, monospace",
      metaLineH: 28,
      tableHead: "bold 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      tableHeadLineH: 28,
      itemName: "bold 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      itemNameLineH: 30,
      itemCalc: "bold 22px 'Courier New', Consolas, monospace",
      itemCalcLineH: 28,
      totals: "bold 22px 'Courier New', Consolas, monospace",
      totalsLineH: 28,
      netTotalLabel: "bold 26px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      netTotalVal: "bold 36px 'Courier New', Consolas, monospace",
      netTotalLineH: 42,
      box: "bold 22px 'Courier New', Consolas, monospace",
      boxH: 96,
      footer: "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      footerLineH: 26,
      footerSub: "bold 17px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      footerSubLineH: 22,
    },
  }[fontSizeMode];

  const nameLines = wrap(header.businessName || "Sheikh Pharma", cfg.title, contentWidth);
  const addrLines = header.businessAddress ? wrap(header.businessAddress, cfg.sub, contentWidth) : [];
  const phoneLines = header.businessMobile ? wrap(`Phone: ${header.businessMobile}`, cfg.sub, contentWidth) : [];

  const itemLineRows: { nameLines: string[]; qtyRate: string; total: string }[] = [];
  for (const l of sale.lines) {
    const iNameLines = wrap(`${l.name}`, cfg.itemName, contentWidth);
    const qtyRate = `${l.quantity} × ${Number(l.unit_price).toFixed(2)}`;
    const total = `${Number(l.total_amount).toFixed(2)}`;
    itemLineRows.push({ nameLines: iNameLines, qtyRate, total });
  }

  // Calculate total height needed dynamically
  let totalHeight = 20; // top margin
  totalHeight += nameLines.length * cfg.titleLineH + 4;
  totalHeight += addrLines.length * cfg.subLineH;
  totalHeight += phoneLines.length * cfg.subLineH + 8;

  totalHeight += 18; // divider
  totalHeight += cfg.metaLineH * 2; // Bill No, Date
  if (sale.served_by || sale.counter_id) totalHeight += cfg.metaLineH;
  if (sale.customer_name) totalHeight += cfg.metaLineH;

  totalHeight += 18; // divider
  totalHeight += cfg.tableHeadLineH; // Table header
  totalHeight += 18; // divider

  for (const r of itemLineRows) {
    totalHeight += r.nameLines.length * cfg.itemNameLineH + cfg.itemCalcLineH + 6;
  }

  totalHeight += 18; // divider
  totalHeight += cfg.totalsLineH; // Subtotal
  if (sale.discount > 0) totalHeight += cfg.totalsLineH;
  if (sale.vat) totalHeight += cfg.totalsLineH;
  totalHeight += cfg.totalsLineH; // Total Qty
  totalHeight += 20; // solid separator
  totalHeight += cfg.netTotalLineH + 10; // Net Total

  // Payment Box
  totalHeight += cfg.boxH + 20;

  // Footer & Tear Feed
  totalHeight += cfg.footerLineH + cfg.footerSubLineH + 55;

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext("2d")!;

  // Fill crisp white background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetWidth, totalHeight);
  ctx.fillStyle = "#000000";

  let y = 26;

  // 1. Header (Centered)
  ctx.textAlign = "center";
  ctx.font = cfg.title;
  for (const nl of nameLines) {
    ctx.fillText(nl, targetWidth / 2, y);
    y += cfg.titleLineH;
  }

  ctx.font = cfg.sub;
  for (const al of addrLines) {
    ctx.fillText(al, targetWidth / 2, y);
    y += cfg.subLineH;
  }
  for (const pl of phoneLines) {
    ctx.fillText(pl, targetWidth / 2, y);
    y += cfg.subLineH;
  }

  y += 4;
  const drawDotted = (lineY: number) => {
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad, lineY);
    ctx.lineTo(targetWidth - pad, lineY);
    ctx.stroke();
    ctx.restore();
  };

  drawDotted(y);
  y += 20;

  // 2. Meta Info (Bill No, Date, etc.)
  ctx.textAlign = "left";
  ctx.font = cfg.meta;
  ctx.fillText("Bill No:", pad, y);
  ctx.textAlign = "right";
  ctx.fillText(sale.invoice_no, targetWidth - pad, y);
  y += cfg.metaLineH;

  ctx.textAlign = "left";
  ctx.fillText("Date:", pad, y);
  ctx.textAlign = "right";
  ctx.fillText(sale.date, targetWidth - pad, y);
  y += cfg.metaLineH;

  if (sale.served_by || sale.counter_id) {
    ctx.textAlign = "left";
    ctx.fillText("Cashier:", pad, y);
    ctx.textAlign = "right";
    ctx.fillText(`${sale.served_by ?? ""}${sale.counter_id ? ` (${sale.counter_id})` : ""}`, targetWidth - pad, y);
    y += cfg.metaLineH;
  }

  if (sale.customer_name) {
    ctx.textAlign = "left";
    ctx.fillText("Customer:", pad, y);
    ctx.textAlign = "right";
    ctx.fillText(sale.customer_name, targetWidth - pad, y);
    y += cfg.metaLineH;
  }

  drawDotted(y);
  y += 20;

  // 3. Table Header
  ctx.font = cfg.tableHead;
  ctx.textAlign = "left";
  ctx.fillText("Item / Qty × Rate", pad, y);
  ctx.textAlign = "right";
  ctx.fillText("Total (৳)", targetWidth - pad, y);
  y += cfg.tableHeadLineH;
  drawDotted(y);
  y += 22;

  // 4. Items List
  for (let idx = 0; idx < itemLineRows.length; idx++) {
    const row = itemLineRows[idx];
    ctx.textAlign = "left";
    ctx.font = cfg.itemName;
    for (let lIdx = 0; lIdx < row.nameLines.length; lIdx++) {
      const prefix = lIdx === 0 ? `${idx + 1}. ` : "   ";
      ctx.fillText(prefix + row.nameLines[lIdx], pad, y);
      y += cfg.itemNameLineH;
    }

    ctx.font = cfg.itemCalc;
    ctx.textAlign = "left";
    ctx.fillText(`   ${row.qtyRate}`, pad, y);
    ctx.textAlign = "right";
    ctx.fillText(row.total, targetWidth - pad, y);
    y += cfg.itemCalcLineH + 6;
  }

  drawDotted(y);
  y += 20;

  // 5. Totals
  ctx.font = cfg.totals;
  ctx.textAlign = "left";
  ctx.fillText("Subtotal:", pad, y);
  ctx.textAlign = "right";
  ctx.fillText(Number(sale.subtotal).toFixed(2), targetWidth - pad, y);
  y += cfg.totalsLineH;

  if (sale.discount > 0) {
    ctx.textAlign = "left";
    ctx.fillText("Discount:", pad, y);
    ctx.textAlign = "right";
    ctx.fillText(`-${Number(sale.discount).toFixed(2)}`, targetWidth - pad, y);
    y += cfg.totalsLineH;
  }

  if (sale.vat) {
    ctx.textAlign = "left";
    ctx.fillText("VAT:", pad, y);
    ctx.textAlign = "right";
    ctx.fillText(Number(sale.vat).toFixed(2), targetWidth - pad, y);
    y += cfg.totalsLineH;
  }

  const netQty = sale.lines.reduce((s, l) => s + Number(l.quantity || 0), 0);
  ctx.textAlign = "left";
  ctx.fillText("Total Qty:", pad, y);
  ctx.textAlign = "right";
  ctx.fillText(String(netQty), targetWidth - pad, y);
  y += cfg.totalsLineH;

  // Solid line
  ctx.save();
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(targetWidth - pad, y);
  ctx.stroke();
  ctx.restore();
  y += 24;

  // Net Total
  ctx.textAlign = "left";
  ctx.font = cfg.netTotalLabel;
  ctx.fillText("Net Total:", pad, y);
  ctx.textAlign = "right";
  ctx.font = cfg.netTotalVal;
  ctx.fillText(`৳${Number(sale.total).toFixed(2)}`, targetWidth - pad, y);
  y += cfg.netTotalLineH;

  // 6. Payment Box
  const boxTop = y;
  const boxHeight = cfg.boxH;
  ctx.lineWidth = 2;
  ctx.strokeRect(pad, boxTop, targetWidth - pad * 2, boxHeight);

  const payLabel = (sale.payment_method || "CASH").toUpperCase();
  const rowStep = (boxHeight - 16) / 3;
  ctx.font = cfg.box;
  ctx.textAlign = "left";
  ctx.fillText(`Paid (${payLabel})`, pad + 8, boxTop + rowStep);
  ctx.textAlign = "right";
  ctx.fillText(Number(sale.paid).toFixed(2), targetWidth - pad - 8, boxTop + rowStep);

  ctx.textAlign = "left";
  ctx.fillText("Amount Tendered", pad + 8, boxTop + rowStep * 2);
  ctx.textAlign = "right";
  ctx.fillText(Number(sale.paid).toFixed(2), targetWidth - pad - 8, boxTop + rowStep * 2);

  ctx.textAlign = "left";
  ctx.fillText(sale.change < 0 ? "Due" : "Change Due", pad + 8, boxTop + rowStep * 3);
  ctx.textAlign = "right";
  ctx.fillText(Math.abs(sale.change).toFixed(2), targetWidth - pad - 8, boxTop + rowStep * 3);
  y += boxHeight + 24;

  // 7. Footer
  ctx.textAlign = "center";
  ctx.font = cfg.footer;
  ctx.fillText("Thank You Very Much For Your Business!", targetWidth / 2, y);
  y += cfg.footerLineH;

  ctx.font = cfg.footerSub;
  ctx.fillText("Goods Sold Are Not Returnable", targetWidth / 2, y);

  return canvas;
}

export function renderDueVoucherToCanvas(
  voucher: DueVoucherData,
  targetWidth = 384,
  fontSizeMode: ReceiptFontSize = "large"
): HTMLCanvasElement {
  const pad = 8;
  const contentWidth = targetWidth - pad * 2;

  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d")!;

  const wrap = (text: string, font: string, maxW: number): string[] => {
    mctx.font = font;
    const words = text.split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (mctx.measureText(test).width <= maxW) {
        cur = test;
      } else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [""];
  };

  const cfg = {
    normal: {
      title: "bold 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      titleLineH: 26,
      sub: "bold 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      subLineH: 20,
      meta: "bold 16px 'Courier New', Consolas, monospace",
      metaLineH: 22,
      rowLabel: "bold 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      rowVal: "bold 18px 'Courier New', Consolas, monospace",
      rowLineH: 24,
      paidLabel: "bold 19px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      paidVal: "bold 24px 'Courier New', Consolas, monospace",
      paidBoxH: 70,
      footer: "bold 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      footerLineH: 22,
    },
    large: {
      title: "bold 26px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      titleLineH: 32,
      sub: "bold 17px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      subLineH: 23,
      meta: "bold 18px 'Courier New', Consolas, monospace",
      metaLineH: 24,
      rowLabel: "bold 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      rowVal: "bold 20px 'Courier New', Consolas, monospace",
      rowLineH: 27,
      paidLabel: "bold 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      paidVal: "bold 28px 'Courier New', Consolas, monospace",
      paidBoxH: 82,
      footer: "bold 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      footerLineH: 24,
    },
    xlarge: {
      title: "bold 30px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      titleLineH: 36,
      sub: "bold 19px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      subLineH: 25,
      meta: "bold 20px 'Courier New', Consolas, monospace",
      metaLineH: 26,
      rowLabel: "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      rowVal: "bold 22px 'Courier New', Consolas, monospace",
      rowLineH: 30,
      paidLabel: "bold 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      paidVal: "bold 32px 'Courier New', Consolas, monospace",
      paidBoxH: 92,
      footer: "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      footerLineH: 26,
    },
  }[fontSizeMode];

  const bizName = voucher.business?.name || "Sheikh Pharma";
  const bizAddr = voucher.business?.address || "";
  const bizPhone = voucher.business?.notify_phone || "";

  const nameLines = wrap(bizName, cfg.title, contentWidth);
  const addrLines = bizAddr ? wrap(bizAddr, cfg.sub, contentWidth) : [];
  const phoneLines = bizPhone ? wrap(`Phone: ${bizPhone}`, cfg.sub, contentWidth) : [];

  let totalHeight = 20;
  totalHeight += nameLines.length * cfg.titleLineH + 4;
  totalHeight += addrLines.length * cfg.subLineH;
  totalHeight += phoneLines.length * cfg.subLineH + 8;
  totalHeight += 40; // Title banner
  totalHeight += 18; // divider
  totalHeight += cfg.metaLineH * 4; // VoucherNo, Date, InvoiceNo, Customer
  if (voucher.customerMobile) totalHeight += cfg.metaLineH;
  if (voucher.customerAddress) totalHeight += cfg.metaLineH;
  totalHeight += 18; // divider
  totalHeight += cfg.rowLineH * 3; // totalBill, previouslyPaid, prevDue
  totalHeight += cfg.paidBoxH + 15; // amountPaidNow box
  totalHeight += cfg.rowLineH + 10; // remainingDue
  if (voucher.note) totalHeight += cfg.metaLineH * 1.5;
  totalHeight += 50; // signature lines
  totalHeight += cfg.footerLineH + 55; // footer & tear margin

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = Math.ceil(totalHeight);
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetWidth, canvas.height);
  ctx.fillStyle = "#000000";
  ctx.strokeStyle = "#000000";

  let y = 16;
  const centerX = targetWidth / 2;

  // Header
  ctx.textAlign = "center";
  ctx.font = cfg.title;
  for (const l of nameLines) {
    ctx.fillText(l, centerX, y + cfg.titleLineH * 0.75);
    y += cfg.titleLineH;
  }
  ctx.font = cfg.sub;
  for (const l of addrLines) {
    ctx.fillText(l, centerX, y + cfg.subLineH * 0.75);
    y += cfg.subLineH;
  }
  for (const l of phoneLines) {
    ctx.fillText(l, centerX, y + cfg.subLineH * 0.75);
    y += cfg.subLineH;
  }

  y += 6;

  // Title Box
  const bannerH = 28;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(pad + 10, y, contentWidth - 20, bannerH);
  ctx.font = cfg.sub;
  ctx.fillText("বকেয়া আদায় রশিদ / Due Voucher", centerX, y + bannerH * 0.68);
  y += bannerH + 12;

  // Dashed divider
  const drawDashed = (currY: number) => {
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(pad, currY);
    ctx.lineTo(targetWidth - pad, currY);
    ctx.stroke();
    ctx.restore();
  };

  drawDashed(y);
  y += 14;

  // Meta rows
  ctx.textAlign = "left";
  ctx.font = cfg.meta;
  const drawMetaRow = (left: string, right: string) => {
    ctx.textAlign = "left";
    ctx.fillText(left, pad, y + cfg.metaLineH * 0.75);
    ctx.textAlign = "right";
    ctx.fillText(right, targetWidth - pad, y + cfg.metaLineH * 0.75);
    y += cfg.metaLineH;
  };

  drawMetaRow("রশিদ নং:", voucher.voucherNo);
  drawMetaRow("তারিখ:", voucher.date);
  drawMetaRow("মূল চালান:", voucher.invoiceNo);
  drawMetaRow("মাধ্যম:", (voucher.paymentMethod || "CASH").toUpperCase());
  drawMetaRow("গ্রাহক:", voucher.customerName || "Walk-in");
  if (voucher.customerMobile) {
    drawMetaRow("মোবাইল:", voucher.customerMobile);
  }

  y += 6;
  drawDashed(y);
  y += 14;

  const money = (n: number) => `Tk ${(Number(n) || 0).toFixed(2)}`;

  // Table rows
  ctx.font = cfg.rowLabel;
  const drawBillRow = (label: string, val: string, isBold = false) => {
    ctx.textAlign = "left";
    ctx.font = isBold ? cfg.rowLabel : cfg.meta;
    ctx.fillText(label, pad, y + cfg.rowLineH * 0.75);
    ctx.textAlign = "right";
    ctx.font = cfg.rowVal;
    ctx.fillText(val, targetWidth - pad, y + cfg.rowLineH * 0.75);
    y += cfg.rowLineH;
  };

  drawBillRow("মূল চালানের মোট বিল:", money(voucher.totalBill));
  drawBillRow("পূর্বে পরিশোধিত টাকা:", money(voucher.previouslyPaid));
  const prevDue = Math.max(0, voucher.totalBill - voucher.previouslyPaid);
  drawBillRow("আজকের পূর্বের বকেয়া:", money(prevDue));

  y += 8;

  // Paid Now Box
  const boxTop = y;
  const boxH = cfg.paidBoxH;
  ctx.lineWidth = 2;
  ctx.strokeRect(pad, boxTop, contentWidth, boxH);
  ctx.textAlign = "center";
  ctx.font = cfg.paidLabel;
  ctx.fillText("আজকে আদায়কৃত টাকা:", centerX, boxTop + boxH * 0.38);
  ctx.font = cfg.paidVal;
  ctx.fillText(money(voucher.amountPaidNow), centerX, boxTop + boxH * 0.82);
  y += boxH + 14;

  // Remaining Due line
  ctx.textAlign = "left";
  ctx.font = cfg.rowLabel;
  const remDueLabel = voucher.remainingDue > 0 ? "বর্তমান অবশিষ্ট বকেয়া:" : "পরিশোধ স্ট্যাটাস:";
  const remDueVal = voucher.remainingDue > 0 ? money(voucher.remainingDue) : "পরিশোধিত (Cleared)";
  ctx.fillText(remDueLabel, pad, y + cfg.rowLineH * 0.75);
  ctx.textAlign = "right";
  ctx.font = cfg.paidLabel;
  ctx.fillText(remDueVal, targetWidth - pad, y + cfg.rowLineH * 0.75);
  y += cfg.rowLineH + 8;

  drawDashed(y);
  y += 18;

  // Signatures
  const sigW = (contentWidth - 20) / 2;
  drawDashed(y + 20); // signature line placeholder
  ctx.textAlign = "center";
  ctx.font = cfg.footer;
  ctx.fillText("গ্রাহকের স্বাক্ষর", pad + sigW / 2, y + 22);
  ctx.fillText("আদায়কারীর স্বাক্ষর", targetWidth - pad - sigW / 2, y + 22);
  y += 42;

  // Footer
  ctx.font = cfg.footer;
  ctx.textAlign = "center";
  ctx.fillText("শেখ ফার্মার সাথে থাকার জন্য ধন্যবাদ!", centerX, y + cfg.footerLineH * 0.75);

  return canvas;
}

class ThermalPrinterManager {
  private bleDevice: any = null;
  private bleCharacteristic: any = null;
  private serialPort: any = null;
  private serialWriter: any = null;
  private currentPrinter: ConnectedPrinterInfo | null = null;
  private activeDriver: PrinterDriverType = "escpos";
  private listeners: Set<(info: ConnectedPrinterInfo | null) => void> = new Set();

  constructor() {
    try {
      const savedDriver = (typeof localStorage !== "undefined" && localStorage.getItem("pos_printer_driver")) as PrinterDriverType;
      if (savedDriver === "cat_printer" || savedDriver === "escpos") {
        this.activeDriver = savedDriver;
      }
    } catch (_) {}
    this.restoreLastPrinter();
  }

  public subscribe(listener: (info: ConnectedPrinterInfo | null) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentPrinter);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const l of this.listeners) {
      l(this.currentPrinter);
    }
  }

  public getConnectedPrinter(): ConnectedPrinterInfo | null {
    return this.currentPrinter;
  }

  public getActiveDriver(): PrinterDriverType {
    return this.activeDriver;
  }

  public setActiveDriver(driver: PrinterDriverType) {
    this.activeDriver = driver;
    try {
      localStorage.setItem("pos_printer_driver", driver);
      if (this.currentPrinter) {
        this.currentPrinter = { ...this.currentPrinter, driver };
        localStorage.setItem("last_pos_thermal_printer", JSON.stringify(this.currentPrinter));
      }
    } catch (_) {}
    this.notify();
  }

  public isConnected(): boolean {
    return Boolean(this.bleCharacteristic || this.serialWriter);
  }

  private restoreLastPrinter() {
    try {
      const saved = localStorage.getItem("last_pos_thermal_printer");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.driver) {
          this.activeDriver = parsed.driver;
        }
        this.currentPrinter = { ...parsed, driver: this.activeDriver, connectedAt: Date.now() };
      }
    } catch (_) {}
  }

  /**
   * Connect via Web Bluetooth (BLE GATT)
   */
  public async connectBluetooth(): Promise<ConnectedPrinterInfo> {
    if (typeof window === "undefined" || !(navigator as any).bluetooth) {
      throw new Error(
        "আপনার ব্রাউজারে Web Bluetooth API সাপোর্ট নেই। অনুগ্রহ করে Google Chrome বা Microsoft Edge ব্যবহার করুন।"
      );
    }

    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: KNOWN_PRINTER_SERVICES,
      });

      if (!device) throw new Error("কোনো ডিভাইস সিলেক্ট করা হয়নি");

      const server = await device.gatt?.connect();
      if (!server) throw new Error("ব্লুটুথ কানেকশন পাওয়া যায়নি");

      let writeChar: any = null;

      for (const serviceUuid of KNOWN_PRINTER_SERVICES) {
        try {
          const service = await server.getPrimaryService(serviceUuid);
          const chars = await service.getCharacteristics();
          for (const c of chars) {
            if (c.properties.write || c.properties.writeWithoutResponse) {
              writeChar = c;
              break;
            }
          }
        } catch (_) {}
        if (writeChar) break;
      }

      if (!writeChar) {
        try {
          const services = await server.getPrimaryServices();
          for (const service of services) {
            try {
              const chars = await service.getCharacteristics();
              for (const c of chars) {
                if (c.properties.write || c.properties.writeWithoutResponse) {
                  writeChar = c;
                  break;
                }
              }
            } catch (_) {}
            if (writeChar) break;
          }
        } catch (_) {}
      }

      if (!writeChar) {
        throw new Error(
          `ডিভাইসে রাইট করার জন্য কোনো ক্যারেক্টারিস্টিক পাওয়া যায়নি। অনুগ্রহ করে প্রিন্টারের সাথে Windows Bluetooth পেয়ার করে "Bluetooth COM" মেথড ব্যবহার করুন।`
        );
      }

      this.bleDevice = device;
      this.bleCharacteristic = writeChar;
      this.disconnectSerial();

      // Auto-detect printer model
      const devName = (device.name || "").toLowerCase();
      const isCat = /mx04|mx05|mx06|gt01|gb01|gb02|gb03|cat|walkprint|iprint|funprint|tiny/i.test(devName);
      const isPt220 = /pt-220|mtp|pos-58|rpp|xprinter/i.test(devName);

      if (isCat) {
        this.activeDriver = "cat_printer";
      } else if (isPt220) {
        this.activeDriver = "escpos";
      }
      try {
        localStorage.setItem("pos_printer_driver", this.activeDriver);
      } catch (_) {}

      const info: ConnectedPrinterInfo = {
        name: device.name || (this.activeDriver === "cat_printer" ? "MX04 Cat Printer" : "PT-220 Thermal Printer"),
        type: "bluetooth",
        driver: this.activeDriver,
        id: device.id,
        connectedAt: Date.now(),
      };

      this.currentPrinter = info;
      localStorage.setItem("last_pos_thermal_printer", JSON.stringify(info));
      this.notify();

      device.addEventListener("gattserverdisconnected", () => {
        this.bleDevice = null;
        this.bleCharacteristic = null;
        this.currentPrinter = null;
        this.notify();
      });

      return info;
    } catch (err: any) {
      this.bleDevice = null;
      this.bleCharacteristic = null;
      this.currentPrinter = null;
      this.notify();
      throw err;
    }
  }

  /**
   * Connect via Web Serial API (Windows Bluetooth Virtual COM / USB)
   * Baudrate: 115200 (Matches PT-220 self-test)
   */
  public async connectSerial(baudRate = 115200): Promise<ConnectedPrinterInfo> {
    if (typeof window === "undefined" || !(navigator as any).serial) {
      throw new Error(
        "আপনার ব্রাউজারে Web Serial API সাপোর্ট নেই। অনুগ্রহ করে Google Chrome বা Microsoft Edge ব্যবহার করুন।"
      );
    }

    try {
      const port = await (navigator as any).serial.requestPort();
      if (!port) throw new Error("কোনো সিরিয়াল পোর্ট সিলেক্ট করা হয়নি");

      await port.open({ baudRate });
      const writer = port.writable.getWriter();

      this.serialPort = port;
      this.serialWriter = writer;
      this.disconnectBle();

      const info: ConnectedPrinterInfo = {
        name: "PT-220 (Bluetooth Serial COM)",
        type: "serial",
        connectedAt: Date.now(),
      };

      this.currentPrinter = info;
      localStorage.setItem("last_pos_thermal_printer", JSON.stringify(info));
      this.notify();

      return info;
    } catch (err: any) {
      this.serialPort = null;
      this.serialWriter = null;
      this.currentPrinter = null;
      this.notify();
      throw err;
    }
  }

  public async disconnect() {
    this.disconnectBle();
    this.disconnectSerial();
    this.currentPrinter = null;
    localStorage.removeItem("last_pos_thermal_printer");
    this.notify();
  }

  private disconnectBle() {
    try {
      if (this.bleDevice?.gatt?.connected) {
        this.bleDevice.gatt.disconnect();
      }
    } catch (_) {}
    this.bleDevice = null;
    this.bleCharacteristic = null;
  }

  private async disconnectSerial() {
    try {
      if (this.serialWriter) {
        this.serialWriter.releaseLock();
      }
      if (this.serialPort) {
        await this.serialPort.close();
      }
    } catch (_) {}
    this.serialPort = null;
    this.serialWriter = null;
  }

  /**
   * Send raw binary data chunks to the printer
   */
  public async writeRaw(data: Uint8Array, chunkSize = 100, delayMs = 15): Promise<void> {
    if (this.serialWriter) {
      await this.serialWriter.write(data);
      return;
    }

    if (this.bleCharacteristic) {
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        try {
          if (this.bleCharacteristic.writeValueWithResponse) {
            await this.bleCharacteristic.writeValueWithResponse(chunk);
          } else {
            await this.bleCharacteristic.writeValue(chunk);
          }
        } catch (_) {
          await this.bleCharacteristic.writeValue(chunk);
        }
        if (delayMs > 0) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
      return;
    }

    throw new Error("প্রিন্টার সংযুক্ত নেই। প্রথমে 'Connect Printer' এ ক্লিক করুন।");
  }

  /**
   * Direct, robust receipt printing using native 2D Canvas (No HTML/CSS parser, immune to oklch bugs)
   */
  /**
   * Print any arbitrary 2D canvas directly to the thermal printer
   * Automatically branches between PT-220 (ESC/POS) and MX04 (Cat Printer BLE Protocol)
   */
  public async printCanvasDirect(
    canvas: HTMLCanvasElement,
    targetWidthDots = 384
  ): Promise<void> {
    if (this.activeDriver === "cat_printer") {
      await this.printCanvasCat(canvas);
    } else {
      const escPosBytes = this.canvasToEscPosRaster(canvas, targetWidthDots);
      await this.writeRaw(escPosBytes);
    }
  }

  /**
   * Print 384px canvas to MX04 Cat Printer using 0x5178 protocol frames
   */
  public async printCanvasCat(canvas: HTMLCanvasElement): Promise<void> {
    const packets = canvasToCatPrinterPackets(canvas);
    for (const packet of packets) {
      await this.writeRaw(packet, 64, 8);
    }
  }

  /**
   * Direct, robust receipt printing using native 2D Canvas (No HTML/CSS parser, immune to oklch bugs)
   * Supports 'normal', 'large', and 'xlarge' font sizes
   */
  public async printReceiptDirect(
    sale: ReceiptSale,
    header: ReceiptHeader,
    targetWidthDots = 384,
    fontSizeMode: ReceiptFontSize = "large"
  ): Promise<void> {
    const canvas = renderReceiptToCanvas(sale, header, targetWidthDots, fontSizeMode);
    await this.printCanvasDirect(canvas, targetWidthDots);
  }

  /**
   * Direct Due Voucher printing using native 2D Canvas
   */
  public async printDueVoucherDirect(
    voucher: DueVoucherData,
    targetWidthDots = 384,
    fontSizeMode: ReceiptFontSize = "large"
  ): Promise<void> {
    const canvas = renderDueVoucherToCanvas(voucher, targetWidthDots, fontSizeMode);
    await this.printCanvasDirect(canvas, targetWidthDots);
  }

  /**
   * Hardware ESC/POS Direct Text Mode for Due Voucher
   */
  public async printDueVoucherEscPosText(
    voucher: DueVoucherData,
    cols = 32
  ): Promise<void> {
    if (this.activeDriver === "cat_printer") {
      await this.printDueVoucherDirect(voucher, 384);
      return;
    }
    const encoder = new TextEncoder();
    const parts: Uint8Array[] = [];

    const text = (str: string) => parts.push(encoder.encode(str));
    const raw = (...bytes: number[]) => parts.push(new Uint8Array(bytes));

    // ESC @: Init
    raw(0x1b, 0x40);

    // ESC a 1: Center
    raw(0x1b, 0x61, 0x01);

    // GS ! 0x11: Double Width + Double Height
    raw(0x1d, 0x21, 0x11);
    text(`${voucher.business?.name || "Sheikh Pharma"}\n`);

    // GS ! 0x00: Normal
    raw(0x1d, 0x21, 0x00);
    if (voucher.business?.address) text(`${voucher.business.address}\n`);
    if (voucher.business?.notify_phone) text(`Phone: ${voucher.business.notify_phone}\n`);

    text("=".repeat(cols) + "\n");
    raw(0x1b, 0x45, 0x01); // Bold
    text("DUE COLLECTION VOUCHER\n");
    raw(0x1b, 0x45, 0x00);
    text("=".repeat(cols) + "\n");

    raw(0x1b, 0x61, 0x00); // Left
    const row2 = (left: string, right: string) => {
      const space = cols - left.length - right.length;
      if (space >= 1) {
        text(left + " ".repeat(space) + right + "\n");
      } else {
        text(left + "\n" + right.padStart(cols) + "\n");
      }
    };

    row2("Voucher No:", voucher.voucherNo);
    row2("Date:", voucher.date);
    row2("Original Inv:", voucher.invoiceNo);
    row2("Method:", (voucher.paymentMethod || "CASH").toUpperCase());
    row2("Customer:", voucher.customerName || "Walk-in");
    if (voucher.customerMobile) row2("Mobile:", voucher.customerMobile);

    text("-".repeat(cols) + "\n");
    row2("Total Bill:", `Tk ${Number(voucher.totalBill).toFixed(2)}`);
    row2("Previously Paid:", `Tk ${Number(voucher.previouslyPaid).toFixed(2)}`);
    const prevDue = Math.max(0, voucher.totalBill - voucher.previouslyPaid);
    row2("Previous Due:", `Tk ${Number(prevDue).toFixed(2)}`);
    text("=".repeat(cols) + "\n");

    // Paid Now (Double Height + Bold)
    raw(0x1d, 0x21, 0x01);
    raw(0x1b, 0x45, 0x01);
    row2("COLLECTED NOW:", `Tk ${Number(voucher.amountPaidNow).toFixed(2)}`);
    raw(0x1b, 0x45, 0x00);
    raw(0x1d, 0x21, 0x00);

    text("-".repeat(cols) + "\n");
    row2("Remaining Due:", voucher.remainingDue > 0 ? `Tk ${Number(voucher.remainingDue).toFixed(2)}` : "CLEARED");
    text("=".repeat(cols) + "\n\n");

    // Signatures
    row2("Customer Sign", "Cashier Sign");
    text("\n");
    raw(0x1b, 0x61, 0x01);
    text("Thank you for your business!\n\n\n\n");

    const totalLen = parts.reduce((acc, p) => acc + p.length, 0);
    const combined = new Uint8Array(totalLen);
    let offset = 0;
    for (const p of parts) {
      combined.set(p, offset);
      offset += p.length;
    }

    await this.writeRaw(combined);
  }

  /**
   * Hardware ESC/POS Direct Text Mode
   * Prints instantly using printer ROM fonts (Ultra-crisp, native hardware density)
   */
  public async printReceiptEscPosText(
    sale: ReceiptSale,
    header: ReceiptHeader,
    cols = 32
  ): Promise<void> {
    if (this.activeDriver === "cat_printer") {
      await this.printReceiptDirect(sale, header, 384);
      return;
    }
    const encoder = new TextEncoder();
    const parts: Uint8Array[] = [];

    const text = (str: string) => parts.push(encoder.encode(str));
    const raw = (...bytes: number[]) => parts.push(new Uint8Array(bytes));

    // ESC @: Init
    raw(0x1b, 0x40);

    // ESC a 1: Center
    raw(0x1b, 0x61, 0x01);

    // GS ! 0x11: Double Width + Double Height
    raw(0x1d, 0x21, 0x11);
    text(`${header.businessName || "Sheikh Pharma"}\n`);

    // GS ! 0x00: Normal
    raw(0x1d, 0x21, 0x00);
    if (header.businessAddress) text(`${header.businessAddress}\n`);
    if (header.businessMobile) text(`Phone: ${header.businessMobile}\n`);

    text("-".repeat(cols) + "\n");

    // ESC a 0: Left
    raw(0x1b, 0x61, 0x00);

    const row2 = (left: string, right: string) => {
      const space = cols - left.length - right.length;
      if (space >= 1) {
        text(left + " ".repeat(space) + right + "\n");
      } else {
        text(left + "\n" + right.padStart(cols) + "\n");
      }
    };

    row2("Bill No:", sale.invoice_no);
    row2("Date:", sale.date);
    if (sale.served_by || sale.counter_id) {
      row2("Cashier:", `${sale.served_by || ""}${sale.counter_id ? ` (${sale.counter_id})` : ""}`);
    }
    if (sale.customer_name) {
      row2("Customer:", sale.customer_name);
    }

    text("-".repeat(cols) + "\n");
    row2("Item / Qty x Rate", "Total");
    text("-".repeat(cols) + "\n");

    for (let i = 0; i < sale.lines.length; i++) {
      const item = sale.lines[i];
      text(`${i + 1}. ${item.name}\n`);
      const qtyRate = `   ${item.quantity} x ${Number(item.unit_price).toFixed(2)}`;
      const lineTot = Number(item.total_amount).toFixed(2);
      row2(qtyRate, lineTot);
    }

    text("-".repeat(cols) + "\n");
    row2("Subtotal:", Number(sale.subtotal).toFixed(2));
    if (sale.discount > 0) {
      row2("Discount:", `-${Number(sale.discount).toFixed(2)}`);
    }
    if (sale.vat) {
      row2("VAT:", Number(sale.vat).toFixed(2));
    }
    const netQty = sale.lines.reduce((s, l) => s + Number(l.quantity || 0), 0);
    row2("Total Qty:", String(netQty));

    text("=".repeat(cols) + "\n");

    // Net Total (Double Height)
    raw(0x1d, 0x21, 0x01);
    raw(0x1b, 0x45, 0x01); // Bold
    row2("NET TOTAL:", `Tk ${Number(sale.total).toFixed(2)}`);
    raw(0x1b, 0x45, 0x00);
    raw(0x1d, 0x21, 0x00);

    text("-".repeat(cols) + "\n");

    const payLabel = (sale.payment_method || "CASH").toUpperCase();
    row2(`Paid (${payLabel}):`, Number(sale.paid).toFixed(2));
    row2("Amount Tendered:", Number(sale.paid).toFixed(2));
    row2(sale.change < 0 ? "Due:" : "Change Due:", Math.abs(sale.change).toFixed(2));

    text("=".repeat(cols) + "\n");

    // Footer (Center)
    raw(0x1b, 0x61, 0x01);
    raw(0x1b, 0x45, 0x01);
    text("Thank You Very Much!\n");
    raw(0x1b, 0x45, 0x00);
    text("Goods Sold Are Not Returnable\n\n\n\n");

    const totalLen = parts.reduce((acc, p) => acc + p.length, 0);
    const combined = new Uint8Array(totalLen);
    let offset = 0;
    for (const p of parts) {
      combined.set(p, offset);
      offset += p.length;
    }

    await this.writeRaw(combined);
  }

  /**
   * Fallback DOM element rasterizer using html-to-image (does not throw oklch errors)
   */
  public async printElementAsBitmap(
    element: HTMLElement,
    targetWidthDots = 384
  ): Promise<void> {
    const { toCanvas } = await import("html-to-image");
    const canvas = await toCanvas(element, {
      backgroundColor: "#ffffff",
      pixelRatio: 1,
      skipFonts: true,
    });
    const escPosBytes = this.canvasToEscPosRaster(canvas, targetWidthDots);
    await this.writeRaw(escPosBytes);
  }

  /**
   * Converts a canvas into ESC/POS GS v 0 raster bit image commands
   * Uses luminance threshold 195 for rich, dark, solid thermal strokes
   */
  private canvasToEscPosRaster(canvas: HTMLCanvasElement, targetWidth = 384): Uint8Array {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get canvas context");

    const width = targetWidth;
    const height = canvas.height;
    const imgData = ctx.getImageData(0, 0, width, height);
    const pixels = imgData.data;

    const bytesPerRow = Math.ceil(width / 8); // 384 / 8 = 48 bytes
    const commands: number[] = [];

    // Initialize printer (ESC @)
    commands.push(0x1b, 0x40);

    // Center alignment
    commands.push(0x1b, 0x61, 0x01);

    // Slice image into vertical blocks (64 rows per slice) to prevent buffer overflows
    const sliceHeight = 64;
    for (let y = 0; y < height; y += sliceHeight) {
      const currentSlice = Math.min(sliceHeight, height - y);
      const xL = bytesPerRow % 256;
      const xH = Math.floor(bytesPerRow / 256);
      const yL = currentSlice % 256;
      const yH = Math.floor(currentSlice / 256);

      // GS v 0 0 xL xH yL yH
      commands.push(0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH);

      for (let row = 0; row < currentSlice; row++) {
        const actualY = y + row;
        for (let col = 0; col < bytesPerRow; col++) {
          let byte = 0;
          for (let bit = 0; bit < 8; bit++) {
            const px = col * 8 + bit;
            if (px < width) {
              const idx = (actualY * width + px) * 4;
              const r = pixels[idx];
              const g = pixels[idx + 1];
              const b = pixels[idx + 2];
              const a = pixels[idx + 3];

              // Luminance < 195 gives richer, thicker, bolder thermal head burn
              const luminance = a < 128 ? 255 : 0.299 * r + 0.587 * g + 0.114 * b;
              if (luminance < 195) {
                byte |= 1 << (7 - bit);
              }
            }
          }
          commands.push(byte);
        }
      }
    }

    // Feed lines so receipt clears the tear cutter
    commands.push(0x0a, 0x0a, 0x0a, 0x0a);

    return new Uint8Array(commands);
  }

  /**
   * Print a test slip to verify Bluetooth communication instantly (Supports both PT-220 & Cat Printer)
   */
  public async printTestSlip(businessName = "শেখ ফার্মা (Sheikh Pharma)") {
    if (this.activeDriver === "cat_printer") {
      const canvas = renderCatTestSlipCanvas(businessName);
      await this.printCanvasCat(canvas);
      return;
    }

    const encoder = new TextEncoder();
    const parts: Uint8Array[] = [];

    // ESC @ - Init
    parts.push(new Uint8Array([0x1b, 0x40]));

    // ESC a 1 - Center
    parts.push(new Uint8Array([0x1b, 0x61, 0x01]));

    // GS ! 17 - Double height + width
    parts.push(new Uint8Array([0x1d, 0x21, 0x11]));
    parts.push(encoder.encode("SHEIKH PHARMA\n"));

    // GS ! 0 - Normal size
    parts.push(new Uint8Array([0x1d, 0x21, 0x00]));
    parts.push(encoder.encode("58mm Bluetooth Thermal\n"));
    parts.push(encoder.encode("================================\n"));

    // ESC a 0 - Left
    parts.push(new Uint8Array([0x1b, 0x61, 0x00]));
    parts.push(encoder.encode("Model: PT-220_73D4 (58mm)\n"));
    parts.push(encoder.encode("Interface: Bluetooth & USB\n"));
    parts.push(encoder.encode("Baudrate: 115200 (ESC/POS)\n"));
    parts.push(encoder.encode("PIN: 0000\n"));
    parts.push(encoder.encode(`Time: ${new Date().toLocaleTimeString()}\n`));
    parts.push(encoder.encode("--------------------------------\n"));

    // ESC a 1 - Center
    parts.push(new Uint8Array([0x1b, 0x61, 0x01]));
    parts.push(new Uint8Array([0x1b, 0x45, 0x01])); // Bold on
    parts.push(encoder.encode("WIRELESS PRINTING OK!\n"));
    parts.push(new Uint8Array([0x1b, 0x45, 0x00])); // Bold off
    parts.push(encoder.encode("Driverless Web Bluetooth Ready\n"));
    parts.push(encoder.encode("================================\n\n\n\n"));

    const totalLen = parts.reduce((acc, p) => acc + p.length, 0);
    const combined = new Uint8Array(totalLen);
    let offset = 0;
    for (const p of parts) {
      combined.set(p, offset);
      offset += p.length;
    }

    await this.writeRaw(combined);
  }
}

export const thermalPrinter = new ThermalPrinterManager();
