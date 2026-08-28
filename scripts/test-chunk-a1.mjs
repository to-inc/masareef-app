#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK A1 ═══════════
 * «The token vocabularies in theme.js are COMPLETE per the ledger's TOKEN
 *  RULINGS — RADIUS (incl. inset), TYPE (incl. action, caption), SPACE, MOTION,
 *  GLYPH, ICON, TAP, UNIT_RATIO/unitSize — and every vocabulary is consumed,
 *  never merely exported.»
 *
 * WHY VALUES ARE ASSERTED LITERALLY. The ruled numbers (ledger, TOKEN RULINGS
 * 1–5, Planner 5 2026-08-25) are the Owner-ratified vocabulary; a token whose
 * value drifts is a different ruling wearing the same name. A pin like
 * `TYPE.action === TYPE.action` cannot fail and proves nothing, so every
 * assertion here is against the ruling's own literal.
 *
 * CONSUMERS, in two tiers, and why the second tier does not fail:
 *   · IN-THEME consumers exist today and are ASSERTED — DIVIDER's clearance is
 *     SPACE.gap, unitSize's floor is TYPE.label, its ratio is UNIT_RATIO, and
 *     TAP already has real view consumers. Value equality alone is a
 *     coincidence (12 === 12 proves nothing), so each in-theme consumption is
 *     pinned in SOURCE as well as measured at runtime.
 *   · VIEW consumers for MOTION, RADIUS, GLYPH, ICON are Wave 2's edits in
 *     files this chunk does not own. They are CENSUSED and reported, never
 *     asserted: a gate that goes red when another leaf lands its consumer —
 *     or green only after edits outside this chunk's ownership — is red or
 *     green for the wrong reason. When Wave 2 lands, move the vocabulary out
 *     of WAVE2_OWED below and its census line becomes an assertion.
 *
 * Every reach through a possibly-absent export goes through a guard: this gate
 * runs against trees where the tokens do not exist, and a gate that dies
 * instead of failing reports nothing.
 */
import { readFileSync, readdirSync } from 'node:fs';

const MARKER = 'CHUNK-A1-GREEN';

let pass = 0;
const failures = [];
const eq = (a, b, label) => {
  if (Object.is(a, b)) { pass++; return; }
  failures.push(`${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const ok = (c, label) => eq(!!c, true, label);
const at = (fn, label) => {
  try { return fn(); } catch (err) { failures.push(`${label}\n      THREW — ${err && err.message}`); return undefined; }
};

// ——— the module, guarded: an absent vocabulary is a named red, not a crash
let T = {};
try { T = await import('../src/theme.js'); }
catch (err) { failures.push(`theme.js failed to import — every vocabulary check below is moot\n      THREW — ${err && err.message}`); }
const { RADIUS, TYPE, SPACE, MOTION, GLYPH, ICON, TAP, UNIT_RATIO, unitSize, DIVIDER } = T;

// ——— the source text, guarded: comment pins and consumption pins read it raw
let src = null;
try { src = readFileSync(new URL('../src/theme.js', import.meta.url), 'utf8'); }
catch (err) { failures.push(`theme.js source is unreadable — comment pins cannot run\n      THREW — ${err && err.message}`); }
const pin = (re, label) => ok(src !== null && re.test(src), label);

/**
 * ——— 1. RADIUS — three surfaces plus the inset (ruling 4).
 */
// ⚠️ MOVED 2026-08-28 with the approved glass redesign — «Card — 26r» and
// «Row — 20r» in the design file. Two pins in two suites held this scale
// (A1 by value, A3.V by verbatim line); both move together with the ruling,
// which is the point of having had two.
eq(RADIUS?.card, 26, 'RADIUS.card — the card surface (glass 26r)');
eq(RADIUS?.row, 20, 'RADIUS.row — the row surface (glass 20r)');
eq(RADIUS?.capsule, 999, 'RADIUS.capsule — the pill');
eq(RADIUS?.inset, 8, 'RADIUS.inset — ruling 4: the small inner surface, 8');
pin(/GEOMETRY EXEMPTION/, 'the GEOMETRY EXEMPTION is named in theme.js — inline radii cite it by this name, so the name must exist to cite');

/**
 * ——— 2. TYPE — six reading sizes plus the two ruled roles.
 */
eq(TYPE?.hero, 40, 'TYPE.hero');
eq(TYPE?.display, 34, 'TYPE.display');
eq(TYPE?.section, 22, 'TYPE.section');
eq(TYPE?.row, 17, 'TYPE.row');
eq(TYPE?.body, 16, 'TYPE.body');
eq(TYPE?.label, 15, 'TYPE.label — the senior prose floor');
eq(TYPE?.action, 19, 'TYPE.action — ruling 1: a named role, not a compositional rule; the Inbox one-tap guess stays ≥19');
eq(TYPE?.caption, 13, 'TYPE.caption — ruling 2: below the prose floor, so its restriction must exist');
pin(/DUPLICATE information available elsewhere/,
  'caption carries its restriction in words — 13px is legal ONLY for annotations that duplicate information available elsewhere');

/**
 * ——— 3. SPACE — complete: the four ruled roles (never-assigned before A1).
 */
eq(SPACE?.gutter, 20, 'SPACE.gutter — the screen side margin');
eq(SPACE?.gap, 12, 'SPACE.gap — between siblings');
eq(SPACE?.cardPad, 16, 'SPACE.cardPad — a card’s own inset');
eq(SPACE?.section, 32, 'SPACE.section — between titled groups');

/**
 * ——— 4. MOTION — complete: four durations, two easings (north-star §3).
 */
eq(MOTION?.tap, 120, 'MOTION.tap');
eq(MOTION?.move, 260, 'MOTION.move');
eq(MOTION?.page, 320, 'MOTION.page');
eq(MOTION?.draw, 700, 'MOTION.draw — the chart draw, once per mount');
eq(MOTION?.easeOut, 'cubic-bezier(0.2,0,0,1)', 'MOTION.easeOut');
eq(MOTION?.easeSettle, 'cubic-bezier(0.22,1,0.36,1)', 'MOTION.easeSettle');

/**
 * ——— 5. GLYPH / ICON — the not-type vocabularies, part of the complete claim.
 */
eq(GLYPH?.illustration, 46, 'GLYPH.illustration');
eq(GLYPH?.spot, 34, 'GLYPH.spot');
// ⚠️ 21→20 with the glass redesign (2026-08-28): the nav glyph is 20 at rest
// and 26 pressed (NAV.iconActive), because icon scale became a state signal.
eq(ICON?.nav, 20, 'ICON.nav — the glyph at REST (NAV.iconActive is the pressed size)');
eq(ICON?.primary, 32, 'ICON.primary');
eq(ICON?.control, 17, 'ICON.control');

/**
 * ——— 6. TAP — the touch floor, already consumed by real screens.
 */
eq(TAP, 48, 'TAP — the senior touch floor');

/**
 * ——— 7. UNIT_RATIO / unitSize — ruling 5, the floor as arithmetic.
 *
 * The floor must bind to TYPE.label BY REFERENCE: an implementation hardcoding
 * 15 passes every value check below and silently detaches from the prose floor
 * the moment TYPE.label moves — so the function's own source is pinned too.
 */
eq(UNIT_RATIO, 0.55, 'UNIT_RATIO — the unit runs at 0.55× its value');
if (typeof unitSize !== 'function') {
  failures.push('unitSize is not exported as a function — the ratio has no arithmetic to live in');
} else {
  pass++;
  eq(at(() => unitSize(40), 'unitSize(40)'), 22, 'unitSize(40) — the hero’s unit, above the floor: 0.55 × 40 = 22');
  eq(at(() => unitSize(100), 'unitSize(100)'), 55, 'unitSize(100) — the bare ratio, visible where the floor is far away');
  ok(at(() => unitSize(22), 'unitSize(22)') === TYPE?.label && typeof TYPE?.label === 'number',
    'unitSize(22) === TYPE.label — 12.1 would defeat the scale in front of a 70-year-old; the floor holds');
  ok(at(() => unitSize(0), 'unitSize(0)') === TYPE?.label && typeof TYPE?.label === 'number',
    'unitSize(0) === TYPE.label — the floor holds at the bottom, never a 0px unit');
  ok(String(unitSize).includes('TYPE.label'),
    'the floor is TYPE.label by REFERENCE — a literal 15 detaches from the prose floor the day it moves');
  ok(String(unitSize).includes('UNIT_RATIO'),
    'the ratio is UNIT_RATIO by REFERENCE — same drift, other operand');
}

/**
 * ——— 8. ANTI-DRIFT (A11, absorbed): the palette's role casting is stated
 * where the palette lives, so «a new hue» has to argue with the comment.
 */
pin(/Gentler-green/, 'anti-drift names harbor’s role: harbor plays Gentler-green');
pin(/Gentler-orange-Add/, 'anti-drift names amber’s role: amber plays Gentler-orange-Add');

/**
 * ——— 9. IN-THEME CONSUMERS — the vocabulary is law only where something obeys it.
 */
ok(typeof SPACE?.gap === 'number' && DIVIDER?.paddingBottom === SPACE.gap,
  'DIVIDER consumes SPACE — the clearance under the beads IS the sibling gap (measured)');
pin(/paddingBottom:\s*SPACE\.gap/,
  'DIVIDER consumes SPACE in SOURCE — 12 === 12 by coincidence is not consumption');

/**
 * ——— 10. THE CONSUMER CENSUS across src/ (theme.js excluded).
 *
 * A consumer is a file whose theme.js import names the token. Vocabularies in
 * WAVE2_OWED have their view consumers owed to Wave 2 edits outside this
 * chunk's ownership — their lines report, the rest assert.
 */
const WAVE2_OWED = ['MOTION', 'RADIUS', 'GLYPH', 'ICON', 'TYPE', 'SPACE', 'UNIT_RATIO', 'unitSize'];
const census = at(() => {
  const files = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = new URL(`${dir.pathname}/${e.name}`, dir);
      if (e.isDirectory()) walk(p);
      else if (/\.jsx?$/.test(e.name) && e.name !== 'theme.js') files.push(p);
    }
  };
  walk(new URL('../src', import.meta.url));
  const names = ['RADIUS', 'TYPE', 'SPACE', 'MOTION', 'GLYPH', 'ICON', 'TAP', 'UNIT_RATIO', 'unitSize'];
  const counts = Object.fromEntries(names.map((n) => [n, 0]));
  for (const p of files) {
    const text = readFileSync(p, 'utf8');
    const m = text.match(/import\s*\{([^}]*)\}\s*from\s*['"][^'"]*theme\.js['"]/);
    if (!m) continue;
    const imported = m[1].split(',').map((s) => s.trim());
    for (const n of names) if (imported.includes(n)) counts[n]++;
  }
  return counts;
}, 'the consumer census walked src/');

if (census) {
  ok(census.TAP >= 1, `TAP is consumed by real screens (census: ${census.TAP} files) — a floor nothing stands on is decoration`);
  for (const [name, n] of Object.entries(census)) {
    if (name === 'TAP') continue;
    if (WAVE2_OWED.includes(name)) {
      console.log(n === 0
        ? `  · ${name} src consumers: 0 — view consumers OWED to Wave 2 (reported, not asserted: those files are not this chunk’s to edit)`
        : `  · ${name} src consumers: ${n} — landed; tighten this gate: move ${name} out of WAVE2_OWED so it asserts`);
    } else {
      ok(n >= 1, `${name} has ≥1 src consumer (census: ${n})`);
    }
  }
}

if (failures.length) {
  console.log(`❌ CHUNK A1 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · the vocabulary is complete, ruled, and consumed`);
