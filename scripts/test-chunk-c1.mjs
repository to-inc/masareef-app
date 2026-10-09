#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK C1 ═══════════
 * «The bottom nav becomes a FLOATING CAPSULE bar: RADIUS.capsule, inset 16 from
 *  the screen edges (safe-area aware), 0.92-alpha fill with backdrop blur; the
 *  contrast suite gains the WORST-CASE pair — nav label ink over the 0.92 fill
 *  composited over the darkest content that can scroll beneath.»
 *  (chunk-ledger C1 · north-star §4.3 — the Owner's ratified glass compromise)
 *
 * WHY THE ALPHA IS READ FROM App.jsx AND NEVER RESTATED HERE. The whole point
 * of 0.92 over true glass is that the compromise is MEASURABLE: the contrast
 * suite composites the darkest scrollable paint under the fill and asserts the
 * labels still clear their floors. That argument collapses the day the bar's
 * real alpha and the suite's assumed alpha drift apart — so test-contrast.mjs
 * extracts BAR_ALPHA from the shell's source, and this oracle pins BOTH that
 * extraction and the ruled value. One number, one home, two readers.
 *
 * WHY THE CONTRAST SUITE IS SPAWNED, NOT TRUSTED. «asserted, never eyeballed»
 * is only true if the assertion actually RUNS red-capable: a worst-case block
 * that exists in source but is skipped by an early return would pin nothing.
 * So the suite is executed and its own report line is read back.
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RADIUS, NAV, GLASS } from '../src/theme.js';

const MARKER = 'CHUNK-C1-GREEN';
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };

const app = read('src/App.jsx');

// ═══ RE-CUT 2026-10-09 to OWNER-RULINGS R16 (v4): the 0.92-alpha capsule is
// retired; the bar is the glass `chrome` tier at the P3 artboard's geometry.
const navAt = app.indexOf('<nav');
const nav = navAt === -1 ? '' : app.slice(navAt, app.indexOf('</nav>'));
ok(navAt !== -1 && nav.length > 0, 'C1.0 the nav is findable in App.jsx — a slice that missed it would assert nothing');
ok(/position: 'fixed'/.test(nav), 'C1.1 the bar floats — fixed over the scroll box');
ok(nav.includes("...glass('chrome')"), "C1.2 the bar IS the chrome glass tier — glass('chrome'), not a hand-mixed fill (R16, A3)");
ok(NAV.height === 70 && NAV.pad === 6 && NAV.gap === 6 && NAV.inset === 20 && NAV.bottom === 28,
  'C1.3 NAV carries the P3 geometry: 70 tall, 6 pad, 6 gap, 20 from the sides, 28 from the bottom');
ok(/left: `calc\(\$\{NAV\.inset\}px \+ env\(safe-area-inset-left\)\)`/.test(nav)
  && /right: `calc\(\$\{NAV\.inset\}px \+ env\(safe-area-inset-right\)\)`/.test(nav),
  'C1.4 both side insets ride NAV.inset + their safe-area env');
// Re-cut 2026-10-10 (R0, E-017): bottom-pinned layers extend by the measured iOS shortfall (pinBottom / FULL_BLEED).
ok(/bottom: pinBottom\(`max\(\$\{NAV\.bottom\}px, env\(safe-area-inset-bottom\)\)`\)/.test(nav),
  'C1.5 the bottom is NAV.bottom or the home-indicator safe area, whichever is larger');
ok(/height: NAV\.height/.test(nav) && /padding: NAV\.pad/.test(nav) && /gap: NAV\.gap/.test(nav), 'C1.6 the bar reads its size from NAV, never restated');
ok(GLASS.chrome.blur === 30 && GLASS.chrome.sat === 180, 'C1.7 chrome is blur 30 / sat 180 (A3)');
ok(!/BAR_ALPHA/.test(app), 'C1.8 the retired 0.92 compromise is gone, not left as a dead constant');
ok(/BAR_CLEARANCE/.test(app.slice((/<main\s/.exec(app) || { index: -1 }).index, app.indexOf('</main>'))),
  'C1.9 the scroll box reserves BAR_CLEARANCE — the last row must rise clear of a bar that floats over content');
ok(/const BAR_CLEARANCE = NAV\.bottom \+ NAV\.height \+ SPACE\.gap;/.test(app), 'C1.10 BAR_CLEARANCE is derived from NAV, so it moves with the bar');
{
  const run = spawnSync(process.execPath, [join(here, 'test-contrast.mjs')], { encoding: 'utf8' });
  ok(run.status === 0, `C1.11 test-contrast passes (exit ${run.status})`);
  ok(((run.stdout || '').match(/v4 bar — /g) || []).length >= 6,
    'C1.12 …and it measures the v4 bar over what scrolls beneath it (≥6 printed rows) — the residues are visible, never assumed');
}

if (failures.length) {
  console.log(`❌ CHUNK C1 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · the v4 chrome bar floats at the P3 geometry, measured over what scrolls beneath`);
