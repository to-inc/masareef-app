#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK B2 ═══════════
 * «View-swap entrance on tab/period change: opacity + 8px rise at MOTION.page
 *  (320ms), @keyframes in styles.css with the prefers-reduced-motion media
 *  guard — motion collapses to an INSTANT SWAP, content never hidden.»
 *  (chunk-ledger B2 · north-star §4.2 · nav-F3/F12)
 *
 * THE MEDIA GUARD IS THE HALF THAT CAN HURT SOMEONE. The entrance keyframe
 * starts at opacity 0; if reduced motion were honoured by pausing the animation
 * rather than removing it, the view would ENTER invisible and stay there — the
 * accessibility setting would blank the app for exactly the users who set it.
 * `animation: none` is the only correct collapse: the element renders at its
 * natural (final) state instantly. So this oracle pins the guard's FORM, and
 * pins that .view-in carries no opacity of its own outside the keyframes.
 *
 * WHY THE :root VARS ARE PINNED EQUAL TO theme.js MOTION. A stylesheet cannot
 * import the vocabulary, so it restates it once as custom properties — the one
 * legal restatement, and only because this suite holds the two files equal.
 * Every animation in styles.css must then SPEAK vars, never raw seconds: the
 * old 0.28s/0.18s/0.15s/0.08s literals are pinned gone.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOTION } from '../src/theme.js';

const MARKER = 'CHUNK-B2-GREEN';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };

const css = read('src/styles.css');
const app = read('src/App.jsx');

// ——— the CSS↔theme bridge, held equal (the durations AND both easings)
const cssVar = (name) => {
  const m = new RegExp(`--${name}:\\s*([^;]+);`).exec(css);
  return m ? m[1].trim() : null;
};
for (const [name, want] of [
  ['dur-tap', `${MOTION.tap}ms`], ['dur-move', `${MOTION.move}ms`],
  ['dur-page', `${MOTION.page}ms`], ['dur-draw', `${MOTION.draw}ms`],
  ['ease-out', MOTION.easeOut], ['ease-settle', MOTION.easeSettle],
]) {
  ok(cssVar(name) === want,
    `B2.1 :root --${name} equals theme MOTION (${want}) — got ${JSON.stringify(cssVar(name))}`);
}

// ——— the entrance itself: opacity + 8px rise, page-scale, settle
const kfAt = css.indexOf('@keyframes viewin');
const kf = kfAt === -1 ? '' : css.slice(kfAt, css.indexOf('}\n', css.indexOf('to', kfAt)) + 1);
ok(kfAt !== -1, 'B2.2 @keyframes viewin exists in styles.css — the entrance is stylesheet fact, not inline improvisation');
ok(/from\s*\{\s*opacity:\s*0;\s*transform:\s*translateY\(8px\);?\s*\}/.test(kf),
  'B2.3 it starts faded and 8px LOW — the rise the Owner praised, at the ruled distance');
ok(/to\s*\{\s*opacity:\s*1;\s*transform:\s*translateY\(0\);?\s*\}/.test(kf),
  'B2.4 …and lands at rest, fully present');

// '\n.view-in {' — the RULE at line start; the vocabulary comment above the
// keyframes mentions the class in prose.
const ruleAt = css.indexOf('\n.view-in {');
const rule = ruleAt === -1 ? '' : css.slice(ruleAt, css.indexOf('}', ruleAt) + 1);
ok(ruleAt !== -1 && /animation:\s*viewin\s+var\(--dur-page\)\s+var\(--ease-settle\)\s+both/.test(rule),
  'B2.5 .view-in runs viewin at var(--dur-page) with var(--ease-settle) both — a screen SWAP rides the page token, settling');
ok(rule && !/opacity/.test(rule),
  'B2.6 .view-in carries NO opacity of its own — with the animation removed the view must render fully visible, instantly');

// ——— the media guard: instant swap, content never hidden
{
  const mediaAt = css.indexOf('@media (prefers-reduced-motion: reduce)');
  ok(mediaAt !== -1, 'B2.7 the prefers-reduced-motion block exists');
  const media = css.slice(mediaAt);
  ok(/\.view-in[^{]*\{[^}]*animation:\s*none/.test(media.replace(/\n/g, ' ')),
    'B2.8 under reduced motion .view-in collapses to animation:none — an instant state change, never a paused opacity-0');
}

// ——— the shell APPLIES it, keyed — an entrance nothing triggers is theatre that never opens
ok(/key=\{tab\} className="view-in"/.test(app),
  'B2.9 App.jsx wraps the swapped view in key={tab} + .view-in — remount on tab change is what replays the entrance');

// ——— the old raw seconds are gone; the surviving classes ride the vocabulary
for (const literal of ['0.28s', '0.18s', '0.15s', '0.08s']) {
  ok(!css.includes(literal),
    `B2.10 styles.css no longer states ${literal} raw — a raw duration where a MOTION token exists is a defect`);
}
ok(/\.card-in\s*\{\s*animation:\s*slideup\s+var\(--dur-move\)/.test(css),
  'B2.11 .card-in (a move within the screen) rides var(--dur-move)');
// AMENDED at Wave-3 integration (Planner): the toast now enters as a SHEET —
// B4's entrance in Primitives.jsx — so `.toast-in`/`pop` died with their last
// consumer. The pin flips from «rides the token» to «stays dead»: a revived
// orphan class is exactly the drift a motion census exists to catch.
// Comments stripped first: the tombstone comment naming the dead class is
// documentation, not a revival.
ok(!/\.toast-in/.test(css.replace(/\/\*[\s\S]*?\*\//g, ''))
  && !/@keyframes pop\b/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')),
  'B2.12 .toast-in and @keyframes pop stay DELETED — the toast rides B4\'s sheet entrance now, and dead motion does not linger');
ok(css.includes('.spin { animation: spin 0.9s linear infinite; }'),
  'B2.13 the spinner alone keeps its literal — an INDEFINITE progress loop is not in the tap/move/page/draw vocabulary, '
  + 'and its reduced-motion collapse is already pinned in the media block');

if (failures.length) {
  console.log(`❌ CHUNK B2 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · views enter at MOTION.page and collapse instantly under reduced motion`);
