#!/usr/bin/env node
/**
 * The receipt card's category chips.  `npm run check:chips`
 *
 * FIELD BUG, 2026-08-01, first real receipt: tapping a chip made it VANISH from
 * the list and displayed nothing in its place, so a chosen category and an
 * unchosen one looked identical — on the one card whose entire job is showing
 * what is about to be written to his sheet.
 *
 * Two faults compounded. `.filter(c => c !== category)` removed the tapped chip,
 * and the green ✓ summary that would have shown the choice was hidden by
 * `showAllCats`, which tapping a chip sets. Neither was visible in isolation;
 * together they erased the selection completely.
 *
 * These assertions are about SHAPE AND STATE, not styling: the list must not
 * change length when a choice is made, the choice must be machine-visible
 * (`aria-pressed`, which is also what a screen reader announces), and tapping
 * the selected chip must clear it rather than doing nothing.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';

let pass = 0;
const failures = [];
const eq = (actual, expected, label) => {
  if (Object.is(actual, expected)) { pass++; return; }
  failures.push(`${label}\n      expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};
const ok = (cond, label) => eq(!!cond, true, label);

/** Rendered text only — style attributes and markup are not what a person reads. */
function textRuns(html) {
  const runs = [];
  const re = />([^<]+)</g;
  let m;
  while ((m = re.exec(html))) {
    const t = m[1].replace(/&amp;/g, '&').replace(/&#x27;/g, "'").trim();
    if (t) runs.push(t);
  }
  return runs;
}

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });

try {
  const { CategoryChips } = await vite.ssrLoadModule('/src/views/ReceiptView.jsx');
  const { categoryLabel: L } = await vite.ssrLoadModule('/src/i18n/strings.js');
  const LIST = ['Eating out', 'Groceries', 'Car', 'Gifts'];

  /**
   * ——— THE LABEL IS WHAT HE READS; THE VALUE IS WHAT IS WRITTEN (finding M2).
   *
   * Every expectation below is stated as `L(value)` rather than as the Latin
   * string, so these assertions keep testing ORDER and PRESENCE — which is what
   * they are for — in whichever language the app is speaking. Stating them as
   * literals would mean this whole file silently only ever checked the English
   * install, on an app whose default is Arabic.
   *
   * The value's survival is asserted where it actually matters — at the callback
   * below, and at the wire in test-entry.mjs.
   */
  ok(L('Groceries') !== 'Groceries', 'the Arabic label is NOT the frozen value — or this file proves nothing');
  ok(L('Science Pitchers') === 'Science Pitchers', 'while a proper noun is left exactly as it is');

  const render = (selected) =>
    renderToStaticMarkup(createElement('div', null,
      createElement(CategoryChips, { list: LIST, selected, onPick: () => {} })));

  // ——— THE BUG ITSELF: the list must not change shape when he chooses.
  const none = render(null);
  const picked = render('Car');
  const count = (html) => (html.match(/<button/g) || []).length;
  eq(count(none), LIST.length, 'every category is offered when nothing is selected');
  eq(count(picked), LIST.length, 'and STILL every category after one is selected — none vanishes');
  for (const c of LIST) {
    ok(picked.includes(`>${L(c)}</button>`) || picked.includes(`✓ ${L(c)}</button>`),
      `${c} is still present after selecting Car`);
  }

  /**
   * ——— SELECTED FIRST (P4a), and the fixtures that make it mean something.
   *
   * "Selected is at index 0" alone is a weak claim: an implementation that
   * ALPHABETISED the list would pass it whenever the selection happens to sort
   * first, and one that sorted the remainder would pass it always. So the
   * remainder's ORIGINAL order is asserted too — LIST is deliberately not in
   * alphabetical order, which is what lets these two cases separate.
   */
  const order = (selected) => textRuns(render(selected)).map((t) => t.replace('✓ ', ''));
  const labels = (arr) => arr.map(L).join(',');
  eq(order(null).join(','), labels(LIST), 'with nothing selected the order is untouched');
  eq(order('Car')[0], L('Car'), 'the selected chip floats to the front');
  eq(order('Car').length, LIST.length, 'and nothing is added or lost in the move');
  eq(order('Car').slice(1).join(','), labels(LIST.filter((c) => c !== 'Car')),
    'the REST keep their original most-used-first order — not alphabetised');
  eq(order('Gifts')[0], L('Gifts'), 'any chip floats, not just one that already sorted early');
  eq(order('Gifts').slice(1).join(','), labels(['Eating out', 'Groceries', 'Car']),
    'and again the remainder is stable');

  // A selection this install does not offer must NOT be prepended as a phantom
  // chip — that would hand him a button the server will refuse.
  eq(order('Transportation').join(','), labels(LIST),
    'a selection absent from the list adds nothing and reorders nothing');

  // ——— the choice must be visible to a machine, not only to a colour.
  eq((picked.match(/aria-pressed="true"/g) || []).length, 1, 'exactly one chip reports selected');
  eq((none.match(/aria-pressed="true"/g) || []).length, 0, 'and none does when nothing is chosen');
  ok(picked.includes(`✓ ${L('Car')}</button>`), 'the selected chip is marked in TEXT, not by colour alone');
  ok(!picked.includes(`✓ ${L('Groceries')}`), 'and the others are not');
  /**
   * AND THE FROZEN VALUE IS NOT PAINTED AT HIM. The chip is 48px of one line;
   * the value belongs on the wire and, during the changeover, under the guess
   * button — not doubled onto every chip in the grid.
   */
  ok(!picked.includes('>Car</button>'), 'the raw wire value is not the chip text');

  // ——— toggle semantics, asserted through the callback rather than by eye.
  let handed = 'unset';
  const chips = CategoryChips({ list: LIST, selected: 'Car', onPick: (c) => { handed = c; } });
  /**
   * A MISSING CHIP MUST REPORT, NOT THROW. The first version of this file did
   * `find(label).props.onClick()` — and against the original bug (which removes
   * the selected chip) `find('Car')` was undefined, so the suite CRASHED before
   * printing anything. The most important mutation it had was the one whose
   * failure it could not describe. A test that dies instead of failing tells you
   * only that something is wrong, on the run where you most need to know what.
   */
  const find = (label) => {
    const el = chips.find((x) => x.key === label);
    if (el) return el;
    failures.push(`chip ${JSON.stringify(label)} is MISSING from the list — `
      + `the selected chip must never be removed (this is the original field bug)`);
    return { props: { onClick: () => {}, 'aria-pressed': '<missing chip>' } };
  };
  find('Groceries').props.onClick();
  eq(handed, 'Groceries', 'tapping another category moves the selection');
  find('Car').props.onClick();
  eq(handed, null, 'tapping the SELECTED category clears it');

  // ——— aria-pressed must track `selected`, not merely exist.
  eq(find('Car').props['aria-pressed'], true, 'the selected chip is aria-pressed');
  eq(find('Gifts').props['aria-pressed'], false, 'an unselected chip is not');

  /**
   * ——— النوع ALIGNS WITH ITS SIBLINGS (P4b).
   *
   * The card is RTL, so its other values sit right by inheritance — but a Latin
   * category name with `dir="auto"` resolves LTR and drifts left, breaking the
   * column. Asserted as `right` explicitly, NOT `end`: inside an RTL container
   * `end` resolves to LEFT, so a fix written that way is the same bug spelled
   * differently and would pass a test that only checked "an alignment is set".
   */
  const cardSrc = await readFile(new URL('../src/views/ReceiptView.jsx', import.meta.url), 'utf8');
  const catField = cardSrc.slice(cardSrc.indexOf('S.receiptCategory'));
  const catBlock = catField.slice(0, catField.indexOf('</Field>'));
  ok(catBlock.includes("textAlign: 'right'"), 'the النوع value is explicitly right-aligned');
  ok(!catBlock.includes("textAlign: 'end'"), "and NOT 'end', which means left in an RTL card");

  /**
   * ——— TWO DOORS, ONE PIPELINE (P3, 2026-08-01).
   *
   * Camera and photo-library differ by exactly ONE attribute: `capture`. With
   * it iOS opens the camera, without it the picker. That is the entire feature,
   * and a single attribute is precisely the kind of thing that regresses
   * silently — copy the input, forget to strip `capture`, and the library
   * button opens the camera with nobody the wiser.
   *
   * Both must also route through the SAME handler: a second path here would be
   * a second place for EXIF orientation to drift, and library images are the
   * ones most likely to carry a rewritten or missing orientation tag (old
   * photos, screenshots, WhatsApp re-compressions).
   */
  const ReceiptView = (await vite.ssrLoadModule('/src/views/ReceiptView.jsx')).default;
  const idle = renderToStaticMarkup(createElement(ReceiptView, { onSaved: () => {}, onManual: () => {} }));
  const inputs = idle.match(/<input[^>]*type="file"[^>]*>/g) || [];
  eq(inputs.length, 2, 'the idle screen offers exactly two ways in: camera and library');
  eq(inputs.filter((i) => i.includes('capture=')).length, 1,
    'exactly ONE carries capture — the camera');
  eq(inputs.filter((i) => !i.includes('capture=')).length, 1,
    'and exactly one does NOT — the library picker');
  ok(inputs.every((i) => i.includes('accept="image/*"')), 'both accept images');

  /**
   * BOTH DOORS MUST CALL THE SAME HANDLER — asserted against the SOURCE, not
   * the render, because React strips event handlers from server markup and the
   * rendered HTML simply cannot show it.
   *
   * Stated as prose in the component and NOT asserted, this was the one
   * mutation that survived: rewiring the library input to a different handler
   * passed every other check here. The claim it guards is the important one —
   * a second path is a second place for EXIF orientation to drift, and library
   * images are the ones most likely to carry a rewritten or missing orientation
   * tag. A source-level assertion is cruder than a behavioural one; it is also
   * the only kind available here, and crude-and-real beats elegant-and-absent.
   */
  const src = await readFile(new URL('../src/views/ReceiptView.jsx', import.meta.url), 'utf8');
  const inputTags = src.match(/<input\b[\s\S]*?\/>/g) || [];
  const fileTags = inputTags.filter((t) => t.includes('type="file"'));
  eq(fileTags.length, 2, 'source declares exactly two file inputs');
  eq(fileTags.filter((t) => t.includes('onChange={onFile}')).length, 2,
    'BOTH doors are wired to onFile — one pipeline, one EXIF path');

  /**
   * ——— THE JOBS LIST (WS4-Q): status is a WORD, and an unknown status says so.
   *
   * The spec's ledger obligation: the unnamed state must fail loud. An
   * unrecognised stage is not a synonym for "waiting" — it is a state we do not
   * understand, and rendering it as the happy path is precisely the class of lie
   * this project keeps finding. A machine must be able to tell the difference.
   */
  const { JobsList } = await vite.ssrLoadModule('/src/views/ReceiptView.jsx');
  /**
   * A RENDER THAT THROWS IS REPORTED, NOT PROPAGATED.
   *
   * `cairoClock(undefined)` throws inside `JobRow`, and an uncaught throw here
   * kills the process before a single assertion prints — which is how this suite
   * announced a real crash-on-missing-timestamp as a stack trace with no verdict
   * attached. The house pattern (WS3-C's third verdict) is that a detector must
   * fail, not die: the throw becomes a named failure and the run continues, so
   * the OTHER assertions still get to speak.
   */
  const listHtml = (jobs) => {
    try {
      return renderToStaticMarkup(createElement(JobsList, {
        jobs, onReview: () => {}, onRetry: () => {}, onCancel: () => {},
      }));
    } catch (err) {
      failures.push(`the jobs list THREW while rendering ${JSON.stringify(jobs)}`
        + `\n      ${err?.message || err} — a row that cannot render takes the whole queue view with it`);
      return '';
    }
  };
  /**
   * Assert on rendered TEXT, not raw markup. A first draft matched `/\d+%/`
   * against the HTML and failed on `width: 100%` in a style attribute, and
   * checked for a stage word that also appears in the list's TITLE. Both were
   * the test looking at the wrong thing — the neighbours of the claim rather
   * than the claim.
   */
  const listText = (jobs) => textRuns(listHtml(jobs)).join(' | ');
  const rowText = (jobs) => textRuns(listHtml(jobs)).slice(1).join(' | ');   // drop the title

  /**
   * A stored `ready` job ALWAYS carries its extraction — the worker writes the
   * body and the stage in one patch. The fixture used to say `{stage:'ready'}`
   * with nothing in it, a shape storage never holds, and it passed only while
   * the label read the stage alone. Same defect as the bare `{ok:true}` bodies
   * in the queue suite: a fixture more permissive than reality.
   */
  const isReceipt = { ok: true, extraction: { is_receipt: true, merchant_display: 'Nile Star Market' } };
  const notReceipt = { ok: true, extraction: { is_receipt: false, merchant_display: null } };

  const known = listText([
    { id: '1', stage: 'queued', queuedAt: 1 }, { id: '2', stage: 'reading', queuedAt: 2 },
    { id: '3', stage: 'ready', queuedAt: 3, extraction: isReceipt },
    { id: '4', stage: 'failed', retryable: true, queuedAt: 4 },
    { id: '5', stage: 'capped', queuedAt: 5 },
  ]);
  ok(!/\d+%/.test(known), 'NO percentage anywhere — extraction is one opaque call');
  ok(!known.includes('؟'), 'no unknown-stage marker when every stage is known');
  ok(known.includes('جاهز'), 'a ready job invites review');

  /**
   * ——— THE ZOMBIE, ON SCREEN (R-receipts 4 + 5).
   *
   * A photo the server judged not to be a receipt was STORED as `ready` and so
   * read «جاهز — راجعه» forever, offering a review card with nothing to review.
   * He had two of them on film. The row must now name the verdict instead —
   * and the fixture is stored `ready`, deliberately, because that is the shape
   * already sitting in his IndexedDB.
   */
  const zombie = rowText([{ id: 'z', stage: 'ready', queuedAt: 9, extraction: notReceipt }]);
  ok(zombie.includes('مش فاتورة'), 'A LEGACY not-a-receipt reads as a VERDICT…');
  ok(!zombie.includes('جاهز'), '…and never again as "ready — check it"');
  const settled = rowText([{ id: 'd', stage: 'dismissed', queuedAt: 9, extraction: notReceipt }]);
  ok(settled.includes('اتقفلت'), 'and once he has read it, the row says so');
  ok(!settled.includes('مش فاتورة'), 'without still presenting the verdict as news');

  /**
   * ——— EVERY ROW CAN BE REMOVED (R-receipts 3), including the one being read:
   * a photo mid-extraction is exactly the one he has decided was wrong.
   */
  for (const stage of ['queued', 'reading', 'ready', 'failed', 'capped', 'dismissed']) {
    const html = listHtml([{ id: 'r', stage, queuedAt: 1, retryable: true, extraction: isReceipt }]);
    ok(html.includes('✕'), `a ${stage} job offers a remove button`);
    /**
     * PRESENT IS NOT USABLE, and a mutation proved the difference: adding
     * `hidden` to that button left the glyph in the markup, so a check for `✕`
     * passed while the control was invisible on screen. Asserting on the
     * BUTTON's own markup — it is the last one opened before the glyph — is the
     * claim; asserting that the character exists somewhere is its neighbour.
     */
    const btn = html.slice(html.lastIndexOf('<button', html.indexOf('✕')));
    ok(btn.includes('aria-label'), `a ${stage} job's remove button is named for a screen reader`);
    ok(!btn.includes('hidden'), `a ${stage} job's remove button is actually VISIBLE, not merely rendered`);
    ok(btn.includes('min-width:48px'), `and it is at the tap floor on a ${stage} job`);
  }

  /**
   * ——— THE NAME ON THE CARD (R-receipts 2). "No name… that's terrible UX."
   */
  ok(rowText([{ id: 'n', stage: 'ready', queuedAt: 1, extraction: isReceipt }]).includes('Nile Star Market'),
    'a read job is named by its shop');
  ok(rowText([{ id: 'n', stage: 'queued', queuedAt: Date.UTC(2026, 7, 14, 9, 30) }]).includes('صورة الساعة'),
    'and an unread one by the time it was taken');

  /**
   * A JOB WITH NO CAPTURE TIME MUST NOT TAKE THE SCREEN DOWN.
   * `cairoClock(undefined)` reaches `Intl…format(Invalid Date)`, which THROWS
   * mid-render — one corrupt row would blank his whole queue. Found by this
   * suite CRASHING rather than failing, which is the recorded specimen: a check
   * that dies is not a check. The honest answer is a card with no time on it.
   */
  const timeless = rowText([{ id: 't', stage: 'queued' }]);
  ok(timeless.includes('صورة'), 'a job with no readable capture time still renders…');
  ok(!timeless.includes('الساعة'), '…naming no hour, rather than inventing or crashing on one');

  /**
   * CAPPED AND FAILED MUST READ DIFFERENTLY — asserted on the ROW, not the whole
   * list. The title already contains "بكرة" (it counts held jobs), so checking
   * the full text passed even when the row label was changed to the failure
   * string. Third time in this rev the assertion landed on a neighbour of the
   * claim; comparing the two rows against each other cannot drift that way,
   * because it names the distinction itself.
   */
  const cappedRow = rowText([{ id: 'c', stage: 'capped' }]);
  const failedRow = rowText([{ id: 'f', stage: 'failed', retryable: false }]);
  ok(cappedRow !== failedRow, 'a capped job does NOT read the same as a failed one');
  ok(cappedRow.includes('بكرة'), 'the capped row itself says it waits for tomorrow');
  ok(!cappedRow.includes('محصلش'), 'and never calls it a failure — the system is working');

  const unknown = rowText([{ id: 'x', stage: 'sproing' }]);
  ok(unknown.includes('؟'), 'an UNRECOGNISED stage is marked as unknown…');
  ok(unknown.includes('sproing'), '…and names itself rather than hiding');
  ok(!unknown.includes('في الدور'), 'and is NEVER silently rendered as "waiting"');

  eq(listHtml([]), '', 'an empty queue renders nothing at all');
  ok(!rowText([{ id: 'y', stage: 'queued' }]).includes('؟'),
    'and a KNOWN stage carries no unknown marker — the marker discriminates');

  // ——— NEGATIVE CONTROL: the old behaviour must fail these. If a filtered list
  // still passed, the suite would be decoration.
  const filtered = renderToStaticMarkup(createElement('div', null,
    createElement(CategoryChips, { list: LIST.filter((c) => c !== 'Car'), selected: 'Car', onPick: () => {} })));
  ok(count(filtered) !== LIST.length,
    'negative control: a list with the selected chip removed does NOT pass the shape check');
} finally {
  await vite.close();
}

const report = failures.length
  ? `❌ ${failures.length} / ${pass + failures.length} chip assertions failed:\n  - ${failures.join('\n  - ')}`
  : `✅ all ${pass} chip assertions passed`;
console.log(report);
process.exit(failures.length ? 1 : 0);
