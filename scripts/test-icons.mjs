#!/usr/bin/env node
/**
 * The app icon — "Sextant 4a / Dawn Sight" (D15).  `npm run check:icons`
 *
 * WHAT WENT WRONG BEFORE, and why this file exists. `maskable-512.png` was a
 * BYTE-IDENTICAL copy of `icon-512.png` — same md5 — so the icon declared as
 * safe for Android's adaptive mask had never been safe-zoned at all. Under a
 * circular mask its sun would simply have been sliced off. Nothing caught it:
 * the publish gate checks that the four files exist and are not gitignored,
 * which they were, and the failure is invisible until a launcher on a device
 * nobody here owns crops it.
 *
 * So this suite asserts the two things existence cannot:
 *   1. the SOURCE is the Owner's spec, character-exact, with no letterforms;
 *   2. the OUTPUT is what a user's launcher will actually see — decoded pixel by
 *      pixel, not trusted because the file is large enough to look plausible.
 *
 * The PNG reader below is ~50 lines of `zlib` rather than a dependency: adding a
 * package to this repo means adding it to the published site's supply chain, and
 * the whole decoder is smaller than the lockfile diff would be.
 */
import { readFileSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { forSize, INDEX_ARM_MIN_PX } from './make-icons.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ICONS = join(HERE, '..', 'public', 'icons');

let pass = 0;
const failures = [];
const eq = (a, b, label) => {
  if (Object.is(a, b)) { pass++; return; }
  failures.push(`${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const ok = (c, label) => eq(!!c, true, label);

// ——————————————————————— a minimal PNG reader (8-bit RGBA, non-interlaced)
function decodePng(buf) {
  eq(buf.readUInt32BE(0), 0x89504e47, 'the file starts with the PNG signature');
  let off = 8, w = 0, h = 0, depth = 0, colour = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; colour = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += len + 12;
  }
  if (depth !== 8 || colour !== 6) throw new Error(`unsupported PNG: depth ${depth}, colour type ${colour}`);
  const bpp = 4, stride = w * bpp;
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
      out[y * stride + x] = 255 & (
        filter === 0 ? v : filter === 1 ? v + a : filter === 2 ? v + b
          : filter === 3 ? v + ((a + b) >> 1) : v + paeth(a, b, c));
    }
  }
  return { w, h, px: (x, y) => [0, 1, 2, 3].map((i) => out[y * stride + x * bpp + i]) };
}

// ——————————————————————— the source
const master = readFileSync(join(ICONS, 'sextant.svg'), 'utf8');
const maskable = readFileSync(join(ICONS, 'sextant-maskable.svg'), 'utf8');

/** The Owner's spec, verbatim. A repaint that "tidies" any of these is a redesign. */
const GEOMETRY = [
  'd="M5 20 A 9.5 9.5 0 0 1 19 20"',
  'd="M12 8.6 L5 20"',
  'd="M12 8.6 L19 20"',
  'd="M8.6 14.2 L15.4 14.2"',
  'd="M12 8.6 L15.6 7"',
  'cx="17.4" cy="5.6" r="2.5"',
];
for (const g of GEOMETRY) {
  ok(master.includes(g), `the master carries the specified geometry: ${g}`);
  ok(maskable.includes(g), `and so does the maskable: ${g}`);
}
for (const [svg, name] of [[master, 'master'], [maskable, 'maskable']]) {
  ok(svg.includes('viewBox="0 0 24 24"'), `${name}: the 24-unit viewBox`);
  ok(svg.includes('stroke="#3E7CA6"'), `${name}: the mark is harbor`);
  ok(svg.includes('fill="#D9A441"'), `${name}: the sun is dawn amber`);
  ok(svg.includes('stroke-width="1.4"'), `${name}: stroke weight 1.4`);
  ok(svg.includes('stroke-linecap="round"'), `${name}: round caps`);
  ok(svg.includes('stop-color="#DCE9F0"') && svg.includes('offset="70%"') && svg.includes('stop-color="#FAF7F1"'),
    `${name}: the dawn ground, mist → shell at 70%`);
  /**
   * NO LETTERFORMS. The A and the O are structural — the frame and the sun — and
   * the moment a glyph appears the mark becomes a monogram. It is also the one
   * element that could not survive being scaled to a 16px favicon.
   */
  ok(!/<text|<tspan|font-family/.test(svg), `${name}: carries no letterforms`);
}

/**
 * ——————————————————————— THE MASKABLE IS THE MASTER PLUS ONE TRANSFORM.
 *
 * Asserted as a string difference rather than by eye, because the failure this
 * replaces was exactly a maskable that had stopped being its own file. Strip the
 * comment header and the one attribute, and the two must be identical: any other
 * difference means they have drifted, and drift here is invisible until a
 * launcher crops something.
 */
/**
 * Comments are stripped — ALL of them, not just the header — and whitespace is
 * collapsed. The claim is about the drawing, and the two files legitimately
 * explain themselves differently. Everything that survives is markup: any
 * attribute, element or coordinate that differs still fails.
 */
const body = (s) => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim();
const TRANSFORM = ' transform="translate(12,12) scale(0.78) translate(-12,-12)"';
ok(maskable.includes(TRANSFORM), 'the maskable scales the mark into the safe zone');
ok(!master.includes('transform='), 'and the master does not — it is full-size by design');
eq(body(maskable).replace(TRANSFORM, ''), body(master),
  'the two masters are otherwise character-identical — they cannot drift apart');

/**
 * ——————————————————————— THE SAFE ZONE, COMPUTED FROM THE GEOMETRY.
 *
 * Android guarantees only the central 80% of a maskable icon, i.e. a radius of
 * 0.4 × 24 = 9.6 from the centre. The mark's farthest point is computed here
 * from the same numbers the file draws with, including half the stroke width and
 * the sun's radius — not measured off a screenshot.
 *
 * The arc is the awkward one: its lowest point is not an endpoint. Its circle
 * centre sits a sagitta above the chord, so the extreme is derived rather than
 * taken from the path's coordinates.
 */
const HALF_STROKE = 0.7;
function markRadius(scale) {
  const C = [12, 12];
  const r = ([x, y], pad = 0) => Math.hypot(x - C[0], y - C[1]) * scale + pad * scale;
  const points = [
    r([5, 20], HALF_STROKE), r([19, 20], HALF_STROKE),      // arc feet / frame feet
    r([12, 8.6], HALF_STROKE),                               // frame apex
    r([8.6, 14.2], HALF_STROKE), r([15.4, 14.2], HALF_STROKE),
    r([15.6, 7], HALF_STROKE),                               // index arm tip
    r([17.4, 5.6], 2.5),                                     // the sun, by its own radius
  ];
  // The arc's belly: chord (5,20)–(19,20), radius 9.5, bulging away from centre.
  const halfChord = 7, R = 9.5;
  const sagittaCentreY = 20 - Math.sqrt(R * R - halfChord * halfChord);
  points.push(r([12, sagittaCentreY + R], HALF_STROKE));
  return Math.max(...points);
}
const SAFE = 0.4 * 24;
const maskedRadius = markRadius(0.78);
ok(maskedRadius <= SAFE,
  `the maskable mark stays inside the 80% safe zone (${maskedRadius.toFixed(2)} ≤ ${SAFE})`);
/**
 * And the standard mark must NOT fit — otherwise the transform is doing nothing,
 * the safe-zone assertion above passes vacuously, and a maskable that is once
 * again a copy of the master would sail through this suite.
 */
ok(markRadius(1) > SAFE,
  `the UNSCALED mark would overflow it (${markRadius(1).toFixed(2)} > ${SAFE}) — so the transform is load-bearing`);

// ——————————————————————— the index-arm rule, exercised rather than described
ok(forSize(master, 512).includes('L15.6 7'), 'at 512px the index arm is drawn');
ok(!forSize(master, 64).includes('L15.6 7'), `at ${INDEX_ARM_MIN_PX}px it is dropped — it merges with the sun`);
ok(!forSize(master, 48).includes('index-arm'), 'and the empty group goes with it');
ok(forSize(master, 64).includes('M5 20 A 9.5 9.5'), 'everything else survives the drop');

// ——————————————————————— the rendered output
const RASTERS = [
  ['apple-touch-icon-180.png', 180], ['icon-192.png', 192],
  ['icon-512.png', 512], ['maskable-512.png', 512],
];
const bytes = {};
for (const [name, px] of RASTERS) {
  const p = join(ICONS, name);
  if (!existsSync(p)) { failures.push(`${name} is missing — run \`npm run icons\``); continue; }
  const buf = readFileSync(p);
  bytes[name] = buf.toString('base64');
  const img = decodePng(buf);
  eq(img.w, px, `${name} is ${px}px wide`);
  eq(img.h, px, `${name} is ${px}px tall`);

  /**
   * PIXELS, not file size. A rasteriser that silently produced a blank canvas
   * would still write a well-formed PNG of a plausible size — and that is not a
   * hypothetical: the generator's main-module guard failed silently on this
   * machine (a percent-encoded URL compared against a raw path) and wrote
   * nothing at all, which only surfaced because the md5s had not moved.
   */
  let amber = 0, harbor = 0, transparent = 0;
  for (let y = 0; y < img.h; y += 2) {
    for (let x = 0; x < img.w; x += 2) {
      const [r, g, b, a] = img.px(x, y);
      if (a < 250) transparent++;
      if (r > 180 && g > 125 && g < 205 && b < 115) amber++;
      if (b > 130 && b < 210 && r < 120 && b > r + 40) harbor++;
    }
  }
  ok(amber > 20, `${name}: the sun is actually painted (${amber} amber samples)`);
  ok(harbor > 50, `${name}: the mark is actually painted (${harbor} harbor samples)`);
  eq(transparent, 0, `${name}: fully opaque — a maskable icon must reach every edge`);

  const [tr, tg, tb] = img.px(4, 4);
  const [br, bg, bb] = img.px(4, img.h - 5);
  ok(tb > tr && tb > 225, `${name}: the top corner is dawn sky`);
  ok(br > 240 && bg > 235 && bb > 225 && bb <= br, `${name}: the bottom corner has settled to shell`);
  void [tg, bg];
}

/** The failure that shipped: the two 512s were the same file. */
ok(bytes['icon-512.png'] && bytes['maskable-512.png']
  && bytes['icon-512.png'] !== bytes['maskable-512.png'],
  'maskable-512 is NOT a copy of icon-512 — the safe-zoned one is its own image');

const report = failures.length
  ? `❌ ${failures.length} / ${pass + failures.length} icon checks failed:\n  - ${failures.join('\n  - ')}`
  : `✅ all ${pass} icon checks passed`;
console.log(report);
process.exit(failures.length ? 1 : 0);
