/**
 * Number and digit handling.
 *
 * Everything RENDERS in Western digits — that is what his sheet holds and what
 * Fraunces' numerals are cut for. Anything he TYPES may arrive in Arabic-Indic
 * (٠١٢٣٤٥٦٧٨٩) or Persian digits, so normalize on the way in. Mirrors
 * `normalizeDigits_` in backend/Code.gs.
 */
const AR = '٠١٢٣٤٥٦٧٨٩';
const FA = '۰۱۲۳۴۵۶۷۸۹';

export function normalizeDigits(s) {
  return String(s == null ? '' : s).replace(/[٠-٩۰-۹]/g, (d) => {
    const i = AR.indexOf(d);
    return String(i === -1 ? FA.indexOf(d) : i);
  });
}

/**
 * The one glyph that means "there is no number here". Exported so a view never
 * has to spell it, and so changing it changes it everywhere.
 */
export const ABSENT = '—';

/**
 * Is this value an ABSENCE rather than a number? (Ratified 2026-07-31.)
 *
 * THE TWO ROUTES BY WHICH THIS FILE USED TO FABRICATE, both verified live:
 *
 *   1. `Number(null)` is `0` and `isFinite(0)` is true — so `money(null)`
 *      never reached the guard at all and formatted a zero he never wrote.
 *      `''` and `Number('  ')` coerce to 0 the same way.
 *   2. The explicit `!isFinite` fallback ALSO returned `'0'` — so even
 *      `undefined` and `NaN`, which did reach the guard, were answered with a
 *      number. The guard existed and was itself the fabrication.
 *
 * Six null-fabrication bugs were fixed in this app before this change and every
 * one was fixed AT THE CALL SITE; the primitive stayed loaded. That is why the
 * class kept recurring across four different files while each individual fix
 * was correct. CLAUDE.md's honest-rendering law is about what a person READS:
 * "does he see a number that isn't true?" — and `0` is the most convincing
 * wrong number available, because it looks like an answer.
 *
 * A real zero is NOT an absence: `money(0)` still returns `"0"`, because a day
 * on which he genuinely spent nothing is a fact and must read as one.
 */
function isAbsent(n) {
  if (n === null || n === undefined) return true;
  if (typeof n === 'string' && n.trim() === '') return true;
  return !isFinite(Number(n));
}

// Grouped Western digits — 'en-US' is pinned deliberately: the ambient locale on
// an Arabic iPhone would render ١٬٠٤٥ and break parity with his sheet.
export function money(n) {
  if (isAbsent(n)) return ABSENT;
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function moneyRound(n) {
  if (isAbsent(n)) return ABSENT;
  return Math.round(Number(n)).toLocaleString('en-US');
}

// Amounts are shown with their currency only when it is NOT EGP — a travel row
// reads "12.5 EUR" exactly as it sits in the Amount column (D8).
export function amountWithCurrency(amount, currency) {
  // An absent amount returns the glyph ALONE — never "— EUR". A currency beside
  // a placeholder still asserts that some EUR figure exists, which is the same
  // lie in quieter clothing: it is what put a "✈ سفر" badge on an unpriced row.
  if (isAbsent(amount)) return ABSENT;
  const base = money(amount);
  return currency && currency !== 'EGP' ? `${base} ${currency}` : base;
}
