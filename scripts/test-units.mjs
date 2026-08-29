#!/usr/bin/env node
/**
 * EVERY AMOUNT SHOWS ITS UNIT, AND THE UNIT IS THE MARK.  `npm run check:units`
 *
 * Two laws from the design brief, neither of which had an oracle:
 *
 *   HANDOFF:56  Every amount always shows its currency as a small muted unit.
 *   HANDOFF:57  AR screens «ج.م» · EN screens E£ · foreign keeps its own mark.
 *
 * WHY THIS FILE EXISTS. `currencyShort` («ج.م» / «E£») was added to both
 * locales and then rendered by NOTHING for a day — the app kept printing the
 * long form, and the Owner's phone showed "0 EGP". The check that let it
 * through was a grep for the string in the built bundle: the token WAS in the
 * bundle, sitting in a locale object nobody read. Presence is not use.
 *
 * So every assertion here renders a component and reads the OUTPUT. A token
 * that exists but is never rendered fails, which is the only way this law can
 * be checked honestly.
 */
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOME_CURRENCY } from '../src/state/travel.js';

/**
 * BOTH LANGUAGES, EVERY TIME.
 *
 * The locale is resolved from `localStorage` at module load, so a server-side
 * render with no stub silently speaks Arabic. The defect that prompted this
 * file was seen on an ENGLISH screen ("0 EGP"), and an Arabic-only render would
 * have reported it fixed while English still said EGP. So the whole suite runs
 * twice, against a stubbed `localStorage`, with its own Vite server per
 * language because `LOCALE` is a module-level constant.
 */
const stubLang = (lang) => {
  globalThis.localStorage = {
    getItem: (k) => (k === 'masareef.lang' ? lang : null),
    setItem() {}, removeItem() {}, clear() {},
  };
};

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
let pass = 0;
const failures = [];
const ok = (c, m) => { if (c) pass++; else failures.push(m); };

for (const lang of ['ar', 'en']) {
stubLang(lang);
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const S = (await vite.ssrLoadModule('/src/i18n/strings.js')).S;
  const L = `[${lang}]`;
  const mod = await vite.ssrLoadModule('/src/views/BookView.jsx');
  const BookView = mod.default;
  const day = (over = {}) => ({
    date: '29/8/2026', description: 'S-MARKET VALLILA', method: 'Visa',
    category: 'Groceries', amount: 100, currency: 'EGP', ...over,
  });
  const payload = (entries, totals) => ({
    today_cairo: { y: 2026, m: 8, d: 29 },
    today: { entries, totals },
    week: { cur: { Visa: [1], Cash: [1] }, prev: { Visa: [1], Cash: [1] } },
    month: {
      cur: { Visa: [1], Cash: [1] }, prev: { Visa: [1], Cash: [1] },
      names: { cur: 'August', prev: 'July' },
    },
    year: { cur: { Visa: [1], Cash: [1] }, prev: { Visa: [1], Cash: [1] } },
    monthCats: [], pending: [],
  });
  const render = (p) => renderToStaticMarkup(createElement(BookView, { data: p }));
  const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  // ——— the exact screen from the Owner's report: one foreign row, EGP at zero
  const foreignLead = text(render(payload(
    [day({ amount: 24.04, currency: 'EUR' })], { Visa: 0, Cash: 0 },
  )));
  // ——— an ordinary EGP day
  const homeLead = text(render(payload([day()], { Visa: 100, Cash: 0 })));

  // ─────────────────────────────── A4 · the mark, not the long form
  ok(typeof S.currencyShort === 'string' && S.currencyShort.length > 0,
    `${L} the locale must define currencyShort`);
  ok(homeLead.includes(S.currencyShort),
    `${L} an EGP day must show the mark ${JSON.stringify(S.currencyShort)}; rendered: ${homeLead.slice(0, 120)}`);
  ok(!new RegExp(`\\d[\\s\\u00A0]*${S.currency}\\b`).test(homeLead),
    `${L} the long form ${JSON.stringify(S.currency)} must not sit beside a figure — that is what the mark replaces`);
  ok(foreignLead.includes(S.currencyShort),
    `${L} the aside line must state the home total with its mark, not the code; rendered: ${foreignLead.slice(0, 160)}`);
  ok(!/\d[\s ]*EGP\b/.test(foreignLead),
    `${L} no figure may be followed by the raw ISO code EGP — the home currency has a mark`);

  // negative control: a FOREIGN currency keeps its own code, per HANDOFF:57.
  ok(foreignLead.includes('EUR'),
    `${L} a foreign lead keeps its own code — the mark rule must not be over-applied`);

  // ─────────────────────────────── A5 · no bare amount
  // The Card/Cash metric pair is the site that shipped unitless.
  const metric = new RegExp(`${S.metricVisa}\\s*[\\d.,]+\\s*(?:${S.currencyShort.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')})`);
  ok(metric.test(homeLead),
    `${L} the ${S.metricVisa} total must carry its unit (HANDOFF:56 has no exception clause); rendered: ${homeLead.slice(0, 140)}`);
  const metricCash = new RegExp(`${S.metricCash}\\s*[\\d.,]+\\s*(?:${S.currencyShort.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')})`);
  ok(metricCash.test(homeLead), `${L} the ${S.metricCash} total must carry its unit`);

  // ─────────────────────────────── the aside line is a sentence
  // `travelApart` is authored as a TRAILING modifier ("24.04 EUR — on its own").
  // Reusing it as a LEADING clause leaves the sentence with no subject.
  ok(typeof S.travelApartLead === 'string' && S.travelApartLead.length > 0,
    `${L} a foreign-lead aside needs its own leading string, not the trailing modifier`);
  ok(foreignLead.includes(S.travelApartLead),
    `${L} the foreign-lead aside must use the leading form`);
  ok(!foreignLead.startsWith(S.travelApart),
    `${L} the aside must not open with the trailing modifier — that is the sentence with its subject missing`);

  // ─────────────────────────────── no locale key may be dead
  // This is the check that would have caught `currencyShort` on day one.
  const walk = (d) => readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : (/\.(jsx?|js)$/.test(p) ? [p] : []);
  });
  const code = walk(SRC).filter((p) => !p.includes(`${'i18n'}${'/'}`))
    .map((p) => readFileSync(p, 'utf8')).join('\n');
  // Some keys are reached DYNAMICALLY, e.g. S[`period${Key}`] in BookView. A
  // literal scan cannot see those, so harvest the prefixes and exempt them —
  // otherwise this check reports false positives and gets switched off, which
  // is worse than not having it.
  const prefixes = [...code.matchAll(/S\[`([A-Za-z]+)\$\{/g)].map((m) => m[1]);
  const reachable = (k) => new RegExp(`\\b${k}\\b`).test(code)
    || prefixes.some((p) => k.startsWith(p));

  /**
   * KNOWN DEAD, and left in deliberately rather than deleted. These are strings
   * for states the app does not currently wire up. Removing user-facing copy I
   * did not author is the Owner's call, not a test's. The list is frozen here
   * so the debt is VISIBLE and, more importantly, so no NEW dead key can join
   * it — which is the whole reason this check exists: `currencyShort` sat here
   * for a day while the Owner's phone showed "0 EGP".
   */
  const KNOWN_DEAD = new Set([
    'tabReceipt', 'tabSummary', 'tabRecent', 'inboxOriginal', 'inboxOldOpen',
    'jobRemove', 'receiptQueuedCount', 'receiptStaleTitle', 'receiptStaleBody',
    'receiptReadNow', 'receiptDiscard', 'batchTitle', 'batchNotChosen',
    'todayTitle', 'colDate', 'colDesc', 'colMethod', 'colCategory', 'colAmount',
    'unitWeek', 'unitMonth', 'unitYear', 'recentEdit', 'outboxPending',
  ]);
  const dead = Object.keys(S).filter((k) => !reachable(k) && !KNOWN_DEAD.has(k));
  ok(dead.length === 0,
    `${L} locale keys defined but never rendered — presence is not use: ${dead.join(', ')}`);
  // The allowlist must not rot: a key that comes back to life should leave it.
  const revived = [...KNOWN_DEAD].filter((k) => reachable(k));
  ok(revived.length === 0,
    `${L} these keys are wired up now and should leave KNOWN_DEAD: ${revived.join(', ')}`);
  // positive control: the scan must be able to call something dead.
  ok(!reachable('thisKeyDoesNotExistAnywhere'),
    `${L} the dead-key scan failed its positive control — it would pass vacuously`);
} finally {
  await vite.close();
}
}

const report = failures.length
  ? `❌ ${failures.length} / ${pass + failures.length} unit checks failed:\n  - ${failures.join('\n  - ')}`
  : `✅ all ${pass} unit checks passed`;
console.log(report);
process.exit(failures.length ? 1 : 0);
