#!/usr/bin/env node
/**
 * The batch review draft (D20).  `npm run check:batch`
 *
 * ——— WHAT THIS GUARDS, IN ORDER OF WHAT IT COSTS TO GET WRONG.
 *
 *  1. `row_status` reaching the wire — it would let a DECLINED row be written:
 *     money that never left his account, in his book, with nothing on screen to
 *     notice it by. The server refuses it; this makes the client incapable of
 *     asking.
 *  2. Twins collapsing — two identical real purchases exist. Auto-merging one
 *     away deletes an expense he made, silently.
 *  3. Edits lost on a re-snap — his ticks and corrections are the expensive part
 *     of this screen; the extraction is the cheap part, and only the cheap part
 *     is allowed to expire.
 *
 * Merchants, amounts and dates here are INVENTED. The repo is public and this
 * project has leaked fixture data once; a made-up name exercises the code path
 * exactly as well, and the one property real data adds is the ability to leak.
 * (Ratified with Planner 4: Drive-side artefacts carry real names by necessity;
 * the public repo carries none, ever.)
 */
import { readFile } from 'node:fs/promises';
import {
  ROW_STATUSES, WRITABLE_STATUSES, EDITABLE_FIELDS, isWritable, defaultTicked,
  rowKey, twinKey, mergeJobs, initialTicks, toConfirmRows, reattachEdits, unsettledCount,
  RETRYABLE_OUTCOMES, isRetryable, outcomeMap, outcomeFor, mergeOutcomes, retryRows, pairAnswers,
} from '../src/state/batchDraft.js';

let pass = 0;
const failures = [];
const eq = (a, b, label) => {
  if (Object.is(a, b)) { pass++; return; }
  failures.push(`${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const ok = (c, label) => eq(!!c, true, label);
/**
 * A THROW IS A NAMED FAILURE, NOT A DEAD PROCESS.
 *
 * Found by mutation: breaking `reattachEdits` made an assertion dereference
 * `undefined` and the whole suite died mid-run, reporting nothing — so the
 * mutation "survived" by killing the messenger. Every assertion that reaches
 * into a possibly-absent object goes through here.
 */
const at = (fn, label) => {
  try { return fn(); } catch (err) { failures.push(`${label}\n      THREW — ${err && err.message}`); return undefined; }
};

const row = (over = {}) => ({
  date: '2026-08-14', amount: 12.4, currency: 'EUR', row_status: 'completed',
  merchant_display: 'Almond Tree Bakery', payment_hint: 'card', ...over,
});

// ——————————————————————— the vocabulary
eq(ROW_STATUSES.length, 6, 'six statuses the extractor may emit');
eq(WRITABLE_STATUSES.join(','), 'completed,pending,unclear',
  'three may become a row in his book — declined, incoming and roundup may not');
ok(!isWritable('declined'), 'a declined row is money that never left his account');
ok(!isWritable('incoming'), 'and income is out of scope by design');
/**
 * ——— D22 (ruled 2026-08-24): A ROUND-UP IS NOT AN EXPENSE.
 *
 * Revolut's «Spare change» is a BTC auto-investment, so writing one into his
 * book is a wrong number with a ✓ over it. Read out of `backend/Code.gs` build
 * `20260824-1347` — `WRITABLE_ROW_STATUSES = ['completed','pending','unclear']`
 * — and mirrored here so the app never offers a tick the write answers
 * `row_not_writable`.
 */
ok(!isWritable('roundup'), 'and a round-up is an auto-investment, not a purchase (D22)');
ok(!isWritable('nonsense'), 'and an unknown status is refused rather than assumed benign');
ok(isWritable('unclear'), 'while `unclear` is ours to have failed at, and his to fix');

// ——————————————————————— which arrive ticked
ok(defaultTicked(row()), 'a settled purchase arrives ticked');
ok(!defaultTicked(row({ row_status: 'pending' })), 'a pending one does not — it may yet settle');
ok(!defaultTicked(row({ row_status: 'roundup' })), 'nor an aggregate — D22 answered that taxonomy question');
ok(!defaultTicked(row({ row_status: 'unclear' })), 'nor one we could not read');
ok(!defaultTicked(null), 'and nothing is not a row');

/**
 * ——————————————————————— TWIN IDENTITY, and why METHOD is excluded.
 */
eq(twinKey(row()), '2026-08-14|12.4|EUR', 'date + amount + currency');
eq(twinKey(row({ payment_hint: 'unknown' })), twinKey(row({ payment_hint: 'card' })),
  'the SAME purchase read as card in one photo and unknown in another is still one purchase');
ok(twinKey(row()) !== twinKey(row({ amount: 12.5 })), 'a different amount is a different purchase');
ok(twinKey(row()) !== twinKey(row({ currency: 'EGP' })), 'and so is a different currency');
eq(twinKey(row({ amount: null })), null,
  'an UNPRICED row cannot twin — there is nothing to match on, and pairing two would be a guess');
eq(twinKey(null), null, 'and nothing is not a row');

/**
 * ——————————————————————— THE MERGE: one list, from several photos.
 */
{
  const jobs = [
    { sourceHash: 'photoA', entries: [
      row({ date: '2026-08-14', amount: 4.8, merchant_display: 'Rosewater Coffee' }),
      row({ date: '2026-08-13', amount: 163, row_status: 'declined', merchant_display: 'Harbour Baths' }),
    ] },
    { sourceHash: 'photoB', entries: [
      row({ date: '2026-08-14', amount: 4.8, merchant_display: 'Rosewater Coffee' }),  // the overlap
      row({ date: '2026-08-13', amount: null, row_status: 'roundup', aggregate_count: 3 }),
    ] },
  ];
  const rows = mergeJobs(jobs);
  eq(rows.length, 4, 'every row from every photo is on the list…');
  ok(rows.every((r) => r.sourceHash && r.index != null),
    '…each carrying WHICH extraction it came from — without it a merged batch cannot be status-checked');
  eq(rows[0].date, '2026-08-13', 'ordered by date so he can read down it against the screenshot');
  eq(rows[3].sourceHash, 'photoB', 'and within a day, by the order they appeared in their capture');

  const twins = rows.filter((r) => r.twinOf);
  eq(twins.length, 1, 'the overlap is flagged ONCE — the first copy carries the purchase');
  eq(at(() => twins[0].sourceHash, 'the LATER photo is flagged'), 'photoB',
    'and it is the LATER photo that is flagged, not the earlier');
  eq(at(() => twins[0].twinOf, 'the twin names its original'), 'photoA#0',
    'naming the row it duplicates, so the screen can point at it');
  eq(rows.filter((r) => r.amount === 4.8).length, 2,
    'and NEITHER is dropped — two identical real purchases exist, and merging deletes one he made');

  const ticks = initialTicks(rows);
  ok(ticks['photoA#0'] === true, 'the first copy keeps its default…');
  ok(ticks['photoB#0'] === false, '…and the twin is OFF, so the safe state needs no action from him');
  /**
   * A NON-WRITABLE ROW HAS NO TICK KEY AT ALL — not `false`. A disabled control
   * is a question about why; the row stays visible with its reason in words.
   */
  ok(!('photoA#1' in ticks), 'a declined row has NO tick to set, rather than an unusable one');
  /**
   * ——— AND SINCE D22, NEITHER DOES A ROUND-UP. It used to be writable and
   * tickable-by-deliberate-tap; a «Spare change» row is a BTC auto-investment,
   * so it is categorically not an expense and the server refuses it by name.
   * The row is NOT hidden — capture is sacred and he is entitled to see what
   * the screenshot said — it simply has nothing to tick.
   */
  ok(!('photoB#1' in ticks), 'nor does a round-up, since D22 — the same no-tick-at-all shape');
  const aggregate = rows.find((r) => r.row_status === 'roundup');
  ok(at(() => aggregate.aggregate_count, 'the aggregate survives the merge') === 3,
    'and it is still ON the list with its count — losing the tick is not losing the row');
}

/**
 * ——————————————————————— PHOTOS DO NOT INTERLEAVE.
 *
 * Found by running the merge: ordering by `index` alone across captures gives
 * `A#0 B#0 A#1 B#1 A#2` — so on a day covered by two photos he can read down
 * NEITHER screenshot, which destroys the only reconciliation this screen is for.
 */
{
  const r = (i, d) => row({ date: d, amount: i });
  const rows = mergeJobs([
    { sourceHash: 'A', entries: [r(1, '2026-08-14'), r(2, '2026-08-14'), r(3, '2026-08-14')] },
    { sourceHash: 'B', entries: [r(5, '2026-08-14'), r(6, '2026-08-14')] },
  ]);
  eq(rows.map((x) => `${x.sourceHash}#${x.index}`).join(' '), 'A#0 A#1 A#2 B#0 B#1',
    'each photo is read top to bottom, in the order he sent them — never interleaved');
  eq(rows[0].photoOrder, 0, 'and every row remembers which photo it came from…');
  eq(rows[4].photoOrder, 1, '…so the order is explainable rather than incidental');
}

// An undated row is still an expense he may want.
{
  const rows = mergeJobs([{ sourceHash: 'A', entries: [
    row({ date: null, amount: 3 }), row({ date: '2026-08-14', amount: 4 }),
  ] }]);
  eq(rows.length, 2, 'an undated row is kept…');
  eq(rows[1].date, null, '…and sorts last rather than jumping to the top');
}

// An empty or malformed set of jobs is a quiet empty list, never a crash.
eq(mergeJobs([]).length, 0, 'no photos is no rows');
eq(mergeJobs(null).length, 0, 'and neither is nothing');
eq(mergeJobs([{ sourceHash: 'x' }]).length, 0, 'a job with no entries contributes none');

/**
 * ——————————————————————— THE WIRE: identity + his edits, and NOTHING else.
 */
{
  const rows = mergeJobs([{ sourceHash: 'p', entries: [
    row({ amount: 4.8 }),
    row({ amount: 163, row_status: 'declined' }),
    row({ amount: 9.9, row_status: 'pending' }),
  ] }]);
  const ticks = initialTicks(rows);
  const wire = toConfirmRows(rows, ticks, {});
  eq(wire.length, 1, 'only the ticked rows are sent');
  eq(at(() => wire[0].sourceHash, 'the wire row carries its extraction'), 'p', 'each carrying its extraction…');
  eq(at(() => wire[0].index, 'the wire row carries its position'), 0, '…and its position in it');
  /**
   * THE ASSERTION THIS FILE EXISTS FOR. `row_status` is stripped BY
   * CONSTRUCTION — the payload is built from an allow-list, so a field added to
   * the row later cannot ride along by accident.
   */
  ok(!('row_status' in wire[0]), 'row_status NEVER leaves the client — the server re-reads it from its own cache');
  ok(!JSON.stringify(wire).includes('row_status'), 'not anywhere in the payload');
  ok(!('merchant_display' in wire[0]), 'raw row fields never ride — description is the MAPPED one');
  /**
   * THE WIRE VOCABULARY IS §3.5's REQUEST ROW, ENUMERATED FROM THE CONTRACT.
   *
   * ⚠️ The first version of this loop allowed `EDITABLE_FIELDS` + identity and
   * nothing else — an allow-list taken from the client's own aspiration rather
   * than from the server's reader, and it CERTIFIED every omission that
   * mattered: no `currency` (server defaults absent → EGP: a €15.47 row would
   * have been appended as 15.47 EGP), `date` where the server reads `dateStr`
   * (every row `bad_date`), no `description`/`merchantLatin` (the book records
   * the category as the merchant; Memory learns nothing), no `method`
   * (`normalizeMethod_(undefined)` is Cash — his card statement filed as cash),
   * no `dupAck` (the override button changed nothing). A test whose expected
   * list is copied from the code under test asserts only that the code equals
   * itself.
   */
  const WIRE_FIELDS = ['sourceHash', 'index', 'amount', 'currency', 'method',
    'category', 'description', 'dateStr', 'merchantLatin', 'dupAck'];
  for (const f of Object.keys(wire[0])) {
    ok(WIRE_FIELDS.indexOf(f) !== -1,
      `${f} is in §3.5's request row — nothing else may be on the wire`);
  }

  // ——— each mapped field, with the wrong implementation it kills
  eq(wire[0].currency, 'EUR',
    'currency RIDES — absent means EGP to the server, and these rows are the ones that are not');
  eq(wire[0].dateStr, '14/8/2026',
    'the date crosses as Cairo d/M/yyyy — batchRowDate_ reads dateStr and nothing else');
  ok(!('date' in wire[0]), 'and never as the ISO `date` the server would ignore');
  eq(wire[0].description, 'Almond Tree Bakery',
    'description is the merchant as printed — else his book records "Groceries" as what he bought');
  eq(wire[0].method, 'Visa',
    'method defaults from the SERVER\'s per-list ruling (D19) — normalizeMethod_(undefined) is Cash');
  eq(wire[0].category, '❓',
    'an unclassified ticked row goes as ❓ and joins the Inbox — omitting it would be bad_category, a refused expense');
  ok(!('dupAck' in wire[0]), 'dupAck is ABSENT unless he overrode — presence is the claim the flag was shown');

  // ——— the cash hint outranks the list default; an override rides as dupAck
  {
    const r2 = mergeJobs([{ sourceHash: 'p2', defaultMethod: 'Visa', entries: [
      row({ amount: 5, payment_hint: 'cash' }),
    ] }]);
    const t2 = {}; t2[rowKey(r2[0])] = true;
    const w2 = toConfirmRows(r2, t2, {}, { overridden: { [rowKey(r2[0])]: true } });
    eq(w2[0].method, 'Cash', 'an explicit cash hint on the row outranks the list default');
    eq(w2[0].dupAck, true, 'and an overridden duplicate says so, by name, per row (D18a)');
  }
  {
    const und = mergeJobs([{ sourceHash: 'p3', entries: [row({ amount: 7, date: null })] }]);
    const t3 = {}; t3[rowKey(und[0])] = true;
    const w3 = toConfirmRows(und, t3, {});
    ok(!('dateStr' in w3[0]),
      'an undated row OMITS dateStr — the server answers bad_date per row, visibly, never a silently substituted today');
  }

  // Forcing a tick onto a non-writable row still cannot send it.
  const forced = { ...ticks, 'p#1': true };
  ok(!toConfirmRows(rows, forced, {}).some((r) => r.index === 1),
    'even a forced tick cannot send a DECLINED row — belt and braces, because the cost is his ledger');

  // His edits win over the machine's reading.
  const edited = toConfirmRows(rows, ticks, { 'p#0': { amount: 5.2, category: 'Eating out' } });
  eq(at(() => edited[0].amount, 'his correction is sent'), 5.2, 'his correction is what is sent…');
  eq(at(() => edited[0].category, 'his category is sent'), 'Eating out', '…including a category he chose');
}

/**
 * ——————————————————————— THE EXPIRED DRAFT (CONTRACT-04 ②).
 *
 * His edits are the expensive part and only the CHEAP part expires. After
 * `extraction_expired` he re-snaps, and the corrections come back BY INDEX —
 * not by content, because the new extraction may read the row slightly
 * differently and his edit is the correction to exactly that row.
 */
{
  const before = mergeJobs([{ sourceHash: 'old', entries: [row(), row({ amount: 7 }), row({ amount: 9 })] }]);
  const edits = { 'old#0': { amount: 5.2 }, 'old#2': { category: 'Gifts' } };
  const after = mergeJobs([{ sourceHash: 'new', entries: [row(), row({ amount: 7 }), row({ amount: 9 })] }]);
  const moved = reattachEdits(edits, before, after);
  eq(at(() => moved['new#0'].amount, 'his correction survives the re-snap…'), 5.2,
    'his correction survives the re-snap…');
  eq(at(() => moved['new#2'].category, '…on the row he actually corrected'), 'Gifts',
    '…on the row he actually corrected');
  ok(!('old#0' in moved), 'and is re-keyed to the NEW extraction, which is what the server will check against');

  // A shorter re-read drops what has nowhere to land, rather than mis-attaching.
  const shorter = mergeJobs([{ sourceHash: 'new2', entries: [row()] }]);
  const trimmed = reattachEdits(edits, before, shorter);
  eq(Object.keys(trimmed).length, 1, 'an edit with no row to land on is dropped…');
  eq(at(() => trimmed['new2#0'].amount, '…rather than attached to a row he never corrected'), 5.2,
    '…rather than attached to a row he never corrected');
  eq(Object.keys(reattachEdits(null, before, after)).length, 0, 'no edits re-attaches nothing');
  eq(Object.keys(reattachEdits(edits, null, after)).length, 0, 'and neither does no history');
}

/**
 * ——————————————————————— THE COUNT HE SEES DAILY.
 *
 * A pending batch is money missing from his book; silence about it is the same
 * defect as «This week 0». Counts what could still BECOME an entry.
 */
{
  const draft = (over = {}) => ({ rows: [
    row(), row({ row_status: 'declined' }), row({ row_status: 'pending' }), row({ row_status: 'incoming' }),
  ], ...over });
  eq(unsettledCount(draft()), 2,
    'two rows could still become entries — declined and incoming never could');
  eq(unsettledCount(draft({ settled: true })), 0, 'a settled batch is waiting for nothing');
  eq(unsettledCount(null), 0, 'and no draft is no count');
  eq(unsettledCount({ rows: [] }), 0, 'nor an empty one');
  /**
   * A row he has deliberately left UNTICKED still counts. The decision he has
   * not made is exactly what the count exists to surface — counting only ticked
   * rows would report zero for a batch he has not started.
   */
  eq(unsettledCount({ rows: [row(), row()] }), 2, 'untouched rows are precisely what is waiting');

  /**
   * ——— AND A SETTLED BATCH IS NOT AUTOMATICALLY A FINISHED ONE.
   *
   * This is the SECOND RENDER SITE of the rule the review screen already
   * enforces per row, and it is the quieter one — the number he passes on the
   * Book screen every day. It used to return 0 the moment any confirm came
   * back, so ten written and two REFUSED read as «nothing waiting» while two
   * possibly-real expenses sat in a draft he had no reason to reopen.
   *
   * `written` and `duplicate` are both in his book (the second by our own
   * earlier write). A refusal, an error, and a row he never sent are not.
   */
  const rows4 = mergeJobs([{ sourceHash: 'p', entries: [row(), row({ amount: 3 }), row({ amount: 5 }), row({ amount: 8 })] }]);
  const answered = (pairs) => ({ byKey: pairs });
  eq(unsettledCount({ rows: rows4, settled: answered({
    'p#0': { status: 'written' }, 'p#1': { status: 'written' },
    'p#2': { status: 'written' }, 'p#3': { status: 'written' },
  }) }), 0, 'every row written is nothing waiting');
  eq(unsettledCount({ rows: rows4, settled: answered({
    'p#0': { status: 'written' }, 'p#1': { status: 'book_duplicate' },
    'p#2': { status: 'error' }, 'p#3': { status: 'duplicate' },
  }) }), 2,
  'a refusal and an error are still waiting — a replay of OUR OWN write is not');
  eq(unsettledCount({ rows: rows4, settled: answered({ 'p#0': { status: 'written' } }) }), 3,
    'and a row never sent is waiting too — the tick he did not make is what the count is for');
  /**
   * IT FAILS OPEN (§6.0: this count protects CAPTURE), BUT IT DOES NOT INVENT.
   * A settled marker carrying no per-row answers yields 0 rather than declaring
   * the whole batch outstanding — fabricating N waiting expenses out of an
   * absent answer is the honest-rendering defect pointing the other way.
   */
  eq(unsettledCount({ rows: rows4, settled: { written: 4, skipped: 0, errored: 0 } }), 0,
    'a settled shape with no answers in it counts nothing, rather than guessing');
}

/**
 * ═══════════ THE OUTCOME MAP, THE MERGE, AND THE SECOND CONFIRM ═══════════
 *
 * The thread this closes (docs/05 `6139886`): «a `book_duplicate` discovered at
 * CONFIRM time has no dupAck path — the override panel renders only pre-settle,
 * so a row first refused at confirm can only be captured by re-photographing».
 * The book moves between the extraction and the write, so that second refusal
 * lands on the rows that looked cleanest.
 */
{
  // ——— the allow-list is by NAME, and the three absences each cost something
  eq(RETRYABLE_OUTCOMES.join(','), 'book_duplicate',
    '`dupAck` answers exactly one refusal — a status this file has never heard of is not retryable');
  ok(isRetryable({ status: 'book_duplicate' }), 'the server refused pending his judgement…');
  ok(!isRetryable({ status: 'written' }), '…and a written row is in his book: asking again asks for a second copy');
  ok(!isRetryable({ status: 'duplicate' }), 'a replay of our own earlier write is not his to override');
  ok(!isRetryable({ status: 'error' }), 'and `dupAck` does not fix a bad_date — a button that cannot work is worse than none');
  ok(!isRetryable(null), 'no answer is not a refusal');

  const rows3 = mergeJobs([{ sourceHash: 'p', entries: [row(), row({ amount: 3 }), row({ amount: 5 })] }]);
  const sent = [{ sourceHash: 'p', index: 0 }, { sourceHash: 'p', index: 2 }];
  const res1 = { ok: true, written: 1, skipped: 1, errored: 0, results: [
    { index: 0, status: 'written' },
    { index: 2, status: 'book_duplicate', dupBook: { checked: true, match: { date: '14/8/2026', description: 'Harbour Baths', amount: 12.4, currency: 'EUR' } } },
  ] };

  // ——— positional mapping, and the guard that refuses to slide answers along
  const legacy = { ...res1, sent };
  eq(at(() => outcomeMap(legacy).get('p#0').status, 'the first answer lands on the first row sent'), 'written',
    'the first answer lands on the first row sent');
  eq(at(() => outcomeMap(legacy).get('p#2').status, 'and the second on the second'), 'book_duplicate',
    'and the second on the second');
  eq(outcomeMap(legacy).get('p#1'), undefined, 'a row never sent has no answer — not a blank one');
  eq(outcomeMap({ ...res1, sent: [sent[0]] }).size, 0,
    'a results/sent length mismatch yields NOTHING — a green «written» beside a row that errored is the forbidden output');
  eq(outcomeMap({ ...res1 }).size, 0, 'and a response with no `sent` cannot be placed at all');
  eq(outcomeMap(null).size, 0, 'nothing maps to nothing');

  /**
   * ═══ §3.5a: THE ECHO, CONSUMED — PRESENCE-GATED (Planner 5's commission) ═══
   *
   * Commission F asked the server to echo `sourceHash` on every result, because
   * the positional match rests on a guarantee «observable in the implementation
   * and promised nowhere». With the echo the client asserts instead of assumes.
   *
   * It is PRESENCE-GATED and that is the ruling: the echo is contract text, not
   * necessarily in the build his phone is talking to tonight, and *a client that
   * infers capability from the REPO is wrong by exactly one deploy, every time.*
   */
  const echoSent = [{ sourceHash: 'p', index: 0 }, { sourceHash: 'p', index: 2 }];
  const withEcho = [
    { index: 0, sourceHash: 'p', status: 'written' },
    { index: 2, sourceHash: 'p', status: 'book_duplicate' },
  ];
  eq(at(() => pairAnswers(withEcho, echoSent).get('p#0').status, 'the echo places the first answer'), 'written',
    'when the server echoes `sourceHash`, identity travels WITH the answer…');
  eq(at(() => pairAnswers(withEcho, echoSent).get('p#2').status, 'and the second'), 'book_duplicate',
    '…and the client reads it rather than counting positions');

  /**
   * THE ECHO IS CHECKED, NOT BELIEVED. An answer naming a row we did not send is
   * a response this function does not understand, and §3.5a says so: «a mismatch
   * renders NO outcomes rather than sliding answers one place along».
   */
  eq(pairAnswers([{ index: 0, sourceHash: 'OTHER', status: 'written' },
    { index: 2, sourceHash: 'p', status: 'written' }], echoSent).size, 0,
  'an echoed hash we never sent yields NOTHING — the server is answering about something we did not ask');

  /**
   * ⚠️ THE ECHO ALSO SURVIVES THE COLLISION THAT POSITION WAS INVENTED FOR.
   * Two photos each have a row 0; `index` alone once dropped a real expense and
   * reported it as a successful no-op. The echoed hash separates them.
   */
  const twoPhotos = [{ sourceHash: 'A', index: 0 }, { sourceHash: 'B', index: 0 }];
  const twoAnswers = [
    { index: 0, sourceHash: 'B', status: 'written' },
    { index: 0, sourceHash: 'A', status: 'error' },
  ];
  eq(at(() => pairAnswers(twoAnswers, twoPhotos).get('B#0').status, 'photo B'), 'written',
    'two photos both numbered 0 are told apart by the echo…');
  eq(at(() => pairAnswers(twoAnswers, twoPhotos).get('A#0').status, 'photo A'), 'error',
    '…even when the server answers them OUT OF ORDER, which position could never survive');

  /**
   * AND WITHOUT THE ECHO, NOTHING CHANGES. The serving build may not have it;
   * the positional path and its length guard are untouched.
   */
  const noEcho = [{ index: 0, status: 'written' }, { index: 2, status: 'written' }];
  eq(at(() => pairAnswers(noEcho, echoSent).get('p#0').status, 'the fallback still pairs'), 'written',
    'a build that does not echo is matched by position exactly as before…');
  eq(pairAnswers([{ index: 0, status: 'written' }], echoSent).size, 0,
    '…with the length guard intact');
  /**
   * A response where only SOME rows carry the echo is a shape neither §3.5a nor
   * the positional guarantee describes, so it takes the positional path rather
   * than a half-keyed map — all or none.
   */
  eq(at(() => pairAnswers([{ index: 0, sourceHash: 'p', status: 'written' },
    { index: 2, status: 'error' }], echoSent).get('p#2').status, 'the partial-echo response'), 'error',
  'and a PARTIAL echo falls back to position rather than keying half the answers');

  // ——— the merge accumulates, and recomputes rather than adding up
  const merged = mergeOutcomes(null, res1, sent);
  eq(merged.written, 1, 'the merge counts one written…');
  eq(merged.skipped, 1, '…and one skipped');
  eq(at(() => merged.byKey['p#2'].status, 'the refusal is keyed to its row'), 'book_duplicate',
    'the refusal is keyed to its row');
  ok(outcomeMap(merged).size === 2, 'and a merged object is read by key, not by position');

  /**
   * ⚠️ THE DOUBLE-WRITE THIS PREVENTS. The second confirm sends ONE row, so a
   * replacement would leave the other two unanswered — and a row WRITTEN a
   * minute ago would re-render as a live, tickable candidate.
   */
  const retrySent = [{ sourceHash: 'p', index: 2 }];
  const merged2 = mergeOutcomes(merged, { ok: true, results: [{ index: 2, status: 'written' }] }, retrySent);
  eq(at(() => merged2.byKey['p#0'].status, 'the first confirm\'s answer survives the second'), 'written',
    'the first confirm\'s answer survives the second');
  eq(at(() => merged2.byKey['p#2'].status, 'and the overridden row is written now'), 'written',
    'and the overridden row is written now');
  eq(merged2.written, 2, 'two written…');
  eq(merged2.skipped, 0,
    '…and ZERO skipped: a row refused and then written is ONE row that ended written, not one of each');
  eq(unsettledCount({ rows: rows3, settled: merged2 }), 1,
    'and the count drops to the one row he never sent');

  // ——— what the second confirm may carry
  eq(retryRows(rows3, merged, {}, {}, {}).length, 0,
    'no override, no retry — the judgement is his and an app that batches it away has made it for him');
  const over = { 'p#2': true };
  const insisted = retryRows(rows3, merged, over, {}, {});
  eq(insisted.length, 1, 'the row he insisted on rides alone…');
  eq(at(() => insisted[0].index, '…and it is the refused one'), 2, '…and it is the refused one');
  eq(at(() => insisted[0].dupAck, 'carrying the acknowledgement the server is waiting for'), true,
    'carrying the acknowledgement the server is waiting for');
  eq(at(() => insisted[0].currency, 'and §3.5\'s full row, from the one builder'), 'EUR',
    'and §3.5\'s full row, from the one builder');
  ok(at(() => !('row_status' in insisted[0]), 'still without `row_status` — the allow-list holds on the retry path too'),
    'still without `row_status` — the allow-list holds on the retry path too');

  ok(!retryRows(rows3, merged, { 'p#0': true }, {}, {}).length,
    'overriding a WRITTEN row sends nothing — the one thing this screen must never make easy');
  ok(!retryRows(rows3, merged, { 'p#0': true, 'p#2': true }, {}, { 'p#0': true }).length
    || retryRows(rows3, merged, { 'p#0': true, 'p#2': true }, {}, { 'p#0': true }).every((r) => r.index === 2),
  'and a tick on an already-answered row cannot resurrect it');

  /**
   * THE SECOND DEAD CONTROL THIS CLOSES: a row left unticked at confirm gets no
   * answer, so it keeps its live checkbox — and the footer used to offer only
   * «back to the book», so ticking it did nothing at all.
   */
  const late = retryRows(rows3, merged, {}, {}, { 'p#1': true });
  eq(late.length, 1, 'a row he ticks AFTER the settle can still be sent…');
  eq(at(() => late[0].index, '…and it is the one he ticked'), 1, '…and it is the one he ticked');
  ok(at(() => !('dupAck' in late[0]), 'without a dupAck it never needed — presence is the claim the flag was shown'),
    'without a dupAck it never needed — presence is the claim the flag was shown');
  eq(at(() => outcomeFor(merged, rows3[1]), 'and it had no answer to begin with'), null,
    'and it had no answer to begin with');
}

/**
 * ═══════════ THE RECORD OF WHAT WAS WRITTEN MUST SURVIVE THE EXITS ═══════════
 *
 * ⚠️ FOUND BY AN ADVERSARIAL PASS OVER THIS REV, NOT BY THIS SUITE — and it was
 * this rev's own doing. The second-confirm path made a state reachable that
 * could not exist before: a draft that ALREADY CARRIES ANSWERS arriving at the
 * expired screen.
 *
 * The sequence is the designed flow, not an edge. Fourteen rows; ten written,
 * two refused as `book_duplicate`. He taps «سيبها دلوقتي». More than six hours
 * later the Book's waiting count sends him back; he overrides the two and
 * confirms; the server's extraction cache has expired so BOTH answer
 * `extraction_expired` — and `every()` is satisfied on a two-row list exactly as
 * on a fourteen-row one, so the whole screen becomes «صوّرها تاني». That exit
 * used to null `settled`, erasing the record that ten rows were already in his
 * sheet, and the Book then stated «14 مصروف لسه ما اتسجلوش» about a set of which
 * ten were logged. A confident false number on the screen he passes daily.
 *
 * The answers are keyed by `sourceHash#index`, so keeping them is safe: a
 * re-snap is new bytes and therefore a new hash, and no fresh row can inherit a
 * verdict addressed to an old one.
 */
{
  const rows = mergeJobs([{ sourceHash: 'p', entries: [
    row(), row({ amount: 3 }), row({ amount: 5 }), row({ amount: 8 }),
  ] }]);
  const settledDay1 = { byKey: {
    'p#0': { status: 'written' }, 'p#1': { status: 'written' },
    'p#2': { status: 'book_duplicate' }, 'p#3': { status: 'written' },
  }, written: 3, skipped: 1, errored: 0 };

  eq(unsettledCount({ rows, settled: settledDay1 }), 1,
    'before the exit: one refused row is waiting and three written ones are not');
  eq(unsettledCount({ rows, settled: null }), 4,
    'and THIS is what dropping the record costs — every row reads as waiting, three of them wrongly');

  /**
   * The repair is that `resnapBatch` no longer nulls it. Source-pinned, because
   * the erasure lived in a callback no render can reach.
   */
  const appSrc = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const resnap = appSrc.slice(appSrc.indexOf('const resnapBatch'), appSrc.indexOf('const showToast'));
  ok(resnap.length > 20, 'resnapBatch was located in App.jsx — a slice that missed it would assert nothing');
  ok(!/settled:\s*null/.test(resnap),
    'the re-snap keeps what the server already told us — the photo expired, his written rows did not');

  /**
   * `takeBatchJob` still prunes, but ONLY the photo being replaced. A re-read of
   * the SAME screenshot produces fresh rows at the same indices, and an old
   * verdict would attach to whatever the new reading put there.
   */
  const take = appSrc.slice(appSrc.indexOf('const takeBatchJob'), appSrc.indexOf('const confirmBatch'));
  ok(/startsWith\(`\$\{job\.sourceHash\}#`\)/.test(take),
    'a new photo prunes only ITS OWN stale answers, never another photo\'s');
}

/**
 * ═══════════ THE SCREEN OBEYS THE RULES, RENDERED ═══════════
 *
 * Source checks cannot see a tick being drawn. Every rule below is one where the
 * function is right and the SCREEN could still be wrong — the class all three of
 * this rev's specimens belong to.
 */
{
  const { createServer } = await import('vite');
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  try {
    const BatchReviewView = (await vite.ssrLoadModule('/src/views/BatchReviewView.jsx')).default;
    const { AR } = await vite.ssrLoadModule('/src/i18n/strings.ar.js');
    const render = (props) => renderToStaticMarkup(createElement(BatchReviewView, {
      jobs: [], busy: false, onConfirm: () => {}, onResnap: () => {}, onDiscard: () => {}, ...props,
    }));
    const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

    const jobs = [{ sourceHash: 'p', entriesTotal: 9, entries: [
      row({ merchant_display: 'Rosewater Coffee', amount: 4.8 }),
      row({ merchant_display: 'Harbour Baths', amount: 163, row_status: 'declined' }),
      row({ merchant_display: 'Tram Kiosk', amount: 21.3,
        dupBook: { checked: true, match: { date: '2026-08-13', description: 'Tram Kiosk', amount: 21.3, currency: 'EUR' }, count: 1 } }),
      row({ merchant_display: 'Old Pier Deli', amount: 8.5, dupBook: { checked: false, reason: 'month_not_cached' } }),
    ] }];
    const html = render({ jobs });
    const t = text(html);

    // ——— the non-writable row stays visible, with its reason in words
    ok(t.includes('Harbour Baths'), 'a declined row is still SHOWN — it is information he may want');
    ok(t.includes(AR.batchDeclined), '…with its reason in words, not merely greyed');
    /**
     * NO TICK ON IT. Counted as checkbox roles: three writable rows, three
     * checkboxes. A disabled fourth would be a question about why.
     */
    eq((html.match(/role="checkbox"/g) || []).length, 3,
      'exactly three ticks for three writable rows — the declined row has none at all');

    // ——— the three duplicate flavours are three different sentences
    ok(t.includes(AR.batchDupBook), 'a book duplicate says so…');
    ok(t.includes(AR.batchDupUnchecked), '…and "we could not check" says something DIFFERENT');
    ok(AR.batchDupBook !== AR.batchDupUnchecked && AR.batchDupBatch !== AR.batchDupUnchecked,
      'the three flavours are three distinct strings — collapsing them is the check-that-cannot-fail in UI form');

    // ——— silent truncation is forbidden
    ok(t.includes('9'), 'the screen states how many the model SAW…');
    ok(/[٠-٩0-9]/.test(t) && t.includes(AR.batchTruncated(4, 9).slice(0, 12)),
      '…so a cut-off list never reads as complete');

    // ——— after confirm: three counts, never one verdict, and nothing moves
/**
     * ——— OUTCOMES ARE MATCHED BY POSITION, AGAINST THE ROWS WE SENT.
     *
     * ⚠️ THIS FIXTURE USED TO CARRY `sourceHash` IN THE RESULTS, AND THE SERVER
     * NEVER SENDS IT. `batch_confirm` answers `{index, status, …}` and reads
     * `row.sourceHash` from the REQUEST without echoing it (verified against
     * `Code.gs`, not inferred). So the old matcher compared a real hash to
     * `undefined` and every outcome resolved to null — on a screen whose entire
     * job after a confirm is saying what happened to each row. The fixture
     * modelled a response the server does not produce, which is mock parity's
     * lesson wearing a test's clothes: a fixture more generous than the service
     * certifies a client that cannot work.
     *
     * `sent` is the array the screen actually posted, kept beside the response.
     */
    const sent = [{ sourceHash: 'p', index: 0 }, { sourceHash: 'p', index: 2 }];
    const settled = text(render({ jobs, results: { written: 2, skipped: 1, errored: 0, sent, results: [
      { index: 0, status: 'written' },
      { index: 2, status: 'book_duplicate' },
    ] } }));
    /**
     * ⚠️ «اتسجلت» IS A PREFIX OF «ما اتسجلتش» — Arabic negation wraps the
     * affirmative (ما … ش), so `batchRefusedDup` CONTAINS `batchWritten` as a
     * substring. This diff created that overlap by routing `book_duplicate` to
     * the new string, and it disarmed the line below: with a refusal on screen,
     * `includes(batchWritten)` passes even if every «logged» label is deleted.
     * Verified by mutation — the label removed, this fixture still green.
     *
     * The pair is asserted here anyway (it is the honest description of this
     * screen) and made FALSIFIABLE on the `allDone` fixture further down, where
     * no refusal is rendered and nothing else can satisfy the substring. This is
     * the second time this rev has caught a containment doing exactly this; the
     * first was «امسح الكشف» swallowing the waiting line.
     */
    ok(AR.batchRefusedDup.includes(AR.batchWritten),
      'the containment is REAL — so the next line cannot fail on this fixture, and `allDone` carries the real check');
    ok(settled.includes(AR.batchWritten), 'a written row says so…');
    ok(settled.includes(AR.batchRefusedDup), '…and a refused one says something else — never one verdict for the batch');
    ok(settled.includes('Harbour Baths'), 'and every row is STILL THERE — nothing moves, nothing disappears');

    /**
     * ——— A REFUSAL IS NOT A REPLAY, AND THEY MUST NOT READ THE SAME.
     *
     * `duplicate` means WE wrote the row on an earlier attempt: it is in his
     * book. `book_duplicate` means the server found a match and wrote NOTHING.
     * Both used to render «was already logged», which hides a possibly-real
     * expense behind a word that says it is handled — the same rule that keeps
     * «we could not check» apart from «we checked and it is clean».
     */
    ok(AR.batchRefusedDup !== AR.batchSkippedDup,
      'the two duplicate answers are two sentences — one is finished, the other is waiting for him');
    const replayed = text(render({ jobs, results: { written: 1, skipped: 1, errored: 0, sent, results: [
      { index: 0, status: 'written' },
      { index: 2, status: 'duplicate' },
    ] } }));
    ok(replayed.includes(AR.batchSkippedDup) && !replayed.includes(AR.batchRefusedDup),
      'a replay of our own write says «already logged» and offers nothing to override');
    /**
     * ⚠️ AN ASSERTION THAT «سجّلها برضه» IS ABSENT HERE WAS REMOVED, because it
     * COULD NOT FAIL. The override button renders only inside an EXPANDED row,
     * and `open` starts null with no way for `renderToStaticMarkup` to click —
     * so that string is absent from every rendered fixture in this file whatever
     * the code does. Proven by mutation: making `duplicate` retryable AND
     * forcing the panel open was required before it went red, and the first
     * mutation alone left it green.
     *
     * The property it claimed is really held, by three assertions that CAN fail:
     * the `RETRYABLE_OUTCOMES` pin, `!isRetryable({status:'duplicate'})`, and the
     * `showOverride` source pin below. Deleting a check that cannot fail loses no
     * coverage and stops the suite reporting a guard it does not hold.
     */

    /**
     * ═══ THE DOOR THAT DID NOT EXIST (docs/05 `6139886` loose thread) ═══
     *
     * A `book_duplicate` refused at CONFIRM time — after the extraction's own
     * duplicate check passed — had no dupAck path at all: the override panel
     * rendered only pre-settle, so his one recovery was photographing the
     * statement again. The book moves between the extraction and the write, so
     * this lands on the rows that looked cleanest.
     *
     * A fixture where EVERY writable row was sent, because the four-row one
     * above deliberately leaves two unsent — and an unsent row is still
     * offered, which is the other half of this same fix.
     */
    const duo = [{ sourceHash: 'q', entriesTotal: 2, entries: [
      row({ merchant_display: 'Rosewater Coffee', amount: 4.8 }),
      row({ merchant_display: 'Tram Kiosk', amount: 21.3 }),
    ] }];
    const duoSent = [{ sourceHash: 'q', index: 0 }, { sourceHash: 'q', index: 1 }];
    const refused = text(render({ jobs: duo, results: { written: 1, skipped: 1, errored: 0, sent: duoSent, results: [
      { index: 0, status: 'written' },
      { index: 1, status: 'book_duplicate', dupBook: { checked: true, count: 1,
        match: { date: '2026-08-13', description: 'Tram Kiosk', amount: 21.3, currency: 'EUR' } } },
    ] } }));
    /**
     * ⚠️ THIS ASSERTION COULD NOT FAIL WHEN IT WAS FIRST WRITTEN, and a mutation
     * proved it: the discard button's price read «… 1 expense not logged yet»,
     * which CONTAINS the header's sentence, so deleting the header entirely left
     * `includes` matching the button. A check that cannot fail is worse than no
     * check — it reports a guard where there is none. The two strings are now
     * deliberately different sentences, and the next line keeps them that way.
     */
    ok(!AR.batchDiscardWaiting(1).includes(AR.batchWaiting(1)),
      'the discard price is not the waiting line verbatim — one containing the other disarms the assertion below');
    ok(refused.includes(AR.batchWaiting(1)),
      'the settled header says what is still OUTSTANDING — three counts about what happened is not that');

    /**
     * ——— LEAVING AND DISCARDING ARE DIFFERENT ACTS.
     *
     * The settled screen's only control used to be «Done — back to the book»,
     * and it DESTROYED the draft, refused rows included. While anything is
     * outstanding the primary KEEPS it, and the discard names its price.
     */
    ok(refused.includes(AR.batchLeave) && !refused.includes(AR.batchBack),
      'while rows are unwritten the exit LEAVES them rather than calling itself Done');
    ok(refused.includes(AR.batchDiscardWaiting(1)),
      'and discarding is its own control, saying out loud what it throws away');

    const allDone = text(render({ jobs: duo, results: { written: 2, skipped: 0, errored: 0, sent: duoSent, results: [
      { index: 0, status: 'written' }, { index: 1, status: 'written' },
    ] } }));
    ok(allDone.includes(AR.batchWritten),
      'a written row says «logged» — asserted HERE, where no refusal is on screen to satisfy the substring for it');
    ok(!allDone.includes(AR.batchRefusedDup),
      'and a batch with no refusals says nothing about refusals');
    ok(allDone.includes(AR.batchBack) && !allDone.includes(AR.batchDiscardWaiting(1)),
      'with nothing outstanding the two collapse back into one button — there is no difference left to draw');
    ok(!allDone.includes(AR.batchWaiting(1)),
      'and a finished batch claims nothing is waiting only when nothing is');

    /**
     * ——— THE ROW HE NEVER SENT KEEPS ITS TICK, AND THE FOOTER NOW MEANS IT.
     *
     * Four rows, two sent. The unanswered writable row still renders a live
     * checkbox — it always did — but the footer said «back to the book», so the
     * tick was wired to nothing. A tickable box on the screen that writes to his
     * book, connected to no action, is the dark dictation button again.
     */
    const partial = text(render({ jobs, results: { written: 1, skipped: 1, errored: 0, sent, results: [
      { index: 0, status: 'written' }, { index: 2, status: 'book_duplicate' },
    ] } }));
    ok(partial.includes(AR.batchConfirm(1)),
      'the row he ticked and never sent is still sendable after the settle');
    ok(partial.includes(AR.batchWaiting(2)),
      'and both the refusal and the unsent row are counted as waiting');

    // ——— the expired draft never silently drops his work
    const exp = text(render({ jobs, expired: true }));
    ok(exp.includes(AR.batchExpired), 'an expired extraction says what happened…');
    ok(exp.includes(AR.batchResnap), '…and offers one fresh read rather than dropping his edits');
    ok(!exp.includes('Rosewater Coffee'), 'and does not pretend the stale list is still confirmable');
  } finally {
    await vite.close();
  }
}

/**
 * ——— THE PICKER CAN REACH EVERY CATEGORY (field-found: the batch picker
 * offered SHORT_LIST with no expansion, so the six per-install extras were
 * unreachable on the one screen classifying a whole statement). Source-pinned
 * because the expansion is behind a per-row click SSR cannot perform: the map
 * must branch to the FULL list and an affordance must exist to open it.
 */
{
  const src = await readFile(new URL('../src/views/BatchReviewView.jsx', import.meta.url), 'utf8');
  ok(/catsOpen \? CATEGORIES : SHORT_LIST/.test(src),
    'the batch picker expands to the FULL category list, extras included');
  ok(src.includes('setCatsOpen(true)') && src.includes('S.more'),
    'and the expansion has a visible affordance — a list nobody can open is SHORT_LIST wearing a flag');

  /**
   * ——— THE OVERRIDE PANEL OPENS AFTER A SETTLE, NOT ONLY BEFORE ONE.
   *
   * Source-pinned for the same reason the picker is: the panel is behind a
   * per-row tap that SSR cannot perform. The gate used to read
   * `isOpen && !settled`, which is precisely the loose thread — the panel that
   * answers a duplicate could not be reached once the duplicate had actually
   * been refused.
   */
  ok(!/isOpen && !settled/.test(src),
    'the panel is no longer closed by the settle itself — that gate WAS the missing door');
  ok(/isOpen && canOpen/.test(src) && /const canOpen = !settled \|\| showOverride;/.test(src),
    'it opens whenever there is something to open — before the settle, or on a refusal after it');
  ok(/const showOverride = \(settled \? retryable : !!bookDup\) && !overrode;/.test(src),
    'and post-settle it is the RETRYABLE outcome that earns the override, not any refusal');
  /**
   * The evidence is the server's own match when it sent one, the extraction's
   * otherwise — and NEVER a box framing nothing. Honest rendering applies to a
   * duplicate's proof exactly as it applies to an amount.
   */
  ok(/\{matchRow && \(/.test(src),
    'no evidence, no evidence box — the sentence and the choice stand without a fabricated row');

  /**
   * ——— THE EXIT'S WORD AND THE EXIT'S ACT MUST AGREE.
   *
   * Source-pinned because SSR renders LABELS and not handlers, and a mutation
   * proved the gap: swapping `onLeave` for `onDiscard` under the word «leave it
   * for now» passed every rendered assertion. That is the whole defect this
   * change exists to fix, restored silently — a button that says it keeps his
   * unwritten rows and destroys them instead.
   */
  ok(/outstanding > 0 \? onLeave : onDiscard/.test(src),
    'while rows are outstanding the exit CALLS onLeave — the label and the act are the same promise');
  ok(/S\.batchDiscardWaiting\(outstanding\)/.test(src),
    'and the only control that destroys the draft states the count it destroys');
}

const report = failures.length
  ? `❌ ${failures.length} / ${pass + failures.length} batch checks failed:\n  - ${failures.join('\n  - ')}`
  : `✅ all ${pass} batch checks passed`;
console.log(report);
process.exit(failures.length ? 1 : 0);
