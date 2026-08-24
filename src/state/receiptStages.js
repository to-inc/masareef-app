/**
 * The receipt job state machine — PURE. No IndexedDB, no fetch, no React.
 *
 * WHY IT IS SEPARATE FROM THE QUEUE. Every decision worth getting right here is
 * a decision about STATE, not about storage: which job runs next, what stage a
 * given server answer produces, whether a job is still his to act on. Bolted
 * onto IndexedDB those decisions would be testable only through a database that
 * does not exist in Node — so they would be tested by eye, which for a state
 * machine means not tested. Separated, each one is a plain function with a
 * discriminating fixture.
 *
 * THE STAGES, and why exactly these:
 *
 *   queued     — captured, waiting. The camera is already free; this is the
 *                whole point of the queue.
 *   reading    — the one extraction currently in flight. At most one, ever.
 *   ready      — extracted, IS a receipt, awaiting HIS review on a confirm card.
 *                D10: nothing is written to the sheet until he taps أكّد.
 *   notReceipt — extracted, and the answer was "this is not a receipt". A
 *                VERDICT to read and dismiss, never a card to confirm.
 *   dismissed  — he read that verdict and closed it. Terminal, and kept rather
 *                than deleted so the photo is still his to see.
 *   failed     — extraction failed for a reason a retry might fix. Retryable.
 *   capped     — the daily vision budget is spent. NOT a failure: the photo is
 *                intact and waits for tomorrow. Saying "failed" here would be a
 *                lie about a system working exactly as designed.
 *
 * **`notReceipt` and `dismissed` are new (R-receipts 4 + 5, 2026-08-14), and the
 * first of them fixes a bug at its root.** `resultStage` used to answer `ready`
 * for ANY `ok` response, so a photo the server judged not to be a receipt was
 * stored as "Ready — check it" and said so forever: he had two of those zombies
 * on film, and there was no way to dismiss one because the label promised a card
 * that had nothing to confirm. The label was honest about the CALL succeeding and
 * dishonest about what it found.
 *
 * There is deliberately no `confirmed` stage: a confirmed job leaves the queue.
 * A terminal state that lingers is a row waiting to be written twice. `dismissed`
 * is safe to keep for exactly the opposite reason — a not-a-receipt can never
 * become a row at all, so nothing about it is waiting to be written.
 *
 * PROGRESS IS A STAGE, NEVER A PERCENTAGE. Extraction is one opaque call — we
 * cannot know it is "60% done", and rendering a number we invented would break
 * the honest-render law in the one place he is watching most closely. The law is
 * about what a person READS, and a progress bar reads as knowledge.
 */

export const STAGES = ['queued', 'reading', 'ready', 'notReceipt', 'dismissed', 'failed', 'capped'];

/** Stages that still need something to happen TO them, in worker order. */
export const PENDING_STAGES = ['queued', 'reading'];

export function isStage(stage) {
  return STAGES.indexOf(stage) !== -1;
}

/**
 * The next job the worker should pick up.
 *
 * Oldest-first, and ONLY when nothing is already in flight — the serial rule is
 * enforced here rather than in the caller, so it cannot be forgotten by a second
 * caller later. Returns null when the queue is idle-but-busy, which is a
 * different thing from empty and the caller must not treat them alike.
 */
export function nextJob(jobs) {
  if (!Array.isArray(jobs)) return null;
  if (jobs.some((j) => j.stage === 'reading')) return null;   // one at a time
  const queued = jobs
    .filter((j) => j.stage === 'queued')
    .sort((a, b) => (a.queuedAt || 0) - (b.queuedAt || 0));
  return queued.length ? queued[0] : null;
}

/**
 * What stage does this extraction attempt produce?
 *
 * `res` is the parsed body (or null if the call threw). `threw` says the call
 * never completed — offline, timeout — which is retryable and must NOT be
 * confused with a server that answered "no".
 *
 * The cap is singled out deliberately. `daily-limit` is the system working:
 * the photo is safe, the budget is spent, tomorrow it proceeds. Reporting that
 * as `failed` would invite him to retry all day against a wall.
 */
/**
 * IS THIS A TRANSACTION LIST? (D20, 06 §3.5.)
 *
 * ⚠️ ASKED BEFORE `receiptVerdict`, ALWAYS — and the ordering is the whole fix.
 * A list answers `is_receipt: false` deliberately, so that a client which never
 * heard of D20 degrades to its not-a-receipt branch instead of misbehaving. Ask
 * the verdict first and a list is a refusal forever, which is precisely what
 * happened on his phone: three bank screenshots classified `notReceipt`, and —
 * because the worker stores a body only for `ready` — **their extracted rows
 * were thrown away**, after the vision call had been made and paid for.
 *
 * Requires the rows to actually be present. A `transaction_list` with no
 * `entries` is a truncated answer, not an offer, and it must fall through to the
 * `bad_extraction` path rather than opening an empty review screen.
 */
export function isTransactionList(res) {
  const e = res && res.extraction;
  if (!e || typeof e !== 'object') return false;
  /**
   * ⚠️ `e.entries`, NOT `res.entries` — VERIFIED AGAINST `Code.gs`, THE HARD WAY.
   * `receiptExtractResponse_` returns `{ok, extraction: decorateListRows_(x),
   * entriesTotal, defaultMethod}` — the rows ride INSIDE the extraction; only
   * the count is top-level. The first version of this function read
   * `res.entries` — a shape taken from OUR OWN MOCK rather than from the server
   * — so every real list answered `false` here, fell to the truncated-list
   * guard below, and rendered «Did not work — try again» on a response that was
   * complete and correct. Tarek hit it within the hour, on all three photos.
   * Mock parity, fifth occurrence, and the first one that was the mock's AUTHOR
   * certifying his own assumption.
   */
  return e.doc_type === 'transaction_list'
    && Array.isArray(e.entries) && e.entries.length > 0;
}

export function resultStage(res, threw) {
  if (threw) return { stage: 'failed', error: 'offline', retryable: true };
  if (res && res.ok) {
    // A list is a READY job: it has something for him to act on, and `ready` is
    // the only stage whose body the worker keeps. Which surface it opens is
    // decided at review time from `doc_type`, not by a stage of its own — one
    // more stage would have to be threaded through every reader in this file.
    if (isTransactionList(res)) return { stage: 'ready', error: null, retryable: false };
    /**
     * A LIST THAT ARRIVED WITH NO ROWS IS A BROKEN READ, NOT A VERDICT.
     *
     * Without this it fell through to `receiptVerdict`, which sees
     * `is_receipt:false` and answers «Not a receipt» — a confident wrong verdict
     * about a photo the server actually recognised, and a dead end, because
     * `notReceipt` is terminal. `failed`/`bad_extraction` is the same judgement
     * this function already makes for a truthy envelope with nothing usable in
     * it, and it is retryable, which is the honest offer here.
     *
     * (Caught by running the four cases rather than by reading them: the comment
     * above claimed this fall-through and the code did not have it.)
     */
    if (res.extraction && res.extraction.doc_type === 'transaction_list') {
      return { stage: 'failed', error: 'bad_extraction', retryable: true };
    }
    /**
     * `ok` says the CALL succeeded. It does not say what was found, and
     * conflating those is what put two immortal «Ready — check it» rows on his
     * screen. A verdict of "not a receipt" is a real, final answer — it just is
     * not a card to confirm.
     */
    const verdict = receiptVerdict(res);
    if (verdict === true) return { stage: 'ready', error: null, retryable: false };
    if (verdict === false) return { stage: 'notReceipt', error: null, retryable: false };
    /**
     * `ok:true` carrying no readable extraction — a truncated response or an
     * older deployment. It is neither a receipt nor a verdict, and calling it
     * either would be inventing an answer the server never gave. Same judgment
     * as `isSummaryShape`: a truthy envelope with none of the fields is a failed
     * read, and it is retryable because the next attempt may arrive whole.
     */
    return { stage: 'failed', error: 'bad_extraction', retryable: true };
  }

  const code = (res && res.error) || 'unknown';
  /**
   * ⚠️ THE SERVER'S STRING, NOT A PLAUSIBLE ONE. `handleReceiptExtract_`
   * returns `error:'daily-limit'` when the vision budget is spent (its own
   * suite pins that exact string) — this line matched `'ocr_daily_cap'`, a
   * code no server has ever sent, so a capped photo was classed
   * failed/retryable and the whole `capped` stage (with its
   * wait-for-tomorrow release) was DEAD CODE while every suite stayed green.
   * Verification finding; the correct string already existed twelve lines
   * away in ReceiptView's error map, which is how vocabulary drift looks.
   */
  if (code === 'daily-limit') return { stage: 'capped', error: code, retryable: false };
  if (code === 'ocr_not_configured') return { stage: 'failed', error: code, retryable: false };
  return { stage: 'failed', error: code, retryable: true };
}

/**
 * Did the server say this photo IS a receipt?  `true` | `false` | `null`.
 *
 * Three answers, not two, and the third is the point: `null` means we have no
 * usable verdict, which must never be flattened into "no". `is_receipt` is
 * tested with `=== true` / `=== false` so a missing field, a string `"false"`,
 * or a truncated body all land in `null` rather than being read as a decision.
 */
export function receiptVerdict(res) {
  const e = res && res.extraction;
  if (!e || typeof e !== 'object') return null;
  if (e.is_receipt === true) return true;
  if (e.is_receipt === false) return false;
  return null;
}

/**
 * THE STAGE A JOB ACTUALLY MEANS — one definition, used by every reader.
 *
 * `resultStage` classifies correctly from today on. This exists because his
 * device already holds jobs stored under the OLD rule: `stage:'ready'` on a
 * photo whose extraction says `is_receipt:false`. Those are the two zombies on
 * his recording, and a fix that only classifies NEW jobs would leave them
 * exactly where they are.
 *
 * Deriving rather than migrating is deliberate: a migration writes on every boot
 * until it converges and can race the worker mid-`reading`, while a derivation
 * is a pure function of what is stored, gives the same answer every time, and is
 * the only place any reader asks the question.
 */
export function effectiveStage(job) {
  if (!job || !isStage(job.stage)) return null;
  if (job.stage !== 'ready') return job.stage;
  // Same precedence as `resultStage`, for the same reason — the two layers must
  // never disagree about one job, and a stored list would otherwise derive to
  // `notReceipt` on every read and undo the classification above.
  if (isTransactionList(job.extraction)) return 'ready';
  const verdict = receiptVerdict(job.extraction);
  if (verdict === true) return 'ready';
  if (verdict === false) return 'notReceipt';
  // Stored ready, no usable verdict: not a card to check and not a verdict to
  // read. It agrees with `resultStage`'s answer for the same shape, on purpose —
  // the two layers must never disagree about one job.
  return 'failed';
}

/**
 * The shop this job turned out to be, or `null` while we do not know yet.
 *
 * Lives here, beside `receiptVerdict`, because both read the same stored body
 * and one file should know that shape. `null` is the honest answer before an
 * extraction lands — the card then names itself by the time it was taken, which
 * is a fact, rather than by a placeholder, which is not.
 */
export function jobMerchant(job) {
  const e = job && job.extraction && job.extraction.extraction;
  if (!e || typeof e !== 'object') return null;
  const name = e.merchant_display || e.merchant_latin;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

/**
 * Jobs the CAP is holding, so the count can be stated plainly rather than
 * implied by five identical rows.
 */
export function cappedCount(jobs) {
  return (Array.isArray(jobs) ? jobs : []).filter((j) => j.stage === 'capped').length;
}

/**
 * A job he can act on right now: review it, read its verdict, or retry it.
 *
 * Asks `effectiveStage`, never `job.stage`, so a legacy not-a-receipt stored as
 * `ready` offers the DISMISS it needs rather than a review card with nothing to
 * confirm. `dismissed` is deliberately absent — it is settled, and a settled job
 * asking for another tap is the zombie in a new costume.
 */
export function isActionable(job) {
  const stage = effectiveStage(job);
  if (stage === 'ready' || stage === 'notReceipt') return true;
  return stage === 'failed' && !!job.retryable;
}

/**
 * Cap-held jobs become workable again once the budget resets.
 *
 * Deliberately NOT automatic on a timer inside the worker: the reset is the
 * server's business and the client does not know when it happens. This is
 * called when a new day is observed, so the transition is caused by something
 * real rather than by a guess about someone else's clock.
 */
export function releaseCapped(jobs) {
  return (Array.isArray(jobs) ? jobs : []).map((j) =>
    (j.stage === 'capped' ? { ...j, stage: 'queued', error: null } : j));
}
