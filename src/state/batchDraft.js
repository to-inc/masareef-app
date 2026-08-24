/**
 * THE BATCH REVIEW DRAFT — his ticks and his edits, held on this device.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS SCREEN IS. One photograph of a banking-app transaction LIST becomes
 * N candidate rows; he ticks; one confirm writes them. Reconciliation, not
 * capture — the five-second law governs capture, and the capture already
 * happened when he took the screenshot.
 *
 * WHY THE DRAFT LIVES HERE AND NOT ON THE SERVER (ratified, CONTRACT-04 ②).
 * The extraction the server caches lives SIX HOURS — Apps Script's ceiling, not
 * a chosen number. Fourteen rows ticked one at a time is not six-hour work in
 * the sense that matters: he starts, is interrupted, comes back next morning.
 * If the draft lived only in that cache, every tick would be gone.
 *
 * So the split is by COST: his edits are expensive and are kept here for as long
 * as he likes; the extraction is cheap and is allowed to expire. When it does,
 * one fresh vision call re-reads the photo and his edits re-attach BY INDEX.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * WHAT MAY NEVER LEAVE THIS FILE ON THE WIRE.
 *
 * `row_status` is contract law, and the server re-reads it from its OWN cached
 * extraction (`rcpthash_<sourceHash>` → `entries[index].row_status`). A
 * request-carried status is "the UI is the only guard" wearing server clothes —
 * and the row it would let through is a `declined` one, which is money that
 * never left his account, written into his book with nothing on the screen to
 * notice it by.
 *
 * The client may carry his EDITS — amount, category, description, date, method —
 * because those have always been his (receipt_confirm has worked this way since
 * D10). The distinction is not "client data vs server data"; it is *what he
 * decided* versus *what the machine read*.
 */
export const EDITABLE_FIELDS = ['amount', 'category', 'description', 'date', 'method'];

/** The six the extractor may emit (06 §3.5). */
export const ROW_STATUSES = ['completed', 'declined', 'pending', 'incoming', 'roundup', 'unclear'];

/**
 * The four that may ever become a row in his book.
 *
 * `declined` is absent because the money never left the account. `incoming` is
 * absent because income is out of scope by design. Mirrors the server's
 * `WRITABLE_ROW_STATUSES` — and mirrors it rather than deriving from it, because
 * the server is the enforcer and this copy exists only to avoid OFFERING him a
 * tick the write will refuse. If the two ever disagree the server wins, loudly.
 */
export const WRITABLE_STATUSES = ['completed', 'pending', 'roundup', 'unclear'];

export const isWritable = (status) => WRITABLE_STATUSES.indexOf(status) !== -1;

/**
 * WHICH ROWS ARRIVE TICKED.
 *
 * Only `completed` — a purchase the bank has settled and he almost certainly
 * made. Everything else writable is OFF and tickable by deliberate tap, each for
 * its own reason: `pending` may yet settle, `unclear` is ours to have failed at,
 * `roundup` is a taxonomy question that is Tarek's seat rather than ours.
 *
 * Non-writable rows are not "off" — they have no tick at all. A control he
 * cannot use is a question about why.
 */
export const defaultTicked = (row) => !!row && row.row_status === 'completed';

/**
 * ROW IDENTITY — which photo, and where in it.
 *
 * `sourceHash` is that image's `clientHash`; `index` is its position in that
 * extraction's `entries`. The pair is what lets the server re-read the row's
 * status from its own cache, which is the whole reason a merged batch can be
 * status-checked at all (CONTRACT-04 ①). Without it, a batch assembled from
 * three photos is unverifiable.
 */
export const rowKey = (row) => `${(row && row.sourceHash) || ''}#${row && row.index != null ? row.index : ''}`;

/**
 * TWIN IDENTITY — the same purchase, however it reached the screen.
 *
 * date + amount + currency. METHOD IS EXCLUDED DELIBERATELY: the same purchase
 * can be read as `card` in one capture and `unknown` in another, and a key that
 * disagreed with itself across two photos of one transaction would flag nothing.
 * Same key the book check uses, so "already in your book" and "twice on your
 * screen" are answering the same question.
 *
 * A null amount cannot twin — an unpriced row has nothing to match on, and
 * treating two of them as the same purchase would be a guess.
 */
export function twinKey(row) {
  if (!row || row.amount == null) return null;
  return `${row.date || ''}|${row.amount}|${row.currency || ''}`;
}

/**
 * MERGE THE PHOTOS — at the screen, never at the server (CONTRACT-04 ①).
 *
 * Each photo stays its own extraction and its own vision call; the server never
 * learns two screenshots are related. This is the one list he reads, ordered by
 * date then by the order the rows appeared in their capture.
 *
 * ——— OVERLAP IS THE NORMAL CASE, NOT THE EDGE.
 *
 * He scrolls and snaps, so the same purchase appears in two photos. Twins are
 * FLAGGED, NEVER MERGED and NEVER auto-dropped: two identical real purchases
 * exist (the Recent settle-key lesson), and silently collapsing them would
 * delete an expense he made. The FIRST occurrence keeps its default; every later
 * one is forced OFF and told why, so the safe state needs no action from him and
 * the unsafe one needs a deliberate tap.
 */
export function mergeJobs(jobs) {
  const rows = [];
  (Array.isArray(jobs) ? jobs : []).forEach((job, photoOrder) => {
    if (!job || !Array.isArray(job.entries)) return;
    job.entries.forEach((e, i) => {
      rows.push({ ...e, sourceHash: job.sourceHash || job.clientHash || '', index: i, photoOrder });
    });
  });

  // Date first, then capture order — so he can read down the list against the
  // screenshot in his hand. Rows with no readable date sort last rather than
  // being dropped: an undated row is still an expense he may want.
  /**
   * DATE, THEN THE PHOTO HE SENT, THEN DOWN THAT PHOTO.
   *
   * ——— WHY PHOTO ORDER IS A SORT KEY AND NOT A DETAIL. Found by running it:
   * ordering by `index` alone across photos INTERLEAVES them —
   * `A#0 B#0 A#1 B#1 A#2` — so on a day covered by two captures he can read down
   * neither screenshot. That destroys the only reconciliation this screen exists
   * to let him perform: phone in one hand, bank app in the other, line by line.
   *
   * Rows with no readable date sort LAST rather than being dropped — an undated
   * row is still an expense he may want, and `'￿'` is above every digit.
   */
  rows.sort((a, b) => {
    const da = a.date || '￿';
    const db = b.date || '￿';
    if (da !== db) return da < db ? -1 : 1;
    if (a.photoOrder !== b.photoOrder) return a.photoOrder - b.photoOrder;
    return a.index - b.index;
  });

  const seen = new Map();
  return rows.map((row) => {
    const key = twinKey(row);
    if (!key) return { ...row, twinOf: null };
    if (seen.has(key)) return { ...row, twinOf: seen.get(key) };
    seen.set(key, rowKey(row));
    return { ...row, twinOf: null };
  });
}

/**
 * The ticks a freshly merged list starts with.
 *
 * A twin is OFF regardless of its status: the first copy carries the purchase,
 * and a second tick would write it twice.
 */
export function initialTicks(rows) {
  const ticks = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!isWritable(row.row_status)) continue;       // no tick exists to set
    ticks[rowKey(row)] = row.twinOf ? false : defaultTicked(row);
  }
  return ticks;
}

/**
 * WHAT GOES ON THE WIRE — his edits, the identity, and nothing else.
 *
 * `row_status` is stripped by construction rather than by omission: the payload
 * is BUILT from an allow-list, so a future field added to the row cannot ride
 * along by accident. That is the same shape `manualPayload` uses, and for the
 * same reason — a chooser's label once reached the wire as a method and wrote
 * card money into the Cash column.
 */
export function toConfirmRows(rows, ticks, edits = {}) {
  const out = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = rowKey(row);
    if (!ticks || ticks[key] !== true) continue;
    if (!isWritable(row.row_status)) continue;       // belt and braces; the server refuses too
    const edited = { ...row, ...(edits[key] || {}) };
    const payload = { sourceHash: row.sourceHash, index: row.index };
    for (const f of EDITABLE_FIELDS) {
      if (edited[f] !== undefined) payload[f] = edited[f];
    }
    out.push(payload);
  }
  return out;
}

/**
 * RE-ATTACH HIS EDITS AFTER A RE-SNAP (CONTRACT-04 ②).
 *
 * When the six-hour extraction is gone the server answers `extraction_expired`
 * and writes NOTHING. The draft is not dropped and is not sent hoping — the card
 * says so plainly and offers «صوّرها تاني». One fresh vision call re-reads the
 * photo, and his edits come back BY INDEX.
 *
 * Index, not content: the whole point is that the new extraction may read a row
 * slightly differently, and his edit is the correction to exactly that row. The
 * new sourceHash replaces the old one, because the identity the server will
 * status-check against is the NEW extraction's.
 *
 * A shorter re-read drops the edits that have nowhere to land — the alternative
 * is re-attaching an amount to a row that is not the one he corrected.
 */
export function reattachEdits(oldEdits, oldRows, newRows) {
  const byIndex = new Map();
  for (const row of Array.isArray(oldRows) ? oldRows : []) {
    const e = oldEdits && oldEdits[rowKey(row)];
    if (e) byIndex.set(row.index, e);
  }
  const next = {};
  for (const row of Array.isArray(newRows) ? newRows : []) {
    const e = byIndex.get(row.index);
    if (e) next[rowKey(row)] = e;
  }
  return next;
}

/**
 * HOW MANY EXPENSES ARE WAITING, UNLOGGED — the count that must be visible
 * somewhere he passes daily (Planner 4, CONTRACT-10).
 *
 * A pending batch is MONEY MISSING FROM HIS BOOK. §2.2's honest-incompleteness
 * law applies to the app's own queue exactly as it applies to a month's totals:
 * silence here is the same defect as «This week 0» — a screen that looks complete
 * while something real is absent from it.
 *
 * Counts rows that COULD still become entries: writable, and not already
 * settled. A declined row is not waiting for anything, and a row he has
 * deliberately left unticked is still waiting — the decision he has not made is
 * exactly what the count is for.
 */
export function unsettledCount(draft) {
  if (!draft || draft.settled) return 0;
  const rows = Array.isArray(draft.rows) ? draft.rows : [];
  return rows.filter((r) => isWritable(r && r.row_status)).length;
}

/* ——————————————————————— persistence ——————————————————————— */

const KEY = 'masareef.batchDraft.v1';

/**
 * Kept for as long as he likes. There is no age-out here on purpose: the thing
 * that expires is the EXTRACTION, and that expiry is discovered from the
 * server's answer rather than guessed from a clock on this device. A draft the
 * client had quietly binned would be his ticks thrown away by a timer he never
 * saw.
 */
export function loadDraft() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    return raw && typeof raw === 'object' ? raw : null;
  } catch {
    return null;
  }
}

export function saveDraft(draft) {
  try {
    if (draft && typeof draft === 'object') localStorage.setItem(KEY, JSON.stringify(draft));
  } catch { /* a lost draft costs him ticks, never an expense */ }
  return draft || null;
}

export function clearDraft() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to do */ }
}
