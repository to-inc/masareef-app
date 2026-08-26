#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK E4 ═══════════   `node scripts/test-chunk-e4.mjs`
 *
 * «Lens tiles become chart controllers (selected tile fills harbor → chart
 *  re-renders per that group's categories); tap again to release. The four
 *  no-delta pins are RE-CUT, never deleted.» (chunk ledger E4 — data-F9,
 *  NS §7E's standing warning; north-star §4.5.)
 *
 * THE SHAPE. The Priorities lens's four group rows become TILES — genuine
 * controls at the senior floor, aria-pressed, the selected one filled harbor —
 * and the chart they control is `CategoryCompare` directly below the lens on
 * the Month screen: selected, it re-renders showing ONLY that group's
 * categories, named for what it now is, and it stops claiming the month
 * (no «إجمالي الشهر» line over a subset, no ❓ money adopted into a group it
 * belongs to none of). Released, everything returns exactly as it was.
 *
 * THE WIRING is a store module-local to Charts.jsx (the lens and the chart
 * are siblings mounted by MonthScreen, which is not this chunk's file), with
 * SSR seams (`selectedGroup` / `group` props) because a static render cannot
 * tap. The lens clears the selection when its panel closes and when it
 * unmounts — a scoped chart with no visible pressed controller would be a
 * filtered list passing for a whole one.
 *
 * THE LAWS THAT SURVIVE, asserted here as renders (the re-cut source pins
 * live in test-priorities.mjs): the lens's own figures still state and never
 * advise — no delta, no percentage, no ranking on the tiles — while the
 * CONTROLLED chart below keeps its own lawful comparison grammar.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';

const MARKER = 'CHUNK-E4-GREEN';

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };

/** Comment stripper (the construction test-chunk-a6 proved). */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

// ——— control: the stripper proves itself first.
ok(!stripComments('/* aria-pressed */ x()').includes('aria-pressed')
  && stripComments('/* c */ x()').includes('x()'),
  'control — the stripper removes comments and keeps code');

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { PriorityLens, CategoryCompare } = await vite.ssrLoadModule('/src/components/Charts.jsx');
  const { C, TAP } = await vite.ssrLoadModule('/src/theme.js');
  const { S, categoryLabel } = await vite.ssrLoadModule('/src/i18n/strings.js');
  const { moneyRound } = await vite.ssrLoadModule('/src/lib/format.js');

  /**
   * The month fixture spans all four groups plus the deliberate unplaced one —
   * amounts invented per the standing fixture rule, distinct so every sum is
   * traceable.
   */
  const CATS = [
    { name: 'Groceries', now: 5210, prev: 6480 },   // essentials
    { name: 'Eating out', now: 6840, prev: 9120 },  // joy
    { name: 'Donations', now: 2100, prev: 4500 },   // joy (his amended ruling)
    { name: 'Medical', now: 1200, prev: 0 },        // health
    { name: 'Personal expenses', now: 900, prev: 900 }, // unplaced on purpose
  ];
  const UNCAT = { count: 2, total: 750 };

  const lens = (props) => {
    try {
      return renderToStaticMarkup(createElement(PriorityLens, {
        cats: CATS, uncategorized: UNCAT, open: true, onToggle: () => {}, ...props,
      }));
    } catch (err) {
      failures.push(`PriorityLens THREW — ${err && err.message}`);
      return '';
    }
  };
  const compare = (props) => {
    try {
      return renderToStaticMarkup(createElement(CategoryCompare, {
        cats: CATS, curName: 'أغسطس', prevName: 'يوليو',
        uncategorized: UNCAT, total: 17000, onUncategorized: () => {}, ...props,
      }));
    } catch (err) {
      failures.push(`CategoryCompare THREW — ${err && err.message}`);
      return '';
    }
  };
  const pressed = (html) => (html.match(/aria-pressed="(?:true|false)"/g) || []).length;
  const pressedTrue = (html) => (html.match(/aria-pressed="true"/g) || []).length;

  /**
   * ——— (a) THE TILES ARE CONTROLS. Four of them, always four (the fixed
   * frame is the lens's whole claim), each stating its word and its figure,
   * at the senior tap floor.
   */
  const idle = lens({});
  // The lens header itself is a control (aria-expanded), so tile buttons are
  // counted by their aria-pressed, which only controls-that-select carry.
  ok(pressed(idle) === 4, `E4.1 the four group tiles are genuine controls (aria-pressed) — found ${pressed(idle)}`);
  ok(pressedTrue(idle) === 0, 'E4.2 nothing pressed while nothing is selected');
  ok(!idle.toUpperCase().includes(C.harbor.toUpperCase()),
    'E4.3 …and no harbor fill at rest — the fill IS the selected state');
  for (const [key, figure] of [['essentials', 5210], ['health', 1200], ['joy', 8940], ['projects', 0]]) {
    ok(idle.includes(S.lensGroup(key)) && idle.includes(`>${moneyRound(figure)}<`),
      `E4.4 the «${S.lensGroup(key)}» tile states its word and its sum (${moneyRound(figure)}) — a tile is a stated fact before it is a control`);
  }
  ok(new RegExp(`min-height:${TAP}px`).test(idle),
    `E4.5 tiles stand at the senior floor (${TAP}pt)`);
  ok(!/[▲▼%]/.test(idle.replace(/style="[^"]*"/g, '')),
    'E4.6 the lens still STATES and never advises: no chevron, no percentage on any tile (the re-cut pins hold as a render fact)');

  /**
   * ——— (b) A SELECTED TILE FILLS HARBOR. Seeded through the SSR seam.
   */
  const sel = lens({ selectedGroup: 'joy' });
  ok(pressedTrue(sel) === 1, 'E4.7 exactly one tile is pressed when one group is selected');
  const joyTile = (sel.match(/<button[^>]*aria-pressed="true"[^>]*>/) || [''])[0];
  ok(joyTile.toUpperCase().includes(C.harbor.toUpperCase()),
    'E4.8 …and the pressed tile is FILLED harbor — the palette\'s one selection colour, nothing new');
  ok(sel.includes(S.lensGroup('joy')) && pressed(sel) === 4,
    'E4.9 the other three tiles stand unfilled beside it — the frame never changes shape');

  /**
   * ——— (c) THE CHART RE-RENDERS PER THAT GROUP'S CATEGORIES.
   */
  const whole = compare({});
  for (const c of CATS) {
    ok(whole.includes(categoryLabel(c.name)),
      `E4.10 control — unscoped, the chart shows every category («${categoryLabel(c.name)}»)`);
  }
  ok(whole.includes(S.monthTotalLine) && whole.includes(S.uncategorizedLine),
    'E4.11 control — unscoped, the month total and the ❓ money stand (D16d intact)');

  const joy = compare({ group: 'joy' });
  ok(joy.includes(categoryLabel('Eating out')) && joy.includes(categoryLabel('Donations')),
    'E4.12 scoped to Joy — the group\'s own categories render');
  for (const name of ['Groceries', 'Medical', 'Personal expenses']) {
    ok(!joy.includes(categoryLabel(name)),
      `E4.13 …and «${categoryLabel(name)}» does not — the chart is per THAT group's categories`);
  }
  ok(joy.includes(S.lensGroup('joy')),
    'E4.14 the scoped chart names its scope — a filtered chart that does not say so is a subset passing for the whole');
  ok(!joy.includes(S.monthTotalLine),
    'E4.15 no «month total» line over a subset — the group\'s figure lives on its pressed tile, and two different totals under one label was this project\'s D16d bug');
  ok(!joy.includes(S.uncategorizedLine),
    'E4.16 the ❓ money joins no group — the same law that keeps it out of every rollup group (a chip may not adopt money nobody has placed)');
  ok(/[▲▼]/.test(joy),
    'E4.17 the scoped chart KEEPS its comparison grammar — deltas are CategoryCompare\'s lawful voice; the re-cut pins bind the lens, not the chart it drives');
  ok(joy.includes('يوليو'),
    'E4.18 …still against the same named month');

  /**
   * ——— (d) AN EMPTY GROUP STATES ITS ZERO. Projects has no rows in this
   * fixture; a silent empty card would claim a clean month it cannot claim.
   */
  const empty = compare({ group: 'projects' });
  ok(empty.includes(S.priorityEmpty(S.lensGroup('projects'))),
    'E4.19 an emptied scope says «Projects: 0» in the app\'s own words (N7\'s sentence, reused — no new key)');
  ok(!empty.includes(categoryLabel('Groceries')),
    'E4.20 …and shows no other group\'s rows while saying it');

  /**
   * ——— (e) THE WIRING IS ONE SELECTION, TWO CONSUMERS — and it releases.
   * SSR cannot tap, so the store contract is pinned at the source: both
   * components subscribe to the same module-local store, the tile's handler
   * toggles (tap again to release), and the lens clears the selection when
   * its panel closes or unmounts.
   */
  const src = await readFile(new URL('../src/components/Charts.jsx', import.meta.url), 'utf8');
  const code = stripComments(src);
  const lensSlice = code.slice(code.indexOf('export function PriorityLens'), code.indexOf('export function PeriodSummary'));
  const compareSlice = code.slice(code.indexOf('export function CategoryCompare'), code.indexOf('export function PriorityLens'));
  const stores = (code.match(/useSyncExternalStore\(\s*subscribePriority/g) || []).length;
  ok(stores >= 2 && /useSyncExternalStore\(\s*subscribePriority/.test(lensSlice)
    && /useSyncExternalStore\(\s*subscribePriority/.test(compareSlice),
    'E4.21 the lens and the chart read the SAME selection — one store, two subscribers, no second truth');
  ok(/setPrioritySelection\(\s*active\s*\?\s*null\s*:/.test(lensSlice),
    'E4.22 tap again to release — the pressed tile\'s own handler clears the selection');
  ok(/setPrioritySelection\(null\)/.test(lensSlice),
    'E4.23 a closed or unmounted lens clears the selection — the chart is never scoped by a controller nobody can see');
} finally {
  await vite.close();
}

if (failures.length) {
  console.log(`❌ CHUNK E4 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · lens tiles drive the category chart: harbor when pressed, scoped when driven, released on a second tap`);
