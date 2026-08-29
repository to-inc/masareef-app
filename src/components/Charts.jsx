import { useEffect, useState, useSyncExternalStore } from 'react';
import { C, FONT_DISPLAY, FONT_UI, MOTION, NUMERALS, PREV_SERIES_OPACITY, RADIUS, TAP, TYPE, unitSize } from '../theme.js';
import { METRICS } from '../lib/constants.js';
import { S, categoryLabel, monthByTab, unitFor } from '../i18n/strings.js';
import { moneyRound, money } from '../lib/format.js';
import { seriesFor, sumTo, cumsum, lastIdxOf, periodTotals, hasShape } from '../lib/series.js';
import { rollup, groupOf } from '../lib/priorities.js';
import { HOME_CURRENCY } from '../state/display.js';
import { LATIN, SectionLabel, NeutralDelta } from './Primitives.jsx';

/**
 * Every chart here is ported verbatim from prototype/baba-expense-app.jsx.
 *
 * The one systematic change: each chart is wrapped in `dir="ltr"` by its
 * container. Time runs left→right in these visuals; letting them inherit the
 * document's RTL would mirror the axes and put "today" on the left, which reads
 * as a different (and wrong) story.
 */

/**
 * ═══ NEUTRAL DELTAS DOCTRINE (A5 — data-F8) ═══ now lives on the primitive
 * itself: `NeutralDelta` in Primitives.jsx, folded there once both halves of
 * the chunk landed. The doctrine text rides the definition; the ❓-money
 * button below keeps `conflictInk` as the positive control — unplaced money
 * IS a conflict, whichever way it moved.
 */

/**
 * ═══ B3 — THE LINE DRAWS ITSELF, ONCE PER MOUNT (nav-F6; North Star §3) ═══
 *
 * The cumulative line strokes itself in over MOTION.draw when the chart
 * mounts — the one piece of theatre the Owner's walkthrough opened with
 * («the animation came up right away») — and never again until the next
 * mount. theme.js already states the law this leans on: «`draw` is the chart
 * drawing itself ONCE per mount — a redraw on data refresh is theatre, and
 * theatre is banned.»
 *
 * HOW «ONCE PER MOUNT» IS ENFORCED RATHER THAN INTENDED. A CSS animation
 * restarts only when its element is recreated or its animation-name changes.
 * Both are pinned constant: the class below is a string literal and the path
 * carries no `key`, so a data poke reconciles into the SAME element with a
 * new `d` and the running (or long-finished) animation never notices. Mount
 * identity, never data identity — putting a data-derived `key` on the live
 * path is the exact defect the B3 oracle exists to catch.
 *
 * WHY THE HIDDEN STATE LIVES ONLY INSIDE @keyframes. The path's own markup
 * carries no dash properties, so every render that does not run the
 * animation — SSR, the suites' static markup, a phone with reduced motion —
 * is already the COMPLETE line. Reduced motion does not «skip to the end»;
 * it never leaves it: `animation: none`, and the natural state is the drawn
 * line. Motion collapses to an instant state change; content is never
 * hidden behind it (the MOTION LAW's floor), and honest rendering never
 * waits on JavaScript.
 *
 * `pathLength={1}` normalises the geometry so `stroke-dasharray/dashoffset:
 * 1 → 0` is correct for every data shape with nothing measured at runtime.
 * Only the live line draws: the grey series is the backdrop the line draws
 * AGAINST — animating the backdrop would make the comparison itself the
 * theatre. And the animation lives in a <style> block rather than an inline
 * style because inline is the one place the media guard could not reach it.
 */
const DRAW_CSS = `
@keyframes chart-draw {
  from { stroke-dasharray: 1; stroke-dashoffset: 1; }
  to { stroke-dasharray: 1; stroke-dashoffset: 0; }
}
.chart-draw { animation: chart-draw ${MOTION.draw}ms ${MOTION.easeOut}; }
@media (prefers-reduced-motion: reduce) {
  .chart-draw { animation: none; }
}
`;

/**
 * ═══ E1 — THE YEAR'S MONTH LABELS ARE RANGE CONTROLS (data-F5; NS §4.4) ═══
 *
 * The tap arithmetic, as ONE pure exported value so the oracle asserts the
 * rule itself rather than a closure's shadow: a first tap starts a one-month
 * range; a tap outside the selection EXTENDS toward it, in either direction;
 * a tap INSIDE the selection clears back to the full year — that is the
 * chunk's «second tap pattern», and the one-month case (tap the only selected
 * month again) is the same clause, not a special one.
 *
 * The state that consumes this lives in PeriodSummary — LOCAL to the chart
 * components, per the chunk's own boundary. B2's period key remounts the
 * subtree on a period swap, so a selection can never outlive the year screen
 * it was made on.
 */
export const nextRange = (range, i) => {
  if (!range) return { a: i, b: i };
  if (i >= range.a && i <= range.b) return null;
  return { a: Math.min(range.a, i), b: Math.max(range.b, i) };
};

/**
 * The selection's words come from the app's own month vocabulary: slot i of
 * the year axis IS calendar month i+1, and `monthByTab` already localizes the
 * sheet's tab names in both locales — so «مارس–يونيو» / «March–June» costs no
 * new i18n key. This list is the server's tab vocabulary (docs/02), the same
 * constant BookView keeps for the month strip; it is data, not prose.
 */
const MONTH_TABS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthWord = (i) => monthByTab(MONTH_TABS[i]);

/**
 * ONE HUE, TWO VALUES (Gentler's rust trick, played in harbor). While a range
 * is selected every current-series bar is `C.harbor`; the unselected months
 * are the SAME harbor at this opacity — never a second colour, never a grey
 * that reads as disabled, and never conflict red, which means conflict and
 * nothing else. The value is named so the dimmed state is one fact, not a
 * per-site opinion.
 */
const HARBOR_DIMMED = 0.35;

// Cumulative race: colored line (this period) vs grey line (last period), with a
// marker pair at "the same point in time" — an honest partial-period comparison.
// `peekOpen` seeds the tap-label's state so a static renderer can reach the
// open render — SSR cannot tap, and the suites assert both states (A6).
export function CumulativeChart({ cur, prev, color, labelled = true, prevName = '', peekOpen = false, columns = 0, band = null }) {
  // 12px of headroom at the top so a label on a marker near the ceiling still
  // has somewhere to sit.
  const W = 320, H = 128, P = 8, TOP = 14;
  const cumC = cumsum(cur), cumP = cumsum(prev);
  const li = lastIdxOf(cumC);
  const n = Math.max(cur.length, prev.length);
  /**
   * ═══ E6 RENDER — THE TYPICAL BAND, RE-CHECKED AT THE DOOR (NS §5) ═══
   *
   * `band` is `typicalBand(...)`'s result or null, and the render half
   * re-verifies the shape rather than trusting the caller: a poisoned number
   * paints nothing, and a DEGENERATE band (p25 = p75) paints nothing either —
   * a zero-height region could only be drawn as a line, and the one thing the
   * band may never be is a line to beat. Null renders as honest absence.
   */
  const hasBand = !!band && Number.isFinite(band.p25) && Number.isFinite(band.p75)
    && band.p75 > band.p25;
  // The scale admits the band: typical months can sit above everything this
  // month has done yet, and a band clipped off the ceiling would silently
  // understate where his months usually land. Data alone when there is none.
  const max = Math.max(cumP[cumP.length - 1] || 0, cumC[li] || 0, hasBand ? band.p75 : 0, 1);
  /**
   * ═══ E5 — THE SHARED AXIS, AS GEOMETRY (data-F4) ═══
   *
   * `columns > 0` means this line is the TOP PANEL of the Month stack and
   * point i must sit on bar column i's CENTER, or «one shared axis» is a
   * caption rather than a fact. The bars are flex columns with fixed pixel
   * gaps, so their center fractions depend (weakly) on the rendered width;
   * they are computed here at the NOMINAL inner width of the 375px screen —
   * 311px, the same figure A12's collision proof is cut at — and scaled into
   * the viewBox. Across this app's real range (320–430pt) the drift is under
   * a third of a pixel, measured, which is inside the stroke itself.
   *
   * `0` keeps the classic edge-to-edge spread every standalone chart uses.
   */
  const x = columns > 0
    ? (i) => {
      const NW = 311, g = columns > 8 ? 3 : 6;
      const cw = (NW - (columns - 1) * g) / columns;
      return ((i * (cw + g) + cw / 2) / NW) * W;
    }
    : (i) => P + (i / (n - 1)) * (W - 2 * P);
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

  /**
   * ⚠️ THE MARKER EXPLAINS ITSELF ON TAP (A6 — North Star §5).
   *
   * This is where the deleted legend's cargo went: tapping the same-point
   * marker reveals the compared period, the day, and the compared figure —
   * on demand, dismissed by a second tap or a tap anywhere else. Closed, the
   * chart carries nothing; the calm is the point, so there is no persistent
   * chrome, no hint, no badge.
   *
   * GATED BY `labelled && hasPrev`, the same two gates the persistent labels
   * obey and for the same reasons: no comparison data means there is nothing
   * to explain (a peek would fabricate a «was 0» out of a file that is not
   * connected), and a chart forbidden from stating totals — off-plot money
   * has made its endpoint knowably short — must not whisper them on tap.
   */
  const [peek, setPeek] = useState(peekOpen);
  const canPeek = labelled && hasPrev;
  useEffect(() => {
    if (!peek) return undefined;
    // Outside-tap dismiss. The marker's own handler stops propagation, so a
    // second tap on it toggles rather than closing-then-reopening.
    const close = () => setPeek(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [peek]);
  /**
   * The senior touch floor, in viewBox units. This svg renders at
   * (card width − 56px) of its 320-unit viewBox; on the narrowest phone this
   * app meets (320pt) that is a ~0.825 scale, so TAP real pixels need
   * TAP / 0.8 units. The area is invisible — the floor is why it is not
   * simply the marker's own 11-unit dot.
   */
  const HIT = Math.ceil(TAP / 0.8);
  // Below the lower marker (the persistent labels own the space above),
  // clamped so the second line's descenders stay inside the viewBox.
  const peekTop = Math.min(Math.max(curY, prevY) + 16, H - 20);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }} aria-hidden="true">
      <style>{DRAW_CSS}</style>
      {/**
        * E6 — the typical band: P25–P75 of his own closed months, in MIST,
        * FIRST in paint order — behind the gridlines, behind both data lines.
        * A fill with no stroke, no edge, no label, no class and no animation:
        * it is ground, not figure; where he has BEEN, never a target. Static
        * by construction, so reduced motion has nothing to reduce (the MOTION
        * LAW's cheapest possible compliance: nothing moves).
        */}
      {hasBand && (
        <rect
          x={P} width={W - 2 * P}
          y={y(band.p75).toFixed(1)}
          height={(y(band.p25) - y(band.p75)).toFixed(1)}
          fill={C.mist}
        />
      )}
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={P} x2={W - P} y1={y(max * f)} y2={y(max * f)} stroke={C.line} strokeWidth="0.6" strokeDasharray="3 4" />
      ))}
      <line x1={x(li)} x2={x(li)} y1={y(Math.max(cumC[li] || 0, prevAt))} y2={H - 2} stroke={C.muted} strokeWidth="0.8" />
      <path d={path(cumP, cumP.length - 1)} stroke={C.muted} strokeOpacity={PREV_SERIES_OPACITY} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d={path(cumC, li)} stroke={color} strokeWidth="3.2" fill="none" strokeLinecap="round" pathLength={1} className="chart-draw" />
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

      {/**
        * The tap-label: what «● = same point» used to pre-answer, said only
        * when asked. Grey on purpose — it describes the grey series. The day
        * is the marker's own index in digits and the words are keys the app
        * already owns (`wasThen`, the period name from the header row): A6
        * adds no string key, because a new key here would be the legend
        * growing back under another name.
        */}
      {canPeek && peek && (
        <g>
          <text
            x={labelX} y={peekTop} textAnchor={anchor}
            fontSize="12" fontWeight="600" fill={C.muted}
            stroke={C.shell} strokeWidth="3" paintOrder="stroke"
            style={{ fontFamily: FONT_UI }}
          >
            {prevName ? `${prevName} ${li + 1}` : String(li + 1)}
          </text>
          <text
            x={labelX} y={peekTop + 13} textAnchor={anchor}
            fontSize="12" fontWeight="700" fill={C.muted}
            stroke={C.shell} strokeWidth="3" paintOrder="stroke"
            style={{ fontFamily: FONT_UI, ...NUMERALS }}
          >
            {`${S.wasThen} ${moneyRound(prevAt)}`}
          </text>
        </g>
      )}
      {/* The invisible hit area — last, so it sits above everything it targets. */}
      {canPeek && (
        <rect
          x={x(li) - HIT / 2} y={Math.min(curY, prevY) - HIT / 2}
          width={HIT} height={Math.abs(curY - prevY) + HIT}
          fill="transparent"
          style={{ cursor: 'pointer' }}
          onPointerDown={(e) => { e.stopPropagation(); setPeek((p) => !p); }}
        />
      )}
    </svg>
  );
}

/**
 * ═══ A13 — THE AXIS'S SPOKEN LAYER (charts leaf residual 8) ═══
 *
 * `ariaLabels` is the axis said in FULL WORDS, index-aligned with `labels`,
 * for the buttons' accessible names only. The visual initials are A12's
 * thinning law and never change — but as NAMES they collide: in Arabic
 * MONTH_LABELS runs ي×3, أ×3, م×2 (English J×3, A×2, M×2), so a screen
 * reader hears three indistinguishable «ي» buttons on the one axis whose
 * labels are controls (E1). Optional, with the visible label as fallback:
 * an axis handed no vocabulary keeps exactly the pre-A13 contract.
 */
export function PairedBars({ cur, prev, labels, liveIndex, color, range = null, onRangeTap = null, rangeWords = null, ariaLabels = null }) {
  const vals = cur.map((v) => v || 0);
  const max = Math.max(...vals, ...prev.map((v) => v || 0), 1);
  /**
   * ═══ E1/E2 — THE SELECTION, AS THIS COMPONENT SEES IT ═══
   *
   * `range` is PeriodSummary's {a, b} (inclusive slot indices) or null;
   * `onRangeTap` arrives ONLY for the year axis, and its presence is what
   * turns the columns into controls — a week's day names stay furniture.
   * `rangeWords` is the selection said in the month vocabulary, handed down
   * so the words beside this average and the words beside the re-scoped
   * totals are one derivation and cannot disagree (E2).
   */
  const within = (i) => !!range && i >= range.a && i <= range.b;
  /**
   * E2 — the average rule RECOMPUTES PER SELECTION, and still only over slots
   * that EXIST: a null month inside the range is a missing tab, and averaging
   * it as zero would quietly flatter exactly the ranges that are hardest to
   * read. No selection keeps the whole-period average, unchanged.
   */
  const counted = cur.filter((v, i) => v != null && (!range || within(i)));
  const avg = counted.length ? sumTo(counted) / counted.length : 0;
  /**
   * ═══ A12 — MONTH-AXIS FURNITURE: the axis speaks every 5th day ═══
   *
   * A slot-per-day axis is the only axis with more than 12 slots (weeks have
   * 7, years 12), and it cannot afford a voice per slot: thirty-one labels
   * across ~311px of card is ~10px per column against ~12px of two-digit
   * text — every label collides with both neighbours, so "all of them" reads
   * as none of them, twice over. Days divisible by 5 speak; the rest keep
   * their bars and hold their tongues. Slot i is day i+1: the by-day series
   * runs from the 1st by construction (lib/series), which is what lets the
   * rule live on the index instead of parsing locale-shaped label text.
   *
   * The live day is not furniture and is not thinned — it keeps its • marker
   * below, which outranks a day number whenever the two coincide.
   */
  const monthOfDays = labels.length > 12;
  const speaks = (i) => !monthOfDays || (i + 1) % 5 === 0;
  return (
    <div style={{ position: 'relative', marginTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: labels.length > 8 ? 3 : 6, height: 110, position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${(avg / max) * 100}%`, borderTop: `1.5px solid ${color}`, opacity: 0.55, zIndex: 1 }} />
        <span data-geometry="chart-average-label"
          style={{
            position: 'absolute', right: 0, bottom: `calc(${(avg / max) * 100}% + 2px)`,
            fontSize: 10, fontWeight: 800, color, background: C.card, padding: '0 3px', zIndex: 2,
          }}
        >
          {/**
            * E2 — under a selection the label names its scope IN WORDS, from
            * the range's own months («متوسط مارس–يونيو 45»). S.avg is the
            * existing key; the months are vocabulary, not prose — no new key.
            * With no selection the words would claim a scope that is not in
            * force, so they render only when the range does.
            */}
          {S.avg} {rangeWords ? `${rangeWords} ` : ''}<span style={LATIN}>{moneyRound(avg)}</span>
        </span>
        {labels.map((lb, i) => {
          const isLive = i === liveIndex;
          /**
           * E1 — with `onRangeTap` the whole column is the control: the label
           * is the visible affordance, but a 26px-wide glyph alone can never
           * meet the senior floor across twelve columns, so the tappable area
           * is the full column (~26×130px — more area than TAP², in the only
           * geometry a twelve-column axis affords; the floor's own dimension
           * cannot fit twelve 48pt squares in 311px). aria-pressed carries
           * the selection for hands that cannot see the fill.
           */
          const colStyle = { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' };
          const inner = (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: '100%', width: '100%', justifyContent: 'center' }}>
                {/* GEOMETRY EXEMPTION (ruling 4): bar caps on a ~4px-wide bar.
                    The radius is bounded by the bar's own width — a surface
                    token would clamp the bar into a lollipop, and the square
                    feet on the baseline are the honest shape of a sum.
                    The geometry exemption covers BOTH caps below. */}
                <div style={{ width: '38%', height: `${((prev[i] || 0) / max) * 100}%`, background: C.line, borderRadius: '4px 4px 0 0', minHeight: prev[i] ? 2 : 0 }} />
                {/**
                  * E1 — one hue, two values: while a range is selected EVERY
                  * current bar is harbor, and the unselected months are the
                  * same harbor at HARBOR_DIMMED — opacity is the second
                  * value, never a second colour. No selection keeps the
                  * metric's own colour, with the live slot's harbor accent.
                  */}
                <div style={{
                  width: '38%', height: `${((cur[i] || 0) / max) * 100}%`,
                  background: range ? C.harbor : (isLive ? C.harbor : color),
                  ...(range && !within(i) ? { opacity: HARBOR_DIMMED } : null),
                  // GEOMETRY EXEMPTION (ruling 4): this bar's caps too — the
                  // paragraph on the grey twin above covers both, restated
                  // here because the E1 note pushed it past the audit's reach.
                  borderRadius: '4px 4px 0 0', minHeight: cur[i] ? 2 : 0,
                }} />
              </div>
              {/**
                * ═══ GEOMETRY EXEMPTION (A12, extending ruling 4 to the TYPE
                * floor — cite it by this name) ═══
                *
                * Axis text is chart FURNITURE, not prose: it is measured
                * against the plot the way a bar cap is measured against its
                * bar, and theme.js already rules that an axis label is a
                * PICTURE, not type. So it is exempt from the TYPE floor by
                * the same named exemption — nothing is readable ONLY here
                * (the figures live on the marker labels and the metric
                * cards; these digits are a ruler's ticks), and raising them
                * to `caption` would make every tick wider than its column
                * and hand back the collisions the thinning just removed.
                */}
              <div data-geometry="chart-axis-tick" style={{ fontSize: labels.length > 8 ? 9.5 : 11, marginTop: 5, fontWeight: isLive || within(i) ? 800 : 500, color: isLive || within(i) ? C.harbor : C.muted }}>
                {isLive ? '•' : speaks(i) ? lb : ''}
              </div>
            </>
          );
          return onRangeTap ? (
            <button
              key={lb + i}
              onClick={() => onRangeTap(i)}
              aria-pressed={within(i)}
              // The live column shows «•» instead of its letter, so the name a
              // screen reader hears is stated explicitly — a control called
              // «bullet» is a control with no name. A13: when the caller hands
              // full words, the SPOKEN name is the word (the initials collide
              // as names — ي×3 on this very axis); the VISUAL text below is
              // untouched, because A12's thinning is visual law, not spoken.
              aria-label={(ariaLabels && ariaLabels[i]) || lb}
              style={{ ...colStyle, background: 'transparent', padding: 0, minWidth: 0 }}
            >
              {inner}
            </button>
          ) : (
            <div key={lb + i} style={colStyle}>{inner}</div>
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
export function MetricCards({ metric, setMetric, computed, comparable = true, prevName = '' }) {
  return (
    <div>
      {/**
        * THE UNIT THIS ROW IS DENOMINATED IN (D23 stage 1).
        *
        * ⚠️ FOUND BY OPENING IT. With the headline correctly reading «0 EUR»
        * these cards went on printing «الكل 2,139 ▲93%» — bare figures and
        * percentages, in smaller type, under a euro hero. Nothing on them said
        * pounds, so a reader converts them himself, which is Boundary 8's
        * synthetic conversion arriving through the person instead of the code.
        *
        * That is this file's OWN comment, four lines up, coming true a second
        * time: «Same rule, second render path — and the cards are the smaller
        * type, so it would have survived a visual check.» It did survive one.
        * It did not survive a device.
        *
        * LABELLED, NOT BLANKED. `comparable={false}` exists here and would have
        * hidden the deltas, but «2,139 EGP ▲93%» is a true and complete
        * sentence — suppressing it would delete real information to solve an
        * ambiguity that one word fixes.
        */}
      <div style={{ fontSize: TYPE.label, color: C.muted, marginTop: 10, textAlign: 'center', ...LATIN }}>
        {S.chartUnit(unitFor(HOME_CURRENCY))}
      </div>
      {/**
        * FULL-WIDTH ROWS, not three columns (UI pass 2026-08-30).
        *
        * Each card carried a label, a figure, its unit and a worded
        * comparison inside ~102px. At the 15px prose floor «was 0 E£ — last
        * week» wraps to three lines and the whole row grows to match. As rows
        * every part sits on one line in about a third of the height, and the
        * screen gets that space back for the chart.
        */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
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
              display: 'flex', alignItems: 'center', gap: 12,
              textAlign: 'start', minHeight: 56, width: '100%',
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
              // A tappable card-scale CONTROL, not a plain card: `row` is the
              // control-and-row radius the vocabulary assigns it.
              borderRadius: RADIUS.row, padding: '0 16px', minWidth: 0,
            }}
          >
            <div style={{ fontSize: TYPE.label, fontWeight: 700, color: active ? C.onDark : C.muted, letterSpacing: '.02em', whiteSpace: 'nowrap', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
              {/* GEOMETRY EXEMPTION (ruling 4): an 8×8 series swatch — any
                  surface radius exceeds half its width and would clamp the
                  square to a circle, erasing the "swatch = series" shape. */}
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: active ? C.onDark : m.color, marginInlineEnd: 5 }} />
              {S[m.labelKey]}
            </div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: TYPE.action, fontWeight: 650, color: active ? C.onDark : C.ink, flexShrink: 0, ...LATIN, ...NUMERALS }}>
              {moneyRound(now)}
              {/* A5 (HANDOFF:56): the figure carries its unit. The «in EGP»
                  caption above scopes the GROUP; it does not put a unit on any
                  one figure, and the law has no exception for a scoped group.
                  Sized by `unitSize` so ruling 5's senior floor applies. */}
              <span style={{ fontSize: unitSize(TYPE.action), fontFamily: FONT_UI, fontWeight: 600,
                color: active ? C.onDark : C.muted }}>{' '}{S.currencyShort}</span>
            </div>
            <div style={{ fontSize: TYPE.label, color: active ? C.onDark : C.muted, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {/* No comparison data ≠ a comparison of zero — and a TRUE zero
                  is worded (A4): «كان 0 — الأسبوع اللي فات», never a naked 0
                  the reader must diagnose. Prose, so no LATIN isolate. */}
              {prevAt == null
                ? <span style={LATIN}>—</span>
                : prevAt === 0 && prevName
                  ? <span>{S.prevWorded(`${moneyRound(0)} ${S.currencyShort}`, prevName)}</span>
                  : <span style={LATIN}>{moneyRound(prevAt)} {S.currencyShort}</span>}
              {comparable && <NeutralDelta now={now} prev={prevAt} />}
            </div>
          </button>
        );
      })}
      </div>
    </div>
  );
}

/**
 * ═══ E4 — THE LENS TILES DRIVE THE CATEGORY CHART (data-F9; NS §4.5) ═══
 *
 * ONE selection, TWO consumers: PriorityLens's tiles set it, CategoryCompare
 * re-renders by it. They are siblings on the Month screen — MonthScreen
 * mounts them either side of a section label, and MonthScreen is BookView's
 * file, not this chunk's — so the wiring lives here instead: a store LOCAL TO
 * THIS MODULE, which is as local as state shared by two siblings can be
 * without touching their parent. It behaves like component state, enforced:
 * the lens clears it when its panel closes and when it unmounts (a scoped
 * chart under a controller nobody can see would be a filtered list passing
 * for a whole one), and only one MonthScreen ever mounts at a time (the
 * browsed month stands the live one down), so there is exactly one writer.
 *
 * SSR reads the SEED PROPS (`selectedGroup` / `group`), never this store —
 * `useSyncExternalStore`'s server snapshot — which is what lets the suites
 * render the selected screen the same way peekOpen/policyOpen reach theirs.
 */
let prioritySelection = null;
const prioritySubs = new Set();
const subscribePriority = (fn) => { prioritySubs.add(fn); return () => prioritySubs.delete(fn); };
const readPrioritySelection = () => prioritySelection;
const setPrioritySelection = (key) => {
  if (key === prioritySelection) return;
  prioritySelection = key;
  for (const fn of [...prioritySubs]) fn();
};

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
export function CategoryCompare({ cats, curName, prevName, uncategorized, total, onUncategorized, group = null }) {
  /**
   * E4 — the scope a pressed lens tile put on this chart, or null for the
   * whole month. `group` is the SSR seed (suites; a static render cannot
   * tap); live, the store above is the one truth the tiles write.
   */
  const selected = useSyncExternalStore(subscribePriority, readPrioritySelection, () => group);
  const scoped = selected != null;
  /**
   * Scoped, the chart is per THAT group's categories — `groupOf` is the
   * ratified map's own reader, the same one the Book's filter chips consult
   * (N7), so the tile and the chip can never disagree about membership.
   */
  const shown = scoped ? (cats || []).filter((c) => groupOf(c && c.name) === selected) : cats;
  const max = Math.max(...shown.map((c) => Math.max(c.now, c.prev)), 1);
  return (
    <div style={{ background: C.card, borderRadius: RADIUS.card, padding: 14, marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 14, fontSize: TYPE.label, color: C.muted, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* GEOMETRY EXEMPTION (ruling 4): 10×10 series swatches — a surface
            radius would clamp them to circles; the square is the mark. */}
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: C.harbor, marginInlineEnd: 5, verticalAlign: '-1px' }} />{curName}</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: C.line, marginInlineEnd: 5, verticalAlign: '-1px' }} />{prevName}</span>
        {/**
          * E4 — a scoped chart NAMES its scope, on the chart itself: the
          * pressed tile above says it too, but a filtered list that relies on
          * chrome elsewhere to admit it is filtered is a subset passing for
          * the whole. Harbor fill — selection's own colour, same as the tile.
          * A statement, not a second control: releasing lives on the tile.
          */}
        {scoped && (
          <span style={{ background: C.harbor, color: C.onDark, borderRadius: RADIUS.capsule, padding: '2px 10px', fontWeight: 700 }}>
            {S.lensGroup(selected)}
          </span>
        )}
      </div>
      {/**
        * E4 — an emptied scope states its zero in the app's own sentence
        * (N7's key, reused): a silently empty card would claim a clean group
        * the way «This week 0» claimed a clean week.
        */}
      {scoped && shown.length === 0 && (
        <p style={{ fontSize: TYPE.label, color: C.muted, textAlign: 'center', lineHeight: 1.7, margin: '14px 4px' }}>
          {S.priorityEmpty(S.lensGroup(selected))}
        </p>
      )}
      {shown.map((c) => (
        <div key={c.name} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: TYPE.label, marginBottom: 4 }}>
            {/* Category name is frozen-schema Latin — isolated so RTL cannot reorder it */}
            <span style={{ fontWeight: 600 }} dir="auto">{categoryLabel(c.name)}</span>
            <span style={{ fontWeight: 700, fontFamily: FONT_DISPLAY }}>
              <span style={LATIN}>{money(c.now)}</span>
              <NeutralDelta now={c.now} prev={c.prev} />
            </span>
          </div>
          <div style={{ height: 9, background: C.shell, borderRadius: RADIUS.capsule, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', insetInlineStart: 0, top: 0, bottom: 0, width: `${(c.prev / max) * 100}%`, background: C.line, borderRadius: RADIUS.capsule }} />
            <div style={{ position: 'absolute', insetInlineStart: 0, top: 0, bottom: 0, width: `${(c.now / max) * 100}%`, background: C.harbor, borderRadius: RADIUS.capsule }} />
          </div>
        </div>
      ))}

      {/**
        * The ❓ money, labelled — never a category row. Rendered ONLY when there
        * is some: a month with nothing uncategorised says nothing about
        * uncategorised money, and «0 غير مصنّف» would be a line of noise he has
        * to read past on a clean month.
        */}
      {/**
        * E4 — and never under a group scope: ❓ money belongs to NO group (the
        * rollup's own law — a chip may not adopt money nobody has placed), so
        * a scoped chart neither shows nor hides-and-counts it. It returns,
        * untouched, the moment the tile releases.
        */}
      {!scoped && uncategorized && uncategorized.total > 0 && (
        <button
          onClick={onUncategorized}
          style={{
            // A row-scale tappable control; its old ad-hoc 12 retokenizes to
            // `row` — the control radius — rather than surviving as a 13th
            // distinct radius in the app.
            width: '100%', minHeight: TAP, marginBottom: 12, borderRadius: RADIUS.row,
            padding: '10px 12px', textAlign: 'start',
            background: C.conflictBg, border: `1px solid ${C.conflictLine}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: TYPE.label, gap: 8 }}>
            <span style={{ fontWeight: 700, color: C.conflictInk }}>{S.uncategorizedLine}</span>
            <span style={{ fontWeight: 700, color: C.conflictInk, ...LATIN, ...NUMERALS }}>
              {moneyRound(uncategorized.total)}
            </span>
          </div>
          <div style={{ fontSize: TYPE.label, color: C.ink, marginTop: 2 }}>{S.uncategorizedHint}</div>
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
      {/**
        * E4 — «إجمالي الشهر» never stands over a subset: scoped, the rows sum
        * to the GROUP's figure, which the pressed tile above already states,
        * and printing the month's total under four Joy rows would put two
        * unreconcilable figures on one card — the exact D16d failure, rebuilt.
        */}
      {!scoped && total != null && (
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
export function PriorityLens({ cats, uncategorized, open, onToggle, selectedGroup = null }) {
  /**
   * E4 — which tile is pressed. The store above is the live truth (the chart
   * below reads the same one); `selectedGroup` is the SSR seed. Hooks stand
   * ABOVE the early return, always — a hook under a branch is the
   * «rendered more hooks» crash that once took the whole app out on launch.
   */
  const selected = useSyncExternalStore(subscribePriority, readPrioritySelection, () => selectedGroup);
  /**
   * THE CONTROLLER NEVER OUTLIVES ITS VISIBILITY. A closed panel or an
   * unmounted lens clears the selection — otherwise the chart below stays
   * scoped under a pressed tile nobody can see, which is a filtered list
   * passing for a whole one. (On a month swap the remount runs the cleanup
   * first, so the next screen always opens unscoped.)
   */
  useEffect(() => () => setPrioritySelection(null), []);
  useEffect(() => { if (!open) setPrioritySelection(null); }, [open]);
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
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: RADIUS.card, padding: '4px 14px 10px', marginTop: 12 }}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: '100%', minHeight: TAP, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 8, background: 'transparent',
          padding: '0', textAlign: 'start',
        }}
      >
        <span style={{ fontSize: TYPE.label, fontWeight: 700, color: C.ink }}>{S.lensTitle}</span>
        <span style={{ fontSize: 13, color: C.muted }}>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 2, paddingTop: 4 }}>
          {/**
            * ALL FOUR, ALWAYS — a group with no spend this month is a true zero
            * and the fixed frame is the point of a lens. Hiding it would make
            * the shape of his month change with its contents, which is the one
            * thing a frame may not do.
            *
            * ═══ E4 — AND EACH ONE IS A TILE THAT DRIVES THE CHART ═══
            * (NS §4.5: «the lens tiles double as chart controllers».) Pressed,
            * a tile fills harbor — the palette's one selection colour — and
            * `CategoryCompare` below re-renders per that group's categories;
            * pressed again, it releases. The tile still STATES its word and
            * its sum first (word + figure, never icon-only), in the map's
            * fixed order: a controller is not a licence to rank, and the
            * chart below is where comparison lawfully lives — this panel
            * itself still carries no delta, no percentage, no sort.
            */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '8px 0 4px' }}>
            {folded.groups.map((g) => {
              const active = selected === g.key;
              return (
                <button
                  key={g.key}
                  className="catchip"
                  onClick={() => setPrioritySelection(active ? null : g.key)}
                  aria-pressed={active}
                  style={{
                    minHeight: TAP, borderRadius: RADIUS.row, padding: '9px 12px', textAlign: 'start',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2,
                    background: active ? C.harbor : C.card,
                    border: `1px solid ${active ? C.harbor : C.line}`,
                  }}
                >
                  <span style={{ fontSize: TYPE.label, fontWeight: active ? 700 : 600, color: active ? C.onDark : C.ink }}>
                    {S.lensGroup(g.key)}
                  </span>
                  <span style={{ fontWeight: 700, color: active ? C.onDark : C.ink, fontFamily: FONT_DISPLAY, ...LATIN, ...NUMERALS }}>
                    {moneyRound(g.total)}
                  </span>
                </button>
              );
            })}
          </div>

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
                <div style={{ fontSize: TYPE.label, color: C.muted, lineHeight: 1.7, paddingBottom: 6 }} dir="auto">
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

// A13 — `ariaLabels`: the axis's spoken layer (full words, index-aligned),
// threaded untouched to PairedBars; see the doctrine on the component itself.
// W1 — `homeZeroMisleads`: PeriodBlock's verdict (derived beside the head,
// from the head's own machinery) that this period is FOREIGN-LED with an EGP
// total of 0, so an EGP chart flat at zero would tell a foreign week as
// «nothing happened». This component only ever RENDERS that verdict — the
// doctrine lives where the inputs do, in views/BookView.jsx.
export function PeriodSummary({ data, labels, liveIndex, metric, setMetric, periodNames, showBars, footnote, offPlot = {}, comparable = true, rangeSeed = null, stack = null, ariaLabels = null, homeZeroMisleads = false }) {
  const color = METRICS.find((m) => m.key === metric).color;
  const cur = seriesFor(data.cur, metric);
  const prev = seriesFor(data.prev, metric);

  /**
   * ═══ E1 — THE YEAR'S SELECTED RANGE, LOCAL TO THIS COMPONENT ═══
   *
   * Only the YEAR axis grows range controls, recognised as THE twelve-slot
   * axis — A12's own taxonomy (weeks have 7 slots, a month more than 12), so
   * the test lives on the data's shape, not on a prop BookView would have to
   * be taught to pass. `rangeSeed` is the SSR seam (peekOpen's pattern): a
   * suite renders the selected screen; a person taps into it.
   *
   * A tap lands only on a month the year has REACHED (cur[i] != null): a
   * range anchored on a month with no tab would headline a confident 0 for
   * months that do not exist — absent is not zero, at the controls too.
   */
  const yearAxis = labels.length === 12;
  const [range, setRange] = useState(yearAxis ? rangeSeed : null);
  const onRangeTap = yearAxis
    ? (i) => { if (cur[i] == null) return; setRange((r) => nextRange(r, i)); }
    : null;
  const rangeWords = range
    ? (range.a === range.b ? monthWord(range.a) : `${monthWord(range.a)}–${monthWord(range.b)}`)
    : null;

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

  /**
   * E1 — THE TOTALS RE-SCOPE TO THE SELECTION, with the same honesty the
   * whole-period figures carry:
   *
   *  · `now` is the selected months' own sum. The year series is built from
   *    month totals that already include undated money, so there is no
   *    off-plot correction to miss here (weeks and months never grow range
   *    controls at all).
   *  · the year-ago figure exists ONLY when every selected month is CLOSED.
   *    A selection reaching the month in flight would set a partial sum
   *    against last year's finished months — the same-point lie the chart's
   *    own grey marker exists to avoid, arriving through a control — so the
   *    comparison is withheld (null → «—», the honest absence), never
   *    approximated.
   *  · a previous year the payload does not carry stays null, exactly as the
   *    unscoped cards would say it.
   */
  let scoped = null;
  if (range) {
    scoped = {};
    for (const m of METRICS) {
      const c = seriesFor(data.cur, m.key).slice(range.a, range.b + 1);
      const p = seriesFor(data.prev, m.key).slice(range.a, range.b + 1);
      const closed = liveIndex < 0 || range.b < liveIndex;
      const prevKnown = p.some((v) => v != null);
      scoped[m.key] = { now: sumTo(c), prevAt: closed && prevKnown ? sumTo(p) : null };
    }
  }

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
      <div style={{ background: C.card, borderRadius: RADIUS.card, padding: '14px 12px 10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 4px 8px', gap: 8 }}>
          <span style={{ fontSize: TYPE.label, fontWeight: 700, color }}>
            {periodNames.cur} <span style={{ color: C.muted, fontWeight: 500 }}>{S.vs} {periodNames.prev}</span>
          </span>
          {/**
            * THE UNIT THE CHART IS ACTUALLY DRAWN IN (D23 stage 1).
            *
            * The series is EGP and only EGP — there is no euro history to plot
            * until the backend half derives home-denominated aggregates from
            * D21's stamped rates. So under a EUR headline this chart is in a
            * DIFFERENT unit from the number above it, which is fine only while
            * it says so. An unlabelled axis beneath a euro hero gets read as
            * euros, and that is a synthetic conversion performed by the reader
            * instead of by the code — Boundary 8 reached through the human, the
            * same route the keypad's contradictory toggle took.
            *
            * It sits in the slot the legend vacated: the caption that pre-
            * answered a question the chart answers on contact is gone, and what
            * stands here instead is a fact the chart cannot show on its own.
            */}
          {/**
            * W1 — the caption renders only while the chart it captions does.
            * «in EGP» standing over the quiet sentence would caption an
            * absence — and the sentence below names the unit itself, so the
            * caption's one fact survives the caption (the Owner's screenshot
            * quoted this exact caption as part of the lie).
            */}
          {!homeZeroMisleads && (
          <span style={{ fontSize: TYPE.label, color: C.muted, whiteSpace: 'nowrap', ...LATIN }}>
            {S.chartUnit(unitFor(HOME_CURRENCY))}
          </span>
          )}
          {/**
            * ⚠️ THE LEGEND LINE WAS DELETED HERE (North Star §5, Phase A).
            *
            * It read «cumulative · ● = same point» at 11px — the smallest text
            * in the app, `nowrap`, competing for the same row as the heading it
            * explained. §5: «the legend line is deleted; color does the work;
            * the marker explains itself on tap.»
            *
            * The two facts it carried are not lost. The line IS cumulative and
            * the shape of the curve says so; the ● marker already has its own
            * tap affordance below. What is gone is a permanent caption spending
            * a whole row, every render, to pre-answer a question the chart
            * answers on contact — and spending it at a size the senior-first
            * law would not permit anywhere else.
            *
            * `S.cumulativeNote` was removed from BOTH locales in the same
            * change; a key left behind is the next reader's evidence that the
            * caption should exist.
            */}
        </div>
        {/* Time axes stay left→right regardless of the RTL document */}
        {homeZeroMisleads ? (
          /**
           * ═══ W1 — THE CHART NEVER DRAWS A ZERO IT DOES NOT MEAN ═══
           *
           * A foreign-led period with an EGP total of 0 (the verdict arrives
           * from PeriodBlock — see the doctrine there): no EGP line, no zero
           * marker, no bars of the same zero, no draw animation over an
           * absent line (B3's law has nothing to animate). In their place,
           * ONE quiet true sentence, in periodJustStarted's own voice.
           *
           * AND IT OUTRANKS M7's just-started sentence, deliberately: on day
           * one of a foreign-led zero week, «the chart appears after another
           * day» is a promise this period cannot keep — no EGP money means
           * no chart tomorrow either. The truer sentence wins.
           *
           * THE WORDS ARE A GUARDED LOOKUP. The clean key (`chartHomeZero`)
           * is proposed to the i18n owner — this leaf may not add keys — and
           * until it lands the sentence is composed from two strings the app
           * already owns: N7's emptied-scope grammar («X»: 0 — nothing of
           * this kind this period) scoped to the chart's own unit. E4
           * already reuses `priorityEmpty` for an emptied chart scope; the
           * EGP lens over a euro week is the same shape. Either wording
           * NAMES the unit, which is the caption's fact surviving the
           * caption (and test-book's two-unit-mentions pin rides on it).
           *
           * NOT drawn instead: a EUR line — there is no by-day home-unit
           * series in the payload (D23 stage 2), and faking one from the
           * aggregate would be fabrication in the chart's own hand.
           */
          <p style={{ fontSize: TYPE.label, color: C.muted, textAlign: 'center', lineHeight: 1.55, margin: '10px 8px 6px' }}>
            {typeof S.chartHomeZero === 'function'
              ? S.chartHomeZero(unitFor(HOME_CURRENCY))
              : S.priorityEmpty(S.chartUnit(unitFor(HOME_CURRENCY)))}
          </p>
        ) : !plottable ? (
          <p style={{ fontSize: TYPE.label, color: C.muted, textAlign: 'center', lineHeight: 1.55, margin: '10px 8px 6px' }}>
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
          {/**
            * E5 — the Month screen hands in the two-panel stack (line above
            * per-day bars, one axis) and it REPLACES the lone line: two charts
            * telling the same month would be the months-don't-match lie in a
            * new coat. Every other period keeps the classic line.
            */}
          {stack || (
          <CumulativeChart
            cur={cur} prev={prev} color={color}
            labelled={!((offPlot.Visa || 0) + (offPlot.Cash || 0))}
            prevName={periodNames.prev}
          />
          )}
          {showBars && (
            <PairedBars
              cur={cur} prev={prev} labels={labels} liveIndex={liveIndex} color={color}
              range={range} onRangeTap={onRangeTap} rangeWords={rangeWords}
              ariaLabels={ariaLabels}
            />
          )}
        </div>
        )}
      </div>
      {/* A7: the method cards sit under their own NAME — a section, not an
          inference the reader draws from three buttons. */}
      <SectionLabel>{S.sectionByMethod}</SectionLabel>
      {/**
        * E1 — the cards' scope, said in words while a range is selected. The
        * line above them keeps telling the whole year's story (its marker
        * figures stay year-scoped, deliberately — see the leaf report), so
        * the one place two scopes share a screen, each is named: the chart
        * card's header names the year, this line names the selection.
        */}
      {range && (
        <div dir="auto" style={{ fontSize: TYPE.label, color: C.muted, textAlign: 'center', margin: '6px 0 0' }}>
          {rangeWords}
        </div>
      )}
      <MetricCards metric={metric} setMetric={setMetric} computed={scoped || computed} comparable={comparable} prevName={periodNames.prev} />
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
        <p style={{ fontSize: TYPE.label, color: C.muted, textAlign: 'center', lineHeight: 1.6, margin: '10px 0 0' }}>
          {S.noComparison(periodNames.prev)}
        </p>
      )}
    </div>
  );
}

/**
 * ═══ E5 — THE TWO-PANEL MONTH STACK, ONE SHARED AXIS (data-F4; NS §5) ═══
 *
 * «Cumulative line above answers "how is the month going", per-day bars below
 * answer "which days did it".» One component, mount-ready — MonthScreen
 * mounting it is the Planner's one-line integration, deliberately not this
 * chunk's edit — and BOTH panels are the existing charts, reused: the honest
 * grammar this app has already paid for (S6's marker figures, A6's tap-peek,
 * B3's once-per-mount draw, A12's thinned axis, the hasPrev and labelled
 * gates) exists ONCE. A re-implementation here would be the two-derivations
 * bug factory, panel-sized.
 *
 * ONE SHARED AXIS, mechanically: the bars' day axis is the ONLY axis (the
 * line panel draws no day labels of its own — it never has), and
 * `columns={labels.length}` makes the line's x geometry the COLUMN geometry,
 * so «the 18th» is one vertical everywhere on the card. A12's every-5th-day
 * thinning goes live on this mount: the Month screen has carried
 * `showBars={false}` since the rule was cut, so this stack is where 31
 * thinned labels first stand on a real screen.
 *
 * THE CALLER'S ONE DERIVATION DUTY: `band` is `typicalBand(...)`'s result or
 * null — for the live month, `typicalBand(comb(year.cur.Visa, year.cur.Cash),
 * todayCairo.m)`; the summing rule stays `comb`'s (series.js pins that
 * signature) and this component only ever RENDERS what it was handed.
 *
 * A month with no shape (M7) renders NOTHING — the caller's existing words
 * (`S.periodJustStarted`) say why; a stack that faked a dot over 31 grey
 * bars would read as broken and be believed.
 */
export function MonthStack({ cur, prev, labels, liveIndex, color, band = null, prevName = '', labelled = true, peekOpen = false }) {
  if (!hasShape(cur)) return null;
  return (
    <div dir="ltr">
      <CumulativeChart
        cur={cur} prev={prev} color={color} prevName={prevName}
        labelled={labelled} peekOpen={peekOpen}
        columns={labels.length} band={band}
      />
      <PairedBars cur={cur} prev={prev} labels={labels} liveIndex={liveIndex} color={color} />
    </div>
  );
}
