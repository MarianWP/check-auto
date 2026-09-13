/* Генерує PNG-іконки без залежностей: синій градієнт + біле кільце з галочкою.
   Запуск: node tools/make-icons.js */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function crc32(buf) {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

/* Геометрія у нормованих координатах 0..1 */
function distSeg(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)));
  const dx = px - (ax + t * vx), dy = py - (ay + t * vy);
  return Math.hypot(dx, dy);
}
const CHECK = [[0.31, 0.52], [0.445, 0.665], [0.70, 0.375]];
const STROKE = 0.095;
const RING_R = 0.335, RING_W = 0.055;

function coverage(x, y, rounded, size) {
  /* повертає {bg, white} — частку білого і чи всередині фону (для скруглених кутів) */
  let inBg = 1;
  if (rounded) {
    const r = 0.225; /* радіус кутів як у iOS */
    const cx = Math.min(Math.max(x, r), 1 - r), cy = Math.min(Math.max(y, r), 1 - r);
    const d = Math.hypot(x - cx, y - cy);
    inBg = d <= r ? 1 : 0;
  }
  let white = 0;
  const d1 = distSeg(x, y, ...CHECK[0], ...CHECK[1]);
  const d2 = distSeg(x, y, ...CHECK[1], ...CHECK[2]);
  if (Math.min(d1, d2) <= STROKE / 2) white = 1;
  const dr = Math.abs(Math.hypot(x - 0.5, y - 0.5) - RING_R);
  if (dr <= RING_W / 2) white = 1;
  return { inBg, white };
}

function render(size, rounded) {
  const out = Buffer.alloc(size * size * 4);
  const SS = 4;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bgAcc = 0, whiteAcc = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const x = (px + (sx + 0.5) / SS) / size, y = (py + (sy + 0.5) / SS) / size;
        const c = coverage(x, y, rounded, size);
        bgAcc += c.inBg; whiteAcc += c.inBg * c.white;
      }
      const a = bgAcc / (SS * SS), w = whiteAcc / (SS * SS);
      const t = (px / size + py / size) / 2; /* діагональний градієнт */
      const r0 = 62 + (14 - 62) * t, g0 = 140 + (96 - 140) * t, b0 = 255 + (226 - 255) * t;
      const r = r0 * (1 - w) + 255 * w, g = g0 * (1 - w) + 255 * w, b = b0 * (1 - w) + 255 * w;
      const i = (py * size + px) * 4;
      out[i] = Math.round(r); out[i + 1] = Math.round(g); out[i + 2] = Math.round(b); out[i + 3] = Math.round(255 * a);
    }
  }
  return png(size, size, out);
}

const dir = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(dir, { recursive: true });
const jobs = [
  ["icon-512.png", 512, false],
  ["icon-192.png", 192, false],
  ["apple-touch-icon.png", 180, false],
  ["icon-maskable-512.png", 512, false],
  ["favicon-64.png", 64, true]
];
for (const [name, size, rounded] of jobs) {
  fs.writeFileSync(path.join(dir, name), render(size, rounded));
  console.log("ok", name, size);
}
