import { useState } from 'react';
import { C, TAP, RADIUS, TYPE } from '../theme.js';
import { CATEGORIES, SHORT_LIST } from '../lib/constants.js';
import { S, categoryLabel } from '../i18n/strings.js';
import { LATIN } from './Primitives.jsx';
import { needsHim } from '../state/inboxOutcomes.js';

/**
 * Choosing a category for a row that is ALREADY in his sheet, and saying what
 * became of the choice.
 *
 * ONE component, used by the Inbox card and by the Recent list. They are the
 * same act — tap a category, a cell in his sheet changes — and the moment there
 * are two of these there are two places for the outcome states to drift, two
 * places for the inert rule to be applied differently, and two chip grids whose
 * order can diverge. That is the two-normalizers hazard, and this file exists
 * specifically so it cannot happen here.
 *
 * NOT shared with ReceiptView's `CategoryChips`, deliberately: that one is a
 * SELECTION on a row that does not exist yet — it toggles, it floats the choice
 * to the front, and nothing is written until he confirms. Different semantics,
 * different component. Merging them would be the opposite mistake.
 */

/**
 * What became of his tap. Every word comes from the server's answer; `saving`
 * says only that the tap registered, because between the tap and the reply that
 * is the entire truth.
 */
export function OutcomeNote({ outcome }) {
  if (!outcome) return null;
  const s = outcome.status;

  const skin = {
    saving: { fg: C.ink, bg: C.shell, line: C.line },
    done: { fg: C.settledInk, bg: C.settledBg, line: C.settledLine },
    already: { fg: C.settledInk, bg: C.settledBg, line: C.settledLine },
    queued: { fg: C.ink, bg: C.sand, line: C.line },
    conflict: { fg: C.conflictInk, bg: C.conflictBg, line: C.conflictLine },
    failed: { fg: C.conflictInk, bg: C.conflictBg, line: C.conflictLine },
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
  // holds instead). Nothing is named where naming would assert something we do
  // not know.
  const named = s === 'done' ? outcome.category
    : s === 'conflict' ? outcome.sheetCategory
      : null;

  return (
    <div
      aria-live="polite"
      style={{
        marginTop: 12, minHeight: 44, borderRadius: RADIUS.row, padding: '11px 14px',
        background: skin.bg, color: skin.fg, border: `1px solid ${skin.line}`,
        fontSize: 15.5, fontWeight: 700,
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      }}
    >
      <span>{text}</span>
      {named && (
        <>
          {s === 'conflict' && <span style={{ fontWeight: 500 }}>{S.cardConflictIs}</span>}
          <span dir="auto">{categoryLabel(named)}</span>
        </>
      )}
    </div>
  );
}

/**
 * The green one-tap guess (when the server had one) and the chip grid.
 *
 * A row he has already dealt with keeps its buttons on screen but DEAD. Removing
 * them would be tidier and is wrong: in a batch the list would shorten under his
 * thumb between the tap and the next reach, and he would land on a row he never
 * meant to touch. Height stays constant; only the colour changes.
 */
export function CategoryActions({ guess, outcome, onPick }) {
  /**
   * SIX AND «أنواع تانية…» IN BOTH CASES (finding S7).
   *
   * This used to be `useState(!guess)` — no guess meant the card opened with all
   * twenty-seven categories. The intent was right (D5: never show him a green
   * button we are not sure of, so make him choose) but the execution inverted
   * the help: the card the app is LEAST sure about was the one that dropped a
   * wall of chips on him, pushing every other card off the screen. Measured on
   * the device, one un-guessed card is taller than the whole viewport.
   *
   * Six plausible options is a MENU, not a guess. D5 forbids asserting a
   * category we have not earned — it says nothing about how many we offer, and
   * the guessed card has always offered exactly this shortlist.
   */
  const [showAll, setShowAll] = useState(false);
  const inert = !needsHim(outcome);

  return (
    <>
      {guess && (
        <button
          className="bigbtn"
          onClick={() => onPick(guess)}
          disabled={inert}
          style={{
            marginTop: 12, width: '100%', minHeight: 56, padding: '10px 0',
            borderRadius: RADIUS.row, background: C.harbor, color: C.onDark,
            /**
             * TYPE.action (ruling 1): THIS is the site the token was ruled
             * for — the Inbox one-tap guess, the most-used tap in the app.
             * It shipped at 18.5; «stays ≥19» is not negotiable downward.
             */
            fontSize: TYPE.action, fontWeight: 700, opacity: inert ? 0.45 : 1,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {/* Arabic label, with the frozen value underneath in small type
              (finding M2). Both, on this button only: it is 56px tall, it is
              the tap he makes most, and seeing the two together is what lets
              him check the app against his own sheet during the changeover. */}
          <span>✓ {categoryLabel(guess)}</span>
          <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.72, ...LATIN }} dir="auto">{guess}</span>
        </button>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10, opacity: inert ? 0.45 : 1 }}>
        {(showAll ? CATEGORIES : SHORT_LIST)
          .filter((c) => c !== guess)
          .map((c) => (
            <button
              key={c}
              className="catchip"
              onClick={() => onPick(c)}
              disabled={inert}
              style={{
                padding: '11px 15px', minHeight: TAP, borderRadius: RADIUS.capsule,
                background: C.shell, border: `1px solid ${C.line}`,
                fontSize: TYPE.label, fontWeight: 500, color: C.ink, ...LATIN,
              }}
              dir="auto"
            >
              {categoryLabel(c)}
            </button>
          ))}
        {!showAll && (
          <button
            className="catchip"
            onClick={() => setShowAll(true)}
            disabled={inert}
            style={{
              padding: '11px 15px', minHeight: TAP, borderRadius: RADIUS.capsule,
              background: 'transparent', border: `1px dashed ${C.harbor}`,
              fontSize: TYPE.label, color: C.harbor, fontWeight: 600,
            }}
          >
            {S.more}
          </button>
        )}
      </div>
    </>
  );
}
