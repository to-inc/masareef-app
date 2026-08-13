/**
 * The TWO shapes of a `fix_category` write, side by side and on purpose.
 *
 * Both screens change a category on a row in his sheet. They are NOT the same
 * request, and the difference is the whole file:
 *
 *   · the INBOX card came from `pending[]`, which carries the row's real sheet
 *     position. It sends that position, and `locateRow_` takes it as a fast path;
 *   · a RECENT row came from `entries[]`, which deliberately carries no position
 *     (06 §2.4, six public fields). It sends none, and the server content-scans.
 *
 * WHY THIS IS NOT A MICRO-OPTIMISATION. Without the hint the server collects
 * every row matching on content and, absent a strict match, returns the FIRST
 * (`locateRow_`, Code.gs). An Inbox confirm matches on category `❓` — so two
 * identical unpriced ❓ rows in one month and the edit lands on the wrong one,
 * with no error and nothing on screen for him to notice. Recent cannot avoid
 * that ambiguity (it has no position to send, and two identical purchases really
 * are indistinguishable in his book); the Inbox can, and must.
 *
 * They live in one file because the failure mode is someone reasonably deciding
 * these two near-identical literals should be one function. Reading them here,
 * with the paragraph above between them, is the point.
 *
 * The returned object is also what `enqueue` stores for an offline replay, so
 * this shape survives a cold start — another reason it is built in one named
 * place rather than inline at two call sites.
 */

/**
 * The Inbox confirm. `item.rowHint` is the row's REAL sheet position, handed
 * over by the server in `pending[].rowHint` and echoed back untouched — the
 * client never computes, adjusts or invents it.
 */
export function confirmPayload(item, category) {
  return {
    tab: item.tab,
    rowHint: item.rowHint,
    match: item.match,
    newCategory: category,
  };
}

/**
 * The Recent edit. No `rowHint` KEY AT ALL — not `rowHint: undefined`, which
 * serialises away identically but reads to the next person as an oversight
 * rather than a decision. A Recent item does carry a `rowHint` field, but it is
 * a local settle key built from the row's own date and amount; sending it would
 * put a fabricated position on the wire.
 */
export function editPayload(item, category) {
  return {
    tab: item.tab,
    match: item.match,
    newCategory: category,
  };
}
