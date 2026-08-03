import { C, FONT_DISPLAY, NUMERALS, PREV_SERIES_OPACITY } from '../theme.js';
import { METRICS } from '../lib/constants.js';
import { S } from '../i18n/strings.js';
import { moneyRound, money } from '../lib/format.js';
import { comb, seriesFor, sumTo, cumsum, lastIdxOf } from '../lib/series.js';
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
export function CumulativeChart({ cur, prev, color }) {
  const W = 320, H = 116, P = 8;
  const cumC = cumsum(cur), cumP = cumsum(prev);
  const li = lastIdxOf(cumC);
  const n = Math.max(cur.length, prev.length);
  const max = Math.max(cumP[cumP.length - 1] || 0, cumC[li] || 0, 1);
  const x = (i) => P + (i / (n - 1)) * (W - 2 * P);
  const y = (v) => H - P - (v / max) * (H - 2 * P - 8);
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
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }} aria-hidden="true">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={P} x2={W - P} y1={y(max * f)} y2={y(max * f)} stroke={C.line} strokeWidth="0.6" strokeDasharray="3 4" />
      ))}
      <line x1={x(li)} x2={x(li)} y1={y(Math.max(cumC[li] || 0, prevAt))} y2={H - 2} stroke={C.muted} strokeWidth="0.8" />
      <path d={path(cumP, cumP.length - 1)} stroke={C.muted} strokeOpacity={PREV_SERIES_OPACITY} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d={path(cumC, li)} stroke={color} strokeWidth="3.2" fill="none" strokeLinecap="round" />
      {hasPrev && <circle cx={x(li)} cy={y(prevAt)} r="4" fill={C.muted} fillOpacity={PREV_SERIES_OPACITY} />}
      <circle cx={x(li)} cy={y(cumC[li] || 0)} r="5.5" fill={C.shell} stroke={color} strokeWidth="3" />
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
export function MetricCards({ metric, setMetric, computed }) {
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
              <Delta now={now} prev={prevAt} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function CategoryCompare({ cats, curName, prevName }) {
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
            <span style={{ fontWeight: 600, ...LATIN }} dir="auto">{c.name}</span>
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
    </div>
  );
}

export function PeriodSummary({ data, labels, liveIndex, metric, setMetric, periodNames, showBars, footnote }) {
  const color = METRICS.find((m) => m.key === metric).color;
  const cur = seriesFor(data.cur, metric);
  const prev = seriesFor(data.prev, metric);

  const computed = {};
  for (const m of METRICS) {
    const c = seriesFor(data.cur, m.key);
    const p = seriesFor(data.prev, m.key);
    const idx = lastIdxOf(c);
    // `|| 0` here would turn "we have no data for last year" into a confident
    // "0" — telling him he spent nothing in 2025 when the truth is that the 2025
    // file isn't connected. Null is carried through and rendered as an absence.
    const at = cumsum(p)[Math.min(idx, p.length - 1)];
    computed[m.key] = { now: sumTo(c), prevAt: at == null ? null : at };
  }

  // No comparison data at all — e.g. the previous-year spreadsheet isn't
  // connected. Say so plainly rather than describing a chart that isn't there.
  const hasPrevData = prev.some((v) => v != null);

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
        <div dir="ltr">
          <CumulativeChart cur={cur} prev={prev} color={color} />
          {showBars && <PairedBars cur={cur} prev={prev} labels={labels} liveIndex={liveIndex} color={color} />}
        </div>
      </div>
      <MetricCards metric={metric} setMetric={setMetric} computed={computed} />
      {footnote}
      {/* This paragraph explains a grey line and a grey marker. When there is no
          comparison data neither is drawn, and describing them would send him
          looking for something that isn't on screen. */}
      {hasPrevData ? (
        <p style={{ fontSize: 12.5, color: C.muted, textAlign: 'center', lineHeight: 1.6, margin: '10px 0 0' }}>
          {S.comparisonHelp(periodNames.prev, periodNames.unit)}
        </p>
      ) : (
        <p style={{ fontSize: 12.5, color: C.muted, textAlign: 'center', lineHeight: 1.6, margin: '10px 0 0' }}>
          {S.noComparison(periodNames.prev)}
        </p>
      )}
    </div>
  );
}
