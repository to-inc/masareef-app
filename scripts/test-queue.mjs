#!/usr/bin/env node
/**
 * The receipt queue's state machine and serial worker (WS4-Q).
 * `npm run check:queue`
 *
 * The queue itself lives in IndexedDB, which does not exist in Node — so the
 * DECISIONS were built as pure functions and the worker takes its queue and its
 * extract call as arguments. Everything below is therefore real: no database is
 * faked into pretending, because none is needed.
 *
 * Per the ledger, each stage transition gets a DISCRIMINATING fixture: the
 * question asked of every assertion here is "what wrong implementation would
 * still pass this?" A job that is `queued` and a job that is `reading` must be
 * separable by assertion, not merely by intention.
 */
import {
  STAGES, isStage, nextJob, resultStage, cappedCount, isActionable, releaseCapped,
} from '../src/state/receiptStages.js';
import { createWorker } from '../src/state/receiptWorker.js';

let pass = 0;
const failures = [];
const eq = (a, b, label) => {
  if (Object.is(a, b)) { pass++; return; }
  failures.push(`${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const ok = (c, label) => eq(!!c, true, label);

const job = (id, stage, queuedAt, extra = {}) => ({ id, stage, queuedAt, ...extra });

// ——————————————————————————— the stage vocabulary
eq(STAGES.length, 5, 'exactly five stages — adding one silently is a design change');
ok(isStage('capped'), 'capped is a real stage, distinct from failed');
ok(!isStage('confirmed'), 'there is NO confirmed stage — a confirmed job leaves the queue');
ok(!isStage(''), 'the empty string is not a stage');
ok(!isStage(undefined), 'and neither is undefined — an unnamed state is not a synonym for queued');

// ——————————————————————————— which job runs next
eq(nextJob([]), null, 'an empty queue offers nothing');
eq(nextJob(null), null, 'and neither does a missing one — no crash');
eq(nextJob([job('a', 'queued', 200), job('b', 'queued', 100)]).id, 'b',
  'oldest first — he snapped b before a');
eq(nextJob([job('a', 'ready', 100), job('b', 'queued', 200)]).id, 'b',
  'a job awaiting HIS review does not block the worker');
eq(nextJob([job('a', 'failed', 100), job('b', 'queued', 200)]).id, 'b',
  'nor does a failed one');

/**
 * THE SERIAL RULE. `reading` blocks everything — and note the discrimination:
 * "returns null when busy" and "returns null when empty" are the same VALUE, so
 * a wrong implementation that ignored `reading` would still pass a test that
 * only checked the empty queue. This pair separates them.
 */
eq(nextJob([job('a', 'reading', 100), job('b', 'queued', 200)]), null,
  'nothing is picked up while one is in flight');
eq(nextJob([job('b', 'queued', 200)]).id, 'b',
  'and the SAME queue without the in-flight job does offer work');

// ——————————————————————————— what an attempt produces
eq(resultStage({ ok: true }, false).stage, 'ready', 'a good extraction is ready for review');
eq(resultStage({ ok: true }, false).retryable, false, 'and is not retryable — it succeeded');
eq(resultStage(null, true).stage, 'failed', 'a call that never completed is failed');
eq(resultStage(null, true).retryable, true, '…and retryable — offline is temporary');
eq(resultStage(null, true).error, 'offline', 'with the reason named, not blank');

/**
 * THE CAP IS NOT A FAILURE. The photo is intact and tomorrow it proceeds.
 * Calling it `failed` would invite him to retry all day against a wall — and
 * `retryable` is what separates the two, so both are asserted.
 */
eq(resultStage({ ok: false, error: 'ocr_daily_cap' }, false).stage, 'capped',
  'the daily cap is its own stage, not a failure');
eq(resultStage({ ok: false, error: 'ocr_daily_cap' }, false).retryable, false,
  'and retrying it today cannot help');
eq(resultStage({ ok: false, error: 'ocr_not_configured' }, false).stage, 'failed',
  'an unarmed key IS a failure…');
eq(resultStage({ ok: false, error: 'ocr_not_configured' }, false).retryable, false,
  '…but not one a retry fixes');
eq(resultStage({ ok: false, error: 'vision_failed' }, false).retryable, true,
  'a genuine extraction failure is worth retrying');
eq(resultStage({ ok: false }, false).error, 'unknown',
  'an error with no code is reported as unknown, never as success');
eq(resultStage({ ok: false }, false).stage, 'failed',
  'and an unrecognised answer NEVER lands in ready — the unnamed case fails loud');

// ——————————————————————————— what he can act on
ok(isActionable(job('a', 'ready', 1)), 'a ready job is his to review');
ok(isActionable(job('a', 'failed', 1, { retryable: true })), 'a retryable failure is his to retry');
ok(!isActionable(job('a', 'failed', 1, { retryable: false })), 'an unretryable one offers no button');
ok(!isActionable(job('a', 'queued', 1)), 'a queued job needs nothing from him');
ok(!isActionable(job('a', 'reading', 1)), 'nor does one being read');
ok(!isActionable(null), 'and a missing job does not crash the list');

eq(cappedCount([job('a', 'capped', 1), job('b', 'capped', 2), job('c', 'queued', 3)]), 2,
  'the cap count is stated plainly, not implied by identical rows');

const released = releaseCapped([job('a', 'capped', 1), job('b', 'failed', 2)]);
eq(released[0].stage, 'queued', 'a new day returns capped jobs to the queue');
eq(released[1].stage, 'failed', 'and leaves everything else alone');

// ——————————————————————————— the worker, driven for real
function fakeQueue(initial) {
  let jobs = initial.map((j) => ({ ...j }));
  return {
    all: async () => jobs.map((j) => ({ ...j })),
    update: async (id, patch) => {
      jobs = jobs.map((j) => (j.id === id ? { ...j, ...patch } : j));
      return true;
    },
    snapshot: () => jobs.map((j) => ({ ...j })),
  };
}

{
  // Jobs carry the fields the worker must hand to extract — asserting on real
  // values, not on the shape of `undefined`. (A first draft asserted
  // `'undefined,undefined'`, which is a fixture describing its own bug.)
  const q = fakeQueue([
    job('a', 'queued', 1, { clientHash: 'hash-a', base64: 'AAA', snapDate: '2026-08-01' }),
    job('b', 'queued', 2, { clientHash: 'hash-b', base64: 'BBB', snapDate: '2026-08-01' }),
  ]);
  const seen = [];
  const worker = createWorker({
    queue: q,
    extract: async ({ clientHash, image, snapDate }) => {
      seen.push({ clientHash, image, snapDate });
      return { ok: true, merchant: clientHash };
    },
  });
  await worker.pump();
  eq(seen.length, 2, 'the worker drains the whole queue');
  eq(seen.map((x) => x.clientHash).join(','), 'hash-a,hash-b',
    'each job is passed to extract, oldest first');
  eq(seen[0].image, 'AAA', 'and its IMAGE goes with it — not just its id');
  eq(seen[0].snapDate, '2026-08-01', 'and the capture date the server dates the row from');
  const after = q.snapshot();
  eq(after.every((j) => j.stage === 'ready'), true, 'both jobs end ready for review');
  eq(after.every((j) => j.extraction && j.extraction.ok), true, 'each carries its own extraction');
}

{
  /**
   * THE `reading` STAGE MUST ACTUALLY BE WRITTEN, mid-flight.
   *
   * The serial test above watches the worker's own lock, which is internal — so
   * a worker that never wrote `reading` to the QUEUE still passed it. But the
   * jobs list renders from the queue, and the whole point of this feature is a
   * status that reflects reality: without this write he sees "waiting" next to
   * the receipt currently being read.
   *
   * Observing it requires looking DURING the call — a stage that exists only
   * between two awaits is invisible to any assertion made afterwards.
   */
  // Recorded PER CALL. A single shared variable was overwritten by the second
  // extraction, by which time the first job was already `ready` — the fixture
  // reported a fault that did not exist. Observe each call on its own terms.
  const observations = [];
  const q = fakeQueue([
    job('a', 'queued', 1, { clientHash: 'a' }),
    job('b', 'queued', 2, { clientHash: 'b' }),
  ]);
  const worker = createWorker({
    queue: q,
    extract: async ({ clientHash }) => {
      const snap = q.snapshot();
      observations.push({
        me: clientHash,
        myStage: snap.find((j) => j.id === clientHash)?.stage,
        readingIds: snap.filter((j) => j.stage === 'reading').map((j) => j.id),
      });
      return { ok: true };
    },
  });
  await worker.pump();
  eq(observations.length, 2, 'both jobs were extracted');
  eq(observations.every((o) => o.myStage === 'reading'), true,
    'the job in flight is marked reading WHILE it is read — every time, not just the first');
  eq(observations.every((o) => o.readingIds.length === 1), true,
    'and exactly one job is in that state during each call');
  eq(observations.every((o) => o.readingIds[0] === o.me), true,
    'and it is the job actually being read, not some other one');
  eq(q.snapshot().some((j) => j.stage === 'reading'), false,
    'no job is left stranded in reading once the worker is done');
}

{
  // A failed job must NOT carry a body — otherwise a later render could show
  // fields from a call the server refused.
  const q = fakeQueue([job('a', 'queued', 1)]);
  const worker = createWorker({ queue: q, extract: async () => ({ ok: false, error: 'vision_failed' }) });
  await worker.pump();
  const j = q.snapshot()[0];
  eq(j.stage, 'failed', 'a refused extraction ends failed');
  eq(j.extraction, null, 'and carries NO extraction body');
  eq(j.error, 'vision_failed', 'with the server\'s reason kept');
}

{
  // THE SERIAL GUARANTEE, asserted by observation rather than by reading the
  // code: two pumps racing must not produce two concurrent extractions.
  let concurrent = 0;
  let maxConcurrent = 0;
  const q = fakeQueue([job('a', 'queued', 1), job('b', 'queued', 2), job('c', 'queued', 3)]);
  const worker = createWorker({
    queue: q,
    extract: async () => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 5));
      concurrent -= 1;
      return { ok: true };
    },
  });
  await Promise.all([worker.pump(), worker.pump(), worker.pump()]);
  eq(maxConcurrent, 1, 'NEVER more than one extraction in flight, even under concurrent pumps');
  eq(worker.processedCount(), 3, 'and every job is still processed exactly once');
}

{
  // A crash inside extract must not strand the worker as permanently "running",
  // which would silently stop every future capture from being read.
  const q = fakeQueue([job('a', 'queued', 1)]);
  const worker = createWorker({ queue: q, extract: async () => { throw new Error('boom'); } });
  await worker.pump();
  eq(worker.isRunning(), false, 'the worker releases its lock even when extraction throws');
  eq(q.snapshot()[0].stage, 'failed', 'and the job is marked failed rather than left reading');
  eq(q.snapshot()[0].retryable, true, 'offline-style failures stay retryable');
}

{
  // Nothing runs when there is nothing to run — and the worker says so rather
  // than reporting a phantom pass.
  const q = fakeQueue([job('a', 'ready', 1)]);
  let called = 0;
  const worker = createWorker({ queue: q, extract: async () => { called += 1; return { ok: true }; } });
  const r = await worker.pump();
  eq(called, 0, 'a queue of ready-for-review jobs triggers no extraction');
  eq(r.processed, 0, 'and the worker reports processing nothing');
}

const report = failures.length
  ? `❌ ${failures.length} / ${pass + failures.length} queue assertions failed:\n  - ${failures.join('\n  - ')}`
  : `✅ all ${pass} queue assertions passed`;
console.log(report);
process.exit(failures.length ? 1 : 0);
