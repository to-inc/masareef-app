import { useState } from 'react';
import { C, FONT_DISPLAY, NUMERALS, RADIUS, SPACE, TAP, TYPE } from '../theme.js';
import { S, monthByTab } from '../i18n/strings.js';
import { Sheet, Chip, LATIN } from '../components/Primitives.jsx';
import { CURRENCIES } from '../state/travel.js';
import { normalizeDigits, money } from '../lib/format.js';
import { parseSheetDate } from '../state/recent.js';
import { editEntry } from '../api/index.js';

/**
 * U1 — THE EDIT SHEET (Owner field ruling 2026-08-27, the VR case: a booked
 * 22.9 EUR pool entry marked Cash that was really Card, and no way to fix it).
 *
 * ——— WHAT THIS IS. A B4 Sheet over the Book, opened from a row's own panel,
 * editing the five keys §3.7 makes editable: METHOD FIRST (the Owner's case),
 * then amount, currency, description, date. Category is deliberately NOT here
 * — `fix_category` owns that cell and its Memory-learning side effect, and the
 * row's panel already offers it one gesture earlier.
 *
 * ——— THE IDENTITY IT SENDS, and the identity it refuses to invent. §2.4's
 * `entries` payload deliberately carries no sheet position and no sourceHash
 * exists anywhere in §3.7 — so the wire is `tab + match + edits`, the server's
 * content-scan path, exactly as the category edit already argues (fixPayload's
 * law). The item's `rowHint` is a LOCAL settle key built from the row's own
 * date and amount; sending it would put a fabricated position on the wire.
 *
 * ——— EVERY ANSWER RENDERS AS ITSELF:
 *   · `row_changed` renders the SERVER's row (the conflict grammar the Inbox
 *     card taught), plus a way to adopt that truth and argue again from it —
 *     «a stale client can never overwrite a change it has not seen» becomes
 *     «…and once it has seen it, it may argue again»;
 *   · `bad_edit` renders a refusal in words; the one refusal the client can
 *     name BEFORE the wire — a date that would leave the tab — is named while
 *     he types, month word and all, because the server's answer would be a
 *     bare `bad_edit` for a rule he cannot guess;
 *   · a transport throw renders a LIVE retry with his work intact — never
 *     «هيتسجّل أول ما النت يرجع»: App.jsx's outbox replays only the kinds it
 *     knows, and an unknown kind resolves ok:true and is DROPPED as sent, so
 *     the queued promise would be a silent loss wearing a ✓. The U1 oracle
 *     trips the day the shell learns the verb, and the grammar is revisited.
 */

/**
 * The DIFF between the row he saw and the draft he typed — only CHANGED keys
 * become `edits`, because a no-op edit is a client bug the server surfaces
 * (§3.7's own words) and an unchanged field must never ride along to widen the
 * concurrency claim. Unreadable drafts are NAMED in `invalid` rather than
 * silently dropped from the send — a field that quietly does not send is the
 * silent-drop this chunk exists to kill.
 */
export function editsBetween(match, draft) {
  const m = match || {};
  const d = draft || {};
  const edits = {};
  const invalid = [];

  if (d.method && (d.method === 'Visa' || d.method === 'Cash') && d.method !== m.method) {
    edits.method = d.method;
  }

  const rawAmount = String(d.amount == null ? '' : d.amount).trim();
  if (rawAmount !== '') {
    const t = normalizeDigits(rawAmount).replace(/٫/g, '.').replace(/,/g, '').trim();
    const n = Number(t);
    if (!isFinite(n) || n <= 0 || n >= 1000000) invalid.push('amount');
    else {
      const v = Math.round(n * 100) / 100;
      if (!(m.amount != null && Math.abs(v - Number(m.amount)) < 0.005)) edits.amount = v;
    }
  }

  if (d.currency && d.currency !== (m.currency == null ? null : m.currency)) {
    edits.currency = d.currency;
  }

  const desc = String(d.description == null ? '' : d.description).trim();
  if (desc && desc !== String(m.description == null ? '' : m.description).trim()) {
    edits.description = desc;
  }

  const date = String(d.date == null ? '' : d.date).trim();
  const mDate = String(m.date == null ? '' : m.date).trim();
  if (date && date !== mDate) {
    const parsed = parseSheetDate(normalizeDigits(date));
    if (!parsed) invalid.push('date');
    else {
      const prior = parseSheetDate(normalizeDigits(mDate));
      // The same day spelled differently (01/8 vs 1/8) is not a change.
      if (!(prior && prior.y === parsed.y && prior.m === parsed.m && prior.d === parsed.d)) {
        edits.date = `${parsed.d}/${parsed.m}/${parsed.y}`;
      }
    }
  }

  return { edits, invalid };
}

/**
 * Would this date edit move the row to another TAB? The server refuses that as
 * `bad_edit` (§3.7: a move is append + delete, and the backend has no delete);
 * the client names the rule in words BEFORE the wire. An unreadable row date
 * makes NO local claim — the server judges, and this returns false rather than
 * guessing a refusal the contract might not make.
 */
export function dateLeavesMonth(matchDate, editDate) {
  const a = parseSheetDate(normalizeDigits(String(matchDate == null ? '' : matchDate)));
  const b = parseSheetDate(normalizeDigits(String(editDate == null ? '' : editDate)));
  if (!a || !b) return false;
  return a.y !== b.y || a.m !== b.m;
}

/**
 * tab + match + edits EXACTLY. No `rowHint` KEY at all — absence, not
 * undefined (fixPayload's law, restated at the second edit door: the item's
 * rowHint is a local settle key, and a fabricated position is worse than none).
 */
export function editWirePayload(item, edits) {
  return { tab: item.tab, match: item.match, edits };
}

/**
 * The server's answer → the sheet's state. Strict `ok === true` (outcomeFor's
 * own law — `{ok:"yes"}` from a truncated deployment is not a success), every
 * named refusal its own state, everything unnamed `failed`, and a throw is
 * OFFLINE — a live retry, never a queued claim the shell cannot honour.
 */
export function outcomeForEdit(res, threw) {
  if (threw) return { status: 'offline' };
  if (res && res.ok === true) {
    const e = res.entry;
    return { status: 'done', entry: e && typeof e === 'object' ? e : null };
  }
  const code = (res && res.error) || 'unknown';
  if (code === 'row_changed') {
    const cur = res && res.current;
    return { status: 'conflict', current: cur && typeof cur === 'object' ? cur : null };
  }
  if (code === 'row_not_found') return { status: 'notfound' };
  if (code === 'bad_edit') return { status: 'refused' };
  if (code === 'unknown_action') return { status: 'engine' };
  return { status: 'failed', error: code };
}

const FIELD_LABEL = { fontSize: TYPE.label, fontWeight: 600, color: C.muted, margin: '10px 2px 6px' };
const INPUT = {
  width: '100%', minHeight: TAP, padding: '10px 14px', borderRadius: RADIUS.row,
  background: C.card, border: `1px solid ${C.line}`, color: C.ink, fontSize: TYPE.row,
};

/** One row of the SERVER's truth — rendered in the conflict and done states. */
function SnapshotRow({ row }) {
  if (!row) return null;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
      marginTop: 6, padding: '8px 11px', borderRadius: RADIUS.inset, background: C.card,
    }}>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: TYPE.label, color: C.ink }} dir="auto">
        {row.description}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <Chip kind={row.method} small label={row.method === 'Visa' ? S.metricVisa : S.metricCash} />
        <span style={{ fontSize: TYPE.caption, color: C.muted, ...LATIN }}>{row.date}</span>
        <span style={{ fontFamily: FONT_DISPLAY, fontSize: TYPE.label, fontWeight: 650, color: C.ink, ...LATIN, ...NUMERALS }}>
          {row.amount == null ? '—' : money(row.amount)}
          {row.amount != null && row.currency && row.currency !== 'EGP' ? ` ${row.currency}` : ''}
        </span>
      </span>
    </div>
  );
}

export default function EditSheet({ item, onClose, onSaved, initialDraft = null, initialStatus = null }) {
  const match0 = (item && item.match) || {};
  /**
   * The BASELINE is the row as last SEEN — the concurrency claim. Adopting a
   * conflict's `current` moves it, so a retry argues from the state the server
   * just showed him rather than from one it already refused.
   */
  const [baseline, setBaseline] = useState(match0);
  const [draft, setDraft] = useState(() => ({
    method: match0.method === 'Visa' ? 'Visa' : 'Cash',
    amount: match0.amount == null ? '' : String(match0.amount),
    currency: match0.currency || null,
    description: match0.description || '',
    date: match0.date || '',
    ...(initialDraft || {}),
  }));
  const [outcome, setOutcome] = useState(initialStatus);

  const { edits, invalid } = editsBetween(baseline, draft);
  const leaves = edits.date != null && dateLeavesMonth(baseline.date, edits.date);
  /**
   * Amount and currency are ONE cell (§3.7's guard): pricing an unpriced row
   * needs both, and the client says so instead of collecting a bare `bad_edit`.
   */
  const needCurrency = edits.amount != null
    && (edits.currency || baseline.currency) == null;
  const changed = Object.keys(edits).length > 0;
  const busy = outcome && outcome.status === 'saving';
  const settled = outcome && (outcome.status === 'done' || outcome.status === 'engine');
  const canSave = changed && !leaves && !needCurrency && invalid.length === 0 && !busy && !settled;

  const save = async () => {
    if (!canSave) return;
    setOutcome({ status: 'saving' });
    let res = null; let threw = false;
    try {
      res = await editEntry(editWirePayload({ tab: item.tab, match: baseline }, edits));
    } catch { threw = true; }
    const out = outcomeForEdit(res, threw);
    setOutcome(out);
    // The overlay receives the SHEET's re-read row — never the draft: the
    // screen may only show what the server said it wrote (honest render).
    if (out.status === 'done' && out.entry && onSaved) onSaved(out.entry);
  };

  const adoptCurrent = () => {
    const cur = outcome && outcome.current;
    if (!cur) { setOutcome(null); return; }
    setBaseline(cur);
    setDraft({
      method: cur.method === 'Visa' ? 'Visa' : 'Cash',
      amount: cur.amount == null ? '' : String(cur.amount),
      currency: cur.currency || null,
      description: cur.description || '',
      date: cur.date || '',
    });
    setOutcome(null);
  };

  // The row's currency stays offerable even when the keypad's ruled list has
  // moved on — hiding a row's own unit would make its edit unsendable.
  const currencyOptions = [];
  for (const c of [baseline.currency, ...CURRENCIES]) {
    if (c && currencyOptions.indexOf(c) === -1) currencyOptions.push(c);
  }

  const set = (k) => (v) => setDraft((s) => ({ ...s, [k]: v }));
  const methodBtn = (value, label) => {
    const active = draft.method === value;
    return (
      <button
        key={value}
        onClick={() => set('method')(value)}
        aria-pressed={active}
        style={{
          flex: 1, minHeight: TAP, borderRadius: RADIUS.capsule,
          background: active ? C.harbor : C.card,
          border: `1px solid ${active ? C.harbor : C.line}`,
          color: active ? C.onDark : C.ink, fontSize: TYPE.label, fontWeight: active ? 700 : 600,
        }}
      >
        {label}
      </button>
    );
  };

  const refusalLine = (words) => (
    <div style={{ fontSize: TYPE.label, color: C.conflictInk, lineHeight: 1.5, margin: '6px 2px 0' }}>
      {words}
    </div>
  );

  return (
    <>
      {/* The way out: the whole page behind the sheet (SettingsSheet's grammar). */}
      <button
        onClick={onClose}
        aria-label={S.settingsClose}
        style={{ position: 'fixed', inset: 0, zIndex: 44, background: 'transparent', cursor: 'default' }}
      />
      <div
        style={{
          position: 'fixed', insetInline: 0, bottom: 0, zIndex: 45,
          borderRadius: `${RADIUS.sheet}px ${RADIUS.sheet}px 0 0`,
          overflow: 'hidden',
        }}
      >
        <Sheet
          role="dialog"
          aria-label={S.editRowTitle}
          style={{
            background: C.shell, border: `1px solid ${C.line}`,
            padding: `6px ${SPACE.gutter}px calc(${SPACE.cardPad}px + env(safe-area-inset-bottom, 0px) + ${RADIUS.sheet}px)`,
            marginBottom: -RADIUS.sheet,
            maxHeight: '82vh', overflowY: 'auto',
            boxShadow: '0 -12px 32px rgba(44, 67, 86, 0.18)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.gap, padding: '10px 0 2px' }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: TYPE.section, fontWeight: 650, color: C.ink }}>
              {S.editRowTitle}
            </div>
            <button
              onClick={onClose}
              style={{
                minHeight: TAP, padding: '0 18px', borderRadius: RADIUS.capsule,
                background: 'transparent', border: `1px solid ${C.line}`,
                color: C.ink, fontSize: TYPE.label, fontWeight: 700,
              }}
            >
              {S.settingsClose}
            </button>
          </div>

          {/* ═══ METHOD FIRST — the Owner's VR case is the headline field. ═══ */}
          <div style={FIELD_LABEL}>{S.entryMethod}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {methodBtn('Cash', S.methodCash)}
            {methodBtn('Visa', S.methodCard)}
          </div>

          <div style={FIELD_LABEL}>{S.receiptAmount}</div>
          <input
            value={draft.amount}
            onChange={(e) => set('amount')(e.target.value)}
            inputMode="decimal"
            style={{ ...INPUT, ...LATIN, ...NUMERALS }}
          />
          {invalid.indexOf('amount') !== -1 && refusalLine(S.editBadAmount)}
          {needCurrency && refusalLine(S.editNeedCurrency)}

          <div style={FIELD_LABEL}>{S.entryCurrency}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {currencyOptions.map((c) => {
              const active = draft.currency === c;
              return (
                <button
                  key={c}
                  onClick={() => set('currency')(c)}
                  aria-pressed={active}
                  style={{
                    minHeight: TAP, padding: '0 16px', borderRadius: RADIUS.capsule,
                    background: active ? C.harbor : C.card,
                    border: `1px solid ${active ? C.harbor : C.line}`,
                    color: active ? C.onDark : C.ink, fontSize: TYPE.label, fontWeight: active ? 700 : 600,
                    ...LATIN,
                  }}
                >
                  {c}
                </button>
              );
            })}
          </div>

          <div style={FIELD_LABEL}>{S.editDescription}</div>
          <input
            value={draft.description}
            onChange={(e) => set('description')(e.target.value)}
            dir="auto"
            style={INPUT}
          />

          <div style={FIELD_LABEL}>{S.receiptDate}</div>
          <input
            value={draft.date}
            onChange={(e) => set('date')(e.target.value)}
            placeholder="d/M/yyyy"
            inputMode="numeric"
            style={{ ...INPUT, ...LATIN, ...NUMERALS }}
          />
          {invalid.indexOf('date') !== -1 && refusalLine(S.editBadDate)}
          {/* The one refusal the client can NAME before the wire — the server's
              answer would be a bare bad_edit for a rule he cannot guess. */}
          {leaves && refusalLine(S.editDateLeavesMonth(monthByTab(item && item.tab)))}

          {/* ═══ what the server said — every branch its own true sentence ═══ */}
          {outcome && outcome.status === 'saving' && (
            <div style={{ fontSize: TYPE.label, color: C.muted, margin: '12px 2px 0' }}>{S.cardSaving}</div>
          )}
          {outcome && outcome.status === 'done' && (
            <div style={{
              marginTop: 12, padding: '10px 12px', borderRadius: RADIUS.row,
              background: C.settledBg, border: `1px solid ${C.settledLine}`,
            }}>
              <div style={{ fontSize: TYPE.label, fontWeight: 700, color: C.settledInk }}>{S.editDone}</div>
              <SnapshotRow row={outcome.entry} />
            </div>
          )}
          {outcome && outcome.status === 'conflict' && (
            <div style={{
              marginTop: 12, padding: '10px 12px', borderRadius: RADIUS.row,
              background: C.conflictBg, border: `1px solid ${C.conflictLine}`,
            }}>
              <div style={{ fontSize: TYPE.label, fontWeight: 700, color: C.conflictInk }}>{S.editConflict}</div>
              <div style={{ fontSize: TYPE.label, color: C.ink, marginTop: 4 }}>{S.cardConflictIs}</div>
              <SnapshotRow row={outcome.current} />
              <button
                onClick={adoptCurrent}
                style={{
                  width: '100%', minHeight: TAP, marginTop: 10, borderRadius: RADIUS.row,
                  background: C.card, border: `1px solid ${C.line}`,
                  color: C.harborInk, fontSize: TYPE.label, fontWeight: 700,
                }}
              >
                {S.editConflictUse}
              </button>
            </div>
          )}
          {outcome && outcome.status === 'refused' && refusalLine(S.editRefused)}
          {outcome && outcome.status === 'notfound' && refusalLine(S.editNotFound)}
          {outcome && outcome.status === 'failed' && refusalLine(S.genericError)}
          {outcome && outcome.status === 'engine' && (
            <div style={{
              marginTop: 12, padding: '10px 12px', borderRadius: RADIUS.row,
              background: C.sand, border: `1px solid ${C.line}`,
              fontSize: TYPE.label, color: C.ink, lineHeight: 1.5,
            }}>
              {S.dupNeedsEngine}
            </div>
          )}
          {outcome && outcome.status === 'offline' && (
            /* A LIVE retry — his work stays on screen; no queued promise
               exists until something can actually replay this kind. */
            <div style={{
              marginTop: 12, padding: '10px 12px', borderRadius: RADIUS.row,
              background: C.sand, border: `1px solid ${C.line}`,
              fontSize: TYPE.label, color: C.ink, lineHeight: 1.5,
            }}>
              {S.editOffline}
            </div>
          )}

          {/* ═══ the one verb ═══ */}
          {!settled && (
            <>
              <button
                onClick={save}
                disabled={!canSave}
                style={{
                  // 52 ≥ TAP: the floor is a minimum and the one verb earns the
                  // batch button's own height.
                  width: '100%', minHeight: TAP > 52 ? TAP : 52, marginTop: 14, borderRadius: RADIUS.row,
                  background: canSave ? C.harbor : C.mist,
                  color: canSave ? C.onDark : C.muted,
                  fontSize: TYPE.action, fontWeight: 700,
                }}
              >
                {S.editSave}
              </button>
              {!changed && !busy && (
                <div style={{ fontSize: TYPE.label, color: C.muted, textAlign: 'center', marginTop: 8 }}>
                  {S.editNothingChanged}
                </div>
              )}
            </>
          )}
        </Sheet>
      </div>
    </>
  );
}
