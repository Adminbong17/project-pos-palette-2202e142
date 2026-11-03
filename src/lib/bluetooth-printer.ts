/**
 * Bluetooth & Serial Thermal Printer Driver (58mm / 80mm ESC/POS)
 * Supports:
 * 1. Web Bluetooth API (GATT BLE) - Direct zero-driver wireless connection
 * 2. Web Serial API (Bluetooth Virtual COM / USB) - Windows Bluetooth SPP pairing (Baud: 115200)
 * 3. Pure 2D Canvas ESC/POS Rasterization (GS v 0) - Zero CSS / oklch dependency, 100% reliable
 * 4. html-to-image fallback for custom DOM elements
 */

import type { ReceiptSale, ReceiptHeader } from "./receipt-print";

export type PrinterConnectionType = "bluetooth" | "serial";

export interface ConnectedPrinterInfo {
  name: string;
  type: PrinterConnectionType;
  id?: string;
  connectedAt: number;
}

// Known GATT service UUIDs used by mobile thermal printers (PT-220, MTP-II, POS-58, etc.)
const KNOWN_PRINTER_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb", // Standard mobile printer service
  "0000ffe0-0000-1000-8000-00805f9b34fb", // Common Chinese BLE POS
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000fee7-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC Transparent UART
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART
];

export function renderReceiptToCanvas(
  sale: ReceiptSale,
  header: ReceiptHeader,
  targetWidth = 384
): HTMLCanvasElement {
  const pad = 10;
  const contentWidth = targetWidth - pad * 2; // 364px

  // Measurement canvas to calculate dynamic height accurately
  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d")!;

  const wrap = (text: string, font: string, maxW: number): string[] => {
    mctx.font = font;
    const words = text.split(" ");
    const lines: string[] = [];
    let cur = words[0] || "";
    for (let i = 1; i < words.length; i++) {
      const w = words[i];
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

  const nameLines = wrap(header.businessName || "Sheikh Pharma", "bold 20px sans-serif", contentWidth);
  const addrLines = header.businessAddress ? wrap(header.businessAddress, "12px sans-serif", contentWidth) : [];
  const phoneLines = header.businessMobile ? wrap(`Phone: ${header.businessMobile}`, "12px sans-serif", contentWidth) : [];

  const itemLineRows: { nameLines: string[]; qtyRate: string; total: string }[] = [];
  for (const l of sale.lines) {
    const iNameLines = wrap(`${l.name}`, "bold 13px sans-serif", contentWidth);
    const qtyRate = `${l.quantity} × ${Number(l.unit_price).toFixed(2)}`;
    const total = `${Number(l.total_amount).toFixed(2)}`;
    itemLineRows.push({ nameLines: iNameLines, qtyRate, total });
  }

  // Calculate total height needed:
  let totalHeight = 15; // top margin
  totalHeight += nameLines.length * 24 + 4;
  totalHeight += addrLines.length * 16;
  totalHeight += phoneLines.length * 16 + 10;

  totalHeight += 12; // divider
  totalHeight += 20 + 20; // Bill No, Date
  if (sale.served_by || sale.counter_id) totalHeight += 20;
  if (sale.customer_name) totalHeight += 20;

  totalHeight += 12; // divider
  totalHeight += 20; // Table header

  for (const r of itemLineRows) {
    totalHeight += r.nameLines.length * 18 + 18 + 4;
  }

  totalHeight += 12; // divider
  totalHeight += 20; // Subtotal
  if (sale.discount > 0) totalHeight += 20;
  if (sale.vat) totalHeight += 20;
  totalHeight += 20; // Total Qty
  totalHeight += 26; // Net Total

  // Payment Box
  totalHeight += 12 + 65 + 10;

  // Footer & Tear Feed
  totalHeight += 20 + 16 + 45;

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext("2d")!;

  // Fill crisp white background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetWidth, totalHeight);
  ctx.fillStyle = "#000000";

  let y = 20;

  // 1. Header (Centered)
  ctx.textAlign = "center";
  ctx.font = "bold 20px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
  for (const nl of nameLines) {
    ctx.fillText(nl, targetWidth / 2, y);
    y += 24;
  }

  ctx.font = "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
  for (const al of addrLines) {
    ctx.fillText(al, targetWidth / 2, y);
    y += 16;
  }
  for (const pl of phoneLines) {
    ctx.fillText(pl, targetWidth / 2, y);
    y += 16;
  }

  y += 4;
  const drawDotted = (lineY: number) => {
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, lineY);
    ctx.lineTo(targetWidth - pad, lineY);
    ctx.stroke();
    ctx.restore();
  };

  drawDotted(y);
  y += 16;

  // 2. Meta Info (Bill No, Date, etc.)
  ctx.textAlign = "left";
  ctx.font = "bold 13px monospace, 'Courier New', monospace";
  ctx.fillText("Bill No:", pad, y);
  ctx.textAlign = "right";
  ctx.fillText(sale.invoice_no, targetWidth - pad, y);
  y += 20;

  ctx.textAlign = "left";
  ctx.font = "12px monospace, 'Courier New', monospace";
  ctx.fillText("Date:", pad, y);
  ctx.textAlign = "right";
  ctx.fillText(sale.date, targetWidth - pad, y);
  y += 20;

  if (sale.served_by || sale.counter_id) {
    ctx.textAlign = "left";
    ctx.fillText("Cashier:", pad, y);
    ctx.textAlign = "right";
    ctx.fillText(`${sale.served_by ?? ""}${sale.counter_id ? ` (${sale.counter_id})` : ""}`, targetWidth - pad, y);
    y += 20;
  }

  if (sale.customer_name) {
    ctx.textAlign = "left";
    ctx.fillText("Customer:", pad, y);
    ctx.textAlign = "right";
    ctx.fillText(sale.customer_name, targetWidth - pad, y);
    y += 20;
  }

  drawDotted(y);
  y += 16;

  // 3. Table Header
  ctx.font = "bold 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Item / Qty × Rate", pad, y);
  ctx.textAlign = "right";
  ctx.fillText("Total (৳)", targetWidth - pad, y);
  y += 16;
  drawDotted(y);
  y += 16;

  // 4. Items List
  for (let idx = 0; idx < itemLineRows.length; idx++) {
    const row = itemLineRows[idx];
    ctx.textAlign = "left";
    ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
    for (let lIdx = 0; lIdx < row.nameLines.length; lIdx++) {
      const prefix = lIdx === 0 ? `${idx + 1}. ` : "   ";
      ctx.fillText(prefix + row.nameLines[lIdx], pad, y);
      y += 17;
    }

    ctx.font = "12px monospace, 'Courier New', monospace";
    ctx.textAlign = "left";
    ctx.fillText(`   ${row.qtyRate}`, pad, y);
    ctx.textAlign = "right";
    ctx.font = "bold 13px monospace, 'Courier New', monospace";
    ctx.fillText(row.total, targetWidth - pad, y);
    y += 20;
  }

  drawDotted(y);
  y += 16;

  // 5. Totals
  ctx.font = "13px monospace, 'Courier New', monospace";
  ctx.textAlign = "left";
  ctx.fillText("Subtotal:", pad, y);
  ctx.textAlign = "right";
  ctx.fillText(Number(sale.subtotal).toFixed(2), targetWidth - pad, y);
  y += 19;

  if (sale.discount > 0) {
    ctx.textAlign = "left";
    ctx.fillText("Discount:", pad, y);
    ctx.textAlign = "right";
    ctx.fillText(`-${Number(sale.discount).toFixed(2)}`, targetWidth - pad, y);
    y += 19;
  }

  if (sale.vat) {
    ctx.textAlign = "left";
    ctx.fillText("VAT:", pad, y);
    ctx.textAlign = "right";
    ctx.fillText(Number(sale.vat).toFixed(2), targetWidth - pad, y);
    y += 19;
  }

  const netQty = sale.lines.reduce((s, l) => s + Number(l.quantity || 0), 0);
  ctx.textAlign = "left";
  ctx.fillText("Total Qty:", pad, y);
  ctx.textAlign = "right";
  ctx.fillText(String(netQty), targetWidth - pad, y);
  y += 18;

  // Solid line
  ctx.save();
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(targetWidth - pad, y);
  ctx.stroke();
  ctx.restore();
  y += 20;

  // Net Total
  ctx.textAlign = "left";
  ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
  ctx.fillText("Net Total:", pad, y);
  ctx.textAlign = "right";
  ctx.font = "bold 17px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
  ctx.fillText(`৳${Number(sale.total).toFixed(2)}`, targetWidth - pad, y);
  y += 22;

  // 6. Payment Box
  const boxTop = y;
  const boxHeight = 60;
  ctx.strokeRect(pad, boxTop, targetWidth - pad * 2, boxHeight);

  const payLabel = (sale.payment_method || "CASH").toUpperCase();
  ctx.font = "bold 12px monospace, 'Courier New', monospace";
  ctx.textAlign = "left";
  ctx.fillText(`Paid (${payLabel})`, pad + 8, y + 17);
  ctx.textAlign = "right";
  ctx.fillText(Number(sale.paid).toFixed(2), targetWidth - pad - 8, y + 17);

  ctx.font = "12px monospace, 'Courier New', monospace";
  ctx.textAlign = "left";
  ctx.fillText("Amount Tendered", pad + 8, y + 35);
  ctx.textAlign = "right";
  ctx.fillText(Number(sale.paid).toFixed(2), targetWidth - pad - 8, y + 35);

  ctx.textAlign = "left";
  ctx.fillText(sale.change < 0 ? "Due" : "Change Due", pad + 8, y + 51);
  ctx.textAlign = "right";
  ctx.fillText(Math.abs(sale.change).toFixed(2), targetWidth - pad - 8, y + 51);
  y += boxHeight + 20;

  // 7. Footer
  ctx.textAlign = "center";
  ctx.font = "bold 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
  ctx.fillText("Thank You Very Much For Your Business!", targetWidth / 2, y);
  y += 18;

  ctx.font = "10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";
  ctx.fillText("Goods Sold Are Not Returnable", targetWidth / 2, y);

  return canvas;
}

class ThermalPrinterManager {
  private bleDevice: any = null;
  private bleCharacteristic: any = null;
  private serialPort: any = null;
  private serialWriter: any = null;
  private currentPrinter: ConnectedPrinterInfo | null = null;
  private listeners: Set<(info: ConnectedPrinterInfo | null) => void> = new Set();

  constructor() {
    this.restoreLastPrinter();
  }

  public subscribe(listener: (info: ConnectedPrinterInfo | null) => void) {
    this.listeners.add(listener);
    listener(this.currentPrinter);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const l of this.listeners) {
      l(this.currentPrinter);
    }
  }

  public getConnectedPrinter(): ConnectedPrinterInfo | null {
    return this.currentPrinter;
  }

  public isConnected(): boolean {
    return Boolean(this.bleCharacteristic || this.serialWriter);
  }

  private restoreLastPrinter() {
    try {
      const saved = localStorage.getItem("last_pos_thermal_printer");
      if (saved) {
        const parsed = JSON.parse(saved);
        this.currentPrinter = { ...parsed, connectedAt: Date.now() };
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

      const info: ConnectedPrinterInfo = {
        name: device.name || "PT-220 Thermal Printer",
        type: "bluetooth",
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
  public async printReceiptDirect(
    sale: ReceiptSale,
    header: ReceiptHeader,
    targetWidthDots = 384
  ): Promise<void> {
    const canvas = renderReceiptToCanvas(sale, header, targetWidthDots);
    const escPosBytes = this.canvasToEscPosRaster(canvas, targetWidthDots);
    await this.writeRaw(escPosBytes);
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

              const luminance = a < 128 ? 255 : 0.299 * r + 0.587 * g + 0.114 * b;
              if (luminance < 175) {
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
   * Print a test slip to verify Bluetooth communication instantly
   */
  public async printTestSlip(businessName = "শেখ ফার্মা (Sheikh Pharma)") {
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
