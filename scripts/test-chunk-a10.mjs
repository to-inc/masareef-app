#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK A10 ═══════════
 * «Today leads with the TRUE sentence when the number would mislead (ratified
 *  §8b): a foreign-only day headlines its foreign line — never a fabricated
 *  0 — and the zero it does state stands beside the money, not alone.»
 *  (chunk-ledger A10; north-star §8b, ratified 2026-08-25; voice-F1 / Owner
 *  Q2. Lead selection is `state/display.js`'s `leadAndAsides` — CONSUMED,
 *  never reimplemented.)
 *
 * THE LINE THIS MAY NOT CROSS: emphasis, never arithmetic. The screen may
 * REORDER the sums the payload carried; it may not produce a figure that did
 * not arrive. The decimal census below is the same trick test-book's N1b
 * block uses — a conversion at any rate necessarily mints a new number.
 *
 * WHAT DOES NOT TRIGGER IT: a day with real EGP money leads EGP exactly as
 * before (the number does not mislead), and a genuinely empty day leads its
 * TRUE zero — a zero he really spent is a fact, not a fabrication. Both are
 * pinned, because a lead that always went foreign would be the same defect
 * mirrored.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { TYPE } from '../src/theme.js';
import { AR } from '../src/i18n/strings.ar.js';

const MARKER = 'CHUNK-A10-GREEN';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };
const eq = (a, b, label) => ok(Object.is(a, b), `${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
/**
 * The hero by SIZE. `TYPE.hero` OR the pre-token 42 — deliberately, so this
 * gate is red for the LEAD being wrong, never for A4's size migration; A4's
 * own gate pins the token and the two collapse together at wave end.
 */
const heroOf = (html) => {
  const m = html.match(new RegExp(`font-size:(?:${TYPE.hero}|42)px[^"]*"[^>]*>([^<]*)<`));
  return m ? m[1] : null;
};

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const BookView = (await vite.ssrLoadModule('/src/views/BookView.jsx')).default;
  const day = (over = {}) => ({
    date: '17/8/2026', description: 'Nile Star Market', method: 'Visa',
    category: 'Groceries', amount: 100, currency: 'EGP', ...over,
  });
  const payload = (entries, totals) => ({
    today_cairo: { y: 2026, m: 8, d: 17 },
    today: { entries, totals },
    week: { cur: { Visa: [1], Cash: [1] }, prev: { Visa: [1], Cash: [1] } },
    month: { cur: { Visa: [1], Cash: [1] }, prev: { Visa: [1], Cash: [1] }, names: { cur: 'August', prev: 'July' } },
    year: { cur: { Visa: [1], Cash: [1] }, prev: { Visa: [1], Cash: [1] } },
    monthCats: [], pending: [],
  });
  const render = (entries, totals) =>
    renderToStaticMarkup(createElement(BookView, { data: payload(entries, totals) }));

  // ——— §8b's own day: everything in euros, nothing in pounds
  const foreignOnly = render(
    [day({ description: 'Café de Flore', amount: 42.87, currency: 'EUR' })],
    { Visa: 0, Cash: 0 },
  );
  eq(heroOf(foreignOnly), '42.87',
    'A10.1 a foreign-only day HEADLINES the euros he actually spent — the misleading 0 never leads');
  const fText = text(foreignOnly);
  ok(/42\.87\s*EUR/.test(fText),
    'A10.2 …and the lead names its unit — a bare 42.87 under an EGP habit is the same hazard reversed');
  ok(fText.includes(AR.andAlso) && /0\s*(?:EGP|جنيه)/.test(fText),
    'A10.3 the true EGP zero stands BESIDE the money as the aside — stated, never alone, never hidden');
  ok((fText.match(/\d+\.\d\d/g) || []).every((n) => n === '42.87'),
    'A10.4 no figure appears that the payload did not carry — emphasis, never arithmetic (Boundary 8)');

  // ——— a real-EGP day: the number does not mislead, so nothing moves
  const ordinary = render(
    [day(), day({ description: 'Café', amount: 12.5, currency: 'EUR' })],
    { Visa: 100, Cash: 0 },
  );
  eq(heroOf(ordinary), '100',
    'A10.5 a day with real EGP money leads EGP exactly as before — the rule fires on misleading, not on foreignness');
  ok(text(ordinary).includes(AR.travelApart) && /12\.5\s*EUR/.test(text(ordinary)),
    'A10.6 …with the foreign money still named apart from the figure (S4), untouched by this chunk');

  // ——— the genuinely empty day: a TRUE zero is a true sentence
  eq(heroOf(render([], { Visa: 0, Cash: 0 })), '0',
    'A10.7 a day he truly spent nothing leads with its zero — §8b moves the lead only when the number LIES');

  // ——— two foreign currencies, no pounds: lead one, name the rest, sum nothing
  const twoCur = render(
    [day({ description: 'Café', amount: 20, currency: 'EUR' }),
      day({ description: 'Pharmacy', amount: 100, currency: 'SEK' })],
    { Visa: 0, Cash: 0 },
  );
  eq(heroOf(twoCur), '20', 'A10.8 with two foreign currencies one leads (stable code order — EUR before SEK)');
  const tText = text(twoCur);
  ok(/100\s*SEK/.test(tText) && /0\s*(?:EGP|جنيه)/.test(tText),
    'A10.9 …and the other currency AND the EGP zero are both named beside it');
  ok(!tText.includes('120'),
    'A10.10 20 EUR + 100 SEK is never 120 of anything — no sum across currencies, ever');

  // ——— the selection logic is display.js's, consumed — not a second copy
  const view = readFileSync(join(root, 'src/views/BookView.jsx'), 'utf8');
  const head = view.slice(view.indexOf('function TodayHead('),
    view.indexOf('export function PeriodBlock('));
  ok(/leadAndAsides\(/.test(head),
    'A10.11 TodayHead consumes leadAndAsides — the lead-selection logic exists ONCE, in state/display.js');
} finally {
  await vite.close();
}

if (failures.length) {
  console.log(`❌ CHUNK A10 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · Today leads with the true sentence: foreign-only days headline their money, zeros stand beside it`);
