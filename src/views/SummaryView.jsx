import { useState } from 'react';
import { C, METHOD, FONT_DISPLAY, NUMERALS, TAP } from '../theme.js';
import { S, monthName, WEEK_DAYS, MONTH_LABELS } from '../i18n/strings.js';
import { money, amountWithCurrency } from '../lib/format.js';
import { PeriodSummary, CategoryCompare } from '../components/Charts.jsx';
import { SectionLabel, Chip, LATIN } from '../components/Primitives.jsx';
import LogCard from '../components/LogCard.jsx';

/**
 * Today / Week / Month / Year, all driven by the single `summary` payload.
 *
 * The prototype's "Write N rows to Google Sheet" button is deliberately GONE:
 * in the real app every confirm, cash entry and receipt writes immediately, so
 * Today is a read-back mirror of the sheet rather than a staging area. That is
 * the whole trust story — what he sees here is what is in his file.
 */
export default function SummaryView({ data, onGoToInbox }) {
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

  return (
    <div>
      {/**
        * W-6, TOP OF THE TODAY VIEW. First thing on the screen on the first of
        * the month, above his own numbers — a closed book is handed over before
        * the new one is opened. It renders nothing at all on the other 24 days,
        * after he has read it, or when the server sends no log.
        *
        * `today.d` here is `data.today_cairo` — the SERVER's Cairo date. The
        * device clock is never consulted for this decision.
        */}
      <LogCard prevLog={data.month && data.month.prevLog} todayCairo={today} />
      <div style={{ display: 'flex', background: C.card, border: `1px solid ${C.line}`, borderRadius: 999, padding: 4, marginBottom: 14, gap: 2 }}>
        {seg('today', S.periodToday)}
        {seg('week', S.periodWeek)}
        {seg('month', S.periodMonth)}
        {seg('year', S.periodYear)}
      </div>

      {period === 'week' && (
        <PeriodSummary
          data={data.week}
          labels={WEEK_DAYS}
          liveIndex={liveWeekIndex}
          metric={metric}
          setMetric={setMetric}
          periodNames={{ cur: S.thisWeek, prev: S.lastWeek, unit: S.unitWeek }}
          showBars
        />
      )}

      {period === 'month' && (
        <MonthScreen data={data} metric={metric} setMetric={setMetric} onGoToInbox={onGoToInbox} />
      )}

      {period === 'year' && (
        <PeriodSummary
          data={data.year}
          labels={MONTH_LABELS}
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

/**
 * THE MONTH SCREEN — the card, and under it the accountability list (D16d).
 *
 * Its own EXPORTED component, and that is a testing decision as much as a
 * structural one: the Month sits behind a tab press no server render can make,
 * so while this lived inline the only thing a suite could check about it was
 * the shape of its source text. Three of this project's bugs were correct
 * components mounted with the wrong props — the class a source regex cannot
 * see. As a component, `test-accountability.mjs` renders exactly what he sees.
 */
export function MonthScreen({ data, metric, setMetric, onGoToInbox }) {
  // Honest incompleteness (06 §2.2): a month we cannot fully account for must
  // never render as a confident number. `undated` rows are in the total but not
  // the chart; `unpriced` rows are in neither, so the total is knowably short.
  const undated = data.month?.undated;
  const unpriced = data.month?.unpriced;

  /**
   * The month's ONE figure — the same arithmetic the card is handed. Derived
   * here rather than read from a field because the payload carries no month
   * total: `totals = sum(byDay) + undated` by construction, which is exactly
   * these two terms.
   */
  const monthTrueTotal = data.month
    ? (data.month.cur.Visa || []).reduce((a, v) => a + (v || 0), 0)
      + (data.month.cur.Cash || []).reduce((a, v) => a + (v || 0), 0)
      + (undated?.Visa || 0) + (undated?.Cash || 0)
    : null;

  /**
   * WHETHER THE LIST CAN BACK A TOTAL — the V17/V18 gate, and the signal is the
   * FIELD'S PRESENCE, never its value.
   *
   * The «إجمالي الشهر» line at the foot of the list is not decoration, it is a
   * CLAIM: "the rows above, plus the ❓ money, are the whole month" (06 §2.2).
   * Only a V18 payload can back it — it sends EVERY category and a
   * `month.uncategorized` figure, so what is on screen accounts for the total
   * exactly. A V17 payload sends a TOP-5 cut and no `uncategorized` key at all;
   * printing the month's total under that list prints a number the same screen
   * contradicts, which is precisely the arithmetic he caught by hand once
   * already. On V17 we therefore print no claim — the pre-rev presentation, and
   * the honest degradation. The card above is V17-safe either way: its total is
   * derived from the series it plots plus the undated rows, not from this list.
   *
   * PRESENCE, NOT VALUE — the part that must survive the next reader. A clean
   * V18 month sends `uncategorized: {count: 0, total: 0}`, and its list DOES add
   * up to the total exactly, so it MUST still show the line. A value test
   * (`uncategorized.total > 0`) reads as though it asked the same question; it
   * does not, and it would hide the total on exactly the months where the claim
   * is most defensible. Do not "simplify" this into one. `withDefaults` in
   * lib/summaryShape.js leaves `uncategorized` alone for the same reason —
   * absence is information here, and a JSON round-trip preserves absence.
   */
  const listAccountsForTheMonth = data.month?.uncategorized !== undefined;

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
    <>
      <PeriodSummary
        data={data.month}
        labels={[]}
        liveIndex={-1}
        metric={metric}
        setMetric={setMetric}
        periodNames={{ cur: monthName(data.month.names.cur), prev: monthName(data.month.names.prev), unit: S.unitMonth }}
        showBars={false}
        footnote={undatedFootnote}
        /**
         * The undated rows ARE the month; they are simply not on the curve.
         * Handing them here makes the card show the true month total, which
         * is what the accountability list reconciles against — one number,
         * one screen. The footnote above already says how many are missing
         * from the chart, and with this it is finally literally true.
         */
        offPlot={{ Visa: undated?.Visa || 0, Cash: undated?.Cash || 0 }}
      />
      {/**
        * The accountability list (D16d). Categories + ❓ = the month, and the
        * total printed here is the SAME figure the card above shows — one
        * number, one screen. Tapping the ❓ line goes where the work is.
        *
        * `total={null}` is the V17 case saying so out loud: no total line,
        * because this list cannot account for one. See the gate above.
        */}
      <CategoryCompare
        cats={data.monthCats}
        curName={monthName(data.month.names.cur)}
        prevName={monthName(data.month.names.prev)}
        uncategorized={data.month?.uncategorized}
        total={listAccountsForTheMonth ? monthTrueTotal : null}
        onUncategorized={onGoToInbox}
      />
    </>
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
