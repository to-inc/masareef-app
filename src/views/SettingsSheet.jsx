import { useState } from 'react';
import { C, FONT_DISPLAY, RADIUS, SPACE, TAP, TYPE, ICON } from '../theme.js';
import { S } from '../i18n/strings.js';
import { Sheet, LangToggle, CurrencyToggle, SectionLabel } from '../components/Primitives.jsx';
import { otherDisplayCurrency } from '../state/display.js';
import { METHODS } from '../state/entryPayload.js';
import { getDefaultMethod, setDefaultMethod } from '../state/settings.js';

/**
 * S1 — THE SETTINGS SHEET BEHIND THE COG (Owner field ruling 2026-08-27).
 *
 * ——— WHY IT EXISTS. The header had become a shelf: the language switch and
 * the display-currency toggle sat in the footer of every tab, two controls a
 * person changes about once, spending screen on every screen to serve a
 * moment that almost never comes. The Owner's ruling declutters the header to
 * date · cog · refresh and gives the once-in-a-while controls a HOME — a
 * sheet, one tap away, on every tab.
 *
 * ——— WHAT MOVED, AND WHAT DID NOT. The controls themselves are the
 * Primitives' own `LangToggle` and `CurrencyToggle`, imported — not copies.
 * Their contracts are untouched by the move:
 *   · the language switch still reloads, because `S` is resolved once at
 *     module load (state/lang.js says why that is the right trade);
 *   · the display currency still flips the Book's lead unit INSTANTLY, no
 *     reload, persisted in `masareef.display.currency` (N1b's law verbatim).
 *     It REORDERS figures the payload already carries and cannot express a
 *     rate — emphasis, never arithmetic (state/display.js).
 * The two stay independent siblings (D23): an Arabic reader may read in
 * euros, and an English one in pounds. The Owner ruled against coupling them.
 *
 * ——— THE DRESS. B4's one Sheet primitive, in the MonthSheet's exact wrapper
 * grammar: a backdrop button honestly labelled (the whole page behind the
 * sheet is the way out), a positioning wrapper that clips the lip square at
 * the screen's bottom edge, and the RADIUS.sheet lip + pinned entrance +
 * reduced-motion instant that belong to the primitive. Named sections only
 * for settings that EXIST — currency & language (S1), and the default method
 * (S2, the Owner's 2026-08-27 ruling); inventing chrome for future ones
 * would be furniture for rooms not built.
 *
 * ——— AND AN EXPLICIT WAY OUT. The month picker closes by backdrop alone;
 * a SETTINGS surface is rarer and less self-evident, so beside the labelled
 * backdrop there is a visible close button he can read. Two exits, one verb.
 */

/**
 * THE COG — the header's quiet door. It mirrors RefreshButton's dress exactly
 * (same floor, same rim, same ground) because the two stand shoulder to
 * shoulder on harbor: a second grammar one button over would read as a
 * different kind of thing, and it is not — both are chrome, neither is amber.
 * The one warm action stays the keypad's (theme.js's one-amber law).
 */
export function SettingsCog({ onOpen }) {
  return (
    <button
      onClick={onOpen}
      aria-label={S.settingsTitle}
      aria-haspopup="dialog"
      style={{
        minHeight: TAP, minWidth: TAP, borderRadius: RADIUS.capsule,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent',
        border: '1px solid rgba(255,255,255,.45)',
        color: '#fff', fontSize: ICON.control, fontWeight: 700,
      }}
    >
      {/**
        * The glyph is a PICTURE at ICON.control (not TYPE — theme.js's
        * positive declaration), and it is decoration: the button's name is
        * the aria-label above, in his language. U+FE0E pins the gear to TEXT
        * presentation — without it iOS paints the emoji cog, a grey machine
        * part in a header that owns exactly two inks.
        */}
      <span aria-hidden style={{ display: 'inline-block', lineHeight: 1 }}>⚙︎</span>
    </button>
  );
}

export default function SettingsSheet({ displayCurrency, onFlipCurrency, onClose }) {
  /**
   * S2 — the DEFAULT METHOD (06 §3.10.3). Owned HERE rather than threaded
   * from the shell: the language toggle already set the precedent (a control
   * that owns its own persisted preference), and nothing else in the app
   * re-renders on this value — EntryView reads it fresh at each visit through
   * `entryDefaultMethod`. State and storage move together through the one
   * setter, which also coerces (a label can never be stored as the value).
   */
  const [defaultMethod, setDefaultMethodState] = useState(() => getDefaultMethod());
  const methodLabel = (m) => (m === 'Visa' ? S.methodCard : S.methodCash);
  return (
    <>
      {/* The way out: the whole page behind the sheet, honestly labelled. */}
      <button
        onClick={onClose}
        aria-label={S.settingsClose}
        style={{ position: 'fixed', inset: 0, zIndex: 44, background: 'transparent', cursor: 'default' }}
      />
      {/**
        * The wrapper only POSITIONS AND CLIPS (MonthSheet's pattern, which is
        * the Toast's: the sheet motion animates `transform`, so positioning
        * must not). RADIUS.sheet lip above, square below — the surface runs
        * one lip-depth past the wrapper's bottom and the clip squares it, so
        * the lip shows exactly where a lip means something.
        */}
      <div
        style={{
          position: 'fixed', insetInline: 0, bottom: 0, zIndex: 45,
          borderRadius: `${RADIUS.sheet}px ${RADIUS.sheet}px 0 0`,
          overflow: 'hidden',
        }}
      >
        <Sheet
          role="dialog"
          aria-label={S.settingsTitle}
          style={{
            background: C.card, border: `1px solid ${C.line}`,
            padding: `6px ${SPACE.gutter}px calc(${SPACE.cardPad}px + env(safe-area-inset-bottom, 0px) + ${RADIUS.sheet}px)`,
            marginBottom: -RADIUS.sheet,
            maxHeight: '70vh', overflowY: 'auto',
            // The lift off the page — an ink-tinted veil, no new hue (§3);
            // the MonthSheet's own, verbatim.
            boxShadow: '0 -12px 32px rgba(44, 67, 86, 0.18)',
          }}
        >
          {/* The title row: what this surface is, and the readable way out. */}
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: SPACE.gap, padding: '10px 0 2px',
            }}
          >
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: TYPE.section, fontWeight: 650, color: C.ink }}>
              {S.settingsTitle}
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

          {/* ═══ the ONE named section — currency & language ═══ */}
          <div style={{ marginTop: SPACE.gap }}>
            <SectionLabel>{S.settingsLangCurrency}</SectionLabel>

            {/* The language switch — same contract it has today (it reloads;
                state/lang.js owns the why). Row label + the primitive. */}
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: SPACE.gap, minHeight: TAP,
              }}
            >
              <span style={{ fontSize: TYPE.row, color: C.ink }}>{S.settingsLanguage}</span>
              <LangToggle subtle />
            </div>

            {/* The display currency — N1b's control, mount moved, law intact:
                flips the lead unit in place, persisted per install. */}
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: SPACE.gap, minHeight: TAP, marginTop: 2,
              }}
            >
              <span style={{ fontSize: TYPE.row, color: C.ink }}>{S.settingsCurrency}</span>
              <CurrencyToggle
                value={displayCurrency}
                other={otherDisplayCurrency(displayCurrency)}
                onFlip={onFlipCurrency}
                subtle
              />
            </div>

            {/**
              * The quiet caption — TYPE.label, NOT caption(13): ruling 2
              * reserves 13 for annotations that DUPLICATE information shown
              * elsewhere, and this sentence is the ONLY place the control's
              * meaning is stated. Muted is quiet enough; small would be
              * unreadable, which is a different thing.
              */}
            <div
              style={{
                fontSize: TYPE.label, color: C.muted, lineHeight: 1.45,
                margin: '4px 0 2px',
              }}
            >
              {S.settingsCurrencyNote}
            </div>
          </div>

          {/* ═══ S2 — the default method (06 §3.10.3) ═══ */}
          <div style={{ marginTop: SPACE.gap }}>
            {/**
              * MEANWHILE-LABEL: `entryMethod` («الدفع كان إزاي») names the
              * same concept the control defaults — a dedicated
              * `settingsDefaultMethod` key is this chunk's reported residual
              * (this leaf may not touch the locale files), and the swap is
              * one line when it lands.
              */}
            <SectionLabel>{S.entryMethod}</SectionLabel>
            {/**
              * The EntryView chooser's own grammar, verbatim: options from
              * METHODS (the wire vocabulary — also the sheet's columns),
              * labels looked up per option, harbor for the chosen one (the
              * one warm action stays the keypad's). The tap persists THROUGH
              * the setter so state and storage cannot disagree, and the
              * setter's coercion means no label ever becomes the value.
              */}
            <div style={{ display: 'flex', gap: SPACE.gap }} role="group" aria-label={S.entryMethod}>
              {METHODS.map((m) => (
                <button
                  key={m}
                  className="catchip"
                  onClick={() => setDefaultMethodState(setDefaultMethod(m))}
                  aria-pressed={defaultMethod === m}
                  style={{
                    flex: 1, minHeight: TAP, padding: '12px 0', borderRadius: RADIUS.row,
                    fontSize: TYPE.row, fontWeight: 700,
                    background: defaultMethod === m ? C.harbor : C.card,
                    color: defaultMethod === m ? C.onDark : C.ink,
                    border: `1px solid ${defaultMethod === m ? C.harbor : C.line}`,
                  }}
                >
                  {methodLabel(m)}
                </button>
              ))}
            </div>
          </div>
        </Sheet>
      </div>
    </>
  );
}
