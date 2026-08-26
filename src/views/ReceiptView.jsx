import { useState, useRef, useEffect } from 'react';
import { C, METHOD, FONT_DISPLAY, NUMERALS, TAP } from '../theme.js';
import { S, categoryLabel } from '../i18n/strings.js';
import { CATEGORIES, SHORT_LIST } from '../lib/constants.js';
import { money, normalizeDigits } from '../lib/format.js';
import { newClientId, cairoClock } from '../lib/dates.js';
import { prepareReceipt, snapDateISO, ReceiptImageError } from '../lib/receipt-image.js';
import { thumbUrl, revokeThumb } from '../lib/jobThumb.js';
import { receiptExtract, receiptConfirm } from '../api/index.js';
import * as queue from '../state/receiptQueue.js';
import { createWorker } from '../state/receiptWorker.js';
import { isActionable, cappedCount, effectiveStage, jobMerchant } from '../state/receiptStages.js';
import { isMethod, DEFAULT_METHOD } from '../state/entryPayload.js';
import { dupState, bookFrom, undatedHint, isBlocked, confirmOutcome } from '../state/receiptDup.js';
import { SectionLabel, LATIN } from '../components/Primitives.jsx';

/**
 * Two-phase receipt capture (contract §3.3–§3.4).
 *
 * The rule that shapes every state below: **nothing unconfirmed is ever
 * written.** Phase 1 reads the photo and writes nothing at all; phase 2 appends
 * exactly one row, and only from values Dad has looked at. The model never picks
 * the category — that comes from his own Memory tab or from his tap.
 *
 * States: idle → working (S1) → review (S2 confident / S3 uncertain)
 *                             → notReceipt (S4) → queued (S5, offline).
 */
const ISO_TO_DMY = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${Number(m[3])}/${Number(m[2])}/${m[1]}` : '';
};

// Field-test diagnostics, off unless explicitly switched on.
const debugOn = () => {
  try { return localStorage.getItem('masareef.debug') === '1'; } catch { return false; }
};

const ERROR_TEXT = {
  'image_too_large': S.receiptTooLarge,
  'daily-limit': S.receiptNoQuota,
  'ocr_not_configured': S.receiptNotConfigured,
  'vision_failed': S.receiptFailed,
};

export default function ReceiptView({ onSaved, onManual, onBatch }) {
  const [stage, setStage] = useState('idle');
  const [slow, setSlow] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [jobs, setJobs] = useState([]);
  const [reviewingId, setReviewingId] = useState(null);

  const [shot, setShot] = useState(null);          // { base64, clientHash, snapDate }
  const [extraction, setExtraction] = useState(null);
  const [dup, setDup] = useState({ sms: false, photo: false, book: null });
  const [dupUndated, setDupUndated] = useState(false);
  const [overrideDup, setOverrideDup] = useState(false);

  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [method, setMethod] = useState('Cash');
  const [category, setCategory] = useState(null);
  const [showAllCats, setShowAllCats] = useState(false);
  const [saving, setSaving] = useState(false);

  const fileRef = useRef(null);
  const slowTimer = useRef(null);
  const libraryRef = useRef(null);

  const refreshQueueCount = () => queue.count().then(setPendingCount);
  const refreshJobs = () => queue.all().then((list) => { setJobs(list); setPendingCount(list.length); });

  /**
   * ONE worker for the life of the view (WS4-Q). Created in a ref rather than
   * on every render, because a second worker would be a second thing in flight —
   * and "one extraction at a time" is a promise about the vision budget and
   * about a list that stays truthful, not an implementation detail.
   */
  const workerRef = useRef(null);
  if (!workerRef.current) {
    workerRef.current = createWorker({
      queue, extract: receiptExtract, onChange: () => { refreshJobs(); },
    });
  }

  useEffect(() => { refreshJobs().then(() => workerRef.current.pump()); }, []);
  useEffect(() => () => clearTimeout(slowTimer.current), []);

  const reset = () => {
    setStage('idle'); setSlow(false); setErrorMsg('');
    setShot(null); setExtraction(null); setDup({ sms: false, photo: false, book: null });
    setDupUndated(false);
    setOverrideDup(false); setAmount(''); setMerchant(''); setDateStr('');
    setMethod(DEFAULT_METHOD); setCategory(null); setShowAllCats(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const applyExtraction = (res, snapDate, clientHash) => {
    const e = res.extraction;
    setExtraction(e);
    setDup(dupState(res));
    setDupUndated(undatedHint(res));
    setAmount(e.amount == null ? '' : String(e.amount));
    setMerchant(e.merchant_display || e.merchant_latin || '');
    // Printed date wins when the server judged it plausible; otherwise the day
    // he took the photo. Either way it is on screen before he confirms.
    setDateStr(ISO_TO_DMY(e.date) || ISO_TO_DMY(snapDate));
    /**
     * THE METHOD DEFAULT COMES FROM THE SERVER (D19).
     *
     * A till receipt still defaults to Cash — the SMS automation already logs
     * every card purchase, so defaulting to Visa would double-count. A PAYMENT
     * SLIP is bank-account money and defaults to Visa. Which column a document
     * belongs in is a statement about HIS ledger, so `CONFIG.SLIP_METHOD`
     * decides it server-side and the client is told, exactly as it is told a tab
     * name rather than constructing one.
     *
     * Validated through the same vocabulary the manual entry uses: an
     * unrecognised value — a LABEL, a stale server, a missing field — degrades
     * to Cash rather than being held, so the app can never post a method the
     * sheet would read as something else.
     */
    setMethod(isMethod(res.defaultMethod) ? res.defaultMethod : DEFAULT_METHOD);
    setCategory(res.category || null);
    setShowAllCats(!res.category);
    /**
     * ⚠️ `doc_type` IS ASKED FIRST, AND `is_receipt` IS NOT THE QUESTION.
     *
     * 06 §3.5: a transaction LIST answers `is_receipt: false` DELIBERATELY, so
     * that a client which predates D20 lands on its not-a-receipt branch rather
     * than misbehaving — the degradation target was "no regression", not "no
     * capability". The contract's instruction to clients that DO know about
     * lists is explicit: *test `doc_type === 'transaction_list'` FIRST.*
     *
     * This line used to read `e.is_receipt ? 'review' : 'notReceipt'` and never
     * looked at `doc_type` at all. The cost was not theoretical: three real bank
     * screenshots were refused on the phone as «Not a receipt» with their rows
     * already extracted and the vision call already paid for, and the only
     * control on that screen re-opened the same verdict. The rows existed; the
     * screen had no door.
     */
    if (e.doc_type === 'transaction_list' && Array.isArray(e.entries) && e.entries.length) {
      setStage('batch');
      if (onBatch) {
        onBatch({
          sourceHash: clientHash,
          // INSIDE the extraction — Code.gs nests the rows; only the count is
          // top-level. res.entries was the mock's invention, not the server's.
          entries: e.entries,
          entriesTotal: res.entriesTotal != null ? res.entriesTotal : e.entries.length,
          /**
           * The server's per-list method ruling (D19 via CONFIG.SLIP_METHOD —
           * "sent so a client never has to know that a card list is card
           * money"). Carried on the job because the wire builder needs it: a
           * confirm row with no `method` is normalised to CASH server-side,
           * which would file his card statement into the wrong column.
           */
          defaultMethod: isMethod(res.defaultMethod) ? res.defaultMethod : DEFAULT_METHOD,
        });
      }
      return;
    }
    setStage(e.is_receipt ? 'review' : 'notReceipt');
  };

  const onFile = async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;

    setStage('working');
    setSlow(false);
    clearTimeout(slowTimer.current);
    // Escape hatch at 20 s, well inside the 45 s transport timeout — he should
    // never feel trapped watching a spinner.
    slowTimer.current = setTimeout(() => setSlow(true), 20000);

    let prepared;
    try {
      prepared = await prepareReceipt(file);
    } catch (err) {
      clearTimeout(slowTimer.current);
      setErrorMsg(err instanceof ReceiptImageError && err.code === 'too-large'
        ? S.receiptTooLarge : S.receiptFailed);
      setStage('error');
      return;
    }

    const snapDate = snapDateISO();
    clearTimeout(slowTimer.current);

    /**
     * ENQUEUE, ALWAYS (WS4-Q). Previously this awaited the extraction inline and
     * he sat watching a spinner before he could photograph the next receipt.
     * Now the photo is handed to the queue and he is returned to the camera
     * immediately; the worker reads them one at a time behind him.
     *
     * Queueing was already here — as the OFFLINE fallback in a catch block. All
     * that changed is that it became the normal path, which is why there is no
     * second queue: the machinery was already correct, it was just only reachable
     * by failing.
     */
    const ok = await queue.enqueue({
      id: prepared.clientHash, base64: prepared.base64,
      clientHash: prepared.clientHash, snapDate,
    });
    if (!ok) {
      // Storage refused it. Say so — a photo he believes is saved and is not is
      // the one unrecoverable outcome, since the receipt is already in the bin.
      setErrorMsg(S.receiptFailed);
      setStage('error');
      return;
    }
    await refreshJobs();
    setStage('idle');
    workerRef.current.pump();
  };

  /** Open a finished job's confirm card. Nothing is written until he taps أكّد. */
  const review = (job) => {
    if (!job?.extraction) return;
    setShot({ base64: job.base64, clientHash: job.clientHash, snapDate: job.snapDate });
    setReviewingId(job.id);
    applyExtraction(job.extraction, job.snapDate, job.clientHash);
  };

  const retry = async (job) => {
    await queue.update(job.id, { stage: 'queued', error: null, retryable: false });
    await refreshJobs();
    workerRef.current.pump();
  };

  /**
   * CANCEL — on every stage, as a BUTTON (R-receipts 3).
   *
   * A button and not a swipe: a swipe is an accelerator for people who already
   * know it is there, and the senior-first rule (CLAUDE.md #5) is that the
   * action must be visible. Nothing here is a swipe target.
   *
   * Order matters. Abort FIRST, delete SECOND: the worker marks the job
   * cancelled inside `cancel()` before the abort can settle its await, so the
   * outcome is dropped rather than written back onto a row we are about to
   * remove. Deleting first would leave a window where the extraction lands, the
   * update finds nothing, and the job silently reappears or does not — a race
   * whose two outcomes look identical from the outside.
   *
   * CANCEL IS NOT UNDO. If a row was already written it stays written; nothing
   * here touches his sheet, because extraction never does (§3.3). What cancel
   * removes is a photo waiting to be read.
   */
  const cancelJob = async (job) => {
    workerRef.current.cancel(job.id);
    await queue.remove(job.id);
    // If he cancelled the card he currently has open, close it too — leaving a
    // confirm card on screen for a job that no longer exists is the same class
    // of lie as the zombie it replaces.
    if (reviewingId === job.id) { setReviewingId(null); reset(); }
    await refreshJobs();
    workerRef.current.pump();
  };

  /**
   * SETTLE A VERDICT (R-receipts 4 + 5).
   *
   * He has now READ "this is not a receipt", so it has stopped being something
   * that needs him — and every exit from that screen settles it, including
   * "photograph again". An exit that left the job actionable would put the row
   * straight back in the list saying it wants attention, which is precisely the
   * immortal card this replaces.
   *
   * The photo is KEPT, at stage `dismissed`, rather than deleted: a not-a-receipt
   * can never become a sheet row, so nothing about keeping it risks a double
   * write, and the picture is still his to look at or remove deliberately.
   */
  const settleVerdict = async () => {
    const id = reviewingId;
    if (id) {
      await queue.update(id, { stage: 'dismissed', error: null, retryable: false });
      setReviewingId(null);
      await refreshJobs();
    }
  };

  const save = async () => {
    const amt = Number(normalizeDigits(amount));
    if (!isFinite(amt) || amt <= 0 || !category || saving) return;

    setSaving(true);
    const payload = {
      clientHash: shot?.clientHash,
      clientId: newClientId(),
      amount: amt,
      currency: extraction?.currency && extraction.currency !== 'UNKNOWN' ? extraction.currency : 'EGP',
      method,
      category,
      description: merchant || category,
      merchantLatin: extraction?.merchant_latin || '',
      dateStr,
    };
    // Only ever sent when he has actually acknowledged a flag. Sending it by
    // default would turn the server's gate into decoration.
    if (overrideDup) payload.dupAck = true;
    try {
      const res = await receiptConfirm(payload);
      const outcome = confirmOutcome(res);
      /**
       * BLOCKED IS NOT SAVED, and `res.ok` cannot tell them apart.
       *
       * The authoritative book check runs at CONFIRM, so the server can refuse a
       * write the extract-time hint thought was clean — an SMS landing in
       * between is exactly the race D18a describes. That answer is
       * `{ok:true, skipped:"book_duplicate"}`: truthy, successful, and NO ROW
       * WRITTEN. Treated as success it would close the card, delete the job from
       * the queue, and lose the expense in silence.
       *
       * So the card STAYS, now carrying the row his book already holds, and the
       * override becomes his one deliberate tap.
       */
      if (outcome === 'blocked') {
        setDup((d) => ({ ...d, book: bookFrom(res) }));
        setDupUndated(undatedHint(res));
        setOverrideDup(false);
        setSaving(false);
        return;
      }
      if (outcome === 'written') {
        const doneId = reviewingId || shot?.clientHash;
        if (doneId) queue.remove(doneId).then(refreshJobs);
        setReviewingId(null);
        onSaved?.(S.saved);
        reset();
      } else {
        setErrorMsg(S.genericError);
        setStage('error');
      }
    } catch {
      // The row still needs writing — hand it to the outbox, which is age-gated
      // and clientId-idempotent exactly like a cash entry.
      onSaved?.(S.queued, payload);
      reset();
    } finally {
      setSaving(false);
    }
  };

  // ——————————————————————————————— render
  if (stage === 'working') {
    return (
      <Centered>
        <div style={{ fontSize: 46 }}>🧾</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 21, fontWeight: 650, color: C.harbor, marginTop: 10 }}>
          {S.receiptReading}
        </div>
        {slow && (
          <>
            <p style={{ color: C.muted, fontSize: 15, marginTop: 10, lineHeight: 1.6, maxWidth: 290 }}>
              {S.receiptSlow}
            </p>
            <button className="bigbtn" onClick={() => { reset(); onManual?.(); }} style={ghostBtn}>
              {S.receiptEnterManually}
            </button>
          </>
        )}
      </Centered>
    );
  }

  if (stage === 'notReceipt') {
    /**
     * THE VERDICT SCREEN — and it now has a way out (R-receipts 4).
     *
     * "I can't even go back." It offered exactly one button, «صوّر تاني», which
     * dropped him back at the camera with the job still sitting in the list
     * claiming to be «جاهز — راجعه» forever.
     *
     * BOTH exits settle it, and that is the whole fix rather than a nicety: a
     * verdict he has read is not a verdict that is still waiting for him. The
     * one thing neither exit does is delete his photo — that stays his to
     * remove, from the list, deliberately.
     */
    return (
      <Centered>
        <div style={{ fontSize: 46 }}>🤔</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 21, fontWeight: 650, color: C.harbor, marginTop: 10 }}>
          {S.receiptNotReceipt}
        </div>
        <p style={{ color: C.muted, fontSize: 15.5, marginTop: 8, lineHeight: 1.6, maxWidth: 290 }}>
          {/**
            * THE REASON, WHEN THE SERVER GAVE ONE (06 §6, `not_expense_reason`).
            *
            * The field was added in August precisely because a refusal without a
            * reason is useless to the person holding the phone: two perfectly
            * legible screenshots were refused CORRECTLY and the app could only
            * say "try again in better light, or enter it yourself" — advice that
            * fitted neither. It has been on the wire since and this screen has
            * never read it.
            *
            * Falls back to the generic body when absent, which is every older
            * server and every reason the enum does not name.
            */}
          {S.notExpenseReason(extraction && extraction.not_expense_reason)
            || S.receiptNotReceiptBody}
        </p>
        <button
          className="bigbtn"
          onClick={() => { settleVerdict().then(reset); }}
          style={primaryBtn}
        >
          {S.receiptVerdictClose}
        </button>
        <button
          className="catchip"
          onClick={() => { settleVerdict().then(reset); }}
          style={ghostBtn}
        >
          {S.receiptRetake}
        </button>
      </Centered>
    );
  }

  if (stage === 'queued') {
    return (
      <Centered>
        <div style={{ fontSize: 46 }}>📥</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 21, fontWeight: 650, color: C.harbor, marginTop: 10 }}>
          {S.receiptQueuedTitle}
        </div>
        <p style={{ color: C.muted, fontSize: 15.5, marginTop: 8, lineHeight: 1.6, maxWidth: 290 }}>
          {S.receiptQueuedBody}
        </p>
        <button className="bigbtn" onClick={reset} style={primaryBtn}>{S.receiptRetake}</button>
      </Centered>
    );
  }

  if (stage === 'error') {
    return (
      <Centered>
        <div style={{ fontSize: 46 }}>🌿</div>
        <p style={{ color: C.ink, fontSize: 16.5, marginTop: 12, lineHeight: 1.6, maxWidth: 300 }}>
          {errorMsg || S.receiptFailed}
        </p>
        <button className="bigbtn" onClick={reset} style={primaryBtn}>{S.receiptRetake}</button>
        <button className="catchip" onClick={() => { reset(); onManual?.(); }} style={ghostBtn}>
          {S.receiptEnterManually}
        </button>
      </Centered>
    );
  }

  if (stage === 'review' && extraction) {
    const lowAmount = extraction.amount_confidence === 'low' || extraction.amount == null;
    const lowMerchant = extraction.merchant_confidence === 'low';
    const lowDate = extraction.date_confidence === 'low';
    const anyLow = lowAmount || lowMerchant || lowDate;
    const ready = Number(normalizeDigits(amount)) > 0 && !!category && !saving;
    const blockedByDup = isBlocked(dup, overrideDup);

    return (
      <div>
        <SectionLabel>{S.receiptCheck}</SectionLabel>

        {/* FIELD-TEST ONLY — enable with localStorage['masareef.debug']='1'.
            Tarek-facing; Dad never sets this flag and never sees this line.
            Exists because iOS Safari's console needs a tethered Mac, which is
            useless mid-field-test, and because a failed EXIF rotation is
            otherwise invisible until extraction quality is statistically bad. */}
        {debugOn() && shot && (
          <div style={{
            fontSize: 12, fontFamily: 'ui-monospace, monospace', direction: 'ltr',
            padding: '6px 10px', borderRadius: 8, marginBottom: 10,
            background: shot.landscape ? C.conflictBg : C.shell,
            color: shot.landscape ? C.conflictInk : C.muted,
            border: `1px solid ${shot.landscape ? C.conflictInk : C.line}`,
          }}>
            {shot.width}×{shot.height} · {Math.round(shot.bytes / 1024)}KB · q{shot.quality}
            {shot.landscape ? ' · ⚠ LANDSCAPE — EXIF rotation not applied?' : ' · portrait ✓'}
          </div>
        )}

        {anyLow && (
          <Banner tone="warn">{S.receiptUnsure}</Banner>
        )}
        {dup.sms && <Banner tone="warn">{S.receiptDupSms}</Banner>}
        {dup.photo && <Banner tone="warn">{S.receiptDupPhoto}</Banner>}

        {/*
          THE BOOK SAYS HE ALREADY HAS THIS (D18a).
          The other two hints are statements about our caches; this one is a ROW
          in his sheet, so it is shown rather than described. He judges it — the
          merchant on a slip and the description on the row rarely match, which
          is exactly why the duplicate key does not compare them.
        */}
        {dup.book && (
          <Banner tone="warn">
            <div>{S.receiptDupBook}</div>
            <div style={{ marginTop: 6, fontWeight: 700, direction: 'ltr', unicodeBidi: 'isolate', textAlign: 'start' }}>
              <span style={LATIN}>{dup.book.match.date}</span>
              {' · '}
              <span dir="auto">{dup.book.match.description || '—'}</span>
              {' · '}
              <span style={{ ...LATIN, ...NUMERALS }}>{money(dup.book.match.amount)}</span>
              {' '}
              <span style={LATIN}>{dup.book.match.currency}</span>
              {' · '}
              <span style={LATIN}>{dup.book.match.method}</span>
            </div>
            {dup.book.count > 1 && (
              <div style={{ marginTop: 4, fontWeight: 500 }}>{S.receiptDupBookMore(dup.book.count)}</div>
            )}
          </Banner>
        )}

        {/* Advisory only, and never a blocker: a row that month has no readable
            date, so we cannot say whether it is this one. Saying nothing would
            be the tidier lie. */}
        {dupUndated && !dup.book && (
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 10, lineHeight: 1.6 }}>
            {S.receiptDupUndated}
          </div>
        )}

        <div style={{ background: C.card, borderRadius: 18, padding: 16 }}>
          <Field label={S.receiptAmount} editable={lowAmount}>
            {lowAmount ? (
              <input
                inputMode="decimal" dir="ltr" value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={inputStyle} autoFocus
              />
            ) : (
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 34, fontWeight: 650, ...LATIN, ...NUMERALS }}>
                {money(amount)} <span style={{ fontSize: 16, color: C.muted }}>{extraction.currency}</span>
              </div>
            )}
          </Field>

          {/* The verbatim line the number came from — he can check our reading
              against the paper in his hand without trusting us. */}
          {extraction.raw_total_line && (
            <div style={{ fontSize: 13, color: C.muted, marginTop: 2, lineHeight: 1.7 }}>
              {S.receiptSaw}{' '}
              <span style={{ background: C.shell, borderRadius: 6, padding: '2px 6px' }} dir="auto">
                {extraction.raw_total_line}
              </span>
            </div>
          )}

          <Field label={S.receiptMerchant} editable={lowMerchant}>
            {lowMerchant ? (
              <input value={merchant} onChange={(e) => setMerchant(e.target.value)} style={inputStyle} dir="auto" />
            ) : (
              <div style={{ fontSize: 17.5, fontWeight: 600 }} dir="auto">{merchant}</div>
            )}
          </Field>

          <Field label={S.receiptDate} editable={lowDate}>
            {lowDate ? (
              <input value={dateStr} onChange={(e) => setDateStr(e.target.value)} style={inputStyle} dir="ltr" />
            ) : (
              <div style={{ fontSize: 16, ...LATIN }}>{dateStr}</div>
            )}
          </Field>

          {/*
            CATEGORY IS A FIELD, not just a chip state (field-found 2026-08-01).
            This card is "راجع وأكّد" — review and confirm — and review means
            seeing everything that will be written. Category was the one value
            heading for his sheet with nowhere on the card that showed it, so a
            chosen category was invisible and an unchosen one looked the same.
            It sits beside amount/merchant/date because it is the same kind of
            thing: a value about to be committed.
            Absent renders as `—`, never as a blank that could pass for a choice.
          */}
          <Field label={S.receiptCategory}>
            {/*
              EXPLICIT right alignment (P4b). The card is RTL, so its other
              values sit right by inheritance — but a Latin category name with
              `dir="auto"` is resolved LTR and drifts to the left, breaking the
              column. `textAlign: 'right'` and not `'end'`: inside an RTL
              container `end` means LEFT, which is the bug, spelled differently.
            */}
            <div
              style={{
                fontSize: 17.5, fontWeight: 600,
                color: category ? C.ink : C.muted,
                textAlign: 'right',
              }}
            >
              {category ? <span dir="auto">{categoryLabel(category)}</span> : '—'}
            </div>
          </Field>

          {/* Cash / Visa. Cash is the default and the steer explains why, so the
              same purchase is not counted twice. */}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            {['Cash', 'Visa'].map((m) => (
              <button
                key={m}
                className="catchip"
                onClick={() => setMethod(m)}
                aria-pressed={method === m}
                style={{
                  flex: 1, minHeight: TAP, borderRadius: 12, fontSize: 16, fontWeight: 700,
                  background: method === m ? METHOD[m].bg : C.shell,
                  color: method === m ? METHOD[m].fg : C.ink,
                  border: `1px solid ${method === m ? C.harbor : C.line}`,
                }}
              >
                {m === 'Visa' ? S.metricVisa : S.metricCash}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6, textAlign: 'center' }}>
            {S.receiptCashSteer}
          </div>
        </div>

        {/*
          Category chips: a SELECTION, not a commit.
          
          WHY THIS DIVERGED FROM THE INBOX, which is where the bug came from.
          The Inbox's chips are commit buttons — `onConfirm(item, c)` writes the
          row and the card disappears — so filtering the guess out of the list is
          right there: it already has its own green button, and any tap ends the
          card. That idiom was copied here, where the chips only set state and
          the write happens later at أكّد. Two faults compounded:
          `.filter(c => c !== category)` REMOVED the chip he tapped, and the
          green ✓ summary was hidden by `showAllCats` — which tapping a chip
          sets. So a tap made the chip vanish and displayed nothing in its place.
          
          Now: every chip stays, the selected one is filled, tapping another
          moves the selection, and tapping the selected one clears it. The list
          he can choose from does not change shape when he chooses.
        */}
        {category && !showAllCats && (
          <button className="bigbtn" onClick={() => setShowAllCats(true)} style={{ ...chipStyle, marginTop: 12, width: '100%', background: C.harbor, color: C.onDark, fontSize: 18, fontWeight: 700, minHeight: 56 }}>
            ✓ <span dir="auto">{categoryLabel(category)}</span>
          </button>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          <CategoryChips
            list={showAllCats ? CATEGORIES : SHORT_LIST}
            selected={category}
            onPick={(c) => { setCategory(c); setShowAllCats(true); }}
          />
          {!showAllCats && (
            <button className="catchip" onClick={() => setShowAllCats(true)}
              style={{ ...chipStyle, background: 'transparent', border: `1px dashed ${C.harbor}`, color: C.harbor, fontWeight: 600 }}>
              {S.more}
            </button>
          )}
        </div>

        {blockedByDup ? (
          <button className="bigbtn" onClick={() => setOverrideDup(true)}
            style={{ ...primaryBtn, marginTop: 16, width: '100%', background: C.harbor }}>
            {S.receiptSaveAnyway}
          </button>
        ) : (
          <button
            className="bigbtn" disabled={!ready} onClick={save}
            style={{
              marginTop: 16, width: '100%', minHeight: 58, padding: '16px 0', borderRadius: 14,
              background: ready ? C.harbor : C.line, color: ready ? C.onDark : C.ink,
              fontSize: 18.5, fontWeight: 700,
            }}
          >
            {saving ? S.saving : S.receiptConfirm}
          </button>
        )}

        <button className="catchip" onClick={reset} style={{ ...ghostBtn, width: '100%', marginTop: 8 }}>
          {S.receiptCancel}
        </button>
      </div>
    );
  }

  // ——— idle
  return (
    <Centered>
      <div style={{ fontSize: 52 }}>🧾</div>
      <p style={{ color: C.muted, fontSize: 15.5, marginTop: 10, lineHeight: 1.7, maxWidth: 300 }}>
        {S.receiptIntro}
      </p>
      <JobsList jobs={jobs} onReview={review} onRetry={retry} onCancel={cancelJob} />
      <label className="bigbtn" style={{ ...primaryBtn, display: 'inline-block', cursor: 'pointer' }}>
        {S.receiptStart}
        {/* `capture="environment"` opens the native camera directly. Deliberately
            NOT getUserMedia, which has a long-standing standalone-mode bug on
            iOS. VERIFIED working from the installed standalone PWA 2026-08-01. */}
        <input
          ref={fileRef} type="file" accept="image/*" capture="environment"
          onChange={onFile} style={{ display: 'none' }}
        />
      </label>

      {/*
        FROM THE LIBRARY — the same pipeline, a different door (P3, 2026-08-01).

        The ONLY difference is the missing `capture` attribute: with it, iOS
        opens the camera; without it, the photo picker. Same `onFile`, same
        prepareReceipt → extract → confirm. A second code path here would be a
        second place for EXIF handling to drift, which is the one thing this
        flow cannot afford — see below.

        Secondary styling on purpose: the camera stays the big primary button
        because Dad's flow is snap-then-confirm, and CLAUDE.md's senior-friendly
        rule is one obvious action per screen. This is the deliberate second
        choice, not a peer.

        ⚠️ EXIF ORIENTATION MATTERS MORE THROUGH THIS DOOR. A camera capture is
        taken seconds earlier by the device itself; a library image can be an old
        photo, a screenshot, or a WhatsApp re-compression that stripped or
        rewrote its orientation tag. `prepareReceipt`'s landscape-output check
        (app/README) is the signal that catches a missed rotation, and it applies
        identically here — which is exactly why both doors share one function.
      */}
      <label
        className="catchip"
        style={{
          ...ghostBtn, display: 'inline-block', cursor: 'pointer',
          marginTop: 10, fontSize: 16,
        }}
      >
        {S.receiptFromLibrary}
        <input
          ref={libraryRef} type="file" accept="image/*"
          onChange={onFile} style={{ display: 'none' }}
        />
      </label>
    </Centered>
  );
}

/**
 * The jobs list (WS4-Q).
 *
 * STATUS IS A WORD, NOT A BAR. Extraction is a single opaque call — we cannot
 * know it is "half done", and a progress bar reads as knowledge. The
 * honest-render law is about what a person READS, and it applies to progress
 * exactly as it applies to money: never show a number you did not measure.
 *
 * The cap gets its own line and its own count. Five identical rows saying
 * "waiting" would imply five failures; one line saying how many are held until
 * tomorrow is the truth, and it is a system working rather than breaking.
 */
export function JobsList({ jobs, onReview, onRetry, onCancel }) {
  if (!jobs.length) return null;
  const held = cappedCount(jobs);
  return (
    <div style={{ width: '100%', maxWidth: 340, marginTop: 14, textAlign: 'start' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, marginBottom: 6 }}>
        {S.jobsTitle(jobs.length)}
        {held > 0 && <span style={{ color: C.ink }}>{' · '}{S.jobsCapped(held)}</span>}
      </div>
      {jobs.map((j) => (
        <JobRow key={j.id} job={j} onReview={onReview} onRetry={onRetry} onCancel={onCancel} />
      ))}
    </div>
  );
}

const JOB_LABEL = () => ({
  queued: S.jobQueued, reading: S.jobReading, ready: S.jobReady,
  notReceipt: S.jobNotReceipt, dismissed: S.jobDismissed,
  failed: S.jobFailed, capped: S.jobCapped,
});

/**
 * WHAT THE ROW SAYS, AND WHY A REFUSAL IS THE ONE STAGE THAT ARGUES (N1).
 *
 * Every other stage has one honest word. `notReceipt` does not: the same label
 * covers a pending authorization, an account balance, an incoming transfer and
 * a menu, and only one of those means «there is nothing to record YET». The
 * Owner asked for the difference on the CARD, where he scans, not two taps in.
 *
 * The specific label is preferred WHEN THE SERVER NAMED A REASON and the
 * generic one is kept when it did not — an older deployment, or `other`, which
 * means "no more specific reason". Dressing an unexplained refusal in an
 * explanation would be the app inventing a diagnosis, which is the same defect
 * as «we could not check» rendering as «we checked and it is clean».
 */
function jobLabel(job, stage) {
  if (stage === 'notReceipt') {
    const why = S.jobNotExpense(job && job.notExpenseReason);
    if (why) return why;
  }
  return JOB_LABEL()[stage];
}

/**
 * One job, and it now says WHICH job it is (R-receipts 2).
 *
 * It used to render a stage label and nothing else, so a queue of five photos
 * was five identical rows reading «في الدور» — "no name… that's terrible UX".
 * Two facts name it, and both are already on the device: the picture itself,
 * and the shop once an extraction has found one. Until then it is named by the
 * time it was taken, which is true, rather than by "Receipt 3", which is a
 * number we made up.
 *
 * The STAGE comes from `effectiveStage`, never `job.stage` — that is what stops
 * a not-a-receipt from announcing itself as «جاهز — راجعه».
 */
function JobRow({ job, onReview, onRetry, onCancel }) {
  const stage = effectiveStage(job);
  const [thumb, setThumb] = useState(null);

  /**
   * The object URL is created in an effect and REVOKED when the row goes away.
   * An unrevoked URL pins its ~500 KB Blob for the life of the document, and he
   * photographs receipts in batches on a phone that is already holding them all
   * in IndexedDB. It is also why this runs in an effect rather than during
   * render: a render can be thrown away or repeated, and every discarded one
   * would leak a Blob nobody has a handle to.
   */
  useEffect(() => {
    const url = thumbUrl(job.base64);
    setThumb(url);
    return () => revokeThumb(url);
  }, [job.base64]);

  /**
   * THE NAME, and the guard on it is not defensive decoration.
   *
   * `cairoClock(undefined)` reaches `Intl.DateTimeFormat.format(Invalid Date)`,
   * which THROWS — so one job with a missing or corrupt `queuedAt` did not lose
   * its timestamp, it took the entire receipt screen down with it, mid-render,
   * with his whole queue on it. Found by the chips suite crashing rather than
   * failing, which is the specimen this project has recorded before: a check
   * that dies is not a check.
   *
   * A time we cannot read is therefore no time at all — the card says «صورة»
   * and stops there. Naming it after a clock we do not have would be the same
   * lie as a fabricated total, spelled in a different unit.
   */
  const merchant = jobMerchant(job);
  const at = Number.isFinite(job.queuedAt) ? cairoClock(job.queuedAt) : null;
  const name = merchant || (at ? S.jobPhotoAt(at) : S.jobPhoto);
  const label = jobLabel(job, stage);

  /**
   * TWO LINES, NOT ONE — restructured on a field screenshot (Tarek, 2026-08-24).
   *
   * The single-line layout was written when a row carried at most ONE action
   * chip. «Read it again» made it two, and on a 375-pt phone the arithmetic
   * stopped working: thumbnail + name + two padded chips + the ✕ exceeded the
   * row, so flexbox shrank the one child allowed to shrink — the NAME — down to
   * a strip of clipped letters showing THROUGH the chips. Nobody chose that
   * rendering; it was the layout resolving an overflow nobody had re-checked
   * after the second chip landed.
   *
   * Now the row is a COLUMN: identity (thumb · name · status · ✕) on the first
   * line, actions on their own line below, wrapping if a locale runs long. The
   * name can never collide with an action again no matter how many actions a
   * stage grows, which is the property the one-line layout silently lacked.
   */
  const actions = [];
  if (stage === 'ready') {
    actions.push({ key: 'review', primary: true, label: S.jobReady, onTap: () => onReview(job) });
  }
  if (stage === 'notReceipt') {
    actions.push({ key: 'verdict', primary: false, label: S.jobWhy, onTap: () => onReview(job) });
    /**
     * READ IT AGAIN — the way forward a not-a-receipt job never had.
     * Nearly free: `receipt_extract` is cached by `rcpthash_<clientHash>` for
     * six hours, so a re-read inside that window returns the same extraction
     * without a second vision call (06 §5). Deliberately not automatic — a
     * verdict he has read is settled; this puts the tap in his hand.
     */
    if (job.base64) {
      actions.push({ key: 'reread', primary: false, label: S.jobReadAgain, onTap: () => onRetry(job) });
    }
  }
  if (stage === 'failed' && isActionable(job)) {
    actions.push({ key: 'retry', primary: false, label: S.jobRetry, onTap: () => onRetry(job) });
  }

  return (
    <div
      style={{
        background: C.card,
        borderRadius: 12, padding: '10px 12px', marginBottom: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* No thumbnail is a missing picture, never a broken one — `thumbUrl`
            answers null where it cannot make one, and this simply renders the
            placeholder tile instead. */}
        {thumb ? (
          <img
            src={thumb} alt={S.jobThumbAlt}
            style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, flexShrink: 0,
              border: `1px solid ${C.line}`, opacity: stage === 'dismissed' ? 0.5 : 1 }}
          />
        ) : (
          <div style={{ width: 40, height: 40, borderRadius: 8, flexShrink: 0,
            background: C.shell, border: `1px solid ${C.line}`, display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🧾</div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{ fontSize: 14.5, fontWeight: 600, color: C.ink,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            dir="auto"
          >
            {name}
          </div>
          <div style={{ fontSize: 12.5, fontWeight: stage === 'ready' ? 700 : 500,
            color: stage === 'failed' ? C.conflictInk : C.muted }}>
            {/* An UNKNOWN stage is never silently rendered as "waiting" — an
                unnamed state is a state we do not understand, and saying so is
                the only honest option. */}
            {label || `؟ ${job.stage}`}
          </div>
        </div>

        {/*
          CANCEL, ON EVERY STAGE (R-receipts 3) — including `reading`, which is the
          one that needs it most: a photo being read is a photo he cannot get rid
          of, and that is exactly when he decided it was the wrong photo.
          It stays on the IDENTITY line: removing is about the photo, not about
          any one action, and its position should not move as actions come and go.
        */}
        <button
          className="catchip"
          onClick={() => onCancel(job)}
          aria-label={S.jobRemoveTitle}
          title={S.jobRemoveTitle}
          style={{ minWidth: TAP, minHeight: TAP, borderRadius: 999, flexShrink: 0,
            background: 'transparent', border: `1px solid ${C.line}`,
            color: C.muted, fontSize: 16, fontWeight: 700, lineHeight: 1 }}
        >
          ✕
        </button>
      </div>

      {actions.length > 0 && (
        <div style={{
          display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end',
          marginTop: 8,
        }}>
          {actions.map((a) => (
            <button
              key={a.key} className="catchip" onClick={a.onTap}
              style={{
                padding: '8px 14px', minHeight: TAP, borderRadius: 999, fontSize: 13.5,
                whiteSpace: 'nowrap',
                background: a.primary ? C.harbor : C.shell,
                color: a.primary ? C.onDark : C.ink,
                fontWeight: a.primary ? 700 : 600,
                border: a.primary ? 'none' : `1px solid ${C.line}`,
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ——————————————————————————————— small pieces
function Centered({ children }) {
  return (
    <div style={{ textAlign: 'center', paddingTop: 70, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      {children}
    </div>
  );
}

/**
 * The receipt card's category chips — a SELECTION, exported so its behaviour can
 * be tested without driving the whole OCR flow.
 *
 * ⚠️ THE INBOX DELIBERATELY DOES NOT USE THIS, and that is the whole lesson of
 * the bug it was written to fix. The Inbox's chips are COMMIT buttons: one tap
 * calls `onConfirm(item, c)`, the row is written and the card disappears. There
 * is no selected state there because there is no selection — and filtering the
 * guess out of that list is right, since the guess has its own green button and
 * any tap ends the card.
 *
 * That idiom was copied into this card, where the chips only set state and the
 * write happens later at أكّد. The copied `.filter(c => c !== category)` then
 * deleted the chip he had just tapped, while the ✓ summary above was hidden by
 * `showAllCats` — which tapping a chip sets. A tap made the chip vanish and put
 * nothing in its place, so a chosen category and an unchosen one looked
 * identical on a card whose entire job is showing what will be written.
 *
 * Sharing one component between the two surfaces would repeat that mistake in a
 * more durable form. They look alike and mean different things.
 */
export function CategoryChips({ list, selected, onPick, chipStyle: styleOverride }) {
  const base = styleOverride || {
    padding: '11px 15px', minHeight: TAP, borderRadius: 999, fontSize: 15,
  };
  /**
   * SELECTED FIRST (P4a). His chosen category sits at position 1 so the card can
   * be read top-down without hunting: النوع says what it is, and the chip that
   * says the same thing is the first one under it.
   *
   * Two things this must NOT do, both of which a careless one-liner would:
   *   - ADD a chip. If `selected` is not in `list` (a category from another
   *     install profile, say), prepending it blindly would offer him a button
   *     this deployment will refuse. Guarded by the `indexOf` check.
   *   - REORDER the rest. The remainder keeps its original order, which is
   *     most-used-first — the ordering CLAUDE.md calls the cheapest way to cut
   *     taps. Floating one chip must not reshuffle the other twenty-three.
   * And it still never REMOVES one; that was the P1 bug.
   */
  const ordered = (selected && list.indexOf(selected) !== -1)
    ? [selected, ...list.filter((c) => c !== selected)]
    : list;

  return ordered.map((c) => {
    const isSelected = c === selected;
    return (
      <button
        key={c}
        className="catchip"
        aria-pressed={isSelected}
        // Toggle semantics: tapping another moves the selection, tapping the
        // selected one clears it. Nothing is ever removed from the list.
        onClick={() => onPick(isSelected ? null : c)}
        style={{
          ...base,
          background: isSelected ? C.harbor : C.shell,
          border: `1px solid ${isSelected ? C.harbor : C.line}`,
          color: isSelected ? C.onDark : C.ink,
          fontWeight: isSelected ? 700 : 500,
          ...LATIN,
        }}
        dir="auto"
      >
        {isSelected ? '✓ ' : ''}{categoryLabel(c)}
      </button>
    );
  });
}

function Field({ label, editable, children }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: editable ? C.harbor : C.ink, letterSpacing: '.02em' }}>
        {label}{editable ? ' •' : ''}
      </div>
      {children}
    </div>
  );
}

function Banner({ children }) {
  return (
    <div style={{
      background: C.sand, border: `1px solid ${C.line}`, color: C.ink,
      borderRadius: 12, padding: '10px 14px', fontSize: 14.5, fontWeight: 600,
      marginBottom: 10, lineHeight: 1.6,
    }}>
      {children}
    </div>
  );
}

const primaryBtn = {
  marginTop: 14, minHeight: 58, padding: '16px 30px', borderRadius: 14,
  background: C.harbor, color: C.onDark, fontSize: 18, fontWeight: 700,
};
const ghostBtn = {
  marginTop: 10, minHeight: TAP, padding: '12px 20px', borderRadius: 12,
  background: 'transparent', border: `1px solid ${C.line}`, color: C.muted,
  fontSize: 15.5, fontWeight: 600,
};
const chipStyle = {
  padding: '11px 15px', minHeight: TAP, borderRadius: 999,
  fontSize: 15, fontWeight: 500, color: C.ink, ...LATIN,
};
const inputStyle = {
  width: '100%', padding: '12px 14px', borderRadius: 12, marginTop: 4,
  border: `1.5px solid ${C.harbor}`, background: C.shell, color: C.ink,
  fontSize: 20, fontWeight: 600, outline: 'none',
};
