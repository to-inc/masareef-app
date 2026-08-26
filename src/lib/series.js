/**
 * Chart series maths, verbatim from the prototype — these five functions ARE the
 * null-padding contract in code form, so read §2.2 before touching any of them.
 *
 *  comb      — combines Visa+Cash; null ONLY where both are null, which is why
 *              the server must pad both arrays in identical positions.
 *  cumsum    — stops accumulating at a null and emits null, breaking the line at
 *              "now" instead of dragging it flat across the rest of the period.
 *  lastIdxOf — the last non-null index, i.e. today. This is what anchors the
 *              "same point in time" marker that makes a mid-period comparison
 *              honest rather than flattering.
 */
export const comb = (a, b) =>
  a.map((v, i) => (v == null && b[i] == null ? null : (v || 0) + (b[i] || 0)));

export const seriesFor = (d, m) => (m === 'all' ? comb(d.Visa, d.Cash) : d[m]);

export const sumTo = (arr) => arr.reduce((s, v) => s + (v || 0), 0);

export function cumsum(arr) {
  const out = [];
  let s = 0;
  for (const v of arr) {
    if (v == null) { out.push(null); continue; }
    s += v;
    out.push(s);
  }
  return out;
}

export const lastIdxOf = (arr) => arr.reduce((a, v, i) => (v != null ? i : a), 0);

/**
 * THE PERIOD'S FIGURES — one per metric, each with its same-point comparison.
 *
 * ——— WHY THIS LEFT THE CHART COMPONENT.
 *
 * It lived inside `PeriodSummary`, which was fine while the only thing that
 * needed it was the row of metric cards inside `PeriodSummary`. The Book leads
 * with the figure now (finding M5: the answer, then one sentence, then the
 * evidence) — so the header and the cards both need it, and the moment there
 * are two callers there must not be two computations. This project has been
 * bitten by exactly that shape three times: `entryReady` stated twice,
 * `cardKey` nearly defined twice, the month total derived twice.
 *
 * `offPlot` is money that belongs to the period and to no plottable slot — for
 * a month, the rows whose date cell cannot be read. It is added to `now` and
 * NOT to the series, which is the whole D16d correction: the curve legitimately
 * omits them, the total may not.
 *
 * `prevAt` is `null`, never 0, when there is no comparison to make. Coalescing
 * would tell him he spent nothing last year when the truth is that the 2025 file
 * is not connected.
 */
export function periodTotals(data, metrics, offPlot = {}) {
  const out = {};
  for (const m of metrics) {
    const c = seriesFor(data.cur, m.key);
    const p = seriesFor(data.prev, m.key);
    const at = cumsum(p)[Math.min(lastIdxOf(c), p.length - 1)];
    const extra = m.key === 'all'
      ? (offPlot.Visa || 0) + (offPlot.Cash || 0)
      : (offPlot[m.key] || 0);
    out[m.key] = { now: sumTo(c) + extra, prevAt: at == null ? null : at };
  }
  return out;
}

/**
 * The one-sentence comparison the Book leads with — as a SHAPE, so the wording
 * stays in i18n and the arithmetic stays here.
 *
 * `null` means there is nothing honest to say: no comparison figure, or a
 * previous period of zero (against which every change is "infinitely more").
 * The caller renders nothing rather than inventing a percentage.
 */
/**
 * HAS THIS PERIOD ENOUGH POINTS TO BE A SHAPE? (finding M7)
 *
 * ——— WHAT IT LOOKS LIKE WHEN IT DOES NOT, observed in the running app.
 *
 * On the first day of a week the current series holds ONE slot. The cumulative
 * line has nowhere to go, so it renders as a dot at the origin; the paired bars
 * are all previous-week grey; and all three metric cards read `▼ 100%`, because
 * every metric genuinely is down from a full week to one morning. Every figure
 * on that screen is true, and the screen reads as broken — which is its own kind
 * of dishonesty, since he will either distrust the app or believe something
 * alarming about his spending.
 *
 * TWO POINTS is the threshold because two is where a line starts being a line.
 * One is a dot; zero is nothing. The figure and the comparison are still shown —
 * they are facts — and only the CHART is withheld, with a sentence saying why.
 *
 * Counts SLOTS THAT EXIST, not spending: a Monday he spent nothing on is a real
 * data point (a genuine zero), and treating it as absent would hide the chart
 * from a week that has perfectly good shape.
 */
export function hasShape(series) {
  return (Array.isArray(series) ? series : []).filter((v) => v != null).length >= 2;
}

export function comparisonOf(now, prevAt) {
  if (prevAt == null || !isFinite(prevAt) || prevAt <= 0) return null;
  const pct = Math.round(((now - prevAt) / prevAt) * 100);
  if (!isFinite(pct)) return null;
  return { pct: Math.abs(pct), direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'same', prevAt };
}

/**
 * THE TYPICAL BAND'S FLOOR — how many CLOSED months of real history must exist
 * before a P25–P75 band may derive at all (chunk E6; north-star §5: «only
 * where derivable from real history, never invented»).
 *
 * Four is proposed, not eternal: it is the Owner-facing default flagged for
 * Tarek's veto in the E6 report. It lives here as ONE named export so that a
 * veto is a one-line edit, and so the render half can say «why there is no
 * band yet» from the same number the maths used. Below four, quartiles of the
 * closed months still COMPUTE — that is exactly the trap — but two or three
 * months wearing quartile clothes is a costume, not a distribution, and the
 * band's whole claim is «your typical month», which no pair of months can make.
 */
export const TYPICAL_BAND_MIN_MONTHS = 4;

/**
 * THE TYPICAL BAND — P25–P75 of the year's CLOSED months, or null.
 *
 * ——— THE ONE SIGNATURE, pinned (test-chunk-e6 E6.4 — do not add a second):
 * `monthTotals` arrives ALREADY SUMMED by the caller — one number-or-null per
 * calendar month, produced with `comb(year.cur.Visa, year.cur.Cash)` above.
 * `comb` is the null-padding contract in code form (null only where BOTH
 * halves are null), so summing does not live twice and a month with a tab but
 * no spend stays a genuine 0 while a month with no tab stays null.
 * `currentMonthIndex1based` is the calendar position of the month now in
 * flight (August = 8). For a browsed FULLY-CLOSED year pass 13: every slot is
 * history there and all twelve may count.
 *
 * ——— REAL HISTORY ONLY (E6 FEASIBILITY; the law this function IS):
 * a month is CLOSED iff its 0-based index < currentMonthIndex1based − 1 AND
 * its entry is a finite number. So:
 *   · the current month never counts, even when it already holds a value —
 *     a mid-flight partial total inside a «typical month» band would drag the
 *     band toward whatever today happens to be;
 *   · anything at or past the current index never counts (a stale slot after
 *     «now» is not history, whatever it claims to hold);
 *   · null is a MISSING TAB and is skipped, never zero-coerced — coercion
 *     would tell him he typically spends less because January has no tab;
 *   · NaN and other non-finite garbage are skipped the same way, so the
 *     quartiles can never be poisoned into NaN.
 *
 * Fewer than TYPICAL_BAND_MIN_MONTHS closed months → null, and the caller
 * renders NOTHING (honest absence, the app-wide law) — never a band from one
 * month wearing quartile clothes.
 *
 * P25/P75 by LINEAR INTERPOLATION on the sorted closed totals: h = (n−1)·q,
 * value = a[⌊h⌋] + (h−⌊h⌋)·(a[⌊h⌋+1] − a[⌊h⌋]) — the R-type-7 / numpy default
 * method, chosen because «P25» alone names at least nine different numbers
 * and this one is continuous in the data. Pinned by exact fixture in the
 * oracle so no library swap can silently move the band.
 *
 * Returns `{ p25, p75, n }` — `n` is the honest population: exactly the
 * closed months the quartiles used, which the render half must surface when
 * it explains the band. `p25 ≤ p75` always (both read off one sorted array).
 * NEVER a target: this is where he has BEEN, not where he should be — the
 * render half owes the mist fill and owes never drawing it as a line to beat.
 */
export function typicalBand(monthTotals, currentMonthIndex1based) {
  if (!Array.isArray(monthTotals)) return null;
  const cutoff = currentMonthIndex1based - 1; // 0-based index of the month in flight
  if (!Number.isFinite(cutoff)) return null;  // unknowable "now" → nothing is provably closed
  const closed = [];
  for (let i = 0; i < monthTotals.length && i < cutoff; i++) {
    const v = monthTotals[i];
    if (typeof v === 'number' && Number.isFinite(v)) closed.push(v);
  }
  if (closed.length < TYPICAL_BAND_MIN_MONTHS) return null;
  closed.sort((a, b) => a - b);
  const q = (p) => {
    const h = (closed.length - 1) * p;
    const lo = Math.floor(h);
    // hi clamps so an integer h never reads past the end and multiplies a 0
    // fraction into `undefined` — the one path that could have minted a NaN.
    const hi = Math.min(lo + 1, closed.length - 1);
    return closed[lo] + (h - lo) * (closed[hi] - closed[lo]);
  };
  return { p25: q(0.25), p75: q(0.75), n: closed.length };
}
