#!/usr/bin/env node
/**
 * The manual refresh.  `npm run check:refresh`
 *
 * Three claims, and one of them is the reason this file exists:
 *
 *   1. the in-flight state follows the ACTUAL fetch, not a timer;
 *   2. a second press while fetching is a no-op, not a queued second fetch;
 *   3. «آخر تحديث» moves on success and NOT on failure.
 *
 * (3) is the load-bearing one. That stamp is a claim about when we last heard
 * from his sheet, so moving it after a failed refresh tells him the screen is
 * current at a moment we know it is not — the honest-render law applied to time
 * instead of to money. It is also the easiest bug in this rev to write:
 * `finally { setSavedAt(Date.now()) }` reads as tidy and is a lie.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import {
  REFRESH_STATES, isRefreshState, nextOnPress, resultState, stampAfter, createRefresher,
} from '../src/state/refresh.js';

let pass = 0;
const failures = [];
const eq = (a, b, label) => {
  if (Object.is(a, b)) { pass++; return; }
  failures.push(`${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const ok = (c, label) => eq(!!c, true, label);

// ——————————————————————— the vocabulary
eq(REFRESH_STATES.length, 3, 'three states — idle, busy, failed');
ok(isRefreshState('failed'), 'a failed refresh is its own state, not a silent return to idle');
ok(!isRefreshState('done'), 'and there is no "done" — a finished refresh is idle again');

// ——————————————————————— pressing
eq(nextOnPress('idle'), 'busy', 'pressing an idle button starts a fetch');
eq(nextOnPress('failed'), 'busy', 'and pressing after a failure retries — it is his way back');
eq(nextOnPress('busy'), null, 'but pressing while busy does NOTHING — no second fetch');
eq(resultState(true), 'idle', 'a successful fetch returns to rest');
eq(resultState(false), 'failed', 'a failed one says so');

/**
 * ——————————————————————— THE STAMP.
 *
 * `1000` is the old stamp and `2000` is now; they are deliberately different, so
 * an implementation that returns `now` unconditionally cannot pass by accident.
 */
eq(stampAfter(1000, true, 2000), 2000, 'a successful refresh moves «آخر تحديث» to now');
eq(stampAfter(1000, false, 2000), 1000, 'a FAILED refresh leaves it exactly where it was');
eq(stampAfter(null, false, 2000), null, 'and a failure on a screen that never had a stamp adds none');
eq(stampAfter(null, true, 2000), 2000, 'while a first success sets one');

// ——————————————————————— the in-flight guard, driven by a real promise
{
  let started = 0;
  let release;
  const gate = new Promise((r) => { release = r; });
  const r = createRefresher(async () => { started++; await gate; return true; });

  ok(!r.isBusy(), 'a refresher starts at rest');
  const first = r.press();
  ok(r.isBusy(), 'and reports busy while the fetch is genuinely out');

  /**
   * THE KILLING ASSERTION COMES FIRST, AND IT DOES NOT AWAIT.
   *
   * A first draft did `await r.press()` here. With the guard removed the second
   * press starts a real fetch on the same un-released gate, so the await never
   * resolves and the SUITE DEADLOCKS — it reported a crash rather than a
   * failure, on the mutation it exists to catch. `started` is incremented
   * synchronously by `run`, so counting it needs no await at all and cannot hang
   * however wrong the implementation is.
   */
  const second = r.press();
  eq(started, 1, 'a second press starts NO second fetch — tap-tap-tap is one cold start, not three');

  release(true);
  const done = await first;
  eq(done.ok, true, 'the first press reports its own result');
  eq((await second).skipped, true, 'and the skipped press says it was skipped');
  ok(!r.isBusy(), 'and the button is released only when the fetch actually finished');

  // …and it can be pressed again afterwards. A guard that never clears would
  // leave him with a dead button and no way to know why.
  const again = await r.press();
  eq(again.skipped, false, 'pressing again after it settles works');
  eq(started, 2, 'and does start a fresh fetch');
}

// ——————————————————————— failures are results, not crashes
{
  const thrower = createRefresher(async () => { throw new Error('offline'); });
  const res = await thrower.press();
  eq(res.ok, false, 'a fetch that THROWS is a failed refresh…');
  eq(res.skipped, false, '…that genuinely ran');
  ok(!thrower.isBusy(), 'and the button is released — a thrown fetch must not wedge it forever');
}
{
  const falsey = createRefresher(async () => false);
  eq((await falsey.press()).ok, false, 'a run that reports false is a failure');
  const truthy = createRefresher(async () => undefined);
  eq((await truthy.press()).ok, true,
    'while a run that returns nothing is a success — only an explicit false is a failure');
}

/**
 * ——————————————————————— THE TWO TOGETHER, which is where the bug would live.
 * The stamp is derived from the press's result, so a failure cannot move it even
 * though the press definitely happened.
 */
{
  let stamp = 1000;
  const failing = createRefresher(async () => false);
  const res = await failing.press();
  stamp = stampAfter(stamp, res.ok, 2000);
  eq(stamp, 1000, 'after a failed press the stamp is untouched — the screen does not claim to be current');

  const working = createRefresher(async () => true);
  const res2 = await working.press();
  stamp = stampAfter(stamp, res2.ok, 3000);
  eq(stamp, 3000, 'and after a successful one it moves');

  /**
   * A SKIPPED press must not move the stamp either: nothing was fetched.
   *
   * Built on a gate this test can RELEASE, and asserted synchronously first.
   * The first version used `new Promise(() => {})` — a fetch that never settles —
   * and awaited the second press. With the guard removed that await never
   * resolves and the suite deadlocks with an unsettled top-level await: a CRASH
   * on the mutation it exists to catch, which is the second time this same shape
   * bit in this one file. The rule it taught: never AWAIT a call whose whole
   * claim is that it returned immediately — prove it returned first.
   */
  let started3 = 0;
  let release3;
  const gate3 = new Promise((r) => { release3 = r; });
  const busyOne = createRefresher(async () => { started3++; await gate3; return true; });
  const inflight = busyOne.press();
  const skippedPress = busyOne.press();
  eq(started3, 1, 'a press while busy starts no fetch at all');
  release3(true);
  await inflight;
  const skipped = await skippedPress;
  eq(skipped.ok, null, 'a skipped press has no result…');
  eq(stampAfter(stamp, skipped.ok, 4000), 3000, '…so it cannot move the stamp either');
}

/**
 * ——————————————————————— THE BUTTON IS RENDERED, and that is not a formality.
 *
 * The first version of this rev shipped `RefreshButton` using `TAP` without
 * importing it. Every one of ELEVEN suites was green; the app crashed on boot
 * into the error boundary, on every screen, in both languages. Nothing caught it
 * because nothing rendered the HEADER — the suites cover views and pure modules,
 * and the header had quietly grown two interactive controls that no test mounted.
 *
 * A module that is only ever imported by a test that does not render it is a
 * module with no test. These assertions exist so the header cannot be un-covered
 * again.
 */
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { RefreshButton, LangToggle } = await vite.ssrLoadModule('/src/components/Primitives.jsx');
  /**
   * A RENDER THAT THROWS IS A NAMED FAILURE, not a dead process. The very crash
   * this block was written for — a missing import — kills `renderToStaticMarkup`,
   * and an uncaught throw here would print a React stack and no assertion, on the
   * one run where the message matters most. Third time this shape has bitten in
   * this rev; the remedy is a house pattern now.
   */
  const html = (state) => {
    try {
      return renderToStaticMarkup(createElement(RefreshButton, { state, onPress: () => {} }));
    } catch (err) {
      failures.push(`RefreshButton THREW while rendering "${state}" — ${err && err.message}`);
      return '';
    }
  };

  const idle = html('idle');
  ok(idle.includes('<button'), 'the refresh renders as a BUTTON — never a gesture-only affordance');
  ok(/min-height:48px/.test(idle) && /min-width:48px/.test(idle),
    'at the senior tap floor in both dimensions');
  ok(!idle.includes('disabled'), 'and it is pressable at rest');
  ok(!idle.includes('aria-busy'), 'with nothing claiming work is in flight');

  const busy = html('busy');
  ok(busy.includes('aria-busy="true"'), 'in flight it says so, for a screen reader too');
  ok(busy.includes('disabled'), 'and it cannot be pressed again — the guard is visible, not just internal');
  ok(busy.includes('class="spin"'), 'the spinner is on, driven by the real fetch');
  ok(!html('idle').includes('class="spin"'), 'and off when nothing is in flight');

  const failed = html('failed');
  ok(!failed.includes('disabled'), 'a failed refresh leaves the button pressable — that is his way back');
  ok(failed !== idle, 'and it does not look identical to a refresh that never happened');

  // The header's other control must render too — same gap, same reason.
  let toggleHtml = '';
  try { toggleHtml = renderToStaticMarkup(createElement(LangToggle, {})); }
  catch (err) { failures.push(`LangToggle THREW while rendering — ${err && err.message}`); }
  ok(toggleHtml.includes('<button'), 'the language toggle renders as a button as well');
} finally {
  await vite.close();
}

const report = failures.length
  ? `❌ ${failures.length} / ${pass + failures.length} refresh checks failed:\n  - ${failures.join('\n  - ')}`
  : `✅ all ${pass} refresh checks passed`;
console.log(report);
process.exit(failures.length ? 1 : 0);
