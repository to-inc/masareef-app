import { useState } from 'react';
import {
  C, FONT_DISPLAY, NUMERALS, TAP, RADIUS, TYPE, unitSize,
} from '../theme.js';
import { CATEGORIES, SHORT_LIST } from '../lib/constants.js';
import { repeatChips } from '../state/repeats.js';
import { isTravelling, toggleCurrency, HOME_CURRENCY } from '../state/travel.js';
import { METHODS } from '../state/entryPayload.js';
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
 * ——— UX REV, 2026-08-17 (findings S1–S5 of the design read).
 *
 * MEASURED ON THE DEVICE, not guessed: at 375×812 the body is 658px. The old
 * order — title, method, 46px amount, a 248px keypad, then eight quick chips,
 * then twenty-seven categories, then the submit button — put «سجّل المصروف»
 * roughly 200px BELOW the fold. On the one screen in this app whose entire
 * subject is the five-second law, the button that ends the task could not be
 * seen without scrolling past everything else.
 *
 * Three changes, and they are all about that one fact:
 *
 *  1. THE SUBMIT LEFT THE SCROLL. It is `EntryDock` now, rendered by the shell
 *     between <main> and the tab bar, so it is on screen from the first frame to
 *     the last. The missing step is still STATED rather than merely greyed —
 *     «اكتب المبلغ» → «اختار النوع» → «60 جنيه · أكل بره» — but since A9 it is
 *     stated on a quiet line BESIDE the button, never as the button's label:
 *     the button keeps one verb in every state (north-star §4.1).
 *
 *  2. THE QUICK CHIPS CAME UP TOP. They set the description AND the category in
 *     one tap, which makes them the fastest path on the screen; they were under
 *     the keypad, where the fastest path is not.
 *
 *  3. THE KEYPAD GAVE BACK 32px (56 → 50 per row, still above the 48 floor) and
 *     the amount is no longer painted in the BORDER colour when empty. Together
 *     with (1) that is what lifts the category row into view.
 */
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
   * THE REPEATS ROW IS HIDDEN WHILE HE IS TRAVELLING, and this is a correctness
   * fix rather than a layout one — caught by putting the screen in EUR mode.
   *
   * Every remembered chip is EGP by construction (`remember` refuses anything
   * else, because the keypad is a pound keypad). Offering «قهوة 60» in euro mode
   * would prefill 60 into a field whose unit now reads «يورو» — writing a sixty
   * EURO coffee into his book, with a ✓ over it. His Cairo habits are not his
   * Stockholm habits, and the accelerator for one is a trap in the other.
   *
   * It also gives back the 55px the currency strip costs, which is what keeps
   * the category chips above the fold abroad — the same fold S1 exists to fix.
   */
  const repeats = isTravelling(currency) ? [] : allRepeats;
  // The keypad's rules live in state/entryDock.js so they can be stated once and
  // checked without a browser. `normalizeDigits` first: he may have an
  // Arabic-Indic keyboard, and the sheet only ever sees Western digits.
  const press = (k) => setAmount(pressKey(amount, normalizeDigits(k)));
  const methodLabel = (m) => (m === 'Visa' ? S.methodCard : S.methodCash);

  return (
    <div>
      {/**
        * THE CAMERA LIVES HERE NOW (finding M1).
        *
        * «فاتورة» was one of five tabs and its entire content was one button on
        * an otherwise empty screen. A receipt is not a PLACE in this app — it is
        * a way of making an entry, exactly like the keypad below, so it belongs
        * on the screen where entries are made.
        *
        * Secondary weight on purpose: the keypad is the path he takes daily and
        * this is the one he takes holding a paper receipt. One obvious action per
        * screen still holds — this is the deliberate second, not a peer.
        */}
      {/**
        * THE FASTEST PATH, FIRST. One tap fills the description and — where the
        * mapping is genuinely unambiguous — the category too, leaving only the
        * amount. `CASH_QUICK` deliberately leaves some categories null (D5: never
        * a wrong guess), and those chips simply set the description.
        *
        * THE CAMERA SHARES THIS ROW, and that is a measurement rather than a
        * preference: as a full-width button of its own it cost 62px and pushed
        * the category chips back below the fold — undoing the thing S1 exists to
        * fix, to serve a path he takes weekly rather than hourly. On the label's
        * own line it costs nothing.
        */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <SectionLabel>{repeats.length ? S.entryRepeats : S.entryTitleShort}</SectionLabel>
        <span style={{ display: 'flex', gap: 7, marginBottom: 12, flex: '0 0 auto' }}>
          {/**
            * DICTATION (finding A5). Web Speech is verified broken in installed
            * standalone apps; the iOS keyboard's OWN microphone is not, because
            * keyboard dictation is just text input. This opens a plain field —
            * he taps the mic on his keyboard and says «٥٠ جنيه قهوة», and the
            * text goes to the same `voice` parser the Siri Shortcut has used
            * since Phase 1.
            */}
          {onDictate && (
            <button
              className="catchip"
              onClick={onDictate}
              style={{
                minHeight: 38, padding: '0 13px', borderRadius: RADIUS.capsule,
                background: C.card, border: `1px solid ${C.line}`, color: C.ink,
                fontSize: TYPE.label, fontWeight: 600, whiteSpace: 'nowrap',
              }}
            >
              {S.dictateShort}
            </button>
          )}
          {/**
            * THE CURRENCY BUTTON (finding A4, revised at Tarek's request).
            *
            * ALWAYS VISIBLE, and that is a bug fix rather than a preference. The
            * first version showed a currency strip only once he was already in a
            * foreign currency — so there was no way to turn travel mode ON from
            * the app at all. He asked for "a button that changes the entire
            * thing", and this is it: pounds ⇄ euros, one tap, from the screen
            * where the entry is made.
            *
            * It reads as the CURRENCY IT WILL SWITCH TO, not the one he is in —
            * the same rule as the language toggle. He never has to read the
            * state he is stuck in to find his way out of it.
            */}
          {setCurrency && (
            <button
              className="catchip"
              onClick={() => setCurrency(toggleCurrency(currency))}
              aria-pressed={isTravelling(currency)}
              style={{
                minHeight: 38, padding: '0 13px', borderRadius: RADIUS.capsule,
                background: isTravelling(currency) ? C.harbor : C.card,
                border: `1px solid ${isTravelling(currency) ? C.harbor : C.line}`,
                color: isTravelling(currency) ? C.onDark : C.ink,
                fontSize: TYPE.label, fontWeight: 600, whiteSpace: 'nowrap',
              }}
            >
              {S.currencyIn(currency)}
            </button>
          )}
          {onCamera && (
            <button
              className="catchip"
              onClick={onCamera}
              style={{
                minHeight: 38, padding: '0 13px', borderRadius: RADIUS.capsule,
                background: C.card, border: `1px solid ${C.line}`, color: C.ink,
                fontSize: TYPE.label, fontWeight: 600, whiteSpace: 'nowrap',
              }}
            >
              {S.receiptShort}
            </button>
          )}
        </span>
      </div>
      {/**
        * ONE ROW, scrolled sideways — not a wrap. Eight chips wrap to two rows and
        * cost 103px of a 584px body, which is the difference between one row of
        * categories clearing the fold and two. These are ACCELERATORS: the
        * complete path (keypad + the grid below) is unaffected by what is off the
        * right edge, and the same sideways pattern is already how he browses
        * months in «الأخير».
        */}
      <Rail style={{ gap: 7, marginBottom: 14, paddingBottom: 2 }}>
        {/**
          * HIS OWN LAST ENTRIES, WITH THEIR AMOUNTS (finding A3).
          *
          * `repeatChips()` returns what he actually logged, most recent first,
          * and pads with the hand-written presets so a fresh install is never
          * bare. A remembered chip fills the amount too — but it FILLS, it does
          * not submit: the pinned dock's status line reads «60 جنيه · أكل بره»
          * and he still presses the verb. The amount is printed on the chip so
          * the figure is on screen before he touches it.
          */}
        {repeats.map((q) => (
          <button
            key={`${q.description}|${q.method}`}
            className="quickchip"
            onClick={() => {
              setDesc(q.description);
              if (q.category) setCat(q.category);
              if (q.method) setMethod(q.method);
              if (q.amount != null) setAmount(String(q.amount));
            }}
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


      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }} role="group" aria-label={S.entryMethod}>
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
        * THE EMPTY AMOUNT IS `muted`, NOT `line` (finding S2). `C.line` is the
        * CARD BORDER colour — painting the screen's one subject in it made the
        * number effectively invisible until he had already typed it, on a screen
        * he opens precisely because he has a number in his head.
        */}
      {/**
        * TYPE.hero, and its unit at unitSize(TYPE.hero) — the §3 anatomy: serif
        * value, unit at 0.55× floored at the prose floor, on the same line. The
        * pre-token 46/18 pair is retired with the A9 rider; the number he is
        * typing is this screen's hero and takes the hero's own leading rules.
        */}
      {/**
        * THE CAPSULE CONTAINER (A3's named pin, vis-F6): the number he is
        * typing sits in a soft full-round surface — RADIUS.capsule — filled
        * like any plain card (A2: luminance, no border, no shadow).
        */}
      <div
        style={{
          textAlign: 'center', fontFamily: FONT_DISPLAY, ...NUMERALS, fontSize: TYPE.hero, fontWeight: 650,
          color: amount ? C.ink : C.muted, padding: '8px 16px',
          background: C.card, borderRadius: RADIUS.capsule,
        }}
        dir="ltr"
      >
        {amount || '0'} <span style={{ fontSize: unitSize(TYPE.hero), color: C.muted }}>{S.currencyName(currency)}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, margin: '6px 0 14px' }} dir="ltr">
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
              color: C.harbor, fontWeight: 600,
            }}
          >
            {S.more}
          </button>
        )}
      </div>
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
