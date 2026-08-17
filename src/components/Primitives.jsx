import { C, METHOD, DIVIDER, FONT_DISPLAY, NUMERALS, TAP } from '../theme.js';
import { S, SWITCH_TO } from '../i18n/strings.js';
import { getLang, setLang, otherLang } from '../state/lang.js';

/**
 * Category names, merchant names and amounts are Latin text living inside an RTL
 * document. Without isolation the bidi algorithm reorders them against
 * neighbouring Arabic — "Water. Recharge" can render with the dot leading, and
 * "12.5 EUR" can flip. `unicode-bidi: isolate` + dir="auto" pins each run.
 */
export const LATIN = { unicodeBidi: 'isolate', direction: 'ltr', display: 'inline-block' };

/**
 * ISOLATION WITHOUT A DIRECTION — for a run whose script is not known in advance.
 *
 * `LATIN` pins a run to left-to-right, which is right for a frozen category value
 * or an amount and WRONG for anything that might be Arabic. The repeats row
 * (finding A3) is exactly that case: it holds his own descriptions, which are
 * Arabic, beside the hand-written presets, which are Latin. Wrapping both in
 * `LATIN` forced «قهوة» to render left-to-right and collapsed the space between
 * it and its amount — «قهوة60».
 *
 * Pair with `dir="auto"` so the browser picks the direction from the first
 * strong character of each run, while `isolate` still stops that run from
 * reordering its neighbours.
 */
export const ISOLATE = { unicodeBidi: 'isolate', display: 'inline-block' };

/**
 * The language switch (D16b) — one tap, and it is ALWAYS labelled in the
 * language it switches TO. He never has to read the language he is stuck in to
 * find his way out of it, which is the whole failure mode of a toggle labelled
 * "Language".
 *
 * It reloads. `S` is resolved once at module load (see i18n/strings.js), so a
 * reload is what re-imports the other locale — and it cannot leave half the
 * screen in the old language, which a partial re-render can. One second, from
 * the service worker's cache, for a setting he changes about once.
 */
export function LangToggle({ subtle }) {
  const flip = () => {
    setLang(otherLang(getLang()));
    if (typeof location !== 'undefined') location.reload();
  };
  return (
    <button
      onClick={flip}
      lang={otherLang(getLang())}
      style={{
        minHeight: 32, padding: '4px 12px', borderRadius: 999,
        background: 'transparent',
        border: `1px solid ${subtle ? C.line : 'rgba(255,255,255,.45)'}`,
        color: subtle ? C.ink : '#fff',
        fontSize: 13, fontWeight: 700, opacity: subtle ? 1 : 0.9,
      }}
    >
      {SWITCH_TO}
    </button>
  );
}

/**
 * The manual refresh (D16c).
 *
 * A BUTTON, at the senior tap floor, on every data screen — never a pull
 * gesture. Nothing in this app may be reachable only by a movement he has to
 * already know about.
 *
 * The spinner is the REAL fetch: `busy` comes from the promise, not a timer, so
 * it says "working" for exactly as long as the work takes. A `failed` press
 * turns the button, and — the part that matters — leaves «آخر تحديث» exactly
 * where it was. See state/refresh.js: a refresh that failed must never look like
 * one that succeeded.
 */
export function RefreshButton({ state, onPress }) {
  const busy = state === 'busy';
  const failed = state === 'failed';
  return (
    <button
      onClick={onPress}
      disabled={busy}
      aria-label={busy ? S.refreshing : S.refresh}
      aria-busy={busy ? 'true' : undefined}
      style={{
        minHeight: TAP, minWidth: TAP, borderRadius: 999,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent',
        border: `1px solid ${failed ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.45)'}`,
        color: '#fff', fontSize: 17, fontWeight: 700,
        opacity: busy ? 0.6 : 1,
      }}
    >
      <span className={busy ? 'spin' : undefined} style={{ display: 'inline-block', lineHeight: 1 }}>
        {failed ? '↻!' : '↻'}
      </span>
    </button>
  );
}

export function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 14, fontWeight: 600, color: C.muted, margin: '2px 2px 12px',
      letterSpacing: '.01em', ...DIVIDER,
    }}>
      {children}
    </div>
  );
}

export function Chip({ kind, small, label }) {
  const skin = METHOD[kind] || METHOD.Cash;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: small ? '3px 9px' : '4px 12px',
        borderRadius: 999,
        fontSize: small ? 12 : 13,
        fontWeight: 700,
        background: skin.bg,
        color: skin.fg,
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
        color: up ? C.conflictInk : C.settledInk,
        background: up ? C.conflictBg : C.settledBg,
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
        color: active ? C.harbor : C.muted,
        position: 'relative',
      }}
    >
      <div
        style={
          big
            ? {
                width: 50, height: 50, margin: '-18px auto 2px', borderRadius: 999,
                background: C.harbor, color: C.onDark, fontSize: 32, lineHeight: '48px',
                fontWeight: 600, boxShadow: '0 6px 16px rgba(62,124,166,.42)',
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
            background: C.conflictInk, color: C.onDark, fontSize: 11, fontWeight: 700,
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
        background: C.harbor,
        color: C.onDark,
        padding: '13px 24px',
        borderRadius: 999,
        fontSize: 16.5,
        fontWeight: 600,
        boxShadow: '0 8px 24px rgba(62,124,166,.38)',
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
        background: C.sand,
        color: C.ink,
        border: `1px solid ${C.line}`,
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
    <div style={{ fontFamily: FONT_DISPLAY, fontSize: size, fontWeight: 650, color: C.ink, ...LATIN, ...NUMERALS }}>
      {amount}
      {currency ? <span style={{ fontSize: size * 0.5, color: C.muted, fontWeight: 500 }}> {currency}</span> : null}
    </div>
  );
}
