/**
 * TRAVEL MODE — the keypad's currency (finding A4).
 *
 * ——— THE FINDING. The product brief names travel as *the* failure mode, and
 * until now the app handled it by reading foreign rows and quietly excluding
 * them from every EGP sum. Correct, and only half the story: the keypad wrote
 * EGP whatever he was holding, so a euro coffee in Stockholm had to be typed
 * into the sheet by hand — on precisely the trip where the app is least
 * convenient to work around.
 *
 * ——— WHAT IS AND IS NOT A DECISION HERE.
 *
 * The currency is a MODE, not a per-entry field. He is in Egypt or he is not,
 * and asking "which currency?" on every cash entry would add a decision to the
 * one screen whose whole subject is the five-second law. So it is sticky: set it
 * once on arrival, and every entry until he sets it back is in that currency.
 *
 * The cost of sticky is the obvious one — a forgotten switch writes EGP amounts
 * as euros, or the reverse. That is why the pinned dock spells the currency out
 * in the confirm («✓ سجّل 12.5 يورو») and why the chooser is only ever one tap
 * from the amount. It is visible on the screen where the row is written, every
 * single time.
 *
 * ——— AND WHY IT IS NOT REMEMBERED ACROSS RE-INSTALLS.
 *
 * `localStorage`, like every other preference here. If it is ever lost the app
 * is back in EGP, which is where he lives — the safe direction to fail.
 */

const KEY = 'masareef.currency.v1';

/**
 * The currencies the keypad offers, and they MUST be a subset of the server's
 * `MANUAL_CURRENCIES`. Anything outside that list is coerced to EGP server-side,
 * which would write a euro amount into his book as pounds — a wrong number with
 * a ✓ over it, which is the one failure this project treats as unacceptable.
 *
 * His sheet also holds SEK and NOK rows from earlier trips. They are not offered
 * here — see the note under `toggleCurrency` — and nothing about reading those
 * rows changes: they display and are excluded from EGP sums exactly as before.
 */
export const CURRENCIES = ['EGP', 'EUR'];
export const HOME_CURRENCY = 'EGP';
/** The one he travels in. Changing this line is how a third currency arrives. */
export const AWAY_CURRENCY = 'EUR';

/**
 * ——— TWO, NOT SIX (Tarek's call, 2026-08-17): *"let's keep it in euros."*
 *
 * The first version offered EGP · EUR · SEK · NOK · USD · GBP, because his sheet
 * has held all of those. Six chips is a menu; a menu is a decision; and a
 * decision on the screen whose whole subject is the five-second law is exactly
 * what the design read spent Tier 1 removing. He asked for **a button that
 * changes the whole thing**, so it is a button: pounds or euros, one tap, and
 * the currency is spelled out in the confirm every time.
 *
 * Conversion is deliberately NOT here. He has a Sheet formula that looks the
 * rate up against the purchase DATE — which is the right place for it, because
 * a rate is a fact about a day and his book is the thing that holds days. The
 * app writes what he actually paid, in the currency he actually paid it, and
 * never guesses a rate.
 */
export const toggleCurrency = (c) => (isTravelling(c) ? HOME_CURRENCY : AWAY_CURRENCY);

export const isCurrency = (c) => CURRENCIES.indexOf(c) !== -1;

/** Anything unrecognised reads as home. Failing toward Cairo is the safe way. */
export function getCurrency() {
  try {
    const c = localStorage.getItem(KEY);
    return isCurrency(c) ? c : HOME_CURRENCY;
  } catch {
    return HOME_CURRENCY;
  }
}

export function setCurrency(c) {
  const next = isCurrency(c) ? c : HOME_CURRENCY;
  try {
    if (next === HOME_CURRENCY) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch { /* a lost preference costs him a mode, never an entry */ }
  return next;
}

/**
 * IS HE TRAVELLING? — the one question the UI asks of this module.
 *
 * Used to decide whether the currency chooser is even shown. In Cairo the
 * keypad has no business offering six currencies: that is a decision per entry
 * on the screen that must take five seconds, for a man who spends in pounds.
 * The chooser lives behind the receipt-row's own control instead, so the daily
 * path never sees it.
 */
export const isTravelling = (c) => (c || HOME_CURRENCY) !== HOME_CURRENCY;

/**
 * What goes on the wire.
 *
 * EGP is sent as `undefined` rather than as the string, deliberately: every
 * client that predates travel mode — the three iOS Shortcuts — omits the field
 * entirely, and the server reads an absent currency as EGP. Sending nothing in
 * the ordinary case keeps the app's home-currency payload byte-identical to the
 * one that has been in production since Phase 1, so travel mode cannot regress
 * the path he uses every day.
 */
export const wireCurrency = (c) => (isTravelling(c) && isCurrency(c) ? c : undefined);
