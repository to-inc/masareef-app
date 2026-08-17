/**
 * The Book's four zooms, and the two sums the Today head prints (M1, S4).
 *
 * Pure functions, in the house pattern: the decisions are the part worth
 * pinning, and pinning them does not require a browser.
 */
import { UNKNOWN_CATEGORY } from '../lib/constants.js';

/**
 * The periods, in the order the control shows them. «الأخير» offered three and
 * «اليوم» offered four; merging them meant choosing, and four is the one that
 * loses nothing — the year had a chart nobody could reach from the other tab.
 */
export const BOOK_PERIODS = ['today', 'week', 'month', 'year'];
export const bookPeriods = () => BOOK_PERIODS.slice();
export const isBookPeriod = (p) => BOOK_PERIODS.indexOf(p) !== -1;

/**
 * WHERE THIS PERIOD'S ROWS COME FROM.
 *
 * Today's rows are already in hand — the server builds `today` and `pending`
 * from the same month blob the summary carries, so re-fetching them would be a
 * needless Apps Script cold start (1–3s, occasionally worse) on the screen he
 * opens most. Everything else needs a read.
 *
 * Browsing an explicit month always fetches, including when that month happens
 * to be the current one: the summary's `today` is one DAY, and answering a
 * request for a month with a day's rows is the kind of quiet wrongness that
 * looks like an empty book.
 */
export function rowsSource(period, browsing) {
  if (browsing) return 'fetch';
  return period === 'today' ? 'summary' : 'fetch';
}

/**
 * THE DAY'S EGP FIGURE — the one the old screen made him add up himself.
 *
 * Reads the server's `today.totals`, which are already EGP-only by D8: a
 * non-EGP row is written into his sheet as `"12.5 EUR"` text and excluded from
 * every EGP sum. So this is a sum of two numbers, not a re-derivation from the
 * rows — deriving it again from `entries` would be a second answer to a question
 * the payload already answers, and the two would disagree the first time a row
 * arrived that the totals counted and the list did not.
 */
export function egpTotalOf(totals) {
  const v = Number(totals && totals.Visa);
  const c = Number(totals && totals.Cash);
  return (isFinite(v) ? v : 0) + (isFinite(c) ? c : 0);
}

/**
 * THE TRAVEL LINE — foreign money, named beside the figure rather than folded
 * silently out of it (finding S4).
 *
 * D8 excludes non-EGP rows from the EGP sums, which is correct: adding euros to
 * pounds is not arithmetic. But the exclusion was invisible, so a day with a
 * foreign purchase showed a total quietly missing one, on a screen headed «زي ما
 * هي في الشيت بالظبط». Naming it is the honest-render law applied to a sum.
 *
 * Grouped BY CURRENCY and never summed across them, for the same reason. A day
 * with euros and krona shows two figures, because that is how many facts there
 * are.
 *
 * An unpriced row (`amount == null`) contributes nothing — it has no figure to
 * contribute, and `|| 0` here would invent a zero-euro purchase.
 */
/**
 * IS THIS ROW STILL WAITING FOR A CATEGORY? — the predicate behind "every ❓ is
 * a door" (finding M6).
 *
 * ——— CAUGHT ON THE DEVICE, and it is the whole reason this is a function.
 *
 * The first version of the Book asked `!row.category`, which is the obvious
 * reading and is wrong: an uncategorised row does NOT arrive with an empty
 * category. It arrives carrying the literal `❓` — that glyph is a real value in
 * his sheet's Category column, written there by the capture path, and it is what
 * `fix_category` overwrites. So `!row.category` was false for every row the
 * feature exists for, and the doors rendered as ordinary categories showing a
 * question mark. It LOOKED like the old screen, which is exactly why it would
 * have shipped.
 *
 * Both forms are treated as the gap because both occur: `❓` from the capture
 * path, and genuinely empty from a row he typed into the sheet himself and left
 * blank. Whitespace is trimmed for the same reason `canonicalCategory_` trims
 * server-side — a cell holding one space is not a category.
 */
export function needsCategory(row) {
  if (!row) return false;
  const c = typeof row.category === 'string' ? row.category.trim() : row.category;
  return !c || c === UNKNOWN_CATEGORY;
}

export function travelOf(entries) {
  const by = new Map();
  for (const e of Array.isArray(entries) ? entries : []) {
    if (!e || !e.currency || e.currency === 'EGP') continue;
    /**
     * ABSENCE IS CHECKED BEFORE THE CAST, and that order is the assertion.
     *
     * `Number(null)` is 0 and `isFinite(0)` is true, so guarding only on
     * `isFinite` lets an unpriced row through as a real zero — printing
     * «✈ 0.00 EUR» for a row he wrote down and never priced. That is the
     * `money(null) → 0` lie wearing a currency code, and it was in the first
     * version of this function. `Number('')` is 0 too, hence the empty-string
     * case.
     */
    if (e.amount == null || e.amount === '') continue;
    const amt = Number(e.amount);
    if (!isFinite(amt)) continue;
    by.set(e.currency, (by.get(e.currency) || 0) + amt);
  }
  // Stable order, so two renders of the same day never reshuffle.
  return [...by.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([currency, amount]) => ({ currency, amount }));
}
