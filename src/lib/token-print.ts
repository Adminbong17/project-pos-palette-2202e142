// Patient token print (serial slip) for the chamber front desk.
// Sizes: 58mm / 80mm thermal rolls and "half A4" (A5) slips.
import { showPrintPreview } from "@/lib/print-preview";

export type TokenSize = "58mm" | "80mm" | "A5";

export type TokenData = {
  clinicName?: string | null;
  doctorName?: string | null;
  doctorQualification?: string | null;
  serialNo?: number | string | null;
  patientCode?: string | null;
  fee?: number | null;
  isNewPatient?: boolean;
  patientName?: string | null;
  age?: string | null;
  gender?: string | null;
  phone?: string | null;
  location?: string | null;
  date?: string | null;
  time?: string | null;
};

const esc = (s: any) =>
  String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));

export function printPatientToken(data: TokenData, size: TokenSize = "80mm") {
  const width = size === "A5" ? "148mm" : size === "80mm" ? "76mm" : "54mm";
  const pageSize = size === "A5" ? "A5" : size === "80mm" ? "80mm auto" : "58mm auto";
  const pageMargin = size === "A5" ? "8mm" : "2mm";
  const fontSize = size === "A5" ? "13px" : size === "80mm" ? "12px" : "11px";
  const serialSize = size === "A5" ? "56px" : size === "80mm" ? "44px" : "38px";

  const styleId = "token-print-style";
  document.getElementById(styleId)?.remove();
  const st = document.createElement("style");
  st.id = styleId;
  st.textContent = `
    #token-print-page { display:none; }
    @media print {
      @page { size: ${pageSize}; margin: ${pageMargin}; }
      body * { visibility: hidden !important; }
      #token-print-page, #token-print-page * { visibility: visible !important; }
      #token-print-page { display:block !important; position:absolute; left:0; top:0; width:100%; background:#fff; color:#000; }
    }
    .receipt-preview-clone.patient-token { display:block !important; width:${width}; font-family: ui-sans-serif, system-ui, Arial, sans-serif; color:#000; font-size:${fontSize}; }
    .receipt-preview-clone.patient-token table { width:100%; border-collapse:collapse; }
    .receipt-preview-clone.patient-token td { padding:2px 0; vertical-align:top; }
  `;
  document.head.appendChild(st);

  const row = (label: string, value: any) =>
    value === null || value === undefined || value === ""
      ? ""
      : `<tr><td style="width:38%;color:#333;">${esc(label)}</td><td style="font-weight:700;">${esc(value)}</td></tr>`;

  const page = document.createElement("div");
  page.id = "token-print-page";
  page.className = "patient-token";
  page.style.cssText = `font-family:ui-sans-serif,system-ui,Arial,sans-serif;color:#000;background:#fff;width:${width};font-size:${fontSize};padding:6px;`;
  page.innerHTML = `
    <div style="text-align:center;border-bottom:1px dashed #000;padding-bottom:6px;">
      ${data.clinicName ? `<div style="font-size:11px;letter-spacing:.5px;">${esc(data.clinicName)}</div>` : ""}
      <div style="font-size:${size === "A5" ? "22px" : "16px"};font-weight:800;">${esc(data.doctorName || "Doctor")}</div>
      ${data.doctorQualification ? `<div style="font-size:10px;">${esc(data.doctorQualification)}</div>` : ""}
      <div style="margin-top:4px;font-size:11px;font-weight:700;">PATIENT TOKEN</div>
    </div>
    <div style="text-align:center;padding:6px 0;border-bottom:1px dashed #000;">
      <div style="font-size:10px;letter-spacing:1px;">SERIAL NO</div>
      <div style="font-size:${serialSize};font-weight:800;line-height:1;">${esc(data.serialNo ?? "—")}</div>
      ${data.patientCode ? `<div style="margin-top:4px;font-size:12px;font-weight:700;">ID: ${esc(data.patientCode)}</div>` : ""}
    </div>
    <table style="margin-top:6px;">
      ${row("Patient", data.patientName)}
      ${row("Age", data.age)}
      ${row("Sex", data.gender)}
      ${row("Phone", data.phone)}
      ${row("Location", data.location)}
      ${row("Date", data.date)}
      ${row("Time", data.time)}
      ${row(
        data.isNewPatient === false ? "Fee (old patient)" : "Fee (new patient)",
        data.fee === null || data.fee === undefined ? "" : `৳ ${Number(data.fee).toFixed(2)}`,
      )}
    </table>
    <div style="margin-top:8px;border-top:1px dashed #000;padding-top:5px;text-align:center;font-size:9px;">
      QweekRx ${new Date().getFullYear()} · 01712472839 (Phone/WhatsApp)
    </div>
  `;

  document.body.appendChild(page);
  showPrintPreview({
    printPage: page,
    filename: `token-${data.patientCode ?? data.serialNo ?? "patient"}`,
    cleanup: () => {
      page.remove();
      document.getElementById(styleId)?.remove();
    },
  });
}
