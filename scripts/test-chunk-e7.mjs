#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK E7 (+ the book leaf's Sheet-adoption half) ═══════════
 * «When a period's comparison is HONESTLY available, the head leads with the
 *  factual sentence in WORDS («lighter than last week», «heavier than July»)
 *  with the figure beside it — an OBSERVATION, never a judgment. The sentence
 *  stays out of any period whose comparison is refused (foreign money in
 *  either window, missing history) — the mayCompare gates already rule this;
 *  they are CONSUMED, never re-derived. Words earned by the data ONLY:
 *  stage 1 has last-period comparisons, so «than your usual» phrasing is NOT
 *  earned until the typical band (E6) wires into the head — the builder
 *  refuses unearned phrasings TODAY.» (chunk-ledger E7; north-star §6.2:
 *  «we may state ‹lighter than your usual week› as fact; we may never praise,
 *  blame, or advise»; data-F12.)
 *
 * THE SECOND HALF THIS LEAF OWES (Wave-3 residual, ledger «Queued onward»):
 * BookView's advisory surfaces mount B4's Sheet primitive instead of
 * hand-rolled appearance — the month-picker sheet, the whyOpen policy detail,
 * and the undated sand note. Entrance and lip come from the primitive's
 * pinned motion; a second hand-rolled entrance is how the second one drifts
 * (the Rail's own lesson, N2). Pinned here rather than in a new suite because
 * it is this leaf's deliverable and it must be red-first like the rest.
 *
 * WHY RENDERS AND SOURCE PINS BOTH. The refusals (foreign, no history, wrong
 * unit) are SCREEN facts — every function can be right and the screen wrong,
 * which is this project's recurring defect class — so they are rendered. The
 * single-derivation law (one comparisonOf, basis named at the call site) is a
 * source fact a render cannot see. Both locales are swept, one vite server
 * per language (strings.js resolves its locale once at module load).
 *
 * Guarded lookups throughout: a missing key or export is a NAMED failure,
 * never «is not a function» killing the run (the N1/N1b lesson).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { TYPE, RADIUS, C } from '../src/theme.js';
import { AR } from '../src/i18n/strings.ar.js';
import { EN } from '../src/i18n/strings.en.js';

const MARKER = 'CHUNK-E7-GREEN';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(root, p), 'utf8');

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };
const text = (html) => html.replace(/<style>[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

// ═══ 1. i18n — the headline words, BOTH locales, and the NO-NAGGING review ═══
/**
 * WHAT IS BANNED, by name. The law (north-star §6.2) is that the head may
 * STATE and may never praise, blame, advise or count streaks. So the review
 * bans: praise words, blame words, imperative coaching, streak vocabulary,
 * exclamation, and DIGITS — a «word-first» sentence that smuggles a figure in
 * is the old headline wearing the new clothes.
 */
const NAG_AR = ['برافو', 'ممتاز', 'شاطر', 'كويس', 'وحش', 'حرام', 'لازم', 'حاول',
  'خليك', 'استمر', 'بطّل', 'اصرف', 'وفّر', 'كتير أوي', 'سلسلة'];
const NAG_EN = /\b(great|well done|good|bad|nice|careful|warning|should|try|keep it up|too much|congrats|oops|sorry|streak|on track|off track)\b/i;
const UNEARNED_AR = /المعتاد|معتادك|زي العادة/;
const UNEARNED_EN = /usual|typical/i;

for (const [name, L] of [['ar', AR], ['en', EN]]) {
  const prev = name === 'ar' ? 'يوليو' : 'July';
  for (const key of ['headLighter', 'headHeavier']) {
    const fn = L[key];
    ok(typeof fn === 'function' && fn.length === 1,
      `E7.1 ${name}.${key} exists as a (prev) template — the head has words to lead with`);
    if (typeof fn !== 'function') continue;
    const out = fn(prev);
    ok(typeof out === 'string' && out.includes(prev),
      `E7.2 ${name}.${key}(${prev}) names the period it observes against — got ${JSON.stringify(out)}`);
    ok(typeof out === 'string' && !/[0-9٠-٩%]/.test(out),
      `E7.3 ${name}.${key} is WORDS — no digit, no percent; the figure stands beside the sentence, never inside it`);
  }
  // The three sentences the head can lead with, reviewed against NO-NAGGING.
  const outputs = ['headLighter', 'headHeavier', 'sameAs']
    .map((k) => (typeof L[k] === 'function' ? L[k](prev) : null))
    .filter((s) => typeof s === 'string');
  ok(outputs.length === 3 && outputs.every((s) => !s.includes('!') && !s.includes('⚠')
    && (name === 'ar' ? !NAG_AR.some((w) => s.includes(w)) : !NAG_EN.test(s))),
    `E7.4 ${name} headline sentences pass the NO-NAGGING review — observation vocabulary only, no praise/blame/coaching/streaks — got ${JSON.stringify(outputs)}`);
  ok(outputs.length === 3 && outputs.every((s) => (name === 'ar' ? !UNEARNED_AR.test(s) : !UNEARNED_EN.test(s))),
    `E7.5 ${name} states nothing «than your usual» — that phrasing is unearned until the typical band (E6) wires into the head`);
}

/** Render the Book's period surfaces under one locale, in the sweep pattern. */
async function sweep(lang, L, monthNameOf) {
  globalThis.localStorage = { getItem: () => lang, setItem() {} };
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  try {
    const mod = await vite.ssrLoadModule('/src/views/BookView.jsx');
    const { PeriodBlock, MonthScreen, MonthSheet, headlineWords } = mod;
    const names = { cur: L.thisWeek, prev: L.lastWeek };
    const week = (over = {}) => ({
      cur: { Visa: [50, null], Cash: [0, null] },
      prev: { Visa: [100, 100], Cash: [0, 0] },
      ...over,
    });
    const pbHtml = (data, extra = {}) => {
      try {
        return renderToStaticMarkup(createElement(PeriodBlock, { data, names, ...extra }));
      } catch (err) {
        failures.push(`[${lang}] PeriodBlock THREW while rendering — ${err && err.message}`);
        return '';
      }
    };
    const heroOf = (html) => {
      const m = html.match(new RegExp(`font-size:${TYPE.hero}px[^"]*"[^>]*>([^<]*)<`));
      return m ? m[1] : null;
    };
    const lighter = typeof L.headLighter === 'function' ? L.headLighter(L.lastWeek) : null;
    const heavier = typeof L.headHeavier === 'function' ? L.headHeavier(L.lastWeek) : null;
    const same = typeof L.sameAs === 'function' ? L.sameAs(L.lastWeek) : null;

    // ═══ 2. the BUILDER — words earned by the data only, basis named ═══
    if (typeof headlineWords !== 'function') {
      failures.push(`[${lang}] E7.6 headlineWords is not exported from BookView — the sentence has no single builder the band case can slot into`);
    } else {
      ok(headlineWords('down', L.lastWeek, 'last') === lighter,
        `E7.6 [${lang}] down against last period builds the LIGHTER observation`);
      ok(headlineWords('up', L.lastWeek, 'last') === heavier,
        `E7.7 [${lang}] up builds the HEAVIER observation — information, not sin`);
      ok(headlineWords('same', L.lastWeek, 'last') === same,
        `E7.8 [${lang}] same builds the same-as sentence — one vocabulary, no second copy`);
      ok(headlineWords('down', L.lastWeek, 'typical') === null,
        `E7.9 [${lang}] the 'typical' basis is REFUSED today — «than your usual» is not earned until E6's band wires into the head`);
      ok(headlineWords('down', L.lastWeek) === null,
        `E7.10 [${lang}] an UNNAMED basis is refused — the call site must state what earned the words`);
      ok(headlineWords('sideways', L.lastWeek, 'last') === null,
        `E7.11 [${lang}] an unknown direction builds nothing — no confident sentence about a comparison that has no shape`);
    }

    // ═══ 3. the RENDERED head — word-first where earned, silent where refused ═══
    const downHtml = pbHtml(week());                       // 50 vs 100 → down
    const downText = text(downHtml);
    ok(!!lighter && downText.includes(lighter),
      `E7.12 [${lang}] a lighter week LEADS WITH THE WORDS — «${lighter}» is on the screen`);
    ok(!!lighter && downText.indexOf(lighter) !== -1
      && downText.indexOf(lighter) < downText.indexOf('50'),
      `E7.13 [${lang}] …and the words come BEFORE the figure — word-first, the figure beside it`);
    ok(heroOf(downHtml) === '50',
      `E7.14 [${lang}] the figure is still the hero (TYPE.hero) — the words lead it, they do not replace it`);
    ok(downText.includes('%'),
      `E7.15 [${lang}] the arithmetic detail keeps its percentage below — the observation adds words, it deletes no fact`);

    const upText = text(pbHtml(week({ cur: { Visa: [300, null], Cash: [0, null] } })));
    ok(!!heavier && upText.includes(heavier),
      `E7.16 [${lang}] a heavier week says so in the same grammar — stated, never colored, never scolded`);

    const sameText = text(pbHtml(week({ cur: { Visa: [100, null], Cash: [0, null] } })));
    ok(!!same && sameText.split(same).length - 1 === 1,
      `E7.17 [${lang}] an identical week states «${same}» EXACTLY ONCE — led with, not repeated below`);

    // ——— the refusals: the words ride the SAME gates as the percentage
    const foreignText = text(pbHtml(week({ foreign: { count: 2, byCurrency: { EUR: 80 } } })));
    ok(!!lighter && !foreignText.includes(lighter) && !!heavier && !foreignText.includes(heavier),
      `E7.18 [${lang}] a week with foreign money gets NO headline words — an EGP-subset observation is the ▼100% lie in prose`);
    const prevForeignText = text(pbHtml(week({ prevForeign: { count: 1, byCurrency: { EUR: 90 } } })));
    ok(!!lighter && !prevForeignText.includes(lighter),
      `E7.19 [${lang}] …and neither does one compared AGAINST a foreign period — the base is a subset either way`);
    const eurLedText = text(pbHtml(week({ foreign: { count: 2, byCurrency: { EUR: 80 } } }), { displayCurrency: 'EUR' }));
    ok(!!lighter && !eurLedText.includes(lighter) && !!heavier && !eurLedText.includes(heavier),
      `E7.20 [${lang}] a EUR-led head has no words either — there is no euro history for them to observe against`);
    const noHistoryText = text(pbHtml(week({ prev: { Visa: [null, null], Cash: [null, null] } })));
    ok(!!lighter && !noHistoryText.includes(lighter) && !!same && !noHistoryText.includes(same),
      `E7.21 [${lang}] missing history is silence — absent is not zero, and no sentence is built on it`);

    // ——— the month path: the words lead the month's head too
    const series = (days, fill, total) => Array.from({ length: total }, (_, i) => (i < days ? fill : null));
    const monthHtml = (() => {
      try {
        return renderToStaticMarkup(createElement(MonthScreen, {
          data: {
            month: {
              cur: { Visa: series(24, 10, 31), Cash: series(24, 0, 31) },
              prev: { Visa: series(31, 20, 31), Cash: series(31, 0, 31) },
              names: { cur: 'August', prev: 'July' },
              undated: { count: 0, Visa: 0, Cash: 0 }, unpriced: { count: 0 },
              uncategorized: { count: 0, total: 0 }, prevLog: null,
            },
            monthCats: [],
          },
          metric: 'all', setMetric: () => {}, onGoToInbox: () => {},
        }));
      } catch (err) {
        failures.push(`[${lang}] MonthScreen THREW while rendering — ${err && err.message}`);
        return '';
      }
    })();
    const july = monthNameOf('July');
    const monthLighter = typeof L.headLighter === 'function' ? L.headLighter(july) : null;
    const monthLess = typeof L.lessThan === 'function' ? L.lessThan(july) : null;
    ok(!!monthLighter && text(monthHtml).includes(monthLighter),
      `E7.22 [${lang}] a lighter month leads with «${monthLighter}» — the observation names the month it is against`);
    ok(!!monthLess && text(monthHtml).includes(monthLess),
      `E7.23 [${lang}] …and the month's percentage sentence stays beneath it — N6/E3's pinned arithmetic is untouched`);

    // ═══ 4. SHEET ADOPTION — the renders (this locale's server, same modules) ═══
    if (lang === 'ar') {
      // ——— the month-picker sheet rides the primitive
      const sheetHtml = (() => {
        try {
          return renderToStaticMarkup(createElement(MonthSheet, {
            today: { y: 2026, m: 8, d: 17 }, browsing: null, onChoose: () => {}, onClose: () => {},
          }));
        } catch (err) {
          failures.push('MonthSheet THREW while rendering — ' + (err && err.message));
          return '';
        }
      })();
      ok(sheetHtml.includes('class="sheet-in"'),
        'E7.24 the month picker ARRIVES as B4\'s sheet — class="sheet-in", the one pinned entrance, never a second hand-rolled one');
      ok(sheetHtml.includes('prefers-reduced-motion'),
        'E7.25 …and the reduced-motion guard ships WITH it — the primitive\'s own <style> rides the markup');
      ok(sheetHtml.includes(`border-radius:${RADIUS.sheet}px ${RADIUS.sheet}px 0 0`),
        'E7.26 the bottom-sheet SILHOUETTE stands — lipped at RADIUS.sheet on top, flush at the screen edge (N6\'s pinned shape, kept)');
      const settledSheet = sheetHtml.replace(/<style>[\s\S]*?<\/style>/g, '');
      ok(settledSheet.includes('translateY') === false && !/opacity:\s*0[;"}]/.test(settledSheet),
        'E7.27 the static render is the SETTLED sheet — the rise lives only in the keyframes (B4\'s collapse-safety law, on this consumer)');

      // ——— the policy detail is a sand advisory sheet, one tap away
      const openedHtml = pbHtml(week({ foreign: { count: 2, byCurrency: { EUR: 80 } } }), { policyOpen: true });
      ok(openedHtml.includes('class="sheet-in"'),
        'E7.28 the opened policy detail arrives as the same sheet — the advisory surface\'s one entrance');
      ok(openedHtml.includes(AR.foreignNoCompare),
        'E7.29 …carrying the full sentence the compressed line promised (A7\'s tap, honored on the new surface)');
      const sheetStyles = [...openedHtml.matchAll(/class="sheet-in" style="([^"]*)"/g)].map((m) => m[1]);
      ok(sheetStyles.some((s) => s.toUpperCase().includes(C.sand.toUpperCase()) && s.includes('1px solid')),
        'E7.30 the detail dresses as what it is — a SAND advisory surface, bordered by name (theme.js\'s C.line doctrine: the foreign-money notes)');

      // ——— nothing else fell out of the opened screen
      ok(!/[▲▼]/.test(text(openedHtml)),
        'E7.31 opening the detail added words, not verdicts — still no percentage marker anywhere on a foreign week');
    }
    return true;
  } finally {
    await vite.close();
    delete globalThis.localStorage;
  }
}

await sweep('ar', AR, (n) => ({ July: 'يوليو' }[n] || n));
await sweep('en', EN, (n) => n);

// ═══ 5. SOURCE — one derivation, a named basis, no second entrance ═══
{
  const view = src('src/views/BookView.jsx');
  ok(/headlineWords\(cmp\.direction, names\.prev, 'last'\)/.test(view),
    'E7.32 the call site NAMES its basis — \'last\' is the only comparison stage 1 has earned, stated where it is spent');
  const block = view.slice(view.indexOf('export function PeriodBlock'),
    view.indexOf('export function MonthScreen'));
  ok((block.match(/comparisonOf\(/g) || []).length === 1,
    'E7.33 the words and the percentage ride ONE comparisonOf — the mayCompare-gated one; a second derivation is how they drift apart');
  ok(/import \{[^}]*\bSheet\b[^}]*\} from '\.\.\/components\/Primitives\.jsx'/.test(view),
    'E7.34 BookView imports the Sheet primitive — the adoption is a consumption, not a copy');
  ok(!/@keyframes|animation:/.test(view),
    'E7.35 …and hand-rolls NO entrance of its own — B4\'s motion is the only way a surface arrives here');
  ok(/\{undated > 0 && !loadingRows && period !== 'year' && \(\s*<Sheet/.test(view),
    'E7.36 the undated sand note mounts the Sheet — the third advisory surface, same primitive as the other two');
  ok(/\{policySuppressed && whyOpen && \(\s*<Sheet/.test(view),
    'E7.37 the whyOpen policy detail mounts the Sheet — it ARRIVES on his tap, so it arrives the pinned way');
}

if (failures.length) {
  console.log(`❌ CHUNK E7 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · the head leads with the earned observation in words; advisory surfaces arrive as B4 sheets`);
