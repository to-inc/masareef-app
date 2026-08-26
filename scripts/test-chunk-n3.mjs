#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK N3 ═══════════
 * «'Like before' becomes its own ONE-TAP card at the top of New: the
 *  repeat-last-entry action is a card (RADIUS.card surface, one tap re-fills
 *  amount/category/method), not a chip crowded into a mode row. If no prior
 *  entry exists the card stays absent — never a dead control.»
 *  (chunk-ledger N3 · north-star §4.1 · gates/N3.gates.md)
 *
 * WHY THE CARD IS RENDER-PINNED AND THE FILL SOURCE-PINNED. Whether the action
 * stands as a card AT THE TOP is a fact about what the screen puts in front of
 * him, and only rendered markup can order two elements. Whether one tap fills
 * all four fields is a handler, and static markup cannot press a button — so
 * the fill is pinned in source as ONE shared function both the card and the
 * rail chips delegate to (one rule, both callers — the entryDock lesson).
 *
 * WHAT A WRONG IMPLEMENTATION WOULD STILL PASS, per family: a card that merely
 * RESTYLES the first chip fails the top-of-screen and RADIUS.card pins; a card
 * hardcoded to render always fails the two absence pins (fresh install,
 * travel); a card that renders but fills only the description fails the
 * shared-fill source pin; and a card duplicating its entry as a chip below
 * fails the once-only count.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';
import { RADIUS, TAP } from '../src/theme.js';
import { AR, AR_LOCALE } from '../src/i18n/strings.ar.js';
import { EN } from '../src/i18n/strings.en.js';

const MARKER = 'CHUNK-N3-GREEN';

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };
const eq = (a, b, label) => ok(Object.is(a, b),
  `${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

// ——— guarded controls first: a missing key must FAIL by name, never throw
//     and kill the run (the N1/N1b lesson, twice in one afternoon).
const arRepeats = typeof AR.entryRepeats === 'string' ? AR.entryRepeats : '';
const enRepeats = typeof EN.entryRepeats === 'string' ? EN.entryRepeats : '';
const L = typeof AR_LOCALE.categoryLabel === 'function' ? AR_LOCALE.categoryLabel : () => '';
ok(arRepeats.length > 0, 'control — AR.entryRepeats exists (the card has an Arabic name)');
ok(enRepeats.length > 0, 'control — EN.entryRepeats exists (and an English one)');
ok(L('Eating out').length > 0, 'control — the seeded category has an Arabic label to look for');

// ——— the source half: the card exists, rides RADIUS.card, and delegates to
//     the ONE fill the rail chips also use.
const view = await readFile(new URL('../src/views/EntryView.jsx', import.meta.url), 'utf8');
const decl = /^(?:export )?function LikeBeforeCard\b/m.exec(view);
const rest = decl ? view.slice(decl.index + 1) : '';
const next = /^(?:export )?(?:default )?function /m.exec(rest);
const slice = decl ? view.slice(decl.index, next ? decl.index + 1 + next.index : view.length) : '';
ok(!!decl, 'N3.1 source — LikeBeforeCard is a named component in EntryView.jsx');
ok(slice.includes('RADIUS.card'),
  'N3.2 source — the card consumes RADIUS.card (the chunk names the surface by token)');
ok(slice.includes('<button'),
  'N3.3 source — the card IS the control: one button, one complete action');
ok(/onFill\(/.test(slice) && !/setDesc\(|setCat\(|setMethod\(|setAmount\(/.test(slice),
  'N3.4 source — the card DELEGATES to onFill and carries no private half-fill of its own');
const fillDecl = view.indexOf('const fill = ');
const fillBody = fillDecl === -1 ? '' : view.slice(fillDecl, view.indexOf('};', fillDecl) + 2);
ok(fillDecl !== -1, 'N3.5 source — EntryView states the fill ONCE (const fill = …)');
for (const setter of ['setDesc(', 'setCat(', 'setMethod(', 'setAmount(String(']) {
  ok(fillBody.includes(setter),
    `N3.5 source — the one fill sets ${setter}…) — amount, category, method and description in one tap`);
}
ok(/onFill=\{fill\}/.test(view),
  'N3.6 source — the card is handed that same fill (one rule, both callers)');
ok(/fill\(q\)/.test(view),
  'N3.6 source — and the rail chips call it too, so the two paths cannot drift');

// ——— the render half. localStorage is mocked so repeatChips() reads a known
//     store; the mock answers ONLY the repeats key so lang/theme stay default.
const KEY = 'masareef.repeats.v1';
let store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const EntryView = (await vite.ssrLoadModule('/src/views/EntryView.jsx')).default;
  const noop = () => {};
  const render = (props = {}) => renderToStaticMarkup(createElement(EntryView, {
    amount: '', setAmount: noop, desc: '', setDesc: noop, cat: null, setCat: noop,
    method: 'Cash', setMethod: noop, ...props,
  }));
  const buttons = (html) => html.split('<button').slice(1).map((s) => `<button${s.split('</button>')[0]}`);
  const card = (html) => buttons(html).find((b) => b.includes('likecard')) || null;

  // — seeded: two of his own entries, most recent first (the store's order)
  store = {
    [KEY]: JSON.stringify([
      { description: 'قهوة', category: 'Eating out', method: 'Cash', amount: 60 },
      { description: 'تاكسي', category: null, method: 'Cash', amount: 45 },
    ]),
  };
  const seeded = render();
  const c = card(seeded);
  ok(!!c, 'N3.7 render — with a prior entry the likecard button exists');
  const cardHtml = c || '⟨no card⟩';
  ok(cardHtml.includes(arRepeats), 'N3.8 render — the card carries the «زي قبل كده» name');
  ok(cardHtml.includes('60'), 'N3.8 render — and the amount he actually paid');
  ok(cardHtml.includes(L('Eating out')), 'N3.8 render — and the category, labelled — the whole row legible before the tap');
  ok(cardHtml.includes('قهوة'), 'N3.8 render — and his own description');
  ok(cardHtml.includes(`border-radius:${RADIUS.card}px`),
    'N3.9 render — the surface is RADIUS.card in the DOM, not a chip capsule');
  ok(cardHtml.includes(`min-height:${TAP}px`),
    'N3.10 render — at the senior tap floor');
  const heroAt = seeded.indexOf('Baskerville');
  ok(heroAt > -1 && seeded.indexOf('likecard') > -1 && seeded.indexOf('likecard') < heroAt,
    'N3.11 render — the card sits at the TOP of New, above the amount hero');
  ok(cardHtml.includes('قهوة') && !cardHtml.includes('تاكسي'),
    'N3.12 render — the card is the MOST RECENT entry, not a merged list');
  ok(seeded.includes('تاكسي'),
    'N3.13 render — the runner-up is still offered (as a rail chip), not deleted');
  eq((seeded.match(/قهوة/g) || []).length, 1,
    'N3.14 render — the card\'s entry appears ONCE — never doubled as a chip below');

  // — absent honestly: a fresh install has no prior entry, so no card at all —
  //   the rail of presets is the accelerator, and nothing on screen is dead.
  store = {};
  const fresh = render();
  ok(!card(fresh), 'N3.15 render — fresh install: no prior entry, no card — never a dead control');
  ok(!buttons(fresh).some((b) => b.includes(arRepeats)),
    'N3.16 render — and nothing labelled «زي قبل كده» is tappable while there is nothing to repeat');

  // — absent while travelling: every remembered entry is EGP by construction;
  //   offering it under a EUR keypad would prefill a wrong-currency figure.
  store = {
    [KEY]: JSON.stringify([{ description: 'قهوة', category: 'Eating out', method: 'Cash', amount: 60 }]),
  };
  const abroad = render({ currency: 'EUR', setCurrency: noop });
  ok(!card(abroad), 'N3.17 render — travelling: the EGP repeat card is absent, not a 60-EURO trap');
} finally {
  await vite.close();
  delete globalThis.localStorage;
}

if (failures.length) {
  console.log(`❌ CHUNK N3 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · «زي قبل كده» is one card, one tap, honestly absent when there is nothing to repeat`);
