#!/usr/bin/env node
/**
 * The manual entry's method chooser (R-receipts 1).  `npm run check:entry`
 *
 * FIELD FINDING, his walkthrough of 2026-08-12: the ﹢ screen said "Cash" in
 * every voice — tab, title, button, empty state — and "it's not always cash".
 * Since D18c he is abroad, where a card purchase sends no Arabic SMS and so
 * never logs itself; the method had to become his to choose.
 *
 * THE BUG THIS REV COULD HAVE SHIPPED, and what every assertion below is aimed
 * at. `normalizeMethod_` (06 §3.1) does case-insensitive EQUALITY with `visa`
 * and coerces ANYTHING ELSE to Cash. It does not reject. So posting the button's
 * own label — `Card`, «فيزا» — writes a card expense into the Cash column, with
 * a ✓ on screen, no error on the wire, and nothing in his sheet to notice it by
 * until a month total is wrong. That is WS1-M's specimen reaching the app
 * through the one door WS1-M could not cover: until today there was no chooser.
 *
 * So the question asked of each assertion is the house one — what wrong
 * implementation would still pass this? — and for the load-bearing ones the
 * answer has to be "the one that was one keystroke away".
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';
import {
  METHODS, DEFAULT_METHOD, isMethod, manualPayload, applyEntryToToday,
} from '../src/state/entryPayload.js';
import { AR } from '../src/i18n/strings.ar.js';
import { EN } from '../src/i18n/strings.en.js';

let pass = 0;
const failures = [];
const eq = (a, b, label) => {
  if (Object.is(a, b)) { pass++; return; }
  failures.push(`${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const ok = (c, label) => eq(!!c, true, label);

// ——————————————————————— the vocabulary IS the wire's
eq(METHODS.join(','), 'Cash,Visa', 'two methods, spelled exactly as the sheet and the contract spell them');
eq(DEFAULT_METHOD, 'Cash', 'and cash is the default — a card purchase at home logs itself from the SMS');
ok(isMethod('Cash'), 'Cash is a method');
ok(isMethod('Visa'), 'Visa is a method');

/**
 * ——————————————————————— THE LABEL IS NOT THE VALUE.
 *
 * Every one of these is a string that appears ON THE BUTTON in one locale or the
 * other. None of them may be a method, because the server would answer `ok` to
 * all of them and write Cash.
 */
ok(!isMethod('Card'), 'the English label is NOT a method — the server would coerce it to Cash silently');
ok(!isMethod(EN.methodCard), 'stated against the string file itself, so renaming the label re-runs this');
ok(!isMethod(AR.methodCard), 'and the Arabic label is not one either');
ok(!isMethod('card'), 'nor its lowercase');
ok(!isMethod('visa'), 'nor a lowercase visa — the contract says EQUALITY, and the app holds the canonical form');
ok(!isMethod(''), 'nor an empty string');
ok(!isMethod(undefined), 'nor a missing value');
eq(EN.methodCard === 'Visa', false, 'the two locales label the column, they do not name it…');
eq(AR.methodCash === 'Cash', false, '…in either direction');

// ——————————————————————— the payload
{
  const base = {
    amount: 60, category: 'Eating out', description: 'Coffee',
    clientId: 'cid-1', entryDate: '14/8/2026',
  };
  eq(manualPayload({ ...base, method: 'Visa' }).method, 'Visa', 'a card entry posts Visa');
  eq(manualPayload({ ...base, method: 'Cash' }).method, 'Cash', 'a cash entry posts Cash');
  /**
   * The floor, not a feature. Nothing in the app can reach it — but if anything
   * ever does, it must degrade the way the SERVER would, so the client's belief
   * about what was written can never differ from the sheet's.
   */
  eq(manualPayload({ ...base, method: 'Card' }).method, 'Cash',
    'a label arriving here does NOT become Visa — it degrades exactly as the server would');
  eq(manualPayload({ ...base, method: undefined }).method, 'Cash', 'and so does a missing method');

  const p = manualPayload({ ...base, method: 'Visa' });
  eq(p.description, 'Coffee', 'his description rides along');
  eq(manualPayload({ ...base, method: 'Visa', description: '' }).description, 'Eating out',
    'and an empty one falls back to the category, never to blank');
  eq(Object.keys(p).sort().join(','), 'amount,category,clientId,description,entryDate,method',
    'exactly the six fields §3.1 names — no more, so nothing private leaks into a write');

  /**
   * ——— TRAVEL MODE ADDS A SEVENTH FIELD, AND ONLY WHILE HE IS TRAVELLING (A4).
   *
   * The payload he sends EVERY DAY has to stay exactly the six above — same
   * keys, same bytes as the path in production since Phase 1 — because that is
   * the one this app's whole capture story rests on. So the assertion is in two
   * halves: at home the key is ABSENT (not present holding undefined, which
   * `Object.keys` would still count), and abroad it is there with a value the
   * server's allow-list accepts.
   */
  eq(Object.keys(manualPayload({ ...base, currency: 'EGP' })).indexOf('currency'), -1,
    'in Cairo there is no currency key at all — the daily payload is untouched');
  eq(Object.keys(manualPayload({ ...base, currency: undefined })).indexOf('currency'), -1,
    'and none when the caller says nothing about currency');
  eq(manualPayload({ ...base, currency: 'EUR' }).currency, 'EUR',
    'abroad the currency rides along…');
  eq(Object.keys(manualPayload({ ...base, currency: 'EUR' })).sort().join(','),
    'amount,category,clientId,currency,description,entryDate,method',
    '…as the seventh field, and nothing else appears with it');
  /**
   * A CURRENCY THE SERVER WOULD REFUSE NEVER LEAVES. `normalizeCurrency_`
   * coerces an unknown code to EGP — so sending one would write a foreign amount
   * into his book as POUNDS, a wrong number with a ✓ over it. Dropping it here
   * means the app and the server agree before the request is made.
   */
  eq(Object.keys(manualPayload({ ...base, currency: 'BTC' })).indexOf('currency'), -1,
    'a currency outside the offered list is dropped rather than sent to be silently coerced');
}

/**
 * ——————————————————————— THE OPTIMISTIC LINE MUST CREDIT THE COLUMN HE CHOSE.
 *
 * The old handler added to `totals.Cash` unconditionally, which was correct only
 * while the screen was cash-only. Under a chooser it is a false number on the
 * screen headed «مصاريف النهاردة — زي ما هي في الشيت بالظبط».
 *
 * Both directions are fixtured because either alone passes the wrong answer: a
 * version hardcoded to Cash passes the Cash case, and one hardcoded to Visa
 * passes the Visa case.
 */
{
  const today = () => ({ entries: [{ description: 'old', amount: 5 }], totals: { Visa: 100, Cash: 20 } });

  const visa = applyEntryToToday(today(), { method: 'Visa', amount: 60, description: 'Coffee' });
  eq(visa.totals.Visa, 160, 'a card entry moves the card total…');
  eq(visa.totals.Cash, 20, '…and leaves cash exactly where it was');

  const cash = applyEntryToToday(today(), { method: 'Cash', amount: 60, description: 'Guards' });
  eq(cash.totals.Cash, 80, 'a cash entry moves the cash total…');
  eq(cash.totals.Visa, 100, '…and leaves the card alone');

  eq(visa.entries.length, 2, 'the row joins the list he is looking at');
  eq(visa.entries[1].description, 'Coffee', 'as the row he just wrote');

  const input = today();
  applyEntryToToday(input, { method: 'Visa', amount: 60 });
  eq(input.totals.Visa, 100, 'the input is never mutated — React state is replaced, not edited');
  eq(input.entries.length, 1, 'and its list is untouched too');

  const bad = today();
  eq(applyEntryToToday(bad, { method: 'Card', amount: 60 }), bad,
    'an unrecognised method changes NOTHING rather than guessing a column');
  eq(applyEntryToToday(bad, { method: 'Visa', amount: NaN }), bad,
    'and an unreadable amount is not added as 0 — honest render, at the totals');
}

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });

try {
  const EntryView = (await vite.ssrLoadModule('/src/views/EntryView.jsx')).default;
  const noop = () => {};
  const render = (method) => renderToStaticMarkup(createElement(EntryView, {
    amount: '', setAmount: noop, desc: '', setDesc: noop, cat: null, setCat: noop,
    method, setMethod: noop, onSubmit: noop, busy: false,
  }));
  // The chooser's own markup: the group opens at role="group" and closes at the
  // first </div> after it, since its children are buttons.
  const group = (html) => html.slice(html.indexOf('role="group"')).split('</div>')[0];

  const asCash = group(render('Cash'));
  const asVisa = group(render('Visa'));

  eq((asCash.match(/<button/g) || []).length, 2, 'two buttons, one decision');
  eq((asCash.match(/aria-pressed="true"/g) || []).length, 1,
    'exactly one is pressed — neither "both" nor "none" is a state a chooser may be in');
  eq((asVisa.match(/aria-pressed="true"/g) || []).length, 1, 'in either position');
  ok(asCash !== asVisa, 'and the two positions actually render differently');

  /**
   * WHICH one is pressed, in both directions. A hardcoded `aria-pressed={true}`
   * on the first button passes a one-direction check and tells him he is paying
   * cash while the payload says Visa.
   */
  const pressedLabel = (html) => {
    const m = html.match(/aria-pressed="true"[^>]*>([^<]*)</);
    return m ? m[1] : null;
  };
  eq(pressedLabel(asCash), AR.methodCash, 'Cash selected shows the cash label pressed');
  eq(pressedLabel(asVisa), AR.methodCard, 'Visa selected shows the card label pressed');

  ok(asCash.includes(AR.methodCard), 'the unchosen option stays on screen — he can switch without leaving');
  eq((asCash.match(/min-height:48px/g) || []).length, 2,
    'both sit at the tap floor — this screen is used one-handed, in a shop');
} finally {
  await vite.close();
}

/**
 * ——————————————————————— AND THE SAME CLAIM AT THE WIRE.
 *
 * `endpoints.js` does not forward the payload — it DESTRUCTURES named fields and
 * reassembles the body (the M8 finding, 2026-08-13). Deleting `method` from that
 * whitelist strips it from every manual write and the server defaults it to
 * Cash: the exact column swap, invisible to every assertion above.
 *
 * The credentials are fake and local by construction. This speaks to no
 * deployment, and by law (D18b, RED LETTER) never to his book.
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
  const { manual } = await import('../src/api/endpoints.js');

  await manual(manualPayload({
    amount: 60, method: 'Visa', category: 'Eating out', description: 'Coffee',
    clientId: 'cid-1', entryDate: '14/8/2026',
  }));
  eq(sent.length, 1, 'one tap is one request');
  eq(sent[0].action, 'manual', 'and it is a manual write');
  eq(sent[0].method, 'Visa', 'THE METHOD IS ON THE WIRE — not merely in the object we built');
  eq(sent[0].amount, 60, 'with his amount');
  eq(sent[0].category, 'Eating out', 'his category');
  eq(sent[0].entryDate, '14/8/2026', 'and the date stamped at tap time');

  // Both values through the same layer: a whitelist hardcoded to one of them
  // would satisfy a single-value check (the M2 lesson — a pass-through is never
  // provable from one value).
  sent.length = 0;
  await manual(manualPayload({
    amount: 12, method: 'Cash', category: 'Gifts', description: '',
    clientId: 'cid-2', entryDate: '14/8/2026',
  }));
  eq(sent[0].method, 'Cash', 'and cash reaches the wire as cash');

  delete globalThis.fetch;
  delete globalThis.localStorage;
}

/**
 * ——————————————————————— AND THE APP ACTUALLY CALLS THEM.
 *
 * Proving a pure function correct while the screen keeps its own inline literal
 * is the trap this project has fallen into repeatedly. The old handler's
 * `method: 'Cash'` and `totals.Cash + amount` are the two literals this rev
 * exists to remove, so their absence is asserted, not assumed.
 */
{
  const appSrc = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  ok(/manualPayload\(\{/.test(appSrc), 'the entry builds its payload in the named place…');
  ok(/applyEntryToToday\(d\.today,/.test(appSrc), '…and its optimistic line in the other one');
  ok(!/method: 'Cash'/.test(appSrc), 'the hardcoded method is GONE from the handler');
  ok(!/totals\.Cash \+ amount/.test(appSrc), 'and so is the hardcoded cash total');
  ok(/setEntryMethod\(DEFAULT_METHOD\)/.test(appSrc),
    'and the chooser resets after a write — a sticky Card files his next cash expense wrong');

  const viewSrc = await readFile(new URL('../src/views/EntryView.jsx', import.meta.url), 'utf8');
  ok(/METHODS\.map\(/.test(viewSrc), 'the buttons are generated from the wire vocabulary…');
  ok(/setMethod\(m\)/.test(viewSrc), '…and hand back the vocabulary item itself');
  ok(!/setMethod\(['"`]/.test(viewSrc), 'never a string literal');
  ok(!/setMethod\(S\./.test(viewSrc), 'and never a label — which is the whole rev');
}

const report = failures.length
  ? `❌ ${failures.length} / ${pass + failures.length} entry checks failed:\n  - ${failures.join('\n  - ')}`
  : `✅ all ${pass} entry checks passed`;
console.log(report);
process.exit(failures.length ? 1 : 0);
