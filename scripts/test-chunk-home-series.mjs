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
import { inReadingUnit, catsInReadingUnit, homeOffPlot } from '../src/lib/series.js';

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

// ——— categories in his unit («why is this 0?»)
const srvCats = [{ name: 'Groceries', now: 1000, prev: 0, homeNow: 39, homePrev: 20 }, { name: 'Eating out', now: 0, prev: 0, homeNow: 25, homePrev: 0 }];
const cv = catsInReadingUnit(srvCats, { count: 1, total: 0, homeTotal: 9 }, 'EUR', 'EUR');
ok(cv.inHome && cv.cats.map((c) => `${c.name}:${c.now}/${c.prev}`).join(',') === 'Groceries:39/20,Eating out:25/0',
  'HS.14 read in €, By priority and the category list get the euro figures — a euro-only category included');
ok(cv.uncategorized.total === 9, 'HS.15 …and the ❓ total in euros');
// R0 re-cut (audit 2026-10-10): the pound figures stand untouched, and a euro-only
// category (now 0, prev 0 in pounds) is left out rather than drawn as «0».
ok(!catsInReadingUnit(srvCats, null, 'EGP', 'EUR').inHome
  && JSON.stringify(catsInReadingUnit(srvCats, null, 'EGP', 'EUR').cats) === JSON.stringify([srvCats[0]]),
  'HS.16 read in E£, the pound figures stand untouched — the euro-only row is not a pound «0»');
ok(!catsInReadingUnit([{ name: 'X', now: 5, prev: 1 }], null, 'EUR', 'EUR').inHome, 'HS.17 a server without home figures keeps the old lists');

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
  // ——— «why are the colours different / why are the bars not clickable» (2026-10-10)
  ok(/data-bars-legend[\s\S]{0,600}This week[\s\S]{0,400}Last week/.test(html), 'HS.22 the bars carry a key — this week in the line colour, last week in sand');
  ok(/<button[^>]*aria-label="W"/.test(html) || /<button[^>]*aria-pressed="false"[^>]*aria-label="[^"]*"/.test(html), 'HS.23 the week\'s day bars are buttons');
  const old = render('EGP');
  ok(old.includes(S.chartHomeZero(S.currencyShort)), 'HS.9 control: read in E£ the same week still tells the truth about its empty pound chart');
} finally { await vite.close(); }

const book = readFileSync(new URL('../src/views/BookView.jsx', import.meta.url), 'utf8');
// Audit 2026-10-10: a euro row with no readable day is in homeAgg but on no slot.
{
  const p = { cur: { Visa: [10, 20], Cash: [5, null] }, homeAgg: { byMethod: { Visa: { total: 80 }, Cash: { total: 5 } } } };
  const o = homeOffPlot(p);
  ok(o.Visa === 50 && o.Cash === 0, `HS.off1 the undated euro money is the gap between homeAgg and the series — got ${JSON.stringify(o)}`);
  ok(JSON.stringify(homeOffPlot({ cur: {} })) === '{}', 'HS.off2 no byMethod, no claim');
  const pc = catsInReadingUnit([{ name: 'Eating out', now: 0, prev: 0, homeNow: 25 }, { name: 'Car', now: 10, prev: 0 }], null, 'EGP', 'EUR');
  ok(pc.cats.map((c) => c.name).join() === 'Car', 'HS.off3 in pounds, a euro-only category is not drawn as «0»');
}
ok(/period === 'week' && weekDay != null/.test(book) && /getDay\(\) === weekDay/.test(book) && /useEffect\(\(\) => \{ setWeekDay\(null\); \}, \[period\]\)/.test(book),
  'HS.24 a tapped day narrows the week\'s list to that day, and leaving Week forgets it');
{
  // ——— a BROWSED month in his unit: euro rows at face, pound rows at their stamp, the rest named
  const v2 = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
  try {
    const { browsedMonthData, MonthScreen } = await v2.ssrLoadModule('/src/views/BookView.jsx');
    // Audit r2 2026-10-10: the euro Month screen threw (bookHome undefined) and took
    // the whole app down. It must RENDER, with «Where it went» in euros.
    {
      const agg = (t) => ({ currency: 'EUR', total: t, unstamped: { count: 0, total: null, byCurrency: {} }, byMethod: { Visa: { total: t }, Cash: { total: 0 } } });
      const n30 = Array.from({ length: 30 }, (_, i) => (i < 10 ? 10 : null));
      const data = { today_cairo: { y: 2026, m: 9, d: 10 }, monthCats: [{ name: 'Groceries', now: 0, prev: 0, homeNow: 100, homePrev: 50 }],
        month: { cur: { Visa: n30, Cash: n30.map((v) => (v == null ? null : 0)) }, prev: { Visa: Array(31).fill(5), Cash: Array(31).fill(0) },
          names: { cur: 'Sep', prev: 'Aug' }, undated: { count: 0, Visa: 0, Cash: 0 }, unpriced: { count: 0 },
          uncategorized: { count: 0, total: 0, homeTotal: 0 }, foreign: { count: 10, byCurrency: { EUR: 100 } }, prevForeign: { count: 0, byCurrency: {} },
          homeAgg: agg(100), prevHomeAgg: agg(155),
          homeSeries: { currency: 'EUR', cur: { Visa: n30, Cash: n30.map((v) => (v == null ? null : 0)) }, prev: { Visa: Array(31).fill(5), Cash: Array(31).fill(0) } } } };
      let html = '', threw = null;
      try {
        html = renderToStaticMarkup(createElement(MonthScreen, { data, metric: 'all', setMetric() {}, onGoToInbox() {}, lensOpen: false, onToggleLens() {}, displayCurrency: 'EUR' }));
      } catch (e) { threw = e; }
      ok(!threw && html.length > 1000, `HS.ms1 the euro Month screen renders instead of throwing (${threw && threw.message})`);
    }
    const rows = [
      { date: '3/9/2026', description: 'Prisma', method: 'Visa', category: 'Groceries', amount: 12.4, currency: 'EUR' },
      { date: '5/9/2026', description: 'Hyper1', method: 'Cash', category: 'Groceries', amount: 1000, currency: 'EGP', home: 19 },
      { date: '6/9/2026', description: 'Carrefour', method: 'Cash', category: 'Groceries', amount: 500, currency: 'EGP' },
      { date: '9/9/2026', description: 'Cafe', method: 'Visa', category: 'Eating out', amount: 25, currency: 'EUR' },
    ];
    const d = browsedMonthData({ y: 2026, m: 9 }, rows, [], { y: 2026, m: 10, d: 10 }, 'EUR', 'EUR');
    ok(d.month.homeAgg.total === 56.4, `HS.18 a browsed September in € totals 12.4 + 19 (stamped) + 25 = 56.4 (got ${d.month.homeAgg.total})`);
    ok(d.month.homeAgg.unstamped.byCurrency.EGP === 500, 'HS.19 …the unstamped 500 E£ is named, never converted on the phone');
    const g = d.monthCats.find((c) => c.name === 'Groceries');
    ok(g && g.homeNow === 31.4 && d.month.homeSeries.cur.Cash[4] === 19, 'HS.20 …its categories and its daily chart read in euros');
    const egp = browsedMonthData({ y: 2026, m: 9 }, rows, [], { y: 2026, m: 10, d: 10 }, 'EGP', 'EUR');
    ok(!egp.month.homeSeries && !('homeNow' in (egp.monthCats[0] || {})), 'HS.21 read in E£, the browsed month is exactly as before');
  } finally { await v2.close(); }
}
ok(/const mv = inReadingUnit\(data\.month, displayCurrency, HOME_CURRENCY\);/.test(book) && /cur=\{seriesFor\(mv\.period\.cur, metric\)\}/.test(book),
  'HS.10 the Month screen\'s own stack (line + daily bars) draws in the reading unit too');

if (failures.length) {
  console.log(`❌ CHUNK HOMESERIES — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · a euro book's week, month and year draw in euros, adding up to the headline`);
