#!/usr/bin/env node
/**
 * The category list itself.  `npm run check:categories`
 *
 * WHY THIS FILE EXISTS. Until 2026-08-03 nothing in the app asserted anything
 * about `CATEGORIES` — the list appeared in four files and was pinned by none of
 * them. That gap was found while enumerating what a new category touches: a
 * client/server whitelist mismatch was caught by nothing until a chip turned
 * into a dead button in his hand.
 *
 * The dangerous direction is stated in constants.js: a category the SERVER
 * accepts but the client cannot offer. That one cannot be checked from here —
 * the server's whitelist is per-install config — so what is checked instead is
 * everything that makes a name unusable once it is here: an untrimmed copy, a
 * near-duplicate, a name inserted where it silently reorders his one-tap row.
 *
 * Every assertion is written so the wrong answer is a REAL past mistake, not a
 * hypothetical: the trailing space is D13, the ordering is the cash keypad, and
 * the near-duplicate is what `canonicalCategory_` collapses server-side.
 */
import { CATEGORIES, SHORT_LIST, CASH_QUICK, UNKNOWN_CATEGORY } from '../src/lib/constants.js';

let pass = 0;
const failures = [];
const eq = (a, b, label) => {
  if (Object.is(a, b)) { pass++; return; }
  failures.push(`${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const ok = (c, label) => eq(!!c, true, label);

/**
 * The shared base, verbatim, in order. Frozen for Dad — CLAUDE.md forbids
 * inventing, renaming, merging or "cleaning up" any of it.
 */
const BASE = [
  'Eating out', 'Groceries', 'Car', 'Gifts', 'Donations',
  'Internet', 'Telephone', 'Medical', 'Personal expenses',
  'omara2 al behar', 'Elect. Recharge', 'Water. Recharge',
  'Villa', 'Taxes and fines', 'Gas', 'Madinety club',
  'Shams club', 'Officers club', 'Vacations', 'Utilities', 'fara7',
];

/** Tarek's book only, in the order they were added. */
const EXTRAS = [
  'Transportation', 'InstaPay - Services', 'InstaPay - Purchases',
  'Science Pitchers', 'HYS', 'Team',      // 2026-08-03, his ruling
];

// ——————————————————————— the set
eq(CATEGORIES.length, 21 + 6, 'twenty-one shared plus this install\'s six');
eq(CATEGORIES.length, BASE.length + EXTRAS.length, 'and nothing else has crept in');

for (let i = 0; i < BASE.length; i++) {
  eq(CATEGORIES[i], BASE[i], `the shared base is first and unmodified: #${i}`);
}
for (let i = 0; i < EXTRAS.length; i++) {
  eq(CATEGORIES[BASE.length + i], EXTRAS[i], `the extras are appended, in order: ${EXTRAS[i]}`);
}

/**
 * APPEND, NEVER INSERT — asserted through the two slices that actually consume
 * the order, so this fails for the reason it exists rather than for tidiness.
 * A name inserted at the top would silently move the six buttons he reaches for
 * without looking, and the cash keypad's grid with them.
 */
eq(SHORT_LIST.join(','), 'Eating out,Groceries,Car,Gifts,Donations,Internet',
  'the six most-used are untouched by anything appended');
eq(SHORT_LIST.length, 6, 'and there are still six of them');
eq(CATEGORIES.slice(0, 12).join(','),
  'Eating out,Groceries,Car,Gifts,Donations,Internet,Telephone,Medical,Personal expenses,omara2 al behar,Elect. Recharge,Water. Recharge',
  'and the cash keypad\'s twelve are the same twelve as yesterday');

// ——————————————————————— the names themselves
for (const c of CATEGORIES) {
  ok(typeof c === 'string' && c.length > 0, `a category is a non-empty string: ${JSON.stringify(c)}`);
  eq(c, c.trim(), `no stray whitespace: ${JSON.stringify(c)}`);
}

/**
 * THE TRAILING SPACE, NAMED. `backend/Code.gs` stores `'Elect. Recharge '` WITH
 * one, because his dashboard's SUMIF criteria cell contains it (D13). This list
 * deliberately stays trimmed and the server owns the stored form. Copying the
 * space here would put an invisible character into a button label, and the loop
 * above would catch it — but only this assertion says WHICH name it was, which
 * is the difference between a failure you can act on and one you have to
 * investigate.
 */
eq(CATEGORIES[10], 'Elect. Recharge', 'Elect. Recharge is trimmed here, spaced in the sheet');
eq(CATEGORIES[11], 'Water. Recharge', 'Water. Recharge keeps its stray dot');
ok(CATEGORIES.includes('omara2 al behar'), 'omara2 al behar is a real category, not a typo');
ok(CATEGORIES.includes('fara7'), 'and so is fara7');

/**
 * NO NEAR-DUPLICATES. The server matches on a lower-cased, trimmed key
 * (`categoryKey_`), so two names that differ only in case or spacing are ONE
 * category to it and two chips to him — the second of which writes over the
 * first's meaning. Exact-duplicate checking alone would miss `HYS` / `hys`.
 */
const seen = new Map();
for (const c of CATEGORIES) {
  const key = String(c).trim().toLowerCase();
  if (seen.has(key)) {
    failures.push(`two categories collapse to one server-side: ${JSON.stringify(seen.get(key))} and ${JSON.stringify(c)}`);
  } else {
    seen.set(key, c);
    pass++;
  }
}

ok(!CATEGORIES.includes(UNKNOWN_CATEGORY), '❓ is a marker, never an offerable category');

// ——————————————————————— the three added today, by name
ok(CATEGORIES.includes('Science Pitchers'), 'Science Pitchers is offered');
ok(CATEGORIES.includes('HYS'), 'HYS is offered');
ok(CATEGORIES.includes('Team'), 'Team is offered');

/**
 * A CASH PRESET MUST NAME A CATEGORY THAT EXISTS. `CASH_QUICK` maps a one-tap
 * label to a category, and a preset pointing at a name the list no longer holds
 * is a button that writes something the server refuses — the row lands as ❓ and
 * he has to fix by hand the thing the preset existed to save him from.
 */
for (const q of CASH_QUICK) {
  if (q.category === null) { pass++; continue; }   // deliberately unguessed (D5)
  ok(CATEGORIES.includes(q.category),
    `the "${q.label}" preset names a real category: ${JSON.stringify(q.category)}`);
}

const report = failures.length
  ? `❌ ${failures.length} / ${pass + failures.length} category checks failed:\n  - ${failures.join('\n  - ')}`
  : `✅ all ${pass} category checks passed`;
console.log(report);
process.exit(failures.length ? 1 : 0);
