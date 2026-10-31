/**
 * When the captain's log is shown, and when it is gone — W-6 «سجل القبطان».
 *
 * The card reports the month that just closed. It appears in the first week of
 * the new one, he reads it once, and it goes. Everything about that sentence is
 * a decision someone could get wrong, so all of it is here as pure functions
 * over plain data, and none of it is in the component.
 *
 * THE CARD IS NOT A NOTIFICATION. It never returns after dismissal, it never
 * nags, it has nothing to tap into and nothing to act on. A report to the
 * captain, not a prompt.
 */

/**
 * The first seven days of the month, counted on the SERVER's Cairo date.
 *
 * Never the device clock. His phone's date can be wrong, can be in another
 * timezone after travel, or can simply be a day ahead at 11pm Cairo — and any
 * of those would either hide the log he is owed or resurrect one he dismissed.
 * `today_cairo` is the server's own civil date and is the only clock this app
 * has ever been allowed to believe (contract §2.2).
 */
export const LOG_WINDOW_DAYS = 7;

export function isLogWindow(todayCairo) {
  const d = todayCairo && todayCairo.d;
  return typeof d === 'number' && d >= 1 && d <= LOG_WINDOW_DAYS;
}

/**
 * Is there a log at all?
 *
 * `null` is the server's honest answer for a first month or one holding no
 * readable entries (06 §2.2), and it must render NOTHING — an absent month is
 * an absent card, never a zero.
 *
 * Note what this does NOT test: the total, or whether `top` has anything in it.
 * A month whose every row is unpriced legitimately reports a total of 0 with an
 * empty `top`, and that is the single most important log the card can show —
 * "we could not account for this month". Gating on the total would delete it.
 */
export function hasLog(prevLog) {
  return !!prevLog
    && typeof prevLog.name === 'string'
    && typeof prevLog.total === 'number'
    && Array.isArray(prevLog.top);
}

/**
 * Dismissal is keyed by the month the card is shown IN, not the month it
 * reports. Same thing shifted, and this way the key comes straight from
 * `today_cairo` with no arithmetic — one less place to be off by one across a
 * December boundary.
 */
const key = (todayCairo) => `masareef.log.dismissed.${todayCairo.y}-${todayCairo.m}`;

export function isDismissed(todayCairo, storage) {
  if (!todayCairo) return false;
  try {
    const store = storage || (typeof localStorage === 'undefined' ? null : localStorage);
    return !!store && store.getItem(key(todayCairo)) === '1';
  } catch {
    // Private mode or a full quota. A log he cannot dismiss is a far smaller
    // problem than a crash on the screen that shows it.
    return false;
  }
}

export function dismiss(todayCairo, storage) {
  if (!todayCairo) return;
  try {
    const store = storage || (typeof localStorage === 'undefined' ? null : localStorage);
    if (store) store.setItem(key(todayCairo), '1');
  } catch { /* see above — dismissal is a convenience, never a dependency */ }
}

/** All three conditions, in one place, so no caller can apply two of them. */
export function shouldShowLog(prevLog, todayCairo, dismissed) {
  return hasLog(prevLog) && isLogWindow(todayCairo) && !dismissed;
}

/**
 * WHAT THE CLOSED MONTH CAME TO, IN EVERY CURRENCY IT WAS SPENT IN (Tarek,
 * 2026-11-01: his all-euro October closed as «0 EGP»).
 *
 * `prevLog.total` is the POUND sum only — the server's month totals leave foreign
 * money out by design (D8) — so a euro book's month read zero. The money is on
 * the wire already, in the same `month` payload: `prevForeign` sums every
 * non-pound currency, and `prevHomeAgg` is the closed month in the book's own
 * unit (native + converted at the rate stamped on each row; `unstamped` is what
 * no rate covers). Nothing here converts anything — it selects.
 *
 *   each      one line per currency, the home unit first; [] when only one
 *             currency was used (the hero already says it).
 *   hero      the figure the card leads with: the all-in home total when he
 *             reads in the book's unit, else his reading unit's own sum, else pounds.
 *   inHome    null, or { currency, native, converted, unconverted[], total } —
 *             the sum spelled out, shown only when more than one currency was used.
 *   unconverted  money in the month no stamped rate covers — said beside the
 *             home hero even when it is the only other currency, never added in.
 *   egpOnly   true when the pound sum is the whole month.
 *   top       { currency, list } — the top categories in the unit they were
 *             ranked in: the server's euro ranking (`homeTop`, build 1988+) when
 *             the hero is the home total, the pound ranking when pounds are the
 *             whole month, else null (an older server: ranked pounds would not
 *             add up to a euro hero).
 */
export function logFigures(prevLog, prevForeign, prevHomeAgg, readingCurrency) {
  const sums = {};
  if (prevLog.total > 0) sums.EGP = prevLog.total;
  const by = (prevForeign && prevForeign.byCurrency) || {};
  for (const c of Object.keys(by)) {
    const a = Number(by[c]);
    if (isFinite(a) && a > 0) sums[c] = (sums[c] || 0) + a;
  }
  const home = prevHomeAgg && prevHomeAgg.currency && isFinite(Number(prevHomeAgg.total))
    && prevHomeAgg.currency === readingCurrency ? prevHomeAgg : null;
  const first = home ? home.currency : readingCurrency;
  const each = Object.keys(sums)
    .sort((a, b) => (a === first ? -1 : b === first ? 1 : a === 'EGP' ? -1 : b === 'EGP' ? 1 : a < b ? -1 : 1))
    .map((c) => ({ currency: c, amount: sums[c] }));
  const egpOnly = !Object.keys(sums).some((c) => c !== 'EGP');
  const several = each.length > 1;

  let hero;
  if (home) hero = { currency: home.currency, amount: Number(home.total) };
  else if (sums[readingCurrency] != null) hero = { currency: readingCurrency, amount: sums[readingCurrency] };
  else hero = { currency: 'EGP', amount: prevLog.total };

  const unconverted = home
    ? Object.keys((home.unstamped && home.unstamped.byCurrency) || {})
      .map((c) => ({ currency: c, amount: Number(home.unstamped.byCurrency[c]) }))
      .filter((l) => isFinite(l.amount) && l.amount > 0)
    : [];
  const inHome = home && several ? {
    currency: home.currency,
    native: Number((home.native && home.native.total) || 0),
    converted: Number((home.converted && home.converted.total) || 0),
    unconverted,
    total: Number(home.total),
  } : null;

  const top = home && Array.isArray(prevLog.homeTop) ? { currency: home.currency, list: prevLog.homeTop }
    : egpOnly ? { currency: 'EGP', list: prevLog.top } : null;
  return { hero, each: several ? each : [], inHome, unconverted, egpOnly, top };
}
