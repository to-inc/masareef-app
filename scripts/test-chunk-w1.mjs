#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK W1 ═══════════   `node scripts/test-chunk-w1.mjs`
 *
 * «The chart never draws a zero it does not mean: a FOREIGN-LED period whose
 *  EGP total is 0 renders no EGP cumulative line, no zero marker and no
 *  «in EGP» caption as its story — ONE quiet true sentence stands in their
 *  place, inside the same chart card; the comparison stays refused (that is
 *  mayCompare's standing rule, untouched); the method cards below keep their
 *  own honest rendering; and the moment the period has ANY EGP money — or the
 *  lead is EGP — the chart returns exactly as it is today.»
 *  (chunk-ledger W1; Owner field ruling 2026-08-27: the screenshot of «This
 *  week vs Last week · in EGP» flat at zero, marker «0», under a 160 EUR
 *  week. Every figure true, the picture a lie.)
 *
 * WHAT IS DELIBERATELY NOT DRAWN INSTEAD: a EUR line. By-day home-unit data
 * does not exist in the payload (D23 stage 2, deferred behind the supervised
 * backfill), and a euro curve faked from the aggregate would be fabrication —
 * the exact class this family of chunks exists to kill.
 *
 * THE SENTENCE IS ASSERTED THROUGH THE COMPONENT'S OWN GUARDED DERIVATION:
 * the proposed `chartHomeZero(cur)` key once a locale grows it (this leaf may
 * not add keys — the proposal is a ledger residual), and until then the
 * fallback composed from strings the app already owns. Deriving the expected
 * words the same way keeps this oracle green across the key landing, and the
 * guarded lookups keep a missing key a NAMED failure, never a dead suite
 * (the twice-in-one-afternoon law).
 *
 * Every detector proves itself on seeded input first (the A6/A12 discipline).
 */
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { TYPE } from '../src/theme.js';
import { AR } from '../src/i18n/strings.ar.js';
import { EN } from '../src/i18n/strings.en.js';
import { HOME_CURRENCY } from '../src/state/display.js';

const MARKER = 'CHUNK-W1-GREEN';

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };
const eq = (a, b, label) => ok(Object.is(a, b),
  `${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const count = (t, needle) => (needle ? t.split(needle).length - 1 : 0);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Every <svg …> opening tag — the cumulative chart is the app's only svg. */
const svgCount = (html) => (html.match(/<svg\b/g) || []).length;
/**
 * The chart card's UNIT CAPTION, found by the one style that is its own:
 * the header caption is the `white-space:nowrap` span carrying chartUnit's
 * words. The metric cards' unit line is `text-align:center` and must be told
 * apart — the chunk removes the caption and KEEPS the cards' label.
 */
const capRe = (L) => new RegExp(`white-space:nowrap[^"]*"[^>]*>\\s*${escapeRe(L.chartUnit(L.currencyShort))}`);
const cardsUnitRe = (L) => new RegExp(`text-align:center[^"]*"[^>]*>\\s*${escapeRe(L.chartUnit(L.currencyShort))}`);
/** The hero figure, by its token size — test-book's own extractor. */
const heroOf = (html) => {
  const m = html.match(new RegExp(`font-size:${TYPE.hero}px[^"]*"[^>]*>([^<]*)<`));
  return m ? m[1] : null;
};
/**
 * THE ONE QUIET TRUE SENTENCE, derived exactly as the component derives it:
 * the proposed key when present, else the fallback composed from two strings
 * the app already owns — N7's emptied-scope grammar scoped to the chart's
 * own unit («بالـEGP»: 0 — …). E4 already reuses `priorityEmpty` for an
 * emptied chart scope; the EGP lens over a euro week is the same shape.
 */
const wordsOf = (L) => (typeof L.chartHomeZero === 'function'
  ? L.chartHomeZero(L.currencyShort)
  : (typeof L.priorityEmpty === 'function' && typeof L.chartUnit === 'function'
    ? L.priorityEmpty(L.chartUnit(L.currencyShort))
    : null));

// ——— controls: the detectors prove themselves on seeded input first.
{
  // Seeded from the LOCALE, not from a literal. The first version pasted
  // «بالـEGP» in by hand, so when the caption moved to the mark the detectors
  // were correct and their own controls were the things that failed.
  const seedWords = AR.chartUnit(AR.currencyShort);
  const seededCap = `<span style="font-size:11.5px;color:#8A94A6;white-space:nowrap;unicode-bidi:isolate">${seedWords}</span>`;
  ok(capRe(AR).test(seededCap), 'control — the caption detector finds a seeded nowrap unit caption');
  ok(!capRe(AR).test(seededCap.replace('white-space:nowrap', 'text-align:center')),
    'control — and refuses the same words under the metric cards’ own centred style');
  ok(cardsUnitRe(AR).test(`<div style="font-size:11.5px;margin-top:10px;text-align:center">${seedWords}</div>`),
    'control — the cards-unit detector finds the centred label');
  ok(svgCount('<div><svg viewBox="0 0 1 1"></svg></div>') === 1 && svgCount('<div></div>') === 0,
    'control — the svg counter counts what is there and only that');
}

// ——— the sentence exists in BOTH locales, and it NAMES the unit.
for (const [name, L] of [['ar', AR], ['en', EN]]) {
  const w = wordsOf(L);
  ok(typeof w === 'string' && w.length > 0,
    `W1.1 [${name}] the quiet sentence derives from strings the locale already owns — no new key required to be honest`);
  ok(typeof w === 'string' && w.includes(L.chartUnit(L.currencyShort)),
    `W1.2 [${name}] the sentence NAMES the chart's unit («${L.chartUnit(L.currencyShort)}») — the caption's fact survives the caption, and test-book's two-unit-mentions law depends on it`);
  ok(typeof w === 'string' && !/[▲▼%!⚠]/.test(w),
    `W1.3 [${name}] the sentence is a quiet statement — no delta glyph, no percentage, no alarm`);
}

/** One locale's whole render pass — e7's sweep pattern. */
async function sweep(lang, L) {
  globalThis.localStorage = { getItem: () => lang, setItem() {} };
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  try {
    const { PeriodBlock, MonthScreen } = await vite.ssrLoadModule('/src/views/BookView.jsx');
    const names = { cur: L.thisWeek, prev: L.lastWeek };
    const pb = (data, extra = {}) => {
      try {
        return renderToStaticMarkup(createElement(PeriodBlock,
          { data, names, showBars: true, labels: ['a', 'b', 'c'], liveIndex: 1, ...extra }));
      } catch (err) {
        failures.push(`[${lang}] PeriodBlock THREW — ${err && err.message}`);
        return '';
      }
    };
    const words = wordsOf(L);

    /**
     * ——— THE OWNER'S WEEK: 160 EUR, nothing in pounds, read in EUR.
     * The head already tells it truthfully («160 EUR», aside «0 EGP»); the
     * chunk is about the chart below RE-telling it as «nothing happened».
     */
    const hisWeek = (over = {}) => ({
      cur: { Visa: [0, 0, null], Cash: [0, 0, null] },
      prev: { Visa: [500, 500, 500], Cash: [0, 0, 0] },
      foreign: { count: 2, byCurrency: { EUR: 160 } },
      ...over,
    });
    /**
     * DAD'S WEEK, as its own fixture. These checks used to simulate Dad by
     * rendering HIS euro week with no `displayCurrency` and leaning on the
     * default being EGP. Two rulings since have retired that proxy: the default
     * is EUR now, and the lead follows the money rather than the setting — so a
     * euro-only week leads in euros no matter what is or is not chosen.
     *
     * Dad's install is unmoved, and this asserts it the way it should always
     * have been asserted: with pounds in the book.
     */
    const dadWeek = (over = {}) => ({
      cur: { Visa: [3000, 0, null], Cash: [0, 0, null] },
      prev: { Visa: [500, 500, 500], Cash: [0, 0, 0] },
      foreign: { count: 0, byCurrency: {} },
      ...over,
    });
    const eur = pb(hisWeek(), { displayCurrency: 'EUR' });
    const eurText = text(eur);

    eq(svgCount(eur), 0,
      `W1.4 [${lang}] a foreign-led 0-EGP week draws NO cumulative line and NO zero marker — the chart never draws a zero it does not mean`);
    ok(!eur.includes('chart-draw') && !eur.includes('@keyframes'),
      `W1.5 [${lang}] and B3's draw animation does not mount — an absent line is never animated`);
    ok(!capRe(L).test(eur),
      `W1.6 [${lang}] the «${L.chartUnit(L.currencyShort)}» header caption is gone — a caption over an absent chart captions nothing`);
    ok(typeof L.avg === 'string' && !eurText.includes(L.avg),
      `W1.7 [${lang}] the paired bars stand down with the line — the same zero in columns is the same lie`);
    ok(!!words && eurText.includes(words),
      `W1.8 [${lang}] the ONE quiet true sentence stands in the chart's place — expected «${words}»`);
    ok(!!words && count(eurText, words) === 1,
      `W1.9 [${lang}] …exactly once — one sentence, not a chorus`);
    ok(!!words && eur.indexOf(words) > eur.indexOf('160')
      && eur.indexOf(words) < eur.indexOf(L.sectionByMethod),
      `W1.10 [${lang}] …and INSIDE the same chart card — after the head, before «${L.sectionByMethod}»`);
    eq(heroOf(eur), '160',
      `W1.11 [${lang}] the head is untouched — the week still leads with the 160 he actually spent (N1b's ground)`);
    ok(!/[▲▼]/.test(eurText) && !eurText.includes('%'),
      `W1.12 [${lang}] the comparison stays refused — mayCompare's standing rule, not loosened by the sentence`);
    ok(cardsUnitRe(L).test(eur) && eurText.includes(L.metricVisa),
      `W1.13 [${lang}] the method cards below keep their own honest rendering — their unit label and their figures stay`);

    /**
     * ——— DAY ONE of a foreign-led zero week: the W1 sentence OUTRANKS M7's
     * «the chart appears after another day» — no EGP money means no chart
     * tomorrow either, and a promise the period cannot keep is not quiet.
     * (test-book's own EUR fixture is exactly this one-slot shape.)
     */
    const oneSlot = { cur: { Visa: [0, null], Cash: [0, null] }, prev: { Visa: [500, 500], Cash: [0, 0] } };
    const daySlot = pb(hisWeek(oneSlot), { displayCurrency: 'EUR' });
    ok(!!words && text(daySlot).includes(words)
      && !text(daySlot).includes(L.periodJustStarted(L.thisWeek)),
      `W1.13b [${lang}] on a one-slot foreign-led zero week the TRUE sentence outranks the just-started promise`);
    ok(text(pb(dadWeek(oneSlot))).includes(L.periodJustStarted(L.thisWeek)),
      `W1.13c [${lang}] while under an EGP lead the one-slot week keeps M7's own sentence — the just-started case is untouched where the rule does not fire`);

    /**
     * ——— ANY EGP money returns the chart EXACTLY as it is today (both
     * directions pinned): the mixed week draws, captions, and says nothing.
     */
    const mixed = hisWeek({ cur: { Visa: [30, 20, null], Cash: [0, 0, null] } });
    const mixedEur = pb(mixed, { displayCurrency: 'EUR' });
    eq(svgCount(mixedEur), 1,
      `W1.14 [${lang}] the moment the period has ANY EGP money the line is back — the rule fires on the unmeant zero, not on foreignness`);
    ok(capRe(L).test(mixedEur),
      `W1.15 [${lang}] …with its «${L.chartUnit(L.currencyShort)}» caption — an EGP chart under a euro hero must still say which unit it plots`);
    ok(!!words && !text(mixedEur).includes(words),
      `W1.16 [${lang}] …and no sentence — it exists only where the chart would lie`);
    ok(typeof L.avg === 'string' && text(mixedEur).includes(L.avg),
      `W1.17 [${lang}] …and the bars are back too, average rule and all`);
    {
      const svgOf = (html) => (html.match(/<svg[\s\S]*?<\/svg>/) || [null])[0];
      const mixedEgp = pb(mixed, { displayCurrency: 'EGP' });
      ok(!!svgOf(mixedEur) && svgOf(mixedEur) === svgOf(mixedEgp),
        `W1.18 [${lang}] the returned chart is byte-identical whichever unit leads — «exactly as it is today», mechanically`);
    }

    // ——— Dad's install: EGP leads, so the flat zero MATCHES the headline
    // above it («0 جنيه · ومعاهم 160 EUR») — the card's story and its chart
    // agree, and nothing moves.
    const dad = pb(dadWeek());
    eq(svgCount(dad), 1,
      `W1.19 [${lang}] under an EGP lead the chart stays — the zero it draws is the zero the head states beside the euros`);
    ok(!!words && !text(dad).includes(words),
      `W1.20 [${lang}] …and no sentence on Dad's screen — his install is unmoved`);

    // ——— a genuinely empty week read in EUR: no foreign money anywhere, so
    // the flat zero is TRUE («nothing happened» is the week) and stays drawn.
    const empty = pb(hisWeek({ foreign: null }), { displayCurrency: 'EUR' });
    eq(svgCount(empty), 1,
      `W1.21 [${lang}] a truly empty week keeps its chart even under a EUR lead — that zero IS meant, and honest absence is not this rule's business`);
    ok(!!words && !text(empty).includes(words),
      `W1.22 [${lang}] …and states no foreign-money sentence it cannot back`);

    /**
     * ——— THE MONTH PATH: the stack (E5) rides the same gate — a EUR-led
     * 0-EGP month states the sentence instead of two panels of zeros.
     */
    const monthHtml = (() => {
      try {
        return renderToStaticMarkup(createElement(MonthScreen, {
          data: {
            month: {
              cur: { Visa: [0, 0, null], Cash: [0, 0, null] },
              prev: { Visa: [10, 10, 10], Cash: [0, 0, 0] },
              names: { cur: 'August', prev: 'July' },
              undated: { count: 0, Visa: 0, Cash: 0 }, unpriced: { count: 0 },
              uncategorized: { count: 0, total: 0 },
              foreign: { count: 1, byCurrency: { EUR: 90 } }, prevLog: null,
            },
            monthCats: [],
          },
          metric: 'all', setMetric: () => {}, onGoToInbox: () => {},
          displayCurrency: 'EUR',
        }));
      } catch (err) {
        failures.push(`[${lang}] MonthScreen THREW — ${err && err.message}`);
        return '';
      }
    })();
    eq(svgCount(monthHtml), 0,
      `W1.23 [${lang}] a foreign-led 0-EGP MONTH mounts no stack — neither panel may tell the zero the line may not`);
    ok(!!words && count(text(monthHtml), words) === 1,
      `W1.24 [${lang}] …and states the same one sentence, once, in its chart card`);
    ok(!monthHtml.includes('chart-draw'),
      `W1.25 [${lang}] …with no draw animation there either`);
  } finally {
    await vite.close();
  }
}

await sweep('ar', AR);
await sweep('en', EN);

/**
 * ——— THE SOURCE PINS: the decision is DERIVED from the head's own machinery,
 * never re-derived; the sentence upgrades to the proposed key by itself.
 */
{
  const view = await readFile(new URL('../src/views/BookView.jsx', import.meta.url), 'utf8');
  ok(/const homeZeroMisleads = !leadsHome && hasForeign\(foreign\) && totals\.all\.now === 0;/.test(view),
    'W1.26 PeriodBlock derives the gate from leadsHome (leadAndAsides’ verdict), hasForeign and totals.all.now — the head’s own machinery, no second derivation over the series');
  ok(/homeZeroMisleads=\{homeZeroMisleads\}/.test(view),
    'W1.27 …and hands the verdict to PeriodSummary as a prop — the card renders a decision, it never re-decides');

  const charts = await readFile(new URL('../src/components/Charts.jsx', import.meta.url), 'utf8');
  ok(/typeof S\.chartHomeZero === 'function'/.test(charts)
    && /S\.priorityEmpty\(S\.chartUnit\(unitFor\(HOME_CURRENCY\)\)\)/.test(charts),
    'W1.28 the sentence is a GUARDED lookup — the proposed chartHomeZero key when i18n lands it, the owned-strings fallback until then');
}

if (failures.length) {
  console.log(`❌ CHUNK W1 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · a foreign-led 0-EGP period states its true sentence in the chart card; any EGP money brings the chart back unchanged`);
