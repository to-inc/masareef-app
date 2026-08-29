#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK A4 ═══════════
 * «Stat anatomy everywhere: label-above muted at TYPE.label; value ink serif
 *  tabular (the Book's heroes ride TYPE.hero=40); the unit rides INLINE at
 *  unitSize() (UNIT_RATIO 0.55, floored at TYPE.label) and NON-serif; method
 *  cards' naked «0» becomes a worded prev (both locales).» (chunk-ledger A4;
 *  north-star §3 stat anatomy; TOKEN RULING 5.)
 *
 * WHY RENDERS AND NOT ONLY SOURCE PINS. The anatomy is a claim about what a
 * person READS — a unit's size and face exist only in the rendered style. The
 * source half (no raw fontSize/borderRadius in BookView) is the vocabulary
 * claim; the render half is the anatomy claim; both are the chunk.
 *
 * MID-WAVE HONESTY: the method-card worded prev lives in Charts.jsx and the
 * BigAmount unit in Primitives.jsx — both edited by their own leaves in
 * parallel. Those pins are labelled [cross-file] and may be red until that
 * leaf lands; the i18n keys they consume are THIS leaf's and are pinned
 * unconditionally. Global certification at wave end is the Planner's.
 *
 * Every locale-key dereference is GUARDED — a missing key must surface as a
 * NAMED failure, never as «is not a function» killing the run. That pattern
 * bit twice in one afternoon (N1, N1b); it does not get a third.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { TYPE, UNIT_RATIO, unitSize, C } from '../src/theme.js';
import { AR, AR_LOCALE } from '../src/i18n/strings.ar.js';
import { EN } from '../src/i18n/strings.en.js';
import { moneyRound } from '../src/lib/format.js';

const MARKER = 'CHUNK-A4-GREEN';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(root, p), 'utf8');

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };
const eq = (a, b, label) => ok(Object.is(a, b), `${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
/** The hero is found by its SIZE — TYPE.hero and nothing else. The pre-token
 *  42 is deliberately NOT accepted here: this chunk IS the migration. */
const heroOf = (html) => {
  const m = html.match(new RegExp(`font-size:${TYPE.hero}px[^"]*"[^>]*>([^<]*)<`));
  return m ? m[1] : null;
};
const heroStyleOf = (html) => {
  const m = html.match(new RegExp(`style="([^"]*font-size:${TYPE.hero}px[^"]*)"`));
  return m ? m[1] : null;
};
/** The style of the element whose text content ends with `content`. */
const styleOfContent = (html, content) => {
  const esc = content.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = html.match(new RegExp(`style="([^"]*)"[^>]*>[^<]*${esc}<`));
  return m ? m[1] : null;
};

// ═══ 1. SOURCE — BookView consumes the vocabulary, never restates it ═══
{
  const view = src('src/views/BookView.jsx');
  const importLine = (view.match(/import \{[^}]*\} from '\.\.\/theme\.js'/) || [''])[0];
  for (const name of ['TYPE', 'RADIUS', 'unitSize', 'FONT_UI']) {
    ok(new RegExp(`\\b${name}\\b`).test(importLine),
      `A4.1 BookView imports ${name} from the theme — the vocabulary is consumed, not restated`);
  }

  const lines = view.split('\n');
  const rawType = [];
  lines.forEach((ln, i) => {
    if (!/fontSize:/.test(ln)) return;
    if (/TYPE\.|GLYPH\.|ICON\.|unitSize\(/.test(ln)) return;
    rawType.push(`L${i + 1}: ${ln.trim()}`);
  });
  ok(rawType.length === 0,
    `A4.2 every fontSize in BookView is a TYPE/GLYPH/ICON token or unitSize() — raw px remaining:\n      ${rawType.join('\n      ')}`);

  const rawRadius = [];
  lines.forEach((ln, i) => {
    if (!/borderRadius:/.test(ln)) return;
    if (/RADIUS\./.test(ln)) return;
    const context = lines.slice(Math.max(0, i - 4), i + 1).join('\n');
    if (/geometry[\s-]*exemption/i.test(context)) return;
    rawRadius.push(`L${i + 1}: ${ln.trim()}`);
  });
  ok(rawRadius.length === 0,
    `A4.3 every borderRadius in BookView is a RADIUS token or carries the named geometry exemption — remaining:\n      ${rawRadius.join('\n      ')}`);
}

// ═══ 2. i18n — the worded prev, BOTH locales (this leaf's own half) ═══
{
  for (const [name, L] of [['ar', AR], ['en', EN]]) {
    const fn = L.prevWorded;
    ok(typeof fn === 'function' && fn.length === 2,
      `A4.4 ${name}.prevWorded exists as an (amount, prevName) template — the naked «0» has words to become`);
    if (typeof fn !== 'function') continue;
    const out = fn('0', name === 'ar' ? 'يوليو' : 'July');
    ok(typeof out === 'string' && out.includes('0') && out.length > 3
      && out.includes(name === 'ar' ? 'يوليو' : 'July'),
      `A4.5 ${name}.prevWorded('0', …) is «0 last month» IN WORDS — figure and period both present, got ${JSON.stringify(out)}`);
  }
}

// ═══ 3. RENDERS ═══
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const mod = await vite.ssrLoadModule('/src/views/BookView.jsx');
  const { PeriodBlock } = mod;
  const BookView = mod.default;
  const { PeriodSummary } = await vite.ssrLoadModule('/src/components/Charts.jsx');
  const { BigAmount } = await vite.ssrLoadModule('/src/components/Primitives.jsx');

  const week = (foreign) => ({
    cur: { Visa: [200, 100, null], Cash: [50, 0, null] },
    prev: { Visa: [100, 100, 100], Cash: [0, 0, 0] },
    foreign,
  });
  const names = { cur: AR.thisWeek, prev: AR.lastWeek };
  const pb = (data, extra = {}) =>
    renderToStaticMarkup(createElement(PeriodBlock, { data, names, ...extra }));

  const UNIT_PX = unitSize(TYPE.hero);
  eq(UNIT_PX, Math.max(TYPE.label, Math.round(TYPE.hero * UNIT_RATIO)),
    'A4.6 the unit size is unitSize(TYPE.hero) — ruling 5’s floor, as arithmetic');

  // ——— the EGP-led period: label above, hero, inline unit
  const egpHtml = pb(week(null));
  eq(heroOf(egpHtml), moneyRound(350),
    `A4.7 the period hero rides TYPE.hero=${TYPE.hero} and carries the period figure`);
  const heroStyle = heroStyleOf(egpHtml) || '';
  ok(heroStyle.includes('Baskerville') && heroStyle.includes('tabular-nums'),
    'A4.8 the hero value is serif AND tabular — stat anatomy’s value half');
  const labelStyle = styleOfContent(egpHtml, AR.thisWeek) || '';
  ok(labelStyle.includes(`font-size:${TYPE.label}px`) && labelStyle.toUpperCase().includes(C.muted.toUpperCase()),
    `A4.9 the label above the hero is muted at TYPE.label=${TYPE.label} — got style ${JSON.stringify(labelStyle)}`);
  /**
   * A4 (glass audit): the unit's CONTENT is now the mark «ج.م», not the word
   * «جنيه» — HANDOFF:57. These three assertions have never been about the
   * wording; they are about PLACEMENT (inline, not on its own line), SIZE
   * (unitSize(TYPE.hero)) and FACE (non-serif beside a serif figure). All three
   * still hold. Only the string used to FIND the element moved, so the pin
   * moves with it — and moves to the mark specifically, which is stricter than
   * accepting either form.
   */
  const egpUnitStyle = styleOfContent(egpHtml, AR.currencyShort);
  ok(!!egpUnitStyle && egpUnitStyle.includes(`font-size:${UNIT_PX}px`),
    `A4.10 the EGP hero carries its unit INLINE at unitSize(TYPE.hero)=${UNIT_PX} — never on its own line`);
  ok(!!egpUnitStyle && egpUnitStyle.includes('-apple-system'),
    'A4.11 …and the unit is NON-serif (FONT_UI) beside a serif value');

  // ——— the foreign-led period: same anatomy, the unit is the code
  const eurHtml = pb(week({ count: 2, byCurrency: { EUR: 80 } }), { displayCurrency: 'EUR' });
  eq(heroOf(eurHtml), '80', 'A4.12 a EUR-led hero rides the same TYPE.hero');
  const eurUnitStyle = styleOfContent(eurHtml, 'EUR');
  ok(!!eurUnitStyle && eurUnitStyle.includes(`font-size:${UNIT_PX}px`) && eurUnitStyle.includes('-apple-system'),
    'A4.13 the foreign unit rides inline at unitSize(TYPE.hero), non-serif — same anatomy, other unit');

  // ——— the Today hero, through the whole Book
  const today = renderToStaticMarkup(createElement(BookView, {
    data: {
      today_cairo: { y: 2026, m: 8, d: 17 },
      today: {
        entries: [{ date: '17/8/2026', description: 'Nile Star Market', method: 'Visa', category: 'Groceries', amount: 100, currency: 'EGP' }],
        totals: { Visa: 100, Cash: 0 },
      },
      week: { cur: { Visa: [1], Cash: [1] }, prev: { Visa: [1], Cash: [1] } },
      month: { cur: { Visa: [1], Cash: [1] }, prev: { Visa: [1], Cash: [1] }, names: { cur: 'August', prev: 'July' } },
      year: { cur: { Visa: [1], Cash: [1] }, prev: { Visa: [1], Cash: [1] } },
      monthCats: [], pending: [],
    },
  }));
  eq(heroOf(today), '100', 'A4.14 the Today hero rides TYPE.hero too — anatomy everywhere, not per-screen');
  const todayUnit = styleOfContent(today, AR.currencyShort);
  ok(!!todayUnit && todayUnit.includes(`font-size:${UNIT_PX}px`) && todayUnit.includes('-apple-system'),
    'A4.15 and its unit is inline, floored, non-serif — «ج.م» rides the figure, not the meta line');

  // ═══ [cross-file] the method cards’ worded prev (Charts leaf’s render half) ═══
  {
    const zeroPrev = {
      cur: { Visa: [120, 80, null], Cash: [0, 0, null] },
      prev: { Visa: [0, 0, 0], Cash: [0, 0, 0] },
    };
    const html = renderToStaticMarkup(createElement(PeriodSummary, {
      data: zeroPrev, labels: [], liveIndex: -1, metric: 'all', setMetric: () => {},
      periodNames: names, showBars: false,
    }));
    const worded = typeof AR.prevWorded === 'function' ? AR.prevWorded(moneyRound(0), AR.lastWeek) : null;
    ok(!!worded && text(html).includes(worded),
      `A4.16 [cross-file Charts.jsx] a method card’s «0» prev is WORDED — expected ${JSON.stringify(worded)} in the card`);
  }

  // ═══ [cross-file] BigAmount’s unit — non-serif, floored (Primitives leaf) ═══
  {
    const html = renderToStaticMarkup(createElement(BigAmount, { amount: '80', currency: 'EUR' }));
    const unitStyle = styleOfContent(html, 'EUR') || '';
    ok(unitStyle.includes(`font-size:${unitSize(30)}px`),
      `A4.17 [cross-file Primitives.jsx] BigAmount’s unit runs at unitSize(size)=${unitSize(30)} — 0.55×, floored at TYPE.label`);
    ok(unitStyle.includes('-apple-system'),
      'A4.18 [cross-file Primitives.jsx] …and is NON-serif while the value stays serif');
  }
} finally {
  await vite.close();
}

if (failures.length) {
  console.log(`❌ CHUNK A4 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · stat anatomy: muted label, serif tabular value, inline non-serif unit at the floor`);
