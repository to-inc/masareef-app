import { useState } from 'react';
import { C, FONT_DISPLAY, NUMERALS, RADIUS, TYPE } from '../theme.js';
import { S } from '../i18n/strings.js';
import { money } from '../lib/format.js';
import { SectionLabel, Chip, LATIN } from '../components/Primitives.jsx';
import { OutcomeNote, CategoryActions } from '../components/CategoryPicker.jsx';
import { cardKey, reconcile, remaining, needsHim, headlineFor, batchable } from '../state/inboxOutcomes.js';

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
export default function InboxView({ pending, settled = {}, onConfirm, onConfirmMany }) {
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
  /**
   * THE HEADLINE COUNTS EVERY ROW, INCLUDING THE FOLDED ONES (finding S3).
   *
   * It used to count `fresh` while the tab badge counted all of `pending`, so
   * the app showed a red 4 over a list headed «2 عمليات مستنية». Both numbers
   * were defensible and together they were a contradiction on the home screen —
   * the same class of thing `needsHim` exists to make impossible between the
   * badge, the header and the buttons.
   *
   * Counting everything here is the honest direction rather than teaching the
   * badge to count fresh: the four rows all need him, and the two that are old
   * are folded, not cancelled. The arithmetic is now visible on one screen —
   * two cards, plus «مصاريف قديمة (2)» right under them, equals the four the
   * badge claims.
   */
  const head = headlineFor(rows);
  // The batch's contents, from the shared rule — the button's label counts the
  // very list it will send, so the two cannot disagree.
  const batch = onConfirmMany ? batchable(fresh) : [];
  const HEADLINE = {
    waiting: S.inboxWaiting(head.count),
    saving: S.cardSaving,
    queued: S.cardQueued,
    done: S.inboxAllDone,
  };

  return (
    <div>
      {/* Rendered whenever there is anything at all — a month where every
          outstanding row is old still has a headline, and it still counts them. */}
      {rows.length > 0 && <SectionLabel>{HEADLINE[head.kind]}</SectionLabel>}

      {/**
        * THE BATCH (finding M4). Offered only when it saves him something: at one
        * row it is the same tap as the card's own green button, one row further
        * down, so it is noise. From two it is the difference between an evening
        * pass and a queue.
        *
        * It never appears on rows the app has not earned — `batchable` excludes
        * anything without a server guess (D5) — so this button can only ever do
        * what the green buttons under it would have done.
        */}
      {batch.length > 1 && (
        <button
          className="bigbtn"
          onClick={() => onConfirmMany(batch.map((r) => r.item))}
          style={{
            width: '100%', minHeight: 52, borderRadius: RADIUS.row, marginBottom: 14,
            background: C.harbor, color: C.onDark, fontSize: 17, fontWeight: 700,
          }}
        >
          ✓ {S.inboxBatch(batch.length)}
        </button>
      )}

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
          width: '100%', minHeight: 56, borderRadius: RADIUS.row, padding: '12px 16px',
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

function PendingCard({ item, outcome, onConfirm }) {
  const p = item.match;

  /**
   * The buttons live in `components/CategoryPicker.jsx` — the SAME component the
   * Recent list uses, because tapping a category here and tapping one there are
   * the same act on the same sheet cell. Two copies would be two places for the
   * outcome states to drift.
   */
  const inert = !needsHim(outcome);

  return (
    <div
      className="card-in"
      style={{
        background: C.card, borderRadius: RADIUS.card, padding: 16, marginBottom: 14,
        opacity: inert ? 0.62 : 1,
        transition: 'opacity .2s ease',
      }}
    >
      {/**
        * THE MERCHANT LEADS (finding M3).
        *
        * The amount used to be set at 30px with the merchant at 17.5px under it.
        * But the question this card asks is "what KIND of purchase was this?",
        * and only the merchant answers it — the amount is context. He is not
        * deciding anything about 860; he is deciding about Nile Star Market.
        *
        * The two also swapped places for a second reason: at 30px the amount
        * plus a 56px guess button plus twenty-seven chips made one card taller
        * than the viewport. Merchant-leading with the amount beside it puts three
        * cards on screen where there were one and a half, which is what makes the
        * evening pass feel like a pass rather than a queue.
        */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <div style={{ fontSize: 19, fontWeight: 650, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...LATIN }} dir="auto">
          {p.description}
        </div>
        {/* A row he never priced has NO amount. Rendering money(null) as "0"
            would state a figure he never wrote — the same lie the unpriced
            counter exists to prevent. Show the absence instead. */}
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 650, color: C.ink, flexShrink: 0, ...LATIN, ...NUMERALS }}>
          {p.amount == null ? '—' : money(p.amount)}{' '}
          {/* caption (ruling 2): a unit suffix duplicates the amount beside it */}
          {p.amount != null && <span style={{ fontSize: TYPE.caption, color: C.muted, fontWeight: 500 }}>{p.currency}</span>}
        </div>
      </div>

      {/* caption (ruling 2): row meta — method chip, date, travel flag — restates the row */}
      <div style={{ fontSize: TYPE.caption, color: C.muted, marginTop: 5, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip kind={p.method} small label={p.method === 'Visa' ? S.metricVisa : S.metricCash} />
        <span style={LATIN}>{p.date}</span>
        {/* Only a REAL foreign currency is travel. An unpriced row has
            currency null, and `null !== 'EGP'` would mislabel it. */}
        {p.currency && p.currency !== 'EGP' ? <span>{S.travel}</span> : null}
      </div>

      <OutcomeNote outcome={outcome} />

      <CategoryActions guess={item.guess} outcome={outcome} onPick={(c) => onConfirm(item, c)} />

      {/**
        * «الرسالة الأصلية» IS GONE (finding S10).
        *
        * The prototype showed the original bank SMS here, which was a real
        * "show your work" gesture. The row now comes from the sheet instead, so
        * what the disclosure actually revealed was `Aug · #14` — a tab name and
        * a row index. That is a developer's breadcrumb: it names a place he
        * cannot go, in a vocabulary he does not use, and it sat on the card he
        * taps most often in the app.
        *
        * The honest version of the same gesture is «افتح الشيت» at the foot of
        * the book, where it opens the actual file. This card keeps the amount,
        * the merchant and the date — which is everything the sheet row holds.
        */}
    </div>
  );
}

// Re-exported so a caller never has a reason to write its own copy of the key
// rule — one definition, asserted in scripts/test-inbox.mjs.
export { cardKey };
