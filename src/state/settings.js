import { METHODS } from './entryPayload.js';
import { FROST, ATMOSPHERE, COMFORT_ZOOM } from '../theme.js';
import { isTravelling } from './travel.js';

/**
 * THE DEFAULT METHOD — a SETTING (S2; 06 §3.10.3; Owner field ruling
 * 2026-08-27: «keep card as the default»).
 *
 * ——— WHY THE DEFAULT MOVED OFF THE KEYPAD'S OWN CONSTANT.
 *
 * The New screen used to pre-choose Cash through `DEFAULT_METHOD`, and that
 * was right for the life it was written in: card purchases on his Egyptian
 * bank log themselves from the SMS, so a manual entry was a cash entry unless
 * he said otherwise. The Owner's field report says his life stopped working
 * that way — the entries he types by hand are card entries now, and every one
 * of them cost a tap to say so. The default is a fact about the INSTALL's
 * life, so it is a setting: this install ships Card, and Dad's is set back to
 * Cash at setup with one tap in the Settings sheet.
 *
 * ——— TWO DEFAULTS EXIST, AND THEY ARE DIFFERENT FACTS. DO NOT UNIFY THEM.
 *
 * `entryPayload.DEFAULT_METHOD` ('Cash') is the WIRE FLOOR UNDER A BUG: it
 * mirrors the server's `normalizeMethod_` coercion (anything unrecognised →
 * Cash) so the client can never hold a different belief about what was
 * written than the sheet does. It is not a preference and must never follow
 * one — a floor that moved with a setting would let the client and the server
 * disagree about the same broken payload. THIS file is the chooser's
 * PRE-CHOICE, a UI fact, persisted per install. The S2 oracle pins both
 * facts apart by value.
 *
 * ——— THE VALUE IS THE SHEET'S WORD, NEVER THE BUTTON'S.
 *
 * Stored values live in `METHODS` — the wire vocabulary ('Cash' | 'Visa'),
 * which is also the sheet's column vocabulary. The reader-facing words stay
 * `methodCard`/`methodCash` lookups at render time (state/entryPayload.js
 * owns the column-swap story this arrangement exists to make impossible).
 * A stored label, or any unrecognised value, falls back to the shipped
 * default rather than rendering itself — the same reasoning as `getLang`:
 * a corrupted preference must not become a pre-choice on the screen that
 * writes his book.
 */

const KEY = 'masareef.settings.defaultMethod';

/** The Owner's ruling, as the sheet spells it: Card ships as the default. */
export const SHIPPED_DEFAULT_METHOD = 'Visa';

/**
 * §3.10.3's second half: a NON-EGP currency mode forces the pre-choice to
 * Card — euro cash is not his life. A separate named fact from the shipped
 * default: the two happen to share a value today, and the day Dad's install
 * is set to Cash they will still share this one abroad.
 */
export const FORCED_AWAY_METHOD = 'Visa';

/**
 * `storage` is injectable for the suites (the display.js pattern); absent, it
 * guards for environments with no localStorage at all — node, private mode —
 * and answers the shipped default rather than throwing.
 */
export function getDefaultMethod(storage) {
  try {
    const store = storage || (typeof localStorage === 'undefined' ? null : localStorage);
    const v = store && store.getItem(KEY);
    return METHODS.indexOf(v) === -1 ? SHIPPED_DEFAULT_METHOD : v;
  } catch {
    return SHIPPED_DEFAULT_METHOD;
  }
}

export function setDefaultMethod(m, storage) {
  const next = METHODS.indexOf(m) === -1 ? SHIPPED_DEFAULT_METHOD : m;
  try {
    const store = storage || (typeof localStorage === 'undefined' ? null : localStorage);
    if (store) store.setItem(KEY, next);
  } catch { /* the choice simply will not persist; nothing else breaks */ }
  return next;
}

/**
 * THE ONE RULE THE CHOOSER INITIALIZES FROM — stated here so EntryView's two
 * triggers (mount, and the currency flipping away from EGP) call the SAME
 * expression and cannot drift. At home the pre-choice is the setting; away it
 * is Card, whatever the setting says. A manual tap within the entry being
 * composed still overrides — this function decides the PRE-choice, never the
 * choice.
 */
export function entryDefaultMethod(currency, storage) {
  return isTravelling(currency) ? FORCED_AWAY_METHOD : getDefaultMethod(storage);
}

/**
 * R10 — THE DISPLAY SETTINGS: frost (how much the glass blurs), atmosphere (a
 * tint on the GROUND only — never an ancestor of the fixed bar or sheets, A22)
 * and comfort zoom (a multiplier ON TOP of compliant type; at 100% every floor
 * holds as built). Applied as CSS on the page root, so one change restyles the
 * whole app with no re-render and no view knowing.
 */
const KD = 'masareef.display.v1';
export const DISPLAY_DEFAULT = { frost: 'designed', atmosphere: 'morning', zoom: 1 };
export function cleanDisplay(v) {
  const o = v && typeof v === 'object' ? v : {};
  const z = Math.round(Number(o.zoom) * 100) / 100;
  return {
    frost: Object.prototype.hasOwnProperty.call(FROST, o.frost) ? o.frost : DISPLAY_DEFAULT.frost,
    atmosphere: Object.prototype.hasOwnProperty.call(ATMOSPHERE, o.atmosphere) ? o.atmosphere : DISPLAY_DEFAULT.atmosphere,
    zoom: isFinite(z) && z >= COMFORT_ZOOM.min && z <= COMFORT_ZOOM.max ? z : DISPLAY_DEFAULT.zoom,
  };
}
export function getDisplay(storage) {
  try {
    const store = storage || (typeof localStorage === 'undefined' ? null : localStorage);
    return cleanDisplay(JSON.parse((store && store.getItem(KD)) || 'null'));
  } catch { return { ...DISPLAY_DEFAULT }; }
}
export function setDisplay(next, storage) {
  const v = cleanDisplay(next);
  try {
    const store = storage || (typeof localStorage === 'undefined' ? null : localStorage);
    if (store) store.setItem(KD, JSON.stringify(v));
  } catch { /* will not persist; still applies now */ }
  applyDisplay(v);
  return v;
}
/** Writes the three settings onto the page root. `root` is injectable for tests. */
export function applyDisplay(v, root = (typeof document !== 'undefined' ? document.documentElement : null)) {
  if (!root) return;
  const d = cleanDisplay(v);
  root.style.setProperty('--frost', String(FROST[d.frost]));
  root.style.setProperty('--atmosphere', ATMOSPHERE[d.atmosphere]);
  root.style.zoom = d.zoom === 1 ? '' : String(d.zoom);
}

// Field-test diagnostics, off unless localStorage['masareef.debug']='1'.
// Moved here from ReceiptView so Settings can gate its screen readout too (audit 2026-10-10).
export const debugOn = () => {
  try { return localStorage.getItem('masareef.debug') === '1'; } catch { return false; }
};
