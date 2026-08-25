#!/usr/bin/env node
/**
 * THE PRIORITIES LENS (ratified by Tarek, 2026-08-24).  `npm run check:priorities`
 *
 * ——— WHAT THIS GUARDS, IN ORDER OF WHAT IT COSTS TO GET WRONG.
 *
 *  1. THE ARITHMETIC NOT ADDING UP. A rollup that does not account for the
 *     month's whole figure is «This week 0» in a nicer shirt — a surface that
 *     looks complete while something real is missing from it. Every fixture here
 *     reconciles: four groups + remainder = every category + the ❓ money.
 *  2. A CATEGORY IN TWO GROUPS. It would be counted twice and the remainder
 *     would absorb the error to keep the total looking right — arithmetic that
 *     reconciles while two of its terms are wrong, which is worse than a visible
 *     mismatch.
 *  3. THE LENS STARTING TO ADVISE. It states sums. A sort by size, a delta, a
 *     percentage: each would be the app ranking his priorities, and each would
 *     arrive looking like a layout improvement.
 *
 * Merchants, amounts and dates here are INVENTED, per the standing rule — the
 * repo is public and this project has leaked fixture data once. The CATEGORY
 * names are real because they are frozen schema, not personal data.
 */
import { readFile } from 'node:fs/promises';
import {
  PRIORITY_GROUPS, groupOf, priorityKey, rollup,
} from '../src/lib/priorities.js';
import { CATEGORIES } from '../src/lib/constants.js';
import { lensOpen, setLensOpen } from '../src/state/lens.js';

let pass = 0;
const failures = [];
const eq = (a, b, label) => {
  if (Object.is(a, b)) { pass++; return; }
  failures.push(`${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const ok = (c, label) => eq(!!c, true, label);
/** A THROW IS A NAMED FAILURE, NOT A DEAD PROCESS (docs/12 §02, specimen 3). */
const at = (fn, label) => {
  try { return fn(); } catch (err) { failures.push(`${label}\n      THREW — ${err && err.message}`); return undefined; }
};

// ——————————————————————— the map is HIS ruling, and it is checkable
{
  eq(PRIORITY_GROUPS.map((g) => g.key).join(','), 'essentials,health,joy,projects',
    'four groups, in his order — the frame is fixed and only the numbers move');

  /**
   * ONE CATEGORY, ONE GROUP. A name in two groups is double-counted, and the
   * remainder silently absorbs the difference so the TOTAL still reconciles —
   * the one failure this file cannot detect from the arithmetic alone.
   */
  const seen = new Map();
  const dupes = [];
  for (const g of PRIORITY_GROUPS) {
    for (const n of g.names) {
      const k = priorityKey(n);
      if (seen.has(k)) dupes.push(`${k} (${seen.get(k)} + ${g.key})`);
      seen.set(k, g.key);
    }
  }
  eq(dupes.join(', '), '', 'no category is in two groups — it would be counted twice and the remainder would hide it');

  // ——— his ruling, spot-checked where it was AMENDED from the draft
  eq(groupOf('InstaPay - Services'), 'essentials',
    'InstaPay - Services is Essentials — his amendment, moved out of the draft\'s Projects');
  eq(groupOf('InstaPay - Purchases'), 'essentials', 'and so is InstaPay - Purchases');
  eq(groupOf('Hobbies'), 'joy', 'Hobbies is Joy — his addition');
  eq(groupOf('Sports'), 'health', 'Sports is Health, not Joy');
  eq(groupOf('Science Pitchers'), 'projects', 'and Projects is exactly the three project labels');
  eq(groupOf('HYS'), 'projects', 'and Projects is exactly the three project labels');
  eq(groupOf('Team'), 'projects', 'and Projects is exactly the three project labels');
  eq(PRIORITY_GROUPS.find((g) => g.key === 'projects').names.length, 3,
    'exactly those three — «exactly these three» is how he ruled it');

  /**
   * ⚠️ DONATIONS IS JOY — ruled by Tarek the same evening, amending the draft
   * that left it unplaced (docs/05 strikes the old clause by name). The first
   * build of this suite pinned the STRUCK version, because the ruling was
   * amended in the hour between reading it and writing the code. A suite that
   * pins a superseded ruling does not merely miss the defect — it defends it.
   */
  eq(groupOf('Donations'), 'joy', 'Donations is Joy — ruled 2026-08-24, amending the draft that left it in the remainder');
  /**
   * THE THREE CLUBS ARE HEALTH — placed by the Owner 2026-08-25, «these are
   * actually fitness and health clubs». The Planner would have guessed Joy. A
   * club reads like leisure from outside his life, so this is asserted by name:
   * it is the one placement in the map that nobody could have derived.
   */
  eq(groupOf('Madinety club'), 'health', 'the clubs are fitness, not leisure — his word, not a guess');
  eq(groupOf('Shams club'), 'health', 'the clubs are fitness, not leisure — his word, not a guess');
  eq(groupOf('Officers club'), 'health', 'the clubs are fitness, not leisure — his word, not a guess');
  /**
   * AND EXACTLY ONE OF HIS THIRTY IS UNPLACED, deliberately. `Personal expenses`
   * has ZERO rows in the whole book (measured on the wire, 2026-08-25) — it is
   * Dad's pattern, unused here. Placing an empty category would be tidiness
   * standing in for a decision; the remainder names it if a row ever lands.
   *
   * Asserted as an exact list so the remainder's contents are a known set: a
   * category silently falling out of a group would land here and say so.
   */
  eq(CATEGORIES.filter((c) => !groupOf(c)).join(' · '), 'Personal expenses',
    'the map places 29 of 30, and the thirtieth is unplaced on purpose');

  /**
   * ——— THE TRAILING SPACE. `Elect. Recharge ` is stored in his sheet WITH one
   * (D13: it is a SUMIF criterion). A map keyed on the untrimmed form would drop
   * his electricity out of Essentials and into the remainder — a true total made
   * of a wrong sentence, and invisible because the arithmetic would still add up.
   */
  eq(groupOf('Elect. Recharge '), 'essentials', 'the stored form with its trailing space still finds its group…');
  eq(groupOf('Elect. Recharge'), 'essentials', '…and so does the trimmed form this client uses');
  eq(groupOf('Water. Recharge'), 'essentials', 'and the stray dot is left exactly where it is');
  eq(groupOf('Nothing In Particular'), null, 'a name the map does not know falls to the remainder, never to a guess');
  eq(groupOf(null), null, 'and nothing is not a category');
}

/**
 * ——————————————————————— EVERY GROUP HAS A LABEL, IN BOTH LOCALES.
 *
 * The map and the strings are two files, and a group added to one without the
 * other renders its raw key — «projects» in Arabic, on his Month screen. The
 * runtime falls back to the key rather than to nothing (an unlabelled row is
 * worse than an untranslated one), which is exactly the kind of soft landing
 * that hides drift, so the drift is asserted here at the source instead.
 */
{
  const { AR_LOCALE } = await import('../src/i18n/strings.ar.js');
  const { EN_LOCALE } = await import('../src/i18n/strings.en.js');
  for (const g of PRIORITY_GROUPS) {
    for (const [name, loc] of [['ar', AR_LOCALE], ['en', EN_LOCALE]]) {
      const label = at(() => loc.S.lensGroup(g.key), `${name}.lensGroup('${g.key}')`);
      ok(typeof label === 'string' && label.length > 0 && label !== g.key,
        `${name} has a real label for «${g.key}» — not its raw key`);
    }
  }
}

// ——————————————————————— the arithmetic, which is the whole point
{
  const cats = [
    { name: 'Groceries', now: 5210, prev: 6480 },
    { name: 'Eating out', now: 6840, prev: 9120 },
    { name: 'Medical', now: 1200, prev: 0 },
    { name: 'HYS', now: 3000, prev: 2500 },
    { name: 'Donations', now: 2100, prev: 4500 },
    // The one category his ruling leaves unplaced — see Law 4.
    { name: 'Personal expenses', now: 900, prev: 900 },
  ];
  const folded = rollup(cats, { count: 2, total: 750 });
  const byKey = (k) => at(() => folded.groups.find((g) => g.key === k).total, `group ${k} exists`);

  eq(byKey('essentials'), 5210, 'Essentials sums the categories his ruling put there');
  eq(byKey('health'), 1200, 'Health is Medical, Sports and the three clubs — and only Medical has rows here');
  eq(byKey('joy'), 6840 + 2100, 'Joy sums his — Eating out AND Donations, per the amended ruling');
  eq(byKey('projects'), 3000, 'and Projects sums the project labels');
  eq(at(() => folded.remainder.total, 'the remainder exists'), 900 + 750,
    'the remainder is every unmapped category PLUS the ❓ money — nothing may fall outside it');
  ok(at(() => folded.remainder.names.includes('Personal expenses'), 'the remainder names itself'),
    'and it NAMES what is in it — a bare figure would hide which categories the map has not placed');
  ok(!at(() => folded.remainder.names.includes('Donations'), 'Donations left the remainder'),
    'and Donations is no longer among them — the ruling moved it to Joy');

  /**
   * ═══ THE LAW: THE ROLLUP ACCOUNTS FOR THE MONTH'S WHOLE FIGURE ═══
   * `sum(monthCats.now) + uncategorized.total` is the month, by 06 §2.2's own
   * reconciliation law. If the lens's total is ever less than that, money he
   * spent is on no line of this panel and the panel looks complete anyway.
   */
  const wholeMonth = cats.reduce((a, c) => a + c.now, 0) + 750;
  eq(at(() => folded.total, 'the lens states a total'), wholeMonth,
    'four groups + remainder = every category + the ❓ money, exactly');
  eq(at(() => folded.groups.reduce((a, g) => a + g.total, 0) + folded.remainder.total, 'the parts sum'),
    wholeMonth, 'and the parts add up to it independently of how it is reported');

  /**
   * ——— A GROUP WITH NO SPEND IS A TRUE ZERO, AND IT STAYS.
   * The fixed frame is what makes this a lens. A group that vanished in a month
   * he booked nothing to it would make the shape of his month change with its
   * contents — the one thing a frame may not do.
   */
  const sparse = rollup([{ name: 'Groceries', now: 100, prev: 0 }], { count: 0, total: 0 });
  eq(at(() => sparse.groups.length, 'all four groups are reported'), 4,
    'all four groups are reported even when three of them are empty');
  eq(at(() => sparse.groups.find((g) => g.key === 'projects').total, 'an empty group is zero'), 0,
    'an empty group is a true zero, not an absence');
  eq(at(() => sparse.remainder.total, 'a clean month has no remainder'), 0,
    'and a month with nothing unmapped and nothing uncategorised has no remainder at all');

  /**
   * ═══ A NEGATIVE REMAINDER MUST NOT VANISH ═══
   *
   * Refunds and reversals are an ordinary state of his book, so an unmapped
   * category can legitimately come back below zero. The render gate read
   * `remainder.total > 0`, so the whole block disappeared while the panel's
   * total went on subtracting it — four figures summing to 8,500 above a bold
   * «Month total» reading 7,300, with the 1,200 and its category name on no line
   * of the panel. The lens producing the exact reconciliation failure it exists
   * to prevent.
   */
  const refunded = rollup([
    { name: 'Groceries', now: 5000, prev: 0 },
    { name: 'Medical', now: 1000, prev: 0 },
    { name: 'Eating out', now: 2000, prev: 0 },
    { name: 'HYS', now: 500, prev: 0 },
    { name: 'Personal expenses', now: -1200, prev: 0 },
  ], { count: 0, total: 0 });
  eq(at(() => refunded.remainder.total, 'a refund lands in the remainder'), -1200,
    'a refunded unmapped category is carried, sign and all');
  eq(at(() => refunded.total, 'and the total accounts for it'), 7300,
    'and the stated total subtracts it — so the line MUST render, or the panel does not add up');
  ok(at(() => refunded.remainder.names.includes('Personal expenses'), 'named'),
    'and it is named, so he can see which category went negative');

  /**
   * AND A REMAINDER THAT NETS TO ZERO WHILE ❓ MONEY IS IN IT. docs/05 is
   * explicit: it «must STILL render whenever the uncategorized total is nonzero
   * — an empty remainder is a claim, not a decoration».
   */
  const netZero = rollup([{ name: 'Personal expenses', now: -500, prev: 0 }], { count: 1, total: 500 });
  eq(at(() => netZero.remainder.total, 'the remainder nets to zero'), 0,
    'a remainder can net to zero while carrying real money on both sides…');
  eq(at(() => netZero.remainder.uncategorized, 'the ❓ figure survives the netting'), 500,
    '…so the ❓ total is kept SEPARATELY, which is what lets the screen know to render anyway');

  // Order is the MAP's order, never the sizes — sorting would be a ranking.
  eq(folded.groups.map((g) => g.key).join(','), 'essentials,health,joy,projects',
    'the groups come back in his fixed order — sorting them by size would rank his priorities for him');
}

/**
 * ——————————————————————— IT REFUSES RATHER THAN UNDERSTATES.
 *
 * `uncategorized` is what makes the arithmetic complete. Against a payload that
 * does not carry it (a pre-V18 backend, or a month the server could not fully
 * read) a rollup would still render four confident groups with his ❓ money
 * outside all of them AND outside the remainder. Fail direction (§6.0): this
 * protects the truth of a figure, so it fails CLOSED — nothing renders.
 *
 * PRESENCE, never value: a clean month sends `{count: 0, total: 0}` and its
 * arithmetic is perfectly sound. A value test would blank the lens on exactly
 * the months where its claim is most defensible.
 */
{
  const cats = [{ name: 'Groceries', now: 100, prev: 0 }];
  eq(rollup(cats, undefined), null, 'no `uncategorized` field, no lens — never four confident groups with a gap');
  eq(rollup(cats, null), null, 'and null is the same refusal');
  eq(rollup(cats, {}), null, 'as is a field that carries no total');
  ok(rollup(cats, { count: 0, total: 0 }) !== null,
    'but a clean month renders — the signal is the FIELD\'S PRESENCE, never its value');
  eq(rollup(null, { count: 0, total: 0 }), null, 'and no categories is nothing to fold');
  eq(at(() => rollup([{ name: 'Groceries', now: 'nonsense' }], { count: 0, total: 0 }).total, 'a junk amount'), 0,
    'an unreadable amount is skipped rather than turned into NaN — one bad row may not blank the panel');
}

// ——————————————————————— the per-install preference, and it defaults CLOSED
{
  const store = (v) => {
    let held = v;
    return { getItem: () => held, setItem: (_, x) => { held = x; } };
  };
  eq(lensOpen(store(null)), false, 'a fresh install has the lens CLOSED — that is the per-install guarantee');
  eq(lensOpen(store('open')), true, 'he opens it once and it stays open');
  eq(lensOpen(store('closed')), false, 'and closing it closes it');
  eq(lensOpen(store('true')), false, 'a truthy-but-wrong value reads as closed rather than being coerced open');
  eq(lensOpen({ getItem() { throw new Error('storage is gone'); } }), false,
    'and a storage that throws lands closed — every failure path leads to Dad seeing nothing new');
  const s = store(null);
  setLensOpen(true, s);
  eq(lensOpen(s), true, 'the preference round-trips…');
  setLensOpen(false, s);
  eq(lensOpen(s), false, '…in both directions');
}

/**
 * ——————————————————————— IT STATES, AND NEVER ADVISES.
 *
 * Source-pinned, because this is a rule about what the component MUST NOT grow.
 * `CategoryCompare` sits directly below it and carries deltas and bars, and it
 * is right to — it answers «how does this month compare». The lens answers
 * «where did the month go», and the day it grows a comparison it has started
 * telling him what to think about his own priorities. Every one of these would
 * arrive looking like an improvement.
 */
{
  const src = await readFile(new URL('../src/components/Charts.jsx', import.meta.url), 'utf8');
  const lens = src.slice(src.indexOf('export function PriorityLens'), src.indexOf('export function PeriodSummary'));
  ok(lens.length > 400, 'the lens component was found in Charts.jsx — a slice that missed it would assert nothing');
  ok(!/<Delta/.test(lens), 'the lens renders NO delta — a comparison is not a sum');
  /**
   * NO PERCENTAGE — and the first version of this line asserted the percent
   * SIGN, which `width: '100%'` fails. A guard that reddens on a CSS length
   * teaches the next person to delete it. What it means is: the lens never
   * divides one of his figures by another. A share of the whole is still a
   * comparison, and it is the one that would look most like a helpful addition.
   */
  const executes = lens.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  ok(!/[\w.)\]]\s*\/\s*[\w(]/.test(executes.replace(/'[^']*'/g, "''")),
    'the lens divides nothing by anything — a share of the whole is still a comparison');
  ok(!/`[^`]*%[^`]*\$\{/.test(executes) && !/\$\{[^}]*\}%/.test(executes),
    'and no computed percentage reaches the screen');
  ok(!/\.sort\(/.test(lens), 'and it never sorts — ordering four groups by size would rank his priorities for him');
  ok(!/prev/.test(lens.replace(/\/\*[\s\S]*?\*\//g, '')),
    'and it never reaches for last month — `monthCats` carries `prev` and this panel must not read it');
  /**
   * The guard reads what EXECUTES. Stripping comments first is the fix from the
   * constitutional guard that reddened on the prose explaining why deletion is
   * forbidden — a file may not become less explainable in order to pass its own
   * check.
   */
  ok(/S\.monthTotalLine/.test(lens),
    'it states the figure it accounts for — a rollup that reconciles against nothing is a decoration');
  /**
   * THE REMAINDER'S RENDER GATE, pinned by source because the panel is behind a
   * per-install toggle SSR cannot flip. `> 0` hid a negative remainder and hid a
   * zero-net remainder holding ❓ money; both are states his book really
   * produces, and in both the panel stopped adding up while looking complete.
   */
  ok(!/folded\.remainder\.total > 0/.test(lens),
    'the remainder is NOT gated on being positive — a refund is not an absence');
  ok(/folded\.remainder\.total !== 0/.test(lens) && /folded\.remainder\.uncategorized !== 0/.test(lens),
    'it renders whenever it carries anything: a figure of either sign, a name, or ❓ money');
}

/**
 * ——————————————————————— NO MOCK OPTIMISM SHIPS FLIPPED.
 *
 * `api/mock.js` carries review flags — `MOCK_HAS_PREV_YEAR`,
 * `MOCK_PREVLOG_NULL`, and `MOCK_V18_MONTH`, which this feature added so the
 * lens can be opened on a device at all. Each exists to be turned on for a
 * local look and turned off again, and each one left on would make the mock
 * more generous than the service.
 *
 * That is the defect this project has now paid for FIVE times — most recently a
 * response shape «composed for MY OWN MOCK from memory», which certified a
 * client that could not read a real list. None of these flags was asserted by
 * anything, so the only thing standing between a flipped flag and a green suite
 * was the person who flipped it remembering.
 *
 * It lives in THIS suite because the priorities lens is the surface that is
 * invisible without a flag, so this is where someone will be tempted to leave
 * one on. The sweep is deliberately file-wide rather than about this feature: a
 * guard that only watched its own flag would have watched the wrong one twice
 * already. A flag whose honest default is ever `true` will redden this — which
 * is the right outcome, because that is a decision worth making deliberately.
 */
{
  const src = await readFile(new URL('../src/api/mock.js', import.meta.url), 'utf8');
  const executes = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const flags = [...executes.matchAll(/const (MOCK_[A-Z0-9_]+) = (true|false);/g)];
  ok(flags.length >= 2, `the mock's review flags were found (${flags.length}) — a regex that matched none would assert nothing`);
  const flipped = flags.filter((m) => m[2] === 'true').map((m) => m[1]);
  eq(flipped.join(', '), '',
    'every mock review flag ships OFF — one left on makes the mock more generous than the service, which is how this project has shipped five clients that could not read reality');

  /**
   * ——— AND THE V18 ❓ FIGURE IS DERIVED, NOT BACK-SOLVED.
   *
   * It shipped once as `total: 5605` under a comment claiming the numbers
   * reconciled. They did — on 23–24 August 2026 and no other day, because
   * `month.cur` is null-padded at Cairo today and grows while a constant does
   * not. Two surfaces print the same «إجمالي الشهر» label from the two sides of
   * that identity, so on every other day they printed different figures under
   * one word, and `CategoryCompare` stopped adding up on its own.
   *
   * Asserted on the SOURCE because the flag is off by the line above, so no
   * rendered fixture can reach the value. What is pinned is the shape of the
   * arithmetic: the ❓ bucket is whatever the generated month is not accounted
   * for by the category list.
   */
  ok(!/total:\s*5605/.test(executes), 'no back-solved ❓ constant — it reconciled for two days and lied on the rest');
  ok(/sum\(curMonth\.Visa\)\s*\+\s*sum\(curMonth\.Cash\)/.test(executes),
    'the month it reconciles against is the SAME series the Month screen sums');
  /**
   * BOTH SIDES DERIVE. Deriving only the ❓ bucket from a fixed category list
   * made the identity hold every day — by handing ❓ a NEGATIVE total for the
   * first twelve of them, which the real server can never return. So the five
   * names take shares of the generated month and ❓ takes the exact leftover.
   */
  ok(/Math\.round\(monthTrueTotal \* share\)/.test(executes),
    'the categories are SHARES of the generated month, so they scale with it…');
  ok(/total: monthTrueTotal - sum\(monthCats/.test(executes),
    '…and ❓ takes the exact leftover, so it can never go negative and the identity is exact');

  /**
   * ——— AND `month.uncategorized` IS UNCONDITIONAL.
   *
   * It shipped gated behind a review flag on the belief that the serving
   * backend did not send it. Planner 5 probed his book on 2026-08-24:
   * `{count: 3, total: 0}`. The field is live, and the client gates BOTH the
   * «إجمالي الشهر» line and this whole lens on its presence — so a mock that
   * withheld it hid two shipped surfaces from every dev and every suite.
   *
   * Mock parity is usually stated as «never more generous than the service».
   * This is its other face: a mock more PESSIMISTIC than the service hides the
   * feature from everyone who could have found a defect in it. Pinned so the
   * field cannot quietly go back behind a flag.
   */
  ok(/\n\s*uncategorized: mockUncategorized,/.test(executes),
    'the mock carries `month.uncategorized` UNCONDITIONALLY — his book sends it, and the lens fails closed without it');
  ok(!/MOCK_V18_MONTH/.test(src),
    'and the flag that used to hide it is gone, not merely flipped');
}

const report = failures.length
  ? `❌ ${failures.length} / ${pass + failures.length} priorities checks failed:\n  - ${failures.join('\n  - ')}`
  : `✅ all ${pass} priorities checks passed`;
console.log(report);
process.exit(failures.length ? 1 : 0);
