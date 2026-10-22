import html2canvas from "html2canvas";

export interface TokenJpgData {
  clinicName?: string | null;
  doctorName?: string | null;
  doctorQualification?: string | null;
  serialNo?: number | string | null;
  patientCode?: string | null;
  patientName?: string | null;
  age?: string | null;
  gender?: string | null;
  phone?: string | null;
  location?: string | null;
  date?: string | null;
  time?: string | null;
  fee?: number | null;
  patientType?: string | null;
}

const esc = (s: any) =>
  String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));

/** Download an existing DOM element as a crisp, high-resolution JPG image. */
export async function saveElementAsJpg(element: HTMLElement, filename?: string): Promise<boolean> {
  try {
    const canvas = await html2canvas(element, {
      scale: 3,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });
    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename || `sheikh-pharma-token-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (err) {
    console.error("Failed to save token image:", err);
    return false;
  }
}

/** Render a dedicated high-fidelity Token Slip off-screen and download it as JPG. */
export async function downloadTokenAsJpg(data: TokenJpgData): Promise<boolean> {
  try {
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "-9999px";
    container.style.width = "420px";
    container.style.padding = "24px";
    container.style.background = "#ffffff";
    container.style.color = "#0f172a";
    container.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
    container.style.borderRadius = "16px";
    container.style.boxShadow = "none";
    container.style.border = "2px dashed #059669";

    const docName = String(data.doctorName || "চিকিৎসক").trim();
    const docQual = String(data.doctorQualification || "").trim();
    const serial = String(data.serialNo ?? "—");
    const pCode = data.patientCode ? String(data.patientCode).trim() : "";
    const pName = String(data.patientName || "সম্মানিত রোগী").trim();
    const phone = data.phone ? String(data.phone).trim() : "";
    const loc = String(data.location || "শেখ ফার্মা চেম্বার").trim();
    const date = String(data.date || new Date().toISOString().slice(0, 10)).trim();
    const fee = data.fee != null ? (Number(data.fee) > 0 ? `৳${data.fee}` : "ফ্রি / ০৳") : "—";

    container.innerHTML = `
      <div style="text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 14px; margin-bottom: 16px;">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #059669; font-weight: 800;">
          ${esc(data.clinicName || "শেখ ফার্মা ও ডায়াগনস্টিক")}
        </div>
        <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 2px;">
          ডিজিটাল অ্যাপয়েন্টমেন্ট টোকেন
        </div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
          রোগী সেবা ও প্রেসক্রিপশন সিরিয়াল স্লিপ
        </div>
      </div>

      <!-- Large Serial Badge -->
      <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff; border-radius: 14px; padding: 14px; text-align: center; margin-bottom: 18px;">
        <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9;">
          আপনার সিরিয়াল নম্বর / Serial No
        </div>
        <div style="font-size: 42px; font-weight: 900; line-height: 1.1; margin-top: 4px; letter-spacing: -1px;">
          #${esc(serial)}
        </div>
        <div style="font-size: 12px; font-weight: 600; margin-top: 4px; opacity: 0.95;">
          তারিখ: ${esc(date)}
        </div>
      </div>

      <!-- Doctor Information (NO extra Dr. added) -->
      <div style="background: #f8fafc; border-radius: 12px; padding: 12px 14px; margin-bottom: 14px; border: 1px solid #e2e8f0;">
        <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px;">
          ডাক্তার / Specialist Doctor
        </div>
        <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 2px;">
          ${esc(docName)}
        </div>
        ${docQual ? `<div style="font-size: 12px; color: #475569; margin-top: 2px;">${esc(docQual)}</div>` : ""}
      </div>

      <!-- Patient & Appointment Details -->
      <div style="background: #ffffff; border-radius: 12px; padding: 10px 14px; border: 1px solid #e2e8f0; font-size: 13px; line-height: 1.6; margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #e2e8f0; padding-bottom: 6px; margin-bottom: 6px;">
          <span style="color: #64748b; font-weight: 600;">রোগীর নাম:</span>
          <span style="color: #0f172a; font-weight: 800;">${esc(pName)}</span>
        </div>

        ${pCode ? `
        <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #e2e8f0; padding-bottom: 6px; margin-bottom: 6px;">
          <span style="color: #64748b; font-weight: 600;">রোগীর আইডি (UID):</span>
          <span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 6px; font-family: monospace; font-weight: 700; font-size: 12px;">${esc(pCode)}</span>
        </div>` : ""}

        ${phone ? `
        <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #e2e8f0; padding-bottom: 6px; margin-bottom: 6px;">
          <span style="color: #64748b; font-weight: 600;">মোবাইল নম্বর:</span>
          <span style="color: #0f172a; font-weight: 600; font-family: monospace;">${esc(phone)}</span>
        </div>` : ""}

        <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #e2e8f0; padding-bottom: 6px; margin-bottom: 6px;">
          <span style="color: #64748b; font-weight: 600;">চেম্বার / লোকেশন:</span>
          <span style="color: #0f172a; font-weight: 700; text-align: right; max-width: 220px;">${esc(loc)}</span>
        </div>

        <div style="display: flex; justify-content: space-between; padding-top: 2px;">
          <span style="color: #64748b; font-weight: 600;">পরামর্শ ফি:</span>
          <span style="color: #059669; font-weight: 800; font-size: 14px;">${esc(fee)}</span>
        </div>
      </div>

      <!-- Footer Note -->
      <div style="text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 11px; color: #64748b;">
        <div style="font-weight: 600; color: #334155;">অনুগ্রহ করে সিরিয়াল অনুযায়ী নির্দিষ্ট সময়ে চেম্বারে উপস্থিত থাকুন।</div>
        <div style="margin-top: 3px; font-size: 10px;">শেখ ফার্মা · pt.sheikhpharma.shop</div>
      </div>
    `;

    document.body.appendChild(container);

    const canvas = await html2canvas(container, {
      scale: 3,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });

    document.body.removeChild(container);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    const link = document.createElement("a");
    link.href = dataUrl;
    const cleanPatient = pName.replace(/[^a-zA-Z0-9\u0980-\u09FF]/g, "_").slice(0, 20);
    link.download = `sheikh-pharma-serial-${serial}-${cleanPatient || "token"}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (err) {
    console.error("Failed to render token JPG:", err);
    return false;
  }
}
