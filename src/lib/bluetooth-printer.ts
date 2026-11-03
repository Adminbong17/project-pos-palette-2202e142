/**
 * Bluetooth & Serial Thermal Printer Driver (58mm / 80mm ESC/POS)
 * Supports:
 * 1. Web Bluetooth API (GATT BLE) - Direct zero-driver wireless connection
 * 2. Web Serial API (Bluetooth Virtual COM / USB) - Windows Bluetooth SPP pairing (Baud: 115200)
 * 3. High-Fidelity Canvas Rasterization (GS v 0) - 100% crystal clear Bengali & English text
 * 4. Ultra-fast direct text ESC/POS mode
 */

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
        // Note: browser security prevents auto-opening without user gesture, but we keep the name
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
      // Prompt user to select device
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: KNOWN_PRINTER_SERVICES,
      });

      if (!device) throw new Error("কোনো ডিভাইস সিলেক্ট করা হয়নি");

      const server = await device.gatt?.connect();
      if (!server) throw new Error("ব্লুটুথ কানেকশন পাওয়া যায়নি");

      // Auto-discover writable characteristic
      let writeChar: any = null;

      // Try known services first
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

      // Fallback: search all primary services if permitted
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
      // Web Serial handles large buffers directly
      await this.serialWriter.write(data);
      return;
    }

    if (this.bleCharacteristic) {
      // BLE GATT characteristics need small chunking to prevent MTU / buffer overflow
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        try {
          if (this.bleCharacteristic.writeValueWithResponse) {
            await this.bleCharacteristic.writeValueWithResponse(chunk);
          } else {
            await this.bleCharacteristic.writeValue(chunk);
          }
        } catch (_) {
          // Fallback to writeValue without response if needed
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
   * Convert an HTML DOM element (e.g. Receipt preview) into a crisp 58mm / 384-dot ESC/POS monochrome bitmap
   */
  public async printElementAsBitmap(
    element: HTMLElement,
    targetWidthDots = 384
  ): Promise<void> {
    const html2canvas = (await import("html2canvas")).default;

    // Clone and prepare element in isolated offscreen container
    const container = document.createElement("div");
    container.style.cssText = `position:fixed;left:-9999px;top:0;width:${targetWidthDots}px;background:#ffffff;color:#000000;box-sizing:border-box;`;
    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.width = `${targetWidthDots}px`;
    clone.style.maxWidth = `${targetWidthDots}px`;
    clone.style.margin = "0";
    clone.style.background = "#ffffff";
    clone.style.color = "#000000";
    container.appendChild(clone);
    document.body.appendChild(container);

    let canvas: HTMLCanvasElement;
    try {
      canvas = await html2canvas(clone, {
        width: targetWidthDots,
        scale: 1,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true,
      });
    } finally {
      container.remove();
    }

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

    // Slice image into vertical blocks (e.g. 64 rows per slice) to prevent buffer overflows
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

              // Luminance calculation
              const luminance = a < 128 ? 255 : 0.299 * r + 0.587 * g + 0.114 * b;
              if (luminance < 175) {
                // Black pixel
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
