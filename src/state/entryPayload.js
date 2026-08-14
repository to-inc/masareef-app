/**
 * The manual entry: its METHOD, its payload, and its effect on Today.
 *
 * ——— WHY THIS FILE EXISTS, AND IT IS ONE SENTENCE OF THE CONTRACT.
 *
 * `normalizeMethod_` (06 §3.1) is deliberately STRICTER than the sheet reader:
 * case/whitespace-insensitive EQUALITY with `visa` → `Visa`, and **anything else
 * → Cash**. It does not reject; it coerces. So a payload carrying this screen's
 * BUTTON LABEL — `Card`, `card`, «فيزا» — is not an error the server reports. It
 * is a card expense written into the Cash column, with a ✓ on screen and nothing
 * anywhere to notice it by.
 *
 * That is WS1-M's specimen ("the same string meant opposite things depending on
 * direction… wrong money in the wrong column, no error"), reaching the app
 * through the one door WS1-M could not have covered: until today this screen had
 * no chooser to get wrong. It hardcoded `method: 'Cash'`.
 *
 * The structural answer, rather than a careful one: **the app never holds a
 * label.** State holds a WIRE value, the label is a lookup at render time, and
 * there is no path by which the thing he reads becomes the thing we post.
 */

/**
 * The two methods, as the wire spells them. These are `today.totals`' keys too
 * (06 §2.2), which is why the optimistic update below can index by them —
 * one vocabulary, not two that must be kept in step.
 */
export const METHODS = ['Cash', 'Visa'];

/**
 * Cash is the default, and it is not arbitrary: card purchases on his Egyptian
 * bank log themselves from the SMS (D2), so a manual entry is a cash entry
 * unless he says otherwise. The chooser exists because that stopped being
 * universally true when he moved abroad — Finnish cards send him no Arabic SMS
 * (D18c) — not because the default was wrong.
 */
export const DEFAULT_METHOD = 'Cash';

export function isMethod(v) {
  return METHODS.indexOf(v) !== -1;
}

/**
 * The `manual` write (06 §3.1).
 *
 * The method falls back to Cash for an unrecognised value — the SAME rule the
 * server applies, deliberately, so the client can never hold a different belief
 * about what was written than the sheet does. It is a floor under a bug, not a
 * feature: nothing in the app should ever reach it, and the suite pins that a
 * label arriving here does NOT become `Visa`.
 */
export function manualPayload({ amount, method, category, description, clientId, entryDate }) {
  return {
    amount,
    method: isMethod(method) ? method : DEFAULT_METHOD,
    category,
    description: description || category,
    clientId,
    // Stamped at TAP time, not send time — an entry flushed after midnight must
    // keep the day he actually spent the money.
    entryDate,
  };
}

/**
 * The optimistic line on Today, which must credit the column he CHOSE.
 *
 * Written as a function rather than inline in the handler for the reason
 * `applyCategoryToToday` was: the old inline version added to `totals.Cash`
 * unconditionally. Under a chooser that is no longer an optimistic display, it
 * is a false one — his card expense would land under Cash on the very screen
 * headed «مصاريف النهاردة — زي ما هي في الشيت بالظبط», until the next refresh
 * quietly disagreed with it.
 *
 * Returns a new object; the input is never mutated.
 */
export function applyEntryToToday(today, entry) {
  if (!today || !entry || !isMethod(entry.method)) return today;
  const amount = Number(entry.amount);
  if (!isFinite(amount)) return today;
  return {
    ...today,
    entries: [...(today.entries || []), entry],
    totals: {
      ...today.totals,
      [entry.method]: (today.totals?.[entry.method] || 0) + amount,
    },
  };
}
