#!/usr/bin/env node

/**
 * Generates the macOS menu bar (tray) icons as template images.
 *
 * Output: src/assets/tray/
 *   idleTemplate{,@2x,@3x}.png            – outlined ring + waveform bars (static)
 *   recording-<n>Template{,@2x,@3x}.png   – filled disc with knocked-out, animated bars
 *   processing-<n>Template{,@2x,@3x}.png  – outlined ring with faint, travelling bars
 *
 * Template images only use the alpha channel; macOS tints them to match the menu bar
 * (light/dark, wallpaper tint, highlighted state). No runtime dependencies: shapes are
 * rasterized with signed distance functions and written with a minimal PNG encoder.
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUTPUT_DIR = path.resolve(__dirname, "..", "src", "assets", "tray");

// Logical canvas in points (macOS menu bar icons are 16x16pt).
const SIZE = 16;
const CENTER = SIZE / 2;
const OUTER_RADIUS = 7.75;
const RING_STROKE = 1.5;
const BAR_WIDTH = 1.8;
const BAR_GAP = 1.1;
const MIN_BAR_HEIGHT = 2.4;
const SCALES = [1, 2, 3];
const SUPERSAMPLE = 4;

const RECORDING_FRAMES = 6;
const PROCESSING_FRAMES = 6;
const PROCESSING_BAR_ALPHA = 0.5;

// ---------------------------------------------------------------------------
// Signed distance functions (all in points, negative = inside)
// ---------------------------------------------------------------------------

function sdCircle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r;
}

function sdRing(px, py, cx, cy, midRadius, halfStroke) {
  return Math.abs(Math.hypot(px - cx, py - cy) - midRadius) - halfStroke;
}

function sdRoundedRect(px, py, cx, cy, halfW, halfH, radius) {
  const qx = Math.abs(px - cx) - (halfW - radius);
  const qy = Math.abs(py - cy) - (halfH - radius);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return outside + inside - radius;
}

function sdBars(px, py, heights) {
  const total = heights.length * BAR_WIDTH + (heights.length - 1) * BAR_GAP;
  let x = CENTER - total / 2 + BAR_WIDTH / 2;
  let d = Infinity;
  for (const h of heights) {
    const height = Math.max(h, MIN_BAR_HEIGHT);
    d = Math.min(d, sdRoundedRect(px, py, x, CENTER, BAR_WIDTH / 2, height / 2, BAR_WIDTH / 2));
    x += BAR_WIDTH + BAR_GAP;
  }
  return d;
}

// ---------------------------------------------------------------------------
// Icon definitions: each icon is a list of layers { sdf(px, py), alpha }
// ---------------------------------------------------------------------------

function ringLayer() {
  const mid = OUTER_RADIUS - RING_STROKE / 2;
  return { alpha: 1, sdf: (x, y) => sdRing(x, y, CENTER, CENTER, mid, RING_STROKE / 2) };
}

function barsLayer(heights, alpha = 1) {
  return { alpha, sdf: (x, y) => sdBars(x, y, heights) };
}

function filledDiscWithCutoutBars(heights) {
  return {
    alpha: 1,
    sdf: (x, y) => Math.max(sdCircle(x, y, CENTER, CENTER, OUTER_RADIUS), -sdBars(x, y, heights)),
  };
}

const IDLE_HEIGHTS = [4.4, 7.4, 4.4];

function recordingHeights(frame) {
  const t = (frame / RECORDING_FRAMES) * Math.PI * 2;
  return [5.0 + 1.8 * Math.sin(t), 6.8 + 1.6 * Math.sin(t + 2.1), 5.0 + 1.8 * Math.sin(t + 4.2)];
}

function processingHeights(frame) {
  const t = (frame / PROCESSING_FRAMES) * Math.PI * 2;
  return [0, 1, 2].map((i) => 3.8 + 1.3 * Math.sin(t - (i * Math.PI * 2) / 3));
}

function buildIcons() {
  const icons = [{ name: "idle", layers: [ringLayer(), barsLayer(IDLE_HEIGHTS)] }];

  for (let i = 0; i < RECORDING_FRAMES; i++) {
    icons.push({ name: `recording-${i}`, layers: [filledDiscWithCutoutBars(recordingHeights(i))] });
  }

  for (let i = 0; i < PROCESSING_FRAMES; i++) {
    icons.push({
      name: `processing-${i}`,
      layers: [ringLayer(), barsLayer(processingHeights(i), PROCESSING_BAR_ALPHA)],
    });
  }

  return icons;
}

// ---------------------------------------------------------------------------
// Rasterizer
// ---------------------------------------------------------------------------

function coverage(distancePx) {
  return Math.min(1, Math.max(0, 0.5 - distancePx));
}

function rasterize(layers, scale) {
  const px = SIZE * scale;
  const rgba = Buffer.alloc(px * px * 4, 0);
  const step = 1 / SUPERSAMPLE;

  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      let alphaSum = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const ptX = (x + (sx + 0.5) * step) / scale;
          const ptY = (y + (sy + 0.5) * step) / scale;
          let alpha = 0;
          for (const layer of layers) {
            const c = coverage(layer.sdf(ptX, ptY) * scale) * layer.alpha;
            alpha = alpha + c * (1 - alpha);
          }
          alphaSum += alpha;
        }
      }
      const offset = (y * px + x) * 4;
      // Template images: black + alpha.
      rgba[offset + 3] = Math.round((alphaSum / (SUPERSAMPLE * SUPERSAMPLE)) * 255);
    }
  }

  return { width: px, height: px, rgba };
}

// ---------------------------------------------------------------------------
// Minimal PNG encoder (8-bit RGBA, no interlace)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng({ width, height, rgba }) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const existing of fs.readdirSync(OUTPUT_DIR)) {
    if (/Template(@\dx)?\.png$/.test(existing)) {
      fs.unlinkSync(path.join(OUTPUT_DIR, existing));
    }
  }

  let written = 0;
  for (const icon of buildIcons()) {
    for (const scale of SCALES) {
      const suffix = scale === 1 ? "" : `@${scale}x`;
      const fileName = `${icon.name}Template${suffix}.png`;
      fs.writeFileSync(path.join(OUTPUT_DIR, fileName), encodePng(rasterize(icon.layers, scale)));
      written++;
    }
  }

  console.log(`[tray-icons] Wrote ${written} files to ${path.relative(process.cwd(), OUTPUT_DIR)}`);
}

main();
