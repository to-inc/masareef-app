import { C, FONT_DISPLAY, NUMERALS, TAP } from '../theme.js';
import { CATEGORIES, CASH_QUICK } from '../lib/constants.js';
import { METHODS } from '../state/entryPayload.js';
import { S } from '../i18n/strings.js';
import { normalizeDigits } from '../lib/format.js';
import { SectionLabel, LATIN } from '../components/Primitives.jsx';

/**
 * The manual entry screen (was CashView).
 *
 * Cash is ~20% of his spending and completely invisible to the bank SMS, so this
 * keypad is the only way those entries ever exist. Amount first, then category:
 * two decisions, nothing else on screen.
 *
 * IT IS NO LONGER CASH-ONLY (R-receipts finding 1, from his 2026-08-12
 * walkthrough): "it's not always cash". Since D18c he is abroad, where a card
 * purchase sends no Arabic SMS and therefore never logs itself — so the method
 * became a THIRD decision, and it sits above the amount because it changes what
 * the number means before he types it.
 *
 * The chooser renders from `METHODS`, the wire vocabulary, and looks its label
 * up per option. The label is never the value — see state/entryPayload.js for
 * the column-swap that arrangement exists to make impossible.
 */
export default function EntryView({
  amount, setAmount, desc, setDesc, cat, setCat, method, setMethod, onSubmit, busy,
}) {
  const press = (k) => {
    if (k === '⌫') return setAmount(amount.slice(0, -1));
    if (k === '.' && amount.includes('.')) return;
    if (amount.length > 8) return;
    // He may have an Arabic-Indic keyboard; the sheet only ever sees Western digits.
    setAmount(amount + normalizeDigits(k));
  };
  const ready = amount && parseFloat(amount) > 0 && cat && !busy;
  const methodLabel = (m) => (m === 'Visa' ? S.methodCard : S.methodCash);

  return (
    <div>
      <SectionLabel>{S.entryTitle}</SectionLabel>

      <div style={{ display: 'flex', gap: 8, margin: '2px 0 12px' }} role="group" aria-label={S.entryMethod}>
        {METHODS.map((m) => (
          <button
            key={m}
            className="catchip"
            onClick={() => setMethod(m)}
            aria-pressed={method === m}
            style={{
              flex: 1, minHeight: TAP, padding: '13px 0', borderRadius: 12,
              fontSize: 16.5, fontWeight: 700,
              background: method === m ? C.harbor : C.card,
              color: method === m ? C.onDark : C.ink,
              border: `1px solid ${method === m ? C.harbor : C.line}`,
            }}
          >
            {methodLabel(m)}
          </button>
        ))}
      </div>

      <div
        style={{
          textAlign: 'center', fontFamily: FONT_DISPLAY, ...NUMERALS, fontSize: 46, fontWeight: 650,
          color: amount ? C.ink : C.line, padding: '6px 0 2px',
        }}
        dir="ltr"
      >
        {amount || '0'} <span style={{ fontSize: 18, color: C.muted }}>{S.currency}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, margin: '8px 0 14px' }} dir="ltr">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((k) => (
          <button
            key={k}
            className="catchip"
            onClick={() => press(k)}
            aria-label={k === '⌫' ? 'مسح' : k}
            style={{
              padding: '15px 0', minHeight: 56, fontSize: 23, fontWeight: 600,
              borderRadius: 12, background: C.card, border: `1px solid ${C.line}`, color: C.ink,
            }}
          >
            {k}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {CASH_QUICK.map((q) => (
          <button
            key={q.label}
            className="quickchip"
            onClick={() => {
              setDesc(q.label);
              if (q.category) setCat(q.category);
            }}
            style={{
              padding: '10px 14px', minHeight: TAP, borderRadius: 999, fontSize: 14,
              background: desc === q.label ? C.line : 'transparent',
              border: `1px solid ${desc === q.label ? C.harbor : C.line}`,
              color: desc === q.label ? C.harbor : C.ink,
              fontWeight: 600, ...LATIN,
            }}
            dir="auto"
          >
            {q.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {CATEGORIES.slice(0, 12).map((c) => (
          <button
            key={c}
            className="catchip"
            onClick={() => setCat(c)}
            aria-pressed={cat === c}
            style={{
              padding: '12px 15px', minHeight: TAP, borderRadius: 999, fontSize: 15.5, fontWeight: 600,
              background: cat === c ? C.harbor : C.card,
              color: cat === c ? C.onDark : C.ink,
              border: `1px solid ${cat === c ? C.harbor : C.line}`,
              ...LATIN,
            }}
            dir="auto"
          >
            {c}
          </button>
        ))}
      </div>

      <button
        className="bigbtn"
        disabled={!ready}
        onClick={onSubmit}
        style={{
          marginTop: 16, width: '100%', minHeight: 58, padding: '16px 0', borderRadius: 14,
          background: ready ? C.amber : C.line,
          color: ready ? C.amberInk : C.ink,
          fontSize: 18.5, fontWeight: 700,
        }}
      >
        {busy ? S.saving : <>✓ {S.entryLog}{amount ? <> · <span style={LATIN}>{amount}</span> {S.currency}</> : null}</>}
      </button>
    </div>
  );
}
