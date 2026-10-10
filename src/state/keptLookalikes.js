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
function saveKept(list) {
  const next = Array.from(new Set(list)).slice(-1000);
  try { localStorage.setItem(KEPT_KEY, JSON.stringify(next)); } catch { /* the card simply asks again */ }
  return next;
}

/** Kept here at once; sent to the sheet's Kept tab when the server can take it. */
export function keepRow(r, send = null) {
  const sig = rowSignature(r);
  const next = saveKept([...loadKept(), sig]);
  if (send) send({ signature: sig }).catch(() => { /* offline: the next sync sends it */ });
  return next;
}

/**
 * THE SHEET IS THE MEMORY (Tarek, 2026-10-11: «save the kept list to the sheet»).
 * On launch: read the Kept tab, merge it into this phone's list, and send the
 * sheet anything kept here that it does not have yet (a tap made offline).
 */
export async function syncKept(list, send) {
  const res = await list();
  if (!res || !res.ok || !Array.isArray(res.signatures)) return loadKept();
  const onSheet = new Set(res.signatures);
  const mine = loadKept();
  for (const sig of mine) if (!onSheet.has(sig)) await send({ signature: sig }).catch(() => {});
  return saveKept([...mine, ...res.signatures]);
}
/** The report without kept rows; a group needs two rows left to stay a group. */
export function withoutKept(report, kept) {
  const set = new Set(kept || []);
  const groups = ((report && report.groups) || [])
    .map((g) => ({ ...g, rows: g.rows.filter((r) => !set.has(rowSignature(r))) }))
    .filter((g) => g.rows.length >= 2);
  return { ...report, groups };
}
