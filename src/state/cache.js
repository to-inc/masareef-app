/**
 * Last-known `summary` snapshot.
 *
 * The rule this exists to serve: NEVER a blank screen. Apps Script cold starts
 * run 1–3 s and Cairo mobile data can simply stop, so the app paints from here
 * the instant it launches and swaps in fresh data behind the scenes. A skeleton
 * is only ever shown on a true first run.
 *
 * This is a render cache, not a source of truth — his sheet is. It is always
 * labelled with its timestamp so a stale number can never masquerade as live.
 */
import { isSummaryShape, withDefaults } from '../lib/summaryShape.js';

const K_SNAP = 'masareef.snapshot.v1';

export function saveSnapshot(data) {
  try {
    localStorage.setItem(K_SNAP, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // Quota or private mode. The app still works; it just starts from a skeleton.
  }
}

export function loadSnapshot() {
  try {
    const raw = localStorage.getItem(K_SNAP);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // A snapshot written by an older build could be missing fields the current
    // views read. Same validator as the live fetch, deliberately — two separate
    // shape checks would drift and one of them would eventually be wrong.
    if (!isSummaryShape(parsed?.data)) return null;
    return { ...parsed, data: withDefaults(parsed.data) };
  } catch {
    return null;
  }
}

export function clearSnapshot() {
  try { localStorage.removeItem(K_SNAP); } catch { /* nothing to do */ }
}
