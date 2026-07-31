import { useState, useEffect, useRef, useCallback } from 'react';
import { C, FONT_DISPLAY, FONT_UI } from './theme.js';
import { S } from './i18n/strings.js';
import { fetchSummary, fixCategory, postManual, receiptConfirm, USING_MOCK } from './api/index.js';
import { getCreds, consumeHashCredentials } from './state/secret.js';
import { loadSnapshot, saveSnapshot } from './state/cache.js';
import { enqueue, flush, partition, remove as dropQueued } from './state/outbox.js';
import { cairoDateStr, cairoClock, newClientId } from './lib/dates.js';
import { isSummaryShape, withDefaults } from './lib/summaryShape.js';
import { TabButton, Toast, OfflineBanner } from './components/Primitives.jsx';
import SetupView from './views/SetupView.jsx';
import InboxView from './views/InboxView.jsx';
import CashView from './views/CashView.jsx';
import ReceiptView from './views/ReceiptView.jsx';
import SummaryView from './views/SummaryView.jsx';

/**
 * The app shell.
 *
 * Three rules this file enforces:
 *  - NEVER a blank screen. Paint from the last snapshot immediately, labelled
 *    with its timestamp, then swap in fresh data behind it. A skeleton appears
 *    only on a true first run.
 *  - Every action writes immediately. There is no "save" step; Today mirrors the
 *    sheet. The prototype's "Write N rows" button is gone on purpose.
 *  - Optimistic, but never a lie. The card leaves the screen at once, and if the
 *    server disagrees we say so plainly and refetch rather than leaving him
 *    looking at something that did not happen.
 */
export default function App() {
  const [booted, setBooted] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [tab, setTab] = useState('inbox');
  const [data, setData] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [offline, setOffline] = useState(false);
  const [toast, setToast] = useState(null);
  const [staleQueue, setStaleQueue] = useState([]);
  const toastTimer = useRef(null);

  // cash entry state
  const [cashAmount, setCashAmount] = useState('');
  const [cashDesc, setCashDesc] = useState('');
  const [cashCat, setCashCat] = useState(null);
  const [cashBusy, setCashBusy] = useState(false);

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
        setSavedAt(Date.now());
        saveSnapshot(clean);
        setOffline(false);
      } else {
        setOffline(true);
      }
    } catch {
      // Keep whatever is on screen. Losing signal in Cairo is normal, not an error.
      setOffline(true);
    }
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

  // ——— boot
  useEffect(() => {
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
    }
    setBooted(true);
    setStaleQueue(partition().stale);
    refresh();
    runOutbox();
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
  const confirmPending = async (item, category) => {
    // Optimistic: the card goes now. He has done his part.
    setData((d) => ({
      ...d,
      pending: d.pending.filter((p) => !(p.tab === item.tab && p.rowHint === item.rowHint)),
      today: {
        ...d.today,
        entries: [...d.today.entries, { ...item.match, category }],
        totals: addToTotals(d.today.totals, item.match),
      },
    }));
    showToast(S.saved);

    const payload = { tab: item.tab, rowHint: item.rowHint, match: item.match, newCategory: category };
    try {
      const res = await fixCategory(payload);
      if (res?.ok) return;
      if (res?.error === 'row_not_found') {
        // He already fixed it in the sheet. That is a success, not a failure.
        showToast(S.alreadyFixed);
        refresh();
      } else if (res?.error === 'row_changed') {
        refresh();
      } else {
        showToast(S.genericError);
        refresh();
      }
    } catch {
      // Offline. Not age-gated: the server's concurrency guard makes a late
      // replay safe at any age (see state/outbox.js).
      enqueue({ id: newClientId(), kind: 'fix_category', ageGated: false, payload });
      showToast(S.queued);
    }
  };

  const submitCash = async () => {
    const amount = parseFloat(cashAmount);
    if (!amount || !cashCat || cashBusy) return;

    const clientId = newClientId();
    const payload = {
      amount,
      method: 'Cash',
      category: cashCat,
      description: cashDesc || cashCat,
      clientId,
      // Stamped at TAP time, not send time — an entry flushed after midnight
      // must keep the day he actually spent the money.
      entryDate: cairoDateStr(),
    };

    setCashBusy(true);
    setData((d) => ({
      ...d,
      today: {
        ...d.today,
        entries: [...d.today.entries, {
          date: payload.entryDate, description: payload.description,
          method: 'Cash', category: cashCat, amount, currency: 'EGP',
        }],
        totals: { ...d.today.totals, Cash: d.today.totals.Cash + amount },
      },
    }));

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
      setCashBusy(false);
      setCashAmount('');
      setCashDesc('');
      setCashCat(null);
      setTab('summary');
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

  const pendingCount = data?.pending?.length || 0;

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
        background: C.paper,
        fontFamily: FONT_UI,
        color: C.ink,
        fontSize: 17,
      }}
    >
      <header
        style={{
          background: C.nile, color: '#EDE6D4',
          padding: `calc(12px + env(safe-area-inset-top)) 20px 12px`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        }}
      >
        <span style={{ fontFamily: FONT_DISPLAY, fontSize: 21, fontWeight: 650 }}>{S.appName}</span>
        {data && (
          <span style={{ fontSize: 12.5, opacity: 0.75, direction: 'ltr' }}>
            {`${data.today_cairo.d}/${data.today_cairo.m}/${data.today_cairo.y}`}
          </span>
        )}
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
                {tab === 'inbox' && <InboxView pending={data.pending} onConfirm={confirmPending} />}
                {tab === 'cash' && (
                  <CashView
                    amount={cashAmount} setAmount={setCashAmount}
                    desc={cashDesc} setDesc={setCashDesc}
                    cat={cashCat} setCat={setCashCat}
                    onSubmit={submitCash} busy={cashBusy}
                  />
                )}
                {tab === 'receipt' && (
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
                    onManual={() => setTab('cash')}
                  />
                )}
                {tab === 'summary' && <SummaryView data={data} />}
                {savedAt && offline && (
                  <p style={{ fontSize: 12.5, color: C.faint, textAlign: 'center', marginTop: 14 }}>
                    {S.lastUpdated} <span style={{ direction: 'ltr', unicodeBidi: 'isolate' }}>{cairoClock(savedAt)}</span>
                  </p>
                )}
              </>
            )}
          </>
        )}
      </main>

      <Toast message={toast} />

      {!needsSetup && (
        <nav
          style={{
            display: 'flex', borderTop: `1px solid ${C.line}`, background: C.card,
            paddingBottom: 'env(safe-area-inset-bottom)', flexShrink: 0,
          }}
        >
          <TabButton active={tab === 'inbox'} onClick={() => setTab('inbox')} label={S.tabInbox} badge={pendingCount || null} icon="✉" />
          <TabButton active={tab === 'cash'} onClick={() => setTab('cash')} label={S.tabCash} icon="﹢" big />
          <TabButton active={tab === 'receipt'} onClick={() => setTab('receipt')} label={S.tabReceipt} icon="🧾" />
          <TabButton active={tab === 'summary'} onClick={() => setTab('summary')} label={S.tabSummary} icon="☰" />
        </nav>
      )}

      {USING_MOCK && (
        <div style={{ position: 'fixed', top: 0, insetInlineStart: 0, background: C.brass, color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderEndEndRadius: 6, zIndex: 50 }}>
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
        background: C.warnBg, border: `1px solid ${C.brassSoft}`, borderRadius: 14,
        padding: 14, marginBottom: 12,
      }}
    >
      <div style={{ fontWeight: 700, color: '#7A5B12', fontSize: 15.5 }}>{S.outboxStaleTitle}</div>
      <div style={{ fontSize: 14, color: '#7A5B12', opacity: 0.85, marginTop: 4, lineHeight: 1.6 }}>
        {S.outboxStaleNote}
      </div>
      <div style={{ fontSize: 14.5, marginTop: 8, direction: 'ltr', unicodeBidi: 'isolate', textAlign: 'end' }}>
        {item.payload?.description} · {item.payload?.amount} · {item.payload?.entryDate}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          className="bigbtn" onClick={onSend}
          style={{ flex: 1, minHeight: 48, borderRadius: 12, background: C.confirm, color: '#fff', fontSize: 16, fontWeight: 700 }}
        >
          {S.outboxSend}
        </button>
        <button
          className="catchip" onClick={onDrop}
          style={{ minHeight: 48, padding: '0 16px', borderRadius: 12, background: 'transparent', border: `1px solid ${C.brassSoft}`, color: '#7A5B12', fontSize: 15, fontWeight: 600 }}
        >
          {S.outboxDrop}
        </button>
      </div>
    </div>
  );
}

function addToTotals(totals, match) {
  if (match.currency !== 'EGP') return totals;   // travel rows are never in EGP sums
  return { ...totals, [match.method]: totals[match.method] + match.amount };
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
