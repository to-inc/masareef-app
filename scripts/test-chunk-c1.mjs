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
import { RADIUS } from '../src/theme.js';

const MARKER = 'CHUNK-C1-GREEN';
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };

const app = read('src/App.jsx');

// ——— the bar itself: located, floating, capsule, safe-area aware
const navAt = app.indexOf('<nav');
const nav = navAt === -1 ? '' : app.slice(navAt, app.indexOf('</nav>'));
ok(navAt !== -1 && nav.length > 0, 'C1.0 the nav is findable in App.jsx — a slice that missed it would assert nothing');

ok(/position: 'fixed'/.test(nav),
  'C1.1 the bar FLOATS — position fixed, so content actually scrolls beneath it (the blur has something to blur)');

const inset = /const BAR_INSET = (\d+)/.exec(app);
ok(inset && Number(inset[1]) === 16,
  `C1.2 BAR_INSET is declared once and equals the ruled 16 (got ${inset ? inset[1] : 'nothing'})`);
ok(/left: `calc\(\$\{BAR_INSET\}px \+ env\(safe-area-inset-left\)\)`/.test(nav)
  && /right: `calc\(\$\{BAR_INSET\}px \+ env\(safe-area-inset-right\)\)`/.test(nav),
  'C1.3 both side insets ride BAR_INSET + their safe-area env — inset 16 from the EDGES, not from wherever the notch left off');
ok(/bottom: `calc\(\$\{BAR_INSET\}px \+ env\(safe-area-inset-bottom\)\)`/.test(nav),
  'C1.4 the bottom inset rides BAR_INSET + the home-indicator safe area');

ok(nav.includes('borderRadius: RADIUS.capsule'),
  'C1.5 the bar is a CAPSULE — RADIUS.capsule, the token, never a restated 999');
ok(RADIUS.capsule === 999, 'C1.5b …and the token still means capsule (999)');

// ——— the ruled fill: 0.92 alpha derived from the card token, plus the blur
const alpha = /const BAR_ALPHA = (0\.\d+)/.exec(app);
ok(alpha && Number(alpha[1]) === 0.92,
  `C1.6 BAR_ALPHA is declared and equals the Owner's ruled 0.92 (got ${alpha ? alpha[1] : 'nothing'})`);
ok(nav.includes('withAlpha(C.card, BAR_ALPHA)'),
  'C1.7 the fill is C.card AT BAR_ALPHA — derived from the token, so a palette change cannot strand the bar in an old white');
ok(/backdropFilter: 'blur\(/.test(nav) && /WebkitBackdropFilter: 'blur\(/.test(nav),
  'C1.8 backdrop blur, BOTH spellings — this app has exactly one device to be wrong on and it needs the -webkit- prefix');

// ——— the old solid-bar chrome is gone, not merely painted over
ok(!nav.includes('borderTop'),
  'C1.9 the full-width borderTop died with the full-width bar — a capsule with a leftover top rule is two designs at once');

// ——— content can still get OUT from under it
// /<main\s/ — the ELEMENT: doc comments higher up legitimately say «<main>» in prose
ok(/BAR_CLEARANCE/.test(app.slice((/<main\s/.exec(app) || { index: -1 }).index, app.indexOf('</main>'))),
  'C1.10 the scroll box reserves BAR_CLEARANCE — the last row must be able to rise clear of a bar that floats over content');
ok((app.match(/BAR_CLEARANCE/g) || []).length >= 3,
  'C1.11 …and so does the EntryDock side (declaration + main + dock): the submit may never sit buried under the bar');

// ——— the contrast half: the suite reads the REAL alpha and composites worst-case
const contrast = read('scripts/test-contrast.mjs');
ok(/BAR_ALPHA/.test(contrast) && /App\.jsx/.test(contrast),
  'C1.12 test-contrast extracts BAR_ALPHA from App.jsx — one number, one home; a copied 0.92 is the drift that unmeasures the glass');
ok(/darkest/.test(contrast) && /C1 worst case/.test(contrast),
  'C1.13 test-contrast composites the DARKEST scrollable paint under the fill and labels the pairs «C1 worst case»');

// ——— and it RUNS, with the worst-case rows in its own report
{
  const run = spawnSync(process.execPath, [join(here, 'test-contrast.mjs')], { encoding: 'utf8' });
  ok(run.status === 0,
    `C1.14 test-contrast passes with the worst-case pairs in force (exit ${run.status})`);
  ok(((run.stdout || '').match(/C1 worst case/g) || []).length >= 2,
    'C1.15 …and its own printed table carries ≥2 «C1 worst case» rows — asserted and visible, never eyeballed');
}

if (failures.length) {
  console.log(`❌ CHUNK C1 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · the bar floats at 0.92 over a measured worst case`);
