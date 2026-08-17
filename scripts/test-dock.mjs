#!/usr/bin/env node
/**
 * The pinned submit and its readiness rule (S1/S2).  `npm run check:dock`
 *
 * ——— THE FINDING, measured on the device 2026-08-17.
 *
 * At 375×812 the body is 658px. The old ﹢ screen laid out title (32) + method
 * (62) + amount (64) + keypad (270) + eight quick chips (114) + twenty-seven
 * categories, and only then «سجّل المصروف». The button that ENDS the task sat
 * roughly 200px below the fold, on the one screen in this app that exists to
 * satisfy "capture in under five seconds" (CLAUDE.md, the one design law).
 *
 * ——— THE BUG THAT WAS ALREADY THERE, and is the reason this is a module.
 *
 * Readiness was stated TWICE, in two files, in two different dialects:
 *
 *     EntryView   amount && parseFloat(amount) > 0 && cat && !busy
 *     App.jsx     if (!amount || !entryCat || entryBusy) return
 *
 * They disagree on "0". `parseFloat("0") > 0` is false, so the button was dead;
 * `!"0"` is false too, so the handler ran. Any path that could call the handler
 * without the button — a keyboard Enter, a future gesture, a test — would post a
 * zero-pound row into his book. Neither expression was wrong on its own; having
 * two was.
 *
 * So the assertions below are aimed at three things, in order of what they cost
 * if wrong: that the wire is protected from a value the button rejects, that the
 * dock NAMES the missing step instead of merely greying, and that the layout
 * fact this rev is about is actually true in the file.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';
import {
  DOCK_STATES, dockState, entryReady, pressKey, MAX_AMOUNT_CHARS,
} from '../src/state/entryDock.js';
import { AR, AR_LOCALE } from '../src/i18n/strings.ar.js';
import { EN } from '../src/i18n/strings.en.js';

// The dock prints the category's LABEL; the VALUE reaches the wire (finding
// M2, pinned at the wire in test-entry.mjs).
const L = AR_LOCALE.categoryLabel;

let pass = 0;
const failures = [];
const eq = (a, b, label) => {
  if (Object.is(a, b)) { pass++; return; }
  failures.push(`${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const ok = (c, label) => eq(!!c, true, label);

// ——————————————————————— the states are a closed set, in his order
eq(DOCK_STATES.join(','), 'needAmount,needCategory,ready', 'three states, in the order he passes through them');

// ——————————————————————— what is missing, and it names the AMOUNT first
eq(dockState({ amount: '', cat: null }), 'needAmount', 'an empty screen asks for the amount');
eq(dockState({ amount: '', cat: 'Eating out' }), 'needAmount',
  'and still asks for the amount when only the category is in — the keypad is already under his thumb');
eq(dockState({ amount: '60', cat: null }), 'needCategory', 'with an amount, the category is what is left');
eq(dockState({ amount: '60', cat: 'Eating out' }), 'ready', 'both present is ready');

/**
 * ——————————————————————— THE ZERO, which is the whole reason for the module.
 *
 * Every one of these was postable through App.jsx's old `!amount` check while
 * the view's own `parseFloat(amount) > 0` had the button dead. A row of 0 EGP in
 * his book is not a crash; it is a line he has to find and delete by hand.
 */
eq(dockState({ amount: '0', cat: 'Eating out' }), 'needAmount', 'a bare zero is not an amount…');
eq(dockState({ amount: '0.00', cat: 'Eating out' }), 'needAmount', '…nor is a padded one…');
eq(dockState({ amount: '-5', cat: 'Eating out' }), 'needAmount', '…nor a negative…');
eq(dockState({ amount: '.', cat: 'Eating out' }), 'needAmount', '…nor a lone decimal point…');
eq(dockState({ amount: 'abc', cat: 'Eating out' }), 'needAmount', '…nor anything unparseable');
eq(entryReady({ amount: '0', cat: 'Eating out', busy: false }), false,
  'and the boolean the HANDLER reads says so too — one rule, both callers');
eq(entryReady({ amount: '0.5', cat: 'Eating out', busy: false }), true,
  'while half a pound is a real expense and must not be collateral');

// ——————————————————————— busy enters at the boolean, never at the state
eq(dockState({ amount: '60', cat: 'Eating out' }), 'ready',
  'a write in flight does not make the entry incomplete…');
eq(entryReady({ amount: '60', cat: 'Eating out', busy: true }), false,
  '…but it does stop the second tap — which is what keeps one tap from being two rows');
eq(entryReady({ amount: '60', cat: 'Eating out', busy: false }), true, 'and releases afterwards');

/**
 * ——————————————————————— THE KEYPAD, and the leading zero.
 *
 * Found by driving the real screen: 0 then 6 gave "06", 0-0-6 gave "006".
 * Nothing was ever written wrong — parseFloat("060") is 60 — which is exactly
 * why it survived: the amount was a small line above a keypad and nobody read it
 * twice. The pinned dock now echoes it back at 18px on the last screen before
 * the row is written, so «سجّل · 060 جنيه» is the app stating his expense in a
 * form he did not type. The honest-render law is about what a person READS.
 */
eq(pressKey('', '6'), '6', 'the first digit is the amount');
eq(pressKey('6', '0'), '60', 'and the second appends');
eq(pressKey('0', '6'), '6', 'but a leading zero is REPLACED, not appended — this is the bug');
eq(pressKey('0', '0'), '0', 'and zero on zero stays one zero, not "00"');
eq(pressKey('060', '⌫'), '06', 'backspace still just removes the last character');
eq(pressKey('6', '⌫'), '', 'down to empty');
eq(pressKey('', '⌫'), '', 'and backspace on empty is not an error');

/**
 * THE ZERO THAT MUST SURVIVE. "0." is a real prefix of "0.50", and half a pound
 * is a real expense — collapsing every leading zero would eat it.
 */
eq(pressKey('', '.'), '0.', 'a bare decimal point opens with its zero…');
eq(pressKey('0', '.'), '0.', '…and a zero followed by a point keeps the zero');
eq(pressKey('0.', '5'), '0.5', '…so half a pound is typable');
eq(pressKey('0.5', '0'), '0.50', '…to the piastre');
eq(pressKey('0.5', '.'), '0.5', 'and a second point is refused');
eq(dockState({ amount: '0.5', cat: 'Gifts' }), 'ready', 'and it is a writable amount');

eq(pressKey('123456789', '1'), '123456789', `the length cap holds at ${MAX_AMOUNT_CHARS}`);
eq(pressKey('12345678', '9'), '123456789', 'and admits the character that reaches it');
eq(pressKey('60', 'x'), '60', 'anything that is not a digit, a point or a backspace changes nothing');

/**
 * ——————————————————————— THE LABEL IS THE STATE, in both locales.
 *
 * A disabled button that says nothing leaves him guessing which of two fields is
 * missing. These are asserted against the string files rather than against
 * literals, so renaming a label re-runs the check instead of silently passing.
 */
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { EntryDock } = await vite.ssrLoadModule('/src/views/EntryView.jsx');
  const noop = () => {};
  const dock = (props) => renderToStaticMarkup(createElement(EntryDock, { onSubmit: noop, busy: false, ...props }));

  const empty = dock({ amount: '', cat: null });
  const noCat = dock({ amount: '60', cat: null });
  const done = dock({ amount: '60', cat: 'Eating out' });
  const saving = dock({ amount: '60', cat: 'Eating out', busy: true });

  ok(empty.includes(AR.entryNeedAmount), 'with nothing entered it asks for the amount, in words');
  ok(noCat.includes(AR.entryNeedCategory), 'with an amount it asks for the category');
  ok(!noCat.includes(AR.entryNeedAmount), 'and stops asking for what it already has');
  ok(done.includes('60'), 'when ready it shows the amount…');
  ok(done.includes(L('Eating out')), '…and the category, so the whole row is legible before it is written');
  ok(done.includes(AR.entryLog), '…under the verb');
  ok(saving.includes(AR.saving), 'a write in flight says so');

  // The disabled attribute and the label must agree — they read one value.
  ok(/disabled/.test(empty), 'not ready is disabled');
  ok(/disabled/.test(noCat), 'still disabled with only an amount');
  ok(!/disabled/.test(done), 'ready is pressable');
  ok(/disabled/.test(saving), 'and busy is not pressable — the double-tap guard, at the button');

  /**
   * The three states must render as three DIFFERENT things. A dock that greyed
   * identically in all three would pass every `includes` above if the strings
   * happened to be substrings of one another.
   */
  ok(empty !== noCat && noCat !== done && done !== saving, 'four states, four renderings');

  eq((done.match(/min-height:58px/g) || []).length, 1,
    'and it is a full-width target, not a link — he presses this one-handed');
} finally {
  await vite.close();
}

/**
 * ——————————————————————— AND THE LAYOUT CLAIM, asserted against the files.
 *
 * The finding is about ORDER on a 658px body, and order is not observable from a
 * rendered string without laying it out. What IS observable is that the two
 * moves actually happened in the source, so a later edit that quietly puts the
 * submit back into the scroll turns this red.
 */
{
  const view = await readFile(new URL('../src/views/EntryView.jsx', import.meta.url), 'utf8');
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');

  /**
   * The accelerator chips come before the keypad in the file, and the file is
   * the order. The marker is `repeats.map` since A3 — the row is his own last
   * entries now, padded with the old hand-written presets — but the ordering
   * this asserts is the S2 one and is unchanged.
   */
  const iQuick = view.indexOf('repeats.map');
  const iKeys = view.indexOf("'1', '2', '3'");
  const iCats = view.indexOf('CATEGORIES.slice');
  ok(iQuick > -1 && iKeys > -1 && iCats > -1, 'the three blocks are all still there');
  ok(iQuick < iKeys, 'the one-tap chips are ABOVE the keypad — they set description AND category');
  ok(iKeys < iCats, 'and the categories follow the keypad, as before');

  // The submit is not in the scrolling body any more.
  ok(/export function EntryDock/.test(view), 'the submit is its own component…');
  ok(!/EntryView\([^)]*onSubmit/.test(view), '…and the scrolling view no longer takes onSubmit at all');
  ok(/<EntryDock/.test(app), 'the shell renders it…');
  const iMain = app.indexOf('</main>');
  const iDock = app.indexOf('<EntryDock');
  const iNav = app.indexOf('<nav');
  ok(iMain < iDock && iDock < iNav, '…between the scroll and the tab bar, so it cannot scroll away');

  // One readiness rule, and the old second one is gone.
  ok(/entryReady\(/.test(app), 'the handler asks the shared rule…');
  ok(!/!amount \|\| !entryCat \|\| entryBusy/.test(app), '…and its old private copy is deleted');

  // The empty amount is no longer painted in the border colour (S2).
  ok(!/color: amount \? C\.ink : C\.line/.test(view),
    'the empty amount is not the card-border colour any more — it was invisible until typed');

  // The keypad calls the shared rule rather than carrying its own string maths.
  ok(/pressKey\(amount,/.test(view), 'the keypad delegates to the tested rule…');
  ok(!/setAmount\(amount \+ /.test(view), '…and its old inline append is gone');
}

const report = failures.length
  ? `❌ ${failures.length} / ${pass + failures.length} dock checks failed:\n  - ${failures.join('\n  - ')}`
  : `✅ all ${pass} dock checks passed`;
console.log(report);
process.exit(failures.length ? 1 : 0);
