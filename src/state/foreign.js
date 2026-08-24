/**
 * FOREIGN MONEY IN A PERIOD — and the two things it forbids.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE «THIS WEEK 0» DEFECT, IN ITS RENDER HALF.
 *
 * D8 excludes non-EGP rows from every EGP sum, correctly: adding euros to pounds
 * is not arithmetic. His sheet holds them as `"12.5 EUR"` text and always has.
 *
 * But a week he spent entirely abroad then has an EGP total of ZERO — and the
 * screen renders «0», and beside it «أقل من الأسبوع اللي فات بـ 100%». Both
 * figures are arithmetically defensible and together they tell a retired man he
 * spent nothing in a week he spent two hundred euros. That is not a rounding
 * complaint; it is the app stating a falsehood in its largest type.
 *
 * ——— SO THE RULE HAS TWO HALVES, AND BOTH ARE ABSOLUTE.
 *
 *  1. NEVER A BARE TOTAL. Where foreign money exists the EGP figure is not the
 *     period; it is a PART of the period. It may only appear accompanied by what
 *     it excludes.
 *  2. NEVER A PERCENTAGE. A comparison between an EGP-only subset and another
 *     period is a comparison of two different questions. Silence is honest; a
 *     confident «▼100%» is not.
 *
 * The second is the one that would be argued away, so it is stated first in
 * code: `mayCompare` is consulted BEFORE any percentage is computed, not applied
 * to one afterwards.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Does this period contain money the EGP figure cannot see?
 *
 * Reads `count` rather than `byCurrency`'s emptiness, because the two answer
 * different questions: a period can carry an unpriced foreign row — he wrote the
 * shop down and never the price — which counts as "there is money here we cannot
 * show" while contributing nothing to any per-currency sum. Treating that as
 * absent would restore the bare total in exactly the case with the least
 * information behind it.
 */
export function hasForeign(foreign) {
  if (!foreign) return false;
  const n = Number(foreign.count);
  return isFinite(n) && n > 0;
}

/**
 * MAY THIS PERIOD SHOW A PERCENTAGE?
 *
 * Both sides are consulted. If EITHER period holds foreign money the comparison
 * is between an EGP-subset and something else — and which side is short does not
 * change that the ratio answers no question he asked.
 *
 * `prevForeign` is optional: absent means "we were not told", which is treated
 * as CLEAN rather than as dirty. That is the one place here that fails open, and
 * deliberately — refusing every comparison for want of a field the server may
 * not send would delete a true, useful sentence from every ordinary month. The
 * dangerous case (the CURRENT period being foreign) is always known.
 */
export function mayCompare(foreign, prevForeign) {
  return !hasForeign(foreign) && !hasForeign(prevForeign);
}

/**
 * The lines that stand beside the figure — one per currency, never summed
 * across them.
 *
 * 200 EUR + 100 SEK is not 300 of anything, and a single figure would be the
 * same invention as `money(null)` rendering 0, wearing a currency code. A day
 * with two currencies gets two lines because that is how many facts there are.
 *
 * Sorted by code so two renders of one period never reshuffle. An entry with no
 * readable amount is dropped from the LINES but has already been counted by
 * `hasForeign` — the period still refuses its bare total and its percentage,
 * which is the honest outcome for money we know exists and cannot size.
 */
export function foreignLines(foreign) {
  const by = (foreign && foreign.byCurrency) || null;
  if (!by || typeof by !== 'object') return [];
  const out = [];
  for (const code of Object.keys(by)) {
    const amt = Number(by[code]);
    if (!code || !isFinite(amt)) continue;
    out.push({ currency: code, amount: amt });
  }
  return out.sort((a, b) => (a.currency < b.currency ? -1 : 1));
}

/**
 * Money we know is there and cannot size: `count` exceeds what the lines
 * account for. The screen says so rather than letting the lines imply they are
 * the whole of it.
 */
export function unsizedForeign(foreign) {
  if (!hasForeign(foreign)) return 0;
  const counted = foreignLines(foreign).length;
  const n = Number(foreign.count);
  return counted > 0 && n > counted ? n - counted : (counted === 0 ? n : 0);
}
