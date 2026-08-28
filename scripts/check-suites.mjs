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
 */
const EXPECTED_ASSERTIONS = 5581;

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
