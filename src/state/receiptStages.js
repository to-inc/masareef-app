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
 *   queued   — captured, waiting. The camera is already free; this is the whole
 *              point of the queue.
 *   reading  — the one extraction currently in flight. At most one, ever.
 *   ready    — extracted, awaiting HIS review on a confirm card. D10: nothing
 *              is written to the sheet until he taps أكّد.
 *   failed   — extraction failed for a reason a retry might fix. Retryable.
 *   capped   — the daily vision budget is spent. NOT a failure: the photo is
 *              intact and waits for tomorrow. Saying "failed" here would be a
 *              lie about a system working exactly as designed.
 *
 * There is deliberately no `confirmed` stage: a confirmed job leaves the queue.
 * A terminal state that lingers is a row waiting to be written twice.
 *
 * PROGRESS IS A STAGE, NEVER A PERCENTAGE. Extraction is one opaque call — we
 * cannot know it is "60% done", and rendering a number we invented would break
 * the honest-render law in the one place he is watching most closely. The law is
 * about what a person READS, and a progress bar reads as knowledge.
 */

export const STAGES = ['queued', 'reading', 'ready', 'failed', 'capped'];

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
 * The cap is singled out deliberately. `ocr_daily_cap` is the system working:
 * the photo is safe, the budget is spent, tomorrow it proceeds. Reporting that
 * as `failed` would invite him to retry all day against a wall.
 */
export function resultStage(res, threw) {
  if (threw) return { stage: 'failed', error: 'offline', retryable: true };
  if (res && res.ok) return { stage: 'ready', error: null, retryable: false };

  const code = (res && res.error) || 'unknown';
  if (code === 'ocr_daily_cap') return { stage: 'capped', error: code, retryable: false };
  if (code === 'ocr_not_configured') return { stage: 'failed', error: code, retryable: false };
  return { stage: 'failed', error: code, retryable: true };
}

/**
 * Jobs the CAP is holding, so the count can be stated plainly rather than
 * implied by five identical rows.
 */
export function cappedCount(jobs) {
  return (Array.isArray(jobs) ? jobs : []).filter((j) => j.stage === 'capped').length;
}

/** A job he can act on right now: review it, or retry it. */
export function isActionable(job) {
  return !!job && (job.stage === 'ready' || (job.stage === 'failed' && job.retryable));
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
