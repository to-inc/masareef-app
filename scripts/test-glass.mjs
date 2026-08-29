#!/usr/bin/env node
/**
 * THE GLASS LAYER'S INVARIANTS (glass audit Tier 2/3).  `npm run check:glass`
 *
 * The glass redesign added a whole surface vocabulary to theme.js and no suite
 * owned it. That is the gap this file closes — but the reason it exists is one
 * specific trap the audit found, which no amount of looking at the screen would
 * ever reveal:
 *
 *   A CSS `filter` other than `none` makes its element the CONTAINING BLOCK for
 *   every `position: fixed` descendant.
 *
 * The design prototype applies the atmosphere tint as `#glass-root { filter }`,
 * an ancestor of everything. Ported here that would silently re-parent the nav
 * and all three bottom sheets — and because `ATMOSPHERE.morning` is `'none'`,
 * it would work perfectly under the default setting and break only under Golden
 * hour and Cool dusk. A bug that appears only under two of three settings, in a
 * property nobody associates with layout, is the kind that costs a day.
 *
 * So the guard below is not a style preference. It is the assertion that the
 * trap has not been built, enforced every run rather than remembered.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLASS, FROST, ATMOSPHERE, C } from '../src/theme.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
let pass = 0;
const failures = [];
const ok = (cond, msg) => { if (cond) pass++; else failures.push(msg); };

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : (/\.jsx?$/.test(p) ? [p] : []);
});
const files = walk(SRC);
const rel = (p) => p.slice(SRC.length + 1);

// ——————————————————————————————————— 1. every blurring recipe carries both prefixes
// A15's law, app side: the unprefixed property alone leaves Safari — which is
// the only browser this app runs in — with no blur at all.
const blurring = ['card', 'row', 'advisory', 'smartEdge'];
for (const name of blurring) {
  const fn = GLASS[name];
  if (typeof fn !== 'function') { failures.push(`GLASS.${name} is missing`); continue; }
  const s = fn(1);
  if (!s.backdropFilter) continue;          // a recipe may legitimately not blur
  ok(s.WebkitBackdropFilter === s.backdropFilter,
    `GLASS.${name} must emit -webkit-backdrop-filter identical to backdrop-filter`);
}

// ——————————————————————————————————— 2. frost is a real factor, not a dead token
// A22: frost must be TOKEN-DRIVEN. The design prototype drove it from a
// `[style*="backdrop-filter"]` attribute selector, which matches zero elements
// the moment recipes become shared tokens — it dies outright rather than
// degrading. Here every recipe takes the factor, so this asserts it is consumed.
const px = (s) => Number((s.backdropFilter.match(/blur\((\d+)px\)/) || [])[1]);
for (const name of ['card', 'row', 'advisory']) {
  const sheer = px(GLASS[name](FROST.sheer));
  const designed = px(GLASS[name](FROST.designed));
  const deep = px(GLASS[name](FROST.deep));
  ok(sheer < designed && designed < deep,
    `GLASS.${name} must scale its blur with the frost factor (got ${sheer} / ${designed} / ${deep})`);
}
ok(FROST.designed === 1, 'FROST.designed must be the identity factor');

// ——————————————————————————————————— 3. the Well does not blur, by specification
// HANDOFF:27 gives the Well no blur, so frost skipping it is correct rather than
// an omission. Asserted so a later "consistency" pass does not add one.
ok(GLASS.well().backdropFilter === undefined,
  'GLASS.well() must NOT blur — HANDOFF:27 specifies no blur for a pressed well');

// A24, app side: the nav well carries HANDOFF:27's ink hairline.
ok(/1px solid/.test(GLASS.well().border || ''),
  'GLASS.well() must carry the ink hairline border (A24)');

// ——————————————————————————————————— 4. THE A22 GUARD
// No component may set a bare CSS `filter`. ATMOSPHERE is the only thing that
// would want one, and it must be applied to a GROUND LAYER that is not an
// ancestor of anything fixed.
const offenders = [];
for (const p of files) {
  const src = readFileSync(p, 'utf8');
  // `filter:` in a style object — NOT backdropFilter, NOT a JS .filter() call,
  // NOT the word inside a comment or a string of prose.
  const lines = src.split('\n');
  lines.forEach((l, i) => {
    if (/(^|[^k])filter:\s*['"`]/.test(l) && !/backdropFilter|WebkitBackdropFilter/.test(l)) {
      offenders.push(`${rel(p)}:${i + 1}`);
    }
  });
}
ok(offenders.length === 0,
  'a CSS filter creates a containing block for position: fixed — the nav and all three '
  + `sheets would re-parent. Found at: ${offenders.join(', ')}`);

// The default atmosphere must stay inert, so the trap cannot hide behind it.
ok(ATMOSPHERE.morning === 'none',
  'ATMOSPHERE.morning must be none — the default is what makes a filter bug invisible');

// Negative control for the guard above: the same matcher, run against a known
// positive, must fire. Without this the absence assertion proves nothing.
const CONTROL = "  style={{ filter: 'sepia(.12)' }}";
ok(/(^|[^k])filter:\s*['"`]/.test(CONTROL) === true,
  'the filter matcher failed its positive control — the guard would pass vacuously');
const CONTROL_NEG = '  backdropFilter: blur(26px)';
ok(/(^|[^k])filter:\s*['"`]/.test(CONTROL_NEG) === false,
  'the filter matcher fires on backdropFilter — it would report false positives');

// ——————————————————————————————————— 5. the ground stops are the design's, verbatim
ok(typeof C.harborInk === 'string' && C.harborInk === '#34688C',
  'harborInk must be the ratified gradient end stop #34688C (A7)');

const report = failures.length
  ? `❌ ${failures.length} / ${pass + failures.length} glass checks failed:\n  - ${failures.join('\n  - ')}`
  : `✅ all ${pass} glass checks passed`;
console.log(report);
process.exit(failures.length ? 1 : 0);
