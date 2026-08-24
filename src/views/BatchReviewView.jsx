import { useState, useMemo } from 'react';
import { C, FONT_DISPLAY, NUMERALS, TAP } from '../theme.js';
import { S, categoryLabel } from '../i18n/strings.js';
import { SHORT_LIST } from '../lib/constants.js';
import { money, moneyRound } from '../lib/format.js';
import { LATIN, ISOLATE } from '../components/Primitives.jsx';
import {
  rowKey, isWritable, mergeJobs, initialTicks, toConfirmRows,
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
  jobs, expired, busy, results, onConfirm, onResnap, onDiscard,
}) {
  const rows = useMemo(() => mergeJobs(jobs), [jobs]);
  const [ticks, setTicks] = useState(() => initialTicks(rows));
  const [edits, setEdits] = useState({});
  const [open, setOpen] = useState(null);
  const [overridden, setOverridden] = useState({});

  const settled = !!results;
  const chosen = useMemo(() => toConfirmRows(rows, ticks, edits), [rows, ticks, edits]);

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
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 650 }}>
            {S.batchDone(results.written, results.skipped, results.errored)}
          </div>
        ) : (
          <>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 38, fontWeight: 650, ...NUMERALS, ...LATIN, lineHeight: 1.05 }}>
              {chosenTotals.length
                ? chosenTotals.map(([cur, amt]) => `${moneyRound(amt)} ${cur}`).join(' · ')
                : '—'}
            </div>
            <div style={{ fontSize: 13.5, color: C.muted, marginTop: 3 }}>
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
                flex: 1, minHeight: 42, borderRadius: 10, background: C.card,
                border: `1px solid ${C.line}`, color: C.ink, fontSize: 14.5, fontWeight: 600,
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
              outcome={settled ? outcomeOf(results, r) : null}
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
            />
          ))}
        </div>
      ))}

      {/**
        * SILENT TRUNCATION IS FORBIDDEN. `entries_total` above what arrived means
        * half his screenshot is missing, and the list would otherwise read as
        * complete. It says so, and says what to do about it.
        */}
      {truncated && (
        <p style={{
          fontSize: 12.5, color: C.ink, background: C.sand, border: `1px solid ${C.line}`,
          borderRadius: 10, padding: '9px 12px', marginTop: 12, textAlign: 'center', lineHeight: 1.6,
        }}>
          {S.batchTruncated(rows.length, totalSeen)}
        </p>
      )}

      <div style={{ paddingTop: 14 }}>
        <button
          className="bigbtn"
          onClick={settled ? onDiscard : () => onConfirm(chosen)}
          disabled={!settled && (busy || chosen.length === 0)}
          style={{
            width: '100%', minHeight: 58, borderRadius: 14, fontSize: 18, fontWeight: 700,
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
             */
            background: settled ? C.card : (chosen.length && !busy ? C.amber : C.line),
            border: settled ? `1px solid ${C.line}` : 'none',
            color: settled ? C.ink : (chosen.length && !busy ? C.amberInk : C.ink),
          }}
        >
          {settled ? S.batchBack
            : busy ? S.batchSending
              : chosen.length ? S.batchConfirm(chosen.length) : S.batchNothing}
        </button>
      </div>
    </div>
  );
}

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

function outcomeOf(results, row) {
  const list = (results && results.results) || [];
  return list.find((r) => r.sourceHash === row.sourceHash && r.index === row.index) || null;
}

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

function Row({ row, ticked, outcome, edit, isOpen, overrode, onToggleOpen, onTick, onOverride, onPick }) {
  const writable = isWritable(row.row_status);
  const note = statusNote(row);
  const dup = row.dupBook;
  const bookDup = dup && dup.checked && dup.match;
  const unchecked = dup && dup.checked === false;
  const category = (edit && edit.category) || row.category;
  const settled = !!outcome;

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
      borderRadius: 12, marginBottom: 7,
      opacity: settled && outcome.status !== 'written' ? 0.75 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', minHeight: 56 }}>
        {/**
          * A NON-WRITABLE ROW HAS NO TICK AT ALL — not a disabled one. A control
          * he cannot use is a question about why; the reason is in words instead.
          */}
        {settled ? (
          <span style={{ flex: '0 0 26px', textAlign: 'center', color: C.muted }}>
            {outcome.status === 'written' ? '✓' : outcome.status === 'error' ? '!' : '·'}
          </span>
        ) : writable ? (
          <button
            onClick={() => onTick(!ticked)}
            role="checkbox"
            aria-checked={ticked}
            aria-label={row.merchant_display || row.description || ''}
            style={{
              flex: '0 0 30px', height: 30, borderRadius: 8,
              border: `2px ${ticked ? 'solid' : 'dashed'} ${ticked ? C.harbor : C.line}`,
              background: ticked ? C.harbor : 'transparent',
              color: C.onDark, fontSize: 16, fontWeight: 700,
            }}
          >
            {ticked ? '✓' : ''}
          </button>
        ) : (
          <span style={{ flex: '0 0 30px', textAlign: 'center', color: C.muted, fontSize: 18 }}>✕</span>
        )}

        <button
          onClick={onToggleOpen}
          aria-expanded={isOpen}
          style={{ flex: 1, minWidth: 0, textAlign: 'start', background: 'transparent', padding: 0 }}
        >
          <span style={{
            display: 'block', fontSize: 15.5, fontWeight: 600,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...ISOLATE,
          }} dir="auto">
            {/* Printed AS THE BANK PRINTED IT, truncation included — that is what
                lets him match this list against the picture in his hand. */}
            {row.merchant_display || row.description || '—'}
          </span>
          <span style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, color: C.muted, marginTop: 2 }}>
            {settled && (
              <b style={{ color: outcome.status === 'written' ? C.settledInk : C.conflictInk }}>
                {outcome.status === 'written' ? S.batchWritten
                  : outcome.status === 'error' ? S.batchErrored : S.batchSkippedDup}
              </b>
            )}
            {!settled && note && (
              <span style={{
                padding: '2px 8px', borderRadius: 999, fontWeight: 700,
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
              <span style={{ padding: '2px 8px', borderRadius: 999, background: C.mist, fontWeight: 700 }}>
                {S.batchNeedCategory}
              </span>
            )}
            {category && <span dir="auto">{categoryLabel(category)}</span>}
          </span>
        </button>

        {/* A null amount renders —, never 0. An aggregate has no single figure. */}
        <span style={{ fontFamily: FONT_DISPLAY, fontSize: 16.5, fontWeight: 650, ...LATIN, ...NUMERALS }}>
          {row.amount == null ? '—' : money(Math.abs(row.amount))}
        </span>
      </div>

      {isOpen && !settled && (
        <div style={{ padding: '0 12px 12px' }}>
          {/**
            * THE MATCHED ROW ITSELF, so he judges rather than trusts — and the
            * override REPLACES the tick rather than sitting beside it, which is
            * the shape already proven on the SMS duplicate.
            */}
          {bookDup && !overrode && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.conflictInk }}>{S.batchDupBookIntro}</div>
              <div style={{
                background: C.shell, border: `1px solid ${C.line}`, borderRadius: 9,
                padding: '9px 11px', fontSize: 13, marginTop: 6, lineHeight: 1.7, ...ISOLATE,
              }} dir="auto">
                <span style={LATIN}>{dup.match.date}</span> · {dup.match.description} ·{' '}
                <span style={LATIN}>{money(dup.match.amount)} {dup.match.currency}</span>
              </div>
              <button
                className="catchip" onClick={onOverride}
                style={{
                  marginTop: 9, minHeight: TAP, width: '100%', borderRadius: 12,
                  background: C.card, border: `1px solid ${C.conflictLine}`,
                  color: C.conflictInk, fontSize: 15, fontWeight: 700,
                }}
              >
                {S.batchSaveAnyway}
              </button>
            </>
          )}
          {writable && !bookDup && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SHORT_LIST.map((c) => (
                <button
                  key={c} className="catchip" onClick={() => onPick(c)}
                  style={{
                    padding: '9px 13px', minHeight: 44, borderRadius: 999,
                    background: category === c ? C.harbor : C.shell,
                    color: category === c ? C.onDark : C.ink,
                    border: `1px solid ${category === c ? C.harbor : C.line}`,
                    fontSize: 14, fontWeight: category === c ? 700 : 500,
                  }}
                  dir="auto"
                >
                  {category === c ? '✓ ' : ''}{categoryLabel(c)}
                </button>
              ))}
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
      <div style={{ fontSize: 44 }}>🧾</div>
      <p style={{ fontSize: 16, lineHeight: 1.7, color: C.ink, margin: '12px auto 18px', maxWidth: 300 }}>
        {S.batchExpired}
      </p>
      <button
        className="bigbtn" onClick={onResnap} disabled={busy}
        style={{
          width: '100%', minHeight: 56, borderRadius: 14, background: C.harbor,
          color: C.onDark, fontSize: 17, fontWeight: 700,
        }}
      >
        {busy ? S.batchSending : S.batchResnap}
      </button>
      <button
        className="catchip" onClick={onDiscard}
        style={{
          marginTop: 10, minHeight: TAP, padding: '0 16px', borderRadius: 12,
          background: 'transparent', border: `1px solid ${C.line}`, color: C.muted, fontSize: 14.5,
        }}
      >
        {S.batchDiscard}
      </button>
    </div>
  );
}
