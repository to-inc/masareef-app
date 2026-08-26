#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK E6 ═══════════
 * «Typical band (P25–P75 of prior same-length periods) in mist, only where
 *  ≥N periods of real history — derivation from real history only, never a
 *  target line.» (chunk-ledger E6 row; E6 FEASIBILITY block; north-star §5;
 *  gates/E6.gates.md G1.)
 *
 * THIS FILE COVERS THE DERIVATION HALF: `typicalBand` in src/lib/series.js —
 * the maths, isolated where it can be tortured. The RENDER half (mist fill,
 * never a line to beat, honest absence on screen) belongs to the charts leaf,
 * which APPENDS its pins here as new numbered sections ABOVE the verdict
 * block at the bottom — use dynamic `await import(...)` for any render
 * machinery so this file's top stays dependency-free and runnable with plain
 * node against a bare tree.
 *
 * THE LAW UNDER TEST, spelled out so each section reads as a clause of it:
 *   · REAL HISTORY ONLY — closed months: non-null entries at index < the
 *     current month. The current month is mid-flight and never counts, even
 *     when it holds a value. Nothing is invented.
 *   · NULL under fewer than 4 closed months (N=4 proposed, Owner veto open —
 *     which is why N must be ONE exported constant, not a magic number).
 *     Fewer than four months wearing quartile clothes is a costume, not a
 *     statistic.
 *   · A null slot is a MISSING TAB, not a spent-nothing month. Skipped,
 *     never zero-coerced. A true 0 in a slot that exists IS a real month.
 *   · P25/P75 by linear interpolation on the sorted closed totals
 *     (h = (n−1)·q — the R-7/numpy-default method, pinned by fixture).
 *   · Never NaN; p25 ≤ p75 always; n reports the population honestly.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as series from '../src/lib/series.js';

const MARKER = 'CHUNK-E6-GREEN';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ═══ Assertion helpers — shared by every section, including appended ones ═══
let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) { pass++; } else { failures.push(label); } };
const near = (a, b) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-9;

/**
 * Call typicalBand with a verdict either way: a missing export or a throwing
 * implementation comes back as a sentinel OBJECT that fails every assertion
 * BY NAME instead of killing the run. A red test that dies is not a red test.
 */
const band = (...args) => {
  if (typeof series.typicalBand !== 'function') return { __absent: 'typicalBand is not exported from src/lib/series.js' };
  try { return series.typicalBand(...args); } catch (e) { return { __threw: String(e) }; }
};
const isNull = (v) => v === null;
const bandEq = (got, want, label) => ok(
  got != null && near(got.p25, want.p25) && near(got.p75, want.p75) && got.n === want.n,
  `${label} — want ${JSON.stringify(want)}, got ${JSON.stringify(got)}`,
);

// ═══ 1. SURFACE — the one pinned signature, and N as an Owner-facing knob ═══
{
  ok(typeof series.typicalBand === 'function',
    'E6.1 series.js exports typicalBand(monthTotals, currentMonthIndex1based)');
  ok(series.TYPICAL_BAND_MIN_MONTHS === 4,
    'E6.2 TYPICAL_BAND_MIN_MONTHS is exported and is 4 — the Owner-facing N, vetoable in ONE edit');

  const src = readFileSync(join(root, 'src/lib/series.js'), 'utf8');
  ok((src.match(/TYPICAL_BAND_MIN_MONTHS/g) || []).length >= 2,
    'E6.3 typicalBand CONSUMES the named constant — a magic 4 inline would turn the Owner veto into a hunt');
  const doc = src.match(/\/\*\*(?:(?!\*\/)[\s\S])*\*\/\s*export function typicalBand/);
  ok(!!doc && /comb\(/.test(doc[0]) && /monthTotals/.test(doc[0]),
    'E6.4 the JSDoc pins the ONE signature: monthTotals arrives pre-summed by the caller via comb() — one summing rule, one place');
}

// ═══ 2. THIN HISTORY → NULL — under 4 closed months there is no band at all ═══
{
  ok(isNull(band([], 1)), 'E6.5 an empty year has no band');
  ok(isNull(band([null, null, null, null, null], 5)), 'E6.6 all-null history (no tabs yet) has no band');
  ok(isNull(band([100], 2)), 'E6.7 one closed month is a dot, not a distribution — null');
  ok(isNull(band([100, 200], 3)), 'E6.8 two closed months — null');
  ok(isNull(band([100, 200, 300], 4)), 'E6.9 three closed months — null, one short of N');
  ok(isNull(band([100, 200, 300, 999], 4)),
    'E6.10 three closed + a non-null CURRENT month is still three — the mid-flight month cannot rescue thin history');
}

// ═══ 3. EXACT QUARTILES — linear interpolation on sorted closed totals, pinned by fixture ═══
{
  bandEq(band([10, 20, 30, 40], 5), { p25: 17.5, p75: 32.5, n: 4 },
    'E6.11 even count (4 closed): [10,20,30,40] → h=(n−1)q interpolation');
  bandEq(band([10, 20, 30, 40, 50], 6), { p25: 20, p75: 40, n: 5 },
    'E6.12 odd count (5 closed): quartiles land ON members');
  bandEq(band([1, 2, 3, 4, 5, 6, 7], 8), { p25: 2.5, p75: 5.5, n: 7 },
    'E6.13 seven closed months: [1..7]');
  bandEq(band([40, 10, 30, 20], 5), { p25: 17.5, p75: 32.5, n: 4 },
    'E6.14 months arrive in CALENDAR order, not rank order — the band sorts internally');
  bandEq(band([10, 20, 30, 40, 50, 60], 7), { p25: 22.5, p75: 47.5, n: 6 },
    'E6.15 genuinely LINEAR interpolation — nearest-rank would say 20/50; the law says 22.5/47.5');
}

// ═══ 4. THE CURRENT MONTH IS EXCLUDED — even when it holds a value ═══
{
  bandEq(band([10, 20, 30, 40, 999], 5), { p25: 17.5, p75: 32.5, n: 4 },
    'E6.16 a huge mid-flight current month moves NOTHING — the band is history, not news');
  bandEq(band([10, 20, 30, 40, null], 5), { p25: 17.5, p75: 32.5, n: 4 },
    'E6.17 …and its value being present or null changes nothing either — same band both ways');
  bandEq(band([10, 20, 30, 40, 999, 888], 5), { p25: 17.5, p75: 32.5, n: 4 },
    'E6.18 stale entries AFTER the current month never contribute — index < current is the whole gate');
  const full = band([5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5], 13);
  ok(full != null && full.n === 12,
    `E6.19 a browsed fully-closed year (index 13) counts all 12 months — got ${JSON.stringify(full)}`);
}

// ═══ 5. NULL IS A MISSING TAB, NOT A ZERO — and a true zero is a real month ═══
{
  bandEq(band([100, null, 200, 300, 400], 6), { p25: 175, p75: 325, n: 4 },
    'E6.20 a null slot is SKIPPED — zero-coercion would drag p25 to 100 and claim he spent nothing in a month that has no tab');
  bandEq(band([0, 20, 30, 40], 5), { p25: 15, p75: 32.5, n: 4 },
    'E6.21 a genuine 0 in a month that EXISTS is data — a spent-nothing month belongs in the distribution');
  bandEq(band([10, NaN, 20, 30, 40], 6), { p25: 17.5, p75: 32.5, n: 4 },
    'E6.22 a NaN slot is treated as absent, never allowed to poison the quartiles');
}

// ═══ 6. DEGENERACY & SAFETY — never NaN, never a throw, p25 ≤ p75 always ═══
{
  bandEq(band([50, 50, 50, 50], 5), { p25: 50, p75: 50, n: 4 },
    'E6.23 a flat history is a flat band (p25 = p75), not NaN and not an error');
  ok(isNull(band(undefined, 5)) && isNull(band(null, 5)),
    'E6.24 a missing totals array yields null, never a throw');
  ok(isNull(band([10, 20, 30, 40, 50], undefined)) && isNull(band([10, 20, 30, 40, 50], NaN)),
    'E6.25 an unknowable current index yields null — a band that cannot tell which months are closed derives nothing');
  ok(isNull(band([10, 20, 30, 40, 50], 1)),
    'E6.26 January: the year opens with zero closed months and no band');

  // Deterministic torture sweep — LCG-seeded so a failure reproduces exactly.
  let seed = 20260826;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  let shapeOk = 0, orderOk = 0, runs = 0;
  for (let t = 0; t < 200; t++) {
    const totals = Array.from({ length: 12 }, () => (rnd() < 0.3 ? null : Math.round(rnd() * 5000)));
    const cur = 1 + Math.floor(rnd() * 13);
    const b = band(totals, cur);
    runs++;
    if (b === null) { shapeOk++; orderOk++; continue; }
    if (b != null && Number.isFinite(b.p25) && Number.isFinite(b.p75)
      && Number.isInteger(b.n) && b.n >= 4) shapeOk++;
    if (b != null && b.p25 <= b.p75) orderOk++;
  }
  ok(shapeOk === runs,
    `E6.27 every result over 200 seeded random years is null or {finite p25, finite p75, integer n ≥ 4} — ${shapeOk}/${runs}`);
  ok(orderOk === runs,
    `E6.28 p25 ≤ p75 in every one of them — ${orderOk}/${runs}`);
}

// ═══ 7. n IS THE HONEST POPULATION — exactly the months the quartiles used ═══
{
  bandEq(band([5, null, 7, 9, 11, 13, 999], 7), { p25: 7, p75: 11, n: 5 },
    'E6.29 n counts the closed non-null months and nothing else — not the nulls, not the current month');
}

// ═══ 8–9. RENDER (charts leaf, chunk E6's render half — APPENDED per the
// header's contract; the derivation sections above are pins and stay as cut) ═══
/**
 * «The typical band as a MIST region behind the month's cumulative line:
 *  rendered ONLY when typicalBand(...) returns non-null; visually quieter
 *  than both data lines; NEVER styled as a line to beat; reduced-motion safe
 *  (static — no animation at all).»
 *
 * Dynamic imports throughout, so the derivation half stays runnable with
 * plain node against a bare tree (the header's own rule).
 */
{
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  try {
    const { MonthStack } = await vite.ssrLoadModule('/src/components/Charts.jsx');
    const { C } = await vite.ssrLoadModule('/src/theme.js');

    if (typeof MonthStack !== 'function') {
      failures.push('E6.30 MonthStack is not exported from Charts.jsx — the band has no month chart to stand behind (every render pin below fails with it)');
    } else {
      // The month the band stands behind: 18 lived days of 10 against a full
      // previous month of 8s — cumC ends at 180, cumP at 248.
      const CUR = Array.from({ length: 31 }, (_, i) => (i < 18 ? 10 : null));
      const PREV = Array(31).fill(8);
      const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
      const stack = (props) => {
        try {
          return renderToStaticMarkup(createElement(MonthStack, {
            cur: CUR, prev: PREV, labels: DAYS, liveIndex: 17, color: '#2C4356', prevName: 'يوليو', ...props,
          }));
        } catch (e) { failures.push(`E6 render — MonthStack THREW: ${e && e.message}`); return ''; }
      };
      /** The band: the one C.mist-filled rect in the svg, with its numbers. */
      const bandRect = (html) => {
        const re = new RegExp(`<rect([^>]*fill="${C.mist}"[^>]*)>`, 'i');
        const m = re.exec(html);
        if (!m) return null;
        const attr = (k) => { const a = new RegExp(`${k}="([-\\d.]+)"`).exec(m[0]); return a ? Number(a[1]) : null; };
        return { tag: m[0], y: attr('y'), height: attr('height'), at: m.index };
      };
      // Control: the extractor proves itself on seeded input first.
      ok(bandRect(`<svg><rect x="8" y="22.0" width="304" height="52.8" fill="${C.mist}"></rect></svg>`) != null,
        'E6.30a control — the band extractor finds a seeded mist rect');

      /**
       * ——— (8a) NON-NULL BAND → A MIST REGION, BEHIND EVERYTHING.
       * With p75=260 the scale stretches to hold the band (max 260), so
       * y(v) = 120 − (v/260)·98: top y(260)=22.0, bottom y(120)≈74.8.
       */
      const band = { p25: 120, p75: 260, n: 5 };
      const withBand = stack({ band });
      const r = bandRect(withBand);
      ok(r != null, 'E6.30 the band renders as a MIST region when typicalBand gave one');
      const near1 = (a, b) => a != null && Math.abs(a - b) <= 0.11;
      ok(r != null && near1(r.y, 22) && near1(r.height, 52.8),
        `E6.31 …spanning exactly y(p75)→y(p25) on the chart's own scale (want y≈22.0 h≈52.8, got y=${r && r.y} h=${r && r.height})`);
      ok(r != null && !/stroke/.test(r.tag),
        'E6.32 NO stroke on the band — edges that read as lines are targets, and the band is where he has BEEN, never a line to beat');
      ok(r != null && !/class=|animation/.test(r.tag),
        'E6.33 the band is STATIC — no class, no animation: reduced motion has nothing to reduce');
      const liveAt = withBand.indexOf('stroke-width="3.2"');
      const greyAt = withBand.indexOf('stroke-width="2.5"');
      const gridAt = withBand.indexOf('<line');
      ok(r != null && liveAt !== -1 && greyAt !== -1 && r.at < liveAt && r.at < greyAt && (gridAt === -1 || r.at < gridAt),
        'E6.34 the band sits BEHIND both data lines and the gridlines — mist is ground, never figure');
      ok(withBand.includes('>180<'),
        'E6.35 the line\'s own marker figure still stands over the band — the band quiets nothing that is data');

      /**
       * ——— (8b) THE SCALE ADMITS THE BAND. A p75 above every curve must not
       * clip off the top: the same render just proved y(p75)=22 ≥ TOP. And a
       * band UNDER the data changes nothing about the line's own endpoint row.
       */
      const low = bandRect(stack({ band: { p25: 40, p75: 80, n: 4 } }));
      ok(low != null && low.y > 22 && low.height > 0,
        'E6.36 a band below the curve renders inside the plot on the data\'s own scale');

      /**
       * ——— (9) NULL → NOTHING, and null is the DERIVATION's word.
       */
      ok(bandRect(stack({})) === null,
        'E6.37 no band prop, no mist — absence renders as absence');
      ok(bandRect(stack({ band: null })) === null,
        'E6.38 an explicit null (thin history) renders NOTHING — never a band from months that do not exist');
      ok(bandRect(stack({ band: series.typicalBand ? series.typicalBand([100, 200, null, null, null], 5) : null })) === null,
        'E6.39 wired end-to-end: typicalBand\'s own null on thin history reaches the screen as honest absence');
      const real = series.typicalBand ? series.typicalBand([100, 150, 200, 250, null, null, null, null, null, null, null, null], 5) : null;
      ok(real != null && bandRect(stack({ band: real })) != null,
        'E6.40 …and typicalBand\'s own real output reaches the screen as a band — the derivation and the render meet');
      ok(bandRect(stack({ band: { p25: NaN, p75: 260, n: 4 } })) === null,
        'E6.41 a poisoned band renders nothing — the render half re-checks what it was handed rather than painting garbage');
      ok(bandRect(stack({ band: { p25: 90, p75: 90, n: 4 } })) === null,
        'E6.42 a DEGENERATE band (p25 = p75) renders nothing — a zero-height region could only be drawn as a line, and a line is a target');
    }
  } finally {
    await vite.close();
  }
}

// ═══ VERDICT — appended render sections go ABOVE this block ═══
if (failures.length) {
  console.log(`❌ CHUNK E6 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · the typical band derives from closed months only — null under thin history, quartiles by pinned interpolation, never an invented number`);
