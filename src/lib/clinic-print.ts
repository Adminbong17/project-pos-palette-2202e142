// Clinic sale invoice + treatment plan printing in A4 / 80mm / 58mm.
import { showPrintPreview } from "@/lib/print-preview";
import type { PrintSize } from "@/components/print-size-select";

const esc = (s: any) =>
  String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));

const tk = (n: any) => `${Number(n || 0).toFixed(2)}`;

export type ClinicPrintHeader = {
  businessName?: string | null;
  address?: string | null;
  phone?: string | null;
};

type Geometry = { width: string; pageSize: string; pageMargin: string; fontSize: string };

function geometry(size: PrintSize): Geometry {
  if (size === "A4") return { width: "190mm", pageSize: "A4", pageMargin: "10mm", fontSize: "13px" };
  if (size === "80mm") return { width: "76mm", pageSize: "80mm auto", pageMargin: "2mm", fontSize: "12px" };
  return { width: "54mm", pageSize: "58mm auto", pageMargin: "2mm", fontSize: "11px" };
}

function headerHtml(header: ClinicPrintHeader, title: string, big: boolean) {
  return `
    <div style="text-align:center;border-bottom:1px solid #000;padding-bottom:5px;">
      <div style="font-size:${big ? "20px" : "15px"};font-weight:800;">${esc(header.businessName ?? "Clinic")}</div>
      ${header.address ? `<div style="font-size:10px;">${esc(header.address)}</div>` : ""}
      ${header.phone ? `<div style="font-size:10px;">Phone: ${esc(header.phone)}</div>` : ""}
      <div style="margin-top:4px;font-size:11px;font-weight:700;letter-spacing:.5px;">${esc(title)}</div>
    </div>
  `;
}

function metaHtml(rows: [string, any][]) {
  const body = rows
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
    .map(
      ([k, v]) =>
        `<tr><td style="color:#333;white-space:nowrap;padding:1px 0;">${esc(k)}</td><td style="font-weight:700;padding:1px 0 1px 6px;">${esc(v)}</td></tr>`,
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;margin-top:5px;">${body}</table>`;
}

function itemsTable(
  headings: string[],
  rows: string[][],
  aligns: ("l" | "c" | "r")[],
) {
  const al = (i: number) => (aligns[i] === "r" ? "right" : aligns[i] === "c" ? "center" : "left");
  return `
    <table style="width:100%;border-collapse:collapse;margin-top:6px;font-size:1em;">
      <thead><tr>${headings
        .map((h, i) => `<th style="text-align:${al(i)};border-bottom:1px solid #000;padding:2px 1px;">${esc(h)}</th>`)
        .join("")}</tr></thead>
      <tbody>${rows
        .map(
          (r) =>
            `<tr>${r
              .map((c, i) => `<td style="text-align:${al(i)};padding:2px 1px;vertical-align:top;">${esc(c)}</td>`)
              .join("")}</tr>`,
        )
        .join("")}</tbody>
    </table>
  `;
}

function totalsHtml(rows: [string, string, boolean?][]) {
  return `<div style="margin-top:6px;border-top:1px solid #000;padding-top:3px;">${rows
    .map(
      ([k, v, bold]) =>
        `<div style="display:flex;justify-content:space-between;${bold ? "font-weight:800;font-size:1.1em;" : ""}padding:1px 0;"><span>${esc(k)}</span><span>${esc(v)}</span></div>`,
    )
    .join("")}</div>`;
}

function renderPrint(size: PrintSize, inner: string, filename: string) {
  const g = geometry(size);
  const styleId = "clinic-print-style";
  const pageId = "clinic-print-page";
  document.getElementById(styleId)?.remove();
  document.getElementById(pageId)?.remove();

  const st = document.createElement("style");
  st.id = styleId;
  st.textContent = `
    #${pageId} { display:none; }
    @media print {
      @page { size: ${g.pageSize}; margin: ${g.pageMargin}; }
      body * { visibility: hidden !important; }
      #${pageId}, #${pageId} * { visibility: visible !important; }
      #${pageId} { display:block !important; position:absolute; left:0; top:0; width:100%; background:#fff; color:#000; }
    }
    .receipt-preview-clone.clinic-doc { display:block !important; width:${g.width}; font-family: ui-sans-serif, system-ui, Arial, sans-serif; color:#000; background:#fff; font-size:${g.fontSize}; }
  `;
  document.head.appendChild(st);

  const page = document.createElement("div");
  page.id = pageId;
  page.className = "clinic-doc";
  page.style.cssText = `font-family:ui-sans-serif,system-ui,Arial,sans-serif;color:#000;background:#fff;width:${g.width};font-size:${g.fontSize};padding:6px;`;
  page.innerHTML = `${inner}
    <div style="margin-top:8px;border-top:1px dashed #000;padding-top:4px;text-align:center;font-size:9px;">
      QweekRx ${new Date().getFullYear()} · 01712472839 (Phone/WhatsApp)
    </div>`;

  document.body.appendChild(page);
  showPrintPreview({
    printPage: page,
    filename,
    cleanup: () => {
      page.remove();
      document.getElementById(styleId)?.remove();
    },
  });
}

export type ClinicSalePrintData = {
  invoice_no?: string | null;
  sale_date?: string | null;
  patient_name?: string | null;
  patient_phone?: string | null;
  ref_doctor_name?: string | null;
  notes?: string | null;
  subtotal: number;
  discount_amount: number;
  total: number;
  paid: number;
  lines: { name: string; quantity: number; unit_price: number; line_total: number }[];
};

export function printClinicSale(sale: ClinicSalePrintData, header: ClinicPrintHeader, size: PrintSize = "80mm") {
  const compact = size !== "A4";
  const due = Math.max(Number(sale.total || 0) - Number(sale.paid || 0), 0);
  const when = sale.sale_date ? new Date(sale.sale_date).toLocaleString() : "";

  const rows = sale.lines.map((l, i) =>
    compact
      ? [String(i + 1), l.name, String(l.quantity), tk(l.line_total)]
      : [String(i + 1), l.name, String(l.quantity), tk(l.unit_price), tk(l.line_total)],
  );

  const inner = `
    ${headerHtml(header, "SALE INVOICE", !compact)}
    ${metaHtml([
      ["Invoice", sale.invoice_no],
      ["Date", when],
      ["Patient", sale.patient_name],
      ["Phone", sale.patient_phone],
      ["Ref. doctor", sale.ref_doctor_name],
    ])}
    ${itemsTable(
      compact ? ["#", "Item", "Qty", "Amount"] : ["#", "Item", "Qty", "Price", "Amount"],
      rows,
      compact ? ["c", "l", "c", "r"] : ["c", "l", "c", "r", "r"],
    )}
    ${totalsHtml([
      ["Subtotal", tk(sale.subtotal)],
      ...(Number(sale.discount_amount) > 0 ? ([["Discount", tk(sale.discount_amount)]] as [string, string][]) : []),
      ["Total", tk(sale.total), true],
      ["Paid", tk(sale.paid)],
      ["Due", tk(due)],
    ])}
    ${sale.notes ? `<div style="margin-top:5px;font-size:0.9em;">Note: ${esc(sale.notes)}</div>` : ""}
  `;
  renderPrint(size, inner, `clinic-invoice-${sale.invoice_no ?? "sale"}`);
}

export type ClinicPlanPrintData = {
  patient_name: string;
  patient_code?: string | null;
  patient_phone?: string | null;
  doctor_name?: string | null;
  start_date?: string | null;
  total_amount: number;
  discount: number;
  paid: number;
  notes?: string | null;
  lines: { name: string; quantity: number; unit_price: number; line_total: number }[];
  installments: { seq: number; due_date: string; amount: number; paid_amount: number; status: string }[];
};

export function printClinicPlan(plan: ClinicPlanPrintData, header: ClinicPrintHeader, size: PrintSize = "A4") {
  const compact = size !== "A4";
  const payable = Math.max(Number(plan.total_amount || 0) - Number(plan.discount || 0), 0);
  const due = Math.max(payable - Number(plan.paid || 0), 0);

  const serviceRows = plan.lines.map((l, i) =>
    compact
      ? [String(i + 1), l.name, String(l.quantity), tk(l.line_total)]
      : [String(i + 1), l.name, String(l.quantity), tk(l.unit_price), tk(l.line_total)],
  );
  const instRows = plan.installments.map((i) => [
    String(i.seq),
    i.due_date,
    tk(i.amount),
    tk(i.paid_amount),
    i.status,
  ]);

  const inner = `
    ${headerHtml(header, "TREATMENT PLAN", !compact)}
    ${metaHtml([
      ["Patient", plan.patient_name],
      ["Patient ID", plan.patient_code],
      ["Phone", plan.patient_phone],
      ["Advised by", plan.doctor_name ? `Dr. ${plan.doctor_name}` : ""],
      ["Start date", plan.start_date],
    ])}
    ${
      serviceRows.length
        ? itemsTable(
            compact ? ["#", "Service", "Qty", "Amount"] : ["#", "Service", "Qty", "Price", "Amount"],
            serviceRows,
            compact ? ["c", "l", "c", "r"] : ["c", "l", "c", "r", "r"],
          )
        : ""
    }
    ${totalsHtml([
      ["Subtotal", tk(plan.total_amount)],
      ...(Number(plan.discount) > 0 ? ([["Discount", tk(plan.discount)]] as [string, string][]) : []),
      ["Total payable", tk(payable), true],
      ["Paid", tk(plan.paid)],
      ["Due", tk(due)],
    ])}
    <div style="margin-top:7px;font-weight:700;font-size:0.95em;">Instalment schedule</div>
    ${itemsTable(["#", "Due date", "Amount", "Paid", "Status"], instRows, ["c", "l", "r", "r", "c"])}
    ${plan.notes ? `<div style="margin-top:5px;font-size:0.9em;">Note: ${esc(plan.notes)}</div>` : ""}
  `;
  renderPrint(size, inner, `treatment-plan-${plan.patient_code ?? plan.patient_name}`);
}
