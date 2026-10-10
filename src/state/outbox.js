/**
 * Offline write queue.
 *
 * Every write carries a `clientId`, and the server uses it as the dedupe key, so
 * replaying a queued item is idempotent — that is what lets the app promise
 * "never lost" on Cairo mobile data without a second database.
 *
 * THE 6-HOUR AGE GATE (contract §5) is the important rule here. Server-side
 * dedupe lives in CacheService, whose hard ceiling is 6 hours. Past that the key
 * is gone and a replay would append a SECOND row to his sheet with nothing to
 * stop it. So items older than 6 h are never auto-flushed: they surface as a
 * card he taps deliberately. A duplicate then becomes his decision rather than
 * our silent bug — and silently double-counting his money is the one failure
 * this app must never commit.
 */
const K_OUTBOX = 'masareef.outbox.v1';
export const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

function readAll() {
  try {
    const raw = localStorage.getItem(K_OUTBOX);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAll(items) {
  try { localStorage.setItem(K_OUTBOX, JSON.stringify(items)); } catch { /* full or blocked */ }
}

export function enqueue(item) {
  const items = readAll();
  items.push({ ...item, queuedAt: item.queuedAt ?? Date.now() });
  writeAll(items);
  return items.length;
}

export function remove(id) {
  writeAll(readAll().filter((i) => i.id !== id));
}

export function all() { return readAll(); }

/** Retrying cannot fix these: the row is already sorted, or can never be written. */
export const FINAL_ERRORS = ['bad_category', 'bad_amount', 'row_not_found', 'row_changed'];

/** Marks one item, in place (audit r3: a receipt the server held as a book duplicate). */
export function mark(id, patch) {
  writeAll(readAll().map((i) => (i.id === id ? { ...i, ...patch } : i)));
}

export function clear() { writeAll([]); }

/**
 * Fresh items may auto-flush; stale ones require a deliberate tap.
 *
 * `ageGated: false` opts an item out of the 6 h rule. That is correct for
 * `fix_category` and ONLY for it: its safety does not come from the expiring
 * dedupe cache but from the optimistic-concurrency guard, which re-checks that
 * the category cell still holds the value the client saw. That check never
 * expires — a replay against a row Dad already fixed comes back `row_changed`
 * or `row_not_found` and writes nothing. Writes that APPEND rows (`manual`,
 * later `receipt_confirm`) have no such guard and stay gated.
 */
export function partition(now = Date.now()) {
  const items = readAll();
  // A `blocked` item waits for HIS decision, so it is shown as a card at once (audit r3).
  const isStale = (i) => !!i.blocked || (i.ageGated !== false && now - i.queuedAt >= SIX_HOURS_MS);
  return { fresh: items.filter((i) => !isStale(i)), stale: items.filter(isStale) };
}

/**
 * Flush the fresh items. `send(item)` must resolve to the parsed envelope.
 *
 * An item is dropped from the queue when the server accepted it — including
 * `skipped:'duplicate'`, which means a previous attempt already landed the row,
 * and including a permanent rejection like `bad_category`, which retrying can
 * never fix. Transport failures leave it queued for the next attempt.
 */
export async function flush(send, now = Date.now()) {
  // v4 P5 (R19, A7): an item still inside its undo window (`holdUntil`) is not
  // sent yet — «رجوع» removes it from the queue before it ever leaves the phone.
  const fresh = partition(now).fresh.filter((i) => !(i.holdUntil > now));
  // `dropped` and `retrying` are counted SEPARATELY on purpose. Both leave the
  // happy path, but they mean opposite things to the person holding the phone:
  // a dropped item is finished and needs no further thought, while a retrying
  // one is still owed. Collapsing them into one "failed" number guarantees the
  // UI eventually tells him something is pending when it is actually resolved.
  let sent = 0, dropped = 0, retrying = 0;

  for (const item of fresh) {
    try {
      const res = await send(item);
      if (res?.ok && res.skipped === 'book_duplicate') {
        // NOTHING WAS WRITTEN (audit r3): the server found the same expense in his
        // book and held this one back. Dropping it «as sent» lost the receipt in
        // silence — the receipt screen refuses exactly that. It becomes a card he
        // decides on; sending from the card carries dupAck.
        mark(item.id, { blocked: true });
        retrying++;
      } else if (res?.ok) {
        remove(item.id);
        sent++;
      } else if (FINAL_ERRORS.includes(res?.error)) {
        // Retrying cannot help. `row_not_found`/`row_changed` specifically mean
        // the row is already sorted — dropping is the correct outcome, not a loss.
        remove(item.id);
        dropped++;
      } else {
        retrying++;
      }
    } catch {
      retrying++;   // still offline — leave it queued, try again next time
      break;        // no point hammering the rest of the queue
    }
  }
  return { sent, dropped, retrying, settled: sent + dropped };
}

/**
 * THE ROWS STILL ON THE PHONE (v4 P5) — appended entries (`manual`,
 * `receipt_confirm`) that have not reached his sheet: held for undo, or waiting
 * for the network. The Book shows them, marked, and says their sum plainly; it
 * never folds them into the sheet's figures silently.
 */
export function onPhone(now = Date.now()) {
  return readAll()
    // A receipt HELD as a book duplicate is not «waiting to be logged» — it waits
    // for his decision on its card, and its money is already in the book (audit r4).
    .filter((i) => !i.blocked && (i.kind === 'manual' || i.kind === 'receipt_confirm'))
    .map((i) => ({ ...i, held: i.holdUntil > now }));
}
