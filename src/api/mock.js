/**
 * Mock `summary` payload — contract-shaped (docs/06-api-contract.md §2.2).
 *
 * This file exists to let the whole UI be built and reviewed before the backend
 * is deployed, so it has to be honest about the two things the charts actually
 * depend on:
 *
 *  1. THE NULL-PADDING CONTRACT. Future slots are `null`, never `0`. Past slots
 *     with no spending are `0`. The boundary is Cairo *today*. Get this wrong
 *     and `cumsum` keeps accumulating across the future, `lastIdxOf` lands on
 *     the wrong day, and the "same point in time" marker silently lies. Visa and
 *     Cash must carry nulls in the IDENTICAL positions, because `comb()` only
 *     yields null where both are null.
 *  2. `month.undated` — rows whose date cell is unreadable. They are in the
 *     month total but in no daily slot, so the Month view footnotes the gap.
 *
 * Amounts are deterministic (seeded by date), so re-renders never flicker and
 * two people comparing screens see the same numbers.
 */
import { UNKNOWN_CATEGORY } from '../lib/constants.js';

/**
 * ⚠️ EVERY VALUE IN THIS FILE IS INVENTED. KEEP IT THAT WAY.
 *
 * This directory is the ONLY part of the project published to a public repo
 * (docs/ and backend/ stay private precisely because they carry his real
 * figures and family context). So a realistic-looking fixture copied from a
 * diagnostic is a privacy leak, not a convenience.
 *
 * This has already happened once: two merchants here were pasted verbatim from
 * a real-data diagnostic and quietly published his family's travel itinerary
 * — the hotel and the supermarket named the countries they visited. Amounts
 * came from his actual bank messages.
 *
 * When you need a fixture, INVENT one. The mock's job is to exercise a code
 * path — a made-up merchant does that exactly as well as a real one, and the
 * one property real data adds here is the ability to leak.
 */

// Full names are what `month.names` carries (the UI maps them to Arabic).
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// His real tab names are 3-letter with no year (PART_ZERO, docs/02). The client
// treats `pending[].tab` as opaque and echoes it back on fix_category, so this
// only has to be realistic — but an unrealistic mock is how you ship a client
// that quietly depends on a format the server never sends.
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Cairo civil date — the server's "today" is authoritative, so the mock uses the
// same timezone rather than the device clock.
function cairoToday() {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (t) => Number(p.find((x) => x.type === t).value);
  return { y: get('year'), m: get('month'), d: get('day') };
}

const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const prevMonthOf = (y, m) => (m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 });
const dow = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();

// Cheap deterministic hash → a stable "amount" per (bucket, index).
function seeded(seed, lo, hi) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const unit = ((h >>> 0) % 10000) / 10000;
  return Math.round(lo + unit * (hi - lo));
}

// A day with no spending is a real 0 — roughly a third of his days are.
function daySpend(tag, y, m, d, lo, hi) {
  const key = `${tag}-${y}-${m}-${d}`;
  return seeded(key + 'gate', 0, 100) < 32 ? 0 : seeded(key, lo, hi);
}

function monthSeries(y, m, boundaryDay) {
  const n = daysInMonth(y, m);
  const Visa = [], Cash = [];
  for (let d = 1; d <= n; d++) {
    if (boundaryDay != null && d > boundaryDay) { Visa.push(null); Cash.push(null); continue; }
    Visa.push(daySpend('v', y, m, d, 300, 2600));
    Cash.push(daySpend('c', y, m, d, 0, 600));
  }
  return { Visa, Cash };
}

const sum = (a) => a.reduce((s, v) => s + (v || 0), 0);

/**
 * The server returns `year.prev` as all-nulls until `CONFIG.PREV_YEAR_SHEET_ID`
 * is set — which is the current staging reality and the default everywhere.
 * The mock matches that, because a mock more optimistic than the real service is
 * how you ship a client that has never rendered the state it will actually meet.
 *
 * Flip to true to review the year-over-year comparison UI with data present.
 */
const MOCK_HAS_PREV_YEAR = false;

/**
 * §2.2a home-denominated aggregates (`homeAgg`/`prevHomeAgg`) are built in
 * 20260826-1531 and NOT DEPLOYED YET, so the honest default is the fields
 * being ABSENT — absent is the 1463 server; `null` is 1531 with no home
 * currency; an object is 1531 patched. The client is tri-state on this field
 * and the mock must default to the state it will actually meet.
 *
 *   false → fields absent (the deployed server, TODAY)
 *   ''    → fields present, null (1531 on Dad's unpatched book)
 *   'EUR' → fields computed (1531 on Tarek's patched book)
 *
 * Boolean `false` on purpose: the priorities suite sweeps this file for
 * `const MOCK_* = true|false;` and asserts every flag ships OFF. Flip to a
 * string locally to review; flipping the DEFAULT is a deliberate act that
 * happens only after the 1531 paste is live — and reddens a parity pin until
 * someone means it.
 */
const MOCK_HOMEAGG_CURRENCY = false;

/**
 * The other real state of `month.prevLog`: `null`, which the server returns for
 * a first month or one holding no readable entries. Populated is the DEFAULT
 * because that is what his book actually returns — he has months of history —
 * and a mock must default to the state the service is really in. Flip this to
 * review the card-less screen.
 */
const MOCK_PREVLOG_NULL = false;

/**
 * THE V18 MONTH SHAPE IS THE DEFAULT NOW, AND THE FLAG THAT HID IT IS GONE.
 *
 * ⚠️ THIS FIXTURE WAS V17 ON A BELIEF THAT WAS ALREADY FALSE. It carried a
 * top-5 category cut and NO `month.uncategorized`, under a comment asserting
 * «that is what the serving backend returns today» — and the client gates two
 * surfaces on that field's PRESENCE, so the mock was hiding the «إجمالي الشهر»
 * line and the whole priorities lens from every dev and every suite.
 *
 * Planner 5 PROBED his book on 2026-08-24 and it answers
 * `month.uncategorized: {count: 3, total: 0}`. The field is live. The belief
 * was a cache with no invalidation, exactly as the batch seat's own note says,
 * and mock parity cuts BOTH ways: a mock more PESSIMISTIC than the service
 * hides a shipped feature from everyone who could have caught a defect in it.
 * That is the fifth-occurrence lesson wearing its other face.
 *
 * ——— WHAT «RECONCILES» MEANS HERE, since two earlier attempts got it wrong.
 *
 * 06 §2.2's law: `sum(monthCats.now) + uncategorized.total` IS the month on
 * display. The month's series is null-padded at Cairo today and therefore grows
 * daily, so neither side may be a constant:
 *   · a hard-coded ❓ total reconciled on the two days around the afternoon it
 *     was chosen and lied on the other twenty-nine;
 *   · deriving ONLY the ❓ bucket from a fixed category list held the identity
 *     every day by handing ❓ a NEGATIVE total for the first twelve — a state
 *     the real server cannot produce, since ❓ money is a sum of real rows.
 * So both sides derive: the names take fixed SHARES of the month the mock
 * actually generated, and ❓ takes the exact leftover. Whole pounds on both
 * sides, so the identity is exact rather than true to within floating point —
 * an identity a suite cannot assert is not an identity.
 */
const MOCK_UNDATED = { count: 2, Visa: 0, Cash: 175 };
/**
 * The month's categories. `share` is of the month's TRUE total, and the shares
 * deliberately sum to less than one — what is left is the ❓ money, which his
 * book really does carry (the Inbox exists for it).
 *
 * `prev` is last month's and is a genuine constant: a closed month does not
 * grow. Only `now` has to move with the day.
 *
 * The six names span three of the priorities lens's groups — Essentials,
 * Health (the clubs, placed there by the Owner 2026-08-25) and Joy — leaving
 * Projects at a true zero, which is worth rendering too. The remainder line is
 * exercised by the ❓ money rather than by an unplaced category, which is
 * exactly the shape his own book is in: everything placed, a ❓ balance
 * outstanding. (The map's one unplaced name, `Personal expenses`, has zero rows
 * in his whole book, so putting spend on it here would be inventing a state the
 * fixture is supposed to mirror.)
 */
const MOCK_MONTH_CATS = [
  { name: 'Eating out', prev: 9120, share: 0.288 },
  { name: 'Groceries', prev: 6480, share: 0.220 },
  { name: 'Car', prev: 1890, share: 0.125 },
  { name: 'Donations', prev: 4500, share: 0.088 },
  { name: 'Internet', prev: 860, share: 0.039 },
  { name: 'Madinety club', prev: 700, share: 0.032 },
];

const round2 = (x) => Math.round(x * 100) / 100;

/**
 * TRANSCRIBED from Code.gs `foreignIn_` — never composed from memory (the
 * batch-shape lesson). Every non-EGP row is COUNTED; an unpriced one is never
 * summed («counted but not summed» is the honest answer). Exported so the
 * parity suite can exercise the unpriced branch by DIRECT CALL — the
 * `foreignIn_` precedent: the sheet path cannot produce it, a suite must.
 */
export function mockForeignIn(rows) {
  let count = 0; const byCurrency = {};
  for (const e of rows || []) {
    if (!e || !e.currency || e.currency === 'EGP') continue;
    count++;
    if (e.amount == null) continue;          // counted, unpriced, never summed
    byCurrency[e.currency] = round2((byCurrency[e.currency] || 0) + e.amount);
  }
  return { count, byCurrency };
}

/**
 * TRANSCRIBED from Code.gs `homeAggIn_` (§2.2a). The partition is EXCLUSIVE —
 * every row lands in exactly one of native/converted/unstamped/unpriced, and
 * the parity suite asserts the identity. A stamp on a native row is surfaced
 * in `strayStamps`, never absorbed; a converted row participates at its
 * RECORDED home value, never re-derived; `unstamped.byCurrency` carries money
 * sums with `total: null` because currencies do not add; an empty home
 * currency returns NULL — absent feature, not a zero.
 */
export function mockHomeAggIn(rows, home) {
  if (!home) return null;
  const native = { count: 0, total: 0 };
  const converted = { count: 0, total: 0 };
  const unstamped = { count: 0, total: null, byCurrency: {} };
  let unpriced = 0, strayStamps = 0;
  for (const e of rows || []) {
    if (!e) continue;
    if (e.currency === home && e.amount != null) {
      native.count++;
      native.total += e.amount;
      if (e.home != null) strayStamps++;
    } else if (e.home != null) {
      converted.count++;
      converted.total += e.home;
    } else if (e.amount != null) {
      unstamped.count++;
      unstamped.byCurrency[e.currency] = round2((unstamped.byCurrency[e.currency] || 0) + e.amount);
    } else {
      unpriced++;
    }
  }
  native.total = round2(native.total);
  converted.total = round2(converted.total);
  return {
    currency: home,
    total: round2(native.total + converted.total),
    native,
    converted,
    unstamped,
    unpriced,
    strayStamps,
  };
}

export function mockSummary() {
  const today = cairoToday();
  const prev = prevMonthOf(today.y, today.m);

  // ——— week: Sunday-first, 7 slots, nulls after today
  const startOffset = dow(today.y, today.m, today.d);
  const weekOf = (offsetDays, boundary) => {
    const Visa = [], Cash = [];
    for (let i = 0; i < 7; i++) {
      const t = new Date(Date.UTC(today.y, today.m - 1, today.d - startOffset + offsetDays + i));
      const y = t.getUTCFullYear(), m = t.getUTCMonth() + 1, d = t.getUTCDate();
      if (boundary && i > startOffset) { Visa.push(null); Cash.push(null); continue; }
      Visa.push(daySpend('v', y, m, d, 300, 2600));
      Cash.push(daySpend('c', y, m, d, 0, 600));
    }
    return { Visa, Cash };
  };

  const curMonth = monthSeries(today.y, today.m, today.d);
  const prevMonth = monthSeries(prev.y, prev.m, null);

  /**
   * THE MONTH, DERIVED ON BOTH SIDES so 06 §2.2's identity holds on EVERY day —
   * `sum(monthCats.now) + uncategorized.total` is the figure the card shows.
   * The reasoning, and the two wrong versions that preceded it, are at
   * `MOCK_MONTH_CATS` above.
   */
  const monthTrueTotal = sum(curMonth.Visa) + sum(curMonth.Cash)
    + MOCK_UNDATED.Visa + MOCK_UNDATED.Cash;
  // WHOLE POUNDS on both sides. Two-decimal rounding left a float residue
  // (17,868.370000000003 + 5,642.63 ≠ 23,511 by 4e-12) — invisible on screen,
  // but an identity that is only true to within floating-point is not an
  // identity a suite can assert, and this fixture exists to BE asserted. The
  // month's own series are whole pounds, so nothing is lost.
  const monthCats = MOCK_MONTH_CATS.map(({ share, ...c }) => ({
    ...c, now: Math.round(monthTrueTotal * share),
  }));
  const mockUncategorized = {
    count: 3, total: monthTrueTotal - sum(monthCats.map((c) => c.now)),
  };

  // ——— year: null for months after this one; January is deliberately null to
  // stand in for "no tab exists yet", which is NOT the same as "spent nothing".
  const yearVisa = [], yearCash = [], prevYearVisa = [], prevYearCash = [];
  for (let m = 1; m <= 12; m++) {
    if (m > today.m || m === 1) { yearVisa.push(null); yearCash.push(null); }
    else if (m === today.m) { yearVisa.push(sum(curMonth.Visa)); yearCash.push(sum(curMonth.Cash)); }
    else {
      const s = monthSeries(today.y, m, null);
      yearVisa.push(sum(s.Visa)); yearCash.push(sum(s.Cash));
    }
    if (MOCK_HAS_PREV_YEAR) {
      const ps = monthSeries(today.y - 1, m, null);
      prevYearVisa.push(sum(ps.Visa)); prevYearCash.push(sum(ps.Cash));
    } else {
      prevYearVisa.push(null); prevYearCash.push(null);
    }
  }

  /**
   * ⚠️ MOCK PARITY — the ❓ rows below are in `today` AND in `pending`, because
   * on the real server they cannot be anywhere else.
   *
   * `buildTodayFromBlob_` and `collectPending_` read the SAME month blob, and
   * the today filter is on the date alone — never on the category. So a
   * today-dated ❓ row is necessarily in both lists, and it is already counted
   * in `today.totals`.
   *
   * This mock used to keep the two lists disjoint, which the server cannot do,
   * and that gap hid a real bug for five days: `confirmPending` APPENDED the
   * confirmed row to `today` and added its amount to the totals, so every
   * confirmation counted the same purchase twice. Against this fixture the
   * append looked correct — the row genuinely was not there. Against his sheet
   * on 2026-08-03 it inflated the day's Visa total by the sum of nine
   * transfers. A mock that is tidier than the service is not a simplification;
   * it is a certificate for code that has never met reality.
   */
  const pendingToday = [
    { date: `${today.d}/${today.m}/${today.y}`, description: 'Nile Star Market', method: 'Visa', category: UNKNOWN_CATEGORY, amount: 860, currency: 'EGP' },
    { date: `${today.d}/${today.m}/${today.y}`, description: 'Zaytouna Bakery', method: 'Visa', category: UNKNOWN_CATEGORY, amount: 75, currency: 'EGP' },
  ];

  const todayEntries = [
    { date: `${today.d}/${today.m}/${today.y}`, description: 'Coffee', method: 'Cash', category: 'Eating out', amount: 60, currency: 'EGP' },
    { date: `${today.d}/${today.m}/${today.y}`, description: 'Taqa', method: 'Cash', category: 'Elect. Recharge', amount: 200, currency: 'EGP' },
    /**
     * `auto: true` — the server flags a row whose category the merchant memory
     * would have chosen, i.e. one he never had to pick (finding A2). Uber is the
     * honest example: `uber → Personal expenses` is a seeded Memory rule, so
     * every Uber row this app has ever logged was filed without a tap.
     *
     * MOCK PARITY: exactly one row carries it, and the flag is ABSENT elsewhere
     * rather than `false` — which is what the server sends. A mock that set
     * `auto: false` on the others would certify a client against a field the
     * server never emits.
     */
    { date: `${today.d}/${today.m}/${today.y}`, description: 'Uber', method: 'Visa', category: 'Personal expenses', amount: 214.75, currency: 'EGP', auto: true },
    // A travel row: excluded from EGP sums, shown verbatim as it sits in the sheet.
    { date: `${today.d}/${today.m}/${today.y}`, description: 'Café de Flore', method: 'Visa', category: 'Eating out', amount: 12.5, currency: 'EUR' },
    ...pendingToday,
  ];
  const todayTotals = todayEntries.reduce(
    (acc, e) => { if (e.currency === 'EGP') acc[e.method] += e.amount; return acc; },
    { Visa: 0, Cash: 0 },
  );

  /**
   * ROW-DERIVED AGGREGATES, over the populations this fixture actually has.
   *
   * The mock materializes row objects only for TODAY, and today sits inside
   * the current week, month and year — so every current side computes over
   * `todayEntries` and every previous side over the empty population, which
   * is this fixture's own story: its one foreign row is today's Café de
   * Flore, its history is EGP-only. The aggregates therefore reconcile with
   * the rows the fixture can show, and the §2.2a partition identity holds
   * EXACTLY over each aggregate's own population — the identity a client may
   * rely on. (The unstamped EGP sums deliberately under-run the generated
   * series for the same reason: sums have no rows behind them here.)
   *
   * `foreign`/`prevForeign` are UNCONDITIONAL — the deployed server
   * (20260825-1463) serves them on all three periods, and a mock more
   * pessimistic than the service hides a shipped surface (the V17 lesson,
   * which this file already paid for once). `homeAgg`/`prevHomeAgg` ride
   * `MOCK_HOMEAGG_CURRENCY` — see the flag's own comment.
   */
  const rowAggs = {
    foreign: mockForeignIn(todayEntries),
    prevForeign: mockForeignIn([]),
    ...(MOCK_HOMEAGG_CURRENCY === false ? {} : {
      homeAgg: mockHomeAggIn(todayEntries, MOCK_HOMEAGG_CURRENCY),
      prevHomeAgg: mockHomeAggIn([], MOCK_HOMEAGG_CURRENCY),
    }),
  };

  return {
    ok: true,
    v: 1,
    serverTime: new Date().toISOString(),
    today_cairo: today,
    week: { cur: weekOf(0, true), prev: weekOf(-7, false), ...rowAggs },
    month: {
      cur: curMonth,
      prev: prevMonth,
      names: { cur: MONTH_NAMES[today.m - 1], prev: MONTH_NAMES[prev.m - 1] },
      // Two unreadable date cells this month — exercises the footnote.
      undated: MOCK_UNDATED,
      // PRESENT, because his book's `summary` carries it (probed 2026-08-24).
      // The client gates the total line and the priorities lens on this field's
      // PRESENCE, never on its value — a clean month sends {count: 0, total: 0}
      // and its arithmetic is perfectly sound.
      uncategorized: mockUncategorized,
      // Rows he wrote down but never priced (the travel legs). The month total
      // is knowably short, and the UI must say so rather than look confident.
      unpriced: { count: 3 },
      // The row-derived aggregates — see `rowAggs` above for the population.
      ...rowAggs,
      /**
       * W-6 «سجل القبطان» — the closed month (06 §2.2).
       *
       * MOCK PARITY, which takes a moment's care here: this is what a real
       * server would return FOR THIS MOCK'S OWN DATA, not a nicer version of it.
       *
       *  · `total` is the previous month's series summed exactly as the server
       *    sums it — both methods, the whole month.
       *  · `top` is the previous month's category figures, which this file
       *    already carries as `monthCats[].prev`, sorted and cut to three by the
       *    same rule the server applies.
       *  · `total` is therefore LARGER than the sum of `top`, exactly as it is
       *    in reality: money in ❓ rows is in the month and in no category. A
       *    mock where those two agreed would let a client ship that quietly
       *    assumed they always do.
       *  · `unpriced`/`undated` are the PREVIOUS month's — deliberately NOT the
       *    two numbers directly above, which are the current month's and the
       *    easiest pair in this file to wire up by mistake. One is nonzero and
       *    one is zero so a single fixture exercises both the shown and the
       *    hidden line.
       */
      prevLog: MOCK_PREVLOG_NULL ? null : {
        name: MONTH_ABBR[prev.m - 1],
        total: sum(prevMonth.Visa) + sum(prevMonth.Cash),
        top: [
          { name: 'Eating out', amount: 9120 },
          { name: 'Groceries', amount: 6480 },
          { name: 'Donations', amount: 4500 },
        ],
        unpriced: 1,
        undated: 0,
        /**
         * The month's most-visited place — the fact that replaced A8's weekly
         * question. The server sends `null` far more often than not (a tie has
         * no "most" in it, and twice is not a habit), so a mock that always
         * populated it would certify a client that never renders the common
         * case. Kept present here because the ABSENT case is what
         * `MOCK_PREVLOG_NULL` already exercises, and the log card's own suite
         * asserts both directions directly.
         */
        mostOften: { name: 'Nile Star Market', times: 6 },
      },
    },
    year: {
      cur: { Visa: yearVisa, Cash: yearCash },
      prev: { Visa: prevYearVisa, Cash: prevYearCash },
      // The row-derived aggregates — see `rowAggs` above for the population.
      ...rowAggs,
    },
    /**
     * SIX CATEGORIES, DERIVED — see `MOCK_MONTH_CATS` for the shares and for why
     * both sides of the month have to move with the day. `sum(monthCats.now) +
     * uncategorized.total` IS the month the card shows (06 §2.2's law), which is
     * why the «إجمالي الشهر» line renders under this list rather than being
     * withheld: the list can account for the total, so it states it.
     *
     * ⚠️ THIS COMMENT USED TO SAY THE OPPOSITE, AND IT SURVIVED THE EDIT THAT
     * FALSIFIED IT. It read «V17 SHAPE, DELIBERATELY — a TOP-5 cut, and `month`
     * above carries NO `uncategorized` key … that is what the serving backend
     * returns today», and it closed by instructing whoever eventually flipped the
     * mock to make the numbers reconcile. The flip happened; the instruction
     * stayed; every clause inverted. The array beneath it was replaced and the
     * prose above it was untouched CONTEXT in the diff, which is exactly how a
     * comment outlives the code it describes.
     *
     * It is recorded rather than merely deleted because of WHAT it would have
     * cost: a maintainer landing here — and this is the block you land on when
     * you come to edit the categories — would have been told in the file's most
     * authoritative register to re-gate `month.uncategorized`. That single change
     * re-hides the month-total line AND the entire priorities lens from every dev
     * and every suite, which is the defect this fixture was just repaired to end.
     * A stale comment that merely misinforms is a nuisance; one that instructs
     * the reversal of the fix above it is a trap.
     */
    monthCats,
    today: { entries: todayEntries, totals: todayTotals },
    pending: [
      // `match` is the SAME row object shape as `today.entries` above — see the
      // parity note. Spread, not shared by reference, because the server sends
      // two independently-serialised copies and a client that accidentally
      // relied on identity would work here and fail there.
      {
        tab: MONTH_ABBR[today.m - 1],
        rowHint: 14,
        match: { ...pendingToday[0] },
        guess: 'Groceries',        // → the one-tap green button
        stale: false,
      },
      {
        tab: MONTH_ABBR[today.m - 1],
        rowHint: 15,
        match: { ...pendingToday[1] },
        guess: null,               // → chips only, never a wrong guess (D5)
        stale: false,
      },
      // A months-old travel row: empty category (not ❓), no amount at all, and
      // tagged stale so the Inbox groups it instead of listing it with today's.
      {
        tab: MONTH_ABBR[prev.m - 1],
        rowHint: 41,
        match: {
          date: `22/${prev.m}/${prev.y}`, description: 'Northgate Hotel', method: 'Visa',
          category: '', amount: null, currency: null,
        },
        guess: null,
        stale: true,
      },
      {
        tab: MONTH_ABBR[prev.m - 1],
        rowHint: 44,
        match: {
          date: `23/${prev.m}/${prev.y}`, description: 'Bergen Market', method: 'Visa',
          category: '', amount: null, currency: null,
        },
        guess: 'Groceries',
        stale: true,
      },
    ],
  };
}

// Same latency shape as a warm Apps Script call, so the loading states are real.
export function mockFetchSummary() {
  return new Promise((resolve) => setTimeout(() => resolve(mockSummary()), 420));
}

/**
 * Receipt fixtures, cycled on each capture so every branch of the review UI can
 * actually be walked without a vision key: confident → uncertain → travel →
 * duplicate-of-SMS → not-a-receipt.
 */
/**
 * A TRANSACTION LIST (D20). Its `is_receipt` is FALSE — deliberately, per 06
 * §3.5 — so a client that has not learned `doc_type` lands on its not-a-receipt
 * branch instead of misbehaving. That degradation is the contract's design, and
 * it is also exactly what shipped: the app branched on `is_receipt` alone and
 * threw three real bank screenshots onto the "Not a receipt" pile with the rows
 * already extracted and paid for. The fixture exists so that can never be true
 * again silently — a client that ignores `doc_type` fails this mock.
 *
 * The rows carry the statuses that actually change behaviour: a `completed` pair
 * ticked by default, a `declined` row that must have NO tick at all, an
 * `incoming` one for the same reason, a `roundup` with its aggregate count, and
 * an unpriced `unclear`. Merchants invented; the repo is public.
 */
const LIST_FIXTURE = {
  label: 'D20 transaction list',
  ok: true,
  /**
   * ⚠️ SHAPE COPIED FROM `receiptExtractResponse_` IN Code.gs, FIELD BY FIELD —
   * NOT from what the client would find convenient. The first version of this
   * fixture put `entries` at the TOP level, beside `extraction`; the server
   * nests them INSIDE it (`extraction: decorateListRows_(extraction)`) with only
   * `entriesTotal` outside. Every suite then certified a client that read the
   * top level — which shipped, and answered «Did not work — try again» to three
   * real bank screenshots whose extractions were complete and correct.
   * Mock parity's rule has a sharper corollary now: **the mock's shape is
   * transcribed from the server's response builder, never composed from memory.**
   *
   * Row fields are `validateListRow_`'s output + `decorateListRows_`'s two
   * additions (`category`, `dupBook`) — no `index` (rows are positional), no
   * `section_date` (consumed into `date`, ISO or null, server-resolved).
   * A list response carries NO top-level `category`/`dupBook` — per-document
   * answers to per-row questions — and DOES carry `defaultMethod` (D19: a card
   * list is card money; the client is told, it never decides).
   */
  entriesTotal: 6,
  defaultMethod: 'Visa',
  extraction: {
    doc_type: 'transaction_list', is_receipt: false, amount: null, currency: 'UNKNOWN',
    merchant_display: null, merchant_latin: null, date: null, payment_hint: 'unknown',
    amount_confidence: 'low', merchant_confidence: 'low', date_confidence: 'low',
    raw_total_line: null, notes: null,
    /**
     * `entries_total` rides INSIDE the extraction too — validateExtraction_
     * sets it on the object receiptExtractResponse_ then nests, so the real
     * wire carries both this and the top-level `entriesTotal`. And there is NO
     * `not_expense_reason` here: the server adds that key only under
     * doc_type 'not_expense'. Both were wrong in the first transcription —
     * checked against Code.gs line by line this time, by an adversary.
     */
    entries_total: 6,
    entries: [
      { amount: 15.47, currency: 'EUR', merchant_display: 'Lantern Grocer',
        merchant_latin: 'lantern grocer', date: '2026-08-24', row_status: 'completed',
        payment_hint: 'card', aggregate_count: null, category: 'Groceries',
        dupBook: { checked: true, reason: null, match: null, count: 0, undatedAmountMatch: false } },
      { amount: 27.40, currency: 'EUR', merchant_display: 'Bridge Cafe',
        merchant_latin: 'bridge cafe', date: '2026-08-24', row_status: 'completed',
        payment_hint: 'card', aggregate_count: null, category: 'Eating out',
        dupBook: { checked: true, reason: null, match: null, count: 0, undatedAmountMatch: false } },
      { amount: 163.00, currency: 'EUR', merchant_display: 'Harbour Baths',
        merchant_latin: 'harbour baths', date: '2026-08-23', row_status: 'declined',
        payment_hint: 'card', aggregate_count: null, category: null,
        dupBook: { checked: false, reason: 'month_not_cached', match: null, count: 0, undatedAmountMatch: false } },
      { amount: 42.00, currency: 'EUR', merchant_display: 'Refund from Ferry Co',
        merchant_latin: 'ferry co', date: '2026-08-23', row_status: 'incoming',
        payment_hint: 'card', aggregate_count: null, category: null,
        dupBook: { checked: true, reason: null, match: null, count: 0, undatedAmountMatch: false } },
      { amount: 6.50, currency: 'EUR', merchant_display: 'Spare change',
        merchant_latin: 'spare change', date: '2026-08-23', row_status: 'roundup',
        payment_hint: 'card', aggregate_count: 3, category: null,
        dupBook: { checked: true, reason: null, match: null, count: 0, undatedAmountMatch: false } },
      { amount: null, currency: 'EUR', merchant_display: 'Kiosk',
        merchant_latin: 'kiosk', date: '2026-08-22', row_status: 'unclear',
        payment_hint: 'unknown', aggregate_count: null, category: null,
        dupBook: { checked: true, reason: null, match: null, count: 0, undatedAmountMatch: false } },
    ],
  },
};

/**
 * PER-ROW ANSWERS, INCLUDING THE REFUSALS.
 *
 * `results` comes back IN REQUEST ORDER, one entry per row sent — which is what
 * the review screen relies on to put an outcome beside the right row, since the
 * server does not echo `sourceHash` and `index` alone is per-photo.
 */
export function mockBatchConfirm({ rows } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const results = list.map((r, i) => {
    if (i === 1 && list.length > 2) {
      // Shape from batchBookCheck_: `inBatch` on EVERY path, and `match` is
      // publicRow_ (date · description · method · category · amount ·
      // currency) plus the resolved `tab`. The narrower first version had
      // never shown a client three of the fields the real server sends.
      return { index: r.index, status: 'book_duplicate',
        dupBook: { checked: true, reason: null, count: 1, undatedAmountMatch: false, inBatch: false,
          match: { tab: 'Aug', date: '24/8/2026', description: 'Bridge Cafe',
            method: 'Visa', category: 'Eating out', amount: 27.4, currency: 'EUR' } } };
    }
    // The idempotent replay answer, so the settle screen has SEEN a
    // `duplicate` row before the wire shows it one (mock parity is about
    // refusals as much as successes).
    if (i === 2 && list.length > 3) {
      return { index: r.index, status: 'duplicate',
        entry: { date: '23/8/2026', description: r.description || 'row', method: r.method || 'Visa',
          category: r.category || '❓', amount: r.amount, currency: r.currency || 'EUR' } };
    }
    return { index: r.index, status: 'written',
      entry: { date: '24/8/2026', description: r.description || 'row', method: r.method || 'Visa',
        category: r.category || '❓', amount: r.amount, currency: r.currency || 'EUR' } };
  });
  const written = results.filter((r) => r.status === 'written').length;
  return new Promise((resolve) => setTimeout(() => resolve({
    ok: true, v: 1, results,
    written, skipped: results.length - written, errored: 0,
  }), 500));
}

const RECEIPT_FIXTURES = [
  LIST_FIXTURE,
  {
    label: 'S2 confident EGP cash',
    ok: true, category: 'Medical', dupReceipt: false, dupSms: false,
    dupBook: { checked: true, reason: null, match: null, count: 0, undatedAmountMatch: false },
    defaultMethod: 'Cash',
    extraction: {
      doc_type: 'purchase_receipt', is_receipt: true, amount: 137.5, currency: 'EGP',
      merchant_display: 'صيدلية سيف', merchant_latin: 'seif pharmacy',
      date: null, payment_hint: 'cash',
      amount_confidence: 'high', merchant_confidence: 'high', date_confidence: 'high',
      raw_total_line: 'الإجمالي 137.50 ج.م', notes: null,
    },
  },
  {
    label: 'S3 uncertain — faded total',
    ok: true, category: null, dupReceipt: false, dupSms: false,
    dupBook: { checked: true, reason: null, match: null, count: 0, undatedAmountMatch: false },
    defaultMethod: 'Cash',
    extraction: {
      doc_type: 'purchase_receipt', is_receipt: true, amount: null, currency: 'EGP',
      merchant_display: 'بقالة ??', merchant_latin: null,
      date: null, payment_hint: 'unknown',
      amount_confidence: 'low', merchant_confidence: 'low', date_confidence: 'low',
      raw_total_line: 'ا?ج?الي ??.?? ج.م', notes: 'faded thermal print',
    },
  },
  {
    label: 'S2 travel EUR',
    ok: true, category: 'Eating out', dupReceipt: false, dupSms: false,
    dupBook: { checked: true, reason: null, match: null, count: 0, undatedAmountMatch: false },
    defaultMethod: 'Cash',
    extraction: {
      doc_type: 'purchase_receipt', is_receipt: true, amount: 12.5, currency: 'EUR',
      merchant_display: 'Café de Flore', merchant_latin: 'cafe de flore',
      date: null, payment_hint: 'cash',
      amount_confidence: 'high', merchant_confidence: 'high', date_confidence: 'low',
      raw_total_line: 'TOTAL 12,50 €', notes: null,
    },
  },
  {
    label: 'card receipt the SMS already logged',
    ok: true, category: 'Personal expenses', dupReceipt: false, dupSms: true,
    dupBook: { checked: true, reason: null, match: null, count: 0, undatedAmountMatch: false },
    defaultMethod: 'Cash',
    extraction: {
      doc_type: 'purchase_receipt', is_receipt: true, amount: 214.75, currency: 'EGP',
      merchant_display: 'Uber', merchant_latin: 'uber',
      date: null, payment_hint: 'card',
      amount_confidence: 'high', merchant_confidence: 'high', date_confidence: 'high',
      raw_total_line: 'TOTAL 214.75 EGP', notes: null,
    },
  },
  {
    label: 'S4 not a receipt',
    ok: true, category: null, dupReceipt: false, dupSms: false,
    dupBook: { checked: false, reason: 'no_amount', match: null, count: 0, undatedAmountMatch: false },
    defaultMethod: 'Cash',
    extraction: {
      doc_type: 'not_expense', is_receipt: false, amount: null, currency: 'UNKNOWN',
      merchant_display: null, merchant_latin: null, date: null,
      payment_hint: 'unknown', amount_confidence: 'low',
      merchant_confidence: 'low', date_confidence: 'low',
      raw_total_line: null, notes: null,
    },
  },
  {
    /**
     * A PAYMENT SLIP (D18a) — captured, not refused. Under the old prompt this
     * same screenshot answered `is_receipt:false`; it is now an expense with a
     * card default (D19), and the payee keeps the bank's masking because that
     * masked form is what the Memory tab learns.
     */
    label: 'payment slip — InstaPay transfer',
    ok: true, category: null, dupReceipt: false, dupSms: false,
    dupBook: { checked: true, reason: null, match: null, count: 0, undatedAmountMatch: false },
    defaultMethod: 'Visa',
    extraction: {
      doc_type: 'payment_slip', is_receipt: true, amount: 800, currency: 'EGP',
      merchant_display: 'MOHAMED G**** R', merchant_latin: 'mohamed g r',
      date: '2026-08-11', payment_hint: 'card',
      amount_confidence: 'high', merchant_confidence: 'high', date_confidence: 'high',
      raw_total_line: 'تم تنفيذ تحويل لحظي بمبلغ 800.00 جم', notes: null,
    },
  },
  {
    /**
     * ALREADY IN THE BOOK. The slip arrived days after the SMS wrote the row, so
     * the 6 h `xsrc` cache is long gone and only the book knows. Nothing is
     * written unless he explicitly acknowledges it (`dupAck`), and the app shows
     * him the row it found rather than just asserting a clash.
     */
    label: 'payment slip his book already holds',
    ok: true, category: 'Transportation', dupReceipt: false, dupSms: false,
    dupBook: {
      checked: true, reason: null, count: 1, undatedAmountMatch: false,
      match: {
        date: '11/8/2026', description: 'Uber', method: 'Visa',
        category: 'Transportation', amount: 355.96, currency: 'EGP', tab: 'Aug',
      },
    },
    defaultMethod: 'Visa',
    extraction: {
      doc_type: 'payment_slip', is_receipt: true, amount: 355.96, currency: 'EGP',
      merchant_display: 'UBER RIDES', merchant_latin: 'uber rides',
      date: '2026-08-11', payment_hint: 'card',
      amount_confidence: 'high', merchant_confidence: 'high', date_confidence: 'high',
      raw_total_line: 'Paid 355.96 EGP', notes: null,
    },
  },
];

let fixtureIndex = 0;

export function mockReceiptExtract() {
  const fixture = RECEIPT_FIXTURES[fixtureIndex % RECEIPT_FIXTURES.length];
  fixtureIndex++;
  // Vision calls are genuinely slow — long enough that the 20 s escape hatch is
  // a real design concern, not a hypothetical one.
  return new Promise((resolve) => setTimeout(() => resolve({ v: 1, ...fixture }), 900));
}

/**
 * `entries` for one month (06 §2.4) — the Recent tab's data.
 *
 * MOCK PARITY, and it takes the same care the pending/today overlap did: the
 * CURRENT month's rows must INCLUDE today's, because on the real server both
 * come from the one month blob and a row cannot be in one and not the other.
 * A mock that kept them separate would certify a Recent tab that disagrees with
 * the Today screen about what he spent this morning.
 *
 * The invented rows below deliberately carry the three states the filters have
 * to handle honestly:
 *   · an UNDATED row (`221` — one of his real unreadable date cells), which
 *     belongs to the month and to no day, so Today and Week must leave it out;
 *   · an UNPRICED row, which renders `—` and never `0`;
 *   · a FOREIGN row, excluded from EGP sums and shown verbatim.
 *
 * A month with no tab answers an empty LIST, never an error — browsing backwards
 * through the year is not a failure mode (§2.4).
 */
const MOCK_MONTH_ROWS = (y, m, today, pendingToday, todayEntries) => {
  if (y !== today.y) return [];
  if (m === today.m) {
    return [
      { date: `2/${m}/${y}`, description: 'Nile Star Market', method: 'Visa', category: 'Groceries', amount: 612, currency: 'EGP' },
      { date: `4/${m}/${y}`, description: 'Zaytouna Bakery', method: 'Cash', category: 'Eating out', amount: 48, currency: 'EGP' },
      { date: '221', description: 'Guards', method: 'Cash', category: 'Gifts', amount: 100, currency: 'EGP' },
      { date: `5/${m}/${y}`, description: 'Northgate Hotel', method: 'Visa', category: 'Vacations', amount: null, currency: null },
      { date: `6/${m}/${y}`, description: 'Bergen Market', method: 'Visa', category: 'Groceries', amount: 41.9, currency: 'EUR' },
      ...todayEntries,
    ];
  }
  const prev = prevMonthOf(today.y, today.m);
  if (m === prev.m && y === prev.y) {
    return [
      { date: `12/${m}/${y}`, description: 'Carrefour', method: 'Visa', category: 'Groceries', amount: 903, currency: 'EGP' },
      { date: `22/${m}/${y}`, description: 'Seif', method: 'Cash', category: 'Medical', amount: 137.5, currency: 'EGP' },
    ];
  }
  return [];
};

export function mockEntries({ y, m }) {
  const today = cairoToday();
  const base = mockSummary();
  const MONTH_ABBR_ = MONTH_ABBR[Number(m) - 1] || String(m);
  /**
   * U1/U4 — the list reflects this session's mock edits and removals (the
   * overlay is a no-op until a mock write happens): on the real server the
   * editor and the list read the ONE month blob, and a mock whose list
   * reverts what its editor just confirmed would certify a refetch that
   * un-edits rows — the pending/today disjointness bug wearing new clothes.
   */
  const rows = mockLiveRows_(MONTH_ABBR_,
    MOCK_MONTH_ROWS(Number(y), Number(m), today, null, base.today.entries)).filter(Boolean);
  return new Promise((resolve) => setTimeout(() => resolve({
    ok: true,
    v: 1,
    tab: MONTH_ABBR_,
    entries: rows,
    // Counts the client renders as the honest footer. Derived from the rows
    // themselves so the mock cannot disagree with its own list.
    unpriced: rows.filter((r) => r.amount == null).length,
    undated: rows.filter((r) => !/^\s*\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{4}\s*$/.test(String(r.date))).length,
  }), 380));
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DICTATION — and the third failure of the mock-parity law.
 *
 * There was no voice handler here at all. The client sent `{action:'voice'}` to
 * a server that had no such case, every press answered `unknown_action`, nothing
 * was ever written — and 2,412 assertions saw none of it, because a mock with no
 * handler cannot refuse anything. CLAUDE.md records this law as "learned twice
 * in one day"; this was the third time, in the exact shape it names.
 *
 * So this models the SERVICE, including what the service REFUSES.
 *
 * ——— THE RULE THAT MATTERS MOST: never more permissive than the server.
 *
 * The parse below mirrors `handleVoice_` deliberately — same first-number regex,
 * same Arabic-Indic normalisation, same `فيزا`-switches-method, same ❓ when no
 * keyword matches. A mock that accepted a sentence the server rejects would
 * certify a client against a success it will never see in his hand, which is
 * this bug wearing a different hat.
 * ═══════════════════════════════════════════════════════════════════════════
 */

// The keywords the server actually matches, in its own order — first hit wins.
const MOCK_VOICE_KEYWORDS = [
  ['قهو', 'Eating out'], ['كافيه', 'Eating out'], ['اكل', 'Eating out'], ['أكل', 'Eating out'],
  ['سوبر', 'Groceries'], ['خضار', 'Groceries'], ['بقال', 'Groceries'],
  ['بنزين', 'Car'], ['غسيل', 'Car'],
  ['دوا', 'Medical'], ['صيدلي', 'Medical'],
  ['كهرب', 'Elect. Recharge'], ['غاز', 'Gas'],
];

/** Arabic-Indic → Western, and the two Arabic separators the server normalises. */
const mockNormalizeDigits = (t) => String(t == null ? '' : t)
  .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
  .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
  .replace(/\u066B/g, '.')
  .replace(/\u066C/g, '');

// Replayed clientIds, so an outbox retry answers `duplicate` exactly as the
// server's 6 h cache does. Module-scoped: the mock is one "server" per session.
const mockVoiceSeen = new Set();

export function mockVoice({ text, clientId } = {}) {
  const raw = String(text == null ? '' : text).trim();
  /**
   * `no_text` and `no_amount` are DIFFERENT and must never collapse. "We heard
   * nothing" and "we heard no number" are two different sentences to put in
   * front of him, and only one of them is his to fix by speaking again.
   */
  if (!raw) return Promise.resolve({ ok: false, v: 1, error: 'no_text' });

  const normalized = mockNormalizeDigits(raw);
  const m = normalized.match(/(\d[\d.,]*)/);
  if (!m) return Promise.resolve({ ok: false, v: 1, error: 'no_amount' });
  const amount = Number(String(m[1]).replace(/,/g, ''));
  if (!isFinite(amount) || amount <= 0) {
    return Promise.resolve({ ok: false, v: 1, error: 'no_amount' });
  }

  let category = null;
  for (const [word, cat] of MOCK_VOICE_KEYWORDS) {
    if (normalized.indexOf(word) !== -1) { category = cat; break; }
  }
  const method = normalized.indexOf('فيزا') !== -1 ? 'Visa' : 'Cash';
  const description = raw.replace(m[1], '').replace(/جنيه|فيزا|كاش/g, '').trim()
    || (category || 'voice');

  const today = cairoToday();
  const entry = {
    date: `${today.d}/${today.m}/${today.y}`,
    description,
    method,
    // ❓ when no keyword matched — chips, never a guess (D5).
    category: category || UNKNOWN_CATEGORY,
    amount,
    currency: 'EGP',
  };

  // Idempotent, like `manual`. The outbox depends on it: `duplicate` settles,
  // anything else re-queues.
  if (clientId) {
    if (mockVoiceSeen.has(clientId)) {
      return Promise.resolve({ ok: true, v: 1, skipped: 'duplicate', entry });
    }
    mockVoiceSeen.add(clientId);
  }
  return Promise.resolve({ ok: true, v: 1, entry });
}

/** Test seam — a suite must be able to replay a clientId from a clean slate. */
export function _resetMockVoice() { mockVoiceSeen.clear(); }

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * U1/U4 — `edit_entry` (deployed) and `remove_entry` (not yet), and the
 * mock-parity law applied to BOTH directions at once.
 *
 * The deployed 20260825-1463 DISPATCHES AND ADVERTISES `edit_entry` (its
 * dispatch table carries the key, and `build.actions` is that table's own key
 * list) — so the mock serves it DEFAULT ON, transcribed from Code.gs §3.7.
 * A mock without it would model the service as LESS capable than it is: the
 * V17 class, the same hole that once hid travel mode entirely.
 *
 * `remove_entry` is DESIGN RATIFIED-PENDING-BUILD (06 §3.9, D26). The
 * deployed server answers `{ok:false, error:'unknown_action'}` — so that is
 * exactly what the wired mock door answers while MOCK_HAS_REMOVE_ENTRY ships
 * false, and the §3.9 transcription behind it is exercised by DIRECT import
 * (the mockHomeAggIn pattern). Flipping the default is a deliberate act that
 * happens only after D26 is live on his book, and it reddens the priorities
 * suite's flag census until someone means it.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * The SERVER's currency vocabulary (Code.gs `MANUAL_CURRENCIES`, verbatim).
 * Deliberately NOT travel.js's two-currency list: that one is the KEYPAD's
 * ruled subset («let's keep it in euros»), while the edit boundary tests raw
 * membership against what the server itself accepts — two different questions,
 * and folding them would re-run the two-normalisers hazard at a new seam.
 */
const MOCK_MANUAL_CURRENCIES = ['EGP', 'EUR', 'USD', 'GBP', 'SEK', 'NOK', 'SAR', 'AED'];

const round2_ = (n) => Math.round(n * 100) / 100;

/**
 * `editRowMatches_` transcribed: compare a row against `match` on a CHOSEN
 * subset of fields. Amount and currency are ONE cell, so the amount test
 * carries the currency with it; null-vs-null is equality, null-vs-number is
 * not; numbers meet at the server's own 0.005 tolerance.
 */
function editSnapshotEq_(row, match, fields) {
  const trim = (v) => String(v == null ? '' : v).trim();
  const cur = (v) => (v == null ? null : v);
  for (const f of fields) {
    if (f === 'date' && trim(row.date) !== trim(match.date)) return false;
    if (f === 'description' && trim(row.description) !== trim(match.description)) return false;
    if (f === 'method' && (row.method === 'Visa' ? 'Visa' : 'Cash') !== (match.method === 'Visa' ? 'Visa' : 'Cash')) return false;
    if (f === 'category' && trim(row.category) !== trim(match.category)) return false;
    if (f === 'amount') {
      if (cur(row.currency) !== cur(match.currency)) return false;
      if (row.amount == null || match.amount == null) { if (row.amount !== match.amount) return false; }
      else if (Math.abs(row.amount - Number(match.amount)) >= 0.005) return false;
    }
  }
  return true;
}

const EDIT_ALL_FIELDS = ['date', 'description', 'method', 'amount', 'category'];

/**
 * `editLocate_` transcribed, three stages and REFUSE rather than guess:
 * rowHint fast path (all fields) → any full match (twins are interchangeable
 * only while byte-identical) → relaxed scan over the fields the edit does not
 * retire, where EXACTLY ONE candidate answers `row_changed` and anything else
 * is `row_not_found` — repricing an arbitrary twin is a confident wrong number.
 */
function editLocateOn_(rows, match, edited, rowHint) {
  const hint = Number(rowHint);
  if (isFinite(hint) && hint >= 2 && hint <= rows.length + 1 && rows[hint - 2]
      && editSnapshotEq_(rows[hint - 2], match, EDIT_ALL_FIELDS)) return { at: hint - 2, exact: true };
  for (let i = 0; i < rows.length; i++) {
    if (rows[i] && editSnapshotEq_(rows[i], match, EDIT_ALL_FIELDS)) return { at: i, exact: true };
  }
  const fields = [];
  for (const f of EDIT_ALL_FIELDS) {
    if (f === 'amount') { if (!edited.amount && !edited.currency) fields.push(f); continue; }
    if (!edited[f]) fields.push(f);
  }
  if (fields.length < 2) return { at: -1, exact: false };   // a scan that thin hands back strangers
  const cands = [];
  for (let j = 0; j < rows.length; j++) if (rows[j] && editSnapshotEq_(rows[j], match, fields)) cands.push(j);
  return cands.length === 1 ? { at: cands[0], exact: false } : { at: -1, exact: false };
}

/** `editValidate_` transcribed — every refusal fails CLOSED, nothing coerces. */
function editValidateOn_(edits, clean, ym, today) {
  const EDITABLE = ['method', 'amount', 'currency', 'description', 'date'];
  const keys = Object.keys(edits);
  if (!keys.length) return 'bad_edit';                       // an edit that edits nothing is a client bug surfaced
  for (const k of keys) if (EDITABLE.indexOf(k) === -1) return 'bad_edit';
  if (Object.prototype.hasOwnProperty.call(edits, 'method')) {
    const m = String(edits.method == null ? '' : edits.method).trim().toLowerCase();
    if (m !== 'cash' && m !== 'visa') return 'bad_edit';     // raw membership — capture coerces, an edit refuses
    clean.method = m === 'visa' ? 'Visa' : 'Cash';
  }
  if (Object.prototype.hasOwnProperty.call(edits, 'amount')) {
    const a = Number(mockNormalizeDigits(String(edits.amount == null ? '' : edits.amount)).trim());
    if (!isFinite(a) || a <= 0 || a >= 1000000) return 'bad_edit';
    clean.amount = round2_(a);
  }
  if (Object.prototype.hasOwnProperty.call(edits, 'currency')) {
    const c = String(edits.currency == null ? '' : edits.currency).trim().toUpperCase();
    if (MOCK_MANUAL_CURRENCIES.indexOf(c) === -1) return 'bad_edit';   // never fall back to EGP
    clean.currency = c;
  }
  if (Object.prototype.hasOwnProperty.call(edits, 'description')) {
    const d = String(edits.description == null ? '' : edits.description).trim();
    if (!d) return 'bad_edit';                               // a blank row is unaddressable forever
    if (d.charAt(0) === '=') return 'bad_edit';              // a live formula in real Sheets
    clean.description = d;
  }
  if (Object.prototype.hasOwnProperty.call(edits, 'date')) {
    const m = /^\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})\s*$/.exec(
      mockNormalizeDigits(String(edits.date == null ? '' : edits.date)));
    if (!m) return 'bad_edit';
    const dd = Number(m[1]), mm = Number(m[2]), yy = Number(m[3]);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return 'bad_edit';
    // −60…+2 d Cairo (CONFIG.SLIP_DATE_BACK_DAYS), then the leaves-tab refusal:
    // a move is append + delete, and the backend has no delete (docs/09 §4).
    const days = (Date.UTC(yy, mm - 1, dd) - Date.UTC(today.y, today.m - 1, today.d)) / 86400000;
    if (days < -60 || days > 2) return 'bad_edit';
    if (yy !== ym.y || mm !== ym.m) return 'bad_edit';
    clean.dateStr = `${dd}/${mm}/${yy}`;
  }
  return null;
}

/**
 * §3.7 transcribed, over a given row list — exported for direct call so the
 * refusal branches are exercised without a browser (the mockHomeAggIn pattern).
 * NOT transcribed, by name: D21's Rate/Home recompute (these mock rows carry
 * no such columns — his book's, not Dad's), the `"By euro "` foreign-column
 * refusal (same reason), and the post-write re-read guard (no concurrent
 * writer exists inside a mock). Each lives in Code.gs and in the backend
 * battery; a mock copy would assert nothing the fixture can reach.
 */
export function mockEditEntryOn(rows, body, ym, today = cairoToday()) {
  const edits = body && body.edits;
  const match = (body && body.match) || {};
  if (!edits || typeof edits !== 'object') return { ok: false, error: 'bad_edit' };
  const edited = {};
  for (const k of Object.keys(edits)) edited[k] = true;
  // A key in `edits` whose `match` counterpart is absent is not "don't care" —
  // it is a claim the client did not make (Code.gs handleEditEntry_).
  for (const k of Object.keys(edited)) {
    if (!Object.prototype.hasOwnProperty.call(match, k)) return { ok: false, error: 'bad_edit' };
  }
  const clean = {};
  const vErr = editValidateOn_(edits, clean, ym, today);
  if (vErr) return { ok: false, error: vErr };

  const found = editLocateOn_(rows, match, edited, body && body.rowHint);
  if (found.at === -1) return { ok: false, error: 'row_not_found' };
  const row = rows[found.at];
  if (!found.exact) return { ok: false, error: 'row_changed', current: { ...row } };

  // GUARD THE VALUE THAT WILL BE WRITTEN: amount and currency are one cell,
  // and either arriving alone on an unpriced row writes a lie («null SEK», or
  // a bare number that is silently EGP inside his dashboard totals).
  const wantAmount = edited.amount ? clean.amount : row.amount;
  const wantCurrency = edited.currency ? clean.currency : row.currency;
  if ((edited.amount || edited.currency) && (wantAmount == null || wantCurrency == null)) {
    return { ok: false, error: 'bad_edit' };
  }
  const entry = { ...row };
  if (edited.method) entry.method = clean.method;
  if (edited.description) entry.description = clean.description;
  if (edited.date) entry.date = clean.dateStr;
  if (edited.amount || edited.currency) { entry.amount = wantAmount; entry.currency = wantCurrency; }
  return { ok: true, tab: body && body.tab, row: found.at + 2, entry };
}

/**
 * The wired book behind the edit/remove doors: the SAME rows `mockEntries`
 * serves (one population — a mock whose editor sees rows its list does not is
 * the pending/today disjointness bug wearing new clothes), with this session's
 * edits applied and removed rows dropped, so optimistic concurrency is real:
 * a replayed claim meets the sheet it already changed.
 */
const mockEditedRows = new Map();   // `${tab}#${index}` → post-edit row
const mockRemovedIdx = new Set();   // `${tab}#${index}` — dropped from the served book

function mockBookFor_(tab) {
  const today = cairoToday();
  const mi = MONTH_ABBR.indexOf(String(tab == null ? '' : tab).trim());
  if (mi === -1) return null;
  const base = mockSummary();
  return {
    rows: MOCK_MONTH_ROWS(today.y, mi + 1, today, null, base.today.entries),
    ym: { y: today.y, m: mi + 1 },
    today,
  };
}

function mockLiveRows_(tab, rows) {
  return rows.map((r, i) => (mockRemovedIdx.has(`${tab}#${i}`) ? null : (mockEditedRows.get(`${tab}#${i}`) || r)));
}

export function mockEditEntry(body) {
  const book = mockBookFor_(body && body.tab);
  if (!book) return new Promise((resolve) => setTimeout(() => resolve({ ok: false, v: 1, error: 'row_not_found' }), 120));
  const out = mockEditEntryOn(mockLiveRows_(body.tab, book.rows), body, book.ym, book.today);
  if (out.ok) mockEditedRows.set(`${body.tab}#${out.row - 2}`, out.entry);
  // Same latency shape as the other write doors, so saving states are real.
  return new Promise((resolve) => setTimeout(() => resolve({ v: 1, ...out }), 240));
}

/** Test seam. */
export function _resetMockEdits() { mockEditedRows.clear(); }

/**
 * remove_entry is NOT deployed (06 §3.9 is ratified-pending-build, D26).
 * `false` = the wired door answers `unknown_action`, the deployed doPost's
 * exact sentence. Boolean on purpose: the priorities suite's file-wide census
 * asserts every `const MOCK_* = true|false;` ships false.
 */
const MOCK_HAS_REMOVE_ENTRY = false;

/**
 * What the mock's ping must advertise BEYOND capabilities.js's SERVER_ACTIONS:
 * that list still reads «the nine plus voice» and is another leaf's file this
 * wave — while the deployed 1463's dispatch table (and therefore its
 * `build.actions`) carries `edit_entry`. The advertisement and the answer stay
 * one fact: `remove_entry` joins only with its flag. Dedup-safe by
 * construction, so the day SERVER_ACTIONS itself learns `edit_entry`, nothing
 * doubles (api/index.js filters).
 */
export const MOCK_EXTRA_ACTIONS = ['edit_entry'].concat(MOCK_HAS_REMOVE_ENTRY ? ['remove_entry'] : []);

const mockRemoveState = { removed: [], seen: new Map() };

/**
 * §3.9 transcribed, over a given row list — the flag-on branch, exercised by
 * direct import while the wired door ships dark:
 *  · the row is MOVED to `Removed` (five columns + RemovedFrom/RemovedAt),
 *    never vanished — a mis-swipe is recoverable by hand from that tab;
 *  · a stale match answers `row_changed` with the current snapshot;
 *  · identical twins with no position are REFUSED — the counterpart-survives
 *    law forbids guessing which of two real expenses to take;
 *  · a REPLAY answers `already: true` and touches nothing — the one replay
 *    that could take the counterpart is the one this map exists to stop.
 * The caller's rows are never mutated; the wired book drops the row itself.
 */
export function mockRemoveEntryOn(rows, body, state) {
  const st = state || mockRemoveState;
  const match = (body && body.match) || {};
  const sig = JSON.stringify([body && body.tab, body && body.rowHint, match]);
  if (st.seen.has(sig)) return { ...st.seen.get(sig), already: true };

  const hint = Number(body && body.rowHint);
  let at = -1;
  if (isFinite(hint) && hint >= 2 && hint <= rows.length + 1 && rows[hint - 2]
      && editSnapshotEq_(rows[hint - 2], match, EDIT_ALL_FIELDS)) at = hint - 2;
  if (at === -1) {
    const full = [];
    for (let i = 0; i < rows.length; i++) if (rows[i] && editSnapshotEq_(rows[i], match, EDIT_ALL_FIELDS)) full.push(i);
    if (full.length === 1) at = full[0];
    else if (full.length > 1) return { ok: false, error: 'row_not_found' };
    else {
      const ident = [];
      for (let j = 0; j < rows.length; j++) if (rows[j] && editSnapshotEq_(rows[j], match, ['date', 'description'])) ident.push(j);
      if (ident.length === 1) return { ok: false, error: 'row_changed', current: { ...rows[ident[0]] } };
      return { ok: false, error: 'row_not_found' };
    }
  }
  const row = rows[at];
  st.removed.push({ ...row, RemovedFrom: (body && body.tab) || '', RemovedAt: new Date().toISOString() });
  const res = { ok: true, tab: body && body.tab, row: at + 2, removed: { ...row } };
  st.seen.set(sig, res);
  return res;
}

export function mockRemoveEntry(body) {
  if (!MOCK_HAS_REMOVE_ENTRY) {
    // The deployed doPost's exact answer for a verb its table does not hold —
    // the client must meet the state it will actually meet.
    return new Promise((resolve) => setTimeout(() => resolve({ ok: false, v: 1, error: 'unknown_action' }), 120));
  }
  const book = mockBookFor_(body && body.tab);
  if (!book) return new Promise((resolve) => setTimeout(() => resolve({ ok: false, v: 1, error: 'row_not_found' }), 120));
  const out = mockRemoveEntryOn(mockLiveRows_(body.tab, book.rows), body, mockRemoveState);
  if (out.ok && !out.already) mockRemovedIdx.add(`${body.tab}#${out.row - 2}`);
  return new Promise((resolve) => setTimeout(() => resolve({ v: 1, ...out }), 240));
}

/** Test seams — the Removed tab is a fact a suite must be able to read. */
export function _mockRemovedRows() { return mockRemoveState.removed.slice(); }
export function _resetMockRemove() {
  mockRemoveState.removed.length = 0;
  mockRemoveState.seen.clear();
  mockRemovedIdx.clear();
}
