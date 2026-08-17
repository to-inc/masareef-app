/**
 * WHEN THE ENTRY MAY BE WRITTEN, and — the part that is new — WHICH STEP IS
 * MISSING WHEN IT MAY NOT.
 *
 * ——— WHY THIS IS A MODULE AND NOT AN `&&` IN THE VIEW.
 *
 * The readiness rule used to live inline in EntryView as
 * `amount && parseFloat(amount) > 0 && cat && !busy`, and the submit handler in
 * App.jsx carried its own second copy as `if (!amount || !entryCat || entryBusy)
 * return`. Two expressions, in two files, for one question — and they did not
 * agree: `parseFloat("0") > 0` is false, while `!"0"` is also false, so a
 * zero-pound entry was un-pressable in the view and perfectly postable through
 * the handler. That is the shape of bug this project keeps finding: not a wrong
 * answer, two answers.
 *
 * With the button pinned it also has to say something in every state, and a
 * boolean cannot. So the question became "which state", and the boolean is
 * DERIVED from it — the label can never drift from the disabled attribute,
 * because both read the same value.
 *
 * Arabic-Indic digits never reach here: `normalizeDigits` runs on every keypress
 * in the view. This still parses defensively rather than trusting that, because
 * the quick-chip path sets state without a keypress.
 */

/**
 * The three states, in the order he passes through them. `ready` is the only one
 * that may write.
 */
export const DOCK_STATES = ['needAmount', 'needCategory', 'ready'];

/**
 * What the entry is still missing — a statement about the CONTENT only.
 *
 * AMOUNT FIRST, deliberately. When both are missing the dock names the amount,
 * because that is what the keypad under his thumb is already for; naming the
 * category there would send him past the keypad to the chips and back.
 *
 * `busy` is not a state here on purpose. A write in flight is not a missing
 * step — it is this same entry, mid-flight — and folding it in would make the
 * label say "choose a category" over an entry that has one. The view renders
 * «جارٍ الحفظ…» over whichever state it was in, and `entryReady` below is what
 * actually stops the second tap.
 */
export function dockState({ amount, cat }) {
  const n = parseFloat(amount);
  if (!isFinite(n) || n <= 0) return 'needAmount';
  if (!cat) return 'needCategory';
  return 'ready';
}

/**
 * The boolean the button's `disabled` and the submit handler both use. Derived,
 * never re-stated — that is the whole point of the module.
 *
 * `busy` enters HERE and nowhere else: it is the guard that keeps a double-tap
 * on a slow Apps Script call from becoming two rows in his book.
 */
export function entryReady({ amount, cat, busy }) {
  return !busy && dockState({ amount, cat }) === 'ready';
}

/**
 * ONE KEYPRESS → THE NEXT AMOUNT STRING. Pure, so the keypad's rules can be
 * stated once and checked without a browser.
 *
 * ——— THE LEADING ZERO, found by driving the real screen 2026-08-17.
 *
 * The old handler was `setAmount(amount + k)` with no rule about `"0"`, so
 * tapping 0 then 6 produced `"06"`, and 0-0-6 produced `"006"`. Nothing was ever
 * WRITTEN wrong — `parseFloat("060")` is 60 — so the sheet was safe and the bug
 * was invisible for as long as the amount was only a small line above a keypad.
 *
 * The pinned dock is what made it matter: it now echoes the amount back at 18px
 * as «✓ سجّل · 060 جنيه · Eating out», which is the app stating his expense to
 * him in a form he did not type, on the last screen before it becomes a row. The
 * honest-render law is about what a person READS; `060` is not a figure he wrote.
 *
 * `"0."` is deliberately allowed through — it is a real prefix of `"0.50"`, and
 * half a pound is a real expense. Only a leading zero followed by a DIGIT is
 * collapsed.
 */
export const MAX_AMOUNT_CHARS = 9;

export function pressKey(amount, key) {
  const s = typeof amount === 'string' ? amount : '';
  if (key === '⌫') return s.slice(0, -1);
  if (key === '.') return s.includes('.') ? s : (s === '' ? '0.' : `${s}.`);
  if (!/^[0-9]$/.test(key)) return s;
  // 0 → 6 is 6, not 06. But 0. → 0.6 keeps its zero.
  if (s === '0') return key;
  if (s.length >= MAX_AMOUNT_CHARS) return s;
  return s + key;
}
