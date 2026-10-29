// Genera le immagini del marchio che servono fuori dal sito: l'anteprima dei link (og-image.png) e l'icona
// per la schermata Home dei telefoni (apple-touch-icon.png). Nessuna dipendenza: disegna i tre strati del
// logo con un rasterizzatore minimo e scrive il PNG con zlib. Da rilanciare solo se cambia il marchio:
//   node tools/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../public/assets/', import.meta.url));
const SAMPLES = 3; // 3x3 campioni per pixel: bordi morbidi

/** oklch -> sRGB 0..255 (stessi colori di tokens.css, tema scuro). */
function oklch(l, c, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  const lin = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_,
  ];
  return lin.map((v) => {
    const x = Math.min(1, Math.max(0, v));
    return Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055));
  });
}

const BG = oklch(0.158, 0.006, 60);
const SIGNAL = oklch(0.72, 0.17, 52);
const mix = (amount) => SIGNAL.map((channel, i) => Math.round(channel * amount + BG[i] * (1 - amount)));
// Gli strati come in ShellView/components.css: in alto pieno, al centro 68%, alla base 42%.
const LAYERS = [
  { x: 12, y: 6, w: 16, h: 7, color: SIGNAL },
  { x: 7, y: 16, w: 26, h: 7, color: mix(0.68) },
  { x: 2, y: 26, w: 36, h: 8, color: mix(0.42) },
];
const RADIUS = 1.5;

function inRoundedRect(px, py, { x, y, w, h }) {
  if (px < x || px > x + w || py < y || py > y + h) return false;
  const cx = Math.min(Math.max(px, x + RADIUS), x + w - RADIUS);
  const cy = Math.min(Math.max(py, y + RADIUS), y + h - RADIUS);
  return (px - cx) ** 2 + (py - cy) ** 2 <= RADIUS ** 2;
}

/** Disegna il marchio (viewBox 40x40) centrato, alto `markSize` pixel, su fondo pieno. */
function render(width, height, markSize) {
  const scale = markSize / 40;
  const left = (width - markSize) / 2;
  const top = (height - markSize) / 2;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 3 + 1)] = 0; // filtro "nessuno"
    for (let x = 0; x < width; x += 1) {
      const sum = [0, 0, 0];
      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const u = (x + (sx + 0.5) / SAMPLES - left) / scale;
          const v = (y + (sy + 0.5) / SAMPLES - top) / scale;
          const layer = LAYERS.find((item) => inRoundedRect(u, v, item));
          const color = layer ? layer.color : BG;
          sum[0] += color[0]; sum[1] += color[1]; sum[2] += color[2];
        }
      }
      const at = y * (width * 3 + 1) + 1 + x * 3;
      for (let c = 0; c < 3; c += 1) raw[at + c] = Math.round(sum[c] / (SAMPLES * SAMPLES));
    }
  }
  return raw;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}
function png(width, height, raw) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit per canale
  header[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [file, width, height, mark] of [
  ['og-image.png', 1200, 630, 340],
  ['apple-touch-icon.png', 180, 180, 120],
]) {
  const data = png(width, height, render(width, height, mark));
  writeFileSync(OUT + file, data);
  console.log(`${file}: ${width}x${height}, ${(data.length / 1024).toFixed(1)} kB`);
}
