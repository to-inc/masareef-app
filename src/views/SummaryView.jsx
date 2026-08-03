import { useState } from 'react';
import { C, METHOD, FONT_DISPLAY, NUMERALS, TAP } from '../theme.js';
import { S, monthAr, WEEK_DAYS_AR, MONTH_LABELS_AR } from '../i18n/strings.js';
import { money, amountWithCurrency } from '../lib/format.js';
import { PeriodSummary, CategoryCompare } from '../components/Charts.jsx';
import { SectionLabel, Chip, LATIN } from '../components/Primitives.jsx';

/**
 * Today / Week / Month / Year, all driven by the single `summary` payload.
 *
 * The prototype's "Write N rows to Google Sheet" button is deliberately GONE:
 * in the real app every confirm, cash entry and receipt writes immediately, so
 * Today is a read-back mirror of the sheet rather than a staging area. That is
 * the whole trust story — what he sees here is what is in his file.
 */
export default function SummaryView({ data }) {
  const [period, setPeriod] = useState('today');
  const [metric, setMetric] = useState('all');

  const today = data.today_cairo;
  const liveWeekIndex = new Date(Date.UTC(today.y, today.m - 1, today.d)).getUTCDay();

  const seg = (key, label) => (
    <button
      key={key}
      onClick={() => setPeriod(key)}
      aria-pressed={period === key}
      style={{
        flex: 1, minHeight: TAP, padding: '11px 0', borderRadius: 999,
        background: period === key ? C.harbor : 'transparent',
        color: period === key ? C.onDark : C.ink,
        fontSize: 15, fontWeight: period === key ? 700 : 600,
      }}
    >
      {label}
    </button>
  );

  // Honest incompleteness (06 §2.2): a month we cannot fully account for must
  // never render as a confident number. `undated` rows are in the total but not
  // the chart; `unpriced` rows are in neither, so the total is knowably short.
  const undated = data.month?.undated;
  const unpriced = data.month?.unpriced;
  const note = (text, key) => (
    <p key={key} style={{ fontSize: 12.5, color: C.ink, background: C.sand, border: `1px solid ${C.line}`, borderRadius: 10, padding: '8px 12px', margin: '10px 0 0', lineHeight: 1.6, textAlign: 'center' }}>
      {text}
    </p>
  );
  const notes = [];
  if (unpriced && unpriced.count > 0) notes.push(note(S.unpricedNote(unpriced.count), 'unpriced'));
  if (undated && undated.count > 0) notes.push(note(S.undatedNote(undated.count), 'undated'));
  const undatedFootnote = notes.length ? <>{notes}</> : null;

  return (
    <div>
      <div style={{ display: 'flex', background: C.card, border: `1px solid ${C.line}`, borderRadius: 999, padding: 4, marginBottom: 14, gap: 2 }}>
        {seg('today', S.periodToday)}
        {seg('week', S.periodWeek)}
        {seg('month', S.periodMonth)}
        {seg('year', S.periodYear)}
      </div>

      {period === 'week' && (
        <PeriodSummary
          data={data.week}
          labels={WEEK_DAYS_AR}
          liveIndex={liveWeekIndex}
          metric={metric}
          setMetric={setMetric}
          periodNames={{ cur: S.thisWeek, prev: S.lastWeek, unit: S.unitWeek }}
          showBars
        />
      )}

      {period === 'month' && (
        <>
          <PeriodSummary
            data={data.month}
            labels={[]}
            liveIndex={-1}
            metric={metric}
            setMetric={setMetric}
            periodNames={{ cur: monthAr(data.month.names.cur), prev: monthAr(data.month.names.prev), unit: S.unitMonth }}
            showBars={false}
            footnote={undatedFootnote}
          />
          <CategoryCompare
            cats={data.monthCats}
            curName={monthAr(data.month.names.cur)}
            prevName={monthAr(data.month.names.prev)}
          />
        </>
      )}

      {period === 'year' && (
        <PeriodSummary
          data={data.year}
          labels={MONTH_LABELS_AR}
          liveIndex={today.m - 1}
          metric={metric}
          setMetric={setMetric}
          periodNames={{ cur: String(today.y), prev: String(today.y - 1), unit: S.unitYear }}
          showBars
        />
      )}

      {period === 'today' &&
        (data.today.entries.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 90 }}>
            <div style={{ fontSize: 52 }}>🌙</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 650, color: C.harbor, marginTop: 10 }}>
              {S.todayEmptyTitle}
            </div>
            <div style={{ color: C.muted, fontSize: 15.5, marginTop: 8 }}>{S.todayEmptyBody}</div>
          </div>
        ) : (
          <TodayEntries entries={data.today.entries} totals={data.today.totals} />
        ))}
    </div>
  );
}

function TodayEntries({ entries, totals }) {
  const cols = '1fr 1.6fr .9fr 1.4fr 1fr';
  return (
    <div>
      <SectionLabel>{S.todayTitle}</SectionLabel>

      <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.line}`, overflow: 'hidden', marginBottom: 14 }}>
        <div
          style={{
            display: 'grid', gridTemplateColumns: cols, fontSize: 11.5, fontWeight: 700,
            color: C.muted, letterSpacing: '.02em', padding: '10px 12px',
            background: C.shell, borderBottom: `1px solid ${C.line}`,
          }}
        >
          <span>{S.colDate}</span>
          <span>{S.colDesc}</span>
          <span>{S.colMethod}</span>
          <span>{S.colCategory}</span>
          <span style={{ textAlign: 'end' }}>{S.colAmount}</span>
        </div>
        {entries.map((e, i) => (
          <div
            key={`${e.description}-${e.amount}-${i}`}
            className="card-in"
            style={{
              display: 'grid', gridTemplateColumns: cols, fontSize: 14,
              padding: '12px', borderBottom: `1px solid ${C.line}`, alignItems: 'center', gap: 4,
            }}
          >
            <span style={{ color: C.muted, ...LATIN }}>{e.date}</span>
            <span style={{ fontWeight: 600, ...LATIN, overflow: 'hidden', textOverflow: 'ellipsis' }} dir="auto">{e.description}</span>
            <Chip kind={e.method} small label={e.method === 'Visa' ? S.metricVisa : S.metricCash} />
            {/* An empty category is a row he hasn't classified — show the gap,
                not a blank cell that reads as a rendering glitch. And show it in
                INK: greying the marker is how a gap becomes invisible, which is
                the same lie as not printing it (caught by honest-render.mjs when
                this cell was still `muted` against the new white card). */}
            <span style={{ ...LATIN, overflow: 'hidden', textOverflow: 'ellipsis', color: C.ink }} dir="auto">
              {e.category || '—'}
            </span>
            {/* An unpriced row has no amount. amountWithCurrency(null) would
                render "0" — a figure he never wrote. */}
            <span style={{ textAlign: 'end', fontWeight: 700, fontFamily: FONT_DISPLAY, fontSize: 15, color: C.ink, ...LATIN, ...NUMERALS }}>
              {e.amount == null ? '—' : amountWithCurrency(e.amount, e.currency)}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <TotalCard label={S.metricVisa} value={totals.Visa} color={METHOD.Visa.fg} bg={METHOD.Visa.bg} />
        <TotalCard label={S.metricCash} value={totals.Cash} color={METHOD.Cash.fg} bg={METHOD.Cash.bg} />
      </div>
    </div>
  );
}

function TotalCard({ label, value, color, bg }) {
  return (
    <div style={{ flex: 1, background: bg, borderRadius: 14, padding: '12px 14px' }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color, letterSpacing: '.03em' }}>{label}</div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 650, color: C.ink, ...NUMERALS }}>
        <span style={LATIN}>{money(value)}</span> <span style={{ fontSize: 13, color: C.muted }}>{S.currency}</span>
      </div>
    </div>
  );
}
