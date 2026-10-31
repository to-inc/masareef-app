import { C, TAP, RADIUS, TYPE, glass } from '../theme.js';

/** 24×24 line icons, the eye's own drawing style (1.8 stroke). */
const PATHS = {
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  save: <><path d="M12 4v11" /><path d="M7 10l5 5 5-5" /><path d="M5 20h14" /></>,
  again: <><path d="M20 11a8 8 0 0 0-14.6-4.5" /><path d="M4 3v4h4" /><path d="M4 13a8 8 0 0 0 14.6 4.5" /><path d="M20 21v-4h-4" /></>,
  trash: <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /><path d="M10 11v6" /><path d="M14 11v6" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  pen: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></>,
  why: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><path d="M12 7.5v.5" /></>,
};
export const Icon = ({ name, size = 22 }) => (
  <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{PATHS[name]}</svg>
);

/**
 * VERSION A — ONE STRIP (Tarek picked it 2026-10-31, from https://claude.ai/artifact/UmhM7MvnQJMPhtjHHu6tDp):
 * a photo's actions on ONE line, an icon over a short word, in one pressed glass well.
 * «Remove» sits apart after a hairline. Each item: { key, icon, label, onTap, tone, sep, attrs, render }.
 * `render(button)` lets a caller wrap the button (the eye opens its own viewer).
 */
export function StripButton({ item, ...rest }) {
  const color = item.tone === 'lead' ? C.harborInk : item.tone === 'muted' ? C.muted : C.ink;
  return (
    <button className="catchip" onClick={item.onTap} disabled={item.disabled} aria-label={item.aria || undefined} {...item.attrs} {...rest}
      style={{ flex: item.grow || '1 1 0', minWidth: 0, minHeight: Math.max(TAP, 52), padding: '4px 2px', border: 'none', background: 'transparent',
        borderRadius: RADIUS.inset, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
        color, fontSize: TYPE.caption, fontWeight: item.tone === 'lead' ? 700 : 600, whiteSpace: 'nowrap', overflow: 'hidden' }}>
      <Icon name={item.icon} />
      <span style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
    </button>
  );
}

export default function ActionStrip({ items, style = null, ...attrs }) {
  return (
    <div role="group" {...attrs}
      style={{ ...glass('well'), display: 'flex', alignItems: 'stretch', gap: 2, padding: 3, borderRadius: RADIUS.glassWell, width: '100%', ...style }}>
      {items.filter(Boolean).map((it) => (
        <span key={it.key} style={{ display: 'contents' }}>
          {it.sep && <span aria-hidden style={{ width: 1, alignSelf: 'stretch', margin: '10px 2px', background: C.line }} />}
          {it.render ? it.render(it) : <StripButton item={it} />}
        </span>
      ))}
    </div>
  );
}
