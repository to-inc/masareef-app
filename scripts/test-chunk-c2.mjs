#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK C2 ═══════════
 * «The active nav item sits in a 48pt harbor-tinted circle — “you are here”;
 *  inactive items stay quiet; the circle is a STATE, not a shadow (A2 law).»
 *  (chunk-ledger C2 · north-star §4.3)
 *
 * WHY THE CIRCLE LIVES IN styles.css AND NOT IN TabButton. Primitives.jsx is
 * another leaf's file; the shell owns its own chrome. TabButton already emits
 * the one honest hook — aria-current="page" — so the circle is a stylesheet
 * consequence of the accessibility state, which has a property the inline
 * version lacks: the visual «you are here» and the announced «current page»
 * cannot disagree, because they are one attribute.
 *
 * WHY THE CSS VARIABLES ARE PINNED AGAINST theme.js. A stylesheet cannot
 * import a token, so :root restates TAP / RADIUS.capsule / C.harbor / C.ink as
 * custom properties — and a restated value is exactly the drift the token law
 * exists to catch. This oracle holds the two files equal, so editing theme.js
 * without styles.css (or the reverse) goes red rather than quietly forking the
 * vocabulary.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { C, TAP, NAV } from '../src/theme.js';

// ═══ RE-CUT 2026-10-09 to OWNER-RULINGS R16: the 48pt tinted circle is retired.
// «You are here» is now the WHOLE side tab tinted harbor (.13) with an ink 700
// label; «جديد» is a filled harbor pill, always. aria-current still carries it.
const MARKER = 'CHUNK-C2-GREEN';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };

const css = read('src/styles.css');
ok(!/nav button\[aria-current/.test(css) && !/--harbor-tint/.test(css),
  'C2.1 the retired circle rule and its --harbor-tint are gone from styles.css — no CSS can repaint the v4 tab behind its back');
ok(NAV.activeTint.replace(/\s/g, '') === 'rgba(62,124,166,0.13)', 'C2.2 the active tint is C.harbor at .13 (R16)');

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { TabButton } = await vite.ssrLoadModule('/src/components/Primitives.jsx');
  const r = (p) => renderToStaticMarkup(createElement(TabButton, { onClick: () => {}, label: 'الدفتر', icon: 'x', ...p }));
  const on = r({ active: true }), off = r({ active: false });
  ok(on.includes('aria-current="page"') && !off.includes('aria-current'), 'C2.3 aria-current marks the active tab, and only it');
  ok(on.includes('background:rgba(62,124,166,0.13)') && off.includes('background:transparent'), 'C2.4 the active side tab is tinted harbor; at rest it is clear');
  ok(on.includes(`color:${C.ink}`) && on.includes('font-weight:700'), 'C2.5 the active label is ink 700 (R16)');
  ok(off.includes(`color:${C.muted}`) && off.includes('font-weight:600'), 'C2.6 a resting label is muted 600 — chrome\'s «600+» floor');
  ok(new RegExp(`min-height:${TAP}px`).test(on), 'C2.7 every tab is at least the 48pt touch floor');
  const big = r({ big: true, active: false, label: 'جديد' });
  const bigOn = r({ big: true, active: true, label: 'جديد' });
  ok(big.includes('linear-gradient(160deg, #3E7CA6, #34688C)') && bigOn.includes('linear-gradient(160deg, #3E7CA6, #34688C)'),
    'C2.8 «جديد» is the canonical harbor gradient — filled at rest AND active (R16 «always», R13 start stop)');
  ok(big.includes(`color:${C.onDark}`) && big.includes('font-weight:700'), 'C2.9 «جديد» is white 700 on the pill');
  ok(big.includes(`flex:${NAV.newFlex}`), 'C2.10 «جديد» is the wider pill (flex 1.15)');
  const badged = r({ active: false, badge: 3 });
  ok(/background:#A05446[^"]*font-size:12px/.test(badged) && badged.includes('>3<'), 'C2.11 the review badge is a terracotta disc with its count');
} finally { await vite.close(); }

if (failures.length) {
  console.log(`❌ CHUNK C2 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · «you are here» is a tinted tab with an ink 700 label; «جديد» is always filled`);
