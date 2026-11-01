import { C, RADIUS, TAP, glass } from '../theme.js';
import { S } from '../i18n/strings.js';
import { GearIcon } from '../components/Primitives.jsx';

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
        color: C.ink,
        // Lit while Settings is open; tapping it again closes it (Tarek, 2026-10-13).
        ...(active ? { background: C.harbor, color: C.onDark, borderColor: C.harbor } : null),
      }}
    >
      {/* A line gear in the photos icon's stroke (design audit 2026-11-01: the ⚙︎ text
          glyph drew thinner and smaller than its neighbour). Decoration: the name is the aria-label. */}
      <GearIcon />
    </button>
  );
}
