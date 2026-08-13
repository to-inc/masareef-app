/**
 * The manual refresh — pressed, in flight, and what it is allowed to claim.
 *
 * A BUTTON, not a gesture. Senior law: nothing this app can do may be reachable
 * only by pull, swipe or long-press. A pull-to-refresh may exist one day as an
 * accelerator for people who already know it; the button is the affordance.
 *
 * THE ONE RULE THAT MATTERS. «آخر تحديث» is a claim about when we last heard
 * from his sheet. A refresh that FAILED must leave that stamp exactly where it
 * was — moving it would tell him the screen is current at a moment we know it is
 * not, which is the honest-render law applied to time instead of to money. It is
 * also the easiest possible bug to write: `finally { setSavedAt(Date.now()) }`
 * reads as tidy and is a lie.
 */

/**
 * `busy` is driven by the ACTUAL fetch promise, never by a timer. A spinner on a
 * setTimeout is a fake spinner: it says "working" for a fixed period regardless
 * of what the network did, and it stops saying it while the request is still out.
 */
export const REFRESH_STATES = ['idle', 'busy', 'failed'];

export const isRefreshState = (s) => REFRESH_STATES.indexOf(s) !== -1;

/**
 * What a press does. A second press while a fetch is out is a NO-OP — not a
 * queued second fetch. Queueing would let an impatient tap-tap-tap turn one cold
 * Apps Script start into five, and the last reply to land would win regardless
 * of which was freshest.
 */
export function nextOnPress(state) {
  return state === 'busy' ? null : 'busy';
}

/** Where a finished fetch leaves the button. A failure is a state, not a toast. */
export function resultState(ok) {
  return ok ? 'idle' : 'failed';
}

/**
 * THE STAMP. New time on success; the OLD time, untouched, on failure.
 *
 * Written as its own function precisely so it can be mutated and caught: a
 * version returning `now` unconditionally is the bug this whole rule exists to
 * prevent, and it is invisible on any screen where the refresh happened to work.
 */
export function stampAfter(previous, ok, now) {
  return ok ? now : previous;
}

/**
 * A refresh that cannot overlap itself.
 *
 * `run` is whatever the current view needs — the summary on Today, the active
 * month's rows in Recent. The guard lives here rather than in a component so
 * that "a second press is a no-op" is a property of the machine and not of one
 * screen's `useState`.
 */
export function createRefresher(run) {
  let busy = false;
  return {
    isBusy: () => busy,
    async press() {
      if (busy) return { skipped: true, ok: null };
      busy = true;
      try {
        const ok = await run();
        return { skipped: false, ok: ok !== false };
      } catch {
        // A throw is a failed refresh, not a crash. The banner speaks and the
        // stamp stays where it was.
        return { skipped: false, ok: false };
      } finally {
        busy = false;
      }
    },
  };
}
