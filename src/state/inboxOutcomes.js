/**
 * What happened to a card he tapped — the Inbox's completion cue (WS3-C).
 *
 * FIELD BUG, 2026-08-03. He categorised nine transfer cards and reported that a
 * card "doesn't get greyed out or removed — no cue which ones are done". It was
 * reproduced exactly: the card WAS removed optimistically, and then `refresh()`
 * put it straight back, because the app kept no record of what it had confirmed.
 * `pending[]` was rendered raw, so any refetch that still listed the row
 * restored it as if he had never touched it. On the `row_changed` branch that
 * refetch was also SILENT — no toast at all — so tapping did nothing and said
 * nothing.
 *
 * The old design had exactly one visible state for four different outcomes:
 *
 *     ok:true         card gone … until any refetch brought it back
 *     row_changed     card back, silence
 *     row_not_found   card back + "اتسجّلت خلاص ✓"
 *     anything else   card back + "حصلت مشكلة"
 *
 * So the rule this module exists to enforce: **a card carries its own outcome,
 * and the outcome is what the SERVER said, not what he tapped.** A settled card
 * renders as settled even when the server keeps listing it — that is what makes
 * resurrection impossible rather than merely unlikely.
 *
 * Everything here is a pure function over plain data, for the same reason
 * `receiptStages.js` is: the decisions are the part worth pinning, and pinning
 * them does not require a browser.
 */

/**
 * The six states a tapped card can be in. `saving` is deliberately one of them:
 * the tap is not the outcome, and the honest thing to show between the tap and
 * the answer is "I heard you", not "recorded ✓".
 *
 * There is no `pending` member — an untapped card has NO outcome (null), which
 * is a different thing from having an outcome that means "not yet". Collapsing
 * those two would make `needsHim` unable to tell "he has not acted" from "the
 * server has not answered".
 */
export const OUTCOMES = ['saving', 'done', 'already', 'conflict', 'failed', 'queued'];

export const isOutcome = (s) => OUTCOMES.indexOf(s) !== -1;

/**
 * The identity of a card, used BOTH as its React key and as its settle key.
 *
 * One definition on purpose. Two would drift, and the failure mode of drift here
 * is silent: the settle map would be written under one key and read under
 * another, so every card would render unsettled and the whole feature would be
 * a no-op that still passes any test asserting `outcomeFor` in isolation.
 *
 * `tab` and `rowHint` are the pair `fix_category` itself addresses. Description
 * is included as well so that a DIFFERENT row arriving at the same sheet row —
 * which is what a row deleted in the sheet looks like from here — cannot inherit
 * the previous occupant's ✓.
 */
export function cardKey(item) {
  const m = (item && item.match) || {};
  return `${item ? item.tab : ''}:${item ? item.rowHint : ''}:${m.description == null ? '' : m.description}`;
}

/**
 * A server reply → the outcome to show. `tapped` is the category he chose.
 *
 * THE FAILURE THIS SHAPE PREVENTS: an unrecognised answer must never land in
 * `done`. `res.ok === true` is compared strictly for the same reason — a
 * truncated or older deployment answering `{ok:"yes"}` is not a success, and
 * `if (res.ok)` would call it one. Everything unnamed falls to `failed`, which
 * keeps the card live and tappable; the cost of being wrong that way is one
 * extra tap, and the cost of being wrong the other way is a ✓ over a row that
 * was never written.
 *
 * `conflict` carries BOTH categories deliberately — `category` is what he
 * tapped, `sheetCategory` is what the sheet actually says now. Rendering the
 * former where the latter belongs is precisely the honest-render violation this
 * whole rev is about, and keeping them in separate fields is what lets an
 * assertion tell them apart.
 */
export function outcomeFor(res, threw, tapped) {
  const category = tapped == null ? null : tapped;
  if (threw) return { status: 'queued', category };
  if (res && res.ok === true) return { status: 'done', category };

  const code = (res && res.error) || 'unknown';
  if (code === 'row_not_found') return { status: 'already', category };
  if (code === 'row_changed') {
    // The contract (06 §3.2) says `current:{...}` without naming its fields, so
    // the value is validated rather than trusted: a conflict whose current
    // category we cannot read still gets a real cue, never "undefined".
    const cur = res && res.current;
    const label = cur && typeof cur.category === 'string' ? cur.category.trim() : '';
    return { status: 'conflict', category, sheetCategory: label || null };
  }
  return { status: 'failed', category, error: code };
}

/**
 * Does this card still need something from him?
 *
 * `conflict` and `failed` do — the row is not settled and the buttons stay
 * live. `saving`, `done`, `already` and `queued` do not: in all four his part is
 * finished, whether or not the sheet has caught up. A card with NO outcome
 * always needs him; that is the ordinary case.
 *
 * This one predicate drives the header count, the tab badge and whether the
 * buttons are disabled — so those three can never disagree about what "done"
 * means, which is how the old code ended up showing a badge of 4 over a list
 * where he had already confirmed all four.
 */
export function needsHim(outcome) {
  if (!outcome || !isOutcome(outcome.status)) return true;
  return outcome.status === 'conflict' || outcome.status === 'failed';
}

/**
 * THE ANTI-RESURRECTION STEP. Pair every row the server still lists with what
 * we know happened to it.
 *
 * The wrong implementation this exists to kill is optimistic-remove-without-
 * reconciliation — the code that shipped. It passes any test that asks "is the
 * card gone after a tap?", because it IS gone; it fails the moment a refetch
 * arrives, which is the only moment that matters.
 */
export function reconcile(pending, settled) {
  const map = settled || {};
  const list = Array.isArray(pending) ? pending : [];
  return list.map((item) => {
    const key = cardKey(item);
    return { key, item, outcome: map[key] || null };
  });
}

/** How many of these he still has to deal with. */
export function remaining(rows) {
  return (Array.isArray(rows) ? rows : []).filter((r) => needsHim(r && r.outcome)).length;
}

/**
 * What the list's header should say — as a KIND, not a sentence, so the rule
 * lives here and the wording lives in i18n.
 *
 * THE TRAP THIS EXISTS TO AVOID, found by its own suite: "nothing left for him
 * to do" and "everything is recorded" are not the same statement. `remaining`
 * reaches zero the instant he taps the last card, while that write is still in
 * flight — and a header reading «كله اتسجل ✓» at that moment claims a result the
 * server has not given. A queued card is worse: it is explicitly NOT written,
 * and it also needs nothing from him.
 *
 * So the ✓ headline is earned only when every row is genuinely settled with the
 * sheet. Otherwise the header names the true state.
 */
export function headlineFor(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const left = remaining(list);
  if (left > 0) return { kind: 'waiting', count: left };
  const has = (s) => list.some((r) => r && r.outcome && r.outcome.status === s);
  if (has('saving')) return { kind: 'saving', count: 0 };
  if (has('queued')) return { kind: 'queued', count: 0 };
  return { kind: 'done', count: 0 };
}

/**
 * THE ROWS THE APP ALREADY KNOWS — the batch's contents (finding M4).
 *
 * His evening pass is several rows at once, and the Memory table has usually
 * seen most of the merchants before: those arrive carrying a server-computed
 * `guess`, which is exactly the set that can be settled without a decision from
 * him. One button, then the genuinely unknown ones as cards — which is where his
 * attention was supposed to go all along.
 *
 * WHAT IS DELIBERATELY EXCLUDED, and each exclusion is the honest one:
 *
 *  · rows with NO guess. That is D5 — never assert a category we have not
 *    earned. A batch that filled these in would be the one thing this app has
 *    never done.
 *  · rows that no longer need him (`needsHim`), so pressing twice cannot
 *    re-send a row that is already saving, done, or queued.
 *  · STALE rows. They are folded behind «مصاريف قديمة» precisely because they
 *    are months old and want reading, not sweeping; a button that silently
 *    settled forty travel rows he cannot see is the opposite of the batch's
 *    point.
 *
 * Returns the ROWS, not a count, so the button and its label read one list. A
 * count computed separately is how the badge and the headline came to disagree.
 */
export function batchable(rows) {
  return (Array.isArray(rows) ? rows : []).filter((r) => (
    r && r.item && !r.item.stale && r.item.guess && needsHim(r.outcome)
  ));
}

/**
 * Forget the rows the server has stopped listing.
 *
 * A ✓ is worth keeping only while the row it belongs to is still on screen —
 * once the sheet agrees and the server drops the row, the card leaves and its
 * record is dead weight. Without this the map grows for as long as the app is
 * open.
 *
 * The half that matters more is the one it must NOT do: a record for a row the
 * server is STILL listing has to survive. That is the whole anti-resurrection
 * mechanism, and a prune written as "clear it after every fetch" would undo the
 * fix while passing any test that only checks the map shrinks.
 */
export function pruneSettled(settled, pending) {
  const map = settled || {};
  const live = new Set(reconcile(pending, null).map((r) => r.key));
  const out = {};
  for (const key of Object.keys(map)) if (live.has(key)) out[key] = map[key];
  return out;
}

/**
 * Optimistically show the new category on the "اليوم" screen — and NOTHING else.
 *
 * SECOND FIELD BUG, found while fixing the first (2026-08-03). The old code
 * pushed the confirmed row into `today.entries` and added its amount to
 * `today.totals`. But a pending row dated today is ALREADY in both: the server
 * builds `today` and `pending` from the one month blob, and `buildTodayFromBlob_`
 * filters on the date only — never on the category. So every confirmation
 * counted the same purchase twice. Nine taps on nine of today's rows inflated
 * his Visa total by the sum of all nine, under a heading that reads "مصاريف
 * النهاردة — زي ما هي في الشيت بالظبط".
 *
 * `fix_category` writes ONE cell. So this writes one field, and the totals are
 * not touched at all: the amount was counted when the row was written, and the
 * category has never been part of any sum.
 *
 * Identity matching mirrors the server's own rule (`rowMatches_`): date,
 * description, method, amount, currency — category excluded, because that is
 * the mutable field. Among identical twins the first is patched, which is the
 * same choice `locateRow_` makes and for the same reason: interchangeable ❓
 * rows are interchangeable.
 *
 * Returns the ORIGINAL object when nothing matched, so "did nothing" is
 * observable by identity rather than by inspection.
 */
export function applyCategoryToToday(today, match, category) {
  if (!today || !Array.isArray(today.entries) || !match) return today;
  let hit = false;
  const entries = today.entries.map((e) => {
    if (hit || !sameRow(e, match)) return e;
    hit = true;
    return { ...e, category };
  });
  return hit ? { ...today, entries } : today;
}

function sameRow(e, match) {
  if (!e) return false;
  return e.description === match.description
    && e.date === match.date
    && e.method === match.method
    && e.currency === match.currency
    && e.amount === match.amount;
}
