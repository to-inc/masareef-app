#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK B5 ═══════════
 * «Header scrim: a FIXED gradient strip under the header, so content scrolling
 *  beneath dissolves instead of guillotining against the harbor edge. It is
 *  FURNITURE, not a shadow.» (chunk-ledger B5 · nav-F5)
 *
 * WHERE «FIXED» ACTUALLY LIVES, stated so the pin cannot be misread. A
 * viewport-fixed strip needs the header's exact height, which is
 * safe-area-dependent and font-dependent — a hardcoded top is broken on the
 * one device that matters the day the notch inset changes. The header itself
 * NEVER SCROLLS: it is a flexShrink:0 sibling of <main>, outside the scroll
 * container. So the scrim is absolutely anchored to the header's bottom edge
 * (top: 100%), which is fixed-in-effect by construction — it cannot scroll
 * because nothing it is attached to can. That anchoring argument is what this
 * oracle pins, clause by clause.
 *
 * WHY THE GROUND IS TAB-AWARE. The Book tab paints the MORNING_CROWN (mist →
 * shell) behind <main>; every other tab paints shell. A scrim that always
 * dissolved to shell would hang a cream veil over a blue-tinted morning — the
 * strip must dissolve INTO the ground it sits on, or it stops being furniture
 * and starts being paint.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKER = 'CHUNK-B5-GREEN';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };

const app = read('src/App.jsx');

// ——— the header is findable, non-scrolling, and positioned to anchor a child
const hAt = app.indexOf('<header');
const header = hAt === -1 ? '' : app.slice(hAt, app.indexOf('</header>'));
ok(hAt !== -1 && header.length > 0, 'B5.0 the header is findable in App.jsx');
ok(/position: 'relative'/.test(header),
  'B5.1 the header is position:relative — the anchor the scrim hangs from');
ok(/flexShrink: 0/.test(header),
  'B5.2 …and flexShrink:0 — it can never be squeezed or scrolled, which is what makes its child fixed-in-effect');
// /<main\s/ — the ELEMENT: a doc comment higher up legitimately says «<main>»
// in prose, and prose is not a scroll container.
ok(app.indexOf('</header>') !== -1
  && app.indexOf('</header>') < (/<main\s/.exec(app) || { index: -1 }).index,
  'B5.3 the header (and so the scrim) lives OUTSIDE the scroll container — nothing inside <main> could hold still');

// ——— the scrim itself: absolute at the header's hem, gradient, ghost
const sAt = header.indexOf('aria-hidden');
const scrim = sAt === -1 ? '' : header.slice(sAt);
ok(sAt !== -1, 'B5.4 the scrim exists inside the header, aria-hidden — VoiceOver announces the heading, never the furniture');
ok(/position: 'absolute'/.test(scrim) && /top: '100%'/.test(scrim),
  'B5.5 it hangs at top:100% — the strip is UNDER the header, riding its real height (safe-area included) instead of guessing it');
ok(/linear-gradient\(180deg/.test(scrim) && /withAlpha\(/.test(scrim),
  'B5.6 it is a GRADIENT dissolving to the transparent form of its own ground token — never a second opaque bar');
ok(/const scrimGround = tab === 'book' && !needsSetup \? C\.mist : C\.shell;/.test(app)
  && scrim.includes('scrimGround'),
  'B5.7 the ground is tab-aware: mist over the Book\'s morning crown, shell everywhere else — it dissolves into what is actually there');
ok(/pointerEvents: 'none'/.test(scrim),
  'B5.8 pointerEvents:none — furniture may never eat a tap on the one screen area next to the refresh button');
ok(/insetInline: 0/.test(scrim),
  'B5.9 it spans the full width — a partial scrim reads as a rendering artifact, not a surface');

// ——— furniture, NOT a shadow — the chunk's own words, held against the code
// boxShadow the PROPERTY — the doc comment above the scrim names «shadow» in
// prose precisely to forbid it, and prose is not a declaration.
ok(!/box-?shadow/i.test(header),
  'B5.10 no box-shadow anywhere on the header or its scrim — elevation by gradient light, not by a floating dark');

if (failures.length) {
  console.log(`❌ CHUNK B5 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · the header hem dissolves scrolling content into its own ground`);
