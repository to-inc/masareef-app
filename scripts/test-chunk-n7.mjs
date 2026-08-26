#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK N7 ═══════════
 * «Priorities filter chips over the Book list: icon+word, 48pt targets,
 *  filtering rows by priority group (the ratified src/lib/priorities.js map,
 *  CONSUMED); counts IN WORDS; an emptied filter states itself honestly
 *  («History: 0» style, both locales) — an empty list is a sentence, never a
 *  blank.» (chunk-ledger N7; north-star §4.5 «priorities become navigation»;
 *  GAP 4 / data-F11 / Phase E.)
 *
 * WHY THE FILTER IS DRIVEN BY A SEEDED PROP. The chips sit on the Book's own
 * screen and SSR cannot tap, so the render is seeded through
 * `initialPriorityFilter` — the same pattern as PeriodBlock's `policyOpen` and
 * for the same reason: what is asserted is the SCREEN in each state, not the
 * event plumbing, and the chip's own aria-pressed ties the two together.
 *
 * THE HONESTY EDGES PINNED HERE, because each is a lie waiting to ship:
 *  · a ❓ row belongs to NO group — a filter must drop it, not adopt it;
 *  · the lookalike detector examines the rows ON SCREEN, so a filter that
 *    hides a pair must silence the card that describes them;
 *  · an emptied filter is a SENTENCE naming its own zero, never the generic
 *    «no expenses» (which would claim the period is empty — it is not).
 *
 * Guarded lookups throughout: a missing key is a NAMED failure, not a crash.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { TAP } from '../src/theme.js';
import { AR } from '../src/i18n/strings.ar.js';
import { EN } from '../src/i18n/strings.en.js';
import { PRIORITY_GROUPS } from '../src/lib/priorities.js';

const MARKER = 'CHUNK-N7-GREEN';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(root, p), 'utf8');

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };
const eq = (a, b, label) => ok(Object.is(a, b), `${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

// ═══ 1. i18n — counts in words and the honest zero, BOTH locales ═══
for (const [name, L] of [['ar', AR], ['en', EN]]) {
  const count = L.priorityCount;
  ok(typeof count === 'function' && count.length === 2,
    `N7.1 ${name}.priorityCount exists as an (n, group) template — the count is a sentence, not a badge`);
  if (typeof count === 'function') {
    const three = count(3, 'X');
    ok(typeof three === 'string' && three.includes('3') && three.includes('X'),
      `N7.2 ${name}.priorityCount(3, X) carries the figure AND the group IN WORDS — got ${JSON.stringify(three)}`);
    ok(count(1, 'X') !== three.replace('3', '1'),
      `N7.3 ${name}.priorityCount speaks singular and plural — its siblings all do, and he reads this line`);
  }
  const empty = L.priorityEmpty;
  ok(typeof empty === 'function' && empty.length === 1,
    `N7.4 ${name}.priorityEmpty exists — an emptied filter has a sentence of its own`);
  if (typeof empty === 'function') {
    const z = empty('X');
    ok(typeof z === 'string' && /:\s*0/.test(z) && z.includes('X'),
      `N7.5 ${name}.priorityEmpty is «History: 0»-style — the group's own name beside its honest zero, got ${JSON.stringify(z)}`);
  }
}

// ═══ 2. SOURCE — the map is CONSUMED, the rail is the shared Rail ═══
{
  const view = src('src/views/BookView.jsx');
  ok(/import \{[^}]*PRIORITY_GROUPS[^}]*\} from '\.\.\/lib\/priorities\.js'/.test(view),
    'N7.6 the chips ride the ratified priorities map — consumed from lib/priorities.js, never a second copy');
  ok(/\bgroupOf\(/.test(view),
    'N7.7 the filter asks groupOf — one definition of which group a category is in');
  ok(/PRIORITY_ICONS/.test(view),
    'N7.8 each group has a declared icon — icon PLUS word, never icon-only and never word-only');
}

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const mod = await vite.ssrLoadModule('/src/views/BookView.jsx');
  const BookView = mod.default;
  const { PRIORITY_ICONS } = mod;

  if (PRIORITY_ICONS && typeof PRIORITY_ICONS === 'object') {
    for (const g of PRIORITY_GROUPS) {
      ok(typeof PRIORITY_ICONS[g.key] === 'string' && PRIORITY_ICONS[g.key].length > 0,
        `N7.9 the ${g.key} chip has an icon`);
    }
  } else {
    failures.push('N7.9 PRIORITY_ICONS is not exported — the chips have no icons to wear');
  }

  const day = (over = {}) => ({
    date: '17/8/2026', description: 'Nile Star Market', method: 'Visa',
    category: 'Groceries', amount: 100, currency: 'EGP', ...over,
  });
  const payload = (entries, totals) => ({
    today_cairo: { y: 2026, m: 8, d: 17 },
    today: { entries, totals },
    week: { cur: { Visa: [1], Cash: [1] }, prev: { Visa: [1], Cash: [1] } },
    month: { cur: { Visa: [1], Cash: [1] }, prev: { Visa: [1], Cash: [1] }, names: { cur: 'August', prev: 'July' } },
    year: { cur: { Visa: [1], Cash: [1] }, prev: { Visa: [1], Cash: [1] } },
    monthCats: [], pending: [],
  });
  const mixed = [
    day(),                                                                    // essentials
    day({ description: 'Pharmacy Dawa', category: 'Medical', amount: 50 }),   // health
    day({ description: 'Harbour Cafe', category: 'Eating out', amount: 30 }), // joy
    day({ description: 'Mystery', category: '❓', amount: 20 }),              // no group yet
  ];
  const render = (entries, totals, filter) => renderToStaticMarkup(
    createElement(BookView, { data: payload(entries, totals), initialPriorityFilter: filter }),
  );

  // ——— the chips exist: icon+word, 48pt, over the list
  const plain = render(mixed, { Visa: 180, Cash: 0 });
  const chipRe = (label) => new RegExp(`<button[^>]*aria-pressed="(true|false)"[^>]*style="([^"]*)"[^>]*>(?:<span[^>]*>([^<]*)</span>)?\\s*${label}<`);
  for (const g of PRIORITY_GROUPS) {
    const label = typeof AR.lensGroup === 'function' ? AR.lensGroup(g.key) : null;
    const m = label ? plain.match(chipRe(label)) : null;
    ok(!!m, `N7.10 the ${g.key} chip renders over the Book list, wearing its word («${label}»)`);
    if (m) {
      ok(m[2].includes(`min-height:${TAP}px`),
        `N7.11 …at the ${TAP}pt senior floor`);
      ok(!!m[3] && m[3].trim().length > 0,
        'N7.12 …with its icon beside the word — never word-only');
      eq(m[1], 'false', 'N7.13 …and unpressed while no filter is chosen');
    }
  }
  const tPlain = text(plain);
  ok(tPlain.includes('Pharmacy Dawa') && tPlain.includes('Harbour Cafe') && tPlain.includes('Nile Star Market'),
    'N7.14 with no filter, every row is on screen — the chips add a lens, they take nothing away');
  {
    const label = typeof AR.lensGroup === 'function' ? AR.lensGroup('essentials') : '';
    const worded = typeof AR.priorityCount === 'function' ? AR.priorityCount(1, label) : null;
    ok(worded === null || !tPlain.includes(worded),
      'N7.15 …and no count line renders — a count of an unfiltered list restates the list');
  }

  // ——— a chosen filter: only its group's rows, the chip pressed, count in words
  const filtered = render(mixed, { Visa: 180, Cash: 0 }, 'essentials');
  const tF = text(filtered);
  ok(tF.includes('Nile Star Market'), 'N7.16 the essentials row survives its own filter');
  ok(!tF.includes('Pharmacy Dawa') && !tF.includes('Harbour Cafe'),
    'N7.17 the other groups\' rows are filtered out — the chips actually FILTER');
  ok(typeof AR.rowNeedsCategory !== 'string' || !tF.includes(AR.rowNeedsCategory),
    'N7.18 a ❓ row belongs to NO group — a filter may not adopt money nobody has placed');
  {
    const label = typeof AR.lensGroup === 'function' ? AR.lensGroup('essentials') : '';
    const m = filtered.match(chipRe(label));
    ok(!!m && m[1] === 'true', 'N7.19 the chosen chip says so — aria-pressed tracks the filter');
    const worded = typeof AR.priorityCount === 'function' ? AR.priorityCount(1, label) : null;
    ok(!!worded && tF.includes(worded),
      `N7.20 the count is stated IN WORDS — expected «${worded}» on the screen`);
  }

  // ——— the emptied filter: «History: 0», never a blank, never the generic empty
  const emptied = render(mixed, { Visa: 180, Cash: 0 }, 'projects');
  const tE = text(emptied);
  {
    const label = typeof AR.lensGroup === 'function' ? AR.lensGroup('projects') : '';
    const zero = typeof AR.priorityEmpty === 'function' ? AR.priorityEmpty(label) : null;
    ok(!!zero && tE.includes(zero),
      `N7.21 an emptied filter states itself — expected «${zero}», an empty list is a sentence`);
    ok(!tE.includes(AR.recentEmpty) && !tE.includes(AR.todayEmptyBody),
      'N7.22 …and NOT the generic empty state, which would claim the period itself is empty (it is not)');
    ok(!tE.includes('Nile Star Market') && !tE.includes('Pharmacy Dawa'),
      'N7.23 …and no rows, because zero means zero');
  }

  // ——— the lookalike card describes the rows ON SCREEN, so a filter scopes it
  const dupes = [
    day({ description: 'Harbour Cafe', category: 'Eating out', amount: 30 }),
    day({ description: 'Harbour Cafe', category: 'Eating out', amount: 30 }),
    day(),
  ];
  const dupesVisible = render(dupes, { Visa: 160, Cash: 0 }, 'joy');
  const dupesHidden = render(dupes, { Visa: 160, Cash: 0 }, 'essentials');
  const dupTitle = typeof AR.dupTitle === 'function' ? AR.dupTitle(2).slice(0, 10) : null;
  ok(!!dupTitle && text(dupesVisible).includes(dupTitle),
    'N7.24 filtering INTO the pair keeps the lookalike card — the rows it describes are on screen');
  ok(!!dupTitle && !text(dupesHidden).includes(dupTitle),
    'N7.25 filtering AWAY from the pair silences it — the card may never describe rows he cannot see');

  // ——— the empty PERIOD stays the ordinary empty state — chips claim nothing
  const bare = render([], { Visa: 0, Cash: 0 });
  ok(!new RegExp(`aria-pressed="false"[^>]*>(?:<span[^>]*>[^<]*</span>)?\\s*${typeof AR.lensGroup === 'function' ? AR.lensGroup('joy') : ''}<`).test(bare),
    'N7.26 a period with no rows shows no chips — four filters over nothing is furniture claiming a job');
  ok(text(bare).includes(AR.todayEmptyBody),
    'N7.27 …and keeps its own honest empty words');
} finally {
  await vite.close();
}

if (failures.length) {
  console.log(`❌ CHUNK N7 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · priority chips filter the Book list: icon+word at 48pt, counts in words, an emptied filter states its zero`);
