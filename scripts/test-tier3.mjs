#!/usr/bin/env node
/**
 * The five behaviours added by the design read's Tier 3.  `npm run check:tier3`
 *
 *   A1  the evening recap is the front door        state/opening.js
 *   A3  his own last entries, with their amounts   state/repeats.js
 *   A6  the ❓ count on the home-screen icon        state/badge.js
 *   A7  «افتح الشيت» — one tap to his own book     state/secret.js
 *   —   capability gating (the dictation defect)    state/capabilities.js
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


/* ═══════════ THE DEFECT THAT SHIPPED · capability gating ════════════════ */
{
  const { supportsAction, SERVER_ACTIONS, loadBuild, saveBuild, _reset: resetCaps } =
    await import('../src/state/capabilities.js');
  // Read from the PURE module, not from api/index.js — that one needs Vite for
  // `import.meta.env`, and a fact that is awkward to import is a fact nobody tests.
  const MOCK_ACTIONS = SERVER_ACTIONS;

  /**
   * ——— WHAT WENT WRONG, AS AN ASSERTION.
   *
   * The dictation button posted `{action:'voice'}`. The serving backend knows
   * nine actions and `voice` is not one, so every press answered
   * `unknown_action` — a dead control on his primary manual path, live on his
   * phone, past 2,412 green assertions.
   *
   * It survived because `api/mock.js` modelled NO action list, so nothing could
   * ask whether the server knew the verb. These two lines are that hole closed:
   * the mock now carries the real list, and the list does not contain `voice`.
   */
  ok(MOCK_ACTIONS.length === 10, 'the mock models all TEN actions handleAction_ dispatches as of 20260817-1180');
  for (const a of SERVER_ACTIONS) {
    ok(MOCK_ACTIONS.indexOf(a) !== -1, `${a} is an action the server really answers`);
  }

  /**
   * ——— IT FAILS CLOSED, WHICH IS WHY IT FIXES ANYTHING TODAY.
   *
   * `build.actions` does not exist on the serving backend. If an absent list
   * read as "assume supported", this whole change would be decorative and the
   * broken button would still be on his phone.
   */
  ok(!supportsAction(null, 'voice'), 'no build at all ⇒ not supported');
  ok(!supportsAction({}, 'voice'), 'a build with no action list ⇒ not supported — THE case that matters today');
  ok(!supportsAction({ actions: 'voice' }, 'voice'), 'a string is not a list — never coerced');
  ok(!supportsAction({ actions: true }, 'voice'), 'nor is a boolean');
  ok(!supportsAction({ actions: [] }, 'voice'), 'an empty list supports nothing');
  ok(!supportsAction({ actions: ['manual', 'summary'] }, 'voice'),
    'and a list without the verb does not support the verb');
  ok(supportsAction({ actions: ['manual', 'voice'] }, 'voice'),
    'while a list that names it DOES — this is what lights the button up at V20, with no flag to flip');
  ok(!supportsAction({ actions: ['voice'] }, ''), 'an empty action name is never supported');

  /**
   * The cache exists so a gated control does not materialise under his thumb a
   * second after launch — the shape-changing-while-you-reach problem.
   */
  resetCaps();
  eq(loadBuild(), null, 'a fresh install has seen no build…');
  saveBuild({ id: 'x', actions: ['voice'] });
  ok(supportsAction(loadBuild(), 'voice'), '…and once seen, the answer survives a cold launch');
  saveBuild(null);
  ok(loadBuild() !== null, 'saving nothing does not erase what we knew');
  resetCaps();

  /**
   * AND THE SHELL ACTUALLY GATES ON IT. The pure rule being right while the view
   * mounts the button unconditionally is this project's most repeated bug —
   * three of its defects were a correct function beside a wrong call site.
   */
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  ok(/onDictate=\{supportsAction\(build, 'voice'\)/.test(app),
    'the dictation control is mounted ONLY when the server says it knows the verb');
  ok(/ping\(\)\.then/.test(app), 'and the capability is read from ping, which is what carries `build`');
  ok(!/onDictate=\{\(\) => setEntryMode\('dictate'\)\}/.test(app),
    'the ungated version is gone — this exact line is what shipped broken');
}


/* ═══════════ DICTATION · the mock models the SERVICE, refusals included ═══ */
{
  const { mockVoice, _resetMockVoice } = await import('../src/api/mock.js');
  const { UNKNOWN_CATEGORY } = await import('../src/lib/constants.js');
  const { SERVER_ACTIONS, supportsAction } = await import('../src/state/capabilities.js');
  _resetMockVoice();

  /**
   * FOUR BRANCHES, because each is a different sentence the app must render.
   * The mock had NO handler at all, which is why a dead control passed 2,412
   * assertions — a mock that cannot refuse cannot catch a client that assumes.
   */
  eq((await mockVoice({ text: '' })).error, 'no_text', 'nothing arrived is `no_text`…');
  eq((await mockVoice({ text: '   ' })).error, 'no_text', '…including whitespace only');
  eq((await mockVoice({ text: 'قهوة' })).error, 'no_amount',
    '…and heard-him-but-no-number is `no_amount` — a DIFFERENT sentence, never collapsed');
  ok((await mockVoice({ text: '' })).error !== (await mockVoice({ text: 'قهوة' })).error,
    'the two refusals stay distinct — only one of them is his to fix by speaking again');

  const ok50 = await mockVoice({ text: '٥٠ جنيه قهوة' });
  eq(ok50.ok, true, 'Arabic-Indic digits are heard…');
  eq(ok50.entry.amount, 50, '…and normalised to a Western number, as the sheet requires');
  eq(ok50.entry.category, 'Eating out', 'قهوة matches the keyword map…');
  eq(ok50.entry.method, 'Cash', '…and voice defaults to Cash, which is what he uses it for');

  const visa = await mockVoice({ text: '٢٠٠ فيزا بنزين' });
  eq(visa.entry.method, 'Visa', 'فيزا switches the method…');
  eq(visa.entry.category, 'Car', '…and the keyword still lands');

  const unknown = await mockVoice({ text: '75 حاجة غريبة' });
  eq(unknown.entry.category, UNKNOWN_CATEGORY,
    'no keyword ⇒ ❓, never a guess — chips, exactly as D5 requires everywhere else');

  /**
   * IDEMPOTENT, like `manual`. The outbox depends on it: `duplicate` settles a
   * queued item, anything else re-queues it.
   */
  const first = await mockVoice({ text: '٦٠ جنيه قهوة', clientId: 'cid-1' });
  const replay = await mockVoice({ text: '٦٠ جنيه قهوة', clientId: 'cid-1' });
  ok(!first.skipped, 'the first send writes…');
  eq(replay.skipped, 'duplicate', '…and a replayed clientId answers duplicate rather than doubling his coffee');
  eq(replay.ok, true, 'a duplicate is still ok:true — it is a settled outcome, not a failure');

  /**
   * NEVER MORE PERMISSIVE THAN THE SERVER. `handleVoice_` requires a positive
   * number; a mock that accepted these would certify a client against successes
   * it will never see in his hand.
   */
  eq((await mockVoice({ text: 'صفر جنيه قهوة' })).error, 'no_amount',
    'a spelled-out number is not a number — he must SAY the digits');
  eq((await mockVoice({ text: '0 جنيه قهوة' })).error, 'no_amount', 'and zero is not an expense');
  eq((await mockVoice({ text: null })).error, 'no_text', 'and nothing at all does not throw');

  /**
   * THE VERB IS NOW REAL. Backend 20260817-1180 dispatches `voice`, so the list
   * says so — and the gate lights the control up from the same fact.
   */
  ok(SERVER_ACTIONS.indexOf('voice') !== -1,
    'the server dispatches `voice` as of 20260817-1180, and the list records it');
  ok(supportsAction({ actions: SERVER_ACTIONS }, 'voice'),
    'so a server publishing this list turns the dictation button back on, with nothing to flip');
}


/* ═══════════ TRAVEL MODE IS CAPABILITY-GATED · CONTRACT-06 ①ial ═════════ */
{
  const { supportsCurrency, effectiveCurrency } = await import('../src/state/capabilities.js');
  const { HOME_CURRENCY, AWAY_CURRENCY } = await import('../src/state/travel.js');

  /**
   * ——— THE DEFECT THIS PREVENTS, AND WHY IT OUTRANKS THE VOICE ONE.
   *
   * Travel mode went to his phone at ~15:30 against V19, whose `handleManual_`
   * hardcoded `currency:'EGP'` (deployed/20260816-1011.gs:39) and never read the
   * field. A €41.50 dinner would have landed as 41.50 EGP in the column his
   * dashboard sums, with a ✓ on screen.
   *
   * V20 (deployed/20260817-1180.gs:45) now honours it — but publishes NO
   * `currencies` list, and a backend that can do a thing without saying so is
   * indistinguishable from one that cannot, because the client only sees the
   * wire. So the gate stands, and every assertion below still describes the
   * serving build.
   */
  ok(!supportsCurrency(null, 'EUR'), 'no build ⇒ the server cannot take euros');
  ok(!supportsCurrency({}, 'EUR'),
    'a build with no currency list ⇒ NOT supported — the serving build publishes none');
  ok(!supportsCurrency({ currencies: 'EUR' }, 'EUR'), 'a string is not a list');
  ok(!supportsCurrency({ currencies: [] }, 'EUR'), 'an empty list accepts nothing');
  ok(!supportsCurrency({ currencies: ['EGP'] }, 'EUR'), 'and EGP-only does not imply euros');
  ok(supportsCurrency({ currencies: ['EGP', 'EUR'] }, 'EUR'),
    'while a server publishing EUR can be trusted with it');

  /**
   * ——— THE HALF THAT HIDING THE BUTTON DOES NOT COVER.
   *
   * The preference is STICKY. A phone already flipped to euros before this gate
   * existed would keep writing euros as pounds — with the toggle now hidden, so
   * there is not even a control left to flip back. Hiding an affordance does not
   * undo the state it set, so the ANSWER is gated too.
   */
  eq(effectiveCurrency('EUR', {}), HOME_CURRENCY,
    'a phone STUCK in euro mode writes pounds while the server cannot take euros — the dangerous case');
  eq(effectiveCurrency('EUR', null), HOME_CURRENCY, 'and with no build at all');
  eq(effectiveCurrency('EUR', { currencies: ['EGP'] }), HOME_CURRENCY,
    'and against a server that takes only pounds');
  eq(effectiveCurrency('EUR', { currencies: ['EGP', 'EUR'] }), AWAY_CURRENCY,
    'while a capable server honours the mode he chose');
  eq(effectiveCurrency('EGP', {}), HOME_CURRENCY, 'home needs no capability — it is the default');
  eq(effectiveCurrency(null, {}), HOME_CURRENCY, 'and an unset preference is home');

  /**
   * THE STORED PREFERENCE IS NOT REWRITTEN. It becomes true again the moment the
   * backend can honour it; silently clearing a setting he chose would be the app
   * editing his intent rather than declining to act on it.
   */
  const stored = 'EUR';
  effectiveCurrency(stored, {});
  eq(stored, 'EUR', 'gating the ANSWER never rewrites what he chose');

  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  ok(/const entryCurrency = effectiveCurrency\(storedCurrency, build\);/.test(app),
    'the payload carries the EFFECTIVE currency, not the stored one — this is the guard that writes');
  ok(/setCurrency=\{supportsCurrency\(build, AWAY_CURRENCY\)/.test(app),
    'and the toggle is offered only where the write can honour it');
  ok(!/useState\(\(\) => getCurrency\(\)\);[\s\S]{0,80}entryCurrency/.test(app),
    'the ungated read is gone — it is what shipped able to write euros as pounds');
}

const report = failures.length
  ? `❌ ${failures.length} / ${pass + failures.length} tier-3 checks failed:\n  - ${failures.join('\n  - ')}`
  : `✅ all ${pass} tier-3 checks passed`;
console.log(report);
process.exit(failures.length ? 1 : 0);
