#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK A7 ═══════════
 * «Named sections («This month», «By method», «Against July»-style, i18n both
 *  locales) replace the stacked prose; the foreign-money essay compresses to
 *  ONE muted line with the detail one tap away; ≤1 policy sentence per
 *  screen.» (chunk-ledger A7; north-star §5: «sections get NAMES … the three
 *  foreign-money sentences compress to one line + one named zone».)
 *
 * WHAT COUNTS AS A POLICY SENTENCE, stated so the cap is checkable: prose that
 * explains a RULE (why no percentage, why no history) — foreignNoCompare,
 * noCompareInUnit, and the compressed line itself. What does NOT count:
 * FIGURES and money facts (the asides, the unsized count) — those are the
 * honest-render law surfacing money, and hiding them behind a tap would spend
 * honesty to buy calm. The oracle asserts both directions: the essay is
 * compressed AND the money is still on the screen.
 *
 * MID-WAVE HONESTY: the «By method» header sits inside Charts.jsx's
 * PeriodSummary (that leaf's file) — labelled [cross-file], may be red until
 * it lands; the i18n keys it consumes are THIS leaf's and pinned here.
 * Guarded lookups throughout: a missing key is a NAMED failure, not a crash.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { AR, AR_LOCALE } from '../src/i18n/strings.ar.js';
import { EN } from '../src/i18n/strings.en.js';

const MARKER = 'CHUNK-A7-GREEN';

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

// ═══ 1. i18n — the section names and the one line, BOTH locales ═══
for (const [name, L] of [['ar', AR], ['en', EN]]) {
  ok(typeof L.whyNoCompare === 'string' && L.whyNoCompare.length > 0,
    `A7.1 ${name}.whyNoCompare exists — the ONE muted line the essay compresses into`);
  ok(typeof L.sectionAgainst === 'function' && L.sectionAgainst.length === 1
    && String(L.sectionAgainst('X')).includes('X'),
    `A7.2 ${name}.sectionAgainst is an «Against July»-style template carrying the period it names`);
  ok(typeof L.sectionByMethod === 'string' && L.sectionByMethod.length > 0,
    `A7.3 ${name}.sectionByMethod exists — the method cards' section has a NAME`);
}

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { PeriodBlock, MonthScreen } = await vite.ssrLoadModule('/src/views/BookView.jsx');
  const { PeriodSummary } = await vite.ssrLoadModule('/src/components/Charts.jsx');

  const names = { cur: AR.thisWeek, prev: AR.lastWeek };
  const week = (foreign, prevForeign) => ({
    cur: { Visa: [200, 100, null], Cash: [0, 0, null] },
    prev: { Visa: [100, 100, 100], Cash: [0, 0, 0] },
    foreign, prevForeign,
  });
  const pb = (data, extra = {}) =>
    text(renderToStaticMarkup(createElement(PeriodBlock, { data, names, ...extra })));

  /**
   * The policy-sentence census. `noCompareInUnit` is counted in every unit it
   * could have been rendered with — a sentence that moved units is still a
   * sentence.
   */
  const POLICY = () => [
    AR.foreignNoCompare,
    ...(typeof AR.noCompareInUnit === 'function' ? [AR.noCompareInUnit('EUR'), AR.noCompareInUnit('EGP')] : []),
    ...(typeof AR.whyNoCompare === 'string' ? [AR.whyNoCompare] : []),
  ];
  const policyCount = (t) => POLICY().reduce((n, s) => n + (s && t.includes(s) ? 1 : 0), 0);

  // ——— a foreign week, read in the book's unit: ONE line, and it is the line
  const withF = pb(week({ count: 2, byCurrency: { EUR: 200 } }));
  ok(policyCount(withF) <= 1,
    `A7.4 a foreign week states AT MOST ONE policy sentence — counted ${policyCount(withF)}`);
  ok(typeof AR.whyNoCompare === 'string' && withF.includes(AR.whyNoCompare),
    'A7.5 …and the one it states is the compressed line — the essay is behind it, not beside it');
  ok(!withF.includes(AR.foreignNoCompare),
    'A7.6 the full foreign-comparison sentence is NOT on the default screen any more');
  ok(withF.includes('200') && withF.includes(AR.andAlso),
    'A7.7 while the foreign MONEY stays surfaced — figures are not prose and never fold away');

  // ——— the same week, read in EUR: two suppressions, still one line
  const eurLed = pb(week({ count: 2, byCurrency: { EUR: 200 } }), { displayCurrency: 'EUR' });
  ok(policyCount(eurLed) <= 1,
    `A7.8 a EUR-led week — two rules in play — still states at most ONE policy sentence, counted ${policyCount(eurLed)}`);
  ok(/0\s*EGP/.test(eurLed) || eurLed.includes(AR.andAlso),
    'A7.9 …and the pounds stay beside the lead — compression never hides a figure');

  // ——— the detail is ONE TAP away, not deleted
  const opened = pb(week({ count: 3, byCurrency: { EUR: 200 } }), { policyOpen: true });
  ok(opened.includes(AR.foreignNoCompare),
    'A7.10 opened, the screen says the full foreign-comparison sentence — compressed, not censored');
  ok(typeof AR.foreignUnsized === 'function' && opened.includes(AR.foreignUnsized(2)),
    'A7.11 …and the unsized-money count is named — count 3 against one priced line is 2 we cannot size');
  const eurOpened = pb(week({ count: 2, byCurrency: { EUR: 200 } }), { displayCurrency: 'EUR', policyOpen: true });
  ok(typeof AR.noCompareInUnit === 'function' && eurOpened.includes(AR.noCompareInUnit('EUR')),
    'A7.12 opened under a EUR lead, the no-history sentence is there too — each rule keeps its words');

  // ——— a period compared AGAINST a foreign one: suppressed, and it says so
  const prevF = pb(week(null, { count: 2, byCurrency: { EUR: 90 } }));
  ok(typeof AR.whyNoCompare === 'string' && prevF.includes(AR.whyNoCompare),
    'A7.13 a comparison refused because LAST period was foreign also gets the one line — silence explains nothing');

  // ——— the clean week: no policy prose at all
  const clean = pb(week(null));
  ok(policyCount(clean) === 0,
    'A7.14 an ordinary week carries ZERO policy sentences — the cap is not a quota');

  // ——— the named section over the month's category list
  const monthHtml = text(renderToStaticMarkup(createElement(MonthScreen, {
    data: {
      month: {
        cur: { Visa: [100, 200, null], Cash: [0, 50, null] },
        prev: { Visa: [80, 80, 80], Cash: [0, 0, 0] },
        names: { cur: 'August', prev: 'July' },
        undated: { count: 0, Visa: 0, Cash: 0 }, unpriced: { count: 0 },
        uncategorized: { count: 0, total: 0 },
      },
      monthCats: [{ name: 'Groceries', now: 300, prev: 100 }, { name: 'Car', now: 50, prev: 60 }],
    },
    metric: 'all', setMetric: () => {}, onGoToInbox: () => {},
  })));
  const against = typeof AR.sectionAgainst === 'function'
    ? AR.sectionAgainst(AR_LOCALE.monthName('July')) : null;
  ok(!!against && monthHtml.includes(against),
    `A7.15 the category list sits under a NAMED section — expected ${JSON.stringify(against)} on the Month screen`);

  // ——— [cross-file] the method cards' named section (Charts leaf's half)
  const summary = text(renderToStaticMarkup(createElement(PeriodSummary, {
    data: week(null), labels: [], liveIndex: -1, metric: 'all', setMetric: () => {},
    periodNames: names, showBars: false,
  })));
  ok(typeof AR.sectionByMethod === 'string' && summary.includes(AR.sectionByMethod),
    'A7.16 [cross-file Charts.jsx] the method cards sit under their own name — «By method» is a section, not an inference');
} finally {
  await vite.close();
}

if (failures.length) {
  console.log(`❌ CHUNK A7 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · sections have names; the foreign essay is one line with its detail a tap away`);
