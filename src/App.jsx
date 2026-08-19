import { useState, useEffect, useRef, useCallback } from 'react';
import { C, FONT_DISPLAY, FONT_UI, MORNING_CROWN } from './theme.js';
import { S, LOCALE } from './i18n/strings.js';
import { applyDocumentLang } from './state/lang.js';
import { createRefresher, resultState } from './state/refresh.js';
import { fetchSummary, fixCategory, postManual, postVoice, receiptConfirm, ping, USING_MOCK } from './api/index.js';
import { getCreds, consumeHashCredentials } from './state/secret.js';
import { loadSnapshot, saveSnapshot } from './state/cache.js';
import { enqueue, flush, partition, remove as dropQueued } from './state/outbox.js';
import {
  cardKey, outcomeFor, reconcile, remaining, pruneSettled, applyCategoryToToday,
} from './state/inboxOutcomes.js';
import { confirmPayload, editPayload } from './state/fixPayload.js';
import { DEFAULT_METHOD, manualPayload, applyEntryToToday } from './state/entryPayload.js';
import { entryReady } from './state/entryDock.js';
import { openingTab, cairoHourOf } from './state/opening.js';
import { remember } from './state/repeats.js';
import { setBadge } from './state/badge.js';
import { getCurrency, setCurrency as persistCurrency, AWAY_CURRENCY } from './state/travel.js';
import { supportsAction, supportsCurrency, effectiveCurrency, loadBuild, saveBuild } from './state/capabilities.js';
import { cairoDateStr, cairoClock, newClientId } from './lib/dates.js';
import { isSummaryShape, withDefaults } from './lib/summaryShape.js';
import { TabButton, Toast, OfflineBanner, LangToggle, RefreshButton } from './components/Primitives.jsx';
import SetupView from './views/SetupView.jsx';
import InboxView from './views/InboxView.jsx';
import EntryView, { EntryDock } from './views/EntryView.jsx';
import ReceiptView from './views/ReceiptView.jsx';
import DictateView from './views/DictateView.jsx';
import BookView from './views/BookView.jsx';

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
   * THE ﹢ TAB HAS TWO MODES (finding M1). «فاتورة» was a whole destination
   * holding one button; a receipt is a way of making an entry, not a place, so
   * the camera is a mode of the entry screen. Reset on every visit to the tab:
   * he should always land on the keypad, which is the daily path.
   */
  const [entryMode, setEntryMode] = useState('keypad');
  const [data, setData] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [offline, setOffline] = useState(false);
  const [toast, setToast] = useState(null);
  const [staleQueue, setStaleQueue] = useState([]);
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

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const refresh = useCallback(async () => {
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
    const { sent } = await flush(sendQueued);
    setStaleQueue(partition().stale);
    if (sent > 0) refresh();
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
  const pendingCount = remaining(reconcile(data?.pending, settled));

  /**
   * THE SAME COUNT, ON THE HOME-SCREEN ICON (finding A6).
   *
   * `pendingCount` and nothing else — the badge, the tab and the Inbox headline
   * all read one number, which is finding S3 held one layer further out. A third
   * counter on the icon would be the badge-vs-headline contradiction arriving
   * where he sees it before the app is even open.
   *
   * Passive by construction: no permission prompt, no push server, no
   * notification. It appears when something is waiting and clears itself when
   * nothing is — the automatic PROMPT the Fogg model wants, without the nagging
   * CLAUDE.md #5 forbids.
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
    setStaleQueue(partition().stale);
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

    const payload = confirmPayload(item, category);
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
        setEntryMode('keypad');
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
  const submitEntry = async () => {
    /**
     * ONE readiness rule, read from `state/entryDock.js` — the same value the
     * pinned button's `disabled` reads. This handler used to carry its own
     * second, subtly different version of the same test, which accepted a "0"
     * that the view's own check rejected. scripts/test-dock.mjs greps this file
     * for that expression, so the sentence describing it deliberately does not
     * spell it.
     */
    if (!entryReady({ amount: entryAmount, cat: entryCat, busy: entryBusy })) return;
    const amount = parseFloat(entryAmount);

    const clientId = newClientId();
    const payload = manualPayload({
      amount,
      method: entryMethod,
      category: entryCat,
      description: entryDesc,
      clientId,
      entryDate: cairoDateStr(),
      currency: entryCurrency,
    });

    setEntryBusy(true);
    setData((d) => (d ? {
      ...d,
      today: applyEntryToToday(d.today, {
        date: payload.entryDate, description: payload.description,
        method: payload.method, category: payload.category,
        amount, currency: 'EGP',
      }),
    } : d));

    try {
      const res = await postManual(payload);
      if (res?.ok) {
        showToast(S.saved);
        refresh();
      } else {
        showToast(S.genericError);
      }
    } catch {
      // Offline. It is his money either way — queue it and say so honestly
      // rather than claiming it was saved.
      enqueue({ id: clientId, kind: 'manual', ageGated: true, payload });
      showToast(S.queued);
    } finally {
      setEntryBusy(false);
      /**
       * Recorded AFTER the write is accepted, never on the tap (finding A3).
       * A chip offering to repeat something that failed to reach his sheet would
       * be the app remembering an expense he does not have.
       */
      remember({
        description: payload.description, category: payload.category,
        method: payload.method, amount: Number(payload.amount), currency: entryCurrency,
      });
      setEntryAmount('');
      setEntryDesc('');
      setEntryCat(null);
      // Back to Cash, deliberately. A sticky Card would file his next cash
      // expense into the card column on a screen he has stopped reading.
      setEntryMethod(DEFAULT_METHOD);
      setTab('book');
    }
  };

  const sendStale = async (item) => {
    try {
      const res = await sendQueued(item);
      if (res?.ok || res?.error) dropQueued(item.id);
      setStaleQueue(partition().stale);
      refresh();
      showToast(S.saved);
    } catch {
      showToast(S.genericError);
    }
  };

  const dropStale = (item) => {
    dropQueued(item.id);
    setStaleQueue(partition().stale);
  };

  if (!booted) return null;

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
        background: tab === 'book' && !needsSetup ? MORNING_CROWN : C.shell,
        fontFamily: FONT_UI,
        color: C.ink,
        fontSize: 17,
      }}
    >
      <header
        style={{
          background: C.harbor, color: C.onDark,
          padding: `calc(12px + env(safe-area-inset-top)) 20px 12px`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        }}
      >
        <span style={{ fontFamily: FONT_DISPLAY, fontSize: 21, fontWeight: 650 }}>{S.appName}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {data && (
            <span style={{ fontSize: 12.5, opacity: 0.75, direction: 'ltr' }}>
              {`${data.today_cairo.d}/${data.today_cairo.m}/${data.today_cairo.y}`}
            </span>
          )}
          {!needsSetup && <RefreshButton state={refreshState} onPress={onRefresh} />}
        </span>
      </header>

      {/* minHeight:0 lets a flex child actually shrink so overflow-y works */}
      <main style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: 16 }}>
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
              <>
                {tab === 'inbox' && (
                  <InboxView
                    pending={data.pending} settled={settled}
                    onConfirm={confirmPending} onConfirmMany={confirmMany}
                  />
                )}
                {tab === 'entry' && entryMode === 'keypad' && (
                  <EntryView
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
                    onCamera={() => setEntryMode('receipt')}
                    /**
                      * SHOWN ONLY IF THE SERVER KNOWS THE VERB. Absent
                      * capability list ⇒ no button, which is the state of the
                      * backend serving right now. It lights up on its own the
                      * moment V20 publishes `voice`; there is no flag to flip.
                      */
                    onDictate={supportsAction(build, 'voice')
                      ? () => setEntryMode('dictate')
                      : undefined}
                  />
                )}
                {tab === 'entry' && entryMode === 'dictate' && (
                  <DictateView
                    busy={entryBusy}
                    onCancel={() => setEntryMode('keypad')}
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
                    onManual={() => setEntryMode('keypad')}
                  />
                )}
                {tab === 'book' && (
                  <BookView
                    data={data}
                    settled={settled}
                    onEdit={editRecent}
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
                  * THE FOOTER — the timestamp, and now the language switch (S8).
                  *
                  * The toggle used to sit in the header, where it was the second
                  * most prominent control on every screen in the app, for a
                  * setting Dad will change exactly zero times: he reads Arabic,
                  * and Arabic is the default. It cost prime real estate on all
                  * five tabs to serve Tarek's own install once.
                  *
                  * It is still reachable from EVERY screen — this footer renders
                  * under every tab's content — which is the requirement that put
                  * it in the header in the first place (SetupView is unreachable
                  * once the app is set up). It is just no longer shouting.
                  */}
                <footer style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 12, marginTop: 18, flexWrap: 'wrap',
                }}>
                  {savedAt && (
                    <span style={{ fontSize: 12.5, color: C.muted }}>
                      {refreshState === 'failed' ? `${S.refreshFailed} · ` : ''}
                      {S.lastUpdated} <span style={{ direction: 'ltr', unicodeBidi: 'isolate' }}>{cairoClock(savedAt)}</span>
                    </span>
                  )}
                  <LangToggle subtle />
                </footer>
              </>
            )}
          </>
        )}
      </main>

      <Toast message={toast} />

      {/**
        * THE PINNED SUBMIT (S1). Outside <main> on purpose: inside it, it scrolls
        * with the keypad and the category grid, which is exactly how it ended up
        * ~200px below the fold on the one screen the five-second law is about.
        * It is a sibling of the tab bar, so it is on screen from the first frame.
        */}
      {!needsSetup && data && tab === 'entry' && entryMode === 'keypad' && (
        <EntryDock
          amount={entryAmount} cat={entryCat} currency={entryCurrency}
          onSubmit={submitEntry} busy={entryBusy}
        />
      )}

      {!needsSetup && (
        <nav
          style={{
            display: 'flex', borderTop: `1px solid ${C.line}`, background: C.card,
            paddingBottom: 'env(safe-area-inset-bottom)', flexShrink: 0,
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
          <TabButton active={tab === 'inbox'} onClick={() => setTab('inbox')} label={S.tabInbox} badge={pendingCount || null} icon="✉" />
          <TabButton
            active={tab === 'entry'} label={S.tabEntry} icon="﹢" big
            onClick={() => { setEntryMode('keypad'); setTab('entry'); }}
          />
          <TabButton active={tab === 'book'} onClick={() => setTab('book')} label={S.tabBook} icon="☰" />
        </nav>
      )}

      {USING_MOCK && (
        <div style={{ position: 'fixed', top: 0, insetInlineStart: 0, background: C.conflictInk, color: C.onDark, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderEndEndRadius: 6, zIndex: 50 }}>
          MOCK
        </div>
      )}
    </div>
  );
}

/**
 * A queued write that has outlived the server's 6 h dedupe window. Sending it
 * again COULD double-write, so it never flushes on its own — he decides.
 */
function StaleQueueCard({ item, onSend, onDrop }) {
  return (
    <div
      style={{
        background: C.sand, border: `1px solid ${C.line}`, borderRadius: 14,
        padding: 14, marginBottom: 12,
      }}
    >
      <div style={{ fontWeight: 700, color: C.ink, fontSize: 15.5 }}>{S.outboxStaleTitle}</div>
      <div style={{ fontSize: 14, color: C.ink, opacity: 0.85, marginTop: 4, lineHeight: 1.6 }}>
        {S.outboxStaleNote}
      </div>
      <div style={{ fontSize: 14.5, marginTop: 8, direction: 'ltr', unicodeBidi: 'isolate', textAlign: 'end' }}>
        {item.payload?.description} · {item.payload?.amount} · {item.payload?.entryDate}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          className="bigbtn" onClick={onSend}
          style={{ flex: 1, minHeight: 48, borderRadius: 12, background: C.harbor, color: C.onDark, fontSize: 16, fontWeight: 700 }}
        >
          {S.outboxSend}
        </button>
        <button
          className="catchip" onClick={onDrop}
          style={{ minHeight: 48, padding: '0 16px', borderRadius: 12, background: 'transparent', border: `1px solid ${C.line}`, color: C.ink, fontSize: 15, fontWeight: 600 }}
        >
          {S.outboxDrop}
        </button>
      </div>
    </div>
  );
}

// True first run only — every later launch paints from the snapshot.
function Skeleton() {
  return (
    <div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            background: C.card, border: `1px solid ${C.line}`, borderRadius: 18,
            height: 132, marginBottom: 14, opacity: 0.55,
          }}
        />
      ))}
    </div>
  );
}
