/**
 * WHETHER THE PRIORITIES LENS IS OPEN — a per-install preference, default OFF.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY A STORED PREFERENCE AND NOT AN IDENTITY CHECK.
 *
 * The lens is «Tarek's install only, like travel mode» (his ruling). Travel mode
 * is exactly this: a localStorage preference with a visible toggle and a safe
 * default. The client has no other honest way to know WHOSE book it is talking
 * to — `ping`'s `build` carries `{id, assertions, tail, functions, complete,
 * actions, currencies}` and no install identity, and the capability
 * advertisement deliberately carries COUNTS rather than names. Guessing from the
 * data («this book has project categories, so it must be his») would be an
 * identity inferred from spending, wrong the first month he books none.
 *
 * ——— IT DEFAULTS CLOSED, which is the whole per-install guarantee.
 *
 * Dad's phone never opens it, so his Month screen gains one quiet collapsed line
 * and nothing else — strictly less than the language toggle he already carries
 * on every screen (S8), and zero decisions anywhere near the capture path. A
 * cleared install, a garbage value, a storage that throws: all land closed.
 *
 * If the Planner would rather gate this on something the SERVER says, that is an
 * additive `ping` field and therefore theirs to rule — this file is then two
 * lines shorter and nothing else changes.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const KEY = 'masareef.lens.v1';

/**
 * Strict on purpose: only the exact stored string opens it. Anything else — a
 * half-written value, a key from a future version, a legacy `true` — reads as
 * closed rather than being coerced into open, for the same reason
 * `supportsAction` refuses a truthy-but-wrong list.
 */
export function lensOpen(storage) {
  try {
    const store = storage || localStorage;
    return store.getItem(KEY) === 'open';
  } catch {
    return false;
  }
}

export function setLensOpen(open, storage) {
  try {
    const store = storage || localStorage;
    store.setItem(KEY, open ? 'open' : 'closed');
  } catch { /* a lost preference costs a collapsed panel, never a number */ }
  return !!open;
}
