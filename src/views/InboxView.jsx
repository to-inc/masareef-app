import { useState } from 'react';
import { C, FONT_DISPLAY, NUMERALS, TAP } from '../theme.js';
import { CATEGORIES, SHORT_LIST } from '../lib/constants.js';
import { S } from '../i18n/strings.js';
import { money } from '../lib/format.js';
import { SectionLabel, Chip, LATIN } from '../components/Primitives.jsx';
import { cardKey, reconcile, remaining, needsHim, headlineFor } from '../state/inboxOutcomes.js';

/**
 * The Inbox is where the 5-second law is won or lost. Each card is one purchase
 * the bank already told us about; the only thing missing is which category it
 * belongs to. If we guessed it, that is ONE tap on a button big enough to hit
 * without looking.
 *
 * WS3-C (2026-08-03): a card also has to SHOW what became of that tap. It used
 * to vanish optimistically and come back on the next refetch with no trace, so
 * "done" and "the write failed" looked identical — see state/inboxOutcomes.js
 * for the field report. `settled` is that record, keyed by `cardKey`, and it is
 * what makes a confirmed card stay confirmed on screen no matter what the
 * server keeps sending.
 */
export default function InboxView({ pending, settled = {}, onConfirm }) {
  const rows = reconcile(pending, settled);

  if (rows.length === 0) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 110 }}>
        <div style={{ fontSize: 52 }}>🍵</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 23, fontWeight: 650, color: C.harbor, marginTop: 10 }}>
          {S.inboxEmptyTitle}
        </div>
        <div style={{ color: C.muted, fontSize: 15.5, marginTop: 8, lineHeight: 1.6, maxWidth: 280, marginInline: 'auto' }}>
          {S.inboxEmptyBody}
        </div>
      </div>
    );
  }

  // The server tags anything older than PENDING_STALE_DAYS. Fresh rows are the
  // daily list; stale ones live behind one card. Burying today's two purchases
  // under forty months-old travel rows would turn a 5-second chore into a
  // backlog — which is the exact friction the whole design exists to prevent.
  const fresh = rows.filter((r) => !r.item.stale);
  const stale = rows.filter((r) => r.item.stale);
  // Counted from the SAME predicate the buttons use, so the header can never
  // announce work he has already done — nor claim a ✓ the server has not given.
  const head = headlineFor(fresh);
  const HEADLINE = {
    waiting: S.inboxWaiting(head.count),
    saving: S.cardSaving,
    queued: S.cardQueued,
    done: S.inboxAllDone,
  };

  return (
    <div>
      {fresh.length > 0 && <SectionLabel>{HEADLINE[head.kind]}</SectionLabel>}
      {fresh.map((row) => (
        <PendingCard key={row.key} item={row.item} outcome={row.outcome} onConfirm={onConfirm} />
      ))}
      {stale.length > 0 && <StaleGroup rows={stale} onConfirm={onConfirm} />}
    </div>
  );
}

function StaleGroup({ rows, onConfirm }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 8 }}>
      <button
        className="catchip"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', minHeight: 56, borderRadius: 14, padding: '12px 16px',
          background: open ? C.mist : C.card, border: `1px dashed ${C.harbor}`,
          color: C.harbor, fontSize: 16, fontWeight: 700, textAlign: 'start',
        }}
      >
        {S.inboxOldTitle(remaining(rows) || rows.length)}
        <div style={{ fontSize: 13, fontWeight: 500, color: C.muted, marginTop: 2 }}>
          {open ? S.inboxOldHide : S.inboxOldBody}
        </div>
      </button>
      {open && (
        <div style={{ marginTop: 12 }}>
          {rows.map((row) => (
            <PendingCard key={row.key} item={row.item} outcome={row.outcome} onConfirm={onConfirm} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The one strip that says what became of his tap.
 *
 * Honest-render law, applied to a non-numeric field: every word here comes from
 * the server's answer. `saving` says only that the tap registered, because
 * between the tap and the reply that is the entire truth; `conflict` prints the
 * category the SHEET now holds, never the one he pressed; and a conflict whose
 * `current` we could not read still gets a sentence rather than a blank.
 */
export function OutcomeNote({ outcome }) {
  if (!outcome) return null;
  const s = outcome.status;

  const skin = {
    saving:   { fg: C.ink,          bg: C.shell,      line: C.line },
    done:     { fg: C.settledInk,   bg: C.settledBg,  line: C.settledLine },
    already:  { fg: C.settledInk,   bg: C.settledBg,  line: C.settledLine },
    queued:   { fg: C.ink,          bg: C.sand,       line: C.line },
    conflict: { fg: C.conflictInk,  bg: C.conflictBg, line: C.conflictLine },
    failed:   { fg: C.conflictInk,  bg: C.conflictBg, line: C.conflictLine },
  }[s] || { fg: C.ink, bg: C.shell, line: C.line };

  const text = {
    saving: S.cardSaving,
    done: S.cardDone,
    already: S.cardAlready,
    queued: S.cardQueued,
    conflict: S.cardConflict,
    failed: S.cardFailed,
  }[s];
  if (!text) return null;

  // Named beside `done` (what was written) and beside `conflict` (what the sheet
  // holds instead). Nothing is shown for the states where naming a category
  // would assert something we do not know.
  const named = s === 'done' ? outcome.category
    : s === 'conflict' ? outcome.sheetCategory
      : null;

  return (
    <div
      aria-live="polite"
      style={{
        marginTop: 12, minHeight: 44, borderRadius: 12, padding: '11px 14px',
        background: skin.bg, color: skin.fg, border: `1px solid ${skin.line}`,
        fontSize: 15.5, fontWeight: 700,
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      }}
    >
      <span>{text}</span>
      {named && (
        <>
          {s === 'conflict' && <span style={{ fontWeight: 500 }}>{S.cardConflictIs}</span>}
          <span style={LATIN} dir="auto">{named}</span>
        </>
      )}
    </div>
  );
}

function PendingCard({ item, outcome, onConfirm }) {
  const p = item.match;
  const guess = item.guess;
  // No guess → straight to the chip grid. Never a wrong green button (D5).
  const [showAll, setShowAll] = useState(!guess);

  /**
   * A card he has already dealt with keeps its buttons on screen but DEAD.
   *
   * Removing them would be tidier and is wrong: in a nine-card batch the list
   * would shorten under his thumb between the tap and the next reach, and he
   * would land on a card he never meant to touch. Height stays constant; only
   * the colour and the strip change.
   */
  const inert = !needsHim(outcome);

  return (
    <div
      className="card-in"
      style={{
        background: C.card, borderRadius: 18, padding: 16, marginBottom: 14,
        border: `1px solid ${C.line}`, boxShadow: '0 2px 10px rgba(17,38,29,.05)',
        opacity: inert ? 0.62 : 1,
        transition: 'opacity .2s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        {/* A row he never priced has NO amount. Rendering money(null) as "0"
            would state a figure he never wrote — the same lie the unpriced
            counter exists to prevent. Show the absence instead. */}
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 30, fontWeight: 650, color: C.ink, ...LATIN, ...NUMERALS }}>
          {p.amount == null ? '—' : money(p.amount)}{' '}
          {p.amount != null && <span style={{ fontSize: 15, color: C.muted, fontWeight: 500 }}>{p.currency}</span>}
        </div>
        <Chip kind={p.method} label={p.method === 'Visa' ? S.metricVisa : S.metricCash} />
      </div>

      <div style={{ fontSize: 17.5, fontWeight: 600, marginTop: 2, ...LATIN }} dir="auto">{p.description}</div>
      <div style={{ fontSize: 13, color: C.muted, marginTop: 3 }}>
        <span style={LATIN}>{p.date}</span>
        {/* Only a REAL foreign currency is travel. An unpriced row has
            currency null, and `null !== 'EGP'` would mislabel it. */}
        {p.currency && p.currency !== 'EGP' ? ` · ${S.travel}` : ''}
      </div>

      <OutcomeNote outcome={outcome} />

      {guess && (
        <button
          className="bigbtn"
          onClick={() => onConfirm(item, guess)}
          disabled={inert}
          style={{
            marginTop: 12, width: '100%', minHeight: 56, padding: '15px 0',
            borderRadius: 14, background: C.harbor, color: C.onDark,
            fontSize: 18.5, fontWeight: 700,
            opacity: inert ? 0.45 : 1,
          }}
        >
          ✓ <span style={LATIN} dir="auto">{guess}</span>
        </button>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10, opacity: inert ? 0.45 : 1 }}>
        {(showAll ? CATEGORIES : SHORT_LIST)
          .filter((c) => c !== guess)
          .map((c) => (
            <button
              key={c}
              className="catchip"
              onClick={() => onConfirm(item, c)}
              disabled={inert}
              style={{
                padding: '11px 15px', minHeight: TAP, borderRadius: 999,
                background: C.shell, border: `1px solid ${C.line}`,
                fontSize: 15, fontWeight: 500, color: C.ink, ...LATIN,
              }}
              dir="auto"
            >
              {c}
            </button>
          ))}
        {!showAll && (
          <button
            className="catchip"
            onClick={() => setShowAll(true)}
            disabled={inert}
            style={{
              padding: '11px 15px', minHeight: TAP, borderRadius: 999,
              background: 'transparent', border: `1px dashed ${C.harbor}`,
              fontSize: 15, color: C.harbor, fontWeight: 600,
            }}
          >
            {S.more}
          </button>
        )}
      </div>

      {/* The prototype showed the original SMS here. The row now comes from the
          sheet, so the equivalent "show your work" gesture is where it lives —
          he can always go look at exactly that row himself. */}
      <details style={{ marginTop: 10 }}>
        <summary style={{ fontSize: 12.5, color: C.muted, cursor: 'pointer' }}>{S.inboxOriginal}</summary>
        <div
          style={{
            fontSize: 13.5, color: C.muted, background: C.shell, borderRadius: 10,
            padding: 10, marginTop: 6, lineHeight: 1.8,
          }}
        >
          <span style={LATIN} dir="auto">{item.tab}</span> · <span style={LATIN}>{`#${item.rowHint}`}</span>
        </div>
      </details>
    </div>
  );
}

// Re-exported so a caller never has a reason to write its own copy of the key
// rule — one definition, asserted in scripts/test-inbox.mjs.
export { cardKey };
