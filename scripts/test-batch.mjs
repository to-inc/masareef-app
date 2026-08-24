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
import {
  ROW_STATUSES, WRITABLE_STATUSES, EDITABLE_FIELDS, isWritable, defaultTicked,
  rowKey, twinKey, mergeJobs, initialTicks, toConfirmRows, reattachEdits, unsettledCount,
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
eq(WRITABLE_STATUSES.join(','), 'completed,pending,roundup,unclear',
  'four may become a row in his book — declined and incoming may not, ever');
ok(!isWritable('declined'), 'a declined row is money that never left his account');
ok(!isWritable('incoming'), 'and income is out of scope by design');
ok(!isWritable('nonsense'), 'and an unknown status is refused rather than assumed benign');
ok(isWritable('unclear'), 'while `unclear` is ours to have failed at, and his to fix');

// ——————————————————————— which arrive ticked
ok(defaultTicked(row()), 'a settled purchase arrives ticked');
ok(!defaultTicked(row({ row_status: 'pending' })), 'a pending one does not — it may yet settle');
ok(!defaultTicked(row({ row_status: 'roundup' })), 'nor an aggregate — that is a taxonomy question');
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
  ok(ticks['photoB#1'] === false, 'while an aggregate has one, defaulted off and tickable');
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
    ok(settled.includes(AR.batchWritten), 'a written row says so…');
    ok(settled.includes(AR.batchSkippedDup), '…and a skipped one says something else — never one verdict for the batch');
    ok(settled.includes('Harbour Baths'), 'and every row is STILL THERE — nothing moves, nothing disappears');

    /**
     * ——— AND IT REFUSES TO GUESS WHEN THE ASSUMPTION FAILS.
     *
     * Position is only meaningful while `results` and `sent` are the same
     * length. If they are not, the server did something this screen does not
     * understand, and sliding the answers one place along would put a green
     * «written» beside a row that errored — a confident wrong number, the one
     * forbidden output. Silence is the honest degradation.
     */
    const mismatched = text(render({ jobs, results: { written: 1, skipped: 0, errored: 0, sent,
      results: [{ index: 0, status: 'written' }] } }));
    ok(!mismatched.includes(AR.batchWritten),
      'a results/sent length mismatch shows NO outcomes rather than mis-attributing them');
    ok(mismatched.includes('Harbour Baths'),
      'and still shows every row — refusing to label them is not refusing to display them');

    const noSent = text(render({ jobs, results: { written: 1, skipped: 0, errored: 0,
      results: [{ index: 0, status: 'written' }] } }));
    ok(!noSent.includes(AR.batchWritten),
      'and a response with no `sent` at all is the same refusal — the old shape cannot silently half-work');

    // ——— the expired draft never silently drops his work
    const exp = text(render({ jobs, expired: true }));
    ok(exp.includes(AR.batchExpired), 'an expired extraction says what happened…');
    ok(exp.includes(AR.batchResnap), '…and offers one fresh read rather than dropping his edits');
    ok(!exp.includes('Rosewater Coffee'), 'and does not pretend the stale list is still confirmable');
  } finally {
    await vite.close();
  }
}

const report = failures.length
  ? `❌ ${failures.length} / ${pass + failures.length} batch checks failed:\n  - ${failures.join('\n  - ')}`
  : `✅ all ${pass} batch checks passed`;
console.log(report);
process.exit(failures.length ? 1 : 0);
