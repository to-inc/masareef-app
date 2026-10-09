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
  evidence: (res.extraction && res.extraction.method_evidence) || null,
} : null);
