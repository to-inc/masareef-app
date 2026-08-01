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

let pass = 0;
const failures = [];
const eq = (actual, expected, label) => {
  if (Object.is(actual, expected)) { pass++; return; }
  failures.push(`${label}\n      expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};
const ok = (cond, label) => eq(!!cond, true, label);

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
