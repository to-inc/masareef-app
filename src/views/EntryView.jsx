import { useState, useEffect } from 'react';
import {
  C, FONT_DISPLAY, NUMERALS, TAP, RADIUS, TYPE, SPACE, unitSize,
} from '../theme.js';
import { CATEGORIES, SHORT_LIST } from '../lib/constants.js';
import { repeatChips } from '../state/repeats.js';
import { isTravelling, toggleCurrency, HOME_CURRENCY } from '../state/travel.js';
import { METHODS } from '../state/entryPayload.js';
import { entryDefaultMethod } from '../state/settings.js';
import { S, categoryLabel } from '../i18n/strings.js';
import { normalizeDigits } from '../lib/format.js';
import { entryReady, dockState, pressKey } from '../state/entryDock.js';
import { SectionLabel, LATIN, ISOLATE, Rail } from '../components/Primitives.jsx';

/**
 * The manual entry screen (was CashView).
 *
 * Cash is ~20% of his spending and completely invisible to the bank SMS, so this
 * keypad is the only way those entries ever exist.
 *
 * IT IS NO LONGER CASH-ONLY (R-receipts finding 1, from his 2026-08-12
 * walkthrough): "it's not always cash". Since D18c he is abroad, where a card
 * purchase sends no Arabic SMS and therefore never logs itself.
 *
 * The chooser renders from `METHODS`, the wire vocabulary, and looks its label
 * up per option. The label is never the value — see state/entryPayload.js for
 * the column-swap that arrangement exists to make impossible.
 *
 * ——— UX REV, 2026-08-17 (findings S1–S5): the submit left the scroll and became
 * `EntryDock`, pinned by the shell; the quick chips came up top; the keypad gave
 * back 32px. All three were about one measured fact — at 375×812 the button that
 * ends the task sat 200px below the fold on the five-second screen.
 *
 * ——— DECOMPRESSION REV, Wave 3 (north-star §4.1, the Owner's GAP 1: «all very
 * cramped»). Three moves, each its own chunk:
 *
 *  N3 — «زي قبل كده» IS A CARD NOW, not a chip. His most recent complete entry
 *      (description + amount + category + method) stands at the top of the
 *      screen as one RADIUS.card button; one tap re-fills all four and the
 *      pinned dock still asks for the verb. When there is nothing to repeat —
 *      fresh install, or travelling where every remembered chip is EGP by
 *      construction — the card is ABSENT, never a dead control.
 *
 *  N4 — THE TOP CHIP ROW DIED. Say-it / currency / receipt are input MODES, not
 *      destinations, so they wait under the number as icon+word buttons. The
 *      amount capsule is this screen's hero; everything else orbits it.
 *
 *  N5 — THE SCREEN BREATHES IN SECTIONS. Two white RADIUS.card boxes on the
 *      shell — the number (rail, capsule, modes, keypad) and the row's words
 *      (method, category) — with SPACE-token gaps between them. The cramped
 *      single column was each site being locally reasonable and no two of them
 *      agreeing; the SPACE vocabulary is the agreement.
 */

/**
 * N3 — the repeat-last-entry action, as one complete card.
 *
 * IT DELEGATES THE FILL. The card and the rail chips must put the screen into
 * the same state or the two paths drift (the entryDock lesson: readiness stated
 * twice, in two dialects, disagreed on "0"). So this component carries no
 * setters of its own — it hands the whole entry to the one `fill` below.
 *
 * A CONTROL, SO IT KEEPS ITS EDGE. Plain cards lost their borders (A2 —
 * luminance carries elevation), but this card is a BUTTON, and theme.js's
 * doctrine keeps `line` on tappable things by name (the PriorityLens
 * precedent: a tappable disclosure stays bordered).
 *
 * THE AMOUNT IS PRINTED BEFORE IT IS TAPPED. Same honesty rule as the rail
 * chips: a prefilled figure must be on screen before his thumb commits to it,
 * and the unit is stated — every remembered entry is EGP by construction
 * (state/repeats.js refuses anything else), so the unit is the pound, named.
 */
function LikeBeforeCard({ entry, onFill }) {
  return (
    <button
      className="likecard catchip"
      onClick={() => onFill(entry)}
      style={{
        display: 'block', width: '100%', textAlign: 'start',
        minHeight: TAP, padding: SPACE.cardPad,
        background: C.card, borderRadius: RADIUS.card,
        border: `1px solid ${C.line}`, color: C.ink,
      }}
      dir="auto"
    >
      <span
        style={{
          display: 'block', fontSize: TYPE.label, fontWeight: 600,
          color: C.muted, marginBottom: 4,
        }}
      >
        {S.entryRepeats}
      </span>
      <span
        style={{
          display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap',
          fontSize: TYPE.row, fontWeight: 700,
        }}
      >
        {/* His own descriptions are Arabic; direction decided per run. */}
        <span style={ISOLATE} dir="auto">{entry.description}</span>
        <span style={{ whiteSpace: 'nowrap' }}>
          <span style={{ ...LATIN, ...NUMERALS }}>{entry.amount}</span>
          {' '}
          <span style={{ color: C.muted, fontWeight: 500 }}>{S.currencyName('EGP')}</span>
        </span>
        {entry.category ? (
          <span dir="auto" style={{ color: C.muted, fontWeight: 600 }}>
            {'· '}{categoryLabel(entry.category)}
          </span>
        ) : null}
      </span>
    </button>
  );
}

/**
 * N4 — one skin for the three mode buttons, stated once so the second and third
 * cannot drift from the first. `flex: 1` shares the row evenly; TYPE.label
 * keeps the words above the prose floor while staying visibly secondary to the
 * TYPE.hero number they sit under; TAP is the senior touch floor — demoted is a
 * place in the hierarchy, never a smaller target.
 */
const MODE_STYLE = {
  flex: 1, minHeight: TAP, padding: '0 10px', borderRadius: RADIUS.row,
  background: C.card, border: `1px solid ${C.line}`, color: C.ink,
  fontSize: TYPE.label, fontWeight: 600, whiteSpace: 'nowrap',
};

export default function EntryView({
  amount, setAmount, desc, setDesc, cat, setCat, method, setMethod, onCamera,
  currency = HOME_CURRENCY, setCurrency, onDictate,
}) {
  // Opened once, stays open for the visit. Collapsing it back under him between
  // entries is the shape-changing-while-you-reach problem the Inbox avoids too.
  const [showAll, setShowAll] = useState(false);
  /**
   * Read ONCE per visit to the screen, not on every render. The row must not
   * reshuffle under his thumb the moment he logs something — the same
   * shape-changing-while-you-reach rule the Inbox and the category grid follow.
   */
  const [allRepeats] = useState(() => repeatChips());
  /**
   * REPEATS ARE HIDDEN WHILE HE IS TRAVELLING — card and rail both. Every
   * remembered entry is EGP by construction (`remember` refuses anything else,
   * because the keypad is a pound keypad). Offering «قهوة 60» in euro mode
   * would prefill 60 into a field whose unit now reads «يورو» — writing a
   * sixty-EURO coffee into his book, with a ✓ over it.
   */
  const offered = isTravelling(currency) ? [] : allRepeats;
  /**
   * N3 — the card is his most recent COMPLETE entry: his own, amount included.
   * Presets (`repeatChips`'s fresh-install padding) carry `amount: null` by
   * design, so they can never be the card — a card that fills half the screen's
   * fields is the chip problem restated larger. The rail gets the rest, so one
   * entry never appears twice.
   */
  const last = offered.length && offered[0].amount != null ? offered[0] : null;
  const repeats = last ? offered.slice(1) : offered;
  // The keypad's rules live in state/entryDock.js so they can be stated once and
  // checked without a browser. `normalizeDigits` first: he may have an
  // Arabic-Indic keyboard, and the sheet only ever sees Western digits.
  const press = (k) => setAmount(pressKey(amount, normalizeDigits(k)));
  const methodLabel = (m) => (m === 'Visa' ? S.methodCard : S.methodCash);
  /**
   * THE ONE FILL, both callers (N3). The card and the rail chips put the screen
   * into the same state through the same function — two inline copies is how
   * the second quietly drifts (the readiness rule already paid for that once).
   * It FILLS, it does not submit: the pinned dock still states the whole row
   * and he still presses the verb.
   */
  const fill = (q) => {
    setDesc(q.description);
    if (q.category) setCat(q.category);
    if (q.method) setMethod(q.method);
    if (q.amount != null) setAmount(String(q.amount));
  };
  /**
   * S2 — THE PRE-CHOICE (06 §3.10.3). The chooser initializes from the ONE
   * rule in state/settings.js: the install's default method (shipped Card,
   * the Owner's ruling; Dad's install settable back to Cash), forced to Card
   * whenever the currency mode is not EGP — euro cash is not his life.
   *
   * MOUNT applies it only to a PRISTINE composition. The shell keeps this
   * screen's state across tab swaps, so he can leave mid-entry and come back;
   * re-applying the default over a method he already tapped would be the
   * shape-changing-while-you-reach problem, aimed at the one field that files
   * money into a column. (App.jsx still resets to the wire floor after a
   * write and clears the fields with it, so every NEW entry starts pristine
   * and takes the setting here.)
   */
  useEffect(() => {
    if (!amount && !desc && !cat) setMethod(entryDefaultMethod(currency));
    // Mount only: the default is an opening position, not a running rule.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  /**
   * ENTERING a non-EGP mode re-applies the rule — which answers Card away,
   * whatever the setting says. Keyed on the MODE, not on `method`: after the
   * force, a manual tap within the entry being composed stands (an effect
   * that watched `method` would un-tap him, and the S2 oracle pins that no
   * such dependency exists).
   */
  const travelling = isTravelling(currency);
  useEffect(() => {
    if (travelling) setMethod(entryDefaultMethod(currency));
    // The way HOME restores nothing: his EGP pre-choice is whatever stood
    // before the trip forced Card, and only his own tap moves it again.
  }, [travelling]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    /**
     * N5 — the screen is a column of boxed sections with ONE stated gap
     * (SPACE.cardPad, the 16–20px the north star names), ending on a
     * SPACE.section breath so the last chips never sit flush against the dock.
     */
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.cardPad, paddingBottom: SPACE.section }}>
      {/* N3 — the fastest complete action, first, when it honestly exists. */}
      {last && <LikeBeforeCard entry={last} onFill={fill} />}

      {/**
        * SECTION ONE — THE NUMBER. Rail of accelerators, the hero capsule, the
        * input modes, the keypad: everything that produces the amount, in one
        * white box (A2: no border, no shadow — luminance carries it).
        */}
      <section style={{ background: C.card, borderRadius: RADIUS.card, padding: SPACE.cardPad }}>
        {/**
          * The label only when the card is not already saying it: a second
          * «زي قبل كده» four lines under the first is a heading talking to a
          * heading. Travelling (no repeats at all) keeps the short title.
          */}
        {!last && (
          <SectionLabel>{repeats.length ? S.entryRepeats : S.entryTitleShort}</SectionLabel>
        )}
        {/**
          * ONE ROW, scrolled sideways — not a wrap (S2). These are ACCELERATORS:
          * his own last entries with their amounts (finding A3), padded with the
          * hand-written presets so a fresh install is never bare. A chip FILLS —
          * through the same `fill` as the card — it does not submit.
          */}
        {repeats.length > 0 && (
          <Rail style={{ gap: 7, marginBottom: SPACE.gap, paddingBottom: 2 }}>
            {repeats.map((q) => (
              <button
                key={`${q.description}|${q.method}`}
                className="quickchip"
                onClick={() => fill(q)}
                aria-pressed={desc === q.description}
                style={{
                  padding: '9px 14px', minHeight: TAP, borderRadius: RADIUS.capsule, fontSize: TYPE.label,
                  flex: '0 0 auto', whiteSpace: 'nowrap',
                  background: desc === q.description ? C.mist : C.card,
                  border: `1px solid ${desc === q.description ? C.harbor : C.line}`,
                  color: desc === q.description ? C.harbor : C.ink,
                  fontWeight: 600,
                }}
                dir="auto"
              >
                {/* His own descriptions are Arabic and the presets are Latin, so
                    the direction is decided per chip rather than forced. */}
                <span style={ISOLATE} dir="auto">{q.description}</span>
                {q.amount != null && (
                  <>
                    {' '}
                    <span style={{ color: C.muted, fontWeight: 500, ...LATIN, ...NUMERALS }}>
                      {q.amount}
                    </span>
                  </>
                )}
              </button>
            ))}
          </Rail>
        )}

        {/**
          * THE EMPTY AMOUNT IS `muted`, NOT `line` (finding S2) — the number is
          * this screen's one subject and must be visible before he types it.
          * TYPE.hero with its unit at unitSize(TYPE.hero) — the §3 anatomy.
          *
          * THE CAPSULE CONTAINER (A3's named pin, vis-F6): the number sits in a
          * soft full-round surface — RADIUS.capsule. Inside a white section the
          * luminance step INVERTS: the capsule is a shell-coloured well in the
          * card, the same one-step elevation grammar read the other way up.
          */}
        <div
          style={{
            textAlign: 'center', fontFamily: FONT_DISPLAY, ...NUMERALS, fontSize: TYPE.hero, fontWeight: 650,
            color: amount ? C.ink : C.muted, padding: '8px 16px',
            background: C.shell, borderRadius: RADIUS.capsule,
          }}
          dir="ltr"
        >
          {amount || '0'} <span style={{ fontSize: unitSize(TYPE.hero), color: C.muted }}>{S.currencyName(currency)}</span>
        </div>

        {/**
          * N4 — THE INPUT MODES, under the number they serve. Dictation (A5:
          * the keyboard's own mic, since Web Speech is broken in standalone),
          * the currency switch (A4: always visible, states the unit he is IN —
          * the 2026-08-25 ruling), and the receipt camera (M1: a receipt is a
          * way of making an entry, not a place). Icon PLUS word, each of them;
          * each offered only where its handler exists — a dead control is
          * worse here than none, because this row would make it look chosen.
          */}
        {(onDictate || setCurrency || onCamera) && (
          <div style={{ display: 'flex', gap: SPACE.gap, marginTop: SPACE.gap }}>
            {onDictate && (
              <button className="catchip" onClick={onDictate} style={MODE_STYLE}>
                {S.dictateShort}
              </button>
            )}
            {setCurrency && (
              <button
                className="catchip"
                onClick={() => setCurrency(toggleCurrency(currency))}
                aria-pressed={isTravelling(currency)}
                style={{
                  ...MODE_STYLE,
                  background: isTravelling(currency) ? C.harbor : C.card,
                  border: `1px solid ${isTravelling(currency) ? C.harbor : C.line}`,
                  color: isTravelling(currency) ? C.onDark : C.ink,
                }}
              >
                <span aria-hidden="true">💱</span> {S.currencyIn(currency)}
              </button>
            )}
            {onCamera && (
              <button className="catchip" onClick={onCamera} style={MODE_STYLE}>
                {S.receiptShort}
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: SPACE.gap }} dir="ltr">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((k) => (
            <button
              key={k}
              className="catchip"
              onClick={() => press(k)}
              aria-label={k === '⌫' ? S.keypadBackspace : k}
              style={{
                padding: '12px 0', minHeight: 50, fontSize: TYPE.section, fontWeight: 600,
                borderRadius: RADIUS.row, background: C.card, border: `1px solid ${C.line}`, color: C.ink,
              }}
            >
              {k}
            </button>
          ))}
        </div>
      </section>

      {/**
        * SECTION TWO — THE ROW'S WORDS: how he paid, and what it was. The
        * method chooser follows the number now (dockState asks for the amount
        * first, so the screen agrees with the dock's own order).
        */}
      <section style={{ background: C.card, borderRadius: RADIUS.card, padding: SPACE.cardPad }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: SPACE.gap }} role="group" aria-label={S.entryMethod}>
          {METHODS.map((m) => (
            <button
              key={m}
              className="catchip"
              onClick={() => setMethod(m)}
              aria-pressed={method === m}
              style={{
                flex: 1, minHeight: TAP, padding: '12px 0', borderRadius: RADIUS.row,
                fontSize: TYPE.row, fontWeight: 700,
                background: method === m ? C.harbor : C.card,
                color: method === m ? C.onDark : C.ink,
                border: `1px solid ${method === m ? C.harbor : C.line}`,
              }}
            >
              {methodLabel(m)}
            </button>
          ))}
        </div>

        {/**
          * SIX AND «أنواع تانية…», which is the shape the Inbox card already uses.
          *
          * It was `CATEGORIES.slice(0, 12)` — five rows, 272px, of which one row
          * cleared the fold. Six is two rows, it fits above the pinned button, and
          * the chosen one is always visible whichever list is showing. The full
          * twenty-seven are one tap away and stay open once opened.
          */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(showAll ? CATEGORIES : SHORT_LIST).map((c) => (
            <button
              key={c}
              className="catchip"
              onClick={() => setCat(cat === c ? null : c)}
              aria-pressed={cat === c}
              style={{
                padding: '11px 14px', minHeight: TAP, borderRadius: RADIUS.capsule, fontSize: TYPE.body, fontWeight: 600,
                background: cat === c ? C.harbor : C.card,
                color: cat === c ? C.onDark : C.ink,
                border: `1px solid ${cat === c ? C.harbor : C.line}`,
                ...LATIN,
              }}
              dir="auto"
            >
              {cat === c ? '✓ ' : ''}{categoryLabel(c)}
            </button>
          ))}
          {/**
            * The chosen category must never be hidden by the list it is not in. A
            * quick chip can set a category outside the six (Taqa → Elect. Recharge),
            * and «النوع» disappearing the moment he picks it is the P1 bug from the
            * receipt card, spelled on another screen.
            */}
          {!showAll && cat && SHORT_LIST.indexOf(cat) === -1 && (
            <button
              className="catchip"
              onClick={() => setCat(null)}
              aria-pressed
              style={{
                padding: '11px 14px', minHeight: TAP, borderRadius: RADIUS.capsule, fontSize: TYPE.body, fontWeight: 600,
                background: C.harbor, color: C.onDark, border: `1px solid ${C.harbor}`, ...LATIN,
              }}
              dir="auto"
            >
              ✓ {categoryLabel(cat)}
            </button>
          )}
          {!showAll && (
            <button
              className="catchip"
              onClick={() => setShowAll(true)}
              style={{
                padding: '11px 14px', minHeight: TAP, borderRadius: RADIUS.capsule, fontSize: TYPE.label,
                background: 'transparent', border: `1px dashed ${C.harbor}`,
                color: C.harborInk, fontWeight: 600,
              }}
            >
              {S.more}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * THE PINNED SUBMIT (finding S1) — rendered by the shell, not by the scroll.
 *
 * It lives in THIS file rather than in App.jsx for a reason the suite enforces:
 * the warm accent token is licensed at most ONCE PER VIEW FILE (Planner 4's
 * per-screen reading), and the reference below is this screen's once
 * (scripts/test-contrast.mjs counts them by name, so this sentence deliberately
 * does not spell it). The one warm action on this screen is the one that writes
 * a row to his book; moving the button to another file would have carried the
 * accent with it and quietly relicensed it for general use.
 *
 * ONE VERB, BOTH STATES (A9, north-star §4.1). The button's label is `S.entryLog`
 * and nothing else, in every state — resting, ready, even mid-save. A button that
 * narrates its precondition is a system talking; what changes between states is
 * the FILL and the INK (sand+muted resting → amber+rim ready), which is how a
 * physical control says «not yet» without changing what it is for.
 *
 * WHAT IT SAYS STILL MATTERS — it moved, it did not die. `dockState` names the
 * step he is missing and the STATUS LINE above the button states it («اكتب
 * المبلغ» → «اختار النوع»), so a resting button is never a puzzle about which of
 * two things is absent. When the entry is ready the same line echoes the whole
 * row — amount, currency, category — the last chance to notice a wrong category
 * before it is a row in his book. That line is where «جارٍ الحفظ…» lives too: a
 * write in flight is a fact about the ENTRY, not a new name for the button.
 */
export function EntryDock({ amount, cat, onSubmit, busy, currency = HOME_CURRENCY }) {
  const state = dockState({ amount, cat });
  const ready = entryReady({ amount, cat, busy });

  const status = busy ? S.saving
    : state === 'needAmount' ? S.entryNeedAmount
      : state === 'needCategory' ? S.entryNeedCategory
        : (
          <>
            <span style={LATIN}>{amount}</span> {S.currencyName(currency)}
            {' · '}<span dir="auto">{categoryLabel(cat)}</span>
          </>
        );

  return (
    <div
      style={{
        flexShrink: 0, padding: '8px 16px 12px', background: C.shell,
        borderTop: `1px solid ${C.line}`,
      }}
    >
      {/* The narration, beside the button — never on it. `aria-live` sits here
          because this is the text that changes; the verb below never does. */}
      <div
        aria-live="polite"
        style={{
          textAlign: 'center', fontSize: TYPE.label, color: C.muted,
          fontWeight: 600, marginBottom: 6, ...NUMERALS,
        }}
      >
        {status}
      </div>
      <button
        className="bigbtn"
        disabled={!ready}
        onClick={onSubmit}
        style={{
          width: '100%', minHeight: 58, padding: '14px 0', borderRadius: RADIUS.row,
          // Sand when resting — a control at rest, not furniture (`line` made
          // it read as a dead bar); muted ink on it clears 4.10:1 at
          // TYPE.action bold, above the 3:1 large-text floor.
          background: ready ? C.amber : C.sand,
          // The rim, not a darker fill — see theme.js `amberRim`. Amber's edge
          // against the cream shell is 2.10:1; WCAG 1.4.11 asks 3:1 of the
          // control's BOUNDARY, which is what this supplies without restating
          // the Owner's ruled accent.
          border: `1px solid ${ready ? C.amberRim : C.line}`,
          color: ready ? C.amberInk : C.muted,
          fontSize: TYPE.action, fontWeight: 700,
        }}
      >
        {S.entryLog}
      </button>
    </div>
  );
}

// Re-exported so a caller never writes its own copy of the readiness rule.
export { entryReady };
