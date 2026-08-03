import { C, FONT_DISPLAY, NUMERALS, TAP } from '../theme.js';
import { CATEGORIES, CASH_QUICK } from '../lib/constants.js';
import { S } from '../i18n/strings.js';
import { normalizeDigits } from '../lib/format.js';
import { SectionLabel, LATIN } from '../components/Primitives.jsx';

/**
 * Cash is ~20% of his spending and completely invisible to the bank SMS, so this
 * keypad is the only way those entries ever exist. Amount first, then category:
 * two decisions, nothing else on screen.
 */
export default function CashView({ amount, setAmount, desc, setDesc, cat, setCat, onSubmit, busy }) {
  const press = (k) => {
    if (k === '⌫') return setAmount(amount.slice(0, -1));
    if (k === '.' && amount.includes('.')) return;
    if (amount.length > 8) return;
    // He may have an Arabic-Indic keyboard; the sheet only ever sees Western digits.
    setAmount(amount + normalizeDigits(k));
  };
  const ready = amount && parseFloat(amount) > 0 && cat && !busy;

  return (
    <div>
      <SectionLabel>{S.cashTitle}</SectionLabel>

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
        {busy ? S.saving : <>✓ {S.cashLog}{amount ? <> · <span style={LATIN}>{amount}</span> {S.currency}</> : null}</>}
      </button>
    </div>
  );
}
