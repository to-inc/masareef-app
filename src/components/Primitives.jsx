import { useState, useEffect, useRef } from 'react';
import { C, METHOD, DIVIDER, FONT_DISPLAY, FONT_UI, NUMERALS, TAP, RADIUS, ICON, unitSize } from '../theme.js';
import { S, SWITCH_TO, DIR } from '../i18n/strings.js';
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
        minHeight: 32, padding: '4px 12px', borderRadius: RADIUS.capsule,
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
 * A CHIP RAIL THAT SAYS IT CONTINUES (North Star §7 «peek affordance + edge
 * fade»; the Owner's GAP 2).
 *
 * ——— THE FAILURE IT FIXES. A horizontal rail whose last chip happens to land
 * flush at the edge is indistinguishable from a complete list. The categories
 * past the fold are then not merely hard to reach — as far as the screen is
 * concerned they do not exist, and he has no reason to try. Nothing about a
 * scrollbar helps: mobile hides it until you already scrolled.
 *
 * So the affordance is the content itself. The last visible chip is CLIPPED and
 * the edge dissolves into the shell, which is a picture of "there is more this
 * way" that needs no learning and no gesture hint.
 *
 * ——— THREE PROPERTIES THAT MUST AGREE, WHICH IS WHY THIS IS A COMPONENT.
 *
 * There are two rails today (the month browser, the repeat chips) and there
 * will be more. Copying snap + mask + direction into each is how the second one
 * quietly drifts from the first — the single most expensive recurring mistake
 * in this codebase. One rail, pinned by the suite, and the call sites carry no
 * `overflowX` of their own.
 *
 * ——— WHY `proximity` AND NOT `mandatory`, WHICH IS THE INTERESTING ONE.
 *
 * `mandatory` snapping pulls the nearest chip flush to the edge after every
 * flick — which is precisely the state this chunk exists to prevent. The rail
 * would keep re-tidying itself back into looking like a complete list, undoing
 * the peek between one scroll and the next. `proximity` snaps when he lands
 * near a chip and leaves a deliberate half-chip alone.
 *
 * ——— DIRECTION-AWARE, and the mask has no logical keyword to lean on.
 *
 * Content continues toward the inline END: the right edge in English, the LEFT
 * in Arabic. `mask-image` takes a physical direction, so it is chosen from the
 * active locale — the same trap the Morse divider hit, where a hardcoded
 * `bottom right` was correct in Arabic and hung off the end of the line in
 * English. Caught there by looking at the English screen; avoided here by
 * remembering that.
 */
export function Rail({ children, style, ...rest }) {
  /**
   * ——— THE FADE IS A CLAIM, SO IT IS DRAWN ONLY WHERE IT IS TRUE.
   *
   * An unconditional mask dissolves the trailing edge of a rail that does not
   * scroll: it tells him there is more when there is nothing, and it makes a
   * real, fully-reachable chip look disabled on its way out. That is the
   * honest-render law arriving at an AFFORDANCE rather than at a number — the
   * dissolve means «continues», so it may not appear where nothing does.
   *
   * CSS cannot ask whether a box overflows, so it is measured. On mount, and
   * again on resize: a rail that fits in Arabic may not fit in English, and one
   * that fits with the keyboard up may not with it down.
   */
  const ref = useRef(null);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setOverflows(el.scrollWidth > el.clientWidth + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    // Observes the rail AND its content: chips arrive asynchronously (his last
    // entries come from storage), so a mount-time measurement alone would
    // answer for an empty rail and never correct itself.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const child of el.children) ro.observe(child);
    return () => ro.disconnect();
  }, [children]);

  const fadeTo = DIR === 'rtl' ? 'left' : 'right';
  /**
   * 48px, and the width was MEASURED rather than chosen. At 28 the fade landed
   * almost entirely on the 7px inter-chip gap and the chip's rounded corner —
   * a region with nothing in it to dissolve — so the rail still read as a
   * complete list of four on a 375pt screen. The gradient has to bite into a
   * LABEL to say anything, because a word half-gone is the thing a person
   * recognises as "continues"; faded empty space is just empty space.
   */
  const fade = `linear-gradient(to ${fadeTo}, #000 calc(100% - 48px), transparent 100%)`;
  return (
    <div
      ref={ref}
      {...rest}
      style={{
        display: 'flex', overflowX: 'auto',
        scrollSnapType: 'x proximity',
        WebkitOverflowScrolling: 'touch',
        maskImage: overflows ? fade : undefined,
        WebkitMaskImage: overflows ? fade : undefined,
        /**
         * The fade eats 28px of the trailing edge, so the rail is padded by the
         * same amount on that side. Without it the last chip's own label
         * dissolves rather than the empty space after it, and a faded WORD
         * reads as disabled rather than as continuing.
         */
        paddingInlineEnd: overflows ? 48 : 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * THE DISPLAY-UNIT SWITCH (D23) — a sibling of the language toggle, and
 * deliberately NOT coupled to it (the Owner's own refinement).
 *
 * ——— WHICH WAY IT IS LABELLED, AND WHY IT IS NOT THE LANGUAGE CONVENTION.
 *
 * `LangToggle` is labelled with the language it switches TO, because a man
 * stuck in a language he cannot read must not have to read it to escape. That
 * reasoning does not transfer: he can read both «EGP» and «EUR» whichever unit
 * he is in, so the escape-hatch argument buys nothing here.
 *
 * What DOES transfer is the ruling of 2026-08-25 on the keypad's currency
 * control, which had been labelled with its destination while looking pressed:
 * «a filled, pressed-looking button reading "In EGP" directly above an amount
 * reading "0 EUR"». Ruled: **a currency control states what he is IN.** This is
 * a currency control. Two of them in one app under opposite conventions is the
 * confusion that ruling exists to prevent, so this one states the unit he is
 * READING in, and the accessible name carries the action.
 *
 * It does NOT reload. The language switch must, because `S` is resolved once at
 * module load; the display unit is ordinary state and re-renders in place.
 *
 * ⚠️ It is a READ preference and touches nothing that is written. The keypad's
 * currency lives in `state/travel.js` and decides what goes into his book;
 * these two must never learn about each other.
 */
export function CurrencyToggle({ value, other, onFlip, subtle }) {
  return (
    <button
      onClick={onFlip}
      aria-label={S.readInUnit(other)}
      style={{
        minHeight: 32, padding: '4px 12px', borderRadius: RADIUS.capsule,
        background: 'transparent',
        border: `1px solid ${subtle ? C.line : 'rgba(255,255,255,.45)'}`,
        color: subtle ? C.ink : '#fff',
        fontSize: 13, fontWeight: 700, opacity: subtle ? 1 : 0.9,
        ...LATIN,
      }}
    >
      {value}
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
        minHeight: TAP, minWidth: TAP, borderRadius: RADIUS.capsule,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent',
        border: `1px solid ${failed ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.45)'}`,
        color: '#fff', fontSize: ICON.control, fontWeight: 700,
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
        borderRadius: RADIUS.capsule,
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
        borderRadius: RADIUS.capsule,
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
                width: 50, height: 50, margin: '-18px auto 2px', borderRadius: RADIUS.capsule,
                background: C.harbor, color: C.onDark, fontSize: ICON.primary, lineHeight: '48px',
                fontWeight: 600, boxShadow: '0 6px 16px rgba(62,124,166,.42)',
              }
            : { fontSize: ICON.nav, marginBottom: 2 }
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
            borderRadius: RADIUS.capsule, padding: '1px 7px', ...LATIN,
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
        borderRadius: RADIUS.capsule,
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
        borderRadius: RADIUS.row,
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
  // §3 stat anatomy (A4): serif value, NON-serif unit at unitSize() —
  // 0.55× floored at the prose floor, never a bare size * 0.5.
  return (
    <div style={{ fontFamily: FONT_DISPLAY, fontSize: size, fontWeight: 650, color: C.ink, ...LATIN, ...NUMERALS }}>
      {amount}
      {currency ? <span style={{ fontSize: unitSize(size), fontFamily: FONT_UI, color: C.muted, fontWeight: 500 }}> {currency}</span> : null}
    </div>
  );
}
