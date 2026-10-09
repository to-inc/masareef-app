#!/usr/bin/env node
/**
 * ═══════════ GATE — CHARTS IN HIS READING UNIT (Tarek, 2026-10-10) ═══════════
 * «The week and month are lacking diagrams.» His book is euro; the server's
 * cur/prev series are EGP by D8, so every chart read «this chart counts in E£
 * only» over an empty frame. The server now sends `homeSeries` (same shape, in
 * the home unit, valued as the headline's homeAgg); the charts draw it.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
import { inReadingUnit } from '../src/lib/series.js';

const MARKER = 'CHUNK-HOMESERIES-GREEN';
let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) pass++; else failures.push(label); };

const zeros = (n) => Array(n).fill(0);
const week = {
  cur: { Visa: [0, 0, 0, 0, null, null, null], Cash: [0, 0, 0, 0, null, null, null] },
  prev: { Visa: zeros(7), Cash: zeros(7) },
  homeAgg: { currency: 'EUR', total: 61.13 },
  homeSeries: { currency: 'EUR',
    cur: { Visa: [12.5, 0, 30.13, 18.5, null, null, null], Cash: [0, 0, 0, 0, null, null, null] },
    prev: { Visa: [40, 22, 0, 81.31, 60, 37, 40], Cash: zeros(7) } },
};

// ——— the switch itself
const eur = inReadingUnit(week, 'EUR', 'EGP');
ok(eur.inHome && eur.unit === 'EUR' && eur.period.cur.Visa[0] === 12.5, 'HS.1 reading in €, the period draws the euro series');
ok(eur.period.homeAgg === week.homeAgg, 'HS.2 …and keeps every other field of the period untouched');
const egp = inReadingUnit(week, 'EGP', 'EGP');
ok(!egp.inHome && egp.period === week, 'HS.3 reading in E£, nothing changes — the pound series as before');
ok(!inReadingUnit({ ...week, homeSeries: null }, 'EUR', 'EGP').inHome, 'HS.4 a server without the series (Dad\'s book, an old build) keeps the pound charts');
ok(!inReadingUnit({ ...week, homeSeries: { ...week.homeSeries, currency: 'SEK' } }, 'EUR', 'EGP').inHome, 'HS.5 a series in another unit is never drawn under a € label');

// ——— rendered
const store = new Map([['masareef.lang', 'en']]);
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const { PeriodSummary } = await vite.ssrLoadModule('/src/components/Charts.jsx');
  const { S } = await vite.ssrLoadModule('/src/i18n/strings.js');
  const render = (displayCurrency) => renderToStaticMarkup(createElement(PeriodSummary, {
    data: week, labels: ['S', 'M', 'T', 'W', 'T', 'F', 'S'], liveIndex: 3, metric: 'all', setMetric() {},
    periodNames: { cur: 'This week', prev: 'Last week' }, showBars: true, homeZeroMisleads: true, displayCurrency,
  }));
  const html = render('EUR');
  ok(!html.includes(S.chartHomeZero(S.currencyShort)), 'HS.6 the € week no longer says «Nothing in E£ this period — this chart counts in E£ only»');
  ok(html.includes(S.chartUnit('€')), `HS.7 the chart names its unit «${S.chartUnit('€')}»`);
  ok(/<svg[\s\S]*<path[^>]+d="M/.test(html), 'HS.8 …and draws a line (an SVG path is on the page)');
  // ——— the HEADLINE compares euro to euro (Tarek, 2026-10-10: «compare my euros like the cards»)
  const { PeriodBlock } = await vite.ssrLoadModule('/src/views/BookView.jsx');
  const wk = { ...week, foreign: { count: 4, byCurrency: { EUR: 61.13 } }, prevForeign: { count: 11, byCurrency: { EUR: 280.31 } },
    homeAgg: { currency: 'EUR', total: 61.13, unstamped: { count: 0, total: null, byCurrency: {} } },
    prevHomeAgg: { currency: 'EUR', total: 280.31, unstamped: { count: 0, total: null, byCurrency: {} } } };
  const head = (dc) => renderToStaticMarkup(createElement(PeriodBlock, {
    data: wk, labels: ['S', 'M', 'T', 'W', 'T', 'F', 'S'], liveIndex: 3, metric: 'all', setMetric() {},
    names: { cur: 'This week', prev: 'Last week' }, showBars: true, footnote: null, offPlot: {}, displayCurrency: dc }));
  const h = head('EUR');
  ok(!h.includes(S.whyNoCompare), 'HS.11 the € headline no longer says «No comparison here — see why»');
  ok(h.includes(S.lessThan('Last week')) && /<b[^>]*>\d+%<\/b>/.test(h), 'HS.12 …it says «less than Last week» with a percentage, euro to euro');
  ok(new RegExp(`${S.wasThen}[^<]*<span[^>]*>143</span>`).test(h) && !new RegExp(`${S.wasThen}[^<]*<span[^>]*>280</span>`).test(h),
    'HS.13 …measured at the SAME POINT of last week: through Wednesday 40+22+0+81.31 = 143, never the whole week\'s 280');
  const old = render('EGP');
  ok(old.includes(S.chartHomeZero(S.currencyShort)), 'HS.9 control: read in E£ the same week still tells the truth about its empty pound chart');
} finally { await vite.close(); }

const book = readFileSync(new URL('../src/views/BookView.jsx', import.meta.url), 'utf8');
ok(/const mv = inReadingUnit\(data\.month, displayCurrency, HOME_CURRENCY\);/.test(book) && /cur=\{seriesFor\(mv\.period\.cur, metric\)\}/.test(book),
  'HS.10 the Month screen\'s own stack (line + daily bars) draws in the reading unit too');

if (failures.length) {
  console.log(`❌ CHUNK HOMESERIES — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · a euro book's week, month and year draw in euros, adding up to the headline`);
