import { debugShot, debugNote } from '../api/index.js';
import { supportsAction, loadBuild } from './capabilities.js';

/**
 * A READ THAT FAILED FILES ITSELF (Tarek, 2026-10-16: «is there a way that this
 * adds to the log automatically»). When the server refuses a photo («not an
 * expense») or cannot read it, the photo and the reason go to «Debug
 * screenshots» on his Drive — the folder the daily check works through — so a
 * Smartum-style miss reaches the fix list without him doing anything.
 *
 * Once per photo (its hash is remembered), never offline failures (those retry
 * by themselves), and only on a server that can save screenshots. A PDF sends
 * the note alone (the folder takes images).
 */
const KEY = 'masareef.autoDebug.v1';
const seen = (store) => { try { return JSON.parse(store.getItem(KEY) || '[]'); } catch { return []; } };

export function shouldFile(outcome) {
  return !!outcome && (outcome.stage === 'notReceipt'
    || (outcome.stage === 'failed' && outcome.error !== 'offline'));
}

export function autoNote(job, outcome, res) {
  const ex = res && res.extraction;
  const why = outcome.stage === 'notReceipt'
    ? `refused as not an expense${ex && ex.not_expense_reason ? ` (${ex.not_expense_reason})` : ''}`
    : `could not be read (${outcome.error || 'failed'})`;
  return `AUTO — the app filed this itself: a photo ${why}.`
    + (ex && ex.raw_total_line ? ` Read line: «${ex.raw_total_line}».` : '')
    + (ex && ex.merchant_display ? ` Merchant read: «${ex.merchant_display}».` : '')
    + ' If this was a real purchase, the reading rules need fixing.';
}

export async function fileFailedRead(job, outcome, res, {
  store = globalThis.localStorage, build = loadBuild(), shot = debugShot, note = debugNote,
} = {}) {
  if (!shouldFile(outcome) || !job || !job.clientHash) return false;
  if (!supportsAction(build, 'debug_shot') || !supportsAction(build, 'debug_note')) return false;
  const done = seen(store);
  if (done.includes(job.clientHash)) return false;
  const batch = `a${String(job.clientHash).replace(/[^A-Za-z0-9]/g, '').slice(0, 7)}`;
  try {
    const n = await note({ note: autoNote(job, outcome, res), batch });
    if (job.base64 && job.mediaType !== 'application/pdf') {
      await shot({ image: job.base64, mediaType: 'image/jpeg', clientId: job.clientHash, batch, index: 1 });
    }
    if (!n || !n.ok) return false;
    try { store.setItem(KEY, JSON.stringify(done.concat(job.clientHash).slice(-200))); } catch { /* try again next time */ }
    return true;
  } catch { return false; }
}
