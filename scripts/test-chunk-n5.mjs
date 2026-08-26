#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK N5 ═══════════
 * «Boxed sections on the shell: white RADIUS.card sections with SPACE-token
 *  gaps (≥16) — the New screen breathes in sections, not a single cramped
 *  column.» (chunk-ledger N5 · north-star §4.1 «boxed white sections on
 *  shell, 16–20px gaps» · gates/N5.gates.md)
 *
 * THE ORACLE PINS TOKENS, NOT PX — by the chunk's own words. Every expected
 * pixel below is COMPUTED from the imported vocabulary (SPACE, RADIUS, C), so
 * a future ruling that moves a token moves this gate with it; only the ≥16
 * floor is a literal, because the floor is the chunk's claim, not a token's
 * current value.
 *
 * WHAT A WRONG IMPLEMENTATION WOULD STILL PASS, per family: a screen boxed
 * with raw 16s passes the render and fails the source pins (the token must be
 * CONSUMED, not coincided with); sections drawn with borders or shadows pass
 * the counting and fail the A2-law pins (luminance carries elevation, nothing
 * else); a gap quietly re-tokenized onto SPACE.gap (12) passes the token pin
 * and fails the floor.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';
import { SPACE, RADIUS, C } from '../src/theme.js';

const MARKER = 'CHUNK-N5-GREEN';

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };
const eq = (a, b, label) => ok(Object.is(a, b),
  `${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

// ——— the vocabulary can carry the claim at all
ok(SPACE.cardPad >= 16, `N5.0 vocabulary — SPACE.cardPad ≥ 16 (got ${SPACE.cardPad}); the chunk's floor is expressible in tokens`);
ok(SPACE.section >= 16, `N5.0 vocabulary — SPACE.section ≥ 16 (got ${SPACE.section})`);

// ——— source half: the gaps are CONSUMED tokens, not coincidental pixels
const view = await readFile(new URL('../src/views/EntryView.jsx', import.meta.url), 'utf8');
ok(/import\s*\{[^}]*\bSPACE\b[^}]*\}\s*from\s*'\.\.\/theme\.js'/.test(view),
  'N5.1 source — EntryView imports SPACE: the screen speaks the spacing vocabulary');
const gapToken = (view.match(/gap:\s*SPACE\.(\w+)/) || [])[1] || null;
ok(gapToken !== null, 'N5.2 source — the section gap rides a SPACE token (gap: SPACE.…)');
ok(gapToken !== null && SPACE[gapToken] >= 16,
  `N5.2 source — and that token clears the ≥16 floor (SPACE.${gapToken} = ${gapToken ? SPACE[gapToken] : '—'})`);
ok(/padding:\s*SPACE\.cardPad/.test(view),
  'N5.3 source — the sections\' own inset is SPACE.cardPad, by name');
ok(/paddingBottom:\s*SPACE\.section/.test(view),
  'N5.4 source — the screen ends on SPACE.section of breath before the dock');

// ——— render half. Seed one prior entry so the N3 card is on screen too —
//     the count below includes it as a white RADIUS.card surface.
let store = {
  'masareef.repeats.v1': JSON.stringify([
    { description: 'قهوة', category: 'Eating out', method: 'Cash', amount: 60 },
  ]),
};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const EntryView = (await vite.ssrLoadModule('/src/views/EntryView.jsx')).default;
  const noop = () => {};
  const render = () => renderToStaticMarkup(createElement(EntryView, {
    amount: '', setAmount: noop, desc: '', setDesc: noop, cat: null, setCat: noop,
    method: 'Cash', setMethod: noop, onDictate: noop, onCamera: noop, setCurrency: noop,
  }));
  const html = render();

  // — the root is a breathing column: token gap, token breath at the end
  const rootStyle = (html.match(/^<div style="([^"]*)"/) || [])[1] || '';
  ok(rootStyle.includes(`gap:${SPACE.cardPad}px`),
    `N5.5 render — the root column's gap is ${SPACE.cardPad}px, straight from the token`);
  ok(rootStyle.includes(`padding-bottom:${SPACE.section}px`),
    `N5.6 render — and it ends on ${SPACE.section}px of section breath`);

  // — the boxed sections: white, RADIUS.card, cardPad inset — and ≥2 of them
  const sections = html.split('<section').slice(1).map((s) => (s.match(/style="([^"]*)"/) || [])[1] || '');
  ok(sections.length >= 2,
    `N5.7 render — the screen stands in ≥2 boxed <section>s (got ${sections.length}), not one cramped column`);
  sections.forEach((s, i) => {
    ok(s.includes(`background:${C.card}`), `N5.8 render — section ${i + 1} is a white card surface`);
    ok(s.includes(`border-radius:${RADIUS.card}px`), `N5.8 render — section ${i + 1} rides RADIUS.card`);
    ok(s.includes(`padding:${SPACE.cardPad}px`), `N5.8 render — section ${i + 1}'s inset is SPACE.cardPad`);
    // A2's law arrives at the new surfaces: luminance carries elevation.
    ok(!/(?:^|;)border(?!-radius)[a-z-]*:/.test(s),
      `N5.9 render — section ${i + 1} is BORDERLESS — a plain section taking an edge is A2's drift, reborn`);
    ok(!/shadow/i.test(s), `N5.9 render — section ${i + 1} is shadowless`);
  });

  // — the white-card surfaces together (sections + the N3 card) number ≥3
  const whiteCards = (html.match(new RegExp(`border-radius:${RADIUS.card}px`, 'g')) || []).length;
  ok(whiteCards >= 3,
    `N5.10 render — ≥3 RADIUS.card surfaces on the shell (got ${whiteCards}): the card and the sections agree on one radius`);

  // — and nothing on the screen casts a shadow at all (elevation = luminance)
  ok(!/box-shadow/.test(html), 'N5.11 render — no box-shadow anywhere on New');

  // — a fresh install still gets the sectioned screen (the boxes are the
  //   screen's anatomy, not a reward for having history)
  store = {};
  const fresh = render();
  eq(fresh.split('<section').length - 1, sections.length,
    'N5.12 render — the same sections stand on a fresh install; only the N3 card comes and goes');
} finally {
  await vite.close();
  delete globalThis.localStorage;
}

if (failures.length) {
  console.log(`❌ CHUNK N5 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · New breathes in white RADIUS.card sections with token gaps — nothing cramped, nothing shadowed`);
