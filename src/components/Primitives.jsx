import { C, FONT_DISPLAY } from '../theme.js';

/**
 * Category names, merchant names and amounts are Latin text living inside an RTL
 * document. Without isolation the bidi algorithm reorders them against
 * neighbouring Arabic — "Water. Recharge" can render with the dot leading, and
 * "12.5 EUR" can flip. `unicode-bidi: isolate` + dir="auto" pins each run.
 */
export const LATIN = { unicodeBidi: 'isolate', direction: 'ltr', display: 'inline-block' };

export function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 14, fontWeight: 600, color: C.faint, margin: '2px 2px 12px', letterSpacing: '.01em' }}>
      {children}
    </div>
  );
}

export function Chip({ kind, small, label }) {
  const isVisa = kind === 'Visa';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: small ? '3px 9px' : '4px 12px',
        borderRadius: 999,
        fontSize: small ? 12 : 13,
        fontWeight: 700,
        background: isVisa ? C.visaBg : C.cashBg,
        color: isVisa ? C.visa : C.cash,
        justifySelf: 'start',
        whiteSpace: 'nowrap',
      }}
    >
      {label || kind}
    </span>
  );
}

export function Delta({ now, prev }) {
  if (!prev) return null;
  const pct = Math.round(((now - prev) / prev) * 100);
  if (!isFinite(pct)) return null;
  const up = pct > 0;
  return (
    <span
      style={{
        fontSize: 11.5,
        fontWeight: 700,
        color: up ? C.danger : C.confirm,
        background: up ? '#F7E6E2' : '#E3F1E9',
        borderRadius: 999,
        padding: '1px 7px',
        marginInlineStart: 6,
        verticalAlign: 'middle',
        whiteSpace: 'nowrap',
        ...LATIN,
      }}
    >
      {up ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  );
}

export function TabButton({ active, onClick, label, icon, badge, big }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      style={{
        flex: 1,
        padding: '10px 0 12px',
        minHeight: 56,
        background: 'transparent',
        color: active ? C.nile : C.faint,
        position: 'relative',
      }}
    >
      <div
        style={
          big
            ? {
                width: 50, height: 50, margin: '-18px auto 2px', borderRadius: 999,
                background: C.brass, color: '#fff', fontSize: 32, lineHeight: '48px',
                fontWeight: 600, boxShadow: '0 6px 16px rgba(184,146,59,.45)',
              }
            : { fontSize: 21, marginBottom: 2 }
        }
      >
        {icon}
      </div>
      <div style={{ fontSize: 13.5, fontWeight: active ? 700 : 500 }}>{label}</div>
      {badge ? (
        <span
          style={{
            position: 'absolute', top: 6, insetInlineEnd: '24%',
            background: C.danger, color: '#fff', fontSize: 11, fontWeight: 700,
            borderRadius: 999, padding: '1px 7px', ...LATIN,
          }}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export function Toast({ message }) {
  if (!message) return null;
  return (
    <div
      className="toast-in"
      role="status"
      style={{
        position: 'fixed',
        bottom: `calc(96px + env(safe-area-inset-bottom))`,
        left: '50%',
        transform: 'translateX(-50%)',
        background: C.confirm,
        color: '#fff',
        padding: '13px 24px',
        borderRadius: 999,
        fontSize: 16.5,
        fontWeight: 600,
        boxShadow: '0 8px 24px rgba(31,122,77,.4)',
        whiteSpace: 'nowrap',
        zIndex: 40,
      }}
    >
      {message}
    </div>
  );
}

// Calm amber, never red, never a modal — losing signal in Cairo is normal and
// his data is still on screen.
export function OfflineBanner({ text }) {
  return (
    <div
      style={{
        background: C.warnBg,
        color: '#7A5B12',
        border: `1px solid ${C.brassSoft}`,
        borderRadius: 12,
        padding: '10px 14px',
        fontSize: 14.5,
        fontWeight: 600,
        marginBottom: 12,
        textAlign: 'center',
      }}
    >
      {text}
    </div>
  );
}

export function BigAmount({ amount, currency, size = 30 }) {
  return (
    <div style={{ fontFamily: FONT_DISPLAY, fontSize: size, fontWeight: 650, color: C.ink, ...LATIN }}>
      {amount}
      {currency ? <span style={{ fontSize: size * 0.5, color: C.faint, fontWeight: 500 }}> {currency}</span> : null}
    </div>
  );
}
