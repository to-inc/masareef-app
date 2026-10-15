/**
 * HOW LONG A RECEIPT TAKES TO READ, on this phone (Tarek's debug send 2026-10-14:
 * «We need a progress bar»). The server cannot report progress, so the bar is an
 * honest estimate: the median of the last ten reads, 12 s until there are any.
 */
const KEY = 'masareef.readTimes.v1';
const DEFAULT_MS = 12000;

export function recordReadTime(ms, store = globalThis.localStorage) {
  if (!(ms > 0) || ms > 120000) return;
  try {
    const list = JSON.parse(store.getItem(KEY) || '[]');
    store.setItem(KEY, JSON.stringify(list.concat(Math.round(ms)).slice(-10)));
  } catch { /* storage refused: the default estimate still works */ }
}

export function expectedReadMs(store = globalThis.localStorage) {
  try {
    const list = JSON.parse(store.getItem(KEY) || '[]').filter((n) => n > 0).sort((a, b) => a - b);
    if (list.length) return list[Math.floor(list.length / 2)];
  } catch { /* fall through */ }
  return DEFAULT_MS;
}

/**
 * The bar's fill at `elapsed`: about 90% at the usual time, creeping toward
 * 95% after it, and never «done» — only the answer arriving finishes it.
 */
export const readProgress = (elapsed, expected) =>
  Math.min(0.95, Math.max(0, 1 - Math.exp((-2.3 * Math.max(0, elapsed)) / Math.max(1000, expected))));
