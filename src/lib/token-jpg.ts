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

/** Helper to draw rounded rectangles on older canvas implementations safely. */
function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}

/** Helper to truncate text with ellipsis if it exceeds max width. */
function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let str = text;
  while (str.length > 0 && ctx.measureText(str + "...").width > maxWidth) {
    str = str.slice(0, -1);
  }
  return str + "...";
}

const FONT_FAMILY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Bengali', 'Kalpurush', sans-serif";

/** Generate a crystal-clear, high-resolution Canvas (800x1100 px) for the token. */
export function generateTokenCanvas(data: TokenJpgData): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const w = 800;
  const h = 1100;
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context not available");

  // 1. Background
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, w, h);

  // 2. White Card with Emerald Border
  const pad = 24;
  const cardW = w - pad * 2;
  const cardH = h - pad * 2;
  drawRoundRect(ctx, pad, pad, cardW, cardH, 24);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#059669";
  ctx.stroke();

  // 3. Header Section
  ctx.textAlign = "center";
  
  // Clinic Name
  ctx.fillStyle = "#059669";
  ctx.font = `bold 20px ${FONT_FAMILY}`;
  ctx.fillText(data.clinicName || "শেখ ফার্মা ও ডায়াগনস্টিক", w / 2, 75);

  // Main Title
  ctx.fillStyle = "#0f172a";
  ctx.font = `bold 32px ${FONT_FAMILY}`;
  ctx.fillText("ডিজিটাল অ্যাপয়েন্টমেন্ট টোকেন", w / 2, 118);

  // Subtitle
  ctx.fillStyle = "#64748b";
  ctx.font = `500 18px ${FONT_FAMILY}`;
  ctx.fillText("রোগী সেবা ও প্রেসক্রিপশন সিরিয়াল স্লিপ", w / 2, 148);

  // Divider Line
  ctx.beginPath();
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 2;
  ctx.moveTo(pad + 20, 168);
  ctx.lineTo(w - pad - 20, 168);
  ctx.stroke();

  // 4. Serial Number Banner
  const bannerY = 188;
  const bannerH = 155;
  drawRoundRect(ctx, pad + 20, bannerY, cardW - 40, bannerH, 20);
  
  // Gradient fill
  const grad = ctx.createLinearGradient(0, bannerY, 0, bannerY + bannerH);
  grad.addColorStop(0, "#059669");
  grad.addColorStop(1, "#047857");
  ctx.fillStyle = grad;
  ctx.fill();

  // Banner Text
  ctx.fillStyle = "#e6fcf5";
  ctx.font = `600 18px ${FONT_FAMILY}`;
  ctx.fillText("আপনার সিরিয়াল নম্বর / SERIAL NO", w / 2, bannerY + 36);

  ctx.fillStyle = "#ffffff";
  ctx.font = `900 76px ${FONT_FAMILY}`;
  ctx.fillText(`#${data.serialNo ?? "—"}`, w / 2, bannerY + 105);

  ctx.fillStyle = "#ffffff";
  ctx.font = `600 18px ${FONT_FAMILY}`;
  const dateStr = data.date || new Date().toISOString().slice(0, 10);
  ctx.fillText(`তারিখ: ${dateStr}`, w / 2, bannerY + 138);

  // 5. Doctor Box
  const docY = 360;
  const docH = 110;
  drawRoundRect(ctx, pad + 20, docY, cardW - 40, docH, 16);
  ctx.fillStyle = "#f8fafc";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#e2e8f0";
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.fillStyle = "#64748b";
  ctx.font = `bold 15px ${FONT_FAMILY}`;
  ctx.fillText("চিকিৎসক / SPECIALIST DOCTOR", pad + 40, docY + 32);

  ctx.fillStyle = "#0f172a";
  ctx.font = `bold 26px ${FONT_FAMILY}`;
  const docName = String(data.doctorName || "চিকিৎসক").trim();
  ctx.fillText(truncateText(ctx, docName, cardW - 80), pad + 40, docY + 68);

  if (data.doctorQualification) {
    ctx.fillStyle = "#059669";
    ctx.font = `600 18px ${FONT_FAMILY}`;
    ctx.fillText(truncateText(ctx, data.doctorQualification, cardW - 80), pad + 40, docY + 95);
  }

  // 6. Patient & Appointment Details Box
  const detY = 488;
  const detH = 430;
  drawRoundRect(ctx, pad + 20, detY, cardW - 40, detH, 16);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#e2e8f0";
  ctx.stroke();

  // Helper row drawer
  let curY = detY + 45;
  const drawRow = (label: string, value: string, isBadge = false, isFee = false) => {
    ctx.textAlign = "left";
    ctx.fillStyle = "#64748b";
    ctx.font = `600 20px ${FONT_FAMILY}`;
    ctx.fillText(label, pad + 40, curY);

    ctx.textAlign = "right";
    if (isBadge) {
      // Draw blue pill badge for UID
      const bw = ctx.measureText(value).width + 24;
      const bx = w - pad - 40 - bw;
      const by = curY - 24;
      drawRoundRect(ctx, bx, by, bw, 34, 8);
      ctx.fillStyle = "#e0f2fe";
      ctx.fill();
      ctx.strokeStyle = "#bae6fd";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#0369a1";
      ctx.font = "bold 18px monospace";
      ctx.fillText(value, w - pad - 52, curY - 1);
    } else if (isFee) {
      ctx.fillStyle = "#059669";
      ctx.font = `bold 26px ${FONT_FAMILY}`;
      ctx.fillText(value, w - pad - 40, curY);
    } else {
      ctx.fillStyle = "#0f172a";
      ctx.font = `bold 21px ${FONT_FAMILY}`;
      const maxValW = cardW - 280;
      ctx.fillText(truncateText(ctx, value, maxValW), w - pad - 40, curY);
    }

    // Dashed separator below
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1.5;
    ctx.moveTo(pad + 40, curY + 22);
    ctx.lineTo(w - pad - 40, curY + 22);
    ctx.stroke();
    ctx.setLineDash([]); // reset

    curY += 68;
  };

  drawRow("রোগীর নাম:", String(data.patientName || "সম্মানিত রোগী"));

  if (data.patientCode) {
    drawRow("রোগীর আইডি (UID):", String(data.patientCode), true);
  }

  if (data.phone) {
    drawRow("মোবাইল নম্বর:", String(data.phone));
  }

  const locStr = String(data.location || "শেখ ফার্মা চেম্বার");
  drawRow("চেম্বার / লোকেশন:", locStr);

  const feeStr = data.fee != null ? (Number(data.fee) > 0 ? `৳${data.fee}` : "ফ্রি / ০৳") : "—";
  drawRow("পরামর্শ ফি:", feeStr, false, true);

  // 7. Footer Section
  ctx.textAlign = "center";
  ctx.fillStyle = "#334155";
  ctx.font = `600 18px ${FONT_FAMILY}`;
  ctx.fillText("অনুগ্রহ করে সিরিয়াল অনুযায়ী নির্দিষ্ট সময়ে চেম্বারে উপস্থিত থাকুন।", w / 2, 975);

  ctx.fillStyle = "#64748b";
  ctx.font = `500 16px ${FONT_FAMILY}`;
  ctx.fillText("শেখ ফার্মা ডিজিটাল হেলথ প্ল্যাটফর্ম · pt.sheikhpharma.shop", w / 2, 1010);

  return canvas;
}

/** Download token image directly as JPG without external library failures. */
export async function downloadTokenAsJpg(data: TokenJpgData): Promise<boolean> {
  try {
    const canvas = generateTokenCanvas(data);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.95);
    });

    if (!blob) throw new Error("Canvas blob conversion failed");

    const cleanPatient = (data.patientName || "patient")
      .replace(/[^a-zA-Z0-9\u0980-\u09FF]/g, "_")
      .slice(0, 20);
    const filename = `sheikh-pharma-serial-${data.serialNo ?? "token"}-${cleanPatient || "token"}.jpg`;

    // 1. Direct Blob URL Download (Standard across Mobile Chrome, Safari, Edge, Desktop)
    try {
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        try {
          document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
        } catch (_) {}
      }, 3000);

      return true;
    } catch (blobErr) {
      console.warn("Direct blob download failed, trying Web Share API:", blobErr);
    }

    // 2. Web Share API Fallback (for in-app webviews where link.click() is restricted)
    if (
      typeof navigator !== "undefined" &&
      navigator.canShare &&
      navigator.canShare({ files: [new File([blob], filename, { type: "image/jpeg" })] })
    ) {
      try {
        const file = new File([blob], filename, { type: "image/jpeg" });
        await navigator.share({
          files: [file],
          title: "শেখ ফার্মা টোকেন",
          text: `সিরিয়াল #${data.serialNo} টোকেন`,
        });
        return true;
      } catch (shareErr: any) {
        if (shareErr.name === "AbortError") return true;
      }
    }

    // 3. Last-resort fallback: open data URL in new window so user can tap & hold to save
    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    const win = window.open();
    if (win) {
      win.document.write(`<title>Token #${data.serialNo || ""}</title><img src="${dataUrl}" style="max-width:100%;height:auto;display:block;margin:auto;" alt="Token"/>`);
      return true;
    }

    return false;
  } catch (err) {
    console.error("Token download failed:", err);
    return false;
  }
}

/** Get data URL for inline display/modal if needed. */
export function getTokenDataUrl(data: TokenJpgData): string {
  const canvas = generateTokenCanvas(data);
  return canvas.toDataURL("image/jpeg", 0.95);
}
