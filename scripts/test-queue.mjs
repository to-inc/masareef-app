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
  receiptVerdict, effectiveStage, jobMerchant,
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

/**
 * A REALISTIC success body.
 *
 * Six assertions in this file used to fixture a bare `{ok:true}` — a response
 * the server cannot send: `receipt_extract` always returns an `extraction`
 * object beside the envelope (06 §3.3). They passed because `resultStage` read
 * only `ok`, which is the same defect: mock more permissive than the service,
 * certifying a client against a shape reality never produces. Now the fixture
 * carries a body and the code reads it.
 */
const okRes = (over = {}) => ({
  ok: true,
  extraction: { is_receipt: true, merchant_display: 'Hyper1', ...over },
});
const notReceiptRes = () => okRes({ is_receipt: false, merchant_display: null });

// ——————————————————————————— the stage vocabulary
eq(STAGES.length, 7, 'exactly seven stages — adding one silently is a design change');
ok(isStage('capped'), 'capped is a real stage, distinct from failed');
ok(isStage('notReceipt'), 'a VERDICT is its own stage, distinct from ready (R-receipts 4)');
ok(isStage('dismissed'), 'and a verdict he has read is its own stage too');
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
eq(resultStage(okRes(), false).stage, 'ready', 'a good extraction is ready for review');
eq(resultStage(okRes(), false).retryable, false, 'and is not retryable — it succeeded');
/**
 * THE ZOMBIE, KILLED AT ITS ROOT (R-receipts 4).
 *
 * `ok` says the CALL succeeded; it says nothing about what was found. Reading
 * only the envelope stored a not-a-receipt verdict as «جاهز — راجعه», which then
 * offered a review card with nothing to review and no way to dismiss it. He had
 * two of these on film.
 */
eq(resultStage(notReceiptRes(), false).stage, 'notReceipt',
  'a successful call that found no receipt is a VERDICT, never "ready to check"');
eq(resultStage(notReceiptRes(), false).retryable, false,
  'and it is not retryable — the answer was clear, the photo simply is not a receipt');
/**
 * `ok:true` with no readable body — a truncated response or an older
 * deployment. Neither a receipt nor a verdict, so inventing either would be
 * answering a question the server never answered. Same judgment as
 * `isSummaryShape`.
 */
eq(resultStage({ ok: true }, false).stage, 'failed',
  'an ok with no extraction at all is a failed read, not a silent "ready"');
eq(resultStage({ ok: true }, false).error, 'bad_extraction', 'named, never blank');
eq(resultStage({ ok: true }, false).retryable, true, 'and retryable — the next attempt may arrive whole');

// ——————————————————————————— the verdict, which has THREE answers
eq(receiptVerdict(okRes()), true, 'is_receipt true is a yes');
eq(receiptVerdict(notReceiptRes()), false, 'is_receipt false is a no');
eq(receiptVerdict({ ok: true }), null, 'a missing body is NOT a no — it is no answer');
eq(receiptVerdict(okRes({ is_receipt: 'false' })), null,
  'and the STRING "false" is not a decision either — `=== false`, never truthiness');
/**
 * THE CASE A MUTATION FOUND THAT THE THREE ABOVE MISSED: a body that is present
 * and simply has no `is_receipt` in it — a truncated response, or a deployment
 * older than the field. Read by truthiness (`!e.is_receipt`) that is a "no", so
 * EVERY genuine receipt would be filed as a verdict and every capture lost,
 * silently, with the queue looking tidy. Read by `=== false` it is what it is:
 * no answer.
 */
eq(receiptVerdict({ ok: true, extraction: { merchant_display: 'Hyper1' } }), null,
  'an extraction carrying no verdict FIELD is no answer — never a "not a receipt"');
eq(receiptVerdict({ ok: true, extraction: { is_receipt: undefined } }), null,
  'and an explicitly undefined one is the same');
eq(receiptVerdict(null), null, 'a missing response does not crash the list');
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
ok(isActionable(job('a', 'ready', 1, { extraction: okRes() })), 'a ready job is his to review');
ok(isActionable(job('a', 'failed', 1, { retryable: true })), 'a retryable failure is his to retry');
ok(!isActionable(job('a', 'failed', 1, { retryable: false })), 'an unretryable one offers no button');
ok(!isActionable(job('a', 'queued', 1)), 'a queued job needs nothing from him');
ok(!isActionable(job('a', 'reading', 1)), 'nor does one being read');
ok(!isActionable(null), 'and a missing job does not crash the list');
ok(isActionable(job('a', 'notReceipt', 1, { extraction: notReceiptRes() })),
  'a verdict IS his — it needs dismissing, which is the affordance he could not find');
ok(!isActionable(job('a', 'dismissed', 1, { extraction: notReceiptRes() })),
  'and once dismissed it asks for nothing ever again — that is what settled means');

/**
 * ——————————————————————————— THE STAGE A JOB ACTUALLY MEANS.
 *
 * `effectiveStage`, not `job.stage`, is what every reader asks. The case that
 * forced it into existence is the LEGACY one: his device already holds jobs
 * written under the old rule — `stage:'ready'` on a photo whose extraction says
 * `is_receipt:false`. A fix that only classified new jobs would have left the
 * two zombies on his recording exactly where they are.
 */
eq(effectiveStage(job('a', 'ready', 1, { extraction: okRes() })), 'ready',
  'a real receipt stored ready stays ready');
eq(effectiveStage(job('a', 'ready', 1, { extraction: notReceiptRes() })), 'notReceipt',
  'A JOB STORED "ready" WHOSE VERDICT SAYS OTHERWISE IS RECLASSIFIED — the zombie on his film');
eq(effectiveStage(job('a', 'ready', 1)), 'failed',
  'stored ready with no verdict at all is a failed read, exactly as resultStage would call it');
eq(effectiveStage(job('a', 'queued', 1)), 'queued', 'every other stage is passed through untouched');
eq(effectiveStage(job('a', 'capped', 1)), 'capped', 'including the one that is not a failure');
eq(effectiveStage(job('a', 'dismissed', 1)), 'dismissed', 'and the settled one');
eq(effectiveStage(null), null, 'a missing job has no stage rather than a default one');
eq(effectiveStage(job('a', 'banana', 1)), null,
  'and an unrecognised stage is null, never quietly rendered as queued');

/**
 * The two layers must agree about one job. If `resultStage` classifies a body
 * one way and `effectiveStage` reads the stored result the other way, a job
 * changes meaning simply by being written down and read back.
 */
for (const [label, res] of [['a receipt', okRes()], ['a verdict', notReceiptRes()]]) {
  const stored = resultStage(res, false);
  eq(effectiveStage({ id: 'x', stage: stored.stage, queuedAt: 1, extraction: res }), stored.stage,
    `${label} means the same thing after a round trip through storage`);
}

// ——————————————————————————— the name on the card
eq(jobMerchant(job('a', 'ready', 1, { extraction: okRes() })), 'Hyper1',
  'a read job names itself by its shop');
eq(jobMerchant(job('a', 'queued', 1)), null,
  'an unread one has NO name yet — the card falls back to the time it was taken');
eq(jobMerchant(job('a', 'ready', 1, { extraction: okRes({ merchant_display: '   ' }) })), null,
  'and whitespace is not a name');
eq(jobMerchant(job('a', 'ready', 1, { extraction: okRes({ merchant_display: null, merchant_latin: 'seif' }) })),
  'seif', 'falling back to the Latin transliteration when that is all we have');

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
      // Patches an EXISTING job only, exactly like the IndexedDB one: a job that
      // has been removed is not silently re-created by a late write.
      jobs = jobs.map((j) => (j.id === id ? { ...j, ...patch } : j));
      return true;
    },
    remove: async (id) => { jobs = jobs.filter((j) => j.id !== id); },
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
      return okRes({ merchant_display: clientHash });
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
      return okRes();
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
      return okRes();
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
  const worker = createWorker({ queue: q, extract: async () => { called += 1; return okRes(); } });
  const r = await worker.pump();
  eq(called, 0, 'a queue of ready-for-review jobs triggers no extraction');
  eq(r.processed, 0, 'and the worker reports processing nothing');
}

/**
 * ——————————————————————————— CANCEL, MID-READING (R-receipts 3).
 *
 * "Cancel is not undo." Nothing here can un-write a row, and nothing needs to:
 * extraction writes nothing to his sheet (§3.3). What cancel must guarantee is
 * narrower and entirely about the list — the job he removed STAYS removed, and
 * the answer that arrives afterwards is dropped unread rather than written back
 * onto a row he has already dismissed.
 *
 * The gate below is what makes it observable: the extraction parks mid-call so
 * the cancel lands while the job is genuinely in flight. Asserted after the
 * fact, "cancelled during reading" and "cancelled before it started" are the
 * same picture, and only one of them is the case worth protecting.
 */
{
  let seenSignal = null;
  let release;
  const q = fakeQueue([job('a', 'queued', 1, { clientHash: 'a' })]);
  const worker = createWorker({
    queue: q,
    extract: async ({ signal }) => {
      seenSignal = signal;
      await new Promise((r) => { release = r; });
      return okRes();
    },
  });

  const pumping = worker.pump();
  await new Promise((r) => setTimeout(r, 0));       // let the extraction start

  ok(worker.isInFlight('a'), 'the job being read reports itself in flight');
  ok(!worker.isInFlight('zzz'), 'and a job that does not exist does not');
  ok(seenSignal, 'THE EXTRACTION IS HANDED AN ABORT SIGNAL — without one, cancel is decoration');
  /**
   * Read through a guard rather than dereferenced. With the signal removed from
   * the worker, `seenSignal.aborted` throws and this suite DIES — printing a
   * stack trace instead of naming the one claim that failed, on exactly the run
   * where the claim matters. A detector that dies is not a detector.
   */
  const abortedState = () => (seenSignal ? seenSignal.aborted : '<no signal was passed to extract>');
  eq(abortedState(), false, 'which has not fired yet');

  eq(worker.cancel('a'), true, 'cancelling the in-flight job reports that it aborted something');
  eq(abortedState(), true, 'and the signal actually fires — the request is not left running');
  eq(worker.cancel('a'), false, 'cancelling it twice aborts nothing the second time');

  release();                                        // the answer lands AFTER the cancel
  await pumping;

  /**
   * The job is still in this fake queue only because a fake queue has no
   * deletion; in the app `cancelJob` removes it. That is exactly what makes the
   * assertion sharp: if the worker wrote its outcome, we would see `ready` here.
   */
  eq(q.snapshot()[0].stage, 'reading',
    "THE CANCELLED JOB'S OUTCOME IS DROPPED — no terminal stage is ever written back");
  eq(q.snapshot()[0].extraction, undefined, 'and no extraction body is stored for it');
  eq(worker.processedCount(), 0,
    'and nothing was counted as processed — there was no longer a job to finish');
  eq(worker.isRunning(), false, 'the worker released its lock rather than hanging on the cancelled job');
}

{
  // AND IT MOVES ON. A cancel that stalled the queue would be a worse bug than
  // the one it fixes: every later photo would sit unread behind the deleted one.
  let release;
  const q = fakeQueue([
    job('a', 'queued', 1, { clientHash: 'a' }),
    job('b', 'queued', 2, { clientHash: 'b' }),
  ]);
  const worker = createWorker({
    queue: q,
    extract: async ({ clientHash }) => {
      if (clientHash === 'a') { await new Promise((r) => { release = r; }); }
      return okRes();
    },
  });
  const pumping = worker.pump();
  await new Promise((r) => setTimeout(r, 0));
  worker.cancel('a');
  await q.remove('a');                 // the caller's half, exactly as cancelJob does it
  release();
  await pumping;

  const left = q.snapshot();
  eq(left.length, 1, 'the cancelled job does not come back');
  eq(left[0].id, 'b', 'and the one behind it is the one that remains');
  eq(left[0].stage, 'ready', 'which was read normally — the queue kept moving');
  eq(worker.processedCount(), 1, 'exactly one job reached a terminal stage');
}

/**
 * ——————————————————————————— AND THE HALF THAT COSTS MONEY.
 *
 * `call` retries once on a transport failure (06 §1), which is right for a blip
 * on mobile data and CATASTROPHIC for a cancellation: an aborted request looks
 * exactly like a failed one, so the naive version fires the image at the vision
 * endpoint a SECOND time for a receipt he just deleted. `receipt_extract` bills
 * the daily budget on ATTEMPTS rather than successes, so cancelling one receipt
 * would quietly cost two of his forty.
 *
 * Credentials here are fake and the port is dead by construction; this speaks to
 * no deployment, and by law never to his book.
 */
{
  globalThis.localStorage = {
    getItem: (k) => (k === 'masareef.secret' ? 'not-a-real-secret' : 'http://127.0.0.1:0/exec'),
  };
  const { call, TransportError } = await import('../src/api/client.js');
  const { receiptExtract } = await import('../src/api/endpoints.js');

  /**
   * A fetch that never answers, and rejects the way a real abort does.
   *
   * The `aborted` check is not decoration — the first draft only listened for
   * the event, so a signal that had ALREADY fired before the call never
   * rejected and the suite hung on its own stub. Real `fetch` rejects
   * immediately in that case. A double that is more forgiving than the service
   * is the recurring specimen in this project; here it produced a hang instead
   * of a false pass, which is the luckier of the two outcomes.
   */
  const hang = (sent) => (url, init) => new Promise((_resolve, reject) => {
    sent.push(JSON.parse(init.body));
    const fail = () => { const err = new Error('aborted'); err.name = 'AbortError'; reject(err); };
    if (init.signal.aborted) { fail(); return; }
    init.signal.addEventListener('abort', fail);
  });

  {
    const sent = [];
    globalThis.fetch = hang(sent);
    const ctrl = new AbortController();
    const p = call({ action: 'receipt_extract' }, 'vision', ctrl.signal);
    await new Promise((r) => setTimeout(r, 0));
    ctrl.abort();
    let reason = null;
    try { await p; } catch (err) { reason = err instanceof TransportError ? err.reason : 'not-a-transport-error'; }
    eq(sent.length, 1, 'A CANCELLED CALL IS SENT ONCE — the retry must not re-bill the vision endpoint');
    eq(reason, 'cancelled',
      'and it is named `cancelled`, never `timeout` — the two must not collapse, one is worth retrying');
  }

  {
    // THE NEGATIVE CONTROL. Without this, "one request" could simply mean the
    // retry is broken for everyone, which would be a worse bug wearing a pass.
    const sent = [];
    globalThis.fetch = async (url, init) => { sent.push(JSON.parse(init.body)); throw new Error('network down'); };
    try { await call({ action: 'ping' }, 'read'); } catch { /* expected */ }
    eq(sent.length, 2, 'an ordinary transport failure STILL retries once — the suppression is specific to cancel');
  }

  {
    // An already-aborted signal must never reach the network at all.
    const sent = [];
    globalThis.fetch = hang(sent);
    const ctrl = new AbortController();
    ctrl.abort();
    try { await call({ action: 'receipt_extract' }, 'vision', ctrl.signal); } catch { /* expected */ }
    eq(sent.length, 1, 'a pre-aborted call is attempted at most once and never retried');
  }

  {
    // The signal is a THIRD ARGUMENT, never a body field: `"signal":{}` on the
    // wire would be harmless noise today and a field the server might read later.
    const sent = [];
    globalThis.fetch = hang(sent);
    const ctrl = new AbortController();
    const p = receiptExtract({ image: 'AAA', clientHash: 'h', snapDate: '2026-08-14', signal: ctrl.signal });
    await new Promise((r) => setTimeout(r, 0));
    ctrl.abort();
    try { await p; } catch { /* expected */ }
    ok(!('signal' in sent[0]), 'the abort signal never reaches the request body');
    eq(sent[0].action, 'receipt_extract', 'while the action does');
    eq(sent[0].image, 'AAA', 'and the image it is meant to carry');
  }

  delete globalThis.fetch;
  delete globalThis.localStorage;
}

/**
 * ——————————————————————————— THE THUMBNAIL (R-receipts 2).
 *
 * It must never be the reason a list fails to render: a card with no picture is
 * a card, and a card that throws takes the whole queue view with it.
 */
{
  const { thumbUrl, revokeThumb } = await import('../src/lib/jobThumb.js');
  eq(thumbUrl(null), null, 'no payload, no URL — and no crash');
  eq(thumbUrl(''), null, 'nor for an empty one');
  eq(thumbUrl(123), null, 'nor for a payload that is not even a string');

  const madeFrom = [];
  const revoked = [];
  globalThis.atob = (s) => (s === 'BAD' ? (() => { throw new Error('not base64'); })() : 'ab');
  globalThis.Blob = class { constructor(parts, opts) { madeFrom.push(opts?.type); } };
  const realURL = globalThis.URL;
  globalThis.URL = { createObjectURL: () => 'blob:fake', revokeObjectURL: (u) => revoked.push(u) };

  eq(thumbUrl('AAA'), 'blob:fake', 'a real payload becomes an object URL');
  eq(madeFrom[0], 'image/jpeg', 'typed as the JPEG that prepareReceipt produced');
  eq(thumbUrl('BAD'), null, 'and a corrupt payload answers null instead of throwing');

  revokeThumb('blob:fake');
  eq(revoked[0], 'blob:fake', 'revoking releases the Blob — these are ~500 KB each');
  revokeThumb(null);
  eq(revoked.length, 1, 'and revoking nothing does nothing');

  globalThis.URL = realURL;
  delete globalThis.atob;
  delete globalThis.Blob;
}

const report = failures.length
  ? `❌ ${failures.length} / ${pass + failures.length} queue assertions failed:\n  - ${failures.join('\n  - ')}`
  : `✅ all ${pass} queue assertions passed`;
console.log(report);
process.exit(failures.length ? 1 : 0);
