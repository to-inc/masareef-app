import * as queue from './receiptQueue.js';
import { createWorker } from './receiptWorker.js';
import { receiptExtract } from '../api/index.js';
import { recordReadTime } from './readTimes.js';
import { fileFailedRead } from './autoDebug.js';
import { track } from './usage.js';
import { prepareReceipt, prepareDocument, fileSnapDate, ReceiptImageError } from '../lib/receipt-image.js';

/**
 * THE ONE RECEIPT READER, for the whole app (2026-10-10, Tarek: «we can take
 * multiple photos, and they can all be processed in a queue right after each
 * other»). It used to live inside the receipt screen, so leaving that screen
 * stopped the reading. Now the receipt screen and To review's «Photos being
 * processed» bar share this one worker — still one extraction at a time.
 */
let worker = null;
const listeners = new Set();

export function runner() {
  if (!worker) worker = createWorker({ queue, extract: receiptExtract, onRead: (ms) => { recordReadTime(ms); track('read_ms', { ms }); }, onOutcome: (job, outcome, res) => { track('read', { stage: outcome.stage, error: outcome.error || '' }); fileFailedRead(job, outcome, res); }, onChange: () => listeners.forEach((fn) => fn()) });
  return worker;
}

/** Called whenever a job changes stage. Returns the unsubscribe. */
export function onJobsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Tell every watcher the list changed (a capture or a removal outside the worker). */
export function jobsChanged() { listeners.forEach((fn) => fn()); }

/**
 * TRY IT NOW — on any photo not yet read, failed or not (Tarek, 2026-10-31:
 * «retry even if it's not there»). A read in flight is abandoned first (its
 * answer is then dropped unread), the job goes back to the front of its turn,
 * and the worker starts. Within six hours the server answers a re-sent photo
 * from its cache, so this does not spend a second read.
 */
/**
 * READ IT AGAIN, FRESH (Tarek, 2026-10-31: «a button to reread the picture …
 * in case there was an error»). The server keeps each photo's answer for six
 * hours under its hash, so re-sending the same hash only returns the same answer.
 * A re-read goes under a new hash (`<photo>~r<n>`), so the server reads the
 * picture again — one vision call. The archive names files by the first 12
 * characters, so the photo is still archived once.
 */
export async function rereadNow(job, { q = queue, w = runner() } = {}) {
  const base = job.baseHash || job.clientHash || job.id;
  const rereads = (job.rereads || 0) + 1;
  track('photo', { act: 'reread', stage: job.stage || '', n: rereads });
  w.cancel(job.id);
  await q.update(job.id, { clientHash: `${base}~r${rereads}`, baseHash: base, rereads,
    stage: 'queued', error: null, retryable: false, extraction: null, notExpenseReason: null, readingAt: null });
  jobsChanged();
  w.pump();
}

/** Told whenever a photo is removed, with the job as it was — the shell offers «Undo». */
const removedListeners = new Set();
export function onJobRemoved(fn) { removedListeners.add(fn); return () => removedListeners.delete(fn); }

/** Take a photo off the phone's list, stopping its read if one is in flight. */
export async function removeJob(job, { q = queue, w = runner() } = {}) {
  track('photo', { act: 'remove', stage: job.stage || '' });
  w.cancel(job.id);
  await q.remove(job.id);
  jobsChanged();
  removedListeners.forEach((fn) => { try { fn(job); } catch { /* a listener never blocks a removal */ } });
  w.pump();
}

/**
 * UNDO A REMOVE (version A: Remove is one tap, so it gets a way back). The job is
 * put back exactly as it was; a read that was in flight starts again from its turn.
 */
export async function restoreJob(job, { q = queue, w = runner() } = {}) {
  track('photo', { act: 'undo_remove', stage: job.stage || '' });
  await q.enqueue(job.stage === 'reading' ? { ...job, stage: 'queued', readingAt: null } : job);
  jobsChanged();
  w.pump();
}

export async function retryNow(job, { q = queue, w = runner() } = {}) {
  track('photo', { act: 'retry', stage: job.stage || '', error: job.error || '' });
  w.cancel(job.id);
  await q.update(job.id, { stage: 'queued', error: null, retryable: false, readingAt: null });
  jobsChanged();
  w.pump();
}

/**
 * READ IT BEHIND HIM (design audit 2026-10-18, UX 1: «never make him wait on a
 * receipt»). Photos and PDFs chosen on the New sheet are prepared, queued and read
 * by the one worker while he carries on; To review's Photos list and the header's
 * ring show them, and the shell says when one is ready. Returns how many were
 * queued and the first refusal, if any («too-large», «failed»).
 */
export async function enqueueFiles(files, { prep = { prepareReceipt, prepareDocument }, q = queue, pump = () => runner().pump() } = {}) {
  let queued = 0; let refused = null;
  for (const file of [].concat(files).filter(Boolean)) {
    try {
      const p = file.type === 'application/pdf' ? await prep.prepareDocument(file) : await prep.prepareReceipt(file);
      const ok = await q.enqueue({ id: p.clientHash, base64: p.base64, clientHash: p.clientHash, snapDate: fileSnapDate(file),
        ...(p.mediaType ? { mediaType: p.mediaType } : {}) });
      if (ok) queued++; else refused = refused || 'failed';
    } catch (err) {
      refused = refused || (err instanceof ReceiptImageError && err.code === 'too-large' ? 'too-large' : 'failed');
    }
  }
  jobsChanged();
  if (queued) pump();
  return { queued, refused };
}
