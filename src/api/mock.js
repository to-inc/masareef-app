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

  const todayEntries = [
    { date: `${today.d}/${today.m}/${today.y}`, description: 'Coffee', method: 'Cash', category: 'Eating out', amount: 60, currency: 'EGP' },
    { date: `${today.d}/${today.m}/${today.y}`, description: 'Taqa', method: 'Cash', category: 'Elect. Recharge', amount: 200, currency: 'EGP' },
    { date: `${today.d}/${today.m}/${today.y}`, description: 'Uber', method: 'Visa', category: 'Personal expenses', amount: 214.75, currency: 'EGP' },
    // A travel row: excluded from EGP sums, shown verbatim as it sits in the sheet.
    { date: `${today.d}/${today.m}/${today.y}`, description: 'Café de Flore', method: 'Visa', category: 'Eating out', amount: 12.5, currency: 'EUR' },
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
    },
    year: {
      cur: { Visa: yearVisa, Cash: yearCash },
      prev: { Visa: prevYearVisa, Cash: prevYearCash },
    },
    monthCats: [
      { name: 'Eating out', now: 6840, prev: 9120 },
      { name: 'Groceries', now: 5210, prev: 6480 },
      { name: 'Car', now: 2960, prev: 1890 },
      { name: 'Donations', now: 2100, prev: 4500 },
      { name: 'Internet', now: 1010, prev: 860 },
    ],
    today: { entries: todayEntries, totals: todayTotals },
    pending: [
      {
        tab: MONTH_ABBR[today.m - 1],
        rowHint: 14,
        match: {
          date: `${today.d}/${today.m}/${today.y}`, description: 'Hyper1', method: 'Visa',
          category: UNKNOWN_CATEGORY, amount: 860, currency: 'EGP',
        },
        guess: 'Groceries',        // → the one-tap green button
        stale: false,
      },
      {
        tab: MONTH_ABBR[today.m - 1],
        rowHint: 15,
        match: {
          date: `${today.d}/${today.m}/${today.y}`, description: 'Zaytouna Bakery', method: 'Visa',
          category: UNKNOWN_CATEGORY, amount: 75, currency: 'EGP',
        },
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
const RECEIPT_FIXTURES = [
  {
    label: 'S2 confident EGP cash',
    ok: true, category: 'Medical', dupReceipt: false, dupSms: false,
    extraction: {
      is_receipt: true, amount: 137.5, currency: 'EGP',
      merchant_display: 'صيدلية سيف', merchant_latin: 'seif pharmacy',
      date: null, payment_hint: 'cash',
      amount_confidence: 'high', merchant_confidence: 'high', date_confidence: 'high',
      raw_total_line: 'الإجمالي 137.50 ج.م', notes: null,
    },
  },
  {
    label: 'S3 uncertain — faded total',
    ok: true, category: null, dupReceipt: false, dupSms: false,
    extraction: {
      is_receipt: true, amount: null, currency: 'EGP',
      merchant_display: 'بقالة ??', merchant_latin: null,
      date: null, payment_hint: 'unknown',
      amount_confidence: 'low', merchant_confidence: 'low', date_confidence: 'low',
      raw_total_line: 'ا?ج?الي ??.?? ج.م', notes: 'faded thermal print',
    },
  },
  {
    label: 'S2 travel EUR',
    ok: true, category: 'Eating out', dupReceipt: false, dupSms: false,
    extraction: {
      is_receipt: true, amount: 12.5, currency: 'EUR',
      merchant_display: 'Café de Flore', merchant_latin: 'cafe de flore',
      date: null, payment_hint: 'cash',
      amount_confidence: 'high', merchant_confidence: 'high', date_confidence: 'low',
      raw_total_line: 'TOTAL 12,50 €', notes: null,
    },
  },
  {
    label: 'card receipt the SMS already logged',
    ok: true, category: 'Personal expenses', dupReceipt: false, dupSms: true,
    extraction: {
      is_receipt: true, amount: 214.75, currency: 'EGP',
      merchant_display: 'Uber', merchant_latin: 'uber',
      date: null, payment_hint: 'card',
      amount_confidence: 'high', merchant_confidence: 'high', date_confidence: 'high',
      raw_total_line: 'TOTAL 214.75 EGP', notes: null,
    },
  },
  {
    label: 'S4 not a receipt',
    ok: true, category: null, dupReceipt: false, dupSms: false,
    extraction: {
      is_receipt: false, amount: null, currency: 'UNKNOWN',
      merchant_display: null, merchant_latin: null, date: null,
      payment_hint: 'unknown', amount_confidence: 'low',
      merchant_confidence: 'low', date_confidence: 'low',
      raw_total_line: null, notes: null,
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
