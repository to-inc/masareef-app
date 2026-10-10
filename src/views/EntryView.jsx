import { useState, useEffect, useRef } from 'react';
import {
  C, FONT_DISPLAY, NUMERALS, TAP, RADIUS, TYPE, SPACE, unitSize, glass, GRADIENT, SELECTED_TINT, SHEET,
} from '../theme.js';
import { allCategories, shortCategories } from '../state/catOrder.js';
import { repeatChips } from '../state/repeats.js';
import { isTravelling, toggleCurrency, HOME_CURRENCY } from '../state/travel.js';
import { METHODS } from '../state/entryPayload.js';
import { entryDefaultMethod } from '../state/settings.js';
import { S, categoryLabel, unitFor } from '../i18n/strings.js';
import { normalizeDigits } from '../lib/format.js';
import { entryReady, pressKey } from '../state/entryDock.js';
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

export default function EntryView({
  amount, setAmount, desc, setDesc, cat, setCat, method, setMethod, onCamera, onReceiptFile = null,
  acceptPdf = false,   // the server reads PDF receipts (build.documents)
  currency = HOME_CURRENCY, setCurrency, onDictate, onClose = null,
  /**
   * The cash presets («Coffee · Car wash · Taqa · Talabat») are DAD'S Cairo habits
   * (CASH_QUICK). On a book kept in another unit they are a second, foreign row of
   * chips over the categories (Tarek, 2026-10-10: «one should only show»), so the
   * shell turns them off there; his own remembered entries still show.
   */
  presets = true,
}) {
  // Opened once, stays open for the visit. Collapsing it back under him between
  // entries is the shape-changing-while-you-reach problem the Inbox avoids too.
  const [showAll, setShowAll] = useState(false);
  /**
   * Read ONCE per visit to the screen, not on every render. The row must not
   * reshuffle under his thumb the moment he logs something — the same
   * shape-changing-while-you-reach rule the Inbox and the category grid follow.
   */
  const shotRef = useRef(null);   // the camera, opened from here
  const pickRef = useRef(null);   // Photos / Files
  const [allRepeats] = useState(() => repeatChips({ presets }));
  /**
   * REPEATS ARE HIDDEN WHILE HE IS TRAVELLING — card and rail both. Every
   * remembered entry is EGP by construction (`remember` refuses anything else,
   * because the keypad is a pound keypad). Offering «قهوة 60» in euro mode
   * would prefill 60 into a field whose unit now reads «يورو» — writing a
   * sixty-EURO coffee into his book, with a ✓ over it.
   */
  // Audit 2026-10-10: entries are remembered with their currency, so the row
  // offers exactly those in the unit on screen — a pound coffee never prefills
  // a euro field, and his euro entries repeat in euros.
  const offered = allRepeats.filter((r) => (r.currency || 'EGP') === (currency || 'EGP'));
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
    // Only a PRISTINE entry is forced: an undo restoring euro cash must not be
    // flipped back to Card behind his back (audit 2026-10-10).
    if (travelling && !amount && !desc) setMethod(entryDefaultMethod(currency));
    // The way HOME restores nothing: his EGP pre-choice is whatever stood
    // before the trip forced Card, and only his own tap moves it again.
  }, [travelling]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * v4 P4 (R17) — THE SHEET'S BODY, thumb-first, top to bottom:
   *   ✕ · the «زي امبارح» repeat chip
   *   the amount (68, with a harbor caret) · currency / mic / camera, 48px each
   *   cash | card in a pressed well · the category chips · the keypad
   * The amber «سجّل» is NOT here: EntryDock pins it at the safe-area bottom,
   * and it carries the amount and category, so no summary line is drawn.
   */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        {onClose ? (
          <button onClick={onClose} aria-label={S.settingsClose}
            style={{ minHeight: TAP, minWidth: TAP, borderRadius: RADIUS.capsule, background: 'transparent', color: C.muted, fontSize: TYPE.section }}>
            ✕
          </button>
        ) : <span />}
        {last ? (
          <button className="likecard catchip" onClick={() => fill(last)}
            style={{ ...glass('chip'), minHeight: TAP, padding: '0 16px 0 14px', display: 'flex', alignItems: 'center', gap: 8,
              color: C.ink, fontSize: TYPE.label, fontWeight: 600, maxWidth: '78%' }}>
            <span style={{ whiteSpace: 'nowrap' }}>{S.likeYesterday}:</span>
            <span style={{ ...ISOLATE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} dir="auto">{last.description}</span>
            <b style={{ ...LATIN, ...NUMERALS }}>{last.amount}</b>
          </button>
        ) : null}
      </div>

      {/* First visits have no «yesterday» — the quick descriptions stand in for it. */}
      {!last && repeats.length > 0 && (
        <Rail style={{ gap: 7, paddingBottom: 2 }}>
          {repeats.map((q) => (
            <button
              key={`${q.description}|${q.method}`}
              className="quickchip"
              // A second tap on the chosen chip lets it go (audit 2026-10-10).
              onClick={() => (desc === q.description ? setDesc('') : fill(q))}
              aria-pressed={desc === q.description}
              style={{
                ...glass('chip'), ...(desc === q.description ? { background: SELECTED_TINT } : null),
                padding: '0 14px', minHeight: TAP, fontSize: TYPE.label, flex: '0 0 auto', whiteSpace: 'nowrap',
                color: C.ink, fontWeight: desc === q.description ? 700 : 600,
              }}
              dir="auto"
            >
              <span style={ISOLATE} dir="auto">{q.description}</span>
              {q.amount != null && (<>{' '}<span style={{ color: C.muted, fontWeight: 500, ...LATIN, ...NUMERALS }}>{q.amount}</span></>)}
            </button>
          ))}
        </Rail>
      )}

      <div style={{ textAlign: 'center', padding: '2px 0' }}>
        <div
          data-amount
          // What the muted «0» SHOWS, said to VoiceOver in words.
          aria-label={amount ? undefined : S.entryNeedAmount}
          style={{ fontFamily: FONT_DISPLAY, ...NUMERALS, fontSize: TYPE.amountEntry, fontWeight: 650, lineHeight: 1, color: amount ? C.ink : C.muted }}
          dir="ltr"
        >
          {amount || '0'}
          {/* the harbor caret (v4 P4) — a 3px capsule */}
          <span aria-hidden style={{ display: 'inline-block', width: 3, height: '0.8em', background: C.harbor, marginLeft: 4, verticalAlign: '-0.05em', borderRadius: RADIUS.capsule }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
          {/* The unit IS this chip — every amount names its unit (v4); tapping it switches currency. */}
          <button
            className="catchip"
            onClick={setCurrency ? () => setCurrency(toggleCurrency(currency)) : undefined}
            disabled={!setCurrency}
            aria-pressed={isTravelling(currency)}
            aria-label={setCurrency ? S.currencyIn(toggleCurrency(currency)) : S.currencyName(currency)}
            style={{ ...glass('chip'), ...(isTravelling(currency) ? { background: SELECTED_TINT } : null),
              minHeight: TAP, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 6, color: C.ink, fontSize: TYPE.label, fontWeight: 700 }}
          >
            {unitFor(currency)}
            {setCurrency && <span aria-hidden style={{ color: C.muted }}>▾</span>}
          </button>
          {onDictate && (
            <button className="catchip" onClick={onDictate} aria-label={S.dictateShort}
              style={{ ...glass('chip'), minHeight: TAP, minWidth: TAP, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink }}>
              <MicIcon />
            </button>
          )}
          {/**
            * PHOTO and FILE, straight from here (Tarek, 2026-10-10: «much faster»).
            * The camera button opens the iPhone camera itself (`capture`); the file
            * button opens Photos/Files. Either hands the picture to the receipt
            * screen, which reads it at once. Without `onReceiptFile` (an older
            * shell) the camera button keeps opening the receipt screen.
            */}
          {onReceiptFile ? (
            <>
              <button className="catchip" onClick={() => shotRef.current && shotRef.current.click()} aria-label={S.receiptShort}
                style={{ ...glass('chip'), minHeight: TAP, minWidth: TAP, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink }}>
                <CameraIcon />
              </button>
              <button className="catchip" onClick={() => pickRef.current && pickRef.current.click()} aria-label={S.attachFile}
                style={{ ...glass('chip'), minHeight: TAP, minWidth: TAP, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink }}>
                <ClipIcon />
              </button>
              <input ref={shotRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) onReceiptFile(f); }} />
              {/* Several at once: they queue and read one after another (the To review photos bar). */}
              <input ref={pickRef} type="file" accept={acceptPdf ? 'image/*,application/pdf' : 'image/*'} multiple style={{ display: 'none' }}
                onChange={(e) => { const fs = Array.from(e.target.files || []); e.target.value = ''; if (fs.length) onReceiptFile(fs.length === 1 ? fs[0] : fs); }} />
            </>
          ) : onCamera && (
            <button className="catchip" onClick={onCamera} aria-label={S.receiptShort}
              style={{ ...glass('chip'), minHeight: TAP, minWidth: TAP, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.ink }}>
              <CameraIcon />
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', ...glass('well'), borderRadius: RADIUS.capsule, padding: 4, gap: 4 }} role="group" aria-label={S.entryMethod}>
        {METHODS.map((m) => (
          <button
            key={m}
            className="catchip"
            onClick={() => setMethod(m)}
            aria-pressed={method === m}
            style={{
              flex: 1, minHeight: TAP, fontSize: TYPE.body,
              ...(method === m ? glass('raised') : { background: 'transparent', borderRadius: RADIUS.capsule }),
              color: method === m ? C.ink : C.muted, fontWeight: method === m ? 700 : 600,
            }}
          >
            {methodLabel(m)}
          </button>
        ))}
      </div>

      {/* One swipeable row (the Rail's edge fade says it continues) — six wrapped
          chips made the sheet too tall for «0» to clear «سجّل» (the E-003 law).
          «كل الأنواع» unfolds the full list below as a wrapped grid. */}
      <Rail role="group" aria-label={cat ? categoryLabel(cat) : S.entryNeedCategory} style={{ gap: 8, paddingBottom: 2, flexWrap: showAll ? 'wrap' : 'nowrap' }}>
        {(showAll ? allCategories() : shortCategories()).concat(!showAll && cat && shortCategories().indexOf(cat) === -1 ? [cat] : []).map((c) => (
          <button
            key={c}
            className="catchip"
            onClick={() => setCat(cat === c ? null : c)}
            aria-pressed={cat === c}
            style={{
              ...glass('chip'),
              ...(cat === c ? { background: SELECTED_TINT, border: SHEET.pickedRim } : null),
              padding: '0 16px', minHeight: TAP, fontSize: TYPE.body, fontWeight: cat === c ? 700 : 600,
              color: C.ink, display: 'inline-flex', alignItems: 'center', flex: '0 0 auto', whiteSpace: 'nowrap', ...ISOLATE,
            }}
            dir="auto"
          >
            {cat === c ? '✓ ' : ''}{categoryLabel(c)}
          </button>
        ))}
        {!showAll && (
          <button
            className="catchip"
            onClick={() => setShowAll(true)}
            style={{
              padding: '0 14px', minHeight: TAP, borderRadius: RADIUS.capsule, fontSize: TYPE.label,
              background: 'transparent', border: `1px dashed ${C.harbor}`, color: C.harborInk, fontWeight: 600,
              flex: '0 0 auto', whiteSpace: 'nowrap',
            }}
          >
            {S.more}
          </button>
        )}
      </Rail>

      {/* R7: the keypad is a digit grid, so it is deliberately dir="ltr"; ⌫ sits bottom-right beside the digit it deletes. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }} dir="ltr">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((k) => (
          <button
            key={k}
            className="catchip key"
            onClick={() => press(k)}
            aria-label={k === '⌫' ? S.keypadBackspace : k}
            style={{
              ...glass('chip'), borderRadius: RADIUS.glassWell,
              minHeight: 56, fontSize: k === '⌫' ? TYPE.title : TYPE.key, fontWeight: 500,
              color: k === '⌫' ? C.muted : C.ink,
            }}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

/** v4 P4 — the mic and the camera, 22px stroke icons. Verbatim from the artboard. */
function MicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" focusable="false">
      <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
function ClipIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M20 11.5l-7.6 7.6a5 5 0 01-7.1-7.1l8.1-8.1a3.3 3.3 0 014.7 4.7l-8 8a1.7 1.7 0 01-2.4-2.4l7.3-7.3" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

/**
 * v4 P4 (R17) — THE AMBER «سجّل», pinned at the safe-area bottom of the sheet.
 * Ready, it REPEATS the amount and the category («سجّل 240 ج.م · Eating out»),
 * so the summary line that sat above it is gone (R17).
 * At rest — and while a write is in flight — it says only its verb (A9 stands:
 * a button never narrates its own precondition). What is missing is already on
 * the sheet: the muted «0», and no ✓ on any category.
 */
export function EntryDock({ amount, cat, onSubmit, busy, currency = HOME_CURRENCY }) {
  const ready = entryReady({ amount, cat, busy });
  return (
    <button
      className="bigbtn"
      disabled={!ready}
      onClick={onSubmit}
      aria-busy={busy ? 'true' : undefined}
      style={{
        width: '100%', minHeight: SHEET.saveHeight, borderRadius: RADIUS.capsule,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap',
        ...(ready
          ? { background: GRADIENT.amber, border: `1px solid ${C.amberRim}`, color: C.amberInk, boxShadow: SHEET.saveCast }
          : { ...glass('chip'), color: C.muted }),
        fontSize: TYPE.action, fontWeight: 700, ...NUMERALS,
      }}
    >
      {S.entryLog}
      {ready && (
        <span style={{ fontSize: TYPE.body, fontWeight: 600 }}>
          <span style={LATIN}>{amount}</span> {unitFor(currency)}{' · '}<span style={ISOLATE} dir="auto">{categoryLabel(cat)}</span>
        </span>
      )}
    </button>
  );
}

export { entryReady };
