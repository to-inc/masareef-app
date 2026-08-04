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
 * `prevLog.name` is his TAB name — opaque, echoed from the sheet, and the
 * contract is explicit that the client must not parse it. So it is LOOKED UP,
 * and anything unrecognised falls through unchanged rather than becoming a
 * blank or a guess: a tab he renamed should read as its own name, not as
 * nothing.
 */
const MONTH_AR_BY_TAB = {
  Jan: 'يناير', Feb: 'فبراير', Mar: 'مارس', Apr: 'أبريل',
  May: 'مايو', Jun: 'يونيو', Jul: 'يوليو', Aug: 'أغسطس',
  Sep: 'سبتمبر', Oct: 'أكتوبر', Nov: 'نوفمبر', Dec: 'ديسمبر',
};

export function monthArFromTab(name) {
  if (typeof name !== 'string') return '';
  return MONTH_AR_BY_TAB[name.trim()] || name;
}
