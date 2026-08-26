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
import { hasForeign, mayCompare, foreignLines, unsizedForeign } from '../src/state/foreign.js';
import {
  DISPLAY_CURRENCIES, getDisplayCurrency, setDisplayCurrency, otherDisplayCurrency, leadAndAsides,
} from '../src/state/display.js';
import { METRICS, UNKNOWN_CATEGORY } from '../src/lib/constants.js';
import { batchable } from '../src/state/inboxOutcomes.js';
import { AR, AR_LOCALE } from '../src/i18n/strings.ar.js';
import { TYPE } from '../src/theme.js';

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
 * ═══════════ «THIS WEEK 0» — THE RENDER HALF ═══════════
 *
 * D8 excludes non-EGP rows from every EGP sum, correctly. But a week spent
 * entirely abroad then has an EGP total of ZERO, and the screen would render
 * «0» beside «▼100%» — telling a retired man he spent nothing in a week he
 * spent two hundred euros. Two defensible figures, one falsehood, in the
 * largest type on the screen.
 */
ok(!hasForeign(null), 'an ordinary period has no foreign money');
ok(!hasForeign({ count: 0, byCurrency: {} }), 'and neither does one that says so');
ok(hasForeign({ count: 3, byCurrency: { EUR: 200 } }), 'while three euro rows is foreign money');
/**
 * COUNT, NOT byCurrency's emptiness. A period can hold an UNPRICED foreign row —
 * he wrote the shop down and never the price — which is money we know is there
 * and cannot size. Reading `byCurrency` would call that period clean and restore
 * the bare total in exactly the case with the least information behind it.
 */
ok(hasForeign({ count: 1, byCurrency: {} }),
  'an unpriced foreign row still forbids the bare total — we know it is there and cannot size it');

ok(mayCompare(null, null), 'two clean periods may be compared');
ok(!mayCompare({ count: 2, byCurrency: { EUR: 90 } }, null),
  'a period WITH foreign money may never show a percentage — this is the ▼100% case');
ok(!mayCompare(null, { count: 2, byCurrency: { EUR: 90 } }),
  'and neither may one compared AGAINST a foreign period — the base is a subset either way');
/**
 * The one place here that fails OPEN, deliberately: an absent `prevForeign` means
 * "we were not told", not "it was dirty". Refusing every comparison for want of a
 * field would delete a true and useful sentence from every ordinary month, and
 * the dangerous side — the CURRENT period — is always known.
 */
ok(mayCompare({ count: 0 }, undefined), 'an unknown previous period does not veto a clean comparison');

eq(JSON.stringify(foreignLines({ count: 2, byCurrency: { SEK: 100, EUR: 200 } })),
  '[{"currency":"EUR","amount":200},{"currency":"SEK","amount":100}]',
  'one line per currency, stable order');
ok(!JSON.stringify(foreignLines({ count: 2, byCurrency: { SEK: 100, EUR: 200 } })).includes('300'),
  'NEVER summed across currencies — 200 EUR + 100 SEK is not 300 of anything');
eq(foreignLines(null).length, 0, 'nothing is no lines');
eq(unsizedForeign({ count: 3, byCurrency: { EUR: 200 } }), 2,
  'money we know is there and cannot size is counted, not swallowed');
eq(unsizedForeign({ count: 1, byCurrency: { EUR: 200 } }), 0, 'and a fully-sized period reports none');

/**
 * ——————————————————————— AND THE SCREEN ACTUALLY DOES ALL OF THAT.
 *
 * Everything above is a pure function. This project's recurring failure is a
 * correct function beside a view that kept its own inline copy, so the render is
 * checked too — with a payload whose right and wrong answers are different
 * numbers.
 */
/**
 * ═══════════ CHUNK N1b — D23: THE HEADLINE LEADS WITH HIS UNIT ═══════════
 *
 * The field report that ruled it: «This week 0» over a real 80 EUR week —
 * "this is unacceptable". The EGP figure was true and it was the wrong subject.
 *
 * ⚠️ WHAT THIS IS, AND THE LINE IT MUST NOT CROSS. D23: «emphasis, never
 * arithmetic». «80 EUR · and with it 0 EGP» is TWO TRUE SUMS with the lead
 * swapped — each currency summed only over its own rows, by the SERVER, in the
 * payload we already receive. Converting one into the other at render time is
 * Boundary 8 (no synthetic conversion in summaries) and it is forbidden until
 * D21's stamped `Home` values make a real rate available. This function
 * therefore only ever SELECTS and ORDERS figures that arrived; it may not
 * produce a number that was not in the payload.
 */
{
  const foreign = { count: 2, byCurrency: { EUR: 80 } };

  const led = leadAndAsides(1000, foreign, 'EUR');
  eq(led.lead.currency, 'EUR', 'his unit leads…');
  eq(led.lead.amount, 80, '…carrying the SERVER\'s own sum of his EUR rows');
  ok(led.asides.some((a) => a.currency === 'EGP' && a.amount === 1000),
    'and the pounds become the aside rather than disappearing');

  const home = leadAndAsides(1000, foreign, 'EGP');
  eq(home.lead.currency, 'EGP', 'the home unit leads when that is the choice…');
  eq(home.lead.amount, 1000, '…with its own figure');
  ok(home.asides.some((a) => a.currency === 'EUR' && a.amount === 80),
    'and the euros are the aside — the same two facts, reordered');

  /**
   * THE NO-ARITHMETIC ASSERTION, and it is the one worth having.
   *
   * Every number this returns must be a number that ARRIVED. A conversion —
   * at any rate, in either direction — necessarily introduces a third value,
   * so comparing the produced set against the payload's set catches it without
   * needing to know what rate a future mistake might use.
   */
  const produced = [led.lead.amount, ...led.asides.map((a) => a.amount)].sort((a, b) => a - b);
  eq(produced.join(','), '80,1000',
    'the ONLY figures on screen are the ones the payload carried — a conversion would add a third');

  /**
   * A ZERO LEAD IS HONEST **ONLY** BESIDE ITS ASIDE — and D23's own worked
   * example contains one («80 EUR · and with it 0 EGP»). The original defect
   * was never the zero; it was a zero standing ALONE while real money sat
   * outside it. So a period with no rows in the chosen unit still leads with
   * that unit's true zero, and the aside carrying the money is mandatory.
   */
  const noneInUnit = leadAndAsides(3000, { count: 0, byCurrency: {} }, 'EUR');
  eq(noneInUnit.lead.amount, 0, 'a period with nothing in his unit leads with a true zero…');
  ok(noneInUnit.asides.some((a) => a.currency === 'EGP' && a.amount === 3000),
    '…and NEVER alone — the aside carrying the real money is what makes the zero honest');

  eq(DISPLAY_CURRENCIES.join(','), 'EGP,EUR', 'two display units, the book\'s and his');
  eq(otherDisplayCurrency('EGP'), 'EUR', 'the toggle names where it goes…');
  eq(otherDisplayCurrency('EUR'), 'EGP', '…in both directions');

  /**
   * PERSISTED PER INSTALL, AND **NOT** COUPLED TO ANYTHING ELSE — the Owner's
   * own refinement (D23: «a sibling of the language toggle, NOT coupled to
   * it»). It must also stay clear of TRAVEL mode, which is a WRITE concern: the
   * keypad's currency decides what is recorded in his book. A display choice
   * that reached it would turn a reading preference into a wrong row.
   */
  const store = (v) => ({ getItem: () => v, setItem(_, x) { v = x; }, get value() { return v; } });
  const st = store(null);
  eq(getDisplayCurrency(st), 'EGP', 'the default is the BOOK\'s unit — his install opts in');
  setDisplayCurrency('EUR', st);
  eq(getDisplayCurrency(st), 'EUR', 'and the choice survives');
  eq(getDisplayCurrency(store('nonsense')), 'EGP', 'a corrupted value falls back rather than rendering itself');
}

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const mod = await vite.ssrLoadModule('/src/views/BookView.jsx');
  const BookView = mod.default;
  const { PeriodBlock } = mod;
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

  /**
   * ——— THE LOOKALIKE CARD ACTUALLY RENDERS, FROM THE SCREEN HE OPENS.
   *
   * ⚠️ ASSERTED HERE AND NOT ONLY IN `test-duplicates.mjs`, DELIBERATELY. That
   * suite proves the DETECTOR is correct; it cannot prove the card is reachable,
   * and this project has just paid for exactly that gap twice in one rev —
   * `BatchReviewView` was built, mutation-hardened at 57 checks, and imported by
   * zero files, and the batch door itself was a `doc_type` branch nobody called.
   * A tested component with no render site is a tested component nobody sees.
   */
  const dupes = text(render(payload([
    day({ description: 'Nile Star Market', amount: 100 }),
    day({ description: 'nile star market ', amount: 100 }),
  ], { Visa: 200, Cash: 0 })));
  ok(dupes.includes(AR.dupTitle(2).slice(0, 10)),
    'two rows with the same day, amount and currency raise the lookalike card ON THE SCREEN');
  ok(dupes.includes(AR.dupTier('same')),
    'and it says HOW alike in words — a percentage would invite trust it has no basis for');
  ok(!/(?:remove|delete|احذف|امسح)/i.test(dupes),
    'the card offers NO delete control of any kind, in either locale');
  /**
   * ⚠️ THE SHEET LINK IS ASSERTED FROM SOURCE, NOT FROM THIS RENDER, and the
   * reason is worth recording rather than working around silently: the link is
   * `{sheetUrl && …}` and `sheetUrl` comes from stored credentials, which this
   * SSR fixture has none of. So the rendered card correctly omits it here, and
   * an assertion that it appears would have been a true claim about the wrong
   * environment — passing only once someone wired credentials into a unit test.
   *
   * What must hold unconditionally is the SHAPE of the exit: one anchor to his
   * own sheet, and no control that acts. docs/09 §4.
   */
  const bookSrc = await readFile(new URL('../src/views/BookView.jsx', import.meta.url), 'utf8');
  const lookalikes = bookSrc.slice(bookSrc.indexOf('function Lookalikes('),
    bookSrc.indexOf('function TodayHead('));
  ok(lookalikes.includes('href={sheetUrl}'),
    'the card\'s one exit is an anchor into his own sheet…');
  ok(!lookalikes.includes('<button'),
    '…and it renders no button at all — there is nothing here that acts on his book');
  ok(!/onClick/.test(lookalikes),
    'and no click handler either: a detector that could act is no longer a detector');

  // AND THE ORDINARY CASE IS SILENCE — the other direction, which is the one a
  // card that always rendered would pass.
  const noDupes = text(render(payload([
    day({ description: 'Nile Star Market', amount: 100 }),
    day({ description: 'Harbour Cafe', amount: 55 }),
  ], { Visa: 155, Cash: 0 })));
  ok(!noDupes.includes(AR.dupTitle(2).slice(0, 10)),
    'a day with no lookalikes shows no card at all — no badge, no empty state, nothing');

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

  /**
   * ——— AND THE SCREEN OBEYS BOTH HALVES.
   *
   * Rendered, not asserted at the source, because this is the exact class the
   * «This week 0» defect belongs to: every function correct, the SCREEN wrong.
   */
  const week = (foreign) => ({
    cur: { Visa: [200, null], Cash: [0, null] },
    prev: { Visa: [500, 500], Cash: [0, 0] },
    foreign,
  });
  const withF = text(renderToStaticMarkup(createElement(PeriodBlock, { data: week({ count: 2, byCurrency: { EUR: 200 } }) })));
  ok(withF.includes('200'), 'the foreign money is NAMED beside the pounds figure…');
  ok(withF.includes(AR.foreignNoCompare), '…and the screen says why no percentage is shown');
  ok(!/[▲▼]/.test(withF), 'NO percentage marker at all — not a suppressed one, an absent one');
  ok(!withF.includes(AR.noComparison('')) , 'and it does not claim there is no data to compare — there is; it is incomparable');

  /**
   * ——— D23 ON THE SCREEN (chunk N1b): «THIS WEEK 0» OVER A REAL 80 EUR WEEK.
   *
   * The fixture is his week, reduced: nothing in pounds, real money in euros.
   * Today the headline is the EGP figure and the euros are the aside — every
   * number true, and the subject wrong. Reading in EUR, the SAME two figures
   * render with the lead swapped, and nothing is converted.
   *
   * ⚠️ THE FIRST VERSION OF THIS TEST COULD NOT FAIL, and it passed against the
   * unbuilt feature, which is how it was caught. It asserted that «80» appeared
   * in the first 220 characters of the block's TEXT — but the aside «ومعاهم 80
   * EUR» is already inside that window, so the assertion was satisfied by the
   * defect it was written to detect. A prefix of a screen is not a headline.
   *
   * So it reads the HERO ELEMENT itself. That is the one thing that actually
   * moves: the 42px display figure is the subject of the screen, and which
   * number sits in it IS the claim.
   */
  const heroOf = (html) => {
    /**
     * The hero is found by its SIZE, and the size it should be found by is
     * `TYPE.hero` — the literal 42 is BookView's pre-token hero, still what
     * renders until Wave 2 retokenizes that view. Both are accepted so this
     * assertion cannot go red for the wrong reason (a size migration is not a
     * wrong lead figure). Wave 2 is the collapse point: when BookView reads
     * `TYPE.hero`, drop the `|42` and this line pins the token too.
     */
    const m = html.match(new RegExp(`font-size:(?:${TYPE.hero}|42)px[^"]*"[^>]*>([^<]*)<`));
    return m ? m[1] : null;
  };
  const hisWeek = { cur: { Visa: [0, null], Cash: [0, null] },
    prev: { Visa: [500, 500], Cash: [0, 0] },
    foreign: { count: 2, byCurrency: { EUR: 80 } } };

  const eurHtml = renderToStaticMarkup(createElement(PeriodBlock,
    { data: hisWeek, displayCurrency: 'EUR' }));
  eq(heroOf(eurHtml), '80',
    'reading in EUR, the WEEK ITSELF leads with the 80 he actually spent');
  const eurText = text(eurHtml);
  ok(/80\s*EUR/.test(eurText),
    'and the lead names its unit — a bare 80 where euros are meant is the §6.0 hazard through the human');
  ok(eurText.includes(AR.andAlso),
    'the pounds remain as the aside — a lead is a reordering, never a deletion');
  /**
   * THE LINE THIS CHUNK MUST NOT CROSS. No rate exists on the client, so the
   * screen may show no figure the payload did not carry. 80 and 0 are the whole
   * of it; any conversion of one into the other lands somewhere else entirely.
   */
  ok(!/[1-9]\d{2,}/.test(heroOf(eurHtml) || ''),
    'and NOTHING is converted into the lead — a euro week dressed as pounds is Boundary 8');

  const egpHtml = renderToStaticMarkup(createElement(PeriodBlock,
    { data: hisWeek, displayCurrency: 'EGP' }));
  eq(heroOf(egpHtml), '0',
    'reading in EGP the same week leads with its true zero…');
  ok(text(egpHtml).includes('80'),
    '…and the euros are named beside it, which is the whole difference between this and the defect');

  eq(heroOf(renderToStaticMarkup(createElement(PeriodBlock, { data: hisWeek }))), '0',
    'and with no choice expressed at all the book\'s own unit leads — Dad\'s install is unmoved');

  /**
   * ——— THE CHART STAYS HONEST ABOUT ITS OWN UNIT (D23 stage 1).
   *
   * The series is EGP and only EGP; there is no euro history to plot until the
   * backend half derives home-denominated aggregates from D21's stamped rates.
   * So under a EUR headline the chart beneath is drawn in a DIFFERENT unit from
   * the number above it — which is fine, and is only fine while it says so.
   * An unlabelled axis under a euro hero is read as euros, and that is a
   * synthetic conversion performed by the reader instead of by the code.
   */
  /**
   * Guarded, because a red test that DIES is not a red test. Asserting against
   * a locale key before it exists throws «is not a function» at module scope
   * and takes the whole suite with it — the second time this pattern bit in one
   * afternoon. The dereference is made safe so the absence reports itself.
   */
  const chartUnitWords = typeof AR.chartUnit === 'function' ? AR.chartUnit('EGP') : null;
  ok(chartUnitWords && text(eurHtml).includes(chartUnitWords),
    'the chart names its own unit — it plots pounds under a euro headline and must say which');

  /**
   * ——— AND SO DO THE METRIC CARDS. THIS IS THE SECOND RENDER SITE, AGAIN.
   *
   * Found by OPENING IT, not by the suite: with the headline correctly reading
   * «0 EUR», the cards below went on printing «الكل 2,139 ▲93%» — bare figures
   * and percentages, in smaller type, directly under a euro hero. A reader
   * converts those to euros because nothing says otherwise, which is the
   * synthetic conversion of Boundary 8 performed by the person instead of by
   * the code.
   *
   * It is this rev's own catalogued find, repeating on the same component: «the
   * «This week 0» gate suppressed the headline percentage correctly, and the
   * metric cards went on printing their own «▼100%» via `<Delta>` — in smaller
   * type, which is where it would have survived a visual check». Same `Delta`,
   * same quieter place, caught the same way — by looking at a device.
   *
   * The cards are LABELLED rather than blanked: «2,139 EGP ▲93%» is a true and
   * complete statement, and suppressing it would delete real information to
   * solve an ambiguity that a unit fixes.
   */
  const unitMentions = (t) => t.split(chartUnitWords).length - 1;
  ok(unitMentions(text(eurHtml)) >= 2,
    'the metric cards name their unit too — one labelled region does not label the one below it');

  const clean = text(renderToStaticMarkup(createElement(PeriodBlock, { data: week(null) })));
  ok(/[▲▼]/.test(clean), 'while an ordinary period DOES compare — the gate can be satisfied');
  ok(!clean.includes(AR.foreignNoCompare), 'and says nothing about foreign money it does not have');

  const src = await readFile(new URL('../src/views/BookView.jsx', import.meta.url), 'utf8');
  ok(/mayCompare\(foreign, prevForeign\) \? comparisonOf/.test(src),
    'the gate is consulted BEFORE the percentage is computed — there is no path on which the misleading figure exists');
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
