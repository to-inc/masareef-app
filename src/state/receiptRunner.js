import * as queue from './receiptQueue.js';
import { createWorker } from './receiptWorker.js';
import { receiptExtract } from '../api/index.js';
import { recordReadTime } from './readTimes.js';
import { fileFailedRead } from './autoDebug.js';
import { track } from './usage.js';
import { prepareReceipt, prepareDocument, snapDateISO, ReceiptImageError } from '../lib/receipt-image.js';

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
      const ok = await q.enqueue({ id: p.clientHash, base64: p.base64, clientHash: p.clientHash, snapDate: snapDateISO(),
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
