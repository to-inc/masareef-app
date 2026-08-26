#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK E3 ═══════════
 * «Honest window words under a partial-month comparison: «days 1–24 vs July
 *  1–24»-style, both locales, ONLY when the window is genuinely partial — a
 *  complete month states no window qualifier.» (chunk-ledger E3; north-star
 *  §4.4 «label in words: days 1–24 vs July 1–24»; data-F10.)
 *
 * WHY THIS EXISTS. The month's one sentence is a SAME-POINT comparison
 * (`prevAt` is July at the same day, not July's total) and until now that fact
 * lived only in the arithmetic. «أقل من يوليو بـ12%» over a 24-day August reads
 * as August-vs-all-of-July to anyone who has not read series.js — a true
 * figure under a wrong subject, which is the «This week 0» defect's gentler
 * cousin. The words state the window; the window is already what the maths
 * uses; the two derive from the SAME arrays so they cannot drift.
 *
 * THE THREE WINDOW SHAPES, each pinned:
 *   partial cur, prev clipped at the same day   → «days 1–24 vs July 1–24»
 *   partial cur, WHOLE shorter prev (Feb case)  → «days 1–30 vs all of February»
 *   whole cur vs whole prev                     → NO qualifier (nothing partial)
 * And the whole-June-vs-May clamp (30 vs 31 days) is the FIRST shape again:
 * the comparison base really is May 1–30, and the words say so.
 *
 * Both locales are rendered — one vite server per language, the honest-render
 * sweep's own pattern, because `strings.js` resolves its locale once at module
 * load. Guarded lookups throughout: a missing key is a NAMED failure.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { AR } from '../src/i18n/strings.ar.js';
import { EN } from '../src/i18n/strings.en.js';

const MARKER = 'CHUNK-E3-GREEN';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(root, p), 'utf8');

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

// ═══ 1. i18n — the two window templates, BOTH locales, guarded ═══
for (const [name, L] of [['ar', AR], ['en', EN]]) {
  for (const key of ['windowWords', 'windowWordsWholePrev']) {
    const fn = L[key];
    ok(typeof fn === 'function' && fn.length === 2,
      `E3.1 ${name}.${key} exists as a (days, prev) template`);
    if (typeof fn !== 'function') continue;
    const out = fn(24, name === 'ar' ? 'يوليو' : 'July');
    ok(typeof out === 'string' && out.includes('24') && out.includes(name === 'ar' ? 'يوليو' : 'July'),
      `E3.2 ${name}.${key}(24, July) names the day count AND the month — got ${JSON.stringify(out)}`);
  }
  if (typeof L.windowWords === 'function') {
    const both = L.windowWords(24, 'X');
    ok((both.match(/24/g) || []).length >= 2,
      `E3.3 ${name}.windowWords states BOTH windows — days 1–24 on each side, got ${JSON.stringify(both)}`);
  }
}

// ═══ 2. SOURCE — the words derive where the maths does, and only the month asks ═══
{
  const view = src('src/views/BookView.jsx');
  ok(/import \{[^}]*lastIdxOf[^}]*\} from '\.\.\/lib\/series\.js'/.test(view)
    || /import \{[^}]*seriesFor[^}]*\} from '\.\.\/lib\/series\.js'/.test(view),
    'E3.4 the window is read from the SAME series arithmetic periodTotals uses — one derivation, no drift');
  const pbCalls = view.match(/<PeriodBlock[\s\S]*?\/>/g) || [];
  ok(pbCalls.filter((c) => /monthWindow/.test(c)).length === 1,
    'E3.5 exactly ONE PeriodBlock call asks for window words — the Month\'s; a week\'s sentence is not day-windowed prose');
}

/** Render the Month screen under one locale, in the sweep pattern. */
async function sweep(lang, L, monthNameOf) {
  globalThis.localStorage = { getItem: () => lang, setItem() {} };
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  try {
    const { MonthScreen } = await vite.ssrLoadModule('/src/views/BookView.jsx');
    const monthData = (cur, prev, names, extra = {}) => ({
      month: {
        cur, prev, names,
        undated: { count: 0, Visa: 0, Cash: 0 }, unpriced: { count: 0 },
        uncategorized: { count: 0, total: 0 }, prevLog: null, ...extra,
      },
      monthCats: [],
    });
    const render = (d) => text(renderToStaticMarkup(createElement(MonthScreen, {
      data: d, metric: 'all', setMetric: () => {}, onGoToInbox: () => {},
    })));
    const series = (days, fill, total) => Array.from({ length: total }, (_, i) => (i < days ? fill : null));

    const AUG = { cur: 'August', prev: 'July' };
    const julyName = monthNameOf('July');

    // ——— the live partial month: days 1–24 vs July 1–24
    const partial = render(monthData(
      { Visa: series(24, 10, 31), Cash: series(24, 0, 31) },
      { Visa: series(31, 20, 31), Cash: series(31, 0, 31) },
      AUG,
    ));
    const words24 = typeof L.windowWords === 'function' ? L.windowWords(24, julyName) : null;
    ok(!!words24 && partial.includes(words24),
      `E3.6 [${lang}] a 24-day August says «${words24}» under its sentence — the window the maths used, in words`);

    // ——— the complete month: NO qualifier — nothing about it is partial
    const complete = render(monthData(
      { Visa: series(31, 10, 31), Cash: series(31, 0, 31) },
      { Visa: series(31, 20, 31), Cash: series(31, 0, 31) },
      AUG,
    ));
    const words31 = typeof L.windowWords === 'function' ? L.windowWords(31, julyName) : null;
    const whole31 = typeof L.windowWordsWholePrev === 'function' ? L.windowWordsWholePrev(31, julyName) : null;
    ok(!!words31 && !complete.includes(words31) && !!whole31 && !complete.includes(whole31),
      `E3.7 [${lang}] a COMPLETE month against a same-length month states no window qualifier — whole against whole needs no words`);
    ok(complete.includes('50'),
      `E3.8 [${lang}] …and its comparison sentence still renders — down 50%, words gone, figure kept`);

    // ——— the Feb clamp: partial cur against a WHOLE shorter prev
    const febName = monthNameOf('February');
    const febCase = render(monthData(
      { Visa: series(30, 10, 31), Cash: series(30, 0, 31) },
      { Visa: series(28, 20, 28), Cash: series(28, 0, 28) },
      { cur: 'March', prev: 'February' },
    ));
    const wholeFeb = typeof L.windowWordsWholePrev === 'function' ? L.windowWordsWholePrev(30, febName) : null;
    ok(!!wholeFeb && febCase.includes(wholeFeb),
      `E3.9 [${lang}] day 30 of March against all 28 of February says «${wholeFeb}» — never «February 1–30», days February does not have`);

    // ——— no comparison, no qualifier: the words describe a sentence that exists
    const noPrev = render(monthData(
      { Visa: series(24, 10, 31), Cash: series(24, 0, 31) },
      { Visa: series(31, 0, 31), Cash: series(31, 0, 31) },
      AUG,
    ));
    ok(!!words24 && !noPrev.includes(words24),
      `E3.10 [${lang}] with nothing honest to compare against (a zero July), there is no window line — a qualifier of no sentence`);

    // ——— a foreign month suppresses its comparison, and the window words with it
    const foreign = render(monthData(
      { Visa: series(24, 10, 31), Cash: series(24, 0, 31) },
      { Visa: series(31, 20, 31), Cash: series(31, 0, 31) },
      AUG,
      { foreign: { count: 2, byCurrency: { EUR: 80 } } },
    ));
    ok(!!words24 && !foreign.includes(words24),
      `E3.11 [${lang}] a suppressed comparison carries no window words — they qualify the percentage, and there is none`);
  } finally {
    await vite.close();
    delete globalThis.localStorage;
  }
}

await sweep('ar', AR, (n) => ({ July: 'يوليو', February: 'فبراير' }[n] || n));
await sweep('en', EN, (n) => n);

if (failures.length) {
  console.log(`❌ CHUNK E3 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · the month's sentence names its window — days 1–24 vs July 1–24, and only where the window is real`);
