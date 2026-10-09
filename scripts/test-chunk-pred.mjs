#!/usr/bin/env node
/**
 * ═══════════ GATE — E-015 · THE APP READS THE PREDICTOR (Tarek, 2026-10-09) ═══════════
 *
 * «Sometimes it assumes it's cash while my credit card number is actually on the
 * receipt.» The server already read the card (D25's gated pair) and predicted
 * from his book; the app opened every till receipt on Cash anyway. Here the
 * review card opens on the server's PREDICTION and says, in words, where it
 * came from — and a fix in «To review» asks the server to file the same
 * merchant's other ❓ rows at once.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
import { AR } from '../src/i18n/strings.ar.js';
import { startMethod, predOf } from '../src/state/predict.js';
import { confirmPayload } from '../src/state/fixPayload.js';

const MARKER = 'CHUNK-PRED-GREEN';
let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) pass++; else failures.push(label); };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ——— the method a receipt opens on
ok(startMethod({ method: 'Visa', defaultMethod: 'Cash' }) === 'Visa', 'PRED.1 a predicted Card beats D19\'s Cash default');
ok(startMethod({ method: null, defaultMethod: 'Visa' }) === 'Visa', 'PRED.2 no prediction → the server\'s default stands');
ok(startMethod({ method: 'card', defaultMethod: 'nonsense' }) === 'Cash', 'PRED.3 a value that is not a wire method never reaches the sheet — Cash');
ok(predOf({ category: 'Groceries', categorySource: 'history', method: 'Visa', methodSource: 'receipt', extraction: { method_evidence: '**** 4821' } }).evidence === '**** 4821',
  'PRED.4 the card evidence quote travels with the prediction');

// ——— one fix, many rows
ok(confirmPayload({ tab: 'Oct', rowHint: 4, match: {} }, 'Groceries').applySimilar === true, 'PRED.5 a «To review» fix asks the server to file the same merchant\'s other ❓ rows');
ok(/applySimilar \? \{ applySimilar: true \} : null/.test(read('src/api/endpoints.js')), 'PRED.6 …and the wire carries it (absent when false — older servers see the old call)');
const app = read('src/App.jsx');
ok(/also = \(res && res\.ok && res\.alsoFixed\) \|\| 0;/.test(app) && /showToast\(also > 0 \? S\.alsoFiled\(also\)/.test(app),
  'PRED.7 the toast says how many more were filed');
ok(/if \(outcome\.status !== 'done' \|\| also > 0\) refresh\(\);/.test(app), 'PRED.8 …and the queue refreshes so those cards leave');

const rv = read('src/views/ReceiptView.jsx');
ok(/setMethod\(startMethod\(res\)\);\s*setPred\(predOf\(res\)\);/.test(rv) && !/setMethod\(isMethod\(res\.defaultMethod\)/.test(rv),
  'PRED.16 the LIVE path (applyExtraction) opens on the prediction too — not D19\'s default');

// ——— the review card, rendered
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const RV = (await vite.ssrLoadModule('/src/views/ReceiptView.jsx')).default;
  const { fixCategory } = await vite.ssrLoadModule('/src/api/index.js');
  const ex = { doc_type: 'purchase_receipt', amount: 24.5, currency: 'EUR', merchant_display: 'K-Ruoka Kamppi', date: '2026-10-09', method_evidence: '**** 4821', payment_method: 'card' };
  const render = (res) => renderToStaticMarkup(createElement(RV, { onSaved() {}, onManual() {}, onBatch() {},
    initialReview: { extraction: ex, dateStr: '9/10/2026', category: res.category, res: { ...res, extraction: ex } } }));
  const pressed = (html) => (html.match(/aria-pressed="true"[^>]*>([^<]+)</g) || []).map((m) => m.replace(/^.*>/, '').replace(/<$/, ''));

  const card = render({ category: 'Groceries', categorySource: 'history', method: 'Visa', methodSource: 'receipt', defaultMethod: 'Cash' });
  ok(pressed(card).includes(AR.metricVisa), 'PRED.9 HIS CARD NUMBER ON THE RECEIPT → the card opens on Card');
  ok(card.includes(AR.methodEvidence(true, '**** 4821')), 'PRED.10 …and says why, quoting the receipt («فيزا — الإيصال فيه «**** 4821»»)');
  ok(card.includes(AR.predFromHistory), 'PRED.11 the category says it came from his book');

  const habit = render({ category: 'Groceries', categorySource: 'similar', method: 'Visa', methodSource: 'history', defaultMethod: 'Cash' });
  ok(pressed(habit).includes(AR.metricVisa) && habit.includes(AR.methodFromHistory), 'PRED.12 no evidence → his habit here, said as habit');
  ok(habit.includes(AR.predFromSimilar), 'PRED.13 a similar-name guess says so');

  const none = render({ category: null, categorySource: null, method: null, methodSource: null, defaultMethod: 'Cash' });
  ok(pressed(none).includes(AR.metricCash) && none.includes(AR.receiptCashSteer) && !/data-pred=/.test(none),
    'PRED.14 nothing predicted → Cash with the D19 steer, and no invented reason');

  const r = await fixCategory({ tab: 'Aug', rowHint: 2, match: { category: '❓' }, newCategory: 'Groceries', applySimilar: true });
  ok(r && r.ok === true && typeof r.alsoFixed === 'number', 'PRED.15 mock parity: the mock answers applySimilar with a count, as the server does');
} finally { await vite.close(); }

if (failures.length) {
  console.log(`❌ CHUNK PRED — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · the receipt opens on the prediction and says where it came from; one fix files the merchant's other ❓ rows`);
