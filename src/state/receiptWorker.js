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
        try {
          res = await extract({
            image: job.base64, clientHash: job.clientHash, snapDate: job.snapDate,
          });
        } catch {
          threw = true;
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
        });
        processed += 1;
        onChange?.();
      }
    } finally {
      running = false;
    }
    return { started: true, processed: processed - before };
  }

  return {
    pump,
    isRunning: () => running,
    /** Total jobs taken to a terminal stage in this session — tests assert on it. */
    processedCount: () => processed,
  };
}
