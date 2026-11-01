import { C, TYPE } from '../theme.js';
import { allShelves } from '../state/catOrder.js';
import { S } from '../i18n/strings.js';

/**
 * THE FULL CATEGORY LIST ON SHELVES (Tarek, 2026-11-01, «A · Shelves» on the
 * Categories board): his four most-used first, then each kin group under a small
 * heading, so the eye finds the group before the chip. Every grid that unfolds
 * «More categories…» uses this; each keeps its own chip, passed as `children(cats)`.
 * Dad's book gets one unheaded shelf: his grid is unchanged.
 */
export default function CategoryShelves({ children, wrap }) {
  return allShelves().map((g) => (
    <div key={g.key || 'all'} data-shelf={g.key || 'all'} style={{ width: '100%' }}>
      {g.key && (
        <div style={{ fontSize: TYPE.caption, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.muted, margin: '14px 2px 8px' }}>
          {S.shelf(g.key)}
        </div>
      )}
      <div style={wrap}>{children(g.cats)}</div>
    </div>
  ));
}
