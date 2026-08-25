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
import { AR_LOCALE } from '../src/i18n/strings.ar.js';
import { EN_LOCALE } from '../src/i18n/strings.en.js';

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
  'Leisure', 'Sports', 'Hobbies',         // 2026-08-24, his ruling (docs/02 round 6)
];

// ——————————————————————— the set
eq(CATEGORIES.length, 21 + 9, 'twenty-one shared plus this install\'s nine');
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

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE LABEL AND THE VALUE (finding M2) — and why this is the load-bearing file.
 *
 * Until 2026-08-17 every category tap in this app landed on a Latin word inside
 * an Arabic RTL screen. The fix renders an Arabic LABEL while the frozen VALUE
 * goes on the wire — which means the app now holds two strings per category
 * where it held one, and this project's own history says exactly what happens
 * next: `entryPayload.js` exists because a chooser's LABEL reached the wire as a
 * METHOD and wrote card money into the Cash column with a ✓ on screen.
 *
 * That failure is worse here. `normalizeMethod_` coerces; `canonicalCategory_`
 * REJECTS, so a label reaching the wire is a row that lands as ❓ rather than a
 * silent mis-file. But the reverse — a label that happens to equal some OTHER
 * category's value — would be a wrong-but-accepted write, and the whole point of
 * the map is that it is hand-written and can be edited by anyone.
 *
 * So: no label is any category's value, both directions, for all of them.
 */
{
  const AR_L = AR_LOCALE.categoryLabel;
  const EN_L = EN_LOCALE.categoryLabel;
  const values = new Set(CATEGORIES);

  for (const c of CATEGORIES) {
    const label = AR_L(c);
    ok(typeof label === 'string' && label.length > 0,
      `${c} has a label — an unmapped category must render as SOMETHING tappable`);
    /**
     * A label may equal ITS OWN value (proper nouns: `HYS`, `Science Pitchers`,
     * left in Latin on purpose). It may never equal a DIFFERENT one, which is
     * the case that would post the wrong category and be accepted.
     */
    ok(!(values.has(label) && label !== c),
      `the label for ${c} is not some OTHER category's frozen value — that write would be accepted and wrong`);
  }

  // The map covers the whole schema. A category added to constants.js without a
  // label still works (it falls through to itself) — this counts how many do.
  const translated = CATEGORIES.filter((c) => AR_L(c) !== c);
  ok(translated.length >= 20,
    `most of the schema is actually in Arabic — ${translated.length} of ${CATEGORIES.length}`);
  ok(AR_L('Groceries') !== 'Groceries', 'the most-tapped category is translated…');
  ok(AR_L('HYS') === 'HYS', '…while a programme name is left as its own name');
  ok(AR_L('Science Pitchers') === 'Science Pitchers', 'and so is a company');
  eq(AR_L('omara2 al behar'), 'عمارة البحر',
    'his own transliteration gets its alphabet back — the clearest case in the list');
  eq(AR_L('fara7'), 'فرح', 'and so does the other one');

  // ENGLISH IS THE IDENTITY, which is what makes the whole thing revertible: an
  // empty map is the English behaviour, and the English behaviour is the old app.
  for (const c of CATEGORIES) {
    ok(EN_L(c) === c, `in English the label IS the value: ${c}`);
  }

  // Nothing unmapped blanks out — a category the server accepts must never
  // render as an empty button he cannot identify.
  eq(AR_L('Some Future Category'), 'Some Future Category', 'an unmapped value renders as itself');
  eq(AR_L('  Groceries  '), AR_L('Groceries'), 'and lookup trims, as every other comparison here does');
  eq(AR_L(null), '', 'a missing value is an empty label rather than a crash');
  eq(AR_L(undefined), '', 'and so is an absent one');
  eq(EN_L(null), '', 'both locales agree about nothing');
}

const report = failures.length
  ? `❌ ${failures.length} / ${pass + failures.length} category checks failed:\n  - ${failures.join('\n  - ')}`
  : `✅ all ${pass} category checks passed`;
console.log(report);
process.exit(failures.length ? 1 : 0);
