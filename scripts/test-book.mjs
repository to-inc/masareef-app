#!/usr/bin/env node
/**
 * «الدفتر» — the merged Book.  `npm run check:book`
 *
 * ——— WHAT THE MERGE ACTUALLY WAS (finding M1).
 *
 * «اليوم» and «الأخير» rendered the SAME SIX ROWS from the same fetch, in two
 * visual languages, behind two segmented controls offering different periods.
 * One showed the gap as a red mark that did nothing; the other made it fixable.
 * This suite pins the parts of that merge that are DECISIONS rather than layout:
 * where a period's rows come from, what the day's figure is, what happens to
 * foreign money, and — the one that shipped wrong — which rows are doors.
 *
 * ——— THE BUG THIS FILE EXISTS FOR.
 *
 * `needsCategory` was written as `!row.category`, which is the obvious reading
 * and is false for every row it was written to catch: an uncategorised row does
 * not arrive empty, it arrives carrying the literal `❓`. That glyph is a real
 * value in his Category column — it is what `fix_category` overwrites. So the
 * doors rendered as ordinary categories displaying a question mark, which looked
 * exactly like the screen being replaced. Found by opening the app, not by
 * reading the diff.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';
import {
  BOOK_PERIODS, bookPeriods, isBookPeriod, rowsSource,
  egpTotalOf, travelOf, needsCategory,
} from '../src/state/book.js';
import { periodTotals, comparisonOf, hasShape } from '../src/lib/series.js';
import { METRICS, UNKNOWN_CATEGORY } from '../src/lib/constants.js';
import { batchable } from '../src/state/inboxOutcomes.js';
import { AR, AR_LOCALE } from '../src/i18n/strings.ar.js';

// A row shows the category's LABEL (finding M2); the value is what the sheet
// holds and what `fix_category` posts.
const L = AR_LOCALE.categoryLabel;

let pass = 0;
const failures = [];
const eq = (a, b, label) => {
  if (Object.is(a, b)) { pass++; return; }
  failures.push(`${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const ok = (c, label) => eq(!!c, true, label);

// ——————————————————————— the four zooms
eq(BOOK_PERIODS.join(','), 'today,week,month,year', 'four periods, in the order he reads them');
ok(isBookPeriod('year'), 'the year is one of them — «الأخير» had no way to reach it');
ok(!isBookPeriod('decade'), 'and nothing else is');
ok(bookPeriods() !== BOOK_PERIODS, 'the list is handed out as a copy…');
eq(bookPeriods().join(','), BOOK_PERIODS.join(','), '…with the same contents');

/**
 * ——————————————————————— WHERE A PERIOD'S ROWS COME FROM.
 *
 * Today's rows are already in the summary payload every screen fetches. Asking
 * the server for them again is a needless Apps Script cold start (1–3s) on the
 * screen he opens most — the exact latency the snapshot cache exists to hide.
 */
eq(rowsSource('today', null), 'summary', "today's rows are already in hand");
eq(rowsSource('week', null), 'fetch', 'a week needs a read');
eq(rowsSource('month', null), 'fetch', 'and so does a month');
eq(rowsSource('year', null), 'fetch', 'and a year');
/**
 * Browsing an explicit month always fetches — INCLUDING when that month is the
 * current one. `summary.today` is one DAY; answering a request for a month with
 * a day's rows is the kind of quiet wrongness that looks like an empty book.
 */
eq(rowsSource('today', { y: 2026, m: 8 }), 'fetch',
  'browsing a month fetches even from the Today position…');
eq(rowsSource('month', { y: 2026, m: 8 }), 'fetch', '…and browsing the CURRENT month still fetches');

/**
 * ——————————————————————— THE DAY'S FIGURE — the one he used to add himself.
 *
 * Read from the server's `today.totals`, which are EGP-only by D8. Deriving it a
 * second time from the rows would be a second answer to a question the payload
 * already answers.
 */
eq(egpTotalOf({ Visa: 1149.75, Cash: 260 }), 1409.75, 'card plus cash is the day');
eq(egpTotalOf({ Visa: 0, Cash: 0 }), 0, 'a day with nothing spent is zero, which is a true figure');
eq(egpTotalOf({}), 0, 'a payload with no totals does not throw…');
eq(egpTotalOf(null), 0, '…and neither does no payload');
eq(egpTotalOf({ Visa: 'x', Cash: 260 }), 260, 'an unreadable half is skipped rather than made NaN');

/**
 * ——————————————————————— THE TRAVEL LINE (finding S4).
 *
 * D8 writes a non-EGP row into his sheet as `"12.5 EUR"` TEXT and excludes it
 * from every EGP sum — correctly; adding euros to pounds is not arithmetic. But
 * the exclusion was silent, so a day with a foreign purchase showed a total
 * quietly missing one, under a heading reading «زي ما هي في الشيت بالظبط».
 */
{
  const day = [
    { amount: 60, currency: 'EGP' },
    { amount: 12.5, currency: 'EUR' },
    { amount: 7.5, currency: 'EUR' },
    { amount: 100, currency: 'SEK' },
  ];
  const t = travelOf(day);
  eq(t.length, 2, 'two foreign currencies is two lines');
  eq(JSON.stringify(t), '[{"currency":"EUR","amount":20},{"currency":"SEK","amount":100}]',
    'each summed within itself, in a stable order');
  /**
   * NEVER ACROSS CURRENCIES. 20 EUR + 100 SEK is not 120 of anything, and a
   * single figure here would be the same class of invention as `money(null)`
   * rendering 0.
   */
  ok(!t.some((x) => x.amount === 120), 'and never summed across them');
  eq(travelOf([{ amount: 60, currency: 'EGP' }]).length, 0,
    'a day with no foreign spending says nothing about foreign spending');
  eq(travelOf([]).length, 0, 'an empty day is quiet');
  eq(travelOf(null).length, 0, 'and a missing list is not a crash');
  eq(travelOf([{ amount: null, currency: 'EUR' }]).length, 0,
    'an UNPRICED foreign row contributes nothing — `|| 0` here would invent a zero-euro purchase');
}

/**
 * ——————————————————————— WHICH ROWS ARE DOORS (finding M6). THE SHIPPED BUG.
 */
eq(UNKNOWN_CATEGORY, '❓', 'the gap has a literal value in his sheet, and this is it');
ok(needsCategory({ category: UNKNOWN_CATEGORY }),
  'a ❓ row needs a category — the case `!row.category` got WRONG, because ❓ is truthy');
ok(needsCategory({ category: '' }), 'and so does an empty cell he left blank himself');
ok(needsCategory({ category: '   ' }), 'and one holding only spaces — a space is not a category');
ok(needsCategory({}), 'and a row with no category field at all');
ok(!needsCategory({ category: 'Groceries' }), 'while a filed row is not a door…');
ok(!needsCategory({ category: 'omara2 al behar' }), '…including the ones with unusual names');
ok(!needsCategory(null), 'and nothing is not a row');

/**
 * ——————————————————————— THE ONE SENTENCE (finding M5), and when there is none.
 */
eq(JSON.stringify(comparisonOf(18602, 19229)), '{"pct":3,"direction":"down","prevAt":19229}',
  'less than last month, by a whole percent');
eq(comparisonOf(20000, 19229).direction, 'up', 'and more is up');
eq(comparisonOf(19229, 19229).direction, 'same', 'and identical is neither');
/**
 * NO SENTENCE RATHER THAN A NONSENSE ONE. Against a previous period of zero
 * every change is infinitely more; `▲ ∞%` is the confident-garbage case the
 * honest-render law exists to stop, and `null` is what the view renders nothing
 * for.
 */
eq(comparisonOf(500, 0), null, 'nothing to compare against is NOT "up 100%"');
eq(comparisonOf(500, null), null, 'and a missing comparison is not zero');
eq(comparisonOf(500, undefined), null, 'nor an absent one');

/**
 * ——————————————————————— ONE COMPUTATION FOR THE HEADLINE AND THE CARDS.
 *
 * The Book leads with the figure and `PeriodSummary` prints it again on the
 * active metric card. Two derivations of one number is how this project has
 * produced three of its bugs, so both read `periodTotals`.
 */
{
  const data = { cur: { Visa: [100, 200, null], Cash: [50, 25, null] }, prev: { Visa: [10, 10, 10], Cash: [5, 5, 5] } };
  const t = periodTotals(data, METRICS);
  eq(t.all.now, 375, 'the period sums its own series');
  eq(t.Visa.now, 300, 'per metric');
  eq(t.Cash.now, 75, 'both of them');
  eq(t.all.prevAt, 30, 'and the comparison is taken at the SAME POINT, not at the end');
  const off = periodTotals(data, METRICS, { Visa: 40, Cash: 10 });
  eq(off.all.now, 425, 'off-plot money is in the total…');
  eq(off.Visa.now, 340, '…and lands on the right metric');
  eq(off.Cash.now, 85, 'both of them');
  // The absent comparison, carried through as absence.
  const none = periodTotals({ cur: data.cur, prev: { Visa: [null, null, null], Cash: [null, null, null] } }, METRICS);
  eq(none.all.prevAt, null, 'no comparison data is null, never a confident 0');
}

/**
 * ——————————————————————— A PERIOD WITH ONE POINT HAS NO SHAPE (finding M7).
 *
 * Observed in the running app on the first day of a week: the cumulative line is
 * a dot at the origin, every bar is last week's grey, and all three metric cards
 * read ▼100% — because a full week against one morning genuinely is. Every
 * figure true, and the screen reads as broken, which is its own dishonesty.
 *
 * Counts SLOTS, not spending. A Monday he spent nothing on is a real zero and a
 * real point; treating it as absent would hide the chart from a week that has
 * perfectly good shape.
 */
eq(hasShape([100, 50, null, null]), true, 'two days is a line');
eq(hasShape([100, null, null]), false, 'one day is a dot, not a line');
eq(hasShape([null, null]), false, 'and no days is nothing');
eq(hasShape([0, 0, null]), true,
  'two days of spending NOTHING is still two points — a genuine zero is data');
eq(hasShape([]), false, 'an empty series has no shape');
eq(hasShape(null), false, 'and neither does a missing one');
eq(hasShape([1, 2, 3, 4, 5, 6, 7]), true, 'a full week certainly does');

/**
 * ——————————————————————— THE BATCH (finding M4), and what it refuses.
 */
{
  const item = (over = {}) => ({
    tab: 'Aug', rowHint: 1, guess: 'Groceries', stale: false,
    match: { date: '17/8/2026', description: 'Nile Star Market', method: 'Visa', category: '❓', amount: 10, currency: 'EGP' },
    ...over,
  });
  const asRows = (items) => items.map((it, i) => ({ key: String(i), item: it, outcome: null }));

  eq(batchable(asRows([item(), item()])).length, 2, 'two guessed rows are two the app already knows');
  /**
   * NO GUESS, NO BATCH. This is D5 at the batch: the app may not assert a
   * category it has not earned, and sweeping the un-guessed rows in would be the
   * one thing it has never done.
   */
  eq(batchable(asRows([item(), item({ guess: null })])).length, 1,
    'an UN-GUESSED row is never swept in — that would be the app inventing a category');
  /**
   * STALE rows are folded behind «مصاريف قديمة» because they are months old and
   * want reading. A button that silently settled forty travel rows he cannot see
   * is the opposite of what the batch is for.
   */
  eq(batchable(asRows([item(), item({ stale: true })])).length, 1,
    'and neither is a folded months-old row he cannot see');
  // Already dealt with — pressing twice must not re-send.
  const rows = asRows([item(), item()]);
  rows[0].outcome = { status: 'done', category: 'Groceries' };
  eq(batchable(rows).length, 1, 'a row already settled is not sent again');
  rows[1].outcome = { status: 'saving', category: 'Groceries' };
  eq(batchable(rows).length, 0, 'nor one still in flight — this is the double-tap guard');
  rows[1].outcome = { status: 'failed' };
  eq(batchable(rows).length, 1, 'while a FAILED row is offered again, because it still needs him');
  eq(batchable(null).length, 0, 'and nothing is not a list');
}

/**
 * ——————————————————————— AND THE SCREEN ACTUALLY DOES ALL OF THAT.
 *
 * Everything above is a pure function. This project's recurring failure is a
 * correct function beside a view that kept its own inline copy, so the render is
 * checked too — with a payload whose right and wrong answers are different
 * numbers.
 */
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const BookView = (await vite.ssrLoadModule('/src/views/BookView.jsx')).default;
  const day = (over = {}) => ({
    date: '17/8/2026', description: 'Nile Star Market', method: 'Visa',
    category: 'Groceries', amount: 100, currency: 'EGP', ...over,
  });
  const payload = (entries, totals) => ({
    today_cairo: { y: 2026, m: 8, d: 17 },
    today: { entries, totals },
    week: { cur: { Visa: [1], Cash: [1] }, prev: { Visa: [1], Cash: [1] } },
    month: {
      cur: { Visa: [1], Cash: [1] }, prev: { Visa: [1], Cash: [1] },
      names: { cur: 'August', prev: 'July' },
    },
    year: { cur: { Visa: [1], Cash: [1] }, prev: { Visa: [1], Cash: [1] } },
    monthCats: [], pending: [],
  });
  const render = (p) => renderToStaticMarkup(createElement(BookView, { data: p }));
  const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  const withTravel = text(render(payload(
    [day(), day({ description: 'Café', amount: 12.5, currency: 'EUR' })],
    { Visa: 100, Cash: 0 },
  )));
  ok(withTravel.includes('100'), 'the day states its EGP figure');
  ok(withTravel.includes('12.5'), 'and names the foreign money…');
  ok(withTravel.includes(AR.travelApart), '…as standing apart from it');
  ok(!withTravel.includes('112.5'), 'and NEVER adds euros to pounds');

  // The gap is a door, in the rendered screen and not merely in the predicate.
  const withGap = text(render(payload([day({ category: UNKNOWN_CATEGORY })], { Visa: 100, Cash: 0 })));
  ok(withGap.includes(AR.rowNeedsCategory),
    'an uncategorised row invites the tap — this is the assertion the shipped bug failed');
  ok(!withGap.includes(UNKNOWN_CATEGORY),
    'and the raw ❓ glyph is not printed at him as though it were a category');
  const filed = text(render(payload([day()], { Visa: 100, Cash: 0 })));
  ok(!filed.includes(AR.rowNeedsCategory), 'while a filed row does not — the check can fail');
  ok(filed.includes(L('Groceries')), 'it shows its category instead');
  ok(!filed.includes('>Groceries<'),
    'and does NOT paint the frozen wire value at him in a list he only reads');

  /**
   * THE DATE IS NOT REPEATED UNDER «النهاردة» (finding S5) — the old grid printed
   * it once per row on a screen whose own title says which day it is.
   */
  const twoRows = render(payload([day(), day({ description: 'Taqa' })], { Visa: 200, Cash: 0 }));
  eq((twoRows.match(/17\/8\/2026/g) || []).length, 0,
    'today\'s rows carry no date at all — the heading already said it');

  /**
   * ——— THE ROW HE NEVER CHOSE (finding A2, re-scoped).
   *
   * The server flags a row whose category the merchant memory would have picked.
   * Both directions, because a mark that always shows and one that never shows
   * each pass half of this alone — and the always case is the damaging one here,
   * since most of his card spending IS memory-filed and a mark on every row is
   * a screen of noise.
   */
  const auto = text(render(payload([day({ auto: true })], { Visa: 100, Cash: 0 })));
  ok(auto.includes(AR.rowAuto), 'a row filed from memory says so, quietly');
  const chose = text(render(payload([day()], { Visa: 100, Cash: 0 })));
  ok(!chose.includes(AR.rowAuto), 'and a row he chose himself does not');
  /**
   * AND NEVER ON A ❓. That row is entirely about him not having chosen yet,
   * which the door already says — better, and in words he can act on.
   */
  const gapAuto = text(render(payload([day({ category: UNKNOWN_CATEGORY, auto: true })], { Visa: 100, Cash: 0 })));
  ok(!gapAuto.includes(AR.rowAuto), 'and never on a gap, which says its own thing already');

  const src = await readFile(new URL('../src/views/BookView.jsx', import.meta.url), 'utf8');
  ok(/showDate=\{period !== 'today'\}/.test(src),
    'and the other periods DO get it, where the date is what tells the rows apart');
} finally {
  await vite.close();
}

/**
 * ——————————————————————— THE MERGE HAPPENED, structurally.
 */
{
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const tabs = app.slice(app.indexOf('<nav'), app.indexOf('</nav>'));
  eq((tabs.match(/<TabButton/g) || []).length, 3, 'three destinations, not five');
  ok(/tab === 'book'/.test(app), 'the Book is one of them');
  ok(!/tab === 'summary'/.test(app), 'and «اليوم» is gone as a destination…');
  ok(!/tab === 'recent'/.test(app), '…as is «الأخير»…');
  ok(!/tab === 'receipt'/.test(app), '…and «فاتورة», which held one button');
  /**
   * The receipt did not vanish — it became a MODE of the entry screen, and the ﹢
   * always returns to the keypad. Landing on the camera because that is where he
   * last left the tab is the shape-changed-under-you problem, on the screen
   * where five seconds are the law.
   */
  ok(/onConfirmMany=\{confirmMany\}/.test(app), 'the Inbox is handed a batch handler…');
  ok(/confirmPending\(item, item\.guess, \{ quiet: true \}\)/.test(app),
    '…which settles each row through the SAME call a single tap makes — never a second write path');
  ok(/no-await-in-loop/.test(app),
    'and does it in series, because fix_category takes a sheet lock and five racers can land on the wrong row');
  ok(/entryMode === 'receipt'/.test(app), 'the camera is a mode of ﹢…');
  ok(/setEntryMode\('keypad'\); setTab\('entry'\)/.test(app), '…and the tab press always resets to the keypad');
}

const report = failures.length
  ? `❌ ${failures.length} / ${pass + failures.length} book checks failed:\n  - ${failures.join('\n  - ')}`
  : `✅ all ${pass} book checks passed`;
console.log(report);
process.exit(failures.length ? 1 : 0);
