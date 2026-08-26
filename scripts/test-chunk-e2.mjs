#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK E2 ═══════════   `node scripts/test-chunk-e2.mjs`
 *
 * «The average rule recomputes per selection, label in words on the right.»
 * (chunk ledger E2 — data-F6; north-star §4.4: «average rule recomputing per
 *  selection».)
 *
 * THE CLAIM, mechanically: PairedBars' average line — the one horizontal rule
 * the bars carry — averages over the SELECTED months when a range is active,
 * over the whole period when none is, and never over slots that do not exist
 * (null is a missing month, not a zero — dragging the average down with
 * absent months would quietly flatter every January). Its label keeps the
 * app's own word (`S.avg` — no new key) and, under a selection, names the
 * range in the month vocabulary the app already owns — handed down from
 * PeriodSummary so the words beside the average and the words beside the
 * re-scoped totals can never disagree.
 *
 * The selected state is reached through props (PairedBars' `range` /
 * `rangeWords`, PeriodSummary's `rangeSeed`) — the peekOpen/policyOpen seam,
 * because SSR cannot tap. The tap arithmetic itself is E1's oracle.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const MARKER = 'CHUNK-E2-GREEN';

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

/** The average pill: the absolutely-positioned span pinned to the right edge. */
const avgSpan = (html) => {
  const re = /<span style="([^"]*)"[^>]*>([\s\S]*?)<\/span>/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[1].includes('position:absolute') && m[1].includes('right:0')) return { style: m[1], inner: m[2] };
  }
  return null;
};

// ——— control: the extractor proves itself on seeded input first.
{
  const seeded = '<div><span style="position:absolute;right:0;bottom:10%">متوسط <span>45</span></span></div>';
  const got = avgSpan(seeded);
  ok(!!got && got.inner.includes('45'), 'control — the avg-span extractor finds a seeded right-pinned label');
  ok(avgSpan('<span style="left:0">x</span>') === null, 'control — and refuses a span that is not right-pinned');
}

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { PairedBars, PeriodSummary } = await vite.ssrLoadModule('/src/components/Charts.jsx');
  const { S, MONTH_LABELS, monthByTab } = await vite.ssrLoadModule('/src/i18n/strings.js');
  const { moneyRound } = await vite.ssrLoadModule('/src/lib/format.js');

  const CUR = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];
  const PREV = Array(12).fill(40);
  const bars = (props) => {
    try {
      return renderToStaticMarkup(createElement(PairedBars, {
        cur: CUR, prev: PREV, labels: MONTH_LABELS, liveIndex: -1, color: '#2C4356', ...props,
      }));
    } catch (err) {
      failures.push(`PairedBars THREW — ${err && err.message}`);
      return '';
    }
  };
  const WORDS = `${monthByTab('Mar')}–${monthByTab('Jun')}`;

  /**
   * ——— (a) THE RESTING STATE IS UNCHANGED: whole-period average, S.avg, at
   * the right. [10..120] averages 65 — and no range words appear, because a
   * label naming a scope that is not in force would be a false sentence.
   */
  const idle = avgSpan(bars({}));
  ok(!!idle, 'E2.1 the average pill renders, right-pinned, with no selection');
  ok(!!idle && text(idle.inner).includes(`${S.avg} ${moneyRound(65)}`),
    `E2.2 no selection — the average is the whole period's (65), labelled with S.avg alone`);
  ok(!!idle && !idle.inner.includes(WORDS),
    'E2.3 …and carries no range words while no range is selected');

  /**
   * ——— (b) THE RULE RECOMPUTES PER SELECTION. Mar–Jun of the fixture is
   * [30,40,50,60] → 45. The whole-period 65 must be OFF the pill: two
   * averages under one label would be the chart disagreeing with itself.
   */
  const sel = avgSpan(bars({ range: { a: 2, b: 5 }, rangeWords: WORDS }));
  ok(!!sel && text(sel.inner).includes(moneyRound(45)),
    'E2.4 Mar–Jun selected — the average is the selection\'s own (45)');
  ok(!!sel && !text(sel.inner).includes(moneyRound(65)),
    'E2.5 …and the whole-period figure is off the pill — one label, one scope');
  ok(!!sel && text(sel.inner).includes(`${S.avg} ${WORDS} ${moneyRound(45)}`),
    `E2.6 the label reads «${S.avg} ${WORDS} …» — the existing word plus the range's own month words, no new key`);
  ok(!!sel && sel.style.includes('right:0'),
    'E2.7 …and it stays at the right, where the average has always spoken');

  /**
   * ——— (c) ABSENT MONTHS NEVER DRAG THE AVERAGE. A null inside the selection
   * is a month with no tab: [30, null, 50, 60] averages over THREE months
   * (46.67 → 47), never over four (35 — the flattering lie).
   */
  const holed = [10, 20, 30, null, 50, 60, 70, 80, null, null, null, null];
  const hole = avgSpan(bars({ cur: holed, range: { a: 2, b: 5 }, rangeWords: WORDS }));
  ok(!!hole && text(hole.inner).includes(moneyRound(140 / 3)),
    'E2.8 a null month inside the selection is skipped — the average is over months that exist');
  ok(!!hole && !text(hole.inner).includes(moneyRound(35)),
    'E2.9 …and never the null-as-zero average');

  /**
   * ——— (d) THE REAL SCREEN hands the words down. The same seeded selection
   * through PeriodSummary must put the SAME words on the average pill that
   * E1 pins beside the totals — one derivation, one vocabulary.
   */
  const screen = (() => {
    try {
      return renderToStaticMarkup(createElement(PeriodSummary, {
        data: {
          cur: { Visa: CUR, Cash: Array(12).fill(0) },
          prev: { Visa: PREV, Cash: Array(12).fill(0) },
        },
        labels: MONTH_LABELS, liveIndex: 11, metric: 'all', setMetric: () => {},
        periodNames: { cur: '2026', prev: '2025' }, showBars: true,
        rangeSeed: { a: 2, b: 5 },
      }));
    } catch (err) {
      failures.push(`PeriodSummary THREW — ${err && err.message}`);
      return '';
    }
  })();
  const onScreen = avgSpan(screen);
  ok(!!onScreen && text(onScreen.inner).includes(`${S.avg} ${WORDS} ${moneyRound(45)}`),
    'E2.10 the seeded year screen carries the recomputed, worded average — the wiring is real, not only the component seam');
} finally {
  await vite.close();
}

if (failures.length) {
  console.log(`❌ CHUNK E2 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · the average rule follows the selection and says its scope in the app's own month words`);
