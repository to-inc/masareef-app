/**
 * The serial receipt worker (WS4-Q).
 *
 * ONE extraction in flight, ever. Not because the server cannot take two, but
 * because two would race the daily vision budget and because he is watching a
 * list: jobs finishing out of order, or two rows both saying "reading", is a
 * list that has stopped describing reality.
 *
 * The queue and the extract call are INJECTED rather than imported, so the whole
 * machine can be driven in Node with no IndexedDB and no network. That is not
 * test-convenience decoration — the serial guarantee is the thing most worth
 * asserting here, and it is unassertable against a real database.
 *
 * NOTHING HERE WRITES TO HIS SHEET. Extraction is read-only (contract §3.3); a
 * job ends at `ready` and waits for him to tap أكّد on its confirm card. A batch
 * of receipts becomes a stack of cards, never a stack of rows (D10).
 */
import { nextJob, resultStage } from './receiptStages.js';

export function createWorker({ queue, extract, onChange }) {
  let running = false;
  let processed = 0;
  /** id → the controller aborting THAT job's extraction, while it is in flight. */
  const inFlight = new Map();
  /** Jobs cancelled mid-`reading`, whose outcome must be thrown away unread. */
  const cancelled = new Set();

  async function pump() {
    // The serial guard lives HERE, not in the callers. Every capture kicks the
    // worker, so there are already several callers; a guard in one of them is a
    // guard in none.
    if (running) return { started: false, processed: 0 };
    running = true;
    const before = processed;
    try {
      for (;;) {
        const jobs = await queue.all();
        const job = nextJob(jobs);
        if (!job) break;

        await queue.update(job.id, { stage: 'reading', error: null });
        onChange?.();

        let res = null;
        let threw = false;
        const ctrl = new AbortController();
        inFlight.set(job.id, ctrl);
        try {
          res = await extract({
            image: job.base64, clientHash: job.clientHash, snapDate: job.snapDate,
            signal: ctrl.signal,
          });
        } catch {
          threw = true;
        } finally {
          inFlight.delete(job.id);
        }

        /**
         * CANCEL IS NOT UNDO, and this is where that is enforced.
         *
         * He deleted this job while it was being read. Its row is already gone
         * from the queue, so writing an outcome here would put it BACK — a card
         * reappearing seconds after he cancelled it, which reads as the app
         * refusing to be told. The result is dropped unread, and `processed` is
         * not incremented: nothing was carried to a terminal stage, because
         * there is no longer a job to carry.
         *
         * Nothing about the sheet is at stake either way — extraction writes
         * nothing (§3.3) — so the only thing cancel can protect is the list, and
         * the list is what he was complaining about.
         */
        if (cancelled.has(job.id)) {
          cancelled.delete(job.id);
          onChange?.();
          continue;
        }

        const outcome = resultStage(res, threw);
        await queue.update(job.id, {
          stage: outcome.stage,
          error: outcome.error,
          retryable: outcome.retryable,
          // Only a `ready` job carries an extraction. Storing the body of a
          // failed attempt would let a later render show fields from a call the
          // server refused.
          extraction: outcome.stage === 'ready' ? res : null,
          /**
           * THE REASON SURVIVES THE REFUSAL (chunk N1).
           *
           * The rule above stands — the refused BODY is still dropped. This is
           * one published enum value (06 §6 `not_expense_reason`), stored so the
           * queue row can say WHY rather than only «not a receipt», which is
           * true of a pending authorization, a balance screen, an incoming
           * transfer and a menu alike and therefore answers none of them.
           *
           * Persisting it here rather than reading it at render time is what
           * makes the label REACHABLE: the row renders from the stored job long
           * after `res` is gone, so a label fix alone would have been a string
           * that never fires in the field.
           *
           * `null` when the server named no reason — an older deployment, or
           * `other`, which means "no more specific reason" and is exactly when
           * the generic label is the honest one.
           */
          notExpenseReason: (outcome.stage === 'notReceipt'
            && res && res.extraction && res.extraction.not_expense_reason) || null,
        });
        processed += 1;
        onChange?.();
      }
    } finally {
      running = false;
    }
    return { started: true, processed: processed - before };
  }

  /**
   * Cancel one job (R-receipts 3).
   *
   * Returns whether an extraction was actually aborted, and the caller needs
   * that answer rather than a courtesy `true`: a job cancelled while `reading`
   * has a request in the air, and one cancelled while `queued` never did.
   * Removing it from the queue is the CALLER's step in both cases — this owns
   * the in-flight half only, so there is exactly one place that deletes.
   */
  function cancel(id) {
    const ctrl = inFlight.get(id);
    /**
     * Already cancelling counts as NOT cancelling again. The controller stays in
     * `inFlight` until the aborted call actually settles, so without this a
     * second press — an ordinary double-tap, on a screen designed for someone
     * who taps slowly and twice — would re-abort and report that it had done
     * something. The honest answer to the second tap is that nothing changed.
     */
    if (!ctrl || cancelled.has(id)) return false;
    // Marked BEFORE the abort: `abort()` can settle the awaiting `extract` in
    // the same microtask, and a flag set afterwards would arrive too late to
    // stop the outcome being written.
    cancelled.add(id);
    ctrl.abort();
    return true;
  }

  return {
    pump,
    cancel,
    isRunning: () => running,
    /** Is THIS job the one currently being read? The list uses it for its label. */
    isInFlight: (id) => inFlight.has(id),
    /** Total jobs taken to a terminal stage in this session — tests assert on it. */
    processedCount: () => processed,
  };
}
