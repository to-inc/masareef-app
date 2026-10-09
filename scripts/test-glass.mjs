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
import { GLASS, glass, FROST, ATMOSPHERE, C } from '../src/theme.js';

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

// ——————————————————————————————————— 1. the v4 tiers (ARCHITECTURE A3) exist, and every blur carries both prefixes
// The unprefixed property alone leaves Safari — the only browser this app runs
// in — with no blur at all.
for (const name of ['card', 'chip', 'chrome', 'well', 'advisory', 'toast', 'raised', 'alert']) {
  ok(!!GLASS[name], `GLASS.${name} — a v4 tier — is missing`);
  if (!GLASS[name]) continue;
  const s = glass(name);
  if (!s.backdropFilter) continue;
  ok(s.WebkitBackdropFilter === s.backdropFilter,
    `glass('${name}') must emit -webkit-backdrop-filter identical to backdrop-filter`);
}
// R13: the card moved UP to .72/.40, blur 26, sat 160.
ok(/rgba\(255,255,255,0\.72\).*rgba\(255,255,255,0\.4\)/.test(GLASS.card.bg) && GLASS.card.blur === 26 && GLASS.card.sat === 160,
  'R13: GLASS.card is .72→.40, blur 26, sat 160');
ok(GLASS.advisory.blur === 16, 'A15: the advisory blur is pinned at 16');
let threw = false; try { glass('nope'); } catch { threw = true; }
ok(threw, 'glass() refuses an unknown tier rather than returning a plausible nothing');

// ——————————————————————————————————— 1b. A5: every translucent tier falls back to solid
{
  const css = readFileSync(join(HERE, '..', 'src', 'styles.css'), 'utf8');
  const blocks = [
    css.slice(css.indexOf('@supports not ((backdrop-filter')),
    css.slice(css.indexOf('@media (prefers-reduced-transparency: reduce)')),
  ];
  ok(blocks.every((b) => b.length > 30), 'A5: styles.css has both fallbacks — no blur support, and reduced transparency');
  for (const tier of ['card', 'chip', 'chrome', 'advisory', 'toast', 'raised', 'alert']) {
    ok(glass(tier).background.startsWith(`var(--glass-solid-${tier},`),
      `A5: glass('${tier}') paints through --glass-solid-${tier}, so the fallback can reach it`);
    ok(blocks.every((b) => new RegExp(`--glass-solid-${tier}:\\s*#[0-9A-Fa-f]{6}`).test(b.slice(0, b.indexOf('}') + 1))),
      `A5: both fallbacks give ${tier} a solid colour`);
  }
}

// ——————————————————————————————————— 2. frost is a real factor, not a dead token (R10)
const px = (s) => Number((s.backdropFilter.match(/blur\((\d+)px\)/) || [])[1]);
for (const name of ['card', 'chip', 'chrome', 'advisory']) {
  const sheer = px(glass(name, FROST.sheer));
  const designed = px(glass(name, FROST.designed));
  const deep = px(glass(name, FROST.deep));
  ok(sheer < designed && designed < deep,
    `glass('${name}') must scale its blur with the frost factor (got ${sheer} / ${designed} / ${deep})`);
}
ok(FROST.designed === 1, 'FROST.designed must be the identity factor');

// ——————————————————————————————————— 3. the Well does not blur, by specification
ok(glass('well').backdropFilter === undefined, 'the well must NOT blur — it is pressed, not frosted');
ok(/1px solid/.test(glass('well').border || ''), 'the well carries its ink hairline');

// ——————————————————————————————————— 3b. NO GLASS LITERAL IN A VIEW (A3)
// A white-alpha gradient or a backdrop blur written in a view is a recipe that
// drifts from the system — how «glass» shipped as solid white cards before.
const literal = /rgba\(255,\s*255,\s*255,\s*\.?\d|backdropFilter:\s*['"`]blur/;
const glassLiterals = [];
for (const p of files) {
  if (rel(p) === 'theme.js') continue;
  readFileSync(p, 'utf8').split('\n').forEach((l, i) => { if (literal.test(l)) glassLiterals.push(`${rel(p)}:${i + 1}`); });
}
ok(literal.test("background: 'linear-gradient(155deg, rgba(255,255,255,.7), x)'") && literal.test("backdropFilter: 'blur(4px)'"),
  'control: the literal detector sees a white-alpha gradient and a hand-written blur');
// RESIDUE, not a veto, until each view is converted in R20 step 3 — the count may only fall.
const GLASS_LITERAL_BUDGET = 4; // 2026-10-09: 4 white rims on harbor buttons (the nav blur went with R16)
ok(glassLiterals.length <= GLASS_LITERAL_BUDGET,
  `glass literals in views grew past ${GLASS_LITERAL_BUDGET} — use glass(tier): ${glassLiterals.join(', ')}`);

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
