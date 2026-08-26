#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK E5 ═══════════   `node scripts/test-chunk-e5.mjs`
 *
 * «Two-panel Month stack: cumulative line above, per-day bars below, ONE
 *  shared axis.» (chunk ledger E5 — data-F4; north-star §5: «cumulative line
 *  above answers "how is the month going", per-day bars below answer "which
 *  days did it"» — and A12's every-5th-day thinning goes LIVE here: its rule
 *  has been component-complete since Wave 2 while the Month screen mounted
 *  `showBars={false}`, so this stack is where 31 thinned labels first stand
 *  on a real screen.)
 *
 * WHAT «ONE SHARED AXIS» MEANS MECHANICALLY, so it is checkable: the bars'
 * day axis is the ONLY axis — the line panel above draws no day labels of its
 * own — and the line's x geometry is the COLUMN geometry: point i sits at bar
 * column i's center (nominal 375px arithmetic, the same width A12's collision
 * proof is cut at), not at the classic edge-to-edge spread. Two panels whose
 * x scales merely resemble each other would put «the 18th» in two different
 * places on one card, which is the axis disagreeing with itself.
 *
 * The stack REUSES CumulativeChart and PairedBars — the honest grammar
 * (marker labels, hasPrev gating, the once-per-mount draw, the thinning) must
 * exist ONCE; a re-implementation would be the two-derivations bug factory
 * this project has already paid for three times. Export is mount-ready;
 * MonthScreen mounting is the Planner's integration, deliberately not this
 * chunk's edit.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';

const MARKER = 'CHUNK-E5-GREEN';

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };

/** Comment stripper (the construction test-chunk-a6 proved). */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/** A12's axis-slot reader: the label divs are the only margin-top:5px elements. */
const axisSlots = (html) => {
  const out = [];
  const re = /style="([^"]*margin-top:5px[^"]*)"[^>]*>([^<]*)</g;
  let m;
  while ((m = re.exec(html))) {
    const f = /font-size:([\d.]+)px/.exec(m[1]);
    out.push({ font: f ? Number(f[1]) : 0, text: m[2] });
  }
  return out;
};

/** A12's collision arithmetic, verbatim — the 375px proof, now on the stack. */
const collisions = (slots, SPACE) => {
  const inner = 375 - 2 * SPACE.gutter - 2 * 12;
  const gap = slots.length > 8 ? 3 : 6;
  const pitch = (inner - (slots.length - 1) * gap) / slots.length + gap;
  const est = (s) => 0.62 * s.font * s.text.length;
  const rendered = slots.map((s, i) => ({ ...s, i })).filter((s) => s.text.trim() !== '');
  const bad = [];
  for (let k = 1; k < rendered.length; k++) {
    const a = rendered[k - 1], b = rendered[k];
    const clear = (b.i - a.i) * pitch - (est(a) + est(b)) / 2;
    if (clear < 2) bad.push(`«${a.text}»↔«${b.text}» ${clear.toFixed(1)}px`);
  }
  return bad;
};

/** The live cumulative line — the only 3.2-width stroke (B3's own finder). */
const livePathOf = (html) => (html.match(/<path\b[^>]*>/g) || []).find((t) => t.includes('stroke-width="3.2"')) || null;
/** The x of every point in a path's d, in document order. */
const xsOf = (tag) => {
  const d = / d="([^"]*)"/.exec(tag || '');
  return d ? [...d[1].matchAll(/[ML]([\d.]+),/g)].map((m) => Number(m[1])) : [];
};

// ——— controls: every detector proves itself on seeded input first.
{
  const seeded = '<div style="font-size:9.5px;margin-top:5px">15</div>';
  ok(axisSlots(seeded).length === 1 && axisSlots(seeded)[0].text === '15',
    'control — the slot reader sees a seeded axis label');
  ok(xsOf('<path d="M3.7,120.0 L13.8,110.0 " stroke-width="3.2"/>').join(',') === '3.7,13.8',
    'control — the point reader walks a seeded d');
  // Ten fat adjacent labels on a ten-column axis: pitch ~31px against ~74px
  // of glyphs — the arithmetic must flag it or it can flag nothing.
  ok(collisions(Array.from({ length: 10 }, () => ({ font: 30, text: '8888' })), { gutter: 20 }).length > 0,
    'control — the collision arithmetic can still flag a seeded pile-up');
}

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const charts = await vite.ssrLoadModule('/src/components/Charts.jsx');
  const { MonthStack } = charts;
  const { SPACE } = await vite.ssrLoadModule('/src/theme.js');

  ok(typeof MonthStack === 'function',
    'E5.1 Charts.jsx exports MonthStack — the two-panel stack is a mount-ready component, not a description');

  // A 31-day month, live on the 18th (not a multiple of 5 — the • must stand
  // BESIDE the full 5·k set), 10/day against a full previous month of 8s.
  const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
  const CUR = Array.from({ length: 31 }, (_, i) => (i < 18 ? 10 : null));
  const PREV = Array(31).fill(8);
  const stack = (props) => {
    if (typeof MonthStack !== 'function') return '';
    try {
      return renderToStaticMarkup(createElement(MonthStack, {
        cur: CUR, prev: PREV, labels: DAYS, liveIndex: 17, color: '#2C4356', prevName: 'يوليو', ...props,
      }));
    } catch (err) {
      failures.push(`MonthStack THREW — ${err && err.message}`);
      return '';
    }
  };
  const html = stack({});

  /**
   * ——— (a) TWO PANELS, THIS ORDER, ONE CARD'S WORTH OF MARKUP.
   */
  const svgAt = html.indexOf('<svg');
  const barsAt = html.indexOf('width:38%');
  ok(svgAt !== -1 && barsAt !== -1 && svgAt < barsAt,
    'E5.2 the cumulative line stands ABOVE the per-day bars — how the month is going, then which days did it');
  ok(/^<div[^>]*dir="ltr"/.test(html),
    'E5.3 the stack wraps itself dir="ltr" — time runs left→right whatever the document does (the standing charts rule, kept by the component itself because it mounts alone)');
  const live = livePathOf(html);
  ok(live != null && live.includes('class="chart-draw"') && live.includes('pathLength="1"'),
    'E5.4 the line is THE line — it carries B3\'s draw class and pathLength, the once-per-mount mechanism inherited, not re-invented');
  ok(html.includes('prefers-reduced-motion'),
    'E5.5 …and the reduced-motion guard rides in with it');
  ok(html.includes('>180<') && html.includes('>144<'),
    'E5.6 the marker figures render on the stack (S6\'s law arrives with the reused chart: 180 today, 144 at the same point)');

  /**
   * ——— (b) A12 GOES LIVE: the thinned axis, on this stack, no collisions
   * at 375px.
   */
  const slots = axisSlots(html);
  ok(slots.length === 31, `E5.7 all 31 day slots render under the bars — found ${slots.length}`);
  const spoken = slots.filter((s) => s.text.trim() !== '' && s.text !== '•').map((s) => s.text);
  ok(spoken.join(',') === '5,10,15,20,25,30',
    `E5.8 the axis speaks every 5th day — A12's rule, finally on a mounted month (rendered: ${spoken.join(',')})`);
  ok(slots.some((s) => s.text === '•'),
    'E5.9 the live day keeps its • marker');
  const bad = collisions(slots, SPACE);
  ok(bad.length === 0,
    `E5.10 no label collisions at 375px (collide: ${bad.slice(0, 4).join(' · ')}${bad.length > 4 ? ` +${bad.length - 4} more` : ''})`);

  /**
   * ——— (c) ONE SHARED AXIS, as geometry. The line's viewBox is 320 wide;
   * point i must sit at bar column i's CENTER under the nominal 375px
   * arithmetic (inner 311px, 3px gaps — the same numbers the collision proof
   * runs on), scaled into the viewBox. The classic spread would put point 0
   * at x=8; the column center puts it at ~3.7 — the two geometries disagree
   * from the very first point, which is what makes this checkable.
   */
  const xs = xsOf(live);
  ok(xs.length === 18, `E5.11 the live line carries one point per lived day — ${xs.length}/18`);
  {
    const W = 320, NW = 311, n = 31, g = 3;
    const cw = (NW - (n - 1) * g) / n;
    const expected = (i) => ((i * (cw + g) + cw / 2) / NW) * W;
    const off = xs.map((x, i) => Math.abs(x - expected(i))).filter((d) => d > 0.11);
    ok(off.length === 0,
      `E5.12 every line point sits on its bar column's center (±0.11 viewBox units) — ${off.length} points off`);
    ok(xs[0] < 6,
      'E5.13 …and the first point is at the FIRST COLUMN, not the classic edge spread — the discriminating case');
  }
  const svgPart = html.slice(svgAt, html.indexOf('</svg>'));
  ok(['5', '10', '15', '20', '25', '30'].every((d) => !svgPart.includes(`>${d}<`)),
    'E5.14 the line panel draws NO day labels of its own — the bars\' axis is the one axis, spoken once');

  /**
   * ——— (d) HONEST ABSENCE: a month with one lived day has no shape (M7),
   * and the stack says nothing rather than a dot over 31 grey bars.
   */
  const onePoint = stack({ cur: [10, ...Array(30).fill(null)], liveIndex: 0 });
  ok(onePoint === '',
    'E5.15 a one-point month renders NOTHING — the caller\'s words say why; the stack never fakes a shape');

  /**
   * ——— (e) SOURCE — reuse, and the shared-axis wiring, pinned.
   */
  const src = await readFile(new URL('../src/components/Charts.jsx', import.meta.url), 'utf8');
  const code = stripComments(src);
  const slice = code.slice(code.indexOf('export function MonthStack'));
  ok(/<CumulativeChart\b/.test(slice) && /<PairedBars\b/.test(slice),
    'E5.16 the stack MOUNTS CumulativeChart and PairedBars — one grammar, one derivation, no fork');
  ok(/columns=\{labels\.length\}/.test(slice),
    'E5.17 the line panel is told the bar count — the shared axis is wiring, not coincidence');
  ok(/hasShape\(/.test(slice),
    'E5.18 the no-shape gate is the shared hasShape, the same M7 law every other chart consults');

  // ═══ THE MOUNT (Planner integration, Wave-4 close) — component truth became
  // screen truth: MonthScreen hands the stack in, and it REPLACES the lone line.
  {
    const book = await readFile(new URL('../src/views/BookView.jsx', import.meta.url), 'utf8');
    ok(/<MonthStack\b/.test(book),
      'E5.19 MonthScreen mounts MonthStack — the two panels are on the screen, not only in the export');
    ok(/stack=\{monthStack\}/.test(book),
      'E5.20 …threaded through PeriodBlock as the stack slot, so the month card swaps its chart instead of doubling it');
    ok(/band=\{data\.year \? typicalBand\(comb\(data\.year\.cur\.Visa, data\.year\.cur\.Cash\), today \? today\.m : 13\) : null\}/.test(book),
      'E5.21 the band rides E6\'s pinned signature — comb over the year, the Cairo month index, 13 for a closed year, and honest null when the browsed payload has no year series');
    const charts = await readFile(new URL('../src/components/Charts.jsx', import.meta.url), 'utf8');
    ok(/\{stack \|\| \(/.test(charts),
      'E5.22 PeriodSummary renders the stack OR the classic line — never both charts telling one month');
  }
} finally {
  await vite.close();
}

if (failures.length) {
  console.log(`❌ CHUNK E5 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · one card, two panels, one axis: the line rides the bars' own columns and A12's thinning is finally live`);
