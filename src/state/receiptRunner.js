import * as queue from './receiptQueue.js';
import { createWorker } from './receiptWorker.js';
import { receiptExtract } from '../api/index.js';
import { recordReadTime } from './readTimes.js';
import { fileFailedRead } from './autoDebug.js';
import { track } from './usage.js';

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
