#!/usr/bin/env node
/**
 * THE APP ICONS — the AO helm (v4 mark 2a, OWNER-RULINGS R14; ARCHITECTURE A6).
 *
 * Re-cut 2026-10-09: the sextant (L2) is retired. One master, `helm.svg`, now
 * serves icon and maskable alike, because the mark already sits inside the
 * maskable safe circle — so the old «maskable must differ from icon» pin is
 * replaced by the thing it stood for, MEASURED on the pixels: everything drawn
 * stays inside the circle Android may mask to.
 *
 * Pixels, not file sizes: a rasteriser that wrote a blank canvas would still
 * write a well-formed PNG of a plausible size.
 */
import { readFileSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { forSize, SMALL_MAX_PX, STARTUP } from './make-icons.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const ICONS = join(ROOT, 'public', 'icons');

let pass = 0;
const failures = [];
const eq = (a, b, label) => {
  if (Object.is(a, b)) { pass++; return; }
  failures.push(`${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const ok = (c, label) => eq(!!c, true, label);

// ——————————————————————— a minimal PNG reader (8-bit RGB or RGBA, non-interlaced)
function decodePng(buf) {
  eq(buf.readUInt32BE(0), 0x89504e47, 'the file starts with the PNG signature');
  let off = 8, w = 0, h = 0, depth = 0, colour = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; colour = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += len + 12;
  }
  if (depth !== 8 || (colour !== 6 && colour !== 2)) throw new Error(`unsupported PNG: depth ${depth}, colour type ${colour}`);
  const bpp = colour === 6 ? 4 : 3, stride = w * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(h * stride);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      const v = line[x];
      out[y * stride + x] = 255 & (filter === 0 ? v : filter === 1 ? v + a : filter === 2 ? v + b
        : filter === 3 ? v + ((a + b) >> 1) : v + paeth(a, b, c));
    }
  }
  return { w, h, px: (x, y) => { const i = y * stride + x * bpp; return [out[i], out[i + 1], out[i + 2], bpp === 4 ? out[i + 3] : 255]; } };
}

// ——————————————————————— the source: the 2a geometry, verbatim (R14)
const master = readFileSync(join(ICONS, 'helm.svg'), 'utf8');
for (const g of [
  '<circle cx="60" cy="60" r="40" fill="none" stroke="#D9A441" stroke-width="9"/>',
  'd="M60 7v10M60 103v10M7 60h10M103 60h10" stroke="#3E7CA6"',
  'd="M43 83 L60 33 L77 83" fill="none" stroke="#2C4356"',
  'd="M49 67 h22" stroke="#3E7CA6"',
]) ok(master.includes(g), `the master carries v4 #2a's geometry: ${g.slice(0, 48)}…`);
ok(!/<text|<tspan|font-family/.test(master), 'the mark carries no letterforms — the A is a drawn needle, not a font');
ok(!existsSync(join(ICONS, 'sextant.svg')), 'the retired L2 sextant is gone (R14)');
// ≤48px: the bold variant without the crossbar (v4 #2a's home-screen tile)
ok(forSize(master, 512).includes('id="crossbar"'), 'at 512px the crossbar is drawn');
ok(!forSize(master, SMALL_MAX_PX).includes('crossbar') && forSize(master, SMALL_MAX_PX).includes('stroke-width="11"'),
  `at ${SMALL_MAX_PX}px and below the crossbar goes and the strokes thicken`);

// ——————————————————————— the rendered output
const AMBER = ([r, g, b]) => r > 190 && g > 140 && g < 185 && b < 90;
const HARBOR = ([r, g, b]) => b > 140 && r < 90 && b > r + 60;
const INK = ([r, g, b]) => r < 60 && g < 80 && b < 100;
for (const [name, px] of [['apple-touch-icon-180.png', 180], ['icon-192.png', 192], ['icon-512.png', 512], ['maskable-512.png', 512]]) {
  const p = join(ICONS, name);
  if (!existsSync(p)) { failures.push(`${name} is missing — run \`npm run icons\``); continue; }
  const img = decodePng(readFileSync(p));
  eq(img.w, px, `${name} is ${px}px wide`);
  eq(img.h, px, `${name} is ${px}px tall`);
  let amber = 0, harbor = 0, ink = 0, transparent = 0, far = 0;
  const c = px / 2;
  for (let y = 0; y < img.h; y += 2) {
    for (let x = 0; x < img.w; x += 2) {
      const v = img.px(x, y);
      if (v[3] < 250) transparent++;
      const isMark = AMBER(v) || HARBOR(v) || INK(v);
      if (AMBER(v)) amber++; if (HARBOR(v)) harbor++; if (INK(v)) ink++;
      if (isMark) far = Math.max(far, Math.hypot(x - c, y - c));
    }
  }
  ok(amber > 20 && harbor > 10 && ink > 20, `${name}: ring, spokes and needle are all painted (${amber}/${harbor}/${ink})`);
  eq(transparent, 0, `${name}: fully opaque — an icon must reach every edge`);
  ok(far <= 0.4 * px, `${name}: every painted mark pixel lies inside the maskable safe circle (${(far / px * 100).toFixed(1)}% ≤ 40%)`);
  const [tr, , tb] = img.px(4, 4);
  ok(tr > tb, `${name}: the top-left corner is the dawn's sand wash`);
}

// ——————————————————————— the launch images, and the page that names them
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
for (const t of STARTUP) {
  const p = join(ROOT, 'public', t.out);
  ok(existsSync(p), `${t.out} exists`);
  ok(html.includes(`media="${t.media}" href="${t.out}"`), `index.html links ${t.out} for ${t.w}×${t.h}@${t.s}`);
}
const cfg = readFileSync(join(ROOT, 'vite.config.js'), 'utf8');
ok(/globIgnores: \['\*\*\/icons\/startup-\*\.png'\]/.test(cfg), 'the ~4.5 MB of launch images are NEVER precached (iOS fetches its one at install)');
ok(/name="apple-mobile-web-app-status-bar-style" content="default"/.test(html), 'the status bar is «default» — dark text over the light ground (A6)');
ok(/name="theme-color" content="#FAF7F1"/.test(html), 'the theme colour is the paper (A6)');

const report = failures.length
  ? `❌ ${failures.length} / ${pass + failures.length} icon checks failed:\n  - ${failures.join('\n  - ')}`
  : `✅ all ${pass} icon checks passed`;
console.log(report);
process.exit(failures.length ? 1 : 0);
