/**
 * WHO A MEAL OR A MEETING WAS WITH, kept in the row's description (Tarek,
 * 2026-11-01, Categories board: «so that I can start also keeping track of all
 * the people that I'm trying to invite»). His sheet has one description column,
 * so the names ride there after the shop: «Monda · treated Ahmed»,
 * «Pompier · with Omar Abdel Aziz · OT Dent planning». A fuller version (a
 * People list in the Book) can read these back later; it needs weeks of names first.
 */
export const MEETING = 'Business meetings';
export const MEAL = 'Eating out';

const clean = (s) => String(s || '').replace(/\s+/g, ' ').replace(/·/g, '-').trim();

export function describe(merchant, category, { treated = '', meetWith = '', meetFor = '' } = {}) {
  const base = clean(merchant) || category;
  if (category === MEAL && clean(treated)) return `${base} · treated ${clean(treated)}`;
  if (category === MEETING && clean(meetWith)) {
    return `${base} · with ${clean(meetWith)}${clean(meetFor) ? ` · ${clean(meetFor)}` : ''}`;
  }
  return base;
}
