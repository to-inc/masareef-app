/**
 * «KEEP THIS» (Tarek, 2026-10-11: «some of these double entries are actually
 * double purchases»). A row he keeps is a real purchase: it leaves the look-alike
 * card for good, and a group left with fewer than two rows is no group. Kept on
 * this phone (a localStorage list of row signatures). Two identical rows share
 * one signature — keeping either one keeps the pair, which is exactly his call.
 */
const KEPT_KEY = 'masareef.keptLookalikes';
export const rowSignature = (r) => [r && r.date, r && r.amount, (r && r.currency) || 'EGP',
  String((r && r.description) || '').trim().toLowerCase()].join('|');
export function loadKept() {
  try { const a = JSON.parse(localStorage.getItem(KEPT_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
}
export function keepRow(r) {
  const next = Array.from(new Set([...loadKept(), rowSignature(r)])).slice(-500);
  try { localStorage.setItem(KEPT_KEY, JSON.stringify(next)); } catch { /* the card simply asks again */ }
  return next;
}
/** The report without kept rows; a group needs two rows left to stay a group. */
export function withoutKept(report, kept) {
  const set = new Set(kept || []);
  const groups = ((report && report.groups) || [])
    .map((g) => ({ ...g, rows: g.rows.filter((r) => !set.has(rowSignature(r))) }))
    .filter((g) => g.rows.length >= 2);
  return { ...report, groups };
}
