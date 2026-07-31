/**
 * Chart series maths, verbatim from the prototype — these five functions ARE the
 * null-padding contract in code form, so read §2.2 before touching any of them.
 *
 *  comb      — combines Visa+Cash; null ONLY where both are null, which is why
 *              the server must pad both arrays in identical positions.
 *  cumsum    — stops accumulating at a null and emits null, breaking the line at
 *              "now" instead of dragging it flat across the rest of the period.
 *  lastIdxOf — the last non-null index, i.e. today. This is what anchors the
 *              "same point in time" marker that makes a mid-period comparison
 *              honest rather than flattering.
 */
export const comb = (a, b) =>
  a.map((v, i) => (v == null && b[i] == null ? null : (v || 0) + (b[i] || 0)));

export const seriesFor = (d, m) => (m === 'all' ? comb(d.Visa, d.Cash) : d[m]);

export const sumTo = (arr) => arr.reduce((s, v) => s + (v || 0), 0);

export function cumsum(arr) {
  const out = [];
  let s = 0;
  for (const v of arr) {
    if (v == null) { out.push(null); continue; }
    s += v;
    out.push(s);
  }
  return out;
}

export const lastIdxOf = (arr) => arr.reduce((a, v, i) => (v != null ? i : a), 0);
