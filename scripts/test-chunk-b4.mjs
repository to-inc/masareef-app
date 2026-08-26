#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK B4 ═══════════
 * «Advisory surfaces enter as sheets: a translateY rise at MOTION.page with
 *  MOTION.easeSettle; the lip rides RADIUS.sheet (24 — Planner ruling
 *  2026-08-26, its first consumer); prefers-reduced-motion collapses the
 *  entrance to an instant appearance. Static render shows the settled state.»
 *  (chunk-ledger B4; north-star §4.2 motion; nav-F8.)
 *
 * WHICH SURFACES. The overlay/sheet primitives the views mount live in
 * Primitives.jsx: `Toast` (the confirmation overlay App raises after every
 * write) and `OfflineBanner` (the calm advisory banner). Both must ride ONE
 * sheet primitive — two hand-rolled entrances is how the second one drifts,
 * the same law that made the Rail a component (N2).
 *
 * WHY SOURCE PINS *AND* RENDERS. The motion itself exists only at runtime, so
 * the tokens (MOTION.page / MOTION.easeSettle / RADIUS.sheet) and the media
 * guard are pinned in source — a raw ms or px where a token exists is a
 * defect, and a guard that is missing cannot be seen in a static render. The
 * render half proves the settled state: the suites render statically, so the
 * markup must show the sheet ARRIVED — no translateY, no opacity:0 — and must
 * carry its own <style> so the guard ships with the component, not with a
 * stylesheet another leaf owns.
 *
 * THE COLLAPSE-SAFETY PIN (B4.5) is the interesting one: the keyframes may
 * define only `from`. The settled state then belongs to the element itself,
 * so `animation: none` under reduced motion yields an instant appearance BY
 * CONSTRUCTION — there is no keyframe state left that could hide content.
 *
 * Every render is guarded — a component that THROWS surfaces as a NAMED
 * failure, never as a dead process (the N1/N1b lesson, now house pattern).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { RADIUS, MOTION } from '../src/theme.js';

const MARKER = 'CHUNK-B4-GREEN';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/components/Primitives.jsx'), 'utf8');

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };

// ═══ 1. SOURCE — the sheet entrance lives where the primitives live ═══

ok(/@keyframes sheet-in/.test(src),
  'B4.1 Primitives.jsx defines the sheet entrance (@keyframes sheet-in) itself — '
  + 'styles.css\'s pop rides a raw 0.18s the MOTION law bans, so the primitive carries its own tokened entrance');

ok(/\$\{MOTION\.page\}ms \$\{MOTION\.easeSettle\}/.test(src),
  'B4.2 the entrance runs at MOTION.page with MOTION.easeSettle — duration and easing are TOKENS, never restated');

// The sheet CSS block, extracted for the no-raw-values pins. The block runs
// from the keyframes to the end of the template literal that holds them.
const cssAt = src.indexOf('@keyframes sheet-in');
const cssEnd = cssAt === -1 ? -1 : src.indexOf('`', cssAt);
const sheetCss = cssAt === -1 ? '' : src.slice(cssAt, cssEnd === -1 ? src.length : cssEnd);

ok(sheetCss !== '' && !/\d+ms/.test(sheetCss),
  'B4.3 no raw millisecond figure anywhere in the sheet CSS — a raw ms where MOTION exists is a defect');

ok(/translateY\(\$\{[A-Z_]+\.[a-z]+\}px\)/.test(sheetCss),
  'B4.4 the rise is a translateY whose distance consumes a token — the sheet rises by a vocabulary value, not a magic px');

ok(sheetCss.includes('from {') && !sheetCss.includes('to {'),
  'B4.5 the keyframes define only `from` — the settled state is the element\'s own, so killing the '
  + 'animation can only reveal content, never hide it');

const guardAt = sheetCss.indexOf('@media (prefers-reduced-motion: reduce)');
ok(guardAt !== -1 && /\.sheet-in[^}]*\{[^}]*animation: none/.test(sheetCss.slice(guardAt)),
  'B4.6 the media guard stands and collapses .sheet-in to `animation: none` — instant appearance, content never hidden');

ok(/borderRadius: RADIUS\.sheet/.test(src),
  'B4.7 the lip rides RADIUS.sheet — the Planner\'s 24, consumed for the first time, never restated as a raw 24');

ok(!src.includes('toast-in'),
  'B4.8 Toast no longer rides styles.css\'s `toast-in` pop — the confirmation overlay enters as a sheet');

// ═══ 2. RENDERS — the settled state is what a static render shows ═══

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { Toast, OfflineBanner } = await vite.ssrLoadModule('/src/components/Primitives.jsx');
  const html = (name, Comp, props) => {
    try {
      return renderToStaticMarkup(createElement(Comp, props));
    } catch (err) {
      failures.push(`${name} THREW while rendering — ${err && err.message}`);
      return '';
    }
  };

  const toast = html('Toast', Toast, { message: 'اتسجل ✓' });
  ok(toast.includes('اتسجل ✓') && toast.includes('class="sheet-in"'),
    'B4.9 Toast renders its message on the sheet surface (class="sheet-in")');
  ok(toast.includes(`border-radius:${RADIUS.sheet}px`),
    `B4.10 Toast's lip is RADIUS.sheet in the rendered style (border-radius:${RADIUS.sheet}px) — capsule retired on this surface`);
  ok(toast.includes('role="status"'),
    'B4.11 Toast stays a live region (role="status") — the confirmation is announced, motion or none');
  ok(toast.includes('prefers-reduced-motion'),
    'B4.12 the media guard SHIPS WITH the component — the rendered markup carries its own <style>, not a hope about a stylesheet');
  /**
   * The settled-state claim is about the ELEMENT's styles, so the <style>
   * block is stripped first — the keyframes legitimately contain the rise;
   * the element itself must not. (First cut of this check swept the whole
   * markup and would have stayed red against a correct build — an oracle
   * defect of the N1b «failed to be red» family, caught on re-read.)
   */
  const settled = (h) => h.replace(/<style>[\s\S]*?<\/style>/g, '');
  ok(toast.includes('translateY') && !settled(toast).includes('translateY') && !/opacity:\s*0[;"}]/.test(settled(toast)),
    'B4.13 the static render is the SETTLED state — the rise exists only inside the keyframes; the element carries no translateY and no opacity:0');
  ok(html('Toast(empty)', Toast, { message: null }) === '',
    'B4.14 no message, no toast — an empty confirmation surface renders nothing, as before');

  const banner = html('OfflineBanner', OfflineBanner, { text: 'الشبكة مقطوعة' });
  ok(banner.includes('الشبكة مقطوعة') && banner.includes('class="sheet-in"'),
    'B4.15 OfflineBanner enters as the same sheet — one primitive, not a second hand-rolled entrance');
  ok(banner.includes(`border-radius:${RADIUS.sheet}px`),
    'B4.16 the advisory lip is RADIUS.sheet too — one step softer than the card it covers');
  ok(banner.includes('border:1px solid'),
    'B4.17 …and it KEEPS its meaning border — advisory surfaces stay bordered by name (A2\'s doctrine), the sheet did not shed it');
  ok(!banner.includes('box-shadow'),
    'B4.18 no shadow arrived with the sheet — luminance carries elevation (A2); the entrance is motion, not chrome');
} finally {
  await vite.close();
}

if (failures.length) {
  console.log(`❌ CHUNK B4 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · advisory surfaces enter as sheets and settle instantly under reduced motion`);
