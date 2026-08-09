import { useState } from 'react';
import { C, DIVIDER, FONT_DISPLAY, NUMERALS, TAP } from '../theme.js';
import { S, monthByTab, CAPTAIN_INITIALS } from '../i18n/strings.js';
import { money } from '../lib/format.js';
import { LATIN } from './Primitives.jsx';
import { shouldShowLog, isDismissed, dismiss } from '../state/logCard.js';

/**
 * «سجل القبطان» — the closed month, handed up (W-6, contract 06 §2.2).
 *
 * On the first of the month the previous one is finished, and this says what it
 * came to: the total, the three largest categories, and — only if there were any
 * — the rows it could not fully account for. Then it signs off and, once he has
 * read it, it is gone for that month.
 *
 * WHAT IT IS NOT, and must never become: there is nothing to tap into, no
 * comparison with the month before, no "you spent more on X", no streak, no
 * target, no advice. It is a report to the captain. Everything in this file is
 * inert except the single «تمام», and adding a second interactive element would
 * change what the card IS.
 *
 * It also costs nothing: the data rides on the `summary` every screen already
 * fetches. The card never makes a request of its own, so it cannot slow the one
 * thing this app exists to keep under five seconds.
 */
export default function LogCard({ prevLog, todayCairo }) {
  /**
   * Read once, at mount. Re-reading storage on every render would let a write
   * from another tab flip the card out mid-sentence; this way the only thing
   * that removes it during a session is his own tap.
   */
  const [gone, setGone] = useState(() => isDismissed(todayCairo));

  if (!shouldShowLog(prevLog, todayCairo, gone)) return null;

  const line = { display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 8 };

  return (
    <section
      className="card-in"
      aria-label={S.logTitle(monthByTab(prevLog.name))}
      style={{
        background: C.card, border: `1px solid ${C.line}`, borderRadius: 18,
        padding: '18px 18px 14px', marginBottom: 16,
        boxShadow: '0 2px 10px rgba(17,38,29,.05)',
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 700, color: C.harbor }}>
        {S.logTitle(monthByTab(prevLog.name))}
      </div>

      {/* The figure the whole card exists to deliver. Serif, tabular, and the
          only thing on the screen at this size. */}
      <div style={{
        fontFamily: FONT_DISPLAY, fontSize: 40, fontWeight: 650, color: C.ink,
        marginTop: 6, ...LATIN, ...NUMERALS,
      }}>
        {money(prevLog.total)}
        <span style={{ fontSize: 17, color: C.muted, fontWeight: 500 }}> {S.logCurrency}</span>
      </div>

      {/* At most three, already ranked and filtered by the server. An empty
          `top` renders nothing at all rather than an empty-state sentence — a
          month with no categorised spending has nothing to list, and saying so
          would be filler. */}
      <div style={{ marginTop: 14 }}>
        {prevLog.top.map((c) => (
          <div key={c.name} style={line}>
            <span style={{ fontSize: 16, color: C.ink, ...LATIN }} dir="auto">{c.name}</span>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 650, color: C.ink, ...LATIN, ...NUMERALS }}>
              {money(c.amount)}
            </span>
          </div>
        ))}
      </div>

      {/**
        * HONEST INCOMPLETENESS, and ONLY when there is something to admit.
        *
        * A month with nothing missing says nothing about missing things — the
        * silence is the good news, and printing "0 مصاريف من غير تمن" would turn
        * a clean month into a line of noise he has to read and dismiss. When
        * they ARE nonzero the total above is knowably short, and the card is
        * required to say so (06 §2.2).
        */}
      {(prevLog.unpriced > 0 || prevLog.undated > 0) && (
        <div style={{ marginTop: 14, fontSize: 14, color: C.ink, lineHeight: 1.9 }}>
          {prevLog.unpriced > 0 && <div>{S.logUnpriced(prevLog.unpriced)}</div>}
          {prevLog.undated > 0 && <div>{S.logUndated(prevLog.undated)}</div>}
        </div>
      )}

      {/* The Morse beads — A O, the same two letters the icon carries in its
          geometry. A background, so nothing here is read aloud before the
          signature. */}
      <div style={{ ...DIVIDER, height: 4, marginTop: 18, paddingBottom: 0 }} />

      <div style={{ marginTop: 14, fontSize: 14.5, color: C.ink, lineHeight: 1.9 }}>
        <div style={{ fontWeight: 700 }}>{S.logTo(CAPTAIN_INITIALS)}</div>
        <div style={{ color: C.muted }}>{S.logSignoff}</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 12 }}>
        <button
          className="catchip"
          onClick={() => { dismiss(todayCairo); setGone(true); }}
          style={{
            minHeight: TAP, padding: '0 24px', borderRadius: 999,
            background: 'transparent', border: `1px solid ${C.line}`,
            color: C.ink, fontSize: 15.5, fontWeight: 600,
          }}
        >
          {S.logDismiss}
        </button>
      </div>
    </section>
  );
}
