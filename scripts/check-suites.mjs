#!/usr/bin/env node
/**
 * The app's suite runner, and its DECLARED ASSERTION COUNT.  `npm test`
 *
 * ——— THE FOUNDING SPECIMEN, 2026-08-16, and it was mine.
 *
 * I measured the app suite at 1,871, then fixed a mutation that had survived —
 * which added one assertion — and afterwards re-ran only the single suite and
 * the publish gate. The number I had already quoted was never re-measured. It
 * reached a report, and from there would have reached a release record, as a
 * figure that was true when taken and stale when read. The Planner's count
 * (1,872) caught it, by hand.
 *
 * The backend has had a guard against exactly this since Proposal #0, and it
 * fired TWICE in that same rev — *"declares 952 but 1006 assertions ran"*, then
 * *"declares 1006 but 1011"* — both times before the number could leave the
 * machine. The app had no such guard, so the two halves of one project held
 * their totals to different standards. **That asymmetry was the actual defect;
 * my stale number was only how it surfaced.** (Ruled by Planner 4 the same day.)
 *
 * It catches the boring case, a stale quote, and the case worth more: assertions
 * silently DISAPPEARING. A suite whose file stops being run, a block quietly
 * skipped by an early return, a fixture loop that stops iterating — none of
 * those turn anything red. They lower a number nobody is checking.
 *
 * ——— WHY THIS FILE OWNS BOTH THE LIST AND THE NUMBER.
 *
 * The ruling asked that a reviewer see the bump in the same diff as the
 * assertions that caused it. Keeping SUITES and EXPECTED_ASSERTIONS in one file
 * is the strongest form of that: adding a suite, adding assertions to one, and
 * declaring the new total are edits to files a reviewer is already reading
 * together, and the runner cannot drift from the list it runs.
 *
 * It also fixes a smaller thing the `&&` chain did badly: the chain stopped at
 * the first red suite, so a rev that broke three saw one. This runs them all and
 * reports every failure, then exits non-zero.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * BUMP THIS IN THE SAME COMMIT AS THE ASSERTIONS THAT MOVED IT.
 * If you are here because the run went red: the number below is a claim about
 * the suite, and one of the two is wrong. Neither is automatically the number.
 */
/**
 * 5573 since 2026-08-28 (glass redesign, foundation step). RECONCILED
 * LINE-BY-LINE, not estimated: the single new assertion is A3's, and it is
 * A3 doing its job rather than a test being added. A3 asserts once per file
 * that CONTAINS radius sites; `theme.js` contained none until the glass
 * recipes moved into it, and now contains five — all riding RADIUS tokens,
 * all clean. Measured both ways: with the glass block A3 runs 32 checks,
 * with it removed it runs 31.
 *
 * 5581 the same day: `currencyShort` («ج.م» / «E£») entered both locales, and
 * the i18n suite charges 8 checks for one key — parity in both directions,
 * type, arity and template safety, across two locales. RECONCILED THE SAME
 * WAY: test-i18n runs 2429 with the key and 2421 with it removed in a scratch
 * copy, and it is the ONLY suite whose count moved. The key exists because the
 * design uses the full word beside hero figures and the abbreviation beside
 * row-scale ones — 21 sites out of 21, no exception — and the app had only the
 * hero form.
 *
 * 5586 on 2026-08-29 (glass audit Tier 1, A7 — the harbor split). RECONCILED
 * BY DIFFING EVERY SUITE'S OWN COUNT against the pre-change run: exactly ONE
 * suite moved, test-contrast, 68 -> 73. Nothing else in the board shifted by
 * a single assertion, which is what makes +5 a claim rather than a guess.
 *
 * The +5 is 6 added and 2 removed, and the removals are the point. The suite
 * used to carry `harbor on card - headings` (21px bold, 4.53:1, green) and a
 * `canonical()` for `harbor on shell` excused as "reserved for large/bold per
 * the brief". Both described the 21-23px headings truthfully and the ELEVEN
 * 15px labels sharing that colour not at all — and at 15px the floor is 4.5,
 * where harbor measures 4.53 on card and 4.23 on shell. The app had been
 * shipping that failure with a green board. So the two lines were replaced by
 * five pairs stated at the sizes that actually bind (headings on card and
 * shell, label tier on card and shell, the 12.5px editable marker), plus a
 * sixth assertion: a negative control that fails if `harbor` ever clears
 * 4.5:1 as text, so the split cannot quietly become folklore.
 *
 * 5600 on 2026-08-29 (glass audit Tier 2/3). RECONCILED BY DIFFING EVERY
 * SUITE'S OWN COUNT against the previous run: exactly one entry moved, and it
 * moved from absent to present. The +14 is `test-glass.mjs` in its entirety —
 * a NEW suite, not new assertions inside an old one.
 *
 * It exists because the glass redesign added a whole surface vocabulary to
 * theme.js and no suite owned it. Its load-bearing assertion is A22's: a CSS
 * `filter` other than `none` makes its element the containing block for every
 * `position: fixed` descendant, and this app has nine of those — the nav, the
 * conflict strip, and all three bottom sheets. The design prototype applies
 * the atmosphere tint as `#glass-root { filter }`, an ancestor of everything.
 * Ported here it would re-parent all nine — and `ATMOSPHERE.morning` is
 * `'none'`, so it would test clean under the default and break only under
 * Golden hour and Cool dusk. The guard carries its own positive control, so
 * the absence assertion cannot pass vacuously.
 */
/**
 * 5623 on 2026-08-29. The +23 is `test-jsx-comments.mjs`, added because a
 * comment SHIPPED TO THE SCREEN and 5,600 assertions did not notice.
 *
 * In JSX a block comment is only a comment inside an expression container; in
 * children position it is a text node. An annotation landed between `<span>`
 * and `{row.description}` and React painted nine lines of source commentary
 * onto the Today screen, above the merchant name, on the Owner's phone.
 *
 * The new suite compiles every .jsx through Vite and looks for a comment
 * delimiter inside a string literal of the compiled output — which is exactly
 * what the browser is handed. It carries positive controls both ways, and it
 * was proved against the real defect before being trusted.
 */
/**
 * 5659 on 2026-08-30. RECONCILED BY DIFFING EVERY SUITE'S OWN COUNT: exactly
 * two moved. +28 is `test-units.mjs` entire; +8 is `test-i18n.mjs` picking up
 * the parity checks for one new key, `travelApartLead`, in both locales.
 *
 * `test-units.mjs` exists because `currencyShort` («ج.م» / «E£») was added to
 * both locales and rendered by NOTHING for a day, while the Owner's phone
 * showed "0 EGP". The check that let it through was a grep for the string in
 * the built bundle — and the token WAS in the bundle, sitting in a locale
 * object nobody read. PRESENCE IS NOT USE. So every assertion in that file
 * renders a component and reads the output, in BOTH languages, because the
 * defect was seen in English and a server-side render defaults to Arabic.
 *
 * It also carries a dead-key scan, which is what would have caught this on day
 * one. That scan exempts keys reached dynamically (S[`period${Key}`]) and
 * freezes the 24 already-dead keys in a named list, so the existing debt is
 * visible and no NEW dead key can join it.
 */
/**
 * 5465 on 2026-08-30 — a DROP of 194, which is the number this file exists to
 * make someone explain. Reconciled by diffing every suite's own count: exactly
 * one moved, `test-i18n.mjs`, and no suite vanished.
 *
 * 24 dead locale keys were deleted from both locales. i18n runs 8 parity
 * assertions per key (24 × 8 = 192), plus one arity assertion per FUNCTION key
 * — and 2 of the 24 were functions, `receiptQueuedCount` and `outboxPending`.
 * 192 + 2 = 194, to the assertion.
 *
 * The keys were strings for states the app never wired up. A string nothing
 * renders is not a placeholder; it is a claim the screen does not make. The
 * dead-key scan in `test-units.mjs` now enforces zero with no allowlist.
 *
 * One of them needed care: `test-inbox.mjs` asserted a removed disclosure stays
 * removed via `!html.includes(AR.inboxOriginal)`. Deleting that key would have
 * made it `!includes(undefined)` — true for every input, a check that could no
 * longer fail. It pins the literal «الرسالة الأصلية» now.
 */
/**
 * 5497 on 2026-08-30. All +32 is `test-units.mjs` (28 → 60); no other suite
 * moved and none vanished.
 *
 * It grew because it had a hole the size of three screens. It rendered only the
 * DEFAULT period, so it passed while the WEEK screen still said "0 EGP" — that
 * aside is `PeriodBlock`, a different component with its own currency
 * rendering, and nothing in the suite ever reached it. It now renders today,
 * week, month AND year, in both languages, and again with the display currency
 * set to EUR — which is the Owner's own setting and the only configuration in
 * which the home total appears as an aside at all.
 *
 * Re-proved: reverting the one-line fix fails six of those assertions by name.
 */
/**
 * 5499 on 2026-08-30. +2, all of it `test-book`, and nothing vanished: the two
 * assertions added when the LEAD rule was refined — one pinning the unit the
 * lead lands in, one asserting Dad's install directly instead of inferring it
 * from a default that no longer implies it.
 */
/**
 * 5509 on 2026-08-30. +10, all of it `check-lead.mjs` joining the board — a
 * new suite, no existing count moved.
 *
 * It asserts the one thing a currency setting can get wrong in a way the
 * setting itself will never admit: that the LARGEST figure on a screen is a
 * figure and not a zero. Making EUR the default put «0 EUR» in 40px type over
 * a month holding 123,110.68 EGP. Measured against a real captured payload,
 * per period, in both languages, with controls that fail if the fixture ever
 * stops containing the case under test.
 */
const EXPECTED_ASSERTIONS = 5509;

/** In the order they run. Adding a file here is adding it to `npm test`. */
const SUITES = [
  'test-format.mjs',
  'test-i18n.mjs',
  'test-refresh.mjs',
  'test-recent.mjs',
  'test-book.mjs',
  'test-batch.mjs',
  'test-duplicates.mjs',
  'test-priorities.mjs',
  'test-tier3.mjs',
  'test-entry.mjs',
  'test-dock.mjs',
  'test-receipt-dup.mjs',
  'test-accountability.mjs',
  'honest-render.mjs',
  'test-chips.mjs',
  'test-glass.mjs',
  'test-jsx-comments.mjs',
  'test-units.mjs',
  'check-lead.mjs',
  'test-queue.mjs',
  'test-inbox.mjs',
  'test-categories.mjs',
  'test-contrast.mjs',
  'test-logcard.mjs',
  'test-icons.mjs',
  'test-chunk-n1.mjs',
  'test-chunk-a1.mjs',
  'test-chunk-a2.mjs',
  'test-chunk-a6.mjs',
  'test-chunk-a3.mjs',
  'test-chunk-a4.mjs',
  'test-chunk-a5.mjs',
  'test-chunk-a7.mjs',
  'test-chunk-a9.mjs',
  'test-chunk-a10.mjs',
  'test-chunk-a12.mjs',
  'test-chunk-n3.mjs',
  'test-chunk-n4.mjs',
  'test-chunk-n5.mjs',
  'test-chunk-n6.mjs',
  'test-chunk-n7.mjs',
  'test-chunk-e3.mjs',
  'test-chunk-b1.mjs',
  'test-chunk-b2.mjs',
  'test-chunk-b3.mjs',
  'test-chunk-b4.mjs',
  'test-chunk-b5.mjs',
  'test-chunk-b6.mjs',
  'test-chunk-c1.mjs',
  'test-chunk-c2.mjs',
  'test-mock-parity.mjs',
  'test-chunk-e1.mjs',
  'test-chunk-e2.mjs',
  'test-chunk-e4.mjs',
  'test-chunk-e5.mjs',
  'test-chunk-e6.mjs',
  'test-chunk-e7.mjs',
  'test-chunk-a4b.mjs',
  'test-chunk-b4b.mjs',
  'test-chunk-a13.mjs',
  'test-chunk-s1.mjs',
  'test-chunk-w1.mjs',
  'test-chunk-u1.mjs',
  'test-chunk-u4.mjs',
  'test-chunk-s2.mjs',
  'test-chunk-u3.mjs',
];

const here = dirname(fileURLToPath(import.meta.url));
let total = 0;
const broken = [];
const unreadable = [];

for (const suite of SUITES) {
  const run = spawnSync(process.execPath, [join(here, suite)], { encoding: 'utf8' });
  process.stdout.write(run.stdout || '');
  if (run.stderr) process.stderr.write(run.stderr);

  if (run.status !== 0) {
    broken.push(suite);
    continue;                       // a red suite's count is not evidence of anything
  }
  /**
   * Read the count from the suite's OWN report line. A suite that passes without
   * printing one is not quietly worth zero — it is a suite this runner cannot
   * account for, and it says so rather than lowering the total in silence.
   */
  const m = /✅ all ([\d,]+) /.exec(run.stdout || '')
    || /✅ CHUNK-[A-Za-z0-9]+-GREEN · ([\d,]+) checks/.exec(run.stdout || '');
  if (!m) { unreadable.push(suite); continue; }
  total += Number(m[1].replace(/,/g, ''));
}

if (broken.length) {
  console.log(`\n❌ ${broken.length} suite(s) failed: ${broken.join(', ')}`);
  process.exit(1);
}
if (unreadable.length) {
  console.log(`\n❌ ${unreadable.length} suite(s) passed WITHOUT a countable report line: `
    + `${unreadable.join(', ')} — the total cannot be trusted while a suite is unaccounted for`);
  process.exit(1);
}

if (total !== EXPECTED_ASSERTIONS) {
  // Verbatim the backend's sentence, so the two harnesses speak one language.
  console.log(`\n❌ EXPECTED_ASSERTIONS declares ${EXPECTED_ASSERTIONS} but ${total} assertions ran `
    + `— bump EXPECTED_ASSERTIONS, or find the tests that vanished`);
  process.exit(1);
}

console.log(`\n✅ ${SUITES.length} suites · ${total} assertions · declared count matches`);
