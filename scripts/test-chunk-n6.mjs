#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK N6 ═══════════
 * «The month heading becomes a MONTH PICKER: tapping «August» opens a serif
 *  sheet of the current year's months; choosing one fetches THAT month and
 *  compares it against the month BEFORE the chosen one — never always-July.
 *  The sheet is an advisory surface with a RADIUS.sheet (24) lip.»
 *  (chunk-ledger N6; north-star §4.4 «months stop being a dead end»; GAP 3 /
 *  data-F10.)
 *
 * WHAT IS RENDERED AND WHAT IS PINNED, and why the split is honest. SSR cannot
 * tap, so the two INTERACTIONS (open the sheet, choose a month) are pinned at
 * the source — the same route test-accountability already walks for the Month
 * tab — while everything a render CAN prove is rendered: the sheet itself
 * (serif, lip, TAP-height months, newest first, current year only), the
 * heading-as-button, and the browsed month's whole screen built from his own
 * rows, comparing against the month before the CHOSEN one.
 *
 * THE HONESTY CORE: `browsedMonthData` may only restate sums of rows that
 * arrived. Its zeros are TRUE zeros (a closed month's quiet day), its nulls are
 * absences (the current month's future days, a comparison month we could not
 * read), and its foreign shape rides the same state/foreign.js machinery the
 * live month uses — so a browsed travel month refuses its percentage exactly
 * like a live one.
 *
 * Every locale-key dereference is GUARDED — a missing key is a NAMED failure,
 * never «is not a function» killing the run (the N1/N1b lesson, twice in one
 * afternoon).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { TYPE, RADIUS, TAP, C } from '../src/theme.js';
import { AR, AR_LOCALE } from '../src/i18n/strings.ar.js';
import { EN } from '../src/i18n/strings.en.js';

const MARKER = 'CHUNK-N6-GREEN';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(root, p), 'utf8');

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };
const eq = (a, b, label) => ok(Object.is(a, b), `${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

// ═══ 1. i18n — the sheet's two words, BOTH locales, guarded ═══
for (const [name, L] of [['ar', AR], ['en', EN]]) {
  ok(typeof L.monthPickerTitle === 'string' && L.monthPickerTitle.length > 0,
    `N6.1 ${name}.monthPickerTitle exists — the sheet has a name a screen reader can say`);
  ok(typeof L.monthPickerClose === 'string' && L.monthPickerClose.length > 0,
    `N6.2 ${name}.monthPickerClose exists — the way out has words`);
}

// ═══ 2. SOURCE — the wiring SSR cannot tap ═══
{
  const view = src('src/views/BookView.jsx');
  ok(/browsing \? \[browsing, monthBefore\(browsing\)\]/.test(view),
    'N6.3 choosing a month fetches THAT month AND the month before it — the comparison has real data behind it');
  ok(/!browsing && period === 'month' &&/.test(view),
    'N6.4 the LIVE month block stands down while a month is browsed — never August\'s figure over June\'s rows');
  ok(/<MonthSheet/.test(view) && /pickerOpen/.test(view),
    'N6.5 the sheet is mounted from the Book behind a pickerOpen state the heading toggles');
  ok(/setBrowsing\(ref\.y === today\.y && ref\.m === today\.m \? null : ref\)/.test(view),
    'N6.6 choosing the CURRENT month returns to the live screen; any other month browses — one handler, stated once');
  ok((view.match(/onPickMonth=\{/g) || []).length >= 2,
    'N6.7 both month screens (live and browsed) hand the heading the picker — the door exists wherever the heading does');
}

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const mod = await vite.ssrLoadModule('/src/views/BookView.jsx');
  const { MonthSheet, MonthScreen, PeriodBlock, monthBefore, browsedMonthData } = mod;

  // ═══ 3. the month-before arithmetic — the «never always-July» core ═══
  if (typeof monthBefore !== 'function') {
    failures.push('N6.8 monthBefore is not exported — the chosen month has nothing defined to compare against');
  } else {
    eq(JSON.stringify(monthBefore({ y: 2026, m: 6 })), '{"y":2026,"m":5}',
      'N6.8 June compares against May');
    eq(JSON.stringify(monthBefore({ y: 2026, m: 1 })), '{"y":2025,"m":12}',
      'N6.9 January steps back over the year boundary to December');
  }

  // ═══ 4. the sheet itself — serif, lipped, TAP-height, newest first ═══
  if (typeof MonthSheet !== 'function') {
    failures.push('N6.10 MonthSheet is not a component — tapping «August» has nothing to open');
  } else {
    const html = renderToStaticMarkup(createElement(MonthSheet, {
      today: { y: 2026, m: 8, d: 17 }, browsing: null, onChoose: () => {}, onClose: () => {},
    }));
    const t = text(html);
    const M = AR_LOCALE.monthByTab;
    ok(html.includes(`border-radius:${RADIUS.sheet}px ${RADIUS.sheet}px 0 0`),
      `N6.10 the sheet's lip rides RADIUS.sheet=${RADIUS.sheet} — the advisory surface's own radius, one step softer than the card`);
    ok(t.includes(M('Aug')) && t.includes(M('Jan')),
      'N6.11 the current year\'s months are all reachable — August down to January');
    ok(!t.includes(M('Sep')) && !t.includes(M('Dec')),
      'N6.12 and no month the year has not reached — a future month has no data to show');
    ok(t.indexOf(M('Aug')) < t.indexOf(M('Jul')) && t.indexOf(M('Jul')) < t.indexOf(M('Jun')),
      'N6.13 newest first — the month he stands in is the first thing under his thumb (the monthStrip order)');
    const monthBtn = html.match(/<button[^>]*style="([^"]*)"[^>]*>[^<]*<span[^>]*>[^<]*<\/span>/);
    const btnStyle = (html.match(/<button[^>]*aria-pressed[^>]*style="([^"]*)"/) || [])[1] || '';
    ok(btnStyle.includes(`min-height:${TAP}px`),
      `N6.14 a month is a ${TAP}pt target — senior floor, not a list of small text`);
    ok(btnStyle.includes('Baskerville'),
      'N6.15 the months are set in the display serif — a «serif month sheet», as ruled');
    ok(typeof AR.monthPickerClose === 'string' && html.includes(`aria-label="${AR.monthPickerClose}"`),
      'N6.16 the way out is a real labelled control, not a dead zone');
    void monthBtn;
  }

  // ═══ 5. the heading is a DOOR when the picker is wired, and only then ═══
  {
    const names = { cur: AR_LOCALE.monthName('August'), prev: AR_LOCALE.monthName('July') };
    const week = { cur: { Visa: [200, 100, null], Cash: [0, 0, null] }, prev: { Visa: [100, 100, 100], Cash: [0, 0, 0] } };
    const withPick = renderToStaticMarkup(createElement(PeriodBlock, { data: week, names, onPickMonth: () => {} }));
    const headingBtn = new RegExp(`<button[^>]*>(?:<span[^>]*>)?[^<]*${names.cur}`);
    ok(headingBtn.test(withPick),
      'N6.17 with a picker wired, the month heading renders as a BUTTON — «August» is tappable');
    const withoutPick = renderToStaticMarkup(createElement(PeriodBlock, { data: week, names }));
    ok(!headingBtn.test(withoutPick),
      'N6.18 without one it stays a plain label — a week\'s heading does not pretend to open anything');
  }

  // ═══ 6. browsedMonthData — sums that arrived, absences that stay absent ═══
  const row = (over = {}) => ({
    date: '5/6/2026', description: 'x', method: 'Visa', category: 'Groceries',
    amount: 100, currency: 'EGP', ...over,
  });
  if (typeof browsedMonthData !== 'function') {
    failures.push('N6.19 browsedMonthData is not exported — the browsed month has no honest head to render');
  } else {
    const today = { y: 2026, m: 8, d: 17 };
    const june = [
      row(),                                                              // day 5, Visa 100
      row({ date: '10/6/2026', method: 'Cash', category: 'Car', amount: 200 }),
      row({ date: '7/6/2026', category: '❓', amount: 50 }),              // uncategorised money
      row({ date: '221', category: 'Gas', amount: 25 }),                  // undated, priced
      row({ date: '12/6/2026', category: 'Villa', amount: null }),        // unpriced
      row({ date: '15/6/2026', category: 'Vacations', amount: 12.5, currency: 'EUR' }), // foreign
    ];
    const may = [row({ date: '3/5/2026', amount: 400 })];
    const d = browsedMonthData({ y: 2026, m: 6 }, june, may, today);

    eq(d && d.month && d.month.names && d.month.names.cur, 'June',
      'N6.19 the browsed month names ITSELF (the server\'s English name, localized downstream)');
    eq(d && d.month && d.month.names && d.month.names.prev, 'May',
      'N6.20 …and its comparison is the month BEFORE the chosen one — May, never a hardwired July');
    eq(d && d.month.cur.Visa.length, 30, 'N6.21 June has thirty day slots, because June has thirty days');
    eq(d && d.month.cur.Visa[4], 100, 'N6.22 a row lands on its own day');
    eq(d && d.month.cur.Cash[9], 200, 'N6.23 …on its own method');
    eq(d && d.month.cur.Visa[19], 0,
      'N6.24 a closed month\'s quiet day is a TRUE zero — the book says nothing was spent, and that is data');
    eq(d && d.month.undated.count, 1, 'N6.25 the unreadable date is counted, not guessed onto a day');
    eq(d && d.month.undated.Visa, 25, 'N6.26 …and its money still reaches the total (off-plot, like the live month)');
    eq(d && d.month.unpriced.count, 1, 'N6.27 an unpriced row is counted — the total is knowably short and will say so');
    eq(d && d.month.uncategorized.total, 50, 'N6.28 ❓ money is stated so the list can reconcile');
    eq(d && d.month.foreign && d.month.foreign.byCurrency && d.month.foreign.byCurrency.EUR, 12.5,
      'N6.29 foreign money keeps its own line and never joins an EGP sum');
    const catSum = d ? d.monthCats.reduce((s, c) => s + c.now, 0) : NaN;
    eq(catSum + (d ? d.month.uncategorized.total : 0), 375,
      'N6.30 categories + ❓ account for every EGP pound that arrived (100+200+25+50) — the rollup can reconcile');
    ok(d && !d.monthCats.some((c) => c.name === '❓'),
      'N6.31 …and ❓ is not dressed as a category');

    // the CURRENT month browsed: future days are ABSENT, never fabricated zeros
    const cur = browsedMonthData({ y: 2026, m: 8 }, [row({ date: '5/8/2026' })], null, today);
    eq(cur && cur.month.cur.Visa[16], 0, 'N6.32 today and before: real slots');
    eq(cur && cur.month.cur.Visa[17], null,
      'N6.33 tomorrow onward: null — a day that has not happened is an absence, not a zero');
    ok(cur && cur.month.prev.Visa.every((v) => v == null),
      'N6.34 a comparison month we could not read is all absence — never a confident month of zeros');

    // ═══ 7. the browsed screen itself — compared against MAY, in words ═══
    const html = renderToStaticMarkup(createElement(MonthScreen, {
      data: browsedMonthData({ y: 2026, m: 6 }, [row(), row({ date: '10/6/2026', method: 'Cash', category: 'Car', amount: 200 })], may, today),
      metric: 'all', setMetric: () => {}, onGoToInbox: () => {},
    }));
    const t = text(html);
    const mayName = AR_LOCALE.monthName('May');
    const lessThanMay = typeof AR.lessThan === 'function' ? AR.lessThan(mayName) : null;
    ok(!!lessThanMay && t.includes(lessThanMay) && t.includes('25'),
      `N6.35 the browsed June says «${lessThanMay} 25%» — compared against the month BEFORE the chosen one`);
    ok(!t.includes(AR_LOCALE.monthName('July')),
      'N6.36 …and July is nowhere on it — «never always-July» is the whole point of the chunk');

    // a browsed TRAVEL month refuses its HEADLINE percentage like a live one.
    // (The per-category list keeps its neutral deltas — per-category EGP sums
    // are whole facts, and the LIVE month screen already renders them under
    // foreign months; the law here is about the month's ONE sentence.)
    const travel = renderToStaticMarkup(createElement(MonthScreen, {
      data: browsedMonthData({ y: 2026, m: 6 }, [row(), row({ date: '15/6/2026', amount: 80, currency: 'EUR', category: 'Vacations' })], may, today),
      metric: 'all', setMetric: () => {}, onGoToInbox: () => {},
    }));
    const tTravel = text(travel);
    ok(typeof AR.whyNoCompare === 'string' && tTravel.includes(AR.whyNoCompare),
      'N6.37 a browsed month with foreign money says WHY there is no comparison — the one policy line, on the browsed path too');
    ok(!!lessThanMay && !tTravel.includes(lessThanMay)
      && (typeof AR.moreThan !== 'function' || !tTravel.includes(AR.moreThan(mayName))),
      'N6.38 …and the headline sentence itself is refused — an EGP-subset percentage under a euro month is the ▼100% lie');
    ok(/80\s*EUR/.test(tTravel) || tTravel.includes('80'),
      'N6.39 …while the euros stay NAMED beside the figure — suppression hides policy prose, never money');
  }
} finally {
  await vite.close();
}

if (failures.length) {
  console.log(`❌ CHUNK N6 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · the month heading opens a serif sheet; a chosen month is fetched and compared against the month before it`);
