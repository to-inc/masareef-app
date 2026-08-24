import { useState, useEffect, useCallback } from 'react';
import { C, METHOD, FONT_DISPLAY, NUMERALS, TAP } from '../theme.js';
import { S, monthName, monthByTab, categoryLabel, WEEK_DAYS, MONTH_LABELS } from '../i18n/strings.js';
import { METRICS } from '../lib/constants.js';
import { money, moneyRound, amountWithCurrency } from '../lib/format.js';
import { periodTotals, comparisonOf } from '../lib/series.js';
import { hasForeign, mayCompare, foreignLines, unsizedForeign } from '../state/foreign.js';
import { fetchEntries } from '../api/index.js';
import { findLookalikes, lookalikeCounts } from '../state/duplicates.js';
import { PeriodSummary, CategoryCompare } from '../components/Charts.jsx';
import { Chip, LATIN, ISOLATE, SectionLabel } from '../components/Primitives.jsx';
import { OutcomeNote, CategoryActions } from '../components/CategoryPicker.jsx';
import { cardKey, needsHim } from '../state/inboxOutcomes.js';
import { monthStrip, monthsFor, filterEntries, undatedIn, sortForDisplay } from '../state/recent.js';
import { bookPeriods, rowsSource, travelOf, egpTotalOf, needsCategory } from '../state/book.js';
import { getSheetUrl } from '../state/secret.js';
import LogCard from '../components/LogCard.jsx';

/**
 * «الدفتر» — THE BOOK. One list at four zooms (finding M1).
 *
 * ——— WHAT THIS REPLACED, and why it was two screens.
 *
 * «اليوم» and «الأخير» showed the SAME SIX ROWS. Opened one after the other in
 * the running app they were the identical dataset in two visual languages: one
 * as a five-column spreadsheet, one as cards. They had two segmented controls
 * offering different periods (اليوم had السنة, الأخير did not), and the ❓ marker
 * was tappable in one and inert in the other. Two destinations, one question,
 * and a pause every time about which to open.
 *
 * The spreadsheet lost, and it lost on measurement rather than taste: five
 * columns on a 375px screen wrapped `Elect. Recharge`, `Personal expenses`,
 * `Café de Flore` and `12.5 EUR` onto two lines each and collided its own
 * headers, while a quarter of the width went to a date column printing
 * `17/8/2026` six times on a screen titled «النهاردة».
 *
 * ——— THE ORDER, which is finding M5.
 *
 * He opens this to ask "how much, and is that normal?" The old month screen
 * answered chart → cards → two caveats → three lines of instruction →
 * categories, with the figure itself buried inside a card whose label was
 * truncated to «كل المصاري…». The order here is the answer order:
 *
 *     THE FIGURE  →  ONE SENTENCE  →  the chart  →  where it went  →  the rows
 *
 * ——— AND EVERY ❓ IS A DOOR (finding M6).
 *
 * The old «اليوم» printed the gap as a red mark that did nothing, while the same
 * row one tab over was one tap from fixed. Here a row without a category is a
 * button, on every period, using the same picker the Inbox uses.
 */
export default function BookView({
  data, settled = {}, onEdit, onGoToInbox, onBusyChange,
  unsettledBatch = 0, onOpenBatch,
}) {
  const [period, setPeriod] = useState('today');
  const [metric, setMetric] = useState('all');
  const [browsing, setBrowsing] = useState(null);   // a specific {y,m}, or null
  const [fetched, setFetched] = useState([]);
  const [fetchedTab, setFetchedTab] = useState('');
  const [undated, setUndated] = useState(0);
  const [open, setOpen] = useState(null);
  // Read once — it cannot change while he is looking at the screen.
  const [sheetUrl] = useState(() => getSheetUrl());

  const today = data.today_cairo;
  const liveWeekIndex = new Date(Date.UTC(today.y, today.m - 1, today.d)).getUTCDay();

  /**
   * Today's rows ride on the `summary` every screen already fetched; week and
   * month need their own read. That split is `rowsSource`, stated once so this
   * component cannot drift into fetching a period it already has in hand — a
   * needless Apps Script cold start on the screen he opens most.
   */
  const needsFetch = rowsSource(period, browsing) === 'fetch';

  const load = useCallback(async () => {
    if (!needsFetch) return true;
    try {
      const months = browsing ? [browsing] : monthsFor(period === 'year' ? 'month' : period, today);
      const answers = await Promise.all(months.map((ref) => fetchEntries(ref)));
      const all = answers.flatMap((a) => (a && Array.isArray(a.entries) ? a.entries : []));
      const shown = browsing ? all : filterEntries(all, period, today);
      setFetched(sortForDisplay(shown));
      setFetchedTab(answers.length === 1 && answers[0] ? answers[0].tab || '' : '');
      // Counted from the rows ON SCREEN: a week spanning two months is assembled
      // from two responses and neither one's figure describes it.
      setUndated(browsing || period === 'month' ? 0 : undatedIn(all));
      return true;
    } catch {
      // Losing signal in Cairo is normal. Keep what is on screen and say nothing
      // it cannot back up — the shell's offline banner is the one that speaks.
      return false;
    }
  }, [period, browsing, today, needsFetch]);

  useEffect(() => { load(); }, [load]);
  // The header's refresh button reloads THIS view's data while it is showing.
  useEffect(() => { if (onBusyChange) onBusyChange(load); }, [onBusyChange, load]);

  const rows = needsFetch ? fetched : sortForDisplay(data.today.entries || []);

  const seg = (key) => (
    <button
      key={key}
      onClick={() => { setBrowsing(null); setPeriod(key); }}
      aria-pressed={period === key}
      style={{
        flex: 1, minHeight: TAP, padding: '11px 0', borderRadius: 999,
        background: period === key ? C.harbor : 'transparent',
        color: period === key ? C.onDark : C.ink,
        fontSize: 15, fontWeight: period === key ? 700 : 600,
      }}
    >
      {S[`period${key[0].toUpperCase()}${key.slice(1)}`]}
    </button>
  );

  return (
    <div>
      {/* The closed month, handed over on the first of the next one (W-6). */}
      <LogCard prevLog={data.month && data.month.prevLog} todayCairo={today} />

      <div style={{ display: 'flex', background: C.card, border: `1px solid ${C.line}`, borderRadius: 999, padding: 4, marginBottom: 14, gap: 2 }}>
        {bookPeriods().map(seg)}
      </div>

      {period === 'today' && (
        <TodayHead
          totals={data.today.totals} entries={data.today.entries} onGoToInbox={onGoToInbox}
          unsettledBatch={unsettledBatch} onOpenBatch={onOpenBatch}
        />
      )}


      {period === 'week' && (
        <PeriodBlock
          data={data.week} labels={WEEK_DAYS} liveIndex={liveWeekIndex}
          metric={metric} setMetric={setMetric}
          names={{ cur: S.thisWeek, prev: S.lastWeek }} showBars
        />
      )}

      {period === 'month' && (
        <MonthScreen data={data} metric={metric} setMetric={setMetric} onGoToInbox={onGoToInbox} />
      )}

      {period === 'year' && (
        <PeriodBlock
          data={data.year} labels={MONTH_LABELS} liveIndex={today.m - 1}
          metric={metric} setMetric={setMetric}
          names={{ cur: String(today.y), prev: String(today.y - 1) }} showBars
        />
      )}

      {/**
        * THE MONTH BROWSER, under «الشهر» only — it is the control for choosing
        * WHICH month's rows to read, and it has no meaning under a week or a
        * year. Reverse-chronological since S9.
        */}
      {period === 'month' && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '14px 0 10px' }}>
          <span style={{ fontSize: 13, color: C.muted, alignSelf: 'center', whiteSpace: 'nowrap', marginInlineEnd: 4 }}>
            {S.recentMonths}
          </span>
          {monthStrip(today).map((ref) => {
            const active = browsing && browsing.m === ref.m && browsing.y === ref.y;
            return (
              <button
                key={`${ref.y}-${ref.m}`}
                className="catchip"
                onClick={() => setBrowsing(active ? null : ref)}
                aria-pressed={!!active}
                style={{
                  minHeight: TAP, padding: '0 14px', borderRadius: 999, whiteSpace: 'nowrap', flex: '0 0 auto',
                  background: active ? C.harbor : C.card,
                  border: `1px solid ${active ? C.harbor : C.line}`,
                  color: active ? C.onDark : C.ink, fontSize: 15, fontWeight: active ? 700 : 500,
                }}
              >
                {monthByTab(MONTH_ABBR[ref.m - 1])}
                {ref.y !== today.y && (
                  <span style={{ fontSize: 11.5, opacity: 0.7, marginInlineStart: 5, ...LATIN }}>{ref.y}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {browsing && fetchedTab && <SectionLabel>{monthByTab(fetchedTab)}</SectionLabel>}

      {undated > 0 && (
        <p style={{
          fontSize: 12.5, color: C.ink, background: C.sand, border: `1px solid ${C.line}`,
          borderRadius: 10, padding: '8px 12px', margin: '10px 0', lineHeight: 1.6, textAlign: 'center',
        }}>
          {S.recentUndatedNote(undated)}
        </p>
      )}

      {/**
        * THE ROWS. The YEAR has none on purpose: twelve months of them is not a
        * list he reads, it is a scroll he abandons, and every one of them is one
        * tap away under «الشهر».
        */}
      {period !== 'year' && <Lookalikes rows={rows} sheetUrl={sheetUrl} />}
      {period !== 'year' && (
        <RowList
          rows={rows} settled={settled} onEdit={onEdit}
          open={open} setOpen={setOpen}
          tabName={fetchedTab || (data.month && data.month.names && data.month.names.cur) || ''}
          /**
            * THE DATE IS DROPPED UNDER «النهاردة» (finding S5). The old grid
            * printed `17/8/2026` once per row on a screen whose title already
            * says which day it is — a quarter of the width spent restating the
            * heading six times. Under a week or a month the date is the one
            * thing distinguishing the rows, so it stays.
            */
          showDate={period !== 'today'}
          emptyTitle={period === 'today' ? S.todayEmptyTitle : null}
          emptyBody={period === 'today' ? S.todayEmptyBody : S.recentEmpty}
        />
      )}

      {/**
        * «افتح الشيت ↗» (finding A7).
        *
        * The whole trust proposition of this app is that his sheet is untouched
        * and still his. Until now that was ASSERTED, in a subtitle. One link
        * makes it verifiable in a tap — the cheapest trust move available, and
        * the only one that lets him check the app against the book rather than
        * taking its word.
        *
        * RENDERED ONLY WHEN THERE IS A REAL URL to open. A link that goes
        * nowhere, or to the wrong document, damages precisely the thing it
        * exists to prove — so with nothing stored there is no link, and
        * `getSheetUrl` refuses anything that is not an https Google Sheets
        * address.
        */}
      {sheetUrl && (
        <a
          href={sheetUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: TAP, marginTop: 16, borderRadius: 12,
            color: C.harbor, fontSize: 14.5, fontWeight: 600, textDecoration: 'none',
          }}
        >
          {S.openTheSheet}
        </a>
      )}
    </div>
  );
}


const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * TODAY'S ANSWER — the figure, and the two things that qualify it (finding S4).
 *
 * The old screen printed «فيزا 1,149.75» and «كاش 260» in two cards and NO
 * total, on the screen whose entire job is telling him what today came to. He
 * added them himself.
 *
 * THE TRAVEL LINE IS BESIDE THE FIGURE, NEVER INSIDE IT. A non-EGP row is
 * written into his sheet as `"12.5 EUR"` text and is excluded from every EGP sum
 * by D8 — correctly, since adding euros to pounds is not arithmetic. The old
 * screen's exclusion was silent, which meant a day with a foreign purchase
 * showed a total that was quietly missing one. Naming it is the honest-render
 * law applied to a sum rather than to a null.
 */

/**
 * «MIGHT BE THE SAME EXPENSE TWICE» — a report, and only ever a report.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IT OFFERS NO WAY TO REMOVE ANYTHING, AND THAT IS THE CONSTITUTION SPEAKING.
 * docs/09 §4: row deletion is human-only, and the backend has no delete
 * capability and never will. So this card ends at a sentence and a link INTO his
 * sheet; the removing is done by him, in his own book, with both rows in front
 * of him. `state/duplicates.js` cannot act either — its suite asserts that.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * IT SUGGESTS AND NEVER ASSERTS, because two identical coffees on one day is a
 * real pattern, not an error. Every string here is "look at these", never
 * "these are duplicates" — the same reason `dupBook` flags a receipt instead of
 * refusing it (06 §3.4). The system does not know which of two true-looking rows
 * is the mistake; the man holding the phone does.
 *
 * Runs over the rows ALREADY ON SCREEN — no extra read, and the population it
 * examined is the one he is looking at, so the card can never describe a month
 * he is not on.
 */
function Lookalikes({ rows, sheetUrl }) {
  const report = findLookalikes(rows);
  const counts = lookalikeCounts(report);
  if (!counts.groups) return null;              // the ordinary case is silence

  return (
    <div style={{
      marginTop: 14, padding: '13px 15px', borderRadius: 14,
      background: C.conflictBg, border: `1px solid ${C.conflictLine}`,
    }}>
      <div style={{ color: C.conflictInk, fontSize: 15, fontWeight: 700 }}>
        {S.dupTitle(counts.rows)}
      </div>
      <div style={{ color: C.ink, fontSize: 14, marginTop: 4, lineHeight: 1.55 }}>
        {S.dupBody}
      </div>

      {report.groups.map((g) => (
        <div key={g.key} style={{
          marginTop: 10, padding: '9px 11px', borderRadius: 10,
          background: C.card, border: `1px solid ${C.line}`,
        }}>
          {/* The tier is stated in words — a percentage would invite him to
              trust a number this has no basis to produce. */}
          <div style={{ color: C.muted, fontSize: 12.5, fontWeight: 700 }}>
            {S.dupTier(g.tier)}
          </div>
          {g.rows.map((r, i) => (
            <div key={`${g.key}#${i}`} style={{
              display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 5,
            }}>
              <span style={{ color: C.ink, fontSize: 14.5, ...ISOLATE }}>
                {r.description || S.dupNoDescription}
              </span>
              <span style={{ color: C.ink, fontSize: 14.5, fontWeight: 700, ...NUMERALS, ...LATIN }}>
                {amountWithCurrency(r.amount, r.currency)}
              </span>
            </div>
          ))}
        </div>
      ))}

      {/**
        * WHAT IT DID NOT EXAMINE, IT SAYS. An unpriced row has nothing to match
        * on, so it is never grouped — and a detector that silently skipped part
        * of its population would be a check that cannot fail on what it dropped.
        */}
      {report.unpriced > 0 && (
        <div style={{ color: C.muted, fontSize: 12.5, marginTop: 9 }}>
          {S.dupUnpriced(report.unpriced)}
        </div>
      )}

      {/* The only exit: his sheet. Deliberately not a button that does it for
          him — see the header of this component. */}
      {sheetUrl && (
        <a
          href={sheetUrl} target="_blank" rel="noreferrer"
          style={{
            display: 'inline-block', marginTop: 11, minHeight: TAP, lineHeight: '30px',
            color: C.harbor, fontSize: 14, fontWeight: 700, textDecoration: 'underline',
          }}
        >
          {S.dupOpenSheet}
        </a>
      )}
    </div>
  );
}

function TodayHead({ totals, entries, onGoToInbox, unsettledBatch = 0, onOpenBatch }) {
  const egp = egpTotalOf(totals);
  const travel = travelOf(entries);
  const unknown = (entries || []).filter((e) => needsCategory(e)).length;

  return (
    <div style={{ textAlign: 'center', padding: '2px 0 16px' }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 42, fontWeight: 650, ...NUMERALS, ...LATIN, lineHeight: 1.05 }}>
        {money(egp)}
      </div>
      <div style={{ fontSize: 13.5, color: C.muted, marginTop: 3 }}>
        {S.currency} · {S.todayCount((entries || []).length)}
      </div>
      <div style={{ fontSize: 13.5, color: C.muted, marginTop: 7, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <span>{S.metricVisa} <b style={{ color: C.ink, ...LATIN }}>{moneyRound(totals.Visa)}</b></span>
        <span>{S.metricCash} <b style={{ color: C.ink, ...LATIN }}>{moneyRound(totals.Cash)}</b></span>
      </div>
      {/* Only when there IS one. A day with no foreign spending says nothing
          about foreign spending — the silence is the ordinary case. */}
      {travel.length > 0 && (
        <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>
          {S.travel} {travel.map((t) => (
            <span key={t.currency} style={{ ...LATIN, marginInlineStart: 4 }}>{money(t.amount)} {t.currency}</span>
          ))} — {S.travelApart}
        </div>
      )}
      {/**
        * EXPENSES NOT YET LOGGED — money missing from his book, said out loud on
        * the screen he opens every evening. Silence here is the same defect as
        * «This week 0»: a screen that looks complete while something real is
        * absent from it. Distinct from «محتاجين نوع» below, and deliberately so —
        * that one is money IN the book needing a label; this is money that is
        * not in the book at all.
        */}
      {unsettledBatch > 0 && onOpenBatch && (
        <button
          onClick={onOpenBatch}
          style={{
            marginTop: 12, minHeight: TAP, borderRadius: 12, padding: '9px 16px',
            background: C.sand, border: `1px solid ${C.line}`,
            color: C.amberInk, fontSize: 14.5, fontWeight: 700,
          }}
        >
          {S.batchWaiting(unsettledBatch)}
        </button>
      )}

      {unknown > 0 && (
        <button
          onClick={onGoToInbox}
          style={{
            marginTop: 12, minHeight: TAP, borderRadius: 12, padding: '9px 16px',
            background: C.conflictBg, border: `1px solid ${C.conflictLine}`,
            color: C.conflictInk, fontSize: 14.5, fontWeight: 700,
          }}
        >
          {S.todayNeedCategory(unknown)}
        </button>
      )}
    </div>
  );
}

/**
 * A CHARTED PERIOD, answer-first (finding M5).
 *
 * The figure and the sentence come from `periodTotals` — the SAME call the
 * metric cards inside `PeriodSummary` make, so the headline and the card can
 * never disagree about the period's total.
 */
/**
 * EXPORTED for the same reason `MonthScreen` is: a period sits behind a tab
 * press no server render can make, and the «This week 0» defect is precisely the
 * class where every function is correct and the SCREEN is wrong. A suite that
 * can only read this file's source text cannot see a percentage being rendered.
 */
export function PeriodBlock({
  data, labels = [], liveIndex = -1, metric = 'all', setMetric = () => {},
  names = { cur: '', prev: '' }, showBars = false, offPlot, footnote,
}) {
  const totals = periodTotals(data, METRICS, offPlot || {});
  const shown = totals[metric] || totals.all;
  /**
   * THE «THIS WEEK 0» RULE, APPLIED BEFORE THE PERCENTAGE IS COMPUTED.
   *
   * A week spent entirely abroad has an EGP total of zero and would render «0»
   * beside «▼100%» — telling him he spent nothing in a week he spent two hundred
   * euros. `mayCompare` is consulted FIRST rather than used to suppress a
   * percentage afterwards, so there is no path on which the misleading figure
   * exists at all.
   */
  const foreign = data && data.foreign;
  const prevForeign = data && data.prevForeign;
  const lines = foreignLines(foreign);
  const unsized = unsizedForeign(foreign);
  const cmp = mayCompare(foreign, prevForeign) ? comparisonOf(shown.now, shown.prevAt) : null;

  return (
    <>
      <div style={{ textAlign: 'center', padding: '2px 0 12px' }}>
        <div style={{ fontSize: 13.5, color: C.muted }}>{names.cur}</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 42, fontWeight: 650, ...NUMERALS, ...LATIN, lineHeight: 1.05 }}>
          {moneyRound(shown.now)}
        </div>
        {/**
          * ONE SENTENCE, and it is not drawn when it cannot be earned.
          * `comparisonOf` returns null where there is no comparison figure or the
          * previous period was zero — against which every change is "infinitely
          * more". Rendering «▲ ∞%» there is the kind of confident nonsense the
          * honest-render law exists to stop.
          */}
        {/**
          * NEVER A BARE TOTAL. Where foreign money exists the EGP figure is a
          * PART of the period, and may only appear accompanied by what it
          * excludes — one line per currency, never summed across them.
          */}
        {hasForeign(foreign) && (
          <div style={{ fontSize: 14.5, color: C.muted, marginTop: 6, lineHeight: 1.7 }}>
            {lines.map((l) => (
              <span key={l.currency} style={{ marginInlineEnd: 10 }}>
                {S.andAlso} <b style={{ color: C.ink, ...LATIN }}>{moneyRound(l.amount)} {l.currency}</b>
              </span>
            ))}
            {/* Money we know is there and cannot size — said, not implied. */}
            {unsized > 0 && <div style={{ fontSize: 13 }}>{S.foreignUnsized(unsized)}</div>}
            <div style={{ fontSize: 13, marginTop: 2 }}>{S.foreignNoCompare}</div>
          </div>
        )}

        {cmp ? (
          <div style={{ fontSize: 16, marginTop: 6 }}>
            {cmp.direction === 'same'
              ? S.sameAs(names.prev)
              : (
                <>
                  {cmp.direction === 'down' ? S.lessThan(names.prev) : S.moreThan(names.prev)}{' '}
                  <b style={{ color: cmp.direction === 'down' ? C.settledInk : C.conflictInk, ...LATIN }}>{cmp.pct}%</b>
                  <span style={{ color: C.muted, fontSize: 14 }}> ({S.wasThen} <span style={LATIN}>{moneyRound(cmp.prevAt)}</span>)</span>
                </>
              )}
          </div>
        ) : hasForeign(foreign) || hasForeign(prevForeign) ? null : (
          <div style={{ fontSize: 13.5, color: C.muted, marginTop: 6 }}>{S.noComparison(names.prev)}</div>
        )}
      </div>

      <PeriodSummary
        data={data} labels={labels} liveIndex={liveIndex}
        metric={metric} setMetric={setMetric}
        periodNames={{ cur: names.cur, prev: names.prev }}
        showBars={showBars} footnote={footnote} offPlot={offPlot}
        /**
         * The cards carry percentages too. Gating only the headline left «▼100%»
         * on a period whose EGP figure is a subset — smaller type, same lie.
         */
        comparable={mayCompare(foreign, prevForeign)}
      />
    </>
  );
}

/**
 * THE MONTH SCREEN — the card, and under it the accountability list (D16d).
 *
 * Its own EXPORTED component, and that is a testing decision as much as a
 * structural one: the Month sits behind a tab press no server render can make,
 * so while this lived inline the only thing a suite could check about it was the
 * shape of its source text. Three of this project's bugs were correct components
 * mounted with the wrong props — the class a source regex cannot see. As a
 * component, `test-accountability.mjs` renders exactly what he sees.
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
   * total: `totals = sum(byDay) + undated` by construction.
   */
  const monthTrueTotal = data.month
    ? (data.month.cur.Visa || []).reduce((a, v) => a + (v || 0), 0)
      + (data.month.cur.Cash || []).reduce((a, v) => a + (v || 0), 0)
      + (undated?.Visa || 0) + (undated?.Cash || 0)
    : null;

  /**
   * WHETHER THE LIST CAN BACK A TOTAL — the V17/V18 gate, and the signal is the
   * FIELD'S PRESENCE, never its value. A clean V18 month sends
   * `uncategorized: {count: 0, total: 0}` and its list DOES add up, so it MUST
   * still show the line. A value test would hide the total on exactly the months
   * where the claim is most defensible. Do not "simplify" this into one.
   */
  const listAccountsForTheMonth = data.month?.uncategorized !== undefined;

  /**
   * ONE CAVEAT LINE, NOT TWO STACKED BLOCKS (finding M8).
   *
   * These rendered as two sand-coloured panels in sequence, between the chart
   * and the categories, on the screen he opens for reassurance — which reads as
   * an error state even though each sentence is true and required. Joined into
   * one line, and it sits directly under the figure it qualifies rather than
   * halfway down the screen away from it.
   */
  const caveats = [];
  if (unpriced && unpriced.count > 0) caveats.push(S.unpricedNote(unpriced.count));
  if (undated && undated.count > 0) caveats.push(S.undatedNote(undated.count));
  const footnote = caveats.length ? (
    <p style={{
      fontSize: 12.5, color: C.ink, background: C.sand, border: `1px solid ${C.line}`,
      borderRadius: 10, padding: '8px 12px', margin: '10px 0 0', lineHeight: 1.6, textAlign: 'center',
    }}>
      {caveats.join(' · ')}
    </p>
  ) : null;

  return (
    <>
      <PeriodBlock
        data={data.month} labels={[]} liveIndex={-1}
        metric={metric} setMetric={setMetric}
        names={{ cur: monthName(data.month.names.cur), prev: monthName(data.month.names.prev) }}
        showBars={false}
        footnote={footnote}
        /**
         * The undated rows ARE the month; they are simply not on the curve.
         * Handing them here makes the card show the true month total, which is
         * what the accountability list reconciles against — one number, one
         * screen.
         */
        offPlot={{ Visa: undated?.Visa || 0, Cash: undated?.Cash || 0 }}
      />
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


/**
 * THE ROWS — cards, not a grid, and every gap is a door.
 *
 * This is «الأخير»'s row, which won the merge: the date sits with the method and
 * the category on one quiet line under the description, so nothing wraps and
 * nothing is repeated six times.
 */
function RowList({ rows, settled, onEdit, open, setOpen, tabName, showDate, emptyTitle, emptyBody }) {
  if (!rows.length) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 60 }}>
        {emptyTitle && (
          <>
            <div style={{ fontSize: 46 }}>🌙</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 21, fontWeight: 650, color: C.harbor, marginTop: 8 }}>
              {emptyTitle}
            </div>
          </>
        )}
        <div style={{ color: C.muted, fontSize: 15.5, marginTop: 8 }}>{emptyBody}</div>
      </div>
    );
  }

  return (
    <div>
      {rows.map((row, i) => {
        /**
         * The settle key carries the row's CONTENT, because a row here has no
         * sheet position — two purchases from the same shop on the same day for
         * the same amount really are indistinguishable, here and in his book.
         * This value is a KEY only; the edit payload never carries a rowHint.
         */
        const item = { tab: tabName || row.date, rowHint: `${row.date}|${row.amount}`, match: row };
        const key = `${cardKey(item)}:${i}`;
        const outcome = settled[cardKey(item)] || null;
        const isOpen = open === key;
        const inert = !needsHim(outcome);
        // A row still waiting for a category is the gap the Inbox exists for.
        // Here it is a door rather than a red mark (finding M6). The predicate
        // is shared because `❓` is a real value, not an empty cell — see
        // state/book.js for the version of this that shipped wrong.
        const gap = needsCategory(row);

        return (
          <div
            key={key}
            style={{
              background: gap ? C.shell : C.card, border: `1px solid ${gap ? C.conflictLine : C.line}`,
              borderRadius: 14, marginBottom: 8, opacity: inert ? 0.62 : 1, transition: 'opacity .2s ease',
            }}
          >
            <button
              onClick={() => setOpen(isOpen ? null : key)}
              aria-expanded={isOpen}
              style={{
                width: '100%', minHeight: TAP, padding: '12px 14px', textAlign: 'start',
                background: 'transparent', display: 'grid', gap: 4,
                gridTemplateColumns: '1fr auto', alignItems: 'center',
              }}
            >
              <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 600, ...LATIN, overflow: 'hidden', textOverflow: 'ellipsis' }} dir="auto">
                  {row.description}
                </span>
                <span style={{ fontSize: 12.5, color: C.muted, display: 'flex', gap: 8, alignItems: 'center' }}>
                  {showDate && <span style={LATIN}>{row.date}</span>}
                  <Chip kind={row.method} small label={row.method === 'Visa' ? S.metricVisa : S.metricCash} />
                  {gap
                    ? <span style={{ color: C.harbor, fontWeight: 700 }}>{S.rowNeedsCategory}</span>
                    : <span style={{ color: C.ink }} dir="auto">{categoryLabel(row.category)}</span>}
                  {/**
                    * HE NEVER CHOSE THIS ONE (finding A2, re-scoped).
                    *
                    * The server flags a row whose category the merchant memory
                    * would have picked — which is to say, one no human judgement
                    * stands behind. Since Phase 1 those have been filed silently
                    * on capture, so a merchant taught the wrong category once
                    * files wrongly forever and only a hand reconciliation finds
                    * it.
                    *
                    * Deliberately QUIET: a small mark, not a warning. It is the
                    * overwhelmingly common case — most of his card spending is
                    * merchants Memory knows — and the row is already tappable to
                    * change. Anything louder would turn the app working well
                    * into a screen full of alerts.
                    */}
                  {row.auto && !gap && (
                    <span style={{ color: C.muted, fontSize: 12 }} title={S.rowAutoTitle}>
                      {S.rowAuto}
                    </span>
                  )}
                </span>
              </span>
              {/* An unpriced row renders —, never 0: a figure he never wrote. */}
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 17, fontWeight: 650, color: C.ink, ...LATIN, ...NUMERALS }}>
                {row.amount == null ? '—' : money(row.amount)}
                {row.amount != null && row.currency && row.currency !== 'EGP'
                  ? <span style={{ fontSize: 12, color: C.muted }}> {row.currency}</span> : null}
              </span>
            </button>

            {isOpen && (
              <div style={{ padding: '0 14px 14px' }}>
                <OutcomeNote outcome={outcome} />
                <CategoryActions guess={null} outcome={outcome} onPick={(category) => onEdit(item, category)} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
