// Printable lab report: test name as headline, analyte rows below
// (parameter, result, unit, reference range, method).
// Sizes: A4 / 80mm / 58mm.
import { showPrintPreview } from "@/lib/print-preview";
import type { PrintSize } from "@/components/print-size-select";

const esc = (s: any) =>
  String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
const nl = (s: any) => esc(s).replace(/\n/g, "<br>");

export type LabReportRow = {
  name: string;
  result?: string;
  unit?: string;
  ref?: string;
  method?: string;
};

export type LabReportData = {
  clinicName?: string | null;
  address?: string | null;
  phone?: string | null;
  testName: string;
  department?: string | null;
  specimen?: string | null;
  patientName?: string | null;
  patientCode?: string | null;
  age?: string | null;
  gender?: string | null;
  phoneNo?: string | null;
  referredBy?: string | null;
  sampleNo?: string | null;
  collectedAt?: string | null;
  reportedAt?: string | null;
  comment?: string | null;
  techName?: string | null;
  techDesignation?: string | null;
  pathologistName?: string | null;
  pathologistDesignation?: string | null;
  /** When true, leaves 1.5 inch blank space on top (A4) and hides the clinic header. */
  ownPad?: boolean;
  rows: LabReportRow[];
};


function geometry(size: PrintSize) {
  if (size === "A4") return { width: "190mm", pageSize: "A4", pageMargin: "10mm", fontSize: "12px", minHeight: "270mm" };
  if (size === "80mm") return { width: "76mm", pageSize: "80mm auto", pageMargin: "2mm", fontSize: "11px", minHeight: "240mm" };
  return { width: "54mm", pageSize: "58mm auto", pageMargin: "2mm", fontSize: "10px", minHeight: "240mm" };
}

function metaTable(rows: [string, any][]) {
  const body = rows
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
    .map(
      ([k, v]) =>
        `<tr><td style="color:#333;white-space:nowrap;padding:1px 0;">${esc(k)}</td><td style="font-weight:700;padding:1px 0 1px 6px;">${esc(v)}</td></tr>`,
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;">${body}</table>`;
}

export function printLabReport(data: LabReportData, size: PrintSize = "A4") {
  const g = geometry(size);
  const compact = size !== "A4";

  const headings = compact ? ["Test", "Result", "Ref. Range"] : ["Test", "Result", "Unit", "Ref. Range", "Method"];
  const aligns = compact ? ["left", "right", "left"] : ["left", "right", "left", "left", "left"];

  const bodyRows = data.rows
    .map((r) => {
      const cells = compact
        ? [r.name, r.result ?? "", r.ref ?? ""]
        : [r.name, r.result ?? "", r.unit ?? "", r.ref ?? "", r.method ?? ""];
      return `<tr>${cells
        .map(
          (c, i) =>
            `<td style="text-align:${aligns[i]};padding:3px 2px;border-bottom:1px dotted #999;vertical-align:top;${i === 1 ? "font-weight:800;" : ""}">${esc(c) || "&nbsp;"}</td>`,
        )
        .join("")}</tr>`;
    })
    .join("");

  const patientLeft = metaTable([
    ["Name", data.patientName],
    ["Patient ID", data.patientCode],
    ["Age / Sex", [data.age, data.gender].filter(Boolean).join(" / ")],
    ["Contact", data.phoneNo],
    ["Referred By", data.referredBy],
  ]);
  const patientRight = metaTable([
    ["Sample No", data.sampleNo],
    ["Collection", data.collectedAt],
    ["Report Date", data.reportedAt],
    ["Sample Type", data.specimen],
  ]);

  const header = data.ownPad
    ? `<div style="text-align:center;border-bottom:1px solid #000;padding-bottom:4px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:.6px;">LABORATORY REPORT</div>
    </div>`
    : `<div style="text-align:center;border-bottom:2px solid #000;padding-bottom:5px;">
      <div style="font-size:${compact ? "15px" : "20px"};font-weight:800;">${esc(data.clinicName ?? "Diagnostic Centre")}</div>
      ${data.address ? `<div style="font-size:10px;">${esc(data.address)}</div>` : ""}
      ${data.phone ? `<div style="font-size:10px;">Phone: ${esc(data.phone)}</div>` : ""}
      <div style="margin-top:3px;font-size:11px;font-weight:700;letter-spacing:.6px;">LABORATORY REPORT</div>
    </div>`;

  const inner = `
    ${header}

    <div style="margin-top:6px;${compact ? "" : "display:flex;gap:14px;"}">
      <div style="flex:1;">${patientLeft}</div>
      <div style="flex:1;">${patientRight}</div>
    </div>

    <div style="margin-top:8px;background:#eee;border:1px solid #000;padding:3px 5px;text-align:center;">
      <div style="font-size:${compact ? "12px" : "14px"};font-weight:800;text-transform:uppercase;">${esc(data.testName)}</div>
      ${data.department ? `<div style="font-size:9px;letter-spacing:.5px;">${esc(data.department)}</div>` : ""}
    </div>

    <table style="width:100%;border-collapse:collapse;margin-top:5px;font-size:1em;">
      <thead><tr>${headings
        .map(
          (h, i) =>
            `<th style="text-align:${aligns[i]};border-bottom:1px solid #000;padding:3px 2px;font-size:0.95em;">${esc(h)}</th>`,
        )
        .join("")}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>

    ${
      data.comment
        ? `<div style="margin-top:6px;border:1px solid #000;padding:4px;font-size:0.92em;"><b>Comment:</b> ${esc(data.comment)}</div>`
        : ""
    }

    <div style="position:absolute;left:6px;right:6px;bottom:22px;display:flex;justify-content:space-between;font-size:0.85em;">
      <div style="text-align:center;min-width:${compact ? "70px" : "140px"};">
        ${data.techName ? `<div style="font-weight:700;">${nl(data.techName)}</div>` : `<div style="height:1em;">&nbsp;</div>`}
        ${data.techDesignation ? `<div style="font-size:0.85em;">${nl(data.techDesignation)}</div>` : ""}
        <div style="border-top:1px solid #000;padding-top:2px;">Lab Technologist</div>
      </div>
      <div style="text-align:center;min-width:${compact ? "70px" : "140px"};">
        ${data.pathologistName ? `<div style="font-weight:700;">${nl(data.pathologistName)}</div>` : `<div style="height:1em;">&nbsp;</div>`}
        ${data.pathologistDesignation ? `<div style="font-size:0.85em;">${nl(data.pathologistDesignation)}</div>` : ""}
        <div style="border-top:1px solid #000;padding-top:2px;">Consultant Pathologist</div>
      </div>
    </div>
  `;

  const styleId = "lab-report-print-style";
  const pageId = "lab-report-print-page";
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
    .receipt-preview-clone.lab-doc { display:block !important; width:${g.width}; color:#000; background:#fff; font-size:${g.fontSize}; }
  `;
  document.head.appendChild(st);

  const page = document.createElement("div");
  page.id = pageId;
  page.className = "lab-doc";
  const topPad = data.ownPad && size === "A4" ? "38.1mm" : "6px";
  page.style.cssText = `font-family:ui-sans-serif,system-ui,Arial,sans-serif;color:#000;background:#fff;width:${g.width};font-size:${g.fontSize};padding:${topPad} 6px 30px;position:relative;min-height:${g.minHeight};box-sizing:border-box;`;
  page.innerHTML = `${inner}
    <div style="position:absolute;left:6px;right:6px;bottom:4px;border-top:1px dashed #000;padding-top:4px;text-align:center;font-size:9px;">
      QweekRx ${new Date().getFullYear()} · 01712472839 (Phone/WhatsApp)
    </div>`;

  document.body.appendChild(page);
  showPrintPreview({
    printPage: page,
    filename: `lab-report-${(data.patientCode || data.patientName || "patient").toString().replace(/\s+/g, "-")}`,
    cleanup: () => {
      page.remove();
      document.getElementById(styleId)?.remove();
    },
  });
}
