import { useState, useEffect, useRef } from 'react';
import { money2 } from '../lib/format.js';
import { C, METHOD, DIVIDER, FONT_DISPLAY, FONT_UI, NUMERALS, TAP, RADIUS, ICON, MOTION, SPACE, TYPE, unitSize, NAV, GRADIENT, glass, TOAST_ACTION_BG } from '../theme.js';
import { S, SWITCH_TO, DIR, unitFor } from '../i18n/strings.js';
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
        // A3 (glass audit Tier 1): 32 -> TAP. This is a <button onClick>, so the
        // senior touch floor governs it. HANDOFF:72's audited list already claimed
        // the language toggle shipped at 48; it shipped at 32. The padding stays,
        // so the pill grows downward from its text rather than moving it.
        minHeight: TAP, padding: '4px 12px', borderRadius: RADIUS.capsule,
        background: 'transparent',
        border: `1px solid ${subtle ? C.line : 'rgba(255,255,255,.45)'}`,
        color: subtle ? C.ink : '#fff',
        /**
         * TYPE.label, NOT caption (A4b). Ruling 2 makes caption legal only for
         * annotations that DUPLICATE information available elsewhere — and this
         * word is the ONLY way out of a language he cannot read. Nothing about
         * an escape hatch is a duplicate, so it sits on the prose floor.
         */
        fontSize: TYPE.label, fontWeight: 700, opacity: subtle ? 1 : 0.9,
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
      aria-label={S.readInUnit(unitFor(other))}
      style={{
        // A3 (glass audit Tier 1): 32 -> TAP. This is a <button onClick>, so the
        // senior touch floor governs it. HANDOFF:72's audited list already claimed
        // the language toggle shipped at 48; it shipped at 32. The padding stays,
        // so the pill grows downward from its text rather than moving it.
        minHeight: TAP, padding: '4px 12px', borderRadius: RADIUS.capsule,
        background: 'transparent',
        border: `1px solid ${subtle ? C.line : 'rgba(255,255,255,.45)'}`,
        color: subtle ? C.ink : '#fff',
        // TYPE.label (A4b) — the sibling control rides LangToggle's token by
        // ROLE, not by copy: a unit he reads is prose, not a caption duplicate.
        fontSize: TYPE.label, fontWeight: 700, opacity: subtle ? 1 : 0.9,
        ...LATIN,
      }}
    >
      {unitFor(value)}
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
/**
 * THE SYNC PILL (v4 P3, OWNER-RULINGS R19) — the refresh control IS the
 * freshness line: a glass chip at the 48pt floor saying when the book was last
 * read («اتحدث 9:40»), with a dot that tells the state at a glance — green
 * fresh, terracotta when the last refresh failed. Busy, the dot becomes the
 * spinning ↻ and the word says «Refreshing…». Tapping it refreshes.
 */
export function RefreshButton({ state, onPress, savedAt = null, clock = (t) => t, waiting = 0 }) {
  const busy = state === 'busy';
  const failed = state === 'failed';
  /**
   * v4 P5 (R19): with entries still on the phone the pill turns SAND and says
   * how many wait for the network («1 مستني النت») — the same control, a third
   * state. It still refreshes (and so retries the queue) when tapped.
   */
  if (waiting > 0 && !busy) {
    return (
      <button onClick={onPress} aria-label={`${S.waitingNet(waiting)} — ${S.refresh}`}
        style={{ ...glass('advisory'), borderRadius: RADIUS.capsule, minHeight: TAP, minWidth: TAP, padding: '0 16px',
          display: 'inline-flex', alignItems: 'center', gap: 8, color: C.ink, fontSize: TYPE.label, fontWeight: 700 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
          <path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0" /><path d="M3 3l18 18" />
        </svg>
        <span style={LATIN}>{S.waitingNet(waiting)}</span>
      </button>
    );
  }
  /**
   * v4 P8: while reading, the pill says what is ON the screen — over a saved
   * copy «آخر تحديث 8:12» (the copy's age), with nothing yet «بنجيب من الشيت…».
   * The dot is muted while reading: amber is the one save action (ONE-AMBER).
   */
  const words = busy ? (savedAt ? S.lastUpdated : S.fetchingSheet) : (savedAt && !failed ? S.synced : S.refresh);
  return (
    <button
      onClick={onPress}
      disabled={busy}
      aria-label={busy ? S.refreshing : (failed ? S.refreshFailed : S.refresh)}
      aria-busy={busy ? 'true' : undefined}
      style={{
        ...glass('chip'), minHeight: TAP, minWidth: TAP, padding: '0 16px',
        display: 'inline-flex', alignItems: 'center', gap: 8,
        color: C.ink, fontSize: TYPE.label, fontWeight: 600,
      }}
    >
      <span aria-hidden className={busy ? 'pulse' : undefined}
        style={{ width: 8, height: 8, borderRadius: RADIUS.capsule, background: busy ? C.muted : failed ? C.conflictInk : C.settledInk }} />
      {words}
      {savedAt && !failed && (
        <span style={{ direction: 'ltr', unicodeBidi: 'isolate' }}>{clock(savedAt)}</span>
      )}
    </button>
  );
}

/**
 * THE UNDO TOAST (v4 P5, R19) — the one dark surface in the app. «اتحفظ ✓ 240 ج.م»
 * and a 48px «رجوع» that takes the entry back out of the outbox before it is
 * sent. Floats above the tab bar; gone after the undo window.
 */
/**
 * THE UPDATE PROMPT (v4 P8, R19, A6) — a new version waits; it never reloads
 * on its own. «حدّث» applies it now; otherwise it applies at the next cold
 * launch. The shell mounts this only while the entry sheet is CLOSED.
 */
export function UpdatePrompt({ onUpdate }) {
  return (
    <div role="status" aria-live="polite"
      style={{
        ...glass('prompt'), position: 'fixed', zIndex: 34, left: NAV.inset, right: NAV.inset,
        bottom: `calc(max(${NAV.bottom}px, env(safe-area-inset-bottom)) + ${NAV.height + 14}px)`,
        padding: '14px 14px 14px 18px', display: 'flex', alignItems: 'center', gap: 12, color: C.ink,
      }}>
      <span aria-hidden style={{ width: 40, height: 40, borderRadius: RADIUS.inset + 4, background: C.mist, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: C.harbor }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" focusable="false">
          <path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 4v5h-5" />
        </svg>
      </span>
      <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: TYPE.body, fontWeight: 700 }}>{S.updateReady}</span>
        <span style={{ fontSize: TYPE.caption, color: C.muted }}>{S.updateLater}</span>
      </span>
      <button onClick={onUpdate}
        style={{ minHeight: TAP, padding: '0 16px', borderRadius: RADIUS.capsule, background: GRADIENT.harbor, color: C.onDark, fontSize: TYPE.label, fontWeight: 700, flexShrink: 0 }}>
        {S.updateNow}
      </button>
    </div>
  );
}

export function UndoToast({ undo, onUndo }) {
  if (!undo) return null;
  return (
    <div role="status" aria-live="polite" className="sheet-in"
      style={{
        ...glass('toast'), position: 'fixed', zIndex: 35, left: NAV.inset, right: NAV.inset,
        bottom: `calc(max(${NAV.bottom}px, env(safe-area-inset-bottom)) + ${NAV.height + 14}px)`,
        minHeight: 60, padding: '0 8px 0 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        color: C.onDark,
      }}>
      <span style={{ fontSize: TYPE.body, fontWeight: 600 }}>
        {S.savedUndo} <span style={LATIN}>{money2(undo.amount)}</span> {unitFor(undo.currency)}
      </span>
      <button onClick={onUndo}
        style={{ minHeight: TAP, padding: '0 18px', borderRadius: RADIUS.capsule, background: TOAST_ACTION_BG, color: C.onDark, fontSize: TYPE.body, fontWeight: 700 }}>
        {S.undo}
      </button>
    </div>
  );
}

export function SectionLabel({ children }) {
  return (
    <div style={{
      // TYPE.label (A4b) — a muted section heading is PROSE he reads to find
      // his way; 14 was one drifted pixel under the senior prose floor.
      fontSize: TYPE.label, fontWeight: 600, color: C.muted, margin: '2px 2px 12px',
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
        // TYPE.caption BOTH variants (A4b — a chip is a chip): the method is
        // ruling 2's row-meta case, restated by the row the chip annotates.
        // `small` varies the PADDING, never the type — two chip sizes was the
        // 12-vs-13 drift, not a design.
        fontSize: TYPE.caption,
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

/**
 * THE one delta (A5, folded here from Charts once both halves landed). A
 * spending delta is a FIGURE, not a verdict: spending more than last month is
 * not a conflict and spending less is not a settlement, so both directions
 * render in the SAME ink — `inherit`, the row's own colour. The chevron says
 * which way; the ink never editorializes. The old red/green Delta skin died
 * with its last consumer; conflict red stays reserved for genuine conflict
 * STATES (unplaced ❓ money), never for direction.
 *
 * Gates unchanged: no previous figure means no comparison (absent is not
 * zero), and a previous of 0 admits no honest percentage at all.
 */
export function NeutralDelta({ now, prev }) {
  if (!prev || prev < 0 || now < 0) return null;   // a refund below zero admits no percentage (audit r2)
  const pct = Math.round(((now - prev) / prev) * 100);
  if (!isFinite(pct) || pct === 0) return null;     // unchanged is not «▼ 0%» (audit r2)
  return (
    <span
      style={{
        /**
         * TYPE.caption, NOT an exemption (A4b ruling, flagged to the Owner).
         * The exemption is for furniture whose size its own geometry bounds;
         * a delta is TEXT — a percentage restating two figures the screen
         * already shows, which is exactly ruling 2's caption scope. Text
         * takes a TYPE token, always (theme.js vocabulary law).
         */
        fontSize: TYPE.caption, fontWeight: 700, color: 'inherit',
        marginInlineStart: 6, verticalAlign: 'middle', whiteSpace: 'nowrap',
        ...LATIN,
      }}
    >
      {pct > 0 ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  );
}

/**
 * THE «الدفتر» GLYPH — the V2 Ledger mark, transcribed verbatim from the v4
 * design (`Masareef Glass PWA.dc.html` P3 nav, R16).
 *
 * It replaces «☰», which said «a list» and could have been any list in any app.
 * This says «a ruled book with a spine and entries» — which is what الدفتر IS,
 * and what the whole product is named after.
 *
 * `stroke="currentColor"` on purpose: the tab already colours itself
 * (harbor when active, muted at rest), so the glyph inherits that one decision
 * instead of restating it — and the colour cannot drift away from the label
 * beside it.
 */
export function LedgerIcon({ size = ICON.nav }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      /* The tab's own `aria-label` already names it; a second name here would
         make a screen reader say «الدفتر الدفتر». */
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block' }}
    >
      <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
      <path d="M5 17a3 3 0 0 1 3-3h11" />
      <path d="M9 8h6" />
    </svg>
  );
}

/** «للمراجعة» — the tray (R16 retires the ✉ placeholder). Verbatim from v4 P3. */
export function TrayIcon({ size = ICON.nav }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ display: 'block' }}>
      <path d="M3 13h5l1.5 2.5h5L16 13h5" />
      <path d="M5.5 5h13L21 13v6H3v-6z" />
    </svg>
  );
}

/** «جديد» — the plus, at 20 inside the pill. Verbatim from v4 P3. */
export function PlusIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
      strokeLinecap="round" aria-hidden="true" focusable="false" style={{ display: 'block' }}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/**
 * A TAB IN THE v4 BAR (R16). Two shapes:
 *  · a side tab — icon over word, the active one tinted harbor with an ink 700
 *    label (the colour and the weight say «you are here»; aria-current says it
 *    to VoiceOver — the same attribute, so they cannot disagree);
 *  · `big` — «جديد», a filled harbor pill, ALWAYS filled: it is the action, not
 *    a place, so it never looks «off».
 * «icon PLUS word, never icon-only» still holds.
 */
export function TabButton({ active, onClick, label, icon, badge, big }) {
  if (big) {
    return (
      <button
        onClick={onClick}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        style={{
          flex: NAV.newFlex, borderRadius: RADIUS.capsule, background: GRADIENT.harbor,
          boxShadow: NAV.newCast, color: C.onDark, display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 6, fontSize: TYPE.body, fontWeight: 700, minHeight: TAP,
        }}
      >
        {icon}
        {label}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      style={{
        flex: 1, borderRadius: RADIUS.capsule, minHeight: TAP,
        background: active ? NAV.activeTint : 'transparent',
        color: active ? C.ink : C.muted,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
        // GEOMETRY EXEMPTION (A3, R16): chrome label text at 14 — the bar's own
        // floor is «14px+/600+», and both weights here clear it.
        fontSize: NAV.label, fontWeight: active ? 700 : 600,
        position: 'relative',
      }}
    >
      {icon}
      {label}
      {badge ? (
        <span
          style={{
            position: 'absolute', top: 4, right: 22, minWidth: 20, height: 20, padding: '0 5px',
            boxSizing: 'border-box', borderRadius: RADIUS.capsule, background: C.conflictInk, color: C.onDark,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            // GEOMETRY EXEMPTION (ruling 2, R16): the badge's count text at 12 — a
            // 20px disc on the tab's corner; the review screen carries every item.
            fontSize: 12, fontWeight: 700, ...LATIN,
          }}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

/**
 * THE ADVISORY SHEET (B4, nav-F8) — how a surface that was not there a moment
 * ago arrives.
 *
 * ——— THE ENTRANCE. A translateY rise at MOTION.page with MOTION.easeSettle:
 * the surface comes up from below its settled place and eases to rest, which
 * is the grammar of a sheet — something laid OVER the page — rather than the
 * pop of something materializing in it. The rise distance is RADIUS.sheet, on
 * purpose: the surface rises by the depth of its own lip, so the travel and
 * the curve that ends it read as one gesture, and the distance can never
 * drift apart from the lip it belongs to.
 *
 * ——— THE LIP. RADIUS.sheet (24 — Planner ruling 2026-08-26, first consumed
 * here): one step softer than the RADIUS.card (20) content it covers. The lip
 * is the sheet's identity, so a caller's style cannot override it.
 *
 * ——— WHY THE KEYFRAMES DEFINE ONLY `from`, which is the load-bearing choice.
 * The settled state is the ELEMENT'S OWN style; the animation only supplies
 * where it came from. Two laws fall out by construction rather than by
 * discipline: a static render (every suite renders statically) shows the
 * settled sheet, because keyframes do not exist on paper; and the
 * prefers-reduced-motion guard's `animation: none` collapses the entrance to
 * an INSTANT APPEARANCE — there is no keyframe state left that could hide or
 * displace content.
 *
 * ——— WHY THE <style> RIDES THE COMPONENT. The other entrances live in
 * styles.css, which is another leaf's file and still speaks raw seconds
 * (`pop 0.18s`). The MOTION law says durations ride tokens, and a token is a
 * JS value, so the CSS is authored here where MOTION is in scope. Both sheet
 * surfaces can mount at once (offline + a confirm), so the tag may appear
 * twice — identical rules are idempotent in CSS, and React 18 has no
 * hoisting/dedupe to lean on.
 */
const SHEET_IN_CSS = `
@keyframes sheet-in {
  from { transform: translateY(${RADIUS.sheet}px); opacity: 0; }
}
.sheet-in { animation: sheet-in ${MOTION.page}ms ${MOTION.easeSettle} both; }
@media (prefers-reduced-motion: reduce) {
  .sheet-in { animation: none; }
}
`;

/**
 * One sheet, two advisory surfaces today (Toast, OfflineBanner) and every
 * view-owned sand banner tomorrow — exported as the adoption path. Two
 * hand-rolled entrances is how the second one drifts; this codebase has paid
 * for that exact mistake more than any other (the Rail's own lesson, N2).
 */
export function Sheet({ children, style, ...rest }) {
  return (
    <>
      <style>{SHEET_IN_CSS}</style>
      {/* class and lip sit AFTER the spread — the sheet's identity is not a
          default a caller can override, it is what makes the surface a sheet. */}
      <div {...rest} className="sheet-in" style={{ ...style, borderRadius: RADIUS.sheet }}>
        {children}
      </div>
    </>
  );
}

export function Toast({ message }) {
  if (!message) return null;
  return (
    /**
     * The outer strip only POSITIONS — the sheet motion animates `transform`,
     * so centering by translateX would be overwritten for the length of the
     * entrance and the toast would enter from the wrong place. Flex centering
     * keeps `transform` free for the motion. `pointerEvents: 'none'` because
     * the strip spans the screen and the toast is not a control: a
     * confirmation must never eat the tap he was already making.
     */
    <div
      style={{
        position: 'fixed',
        bottom: `calc(96px + env(safe-area-inset-bottom))`,
        insetInline: 0,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 40,
      }}
    >
      <Sheet
        role="status"
        style={{
          background: C.harbor,
          color: C.onDark,
          padding: '13px 24px',
          // TYPE.body (A4b) — the confirmation is a body sentence; 16.5 was
          // body prose off by half a pixel, restated nowhere else.
          fontSize: TYPE.body,
          fontWeight: 600,
          boxShadow: '0 8px 24px rgba(62,124,166,.38)',
          whiteSpace: 'nowrap',
        }}
      >
        {message}
      </Sheet>
    </div>
  );
}

// Calm amber, never red, never a modal — losing signal in Cairo is normal and
// his data is still on screen. It KEEPS its line border under the sheet lip:
// advisory surfaces stay bordered by name (theme.js's C.line doctrine, A2).
export function OfflineBanner({ text }) {
  return (
    <Sheet
      style={{
        background: C.sand,
        color: C.ink,
        border: `1px solid ${C.line}`,
        padding: '10px 14px',
        // TYPE.label (A4b) — an advisory he must read sits ON the prose
        // floor, not half a pixel under it.
        fontSize: TYPE.label,
        fontWeight: 600,
        marginBottom: SPACE.gap,
        textAlign: 'center',
      }}
    >
      {text}
    </Sheet>
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
