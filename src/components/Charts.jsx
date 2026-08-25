import { C, FONT_DISPLAY, FONT_UI, NUMERALS, PREV_SERIES_OPACITY, TAP } from '../theme.js';
import { METRICS } from '../lib/constants.js';
import { S, categoryLabel } from '../i18n/strings.js';
import { moneyRound, money } from '../lib/format.js';
import { seriesFor, sumTo, cumsum, lastIdxOf, periodTotals, hasShape } from '../lib/series.js';
import { rollup } from '../lib/priorities.js';
import { Delta, LATIN } from './Primitives.jsx';

/**
 * Every chart here is ported verbatim from prototype/baba-expense-app.jsx.
 *
 * The one systematic change: each chart is wrapped in `dir="ltr"` by its
 * container. Time runs left→right in these visuals; letting them inherit the
 * document's RTL would mirror the axes and put "today" on the left, which reads
 * as a different (and wrong) story.
 */

// Cumulative race: colored line (this period) vs grey line (last period), with a
// marker pair at "the same point in time" — an honest partial-period comparison.
export function CumulativeChart({ cur, prev, color, labelled = true }) {
  // 12px of headroom at the top so a label on a marker near the ceiling still
  // has somewhere to sit.
  const W = 320, H = 128, P = 8, TOP = 14;
  const cumC = cumsum(cur), cumP = cumsum(prev);
  const li = lastIdxOf(cumC);
  const n = Math.max(cur.length, prev.length);
  const max = Math.max(cumP[cumP.length - 1] || 0, cumC[li] || 0, 1);
  const x = (i) => P + (i / (n - 1)) * (W - 2 * P);
  const y = (v) => H - P - (v / max) * (H - P - TOP - 8);
  const path = (arr, stop) => {
    let d = '';
    for (let i = 0; i <= stop; i++) {
      if (arr[i] == null) continue;
      d += `${d ? 'L' : 'M'}${x(i).toFixed(1)},${y(arr[i]).toFixed(1)} `;
    }
    return d;
  };
  // Null here means "no data for the comparison period" (e.g. the 2025 file
  // isn't connected), NOT "they were at zero". Coalescing to 0 would park the
  // grey marker on the baseline and silently assert a comparison we don't have.
  const prevRaw = cumP[Math.min(li, cumP.length - 1)];
  const hasPrev = prevRaw != null;
  const prevAt = hasPrev ? prevRaw : 0;

  /**
   * THE TWO NUMBERS, ON THE TWO MARKERS (finding S6).
   *
   * This chart carried no figure anywhere: no axis, no value at the live marker,
   * none at the grey one. He could see a shape and had to decode it through the
   * metric cards below and then a three-line paragraph below those — which was
   * the longest block of text in the app, on the screen he opens most, and it
   * existed only to explain a grey line. A chart that needs a paragraph has not
   * landed; labelling the markers deletes the paragraph.
   *
   * `hasPrev` gates the grey label the same way it already gates the grey dot:
   * a missing comparison (the 2025 file is not connected) must not render as a
   * confident 0. Honest-render, at the chart.
   */
  const curY = y(cumC[li] || 0);
  const prevY = y(prevAt);
  // Near the right edge the labels would run off the viewBox, so they flip to
  // the other side of the marker. `li` is "today", so on the 28th of a month
  // this is the normal case, not the edge case.
  const flip = x(li) > W * 0.62;
  const labelX = flip ? x(li) - 8 : x(li) + 8;
  const anchor = flip ? 'end' : 'start';
  // Two labels within 13px of each other would overlap; push the grey one clear.
  const collide = hasPrev && Math.abs(curY - prevY) < 13;
  const prevLabelY = collide ? (prevY <= curY ? prevY - 9 : prevY + 11) : prevY - 5;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }} aria-hidden="true">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={P} x2={W - P} y1={y(max * f)} y2={y(max * f)} stroke={C.line} strokeWidth="0.6" strokeDasharray="3 4" />
      ))}
      <line x1={x(li)} x2={x(li)} y1={y(Math.max(cumC[li] || 0, prevAt))} y2={H - 2} stroke={C.muted} strokeWidth="0.8" />
      <path d={path(cumP, cumP.length - 1)} stroke={C.muted} strokeOpacity={PREV_SERIES_OPACITY} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d={path(cumC, li)} stroke={color} strokeWidth="3.2" fill="none" strokeLinecap="round" />
      {hasPrev && <circle cx={x(li)} cy={prevY} r="4" fill={C.muted} fillOpacity={PREV_SERIES_OPACITY} />}
      <circle cx={x(li)} cy={curY} r="5.5" fill={C.shell} stroke={color} strokeWidth="3" />

      {/* The grey one first, so the coloured one wins any remaining overlap. */}
      {labelled && hasPrev && (
        <text
          x={labelX} y={prevLabelY} textAnchor={anchor}
          fontSize="10" fontWeight="600" fill={C.muted}
          // A shell-coloured outline UNDER the glyphs, so a label crossing a
          // grid line or the grey curve is still readable. `paintOrder` is what
          // makes the stroke sit behind the fill rather than fattening it.
          stroke={C.shell} strokeWidth="3" paintOrder="stroke"
          style={{ fontFamily: FONT_UI }}
        >
          {moneyRound(prevAt)}
        </text>
      )}
      {labelled && (
        <text
          x={labelX} y={curY - 9} textAnchor={anchor}
          fontSize="12" fontWeight="700" fill={color}
          stroke={C.shell} strokeWidth="3" paintOrder="stroke"
          style={{ fontFamily: FONT_DISPLAY, ...NUMERALS }}
        >
          {moneyRound(cumC[li] || 0)}
        </text>
      )}
    </svg>
  );
}

export function PairedBars({ cur, prev, labels, liveIndex, color }) {
  const vals = cur.map((v) => v || 0);
  const max = Math.max(...vals, ...prev.map((v) => v || 0), 1);
  // Average over slots that EXIST — averaging across null future days would
  // drag the line down every morning and quietly flatter him.
  const counted = cur.filter((v) => v != null);
  const avg = counted.length ? sumTo(counted) / counted.length : 0;
  return (
    <div style={{ position: 'relative', marginTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: labels.length > 8 ? 3 : 6, height: 110, position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${(avg / max) * 100}%`, borderTop: `1.5px solid ${color}`, opacity: 0.55, zIndex: 1 }} />
        <span
          style={{
            position: 'absolute', right: 0, bottom: `calc(${(avg / max) * 100}% + 2px)`,
            fontSize: 10, fontWeight: 800, color, background: C.card, padding: '0 3px', zIndex: 2,
          }}
        >
          {S.avg} <span style={LATIN}>{moneyRound(avg)}</span>
        </span>
        {labels.map((lb, i) => {
          const isLive = i === liveIndex;
          return (
            <div key={lb + i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: '100%', width: '100%', justifyContent: 'center' }}>
                <div style={{ width: '38%', height: `${((prev[i] || 0) / max) * 100}%`, background: C.line, borderRadius: '4px 4px 0 0', minHeight: prev[i] ? 2 : 0 }} />
                <div style={{ width: '38%', height: `${((cur[i] || 0) / max) * 100}%`, background: isLive ? C.harbor : color, borderRadius: '4px 4px 0 0', minHeight: cur[i] ? 2 : 0 }} />
              </div>
              <div style={{ fontSize: labels.length > 8 ? 9.5 : 11, marginTop: 5, fontWeight: isLive ? 800 : 500, color: isLive ? C.harbor : C.muted }}>
                {isLive ? '•' : lb}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Tappable metric cards — tap to recolor every chart to that metric.
/**
 * `comparable: false` suppresses every Delta on this row.
 *
 * Found by the «This week 0» render assertion: gating the HEADLINE sentence left
 * the metric cards still printing «▼100%» against a period whose EGP figure is a
 * subset. Same rule, second render path — and the cards are the smaller type, so
 * it would have survived a visual check.
 */
export function MetricCards({ metric, setMetric, computed, comparable = true }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
      {METRICS.map((m) => {
        const active = metric === m.key;
        const { now, prevAt } = computed[m.key];
        return (
          <button
            key={m.key}
            className="catchip"
            onClick={() => setMetric(m.key)}
            aria-pressed={active}
            style={{
              flex: 1, textAlign: 'start', minHeight: 72,
              /**
               * THE ACTIVE FILL IS ALWAYS `harbor`, not the metric's own colour.
               *
               * Measured: white on the Cash metric (`muted`) is 3.51:1, and the
               * label below is 11.5px — normal text, which wants 4.5:1. Filling
               * the card with each metric's colour would therefore ship a label
               * that cannot be read on one of the three cards.
               *
               * The recolouring the design is actually about still happens: the
               * chart stroke and the legend dot take `m.color`, and those are
               * graphics at a 3:1 floor, which all three clear. If the Owner
               * accepts `muted → #5C6871` (it fixes three other flags too), the
               * per-metric fill can come straight back — one token, one line.
               */
              background: active ? C.harbor : C.card,
              border: `1px solid ${active ? C.harbor : C.line}`,
              borderRadius: 16, padding: '10px 11px', minWidth: 0,
            }}
          >
            <div style={{ fontSize: 11.5, fontWeight: 700, color: active ? C.onDark : C.muted, letterSpacing: '.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: active ? C.onDark : m.color, marginInlineEnd: 5 }} />
              {S[m.labelKey]}
            </div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 19, fontWeight: 650, color: active ? C.onDark : C.ink, marginTop: 2, ...LATIN, ...NUMERALS }}>
              {moneyRound(now)}
            </div>
            <div style={{ fontSize: 12, color: active ? C.onDark : C.muted }}>
              {/* No comparison data ≠ a comparison of zero */}
              <span style={LATIN}>{prevAt == null ? '—' : moneyRound(prevAt)}</span>
              {comparable && <Delta now={now} prev={prevAt} />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/**
 * WHERE THE MONTH WENT — every category, the ❓ money, and the total (D16d).
 *
 * FIELD FINDING: he reconciled this screen against its own total and found
 * 18,703 EGP he could not see — a top-5 cutoff plus one ❓ row of 15,000. The
 * list is now complete and it ADDS UP, in terms he can read.
 *
 * THE ARITHMETIC, and why «من غير تاريخ» is not a third term:
 *
 *     every category  +  uncategorized  =  the month
 *
 * exactly, because the server derives both sides from the same rows under the
 * same filter. An UNDATED row is not a fourth bucket — it is a flag on a row
 * that already sits in one of these two (a dated-unreadable Gifts row is in
 * Gifts), so adding it again would overstate his month by exactly that amount.
 * It is named under the chart instead, where the gap it describes is real: the
 * curve cannot plot it. Measured on the July fixture: 715.96 + 1130.50 = 1846.46
 * = the month; adding the 100 EGP undated row gives 1946.46, which is not.
 *
 * The ❓ line is a LABELLED STATE, never a category row — which is what keeps it
 * inside D5 rather than against it: he is shown a gap he can tap, not a category
 * he never chose.
 */
export function CategoryCompare({ cats, curName, prevName, uncategorized, total, onUncategorized }) {
  const max = Math.max(...cats.map((c) => Math.max(c.now, c.prev)), 1);
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 14, marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 14, fontSize: 12.5, color: C.muted, marginBottom: 12 }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: C.harbor, marginInlineEnd: 5, verticalAlign: '-1px' }} />{curName}</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: C.line, marginInlineEnd: 5, verticalAlign: '-1px' }} />{prevName}</span>
      </div>
      {cats.map((c) => (
        <div key={c.name} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 4 }}>
            {/* Category name is frozen-schema Latin — isolated so RTL cannot reorder it */}
            <span style={{ fontWeight: 600 }} dir="auto">{categoryLabel(c.name)}</span>
            <span style={{ fontWeight: 700, fontFamily: FONT_DISPLAY }}>
              <span style={LATIN}>{money(c.now)}</span>
              <Delta now={c.now} prev={c.prev} />
            </span>
          </div>
          <div style={{ height: 9, background: C.shell, borderRadius: 999, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', insetInlineStart: 0, top: 0, bottom: 0, width: `${(c.prev / max) * 100}%`, background: C.line, borderRadius: 999 }} />
            <div style={{ position: 'absolute', insetInlineStart: 0, top: 0, bottom: 0, width: `${(c.now / max) * 100}%`, background: C.harbor, borderRadius: 999 }} />
          </div>
        </div>
      ))}

      {/**
        * The ❓ money, labelled — never a category row. Rendered ONLY when there
        * is some: a month with nothing uncategorised says nothing about
        * uncategorised money, and «0 غير مصنّف» would be a line of noise he has
        * to read past on a clean month.
        */}
      {uncategorized && uncategorized.total > 0 && (
        <button
          onClick={onUncategorized}
          style={{
            width: '100%', minHeight: TAP, marginBottom: 12, borderRadius: 12,
            padding: '10px 12px', textAlign: 'start',
            background: C.conflictBg, border: `1px solid ${C.conflictLine}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, gap: 8 }}>
            <span style={{ fontWeight: 700, color: C.conflictInk }}>{S.uncategorizedLine}</span>
            <span style={{ fontWeight: 700, color: C.conflictInk, ...LATIN, ...NUMERALS }}>
              {moneyRound(uncategorized.total)}
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: C.ink, marginTop: 2 }}>{S.uncategorizedHint}</div>
        </button>
      )}

      {/**
        * The figure the list adds up to — the SAME number the card above shows.
        *
        * A null `total` is the CALLER saying its payload cannot back that claim
        * (a V17 backend sends a top-5 list and no `uncategorized` figure, so the
        * rows on screen do not account for the month). The decision is made
        * where the payload is known — see the gate in views/BookView.jsx —
        * and this component simply prints a total when it is handed one. It must
        * NOT start second-guessing that from `uncategorized`, which carries a
        * different question.
        */}
      {total != null && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', gap: 8,
          borderTop: `1px solid ${C.line}`, paddingTop: 10, marginTop: 2, fontSize: 15,
        }}>
          <span style={{ fontWeight: 700, color: C.ink }}>{S.monthTotalLine}</span>
          <span style={{ fontWeight: 700, color: C.ink, fontFamily: FONT_DISPLAY, ...LATIN, ...NUMERALS }}>
            {moneyRound(total)}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * THE PRIORITIES LENS — four groups, a remainder, and nothing else (D-lens,
 * ratified by Tarek 2026-08-24; mapping and laws in `lib/priorities.js`).
 *
 * ——— WHAT IS DELIBERATELY ABSENT, and each absence is the ruling.
 *
 * No bars, no deltas, no percentages, no sort. `CategoryCompare` directly below
 * carries all of that and is right to: it answers «how does this month compare».
 * This answers «where did the month go», and the moment it grows a comparison it
 * has started telling him what to think about his own priorities. Sorting the
 * groups by size would do it silently — see the note on fixed order in
 * `lib/priorities.js`.
 *
 * ——— IT IS CLOSED UNTIL HE OPENS IT.
 *
 * Per-install, defaulting shut (`state/lens.js`), so Dad's Month screen gains
 * one quiet line and no numbers he did not ask for. The header is the toggle;
 * the state persists, so he opens it once.
 */
export function PriorityLens({ cats, uncategorized, open, onToggle }) {
  const folded = rollup(cats, uncategorized);
  /**
   * A payload that cannot back the arithmetic renders NOTHING — not four
   * confident groups with his ❓ money silently outside all of them. The gate
   * lives in `rollup` and this is the render half of it (fail CLOSED, §6.0:
   * this protects the truth of a figure, not a capture).
   */
  if (!folded) return null;

  const row = (label, amount, strong) => (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 10,
      fontSize: 15, padding: '9px 0',
    }}>
      <span style={{ fontWeight: strong ? 700 : 600, color: C.ink }}>{label}</span>
      <span style={{
        fontWeight: 700, color: C.ink, fontFamily: FONT_DISPLAY, ...LATIN, ...NUMERALS,
      }}>{moneyRound(amount)}</span>
    </div>
  );

  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: '4px 14px 10px', marginTop: 12 }}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: '100%', minHeight: TAP, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 8, background: 'transparent',
          padding: '0', textAlign: 'start',
        }}
      >
        <span style={{ fontSize: 14.5, fontWeight: 700, color: C.ink }}>{S.lensTitle}</span>
        <span style={{ fontSize: 13, color: C.muted }}>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 2, paddingTop: 4 }}>
          {/**
            * ALL FOUR, ALWAYS — a group with no spend this month is a true zero
            * and the fixed frame is the point of a lens. Hiding it would make
            * the shape of his month change with its contents, which is the one
            * thing a frame may not do.
            */}
          {folded.groups.map((g) => (
            <div key={g.key}>{row(S.lensGroup(g.key), g.total)}</div>
          ))}

          {/**
            * THE REMAINDER, AND IT NAMES ITSELF.
            *
            * Law 1: the rollup accounts for the month's whole figure or it is
            * «This week 0» in a nicer shirt. The names matter as much as the
            * number — a bare figure would hide WHICH of his categories the map
            * has not placed, and those names are how he re-draws it.
            *
            * ⚠️ THIS GATE READ `> 0` AND THAT HID TWO REAL STATES.
            *
            *  · A NEGATIVE remainder. Refunds and reversals are an ordinary
            *    server state, so an unmapped category can legitimately come back
            *    below zero — and the whole block disappeared while
            *    `folded.total` went on subtracting it. Four figures summing to
            *    8,500 above a bold «إجمالي الشهر» reading 7,300, with the 1,200
            *    and its category name on no line of the panel. That is the
            *    reconciliation failure this lens exists to prevent, produced by
            *    the lens.
            *  · A remainder that nets to exactly zero while ❓ money is in it
            *    (+500 uncategorised against a −500 unmapped row). docs/05 is
            *    explicit: it «must STILL render whenever the uncategorized total
            *    is nonzero — an empty remainder is a claim, not a decoration».
            *
            * So it renders whenever it is CARRYING anything: a figure of either
            * sign, a name, or ❓ money. Only a genuinely empty remainder — the
            * ordinary state once the map places everything — stays off, on the
            * same reasoning that keeps «0 غير مصنّف» off a clean month.
            */}
          {(folded.remainder.total !== 0
            || folded.remainder.names.length > 0
            || folded.remainder.uncategorized !== 0) && (
            <>
              <div style={{ borderTop: `1px solid ${C.line}` }}>
                {row(S.lensRemainder, folded.remainder.total)}
              </div>
              {folded.remainder.names.length > 0 && (
                <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.7, paddingBottom: 6 }} dir="auto">
                  {folded.remainder.names.map((n) => categoryLabel(n)).join(' · ')}
                </div>
              )}
            </>
          )}

          {/**
            * THE FIGURE THE FOUR GROUPS ADD UP TO — the same number the card
            * above shows and the same one `CategoryCompare` prints. Stated so he
            * can reconcile the lens against something, which is the whole
            * difference between a rollup and a decoration.
            */}
          <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 2 }}>
            {row(S.monthTotalLine, folded.total, true)}
          </div>
        </div>
      )}
    </div>
  );
}

export function PeriodSummary({ data, labels, liveIndex, metric, setMetric, periodNames, showBars, footnote, offPlot = {}, comparable = true }) {
  const color = METRICS.find((m) => m.key === metric).color;
  const cur = seriesFor(data.cur, metric);
  const prev = seriesFor(data.prev, metric);

  /**
   * THE FIGURE IS THE WHOLE PERIOD, not the part that fits on the chart (D16d).
   *
   * `offPlot` carries money that belongs to the period and to no plottable slot
   * — for a month, the rows whose date cell cannot be read. The curve legitimately
   * omits them (a shape cannot chart a day nobody knows) but the TOTAL must not:
   * a card that quietly sums only the chart understates exactly the months that
   * are hardest to read, which is the honest-incompleteness law arriving from the
   * other side. He reconciled his own screen and found 18,703 missing; this is
   * the last place that arithmetic could still disagree with itself.
   *
   * Weeks and years pass nothing: a week window cannot contain an undated row,
   * and the year series is built from month totals that already include them.
   */
  // ONE computation, in lib/series.js — the Book's header leads with the same
  // figures these cards show, and two derivations of one number is how this
  // project has produced three of its bugs.
  const computed = periodTotals(data, METRICS, offPlot);

  // No comparison data at all — e.g. the previous-year spreadsheet isn't
  // connected. Say so plainly rather than describing a chart that isn't there.
  const hasPrevData = prev.some((v) => v != null);
  /**
   * A PERIOD WITH ONE POINT GETS NO CHART (finding M7). On the first day of a
   * week the line is a dot at the origin, the bars are all last week's grey, and
   * every metric card reads ▼100% — all true, and the screen reads as broken.
   * The figures stay; only the shape is withheld, and it says why.
   */
  const plottable = hasShape(cur);

  return (
    <div>
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: '14px 12px 10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 4px 8px', gap: 8 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color }}>
            {periodNames.cur} <span style={{ color: C.muted, fontWeight: 500 }}>{S.vs} {periodNames.prev}</span>
          </span>
          <span style={{ fontSize: 11, color: C.muted, whiteSpace: 'nowrap' }}>{S.cumulativeNote}</span>
        </div>
        {/* Time axes stay left→right regardless of the RTL document */}
        {!plottable ? (
          <p style={{ fontSize: 13.5, color: C.muted, textAlign: 'center', lineHeight: 1.7, margin: '18px 8px 10px' }}>
            {S.periodJustStarted(periodNames.cur)}
          </p>
        ) : (
        <div dir="ltr">
          {/**
            * THE MARKER IS LABELLED ONLY WHEN THE CURVE IS THE WHOLE PERIOD.
            *
            * `offPlot` is money that belongs to the period and to no plottable
            * slot — for a month, the rows whose date cell cannot be read. When
            * there is any, the curve's endpoint is knowably SHORT of the period,
            * and the card above it already shows the true total. Printing the
            * endpoint next to it would put two different figures for "the month"
            * on one screen and let him read the smaller one as his spending.
            *
            * Caught by scripts/test-accountability.mjs, which has asserted since
            * D16d that `375` — the daily-series sum of its fixture — must never
            * appear where `425` is the month. Labelling the marker made it
            * appear, in a place nobody had thought to look. The footnote under
            * the card still names the gap; this simply stops the chart from
            * quietly disagreeing with the number beside it.
            */}
          <CumulativeChart
            cur={cur} prev={prev} color={color}
            labelled={!((offPlot.Visa || 0) + (offPlot.Cash || 0))}
          />
          {showBars && <PairedBars cur={cur} prev={prev} labels={labels} liveIndex={liveIndex} color={color} />}
        </div>
        )}
      </div>
      <MetricCards metric={metric} setMetric={setMetric} computed={computed} comparable={comparable} />
      {footnote}
      {/**
        * THE THREE-LINE EXPLAINER IS GONE (finding S6).
        *
        * It read: "the grey is July, and the grey dot is where it stood at the
        * same point — a fair comparison even halfway through the month. Tap any
        * card to recolour the chart." Three lines of instruction, on the screen
        * he opens most often, and the longest block of text in the app. It was
        * there because the chart carried no numbers; both markers are labelled
        * now, so the sentence describing them has nothing left to add.
        *
        * WHAT SURVIVES is the case where there is nothing to compare against —
        * that is not an explanation, it is a fact about the data, and the
        * honest-render law requires saying it rather than drawing a chart that
        * looks like a comparison and isn't.
        */}
      {!hasPrevData && (
        <p style={{ fontSize: 12.5, color: C.muted, textAlign: 'center', lineHeight: 1.6, margin: '10px 0 0' }}>
          {S.noComparison(periodNames.prev)}
        </p>
      )}
    </div>
  );
}
