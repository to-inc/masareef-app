import { useState, useMemo } from 'react';
import { C, FONT_DISPLAY, NUMERALS, TAP, RADIUS, TYPE } from '../theme.js';
import { S, categoryLabel } from '../i18n/strings.js';
import { CATEGORIES, SHORT_LIST } from '../lib/constants.js';
import { money, moneyRound } from '../lib/format.js';
import { LATIN, ISOLATE } from '../components/Primitives.jsx';
import {
  rowKey, isWritable, mergeJobs, initialTicks, toConfirmRows, BATCH_MAX_ROWS,
  outcomeFor, isRetryable, retryRows, unsettledCount,
} from '../state/batchDraft.js';

/**
 * «مراجعة الكشف» — one bank screenshot (or several) becomes N candidate rows,
 * he ticks, one confirm writes them (D20).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ITS OWN TRANSIENT SURFACE, ENTERED FROM THE JOB CARD — not الوارد.
 *
 * الوارد means rows ALREADY IN HIS BOOK that need a category. A batch is
 * candidates NOT YET IN THE BOOK, and the difference is the only one that
 * matters under the fail-direction rule: an Inbox row left untouched is still
 * COUNTED — the money is in the book as ❓, and ignoring it costs classification.
 * A batch row left untouched is NOT CAPTURED AT ALL — ignoring it costs the
 * expense. One place would teach one habit whose consequence silently differs,
 * and the wrong half loses money. (Planner 4, CONTRACT-10 Q1.)
 *
 * ——— AND IT IS NOT CAPTURE EITHER.
 *
 * The five-second law governs capture, and capture already happened when he
 * photographed the screen. Review may take longer. But that buys a different
 * obligation: he must be able to match this list against the picture in his
 * hand, LINE BY LINE — which is why rows are one line by default, why they are
 * grouped by day, and why the photos never interleave.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export default function BatchReviewView({
  jobs, expired, busy, results, onConfirm, onResnap, onDiscard, onLeave,
}) {
  const rows = useMemo(() => mergeJobs(jobs), [jobs]);
  const [ticks, setTicks] = useState(() => initialTicks(rows));
  const [edits, setEdits] = useState({});
  const [open, setOpen] = useState(null);
  const [overridden, setOverridden] = useState({});

  const settled = !!results;
  // `overridden` rides into the wire as `dupAck` — without it the override
  // button was a pixel that changed nothing: the server refuses a book
  // duplicate unless the request says the flag was SHOWN and overruled (D18a).
  const chosen = useMemo(
    () => (settled
      /**
       * AFTER A SETTLE THE SCREEN IS ABOUT WHAT IS LEFT (docs/05 `6139886`
       * loose thread). A `book_duplicate` refused at CONFIRM time — not at
       * extraction time, where the pre-settle panel already answers it — had no
       * door at all: the override panel rendered only before the settle, so his
       * one recovery was to photograph the statement again. The book moves
       * between the extraction and the write (an SMS lands, a Shortcut fires),
       * so that second refusal is the one that hits rows which looked clean.
       *
       * Only refusals he has overridden and rows he never sent may ride; a
       * written row cannot be re-sent from here at all.
       */
      ? retryRows(rows, results, overridden, edits, ticks)
      : toConfirmRows(rows, ticks, edits, { overridden })),
    [settled, results, rows, ticks, edits, overridden],
  );

  /**
   * WHAT IS STILL NOT IN HIS BOOK — the same number the Book screen shows, from
   * the same function, because a rule enforced at one render site is not
   * enforced. The settled header states three counts about what HAPPENED; this
   * states what is still OUTSTANDING, and after a partial confirm those are
   * different sentences.
   */
  const outstanding = settled ? unsettledCount({ rows, settled: results }) : 0;

  /**
   * WHAT HE IS ABOUT TO WRITE, BEFORE HE READS A ROW — and it moves as he ticks.
   * Fourteen rows with the total only on the button means committing to a number
   * he assembled in his head.
   *
   * Grouped by currency and never summed across them, for the same reason the
   * Book's travel line is: euros and pounds do not add.
   */
  const chosenTotals = useMemo(() => {
    const by = new Map();
    for (const r of rows) {
      if (ticks[rowKey(r)] !== true) continue;
      const e = edits[rowKey(r)] || {};
      const amt = Number(e.amount != null ? e.amount : r.amount);
      if (!isFinite(amt)) continue;
      const cur = e.currency || r.currency || 'EGP';
      by.set(cur, (by.get(cur) || 0) + Math.abs(amt));
    }
    return [...by.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [rows, ticks, edits]);

  const totalSeen = jobs.reduce((n, j) => n + (Number(j.entriesTotal) || (j.entries || []).length), 0);
  const truncated = totalSeen > rows.length;

  const setAll = (on) => {
    const next = {};
    for (const r of rows) {
      if (!isWritable(r.row_status)) continue;
      // A twin is never swept ON — the first copy carries the purchase, and a
      // second tick writes it twice. «اختار الكل» must not undo that.
      next[rowKey(r)] = on ? !r.twinOf && !blockedByDup(r, overridden) : false;
    }
    setTicks(next);
  };

  if (expired) return <Expired onResnap={onResnap} onDiscard={onDiscard} busy={busy} />;

  // Day sections, in the merged order — never re-sorted after confirm.
  const days = [];
  for (const r of rows) {
    const d = r.date || '';
    if (!days.length || days[days.length - 1].date !== d) days.push({ date: d, rows: [] });
    days[days.length - 1].rows.push(r);
  }

  return (
    <div>
      <div style={{ textAlign: 'center', padding: '2px 0 12px' }}>
        {settled ? (
          <>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 650 }}>
              {S.batchSettled(results.written, results.skipped, results.errored)}
            </div>
            {/**
              * THREE COUNTS ABOUT WHAT HAPPENED ARE NOT A STATEMENT ABOUT WHAT
              * IS LEFT. «10 logged ✓ · 2 already there» reads as finished, and
              * two of those rows may be expenses the server refused and nobody
              * wrote. This says so, in the same words the Book screen uses.
              */}
            {outstanding > 0 && (
              <div style={{ fontSize: TYPE.label, color: C.conflictInk, marginTop: 4, fontWeight: 600 }}>
                {S.batchWaiting(outstanding)}
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 38, fontWeight: 650, ...NUMERALS, ...LATIN, lineHeight: 1.05 }}>
              {chosenTotals.length
                ? chosenTotals.map(([cur, amt]) => `${moneyRound(amt)} ${cur}`).join(' · ')
                : '—'}
            </div>
            <div style={{ fontSize: TYPE.label, color: C.muted, marginTop: 3 }}>
              {S.batchCount(chosen.length, rows.length)}
            </div>
          </>
        )}
      </div>

      {!settled && (
        <div style={{ display: 'flex', gap: 7, marginBottom: 10 }}>
          {[[S.batchAll, true], [S.batchNone, false]].map(([label, on]) => (
            <button
              key={label} className="catchip" onClick={() => setAll(on)}
              style={{
                // A3: 42 -> TAP. These are the Select all / Clear all buttons —
            // the same pair A3 names at GLASS :539/:540.
            flex: 1, minHeight: TAP, borderRadius: RADIUS.row, background: C.card,
                border: `1px solid ${C.line}`, color: C.ink, fontSize: TYPE.label, fontWeight: 600,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {days.map((day) => (
        <div key={day.date || 'undated'}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, margin: '14px 2px 7px' }}>
            <span style={LATIN}>{day.date || '—'}</span>
          </div>
          {day.rows.map((r) => (
            <Row
              key={rowKey(r)} row={r}
              ticked={ticks[rowKey(r)] === true}
              outcome={settled ? outcomeFor(results, r) : null}
              edit={edits[rowKey(r)]}
              isOpen={open === rowKey(r)}
              overrode={!!overridden[rowKey(r)]}
              onToggleOpen={() => setOpen(open === rowKey(r) ? null : rowKey(r))}
              onTick={(on) => setTicks((t) => ({ ...t, [rowKey(r)]: on }))}
              onOverride={() => {
                setOverridden((o) => ({ ...o, [rowKey(r)]: true }));
                setTicks((t) => ({ ...t, [rowKey(r)]: true }));
              }}
              onPick={(cat) => setEdits((e) => ({ ...e, [rowKey(r)]: { ...(e[rowKey(r)] || {}), category: cat } }))}
              onMethod={(m) => setEdits((e) => ({ ...e, [rowKey(r)]: { ...(e[rowKey(r)] || {}), method: m } }))}
            />
          ))}
        </div>
      ))}

      {/**
        * SILENT TRUNCATION IS FORBIDDEN. `entries_total` above what arrived means
        * half his screenshot is missing, and the list would otherwise read as
        * complete. It says so, and says what to do about it.
        *
        * B4b VERDICT: STATIC — exempt from the Sheet by the ruled test, the
        * same one that ruled the MonthScreen caveat footnote static.
        * `truncated` derives from the jobs prop, which is settled before this
        * view mounts (jobs change only from ReceiptView, which REPLACES this
        * screen), so the note renders WITH the list on its first paint and
        * can never appear into the flow later. A static surface must not
        * pretend to arrive — an entrance on it would claim a change that did
        * not happen.
        */}
      {truncated && (
        <p style={{
          fontSize: 12.5, color: C.ink, background: C.sand, border: `1px solid ${C.line}`,
          borderRadius: RADIUS.row, padding: '9px 12px', marginTop: 12, textAlign: 'center', lineHeight: 1.6,
        }}>
          {S.batchTruncated(rows.length, totalSeen)}
        </p>
      )}

      {/**
        * ═══ THE FOOTER, AND WHY «BACK» IS NOT ALWAYS ONE BUTTON ═══
        *
        * The settled screen used to offer exactly one control — «Done — back to
        * the book» — and it called `onDiscard`, which DESTROYS the draft. On a
        * clean batch that is right and there is nothing to lose. On a batch with
        * refusals it threw away rows the server had never written, from a button
        * whose word for it was «Done». (The same shape the verification pass
        * caught one level up: a whole-batch refusal rendering as a DONE screen
        * whose only exit destroyed the unwritten draft.)
        *
        * So: while anything is still outstanding, leaving KEEPS the draft — that
        * is what makes the Book's waiting count answerable tomorrow — and
        * discarding is a separate, second control that names what it destroys.
        * When nothing is outstanding the two collapse back into one button,
        * because there is then no difference between them.
        */}
      <div style={{ paddingTop: 14 }}>
        <button
          className="bigbtn"
          onClick={settled
            ? (chosen.length ? () => onConfirm(chosen)
              : outstanding > 0 ? onLeave : onDiscard)
            : () => onConfirm(chosen)}
          disabled={busy || (!chosen.length && !settled) || chosen.length > BATCH_MAX_ROWS}
          style={{
            width: '100%', minHeight: 58, borderRadius: RADIUS.row, fontSize: TYPE.action, fontWeight: 700,
            /**
             * AMBER — this screen's primary action (ruled 2026-08-19).
             *
             * The accent is one PER SCREEN, not one per app. It was pinned to
             * EntryView by file, which enforced a global-once reading by accident
             * and would mean only one screen in the app could ever have a primary
             * action. This button writes N rows into his book in a single
             * irreversible tap — the highest-consequence control here — and
             * rendering it in harbour made it read as secondary, inverting the
             * hierarchy amber exists to encode.
             *
             * It is warm when it WRITES and cool when it merely leaves, before
             * and after a settle alike: the accent tracks the consequence, not
             * the position on the screen.
             */
            background: chosen.length && !busy ? C.amber : (settled ? C.card : C.line),
            // Same rim as the keypad's commit: amber needs a boundary against
            // the shell (theme.js `amberRim`), and this is the higher-stakes of
            // the two buttons — it writes N rows in one tap.
            border: `1px solid ${chosen.length && !busy ? C.amberRim : C.line}`,
            color: chosen.length && !busy ? C.amberInk : C.ink,
          }}
        >
          {busy ? S.batchSending
            : chosen.length > BATCH_MAX_ROWS ? S.batchOverCap(chosen.length, BATCH_MAX_ROWS)
              : chosen.length ? S.batchConfirm(chosen.length)
                : settled ? (outstanding > 0 ? S.batchLeave : S.batchBack)
                  : S.batchNothing}
        </button>

        {/**
          * DISCARD IS ITS OWN ACT, and it says the price out loud. It appears
          * only once there is a price to say — on a fully-written batch the
          * button above already is this one.
          */}
        {settled && outstanding > 0 && (
          <button
            className="catchip" onClick={onDiscard}
            style={{
              marginTop: 10, width: '100%', minHeight: TAP, borderRadius: RADIUS.row,
              background: 'transparent', border: `1px solid ${C.line}`,
              color: C.muted, fontSize: TYPE.label,
            }}
          >
            {S.batchDiscardWaiting(outstanding)}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * U3 — THE ROW'S EFFECTIVE METHOD: what the chip STATES and what the wire
 * will SEND, one answer (06 §3.10.2 — «batch rows default to Card»; the
 * Owner's 2026-08-27 ruling: a bank statement's rows are card movements by
 * definition; an explicit cash hint on the row is EVIDENCE and outranks the
 * presumption; his tap outranks everything).
 *
 * ⚠️ THIS IS A MIRROR OF `toConfirmRows`' method expression, not a second
 * opinion — the builder computes mid-loop and cannot be imported as a rule.
 * A mirror is the two-readers hazard by construction, so the U3 oracle
 * EXECUTES both sides over the whole hint × defaultMethod × edit matrix and
 * fails on the first divergence. Change either side and that suite is where
 * the drift surfaces. Exported for exactly that reason.
 */
export const effectiveMethod = (row, edit) =>
  (edit && edit.method)
  || (row.payment_hint === 'cash' ? 'Cash' : (row.defaultMethod || 'Visa'));

/** One tap, the other value — a two-value chooser needs a flip, not a menu. */
const otherMethod = (m) => (m === 'Visa' ? 'Cash' : 'Visa');

/**
 * The label is never the value (state/entryPayload.js owns that story): the
 * chip renders a LOOKUP of the wire value it holds, per locale.
 */
const methodLabel = (m) => (m === 'Visa' ? S.methodCard : S.methodCash);

/**
 * A duplicate that has not been deliberately overridden blocks the tick.
 *
 * `inBatch` and a book `match` both block; `checked:false` does NOT — that is
 * §3.5 and the fail-direction rule: the dedupe gate fails OPEN because it
 * protects capture, and "we could not look" is not evidence of a duplicate.
 * Unticking there would be the app inventing a suspicion it does not hold.
 */
function blockedByDup(row, overridden) {
  if (overridden && overridden[rowKey(row)]) return false;
  if (row.twinOf) return true;
  const d = row.dupBook;
  return !!(d && d.checked && d.match);
}

/**
 * ⚠️ `outcomeOf` USED TO LIVE HERE. It is `outcomeMap`/`outcomeFor` in
 * `state/batchDraft.js` now — unmoved in behaviour, including the length guard
 * that returns NOTHING rather than sliding answers one place along. It moved
 * because the unsettled COUNT needs the same mapping, and two readers of one
 * mapping is the shape that has cost this project the most: the «This week 0»
 * gate held at the headline while the metric cards printed «▼100%» in smaller
 * type from their own copy of the question.
 */

/** The reason a non-writable row is on screen at all, in words. */
function statusNote(row) {
  switch (row.row_status) {
    case 'declined': return { text: S.batchDeclined, tone: 'bad' };
    case 'incoming': return { text: S.batchIncoming, tone: 'bad' };
    case 'pending': return { text: S.batchPending, tone: 'warn' };
    case 'roundup': return { text: S.batchRoundup(row.aggregate_count), tone: 'warn' };
    case 'unclear': return { text: S.batchUnclear, tone: 'warn' };
    default: return null;
  }
}

function Row({ row, ticked, outcome, edit, isOpen, overrode, onToggleOpen, onTick, onOverride, onPick, onMethod }) {
  /**
   * Per-row, collapsing when the row closes — 27 chips left open on every row
   * would turn the reconciliation list back into the five-row grid EntryView
   * retired. A picked category that lives outside SHORT_LIST renders via the
   * `category === c` highlight once expanded; the collapsed view already shows
   * the chosen name in the row's chip line.
   */
  const [catsOpen, setCatsOpen] = useState(false);
  const writable = isWritable(row.row_status);
  const note = statusNote(row);
  const dup = row.dupBook;
  const bookDup = dup && dup.checked && dup.match;
  const unchecked = dup && dup.checked === false;
  const category = (edit && edit.category) || row.category;
  const method = effectiveMethod(row, edit);
  const settled = !!outcome;

  /**
   * ——— A REFUSAL AT CONFIRM TIME IS STILL A QUESTION FOR HIM.
   *
   * `book_duplicate` is the only outcome an override answers, because `dupAck`
   * is the only thing the server is waiting for. The row was NOT written; the
   * server found a match in his book and stopped, which is the dedupe gate
   * doing its job — and «two identical coffees in one day are two coffees» is
   * why the gate asks rather than decides.
   *
   * The evidence is the server's own match when it sent one (§3.5 `dupBook`),
   * and the extraction-time match otherwise. Never a fabricated row: if neither
   * exists he gets the sentence and the choice, with no box pretending to show
   * him something we do not have.
   */
  const retryable = isRetryable(outcome);
  const awaitingRetry = retryable && overrode;
  const matchRow = settled
    ? ((outcome.dupBook && outcome.dupBook.match) || (bookDup ? dup.match : null))
    : (bookDup ? dup.match : null);
  const showOverride = (settled ? retryable : !!bookDup) && !overrode;
  // Nothing to open is nothing to tap: a written row's title is not a control.
  const canOpen = !settled || showOverride;
  const TitleTag = canOpen ? 'button' : 'div';

  const tone = {
    bad: { fg: C.conflictInk, bg: C.conflictBg },
    warn: { fg: C.amberInk, bg: C.sand },
  };

  const bg = settled
    ? (outcome.status === 'written' ? C.settledBg : outcome.status === 'error' ? C.conflictBg : C.sand)
    : !writable ? C.shell
      : (bookDup || row.twinOf) ? C.conflictBg : C.card;

  return (
    <div style={{
      background: bg,
      border: `1px solid ${(bookDup || row.twinOf) && !settled ? C.conflictLine : C.line}`,
      borderRadius: RADIUS.row, marginBottom: 7,
      opacity: settled && outcome.status !== 'written' ? 0.75 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', minHeight: 56 }}>
        {/**
          * A NON-WRITABLE ROW HAS NO TICK AT ALL — not a disabled one. A control
          * he cannot use is a question about why; the reason is in words instead.
          */}
        {settled ? (
          <span style={{
            flex: '0 0 26px', textAlign: 'center',
            color: awaitingRetry ? C.harbor : C.muted, fontWeight: awaitingRetry ? 700 : 400,
          }}>
            {awaitingRetry ? '✓'
              : outcome.status === 'written' ? '✓' : outcome.status === 'error' ? '!' : '·'}
          </span>
        ) : writable ? (
          <button
            onClick={() => onTick(!ticked)}
            role="checkbox"
            aria-checked={ticked}
            aria-label={row.merchant_display || row.description || ''}
            style={{
              // geometry exemption (ruling 4): a 30px checkbox — its radius is
              // bounded by its own dimensions, and a surface token would clamp
              // it toward a circle: an affordance change, not a style.
              flex: '0 0 30px', height: 30, borderRadius: 8,
              border: `2px ${ticked ? 'solid' : 'dashed'} ${ticked ? C.harbor : C.line}`,
              background: ticked ? C.harbor : 'transparent',
              color: C.onDark, fontSize: 16, fontWeight: 700,
            }}
          >
            {ticked ? '✓' : ''}
          </button>
        ) : (
          <span style={{ flex: '0 0 30px', textAlign: 'center', color: C.muted, fontSize: TYPE.action }}>✕</span>
        )}

        <TitleTag
          onClick={canOpen ? onToggleOpen : undefined}
          aria-expanded={canOpen ? isOpen : undefined}
          style={{ flex: 1, minWidth: 0, textAlign: 'start', background: 'transparent', padding: 0 }}
        >
          <span style={{
            display: 'block', fontSize: TYPE.body, fontWeight: 600,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...ISOLATE,
          }} dir="auto">
            {/* Printed AS THE BANK PRINTED IT, truncation included — that is what
                lets him match this list against the picture in his hand. */}
            {row.merchant_display || row.description || '—'}
          </span>
          <span style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, color: C.muted, marginTop: 2 }}>
            {/**
              * FOUR ANSWERS, FOUR SENTENCES. `duplicate` means WE wrote this row
              * on an earlier attempt — it is in his book. `book_duplicate` means
              * the server refused and wrote NOTHING. One is finished and the
              * other is waiting for him, and the old code gave both «was already
              * logged», which hides a possibly-real expense behind a word that
              * says it is handled. (The same «two cases must never render
              * identically» rule that keeps «we could not check» apart from «we
              * checked and it is clean».)
              */}
            {settled && (
              <b style={{
                color: awaitingRetry ? C.harbor
                  : outcome.status === 'written' ? C.settledInk : C.conflictInk,
              }}>
                {awaitingRetry ? S.batchRetryPending
                  : outcome.status === 'written' ? S.batchWritten
                    : outcome.status === 'error' ? S.batchErrored
                      : outcome.status === 'book_duplicate' ? S.batchRefusedDup
                        : S.batchSkippedDup}
              </b>
            )}
            {!settled && note && (
              <span style={{
                padding: '2px 8px', borderRadius: RADIUS.capsule, fontWeight: 700,
                background: tone[note.tone].bg, color: tone[note.tone].fg,
              }}>{note.text}</span>
            )}
            {!settled && row.twinOf && <span style={{ color: C.conflictInk, fontWeight: 700 }}>{S.batchDupBatch}</span>}
            {!settled && bookDup && <span style={{ color: C.conflictInk, fontWeight: 700 }}>{S.batchDupBook}</span>}
            {/**
              * «WE COULD NOT LOOK» IS NOT «WE LOOKED AND IT IS CLEAN» (§3.5).
              * The row keeps its default — unticking would invent a suspicion —
              * and differs in WORDS. The two must never render identically.
              */}
            {!settled && unchecked && <span>{S.batchDupUnchecked}</span>}
            {!settled && writable && !category && (
              <span style={{ padding: '2px 8px', borderRadius: RADIUS.capsule, background: C.mist, fontWeight: 700 }}>
                {S.batchNeedCategory}
              </span>
            )}
            {category && <span dir="auto">{categoryLabel(category)}</span>}
          </span>
        </TitleTag>

        {/**
          * U3 — THE METHOD CHIP, on the collapsed row (§3.10.2: the review
          * screen SHOWS the chip; a tap still overrides). Pre-selected to
          * Card through `effectiveMethod` — the same answer the wire sends —
          * and one tap flips it, riding the SAME edits overlay the category
          * picker uses, into the one wire builder. It exists exactly where
          * the decision is live: a written row's method is a fact in his
          * book, a non-writable row's is a method on money that will not
          * move — neither gets a control.
          */}
        {!settled && writable && (
          <button
            className="catchip"
            onClick={() => onMethod(otherMethod(method))}
            style={{
              // A3: 44 -> TAP, senior touch floor.
              flex: '0 0 auto', minHeight: TAP, padding: '9px 12px',
              borderRadius: RADIUS.capsule, background: C.shell,
              border: `1px solid ${C.line}`, color: C.ink,
              fontSize: TYPE.label, fontWeight: 700, whiteSpace: 'nowrap',
            }}
          >
            {methodLabel(method)}
          </button>
        )}

        {/* A null amount renders —, never 0. An aggregate has no single figure. */}
        <span style={{ fontFamily: FONT_DISPLAY, fontSize: 16.5, fontWeight: 650, ...LATIN, ...NUMERALS }}>
          {/* The unit rides the row whenever it is not the home default —
              'UNKNOWN' included, rendered as ؟: a figure whose currency nobody
              read must not sit indistinguishable from pounds, because ticking
              it writes it as pounds (server rule: UNKNOWN → EGP). */}
          {row.amount == null ? '—'
            : `${money(Math.abs(row.amount))}${!row.currency || row.currency === 'EGP' ? ''
              : row.currency === 'UNKNOWN' ? ' ؟' : ` ${row.currency}`}`}
        </span>
      </div>

      {isOpen && canOpen && (
        <div style={{ padding: '0 12px 12px' }}>
          {/**
            * THE MATCHED ROW ITSELF, so he judges rather than trusts — and the
            * override REPLACES the tick rather than sitting beside it, which is
            * the shape already proven on the SMS duplicate.
            *
            * THE SAME PANEL SERVES BOTH REFUSALS, deliberately. The pre-settle
            * one answers what the extraction found; the post-settle one answers
            * what the WRITE found, and until now only the first had a door — so
            * a row refused at confirm could be captured only by photographing
            * the statement again. Two panels would be two places for one rule to
            * drift apart in.
            */}
          {showOverride && (
            <>
              {/* No evidence, no evidence box — the sentence and the choice
                  stand on their own rather than framing an empty space. */}
              {matchRow && (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.conflictInk }}>{S.batchDupBookIntro}</div>
                  <div style={{
                    background: C.shell, border: `1px solid ${C.line}`, borderRadius: RADIUS.inset,
                    padding: '9px 11px', fontSize: 13, marginTop: 6, lineHeight: 1.7, ...ISOLATE,
                  }} dir="auto">
                    <span style={LATIN}>{matchRow.date}</span> · {matchRow.description} ·{' '}
                    <span style={LATIN}>{money(matchRow.amount)} {matchRow.currency}</span>
                  </div>
                </>
              )}
              <button
                className="catchip" onClick={onOverride}
                style={{
                  marginTop: 9, minHeight: TAP, width: '100%', borderRadius: RADIUS.row,
                  background: C.card, border: `1px solid ${C.conflictLine}`,
                  color: C.conflictInk, fontSize: 15, fontWeight: 700,
                }}
              >
                {S.batchSaveAnyway}
              </button>
            </>
          )}
          {!settled && writable && !bookDup && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {/**
                * FIELD-FOUND (Tarek, 2026-08-24, first real batch): the picker
                * offered SHORT_LIST with no way out — six base categories, and
                * his six per-install extras plus fifteen others simply
                * UNREACHABLE on the one screen classifying a whole bank
                * statement. EntryView had solved this (showAll) the day the
                * chip grid shipped; the pattern just never crossed files. Same
                * expansion here, per row.
                */}
              {(catsOpen ? CATEGORIES : SHORT_LIST).map((c) => (
                <button
                  key={c} className="catchip" onClick={() => onPick(c)}
                  style={{
                    // A3: 44 -> TAP, senior touch floor.
                    padding: '9px 13px', minHeight: TAP, borderRadius: RADIUS.capsule,
                    background: category === c ? C.harbor : C.shell,
                    color: category === c ? C.onDark : C.ink,
                    border: `1px solid ${category === c ? C.harbor : C.line}`,
                    fontSize: TYPE.label, fontWeight: category === c ? 700 : 500,
                  }}
                  dir="auto"
                >
                  {category === c ? '✓ ' : ''}{categoryLabel(c)}
                </button>
              ))}
              {!catsOpen && (
                <button
                  className="catchip" onClick={() => setCatsOpen(true)}
                  style={{
                    // A3: 44 -> TAP, senior touch floor.
                    padding: '9px 13px', minHeight: TAP, borderRadius: RADIUS.capsule,
                    background: 'transparent', color: C.harborInk,
                    border: `1px dashed ${C.harbor}`, fontSize: TYPE.label, fontWeight: 600,
                  }}
                >
                  {S.more}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * THE EXTRACTION EXPIRED — his edits did not.
 *
 * The server's reading lives six hours (Apps Script's ceiling). His ticks and
 * corrections are the expensive part and are kept locally for as long as he
 * likes; only the cheap part expires. So this never silently drops the draft and
 * never sends it hoping — it says what happened and offers one fresh read, after
 * which his edits re-attach by index.
 */
function Expired({ onResnap, onDiscard, busy }) {
  return (
    <div style={{ textAlign: 'center', paddingTop: 40 }}>
      <div data-geometry="empty-state-illustration" style={{ fontSize: 44 }}>🧾</div>
      <p style={{ fontSize: 16, lineHeight: 1.7, color: C.ink, margin: '12px auto 18px', maxWidth: 300 }}>
        {S.batchExpired}
      </p>
      <button
        className="bigbtn" onClick={onResnap} disabled={busy}
        style={{
          width: '100%', minHeight: 56, borderRadius: RADIUS.row, background: C.harbor,
          color: C.onDark, fontSize: 17, fontWeight: 700,
        }}
      >
        {busy ? S.batchSending : S.batchResnap}
      </button>
      <button
        className="catchip" onClick={onDiscard}
        style={{
          marginTop: 10, minHeight: TAP, padding: '0 16px', borderRadius: RADIUS.row,
          background: 'transparent', border: `1px solid ${C.line}`, color: C.muted, fontSize: TYPE.label,
        }}
      >
        {S.batchDiscard}
      </button>
    </div>
  );
}
