#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK E1 ═══════════   `node scripts/test-chunk-e1.mjs`
 *
 * «Year chart: tappable month labels extend a harbor/harbor-dimmed range;
 *  totals re-scope.» (chunk ledger E1 — data-F5; north-star §4.4: «tappable
 *  month labels on the Year chart extend a selected range — selected harbor,
 *  in-data-unselected harbor-dimmed (one hue, two values, Gentler's rust
 *  trick)».)
 *
 * WHAT A STATIC RENDER CAN PROVE, and how the tap is reached. SSR cannot tap,
 * so the tap ARITHMETIC is a pure exported reducer (`nextRange`) asserted
 * directly — extend, extend the other way, clear from inside — and the
 * SELECTED screen is reached through PeriodSummary's `rangeSeed` seam, the
 * same pattern as CumulativeChart's `peekOpen` and PeriodBlock's `policyOpen`
 * and for the same reason. The seeded render is then held to the chunk's
 * three claims:
 *
 *  · the month labels are genuine CONTROLS (buttons carrying aria-pressed),
 *    on the YEAR axis only — a week's day names stay furniture;
 *  · selection is ONE hue at TWO values: every current-series bar is harbor,
 *    split only by opacity — never a second colour, and never conflict red
 *    anywhere in the selection UI;
 *  · the method-card totals re-scope to the selected months, with the range
 *    said IN WORDS from the app's own month vocabulary, and a selection that
 *    reaches the mid-flight month refuses the year-ago comparison rather
 *    than comparing a partial month against a full one.
 *
 * Every detector proves itself on seeded input first (the A6/A12 discipline).
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';

const MARKER = 'CHUNK-E1-GREEN';

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };

/** Comment stripper (the construction test-chunk-a6 proved). */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/** From `export function <name>` to the next top-level export (a12's slicer). */
const sliceOf = (text, name) => {
  const decl = new RegExp(`^export (?:const |function )${name}\\b`, 'm').exec(text);
  if (!decl) return '';
  const rest = text.slice(decl.index + 1);
  const next = /^export (?:const|function) /m.exec(rest);
  return text.slice(decl.index, next ? decl.index + 1 + next.index : text.length);
};

/**
 * The current-series bars, in axis order: every width:38% div that is NOT the
 * grey previous-series bar (C.line). Each comes back with its background and
 * its opacity ('' when none is declared).
 */
const curBars = (html, lineHex) => {
  const out = [];
  const re = /<(?:div|button)[^>]*style="([^"]*width:38%[^"]*)"/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[1].toUpperCase().includes(lineHex.toUpperCase())) continue;
    const bg = /background:\s*(#[0-9a-fA-F]{3,6}|[a-z-]+\([^)]*\))/.exec(m[1]);
    const op = /opacity:\s*([\d.]+)/.exec(m[1]);
    out.push({ bg: bg ? bg[1] : '', op: op ? op[1] : '' });
  }
  return out;
};

// ——— controls: the extractors prove themselves on seeded input first.
{
  const seeded = '<div style="width:38%;height:10%;background:#3E7CA6;opacity:0.35"></div>'
    + '<div style="width:38%;height:5%;background:#E3DDCE"></div>';
  const bars = curBars(seeded, '#E3DDCE');
  ok(bars.length === 1 && bars[0].bg === '#3E7CA6' && bars[0].op === '0.35',
    'control — the cur-bar extractor reads a seeded harbor bar with its opacity and skips the grey one');
  ok(sliceOf('export function A() {}\nexport function B() {}', 'A').includes('function A'),
    'control — the slicer finds a seeded export');
}

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const mod = await vite.ssrLoadModule('/src/components/Charts.jsx');
  const { PeriodSummary, nextRange } = mod;
  const { C } = await vite.ssrLoadModule('/src/theme.js');
  const { S, MONTH_LABELS, monthByTab } = await vite.ssrLoadModule('/src/i18n/strings.js');
  const { moneyRound } = await vite.ssrLoadModule('/src/lib/format.js');

  /**
   * ——— (a) THE TAP ARITHMETIC — one pure reducer, asserted whole.
   *
   * A first tap starts a one-month range; a tap outside extends toward it
   * (either direction); a tap INSIDE the selection clears back to the full
   * year. That last clause is the «second tap pattern» of the chunk text, and
   * it is the one a hand-rolled onClick would most plausibly get wrong.
   */
  ok(typeof nextRange === 'function', 'E1.a nextRange is exported from Charts.jsx — the tap arithmetic is a testable value, not a closure');
  const nr = (r, i) => (typeof nextRange === 'function' ? nextRange(r, i) : undefined);
  ok(JSON.stringify(nr(null, 3)) === '{"a":3,"b":3}', 'E1.b first tap — a one-month range');
  ok(JSON.stringify(nr({ a: 3, b: 3 }, 6)) === '{"a":3,"b":6}', 'E1.c a tap beyond the end extends the range to it');
  ok(JSON.stringify(nr({ a: 3, b: 6 }, 1)) === '{"a":1,"b":6}', 'E1.d …and a tap before the start extends backwards');
  ok(nr({ a: 3, b: 6 }, 4) === null, 'E1.e a tap INSIDE the selection clears back to the full year');
  ok(nr({ a: 3, b: 3 }, 3) === null, 'E1.f tapping the only selected month again clears too — the one-month case of the same rule');

  /**
   * ——— the year fixture. Eight lived months, four not yet arrived (null —
   * absent, never zero), live month at index 7. Figures chosen so every
   * scoped total is distinct from every unscoped one.
   */
  const YEAR = {
    cur: {
      Visa: [110, 120, 130, 140, 150, 160, 170, 180, null, null, null, null],
      Cash: [10, 20, 30, 40, 50, 60, 70, 80, null, null, null, null],
    },
    prev: {
      Visa: Array(12).fill(100),
      Cash: Array(12).fill(50),
    },
  };
  const summary = (props) => {
    try {
      return renderToStaticMarkup(createElement(PeriodSummary, {
        data: YEAR, labels: MONTH_LABELS, liveIndex: 7, metric: 'all', setMetric: () => {},
        periodNames: { cur: '2026', prev: '2025' }, showBars: true, ...props,
      }));
    } catch (err) {
      failures.push(`PeriodSummary THREW — ${err && err.message}`);
      return '';
    }
  };
  /** The screen in two halves: the chart card, and the method cards below. */
  const split = (html) => {
    const i = html.indexOf(S.sectionByMethod);
    return i === -1 ? { chart: html, cards: '' } : { chart: html.slice(0, i), cards: html.slice(i) };
  };
  const pressedIn = (html) => (html.match(/aria-pressed="(true|false)"/g) || []);

  /**
   * ——— (b) THE LABELS ARE CONTROLS — on the year axis, and only there.
   */
  const idle = summary({});
  const idleBars = split(idle).chart;
  ok(pressedIn(idleBars).length === 12,
    `E1.g the year chart carries twelve month CONTROLS (aria-pressed) — found ${pressedIn(idleBars).length}`);
  ok(!pressedIn(idleBars).includes('aria-pressed="true"'),
    'E1.h …none pressed while nothing is selected: the full year is the resting state');

  const week = renderToStaticMarkup(createElement(PeriodSummary, {
    data: {
      cur: { Visa: [10, 20, 30, null, null, null, null], Cash: [1, 2, 3, null, null, null, null] },
      prev: { Visa: Array(7).fill(5), Cash: Array(7).fill(5) },
    },
    labels: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'], liveIndex: 2, metric: 'all', setMetric: () => {},
    periodNames: { cur: 'w', prev: 'w-1' }, showBars: true,
  }));
  ok(pressedIn(split(week).chart).length === 0,
    'E1.i a week\'s day names stay furniture — range controls are the YEAR axis\'s grammar only');

  /**
   * ——— (c) ONE HUE, TWO VALUES. Selected months harbor; unselected months
   * the SAME harbor, dimmed by opacity alone. Never a second colour.
   */
  const seeded = summary({ rangeSeed: { a: 2, b: 5 } });
  const { chart: sChart, cards: sCards } = split(seeded);
  const bars = curBars(sChart, C.line);
  ok(bars.length === 12, `E1.j all twelve current-series bars still render under a selection — found ${bars.length}`);
  ok(bars.every((b) => b.bg.toUpperCase() === C.harbor.toUpperCase()),
    `E1.k EVERY cur bar is harbor while a range is selected — one hue (got: ${[...new Set(bars.map((b) => b.bg))].join(', ')})`);
  const sel = bars.slice(2, 6), unsel = [...bars.slice(0, 2), ...bars.slice(6)];
  ok(sel.every((b) => b.op === ''),
    'E1.l the four selected months are full-value harbor (no opacity)');
  ok(unsel.every((b) => b.op !== '' && Number(b.op) > 0 && Number(b.op) < 1)
    && new Set(unsel.map((b) => b.op)).size === 1,
    'E1.m every unselected month is the SAME dimmed value — two values exactly, nothing in between');
  ok(pressedIn(sChart).filter((p) => p === 'aria-pressed="true"').length === 4,
    'E1.n the four selected labels say so (aria-pressed="true")');
  ok(!seeded.toUpperCase().includes(C.conflictInk.toUpperCase())
    && !seeded.toUpperCase().includes(C.conflictBg.toUpperCase()),
    'E1.o no conflict red anywhere in the selection UI — selection is navigation, never an alarm');
  // And with nothing selected the bars keep the metric's own colour (control:
  // the harbor takeover is the SELECTION state, not a permanent recolour).
  const idleCur = curBars(split(idle).chart, C.line);
  ok(idleCur.some((b) => b.bg.toUpperCase() !== C.harbor.toUpperCase()),
    'E1.p with no selection the bars keep the metric colour — harbor-everywhere is the selected state only');

  /**
   * ——— (d) THE TOTALS RE-SCOPE, and the scope is said in month WORDS.
   *
   * Mar–Jun of the fixture: all = (130+140+150+160)+(30+40+50+60) = 760,
   * Visa 580, Cash 180; the same months of 2025 sum to 600/400/200 — every
   * month in the selection is CLOSED, so the year-ago comparison is honest
   * and stays.
   */
  const words = `${monthByTab('Mar')}–${monthByTab('Jun')}`;
  for (const [figure, label] of [[760, 'all'], [580, 'Visa'], [180, 'Cash']]) {
    ok(sCards.includes(`>${moneyRound(figure)}<`),
      `E1.q the ${label} card re-scopes to the selection — expected ${moneyRound(figure)} on it`);
  }
  ok(!sCards.includes(`>${moneyRound(1520)}<`),
    'E1.r the full-year figure is OFF the cards while a range is selected — one screen, one scope for these totals');
  ok(sCards.includes(moneyRound(600)),
    'E1.s a fully-closed selection keeps its year-ago figure — same months, last year');
  ok(sCards.includes(words),
    `E1.t the selection is named IN WORDS beside the totals it scopes — expected «${words}»`);
  ok(split(idle).cards.includes(`>${moneyRound(1520)}<`) && !split(idle).cards.includes(words),
    'E1.u …and with no selection the cards say the whole year and no range words (control)');

  /**
   * ——— (e) A SELECTION THAT REACHES THE LIVE MONTH refuses the year-ago
   * comparison. August is mid-flight: its 2026 figure is a partial sum and
   * its 2025 figure is a whole month, and «▼» between those would be the
   * same-point lie the year chart's own marker exists to avoid. The figure
   * stays; only the comparison is withheld (— , the honest absence).
   */
  const live = split(summary({ rangeSeed: { a: 6, b: 7 } })).cards;
  ok(live.includes(`>${moneyRound(500)}<`),
    'E1.v a live-month selection still states its true total (Jul+Aug = 500)');
  ok(!/[▲▼]/.test(live),
    'E1.w …but carries NO delta — a partial month against a full one is not a comparison');
  ok(live.includes('—'),
    'E1.x …and the year-ago slot is the honest absence, never a confident figure');

  /**
   * ——— (f) SOURCE PINS — what the renders cannot see moving.
   */
  const src = await readFile(new URL('../src/components/Charts.jsx', import.meta.url), 'utf8');
  const code = stripComments(src);
  const summarySlice = sliceOf(src, 'PeriodSummary');
  const barsSlice = sliceOf(src, 'PairedBars');
  ok(/nextRange\(/.test(stripComments(summarySlice)),
    'E1.y PeriodSummary consumes nextRange — the reducer proved above is the one the taps actually run');
  ok(/labels\.length === 12/.test(stripComments(summarySlice)),
    'E1.z the year axis is recognised as THE twelve-slot axis (A12\'s own taxonomy: weeks 7, months >12)');
  ok(!/#[0-9a-fA-F]{3,6}/.test(stripComments(barsSlice)),
    'E1.aa no raw hex anywhere in PairedBars code — the selection hue can only be a token');
  ok(/C\.harbor/.test(stripComments(barsSlice)),
    'E1.ab …and the token it rides is harbor, the palette\'s one selection colour');
  // The ❓-money button (CategoryCompare) keeps conflict red — a12's positive
  // control pins that survival. What may never wear it is the selection path.
  const metricSlice = sliceOf(src, 'MetricCards');
  ok([summarySlice, barsSlice, metricSlice].every((s) => !stripComments(s).includes('conflict')),
    'E1.ac no conflict token anywhere in the selection path (PairedBars · PeriodSummary · MetricCards) — red never means «selected»');
} finally {
  await vite.close();
}

if (failures.length) {
  console.log(`❌ CHUNK E1 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · month labels extend a harbor/harbor-dimmed range; the totals re-scope and say their scope in words`);
