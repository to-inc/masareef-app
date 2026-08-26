#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK A9 ═══════════
 * «The submit keeps ONE verb across both states: sand+muted when resting,
 *  amber+rim when ready. The label string never changes — only the fill and
 *  the ink do. One amber per screen: this button is the entry screen's single
 *  warm commit.» (north-star §4.1 · gates/A9.gates.md)
 *
 * Rider owned by the same chunk: EntryView's ad-hoc borderRadius and fontSize
 * literals are retokenized onto RADIUS/TYPE (unitSize for the unit beside the
 * hero), so the file CONSUMES the Wave-1 vocabulary instead of restating it.
 *
 * WHY THE LABEL IS PINNED IN THE RENDER AND THE TOKENS IN THE SOURCE. The
 * label claim is about what four states put IN FRONT OF HIM, and only the
 * rendered button can prove the four are one string — a source read cannot
 * see through a ternary. The token claim is per-site and unconditional,
 * which is exactly what a source pin is for (the A2 lesson, same shape).
 *
 * WHAT A WRONG IMPLEMENTATION WOULD STILL PASS, per family: a button that
 * keeps narrating its precondition passes every includes() on the DOCK but
 * not the button-identity checks; a dock that bought identity by DELETING
 * the missing-step words entirely fails the beside-the-button checks —
 * test-dock's law, restated here from A9's angle so this gate cannot be
 * satisfied by breaking that one.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';
import { C, RADIUS, TYPE, unitSize } from '../src/theme.js';
import { AR, AR_LOCALE } from '../src/i18n/strings.ar.js';

const MARKER = 'CHUNK-A9-GREEN';
const L = AR_LOCALE.categoryLabel;

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(Object.is(a, b),
  `${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

// ——— negative controls first: if either holds, the pins below go blind.
ok(!AR.entryNeedAmount.includes(AR.entryLog),
  'control — the verb is not a substring of the amount prompt (else the verb pin could never fail)');
ok(C.sand !== C.amber, 'control — the resting and ready fills are distinct tokens');

const view = await readFile(new URL('../src/views/EntryView.jsx', import.meta.url), 'utf8');

// ——— A9.1 the screen's ONE warm reference, in source (test-contrast counts
//     per file; this gate states the same law where A9 lives)
eq((view.match(/C\.amber\b/g) || []).length, 1,
  'A9.1 exactly one C.amber reference in EntryView.jsx — the commit, nothing else');

// ——— A9.2 retokenization: no ad-hoc reading sizes or surface radii survive
ok(!/fontSize:\s*[\d.]/.test(view),
  'A9.2a no numeric fontSize literal anywhere in the file — every reading size is a TYPE token');
ok(!/borderRadius:\s*\d/.test(view),
  'A9.2b no numeric borderRadius literal — every surface radius is a RADIUS token');
for (const token of [
  'RADIUS.capsule', 'RADIUS.row', 'TYPE.action', 'TYPE.hero', 'TYPE.label', 'unitSize(TYPE.hero)',
]) {
  ok(view.includes(token), `A9.2c the file consumes ${token}`);
}

// ——— A9.3 the button's child is the verb KEY, in source — not a ternary
ok(/\{S\.entryLog\}\s*<\/button>/.test(view),
  'A9.3 the button closes on {S.entryLog} — one i18n key is the whole label');

// ——— the four states, rendered
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const mod = await vite.ssrLoadModule('/src/views/EntryView.jsx');
  const { EntryDock } = mod;
  const EntryView = mod.default;
  const noop = () => {};
  const dock = (props) => renderToStaticMarkup(
    createElement(EntryDock, { onSubmit: noop, busy: false, ...props }),
  );

  const empty = dock({ amount: '', cat: null });
  const noCat = dock({ amount: '60', cat: null });
  const done = dock({ amount: '60', cat: 'Eating out' });
  const saving = dock({ amount: '60', cat: 'Eating out', busy: true });

  // Guarded lookups — a state with no button must FAIL by name, never throw
  // and kill the run (the N1/N1b lesson, twice in one afternoon).
  const button = (html) => {
    const m = html.match(/<button([^>]*)>([\s\S]*?)<\/button>/);
    return m ? { attrs: m[1], inner: m[2], whole: m[0] } : { attrs: '', inner: '⟨no button⟩', whole: '' };
  };
  const b = { empty: button(empty), noCat: button(noCat), done: button(done), saving: button(saving) };
  ok(![b.empty, b.noCat, b.done, b.saving].some((x) => x.inner === '⟨no button⟩'),
    'A9.4 all four states render a button');

  // ——— A9.5 ONE VERB — the label string never changes
  eq(b.noCat.inner, b.empty.inner, 'A9.5a resting label identical whichever step is missing');
  eq(b.done.inner, b.empty.inner, 'A9.5b ready keeps the SAME label — only the fill may change');
  eq(b.saving.inner, b.empty.inner, 'A9.5c and a write in flight does not rewrite the verb either');
  ok(b.empty.inner.includes(AR.entryLog), 'A9.5d and that one label IS the verb');

  // ——— A9.6 the narration is OFF the button…
  for (const [s, name] of [
    [AR.entryNeedAmount, 'amount prompt'],
    [AR.entryNeedCategory, 'category prompt'],
    [AR.saving, 'saving notice'],
  ]) {
    ok(!b.empty.inner.includes(s) && !b.noCat.inner.includes(s) && !b.saving.inner.includes(s),
      `A9.6 the ${name} never appears ON the button — a button narrating its precondition is a system talking`);
  }

  // ——— A9.7 …but the dock still states the step BESIDE it (test-dock's law,
  //     kept: identity may never be bought by deleting the words)
  ok(empty.replace(b.empty.whole, '').includes(AR.entryNeedAmount),
    'A9.7a the empty dock still names the missing amount, beside the button');
  ok(noCat.replace(b.noCat.whole, '').includes(AR.entryNeedCategory),
    'A9.7b and the missing category');
  const doneAside = done.replace(b.done.whole, '');
  ok(doneAside.includes('60') && doneAside.includes(L('Eating out')),
    'A9.7c when ready the whole entry is legible beside the button — the last look before it is a row');

  // ——— A9.8 the fill and ink are what vary: sand+muted resting, amber+rim ready
  ok(b.empty.attrs.includes(C.sand), 'A9.8a resting fill is sand');
  ok(b.empty.attrs.includes(C.muted), 'A9.8b resting ink is muted');
  ok(!empty.includes(C.amber), 'A9.8c no amber anywhere on the resting dock');
  ok(b.done.attrs.includes(C.amber), 'A9.8d ready fill is the one warm action');
  ok(b.done.attrs.includes(C.amberRim), 'A9.8e with its rim — the boundary 1.4.11 asks of the control');
  ok(b.done.attrs.includes(C.amberInk), 'A9.8f and the only ink that goes on amber');
  eq((done.match(new RegExp(C.amber, 'g')) || []).length, 1,
    'A9.8g amber appears exactly once in the ready dock');
  ok(b.done.attrs.includes(`font-size:${TYPE.action}px`),
    'A9.8h the commit reads at TYPE.action — the senior floor for a primary action, proven in the DOM');

  // ——— A9.9 no second amber on the screen: the scroll body carries none
  const body = renderToStaticMarkup(createElement(EntryView, {
    amount: '60', setAmount: noop, desc: '', setDesc: noop, cat: null, setCat: noop,
    method: 'Cash', setMethod: noop,
  }));
  ok(!body.includes(C.amber),
    'A9.9 the entry screen body paints no amber — the dock commit is the screen\'s single warm action');

  // ——— A9.10 the hero consumed its tokens all the way to the DOM
  const at = body.indexOf('Baskerville');
  ok(at !== -1, 'A9.10a the display-face amount is still there');
  const hero = at === -1 ? '' : body.slice(at);
  ok(hero.slice(0, Math.max(0, hero.indexOf('>'))).includes(`font-size:${TYPE.hero}px`),
    'A9.10b the amount renders at TYPE.hero');
  ok(hero.slice(0, Math.max(0, hero.indexOf('</div>'))).includes(`font-size:${unitSize(TYPE.hero)}px`),
    'A9.10c and its unit at unitSize(TYPE.hero) — 0.55× the value, floored at the prose floor');
} finally {
  await vite.close();
}

if (failures.length) {
  console.log(`❌ CHUNK A9 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · one verb, two fills; the entry screen keeps its single amber`);
