import { useState } from 'react';
import { C, TYPE, TAP, RADIUS, SELECTED_TINT, glass } from '../theme.js';
import { allShelves } from '../state/catOrder.js';
import { S, DIR } from '../i18n/strings.js';
import CategorySign from './CategorySign.jsx';

/**
 * THE FULL CATEGORY LIST AS FOLDERS (Tarek, 2026-11-01, on the Categories board:
 * «Folders the most … one thing expands at a time»). His four most-used stay out
 * as chips; every other kin group is a folder. Closed, the folders sit two across,
 * each with its first category's picture. Tapping one opens it full width and shrinks the others to
 * small pills; tapping it again, or another, closes it. No category counts.
 *
 * Every grid that unfolds «More categories…» uses this; each keeps its own chip,
 * passed as `children(cats)`. The folder holding `selected` starts open, so a
 * chosen category is never hidden. Dad's book gets one unfoldered list, unchanged.
 */
const heading = (t) => (
  <div style={{ fontSize: TYPE.caption, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.muted, margin: '14px 2px 8px' }}>
    {t}
  </div>
);

export default function CategoryShelves({ children, wrap, selected = null }) {
  const shelves = allShelves();
  const [open, setOpen] = useState(() => {
    const g = shelves.find((s) => s.key && s.key !== 'top' && s.cats.includes(selected));
    return g ? g.key : null;
  });
  if (!shelves[0].key) return <div data-shelf="all" style={wrap}>{children(shelves[0].cats)}</div>;

  const top = shelves[0].key === 'top' ? shelves[0] : null;
  const folders = shelves.filter((s) => s.key !== 'top');
  return (
    <div style={{ width: '100%' }}>
      {top && heading(S.shelf('top'))}
      {top && <div data-shelf="top" style={wrap}>{children(top.cats)}</div>}
      {heading(S.shelf('more'))}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {folders.map((g) => {
          const isOpen = open === g.key;
          const small = open && !isOpen;
          return (
            <div key={g.key} data-folder={g.key} data-open={isOpen ? '' : undefined}
              style={{
                flex: isOpen ? '1 1 100%' : small ? '0 0 auto' : '1 1 calc(50% - 8px)',
                ...glass('chip'), borderRadius: small ? RADIUS.capsule : RADIUS.glassWell,
                ...(isOpen ? { background: SELECTED_TINT } : null),
              }}>
              <button className="catchip" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : g.key)}
                style={{
                  width: '100%', minHeight: small ? TAP : 64, background: 'transparent', color: C.ink,
                  display: 'flex', alignItems: 'center', gap: 10, textAlign: 'start',
                  padding: small ? '4px 14px 4px 6px' : '10px 12px', fontSize: small ? TYPE.label : TYPE.body, fontWeight: 600,
                }}>
                <CategorySign category={g.cats[0]} size={small ? 28 : 32} />
                <span style={{ flex: 1 }}>{S.shelf(g.key)}</span>
                {!small && <span aria-hidden style={{ color: C.muted, transform: isOpen ? 'rotate(90deg)' : DIR === 'rtl' ? 'scaleX(-1)' : 'none', transition: 'transform .2s ease' }}>›</span>}
              </button>
              {isOpen && <div style={{ ...wrap, padding: '0 10px 12px' }}>{children(g.cats)}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
