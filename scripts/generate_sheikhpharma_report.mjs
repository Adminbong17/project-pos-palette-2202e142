import fs from "fs";
import path from "path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

async function generateReport() {
  const letterheadPath = "C:/Users/Lotus/.gemini/antigravity/brain/303754bd-951a-4fd1-b5a2-82f8d80643f9/.user_uploaded/media_1792152229050.pdf";
  const letterheadBytes = fs.readFileSync(letterheadPath);
  
  const templateDoc = await PDFDocument.load(letterheadBytes);
  const outDoc = await PDFDocument.create();

  const fontRegular = await outDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await outDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await outDoc.embedFont(StandardFonts.HelveticaOblique);

  // Colors
  const primaryBlue = rgb(0.08, 0.28, 0.65);    // #1447a6
  const darkTeal = rgb(0.02, 0.58, 0.44);       // #059470
  const lightBg = rgb(0.95, 0.97, 0.99);        // #f2f7fc
  const borderGray = rgb(0.82, 0.86, 0.90);     // #d1dce6
  const textDark = rgb(0.12, 0.16, 0.22);       // #1f2937
  const textMuted = rgb(0.38, 0.44, 0.52);      // #617084
  const white = rgb(1, 1, 1);
  const greenBadge = rgb(0.05, 0.65, 0.35);
  const redAlert = rgb(0.85, 0.15, 0.15);

  // Helper function to draw rounded-like or clean rectangles
  function drawBox(page, x, y, w, h, fill, border) {
    page.drawRectangle({
      x, y, width: w, height: h,
      color: fill || undefined,
      borderColor: border || undefined,
      borderWidth: border ? 0.75 : 0,
    });
  }

  // ==========================================
  // PAGE 1: Executive Summary & Top Companies
  // ==========================================
  const [page1] = await outDoc.copyPages(templateDoc, [0]);
  outDoc.addPage(page1);

  let y = 705;

  // Report Title Badge
  drawBox(page1, 38, y - 26, 520, 26, primaryBlue, null);
  page1.drawText("PRODUCT PRICING & MARGIN AUDIT REPORT", {
    x: 48, y: y - 18, size: 12, font: fontBold, color: white,
  });
  page1.drawText("CONFIDENTIAL AUDIT • 2026", {
    x: 400, y: y - 17, size: 8, font: fontBold, color: rgb(0.7, 0.85, 1),
  });

  y -= 38;

  // Subtitle & Meta Info Row
  page1.drawText("Analysis of MRP vs. Purchase Price (Trade Price) Across All Products & Brands", {
    x: 38, y: y, size: 9, font: fontBold, color: textDark,
  });
  page1.drawText("Date: 16 October 2026  |  Store: Sheikh Pharma  |  Audit Engine: QweekPOS Enterprise", {
    x: 38, y: y - 12, size: 7.5, font: fontRegular, color: textMuted,
  });

  y -= 24;

  // KPI Summary Cards (4 Cards across 520 width)
  const cardW = 124;
  const cardGap = 8;
  const cardH = 46;
  const kpis = [
    { label: "TOTAL PRODUCTS", val: "7,199", sub: "100% Catalog Size", color: primaryBlue },
    { label: "VALID PRICED", val: "7,184", sub: "99.8% Complete", color: darkTeal },
    { label: "STANDARD MARGIN", val: "15.00%", sub: "Median Difference", color: darkTeal },
    { label: "AVG DISCOUNT", val: "13.75%", sub: "Mean From MRP", color: primaryBlue },
  ];

  kpis.forEach((kpi, i) => {
    const cx = 38 + i * (cardW + cardGap);
    drawBox(page1, cx, y - cardH, cardW, cardH, lightBg, borderGray);
    drawBox(page1, cx, y - 3, cardW, 3, kpi.color, null);
    page1.drawText(kpi.label, { x: cx + 8, y: y - 14, size: 6.5, font: fontBold, color: textMuted });
    page1.drawText(kpi.val, { x: cx + 8, y: y - 30, size: 14, font: fontBold, color: kpi.color });
    page1.drawText(kpi.sub, { x: cx + 8, y: y - 41, size: 6.5, font: fontRegular, color: textMuted });
  });

  y -= (cardH + 16);

  // Section Header: Margin Distribution
  drawBox(page1, 38, y - 16, 520, 16, rgb(0.92, 0.95, 0.98), borderGray);
  page1.drawText("1. MARGIN DISTRIBUTION SUMMARY (HOW MUCH LOWER PURCHASE PRICE IS FROM MRP)", {
    x: 44, y: y - 11.5, size: 7.5, font: fontBold, color: primaryBlue,
  });

  y -= 22;

  // Distribution Table Headers
  const distCols = [
    { name: "Discount Range (% Lower from MRP)", x: 44, w: 190 },
    { name: "Products Count", x: 236, w: 90, align: "right" },
    { name: "% of Inventory", x: 328, w: 85, align: "right" },
    { name: "Category / Explanation", x: 420, w: 135 },
  ];

  drawBox(page1, 38, y - 14, 520, 14, rgb(0.2, 0.25, 0.32), null);
  page1.drawText("Discount Range (% Less from MRP)", { x: 44, y: y - 10, size: 7, font: fontBold, color: white });
  page1.drawText("Product Count", { x: 240, y: y - 10, size: 7, font: fontBold, color: white });
  page1.drawText("Share (%)", { x: 335, y: y - 10, size: 7, font: fontBold, color: white });
  page1.drawText("Market Category / Typical Goods", { x: 405, y: y - 10, size: 7, font: fontBold, color: white });

  y -= 15;

  const distRows = [
    { range: "15.0% - 17.0% Less", count: "3,838", pct: "53.4%", desc: "Standard Pharma Trade Price (Majority)", hi: true },
    { range: "10.0% - 13.0% Less", count: "1,110", pct: "15.5%", desc: "Antibiotics / Healthcare / Insulin / Specials" },
    { range: "13.0% - 15.0% Less", count: "915", pct: "12.7%", desc: "Select Regular Solid Dosage Forms" },
    { range: "17.0% - 30.0% Less", count: "794", pct: "11.1%", desc: "Syrups, Creams, Drops & OTC Formulations" },
    { range: "30.0%+ Less", count: "376", pct: "5.2%", desc: "Local Market, Surgical, Condoms & Devices" },
    { range: "0.0% - 10.0% Less", count: "98", pct: "1.4%", desc: "Tight Margin & Controlled Life-saving items" },
    { range: "Zero / Anomaly (<= 0%)", count: "53", pct: "0.7%", desc: "40 Data-entry discrepancies (Box vs strip rate)", alert: true },
  ];

  distRows.forEach((r, idx) => {
    const rowH = 12.5;
    const isEven = idx % 2 === 0;
    if (r.hi) {
      drawBox(page1, 38, y - rowH, 520, rowH, rgb(0.90, 0.97, 0.93), borderGray);
    } else if (isEven) {
      drawBox(page1, 38, y - rowH, 520, rowH, rgb(0.98, 0.98, 0.99), borderGray);
    } else {
      drawBox(page1, 38, y - rowH, 520, rowH, white, borderGray);
    }

    page1.drawText(r.range, { x: 44, y: y - 9, size: 6.8, font: r.hi ? fontBold : fontRegular, color: textDark });
    page1.drawText(r.count, { x: 250, y: y - 9, size: 6.8, font: fontBold, color: r.hi ? darkTeal : textDark });
    page1.drawText(r.pct, { x: 345, y: y - 9, size: 6.8, font: fontBold, color: r.hi ? darkTeal : textDark });
    page1.drawText(r.desc, { x: 405, y: y - 9, size: 6.5, font: fontRegular, color: r.alert ? redAlert : textMuted });

    y -= rowH;
  });

  y -= 14;

  // Section Header: Top 15 Brands
  drawBox(page1, 38, y - 16, 520, 16, rgb(0.92, 0.95, 0.98), borderGray);
  page1.drawText("2. MAJOR PHARMACEUTICAL COMPANIES / BRANDS (PART 1 - TOP 15 MANUFACTURERS)", {
    x: 44, y: y - 11.5, size: 7.5, font: fontBold, color: primaryBlue,
  });

  y -= 22;

  // Top Brands Table Header
  drawBox(page1, 38, y - 14, 520, 14, primaryBlue, null);
  page1.drawText("#", { x: 42, y: y - 10, size: 7, font: fontBold, color: white });
  page1.drawText("Company / Brand Name", { x: 58, y: y - 10, size: 7, font: fontBold, color: white });
  page1.drawText("Total Items", { x: 200, y: y - 10, size: 7, font: fontBold, color: white });
  page1.drawText("Typical (Median %)", { x: 260, y: y - 10, size: 7, font: fontBold, color: white });
  page1.drawText("Average %", { x: 350, y: y - 10, size: 7, font: fontBold, color: white });
  page1.drawText("Common Samples & Trade Rates", { x: 410, y: y - 10, size: 7, font: fontBold, color: white });

  y -= 15;

  const top15 = [
    { rank: "1", name: "Square Pharmaceuticals", count: "715", median: "15.00%", avg: "9.73%", sample: "Activon (15%), Alarid (12%), Alfane (13.8%)" },
    { rank: "2", name: "Incepta Pharmaceuticals", count: "617", median: "15.00%", avg: "11.29%", sample: "Ambolyt (12%), Askorel (12%), Azecol (10.9%)" },
    { rank: "3", name: "Local Market / General", count: "649", median: "17.50%", avg: "23.25%", sample: "Afexa (12%), Alcina (30.6%), Alice (27.3%)" },
    { rank: "4", name: "ACME Laboratories Ltd.", count: "408", median: "15.00%", avg: "17.19%", sample: "Azin 15ml (19.3%), Biocal-DX Pot (25.0%)" },
    { rank: "5", name: "Beximco Pharmaceuticals", count: "318", median: "15.00%", avg: "15.40%", sample: "Anustat (12%), Arixon Inj 1g/2g (29%-31.7%)" },
    { rank: "6", name: "Drug International Ltd.", count: "304", median: "15.00%", avg: "12.26%", sample: "Ventil Plus (13.2%), D-Cap (12.9%), Betavate (16.7%)" },
    { rank: "7", name: "SK+F (Eskayef Pharmaceuticals)", count: "291", median: "15.00%", avg: "15.16%", sample: "Actrapid (11.5%), Kilmax (12%), SK-CEF (15.1%)" },
    { rank: "8", name: "Aristo Pharma Ltd.", count: "286", median: "15.00%", avg: "15.85%", sample: "Aroflo (15%), Aristocort (17.3%), Ipec (19.5%)" },
    { rank: "9", name: "Renata Limited", count: "271", median: "15.00%", avg: "16.19%", sample: "Algin Syp (12.7%), Calcin-O (12.5%), Flustar (21.4%)" },
    { rank: "10", name: "ACI Limited", count: "231", median: "15.00%", avg: "15.68%", sample: "Brodil Inhaler (12.5%), Breon (15%), Gabarol (18.2%)" },
    { rank: "11", name: "Opsonin Pharma Ltd.", count: "360", median: "15.00%", avg: "16.12%", sample: "Beltas (12%), Azonox (17%), Beklo (22%)" },
    { rank: "12", name: "Popular Pharmaceuticals", count: "192", median: "15.00%", avg: "15.71%", sample: "Vonomax (20%), Zemicef 200/400 (20%)" },
    { rank: "13", name: "Ibn Sina Pharmaceuticals", count: "187", median: "15.00%", avg: "15.55%", sample: "Etolac (15%), Dexlan (24%), Xorel (29%)" },
    { rank: "14", name: "General Pharmaceuticals", count: "180", median: "15.00%", avg: "15.55%", sample: "Rose (15%), Lulicon (15%), DLP (29.3%)" },
    { rank: "15", name: "Radiant Pharmaceuticals", count: "164", median: "15.00%", avg: "—", sample: "Cranbiotic (13.8%), Acteria (13.8%), Ardance (20%)" },
  ];

  top15.forEach((b, idx) => {
    const rowH = 13.2;
    const isEven = idx % 2 === 0;
    drawBox(page1, 38, y - rowH, 520, rowH, isEven ? rgb(0.98, 0.98, 0.99) : white, borderGray);

    page1.drawText(b.rank, { x: 42, y: y - 9.5, size: 6.8, font: fontRegular, color: textMuted });
    page1.drawText(b.name, { x: 58, y: y - 9.5, size: 6.8, font: fontBold, color: textDark });
    page1.drawText(b.count, { x: 215, y: y - 9.5, size: 6.8, font: fontRegular, color: textDark });
    page1.drawText(b.median, { x: 275, y: y - 9.5, size: 6.8, font: fontBold, color: darkTeal });
    page1.drawText(b.avg, { x: 360, y: y - 9.5, size: 6.8, font: fontRegular, color: textMuted });
    page1.drawText(b.sample, { x: 410, y: y - 9.5, size: 6.2, font: fontRegular, color: textDark });

    y -= rowH;
  });

  // Footer Note on Page 1
  page1.drawText("Continued on Page 2 for Brands 16-35, Price Discrepancies & Official Sign-off • Sheikh Pharma Audit", {
    x: 105, y: 55, size: 6.8, font: fontOblique, color: textMuted,
  });

  // ==========================================
  // PAGE 2: Additional Brands & Action Plan
  // ==========================================
  const [page2] = await outDoc.copyPages(templateDoc, [0]);
  outDoc.addPage(page2);

  y = 705;

  // Section Header: Part 2 Brands
  drawBox(page2, 38, y - 22, 520, 22, primaryBlue, null);
  page2.drawText("PRODUCT PRICING & MARGIN AUDIT REPORT (PAGE 2)", {
    x: 48, y: y - 15, size: 10, font: fontBold, color: white,
  });
  page2.drawText("ADDITIONAL BRANDS & AUDIT EXCEPTIONS", {
    x: 350, y: y - 14, size: 7.5, font: fontBold, color: rgb(0.7, 0.85, 1),
  });

  y -= 32;

  drawBox(page2, 38, y - 16, 520, 16, rgb(0.92, 0.95, 0.98), borderGray);
  page2.drawText("3. MAJOR PHARMACEUTICAL COMPANIES / BRANDS (PART 2 - BRANDS 16 TO 35)", {
    x: 44, y: y - 11.5, size: 7.5, font: fontBold, color: primaryBlue,
  });

  y -= 22;

  // Table Header
  drawBox(page2, 38, y - 14, 520, 14, rgb(0.2, 0.25, 0.32), null);
  page2.drawText("#", { x: 42, y: y - 10, size: 7, font: fontBold, color: white });
  page2.drawText("Company / Brand Name", { x: 58, y: y - 10, size: 7, font: fontBold, color: white });
  page2.drawText("Total Items", { x: 200, y: y - 10, size: 7, font: fontBold, color: white });
  page2.drawText("Typical (Median %)", { x: 260, y: y - 10, size: 7, font: fontBold, color: white });
  page2.drawText("Average %", { x: 350, y: y - 10, size: 7, font: fontBold, color: white });
  page2.drawText("Common Samples & Trade Rates", { x: 410, y: y - 10, size: 7, font: fontBold, color: white });

  y -= 15;

  const brandsPart2 = [
    { rank: "16", name: "Navana Pharmaceuticals", count: "152", median: "15.00%", avg: "18.44%", sample: "Agonil (12%), Allertin (13.6%), Azirox (19.5%)" },
    { rank: "17", name: "Biopharma Ltd.", count: "127", median: "15.00%", avg: "15.95%", sample: "Lasocon (10%), Ortho-D3 (15%), Bantovet (17.1%)" },
    { rank: "18", name: "Beacon Pharmaceuticals", count: "118", median: "15.00%", avg: "15.95%", sample: "Biorenal (12%), Esoprex (15%), Dorakid (16.7%)" },
    { rank: "19", name: "Synovia Pharma PLC", count: "86", median: "15.00%", avg: "16.85%", sample: "Bontiv (14.3%), Brodil Refill (20%), Levo (10%)" },
    { rank: "20", name: "Sun Pharmaceutical", count: "85", median: "15.00%", avg: "14.82%", sample: "Neugaba (12.9%), Sompraz (14.3%)" },
    { rank: "21", name: "Globe Pharmaceuticals", count: "80", median: "15.00%", avg: "14.78%", sample: "Ema (12%), Ecovit (15%), EPL Plus (30%)" },
    { rank: "22", name: "Ziska Pharmaceuticals", count: "79", median: "15.00%", avg: "16.09%", sample: "Ajardy (18%), Relaxo (18%), Dexilend (28%)" },
    { rank: "23", name: "Healthcare Pharmaceuticals", count: "78", median: "12.00%", avg: "—", sample: "Betaval (12%), D-Vine (12%), Denvar (12%)" },
    { rank: "24", name: "Orion Pharma Ltd.", count: "78", median: "15.00%", avg: "15.44%", sample: "Pep (19.4%), Conaz (15%), Dextrosal (50%)" },
    { rank: "25", name: "Delta Pharma Limited", count: "70", median: "15.00%", avg: "18.27%", sample: "Dexalax (20%), Imax (41.8%), Staxim (19.4%)" },
    { rank: "26", name: "Labaid Pharmaceuticals", count: "62", median: "15.00%", avg: "17.27%", sample: "Dexend (15%), Rexiet 10/20mg (25%-28.6%)" },
    { rank: "27", name: "Pacific Pharmaceuticals", count: "60", median: "15.00%", avg: "15.11%", sample: "Festam Gel (21.3%), Magmilk (15%)" },
    { rank: "28", name: "Novartis (Bangladesh)", count: "54", median: "15.00%", avg: "14.94%", sample: "Voltalin (11.7%), Serolux (15%), Vass (15%)" },
    { rank: "29", name: "Nipro JMI Pharma Ltd.", count: "51", median: "15.00%", avg: "16.93%", sample: "Cefracef (27.7%), Syringes 5cc/20cc (20%-30%)" },
    { rank: "30", name: "Silco Pharmaceuticals", count: "50", median: "15.00%", avg: "15.00%", sample: "Oltan A (15%), Antismine (15%), Silpol (15%)" },
    { rank: "31", name: "Nuvista Pharma Ltd.", count: "48", median: "15.00%", avg: "15.33%", sample: "Traxyl (12%), Caprogen (15%), Roxadex (15.1%)" },
    { rank: "32", name: "Hamdard Laboratories", count: "42", median: "15.00%", avg: "17.15%", sample: "Naunehal (25.9%), Apelin (16.7%), Masturin (25%)" },
    { rank: "33", name: "Everest Pharmaceuticals", count: "39", median: "15.00%", avg: "16.23%", sample: "Candifast (12%), Neuroxen (12%), Evofix (29.6%)" },
    { rank: "34", name: "SMC Enterprise Ltd.", count: "26", median: "17.40%", avg: "20.79%", sample: "Panther (30%), Joya (23%), Smile Pants (15%)" },
    { rank: "35", name: "GSK Consumer Healthcare", count: "14", median: "15.00%", avg: "15.00%", sample: "Sensodyne Brushes (15%), Fresh Gel Paste (15%)" },
  ];

  brandsPart2.forEach((b, idx) => {
    const rowH = 12.8;
    const isEven = idx % 2 === 0;
    drawBox(page2, 38, y - rowH, 520, rowH, isEven ? rgb(0.98, 0.98, 0.99) : white, borderGray);

    page2.drawText(b.rank, { x: 42, y: y - 9.2, size: 6.8, font: fontRegular, color: textMuted });
    page2.drawText(b.name, { x: 58, y: y - 9.2, size: 6.8, font: fontBold, color: textDark });
    page2.drawText(b.count, { x: 215, y: y - 9.2, size: 6.8, font: fontRegular, color: textDark });
    page2.drawText(b.median, { x: 275, y: y - 9.2, size: 6.8, font: fontBold, color: darkTeal });
    page2.drawText(b.avg, { x: 360, y: y - 9.2, size: 6.8, font: fontRegular, color: textMuted });
    page2.drawText(b.sample, { x: 410, y: y - 9.2, size: 6.2, font: fontRegular, color: textDark });

    y -= rowH;
  });

  y -= 14;

  // Section 4: Audit Action Items (Missing Prices)
  drawBox(page2, 38, y - 16, 520, 16, rgb(0.98, 0.92, 0.92), rgb(0.90, 0.70, 0.70));
  page2.drawText("4. AUDIT DISCREPANCIES REQUIRING ATTENTION (15 ITEMS MISSING MRP / PURCHASE PRICE)", {
    x: 44, y: y - 11.5, size: 7.2, font: fontBold, color: redAlert,
  });

  y -= 22;

  drawBox(page2, 38, y - 56, 520, 56, lightBg, borderGray);

  page2.drawText("• Missing Purchase Price only (MRP is entered):", { x: 46, y: y - 12, size: 7, font: fontBold, color: textDark });
  page2.drawText("1. pred 10 (SKU: SKP679339) - MRP 320, Purchase 0  |  2. rabix-ig (SKU: inceptapharmaciuticals ltd) - MRP 1000, Purchase 0", {
    x: 52, y: y - 22, size: 6.8, font: fontRegular, color: redAlert,
  });

  page2.drawText("• Missing both Purchase Price & MRP (13 Items with 0.00):", { x: 46, y: y - 35, size: 7, font: fontBold, color: textDark });
  page2.drawText("Drop Vanprox S, fenofix 120, Savlon 500 mL, Tab Amarin, Tab Brodil 2, Tab Brodil 4, Tab Histal, Tab Riboflavin 5mg, Tab Ribosina, Tab Salbu 4, Tab Tamen, Tab Tenoren 25, xinc-B 10pot", {
    x: 52, y: y - 47, size: 6.2, font: fontRegular, color: textMuted,
  });

  y -= 70;

  // Signature Block
  const sigW = 150;
  const sigH = 45;

  // Sign 1: Auditor
  page2.drawLine({ start: { x: 50, y: y - 25 }, end: { x: 50 + sigW, y: y - 25 }, thickness: 0.8, color: textMuted });
  page2.drawText("Prepared by: Auditor / POS Analyst", { x: 50, y: y - 35, size: 7, font: fontRegular, color: textMuted });
  page2.drawText("QweekPOS Automated Audit Engine", { x: 50, y: y - 44, size: 6.5, font: fontBold, color: primaryBlue });

  // Sign 2: Pharmacist
  page2.drawLine({ start: { x: 225, y: y - 25 }, end: { x: 225 + sigW, y: y - 25 }, thickness: 0.8, color: textMuted });
  page2.drawText("Verified by: Registered Pharmacist", { x: 225, y: y - 35, size: 7, font: fontRegular, color: textMuted });
  page2.drawText("Sheikh Pharma muktagacha", { x: 225, y: y - 44, size: 6.5, font: fontRegular, color: textDark });

  // Sign 3: Proprietor
  page2.drawLine({ start: { x: 400, y: y - 25 }, end: { x: 400 + sigW, y: y - 25 }, thickness: 0.8, color: textMuted });
  page2.drawText("Approved by: Proprietor", { x: 400, y: y - 35, size: 7, font: fontRegular, color: textMuted });
  page2.drawText("Sheikh Pharma, Muktagacha", { x: 400, y: y - 44, size: 6.5, font: fontBold, color: primaryBlue });

  // Save the PDF
  const pdfBytes = await outDoc.save();
  const outputPath = "G:/Sheikh Pharma/Sheikh_Pharma_Price_Audit_Report.pdf";
  fs.writeFileSync(outputPath, pdfBytes);
  console.log("PDF created successfully at:", outputPath);
  console.log("PDF file size:", pdfBytes.length, "bytes");
}

generateReport().catch(console.error);
