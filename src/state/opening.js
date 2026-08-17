/**
 * WHICH SCREEN HE LANDS ON (finding A1 — the evening recap as the front door).
 *
 * ——— THE FINDING. The product brief scored "end-of-day recap" at 45/55 and it
 * was never built as a surface. The Book's «النهاردة» IS that recap now — the
 * day's figure, the count, the method split, and a button naming whatever still
 * needs a category. So the feature does not need building; it needs to be what
 * he FINDS when he opens the app during the ritual he already has.
 *
 * ——— WHY A FUNCTION OF THE HOUR, AND NOTHING ELSE.
 *
 * No notification, no reminder, no badge nagging him to review his day. The
 * prompt in the Fogg model is already automatic — the bank SMS fires the system
 * and he opens the app when he opens it. This only decides which of three
 * screens is showing when he does, which is the cheapest possible version of the
 * recap and the only one that cannot nag.
 *
 * ——— THE HOURS, and why the Inbox keeps the daytime.
 *
 * Before 19:00 the useful screen is «الوارد»: purchases arrive through the day
 * and the thing worth doing is filing the ones that came in. From 19:00 the
 * day's spending is essentially complete, and the useful screen is the one that
 * tells him what it came to — with the unfiled rows named on it, one tap from
 * the Inbox, so nothing is hidden by the switch.
 *
 * ——— AND IT IS A LAUNCH DECISION ONLY.
 *
 * `openingTab` is read once, on boot. It must never re-run while he is using the
 * app: a screen that changed under him at 19:00 because a clock ticked is the
 * shape-changing-while-you-reach problem with a timer attached.
 */

/** The hour the day's account is more useful than the day's inbox. Cairo local. */
export const RECAP_HOUR = 19;

/**
 * @param hour   0–23, Cairo civil time — the SERVER's, never the device's.
 *               A phone left on the wrong timezone is a real thing, and this
 *               app has been anchored on Cairo since the first parser.
 * @param hasDay whether there is anything to recap. Landing on an empty
 *               «النهاردة» at 8pm because he spent nothing tells him less than
 *               the Inbox would, and reads like the app lost his day.
 */
export function openingTab(hour, hasDay) {
  const h = Number(hour);
  if (!isFinite(h) || h < 0 || h > 23) return 'inbox';   // unreadable clock → the safe default
  return (h >= RECAP_HOUR && hasDay) ? 'book' : 'inbox';
}

/**
 * Cairo's hour from the server's own `serverTime` stamp.
 *
 * Returns null rather than guessing when the field is missing or unparseable —
 * and `openingTab(null)` is the Inbox, which is where the app has always opened.
 * A wrong guess here is not dangerous, but it is the kind of silent fallback
 * that makes "why did it open there?" unanswerable.
 */
export function cairoHourOf(serverTime) {
  if (typeof serverTime !== 'string' || !serverTime) return null;
  const t = new Date(serverTime);
  if (isNaN(t.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo', hour: '2-digit', hour12: false,
  }).formatToParts(t);
  const hh = parts.find((p) => p.type === 'hour');
  if (!hh) return null;
  const h = Number(hh.value);
  return isFinite(h) ? (h === 24 ? 0 : h) : null;
}
