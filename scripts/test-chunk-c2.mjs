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
import { C, TAP, RADIUS } from '../src/theme.js';

const MARKER = 'CHUNK-C2-GREEN';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };

const css = read('src/styles.css');
const prims = read('src/components/Primitives.jsx');

// ——— the CSS↔theme bridge: restated once, held equal here
const cssVar = (name) => {
  const m = new RegExp(`--${name}:\\s*([^;]+);`).exec(css);
  return m ? m[1].trim() : null;
};
ok(cssVar('tap') === `${TAP}px`,
  `C2.1 :root --tap equals theme TAP (${TAP}px) — got ${JSON.stringify(cssVar('tap'))}`);
ok(TAP === 48, 'C2.1b …and TAP is still the 48pt senior floor the chunk names');
ok(cssVar('radius-capsule') === `${RADIUS.capsule}px`,
  `C2.2 :root --radius-capsule equals RADIUS.capsule (${RADIUS.capsule}px) — got ${JSON.stringify(cssVar('radius-capsule'))}`);
{
  const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',');
  const tint = cssVar('harbor-tint') || '';
  ok(tint.replace(/\s/g, '').includes(`rgba(${hexRgb(C.harbor)},`),
    `C2.3 --harbor-tint is C.harbor's own rgb (${hexRgb(C.harbor)}) at an alpha — a tint, never a fifth hue`);
  ok((cssVar('ink') || '').toLowerCase() === C.ink.toLowerCase(),
    `C2.4 :root --ink equals C.ink (${C.ink}) — got ${JSON.stringify(cssVar('ink'))}`);
}

// ——— the circle itself: 48pt, capsule-clamped, tinted, centred
const sel = 'nav button[aria-current="page"] > div:first-child';
const at = css.indexOf(sel);
const block = at === -1 ? '' : css.slice(at, css.indexOf('}', at) + 1);
ok(at !== -1, `C2.5 the circle rule exists: ${sel}`);
ok(/width:\s*var\(--tap\)/.test(block) && /height:\s*var\(--tap\)/.test(block),
  'C2.6 the circle is TAP × TAP — the «you are here» mark IS the touch floor, not a decoration inside it');
ok(/border-radius:\s*var\(--radius-capsule\)/.test(block),
  'C2.7 its radius rides the capsule token (via the pinned var), clamping the 48pt box to a circle on purpose');
{
  const lines = css.slice(0, at).split('\n');
  const above = lines.slice(-5).join('\n');
  ok(/geometry[\s-]*exemption/i.test(above + block),
    'C2.8 the clamp is DECLARED — the named geometry-exemption comment stands where A3\'s audit will read it');
}
ok(/background:\s*var\(--harbor-tint\)/.test(block),
  'C2.9 the fill is the harbor tint — harbor plays selection (anti-drift casting), softly');
ok(/display:\s*flex/.test(block) && /align-items:\s*center/.test(block) && /justify-content:\s*center/.test(block),
  'C2.10 the glyph is centred IN the circle — a 21px icon in a 48pt circle without centring reads as a misprint');

// ——— a state, not a shadow — and quiet neighbours
const c2Region = css.slice(css.indexOf('/* C2'), css.indexOf('}', at) + 400);
ok(c2Region.length > 0 && !/shadow/i.test(c2Region),
  'C2.11 no shadow anywhere in the C2 rules — the circle is a state (A2: luminance and fill carry meaning, nothing floats)');
ok((css.match(/var\(--harbor-tint\)/g) || []).length === 1,
  'C2.12 exactly ONE consumer of the tint — inactive items stay quiet; a second tinted circle would unsay «you are here»');

// ——— the label ink override: the C1 worst case is what forces it
{
  const m = /nav button\[aria-current="page"\]\s*\{[^}]*color:\s*var\(--ink\)\s*!important/.exec(css);
  ok(!!m,
    'C2.13 the active label reads in INK over the translucent bar — harbor at 13.5px bold measures under 4.5:1 on the C1 '
    + 'worst-case composite (test-contrast), so the state is carried by circle + weight, never by an ink that fails its floor');
}

// ——— the hook this whole chunk hangs on, and the neighbour it must not break
ok(/aria-current=\{active \? 'page' : undefined\}/.test(prims),
  'C2.14 TabButton still emits aria-current="page" — the one attribute the circle, the ink and VoiceOver all read');
ok(/background: C\.harbor, color: C\.onDark/.test(prims),
  'C2.15 the big ﹢ keeps its OWN inline fill — the ink override cannot pierce it, so the primary action stays white-on-harbor');

if (failures.length) {
  console.log(`❌ CHUNK C2 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · «you are here» is a 48pt tinted state, quiet elsewhere`);
