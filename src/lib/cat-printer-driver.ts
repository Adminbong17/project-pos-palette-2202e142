/**
 * Cat Printer (MX04, GT01, GB01, WalkPrint, iPrint, FunPrint) BLE Protocol Driver
 * Supports 384-dot (48 bytes/row) 200 DPI thermal printing via proprietary 0x5178 packets.
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
  SET_PAPER: buildCatPacket(0xa1, new Uint8Array([0x30, 0x00])),
  APPLY_ENERGY: buildCatPacket(0xbe, new Uint8Array([0x01])),
};

export function catSetEnergy(energy = 0xffff): Uint8Array {
  return buildCatPacket(0xaf, new Uint8Array([(energy >> 8) & 0xff, energy & 0xff]));
}

export function catFeedPaper(steps = 40): Uint8Array {
  return buildCatPacket(0xbd, new Uint8Array([steps & 0xff]));
}

function runLengthEncode(row: Uint8Array): number[] {
  const res: number[] = [];
  let count = 0;
  let lastVal = -1;

  const appendRepetition = (n: number, val: number) => {
    while (n > 0x7f) {
      res.push(0x7f | (val << 7));
      n -= 0x7f;
    }
    if (n > 0) {
      res.push((val << 7) | n);
    }
  };

  for (let i = 0; i < row.length; i++) {
    const val = row[i];
    if (val === lastVal) {
      count++;
    } else {
      if (lastVal !== -1) appendRepetition(count, lastVal);
      count = 1;
    }
    lastVal = val;
  }
  if (count > 0 && lastVal !== -1) {
    appendRepetition(count, lastVal);
  }
  return res;
}

function byteEncode(row: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(48); // 384 / 8 = 48 bytes
  for (let col = 0; col < 48; col++) {
    let b = 0;
    const offset = col * 8;
    for (let bit = 0; bit < 8; bit++) {
      if (row[offset + bit] === 1) {
        b |= 1 << bit; // Cat printers use bit 0 as first pixel in chunk
      }
    }
    bytes[col] = b;
  }
  return bytes;
}

/**
 * Builds a single image row packet for Cat Printer.
 * Tries RLE compression (CMD 0xBF); if not smaller than 48 bytes, falls back to raw bytes (CMD 0xA2).
 */
export function buildCatRowPacket(row: Uint8Array): Uint8Array {
  const rle = runLengthEncode(row);
  if (rle.length <= 48) {
    return buildCatPacket(0xbf, new Uint8Array(rle));
  }
  const rawBytes = byteEncode(row);
  return buildCatPacket(0xa2, rawBytes);
}

/**
 * Encodes a 384px wide 2D HTML Canvas into a series of Cat Printer BLE packets.
 */
export function canvasToCatPrinterPackets(
  canvas: HTMLCanvasElement,
  energy = 0xffff
): Uint8Array[] {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas 2D context");

  const width = 384;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const pixels = imgData.data;

  const packets: Uint8Array[] = [];

  // 1. Initial Wakeup & Configuration
  packets.push(CAT_COMMANDS.GET_DEV_STATE);
  packets.push(CAT_COMMANDS.SET_QUALITY_200_DPI);
  packets.push(catSetEnergy(energy));
  packets.push(CAT_COMMANDS.APPLY_ENERGY);
  packets.push(CAT_COMMANDS.LATTICE_START);

  // 2. Row by row pixel encoding
  const rowBuffer = new Uint8Array(width);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x++) {
      const idx = rowOffset + x * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const a = pixels[idx + 3];

      // Luminance thresholding (burn thermal dot if dark enough)
      const lum = a < 128 ? 255 : 0.299 * r + 0.587 * g + 0.114 * b;
      rowBuffer[x] = lum < 195 ? 1 : 0;
    }
    packets.push(buildCatRowPacket(rowBuffer));
  }

  // 3. Feed paper, finalize lattice & query state
  packets.push(catFeedPaper(50));
  packets.push(CAT_COMMANDS.SET_PAPER);
  packets.push(CAT_COMMANDS.SET_PAPER);
  packets.push(CAT_COMMANDS.LATTICE_END);
  packets.push(CAT_COMMANDS.GET_DEV_STATE);

  return packets;
}

/**
 * Generates a crisp test slip canvas for Cat Printer
 */
export function renderCatTestSlipCanvas(businessName = "শেখ ফার্মা (Sheikh Pharma)"): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 320;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";

  // Title
  ctx.font = "bold 26px sans-serif";
  ctx.fillText("SHEIKH PHARMA", 192, 40);

  ctx.font = "bold 16px sans-serif";
  ctx.fillText("MX04 Cat Ear Pocket Printer", 192, 68);
  ctx.fillText("384-Dot BLE Thermal Mode", 192, 90);

  // Divider
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(12, 105);
  ctx.lineTo(372, 105);
  ctx.stroke();

  // Specs & Info
  ctx.textAlign = "left";
  ctx.font = "bold 15px monospace";
  ctx.fillText("Printer: MX04 / Cat BLE", 20, 130);
  ctx.fillText("Resolution: 200 DPI (384px)", 20, 152);
  ctx.fillText("Protocol: 0x5178 Binary Engine", 20, 174);
  ctx.fillText(`Time: ${new Date().toLocaleTimeString()}`, 20, 196);

  // Status Box
  ctx.strokeRect(16, 215, 352, 50);
  ctx.textAlign = "center";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText("🐱 CAT PRINTER READY! 🐱", 192, 246);

  // Subtitle
  ctx.font = "bold 13px sans-serif";
  ctx.fillText("Wireless Receipt Printing OK", 192, 290);

  return canvas;
}
