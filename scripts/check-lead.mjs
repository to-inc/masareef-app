#!/usr/bin/env node
/**
 * NO PERIOD HEADLINES A ZERO WHILE IT HOLDS MONEY.  `npm run check:lead`
 *
 * THE DEFECT THIS EXISTS FOR, stated plainly because I caused it.
 *
 * `leadAndAsides` honours the chosen display unit even when that unit has no
 * rows, on the reasoning that "he asked to read in it, and answering in a
 * different unit would be the app overruling the choice". That reasoning held
 * while the default WAS the book's unit — the chosen unit was the one with the
 * money, so the case almost never arose.
 *
 * Making EUR the default (Owner ruling, 2026-08-30) made it arise on every
 * EGP-heavy period. On the real payload, August holds 123,110.68 EGP and zero
 * euros, and the screen's largest element read «0 EUR» with the real money
 * demoted to an aside. The setting did not lie; the HEADLINE did.
 *
 * The rule now: lead with the chosen unit whenever it has money, and otherwise
 * lead with the unit that does — while still stating every other figure,
 * including the chosen one, as an aside. Nothing is hidden either way, so the
 * choice is still reported rather than overruled; what changes is which true
 * number is given the hero.
 *
 * Asserted against the REAL wire, per period, in both languages, because a
 * hand-built fixture is a guess and this is the second premise in one session
 * that a real payload has corrected.
 */
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

const FIXTURE = process.env.MASAREEF_WIRE
  || new URL('./fixtures-wire-summary.json', import.meta.url);
const wire = JSON.parse(readFileSync(FIXTURE, 'utf8'));

let pass = 0;
const failures = [];
const ok = (c, m) => { if (c) pass++; else failures.push(m); };

const egpOf = (p) => [].concat(p?.cur?.Visa || [], p?.cur?.Cash || [])
  .reduce((a, n) => a + (Number(n) || 0), 0);

// The fixture must contain a period that actually exercises this, or the whole
// file is theatre: money in one unit and nothing in the chosen one.
const monthEgp = egpOf(wire.month);
ok(monthEgp > 0, `the fixture's month must hold EGP money to be worth asserting about (got ${monthEgp})`);
ok(Number(wire.month?.homeAgg?.total || 0) === 0,
  'the fixture\'s month must hold NO euros — that is the case under test');

const stub = (lang) => {
  globalThis.localStorage = {
    getItem: (k) => (k === 'masareef.lang' ? lang : null),
    setItem() {}, removeItem() {}, clear() {},
  };
};
/** the hero is the single largest rendered figure — the one he reads first */
const heroOf = (html, heroPx) => {
  const m = html.match(new RegExp(`font-size:${heroPx}px[^"]*"[^>]*>([^<]*)<`));
  return m ? m[1].trim() : null;
};

for (const lang of ['ar', 'en']) {
  stub(lang);
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
  try {
    const BookView = (await vite.ssrLoadModule('/src/views/BookView.jsx')).default;
    const { TYPE } = await vite.ssrLoadModule('/src/theme.js');
    for (const period of ['today', 'week', 'month', 'year']) {
      let html;
      try { html = renderToStaticMarkup(createElement(BookView, { data: wire, initialPeriod: period })); }
      catch (e) { failures.push(`[${lang}] ${period} threw: ${e.message}`); continue; }
      const hero = heroOf(html, TYPE.hero);
      const holdsMoney = period === 'today'
        ? (Number(wire.today?.totals?.Visa || 0) + Number(wire.today?.totals?.Cash || 0)) > 0
        : egpOf(wire[period]) > 0 || Number(wire[period]?.homeAgg?.total || 0) > 0;
      if (!holdsMoney) {
        // A genuinely empty period SHOULD read zero. That is honesty, not a bug,
        // and asserting otherwise would demand the app invent money.
        ok(hero !== null, `[${lang}] ${period}: an empty period still needs a hero to state its zero`);
        continue;
      }
      const heroDigits = String(hero || '').replace(/[^\d]/g, '');
      ok(heroDigits !== '' && Number(heroDigits) > 0,
        `[${lang}] ${period}: the hero reads ${JSON.stringify(hero)} while the period holds money — `
        + `a zero must never be the largest thing on a screen that has a figure to show`);
    }
  } finally { await vite.close(); }
}

/**
 * ═══ D27 — THE POST-BACKFILL SHAPE, and the double-count it must not create ═══
 *
 * The backfill's ENTIRE effect on this payload is that rows move from
 * `unstamped` into `converted`, and `total` grows by their home value. So the
 * fixture performs exactly that move on the REAL wire at a REAL measured rate
 * (0.017274 EGP→EUR, the source's own answer for 2026-08-12), rather than
 * inventing a payload shape — a hand-built one is a guess, and a guess has
 * already corrected me twice in this project.
 *
 * ONE ROW IS DELIBERATELY LEFT UNSTAMPED. A fixture where the backfill priced
 * everything cannot see the remainder line at all, and the remainder is the
 * whole honesty of the feature.
 */
const RATE = 0.017274;
const LEFT_UNSTAMPED = 2033.32;
const converted = JSON.parse(JSON.stringify(wire));
let exercised = 0;
for (const key of ['month', 'year']) {
  const ha = converted[key] && converted[key].homeAgg;
  const egp = Number(ha && ha.unstamped && ha.unstamped.byCurrency && ha.unstamped.byCurrency.EGP);
  if (!isFinite(egp) || egp <= LEFT_UNSTAMPED) continue;
  const moved = egp - LEFT_UNSTAMPED;
  const inEur = Math.round(moved * RATE * 100) / 100;
  ha.converted = { count: Math.max(1, (ha.unstamped.count || 2) - 1), total: inEur, byCurrency: {} };
  ha.total = Math.round((Number(ha.total || 0) + inEur) * 100) / 100;
  ha.unstamped = { count: 1, total: null, byCurrency: { EGP: LEFT_UNSTAMPED } };
  /**
   * §2.2c — the same partition sliced by method. Split so that the two halves
   * SUM TO THE WHOLE, because «All = Card + Cash» is the arithmetic he will do
   * by eye the moment the three sit together, and a fixture that does not hold
   * it would certify a card that cannot be read.
   */
  const visa = Math.round(ha.total * 0.6 * 100) / 100;
  const cash = Math.round((ha.total - visa) * 100) / 100;
  const bucket = (t) => ({ native: { count: 1, total: t }, converted: { count: 0, total: 0 },
                           unstamped: { count: 0, total: null, byCurrency: {} }, unpriced: 0, total: t });
  ha.byMethod = { Visa: bucket(visa), Cash: bucket(cash) };
  ok(Math.abs((visa + cash) - ha.total) < 0.011,
    `the ${key} fixture must satisfy All = Card + Cash (${visa} + ${cash} vs ${ha.total})`);
  exercised++;
}
ok(exercised > 0, 'the post-backfill fixture must actually move money, or these checks are theatre');

for (const lang of ['ar', 'en']) {
  stub(lang);
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
  try {
    const BookView = (await vite.ssrLoadModule('/src/views/BookView.jsx')).default;
    const { TYPE } = await vite.ssrLoadModule('/src/theme.js');
    const { S } = await vite.ssrLoadModule('/src/i18n/strings.js');
    const { unitFor } = await vite.ssrLoadModule('/src/i18n/strings.js');
    const displayUnit = unitFor('EUR');
    const naiveEur = Number(wire.month?.homeAgg?.total || 0);
    const allIn = Number(converted.month?.homeAgg?.total || 0);
    ok(allIn > naiveEur, `[${lang}] the all-in total must exceed the native-only one (${allIn} vs ${naiveEur})`);

    let html;
    try { html = renderToStaticMarkup(createElement(BookView, { data: converted, initialPeriod: 'month' })); }
    catch (e) { failures.push(`[${lang}] converted month threw: ${e.message}`); continue; }

    const hero = heroOf(html, TYPE.hero);
    const heroNum = Number(String(hero || '').replace(/[^\d]/g, ''));
    ok(heroNum > Math.floor(naiveEur),
      `[${lang}] the hero must be the ALL-IN figure once rows are converted — read ${JSON.stringify(hero)}, `
      + `which is not more than the native-euro sum ${naiveEur}`);

    // ——— THE DOUBLE COUNT. Converted pounds are INSIDE the euro hero, so the
    // additive aside must be gone. This is the one way this change could newly
    // lie, and it is the assertion that would catch it.
    ok(!html.includes(S.andAlso),
      `[${lang}] «${S.andAlso}» is still on screen under an all-in hero — converted money is INSIDE that figure, `
      + 'and restating it beside the figure reads as money the total does not include');

    // ——— THE REMAINDER. Real money, no rate on its row, therefore outside the
    // total and therefore stated.
    // ——— THE CARD HE POINTED AT. «By method … in E£» under a euro hero was
    // the screenshot that opened this whole sitting; with `byMethod` on the
    // wire the cards are euro figures and must say so.
    ok(html.includes(S.chartUnit(displayUnit)),
      `[${lang}] the method cards still do not say «${S.chartUnit(displayUnit)}» — with byMethod on the wire `
      + 'their figures are euros, and a euro figure under a pounds label is the mislabelling this change exists to end');

    ok(html.includes(S.notConverted),
      `[${lang}] the unstamped remainder is not stated — an all-in total that silently omits what it could not price `
      + 'is the same defect this file exists to prevent');
  } finally { await vite.close(); }
}

const report = failures.length
  ? `❌ ${failures.length} / ${pass + failures.length} lead checks failed:\n  - ${failures.join('\n  - ')}`
  : `✅ all ${pass} lead checks passed · no period headlines a zero while it holds money`;
console.log(report);
process.exit(failures.length ? 1 : 0);
