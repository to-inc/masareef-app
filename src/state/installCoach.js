/**
 * v4 P2 (R19, ARCHITECTURE A6) — THE iOS INSTALL COACH.
 *
 * iOS Safari has no install prompt, so this sheet IS the prompt. It shows only
 * in Safari on an iPhone/iPad, never inside the installed app. «بعدين» snoozes
 * it for 14 days; «فهمت» retires it — once he has been told, showing it again
 * would be nagging. It also shows over first-run Setup on purpose: an installed
 * app keeps its OWN storage, so a book connected in Safari would be lost on
 * install — installing first is the right order.
 */
export const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;
const K = 'masareef.installCoach.v1';

/** Pure: should the coach show? */
export function coachDue({ ios, standalone, state, now }) {
  if (!ios || standalone) return false;
  if (state && state.done) return false;
  if (state && state.snoozedUntil && now < state.snoozedUntil) return false;
  return true;
}

export function readCoach() {
  try { return JSON.parse(localStorage.getItem(K) || 'null'); } catch { return null; }
}
export function snoozeCoach(now = Date.now()) {
  try { localStorage.setItem(K, JSON.stringify({ snoozedUntil: now + SNOOZE_MS })); } catch { /* private mode */ }
}
export function retireCoach() {
  try { localStorage.setItem(K, JSON.stringify({ done: true })); } catch { /* private mode */ }
}

/** iPhone/iPad Safari (not Chrome/Firefox on iOS, which cannot add to the home screen the same way). */
export function isIosSafari(ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '')) {
  return /iPad|iPhone|iPod/.test(ua) && /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}
export function isStandalone() {
  try {
    return (typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches)
      || (typeof navigator !== 'undefined' && navigator.standalone === true);
  } catch { return false; }
}
