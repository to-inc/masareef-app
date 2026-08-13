#!/usr/bin/env node
/**
 * The Recent tab's windows.  `npm run check:recent`
 *
 * Three filters over his own rows, and the edges are where this earns its keep:
 *
 *   · a week that straddles a month boundary must fetch BOTH months, or a view
 *     labelled "this week" silently omits half of it;
 *   · a row whose date cell cannot be read belongs to the month and to no day —
 *     it appears in Month, never in Today or Week, and the view says how many
 *     were left out rather than presenting a short list as a complete one;
 *   · every window is anchored on the SERVER's Cairo date, never the device's.
 *
 * The calendar facts below are real and were verified before being written down:
 * 2026-08-01 is a Saturday (so that week starts Sunday 26 July), 2026-08-09 is a
 * Sunday, and 2026-07-29 is a Wednesday.
 */
import {
  FILTERS, isFilter, parseSheetDate, dayKey, weekWindow, monthsFor,
  filterEntries, undatedIn, sortForDisplay,
} from '../src/state/recent.js';

let pass = 0;
const failures = [];
const eq = (a, b, label) => {
  if (Object.is(a, b)) { pass++; return; }
  failures.push(`${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const ok = (c, label) => eq(!!c, true, label);
const ymd = (o) => (o ? `${o.d}/${o.m}/${o.y}` : String(o));

const row = (date, over = {}) => ({
  date, description: 'x', method: 'Visa', category: 'Groceries',
  amount: 10, currency: 'EGP', ...over,
});

// ——————————————————————— the vocabulary
eq(FILTERS.join(','), 'today,week,month', 'three filters, in the order he reads them');
ok(isFilter('week'), 'week is a filter');
ok(!isFilter('year'), 'and year is not — that lives on the Today tab');

// ——————————————————————— reading his date cells
eq(ymd(parseSheetDate('9/8/2026')), '9/8/2026', 'the sheet format reads');
eq(ymd(parseSheetDate('09/08/2026')), '9/8/2026', 'leading zeros are fine');
eq(ymd(parseSheetDate('  9 / 8 / 2026 ')), '9/8/2026', 'and so is his spacing');
/**
 * THE CELLS THAT GENUINELY CANNOT BE READ. Each of these is real, from his
 * sheet — and each must be `null` rather than a guess, because a guessed day
 * puts a real expense on the wrong date in a view he uses to find things.
 */
eq(parseSheetDate('221'), null, '"221" is not a date');
eq(parseSheetDate('10/210/2'), null, 'nor is "10/210/2"');
eq(parseSheetDate('31/0'), null, 'nor a d/M with no year');
eq(parseSheetDate(''), null, 'nor an empty cell');
eq(parseSheetDate(null), null, 'nor a missing one');
eq(parseSheetDate('13/13/2026'), null, 'and month 13 is refused rather than rolled over');
eq(parseSheetDate('0/8/2026'), null, 'as is day zero');

eq(dayKey({ y: 2026, m: 8, d: 9 }), 20260809, 'dates compare as integers');
ok(dayKey({ y: 2026, m: 12, d: 31 }) < dayKey({ y: 2027, m: 1, d: 1 }),
  'and the ordering survives a year boundary');
eq(dayKey(null), null, 'an unreadable date has no key');

/**
 * ——————————————————————— THE WEEK, Sunday-first, and its boundary.
 */
{
  const sunday = weekWindow({ y: 2026, m: 8, d: 9 });   // 9 Aug 2026 IS a Sunday
  eq(ymd(sunday.from), '9/8/2026', 'a Sunday starts its own week');
  eq(ymd(sunday.to), '15/8/2026', 'which runs to the Saturday');

  const saturday = weekWindow({ y: 2026, m: 8, d: 1 }); // 1 Aug 2026 IS a Saturday
  eq(ymd(saturday.from), '26/7/2026', 'a Saturday looks back to the previous Sunday…');
  eq(ymd(saturday.to), '1/8/2026', '…and ends on itself');

  const midweek = weekWindow({ y: 2026, m: 7, d: 29 }); // Wednesday
  eq(ymd(midweek.from), '26/7/2026', 'a midweek day finds the same Sunday');
  eq(ymd(midweek.to), '1/8/2026', 'and the same Saturday');

  // Across a YEAR boundary, where naive month arithmetic breaks.
  const newYear = weekWindow({ y: 2027, m: 1, d: 1 });  // Friday
  eq(ymd(newYear.from), '27/12/2026', 'the first of January looks back into December…');
  eq(ymd(newYear.to), '2/1/2027', '…and forward into January');
}

/**
 * ——————————————————————— WHICH MONTHS TO FETCH.
 * The whole reason `monthsFor` exists: a week can live in two months, and asking
 * for one of them would drop the other half of the week without saying so.
 */
{
  eq(JSON.stringify(monthsFor('today', { y: 2026, m: 8, d: 9 })), '[{"y":2026,"m":8}]',
    'Today needs one month');
  eq(JSON.stringify(monthsFor('month', { y: 2026, m: 8, d: 9 })), '[{"y":2026,"m":8}]',
    'and so does Month');
  eq(JSON.stringify(monthsFor('week', { y: 2026, m: 8, d: 9 })), '[{"y":2026,"m":8}]',
    'a week inside one month is ONE request, not two');
  eq(JSON.stringify(monthsFor('week', { y: 2026, m: 8, d: 1 })),
    '[{"y":2026,"m":7},{"y":2026,"m":8}]',
    'a week that straddles the boundary fetches BOTH — July first, as it runs');
  eq(JSON.stringify(monthsFor('week', { y: 2027, m: 1, d: 1 })),
    '[{"y":2026,"m":12},{"y":2027,"m":1}]',
    'and across a year boundary it crosses the year too');
}

/**
 * ——————————————————————— FILTERING, with the unreadable row present throughout.
 * `221` is one of his real date cells. It must never appear in Today or Week and
 * must always appear in Month.
 */
{
  const TODAY = { y: 2026, m: 8, d: 9 };            // Sunday
  const rows = [
    row('9/8/2026', { description: 'today-1' }),
    row('9/8/2026', { description: 'today-2' }),
    row('11/8/2026', { description: 'later-this-week' }),
    row('8/8/2026', { description: 'yesterday-last-week' }),
    row('2/8/2026', { description: 'earlier-in-month' }),
    row('221', { description: 'undated' }),
  ];

  const today = filterEntries(rows, 'today', TODAY);
  eq(today.length, 2, 'Today shows only today');
  ok(today.every((e) => e.date === '9/8/2026'), 'and nothing else');

  const week = filterEntries(rows, 'week', TODAY);
  eq(week.length, 3, 'the week (Sun 9 – Sat 15) holds today plus the 11th');
  ok(!week.some((e) => e.description === 'yesterday-last-week'),
    'and the 8th is LAST week — a Saturday, not a rolling seven days');

  const month = filterEntries(rows, 'month', TODAY);
  eq(month.length, rows.length, 'Month shows every row the server sent…');
  ok(month.some((e) => e.description === 'undated'), '…including the one with no readable day');

  ok(!today.some((e) => e.description === 'undated'), 'Today cannot place an undated row');
  ok(!week.some((e) => e.description === 'undated'), 'and neither can Week');
  eq(undatedIn(rows), 1, 'so the view is told how many it could not place');
  eq(undatedIn([]), 0, 'and an empty list has nothing to admit');

  // Month returns a COPY — a filter that handed back the caller's own array
  // would let a sort in the view reorder the fetched data underneath it.
  ok(filterEntries(rows, 'month', TODAY) !== rows, 'Month hands back a copy, not the original array');
}

/**
 * ——————————————————————— A WEEK ASSEMBLED FROM TWO MONTHS.
 * The rows arrive from two `entries` calls and are filtered as one list; the
 * window is what decides, not which response a row came in.
 */
{
  const TODAY = { y: 2026, m: 8, d: 1 };            // Saturday; week is 26 Jul – 1 Aug
  const july = [row('25/7/2026', { description: 'before' }), row('26/7/2026', { description: 'sunday' }),
    row('30/7/2026', { description: 'thursday' })];
  const august = [row('1/8/2026', { description: 'saturday' }), row('2/8/2026', { description: 'after' })];
  const week = filterEntries(july.concat(august), 'week', TODAY);
  eq(week.length, 3, 'the week spans both months');
  ok(week.some((e) => e.description === 'sunday'), 'the Sunday it starts on is in');
  ok(week.some((e) => e.description === 'saturday'), 'and the Saturday it ends on');
  ok(!week.some((e) => e.description === 'before'), 'the day before it is not');
  ok(!week.some((e) => e.description === 'after'), 'nor the day after');
}

/**
 * ——————————————————————— ORDER: newest first, and the undated at the bottom.
 * Sorting an unreadable date as if it were ancient would bury a real expense at
 * the end of the list for a reason that is not true. It goes last because it has
 * no day — which is a different statement, and the one we can actually make.
 */
{
  const rows = [
    row('2/8/2026', { description: 'oldest' }),
    row('221', { description: 'undated' }),
    row('9/8/2026', { description: 'newest' }),
    row('5/8/2026', { description: 'middle' }),
  ];
  const order = sortForDisplay(rows).map((e) => e.description).join(',');
  eq(order, 'newest,middle,oldest,undated', 'newest first, undated last');
  ok(sortForDisplay(rows) !== rows, 'and the caller\'s array is not reordered underneath it');
  eq(sortForDisplay([]).length, 0, 'an empty list sorts to an empty list');
}

/**
 * ——————————————————————— THE EDIT POSTS NO rowHint (06 §2.4).
 *
 * A Recent row is identified by what it SAYS, not by where it sat when it was
 * fetched, so the edit takes the server's content-scan path. Sending a rowHint
 * would send a stale sheet position from a list that may be minutes old — and it
 * would fail SILENTLY, because `locateRow_` takes the hint as a fast path and
 * falls through to a scan only if the row still matches all five fields.
 *
 * The Recent ITEM carries a `rowHint` of its own — a local settle key built from
 * the row's date and amount — so this is not a case where the field is simply
 * unavailable to send. It is present, plausible, and wrong to send.
 */
{
  const { readFileSync } = await import('node:fs');
  const { confirmPayload, editPayload } = await import('../src/state/fixPayload.js');

  const item = {
    tab: 'Aug',
    rowHint: '9/8/2026|60',                       // the settle KEY, not a position
    match: row('9/8/2026', { description: 'Coffee', amount: 60 }),
  };
  const sent = editPayload(item, 'Eating out');

  ok(!('rowHint' in sent), 'a Recent edit sends no rowHint KEY at all');
  eq(Object.keys(sent).sort().join(','), 'match,newCategory,tab', 'three fields exactly');
  eq(sent.tab, 'Aug', 'the tab the row was read from');
  eq(sent.match, item.match, 'and the row as the server described it');
  ok(!JSON.stringify(sent).includes('9/8/2026|60'),
    'the settle key never appears on the wire in any field — it is ours, not the server\'s');

  // The Inbox's write, by contrast, DOES carry a position: it has a real one
  // from `pending[]`. Both are correct. Asserting the CONTRAST is what stops
  // someone unifying them into whichever shape is wrong for the other screen —
  // and asserting it from both files means neither can drift alone.
  ok('rowHint' in confirmPayload({ tab: 'Aug', rowHint: 14, match: item.match }, 'Eating out'),
    'while the INBOX write still sends its real one — the two paths differ on purpose');

  // Proven pure, then proven WIRED: a builder the screen does not call is a
  // correct function and a broken app.
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const fn = app.slice(app.indexOf('const editRecent'), app.indexOf('const submitCash'));
  ok(/const payload = editPayload\(item, category\);/.test(fn),
    'and the Recent handler builds its payload with it');
  ok(!/rowHint/.test(fn), 'with no rowHint anywhere in the handler');
}

const report = failures.length
  ? `❌ ${failures.length} / ${pass + failures.length} recent checks failed:\n  - ${failures.join('\n  - ')}`
  : `✅ all ${pass} recent checks passed`;
console.log(report);
process.exit(failures.length ? 1 : 0);
