// Generate the screensaver's crosshatched head (meditations/screensaver/head-data.js)
// from the British Museum photo. screensaver-head.test.mjs fails when it is stale.
// Decoding the JPEG needs macOS `sips`; everything else is plain Node.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SOURCE = fileURLToPath(new URL('../../meditations/marcus-aurelius-british-museum.jpg', import.meta.url));
const OUTPUT = new URL('../../meditations/screensaver/head-data.js', import.meta.url);

// The head in photo pixels, averaged down 2×: one drawing unit is two photo pixels.
const CROP = { x: 620, y: 170, width: 780, height: 950 };
const SCALE = 2;
const W = CROP.width / SCALE, H = CROP.height / SCALE; // 390 × 475
const PIVOT = [190, 265]; // the neck axis: mid-head, ear level
const REST_YAW = (10 * Math.PI) / 180; // the bust looks slightly to his right; face the viewer
const LINE_WIDTH = 0.42;
// Hatching layers: angle (degrees), minimum ink, spacing (drawing units).
const LAYERS = [[38, 0.2, 3.2], [-52, 0.38, 3.2], [82, 0.56, 3.0], [8, 0.74, 2.8]];
// The lower lids are soft in the marble and vanish in the hatching, so the
// eyes get a touch more ink, most of it just below them. [x, y] per eye.
const EYES = [[107, 238], [212, 228]];
// Sculpted features on the photographed head: [depth, x, y, spread x, spread y].
const FEATURES = [
  [28, 159, 250, 9, 30],   // nose ridge
  [30, 157, 287, 13, 12],  // nose tip
  [10, 162, 208, 60, 9],   // brow ridge
  [-16, 107, 238, 20, 13], // eye sockets
  [-16, 212, 228, 20, 13],
  [7, 95, 270, 22, 20],    // cheekbones
  [7, 240, 265, 22, 20],
  [8, 160, 330, 30, 12],   // lips
  [22, 170, 395, 75, 55],  // beard
];

export function readPhoto(file = SOURCE) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'screensaver-head-'));
  try {
    const bmp = path.join(dir, 'photo.bmp');
    // sips exits 0 even when it skips a file, so check for its output instead.
    const { error, stderr } = spawnSync('sips', ['-s', 'format', 'bmp', file, '--out', bmp], { encoding: 'utf8' });
    if (!fs.existsSync(bmp)) throw new Error(`sips could not convert ${file}: ${error?.message ?? stderr.trim()}`);
    return fs.readFileSync(bmp);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Luminance (0–1) of the crop, averaged down, from an uncompressed 24-bit BMP.
function luminance(bmp) {
  if (bmp.toString('latin1', 0, 2) !== 'BM' || bmp.readUInt16LE(28) !== 24 || bmp.readUInt32LE(30) !== 0) {
    throw new Error('Expected an uncompressed 24-bit BMP from sips');
  }
  const offset = bmp.readUInt32LE(10), width = bmp.readInt32LE(18), rows = bmp.readInt32LE(22);
  const height = Math.abs(rows), stride = Math.ceil((width * 3) / 4) * 4;
  if (CROP.x + CROP.width > width || CROP.y + CROP.height > height) throw new Error('Crop is outside the photo');
  const lum = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let sum = 0;
    for (let dy = 0; dy < SCALE; dy++) for (let dx = 0; dx < SCALE; dx++) {
      const py = CROP.y + y * SCALE + dy, px = CROP.x + x * SCALE + dx;
      const i = offset + (rows < 0 ? py : height - 1 - py) * stride + px * 3; // BGR
      sum += 0.0722 * bmp[i] + 0.7152 * bmp[i + 1] + 0.2126 * bmp[i + 2];
    }
    lum[y * W + x] = sum / (255 * SCALE * SCALE);
  }
  return lum;
}

// Three box blurs approximate a Gaussian.
function blur(source, radius, passes = 3) {
  const a = Float32Array.from(source), b = new Float32Array(source.length);
  for (let pass = 0; pass < passes; pass++) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let sum = 0, n = 0;
      for (let k = -radius; k <= radius; k++) if (x + k >= 0 && x + k < W) { sum += a[y * W + x + k]; n++; }
      b[y * W + x] = sum / n;
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let sum = 0, n = 0;
      for (let k = -radius; k <= radius; k++) if (y + k >= 0 && y + k < H) { sum += b[(y + k) * W + x]; n++; }
      a[y * W + x] = sum / n;
    }
  }
  return a;
}

const smoothstep = (edge0, edge1, v) => {
  const t = Math.min(1, Math.max(0, (v - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

// Marble is everything a flood fill of dark backdrop from the border cannot reach.
// An egg-shaped ellipse keeps hair to beard and fades out the drapery below.
function headMask(lum) {
  const backdrop = new Uint8Array(W * H), stack = [];
  const push = (x, y) => {
    const i = y * W + x;
    if (!backdrop[i] && lum[i] < 0.36) { backdrop[i] = 1; stack.push(i); }
  };
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
  while (stack.length) {
    const i = stack.pop(), x = i % W, y = (i - x) / W;
    if (x > 0) push(x - 1, y);
    if (x < W - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < H - 1) push(x, y + 1);
  }
  const marble = blur(Float32Array.from(backdrop, v => 1 - v), 1, 2);
  const mask = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x - 190) / 205, dy = (y - 237) / (y < 237 ? 260 : 240);
    mask[y * W + x] = marble[y * W + x] * (1 - smoothstep(0.84, 1, Math.hypot(dx, dy)));
  }
  return mask;
}

// Ink: darkness within the marble's own tonal range, plus local detail, so the
// carved curls keep their edges and the smooth face does not turn to haze.
function inkField(lum, mask) {
  const tones = [];
  for (let i = 0; i < W * H; i++) if (mask[i] > 0.5) tones.push(lum[i]);
  tones.sort((a, b) => a - b);
  const lo = tones[Math.floor(tones.length * 0.02)], hi = tones[Math.floor(tones.length * 0.985)];
  const dark = Float32Array.from(lum, v => 1 - Math.min(1, Math.max(0, (v - lo) / (hi - lo))));
  const surroundings = blur(dark, 4);
  return Float32Array.from(dark, (d, i) => {
    const x = i % W, y = (i - x) / W;
    let eyes = 0;
    for (const [ex, ey] of EYES) {
      eyes += 0.4 * Math.exp(-(((x - ex) / 22) ** 2 + ((y - ey) / 12) ** 2) / 2)
        + Math.exp(-(((x - ex) / 20) ** 2 + ((y - ey - 10) / 7) ** 2) / 2);
    }
    const detail = Math.max(0, d - surroundings[i]);
    return Math.min(1, 0.55 * d ** 1.8 + (2.4 + 1.6 * eyes) * detail + 0.1 * eyes * d) * mask[i];
  });
}

function sample(field, x, y) {
  if (x < 0 || y < 0 || x >= W - 1 || y >= H - 1) return 0;
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, i = y0 * W + x0;
  return (field[i] * (1 - fx) + field[i + 1] * fx) * (1 - fy) + (field[i + W] * (1 - fx) + field[i + W + 1] * fx) * fy;
}

// Seeded, so regenerating is reproducible byte for byte.
function seeded(seed) {
  return () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
}

// Layered hatching: each layer only where the ink passes its threshold, broken
// into short, slightly wobbly pen strokes. Returns straight segments [x0, y0, x1, y1].
function hatch(ink, random = seeded(7)) {
  const segments = [], reach = Math.hypot(W, H) / 2;
  for (const [angle, threshold, gap] of LAYERS) {
    const ux = Math.cos((angle * Math.PI) / 180), uy = Math.sin((angle * Math.PI) / 180);
    for (let offset = -reach; offset < reach; offset += gap) {
      let first = null, last = null, length = 0, limit = 10 + random() * 26;
      const end = () => {
        if (first && length > 3) segments.push([first[0], first[1], last[0], last[1]]);
        first = last = null;
        length = 0;
        limit = 10 + random() * 26;
      };
      const phase = random() * 100;
      for (let t = -reach; t < reach; t += 1.2) {
        const wobble = 0.35 * Math.sin((t + phase) * 0.21) + 0.25 * Math.sin((t + phase) * 0.057);
        const x = W / 2 + ux * t - uy * (offset + wobble), y = H / 2 + uy * t + ux * (offset + wobble);
        if (sample(ink, x, y) > threshold + 0.05 * Math.sin(t * 0.9 + offset)) {
          first ??= [x, y];
          last = [x, y];
          length += 1.2;
          if (length > limit) { end(); t += 0.8 + random() * 1.5; }
        } else end();
      }
      end();
    }
  }
  return segments;
}

// Sculpted depth toward the viewer, in drawing units: a rounded-box skull (it
// fits the mass of curls) that falls smoothly to the rotation axis at the
// silhouette, plus the features a small turn reveals. A steeper rim, like an
// ellipsoid's, would smear the strokes at the edge into streaks.
export function depth(x, y) {
  const r = Math.min(1, (Math.abs((x - 190) / 190) ** 3 + Math.abs((y - 235) / 235) ** 3) ** (1 / 3));
  let z = 175 * (1 - r * r);
  for (const [amount, cx, cy, sx, sy] of FEATURES) {
    z += amount * Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2) / 2);
  }
  return z;
}

// Flat [x0, y0, z0, dx, dy, dz, …] in half units (finer than a 10%-opacity hatch
// can show): the first end relative to the pivot, counter-rotated so the rest pose
// faces the viewer, and the second end relative to the first, which keeps it short.
export function headStrokes(bmp = readPhoto()) {
  const lum = luminance(bmp);
  const ink = inkField(lum, headMask(lum));
  const cos = Math.cos(REST_YAW), sin = Math.sin(REST_YAW), numbers = [];
  const end = (x, y) => {
    const z = depth(x, y), dx = x - PIVOT[0];
    return [dx * cos + z * sin, y - PIVOT[1], z * cos - dx * sin].map(v => Math.round(v * 2));
  };
  for (const [x0, y0, x1, y1] of hatch(ink)) {
    const a = end(x0, y0), b = end(x1, y1);
    numbers.push(...a, b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  }
  return numbers;
}

export function formatHeadData(numbers) {
  const rows = [];
  for (let i = 0; i < numbers.length; i += 60) rows.push(`    ${numbers.slice(i, i + 60).join(',')},`);
  return `// Generated by tools/meditations-search/build-screensaver-head.mjs. Do not edit.
// Crosshatch drawing after a photograph of a marble bust of Marcus Aurelius
// (British Museum 1861,1127.15, https://www.britishmuseum.org/collection/object/G_1861-1127-15),
// © The Trustees of the British Museum, CC BY-NC-SA 4.0
// (https://creativecommons.org/licenses/by-nc-sa/4.0/). Adapted: traced as
// crosshatching and given a sculpted depth. Shared under the same licence.
// strokes: [x0, y0, z0, dx, dy, dz, …] in half units; the first end is relative to
// the pivot, the second to the first. Decoded by strokeVertices() in head.js.
export default {
  width: ${W},
  height: ${H},
  pivot: [${PIVOT.join(', ')}],
  lineWidth: ${LINE_WIDTH},
  strokes: [
${rows.join('\n')}
  ],
};
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const numbers = headStrokes();
  fs.writeFileSync(OUTPUT, formatHeadData(numbers));
  console.log(`OK ${numbers.length / 6} strokes`);
}
