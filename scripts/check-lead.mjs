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

const report = failures.length
  ? `❌ ${failures.length} / ${pass + failures.length} lead checks failed:\n  - ${failures.join('\n  - ')}`
  : `✅ all ${pass} lead checks passed · no period headlines a zero while it holds money`;
console.log(report);
process.exit(failures.length ? 1 : 0);
