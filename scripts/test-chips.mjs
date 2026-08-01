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
  const LIST = ['Eating out', 'Groceries', 'Car', 'Gifts'];

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
    ok(picked.includes(`>${c}</button>`) || picked.includes(`✓ ${c}</button>`),
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
  eq(order(null).join(','), LIST.join(','), 'with nothing selected the order is untouched');
  eq(order('Car')[0], 'Car', 'the selected chip floats to the front');
  eq(order('Car').length, LIST.length, 'and nothing is added or lost in the move');
  eq(order('Car').slice(1).join(','), LIST.filter((c) => c !== 'Car').join(','),
    'the REST keep their original most-used-first order — not alphabetised');
  eq(order('Gifts')[0], 'Gifts', 'any chip floats, not just one that already sorted early');
  eq(order('Gifts').slice(1).join(','), 'Eating out,Groceries,Car',
    'and again the remainder is stable');

  // A selection this install does not offer must NOT be prepended as a phantom
  // chip — that would hand him a button the server will refuse.
  eq(order('Transportation').join(','), LIST.join(','),
    'a selection absent from the list adds nothing and reorders nothing');

  // ——— the choice must be visible to a machine, not only to a colour.
  eq((picked.match(/aria-pressed="true"/g) || []).length, 1, 'exactly one chip reports selected');
  eq((none.match(/aria-pressed="true"/g) || []).length, 0, 'and none does when nothing is chosen');
  ok(picked.includes('✓ Car</button>'), 'the selected chip is marked in TEXT, not by colour alone');
  ok(!picked.includes('✓ Groceries'), 'and the others are not');

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
  const listHtml = (jobs) => renderToStaticMarkup(
    createElement(JobsList, { jobs, onReview: () => {}, onRetry: () => {} }));
  /**
   * Assert on rendered TEXT, not raw markup. A first draft matched `/\d+%/`
   * against the HTML and failed on `width: 100%` in a style attribute, and
   * checked for a stage word that also appears in the list's TITLE. Both were
   * the test looking at the wrong thing — the neighbours of the claim rather
   * than the claim.
   */
  const listText = (jobs) => textRuns(listHtml(jobs)).join(' | ');
  const rowText = (jobs) => textRuns(listHtml(jobs)).slice(1).join(' | ');   // drop the title

  const known = listText([
    { id: '1', stage: 'queued' }, { id: '2', stage: 'reading' },
    { id: '3', stage: 'ready' }, { id: '4', stage: 'failed', retryable: true },
    { id: '5', stage: 'capped' },
  ]);
  ok(!/\d+%/.test(known), 'NO percentage anywhere — extraction is one opaque call');
  ok(!known.includes('؟'), 'no unknown-stage marker when every stage is known');
  ok(known.includes('جاهز'), 'a ready job invites review');

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
