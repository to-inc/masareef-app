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
