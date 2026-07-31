import { useState } from 'react';
import { C, FONT_DISPLAY, TAP } from '../theme.js';
import { CATEGORIES, SHORT_LIST } from '../lib/constants.js';
import { S } from '../i18n/strings.js';
import { money } from '../lib/format.js';
import { SectionLabel, Chip, LATIN } from '../components/Primitives.jsx';

/**
 * The Inbox is where the 5-second law is won or lost. Each card is one purchase
 * the bank already told us about; the only thing missing is which category it
 * belongs to. If we guessed it, that is ONE tap on a button big enough to hit
 * without looking.
 */
export default function InboxView({ pending, onConfirm }) {
  if (!pending || pending.length === 0) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 110 }}>
        <div style={{ fontSize: 52 }}>🍵</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 23, fontWeight: 650, color: C.nile, marginTop: 10 }}>
          {S.inboxEmptyTitle}
        </div>
        <div style={{ color: C.faint, fontSize: 15.5, marginTop: 8, lineHeight: 1.6, maxWidth: 280, marginInline: 'auto' }}>
          {S.inboxEmptyBody}
        </div>
      </div>
    );
  }

  // The server tags anything older than PENDING_STALE_DAYS. Fresh rows are the
  // daily list; stale ones live behind one card. Burying today's two purchases
  // under forty months-old travel rows would turn a 5-second chore into a
  // backlog — which is the exact friction the whole design exists to prevent.
  const fresh = pending.filter((p) => !p.stale);
  const stale = pending.filter((p) => p.stale);

  return (
    <div>
      {fresh.length > 0 && <SectionLabel>{S.inboxWaiting(fresh.length)}</SectionLabel>}
      {fresh.map((item) => (
        <PendingCard key={cardKey(item)} item={item} onConfirm={onConfirm} />
      ))}
      {stale.length > 0 && <StaleGroup items={stale} onConfirm={onConfirm} />}
    </div>
  );
}

const cardKey = (item) => `${item.tab}:${item.rowHint}:${item.match.description}`;

function StaleGroup({ items, onConfirm }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 8 }}>
      <button
        className="catchip"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', minHeight: 56, borderRadius: 14, padding: '12px 16px',
          background: open ? C.brassSoft : C.card, border: `1px dashed ${C.brass}`,
          color: C.brass, fontSize: 16, fontWeight: 700, textAlign: 'start',
        }}
      >
        {S.inboxOldTitle(items.length)}
        <div style={{ fontSize: 13, fontWeight: 500, color: C.faint, marginTop: 2 }}>
          {open ? S.inboxOldHide : S.inboxOldBody}
        </div>
      </button>
      {open && (
        <div style={{ marginTop: 12 }}>
          {items.map((item) => (
            <PendingCard key={cardKey(item)} item={item} onConfirm={onConfirm} />
          ))}
        </div>
      )}
    </div>
  );
}

function PendingCard({ item, onConfirm }) {
  const p = item.match;
  const guess = item.guess;
  // No guess → straight to the chip grid. Never a wrong green button (D5).
  const [showAll, setShowAll] = useState(!guess);

  return (
    <div
      className="card-in"
      style={{
        background: C.card, borderRadius: 18, padding: 16, marginBottom: 14,
        border: `1px solid ${C.line}`, boxShadow: '0 2px 10px rgba(17,38,29,.05)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        {/* A row he never priced has NO amount. Rendering money(null) as "0"
            would state a figure he never wrote — the same lie the unpriced
            counter exists to prevent. Show the absence instead. */}
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 30, fontWeight: 650, color: p.amount == null ? C.faint : C.ink, ...LATIN }}>
          {p.amount == null ? '—' : money(p.amount)}{' '}
          {p.amount != null && <span style={{ fontSize: 15, color: C.faint, fontWeight: 500 }}>{p.currency}</span>}
        </div>
        <Chip kind={p.method} label={p.method === 'Visa' ? S.metricVisa : S.metricCash} />
      </div>

      <div style={{ fontSize: 17.5, fontWeight: 600, marginTop: 2, ...LATIN }} dir="auto">{p.description}</div>
      <div style={{ fontSize: 13, color: C.faint, marginTop: 3 }}>
        <span style={LATIN}>{p.date}</span>
        {/* Only a REAL foreign currency is travel. An unpriced row has
            currency null, and `null !== 'EGP'` would mislabel it. */}
        {p.currency && p.currency !== 'EGP' ? ` · ${S.travel}` : ''}
      </div>

      {guess && (
        <button
          className="bigbtn"
          onClick={() => onConfirm(item, guess)}
          style={{
            marginTop: 12, width: '100%', minHeight: 56, padding: '15px 0',
            borderRadius: 14, background: C.confirm, color: '#fff',
            fontSize: 18.5, fontWeight: 700,
          }}
        >
          ✓ <span style={LATIN} dir="auto">{guess}</span>
        </button>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        {(showAll ? CATEGORIES : SHORT_LIST)
          .filter((c) => c !== guess)
          .map((c) => (
            <button
              key={c}
              className="catchip"
              onClick={() => onConfirm(item, c)}
              style={{
                padding: '11px 15px', minHeight: TAP, borderRadius: 999,
                background: C.paper, border: `1px solid ${C.line}`,
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
            style={{
              padding: '11px 15px', minHeight: TAP, borderRadius: 999,
              background: 'transparent', border: `1px dashed ${C.brass}`,
              fontSize: 15, color: C.brass, fontWeight: 600,
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
        <summary style={{ fontSize: 12.5, color: C.faint, cursor: 'pointer' }}>{S.inboxOriginal}</summary>
        <div
          style={{
            fontSize: 13.5, color: C.faint, background: C.paper, borderRadius: 10,
            padding: 10, marginTop: 6, lineHeight: 1.8,
          }}
        >
          <span style={LATIN} dir="auto">{item.tab}</span> · <span style={LATIN}>{`#${item.rowHint}`}</span>
        </div>
      </details>
    </div>
  );
}
