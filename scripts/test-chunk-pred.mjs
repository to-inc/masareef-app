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
ok(predOf({ category: 'Groceries', categorySource: 'history', method: 'Visa', methodSource: 'receipt', extraction: { method_evidence: '**** 4821' } }).evidence === '•••• 4821',
  'PRED.4 the card evidence travels with the prediction — a masked card said as its last four (R0 re-cut 2026-10-10)');

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

// Tarek, 2026-10-10 («fix this»): the reader leaked its own JSON into the evidence.
{
  const { cleanEvidence } = await import('../src/state/predict.js');
  ok(cleanEvidence("Visa DEBIT **** **** **** 0634 LP','category_guess':'Eating out'}") === '•••• 0634',
    'PRED.e1 leaked answer text is cut, and a masked card is said as its last four');
  ok(cleanEvidence('KÄTEINEN') === 'KÄTEINEN' && cleanEvidence(null) === null, 'PRED.e2 plain evidence passes untouched; none stays none');
}

// 2026-10-10 — PDF receipts: offered only to a server that reads them, sent whole.
{
  const { supportsDocument } = await import('../src/state/capabilities.js');
  ok(!supportsDocument({ actions: [] }, 'application/pdf') && !supportsDocument(null, 'application/pdf')
    && supportsDocument({ documents: ['image/jpeg', 'application/pdf'] }, 'application/pdf'),
    'PDF.1 the paperclip offers PDFs only when the server advertises them — fails closed');
  const { prepareDocument, PDF_LIMIT } = await import('../src/lib/receipt-image.js');
  const pdf = new Blob([new Uint8Array([37, 80, 68, 70, 45])], { type: 'application/pdf' });
  const prepared = await prepareDocument(pdf);
  ok(prepared.base64 === 'JVBERi0=' && prepared.mediaType === 'application/pdf' && /^[0-9a-f]{64}$/.test(prepared.clientHash),
    'PDF.2 a PDF travels as its own bytes, marked as a PDF, hashed for de-duplication');
  let refused = false;
  try { await prepareDocument({ size: PDF_LIMIT + 1, arrayBuffer: async () => new ArrayBuffer(0) }); } catch (e) { refused = e.code === 'too-large'; }
  ok(refused, 'PDF.3 a PDF over the server\'s ceiling is refused on the phone, with the too-large message');
  const w = readFileSync(new URL('../src/state/receiptWorker.js', import.meta.url), 'utf8');
  ok(/mediaType: job\.mediaType/.test(w), 'PDF.4 the worker hands the reader the job\'s own media type');
}

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
  ok(card.includes(AR.methodEvidence(true, '•••• 4821')), 'PRED.10 …and says why, quoting the receipt («فيزا — الإيصال فيه «•••• 4821»», R0 re-cut 2026-10-10)');
  ok(card.includes(AR.predFromHistory), 'PRED.11 the category says it came from his book');

  const habit = render({ category: 'Groceries', categorySource: 'similar', method: 'Visa', methodSource: 'history', defaultMethod: 'Cash' });
  ok(pressed(habit).includes(AR.metricVisa) && habit.includes(AR.methodFromHistory), 'PRED.12 no evidence → his habit here, said as habit');
  ok(habit.includes(AR.predFromSimilar), 'PRED.13 a similar-name guess says so');

  const none = render({ category: null, categorySource: null, method: null, methodSource: null, defaultMethod: 'Cash' });
  ok(pressed(none).includes(AR.metricCash) && none.includes(AR.receiptCashSteer) && !/data-pred=/.test(none),
    'PRED.14 nothing predicted → Cash with the D19 steer, and no invented reason');

  // Audit r2 2026-10-10: an UNREAD currency on a euro book offers € / E£ chips —
  // and their style is an object (a spread rgba string crashed the screen).
  {
    const exU = { ...ex, currency: 'UNKNOWN' };
    const u = renderToStaticMarkup(createElement(RV, { onSaved() {}, onManual() {}, onBatch() {}, bookCurrency: 'EUR',
      initialReview: { extraction: exU, dateStr: '9/10/2026', category: 'Groceries', res: { category: 'Groceries', extraction: exU } } }));
    ok(!/style="0:/.test(u) && /aria-pressed="true"[^>]*>€</.test(u) && u.includes('ج.م'),
      'PRED.u1 an unread currency on a euro book: € is chosen, E£ is offered, and the chips render');
  }

  const r = await fixCategory({ tab: 'Aug', rowHint: 2, match: { category: '❓' }, newCategory: 'Groceries', applySimilar: true });
  ok(r && r.ok === true && typeof r.alsoFixed === 'number', 'PRED.15 mock parity: the mock answers applySimilar with a count, as the server does');
} finally { await vite.close(); }

if (failures.length) {
  console.log(`❌ CHUNK PRED — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · the receipt opens on the prediction and says where it came from; one fix files the merchant's other ❓ rows`);
