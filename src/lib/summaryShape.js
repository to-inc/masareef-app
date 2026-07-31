/**
 * Is this actually a `summary` payload?
 *
 * `{ok:true}` alone is NOT enough. A truncated response, a deployment running an
 * older router, or any future envelope change can all produce a truthy `ok` with
 * none of the fields the views dereference — and the first `data.today_cairo.d`
 * then throws and unmounts the entire app. A white screen on Dad's phone has no
 * recovery path he could ever find.
 *
 * So the shape is checked once, here, at the boundary. Anything that fails is
 * treated exactly like a failed fetch: keep the last good snapshot, show the
 * calm banner. Used by BOTH the live fetch and the snapshot loader so the two
 * can never drift apart.
 */
const isNumArray = (a) => Array.isArray(a) && a.every((v) => v === null || typeof v === 'number');

const isSeriesPair = (p) =>
  !!p && isNumArray(p.Visa) && isNumArray(p.Cash) && p.Visa.length === p.Cash.length;

const isPeriod = (p) => !!p && isSeriesPair(p.cur) && isSeriesPair(p.prev);

export function isSummaryShape(d) {
  if (!d || d.ok !== true) return false;

  const t = d.today_cairo;
  if (!t || typeof t.y !== 'number' || typeof t.m !== 'number' || typeof t.d !== 'number') return false;

  if (!isPeriod(d.week) || !isPeriod(d.month) || !isPeriod(d.year)) return false;
  if (!d.month.names || typeof d.month.names.cur !== 'string') return false;

  if (!d.today || !Array.isArray(d.today.entries) || !d.today.totals) return false;
  if (typeof d.today.totals.Visa !== 'number' || typeof d.today.totals.Cash !== 'number') return false;

  if (!Array.isArray(d.pending) || !Array.isArray(d.monthCats)) return false;

  return true;
}

/**
 * `month.undated` arrived with the WS1 follow-ups, `month.unpriced` with the
 * travel rev. Treating either absence as a malformed payload would make a
 * slightly older deployment unusable, so both are defaulted rather than
 * required — the client must stay forward- and backward-compatible with a
 * backend Tarek redeploys by hand.
 */
export function withDefaults(d) {
  if (!d.month) return d;
  if (d.month.undated && d.month.unpriced) return d;
  return {
    ...d,
    month: {
      ...d.month,
      undated: d.month.undated || { count: 0, Visa: 0, Cash: 0 },
      unpriced: d.month.unpriced || { count: 0 },
    },
  };
}
