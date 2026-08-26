import { useState, useEffect, useCallback, useRef } from 'react';
import {
  C, METHOD, FONT_DISPLAY, FONT_UI, NUMERALS, TAP, TYPE, RADIUS, SPACE, GLYPH, MOTION, unitSize,
} from '../theme.js';
import { S, DIR, monthName, monthByTab, categoryLabel, WEEK_DAYS, MONTH_LABELS } from '../i18n/strings.js';
import { METRICS } from '../lib/constants.js';
import { money, moneyRound, amountWithCurrency } from '../lib/format.js';
import { periodTotals, comparisonOf, seriesFor, lastIdxOf, comb, typicalBand } from '../lib/series.js';
import { PRIORITY_GROUPS, groupOf } from '../lib/priorities.js';
import { hasForeign, mayCompare, foreignLines, unsizedForeign } from '../state/foreign.js';
import { leadAndAsides, getDisplayCurrency, HOME_CURRENCY } from '../state/display.js';
import { fetchEntries } from '../api/index.js';
import { findLookalikes, lookalikeCounts } from '../state/duplicates.js';
import { PeriodSummary, CategoryCompare, PriorityLens, MonthStack } from '../components/Charts.jsx';
import { Chip, LATIN, ISOLATE, SectionLabel, Rail, Sheet } from '../components/Primitives.jsx';
import { OutcomeNote, CategoryActions } from '../components/CategoryPicker.jsx';
import { cardKey, needsHim } from '../state/inboxOutcomes.js';
import { monthStrip, monthsFor, filterEntries, undatedIn, sortForDisplay, parseSheetDate } from '../state/recent.js';
import { bookPeriods, rowsSource, travelOf, egpTotalOf, needsCategory } from '../state/book.js';
import { getSheetUrl } from '../state/secret.js';
import { lensOpen as loadLensOpen, setLensOpen } from '../state/lens.js';
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
/**
 * B1 — THE MOTION LAW'S GUARD, AS A HOOK.
 *
 * styles.css guards its class-based transitions under the
 * `prefers-reduced-motion` media query, but an INLINE transition outranks any
 * class rule, so the guard for inline motion must live where the style does.
 * The pill's transition collapses to an instant state change when the person
 * asked the OS for less motion — the position still updates, the content is
 * never hidden; only the travel between the two states is skipped.
 *
 * Subscribed, not merely read: flipping the OS setting mid-session takes
 * effect on the next slide rather than on the next launch. Old WebKit exposes
 * `addListener` only; there the guard degrades to its mount-time answer
 * rather than crashing the Book.
 */
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
const prefersReducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia(REDUCED_MOTION).matches;
function useReducedMotion() {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return undefined;
    const mq = matchMedia(REDUCED_MOTION);
    const onChange = () => setReduced(!!mq.matches);
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
    return undefined;
  }, []);
  return reduced;
}

/**
 * N7 — the four groups' icons, beside their words and never instead of them
 * (north-star §4.5: «icon PLUS word, never icon-only»). The WORDS come from
 * `S.lensGroup` — the lens's own vocabulary, one copy — so a chip and the
 * lens panel can never disagree about what a group is called. The icons are
 * presentation constants, exactly like the map they decorate: re-drawable at
 * any time, touching nothing stored.
 */
export const PRIORITY_ICONS = { essentials: '🏠', health: '🩺', joy: '🎈', projects: '🧰' };

export default function BookView({
  data, settled = {}, onEdit, onGoToInbox, onBusyChange,
  unsettledBatch = 0, onOpenBatch,
  /**
   * N7 — the filter's seed, for the same reason PeriodBlock takes
   * `policyOpen`: the chips live behind taps SSR cannot make, and a suite
   * must render the FILTERED screen, not trust the event plumbing.
   */
  initialPriorityFilter = null,
  /**
   * The install's reading unit (D23). A PROP rather than a module read inside
   * `PeriodBlock`, so a suite can render the same week in either unit without a
   * storage shim — and so there is exactly one place the choice enters the
   * screen. Defaults to the book's own unit: Dad's install is unmoved.
   */
  displayCurrency = getDisplayCurrency(),
}) {
  const [period, setPeriod] = useState('today');
  /**
   * N7 — WHICH PRIORITY GROUP THE LIST IS READ THROUGH, or null for all of it.
   * A lens over the rows, never a claim about them: the chips are always on
   * screen stating which one is pressed, and the count line restates the
   * result in words, so a filtered list can never pass for a complete one.
   */
  const [priorityFilter, setPriorityFilter] = useState(initialPriorityFilter);
  /** N6 — whether the month sheet is up. The heading is its only opener. */
  const [pickerOpen, setPickerOpen] = useState(false);
  /**
   * N6 — THE BROWSED MONTH'S ANSWER, whole: the chosen month's rows and the
   * month-before's, kept WITH the ref they answer. The render gate compares
   * this ref against `browsing` so a slower month's data can never dress the
   * head of a faster tap — the same months-don't-match law the loading state
   * enforces for the rows, applied to the figure above them.
   */
  const [browsed, setBrowsed] = useState(null);
  /**
   * THE PRIORITIES LENS'S OPEN STATE — read once, at the top, with every other
   * hook. Never below a branch: a `useEffect` under an early return is what took
   * the whole app out on launch with «rendered more hooks than during the
   * previous render», and hook ORDER is invisible to a pure suite and to SSR.
   */
  const [lensIsOpen, setLensIsOpen] = useState(() => loadLensOpen());
  const [metric, setMetric] = useState('all');
  const [browsing, setBrowsing] = useState(null);   // a specific {y,m}, or null
  const [fetched, setFetched] = useState([]);
  const [fetchedTab, setFetchedTab] = useState('');
  const [loadingRows, setLoadingRows] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [sortBy, setSortBy] = useState('date');   // 'date' | 'amount' | 'name'
  /**
   * THE FETCH SEQUENCE — answers are only as ordered as the network feels like.
   *
   * Field-found (Tarek, 2026-08-24): he tapped July, then June seconds later.
   * Two reads in flight; whichever resolves LAST wins the screen, and a cold
   * closed-month read takes 15–25 s while a cached one takes two — so July's
   * answer landing after June's would render July's rows under June's chip.
   * Every await below checks it still holds the latest ticket and otherwise
   * drops its answer unrendered. Last-tap-wins, not last-network-wins.
   */
  const fetchSeq = useRef(0);
  /**
   * CLOSED MONTHS DO NOT CHANGE UNDER HIM MID-SESSION — his book is append-at-
   * the-current-month — so a browsed month is kept for the session and a
   * return visit renders instantly instead of re-paying the Apps Script round
   * trip. The CURRENT month is deliberately never cached here: it is the one
   * that grows, and the server's own 60 s blob is the freshness authority.
   * Session-lifetime only (a ref, not storage): a new visit re-reads truth.
   */
  const monthCache = useRef(new Map());
  const [undated, setUndated] = useState(0);
  const [open, setOpen] = useState(null);
  // Read once — it cannot change while he is looking at the screen.
  const [sheetUrl] = useState(() => getSheetUrl());
  // B1 — with every other hook, at the top, never below a branch (the same
  // hook-order law the lens state above states in full).
  const reducedMotion = useReducedMotion();

  const today = data.today_cairo;
  const liveWeekIndex = new Date(Date.UTC(today.y, today.m - 1, today.d)).getUTCDay();

  /**
   * Today's rows ride on the `summary` every screen already fetched; week and
   * month need their own read. That split is `rowsSource`, stated once so this
   * component cannot drift into fetching a period it already has in hand — a
   * needless Apps Script cold start on the screen he opens most.
   */
  const needsFetch = rowsSource(period, browsing) === 'fetch';

  const load = useCallback(async (force) => {
    /**
     * THE TICKET IS CLAIMED FIRST, EVEN WHEN NOTHING WILL BE FETCHED — the
     * verification pass refuted the first version here: the !needsFetch return
     * sat ABOVE the claim, so tapping «النهاردة» during a cold June read issued
     * no new ticket, the abandoned June fetch still held the latest one, and on
     * resolve it wrote June's rows, tab and undated count into a screen now
     * showing Today — while the spinner it had set stayed up for the whole 20 s.
     * "Last tap wins" only holds if every tap takes a ticket, fetching or not.
     */
    const ticket = ++fetchSeq.current;
    if (!needsFetch || period === 'year') {
      // The year renders no row list (a 12-month scroll is a scroll he
      // abandons), so fetching for it would be a paid Apps Script read nothing
      // displays — and its undated note would be scoped to one month, a wrong
      // number on a screen about twelve.
      setLoadingRows(false);
      return true;
    }
    if (force) {
      // The header refresh button means "read it AGAIN" — serving the session
      // cache from it would make the one control that promises freshness the
      // one place staleness hides.
      monthCache.current.clear();
    }
    const cacheKey = (ref) => `${ref.y}_${ref.m}`;
    const isClosed = (ref) => !(ref.y === today.y && ref.m === today.m);
    try {
      /**
       * N6 — a browsed month is fetched WITH the month before it, because the
       * chosen month is compared against ITS OWN predecessor — June against
       * May, never against whatever the live screen happens to compare with.
       * The cache makes the second read free on a revisit.
       */
      const months = browsing ? [browsing, monthBefore(browsing)] : monthsFor(period === 'year' ? 'month' : period, today);
      /**
       * LOADING IS A STATE THE SCREEN ADMITS TO. The old code kept the previous
       * rows on screen while the next month loaded — so a slow read left August
       * rendered under a tapped June for twenty seconds, which on a phone reads
       * as "the months do not match the transactions", because that is exactly
       * what the screen said. Stale rows presented as current are a confident
       * wrong answer; «loading» is a true one.
       */
      const allCached = months.every((ref) => monthCache.current.has(cacheKey(ref)));
      if (!allCached) setLoadingRows(true);
      const answers = await Promise.all(months.map(async (ref, i) => {
        const hit = monthCache.current.get(cacheKey(ref));
        if (hit) return hit;
        try {
          const a = await fetchEntries(ref);
          if (a && Array.isArray(a.entries) && isClosed(ref)) {
            monthCache.current.set(cacheKey(ref), a);
          }
          return a;
        } catch (err) {
          /**
           * ONLY THE COMPARISON MONTH MAY FAIL QUIETLY (N6). The month HE
           * CHOSE failing is the screen's failure and rethrows into the catch
           * below; the month-before exists only to stand beside it, and
           * refusing to show June because May was unreachable would punish
           * the answer for the loss of its context. Its absence renders AS
           * absence: null series, so the screen says «no comparison» in
           * words rather than inventing a quiet month of zeros.
           */
          if (browsing && i === 1) return null;
          throw err;
        }
      }));
      // A superseded answer is DROPPED, whole — rendering it would put the
      // slower month's rows under the faster tap's chip.
      if (ticket !== fetchSeq.current) return true;
      /**
       * A WELL-FORMED {ok:false} IS A REAL ANSWER, NOT ZERO ROWS. The transport
       * throws only on transport failure; a server refusal resolves normally —
       * and flat-mapping it to [] rendered «no expenses this month» over a
       * month the server had just REFUSED to read: the honest-render law
       * violated for a whole month at once (verification finding). A refusal
       * renders as a refusal. (The browsed comparison month is the one
       * exception, same reasoning as its transport failure above.)
       */
      if (answers.some((a, i) => a && a.ok === false && !(browsing && i === 1))) {
        setFetched([]); setFetchedTab(''); setUndated(0); setBrowsed(null);
        setLoadError(true); setLoadingRows(false);
        return false;
      }
      setLoadError(false);
      if (browsing) {
        const chosen = answers[0];
        const rowsIn = chosen && Array.isArray(chosen.entries) ? chosen.entries : [];
        const before = answers[1];
        setFetched(sortForDisplay(rowsIn));
        // The CHOSEN month's tab — the edit path posts against it, and the
        // server requires date equality within the named tab.
        setFetchedTab((chosen && chosen.tab) || '');
        setBrowsed({
          ref: browsing,
          entries: rowsIn,
          // A refused/unreachable comparison month is NULL — absence, never [].
          prevEntries: before && before.ok !== false && Array.isArray(before.entries) ? before.entries : null,
        });
        setUndated(0);
        setLoadingRows(false);
        return true;
      }
      setBrowsed(null);
      const all = answers.flatMap((a) => (a && Array.isArray(a.entries) ? a.entries : []));
      const shown = filterEntries(all, period, today);
      setFetched(sortForDisplay(shown));
      setFetchedTab(answers.length === 1 && answers[0] ? answers[0].tab || '' : '');
      // Counted from the rows ON SCREEN: a week spanning two months is assembled
      // from two responses and neither one's figure describes it.
      setUndated(period === 'month' ? 0 : undatedIn(all));
      setLoadingRows(false);
      return true;
    } catch {
      // Losing signal in Cairo is normal. Keep what is on screen and say nothing
      // it cannot back up — the shell's offline banner is the one that speaks.
      if (ticket === fetchSeq.current) { setLoadingRows(false); setLoadError(true); }
      return false;
    }
  }, [period, browsing, today, needsFetch]);

  useEffect(() => { load(); }, [load]);
  // The header's refresh button reloads THIS view's data while it is showing.
  useEffect(() => { if (onBusyChange) onBusyChange(() => load(true)); }, [onBusyChange, load]);

  /**
   * AN EDIT INVALIDATES THE CACHED MONTH IT TOUCHED. The cache's premise —
   * closed months do not change mid-session — is falsified by exactly one
   * actor: him, editing a browsed row. Without this, a fixed ❓ kept showing
   * as ❓ from the cache for the rest of the session, and the refresh button
   * (now force=true) was the only exit.
   */
  const editThenBust = useCallback((item, category) => {
    if (browsing) monthCache.current.delete(`${browsing.y}_${browsing.m}`);
    return onEdit(item, category);
  }, [browsing, onEdit]);

  const fetchedOrToday = needsFetch ? fetched : sortForDisplay(data.today.entries || []);
  /**
   * SORTING (Tarek, 2026-08-24). Three orders, stated in words. Date stays the
   * default and the definition stays `sortForDisplay`'s — one definition of
   * display order, not two. Amount: largest first, UNPRICED ROWS LAST BUT
   * PRESENT (an absent amount is `—`, not zero, so it cannot be ordered among
   * numbers — hiding it would be the quiet version of «This week 0»). Name:
   * locale compare, so Arabic descriptions sort as Arabic.
   */
  const sorted = sortBy === 'date' ? fetchedOrToday
    : [...fetchedOrToday].sort(sortBy === 'amount'
      ? (a, b) => {
        const an = typeof a.amount === 'number' ? a.amount : null;
        const bn = typeof b.amount === 'number' ? b.amount : null;
        if (an === null && bn === null) return 0;
        if (an === null) return 1;
        if (bn === null) return -1;
        return bn - an;
      }
      : (a, b) => String(a.description || '').localeCompare(String(b.description || ''), undefined, { sensitivity: 'base' }));

  /**
   * N7 — THE FILTER APPLIES AFTER THE SORT, so «largest first» means largest
   * of what is shown. `groupOf` is the ratified map's own reader — a ❓ row
   * and an unplaced category belong to NO group, so every filter drops them:
   * a chip may not adopt money nobody has placed. Their door back is clearing
   * the filter, which is always one tap and always visible.
   */
  const rows = priorityFilter
    ? sorted.filter((r) => groupOf(r && r.category) === priorityFilter)
    : sorted;

  const periods = bookPeriods();
  const activeIdx = Math.max(0, periods.indexOf(period));
  /** N6 — the current month IS the live screen; any other month browses. */
  const chooseMonth = (ref) => {
    setPickerOpen(false);
    setBrowsing(ref.y === today.y && ref.m === today.m ? null : ref);
  };

  const seg = (key) => (
    <button
      key={key}
      onClick={() => { setBrowsing(null); setPickerOpen(false); setPeriod(key); }}
      aria-pressed={period === key}
      style={{
        // The fill lives on the sliding pill behind this row (B1); a second
        // fill here would ghost the pill mid-slide. `position: relative`
        // paints the label above the pill.
        flex: 1, minHeight: TAP, padding: '11px 0', borderRadius: RADIUS.capsule,
        background: 'transparent', position: 'relative',
        color: period === key ? C.onDark : C.ink,
        fontSize: TYPE.label, fontWeight: period === key ? 700 : 600,
      }}
    >
      {S[`period${key[0].toUpperCase()}${key.slice(1)}`]}
    </button>
  );

  return (
    <div>
      {/* The closed month, handed over on the first of the next one (W-6). */}
      <LogCard prevLog={data.month && data.month.prevLog} todayCairo={today} />

      <div style={{ display: 'flex', position: 'relative', background: C.card, border: `1px solid ${C.line}`, borderRadius: RADIUS.capsule, padding: 4, marginBottom: 14, gap: 2 }}>
        {/**
          * B1 — THE SLIDING HARBOR PILL (north-star §4.2: the highest-leverage
          * motion in the app — he switches periods constantly). ONE indicator
          * that RELOCATES, so the eye carries the selection from the old
          * period to the new instead of watching two fills swap. Decoration
          * only (aria-hidden): the buttons' own aria-pressed stays the truth.
          *
          * The width is the control's inner quarter (padding 8, three 2px
          * gaps); each step is one pill-width plus one gap. In RTL the first
          * period sits at the RIGHT, so the step runs negative — the same
          * physical-direction trap as the Rail's mask, answered the same way.
          * MOTION.move/easeOut because this is a relocation within a screen;
          * the reduced-motion guard collapses it to an instant jump.
          */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', top: 4, bottom: 4, insetInlineStart: 4,
            width: `calc((100% - ${8 + (periods.length - 1) * 2}px) / ${periods.length})`,
            borderRadius: RADIUS.capsule, background: C.harbor,
            transform: `translateX(calc(${(DIR === 'rtl' ? -1 : 1) * activeIdx} * (100% + 2px)))`,
            transition: reducedMotion ? 'none' : `transform ${MOTION.move}ms ${MOTION.easeOut}`,
          }}
        />
        {periods.map(seg)}
      </div>

      {/**
        * B2's PERIOD HALF (the shell leaf keys tab swaps; this keys period
        * swaps): a new key remounts the period subtree, so the entrance
        * plays — and the chart's once-per-mount draw correctly re-runs on a
        * genuine period change (B3's documented dependency), never on a poke.
        */}
      <div key={browsing ? `${browsing.y}-${browsing.m}` : period} className="view-in">
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
          displayCurrency={displayCurrency}
        />
      )}

      {!browsing && period === 'month' && (
        <MonthScreen
          data={data} metric={metric} setMetric={setMetric} onGoToInbox={onGoToInbox}
          displayCurrency={displayCurrency}
          lensOpen={lensIsOpen}
          onToggleLens={() => setLensIsOpen((v) => setLensOpen(!v))}
          onPickMonth={() => setPickerOpen(true)}
        />
      )}

      {/**
        * N6 — A BROWSED MONTH IS A WHOLE MONTH SCREEN, not rows under a live
        * head. The old shape kept August's figure and chart above June's rows
        * — the months-don't-match lie at the top of the screen while the
        * loading state was killing it at the bottom. Now the live block
        * stands down and the chosen month renders through the SAME
        * MonthScreen, from `browsedMonthData` — sums of his own fetched rows
        * — compared against the month before the CHOSEN one (May under June,
        * never a hardwired July).
        *
        * Gated on the answer CARRYING the browsed ref: a slower month's data
        * can never dress a faster tap's head, and before the answer lands
        * the ⌛ below is the only claim on screen.
        */}
      {period === 'month' && browsing && !loadingRows && !loadError
        && browsed && browsed.ref.y === browsing.y && browsed.ref.m === browsing.m && (
        <MonthScreen
          data={browsedMonthData(browsing, browsed.entries, browsed.prevEntries, today)}
          metric={metric} setMetric={setMetric} onGoToInbox={onGoToInbox}
          displayCurrency={displayCurrency}
          lensOpen={lensIsOpen}
          onToggleLens={() => setLensIsOpen((v) => setLensOpen(!v))}
          onPickMonth={() => setPickerOpen(true)}
        />
      )}

      {period === 'year' && (
        <PeriodBlock
          data={data.year} labels={MONTH_LABELS} liveIndex={today.m - 1}
          metric={metric} setMetric={setMetric}
          names={{ cur: String(today.y), prev: String(today.y - 1) }} showBars
          displayCurrency={displayCurrency}
        />
      )}
      </div>

      {/**
        * THE MONTH BROWSER, under «الشهر» only — it is the control for choosing
        * WHICH month's rows to read, and it has no meaning under a week or a
        * year. Reverse-chronological since S9.
        */}
      {period === 'month' && (
        <Rail style={{ gap: 8, padding: '14px 0 10px' }}>
          <span style={{ fontSize: TYPE.label, color: C.muted, alignSelf: 'center', whiteSpace: 'nowrap', marginInlineEnd: 4 }}>
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
                  minHeight: TAP, padding: '0 14px', borderRadius: RADIUS.capsule, whiteSpace: 'nowrap', flex: '0 0 auto',
                  background: active ? C.harbor : C.card,
                  border: `1px solid ${active ? C.harbor : C.line}`,
                  color: active ? C.onDark : C.ink, fontSize: TYPE.label, fontWeight: active ? 700 : 500,
                }}
              >
                {monthByTab(MONTH_ABBR[ref.m - 1])}
                {ref.y !== today.y && (
                  // Chip years are one of ruling 2's NAMED caption sites — the
                  // year duplicates what the strip's position already says.
                  <span style={{ fontSize: TYPE.caption, opacity: 0.7, marginInlineStart: 5, ...LATIN }}>{ref.y}</span>
                )}
              </button>
            );
          })}
        </Rail>
      )}

      {/* Gated on !loadingRows with everything else: during a cold July read
          this used to show JUNE's name above July's active chip — the exact
          months-don't-match lie the loading state was added to kill. */}
      {browsing && fetchedTab && !loadingRows && <SectionLabel>{monthByTab(fetchedTab)}</SectionLabel>}

      {/**
        * Real information at the prose floor — a caveat he must be able to
        * read is never caption material. A SAND ADVISORY SURFACE, and it
        * rides B4's Sheet (the Wave-3 residual, honored): the note is not on
        * screen until the fetch answers, so it ARRIVES — lip and entrance are
        * the primitive's, never a second hand-rolled copy, and it keeps its
        * meaning border like every advisory surface (A2's doctrine).
        */}
      {undated > 0 && !loadingRows && period !== 'year' && (
        <Sheet style={{
          fontSize: TYPE.label, color: C.ink, background: C.sand, border: `1px solid ${C.line}`,
          padding: '8px 12px', margin: '10px 0', lineHeight: 1.6, textAlign: 'center',
        }}>
          {S.recentUndatedNote(undated)}
        </Sheet>
      )}

      {/**
        * N7 — PRIORITIES BECOME NAVIGATION (north-star §4.5, the Owner's GAP
        * 4): the ratified lens's four groups as filter chips over the list.
        * Icon PLUS word, at the senior tap floor, riding the shared Rail (the
        * N2 affordance — no hand-rolled overflow). They render only where
        * there are rows to filter: four filters over an empty day would be
        * furniture claiming a job.
        *
        * The count line below them restates a FILTERED list in words — a
        * lens that shows three rows says «3 expenses in Essentials», so a
        * subset can never pass for the whole list. No filter, no count: a
        * count of the unfiltered list would restate the list.
        */}
      {period !== 'year' && !loadingRows && !loadError && sorted.length > 0 && (
        <Rail style={{ gap: 8, padding: '10px 0 4px' }}>
          {PRIORITY_GROUPS.map((g) => {
            const active = priorityFilter === g.key;
            return (
              <button
                key={g.key}
                className="catchip"
                onClick={() => setPriorityFilter(active ? null : g.key)}
                aria-pressed={active}
                style={{
                  minHeight: TAP, padding: '0 14px', borderRadius: RADIUS.capsule,
                  whiteSpace: 'nowrap', flex: '0 0 auto',
                  display: 'inline-flex', alignItems: 'center',
                  background: active ? C.harbor : C.card,
                  border: `1px solid ${active ? C.harbor : C.line}`,
                  color: active ? C.onDark : C.ink,
                  fontSize: TYPE.label, fontWeight: active ? 700 : 500,
                }}
              >
                <span aria-hidden="true" style={{ marginInlineEnd: 6 }}>{PRIORITY_ICONS[g.key]}</span>
                {S.lensGroup(g.key)}
              </button>
            );
          })}
        </Rail>
      )}
      {period !== 'year' && !loadingRows && !loadError && priorityFilter && sorted.length > 0 && rows.length > 0 && (
        <div style={{ fontSize: TYPE.label, color: C.muted, margin: '2px 2px 0' }}>
          {S.priorityCount(rows.length, S.lensGroup(priorityFilter))}
        </div>
      )}

      {/**
        * THE ROWS. The YEAR has none on purpose: twelve months of them is not a
        * list he reads, it is a scroll he abandons, and every one of them is one
        * tap away under «الشهر».
        */}
      {period !== 'year' && !loadingRows && !loadError && <Lookalikes rows={rows} sheetUrl={sheetUrl} />}
      {/**
        * The sort strip earns its place only when there is something to sort —
        * two rows have an order already, whatever it is.
        */}
      {period !== 'year' && !loadingRows && !loadError && rows.length > 2 && (
        <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginTop: 12 }}>
          <span style={{ color: C.muted, fontSize: TYPE.label, fontWeight: 700 }}>{S.sortLabel}</span>
          {['date', 'amount', 'name'].map((k) => (
            <button
              key={k} onClick={() => setSortBy(k)} aria-pressed={sortBy === k}
              style={{
                minHeight: 34, padding: '4px 12px', borderRadius: RADIUS.capsule, fontSize: TYPE.label,
                fontWeight: 600,
                background: sortBy === k ? C.harbor : C.card,
                color: sortBy === k ? C.onDark : C.ink,
                border: `1px solid ${sortBy === k ? C.harbor : C.line}`,
              }}
            >
              {S.sortName(k)}
            </button>
          ))}
        </div>
      )}
      {/**
        * LOADING IS SAID, NOT PAPERED OVER. The alternative — the previous
        * month's rows under this month's chip — is the screenshot that filed
        * this bug.
        */}
      {period !== 'year' && loadingRows && (
        <div style={{ textAlign: 'center', paddingTop: 48, color: C.muted }}>
          {/* A picture sized as geometry (GLYPH), not a headline (theme.js). */}
          <div style={{ fontSize: GLYPH.spot }}>⌛</div>
          <div style={{ fontSize: TYPE.body, marginTop: 8 }}>{S.rowsLoading}</div>
        </div>
      )}
      {period !== 'year' && !loadingRows && loadError && (
        <div style={{ textAlign: 'center', paddingTop: 48, color: C.muted }}>
          <div style={{ fontSize: GLYPH.spot }}>🌫</div>
          <div style={{ fontSize: TYPE.body, marginTop: 8 }}>{S.rowsLoadFailed}</div>
        </div>
      )}
      {period !== 'year' && !loadingRows && !loadError && (
        <RowList
          rows={rows} settled={settled} onEdit={editThenBust}
          open={open} setOpen={setOpen}
          /**
            * ⚠️ TODAY'S ROWS NEVER BORROW A BROWSED MONTH'S TAB — refuted into
            * this form by the verification pass. `fetchedTab` survives leaving
            * the months browser (nothing refetches on the way back to
            * «النهاردة»), so the old `fetchedTab || current` fallback aimed
            * every Today category edit at JUNE's tab after a June visit; the
            * server requires date equality within the named tab, so each edit
            * answered `row_not_found` — «editing doesn't work», with no error
            * anywhere. The tab is chosen by WHERE THE ROWS CAME FROM, not by
            * what was fetched most recently.
            */
          tabName={needsFetch
            ? fetchedTab
            : ((data.month && data.month.names && data.month.names.cur) || '')}
          /**
            * THE DATE IS DROPPED UNDER «النهاردة» (finding S5). The old grid
            * printed `17/8/2026` once per row on a screen whose title already
            * says which day it is — a quarter of the width spent restating the
            * heading six times. Under a week or a month the date is the one
            * thing distinguishing the rows, so it stays.
            */
          showDate={period !== 'today'}
          emptyTitle={period === 'today' && !priorityFilter ? S.todayEmptyTitle : null}
          /**
            * N7 — AN EMPTIED FILTER IS A SENTENCE NAMING ITS OWN ZERO
            * («History: 0»). The generic empty line would claim the PERIOD is
            * empty — it is not; only the chosen group is, and the sentence
            * says which. A period that is GENUINELY empty keeps its ordinary
            * words whatever chip is pressed, because there the plain claim is
            * the true one.
            */
          emptyBody={priorityFilter && sorted.length > 0
            ? S.priorityEmpty(S.lensGroup(priorityFilter))
            : (period === 'today' ? S.todayEmptyBody : S.recentEmpty)}
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
            minHeight: TAP, marginTop: 16, borderRadius: RADIUS.row,
            color: C.harbor, fontSize: TYPE.label, fontWeight: 600, textDecoration: 'none',
          }}
        >
          {S.openTheSheet}
        </a>
      )}

      {/* N6 — the month sheet, opened only by the month heading's own tap. */}
      {pickerOpen && period === 'month' && (
        <MonthSheet
          today={today}
          browsing={browsing}
          onChoose={chooseMonth}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}


const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** N6 — which month a chosen month is compared against: its own predecessor. */
export function monthBefore(ref) {
  return ref.m === 1 ? { y: ref.y - 1, m: 12 } : { y: ref.y, m: ref.m - 1 };
}

// Calendar arithmetic only (day 0 of the next month), never "now" — the same
// UTC-as-a-calendar rule state/recent.js runs on.
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

// The server's English month names (they mirror his tab names) — the SAME
// vocabulary `monthName` localizes, so a browsed month's head renders exactly
// like a live one's.
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

/**
 * ONE MONTH'S ROWS, FOLDED INTO THE MONTH PAYLOAD'S OWN SHAPE (chunk N6).
 *
 * Every figure here is a SUM OF ROWS THAT ARRIVED — the browsed head may
 * emphasize and arrange, never invent. The shape's honesty rules, restated at
 * the site because each one has already been a shipped bug somewhere:
 *
 *  · a closed month's quiet day is a TRUE ZERO — the book says nothing was
 *    spent, and that is data (rest-day grammar, north-star §5);
 *  · the CURRENT month's future days are NULL — a day that has not happened
 *    is an absence, and zeros there would drag the cumulative line flat
 *    across the rest of the period;
 *  · a foreign row's money NEVER joins an EGP sum (D8) — it rides the same
 *    `{count, byCurrency}` shape the live month uses, so `mayCompare` and the
 *    asides work unchanged on the browsed path;
 *  · an unpriced row is a COUNT, not a zero; an undated row's money is
 *    off-plot (in the total, not on the curve) exactly like the live month's;
 *  · ❓ money is `uncategorized`, never a category — so the accountability
 *    list reconciles: categories + ❓ = the month, by construction.
 */
function monthSums(rows, ref, todayCairo) {
  const n = daysInMonth(ref.y, ref.m);
  const isCurrent = !!todayCairo && ref.y === todayCairo.y && ref.m === todayCairo.m;
  const live = isCurrent ? Math.min(todayCairo.d, n) : n;
  const perDay = () => Array.from({ length: n }, (_, i) => (i < live ? 0 : null));
  const cur = { Visa: perDay(), Cash: perDay() };
  const undated = { count: 0, Visa: 0, Cash: 0 };
  let unpriced = 0;
  let foreignCount = 0;
  const uncategorized = { count: 0, total: 0 };
  const cats = new Map();
  for (const e of Array.isArray(rows) ? rows : []) {
    if (!e) continue;
    if (e.currency && e.currency !== 'EGP') { foreignCount++; continue; }
    if (e.amount == null || e.amount === '' || !isFinite(Number(e.amount))) { unpriced++; continue; }
    const amt = Number(e.amount);
    const method = e.method === 'Visa' ? 'Visa' : 'Cash';
    const d = parseSheetDate(e.date);
    if (d && d.y === ref.y && d.m === ref.m && d.d <= n) {
      // `|| 0` here is GEOMETRY, not fabrication: a row dated on a slot the
      // null-padding left open (a future day of the current month) makes that
      // day real by carrying money into it.
      cur[method][d.d - 1] = (cur[method][d.d - 1] || 0) + amt;
    } else {
      undated.count += 1;
      undated[method] += amt;
    }
    if (needsCategory(e)) { uncategorized.count += 1; uncategorized.total += amt; }
    else {
      const k = String(e.category).trim();
      cats.set(k, (cats.get(k) || 0) + amt);
    }
  }
  return {
    cur,
    undated,
    unpriced,
    uncategorized,
    cats,
    foreign: {
      count: foreignCount,
      byCurrency: Object.fromEntries(travelOf(rows).map((t) => [t.currency, t.amount])),
    },
  };
}

/**
 * THE BROWSED MONTH'S WHOLE PAYLOAD — the chosen month against the month
 * BEFORE it (N6's «never always-July»). A comparison month we could not read
 * arrives as `prevEntries: null` and renders as ABSENCE: all-null series, a
 * null foreign shape — so the screen says «no comparison» in words rather
 * than comparing against a confident month of zeros nobody fetched.
 */
export function browsedMonthData(ref, entries, prevEntries, todayCairo) {
  const before = monthBefore(ref);
  const c = monthSums(entries, ref, todayCairo);
  const p = prevEntries ? monthSums(prevEntries, before, todayCairo) : null;
  const nullMonth = () => {
    const n = daysInMonth(before.y, before.m);
    const mk = () => Array.from({ length: n }, () => null);
    return { Visa: mk(), Cash: mk() };
  };
  const names = new Set([...c.cats.keys(), ...(p ? p.cats.keys() : [])]);
  return {
    month: {
      cur: c.cur,
      prev: p ? p.cur : nullMonth(),
      /**
       * Q2 (Owner ruling 2026-08-27): the YEAR RIDES THE HEADING on a browsed
       * month outside the current year. The year travels as its own field —
       * appending it to the name here would break monthName()'s English→Arabic
       * lookup at render — and it is present ONLY when it differs from today's
       * year, so the live head and current-year browsing stay just «أغسطس».
       */
      names: {
        cur: MONTH_FULL[ref.m - 1],
        prev: MONTH_FULL[before.m - 1],
        ...(ref.y !== todayCairo.y ? { curY: ref.y } : {}),
        ...(before.y !== todayCairo.y ? { prevY: before.y } : {}),
      },
      undated: c.undated,
      unpriced: { count: c.unpriced },
      uncategorized: c.uncategorized,
      foreign: c.foreign,
      prevForeign: p ? p.foreign : null,
      prevLog: null,
    },
    // Stable order; `prev` is null — absent, never 0 — when the comparison
    // month itself is absent.
    monthCats: [...names].sort().map((name) => ({
      name,
      now: c.cats.get(name) || 0,
      prev: p ? (p.cats.get(name) || 0) : null,
    })),
  };
}

/**
 * N6 — THE MONTH SHEET (north-star §4.4: «the month heading becomes a picker
 * (serif month sheet)»; the Owner's GAP 3: «we can't go anyway back»).
 *
 * An ADVISORY surface, and it dresses like one: `line`-bordered, `RADIUS.sheet`
 * lip — one step softer than the cards it slides over (TOKEN RULING 4b). The
 * months are the CURRENT YEAR's, newest first (the monthStrip's own order —
 * the month he stands in is the first under his thumb), and only months the
 * year has reached: a future month has no data to open. Serif faces, because
 * these are the display vocabulary's own month names.
 *
 * Choosing is the caller's business (`onChoose(ref)`), so this stays a dumb
 * surface a suite can render alone. The ENTRANCE is B4's Sheet primitive —
 * adopted in Wave 4 (the ledger's «Sheet adoption» residual): the surface,
 * its lip and its arrival are the one pinned sheet, never a hand-rolled twin.
 */
export function MonthSheet({ today, browsing, onChoose, onClose }) {
  const months = [];
  for (let m = today.m; m >= 1; m--) months.push({ y: today.y, m });
  return (
    <>
      {/* The way out: the whole page behind the sheet, honestly labelled. */}
      <button
        onClick={onClose}
        aria-label={S.monthPickerClose}
        style={{ position: 'fixed', inset: 0, zIndex: 44, background: 'transparent', cursor: 'default' }}
      />
      {/**
        * The wrapper only POSITIONS AND CLIPS (the Toast's own pattern: the
        * sheet motion animates `transform`, so positioning must not). A
        * bottom sheet is flush with the screen's bottom edge by geometry, and
        * this wrapper states that SILHOUETTE — RADIUS.sheet lip above, square
        * below. The Sheet primitive's identity lip rounds all four corners,
        * so the surface is let run one lip-depth past the wrapper's bottom
        * (negative margin, matching extra padding) and the clip squares it —
        * the lip shows exactly where a lip means something.
        */}
      <div
        style={{
          position: 'fixed', insetInline: 0, bottom: 0, zIndex: 45,
          borderRadius: `${RADIUS.sheet}px ${RADIUS.sheet}px 0 0`,
          overflow: 'hidden',
        }}
      >
      <Sheet
        role="dialog"
        aria-label={S.monthPickerTitle}
        style={{
          background: C.card, border: `1px solid ${C.line}`,
          padding: `6px ${SPACE.gutter}px calc(${SPACE.cardPad}px + env(safe-area-inset-bottom, 0px) + ${RADIUS.sheet}px)`,
          marginBottom: -RADIUS.sheet,
          maxHeight: '70vh', overflowY: 'auto',
          // The lift off the page — an ink-tinted veil, no new hue (§3).
          boxShadow: '0 -12px 32px rgba(44, 67, 86, 0.18)',
        }}
      >
        <div style={{ fontSize: TYPE.label, fontWeight: 700, color: C.muted, padding: '10px 0 6px' }}>
          {S.monthPickerTitle}
        </div>
        {months.map((ref) => {
          const active = browsing
            ? (browsing.y === ref.y && browsing.m === ref.m)
            : (ref.y === today.y && ref.m === today.m);
          return (
            <button
              key={ref.m}
              onClick={() => onChoose(ref)}
              aria-pressed={active}
              style={{
                display: 'flex', width: '100%', minHeight: TAP, alignItems: 'center',
                padding: '0 10px', borderRadius: RADIUS.row, textAlign: 'start',
                background: active ? C.harbor : 'transparent',
                color: active ? C.onDark : C.ink,
                fontFamily: FONT_DISPLAY, fontSize: TYPE.section, fontWeight: 650,
              }}
            >
              <span>{monthByTab(MONTH_ABBR[ref.m - 1])}</span>
            </button>
          );
        })}
      </Sheet>
      </div>
    </>
  );
}

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
      marginTop: 14, padding: '13px 15px', borderRadius: RADIUS.row,
      background: C.conflictBg, border: `1px solid ${C.conflictLine}`,
    }}>
      <div style={{ color: C.conflictInk, fontSize: TYPE.label, fontWeight: 700 }}>
        {S.dupTitle(counts.rows)}
      </div>
      <div style={{ color: C.ink, fontSize: TYPE.label, marginTop: 4, lineHeight: 1.55 }}>
        {S.dupBody}
      </div>

      {report.groups.map((g) => (
        <div key={g.key} style={{
          // A small inner panel sitting on the conflict card — RADIUS.inset's
          // own definition.
          marginTop: 10, padding: '9px 11px', borderRadius: RADIUS.inset,
          background: C.card,
        }}>
          {/* The tier is stated in words — a percentage would invite him to
              trust a number this has no basis to produce. */}
          <div style={{ color: C.muted, fontSize: TYPE.label, fontWeight: 700 }}>
            {S.dupTier(g.tier)}
          </div>
          {g.rows.map((r, i) => (
            <div key={`${g.key}#${i}`} style={{
              display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 5,
            }}>
              <span style={{ color: C.ink, fontSize: TYPE.label, ...ISOLATE }}>
                {r.description || S.dupNoDescription}
              </span>
              <span style={{ color: C.ink, fontSize: TYPE.label, fontWeight: 700, ...NUMERALS, ...LATIN }}>
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
        <div style={{ color: C.muted, fontSize: TYPE.label, marginTop: 9 }}>
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
            color: C.harbor, fontSize: TYPE.label, fontWeight: 700, textDecoration: 'underline',
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

  /**
   * A10 — WHEN THE NUMBER WOULD MISLEAD, THE TRUE SENTENCE LEADS (§8b,
   * RATIFIED 2026-08-25).
   *
   * A day spent entirely abroad has an EGP total of 0, and «0» in the largest
   * type on the screen tells a retired man he spent nothing on a day he sat in
   * a café in Nice — the «This week 0» defect (D23) arriving on the Today
   * head's own data path (per-row `travel`, not the server's `foreign`).
   *
   * The selection is `leadAndAsides`, CONSUMED rather than reimplemented: it
   * can only reorder sums that already exist — each currency summed over its
   * OWN rows by `travelOf` — and it cannot express a rate, which is what keeps
   * Boundary 8 (no synthetic conversion) structurally unreachable from here.
   *
   * The rule fires ONLY when the EGP figure is zero AND sized foreign money
   * exists. A day with real EGP money leads EGP exactly as before — the number
   * does not mislead — and a genuinely empty day leads its TRUE zero: a zero
   * he really spent is a fact, not a fabrication. (An unpriced foreign row
   * cannot trigger the lead either — there is no figure to headline — but it
   * never restores a bare «0» here because there is no bare 0: the zero always
   * stands beside whatever the day carried.)
   */
  const misleads = egp === 0 && travel.length > 0;
  const { lead, asides } = leadAndAsides(
    egp,
    { count: travel.length, byCurrency: Object.fromEntries(travel.map((t) => [t.currency, t.amount])) },
    misleads ? travel[0].currency : HOME_CURRENCY,
  );
  const leadsHome = lead.currency === HOME_CURRENCY;

  return (
    <div style={{ textAlign: 'center', padding: '2px 0 16px' }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: TYPE.hero, fontWeight: 650, ...NUMERALS, ...LATIN, lineHeight: 1.05 }}>
        {money(lead.amount)}
        {/**
          * A4 — the unit rides the figure: inline, NON-serif, muted, at the
          * floored ratio (`unitSize`, ruling 5). It used to sit on the meta
          * line below, which is «on its own line» — the exact arrangement §3
          * forbids. EGP keeps its word («جنيه»/EGP, `S.currency`); a foreign
          * lead keeps its code, exactly as his sheet writes it (D8).
          */}
        <span style={{ fontSize: unitSize(TYPE.hero), fontFamily: FONT_UI, fontWeight: 600, color: C.muted }}>
          {' '}{leadsHome ? S.currency : lead.currency}
        </span>
      </div>
      <div style={{ fontSize: TYPE.label, color: C.muted, marginTop: 3 }}>
        {S.todayCount((entries || []).length)}
      </div>
      <div style={{ fontSize: TYPE.label, color: C.muted, marginTop: 7, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <span>{S.metricVisa} <b style={{ color: C.ink, ...LATIN }}>{moneyRound(totals.Visa)}</b></span>
        <span>{S.metricCash} <b style={{ color: C.ink, ...LATIN }}>{moneyRound(totals.Cash)}</b></span>
      </div>
      {/* Only when there IS one. A day with no foreign spending says nothing
          about foreign spending — the silence is the ordinary case. */}
      {leadsHome && travel.length > 0 && (
        <div style={{ fontSize: TYPE.label, color: C.muted, marginTop: 6 }}>
          {S.travel} {travel.map((t) => (
            <span key={t.currency} style={{ ...LATIN, marginInlineStart: 4 }}>{money(t.amount)} {t.currency}</span>
          ))} — {S.travelApart}
        </div>
      )}
      {/**
        * A FOREIGN LEAD NEVER STANDS ALONE (N1b's law, arriving here): every
        * other currency the day touched — the true EGP zero included — is
        * stated beside it, and «لوحدها» still rides the foreign money, which
        * is excluded from every EGP sum whichever line it leads.
        */}
      {!leadsHome && (
        <div style={{ fontSize: TYPE.label, color: C.muted, marginTop: 6 }}>
          {S.travelApart} · {asides.map((a) => (
            <span key={a.currency} style={{ marginInlineStart: 4 }}>
              {S.andAlso} <b style={{ color: C.ink, ...LATIN }}>{money(a.amount)} {a.currency}</b>
            </span>
          ))}
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
            marginTop: 12, minHeight: TAP, borderRadius: RADIUS.row, padding: '9px 16px',
            background: C.sand, border: `1px solid ${C.line}`,
            color: C.amberInk, fontSize: TYPE.label, fontWeight: 700,
          }}
        >
          {S.batchWaiting(unsettledBatch)}
        </button>
      )}

      {unknown > 0 && (
        <button
          onClick={onGoToInbox}
          style={{
            marginTop: 12, minHeight: TAP, borderRadius: RADIUS.row, padding: '9px 16px',
            background: C.conflictBg, border: `1px solid ${C.conflictLine}`,
            color: C.conflictInk, fontSize: TYPE.label, fontWeight: 700,
          }}
        >
          {S.todayNeedCategory(unknown)}
        </button>
      )}
    </div>
  );
}

/**
 * E7 — THE WORD-FIRST HEADLINE'S BUILDER, and why it takes a `basis`.
 *
 * The head may lead with a factual sentence in WORDS («أخف من يوليو»,
 * «Heavier than last week») — an OBSERVATION the NO-NAGGING law allows
 * (north-star §6.2: state, never praise, blame or advise). But words are
 * EARNED BY THE DATA: stage 1's only honest comparison is the last period at
 * the same point, so `'last'` is the only basis this builder accepts. The
 * «than your usual» sentence needs E6's typical band wired into the head —
 * real P25–P75 history, not a phrase — and until that integration lands the
 * `'typical'` basis returns null HERE, structurally, so no call site can buy
 * the words early. The band case slots in as one more accepted basis; it is
 * added by re-cutting the E7 oracle's refusal pin, never by loosening it.
 *
 * An UNNAMED basis is refused too: the call site must state what earned the
 * sentence, or there is no sentence. Directions come from `comparisonOf` —
 * anything it would not produce builds nothing.
 */
export function headlineWords(direction, prevName, basis) {
  if (basis !== 'last') return null;
  if (direction === 'down') return S.headLighter(prevName);
  if (direction === 'up') return S.headHeavier(prevName);
  if (direction === 'same') return S.sameAs(prevName);
  return null;
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
  displayCurrency = HOME_CURRENCY,
  /**
   * A7 — seeds the policy disclosure open so a static renderer can reach the
   * detail behind the one-line compression. SSR cannot tap; this is the same
   * pattern as CumulativeChart's `peekOpen`, for the same reason.
   */
  policyOpen = false,
  /**
   * N6 — when the Month screen wires this, the heading becomes the DOOR to
   * the months sheet. Absent (weeks, years, suites that render the block
   * alone), the heading stays a plain label claiming nothing it cannot do.
   */
  onPickMonth,
  /**
   * E3 — only the MONTH asks for its window in words; «days 1–24» is
   * month-grammar and a week's sentence already names its whole self.
   */
  monthWindow = false,
  // E5 — the Month screen's two-panel stack, threaded through to the summary.
  stack = null,
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

  /**
   * WHICH UNIT LEADS (D23, chunk N1b).
   *
   * «This week 0» over a real 80 EUR week was every figure true and the subject
   * wrong. The headline's unit now follows his LIFE rather than the ledger's
   * history — and this is a REORDERING of two sums the server already computed,
   * each over its own rows. Nothing here converts; `leadAndAsides` cannot even
   * express a rate, and the suite pins that the only figures on screen are the
   * ones the payload carried.
   */
  const { lead, asides } = leadAndAsides(shown.now, foreign, displayCurrency);
  /**
   * A PERCENTAGE MUST DESCRIBE THE NUMBER ABOVE IT.
   *
   * The comparison is computed from the EGP series, so under a EUR headline it
   * would be a confident statement about the ASIDE — read, inevitably, as being
   * about the figure it sits under. There is no euro history to compare against
   * until D23's backend half lands, so the honest output is no percentage and a
   * line saying why, rather than silence or a number about the wrong thing.
   */
  const leadsHome = lead.currency === HOME_CURRENCY;
  /**
   * A7 — THE FOREIGN-MONEY ESSAY IS ONE MUTED LINE, ITS DETAIL ONE TAP AWAY.
   *
   * Two rules can suppress the comparison here — foreign money in either
   * period, a lead unit with no history — and each used to state its own
   * sentence, stacked, on the screen he opens for reassurance. The rules are
   * unchanged; only their PROSE compresses: one line (`S.whyNoCompare`) that
   * is true under every suppression, with the full sentences behind its tap.
   * The FIGURES never compress — asides and the unsized count are money, not
   * policy, and folding money away would spend honesty to buy calm.
   */
  const policySuppressed = hasForeign(foreign) || hasForeign(prevForeign) || !leadsHome;
  const [whyOpen, setWhyOpen] = useState(!!policyOpen);

  /**
   * E7 — THE WORDS THE HEAD LEADS WITH, built only where the comparison was
   * honestly earned. `cmp` is already null wherever the comparison is refused
   * (foreign money in either window, missing history — the mayCompare gate,
   * CONSUMED and never re-derived), and a foreign lead has no history in its
   * own unit — so the sentence rides `cmp && leadsHome`, the exact gate the
   * percentage below rides. Same words in, same words out: there is no path
   * on which the head observes what the arithmetic refused.
   */
  const headWords = cmp && leadsHome ? headlineWords(cmp.direction, names.prev, 'last') : null;

  /**
   * E3 — THE WINDOW, IN WORDS, DERIVED FROM THE SAME ARRAYS THE MATHS USED.
   *
   * `prevAt` is the previous period at the SAME POINT — `cumsum(prev)` at
   * `min(lastIdxOf(cur), prev.length - 1)` — and until now that fact lived
   * only in series.js. «أقل من يوليو بـ12%» on the 24th reads as
   * August-vs-all-of-July to anyone who has not read the arithmetic: a true
   * figure under a wrong subject. So the window is restated in words, from
   * the SAME derivation (`lastIdxOf`, the same clamp), which is what keeps
   * the words and the percentage incapable of disagreeing.
   *
   * Three shapes, ruled: a clipped previous month → «days 1–24 vs July
   * 1–24» (the clamp guarantees both windows are the same length); a WHOLE
   * shorter previous month (the February case) → «days 1–30 vs all of
   * February» — never «February 1–30», days February does not have; whole
   * against whole → NO qualifier, because nothing about it is partial.
   */
  let windowLine = null;
  if (monthWindow) {
    const curAll = seriesFor(data.cur, 'all');
    const prevAll = seriesFor(data.prev, 'all');
    const li = lastIdxOf(curAll);
    if (curAll[li] != null && prevAll.length > 0) {
      const prevIdx = Math.min(li, prevAll.length - 1);
      const curWhole = li === curAll.length - 1;
      const prevWhole = prevIdx === prevAll.length - 1;
      if (!prevWhole) windowLine = S.windowWords(li + 1, names.prev);
      else if (!curWhole) windowLine = S.windowWordsWholePrev(li + 1, names.prev);
    }
  }

  return (
    <>
      <div style={{ textAlign: 'center', padding: '2px 0 12px' }}>
        {/* Stat anatomy (A4): the label above, muted, at the prose floor. */}
        {onPickMonth ? (
          /**
           * N6 — «August» IS THE DOOR to the months (GAP 3: «we can't go
           * anyway back»). A real button at the senior floor; the chevron is
           * ruling 2's caption grammar — it duplicates the affordance the
           * button already is.
           */
          <button
            onClick={onPickMonth}
            aria-haspopup="dialog"
            style={{
              minHeight: TAP, background: 'transparent', padding: '0 12px',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{ fontSize: TYPE.label, color: C.muted }}>{names.cur}</span>
            <span aria-hidden="true" style={{ fontSize: TYPE.caption, color: C.muted }}>▾</span>
          </button>
        ) : (
          <div style={{ fontSize: TYPE.label, color: C.muted }}>{names.cur}</div>
        )}
        {/**
          * E7 — WORD-FIRST (data-F12; the Owner's Gentler grammar): where the
          * comparison is honestly available, the head leads with the factual
          * sentence IN WORDS — «أخف من يوليو» — and the figure stands beside
          * it, one size down from the hero it introduces. An observation,
          * never a judgment: the words state a direction the arithmetic
          * already earned, and everywhere the comparison is refused this
          * line simply does not exist — no sentence, not a hedged one.
          */}
        {headWords && (
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: TYPE.section, fontWeight: 650, color: C.ink, lineHeight: 1.3, marginTop: 2 }}>
            {headWords}
          </div>
        )}
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: TYPE.hero, fontWeight: 650, ...NUMERALS, ...LATIN, lineHeight: 1.05 }}>
          {moneyRound(lead.amount)}
          {/**
            * A4 — the unit ALWAYS rides the figure now: inline, NON-serif,
            * muted, at the floored ratio (`unitSize`, ruling 5). A bare 80
            * where euros are meant is §6.0's hazard reaching through the human
            * instead of through the wire — and a bare 350 where pounds are
            * meant was the same hazard's quiet twin. EGP keeps its word
            * (`S.currency`); a foreign lead keeps its code, as the sheet does.
            */}
          <span style={{ fontSize: unitSize(TYPE.hero), fontFamily: FONT_UI, fontWeight: 600, color: C.muted }}>
            {' '}{leadsHome ? S.currency : lead.currency}
          </span>
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
        {(asides.length > 0 || unsized > 0) && (
          <div style={{ fontSize: TYPE.label, color: C.muted, marginTop: 6, lineHeight: 1.7 }}>
            {/**
              * EVERY CURRENCY THE PERIOD TOUCHED, MINUS THE ONE LEADING. This
              * used to be «the foreign lines», which was the same list only
              * while EGP always led. Now that the lead can move, the aside is
              * whatever the lead is not — including the POUNDS, which is what
              * keeps a «0 EUR» headline honest. D23's own worked example is
              * «80 EUR · and with it 0 EGP»: the zero was never the defect, a
              * zero standing ALONE was.
              */}
            {asides.map((l) => (
              <span key={l.currency} style={{ marginInlineEnd: 10 }}>
                {S.andAlso} <b style={{ color: C.ink, ...LATIN }}>{moneyRound(l.amount)} {l.currency}</b>
              </span>
            ))}
            {/* Money we know is there and cannot size — said, not implied, and
                NOT behind the tap: a count of money is a figure, not policy. */}
            {unsized > 0 && <div style={{ fontSize: TYPE.label }}>{S.foreignUnsized(unsized)}</div>}
          </div>
        )}

        {/**
          * A7 — the ONE policy line a screen may state, and it is a DOOR. The
          * full sentences (which rule refused the comparison, and why that is
          * the honest refusal) live behind it; the tap toggles them the way
          * the same-point marker explains itself on tap (A6).
          */}
        {policySuppressed && (
          <button
            onClick={() => setWhyOpen((v) => !v)}
            aria-expanded={whyOpen}
            style={{
              minHeight: TAP, padding: '0 12px', marginTop: 2,
              background: 'transparent', color: C.muted, fontSize: TYPE.label,
            }}
          >
            {S.whyNoCompare}
          </button>
        )}
        {/**
          * The detail behind the door is one of theme.js's NAMED advisory
          * surfaces («the foreign-money notes»), and it dresses as one: sand,
          * with its meaning border. It was not on screen a moment ago — his
          * tap raises it — so it arrives as B4's Sheet, the one pinned
          * entrance (the Wave-3 Sheet-adoption residual, honored here). Ink,
          * not muted: the prose floor's contrast is measured on sand for ink
          * (test-contrast's «sand chip label» pair), and a sentence he asked
          * to read is body information, not annotation.
          */}
        {policySuppressed && whyOpen && (
          <Sheet style={{
            fontSize: TYPE.label, color: C.ink, background: C.sand, border: `1px solid ${C.line}`,
            padding: '8px 12px', lineHeight: 1.7, marginTop: 2,
          }}>
            {(hasForeign(foreign) || hasForeign(prevForeign)) && <div>{S.foreignNoCompare}</div>}
            {!leadsHome && <div>{S.noCompareInUnit(lead.currency)}</div>}
          </Sheet>
        )}

        {cmp && leadsHome ? (
          /**
           * The arithmetic detail under the words. Direction `same` states no
           * percentage — its whole sentence is the head's word-first line now
           * (E7), and repeating it here would be the same fact twice on one
           * screen — so this block renders only what the words do NOT carry:
           * the percentage with its «was» figure, and E3's window qualifier.
           */
          (cmp.direction !== 'same' || windowLine) && (
          <div style={{ fontSize: TYPE.body, marginTop: 6 }}>
            {cmp.direction === 'same'
              ? null
              : (
                <>
                  {cmp.direction === 'down' ? S.lessThan(names.prev) : S.moreThan(names.prev)}{' '}
                  {/**
                    * A5 — NEUTRAL DELTAS (north-star §5: «deltas carry no
                    * moral color»; boundary 4). This bold used to turn
                    * settled-green going down and conflict-red going up, which
                    * is a VERDICT on his own spending: red meaning spent-more
                    * makes information into sin, and the words already carry
                    * the direction. Body ink, both directions, always.
                    */}
                  <b style={{ color: C.ink, ...LATIN }}>{cmp.pct}%</b>
                  <span style={{ color: C.muted, fontSize: TYPE.label }}> ({S.wasThen} <span style={LATIN}>{moneyRound(cmp.prevAt)}</span>)</span>
                </>
              )}
            {/**
              * E3 — the qualifier renders ONLY under a sentence it qualifies:
              * a suppressed or absent comparison has no percentage for these
              * words to be about.
              */}
            {windowLine && (
              <div style={{ fontSize: TYPE.label, color: C.muted, marginTop: 2, ...NUMERALS }}>
                {windowLine}
              </div>
            )}
          </div>
          )
        ) : policySuppressed ? null : (
          <div style={{ fontSize: TYPE.label, color: C.muted, marginTop: 6 }}>{S.noComparison(names.prev)}</div>
        )}
      </div>

      <PeriodSummary
        data={data} labels={labels} liveIndex={liveIndex}
        metric={metric} setMetric={setMetric}
        periodNames={{ cur: names.cur, prev: names.prev }}
        showBars={showBars} footnote={footnote} offPlot={offPlot} stack={stack}
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
export function MonthScreen({ data, metric, setMetric, onGoToInbox, lensOpen, onToggleLens, displayCurrency, onPickMonth }) {
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
      // A caveat is real information: prose floor, never caption. The sand
      // note is a small advisory panel — RADIUS.inset is its surface.
      fontSize: TYPE.label, color: C.ink, background: C.sand, border: `1px solid ${C.line}`,
      borderRadius: RADIUS.inset, padding: '8px 12px', margin: '10px 0 0', lineHeight: 1.6, textAlign: 'center',
    }}>
      {caveats.join(' · ')}
    </p>
  ) : null;

  /**
   * E5/E6 — THE TWO-PANEL MONTH STACK, mounted (the charts leaf shipped it
   * mount-ready; this is the Planner's one integration). The line rides the
   * bars' own columns on ONE axis, and A12's every-5th-day thinning is live.
   *
   * · liveIndex: today's slot on the LIVE month; −1 on a browsed month — a
   *   closed month has no «today».
   * · band: typicalBand over the year's closed months (E6's pinned signature,
   *   the caller's one derivation duty). The browsed screen carries no year
   *   series in its payload, so the band honestly renders NOTHING there —
   *   absence, never an invented distribution.
   * · labelled mirrors PeriodSummary's own offPlot rule: undated money makes
   *   the curve's endpoint knowably short, so the markers stay silent.
   */
  const today = data.today_cairo || null;
  const dayLabels = Array.from(
    { length: (data.month.cur.Visa || []).length }, (_, i) => String(i + 1),
  );
  const monthStack = (
    <MonthStack
      cur={seriesFor(data.month.cur, metric)}
      prev={seriesFor(data.month.prev, metric)}
      labels={dayLabels}
      liveIndex={today ? today.d - 1 : -1}
      color={(METRICS.find((x) => x.key === metric) || METRICS[0]).color}
      prevName={monthName(data.month.names.prev)}
      labelled={!((undated?.Visa || 0) + (undated?.Cash || 0))}
      band={data.year ? typicalBand(comb(data.year.cur.Visa, data.year.cur.Cash), today ? today.m : 13) : null}
    />
  );

  return (
    <>
      <PeriodBlock
        data={data.month} labels={[]} liveIndex={-1}
        metric={metric} setMetric={setMetric}
        stack={monthStack}
        displayCurrency={displayCurrency}
        names={{
          // Q2: a browsed month outside the current year says its year.
          cur: monthName(data.month.names.cur) + (data.month.names.curY ? ` ${data.month.names.curY}` : ''),
          prev: monthName(data.month.names.prev) + (data.month.names.prevY ? ` ${data.month.names.prevY}` : ''),
        }}
        showBars={false}
        footnote={footnote}
        onPickMonth={onPickMonth}
        monthWindow
        /**
         * The undated rows ARE the month; they are simply not on the curve.
         * Handing them here makes the card show the true month total, which is
         * what the accountability list reconciles against — one number, one
         * screen.
         */
        offPlot={{ Visa: undated?.Visa || 0, Cash: undated?.Cash || 0 }}
      />
      {/**
        * THE PRIORITIES LENS sits between the month's ONE figure and its
        * per-category detail, because that is the order the three of them
        * actually answer: how much · where it went · how each line moved.
        * Per-install and closed by default (`state/lens.js`), so on Dad's phone
        * this is one quiet line and nothing more.
        */}
      <PriorityLens
        cats={data.monthCats}
        uncategorized={data.month?.uncategorized}
        open={lensOpen}
        onToggle={onToggleLens}
      />
      {/**
        * A7 — the category list sits under a NAME («مقابل يوليو» / «Against
        * July»), not under an inference from its legend chips. The name
        * carries the comparison subject because that is the question the list
        * answers: how each line moved against the month it is read against.
        */}
      {/* SPACE.section IS this gap's definition: the breath between one
          titled group and the next. */}
      <div style={{ marginTop: SPACE.section }}>
        <SectionLabel>{S.sectionAgainst(monthName(data.month.names.prev))}</SectionLabel>
      </div>
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
            {/* A picture sized as geometry (GLYPH), not a headline (theme.js). */}
            <div style={{ fontSize: GLYPH.illustration }}>🌙</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: TYPE.section, fontWeight: 650, color: C.harbor, marginTop: 8 }}>
              {emptyTitle}
            </div>
          </>
        )}
        <div style={{ color: C.muted, fontSize: TYPE.body, marginTop: 8 }}>{emptyBody}</div>
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
              borderRadius: RADIUS.row, marginBottom: 8, opacity: inert ? 0.62 : 1, transition: 'opacity .2s ease',
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
                <span style={{ fontSize: TYPE.body, fontWeight: 600, ...LATIN, overflow: 'hidden', textOverflow: 'ellipsis' }} dir="auto">
                  {row.description}
                </span>
                {/* Row meta — one of ruling 2's NAMED caption sites: the date,
                    chip and category annotate the description above them. */}
                <span style={{ fontSize: TYPE.caption, color: C.muted, display: 'flex', gap: 8, alignItems: 'center' }}>
                  {showDate && <span style={LATIN}>{row.date}</span>}
                  <Chip kind={row.method} small label={row.method === 'Visa' ? S.metricVisa : S.metricCash} />
                  {gap
                    // The door's PROMPT is an action he must read, not meta —
                    // it stays at the prose floor even inside the caption row.
                    ? <span style={{ color: C.harbor, fontWeight: 700, fontSize: TYPE.label }}>{S.rowNeedsCategory}</span>
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
                    // «auto» is ruling 2's first named caption case.
                    <span style={{ color: C.muted, fontSize: TYPE.caption }} title={S.rowAutoTitle}>
                      {S.rowAuto}
                    </span>
                  )}
                </span>
              </span>
              {/* An unpriced row renders —, never 0: a figure he never wrote. */}
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: TYPE.row, fontWeight: 650, color: C.ink, ...LATIN, ...NUMERALS }}>
                {row.amount == null ? '—' : money(row.amount)}
                {/* The currency is a UNIT beside a value, not an annotation —
                    it is the only place saying EUR, so ruling 5's floor
                    (unitSize) governs it, and it is non-serif (A4). */}
                {row.amount != null && row.currency && row.currency !== 'EGP'
                  ? <span style={{ fontSize: unitSize(TYPE.row), fontFamily: FONT_UI, color: C.muted }}> {row.currency}</span> : null}
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
