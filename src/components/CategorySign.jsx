import { C, alpha } from '../theme.js';
import { signFor } from '../lib/categorySigns.js';

/**
 * A SMALL SIGN PER CATEGORY on the Book's rows (Tarek, 2026-11-01, «Do this» on
 * the Calmer Screens page, idea 7): finding «the supermarket ones» meant reading
 * every line; a tinted picture lets the eye find them first.
 *
 * Decoration only (aria-hidden): the row still names its category in words.
 * Four tint families, all existing tokens — home and bills (harbor), food and
 * shopping (sand), going out (settled), money and care (muted). No new colour.
 * A category not drawn here gets the plain tag, never a wrong picture.
 */
const P = {
  fork: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10"/><path d="M17 21V3c-2 1.5-3 4-3 7h3"/>',
  cart: '<path d="M3 4h2l2.4 11h10.2L20 8H6.2"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
  car: '<path d="M5 16v-5l2-5h10l2 5v5"/><path d="M4 16h16"/><circle cx="8" cy="16" r="1.6"/><circle cx="16" cy="16" r="1.6"/>',
  gift: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18M12 9v11"/><path d="M12 9c-2-4-6-4-6-1.5S9 9 12 9c3 0 6 0 6-1.5S14 5 12 9z"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
  wifi: '<path d="M3 9a13 13 0 0 1 18 0M6 12.5a8.5 8.5 0 0 1 12 0M9 16a4 4 0 0 1 6 0"/><circle cx="12" cy="19" r="1" fill="currentColor"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  cross: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/>',
  person: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  tower: '<path d="M6 21V5h9v16M15 10h4v11M3 21h18"/><path d="M9 8h3M9 12h3M9 16h3"/>',
  bolt: '<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  house: '<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-5h4v5"/>',
  doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 11h7M9 15h7"/>',
  flame: '<path d="M12 21a6 6 0 0 0 6-6c0-4-3-6-4-9-1 2-2 3-3.5 3.5C9 10 6 12 6 15a6 6 0 0 0 6 6z"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  plane: '<path d="M2.5 13.5l19-8-6 15-3-6.5z"/><path d="M12.5 14l9-8.5"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16v4M17 18h4"/>',
  bus: '<rect x="5" y="3" width="14" height="15" rx="2.5"/><path d="M5 11h14M8 21v-3M16 21v-3"/><circle cx="8.5" cy="14.5" r=".9" fill="currentColor"/><circle cx="15.5" cy="14.5" r=".9" fill="currentColor"/>',
  swap: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5a3 3 0 0 1 0 6M21 20a6 6 0 0 0-4-5.6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M5 19l1.4-1.4M17.6 6.4L19 5"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="M3.5 9.5c5 1.5 12 1.5 17 0M3.5 14.5c5-1.5 12-1.5 17 0"/>',
  brush: '<path d="M14 4l6 6-8 8-6-6z"/><path d="M6 12l-2 6 2 2 6-2"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l2 2M15 8l2 2"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8" r="1.2"/>',
};

const TINT = {
  home: { bg: alpha(C.harbor, 0.16), ink: C.harborInk },
  sand: { bg: alpha(C.sand, 0.85), ink: C.sandInk },
  out: { bg: C.settledBg, ink: C.settledInk },
  care: { bg: alpha(C.muted, 0.14), ink: C.muted },
};

export default function CategorySign({ category, size = 34 }) {
  const [pic, family] = signFor(category) || ['tag', 'care'];
  const t = TINT[family];
  return (
    // geometry exemption (ruling 4): a 34px sign, its corner bounded by its size — like the 40px thumbnail
    <span aria-hidden data-category-sign={pic}
      style={{ width: size, height: size, borderRadius: 10, background: t.bg, color: t.ink, flex: '0 0 auto',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: P[pic] }} />
    </span>
  );
}
