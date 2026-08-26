#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK N4 ═══════════
 * «The input modes (Say it / In EUR / Receipt) DEMOTE to icon+word buttons
 *  sitting beside/under the amount display — the top chip row dies. Modes are
 *  secondary to the number; the amount capsule stays the hero.»
 *  (chunk-ledger N4 · north-star §4.1 · gates/N4.gates.md)
 *
 * WHY POSITION IS PINNED IN THE RENDER AND THE ROW'S DEATH IN SOURCE. "Under
 * the amount" is an ordering of two elements in the document he reads, so it
 * is asserted against rendered markup: every mode label must come AFTER the
 * hero and BEFORE the keypad. But a render cannot prove a NEGATIVE about
 * layout ("no header row") without knowing every disguise one could wear —
 * so the death of the top row is a source fact: between EntryView's
 * declaration and its Rail there is no <button at all.
 *
 * WHAT A WRONG IMPLEMENTATION WOULD STILL PASS, per family: a row merely
 * restyled in place fails the after-the-hero ordering; modes dumped below the
 * keypad (out of the number's orbit) fail the before-the-keypad ordering; a
 * currency control gone icon-only fails the word pin, and one gone word-only
 * fails the icon pin — icon PLUS word, the N7 law spelled here too.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';
import { TYPE, TAP } from '../src/theme.js';
import { AR } from '../src/i18n/strings.ar.js';

const MARKER = 'CHUNK-N4-GREEN';

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };

// ——— guarded lookups (a missing key fails by name, never kills the run)
const dictate = typeof AR.dictateShort === 'string' ? AR.dictateShort : '';
const receipt = typeof AR.receiptShort === 'string' ? AR.receiptShort : '';
const inEgp = typeof AR.currencyIn === 'function' ? AR.currencyIn('EGP') : '';
const inEur = typeof AR.currencyIn === 'function' ? AR.currencyIn('EUR') : '';
ok(dictate.length > 0, 'control — AR.dictateShort exists');
ok(receipt.length > 0, 'control — AR.receiptShort exists');
ok(inEgp.length > 0 && inEur.length > 0 && inEgp !== inEur,
  'control — AR.currencyIn speaks both units, distinctly');

// ——— source half: the top chip row is DEAD, and the mode handlers moved
//     below the amount in the file the way they moved below it on screen.
const view = await readFile(new URL('../src/views/EntryView.jsx', import.meta.url), 'utf8');
const entryDecl = view.indexOf('export default function EntryView');
const railAt = view.indexOf('<Rail');
ok(entryDecl !== -1 && railAt > entryDecl, 'N4.0 source — EntryView and its Rail are still there');
ok(entryDecl !== -1 && railAt > entryDecl
  && !view.slice(entryDecl, railAt).includes('<button'),
  'N4.1 source — no <button between EntryView\'s open and the Rail: the top chip row died');
const amountAt = view.indexOf("{amount || '0'}");
ok(amountAt !== -1, 'N4.2 source — the amount display still renders {amount || \'0\'}');
for (const [anchor, name] of [
  ['onClick={onDictate}', 'Say-it'],
  ['setCurrency(toggleCurrency(currency))', 'currency'],
  ['onClick={onCamera}', 'receipt'],
]) {
  const at = view.indexOf(anchor);
  ok(at !== -1 && amountAt !== -1 && at > amountAt,
    `N4.3 source — the ${name} control sits AFTER the amount display in the file`);
}

// ——— render half: modes under the hero, above the keypad; hero unmoved.
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const EntryView = (await vite.ssrLoadModule('/src/views/EntryView.jsx')).default;
  const noop = () => {};
  const render = (props = {}) => renderToStaticMarkup(createElement(EntryView, {
    amount: '', setAmount: noop, desc: '', setDesc: noop, cat: null, setCat: noop,
    method: 'Cash', setMethod: noop, ...props,
  }));
  const buttons = (html) => html.split('<button').slice(1).map((s) => `<button${s.split('</button>')[0]}`);

  const html = render({ onDictate: noop, onCamera: noop, setCurrency: noop, currency: 'EGP' });
  const heroAt = html.indexOf('Baskerville');
  const keypadAt = html.indexOf('repeat(3');
  ok(heroAt > -1, 'N4.4 render — the hero amount (display face) is on screen');
  ok(keypadAt > heroAt, 'N4.4 render — and the keypad grid follows it');

  for (const [label, name] of [[dictate, 'Say it'], [inEgp, 'currency'], [receipt, 'Receipt']]) {
    const at = html.indexOf(label);
    ok(at > -1, `N4.5 render — the ${name} mode is offered when its handler exists`);
    ok(at > heroAt, `N4.6 render — ${name} sits UNDER the amount display, never in a top row`);
    ok(at > -1 && keypadAt > -1 && at < keypadAt,
      `N4.7 render — ${name} stays in the number's orbit, above the keypad — not exiled below it`);
  }

  // — icon PLUS word, on each of the three (never icon-only, never word-only)
  const mode = (label) => buttons(html).find((b) => b.includes(label)) || '⟨no button⟩';
  ok(/\p{Extended_Pictographic}/u.test(dictate) && mode(dictate) !== '⟨no button⟩',
    'N4.8 render — Say-it is a button carrying icon+word (the label ships both)');
  ok(/\p{Extended_Pictographic}/u.test(receipt) && mode(receipt) !== '⟨no button⟩',
    'N4.8 render — Receipt likewise');
  ok(/\p{Extended_Pictographic}/u.test(mode(inEgp)),
    'N4.8 render — the currency button carries an icon beside its word too');

  // — demoted, not shrunk below the floor: TYPE.label words on TAP-floor targets
  for (const [label, name] of [[dictate, 'Say-it'], [inEgp, 'currency'], [receipt, 'receipt']]) {
    ok(mode(label).includes(`min-height:${TAP}px`),
      `N4.9 render — the ${name} button stands at the senior tap floor`);
    ok(mode(label).includes(`font-size:${TYPE.label}px`),
      `N4.10 render — and reads at TYPE.label — secondary to the number, above the prose floor`);
  }

  // — the amount capsule stays the hero (A9's pin restated from N4's angle)
  const hero = html.slice(heroAt, html.indexOf('>', heroAt));
  ok(hero.includes(`font-size:${TYPE.hero}px`),
    'N4.11 render — the amount still reads at TYPE.hero; demotion moved the modes, not the number');

  // — the dead-control law: no handler, no button (all three)
  const bare = render();
  ok(!bare.includes(dictate) && !bare.includes(receipt) && !bare.includes(inEgp),
    'N4.12 render — a mode whose handler is absent renders NO control at all');

  // — the currency control states what he is IN (the 2026-08-25 ruling), and
  //   reads as pressed while travelling
  const abroad = render({ setCurrency: noop, currency: 'EUR' });
  const eurBtn = buttons(abroad).find((b) => b.includes(inEur)) || '⟨no button⟩';
  ok(eurBtn !== '⟨no button⟩' && eurBtn.includes('aria-pressed="true"'),
    'N4.13 render — abroad the currency button says the unit he is IN and reads pressed');
} finally {
  await vite.close();
}

if (failures.length) {
  console.log(`❌ CHUNK N4 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · the modes wait under the number as icon+word buttons; the top chip row is gone`);
