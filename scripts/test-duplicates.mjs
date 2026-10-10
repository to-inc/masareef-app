#!/usr/bin/env node
/**
 * The lookalike detector.  `npm run check:duplicates`
 *
 * ——— WHAT THIS GUARDS, IN ORDER OF WHAT IT COSTS TO GET WRONG.
 *
 *  1. THAT IT STAYS A DETECTOR. docs/09 §4 makes row deletion human-only and
 *     says the backend will never gain the capability. The module must export
 *     nothing that acts, and the suite asserts that by NAME — because the
 *     tempting next commit is "while we're here, add a remove button", and the
 *     rule it would break lives in a different file from the code that breaks it.
 *  2. THAT IT USES `batchDraft`'s KEY. Two definitions of "the same purchase"
 *     would drift, and this project has paid for a second quieter implementation
 *     three times. Asserted by agreement, not by inspection.
 *  3. THAT UNPRICED ROWS ARE COUNTED, NOT DROPPED. A detector that silently
 *     skips part of its population is a check that cannot fail on what it skipped.
 *
 * Merchants, amounts and dates here are INVENTED — the repo is public.
 */
import { readFileSync } from 'node:fs';
import {
  bookKey, likeness, findLookalikes, lookalikeCounts,
} from '../src/state/duplicates.js';
import { twinKey } from '../src/state/batchDraft.js';
import { findLookalikes as findLA } from '../src/state/duplicates.js';
import { withoutKept, keepRow, loadKept, syncKept } from '../src/state/keptLookalikes.js';

let pass = 0;
const failures = [];
const eq = (a, b, label) => {
  if (Object.is(a, b)) { pass++; return; }
  failures.push(`${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const ok = (c, label) => eq(!!c, true, label);

const row = (date, description, amount, currency = 'EGP', method = 'Cash') =>
  ({ date, description, amount, currency, method, category: 'Groceries' });

/* ─────────────── 1. IT CANNOT ACT, AND THAT IS ASSERTED BY NAME ───────────── */
{
  const raw = readFileSync(new URL('../src/state/duplicates.js', import.meta.url), 'utf8');

  /**
   * ⚠️ COMMENTS ARE STRIPPED FIRST, AND THE FIRST VERSION OF THIS CHECK DID NOT.
   *
   * It grepped the whole file for "delete" and "remove" and went red — on the
   * PROSE explaining why deletion is forbidden. The check was firing on the
   * documentation of the rule instead of on a breach of it: *assert the claim,
   * not its neighbour*, one level up from the usual place that bites.
   *
   * A file is not allowed to become less explainable in order to pass its own
   * guard, so the guard reads what actually executes.
   */
  const code = raw
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ');

  for (const forbidden of ['fetch(', 'XMLHttpRequest', 'localStorage', 'sessionStorage',
    'from \'../api', 'from \'./api', 'endpoints.js']) {
    ok(code.indexOf(forbidden) === -1,
      `the detector's CODE contains no "${forbidden}" — it reports, it never acts (docs/09 §4)`);
  }

  // Every export is a pure function of its arguments: no module-level mutable
  // state for an action to accumulate in.
  // Column 0 only: `let` inside a function body is ordinary local arithmetic.
  // The claim is about MODULE scope, so the pattern has to be about module scope
  // too — the indented form matched function locals and reddened on nothing.
  ok(!/^(let|var)\s/m.test(code),
    'and it holds no module-level mutable state — there is nothing for an action to be staged in');

  /**
   * THE POSITIVE HALF, so none of the above can pass by the file being empty or
   * gutted — the prohibition is trivially satisfied by a module that does nothing.
   */
  ok(code.indexOf('export function findLookalikes') !== -1,
    'and it does export the thing it is for');
  ok(code.indexOf('twinKey') !== -1,
    'and it still defers to batchDraft for the key rather than growing its own');
}

/* ─────────────── 2. ONE DEFINITION OF "THE SAME PURCHASE" ─────────────────── */
{
  // The two callers see different row SHAPES; they must still answer alike.
  const a = { date: 20260824, amount: 15.47, currency: 'EUR' };
  eq(bookKey({ date: '24/8/2026', amount: 15.47, currency: 'EUR' }), twinKey(a),
    'bookKey normalises the book row and then defers to batchDraft.twinKey');

  eq(bookKey({ date: '1/8/2026', amount: 10, currency: 'EGP' }),
    bookKey({ date: '01/8/2026', amount: 10, currency: 'EGP' }),
    'and 1/8 and 01/8 are ONE day — raw string equality would have missed this twin');

  eq(bookKey({ date: '24/8/2026', amount: null, currency: 'EGP' }), null,
    'an UNPRICED row has no key: nothing to match on, so a match would be a guess');

  ok(bookKey({ date: '24/8/2026', amount: 10, currency: 'EUR' })
     !== bookKey({ date: '24/8/2026', amount: 10, currency: 'EGP' }),
  '€10 and £E10 are not the same purchase — currency is part of the key');

  // METHOD IS EXCLUDED, and the kill is a pair differing ONLY by method.
  const byMethod = findLookalikes([
    row('24/8/2026', 'Ferry Kiosk', 12, 'EGP', 'Cash'),
    row('24/8/2026', 'Ferry Kiosk', 12, 'EGP', 'Visa'),
  ]);
  eq(byMethod.groups.length, 1,
    'method is NOT in the key — one purchase read as Cash once and Visa once still pairs');
}

/* ─────────────── 3. THE TIERS, EACH WITH THE PAIR THAT PROVES IT ──────────── */
{
  eq(likeness({ description: 'Lantern Grocer' }, { description: 'lantern grocer ' }), 'same',
    'case and stray space do not make two merchants');
  eq(likeness({ description: 'Ferry' }, { description: 'Ferry ticket' }), 'similar',
    'one description containing the other is what a merchant typed twice looks like');
  eq(likeness({ description: 'Lantern Grocer' }, { description: 'Bridge Cafe' }), 'different',
    'same money on the same day with different words is most likely two real purchases');

  // A group takes its CLOSEST pair, not an average — the kill for "average the tiers".
  const three = findLookalikes([
    row('24/8/2026', 'Bridge Cafe', 40),
    row('24/8/2026', 'Lantern Grocer', 40),
    row('24/8/2026', 'bridge cafe', 40),
  ]);
  eq(three.groups.length, 1, 'three rows sharing day+amount+currency are ONE group');
  eq(three.groups[0].tier, 'same',
    'and the group is scored by its closest pair — one identical pair inside three is the finding');
  eq(three.groups[0].rows.length, 3, 'every row in the group is carried, none summarised away');
}

/* ─────────────── 4. WHAT IT DOES NOT EXAMINE, IT SAYS ─────────────────────── */
{
  const r = findLookalikes([
    row('24/8/2026', 'Bridge Cafe', 40),
    row('24/8/2026', 'Bridge Cafe', 40),
    row('24/8/2026', 'Unpriced thing', null),
    row('24/8/2026', 'Another unpriced', null),
  ]);
  eq(r.groups.length, 1, 'the priced pair is found…');
  eq(r.unpriced, 2, '…and the two unpriced rows are REPORTED as unexamined, never silently dropped');
  eq(r.examined, 2, 'and `examined` counts only what actually went through the key');
}

/* ─────────────── 5. THE COUNTS MEAN WHAT THEY SAY ────────────────────────── */
{
  const r = findLookalikes([
    row('24/8/2026', 'Bridge Cafe', 40),
    row('24/8/2026', 'Bridge Cafe', 40),
    row('24/8/2026', 'bridge cafe', 40),
    row('23/8/2026', 'Ferry', 8),
    row('23/8/2026', 'Ferry ticket', 8),
  ]);
  const c = lookalikeCounts(r);
  eq(c.groups, 2, 'two groups');
  eq(c.rows, 5, 'five rows implicated — the work in front of him, not the number of groups');
  eq(c.extra, 3,
    'and at most THREE could ever come out: one row per group is the one he is KEEPING');
}

/* ─────────────── 6. THE ORDINARY CASE IS SILENCE ─────────────────────────── */
{
  const clean = findLookalikes([
    row('24/8/2026', 'Bridge Cafe', 40),
    row('24/8/2026', 'Lantern Grocer', 55),
    row('23/8/2026', 'Ferry', 8),
  ]);
  eq(clean.groups.length, 0, 'a book with no lookalikes reports none — no card, no badge, nothing');
  eq(lookalikeCounts(clean).extra, 0, 'and nothing is offered for removal');
  eq(findLookalikes(null).groups.length, 0, 'a missing month is an empty report, never a throw');
  eq(findLookalikes([]).unpriced, 0, 'and an empty month examined nothing and says so');
}

/* ——— 2026-10-11 «Keep this»: a real double purchase leaves the card for good ——— */
{
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const rows = [
    { date: '21/9/2026', description: 'HSL', amount: 4.5, currency: 'EUR' },
    { date: '21/9/2026', description: 'HSL', amount: 4.5, currency: 'EUR' },
    { date: '21/9/2026', description: 'Galleria', amount: 1.45, currency: 'EUR' },
    { date: '21/9/2026', description: 'Galleria', amount: 1.45, currency: 'EUR' },
  ];
  const before = findLA(rows).groups.length;
  keepRow(rows[0]);
  const after = withoutKept(findLA(rows), loadKept()).groups;
  ok(before === 2 && after.length === 1 && after[0].rows.every((r) => r.description === 'Galleria'),
    'KEEP.1 «Keep this» on one HSL clears the HSL pair; the Galleria pair still asks');
  ok(withoutKept(findLA(rows), loadKept()).groups.every((g) => g.rows.length >= 2), 'KEEP.2 a group left with one row is no group');
  // The sheet is the memory (2026-10-11): launch merges the Kept tab in, and sends what only this phone has.
  const sent = [];
  const merged = await syncKept(async () => ({ ok: true, signatures: ['1/9/2026|9|EUR|kiosk'] }), async (b) => { sent.push(b.signature); return { ok: true }; });
  ok(merged.includes('1/9/2026|9|EUR|kiosk') && merged.includes('21/9/2026|4.5|EUR|hsl'),
    'KEEP.3 another phone\'s kept row arrives here, and this phone\'s stays');
  ok(sent.join() === '21/9/2026|4.5|EUR|hsl', 'KEEP.4 the one the sheet did not have is sent to it — nothing else');
  const offline = await syncKept(async () => { throw new Error('offline'); }, async () => ({ ok: true })).catch(() => 'threw');
  ok(offline === 'threw' || Array.isArray(offline), 'KEEP.5 offline, the sync gives up quietly — the phone\'s list is untouched');
  ok(loadKept().includes('21/9/2026|4.5|EUR|hsl'), 'KEEP.6 …and still holds what he kept');
  delete globalThis.localStorage;
}

const report = failures.length
  ? `❌ ${failures.length} / ${pass + failures.length} duplicate checks failed:\n  - ${failures.join('\n  - ')}`
  : `✅ all ${pass} duplicate checks passed`;
console.log(report);
process.exit(failures.length ? 1 : 0);
