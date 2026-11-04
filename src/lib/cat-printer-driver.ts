/**
 * Cat Printer (MX04, GT01, GB01, WalkPrint, iPrint, FunPrint) BLE Protocol Driver
 * Supports 384-dot (48 bytes/row) 200 DPI thermal printing via proprietary 0x5178 packets.
 * Optimized for high-density, jet-black, authentic POS receipt output.
 */

const CHECKSUM_TABLE = new Uint8Array([
  0, 7, 14, 9, 28, 27, 18, 21, 56, 63, 54, 49, 36, 35, 42, 45, 112, 119, 126, 121,
  108, 107, 98, 101, 72, 79, 70, 65, 84, 83, 90, 93, 224, 231, 238, 233, 252, 251,
  242, 245, 216, 223, 214, 209, 196, 195, 202, 205, 144, 151, 158, 153, 140, 139,
  130, 133, 168, 175, 166, 161, 180, 179, 186, 189, 199, 192, 201, 206, 219, 220,
  213, 210, 255, 248, 241, 246, 227, 228, 237, 234, 183, 176, 185, 190, 171, 172,
  165, 162, 143, 136, 129, 134, 147, 148, 157, 154, 39, 32, 41, 46, 59, 60, 53, 50,
  31, 24, 17, 22, 3, 4, 13, 10, 87, 80, 89, 94, 75, 76, 69, 66, 111, 104, 97, 102,
  115, 116, 125, 122, 137, 142, 135, 128, 149, 146, 155, 156, 177, 182, 191, 188,
  173, 170, 163, 164, 249, 254, 247, 240, 229, 226, 235, 236, 193, 198, 207, 204,
  221, 218, 211, 212, 105, 110, 103, 96, 117, 114, 123, 124, 81, 86, 95, 88, 77,
  74, 67, 68, 25, 30, 23, 16, 5, 2, 11, 12, 33, 38, 47, 40, 61, 58, 51, 52, 78,
  73, 64, 71, 82, 85, 92, 91, 118, 113, 120, 127, 106, 109, 100, 99, 62, 57, 48,
  55, 34, 37, 44, 43, 6, 1, 8, 15, 26, 29, 20, 19, 174, 169, 160, 167, 178, 181,
  188, 187, 150, 145, 152, 159, 138, 141, 132, 131, 222, 217, 208, 215, 194, 197,
  204, 203, 230, 225, 232, 239, 250, 253, 244, 243,
]);

export function calcCatCrc(data: Uint8Array, start = 0, length = data.length): number {
  let crc = 0;
  for (let i = start; i < start + length; i++) {
    crc = CHECKSUM_TABLE[(crc ^ data[i]) & 0xff];
  }
  return crc;
}

/**
 * Builds a 0x5178 protocol packet
 * Format: [0x51, 0x78, CMD, 0x00, LEN_LO, LEN_HI, ...PAYLOAD, CRC, 0xFF]
 */
export function buildCatPacket(cmd: number, payload: Uint8Array = new Uint8Array(0)): Uint8Array {
  const len = payload.length;
  const lenLo = len & 0xff;
  const lenHi = (len >> 8) & 0xff;

  const packet = new Uint8Array(6 + len + 2);
  packet[0] = 0x51;
  packet[1] = 0x78;
  packet[2] = cmd & 0xff;
  packet[3] = 0x00;
  packet[4] = lenLo;
  packet[5] = lenHi;

  if (len > 0) {
    packet.set(payload, 6);
  }

  const crc = len > 0 ? calcCatCrc(packet, 6, len) : 0;
  packet[6 + len] = crc;
  packet[6 + len + 1] = 0xff;

  return packet;
}

export const CAT_COMMANDS = {
  GET_DEV_STATE: buildCatPacket(0xa3, new Uint8Array([0x00])),
  SET_QUALITY_200_DPI: buildCatPacket(0xa4, new Uint8Array([0x32])),
  LATTICE_START: buildCatPacket(0xa6, new Uint8Array([0xaa, 0x55, 0x17, 0x38, 0x44, 0x5f, 0x5f, 0x5f, 0x44, 0x38, 0x2c])),
  LATTICE_END: buildCatPacket(0xa6, new Uint8Array([0xaa, 0x55, 0x17, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x17])),
  APPLY_ENERGY: buildCatPacket(0xbe, new Uint8Array([0x01])),
};

/**
 * Sets print energy / darkness
 * Cat printer BLE requires a 4-byte little-endian payload
 */
export function catSetEnergy(energy = 28000): Uint8Array {
  return buildCatPacket(
    0xaf,
    new Uint8Array([
      energy & 0xff,
      (energy >> 8) & 0xff,
      (energy >> 16) & 0xff,
      (energy >> 24) & 0xff,
    ])
  );
}

/**
 * Sets motor speed (lower = slower feed = deeper thermal heat burn = rich jet-black output)
 */
export function catSetSpeed(speed = 16): Uint8Array {
  return buildCatPacket(0xbd, new Uint8Array([speed & 0xff]));
}

/**
 * Feeds paper forward by specified lines (Command 0xA1)
 */
export function catFeedPaper(lines = 70): Uint8Array {
  return buildCatPacket(0xa1, new Uint8Array([lines & 0xff, (lines >> 8) & 0xff]));
}

/**
 * Converts a 384-element row array (1 for black, 0 for white) into exactly 48 bytes (LSB first)
 */
export function byteEncode(row: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(48); // 384 dots / 8 = 48 bytes
  for (let col = 0; col < 48; col++) {
    let b = 0;
    const offset = col * 8;
    for (let bit = 0; bit < 8; bit++) {
      if (row[offset + bit] === 1) {
        b |= 1 << bit; // Standard LSB first bit ordering for Cat Printer
      }
    }
    bytes[col] = b;
  }
  return bytes;
}

/**
 * Builds a single 48-byte raw image row packet for Cat Printer.
 * ALWAYS uses pure 0xA2 raw bitmap.
 * CRITICAL: Never use 0xBF (RLE) on MX04 because cheap JieLi microcontrollers do not decompress RLE,
 * which squishes rows horizontally into microscopic illegible dots.
 */
export function buildCatRowPacket(row: Uint8Array): Uint8Array {
  const rawBytes = byteEncode(row);
  return buildCatPacket(0xa2, rawBytes);
}

/**
 * Encodes a 384px wide 2D HTML Canvas into a series of Cat Printer BLE packets.
 */
export function canvasToCatPrinterPackets(
  canvas: HTMLCanvasElement,
  energy = 28000
): Uint8Array[] {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas 2D context");

  const width = 384;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const pixels = imgData.data;

  const packets: Uint8Array[] = [];

  // 1. Initial Wakeup & Deep Thermal Contrast Configuration
  packets.push(CAT_COMMANDS.GET_DEV_STATE);
  packets.push(CAT_COMMANDS.SET_QUALITY_200_DPI);
  packets.push(catSetSpeed(16)); // Slow steady motor speed for dark, crisp burn
  packets.push(catSetEnergy(energy)); // High energy (28000) for jet-black text
  packets.push(CAT_COMMANDS.APPLY_ENERGY);
  packets.push(CAT_COMMANDS.LATTICE_START);

  // 2. Row by row pixel encoding (pure 0xA2 raw bitmap across all 384 dots)
  const rowBuffer = new Uint8Array(width);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x++) {
      const idx = rowOffset + x * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const a = pixels[idx + 3];

      // High-contrast thresholding: Solid black if lum < 205 (prevents thin antialiasing dropouts)
      const lum = a < 128 ? 255 : (r * 299 + g * 587 + b * 114) / 1000;
      rowBuffer[x] = lum < 205 ? 1 : 0;
    }
    packets.push(buildCatRowPacket(rowBuffer));
  }

  // 3. Finalize lattice, paper feed & device state
  packets.push(CAT_COMMANDS.LATTICE_END);
  packets.push(catFeedPaper(70)); // Clean paper feed so receipt clears tear cutter
  packets.push(CAT_COMMANDS.GET_DEV_STATE);

  return packets;
}

/**
 * Generates an authentic, bold, full-width POS slip canvas for Cat Printer
 */
export function renderCatTestSlipCanvas(businessName = "শেখ ফার্মা (Sheikh Pharma)"): HTMLCanvasElement {
  const width = 384;
  const height = 480;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#000000";
  ctx.strokeStyle = "#000000";

  let y = 28;

  // 1. Business Header (Big, bold, authentic POS title)
  ctx.textAlign = "center";
  ctx.font = "900 34px 'Courier New', Consolas, sans-serif";
  ctx.fillText("SHEIKH PHARMA", width / 2, y);
  y += 28;

  ctx.font = "bold 20px 'Courier New', Consolas, monospace";
  ctx.fillText("Hospital Road, Cumilla", width / 2, y);
  y += 24;
  ctx.fillText("Mob: 01700-000000", width / 2, y);
  y += 18;

  // Double Line Divider
  const drawDoubleLine = (currY: number) => {
    ctx.save();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(8, currY);
    ctx.lineTo(width - 8, currY);
    ctx.moveTo(8, currY + 4);
    ctx.lineTo(width - 8, currY + 4);
    ctx.stroke();
    ctx.restore();
  };

  const drawDashed = (currY: number) => {
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(8, currY);
    ctx.lineTo(width - 8, currY);
    ctx.stroke();
    ctx.restore();
  };

  drawDoubleLine(y);
  y += 24;

  // Banner
  ctx.font = "900 22px 'Courier New', Consolas, monospace";
  ctx.fillText("*** TEST RECEIPT / পরীক্ষা রসিদ ***", width / 2, y);
  y += 20;
  drawDashed(y);
  y += 22;

  // Meta rows
  ctx.font = "bold 21px 'Courier New', Consolas, monospace";
  const row = (left: string, right: string) => {
    ctx.textAlign = "left";
    ctx.fillText(left, 10, y);
    ctx.textAlign = "right";
    ctx.fillText(right, width - 10, y);
    y += 25;
  };

  row("Printer :", "MX04 Cat Ear (58mm)");
  row("Driver  :", "384-Dot Direct BLE");
  row("Density :", "High Energy (28000)");
  row("Time    :", new Date().toLocaleTimeString());

  drawDashed(y);
  y += 22;

  // Table Header
  ctx.font = "900 21px 'Courier New', Consolas, monospace";
  ctx.textAlign = "left";
  ctx.fillText("Item / বিবরণ", 10, y);
  ctx.textAlign = "right";
  ctx.fillText("Total (৳)", width - 10, y);
  y += 22;
  drawDashed(y);
  y += 22;

  // Sample items
  ctx.font = "bold 21px 'Courier New', Consolas, monospace";
  const itemRow = (name: string, calc: string, total: string) => {
    ctx.textAlign = "left";
    ctx.fillText(name, 10, y);
    y += 22;
    ctx.fillText(`  ${calc}`, 10, y);
    ctx.textAlign = "right";
    ctx.fillText(total, width - 10, y);
    y += 25;
  };

  itemRow("1. Napa Extra 500mg", "2 × 2.50", "5.00");
  itemRow("2. Seclo 20mg Cap", "5 × 7.00", "35.00");

  drawDashed(y);
  y += 18;

  // Grand Total Box
  drawDoubleLine(y);
  y += 26;
  ctx.font = "900 28px 'Courier New', Consolas, monospace";
  ctx.textAlign = "left";
  ctx.fillText("NET TOTAL:", 10, y);
  ctx.textAlign = "right";
  ctx.fillText("৳40.00", width - 10, y);
  y += 12;
  drawDoubleLine(y);
  y += 26;

  // Footer
  ctx.textAlign = "center";
  ctx.font = "900 20px 'Courier New', Consolas, monospace";
  ctx.fillText("WIRELESS POS PRINTING OK!", width / 2, y);
  y += 22;
  ctx.font = "bold 18px 'Courier New', Consolas, monospace";
  ctx.fillText("Driverless Web Bluetooth Ready", width / 2, y);

  return canvas;
}
