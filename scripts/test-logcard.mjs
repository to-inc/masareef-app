#!/usr/bin/env node
/**
 * «سجل القبطان» — the monthly log card (W-6).  `npm run check:logcard`
 *
 * The card he will read on the first of every month for years. Three things
 * decide whether it appears, and getting any of them wrong is either a report he
 * never sees or one that will not go away:
 *
 *   1. the server's Cairo day is within the month's first seven;
 *   2. the server sent a log at all;
 *   3. he has not already read it.
 *
 * Each is fixtured so that ONLY it differs from the showing case — an assertion
 * where two conditions change at once cannot say which one did the work.
 *
 * The load-bearing one is `hasLog`: `null` must render nothing, and a month that
 * totals ZERO must still render. Those two look alike from a distance and are
 * opposites — an absent month has nothing to say; a month whose every row is
 * unpriced has the most important thing to say in the whole feature.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';
import {
  isLogWindow, hasLog, shouldShowLog, isDismissed, dismiss, LOG_WINDOW_DAYS,
} from '../src/state/logCard.js';
import { monthByTab } from '../src/i18n/strings.js';

let pass = 0;
const failures = [];
const eq = (a, b, label) => {
  if (Object.is(a, b)) { pass++; return; }
  failures.push(`${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const ok = (c, label) => eq(!!c, true, label);

const LOG = {
  name: 'Jul', total: 31341,
  top: [
    { name: 'Eating out', amount: 10234 },
    { name: 'Groceries', amount: 10755 },
    { name: 'Car', amount: 1951 },
  ],
  unpriced: 0, undated: 0,
};
const DAY1 = { y: 2026, m: 8, d: 1 };

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

// ——————————————————————— the seven-day window
eq(LOG_WINDOW_DAYS, 7, 'the window is the first seven days — changing it is a design change');
ok(isLogWindow({ d: 1 }), 'the 1st is in the window');
ok(isLogWindow({ d: 7 }), 'and so is the 7th — the boundary is inclusive');
ok(!isLogWindow({ d: 8 }), 'the 8th is not');
ok(!isLogWindow({ d: 28 }), 'nor is the end of the month');
ok(!isLogWindow({ d: 0 }), 'a nonsense day is not a window');
ok(!isLogWindow({}), 'and neither is a missing one — no day, no card');
ok(!isLogWindow(null), 'a missing date does not crash the view');

/**
 * ——————————————————————— IS THERE A LOG? The two states that look alike.
 */
ok(hasLog(LOG), 'a populated log is a log');
ok(!hasLog(null), 'null is the server saying the month is absent — no card');
ok(!hasLog(undefined), 'and so is a field an older deployment never sent');
ok(!hasLog({}), 'an empty object is not a log');
/**
 * THE FABRICATION. `prevLog || { total: 0 }` is the shape of the mistake — an
 * absent month dressed as a closed one that spent nothing. It must not pass.
 */
ok(!hasLog({ total: 0 }), 'a fabricated zero is NOT a log');
ok(!hasLog({ name: 'Jul', total: 31341 }), 'nor is one with no `top` at all');
ok(!hasLog({ name: 'Jul', total: '31341', top: [] }), 'nor a total that arrived as a string');

/**
 * AND ITS OPPOSITE, which any `total > 0` guard would delete: a month whose
 * every row is unpriced. It totals zero, ranks nothing, and is the single most
 * important log this card can show — "we could not account for this month".
 */
const HOLLOW = { name: 'Nov', total: 0, top: [], unpriced: 2, undated: 0 };
ok(hasLog(HOLLOW), 'a month that totals ZERO but has entries IS a log — the opposite of absent');

// ——————————————————————— all three conditions, one at a time
ok(shouldShowLog(LOG, DAY1, false), 'in the window, with a log, undismissed → shown');
ok(!shouldShowLog(LOG, { y: 2026, m: 8, d: 9 }, false), 'outside the window → not shown');
ok(!shouldShowLog(null, DAY1, false), 'no log → not shown');
ok(!shouldShowLog(LOG, DAY1, true), 'already read → not shown');
ok(shouldShowLog(HOLLOW, DAY1, false), 'and the hollow month is shown like any other');

// ——————————————————————— dismissal is per month, and it is permanent
{
  const store = fakeStorage();
  ok(!isDismissed(DAY1, store), 'nothing is dismissed to begin with');
  dismiss(DAY1, store);
  ok(isDismissed(DAY1, store), 'and a dismissal sticks');
  /**
   * NEXT MONTH IS A DIFFERENT LOG. A single global key would silence the card
   * for the rest of his life after one tap — the bug would take a month to
   * appear and would look like the feature had simply been removed.
   */
  ok(!isDismissed({ y: 2026, m: 9, d: 1 }, store), 'September is not dismissed by August\'s tap');
  ok(!isDismissed({ y: 2027, m: 8, d: 1 }, store), 'nor is next YEAR\'s August');
  dismiss({ y: 2026, m: 9, d: 1 }, store);
  ok(isDismissed(DAY1, store), 'and dismissing September does not un-dismiss August');
}
{
  // Private mode, or a full quota. A log he cannot dismiss beats a crash on the
  // screen that shows it.
  const hostile = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  eq(isDismissed(DAY1, hostile), false, 'unreadable storage reads as not-dismissed');
  dismiss(DAY1, hostile);
  pass++; // reaching here at all is the assertion: it did not throw
}

// ——————————————————————— the month name is looked up, never parsed
eq(monthByTab('Jul'), 'يوليو', 'the tab name maps to its Arabic month');
eq(monthByTab('Aug'), 'أغسطس', 'and so does August');
eq(monthByTab('Dec'), 'ديسمبر', 'and December');
eq(monthByTab('Q1'), 'Q1', 'a tab we do not recognise renders as ITSELF, never as blank');
eq(monthByTab(null), '', 'and a missing name does not become "null"');

// ——————————————————————— rendered
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });

try {
  const LogCard = (await vite.ssrLoadModule('/src/components/LogCard.jsx')).default;
  const render = (prevLog, todayCairo) =>
    renderToStaticMarkup(createElement(LogCard, { prevLog, todayCairo }));
  const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const card = render(LOG, DAY1);
  ok(card.length > 0, 'the card renders on the 1st');
  ok(text(card).includes('دفتر يوليو — مقفول'), 'it names the month it is closing, in Arabic');
  ok(text(card).includes('31,341'), 'it states the total');
  for (const c of LOG.top) {
    ok(text(card).includes(c.name), `it lists ${c.name}`);
  }
  ok(text(card).includes('10,234'), 'with its amount');
  ok(text(card).includes('إلى القبطان أ.ع.'), 'it is addressed to the captain');
  ok(text(card).includes('كل قرش له سطر. تمام يا فندم.'), 'and it signs off');
  ok(card.includes('background-image:url(&quot;data:image/svg+xml,'), 'the Morse beads sit above the signature');

  /**
   * ONE TAP, AND ONLY ONE. The card is a report: nothing to drill into, no
   * "see details", no second action. A count is the cheapest way to stop a
   * future contributor turning it into a dashboard tile.
   */
  eq((card.match(/<button/g) || []).length, 1, 'exactly one interactive element — the dismissal');
  ok(text(card).includes('تمام'), 'and it says تمام');

  // ——— the three ways it renders nothing at all
  eq(render(null, DAY1), '', 'no log → nothing at all, not an empty card');
  eq(render(LOG, { y: 2026, m: 8, d: 8 }), '', 'past the window → nothing');
  eq(render({ total: 0 }, DAY1), '', 'a fabricated zero renders nothing');

  {
    globalThis.localStorage = fakeStorage();
    dismiss(DAY1);
    eq(render(LOG, DAY1), '', 'and once he has read it, nothing — for that month');
    eq(render(LOG, { y: 2026, m: 9, d: 1 }).length > 0, true, 'but next month it is back');
    delete globalThis.localStorage;
  }

  /**
   * ——— THE HONEST LINES APPEAR EXACTLY WHEN THERE IS SOMETHING TO ADMIT.
   *
   * Both directions asserted. Printing "0 مصاريف من غير تمن" on a clean month
   * would be noise he has to read past; omitting it on a short month would hide
   * that the total above is knowably wrong (06 §2.2).
   */
  const clean = text(render(LOG, DAY1));
  ok(!clean.includes('من غير تمن'), 'a complete month says nothing about missing prices');
  ok(!clean.includes('من غير يوم محدد'), 'nor about missing days');

  const short = text(render({ ...LOG, unpriced: 3, undated: 2 }, DAY1));
  ok(short.includes('3 مصاريف من غير تمن'), 'a month with unpriced rows says how many');
  ok(short.includes('2 من غير يوم محدد'), 'and how many had no readable day');

  /**
   * BOTH ORDERINGS, and the reason is precise. The block is wrapped in "is
   * either nonzero?", so on a clean month neither line can print no matter what
   * the inner guards say — which means the clean fixture cannot see an unguarded
   * line at all. Only a month where the OTHER counter is nonzero opens the
   * wrapper and exposes it. Fixturing one direction left the mirror-image
   * mutation alive; the matrix said so.
   */
  const onlyUnpriced = text(render({ ...LOG, unpriced: 3, undated: 0 }, DAY1));
  ok(onlyUnpriced.includes('3 مصاريف من غير تمن'), 'the two lines are independent: unpriced shows…');
  ok(!onlyUnpriced.includes('من غير يوم محدد'), '…while undated stays silent at zero');

  const onlyUndated = text(render({ ...LOG, unpriced: 0, undated: 2 }, DAY1));
  ok(onlyUndated.includes('2 من غير يوم محدد'), 'and the other way round: undated shows…');
  ok(!onlyUndated.includes('من غير تمن'), '…while unpriced stays silent at zero');

  // ——— the hollow month, end to end
  const hollow = text(render(HOLLOW, DAY1));
  ok(hollow.includes('دفتر نوفمبر — مقفول'), 'the hollow month still closes its book');
  ok(hollow.includes('2 مصاريف من غير تمن'), 'and says what it could not price');
  // n=1 is a different word. «1 مصاريف» reads as "1 expenses" — visibly wrong to
  // the one person this card is written for.
  ok(text(render({ ...LOG, unpriced: 1 }, DAY1)).includes('1 مصروف من غير تمن'),
    'a single unpriced row is singular, like every other counted noun in the app');
  ok(hollow.includes('0'), 'reporting an honest zero rather than hiding');

  /**
   * ——— THE CLOCK IS THE SERVER'S. A device clock can be wrong, can be a day
   * ahead at 11pm Cairo, or can be in another timezone after travel — and any of
   * those either hides the log he is owed or resurrects one he dismissed.
   */
  const src = await readFile(new URL('../src/components/LogCard.jsx', import.meta.url), 'utf8');
  ok(!/new Date\(|Date\.now\(/.test(src), 'the card never consults the device clock');
  ok(src.includes('todayCairo'), 'it decides from the server\'s Cairo date');
  const state = await readFile(new URL('../src/state/logCard.js', import.meta.url), 'utf8');
  ok(!/new Date\(|Date\.now\(/.test(state), 'and neither does the module that decides for it');

  // ——— it costs nothing: the card must never fetch.
  ok(!/fetch\(|api\/|useEffect/.test(src),
    'the card makes no request and runs no effect — it rides the summary every screen already has');
} finally {
  await vite.close();
}

const report = failures.length
  ? `❌ ${failures.length} / ${pass + failures.length} log-card checks failed:\n  - ${failures.join('\n  - ')}`
  : `✅ all ${pass} log-card checks passed`;
console.log(report);
process.exit(failures.length ? 1 : 0);
