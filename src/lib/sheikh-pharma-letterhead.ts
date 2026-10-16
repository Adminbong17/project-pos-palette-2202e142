import { SHEIKH_PHARMA_LOGO_BASE64 } from "./sheikh-pharma-logo.base64";

export const SHEIKH_PHARMA_DETAILS = {
  nameBangla: "শেখ ফার্মা",
  nameEnglish: "Sheikh Pharma",
  address: "দোকান নং ১৩,আরব প্যারাডাইস মার্কেট,নতুন বাজার,মুক্তাগাছা,ময়মনসিংহ।",
  phones: "০১৭৩৫৭৬৯৫৫৭, ০১৭১২৪৭২৮৩৯",
  phonesRaw: ["01712472839", "01735769557"],
  email: "sheikhpharma2023@gmail.com",
  logoBase64: SHEIKH_PHARMA_LOGO_BASE64,
  pdfUrl: "/sheikh-pharma-letterhead.pdf",
};

export function isSheikhPharma(name?: string | null): boolean {
  if (!name) return true; // Default to true if not specified
  const n = name.toLowerCase();
  return n.includes("sheikh") || n.includes("pharma");
}

/**
 * Returns HTML string for the official Sheikh Pharma A4 Letterhead Header.
 * Uses exact brand colors, logo, typography and modern geometric angled accents.
 */
export function getSheikhPharmaHeaderHtml(opts?: {
  title?: string;
  subtitle?: string;
  metaRight?: string;
}): string {
  const { title, subtitle, metaRight } = opts ?? {};

  return `
    <div class="sheikh-pharma-header" style="position:relative; width:100%; box-sizing:border-box; margin-bottom:14px; overflow:hidden;">
      <!-- Top Geometric Color Accent Bars -->
      <div style="height:6px; background:#10b981; width:100%; margin-bottom:2px;"></div>
      <div style="position:absolute; top:0; right:0; width:180px; height:24px; overflow:hidden; pointer-events:none;">
        <svg viewBox="0 0 180 24" preserveAspectRatio="none" style="width:100%; height:100%; display:block;">
          <polygon points="40,0 70,24 180,24 180,0" fill="#1e3a8a" />
          <polygon points="80,0 110,24 180,24 180,0" fill="#2563eb" opacity="0.85" />
          <polygon points="120,0 145,24 180,24 180,0" fill="#10b981" />
        </svg>
      </div>

      <!-- Main Header: Logo + Bangla Name + Address -->
      <div style="display:flex; align-items:center; gap:16px; padding:10px 4px 6px 4px;">
        <img src="${SHEIKH_PHARMA_DETAILS.logoBase64}" alt="Sheikh Pharma Logo" style="width:76px; height:76px; object-fit:contain; flex-shrink:0; border-radius:50%;" />
        <div style="flex:1;">
          <div style="font-size:32px; font-weight:900; color:#1e40af; line-height:1.15; font-family:'Segoe UI', SolaimanLipi, Kalpurush, sans-serif; letter-spacing:0.5px;">
            ${SHEIKH_PHARMA_DETAILS.nameBangla}
          </div>
          <div style="font-size:12px; font-weight:700; color:#1f2937; margin-top:4px; font-family:'Segoe UI', SolaimanLipi, Kalpurush, sans-serif; line-height:1.3;">
            ${SHEIKH_PHARMA_DETAILS.address}
          </div>
        </div>
      </div>

      ${title ? `
        <!-- Optional Report Title Banner -->
        <div style="margin-top:8px; background:#1e3a8a; color:#ffffff; padding:6px 14px; border-radius:4px; display:flex; justify-content:space-between; align-items:center;">
          <div style="font-size:13px; font-weight:800; letter-spacing:0.3px; text-transform:uppercase;">${title}</div>
          ${metaRight ? `<div style="font-size:10px; opacity:0.9;">${metaRight}</div>` : ""}
        </div>
      ` : `
        <!-- Divider Line -->
        <div style="height:2px; background:linear-gradient(90deg, #1e40af 0%, #10b981 100%); width:100%; margin-top:8px;"></div>
      `}

      ${subtitle ? `<div style="font-size:11px; color:#4b5563; margin-top:4px; font-style:italic;">${subtitle}</div>` : ""}
    </div>
  `;
}

/**
 * Returns HTML string for the official Sheikh Pharma A4 Letterhead Footer.
 */
export function getSheikhPharmaFooterHtml(): string {
  return `
    <div class="sheikh-pharma-footer" style="margin-top:auto; width:100%; box-sizing:border-box; padding-top:14px;">
      <!-- Footer Bottom Bar -->
      <div style="background:#059669; color:#ffffff; padding:8px 16px; border-radius:4px; display:flex; justify-content:space-between; align-items:center; font-size:11px; font-weight:700; font-family:sans-serif; position:relative; overflow:hidden;">
        <!-- Phone numbers on Left -->
        <div style="display:flex; align-items:center; gap:6px; z-index:2;">
          <span style="font-size:13px;">📞</span>
          <span style="font-family:'Segoe UI', SolaimanLipi, Kalpurush, sans-serif;">${SHEIKH_PHARMA_DETAILS.phones}</span>
        </div>

        <!-- Center Pharmacy Emblem -->
        <div style="display:flex; align-items:center; gap:4px; opacity:0.95; z-index:2;">
          <span>💊</span>
          <span>Sheikh Pharma • Muktagacha</span>
        </div>

        <!-- Email on Right -->
        <div style="display:flex; align-items:center; gap:6px; z-index:2;">
          <span>✉️</span>
          <span>${SHEIKH_PHARMA_DETAILS.email}</span>
        </div>

        <!-- Corner Geometry -->
        <div style="position:absolute; right:0; top:0; bottom:0; width:50px; background:#1e3a8a; clip-path:polygon(100% 0, 0 100%, 100% 100%); opacity:0.4;"></div>
      </div>
    </div>
  `;
}

/**
 * Full A4 Letterhead Wrapper HTML for printable pages.
 */
export function wrapWithA4Letterhead(bodyContent: string, opts?: {
  title?: string;
  subtitle?: string;
  metaRight?: string;
}): string {
  return `
    <div class="sheikh-pharma-a4-page" style="width:190mm; min-height:270mm; margin:0 auto; padding:10mm; box-sizing:border-box; background:#ffffff; color:#000000; font-family:ui-sans-serif, system-ui, -apple-system, sans-serif; display:flex; flex-direction:column; justify-content:space-between;">
      <div>
        ${getSheikhPharmaHeaderHtml(opts)}
        <div class="sheikh-pharma-body" style="padding:4px 0 14px 0;">
          ${bodyContent}
        </div>
      </div>
      ${getSheikhPharmaFooterHtml()}
    </div>
  `;
}
