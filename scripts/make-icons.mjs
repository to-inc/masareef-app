#!/usr/bin/env node
/**
 * THE APP ICONS AND LAUNCH IMAGES — from ONE master, `public/icons/helm.svg`
 * (the AO helm, v4 mark 2a, OWNER-RULINGS R14; ARCHITECTURE A6).
 *
 * Rendered by headless Chromium (already a dev dependency for the layout
 * guard), so gradients come out exactly as a browser paints them — the old
 * QuickLook path guessed at radial gradients.
 *
 * ≤48px the design swaps in a bolder variant without the crossbar; no target
 * here is that small (iOS asks 180, the manifest 192/512), so `forSize` keeps
 * the rule for the day a 32px favicon is wanted.
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, '..', 'public');
const ICONS = join(PUBLIC, 'icons');

export const SMALL_MAX_PX = 48;
/** ≤48px: no crossbar, heavier strokes (v4 #2a's home-screen tile). */
export function forSize(svg, px) {
  if (px > SMALL_MAX_PX) return svg;
  return svg.replace(/\s*<path id="crossbar"[^>]*\/>/, '')
    .replace('stroke-width="9"', 'stroke-width="11"').replace('stroke-width="5"', 'stroke-width="7"').replace('stroke-width="10"', 'stroke-width="12"');
}

export const ICON_TARGETS = [
  { out: 'icons/apple-touch-icon-180.png', px: 180 },
  { out: 'icons/icon-192.png', px: 192 },
  { out: 'icons/icon-512.png', px: 512 },
  { out: 'icons/maskable-512.png', px: 512 },
];

/** iPhone launch images (portrait), CSS size × scale → the PNG iOS shows while the app opens. */
export const STARTUP = [
  [440, 956, 3], [430, 932, 3], [402, 874, 3], [393, 852, 3], [390, 844, 3],
  [428, 926, 3], [414, 896, 2], [375, 812, 3], [375, 667, 2],
].map(([w, h, s]) => ({ w, h, s, out: `icons/startup-${w * s}x${h * s}.png`,
  media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${s}) and (orientation: portrait)` }));

/** A launch screen: the dawn ground and the mark, centred, 120pt wide. */
export function startupHtml(svg) {
  const mark = svg.slice(svg.indexOf('<g id="mark"'), svg.lastIndexOf('</g>') + 4).replace(/transform="[^"]*"/, '');
  return `<!doctype html><html><body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;
    background:radial-gradient(85% 45% at 10% 0%,#F2D3A6 0%,rgba(242,211,166,0) 70%),radial-gradient(110% 55% at 25% 100%,#B5D2E6 0%,rgba(181,210,230,0) 72%),#F3EEE5">
    <svg width="120" height="120" viewBox="0 0 120 120">${mark}</svg></body></html>`;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const { chromium } = await import('playwright');
  const master = readFileSync(join(ICONS, 'helm.svg'), 'utf8');
  mkdirSync(ICONS, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const t of ICON_TARGETS) {
      const pg = await browser.newPage({ viewport: { width: t.px, height: t.px } });
      await pg.setContent(`<!doctype html><html><body style="margin:0">${forSize(master, t.px).replace('<svg ', `<svg width="${t.px}" height="${t.px}" `)}</body></html>`);
      await pg.screenshot({ path: join(PUBLIC, t.out), clip: { x: 0, y: 0, width: t.px, height: t.px } });
      await pg.close();
      console.log(`  ${t.out.padEnd(32)} ${t.px}px`);
    }
    for (const t of STARTUP) {
      const pg = await browser.newPage({ viewport: { width: t.w, height: t.h }, deviceScaleFactor: t.s });
      await pg.setContent(startupHtml(master));
      await pg.screenshot({ path: join(PUBLIC, t.out) });
      await pg.close();
      console.log(`  ${t.out.padEnd(32)} ${t.w * t.s}×${t.h * t.s}`);
    }
  } finally { await browser.close(); }
  console.log('\n  Now run: npm run check:icons');
}
