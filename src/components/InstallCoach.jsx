import { useState } from 'react';
import { C, FONT_DISPLAY, RADIUS, TAP, TYPE, glass, GRADIENT, SHEET } from '../theme.js';
import { S } from '../i18n/strings.js';
import { coachDue, readCoach, snoozeCoach, retireCoach, isIosSafari, isStandalone } from '../state/installCoach.js';

/** The share glyph Safari draws — so step 1 points at the thing he will see. */
const ShareIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.harbor} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M12 3v12" /><path d="M8 7l4-4 4 4" /><path d="M6 11H5v10h14V11h-1" />
  </svg>
);
const Helm = () => (
  <svg width="46" height="46" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
    <circle cx="60" cy="60" r="40" fill="none" stroke="#D9A441" strokeWidth="11" />
    <path d="M60 7v10M60 103v10M7 60h10M103 60h10" stroke="#3E7CA6" strokeWidth="7" strokeLinecap="round" />
    <path d="M43 83 L60 33 L77 83" fill="none" stroke="#2C4356" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** v4 P2 — see state/installCoach.js for when and why. `force` is the SSR/test seam. */
export default function InstallCoach({ force = false }) {
  const [open, setOpen] = useState(() => force || coachDue({ ios: isIosSafari(), standalone: isStandalone(), state: readCoach(), now: Date.now() }));
  if (!open) return null;
  const step = (n, text, extra) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: TYPE.row }}>
      <span aria-hidden style={{ width: 32, height: 32, borderRadius: RADIUS.capsule, background: C.mist, fontWeight: 700, fontSize: TYPE.label, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</span>
      <span>{text}</span>{extra}
    </div>
  );
  return (
    <>
      <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 60, background: SHEET.dim }} />
      <div role="dialog" aria-modal="true" aria-label={S.coachTitle} className="view-in"
        style={{ ...glass('card'), position: 'fixed', zIndex: 61, left: 12, right: 12, bottom: 'calc(112px + env(safe-area-inset-bottom))',
          padding: '24px 22px 20px', display: 'flex', flexDirection: 'column', gap: 18, color: C.ink }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ ...glass('chip'), borderRadius: RADIUS.glassWell, width: 60, height: 60, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Helm /></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: TYPE.section, fontWeight: 650 }}>{S.coachTitle}</div>
            <div style={{ fontSize: TYPE.label, color: C.muted }}>{S.coachBody}</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {step(1, S.coachStep1, <ShareIcon />)}
          {step(2, S.coachStep2)}
          {step(3, S.coachStep3)}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="bigbtn" onClick={() => { retireCoach(); setOpen(false); }}
            style={{ flex: 1, minHeight: 52, borderRadius: RADIUS.capsule, background: GRADIENT.harbor, color: C.onDark, fontSize: TYPE.row, fontWeight: 700 }}>
            {S.coachGotIt}
          </button>
          <button className="catchip" onClick={() => { snoozeCoach(); setOpen(false); }}
            style={{ ...glass('chip'), minHeight: 52, minWidth: TAP, padding: '0 22px', color: C.ink, fontSize: TYPE.body, fontWeight: 600 }}>
            {S.coachLater}
          </button>
        </div>
      </div>
    </>
  );
}
