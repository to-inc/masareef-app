#!/usr/bin/env node
/**
 * The five behaviours added by the design read's Tier 3.  `npm run check:tier3`
 *
 *   A1  the evening recap is the front door        state/opening.js
 *   A3  his own last entries, with their amounts   state/repeats.js
 *   A6  the ❓ count on the home-screen icon        state/badge.js
 *   A7  «افتح الشيت» — one tap to his own book     state/secret.js
 *
 * ——— WHAT THIS FILE IS ACTUALLY GUARDING.
 *
 * Three of these WRITE something to his screen that no server sent: a landing
 * tab, a prefilled amount, a badge. That is a new category of risk for this app,
 * whose entire discipline until now has been "never print a number the data does
 * not support". The assertions below are aimed at the places where each could
 * invent something — an amount he never spent, a link to the wrong document —
 * because those are the failures that would cost trust rather than convenience.
 *
 * A8 (a weekly reconciliation question) was BUILT AND THEN REMOVED at Tarek's
 * call on 2026-08-17: "it doesn't make sense to me, it's a bit weird". He was
 * right — it was the only surface in the app that asked him for something, and
 * the register was off. The month's most-visited merchant took its place, in
 * the captain's log where a monthly report already lives.
 */
import { readFile } from 'node:fs/promises';
import { openingTab, cairoHourOf, RECAP_HOUR } from '../src/state/opening.js';


let pass = 0;
const failures = [];
const eq = (a, b, label) => {
  if (Object.is(a, b)) { pass++; return; }
  failures.push(`${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const ok = (c, label) => eq(!!c, true, label);

/**
 * A localStorage that behaves like one. `repeats.js` and `query.js` both persist,
 * and a stub that silently dropped writes would make every "it remembers" and
 * every "it does not ask twice" assertion below pass for the wrong reason.
 */
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const { remember, repeatChips, repeatKey, MAX_REPEATS, _reset: resetRepeats } =
  await import('../src/state/repeats.js');
const { CASH_QUICK } = await import('../src/lib/constants.js');

/* ═══════════════════════ A1 · which screen he lands on ═══════════════════ */
{
  const DAY = true;
  eq(openingTab(9, DAY), 'inbox', 'the morning opens on what needs him');
  eq(openingTab(14, DAY), 'inbox', 'and so does the afternoon');
  eq(openingTab(RECAP_HOUR, DAY), 'book', `from ${RECAP_HOUR}:00 the day's account is the useful screen`);
  eq(openingTab(23, DAY), 'book', 'and it stays that way to midnight');
  eq(openingTab(0, DAY), 'inbox', 'after midnight it is a new day with nothing in it yet');

  /**
   * AN EMPTY DAY IS NOT A RECAP. Landing on «النهاردة» at 8pm having spent
   * nothing tells him less than the Inbox would, and reads as though the app
   * lost his day.
   */
  eq(openingTab(20, false), 'inbox', 'a day with no rows opens on the Inbox even in the evening');

  // An unreadable clock falls back to where the app has always opened.
  eq(openingTab(null, DAY), 'inbox', 'no clock is not a reason to move the front door');
  eq(openingTab(99, DAY), 'inbox', 'and neither is a nonsense hour');
  eq(openingTab('evening', DAY), 'inbox', 'nor a non-numeric one');

  /**
   * THE HOUR IS CAIRO'S, FROM THE SERVER — never the device's. A phone left on
   * the wrong timezone is a real thing, and this app has been anchored on Cairo
   * since its first parser.
   */
  eq(cairoHourOf('2026-08-17T16:30:00.000Z'), 19, 'a UTC stamp is read in Cairo time (+3 in August)');
  eq(cairoHourOf('2026-08-17T05:00:00.000Z'), 8, 'and so is the morning');
  eq(cairoHourOf(''), null, 'an empty stamp is unreadable, not midnight');
  eq(cairoHourOf(null), null, 'and a missing one is not either');
  eq(cairoHourOf('not a date'), null, 'and nor is a broken one — never a guess');
}

/* ═══════════════════════ A3 · his own last entries ═══════════════════════ */
{
  resetRepeats();
  eq(repeatChips().length, Math.min(MAX_REPEATS, CASH_QUICK.length),
    'a FRESH install is never bare — the hand-written presets fill the row');
  ok(repeatChips().every((c) => c.amount === null),
    'and a preset carries no amount, exactly as it never did');

  remember({ description: 'Coffee', category: 'Eating out', method: 'Cash', amount: 60, currency: 'EGP' });
  const after = repeatChips();
  eq(after[0].description, 'Coffee', 'what he logged comes first');
  eq(after[0].amount, 60, 'carrying the amount he actually paid');
  eq(after[0].category, 'Eating out', 'and the category he actually chose');

  /**
   * THE LAST AMOUNT, NEVER AN AVERAGE. 60 then 65 is one habit at a new price;
   * an average of 62.5 is a number he has never once spent, prefilled into a
   * field that writes to his book.
   */
  remember({ description: 'Coffee', category: 'Eating out', method: 'Cash', amount: 65, currency: 'EGP' });
  eq(repeatChips()[0].amount, 65, 'a second coffee updates the price…');
  eq(repeatChips().filter((c) => c.description === 'Coffee').length, 1, '…it does not add a second chip');
  ok(!repeatChips().some((c) => c.amount === 62.5), 'and it is never averaged into a figure he never paid');

  // Identity is description + method, deliberately not the amount.
  eq(repeatKey({ description: 'Coffee', method: 'Cash' }), repeatKey({ description: ' coffee ', method: 'Cash' }),
    'the same purchase keys the same whatever the spacing or case');
  ok(repeatKey({ description: 'Coffee', method: 'Cash' }) !== repeatKey({ description: 'Coffee', method: 'Visa' }),
    'while the same thing paid differently is a different repeat');

  /**
   * WHAT IS REFUSED. Each of these would put a chip in front of him that writes
   * something wrong when tapped.
   */
  resetRepeats();
  remember({ description: '', amount: 60, currency: 'EGP' });
  ok(!repeatChips().some((c) => c.description === ''), 'a nameless entry is not a chip he can read');
  remember({ description: 'Zero', amount: 0, currency: 'EGP' });
  ok(!repeatChips().some((c) => c.description === 'Zero'), 'and 0 is not an expense to repeat');
  remember({ description: 'NoPrice', amount: null, currency: 'EGP' });
  ok(!repeatChips().some((c) => c.description === 'NoPrice'), 'nor an unpriced row — there is nothing to prefill');
  /**
   * AND NOT A FOREIGN ONE. The keypad is a POUND keypad: refilling it with 12.5
   * from a euro receipt would write 12.5 EGP into his book. Travel has its own
   * path.
   */
  remember({ description: 'Café de Flore', amount: 12.5, currency: 'EUR' });
  ok(!repeatChips().some((c) => c.description === 'Café de Flore'),
    'a EUR entry is never offered to a pound keypad — that is a 12.5 EGP row waiting to happen');

  // The cap holds, and his own entries push the presets off rather than the reverse.
  resetRepeats();
  for (let i = 0; i < MAX_REPEATS + 3; i++) {
    remember({ description: `Shop ${i}`, category: 'Groceries', method: 'Cash', amount: 10 + i, currency: 'EGP' });
  }
  eq(repeatChips().length, MAX_REPEATS, `the row holds at ${MAX_REPEATS}`);
  ok(repeatChips().every((c) => c.amount != null), 'and once he has his own, the presets are gone');
  eq(repeatChips()[0].description, `Shop ${MAX_REPEATS + 2}`, 'most recent first');
}

/* ═══════════════════════ A6 · the icon badge ═════════════════════════════ */
{
  const { setBadge, badgeSupported } = await import('../src/state/badge.js');
  // Absent API — a Safari tab, or any engine without the Badging API.
  delete globalThis.navigator;
  eq(badgeSupported(), false, 'an engine without the API reports so…');
  eq(setBadge(3), false, '…and setting a badge there is a no-op, never a crash');

  const calls = [];
  globalThis.navigator = {
    setAppBadge: (n) => { calls.push(['set', n]); return Promise.resolve(); },
    clearAppBadge: () => { calls.push(['clear']); return Promise.resolve(); },
  };
  eq(badgeSupported(), true, 'an installed app has it');
  setBadge(4);
  eq(JSON.stringify(calls.at(-1)), '["set",4]', 'four waiting rows is a 4 on the icon');
  /**
   * ZERO CLEARS, IT DOES NOT SET. `setAppBadge(0)` shows an unlabelled DOT on
   * some platforms — "something, unspecified" — where the truth is "nothing".
   */
  setBadge(0);
  eq(JSON.stringify(calls.at(-1)), '["clear"]', 'and an empty inbox clears it rather than showing a bare dot');
  setBadge(NaN);
  eq(JSON.stringify(calls.at(-1)), '["clear"]', 'a NaN count clears too — never a permanent smudge on his home screen');
  setBadge(-2);
  eq(JSON.stringify(calls.at(-1)), '["clear"]', 'and so does a negative one');

  // A rejecting implementation must not surface as an unhandled rejection.
  globalThis.navigator = { setAppBadge: () => Promise.reject(new Error('nope')) };
  eq(setBadge(1), true, 'a rejection is swallowed — a badge may never take a screen down');
  globalThis.navigator = { setAppBadge: () => { throw new Error('sync'); } };
  eq(setBadge(1), false, 'and neither may a synchronous throw');
}

/* ═══════════════════════ A7 · the link to his own book ═══════════════════ */
{
  delete globalThis.navigator;
  const { setCreds, getSheetUrl, clearCreds } = await import('../src/state/secret.js');
  const REAL = 'https://docs.google.com/spreadsheets/d/1AbCdEf/edit';

  clearCreds();
  eq(getSheetUrl(), null, 'with nothing stored there is NO link — never a guessed one');

  setCreds('s', 'https://script.google.com/x/exec', REAL);
  eq(getSheetUrl(), REAL, 'a real sheet address is handed back for the button');

  /**
   * WHAT IS REFUSED, and why the list is this narrow. This string becomes an
   * `href` he taps. A link that opens the WRONG document damages exactly the
   * thing it exists to prove — that his book is untouched and still his.
   */
  setCreds('s', 'https://script.google.com/x/exec', 'javascript:alert(1)');
  eq(getSheetUrl(), null, 'a javascript: URL is refused outright');
  setCreds('s', 'https://script.google.com/x/exec', 'http://docs.google.com/spreadsheets/d/1/edit');
  eq(getSheetUrl(), null, 'and so is plain http');
  setCreds('s', 'https://script.google.com/x/exec', 'https://evil.example/spreadsheets/d/1');
  eq(getSheetUrl(), null, 'and another host wearing the right path');
  setCreds('s', 'https://script.google.com/x/exec', 'https://docs.google.com/document/d/1/edit');
  eq(getSheetUrl(), null, 'and a Google DOC, which is not his book');
  setCreds('s', 'https://script.google.com/x/exec', 'not a url at all');
  eq(getSheetUrl(), null, 'and a typo costs him the link, not a failed setup');

  // Clearing the credentials clears it — a reinstall must not keep a stale link.
  setCreds('s', 'https://script.google.com/x/exec', REAL);
  clearCreds();
  eq(getSheetUrl(), null, 'and clearing the credentials takes it with them');
}

const report = failures.length
  ? `❌ ${failures.length} / ${pass + failures.length} tier-3 checks failed:\n  - ${failures.join('\n  - ')}`
  : `✅ all ${pass} tier-3 checks passed`;
console.log(report);
process.exit(failures.length ? 1 : 0);
