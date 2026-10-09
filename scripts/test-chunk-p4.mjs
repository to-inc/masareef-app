#!/usr/bin/env node
/**
 * ═══════════ GATE — P4 · THE ENTRY SHEET (Glass PWA v4, OWNER-RULINGS R17) ═══════════
 *
 * Replaces N3 (the «like before» card), N4 (modes under the amount) and N5
 * (white sections) — the three suites that pinned the screen v4 redrew. What
 * those laws protected and v4 keeps is carried here; what v4 replaced is
 * asserted in its new form:
 *   · ONE fill rule: the «زي امبارح» chip and the first-visit quick chips both
 *     call the same fill (N3's law) — a second half-fill would drift.
 *   · modes are icon buttons in the number's orbit, at the 48pt floor, never
 *     rendered without a handler (N4's dead-control law), the currency chip
 *     reads pressed abroad (N4.13).
 *   · the sheet's order, thumb-first: ✕ · repeat · amount · currency/mic/camera
 *     · cash|card · categories · keypad (dir=ltr, ⌫ last) — and NO amber in
 *     the body (the dock's «سجّل» is the screen's one warm action).
 * And in App.jsx: the sheet is a dialog over the screen he came from, the bar
 * hides while it is open, and ✕ / the dimmed backdrop / a swipe down close it.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';
import { TAP, TYPE, C } from '../src/theme.js';
import { AR, AR_LOCALE } from '../src/i18n/strings.ar.js';

const MARKER = 'CHUNK-P4-GREEN';
let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) pass++; else failures.push(label); };
const L = AR_LOCALE.categoryLabel;

// ——— a «yesterday» to repeat: repeats.js reads localStorage at mount.
const store = new Map([['masareef.repeats.v1', JSON.stringify([
  { description: 'قهوة', category: 'Eating out', method: 'Cash', amount: 60, currency: 'EGP' },
])]]);
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const view = await readFile(new URL('../src/views/EntryView.jsx', import.meta.url), 'utf8');
const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');

// ——— source: one fill rule, both callers
ok((view.match(/onClick=\{\(\) => fill\(/g) || []).length === 2,
  'P4.1 the repeat chip and the quick chips call the SAME fill — one rule, two callers (N3\'s law)');
ok(!/function LikeBeforeCard/.test(view), 'P4.2 the old two-line «like before» card is gone — v4 draws a chip');

// ——— App: a sheet over the screen he came from
ok(/role="dialog" aria-modal="true" aria-label=\{S\.tabEntry\}/.test(app), 'P4.3 the entry is a modal dialog sheet (R17)');
ok(/\{!needsSetup && !sheetOpen && \(\s*<nav/.test(app), 'P4.4 the bar hides while the sheet is open (R17)');
ok(/const viewTab = sheetOpen \? underTab\.current : tab;/.test(app), 'P4.5 the screen he came from stays drawn underneath');
ok(/aria-label=\{S\.settingsClose\} onClick=\{closeEntry\}/.test(app), 'P4.6 the dimmed backdrop is a labelled button that closes the sheet');
ok(/dy >= 80 && dy >= 2 \* dx\) closeEntry\(\)/.test(app) && /body\.scrollTop > 0\)\) return/.test(app),
  'P4.7 swipe down closes — mostly vertical, 80px+, and never while the sheet body is scrolled');
ok(/onClose=\{closeEntry\}/.test(app), 'P4.8 the ✕ is wired to the same close');

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const EntryView = (await vite.ssrLoadModule('/src/views/EntryView.jsx')).default;
  const noop = () => {};
  const render = (p = {}) => renderToStaticMarkup(createElement(EntryView, {
    amount: '240', setAmount: noop, desc: '', setDesc: noop, cat: 'Eating out', setCat: noop,
    method: 'Cash', setMethod: noop, onClose: noop, ...p,
  }));
  const html = render({ setCurrency: noop, onDictate: noop, onCamera: noop });
  const at = (s) => html.indexOf(s);

  // ——— the order, thumb-first
  const iClose = at(`aria-label="${AR.settingsClose}"`);
  const iRepeat = at(AR.likeYesterday);
  const iAmount = at('data-amount');
  const iCur = at(`aria-label="${AR.currencyIn('EUR')}"`);
  const iMic = at(`aria-label="${AR.dictateShort}"`);
  const iCam = at(`aria-label="${AR.receiptShort}"`);
  const iMethod = at(`aria-label="${AR.entryMethod}"`);
  const iCats = at(`✓ ${L('Eating out')}`);
  const iKeys = at('aria-label="1"');
  ok([iClose, iRepeat, iAmount, iCur, iMic, iCam, iMethod, iCats, iKeys].every((i) => i !== -1),
    'P4.9 every part of the sheet renders: ✕, repeat, amount, currency, mic, camera, method, categories, keypad');
  ok(iClose < iRepeat && iRepeat < iAmount && iAmount < iCur && iCur < iMethod && iMethod < iCats && iCats < iKeys,
    'P4.10 in v4 order: ✕ · repeat · amount · modes · cash|card · categories · keypad');
  ok(iAmount < iMic && iMic < iMethod && iAmount < iCam && iCam < iMethod, 'P4.11 mic and camera sit in the number\'s orbit, above the method');

  // ——— the repeat chip, and its fill
  ok(html.includes(`${AR.likeYesterday}:`) && /قهوة[\s\S]{0,200}>60</.test(html), 'P4.12 «زي امبارح: قهوة 60» — description and amount, legible before the tap');

  // ——— amount
  ok(new RegExp(`data-amount="true"[^>]*font-size:${TYPE.amountEntry}px`).test(html), 'P4.13 the amount reads at TYPE.amountEntry (68)');
  ok(html.includes(`background:${C.harbor}`), 'P4.14 with its harbor caret');

  // ——— modes: icon buttons at the floor, dead-control law, abroad pressed
  for (const [lab, i] of [['mic', iMic], ['camera', iCam]]) {
    const tag = html.slice(i, html.indexOf('</button>', i));
    ok(new RegExp(`min-height:${TAP}px`).test(tag) && new RegExp(`min-width:${TAP}px`).test(tag) && tag.includes('<svg'),
      `P4.15 the ${lab} is a 48pt icon button (R17)`);
  }
  const bare = render();
  ok(!bare.includes(`aria-label="${AR.dictateShort}"`) && !bare.includes(`aria-label="${AR.receiptShort}"`),
    'P4.16 a mode whose handler is absent renders NO control (N4\'s dead-control law)');
  const abroad = render({ setCurrency: noop, currency: 'EUR' });
  // Re-cut 2026-10-09 (R0): Tarek ruled the chip wears the mark «€», not the code.
  ok((/aria-pressed="true"[^>]*aria-label="[^"]*"[^>]*>€/.test(abroad) || /aria-pressed="true"[^>]*>€/.test(abroad)) && !/>EUR</.test(abroad),
    'P4.17 abroad the currency chip names the unit he is IN («€») and reads pressed (N4.13)');

  // ——— the dock's «سجّل» carries the amount in the unit's mark (Tarek 2026-10-09)
  const { EntryDock } = await vite.ssrLoadModule('/src/views/EntryView.jsx');
  const dock = renderToStaticMarkup(createElement(EntryDock, { amount: '240', cat: 'Eating out', onSubmit: noop, currency: 'EUR' }));
  ok(/>240<\/span> €/.test(dock) && !/EUR/.test(dock), 'P4.26 abroad, «سجّل» reads «240 €» — the amount wears the mark');

  // ——— method: a pressed well with a raised choice
  const cash = html.slice(at(`>${AR.methodCash}<`) - 400, at(`>${AR.methodCash}<`));
  ok(/aria-pressed="true"/.test(cash) && cash.includes('rgba(255,255,255,0.95)'), 'P4.18 the chosen method is the raised capsule in the well (v4)');

  // ——— categories: picked = harbor tint + rim + ✓; «more» dashed
  ok(html.includes('1.5px solid rgba(62,124,166,0.75)') && html.includes(`✓ ${L('Eating out')}`), 'P4.19 the picked category wears the harbor rim and ✓');
  ok(html.includes(`dashed ${C.harbor}`) && html.includes(AR.more), 'P4.20 «more» is the dashed harbor chip');

  // ——— keypad: ltr grid, ⌫ last, 56 tall
  const grid = html.slice(html.lastIndexOf('<div', iKeys), html.length);
  ok(/dir="ltr"/.test(grid.slice(0, 200)), 'P4.21 the keypad grid is deliberately dir="ltr" (R7)');
  const keys = [...grid.matchAll(/aria-label="([^"]+)"/g)].map((m) => m[1]).slice(0, 12);
  ok(keys.join(',') === `1,2,3,4,5,6,7,8,9,.,0,${AR.keypadBackspace}`, `P4.22 ⌫ is last — bottom-right, beside the digit it deletes (got ${keys.join(',')})`);
  ok((grid.match(/min-height:56px/g) || []).length >= 12, 'P4.23 every key is 56 tall — above the 48pt floor');

  // ——— one warm action: none in the body
  ok(!html.includes(C.amber) && !html.includes('#CF9A34'), 'P4.24 the sheet body paints no amber — «سجّل» is the one warm action');
} finally { await vite.close(); }

if (failures.length) {
  console.log(`❌ CHUNK P4 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · «جديد» is a sheet over his screen: thumb-first order, one fill rule, one warm action`);
