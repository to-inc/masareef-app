/**
 * The three duplicate hints, and what the server's answer to a confirm MEANS.
 *
 * Pure: no React, no fetch. The decisions here are the ones that decide whether
 * a row reaches his sheet, and they were inline in `ReceiptView` where no
 * assertion could reach them.
 *
 * ——— THE THREE HINTS ARE THREE DIFFERENT QUESTIONS, deliberately not merged:
 *   dupSms    — an SMS for this amount arrived within 6 h (`xsrc`). Fast, and
 *               blind to anything older than this morning.
 *   dupPhoto  — this same IMAGE was extracted before (`rcpthash_`).
 *   dupBook   — HIS BOOK already holds a row with this date + amount + currency
 *               (D18a). The only one that outlives the event, which is why the
 *               e-receipt door needed it: a slip is screenshotted days late, by
 *               which time `xsrc` has expired and the row is simply sitting
 *               there.
 * Collapsing them would be the `ignored`/`error` mistake again — and the book
 * one is the only one that can hand him a ROW to look at.
 */

export const CONFIRM_OUTCOMES = ['written', 'blocked', 'failed'];

/**
 * WHAT DID THE SERVER ACTUALLY DO WITH THE CONFIRM?
 *
 * `{ok:true, skipped:"book_duplicate"}` is the trap this function exists for.
 * `res.ok` is TRUE on it — the request succeeded — and **no row was written**.
 * Read as success (which is what `if (res.ok)` does) the card would close, the
 * job would be deleted from the queue, and the expense would be gone: no error,
 * no row, nothing on screen to notice. The one forbidden output.
 *
 *   written  — a row exists now. `skipped:"duplicate"` counts: that is clientId
 *              idempotency answering for a row this same tap already wrote.
 *   blocked  — his book already holds it and he has not said to write it anyway.
 *              The card STAYS, with the row it found.
 *   failed   — anything else, including an unrecognised shape. Never `written`.
 */
export function confirmOutcome(res) {
  if (!res || res.ok !== true) return 'failed';
  if (res.skipped === 'book_duplicate') return 'blocked';
  if (res.skipped === 'duplicate') return 'written';
  if (res.skipped) return 'failed';        // an unnamed skip is not a success
  return 'written';
}

/** The three hints off an extract response, normalised. */
export function dupState(res) {
  return {
    sms: !!(res && res.dupSms),
    photo: !!(res && res.dupReceipt),
    book: bookFrom(res),
  };
}

/**
 * The book answer, from EITHER shape it arrives in: the extract response, or a
 * blocked confirm. One reader, because two would drift — and the confirm's copy
 * is the authoritative one (the extract check is cache-only and may have had
 * nothing to look at).
 *
 * Returns null when there is no MATCH, including when the check could not run.
 * `checked:false` deliberately shows him nothing: we have no claim to make, and
 * announcing "we could not check" on a card whose job is confirming an amount
 * would be noise about our own cache.
 */
export function bookFrom(res) {
  const d = res && res.dupBook;
  if (!d || typeof d !== 'object') return null;
  if (!d.match || typeof d.match !== 'object') return null;
  return {
    match: d.match,
    count: Number.isFinite(d.count) ? d.count : 1,
    undatedAmountMatch: !!d.undatedAmountMatch,
  };
}

/**
 * An undated row in that month carries the same amount, and his sheet cannot
 * read its date — so the date+amount key is structurally blind to it. Advisory
 * ONLY: it never blocks, because "there might be something we cannot see" is not
 * grounds for refusing his expense. Surfaced rather than swallowed (ruling (b)).
 */
export function undatedHint(res) {
  const d = res && res.dupBook;
  if (!d || typeof d !== 'object') return false;
  return !d.match && !!d.undatedAmountMatch;
}

/**
 * Is the confirm button withheld pending one deliberate tap?
 *
 * Any of the three flags withholds it, and ONE acknowledgement releases all of
 * them — he is answering "yes, log it anyway", not filling in a form. D5's
 * advisory-never-silent rule: nothing is refused, one tap costs him a second.
 */
export function isBlocked(dups, acknowledged) {
  if (acknowledged) return false;
  return !!(dups && (dups.sms || dups.photo || dups.book));
}
