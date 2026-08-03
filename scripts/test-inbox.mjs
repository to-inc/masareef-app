#!/usr/bin/env node
/**
 * The Inbox card's completion cue (WS3-C).  `npm run check:inbox`
 *
 * FIELD BUG, 2026-08-03. He categorised nine transfer cards and reported that a
 * card "doesn't get greyed out or removed — no cue which ones are done".
 *
 * Reproduced in the browser before a line was changed, and the reproduction is
 * what these fixtures are built from:
 *
 *   • on `row_changed` the card was optimistically removed and then silently
 *     restored by `refresh()` — the ONE branch with no toast, so the before and
 *     after screenshots were pixel-identical;
 *   • on success the card was removed and came back on the next refetch,
 *     because the app kept NO record of what it had confirmed;
 *   • `showToast(S.saved)` fired before the request was sent, so "اتسجل ✓"
 *     was shown for writes that failed.
 *
 * The question asked of every assertion below is the house one: what wrong
 * implementation would still pass this? The answer has to be "the one that
 * shipped" for at least the load-bearing ones, or the suite is decoration.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';
import {
  OUTCOMES, isOutcome, cardKey, outcomeFor, needsHim,
  reconcile, remaining, headlineFor, pruneSettled, applyCategoryToToday,
} from '../src/state/inboxOutcomes.js';

let pass = 0;
const failures = [];
const eq = (a, b, label) => {
  if (Object.is(a, b)) { pass++; return; }
  failures.push(`${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const ok = (c, label) => eq(!!c, true, label);

const row = (tab, rowHint, over = {}) => ({
  tab,
  rowHint,
  match: {
    date: '3/8/2026', description: 'MOHAMED G**** R', method: 'Visa',
    category: '❓', amount: 150, currency: 'EGP', ...over,
  },
  guess: null,
  stale: false,
});

// ——————————————————————— the vocabulary
eq(OUTCOMES.length, 6, 'exactly six outcomes — adding one silently is a design change');
ok(isOutcome('conflict'), 'conflict is a real outcome, distinct from failed');
ok(!isOutcome('pending'), 'there is NO "pending" outcome — an untapped card has none at all');
ok(!isOutcome(undefined), 'and undefined is not a synonym for one');

/**
 * ——————————————————————— what the SERVER said, not what he tapped.
 *
 * The strict `ok === true` matters: `{ok:"yes"}` is what a truncated or older
 * deployment can answer, and `if (res.ok)` would call it a success and stamp a
 * ✓ over a row that was never written. Same for a dropped response — `null` is
 * not a yes.
 */
eq(outcomeFor({ ok: true }, false, 'Car').status, 'done', 'ok:true is done');
eq(outcomeFor({ ok: true }, false, 'Car').category, 'Car', 'and it names the category written');
eq(outcomeFor({ ok: 'yes' }, false, 'Car').status, 'failed',
  'a truthy-but-not-true ok is NOT a success');
eq(outcomeFor(null, false, 'Car').status, 'failed',
  'and neither is a dropped response — never done');
eq(outcomeFor(undefined, true, 'Car').status, 'queued', 'a call that threw is queued, not failed');

eq(outcomeFor({ ok: false, error: 'row_not_found' }, false, 'Car').status, 'already',
  'row_not_found means he already fixed it in the sheet');
eq(outcomeFor({ ok: false, error: 'internal' }, false, 'Car').status, 'failed',
  'an unrecognised error is a failure…');
eq(outcomeFor({ ok: false, error: 'internal' }, false, 'Car').error, 'internal',
  '…with the code kept, not flattened');
eq(outcomeFor({ ok: false }, false, 'Car').error, 'unknown',
  'an error with no code is reported as unknown, never as success');
eq(outcomeFor({ ok: false }, false, 'Car').status, 'failed',
  'and the unnamed case fails loud — it never lands in done');

/**
 * THE TWO CATEGORIES OF A CONFLICT. `Car` is what he pressed; `Groceries` is
 * what the sheet holds because he fixed it there himself. They are deliberately
 * DIFFERENT in this fixture: an implementation that stored the tapped value in
 * `sheetCategory` — the exact honest-render violation this rev is about — would
 * pass any fixture where the two happened to be equal.
 */
const conflict = outcomeFor(
  { ok: false, error: 'row_changed', current: { category: 'Groceries' } }, false, 'Car');
eq(conflict?.status, 'conflict', 'row_changed is its own outcome, not a generic failure');
eq(conflict?.sheetCategory, 'Groceries', 'and it carries what the SHEET says now');
eq(conflict?.category, 'Car', 'while still remembering what he tapped');
eq(outcomeFor({ ok: false, error: 'row_changed', current: { category: '  Groceries ' } }, false, 'x')
  .sheetCategory, 'Groceries', 'the sheet value is trimmed, as everywhere else');
// The contract writes `current:{...}` without naming its fields (06 §3.2), so a
// conflict we cannot read must still produce a real cue rather than "undefined".
eq(outcomeFor({ ok: false, error: 'row_changed' }, false, 'Car').sheetCategory, null,
  'a conflict with no readable current names no category at all');
eq(outcomeFor({ ok: false, error: 'row_changed', current: { category: 42 } }, false, 'Car')
  .sheetCategory, null, 'and a non-string current is refused rather than coerced');

// ——————————————————————— what he still has to do
ok(needsHim(null), 'a card he has not touched needs him');
ok(needsHim({ status: 'conflict' }), 'a conflict needs him — his edit and his tap disagree');
ok(needsHim({ status: 'failed' }), 'a failure needs him — it was never written');
ok(!needsHim({ status: 'done' }), 'a written row does not');
ok(!needsHim({ status: 'already' }), 'nor one he had already fixed himself');
ok(!needsHim({ status: 'queued' }), 'nor one waiting for the network — his part is done');
ok(!needsHim({ status: 'saving' }), 'nor one in flight');
ok(needsHim({ status: 'nonsense' }), 'and an unknown status is treated as unfinished, never as done');

// ——————————————————————— card identity
eq(cardKey(row('Aug', 14)), cardKey(row('Aug', 14)), 'the same row keys the same');
ok(cardKey(row('Aug', 14)) !== cardKey(row('Jul', 14)),
  'the TAB is part of the key — row 14 exists in all twelve tabs');
ok(cardKey(row('Aug', 14)) !== cardKey(row('Aug', 15)), 'and so is the row');
ok(cardKey(row('Aug', 14)) !== cardKey(row('Aug', 14, { description: 'someone else' })),
  'a different row arriving at the same sheet position cannot inherit its ✓');
eq(typeof cardKey(undefined), 'string', 'a malformed item yields a key rather than a crash');

/**
 * ——————————————————————— THE RESURRECTION FIXTURE.
 *
 * This is the one that kills the implementation that shipped. That code removed
 * the card from local state and rendered `pending[]` raw; it passes any test
 * asking "is the card gone after a tap?", because it is. What it cannot do is
 * survive the next refetch, which hands back a pending list that STILL contains
 * the row — exactly the list below.
 */
const pending = [row('Aug', 14), row('Aug', 15, { description: 'ALI M**** S' }), row('Aug', 16, { description: 'SARA T**** K' })];
const settled = { [cardKey(pending[0])]: { status: 'done', category: 'Team' } };
const rows = reconcile(pending, settled);
eq(rows.length, 3, 'every row the server still sends is still a row');
eq(rows[0].outcome?.status, 'done',
  'a row the server RE-SENDS after a successful write renders as done, not as untouched');
eq(rows[0].item, pending[0], 'and it is the same row, not a reconstruction');
eq(rows[1].outcome, null,
  'while a row he never touched carries no outcome — a reconcile that tags everything is caught here');
eq(rows[0].key, cardKey(pending[0]), 'rows are keyed by the shared key rule');
eq(reconcile(null, settled).length, 0, 'a missing pending list is empty, not a crash');
eq(reconcile(pending, null).length, 3, 'and a missing settled map settles nothing');

eq(remaining(rows), 2, 'the count drops by the one he finished');
eq(remaining(reconcile(pending, { [cardKey(pending[0])]: { status: 'conflict' } })), 3,
  'but a CONFLICT still counts — it is unfinished, and counting by "has an outcome" would hide it');
eq(remaining(reconcile(pending, Object.fromEntries(pending.map((p) => [cardKey(p), { status: 'done' }])))), 0,
  'all confirmed → nothing left');
eq(remaining(null), 0, 'and no rows is no work');

/**
 * ——————————————————————— the headline is a different question from the count.
 * `remaining` answers "does he have work left"; the ✓ answers "is it all in the
 * sheet". Conflating them puts a ✓ over a write that is still in flight, or over
 * one sitting in the outbox that is explicitly NOT written.
 */
const settledAll = (s) => Object.fromEntries(pending.map((p) => [cardKey(p), { status: s }]));
eq(headlineFor(reconcile(pending, settledAll('done'))).kind, 'done',
  'all written → the ✓ headline is earned');
eq(headlineFor(reconcile(pending, { ...settledAll('done'), [cardKey(pending[2])]: { status: 'saving' } })).kind,
  'saving', 'one still in flight → it is not');
eq(headlineFor(reconcile(pending, { ...settledAll('done'), [cardKey(pending[2])]: { status: 'queued' } })).kind,
  'queued', 'one waiting for the network → nor then');
eq(headlineFor(reconcile(pending, { [cardKey(pending[0])]: { status: 'saving' } })).kind, 'waiting',
  'and an unfinished row outranks an in-flight one — he still has work');
eq(headlineFor(reconcile(pending, { [cardKey(pending[0])]: { status: 'done' } })).count, 2,
  'the waiting headline carries the count he has left');
eq(headlineFor(null).kind, 'done', 'no rows is not a lie — there is nothing to misreport');

/**
 * ——————————————————————— pruning, and the half that must NOT happen.
 * "Clear the map after every fetch" would shrink it just as well and would undo
 * the whole fix, so the keep case is asserted first.
 */
const pruned = pruneSettled(settled, pending);
eq(Object.keys(pruned).length, 1,
  'a record for a row the server STILL lists survives the refetch');
eq(pruned[cardKey(pending[0])]?.status, 'done', 'intact, not merely present');
eq(Object.keys(pruneSettled(settled, [pending[1]])).length, 0,
  'and one for a row it has stopped listing is forgotten');
eq(Object.keys(settled).length, 1, 'the input map is never mutated');

/**
 * ——————————————————————— THE DOUBLE-COUNT (second field bug, same function).
 *
 * `fix_category` writes ONE cell. The old code appended the confirmed row to
 * `today.entries` and added its amount to `today.totals` — but the row was
 * already in both, because the server builds `today` and `pending` from the one
 * blob and filters today on the DATE alone. Nine taps inflated his Visa total by
 * the sum of nine transfers.
 *
 * `Object.is` on the totals is the assertion that kills it: an implementation
 * that adds to them cannot return the identical object.
 */
const today = {
  entries: [
    { date: '3/8/2026', description: 'Coffee', method: 'Cash', category: 'Eating out', amount: 60, currency: 'EGP' },
    { date: '3/8/2026', description: 'MOHAMED G**** R', method: 'Visa', category: '❓', amount: 150, currency: 'EGP' },
  ],
  totals: { Visa: 150, Cash: 60 },
};
const after = applyCategoryToToday(today, pending[0].match, 'Team');
eq(after.entries?.length, 2, 'no row is added — it was already there');
eq(after.entries?.[1]?.category, 'Team', 'the category is changed in place');
eq(after.totals, today.totals, 'and the TOTALS are the identical object — nothing is re-counted');
eq(after.entries?.[0]?.category, 'Eating out', 'other rows are untouched');
eq(today.entries[1].category, '❓', 'and the input is not mutated');

// A row from a PREVIOUS month is in `pending` but not in `today`. The old code
// appended it, showing a July purchase as today's spending.
const older = applyCategoryToToday(today, { ...pending[0].match, date: '22/7/2026' }, 'Team');
eq(older, today, 'a row that is not in today changes today not at all — the same object back');

// Interchangeable ❓ twins: patch the first, exactly as locateRow_ does.
const twins = {
  entries: [
    { date: '3/8/2026', description: 'X', method: 'Cash', category: '❓', amount: 10, currency: 'EGP' },
    { date: '3/8/2026', description: 'X', method: 'Cash', category: '❓', amount: 10, currency: 'EGP' },
  ],
  totals: { Visa: 0, Cash: 20 },
};
const twinned = applyCategoryToToday(twins, twins.entries[0], 'Gifts');
eq(twinned.entries?.[0]?.category, 'Gifts', 'among identical twins the first is patched');
eq(twinned.entries?.[1]?.category, '❓', 'and only the first');
eq(applyCategoryToToday(null, pending[0].match, 'Team'), null, 'no today, no crash');

// ——————————————————————— rendered
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });

try {
  const mod = await vite.ssrLoadModule('/src/views/InboxView.jsx');
  const InboxView = mod.default;

  const render = (pend, sett) =>
    renderToStaticMarkup(createElement(InboxView, { pending: pend, settled: sett, onConfirm: () => {} }));
  const buttons = (html) => (html.match(/<button/g) || []).length;
  const disabled = (html) => (html.match(/disabled=""/g) || []).length;
  const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  const one = [row('Aug', 14)];
  const keyOne = cardKey(one[0]);
  const withStatus = (o) => render(one, { [keyOne]: o });

  const untouched = render(one, {});
  ok(buttons(untouched) > 6, 'an untouched card offers its categories');
  eq(disabled(untouched), 0, 'and every one of them is live');
  eq(untouched, render(one, { [keyOne]: undefined }),
    'a card with no outcome renders exactly as it always did — no drift for the ordinary case');

  /**
   * A FINISHED CARD KEEPS ITS BUTTONS, DEAD. Removing them is the tidier fix and
   * the wrong one: in a nine-card batch the list would shorten under his thumb
   * between the tap and the next reach, and he would land on a card he never
   * meant to touch. So the count must not change and the buttons must not work —
   * two assertions, because either alone is satisfied by the wrong answer.
   */
  const done = withStatus({ status: 'done', category: 'Team' });
  eq(buttons(done), buttons(untouched), 'a confirmed card is the same height — nothing is removed');
  eq(disabled(done), buttons(done), 'and every button on it is dead');

  const saving = withStatus({ status: 'saving', category: 'Team' });
  eq(disabled(saving), buttons(saving), 'a card in flight is dead too — no double-write from a double-tap');

  /**
   * A CONFLICT AND A FAILURE STAY LIVE. This is his retry path: the row was not
   * written, so the card must still be tappable. An implementation that greyed
   * every settled state alike would pass every assertion above and strand him.
   */
  eq(disabled(withStatus({ status: 'conflict', category: 'Car', sheetCategory: 'Groceries' })), 0,
    'a conflicted card is still tappable');
  eq(disabled(withStatus({ status: 'failed', category: 'Car', error: 'internal' })), 0,
    'and so is a failed one');
  eq(disabled(withStatus({ status: 'queued', category: 'Car' })), buttons(untouched),
    'a queued card is inert — it will send itself');

  /**
   * ——— THE WORDS, ASSERTED ON THE STRIP ITSELF.
   *
   * A first draft made these claims against the WHOLE card render and three of
   * them failed for reasons that had nothing to do with the strip: «كله اتسجل ✓»
   * in the section header contains «اتسجل ✓», and the chip grid contains a chip
   * labelled `Car`. Both are correct renders. The assertion was landing on a
   * neighbour of the claim — the fourth time this project has caught that — so
   * the subject is now rendered alone, and a separate assertion proves the card
   * actually mounts it.
   */
  const { OutcomeNote } = mod;
  const strip = (o) => text(renderToStaticMarkup(createElement(OutcomeNote, { outcome: o })));

  eq(strip(null), '', 'an untouched card has no strip at all');
  ok(strip({ status: 'done', category: 'Team' }).includes('اتسجل ✓'), 'done says so in words');
  ok(strip({ status: 'done', category: 'Team' }).includes('Team'),
    'and names the category that was written');

  /**
   * AND THE CARD ACTUALLY MOUNTS IT. Proving the component says the right words
   * proves nothing if nothing renders it — the mutation `<OutcomeNote
   * outcome={null} />` removes every cue from every card and is invisible to
   * every assertion above.
   *
   * A first draft checked `text(done).includes('اتسجل ✓')` and that mutation
   * SURVIVED: the section header reads «كله اتسجل ✓» when nothing is left, so
   * the assertion was satisfied by the header while the card showed nothing.
   * Same class as the three neighbour-of-the-claim specimens already in the
   * ledger, caught here by the mutation matrix rather than by review.
   *
   * So: the strip is the card's one aria-live region — a real property, since
   * the outcome must be announced and not merely coloured — and the string
   * checked below appears in the strip and nowhere else on the screen.
   */
  const live = (html) => (html.match(/aria-live="polite"/g) || []).length;
  eq(live(untouched), 0, 'an untouched card announces nothing');
  eq(live(done), 1, 'a settled card has exactly one live region — the strip is mounted');
  const confCard = withStatus({ status: 'conflict', category: 'Car', sheetCategory: 'Groceries' });
  ok(text(confCard).includes('النوع اتغير في الشيت'),
    'and the right outcome reaches it — a sentence that exists nowhere else on the screen');
  ok(text(confCard).includes('Groceries'), 'carrying the sheet value with it');

  ok(strip({ status: 'saving', category: 'Team' }).includes('بيتسجل…'),
    'in flight, the strip says only that the tap registered');
  for (const s of ['saving', 'conflict', 'failed', 'queued']) {
    ok(!strip({ status: s, category: 'Team', sheetCategory: 'Groceries' }).includes('اتسجل ✓'),
      `${s} NEVER claims the row was recorded — that claim belongs to the server's answer alone`);
  }

  const conf = strip({ status: 'conflict', category: 'Car', sheetCategory: 'Groceries' });
  ok(conf.includes('النوع اتغير في الشيت'), 'a conflict is said plainly, with no error code');
  ok(conf.includes('Groceries'), 'and shows what the SHEET says now…');
  ok(!conf.includes('Car'), '…never the category he pressed');

  const blind = strip({ status: 'conflict', category: 'Car', sheetCategory: null });
  ok(blind.includes('النوع اتغير في الشيت'),
    'a conflict whose current we could not read still gets a real sentence');
  ok(!/undefined|null/.test(blind), 'and never renders "undefined" at him');

  ok(!strip({ status: 'failed', category: 'Car', error: 'internal' }).includes('internal'),
    'a failure never shows him an error code');
  ok(strip({ status: 'failed', category: 'Car', error: 'internal' }).length > 0,
    'but it does say something — silence is what the row_changed branch used to do');

  /**
   * THE HEADER COUNTS WHAT IS HIS, NOT WHAT IS ON SCREEN. The old badge read
   * `pending.length`, which is how he could confirm four cards and still be told
   * four were waiting.
   */
  const three = [row('Aug', 14), row('Aug', 15, { description: 'ALI M**** S' }), row('Aug', 16, { description: 'SARA T**** K' })];
  const twoLeft = render(three, { [cardKey(three[0])]: { status: 'done', category: 'Team' } });
  ok(text(twoLeft).includes('2 عمليات مستنية'), 'the header counts the two he has left');
  ok(!text(twoLeft).includes('3 عمليات'), 'not the three still on screen');
  const mapOf = (over = {}) => Object.fromEntries(
    three.map((p, i) => [cardKey(p), over[i] || { status: 'done', category: 'Team' }]));
  const allDone = render(three, mapOf());
  ok(text(allDone).includes('كله اتسجل ✓'), 'and when none are left it says so');
  ok(!text(allDone).includes('0 عمليات'), 'rather than announcing zero waiting operations');

  /**
   * ——— AND THE ✓ HEADLINE HAS TO BE EARNED.
   *
   * "Nothing left for him to do" and "everything is recorded" are different
   * statements, and `remaining` only measures the first. It hits zero the
   * instant he taps the last card — while that write is still in flight — and it
   * is also zero when a card is sitting in the outbox explicitly NOT written.
   * A header reading «كله اتسجل ✓» in either state is the same lie the toast used
   * to tell, moved one line up the screen. Caught by this suite before it
   * shipped, which is the only reason it is here.
   */
  const lastInFlight = render(three, mapOf({ 2: { status: 'saving', category: 'Team' } }));
  ok(!text(lastInFlight).includes('كله اتسجل ✓'),
    'a write still in flight does not earn the ✓ headline');
  ok(text(lastInFlight).includes('بيتسجل…'), 'it says what is actually happening');
  const lastQueued = render(three, mapOf({ 2: { status: 'queued', category: 'Team' } }));
  ok(!text(lastQueued).includes('كله اتسجل ✓'),
    'and neither does one waiting for the network — that row is explicitly unwritten');
  ok(text(lastQueued).includes('هيتسجّل أول ما النت يرجع'), 'which is said instead');

  /**
   * ——— THE SECTION DIVIDER'S MORSE BEADS ARE DECORATION (D15).
   *
   * `·— ———` is A O — the same two letters the icon carries structurally. As
   * TEXT they would be announced by VoiceOver as a run of punctuation before
   * every section heading, which is noise in front of the one line he needs. As
   * a CSS background they are skipped entirely. That is the whole reason the
   * brief specified a background, so it is asserted rather than trusted.
   */
  ok(untouched.includes('background-image:url(&quot;data:image/svg+xml,'),
    'the divider is painted as a background image');
  ok(!/[·—]{1}\s*—/.test(text(untouched).replace(/—\s*دوس/g, '')),
    'and never as text a screen reader would read out');
  ok(untouched.includes('%233E7CA6'),
    'its beads are drawn in harbor, from the palette rather than a literal');

  // ——— both doors, one handler: the green button and every chip confirm the
  // same way. A second path here is a second place for this bug to come back.
  const handed = [];
  const guessed = [{ ...row('Aug', 14), guess: 'Groceries' }];
  renderToStaticMarkup(createElement(InboxView, {
    pending: guessed, settled: {}, onConfirm: (item, c) => handed.push(c),
  }));
  const src = await readFile(new URL('../src/views/InboxView.jsx', import.meta.url), 'utf8');
  eq((src.match(/onClick=\{\(\) => onConfirm\(/g) || []).length, 2,
    'exactly two confirm doors exist — the green guess and the chip grid');
  ok(src.includes("from '../state/inboxOutcomes.js'"),
    'the view imports the shared key rule');
  ok(!/(const|function)\s+cardKey\s*[=(]/.test(src),
    'and does NOT define its own — two key rules would drift and settle silently under the wrong key');
} finally {
  await vite.close();
}

const report = failures.length
  ? `❌ ${failures.length} / ${pass + failures.length} inbox checks failed:\n  - ${failures.join('\n  - ')}`
  : `✅ all ${pass} inbox checks passed`;
console.log(report);
process.exit(failures.length ? 1 : 0);
