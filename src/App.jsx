import { useState, useEffect, useRef, useCallback } from 'react';
/**
 * B6: `flushSync` is load-bearing, not a convenience. `startViewTransition`
 * snapshots the old frame, runs its callback, then snapshots the new — but
 * React batches updates ASYNCHRONOUSLY, so without the flush the callback
 * returns with the DOM unchanged and the browser animates old-to-old: a
 * transition that looks broken only on the devices that support it.
 */
import { flushSync } from 'react-dom';
import { C, FONT_DISPLAY, FONT_UI, GROUND, RADIUS, SPACE, TYPE, NAV, TAP, glass, SHEET, SKELETON, GLASS_DIVIDER } from './theme.js';
import { S, LOCALE, DIR } from './i18n/strings.js';
import { applyDocumentLang } from './state/lang.js';
import { createRefresher, resultState } from './state/refresh.js';
import { fetchSummary, fixCategory, postManual, postVoice, receiptConfirm, batchConfirm, ping, USING_MOCK } from './api/index.js';
import { getCreds, consumeHashCredentials } from './state/secret.js';
import { loadSnapshot, saveSnapshot } from './state/cache.js';
import { enqueue, flush, partition, remove as dropQueued, onPhone } from './state/outbox.js';
import {
  cardKey, outcomeFor, reconcile, remaining, pruneSettled, applyCategoryToToday,
} from './state/inboxOutcomes.js';
import { confirmPayload, refileItem, editPayload } from './state/fixPayload.js';
import { DEFAULT_METHOD, manualPayload } from './state/entryPayload.js';

/** v4 P5 (R19): the undo window — the outbox holds a new entry this long before sending it. */
const UNDO_MS = 6000;

// R10: the display settings live on the page root; apply the saved ones before first paint.
applyDisplay(getDisplay());
import { entryReady } from './state/entryDock.js';
import { openingTab, cairoHourOf } from './state/opening.js';
import { remember } from './state/repeats.js';
import { setBadge } from './state/badge.js';
import { applyDisplay, getDisplay } from './state/settings.js';
import {
  loadDraft, saveDraft, clearDraft, mergeJobs, unsettledCount, mergeOutcomes, outcomeMap,
} from './state/batchDraft.js';
import { getCurrency, setCurrency as persistCurrency, AWAY_CURRENCY } from './state/travel.js';
import {
  getDisplayCurrency, setDisplayCurrency, otherDisplayCurrency,
} from './state/display.js';
import { supportsAction, supportsCurrency, effectiveCurrency, loadBuild, saveBuild } from './state/capabilities.js';
import { cairoDateStr, cairoClock, newClientId } from './lib/dates.js';
import { isSummaryShape, withDefaults } from './lib/summaryShape.js';
import { TabButton, Toast, OfflineBanner, RefreshButton, Sheet, LedgerIcon, TrayIcon, PlusIcon, UndoToast, UpdatePrompt } from './components/Primitives.jsx';
import { useUpdatePrompt } from './state/update.js';
import InstallCoach from './components/InstallCoach.jsx';
import SetupView from './views/SetupView.jsx';
import InboxView from './views/InboxView.jsx';
import EntryView, { EntryDock } from './views/EntryView.jsx';
import ReceiptView from './views/ReceiptView.jsx';
import DictateView from './views/DictateView.jsx';
import BookView from './views/BookView.jsx';
import BatchReviewView from './views/BatchReviewView.jsx';
import SettingsSheet, { SettingsCog } from './views/SettingsSheet.jsx';

/**
 * ═══ THE FLOATING BAR (v4, OWNER-RULINGS R16) — its geometry lives in NAV ═══
 *
 * A glass `chrome` capsule NAV.height tall, NAV.inset from the screen sides and
 * NAV.bottom above the bottom edge (or the safe area, whichever is larger).
 * R0 retired the 0.92-alpha compromise: the contrast suite now measures the
 * chrome tier over the real ground AND over the darkest content that can scroll
 * beneath, and logs what falls short (GATES.md) rather than vetoing the design.
 *
 * `BAR_CLEARANCE` is what the scroll box (and the EntryDock's wrapper) reserves
 * so the last row can rise clear of a bar that floats OVER content.
 */
const BAR_CLEARANCE = NAV.bottom + NAV.height + SPACE.gap;


/**
 * The app shell.
 *
 * Three rules this file enforces:
 *  - NEVER a blank screen. Paint from the last snapshot immediately, labelled
 *    with its timestamp, then swap in fresh data behind it. A skeleton appears
 *    only on a true first run.
 *  - Every action writes immediately. There is no "save" step; Today mirrors the
 *    sheet. The prototype's "Write N rows" button is gone on purpose.
 *  - Optimistic, but never a lie. The tap is acknowledged at once; the OUTCOME
 *    is whatever the server said, and the card says which (WS3-C). The previous
 *    reading of this rule — remove the card immediately and refetch on failure —
 *    turned four different outcomes into one indistinguishable non-event.
 */
export default function App() {
  const [booted, setBooted] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [tab, setTab] = useState('inbox');
  /**
   * v4 P4 (R17): «جديد» is a SHEET over the screen he came from, not a screen
   * of its own. `underTab` remembers that screen so it stays drawn (dimmed)
   * behind the sheet, and closing the sheet returns him to it.
   */
  const underTab = useRef('book');
  useEffect(() => { if (tab !== 'entry') underTab.current = tab; }, [tab]);
  const swipeY = useRef(null); // the sheet's swipe-down start (hooks stay above every early return)
  const update = useUpdatePrompt(); // v4 P8: a waiting build, applied only when he says
  /**
   * THE ﹢ TAB HAS TWO MODES (finding M1). «فاتورة» was a whole destination
   * holding one button; a receipt is a way of making an entry, not a place, so
   * the camera is a mode of the entry screen. Reset on every visit to the tab:
   * he should always land on the keypad, which is the daily path.
   */
  const [entryMode, setEntryMode] = useState('keypad');
  /**
   * THE BATCH DRAFT — his ticks on a bank screenshot, kept on this device.
   *
   * Loaded ONCE at boot rather than read per render: it is his work, and the
   * extraction it describes may already have expired on the server. The split is
   * by cost (state/batchDraft.js) — the cheap half is allowed to expire, the
   * expensive half is not.
   *
   * `{ jobs, settled }`: `jobs` are the photos' extractions, `settled` is the
   * server's per-row answer once he has confirmed, plus the rows we SENT, which
   * is what lets the review screen put each outcome beside the right row.
   */
  const [batch, setBatch] = useState(() => loadDraft() || { jobs: [], settled: null });
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchExpired, setBatchExpired] = useState(false);
  const [data, setData] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [offline, setOffline] = useState(false);
  const [toast, setToast] = useState(null);
  /**
   * THE INSTALL'S READING UNIT (D23). Read once at mount and held as state, so
   * flipping it re-renders in place — unlike the language switch, which must
   * reload to re-import its locale module.
   *
   * A READ preference. It is deliberately not `state/travel.js`, which decides
   * what the keypad WRITES into his book; the two share a list of currencies
   * and nothing else.
   */
  const [displayCurrency, setDisplayCurrencyState] = useState(() => getDisplayCurrency());
  const flipDisplayCurrency = useCallback(() => {
    setDisplayCurrencyState((cur) => setDisplayCurrency(otherDisplayCurrency(cur)));
  }, []);
  /**
   * THE SETTINGS SHEET (S1, Owner ruling 2026-08-27) — open or not, and
   * nothing else: everything inside it (language, display currency) already
   * has its own state and its own persistence. Opening a sheet must never
   * become a second owner of either.
   */
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [staleQueue, setStaleQueue] = useState([]);
  // v4 P5: rows still on the phone (held for undo, or waiting for the network),
  // and the 6-second «اتحفظ ✓ — رجوع» toast that can still take one back.
  const [phoneRows, setPhoneRows] = useState(() => onPhone());
  const [undo, setUndo] = useState(null);
  const undoTimer = useRef(null);
  // What became of each card he confirmed, keyed by `cardKey`. This is the
  // record whose absence let a refetch resurrect a card he had already done.
  const [settled, setSettled] = useState({});
  const toastTimer = useRef(null);

  // manual entry state (cash OR card — R-receipts 1)
  const [entryAmount, setEntryAmount] = useState('');
  const [entryDesc, setEntryDesc] = useState('');
  const [entryCat, setEntryCat] = useState(null);
  const [entryMethod, setEntryMethod] = useState(DEFAULT_METHOD);
  // Travel mode (A4) — sticky, and read once so the screen cannot change under him.
  const [storedCurrency, setStoredCurrency] = useState(() => getCurrency());
  /**
   * WHAT THE SERVING BACKEND CAN ANSWER — seeded from the last `ping` we saw, so
   * a gated control does not flicker into existence a second after launch.
   *
   * This exists because the dictation button shipped posting an action the
   * backend has never known (`unknown_action`, every press, on his primary
   * manual path while abroad). It fails CLOSED: no list means no button.
   */
  const [build, setBuild] = useState(() => loadBuild());
  /**
   * THE CURRENCY ANY WRITE ACTUALLY CARRIES (Planner 4, CONTRACT-06).
   *
   * Gated, not merely hidden. His book serves V19, whose `handleManual_`
   * hardcodes EGP — so a euro amount would land as pounds in the column his
   * dashboard sums. Hiding the toggle protects a phone that never used travel
   * mode; THIS protects the one already stuck in it, where the sticky
   * preference would keep writing euros as pounds with no control left to see.
   */
  const entryCurrency = effectiveCurrency(storedCurrency, build);
  const [entryBusy, setEntryBusy] = useState(false);

  /**
   * B6 — THE DETAIL PUSH (north-star §4.2: «detail push via View Transitions
   * where supported»). One helper, three worlds, and the state change fires
   * exactly once in each — test-chunk-b6.mjs EXECUTES all three:
   *   · supported: the browser cross-fades old→new at var(--dur-page)
   *     (styles.css); `flushSync` is what puts the NEW frame under the
   *     second snapshot — see the import note;
   *   · unsupported (his iOS today does support it; older WebKit does not):
   *     the nullish fallback applies the SAME state change directly —
   *     absence degrades to instant, never to a dead tap or a half-state;
   *   · reduced motion: the API has no opinion of its own (its crossfade
   *     plays regardless), so the guard is ours — no transition starts at
   *     all, and styles.css flattens the pseudos as the second layer.
   * Tab swaps deliberately do NOT ride this: they are B2's keyed entrance,
   * and two motion systems on one swap is theatre.
   */
  const pushDetail = useCallback((apply) => {
    const reduced = typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof document === 'undefined') { apply(); return; }
    const transition = document.startViewTransition?.(() => flushSync(apply)) ?? apply();
    /**
     * A transition can be SKIPPED after the callback ran — page hidden at the
     * moment of the tap, or a second push landing first. The state is already
     * right; only the theatre was skipped. Per spec it is `ready` that
     * rejects then (InvalidStateError — observed live 2026-08-26, and the
     * first version of this catch covered only `finished` and kept logging).
     * Unhandled, that rejection is console noise a real crash could hide
     * behind. Skipped theatre is swallowed on BOTH promises; it is never an
     * error.
     */
    transition?.ready?.catch?.(() => {});
    transition?.finished?.catch?.(() => {});
  }, []);

  /**
   * A PHOTO TURNED OUT TO BE A TRANSACTION LIST — take its rows into the draft
   * and open the review surface.
   *
   * Its OWN screen, entered from the job card, and deliberately NOT الوارد
   * (CONTRACT-10 Q1): الوارد means rows already in his book that need a
   * category, and an Inbox row he ignores is still counted as ❓. A batch row he
   * ignores is not captured AT ALL. One habit, two consequences, and the wrong
   * half loses money.
   *
   * Keyed by `sourceHash`, so re-reading the same photo REPLACES its rows rather
   * than doubling them — a second read of one screenshot is a fresher answer to
   * the same question, never a second screenshot.
   */
  const takeBatchJob = useCallback((job) => {
    if (!job || !job.sourceHash || !Array.isArray(job.entries)) return;
    setBatchExpired(false);
    setBatch((prev) => {
      const jobs = (prev.jobs || []).filter((j) => j.sourceHash !== job.sourceHash).concat(job);
      /**
       * ⚠️ THIS DISCARDED EVERY ANSWER, AND IT NO LONGER HAS TO.
       *
       * The old comment — «leaving them would label the new rows with the old
       * batch's verdicts» — described the PRE-MERGE positional shape, where an
       * answer was identified by where it sat in an array. `mergeOutcomes` keys
       * every outcome by `sourceHash#index`, so an answer can only ever find the
       * row it was actually about. Throwing away a second photo's verdicts
       * because a third arrived is how the Book comes to claim that rows already
       * in his sheet are still waiting.
       *
       * The ONE case that genuinely invalidates: a re-read of the SAME photo.
       * Same `sourceHash`, freshly extracted rows, and an old verdict at index 3
       * would attach to whatever the new reading put at index 3. Those answers,
       * and only those, are pruned.
       */
      const kept = {};
      for (const [key, outcome] of outcomeMap(prev.settled)) {
        if (!key.startsWith(`${job.sourceHash}#`)) kept[key] = outcome;
      }
      const settled = Object.keys(kept).length ? mergeOutcomes({ byKey: kept }, null, null) : null;
      return saveDraft({ jobs, settled });
    });
    pushDetail(() => setEntryMode('batch'));
  }, [pushDetail]);

  /**
   * WRITE THE ROWS HE TICKED. One call, per-row answers.
   *
   * `sent` is stored beside the response because the server does not echo
   * `sourceHash`, and `index` alone is per-photo — so the ONLY sound way to put
   * an outcome beside its row is the order they were sent in, and that order has
   * to be remembered here rather than reconstructed later from ticks that may
   * since have moved.
   */
  const confirmBatch = useCallback(async (chosen) => {
    if (!chosen || !chosen.length) return;
    setBatchBusy(true);
    try {
      const res = await batchConfirm({
        batchClientId: newClientId(),
        clientHash: (batch.jobs && batch.jobs[0] && batch.jobs[0].sourceHash) || '',
        rows: chosen,
      });
      /**
       * `extraction_expired` is the status guard failing CLOSED, exactly as 06
       * §6.0 says it must: the server could not re-read the rows' statuses from
       * its own cache, so it refused rather than trusting the request. Nothing
       * was written. His edits survive; one fresh read re-attaches them.
       */
      const allExpired = Array.isArray(res && res.results) && res.results.length
        && res.results.every((r) => r && r.error === 'extraction_expired');
      if (allExpired) { setBatchExpired(true); return; }

      /**
       * ⚠️ ONLY A REAL PER-ROW ANSWER MAY SETTLE THE DRAFT — refuted into this
       * form by the verification pass. The first version stored WHATEVER came
       * back as `settled`, so a whole-batch refusal ({ok:false,
       * error:'batch_too_large'}, no results[]) rendered as a DONE screen
       * reading «undefined logged ✓», every row outcome blank — and the one
       * remaining button, Back, discarded the draft. Nothing written, ticks
       * destroyed, reported as success. A refusal keeps the draft and says why;
       * settling is reserved for a response that actually answers the rows.
       */
      if (!res || res.ok !== true || !Array.isArray(res.results)) {
        showToast(res && res.error === 'batch_too_large' ? S.batchTooLarge : S.batchFailed);
        return;
      }
      /**
       * OUTCOMES ACCUMULATE — they do not replace (see `mergeOutcomes`).
       *
       * A second confirm carries ONLY the rows he insisted on after a refusal,
       * so replacing `settled` would leave every other row unanswered: a row
       * WRITTEN a minute ago would re-render as a live, tickable candidate, and
       * the next «اختار الكل» writes his statement into his book twice. Keyed
       * by row, with the three counts recomputed from the map so a row that was
       * refused and then written counts once, as written.
       */
      setBatch((prev) => saveDraft({
        ...prev, settled: mergeOutcomes(prev.settled, res, chosen),
      }));
      if (res.written) refresh();
    } catch {
      showToast(S.batchFailed);
    } finally {
      setBatchBusy(false);
    }
  }, [batch.jobs]);

  /**
   * LEAVING IS NOT DISCARDING. The draft stays exactly as it is — including the
   * rows the server refused and never wrote — so the Book's waiting count is
   * answerable tomorrow and the override path is still there when he comes back.
   * The settled screen's only exit used to be `discardBatch`, under the word
   * «Done»; unwritten rows died with it.
   */
  const leaveBatch = useCallback(() => {
    pushDetail(() => setEntryMode('keypad'));
  }, [pushDetail]);

  /** Settled or abandoned — the draft goes, and so does the screen. */
  const discardBatch = useCallback(() => {
    clearDraft();
    pushDetail(() => {
      setBatch({ jobs: [], settled: null });
      setBatchExpired(false);
      setEntryMode('keypad');
    });
  }, [pushDetail]);

  /**
   * The extraction expired; the PHOTO has not. One fresh read, edits intact.
   *
   * ⚠️ IT USED TO CLEAR `settled`, AND AFTER THE SECOND-CONFIRM PATH LANDED THAT
   * BECAME A FALSE NUMBER ON THE SCREEN HE PASSES DAILY.
   *
   * The sequence, and it is the DESIGNED flow rather than an edge: 14 rows, ten
   * written and two refused as `book_duplicate`; he taps «سيبها دلوقتي»; more
   * than six hours later the Book's waiting count sends him back; he overrides
   * the two and confirms; the server's `rcpthash` cache has expired so BOTH come
   * back `extraction_expired` — and `every()` is satisfied on a two-row list
   * exactly as on a fourteen-row one, so `allExpired` fires and this screen
   * replaces the settled one. Clearing `settled` here then erased the record
   * that TEN of those rows are already in his sheet, and the Book went on to
   * state «14 مصاريف لسه ما اتسجلوش» about a set of which ten were logged.
   *
   * Before this rev the settled screen's only exit was `onDiscard`, so a draft
   * carrying answers could never reach here at all. The second confirm is what
   * made it reachable, so the repair belongs with it.
   *
   * Keeping the answers is safe in a way it was NOT before `mergeOutcomes`:
   * every outcome is keyed by `sourceHash#index`, and a re-snap is new bytes and
   * therefore a new `sourceHash`, so the fresh extraction's rows cannot inherit
   * a verdict addressed to the old ones. `takeBatchJob` prunes the one case that
   * could — a re-read of the SAME photo.
   */
  const resnapBatch = useCallback(() => {
    pushDetail(() => {
      setBatchExpired(false);
      setEntryMode('receipt');
    });
  }, [pushDetail]);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // v4 P8: reads in flight — the startup read and the after-save refresh too, not
  // only a press of the pill — so the pill can say «بنجيب من الشيت…» / «آخر تحديث».
  const [reading, setReading] = useState(0);
  const refresh = useCallback(async () => {
    setReading((n) => n + 1);
    try {
      const res = await fetchSummary();
      // `ok:true` is not enough — a truncated response or an older deployment can
      // return a truthy envelope with none of the fields the views read, and the
      // first dereference would unmount the whole app. Anything that fails the
      // shape check is treated as a failed fetch: keep the snapshot, say so.
      if (isSummaryShape(res)) {
        const clean = withDefaults(res);
        setData(clean);
        // A ✓ outlives every refetch that still lists its row — that is the
        // point — but not the row itself. Once the server stops sending it, the
        // card is gone and so is its record.
        setSettled((s) => pruneSettled(s, clean.pending));
        setSavedAt(Date.now());
        saveSnapshot(clean);
        setOffline(false);
        return true;
      }
      setOffline(true);
      return false;
    } catch {
      // Keep whatever is on screen. Losing signal in Cairo is normal, not an error.
      setOffline(true);
      return false;
    } finally {
      setReading((n) => Math.max(0, n - 1));
    }
  }, []);

  /**
   * THE MANUAL REFRESH (D16c). A button, at the tap floor, on every data screen.
   *
   * `savedAt` is set in exactly ONE place — the success branch above — which is
   * what makes «آخر تحديث» honest by construction: there is no path through a
   * failed refresh that touches it. `state/refresh.js` states the same rule as a
   * function so it can be mutated and caught; this is that rule expressed as
   * control flow.
   *
   * The refresher owns the in-flight guard, so a second press while a fetch is
   * out is a no-op rather than a queued second cold start.
   */
  const [refreshState, setRefreshState] = useState('idle');
  /**
   * The refresh reloads the CURRENT view's data, not a blind everything. Recent
   * registers its own loader while it is on screen; every other tab rides the
   * summary they all read from.
   */
  const recentLoader = useRef(null);
  const refresher = useRef(null);
  if (!refresher.current) {
    refresher.current = createRefresher(
      () => (tabRef.current === 'book' && recentLoader.current
        ? recentLoader.current()
        : refresh()),
    );
  }
  // `tab` read through a ref so the refresher, created once, always sees the
  // tab he is actually looking at rather than the one he opened the app on.
  const tabRef = useRef(tab);
  tabRef.current = tab;

  const onRefresh = useCallback(async () => {
    setRefreshState('busy');
    const res = await refresher.current.press();
    // A skipped press changes nothing — it never ran, so it has nothing to say.
    if (res.skipped) return;
    setRefreshState(resultState(res.ok));
  }, []);

  const sendQueued = useCallback((item) => {
    if (item.kind === 'manual') return postManual(item.payload);
    if (item.kind === 'fix_category') return fixCategory(item.payload);
    if (item.kind === 'receipt_confirm') return receiptConfirm(item.payload);
    return Promise.resolve({ ok: true });
  }, []);

  const runOutbox = useCallback(async () => {
    const res = await flush(sendQueued);
    setStaleQueue(partition().stale); setPhoneRows(onPhone());
    if (res.sent > 0) refresh();
    return res;
  }, [sendQueued, refresh]);

  /**
   * THE ONE COUNT, and it is computed ABOVE every early return.
   *
   * ——— WHY IT MOVED, which is a bug this rev caused and the device caught.
   *
   * The badge effect was first written next to the render that uses this number,
   * which sits below `if (!booted) return null`. On the very first paint React
   * ran 28 hooks; on the next it ran 29, and the app died with "rendered more
   * hooks than during the previous render" — the error boundary's «في حاجة وقفت»
   * screen, on launch, before anything was on screen at all.
   *
   * The suite was fully green when that happened. Hook ORDER is not something a
   * pure-function suite or an SSR render can see, which is precisely why this
   * project's rule is that a change is not done until it has been opened.
   */
  /**
   * OWNER-RULINGS B8 (R5): the badge counts rows awaiting a category in the
   * CURRENT period — the old-expenses backlog is excluded (it has its own row
   * on the review screen, with its own count). The review screen's «1 من N»
   * counts the same queue, so the tab badge, the icon badge and the progress agree.
   */
  const pendingCount = remaining(reconcile((data?.pending || []).filter((p) => !p.stale), settled));

  /**
   * THE SAME COUNT, ON THE HOME-SCREEN ICON (finding A6).
   *
   * `pendingCount` and nothing else — the badge, the tab and the Inbox headline
   * all read one number, which is finding S3 held one layer further out. A third
   * counter on the icon would be the badge-vs-headline contradiction arriving
   * where he sees it before the app is even open.
   *
   * No push server and NO notification, ever (R19). iOS shows an app badge only
   * after notification permission is granted, so Setup asks for it ONCE, on his
   * tap, saying why (R19 rules this is not nagging). It appears when something is
   * waiting and clears itself when nothing is — the automatic PROMPT the Fogg
   * model wants, without the nagging CLAUDE.md #5 forbids.
   */
  useEffect(() => { setBadge(pendingCount); }, [pendingCount]);

  // ——— boot
  useEffect(() => {
    // Direction first: index.html ships the Arabic default, and this only has to
    // change anything for an install that chose English.
    applyDocumentLang(LOCALE);
    consumeHashCredentials();
    if (!USING_MOCK && !getCreds()) {
      setNeedsSetup(true);
      setBooted(true);
      return;
    }
    const snap = loadSnapshot();
    if (snap) {
      setData(snap.data);
      setSavedAt(snap.savedAt);
      /**
       * THE EVENING RECAP IS THE FRONT DOOR (finding A1).
       *
       * Decided ONCE, here, from the snapshot already in hand — so the landing
       * screen is chosen before the first frame and never changes under him.
       * Re-running this on every render would move the screen at 19:00 while he
       * was reaching for it.
       *
       * The Book's «النهاردة» IS the recap the brief asked for: the day's
       * figure, the count, the split, and a button naming whatever still needs a
       * category. Nothing new is built — it is simply what he finds after 7pm.
       */
      const hour = cairoHourOf(snap.data && snap.data.serverTime);
      const hasDay = !!(snap.data && snap.data.today && (snap.data.today.entries || []).length);
      setTab(openingTab(hour, hasDay));
    }
    setBooted(true);
    setStaleQueue(partition().stale); setPhoneRows(onPhone());
    refresh();
    runOutbox();
    /**
     * FIRE AND FORGET. `ping` is the only response carrying `build`, and the
     * capability it answers gates a secondary control — so it must never block
     * the first paint or make a failed launch look broken. A rejection leaves
     * the cached answer in place, which is the honest previous state.
     */
    ping().then((res) => { if (res && res.build) setBuild(saveBuild(res.build)); }).catch(() => {});
  }, [refresh, runOutbox]);

  // Flush on reconnect and whenever he brings the app back to the front — the
  // two moments a queued entry can finally land.
  useEffect(() => {
    const onOnline = () => { refresh(); runOutbox(); };
    const onVisible = () => { if (!document.hidden) { refresh(); runOutbox(); } };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh, runOutbox]);

  // ——— writes
  /**
   * The toast follows the OUTCOME. It used to fire before the request was even
   * sent — `showToast(S.saved)` on line 1 of this function — so the app said
   * "اتسجل ✓" for writes that then failed, which is why the toast could never
   * be used to tell done from not-done.
   */
  const CONFIRM_TOAST = {
    done: S.saved,
    already: S.alreadyFixed,
    conflict: S.cardConflict,
    failed: S.genericError,
    queued: S.queued,
  };

  const confirmPending = async (item, category, opts = {}) => {
    const key = cardKey(item);
    // Acknowledge the tap — and acknowledge ONLY the tap. The card greys and
    // its buttons die immediately, so he can move to the next one without
    // waiting for Apps Script, but nothing yet claims the row was written.
    setSettled((s) => ({ ...s, [key]: { status: 'saving', category } }));
    // The row is already in `today` — the server builds both lists from the one
    // month blob. So this changes the category IN PLACE and touches no total;
    // appending here counted every confirmed purchase twice.
    setData((d) => (d ? { ...d, today: applyCategoryToToday(d.today, item.match, category) } : d));

    // A RE-FILE (he picked again after it was logged — a mis-tap, «Elect.
    // Recharge» for a card fee): the sheet now holds the category he filed, so
    // the concurrency claim must say THAT, or the server rightly refuses it.
    const payload = confirmPayload(refileItem(item, settled[key]), category);
    let outcome;
    try {
      outcome = outcomeFor(await fixCategory(payload), false, category);
    } catch {
      // Offline. Not age-gated: the server's concurrency guard makes a late
      // replay safe at any age (see state/outbox.js).
      enqueue({ id: newClientId(), kind: 'fix_category', ageGated: false, payload });
      outcome = outcomeFor(null, true, category);
    }

    setSettled((s) => ({ ...s, [key]: outcome }));
    /**
     * `quiet` is the BATCH calling (M4): every card still records its own
     * outcome above — that is the part that must not change — but one toast per
     * row would fire five in a row over each other, and one refetch per row
     * would be five Apps Script cold starts. The batch reports the run once and
     * refreshes once, at the end.
     */
    if (!opts.quiet) {
      showToast(CONFIRM_TOAST[outcome.status] || S.genericError);
      // A success needs no refetch — the card already says what happened, and
      // nine of them in a row would be nine cold starts. Everything else means
      // the sheet and the screen disagree, so go and look.
      if (outcome.status !== 'done') refresh();
    }
    return outcome;
  };

  /**
   * DICTATION (finding A5) — a sentence in, a row out.
   *
   * NOTHING IS PARSED HERE. The text goes to `type:'voice'`, the endpoint the
   * Siri Shortcut has used since Phase 1: it reads the first number as the
   * amount, matches an Arabic keyword for the category, defaults to Cash, and
   * falls back to ❓ rather than guessing. A client-side parser would be two
   * implementations of "what did he say", disagreeing on exactly the
   * Arabic-Indic digits the server normalises for.
   *
   * NO OPTIMISTIC ROW, and that is the difference from the keypad. There, the
   * app knows the amount and the category before it posts, so it can show the
   * line immediately. Here it knows a SENTENCE — inventing a row from it would
   * mean guessing what the server will make of the words, and being wrong in
   * front of him. It refreshes instead, and the row appears as the server read
   * it.
   */
  const sendDictated = async (text) => {
    if (!text) return;
    setEntryBusy(true);
    try {
      const res = await postVoice({ text, clientId: newClientId() });
      if (res && res.ok === true) {
        pushDetail(() => setEntryMode('keypad'));
        showToast(S.saved);
        refresh();
      } else {
        showToast(S.genericError);
      }
    } catch {
      // Offline: the voice path has no outbox entry of its own, so rather than
      // invent one, say plainly that it did not go and keep his words on screen.
      showToast(S.genericError);
    } finally {
      setEntryBusy(false);
    }
  };

  /**
   * THE BATCH (finding M4) — every row settled through the SAME call as a single
   * tap, one after another.
   *
   * SEQUENTIAL, DELIBERATELY, and it is not about the quota (five rows is
   * nothing against 30 simultaneous executions). It is that `fix_category` takes
   * a script LOCK and re-locates the row by content; firing five at once means
   * five writers contending for one lock on one sheet, and the failure mode of
   * losing that race is a write landing on a row he did not tap. In series each
   * row is the same operation the green button performs, with the same guard.
   *
   * NO BATCH-LEVEL OUTCOME. Each card still receives its own — `done`, `already`,
   * `conflict`, `failed`, `queued` — because a single "5 saved ✓" over a run
   * where the third one conflicted is precisely the one-state-for-four-outcomes
   * bug WS3-C exists to have killed. The toast reports the run; the cards report
   * themselves.
   */
  const confirmMany = async (items) => {
    let failed = 0;
    for (const item of items) {
      // eslint-disable-next-line no-await-in-loop -- see the lock note above
      const outcome = await confirmPending(item, item.guess, { quiet: true });
      if (outcome && outcome.status !== 'done' && outcome.status !== 'already') failed += 1;
    }
    showToast(failed ? S.batchPartly(items.length - failed, failed) : S.batchDone(items.length));
    // One refresh for the whole run rather than one per row — and only here,
    // because a batch is the one place several rows change at once.
    refresh();
  };

  /**
   * A Recent edit — the same outcome machine as the Inbox, one difference.
   *
   * NO `rowHint`. A Recent row is identified by what it SAYS, not by where it
   * sat when it was fetched, so the payload takes the server's content-scan path
   * by contract (06 §2.4). The item's `rowHint` is a local settle KEY built from
   * the row's own date and amount; sending it would be a stale position from a
   * list that may be minutes old. Both shapes live in `state/fixPayload.js`,
   * next to each other, with the reason they differ written between them.
   */
  const editRecent = async (item, category) => {
    const key = cardKey(item);
    setSettled((s) => ({ ...s, [key]: { status: 'saving', category } }));
    const payload = editPayload(item, category);
    let outcome;
    try {
      outcome = outcomeFor(await fixCategory(payload), false, category);
    } catch {
      enqueue({ id: newClientId(), kind: 'fix_category', ageGated: false, payload });
      outcome = outcomeFor(null, true, category);
    }
    setSettled((s) => ({ ...s, [key]: outcome }));
    showToast(CONFIRM_TOAST[outcome.status] || S.genericError);
    if (outcome.status !== 'done') refresh();
  };

  /**
   * The manual write. The METHOD is his now (R-receipts 1) — it used to be the
   * literal `'Cash'`, here and again in the optimistic line below.
   *
   * Both the payload and that line are built in `state/entryPayload.js`: the
   * wire value can never be the button's label, and Today credits the column he
   * chose rather than always crediting Cash.
   */
  /**
   * v4 P5 (R19, A7) — UNDO REPLACES CONFIRM. «سجّل» puts the entry in the OUTBOX
   * at once, held for UNDO_MS: closing the app inside those six seconds loses
   * nothing (it is already persisted), and «رجوع» takes it back out before it
   * ever leaves the phone. When the hold ends the outbox sends it; with no
   * network it simply stays queued and the Book shows it, marked with a clock.
   * It is NEVER folded silently into the sheet's figures (the old optimistic
   * insert did exactly that) — the Book names its sum instead.
   */
  const submitEntry = () => {
    if (!entryReady({ amount: entryAmount, cat: entryCat, busy: entryBusy })) return;
    const amount = parseFloat(entryAmount);
    const clientId = newClientId();
    const payload = manualPayload({
      amount, method: entryMethod, category: entryCat, description: entryDesc,
      clientId, entryDate: cairoDateStr(), currency: entryCurrency,
    });
    const restore = { amount: entryAmount, desc: entryDesc, cat: entryCat, method: entryMethod, currency: entryCurrency };
    enqueue({ id: clientId, kind: 'manual', ageGated: true, payload, holdUntil: Date.now() + UNDO_MS });
    setPhoneRows(onPhone());
    setEntryAmount(''); setEntryDesc(''); setEntryCat(null); setEntryMethod(DEFAULT_METHOD);
    setTab('book');
    clearTimeout(undoTimer.current);
    setUndo({ id: clientId, amount, currency: entryCurrency, restore });
    undoTimer.current = setTimeout(async () => {
      setUndo(null);
      // «زي امبارح» learns the entry only once it is really kept.
      remember({ description: payload.description, category: payload.category, method: payload.method, amount, currency: restore.currency });
      const r = await runOutbox();
      if (r && r.dropped) showToast(S.genericError);
    }, UNDO_MS);
  };

  const undoEntry = () => {
    clearTimeout(undoTimer.current);
    if (!undo) return;
    dropQueued(undo.id);
    setPhoneRows(onPhone());
    const r = undo.restore;
    setEntryAmount(r.amount); setEntryDesc(r.desc); setEntryCat(r.cat); setEntryMethod(r.method);
    setUndo(null);
    setEntryMode('keypad'); setTab('entry');
  };

  const sendStale = async (item) => {
    try {
      const res = await sendQueued(item);
      if (res?.ok || res?.error) dropQueued(item.id);
      setStaleQueue(partition().stale); setPhoneRows(onPhone());
      refresh();
      showToast(S.saved);
    } catch {
      showToast(S.genericError);
    }
  };

  const dropStale = (item) => {
    dropQueued(item.id);
    setStaleQueue(partition().stale); setPhoneRows(onPhone());
  };

  if (!booted) return null;

  // One name for «the dock is on screen» — the scroll box's clearance, the
  // dock's wrapper and the mount all read it, so the reserved space can never
  // disagree with what is actually there (the badge's one-predicate rule,
  // applied to layout).
  const dockShown = !needsSetup && data && tab === 'entry' && entryMode === 'keypad';
  // The entry sheet is open exactly when the keypad would have been the screen.
  const sheetOpen = dockShown;
  const viewTab = sheetOpen ? underTab.current : tab;
  const closeEntry = () => setTab(underTab.current);
  // R9: which capture-flow screen is up (they are full screens, not the sheet).
  const captureMode = !needsSetup && tab === 'entry' && entryMode !== 'keypad' ? entryMode : null;
  // ← keeps a statement's draft (leaveBatch); receipt and dictation return to the keypad sheet.
  const leaveCapture = () => (captureMode === 'batch' ? leaveBatch() : pushDetail(() => setEntryMode('keypad')));

  // B5: the ground the header scrim dissolves into — the same condition the
  // shell's own background reads four lines below, so the strip can never
  // fade toward a colour the page is not actually painting.

  // The badge counts what is still HIS to do — same predicate the buttons and
  // the section header use, so the three can never disagree.


  return (
    <div
      style={{
        // height, NOT min-height: with min-height the flex child below grows to
        // fit its content instead of scrolling, which pushes the tab bar off the
        // bottom of the screen and strands Dad on whichever tab he opened.
        height: '100dvh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        /**
         * THE MORNING CROWN — the Today screen only.
         *
         * It lives on this OUTER, non-scrolling box rather than on <main>. On
         * <main> the gradient would scroll away with the content, and pinning it
         * with `background-attachment: fixed` is unreliable inside an iOS scroll
         * container — a well-known WebKit failure, and this app has exactly one
         * device to be wrong on. Here it simply sits still behind the content.
         */
        /**
         * THE GROUND (glass redesign, 2026-08-28). Three atmospheres, chosen by
         * what the screen is FOR, not by decoration:
         *   · Dawn  — الدفتر / Book. Wakes warm: sand at the crown over mist.
         *   · Tide  — جديد / New. Cool only, no warm stop anywhere, so the one
         *             number the screen exists to show reads clean.
         *   · Haze  — everything else. Near-neutral; keeps receipts calm.
         * It stays on this OUTER, non-scrolling box for the same reason the
         * Morning Crown did: on <main> it would scroll away, and pinning it with
         * `background-attachment: fixed` is unreliable inside an iOS scroll
         * container — one device to be wrong on. `MORNING_CROWN` is retired by
         * `GROUND.dawn`, which is the same idea with the mist and the crown both
         * built from palette hues instead of one linear ramp.
         */
        // v4 R15: Dawn is the ground of the P-screens — Book AND the review
        // queue (P3, P6). The capture flow's own screens keep Tide (R9).
        // R10/A22: the ground is now its OWN layer (below) so the atmosphere can
        // tint it without becoming an ancestor of the fixed bar and sheets.
        // `isolation` makes a stacking context (not a containing block), so the
        // layer's z-index -1 sits above the page but under every child.
        position: 'relative', isolation: 'isolate',
        fontFamily: FONT_UI,
        color: C.ink,
        // The shell's base reading size IS the row size — one prose vocabulary.
        fontSize: TYPE.row,
      }}
    >
      <div aria-hidden className="ground" style={{
        position: 'absolute', inset: 0, zIndex: -1, pointerEvents: 'none',
        background: needsSetup ? GROUND.haze
          : viewTab === 'book' || viewTab === 'inbox' ? GROUND.dawn
          : viewTab === 'entry' ? GROUND.tide
          : GROUND.haze,
      }} />
      <header
        style={{
          /**
           * v4 (OWNER-RULINGS R0 retires B5): no harbor slab and no scrim. The
           * screen's name floats on the ground in ink, and the header controls
           * are ink on glass — the sync pill (R19: it IS the refresh control,
           * and it says when the book was last read) and the settings cog.
           */
          padding: `calc(4px + env(safe-area-inset-top)) 20px 0`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
          color: C.ink,
        }}
      >
        {/* R9: the capture flow's own screens (receipt, statement, dictation) get a
            48px ← back to the entry sheet, and their own name as the title. */}
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {captureMode && (
            <button onClick={leaveCapture} aria-label={S.back}
              style={{ ...glass('chip'), minHeight: TAP, minWidth: TAP, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink, fontSize: TYPE.section, flexShrink: 0 }}>
              <span aria-hidden>{DIR === 'rtl' ? '→' : '←'}</span>
            </button>
          )}
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: TYPE.title, fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {needsSetup ? S.appName
              : captureMode === 'receipt' ? S.receiptTitle
                : captureMode === 'batch' ? S.batchTitle
                  : captureMode === 'dictate' ? S.dictateTitle
                    : viewTab === 'book' ? S.tabBook : viewTab === 'entry' ? S.tabEntry : S.tabInbox}
          </span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* R9: a capture screen's header is ← + its name only (G05–G07) — the title needs the room. */}
          {!needsSetup && !captureMode && <SettingsCog onOpen={() => setSettingsOpen(true)} />}
          {!needsSetup && !captureMode && <RefreshButton state={reading > 0 ? 'busy' : refreshState} onPress={onRefresh} savedAt={savedAt} clock={cairoClock} waiting={phoneRows.filter((r) => !r.held).length} />}
        </span>
      </header>

      {/* minHeight:0 lets a flex child actually shrink so overflow-y works */}
      <main
        style={{
          flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          // C1: the bar floats OVER this scroll box, so the box reserves
          // BAR_CLEARANCE under its content — the last row must be able to
          // rise clear of translucent chrome. Exactly when the bar is there:
          // with the EntryDock up its wrapper carries the clearance instead,
          // and the setup screen has no bar to clear at all.
          padding: !needsSetup
            ? `16px 16px calc(${BAR_CLEARANCE}px + env(safe-area-inset-bottom))`
            : '16px',
        }}
      >
        {needsSetup ? (
          <SetupView onDone={() => { setNeedsSetup(false); refresh(); }} />
        ) : (
          <>
            {offline && <OfflineBanner text={S.offline} />}
            {staleQueue.map((item) => (
              <StaleQueueCard key={item.id} item={item} onSend={() => sendStale(item)} onDrop={() => dropStale(item)} />
            ))}
            {!data ? (
              <Skeleton />
            ) : (
              /**
                * B2 — the view-swap entrance. The KEY is what makes it real:
                * a new tab remounts this wrapper, replaying the .view-in rise
                * (styles.css, at MOTION.page with the reduced-motion floor).
                * Mode changes within the ﹢ tab are B6's View-Transition
                * territory and deliberately do not re-key — two entrance
                * systems on one swap is theatre, which is banned.
                */
              <div key={viewTab} className="view-in">
                {viewTab === 'inbox' && (
                  <InboxView
                    pending={data.pending} settled={settled}
                    onConfirm={confirmPending} onConfirmMany={confirmMany}
                    onEdited={refresh}
                  />
                )}
                {tab === 'entry' && entryMode === 'dictate' && (
                  <DictateView
                    busy={entryBusy}
                    onCancel={() => pushDetail(() => setEntryMode('keypad'))}
                    onSend={sendDictated}
                  />
                )}
                {tab === 'entry' && entryMode === 'receipt' && (
                  <ReceiptView
                    onSaved={(msg, queuedPayload) => {
                      // A confirm that could not reach the server still has to
                      // append a row, so it goes through the normal outbox —
                      // age-gated and clientId-idempotent, exactly like cash.
                      if (queuedPayload) {
                        enqueue({
                          id: queuedPayload.clientId, kind: 'receipt_confirm',
                          ageGated: true, payload: queuedPayload,
                        });
                      } else {
                        refresh();
                      }
                      showToast(msg);
                    }}
                    // «أسجّلها بنفسي» is now a mode switch rather than a tab
                    // change — same screen, other half.
                    onManual={() => pushDetail(() => setEntryMode('keypad'))}
                    onBatch={takeBatchJob}
                  />
                )}
                {tab === 'entry' && entryMode === 'batch' && (
                  <BatchReviewView
                    jobs={batch.jobs}
                    expired={batchExpired}
                    busy={batchBusy}
                    results={batch.settled}
                    onConfirm={confirmBatch}
                    onResnap={resnapBatch}
                    onDiscard={discardBatch}
                    onLeave={leaveBatch}
                  />
                )}
                {viewTab === 'book' && (
                  <BookView
                    data={data}
                    phoneRows={phoneRows}
                    settled={settled}
                    /**
                      * HOW MANY EXPENSES ARE WAITING, UNLOGGED — on a screen he
                      * passes daily (CONTRACT-10, "not optional").
                      *
                      * A pending batch is MONEY MISSING FROM HIS BOOK, and
                      * silence about it is the same defect as «This week 0»: a
                      * screen that looks complete while something real is absent
                      * from it. Tapping it returns him to the review.
                      */
                    displayCurrency={displayCurrency}
                    unsettledBatch={unsettledCount({
                      rows: mergeJobs(batch.jobs), settled: batch.settled,
                    })}
                    onOpenBatch={() => pushDetail(() => { setEntryMode('batch'); setTab('entry'); })}
                    onEdit={editRecent}
                    onRowRemoved={refresh}
                    onGoToInbox={() => setTab('inbox')}
                    onBusyChange={(fn) => { recentLoader.current = fn; }}
                  />
                )}
                {/**
                  * THE STAMP IS VISIBLE WHENEVER WE HAVE ONE — not only offline.
                  *
                  * It used to render only under the offline banner. With a manual
                  * refresh that makes the feature unobservable: he presses, it
                  * succeeds, and nothing on screen confirms anything. The stamp is
                  * what a successful refresh MOVES, so it has to be there to move.
                  *
                  * It is also the only honest answer to "is this current?" — the
                  * screen is a mirror of his sheet as of a moment, and naming the
                  * moment costs one quiet line. A failed refresh leaves it
                  * untouched, which is the whole rule (state/refresh.js).
                  */}
                {/**
                  * THE FOOTER — the timestamp, and ONLY the timestamp now (S1).
                  *
                  * The toggles' journey, so the next mover inherits the map:
                  * header (D16b) → footer (S8, out of prime real estate) →
                  * the Settings sheet (S1, Owner ruling 2026-08-27) — behind
                  * the header's cog, which renders on every tab. The
                  * every-screen requirement that justified each earlier mount
                  * is still honored; it just costs one quiet button now.
                  * The two controls stay independent siblings there (D23),
                  * exactly as they were here.
                  */}
                {/* «Last updated» moved into the header's sync pill (v4 P3, R19). */}
              </div>
            )}
          </>
        )}
      </main>

      <Toast message={toast} />
      <UndoToast undo={undo} onUndo={undoEntry} />
      {/* v4 P2: iOS Safari only, never inside the installed app (state/installCoach.js). */}
      <InstallCoach />
      {/* R19: never while the entry sheet is open — and the undo toast has the floor first. */}
      {update.waiting && !sheetOpen && !undo && <UpdatePrompt onUpdate={update.apply} />}

      {/**
        * S1 — the Settings sheet, mounted at the SHELL so it opens over any
        * tab (a cog on every screen that only worked on some would be a lie
        * told in chrome). Everything inside already owns its state: the flip
        * passed down is the SAME `flipDisplayCurrency` the footer toggle
        * carried — N1b's no-reload law moved house with it, unchanged.
        */}
      {settingsOpen && !needsSetup && (
        <SettingsSheet
          displayCurrency={displayCurrency}
          onFlipCurrency={flipDisplayCurrency}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/**
        * THE PINNED SUBMIT (S1). Outside <main> on purpose: inside it, it scrolls
        * with the keypad and the category grid, which is exactly how it ended up
        * ~200px below the fold on the one screen the five-second law is about.
        * It is a sibling of the tab bar, so it is on screen from the first frame.
        */}
      {sheetOpen && (
        <>
          {/* The screen he came from, dimmed — tapping it closes the sheet. */}
          <button aria-label={S.settingsClose} onClick={closeEntry}
            style={{ position: 'fixed', inset: 0, zIndex: 40, background: SHEET.dim, cursor: 'default' }} />
          <div
            role="dialog" aria-modal="true" aria-label={S.tabEntry} className="view-in"
            onTouchStart={(e) => { const t = e.touches[0]; swipeY.current = t ? { x: t.clientX, y: t.clientY } : null; }}
            onTouchEnd={(e) => {
              // Swipe down to close (v4 P4) — mostly vertical, 80px+, and only
              // from the top of the sheet's scroll so a scroll back up never closes it.
              const st = swipeY.current; swipeY.current = null;
              const c = e.changedTouches[0]; const body = e.currentTarget.querySelector('[data-sheet-body]');
              if (!st || !c || (body && body.scrollTop > 0)) return;
              const dy = c.clientY - st.y; const dx = Math.abs(c.clientX - st.x);
              if (dy >= 80 && dy >= 2 * dx) closeEntry();
            }}
            style={{
              position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 41,
              top: `calc(${SHEET.top}px + env(safe-area-inset-top))`,
              ...glass('sheet'), borderRadius: `${RADIUS.sheetTall}px ${RADIUS.sheetTall}px 0 0`,
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
              {/* geometry exemption (ruling 4): the 40×5 grab bar, its corner bounded by its height */}
              <span aria-hidden style={{ width: 40, height: 5, borderRadius: 3, background: SHEET.handle }} />
            </div>
            <div data-sheet-body style={{
              flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: `6px 20px calc(${SHEET.saveHeight + SHEET.saveBottom + SPACE.gap}px + env(safe-area-inset-bottom))`,
            }}>
              <EntryView
                    onClose={closeEntry}
                    amount={entryAmount} setAmount={setEntryAmount}
                    desc={entryDesc} setDesc={setEntryDesc}
                    cat={entryCat} setCat={setEntryCat}
                    method={entryMethod} setMethod={setEntryMethod}
                    currency={entryCurrency}
                    /**
                      * The toggle is offered only where the write can honour it
                      * — same rule as the dictation button, and for a worse
                      * reason: a dead control does nothing, this one would post
                      * a wrong number and report success.
                      */
                    setCurrency={supportsCurrency(build, AWAY_CURRENCY)
                      ? (c) => setStoredCurrency(persistCurrency(c))
                      : undefined}
                    onCamera={() => pushDetail(() => setEntryMode('receipt'))}
                    /**
                      * SHOWN ONLY IF THE SERVER KNOWS THE VERB. Absent
                      * capability list ⇒ no button, which is the state of the
                      * backend serving right now. It lights up on its own the
                      * moment V20 publishes `voice`; there is no flag to flip.
                      */
                    onDictate={supportsAction(build, 'voice')
                      ? () => pushDetail(() => setEntryMode('dictate'))
                      : undefined}
                  />
            </div>
            <div style={{ position: 'absolute', left: 20, right: 20, bottom: `max(${SHEET.saveBottom}px, env(safe-area-inset-bottom))` }}>
              <EntryDock amount={entryAmount} cat={entryCat} currency={entryCurrency} onSubmit={submitEntry} busy={entryBusy} />
            </div>
          </div>
        </>
      )}

      {/* v4 P4: the bar hides while the entry sheet is open (R17). */}
      {!needsSetup && !sheetOpen && (
        <nav
          style={{
            position: 'fixed', zIndex: 30,
            left: `calc(${NAV.inset}px + env(safe-area-inset-left))`,
            right: `calc(${NAV.inset}px + env(safe-area-inset-right))`,
            bottom: `max(${NAV.bottom}px, env(safe-area-inset-bottom))`,
            height: NAV.height, padding: NAV.pad, gap: NAV.gap, boxSizing: 'border-box',
            display: 'flex', alignItems: 'stretch',
            ...glass('chrome'),
          }}
        >
          {/**
            * THREE DESTINATIONS (finding M1). What needs him · make an entry ·
            * read the book. «فاتورة» became a mode of ﹢, and «اليوم» and «الأخير»
            * were one list at two zooms — they are «الدفتر» now, with the period
            * control on top.
            *
            * The ﹢ ALWAYS returns to the keypad. Landing on the camera because
            * that is where he happened to leave the tab is the shape-changed-
            * under-you problem, on the screen where five seconds are the law.
            */}
          <TabButton active={tab === 'inbox'} onClick={() => setTab('inbox')} label={S.tabInbox} badge={pendingCount || null} icon={<TrayIcon />} />
          <TabButton
            active={tab === 'entry'} label={S.tabEntry} icon={<PlusIcon />} big
            onClick={() => { setEntryMode('keypad'); setTab('entry'); }}
          />
          <TabButton active={tab === 'book'} onClick={() => setTab('book')} label={S.tabBook} icon={<LedgerIcon />} />
        </nav>
      )}

      {USING_MOCK && (
        // geometry exemption (ruling 4): dev-only chrome — a 6px corner on a
        // ~16px badge Dad never sees; a surface token would clamp it to a pill.
        <div style={{ position: 'fixed', top: 0, insetInlineStart: 0, background: C.conflictInk, color: C.onDark, fontSize: TYPE.caption, fontWeight: 700, padding: '2px 6px', borderEndEndRadius: 6, zIndex: 50 }}>
          MOCK
        </div>
      )}
    </div>
  );
}

/**
 * A queued write that has outlived the server's 6 h dedupe window. Sending it
 * again COULD double-write, so it never flushes on its own — he decides.
 *
 * B4b VERDICT: ARRIVES — so it rides the ONE Sheet (B4).
 *
 * The ruled test: over/into an already-painted flow on a state change, or
 * rendered WITH its content? `staleQueue` is recomputed after every outbox
 * flush (boot, reconnect, visibilitychange), so this card can appear ABOVE
 * whatever he is reading the moment an entry crosses the 6 h window —
 * OfflineBanner's sibling in position and in grammar, and that banner
 * already rides the Sheet. RADIUS.card is retired on this surface: the lip
 * and the entrance are the primitive's; the sand fill and the meaning
 * border stay this site's (A2: advisory surfaces are bordered by name).
 *
 * Exported for test-chunk-b4b's render half.
 */
export function StaleQueueCard({ item, onSend, onDrop }) {
  return (
    <Sheet
      style={{
        background: C.sand, border: `1px solid ${C.line}`,
        padding: 14, marginBottom: 12,
      }}
    >
      <div style={{ fontWeight: 700, color: C.ink, fontSize: TYPE.body }}>{S.outboxStaleTitle}</div>
      {/* A8: `opacity: 0.85` deleted — this is the sentence explaining that
          entries are stuck in the outbox, which is the whole point of the card. */}
      <div style={{ fontSize: TYPE.label, color: C.ink, marginTop: 4, lineHeight: 1.6 }}>
        {S.outboxStaleNote}
      </div>
      <div style={{ fontSize: TYPE.label, marginTop: 8, direction: 'ltr', unicodeBidi: 'isolate', textAlign: 'end' }}>
        {item.payload?.description} · {item.payload?.amount} · {item.payload?.entryDate}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          className="bigbtn" onClick={onSend}
          style={{ flex: 1, minHeight: 48, borderRadius: RADIUS.row, background: C.harbor, color: C.onDark, fontSize: 16, fontWeight: 700 }}
        >
          {S.outboxSend}
        </button>
        <button
          className="catchip" onClick={onDrop}
          style={{ minHeight: 48, padding: '0 16px', borderRadius: RADIUS.row, background: 'transparent', border: `1px solid ${C.line}`, color: C.ink, fontSize: 15, fontWeight: 600 }}
        >
          {S.outboxDrop}
        </button>
      </div>
    </Sheet>
  );
}

// True first run only — every later launch paints from the snapshot.
/**
 * v4 P8 — THE FIRST READ, with nothing saved on the phone. Placeholder blocks
 * hold the layout steady where the period well, the hero and the ledger will
 * land, so nothing jumps when the sheet answers. (With a saved copy, the copy
 * shows instead and the pill says how old it is.)
 */
function Skeleton() {
  const bar = (w, h, c) => <span style={{ width: w, height: h, borderRadius: RADIUS.capsule, background: c }} />;
  return (
    <div aria-busy="true" aria-label={S.fetchingSheet}>
      <div style={{ ...glass('well'), borderRadius: RADIUS.capsule, height: 56 }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '34px 0 30px' }}>
        {bar(110, 14, SKELETON.strong)}
        {/* geometry exemption (ruling 4): the hero's placeholder slab — a 14px corner bounded by its 52px height */}
        <span style={{ width: 230, height: 52, borderRadius: 14, background: SKELETON.strong }} />
        {bar(180, 14, SKELETON.strong)}
      </div>
      <div style={{ ...glass('card'), overflow: 'hidden' }}>
        {[[150, 90, 70], [120, 80, 60], [140, 70, 66]].map(([a, b2, c], i) => (
          <div key={i} style={{ minHeight: 68, padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: i ? GLASS_DIVIDER : 'none' }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{bar(a, 12, SKELETON.row)}{bar(b2, 10, SKELETON.faint)}</span>
            {bar(c, 14, SKELETON.row)}
          </div>
        ))}
      </div>
    </div>
  );
}
