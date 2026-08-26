#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK N1 ═══════════
 * «Pending-authorization cards say WHY on the card: the job-list label uses
 *  not_expense_reason («Pending — not yet money»), not generic «Not a receipt».»
 *
 * WHY THIS FILE EXISTS SEPARATELY FROM THE SUITES.
 *
 * N1's assertions were written INTO `test-queue.mjs` and `test-chips.mjs`, the
 * suites that already owned the worker and the job row. Those assertions are
 * real and they pass — and the chunk was still 0/3, because the ledger's oracle
 * is a gate file per chunk and there was none. «Done» was a sentence again.
 *
 * The distinction is not bookkeeping. A chunk's gate has to be runnable ALONE,
 * against an arbitrary tree, by someone who did not write the work — that is
 * what makes «done» a state a checker can read rather than a claim the builder
 * makes. Assertions scattered across two suites cannot answer «is N1 done?»
 * without a human deciding which of 3,736 assertions were the relevant ones.
 *
 * THE THREE CLAIMS, and each is independently falsifiable:
 *   1. the REASON survives onto the stored job (what makes the label reachable);
 *   2. a refusal WITH a reason renders that reason on the row;
 *   3. a refusal WITHOUT one keeps the generic label, uninvented.
 *
 * PROVEN RED MECHANICALLY, not by assertion: run against `0747f01`'s `src/`
 * (the shipped tree this chunk started from) it fails; against the working tree
 * it prints the marker below. Both runs are recorded in the ledger.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const MARKER = 'CHUNK-N1-GREEN';

let pass = 0;
const failures = [];
const eq = (a, b, label) => {
  if (Object.is(a, b)) { pass++; return; }
  failures.push(`${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const ok = (c, label) => eq(!!c, true, label);
/**
 * A THROW IS A NAMED FAILURE, NOT A DEAD PROCESS. This gate runs against trees
 * where the feature does not exist — missing exports and missing locale keys are
 * the EXPECTED red state, so every reach through a possibly-absent thing goes
 * through here. A gate that dies instead of failing reports nothing, and a
 * checker cannot tell that from a crash in its own harness.
 */
const at = (fn, label) => {
  try { return fn(); } catch (err) { failures.push(`${label}\n      THREW — ${err && err.message}`); return undefined; }
};

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { createWorker } = await vite.ssrLoadModule('/src/state/receiptWorker.js');
  const { JobsList } = await vite.ssrLoadModule('/src/views/ReceiptView.jsx');
  const { AR } = await vite.ssrLoadModule('/src/i18n/strings.ar.js');

  // ——— a queue the worker can drain, with no database anywhere near it
  const fakeQueue = (jobs) => ({
    async claimNext() { return jobs.find((j) => j.stage === 'queued') || null; },
    async update(id, patch) { Object.assign(jobs.find((j) => j.id === id), patch); },
    async all() { return jobs.map((j) => ({ ...j })); },
    snapshot: () => jobs.map((j) => ({ ...j })),
  });
  const refusal = (reason) => ({
    ok: true,
    extraction: { is_receipt: false, merchant_display: null, ...(reason ? { not_expense_reason: reason } : {}) },
  });

  /**
   * ——— CLAIM 1. The reason survives onto the job.
   *
   * The worker stores `extraction: stage === 'ready' ? res : null`, so before
   * this chunk a refused job carried NOTHING to render a reason from. Without
   * this half the label is a string that cannot fire in the field.
   */
  const jobs = [{ id: 'p', stage: 'queued', queuedAt: 1, clientHash: 'h', base64: 'A', snapDate: '2026-08-01' }];
  const q = fakeQueue(jobs);
  await createWorker({ queue: q, extract: async () => refusal('pending_or_declined') }).pump();
  const stored = q.snapshot()[0];
  eq(stored.stage, 'notReceipt', 'N1.1 — a refused photo is still a refusal');
  eq(stored.notExpenseReason, 'pending_or_declined',
    'N1.1 — and the REASON is stored on the job, which is what makes the row able to say why');
  eq(stored.extraction, null,
    'N1.1 — while the refused BODY is still not stored: one published enum value is not the payload');

  const q2 = fakeQueue([{ id: 'n', stage: 'queued', queuedAt: 1, clientHash: 'h', base64: 'A', snapDate: '2026-08-01' }]);
  await createWorker({ queue: q2, extract: async () => refusal(null) }).pump();
  eq(q2.snapshot()[0].notExpenseReason, null,
    'N1.1 — and a server that names no reason leaves it null rather than guessing one');

  // ——— the row, rendered from the stored shape
  const rowText = (job) => renderToStaticMarkup(createElement(JobsList, {
    jobs: [job], onReview: () => {}, onRetry: () => {}, onCancel: () => {},
  })).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  /**
   * ——— CLAIM 2. A named refusal says which one it is.
   *
   * «مش فاتورة» is true of a pending authorization, a balance screen, an
   * incoming transfer and a menu alike, so it distinguishes none of them. For a
   * pending payment the answer is that there is nothing to record YET, which is
   * a different instruction from every other member of that set.
   */
  const pending = rowText({ id: 'p', stage: 'notReceipt', queuedAt: 9, notExpenseReason: 'pending_or_declined' });
  const words = at(() => AR.jobNotExpense('pending_or_declined'),
    'N1.2 — the locale carries a row-length form of the reason enum');
  ok(words && pending.includes(words),
    'N1.2 — a pending authorization says WHY on the row, in the words the reason names');
  ok(!pending.includes(AR.jobNotReceipt),
    'N1.2 — and the generic refusal is gone from that row entirely, including its action button');

  /**
   * ——— CLAIM 3. An unnamed refusal is not dressed in an invented explanation.
   * Two cases, two renderings — the same rule that keeps «we could not check»
   * apart from «we checked and it is clean».
   */
  const bare = rowText({ id: 'n', stage: 'notReceipt', queuedAt: 9 });
  ok(bare.includes(AR.jobNotReceipt),
    'N1.3 — a refusal with NO reason keeps the generic label rather than inventing a diagnosis');
} finally {
  await vite.close();
}

if (failures.length) {
  console.log(`❌ CHUNK N1 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · the refusal row says why`);
