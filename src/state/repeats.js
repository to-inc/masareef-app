/**
 * «زي المرة اللي فاتت» — his OWN last entries, one tap each (finding A3).
 *
 * ——— WHAT THIS REPLACES, and why the old thing was only half right.
 *
 * `CASH_QUICK` is a hand-written list of eight presets — Coffee, Car wash, Taqa,
 * Talabat… Moving it above the keypad (S2) already made it the fastest path on
 * the screen, because one tap sets the description AND, where the mapping is
 * unambiguous, the category.
 *
 * But it is a GUESS at his habits, frozen in a constants file, and it carries no
 * amount — so «قهوة» still costs him the keypad. His actual cash life is roughly
 * eight recurring things at roughly the same prices, and he is the only person
 * who knows what they are. This records what he ACTUALLY logged and offers it
 * back complete: description, category, method, amount. One tap, then confirm.
 *
 * ——— WHY THE AMOUNT IS PART OF IT, and where the honesty line is.
 *
 * Prefilling an amount is the one thing here that could write a figure he did
 * not choose. Three things keep it honest, and they are not negotiable:
 *
 *   1. it fills the KEYPAD, it does not submit — the pinned dock still says
 *      «✓ سجّل 60 جنيه · أكل بره» and he still presses it;
 *   2. the chip PRINTS the amount it will fill, so the number is on screen
 *      before he touches it, never a surprise inside the field;
 *   3. only the LAST amount for that description, never an average or a
 *      rounding. An average is a number he never once spent.
 *
 * ——— WHY LOCAL, AND WHY THAT IS NOT A SECOND SOURCE OF TRUTH.
 *
 * This is a keyboard shortcut, not data. It records what this device typed, it
 * is never read back as fact, nothing sums it, and losing it costs him nothing
 * but the shortcut. The sheet remains the only thing that knows what he spent.
 */
import { CASH_QUICK } from '../lib/constants.js';

const KEY = 'masareef.repeats.v1';
/**
 * Six. The row scrolls sideways at ~120px a chip, so six is roughly two screens
 * of sideways travel — past that they are not accelerators, they are a list to
 * read, and the keypad below is faster than reading.
 */
export const MAX_REPEATS = 6;

const read = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
};

const write = (list) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_REPEATS)));
  } catch {
    /* a full or disabled store costs him a shortcut, never an expense */
  }
};

/**
 * Two entries are THE SAME REPEAT when they name the same thing paid the same
 * way. The AMOUNT is deliberately not part of the identity: buying coffee for 60
 * and then for 65 is one habit at a new price, not two habits — and keying on
 * the amount would fill his six slots with one merchant.
 *
 * Case- and space-insensitive, matching how the backend's merchant memory keys.
 */
export const repeatKey = (e) => (
  `${String((e && e.description) || '').trim().toLowerCase()}|${(e && e.method) || ''}`
);

/**
 * Record an entry he actually logged. Most recent first, de-duplicated by
 * `repeatKey`, capped.
 *
 * REFUSED, and each refusal is a case that would put a bad chip in front of him:
 *  · no description — a chip with no name is a button he cannot read;
 *  · no positive amount — nothing to prefill, and 0 is not an expense;
 *  · a NON-EGP entry. The keypad is a pound keypad; refilling it with 12.5 from
 *    a euro receipt would write 12.5 EGP. Travel has its own path (A4).
 */
export function remember(entry) {
  if (!entry) return read();
  const desc = String(entry.description || '').trim();
  const amount = Number(entry.amount);
  if (!desc) return read();
  if (!isFinite(amount) || amount <= 0) return read();
  if (entry.currency && entry.currency !== 'EGP') return read();

  const fresh = {
    description: desc,
    category: entry.category || null,
    method: entry.method || 'Cash',
    amount,
  };
  const key = repeatKey(fresh);
  const next = [fresh, ...read().filter((r) => repeatKey(r) !== key)];
  write(next);
  return next.slice(0, MAX_REPEATS);
}

/**
 * What the row shows.
 *
 * ——— THE FALLBACK IS THE POINT, not a nicety.
 *
 * On a fresh install this list is empty, and an empty accelerator row on the
 * screen that must take five seconds is worse than the hand-written presets it
 * replaced. So `CASH_QUICK` fills the remaining slots, in its own order, and the
 * row is never bare. As he uses the app his own entries push the presets off the
 * end — the screen gets more his and less ours, without a moment where it is
 * neither.
 *
 * Presets carry NO amount (they never had one), so they behave exactly as
 * before: fill the description, and the category where D5 allows one.
 */
export function repeatChips() {
  const mine = read();
  const seen = new Set(mine.map(repeatKey));
  const presets = CASH_QUICK
    .map((q) => ({ description: q.label, category: q.category, method: 'Cash', amount: null }))
    .filter((q) => !seen.has(repeatKey(q)));
  return [...mine, ...presets].slice(0, MAX_REPEATS);
}

/** Test seam — a suite must be able to start from a known store. */
export function _reset(list = []) { write(list); }
