import { C, RADIUS, TAP, ICON, glass } from '../theme.js';
import { S } from '../i18n/strings.js';

/**
 * THE COG — the header's quiet door. It mirrors RefreshButton's dress exactly
 * (same floor, same rim, same ground) because the two stand shoulder to
 * shoulder on harbor: a second grammar one button over would read as a
 * different kind of thing, and it is not — both are chrome, neither is amber.
 * The one warm action stays the keypad's (theme.js's one-amber law).
 */
export function SettingsCog({ onOpen, active = false }) {
  return (
    <button
      onClick={onOpen}
      aria-label={S.settingsTitle}
      aria-haspopup="dialog"
      aria-expanded={active}
      style={{
        minHeight: TAP, minWidth: TAP, borderRadius: RADIUS.capsule,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        // v4: header controls are ink on glass (R0 retired the harbor header).
        ...glass('chip'),
        color: C.ink, fontSize: ICON.control, fontWeight: 700,
        // Lit while Settings is open; tapping it again closes it (Tarek, 2026-10-13).
        ...(active ? { background: C.harbor, color: C.onDark, borderColor: C.harbor } : null),
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
