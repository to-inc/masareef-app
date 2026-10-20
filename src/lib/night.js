/**
 * THE THEME, decided once before anything renders (2026-10-18): «masareef.theme»
 * = auto | light | night. With no choice saved, a euro book (Tarek's) follows the
 * phone and Dad's pound book stays light. No storage or no matchMedia (the suites,
 * Node) → light. Its own module so theme.js and the chart colours in
 * lib/constants.js read ONE answer without importing each other.
 */
export const THEME_KEY = 'masareef.theme';
export function themeChoice(store = globalThis.localStorage) {
  try {
    const v = store && store.getItem(THEME_KEY);
    if (v === 'auto' || v === 'light' || v === 'night') return v;
    const snap = store && JSON.parse(store.getItem('masareef.snapshot.v1') || 'null');
    const home = snap && snap.data && snap.data.month && snap.data.month.homeAgg && snap.data.month.homeAgg.currency;
    return home && home !== 'EGP' ? 'auto' : 'light';
  } catch { return 'light'; }
}
export const NIGHT = (() => {
  const c = themeChoice();
  if (c === 'night') return true;
  if (c === 'light') return false;
  try { return !!(globalThis.matchMedia && globalThis.matchMedia('(prefers-color-scheme: dark)').matches); } catch { return false; }
})();

