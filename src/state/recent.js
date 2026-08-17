/**
 * The Recent tab's windows — Today, This Week, This Month (D16).
 *
 * Every decision here is arithmetic on the SERVER's Cairo date. The device clock
 * is never consulted: his phone can be a day ahead at 11pm Cairo, or in another
 * timezone after travel, and either would show him "today" that is not his.
 *
 * Dates arrive as the sheet's own `d/M/yyyy` strings. They are compared as
 * integers (`y*10000 + m*100 + d`) rather than as `Date` objects, because a Date
 * carries a timezone and these values have none — they are the day he wrote on a
 * row, and turning them into instants is how an off-by-one appears at midnight.
 */

export const FILTERS = ['today', 'week', 'month'];
export const isFilter = (f) => FILTERS.indexOf(f) !== -1;

/**
 * THE MONTH BROWSER'S ORDER — the current month first, then backwards (S9).
 *
 * It used to render `1..12` ascending, so in August the strip opened on
 * «يناير» and he had eight chips of sideways scrolling to reach the month he is
 * standing in. The months he actually revisits are this one and the one before
 * it; January is the one he will never open.
 *
 * Backwards from today, wrapping into the previous year's tail, which is also
 * the order a paper ledger falls open at. The YEAR is carried on each entry
 * rather than assumed, because `fetchEntries` is asked for `{y, m}` and a strip
 * that ran off the start of the year while still claiming `todayCairo.y` would
 * request twelve months that do not exist in this book.
 *
 * Twelve entries exactly — the same count as before, so nothing became
 * unreachable by reordering.
 */
export function monthStrip(todayCairo, count = 12) {
  const out = [];
  for (let i = 0; i < count; i++) {
    let m = todayCairo.m - i;
    let y = todayCairo.y;
    while (m < 1) { m += 12; y -= 1; }
    out.push({ y, m });
  }
  return out;
}

/**
 * `d/M/yyyy`, the sheet's format, tolerantly — leading zeros and stray spaces
 * are fine. Anything else is `null`, which is the honest answer for the cells
 * that genuinely cannot be read: `221`, `10/210/2`, an empty string.
 *
 * A row whose date is null is NOT a broken row. It is a real expense whose day
 * nobody can recover, it is in his month total, and the Month list shows it. It
 * simply cannot be placed on a calendar, which is why Today and Week leave it
 * out and the footer says how many there are.
 */
export function parseSheetDate(s) {
  if (typeof s !== 'string') return null;
  const m = /^\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})\s*$/.exec(s);
  if (!m) return null;
  const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

/** Comparable, timezone-free, and monotonic across years. */
export const dayKey = (ymd) => (ymd ? ymd.y * 10000 + ymd.m * 100 + ymd.d : null);

const shift = (ymd, days) => {
  const t = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d + days));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
};

/**
 * Sunday..Saturday, containing the server's today — the same convention the
 * server's own week windows use, and the Egyptian one.
 *
 * `Date.UTC` is used only for calendar ARITHMETIC (what is six days before this
 * date), never to decide what "now" is. That distinction is the whole reason
 * this is safe: the inputs and outputs are civil dates, and UTC is just a
 * calendar that has no daylight saving to trip over.
 */
export function weekWindow(todayCairo) {
  const dow = new Date(Date.UTC(todayCairo.y, todayCairo.m - 1, todayCairo.d)).getUTCDay();
  const from = shift(todayCairo, -dow);
  return { from, to: shift(from, 6) };
}

/**
 * Which months the tab must FETCH for a filter.
 *
 * Today and Month need one. A week can straddle a month boundary — 2026-08-01 is
 * a Saturday, so that week runs from Sunday 26 July — and asking only for August
 * would silently drop five days of his spending from a view labelled "this week".
 * Deduped, so a week inside one month is still one request.
 */
export function monthsFor(filter, todayCairo) {
  if (filter !== 'week') return [{ y: todayCairo.y, m: todayCairo.m }];
  const { from, to } = weekWindow(todayCairo);
  const months = [{ y: from.y, m: from.m }];
  if (from.y !== to.y || from.m !== to.m) months.push({ y: to.y, m: to.m });
  return months;
}

/**
 * The rows a filter shows.
 *
 * `month` returns everything the server sent for that month — INCLUDING rows
 * whose date could not be read. They belong to the month; only their day is
 * unknown. Today and Week can place neither, so they leave them out, and the
 * view says how many were left out rather than pretending the list is complete.
 */
export function filterEntries(entries, filter, todayCairo) {
  const rows = Array.isArray(entries) ? entries : [];
  if (filter === 'month') return rows.slice();

  const today = dayKey(todayCairo);
  const { from, to } = weekWindow(todayCairo);
  const lo = filter === 'today' ? today : dayKey(from);
  const hi = filter === 'today' ? today : dayKey(to);

  return rows.filter((e) => {
    const k = dayKey(parseSheetDate(e && e.date));
    return k !== null && k >= lo && k <= hi;
  });
}

/**
 * How many of these rows no filtered view can place.
 *
 * Counted from the ROWS ON SCREEN rather than taken from the server's per-month
 * `undated`, because a week spanning two months is a list assembled from two
 * responses and neither one's count describes it. The two agree for a whole
 * month, which is the case where either would do.
 */
export function undatedIn(entries) {
  return (Array.isArray(entries) ? entries : [])
    .filter((e) => parseSheetDate(e && e.date) === null).length;
}

/** Newest first — the order he thinks in when he goes looking for something. */
export function sortForDisplay(entries) {
  const rows = (Array.isArray(entries) ? entries : []).slice();
  return rows.sort((a, b) => {
    const ka = dayKey(parseSheetDate(a && a.date));
    const kb = dayKey(parseSheetDate(b && b.date));
    // Undated rows sink to the bottom rather than sorting as ancient history —
    // they have no day, and guessing one would be the same lie as rendering 0
    // for a missing amount.
    if (ka === null && kb === null) return 0;
    if (ka === null) return 1;
    if (kb === null) return -1;
    return kb - ka;
  });
}
