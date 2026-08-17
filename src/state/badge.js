/**
 * THE ❓ COUNT ON THE HOME-SCREEN ICON (finding A6).
 *
 * ——— THE TWO RULES THIS RECONCILES.
 *
 * The Fogg model says the PROMPT must be automatic — he must not have to
 * remember. CLAUDE.md #5 says no nagging: no streaks, no notifications, nothing
 * that pesters a retired man about his own money. Those pull against each other,
 * and until now the prompt lived entirely in the bank SMS, which fires at
 * purchase time and says nothing about the rows still waiting.
 *
 * An app badge is the only prompt that satisfies both. It is passive — it never
 * interrupts, never buzzes, never opens anything. It sits on an icon he already
 * looks at, and it disappears by itself when the work is done. The Badging API
 * needs no permission prompt, no push server, no subscription, and no key.
 *
 * ——— WHAT IT COUNTS, and why that matters more than it sounds.
 *
 * Exactly what the tab badge counts — the same `remaining(reconcile(...))` the
 * Inbox header reads (finding S3). A badge saying 4 over a list headed «2» is
 * the contradiction S3 removed from inside the app; putting a third counter on
 * the home screen would reintroduce it one layer further out, where he sees it
 * before the app is even open.
 *
 * ——— AVAILABILITY, verified rather than assumed.
 *
 * `navigator.setAppBadge` requires an INSTALLED app on iOS 16.4+; in a Safari
 * tab it is simply absent. That is the correct behaviour for this project: the
 * whole app is designed to be installed, and a missing API here costs nothing —
 * the tab badge inside the app is unchanged. Every call is feature-detected and
 * every rejection swallowed, because a badge is decoration and must never be
 * able to take a screen down with it.
 */

export const badgeSupported = () => (
  typeof navigator !== 'undefined' && typeof navigator.setAppBadge === 'function'
);

/**
 * @param count rows still waiting for a category.
 *
 * ZERO CLEARS IT. `setAppBadge(0)` shows a dot on some platforms rather than
 * nothing, so an empty inbox calls `clearAppBadge` — the difference between "all
 * done" and "something, unspecified", on a screen with room for neither word.
 *
 * A non-finite or negative count clears too. A NaN badge is a permanent smudge
 * on his home screen that no amount of using the app removes.
 */
export function setBadge(count) {
  if (!badgeSupported()) return false;
  const n = Number(count);
  try {
    if (!isFinite(n) || n <= 0) {
      const p = navigator.clearAppBadge();
      if (p && p.catch) p.catch(() => {});
      return true;
    }
    const p = navigator.setAppBadge(Math.floor(n));
    if (p && p.catch) p.catch(() => {});
    return true;
  } catch {
    // Some engines throw synchronously rather than rejecting.
    return false;
  }
}
