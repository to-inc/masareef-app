import { useState } from 'react';
import { C, TAP, RADIUS, TYPE, GRADIENT, alpha, glass } from '../theme.js';
import { allCategories, shortCategories } from '../state/catOrder.js';
import { S, categoryLabel } from '../i18n/strings.js';
import { ISOLATE, LATIN } from './Primitives.jsx';

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
        fontSize: TYPE.body, fontWeight: 700,
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
  // Filed is NOT final: a logged card stays tappable so a mis-tap can be put
  // right where it happened (field report 2026-10-09: a card fee filed as
  // «Elect. Recharge» could not be changed). Only a write IN FLIGHT or queued
  // locks the buttons — a double-write is the thing to prevent, not a correction.
  const inert = !!outcome && (outcome.status === 'saving' || outcome.status === 'queued');
  const filed = !!outcome && outcome.status === 'done';

  // v4 P6: «غالبًا:» + ONE 64px guess, then «ولا…» + a 2×2 grid of 52px
  // alternatives — three categories and «more». Without a guess, the grid
  // simply leads. «more» unfolds the whole list in the same two columns.
  const rest = (showAll ? allCategories() : shortCategories()).filter((c) => c !== guess);
  const shown = showAll ? rest : rest.slice(0, guess ? 3 : 5);
  const label = (t) => <div style={{ fontSize: TYPE.label, color: C.muted, fontWeight: 600, margin: '18px 0 8px' }}>{t}</div>;
  return (
    <div style={{ opacity: inert ? 0.45 : 1 }}>
      {guess && !filed && label(S.reviewLikely)}
      {guess && !filed && (
        <button
          className="bigbtn"
          onClick={() => onPick(guess)}
          disabled={inert}
          style={{
            width: '100%', minHeight: 64, padding: '8px 0', borderRadius: RADIUS.row,
            background: GRADIENT.harbor, boxShadow: `0 8px 20px ${alpha(C.harbor, 0.3)}`, color: C.onDark,
            fontSize: TYPE.action, fontWeight: 700,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {/* Arabic label, with the frozen value underneath (finding M2) — seeing
              the two together is what lets him check the app against his sheet. */}
          <span>✓ {categoryLabel(guess)}</span>
          <span style={{ fontSize: TYPE.caption, fontWeight: 500, ...ISOLATE }} dir="auto">{guess}</span>
        </button>
      )}
      {label(filed ? S.recategorize : guess ? S.reviewOrElse : S.entryNeedCategory)}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {shown.map((c) => (
          <button
            key={c}
            className="catchip"
            onClick={() => onPick(c)}
            disabled={inert}
            style={{
              ...glass('chip'), borderRadius: RADIUS.glassWell, minHeight: 52, padding: '6px 10px',
              fontSize: TYPE.body, fontWeight: 600, color: C.ink, ...ISOLATE,
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
              minHeight: 52, borderRadius: RADIUS.glassWell, background: 'transparent',
              border: `1px dashed ${C.harbor}`, fontSize: TYPE.label, color: C.harborInk, fontWeight: 600,
            }}
          >
            {S.more}
          </button>
        )}
      </div>
    </div>
  );
}
