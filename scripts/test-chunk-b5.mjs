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
 * WHY THE GROUND IS TAB-AWARE. The Book tab paints GROUND.dawn, New paints
 * GROUND.tide and the rest paint GROUND.haze (glass redesign, 2026-08-28;
 * MORNING_CROWN is retired). The scrim dissolves into GROUND_CROWN — the top
 * colour of whichever ground is painted. A scrim that always
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

// ═══ RE-CUT 2026-10-09: B5 is RETIRED by OWNER-RULINGS R0. The harbor header and
// its scrim are gone; the screen's name floats on the ground in ink, and the
// header controls are ink on glass. This suite now pins THAT, so neither the
// slab nor the scrim can drift back.
const hAt = app.indexOf('<header');
const header = hAt === -1 ? '' : app.slice(hAt, app.indexOf('</header>'));
ok(hAt !== -1 && header.length > 0, 'B5.0 the header is findable in App.jsx');
ok(/flexShrink: 0/.test(header), 'B5.1 the header does not scroll — a flexShrink:0 sibling of the scroll box');
ok(!/background:/.test(header.slice(0, header.indexOf('>'))) && !/C\.harbor/.test(header),
  'B5.2 no harbor slab: the header paints no background of its own — it floats on the ground (R0)');
ok(/color: C\.ink/.test(header), 'B5.3 the header speaks ink, not white-on-harbor (R0)');
ok(!/aria-hidden/.test(header) && !/top: '100%'/.test(header) && !/scrimGround/.test(app),
  'B5.4 the scrim is gone — no strip hangs under the header, and its ground variable is not left behind');
ok(/fontFamily: FONT_DISPLAY, fontSize: TYPE\.title/.test(header), 'B5.5 the screen\'s name is the display face at TYPE.title (24, v4 P3)');
ok(/viewTab === 'book' \? S\.tabBook/.test(header), 'B5.6 the title names the screen he is on — the one under the entry sheet when it is open (v4 P3/P4)');
ok(/<SettingsCog/.test(header) && /<RefreshButton[\s\S]{0,240}savedAt=\{savedAt\}/.test(header),
  'B5.7 the controls are the cog and the sync pill — which carries when the book was last read (R19)');
ok(/env\(safe-area-inset-top\)/.test(header), 'B5.8 the header clears the status bar on its own (safe-area-inset-top)');

if (failures.length) {
  console.log(`❌ CHUNK B5 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · the header floats on the ground in ink — no slab, no scrim (R0)`);
