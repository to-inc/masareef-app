/**
 * E-015 — what the server's predictor says, read once (Tarek, 2026-10-09).
 *
 * The server climbs a ladder (Code.gs predictFor_): category from a rule he
 * taught, his own history, similar names, then the model's reading of the
 * items; method from card/cash EVIDENCE on the receipt, then how he usually
 * pays there. Each answer names its rung. The app pre-selects the answer and
 * says the rung in words, so a guess is never an unexplained default.
 */
import { isMethod, DEFAULT_METHOD } from './entryPayload.js';

/** The method a reviewed receipt opens on: the prediction, else D19's default, else Cash. */
export const startMethod = (res) => (isMethod(res && res.method) ? res.method
  : isMethod(res && res.defaultMethod) ? res.defaultMethod : DEFAULT_METHOD);

/** The parts of a receipt_extract answer the review card explains. */
export const predOf = (res) => (res ? {
  category: res.category || null, categorySource: res.categorySource || null,
  method: isMethod(res.method) ? res.method : null, methodSource: res.methodSource || null,
  evidence: cleanEvidence(res.extraction && res.extraction.method_evidence),
} : null);

/**
 * What the receipt SHOWS, said briefly (Tarek, 2026-10-10: «Visa DEBIT **** ****
 * **** 0634 LP','category_guess':'Eating out'}»). The reader sometimes leaks the
 * tail of its own answer into this field. Cut at the first quote, brace or
 * comma-quote; a masked card number is said as its last four («•••• 0634»).
 */
export function cleanEvidence(raw) {
  if (raw == null) return null;
  let t = String(raw).split(/['"{}]|,\s*'/)[0].trim();
  const card = t.match(/(?:\*{2,}|x{2,}|•{2,})[\s*x•]*(\d{4})\b/i);
  if (card) t = `•••• ${card[1]}`;
  if (t.length > 40) t = `${t.slice(0, 39)}…`;
  return t || null;
}
