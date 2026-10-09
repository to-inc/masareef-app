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
// v4 P4 RE-CUT: the warm action is GRADIENT.amber (it starts at C.amber, R13).
eq((view.match(/GRADIENT\.amber\b/g) || []).length, 1,
  'A9.1 exactly one GRADIENT.amber reference in EntryView.jsx — the commit, nothing else');
ok(!/C\.amber\b/.test(view), 'A9.1b and no bare C.amber fill beside it');

// ——— A9.2 retokenization: no ad-hoc reading sizes or surface radii survive
ok(!/fontSize:\s*[\d.]/.test(view),
  'A9.2a no numeric fontSize literal anywhere in the file — every reading size is a TYPE token');
ok(!/borderRadius:\s*\d/.test(view),
  'A9.2b no numeric borderRadius literal — every surface radius is a RADIUS token');
for (const token of [
  'RADIUS.capsule', 'RADIUS.glassWell', 'TYPE.action', 'TYPE.amountEntry', 'TYPE.label', 'TYPE.key',
]) {
  ok(view.includes(token), `A9.2c the file consumes ${token}`);
}

// ——— A9.3 the button's child is the verb KEY, in source — not a ternary
ok(/>\s*\{S\.entryLog\}\s*\{ready && \(/.test(view),
  'A9.3 the button OPENS on {S.entryLog} — the verb is one i18n key; only the ready state adds the entry (R17)');

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
  // R17: ready, the verb CARRIES the entry — «سجّل 60 ج.م · أكل بره».
  ok(b.done.inner.startsWith(AR.entryLog) && b.done.inner.includes('60') && b.done.inner.includes(L('Eating out')),
    'A9.5b ready: the same verb, now carrying the amount and the category (R17)');
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
  // R17 deleted the summary line beside the button. What is missing is on the
  // SHEET instead: an empty amount reads a muted «0», and no category wears ✓.
  const sheet = (p) => renderToStaticMarkup(createElement(EntryView, {
    amount: '', setAmount: noop, desc: '', setDesc: noop, cat: null, setCat: noop, method: 'Cash', setMethod: noop, ...p,
  }));
  const blank = sheet({});
  ok(/data-amount="true"[^>]*color:#5C6871[^>]*>0</.test(blank) && blank.includes(`aria-label="${AR.entryNeedAmount}"`),
    'A9.7a an empty amount reads as a muted «0» on the sheet — the missing step is visible without words');
  ok(!blank.includes('✓'), 'A9.7b and no category wears ✓ until one is chosen');
  ok(sheet({ cat: 'Eating out' }).includes('✓ '), 'A9.7c …and the chosen one does');

  // ——— A9.8 the fill and ink are what vary: sand+muted resting, amber+rim ready
  ok(b.empty.attrs.includes('rgba(255,255,255,0.66)'), 'A9.8a resting fill is quiet glass (v4), not amber');
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
  ok(hero.slice(0, Math.max(0, hero.indexOf('>'))).includes(`font-size:${TYPE.amountEntry}px`),
    'A9.10b the amount renders at TYPE.amountEntry (68, v4 P4)');
  ok(/aria-pressed="false"[^>]*>ج\.م/.test(body) || body.includes('>ج.م<'),
    'A9.10c and its unit is named right under it — the currency chip IS the unit (v4: every amount with its unit)');
} finally {
  await vite.close();
}

if (failures.length) {
  console.log(`❌ CHUNK A9 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · one verb, two fills; the entry screen keeps its single amber`);
