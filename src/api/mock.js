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
 * The other real state of `month.prevLog`: `null`, which the server returns for
 * a first month or one holding no readable entries. Populated is the DEFAULT
 * because that is what his book actually returns — he has months of history —
 * and a mock must default to the state the service is really in. Flip this to
 * review the card-less screen.
 */
const MOCK_PREVLOG_NULL = false;

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

  return {
    ok: true,
    v: 1,
    serverTime: new Date().toISOString(),
    today_cairo: today,
    week: { cur: weekOf(0, true), prev: weekOf(-7, false) },
    month: {
      cur: curMonth,
      prev: prevMonth,
      names: { cur: MONTH_NAMES[today.m - 1], prev: MONTH_NAMES[prev.m - 1] },
      // Two unreadable date cells this month — exercises the footnote.
      undated: { count: 2, Visa: 0, Cash: 175 },
      // Rows he wrote down but never priced (the travel legs). The month total
      // is knowably short, and the UI must say so rather than look confident.
      unpriced: { count: 3 },
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
    },
    /**
     * V17 SHAPE, DELIBERATELY — a TOP-5 cut, and `month` above carries NO
     * `uncategorized` key. That is what the serving backend returns today, and
     * the parity law says the mock's default state is the real service's default
     * state, never a nicer one. So this list does NOT add up to the month, and
     * the Month screen correctly prints no «إجمالي الشهر» line under it: a total
     * a visible list cannot account for is the exact reconciliation failure this
     * app was built around (06 §2.2).
     *
     * WHEN V18 CYCLES TO PRODUCTION (every category here, plus
     * `month.uncategorized: {count, total}` in the block above), this mock flips
     * to that shape in the same rev — again by the parity law — and the total
     * line starts rendering on its own, because the client gates on that field's
     * PRESENCE. Whoever flips it: make the numbers reconcile, i.e. sum of these
     * `now` figures + `uncategorized.total` = the month's true total (the series
     * above plus `undated`), or the mock will be asserting a lie in the one
     * place the screen shows its arithmetic.
     */
    monthCats: [
      { name: 'Eating out', now: 6840, prev: 9120 },
      { name: 'Groceries', now: 5210, prev: 6480 },
      { name: 'Car', now: 2960, prev: 1890 },
      { name: 'Donations', now: 2100, prev: 4500 },
      { name: 'Internet', now: 1010, prev: 860 },
    ],
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
  ok: true, category: null, dupReceipt: false, dupSms: false,
  dupBook: { checked: true, reason: null, match: null, count: 0, undatedAmountMatch: false },
  defaultMethod: 'Visa',
  entriesTotal: 6,
  entries: [
    { index: 0, amount: 15.47, currency: 'EUR', merchant_display: 'Lantern Grocer',
      merchant_latin: 'lantern grocer', section_date: '08-24', row_status: 'completed',
      payment_hint: 'card', aggregate_count: null, category: 'Groceries', date: '2026-08-24',
      dupBook: { checked: true, reason: null, match: null, count: 0, undatedAmountMatch: false } },
    { index: 1, amount: 27.40, currency: 'EUR', merchant_display: 'Bridge Cafe',
      merchant_latin: 'bridge cafe', section_date: '08-24', row_status: 'completed',
      payment_hint: 'card', aggregate_count: null, category: 'Eating out', date: '2026-08-24',
      dupBook: { checked: true, reason: null, match: null, count: 0, undatedAmountMatch: false } },
    { index: 2, amount: 163.00, currency: 'EUR', merchant_display: 'Harbour Baths',
      merchant_latin: 'harbour baths', section_date: '08-23', row_status: 'declined',
      payment_hint: 'card', aggregate_count: null, category: null, date: '2026-08-23',
      dupBook: { checked: false, reason: 'month_not_cached', match: null, count: 0, undatedAmountMatch: false } },
    { index: 3, amount: 42.00, currency: 'EUR', merchant_display: 'Refund from Ferry Co',
      merchant_latin: 'ferry co', section_date: '08-23', row_status: 'incoming',
      payment_hint: 'card', aggregate_count: null, category: null, date: '2026-08-23',
      dupBook: { checked: true, reason: null, match: null, count: 0, undatedAmountMatch: false } },
    { index: 4, amount: 6.50, currency: 'EUR', merchant_display: 'Spare change',
      merchant_latin: 'spare change', section_date: '08-23', row_status: 'roundup',
      payment_hint: 'card', aggregate_count: 3, category: null, date: '2026-08-23',
      dupBook: { checked: true, reason: null, match: null, count: 0, undatedAmountMatch: false } },
    { index: 5, amount: null, currency: 'EUR', merchant_display: 'Kiosk',
      merchant_latin: 'kiosk', section_date: '08-22', row_status: 'unclear',
      payment_hint: 'unknown', aggregate_count: null, category: null, date: '2026-08-22',
      dupBook: { checked: true, reason: null, match: null, count: 0, undatedAmountMatch: false } },
  ],
  extraction: {
    doc_type: 'transaction_list', is_receipt: false, amount: null, currency: 'EUR',
    merchant_display: null, merchant_latin: null, date: null, payment_hint: 'card',
    amount_confidence: 'low', merchant_confidence: 'low', date_confidence: 'low',
    raw_total_line: null, notes: null, not_expense_reason: null,
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
      return { index: r.index, status: 'book_duplicate',
        dupBook: { checked: true, reason: null, count: 1, undatedAmountMatch: false,
          match: { date: '24/8/2026', description: 'Bridge Cafe', amount: 27.4, currency: 'EUR' } } };
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
  const rows = MOCK_MONTH_ROWS(Number(y), Number(m), today, null, base.today.entries);
  const MONTH_ABBR_ = MONTH_ABBR[Number(m) - 1] || String(m);
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
