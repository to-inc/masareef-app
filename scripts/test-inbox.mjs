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
import { confirmPayload, editPayload } from '../src/state/fixPayload.js';
import { CATEGORIES, SHORT_LIST } from '../src/lib/constants.js';
import { AR, AR_LOCALE } from '../src/i18n/strings.ar.js';

/**
 * The app renders a category's LABEL and posts its VALUE (finding M2). These
 * expectations go through the same map the screen does, so they keep asserting
 * presence and ordering rather than accidentally asserting the language.
 * The value's survival is pinned at the wire, in test-entry.mjs.
 */
const L = AR_LOCALE.categoryLabel;

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
  const { isSwipe } = mod;
  // ═══ FIELD REPORT 2026-10-09 — a card fee filed as «Elect. Recharge» could not
  // be changed: a logged card locked its buttons, and a second pick sent the
  // stale «❓» claim the server refuses. Both halves, pinned.
  {
    const { refileItem } = await vite.ssrLoadModule('/src/state/fixPayload.js');
    const it = { tab: 'Sep', rowHint: '23/9/2026|65', match: { description: 'Revolut Ultra fee', category: '❓', amount: 65 } };
    ok(refileItem(it, null) === it, 'RF.1 a first filing sends the row exactly as he saw it');
    ok(refileItem(it, { status: 'done', category: 'Elect. Recharge' }).match.category === 'Elect. Recharge',
      'RF.2 a RE-file claims the category the sheet holds now — the one he filed — or the server refuses it');
    ok(refileItem(it, { status: 'conflict', category: 'Car' }) === it, 'RF.3 only a LOGGED card changes the claim');
    const api = await vite.ssrLoadModule('/src/api/index.js');
    const args = (cat, now) => ({ tab: 'Sep', rowHint: 'rf|1', match: { category: now }, newCategory: cat });
    const first = await api.fixCategory(args('Elect. Recharge', '❓'));
    const stale = await api.fixCategory(args('Personal expenses', '❓'));
    const fresh = await api.fixCategory(args('Personal expenses', 'Elect. Recharge'));
    ok(first.ok && stale.error === 'row_changed' && fresh.ok,
      'RF.4 mock parity: the mock refuses a re-file with a stale claim (as the server does) and accepts the current one');
    const filedHtml = renderToStaticMarkup(createElement(InboxView, {
      pending: [{ ...row('Jun', 3, { description: 'OLD FEE' }), stale: true }],
      settled: { [cardKey({ ...row('Jun', 3, { description: 'OLD FEE' }), stale: true })]: { status: 'done', category: 'Car' } },
      onConfirm: () => {}, initialStaleOpen: true }));
    ok(filedHtml.includes(AR.recategorize) && !/class="catchip"[^>]*disabled/.test(filedHtml),
      'RF.5 a logged card stays correctable — its buttons are live under «غيّر النوع لو غلط»');
  }
  // ═══ v4 P6 — «سيبها لبعدين»: the skipped card goes to the END, nothing is written.
  { const { focusQueue } = mod; const k = (x) => ({ key: x });
    const order = (n, sk) => focusQueue(n.map(k), sk).map((r) => r.key).join('');
    ok(order(['a', 'b', 'c'], []) === 'abc', 'P6.1 the queue keeps the rows\' own order');
    ok(order(['a', 'b', 'c'], ['a']) === 'bca', 'P6.2 skipping the focus card moves it to the end — the next one comes up');
    ok(order(['a', 'b', 'c'], ['a', 'b']) === 'cab', 'P6.3 skips queue up in the order he made them');
    ok(order(['b', 'c'], ['a', 'b']) === 'cb', 'P6.4 a skipped row he has since filed simply drops out — a skip never resurrects it'); }

  const render = (pend, sett) =>
    renderToStaticMarkup(createElement(InboxView, { pending: pend, settled: sett, onConfirm: () => {} }));
  const buttons = (html) => (html.match(/<button/g) || []).length;
  const disabled = (html) => (html.match(/disabled=""/g) || []).length;
  const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  const one = [row('Aug', 14)];
  const keyOne = cardKey(one[0]);
  const withStatus = (o) => render(one, { [keyOne]: o });

  const untouched = render(one, {});
  ok(buttons(untouched) >= 6, 'an untouched card offers its categories (v4 P6: a 2×2+ grid and «more»)');
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
  // v4 P6 (R18) RE-CUT: one at a time — a confirmed card LEAVES the focus.
  eq(buttons(done), 0, 'a confirmed card leaves the focus — no control for it remains to double-tap');
  ok(text(done).includes(AR.reviewDone), 'and the screen says he is done');

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
  { const q = withStatus({ status: 'queued', category: 'Car' });
    ok(buttons(q) === 0 && text(q).includes(AR.cardQueued), 'a queued card leaves the focus too — it will send itself, and the screen says so'); }

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
  const { OutcomeNote } = await vite.ssrLoadModule('/src/components/CategoryPicker.jsx');
  const strip = (o) => text(renderToStaticMarkup(createElement(OutcomeNote, { outcome: o })));

  eq(strip(null), '', 'an untouched card has no strip at all');
  ok(strip({ status: 'done', category: 'Team' }).includes('اتسجل ✓'), 'done says so in words');
  ok(strip({ status: 'done', category: 'Team' }).includes(L('Team')),
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
  // v4 P6: the «1 من N» line is the one live region while he files; when the
  // queue empties, the finished line takes its place.
  eq(live(untouched), 1, 'an untouched queue has exactly one live region — the progress line');
  eq(live(done), 1, 'and an emptied one has exactly one — the finished line');
  const confCard = withStatus({ status: 'conflict', category: 'Car', sheetCategory: 'Groceries' });
  ok(text(confCard).includes('النوع اتغير في الشيت'),
    'and the right outcome reaches it — a sentence that exists nowhere else on the screen');
  ok(text(confCard).includes(L('Groceries')), 'carrying the sheet value with it');

  ok(strip({ status: 'saving', category: 'Team' }).includes('بيتسجل…'),
    'in flight, the strip says only that the tap registered');
  for (const s of ['saving', 'conflict', 'failed', 'queued']) {
    ok(!strip({ status: s, category: 'Team', sheetCategory: 'Groceries' }).includes('اتسجل ✓'),
      `${s} NEVER claims the row was recorded — that claim belongs to the server's answer alone`);
  }

  const conf = strip({ status: 'conflict', category: 'Car', sheetCategory: 'Groceries' });
  ok(conf.includes('النوع اتغير في الشيت'), 'a conflict is said plainly, with no error code');
  ok(conf.includes(L('Groceries')), 'and shows what the SHEET says now…');
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
  ok(text(twoLeft).includes(AR.reviewProgress(2, 3)), 'the progress says «2 من 3» once he filed the first');
  // Read from the progress line down: the three rows share a day and an amount,
  // so the look-alike notice ABOVE the focus names all three by design.
  { const focusText = text(twoLeft).slice(text(twoLeft).indexOf(AR.reviewProgress(2, 3)));
    ok(focusText.includes('ALI M**** S') && !focusText.includes('SARA T**** K') && !focusText.includes('MOHAMED G**** R'),
      'and shows ONE card — the next one, not the filed one and not the one after'); }
  const mapOf = (over = {}) => Object.fromEntries(
    three.map((p, i) => [cardKey(p), over[i] || { status: 'done', category: 'Team' }]));
  const allDone = render(three, mapOf());
  ok(text(allDone).includes(AR.reviewDone), 'and when none are left it says so');
  ok(!text(allDone).includes(AR.reviewProgress(4, 3)), 'rather than counting past the end');

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
  ok(!text(lastInFlight).includes(AR.reviewDone),
    'a write still in flight does not earn the ✓ headline');
  ok(text(lastInFlight).includes('بيتسجل…'), 'it says what is actually happening');
  const lastQueued = render(three, mapOf({ 2: { status: 'queued', category: 'Team' } }));
  ok(!text(lastQueued).includes(AR.reviewDone),
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
  // v4 P6: the queue has no section heading any more; the beaded divider lives on
  // SectionLabel, which the duplicate pairs and the Book still use — test it there.
  { const { SectionLabel } = await vite.ssrLoadModule('/src/components/Primitives.jsx');
    const lab = renderToStaticMarkup(createElement(SectionLabel, null, 'x'));
    ok(lab.includes('background-image:url(&quot;data:image/svg+xml,'), 'the divider is painted as a background image');
    ok(!/[·—]{1}\s*—/.test(text(lab)), 'and never as text a screen reader would read out');
    ok(lab.includes('%233E7CA6'), 'its beads are drawn in harbor, from the palette rather than a literal'); }

  // ——— both doors, one handler: the green button and every chip confirm the
  // same way. A second path here is a second place for this bug to come back.
  const handed = [];
  const guessed = [{ ...row('Aug', 14), guess: 'Groceries' }];
  renderToStaticMarkup(createElement(InboxView, {
    pending: guessed, settled: {}, onConfirm: (item, c) => handed.push(c),
  }));
  const src = await readFile(new URL('../src/views/InboxView.jsx', import.meta.url), 'utf8');
  const picker = await readFile(new URL('../src/components/CategoryPicker.jsx', import.meta.url), 'utf8');
  eq((picker.match(/onClick=\{\(\) => onPick\(/g) || []).length, 2,
    'exactly two confirm doors exist — the green guess and the chip grid');
  ok(src.includes("from '../state/inboxOutcomes.js'"),
    'the view imports the shared key rule');
  ok(!/(const|function)\s+cardKey\s*[=(]/.test(src),
    'and does NOT define its own — two key rules would drift and settle silently under the wrong key');

  /**
   * ——— ONE CHIP SHEET, NOT TWO (D16).
   *
   * The Recent list edits the same sheet cells the Inbox does, so it uses the
   * SAME component. If either view grows its own grid again there are two places
   * for the chip order, the inert rule and the outcome states to drift — and the
   * drift is invisible until the two screens disagree in his hand. Asserted by
   * source, because the failure is structural rather than behavioural: two
   * correct-today copies pass every render assertion in this file.
   */
  ok(src.includes("from '../components/CategoryPicker.jsx'"),
    'the Inbox card gets its buttons from the shared picker');
  ok(!/\bCATEGORIES\b|\bSHORT_LIST\b/.test(src),
    'and does not reach for the category list itself — that belongs to the picker alone');

  /**
   * ——— THE CONFIRM SENDS THE ROW'S SHEET POSITION (2026-08-13).
   *
   * This file had 107 assertions and not one of them touched `rowHint` — the
   * fixtures BUILT one on every row and nothing downstream ever checked it
   * reached the wire. Deleting it from the confirm payload left the suite fully
   * green. Found by mutation while pinning the opposite claim for Recent, which
   * is the only reason it surfaced at all: the two payloads are near-identical,
   * and a check on one is not a check on the other.
   *
   * WHAT THE MISSING FIELD ACTUALLY COSTS. Without the hint the server collects
   * every row matching on content and, absent a strict match, takes the FIRST
   * (`locateRow_`). A confirm matches on category `❓` — so two identical
   * unpriced ❓ rows in one month and the write lands on the row he did not tap.
   * No error, no toast, nothing on screen. That is a wrong-row write, not a slow
   * one, which is why this is asserted rather than left to the comment.
   */
  eq(typeof confirmPayload, 'function', 'the confirm payload is built in ONE named place…');
  {
    const item = row('Aug', 14);
    const sent = confirmPayload(item, 'Groceries');

    eq(sent.rowHint, 14, 'and it carries the row\'s sheet position');
    /**
     * ECHOED, NOT INVENTED — and provable only by VARYING it. The first draft of
     * this block asserted `sent.rowHint === item.rowHint` against a single
     * fixture built with 14, and a `rowHint: 14` hardcoded into the builder
     * passed it: the check and the mutation agreed because both said 14. Written
     * ten minutes after this file gained a blind spot, in the assertion closing
     * that blind spot. One value can never prove a pass-through.
     */
    for (const n of [2, 14, 837]) {
      eq(confirmPayload(row('Aug', n), 'Gifts').rowHint, n,
        `position ${n} is the server's own number, echoed — never recomputed here`);
    }
    eq(sent.tab, 'Aug', 'with the tab it came from');
    eq(sent.newCategory, 'Groceries', 'and the category he tapped');
    eq(sent.match, item.match, 'the match is the row as the server described it');
    // Re-cut 2026-10-09 (E-015): `applySimilar` is the contract change, made on
    // purpose — the server files the same merchant's other ❓ rows (only ❓ rows).
    eq(Object.keys(sent).sort().join(','), 'applySimilar,match,newCategory,rowHint,tab',
      'five fields exactly — applySimilar is a deliberate contract change (E-015), not a convenience');

    /**
     * A hint of 0 is what a row with no position would produce, and `locateRow_`
     * rejects anything below 2 (row 1 is the header). Passing it through rather
     * than defaulting is correct — inventing a 1 here would aim a write at his
     * column headings — but it must pass through as ITSELF, not vanish.
     */
    ok('rowHint' in confirmPayload(row('Aug', 0), 'Gifts'),
      'a zero position is still SENT, not dropped as falsy — the server judges it, not us');
    eq(confirmPayload(row('Aug', 0), 'Gifts').rowHint, 0, 'and it is still a zero when it arrives');

    // And the contrast, in the file that owns the other side of it.
    ok(!('rowHint' in editPayload(item, 'Groceries')),
      'while a Recent edit has no rowHint KEY at all — absence, not undefined');
    ok(confirmPayload !== editPayload,
      'the two writes are two functions — unifying them is the mutation this catches');
  }

  /**
   * ——— AND THE SAME CLAIM AT THE WIRE, WHICH IS WHERE IT ACTUALLY LIVES.
   *
   * The blind spot above had a floor below it. `endpoints.js` does not forward
   * the payload — it DESTRUCTURES four named fields and reassembles the body. So
   * deleting `rowHint` from that whitelist strips it from every Inbox confirm on
   * the wire, and the builder assertions above stay green, because they never
   * reach that line. Mutated and confirmed: all thirteen suites, 1,574
   * assertions, fully green with the position gone from the request.
   *
   * Asserting the builder was asserting the layer I had just written rather than
   * the layer that decides. This block calls the real `fixCategory` with the
   * transport stubbed and reads what would have been POSTed.
   *
   * The credentials are obviously fake and local. This never speaks to a
   * deployment, and by law it never speaks to his book.
   */
  {
    const sent = [];
    globalThis.localStorage = {
      getItem: (k) => (k === 'masareef.secret' ? 'not-a-real-secret' : 'http://127.0.0.1:0/exec'),
    };
    globalThis.fetch = async (url, init) => {
      sent.push(JSON.parse(init.body));
      return { ok: true, status: 200, text: async () => '{"ok":true,"v":1}' };
    };
    const { fixCategory } = await import('../src/api/endpoints.js');

    await fixCategory(confirmPayload(row('Aug', 14), 'Groceries'));
    eq(sent.length, 1, 'one confirm is one request — the retry does not double-write');
    eq(sent[0].action, 'fix_category', 'and it is a fix_category');
    eq(sent[0].rowHint, 14, 'THE POSITION IS ON THE WIRE — not merely in the object we built');
    eq(sent[0].newCategory, 'Groceries', 'with the category he tapped');
    eq(sent[0].tab, 'Aug', 'and the tab it belongs to');

    // Pass-through again, at this layer, for the same reason as above: a
    // hardcoded 14 in the whitelist would satisfy a single-value check.
    sent.length = 0;
    await fixCategory(confirmPayload(row('Sep', 837), 'Gifts'));
    eq(sent[0].rowHint, 837, 'any position, echoed through the transport unchanged');

    // The Recent shape, through the SAME transport: the key must not appear.
    sent.length = 0;
    await fixCategory(editPayload({ tab: 'Aug', rowHint: '9/8/2026|60', match: row('Aug', 3).match }, 'Car'));
    ok(!('rowHint' in sent[0]),
      'while a Recent edit reaches the wire with no rowHint at all — the settle key stays home');
    ok(!JSON.stringify(sent[0]).includes('9/8/2026|60'),
      'and the key itself appears nowhere in the request');

    delete globalThis.fetch;
    delete globalThis.localStorage;
  }

  /**
   * And the builders are what the app ACTUALLY calls. Proving a pure function
   * correct while the screen keeps its own inline literal is the exact trap this
   * suite has fallen into three times: a component asserted in isolation and
   * never asserted to be wired.
   */
  const appSrc = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  ok(/confirmPayload\(refileItem\(item, settled\[key\]\), category\)/.test(appSrc),
    'the Inbox confirm calls the builder… (through refileItem, so a re-file claims the current category)');
  ok(/editPayload\(item, category\)/.test(appSrc),
    '…and the Recent edit calls the other one');
  ok(!/newCategory: category \}/.test(appSrc),
    'and neither one still assembles a fix_category payload inline');

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * HOW MANY CHIPS A CARD OPENS WITH — the S7 finding, and a blind spot.
   *
   * This suite had 131 assertions and not one of them rendered the picker's
   * chip grid. `CategoryActions` opened with `useState(!guess)`, so an
   * un-guessed card dropped all twenty-seven categories onto the screen —
   * measured on the device, taller than the whole viewport, which pushed every
   * other waiting card out of view. Changing that initial state to `false` left
   * the suite fully green, which is how the gap was found: the fix was silent,
   * so the behaviour was never pinned.
   *
   * The rule being pinned is NOT "six" as a number — it is that the card the app
   * is LEAST confident about must not be the one that buries the list. D5 is
   * untouched by this: it forbids asserting a category we have not earned, and
   * offering a shortlist asserts nothing.
   */
  const chipNames = (html) => CATEGORIES.filter((c) => html.includes(`>${L(c)}</button>`));

  const unguessed = renderToStaticMarkup(createElement(InboxView, {
    pending: [row('Aug', 14)], settled: {}, onConfirm: () => {},
  }));
  const withGuess = renderToStaticMarkup(createElement(InboxView, {
    pending: [{ ...row('Aug', 14), guess: 'Groceries' }], settled: {}, onConfirm: () => {},
  }));

  // v4 P6: the grid is 2×N — without a guess, five of the shortlist and «more».
  eq(chipNames(unguessed).length, 5,
    'an un-guessed card opens with five of the shortlist in the grid, not the whole schema');
  ok(chipNames(unguessed).length < CATEGORIES.length,
    'and that is strictly fewer than every category — the assertion above must be able to fail');
  ok(unguessed.includes(AR.more),
    'with the way to the other twenty-one on screen, so nothing is unreachable');
  ok(!unguessed.includes(L('omara2 al behar')),
    'a category from the far end of the list is NOT rendered until he asks for it');

  /**
   * The guessed card is the control: same shortlist, minus the one that already
   * has its own green button. A picker that ignored `guess` would pass the
   * count above and offer him the same category twice.
   */
  ok(withGuess.includes(L('Groceries')), 'the guess itself is on screen…');
  /**
   * AND THE FROZEN VALUE IS UNDER IT — both, on this one button (finding M2).
   * It is the tap he makes most, and during the changeover seeing the label
   * beside the value is what lets him check the app against his own sheet.
   */
  ok(withGuess.includes('>Groceries<'), '…with the value his sheet holds printed under it');
  eq(chipNames(withGuess).filter((c) => c === 'Groceries').length, 0,
    '…but never twice — the chip grid drops whatever the green button already says');
  eq(chipNames(withGuess).length, 3,
    'and a guessed card shows THREE alternatives — «ولا…» + the 2×2 grid with «more» (v4 P6)');

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * THE HEADLINE COUNTS WHAT THE BADGE COUNTS — the S3 finding.
   *
   * The badge in App.jsx counts `remaining(reconcile(pending, settled))` over
   * ALL pending rows; the headline used to count only the fresh ones. With two
   * fresh rows and two folded behind «مصاريف قديمة», the app showed a red 4 over
   * a list headed «2 عمليات مستنية». Both numbers were defensible; together they
   * were a contradiction on the home screen.
   */
  {
    const mixed = [
      row('Aug', 14),
      row('Aug', 15, { description: 'SECOND' }),
      { ...row('Jun', 3, { description: 'OLD ONE' }), stale: true },
      { ...row('Jun', 4, { description: 'OLD TWO' }), stale: true },
    ];
    const html = renderToStaticMarkup(createElement(InboxView, {
      pending: mixed, settled: {}, onConfirm: () => {},
    }));
    // The badge's own arithmetic, from the module the shell reads.
    eq(remaining(reconcile(mixed, {})), 4, 'four rows still need him');
    // v4 P6: the progress counts the fresh queue («1 من 2») and the older group
    // counts its own — 2 + 2 is the badge's 4, and both halves are on screen.
    ok(html.includes(AR.reviewProgress(1, 2)), 'the progress counts the fresh queue — «1 من 2»');
    // And the folded group still declares its own share, so 2 + 2 = 4 on screen.
    ok(html.includes(AR.inboxOldTitle(2)),
      'with the folded rows counted where they are folded, so the arithmetic is visible');

    // ═══ E-005 — «Older expenses (2)» stayed 2 after he filed both.
    // `remaining(rows) || rows.length` fell back to the row count at zero.
    const olds = mixed.filter((r) => r.stale);
    const filed = Object.fromEntries(olds.map((r) => [cardKey(r), { status: 'done' }]));
    const after = renderToStaticMarkup(createElement(InboxView, { pending: mixed, settled: filed, onConfirm: () => {} }));
    ok(!after.includes(AR.inboxOldTitle(2)) && after.includes(AR.inboxOldTitle(0)) && !after.includes('(0)'),
      'E005.1 filing both older rows takes the group count to nothing — not back to 2, and never «(0)»');
    const oneFiled = renderToStaticMarkup(createElement(InboxView, {
      pending: mixed, settled: { [cardKey(olds[0])]: { status: 'done' } }, onConfirm: () => {} }));
    ok(oneFiled.includes(AR.inboxOldTitle(1)), 'E005.2 …and filing one of two says 1');
    // ═══ E-006 — a diagonal scroll over a duplicate pair removed a row.
    ok(isSwipe(80, 10) && !isSwipe(80, 70) && !isSwipe(40, 0),
      'E006.1 only a mostly-sideways drag of 56px+ removes — a diagonal scroll (80 across, 70 down) does not');
    // ═══ The unfolded group used to throw (`openEdit` undefined inside StaleGroup).
    let threw = null, opened = '';
    try {
      opened = renderToStaticMarkup(createElement(InboxView, {
        pending: mixed, settled: {}, onConfirm: () => {}, initialStaleOpen: true,
        build: { actions: ['edit_entry'] } }));
    } catch (e) { threw = e; }
    ok(!threw && opened.includes('OLD ONE') && opened.includes('OLD TWO'),
      `E005.3 opening «older expenses» renders its rows instead of crashing (${threw && threw.message})`);
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * THE DEVELOPER BREADCRUMB IS GONE — the S10 finding.
   *
   * «الرسالة الأصلية» opened to reveal `Aug · #14`: a tab name and a row index,
   * on the card he taps most often. The prototype's version of this disclosure
   * showed the original bank SMS, which was worth showing; what survived the
   * port to sheet-backed rows was a place he cannot go, named in a vocabulary he
   * does not use.
   */
  /**
   * ═══════════════════════════════════════════════════════════════════════
   * THE BATCH BUTTON APPEARS WHEN IT EARNS ITS PLACE (finding M4).
   *
   * `batchable` is unit-tested in test-book.mjs; this is the other half, and it
   * is the half this project keeps getting wrong — a correct function beside a
   * view that never mounts it, or mounts it always. Both directions are checked
   * because each alone passes for a button that is permanently on or off.
   */
  {
    const guessed = (n) => Array.from({ length: n }, (_, i) => ({
      ...row('Aug', 20 + i, { description: `SHOP ${i}` }), guess: 'Groceries',
    }));
    // R18: the bulk «سجّل الـN اللي عارفينهم» is DROPPED in focus mode — pinned by
    // its LITERAL copy (a deleted feature stays deleted; a removed key proves nothing).
    const withBatch = renderToStaticMarkup(createElement(InboxView, {
      pending: guessed(3), settled: {}, onConfirm: () => {}, onConfirmMany: () => {},
    }));
    ok(!withBatch.includes('اللي عارفينهم') && (withBatch.match(/class="bigbtn"/g) || []).length === 1,
      'R18: even with a batch handler and three known rows, no bulk button — only the focus card\'s own guess');
  }

  ok(!unguessed.includes('<details'), 'no disclosure triangle on the card any more');
  /**
   * The LITERAL, not the token. This asserts a DELETED feature stays deleted —
   * the disclosure whose label was «الرسالة الأصلية». Pointing it at a live
   * locale key made it hostage to that key: once the key was removed as dead,
   * `AR.inboxOriginal` would be `undefined`, `includes(undefined)` false, and
   * the assertion would pass without measuring anything. A regression test for
   * removed copy pins the copy.
   */
  ok(!unguessed.includes('الرسالة الأصلية'), 'and the label that opened it is gone with it');
  ok(!/#14/.test(unguessed), 'the row index is not printed at him anywhere on the card');
  ok(unguessed.includes('150'), 'while the amount, which IS his, is still there');

  // ——— E-002: the review card's edit door. A row added in the wrong currency
  // had no way to be fixed from the screen that shows it. The door re-uses the
  // Book's EditSheet and posts the card's OWN server-authored tab — gated
  // fail-closed on the server advertising edit_entry (§3.7).
  {
    const editWord = 'عدّل';
    const card = { ...row('Oct', 3), match: { ...row('Oct', 3).match, amount: 15.5, currency: 'EGP' } };
    const withEdit = renderToStaticMarkup(createElement(InboxView, {
      pending: [card], settled: {}, onConfirm: () => {}, build: { actions: ['edit_entry'] },
    }));
    const noEdit = renderToStaticMarkup(createElement(InboxView, {
      pending: [card], settled: {}, onConfirm: () => {}, build: { actions: [] },
    }));
    ok(withEdit.includes(`>${editWord}</button>`), 'E002.1 a review card offers «عدّل» when the server advertises edit_entry');
    ok(!noEdit.includes(`>${editWord}</button>`), 'E002.2 …and offers nothing when it does not — no door that posts into the void');
    ok(/min-height:48px[^"]*"[^>]*>عدّل</.test(withEdit), 'E002.3 …at the senior tap floor');
    const open = renderToStaticMarkup(createElement(InboxView, {
      pending: [card], settled: {}, onConfirm: () => {}, build: { actions: ['edit_entry'] }, initialEditing: card,
    }));
    ok(open.includes('عدّل الصف') && open.includes('15.5') && !withEdit.includes('عدّل الصف'), 'E002.4 tapping it opens the edit sheet on THAT row');
    // ——— E-011: «Remove this row» in the edit sheet — two taps, moved not erased.
    const both = { actions: ['edit_entry', 'remove_entry'] };
    const sheet = (extra) => renderToStaticMarkup(createElement(InboxView, {
      pending: [card], settled: {}, onConfirm: () => {}, build: both, initialEditing: card, ...extra,
    }));
    const idle = sheet({});
    ok(idle.includes('>شيل الصف ده</button>'), 'E011.1 the edit sheet offers «شيل الصف ده» when the server advertises remove_entry');
    ok(!open.includes('>شيل الصف ده</button>'), 'E011.2 …and nothing when it does not (edit_entry only)');
    ok(!idle.includes('أيوه، شيله'), 'E011.3 the first tap only ASKS — no «yes» before he has seen the question');
    ok(/min-height:48px[^"]*"[^>]*>شيل الصف ده</.test(idle), 'E011.4 …at the senior tap floor');
    {
      const ES = (await vite.ssrLoadModule('/src/views/EditSheet.jsx')).default;
      const asked = renderToStaticMarkup(createElement(ES, { item: card, onClose: () => {}, onSaved: () => {}, canRemove: true, initialRemove: 'confirm' }));
      ok(asked.includes('نشيل الصف ده؟') && asked.includes('Removed') && asked.includes('>أيوه، شيله</button>'),
        'E011.5 the second step states where the row goes (the Removed tab) and offers «أيوه، شيله»');
      const done = renderToStaticMarkup(createElement(ES, { item: card, onClose: () => {}, onSaved: () => {}, canRemove: true, initialRemove: { status: 'done' } }));
      ok(done.includes('اتشال') && !done.includes('>أيوه، شيله</button>'), 'E011.6 once removed it says so, and the button is gone');
    }

  }
} finally {
  await vite.close();
}

const report = failures.length
  ? `❌ ${failures.length} / ${pass + failures.length} inbox checks failed:\n  - ${failures.join('\n  - ')}`
  : `✅ all ${pass} inbox checks passed`;
console.log(report);
process.exit(failures.length ? 1 : 0);
