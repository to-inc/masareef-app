/**
 * WHAT THE SERVING BACKEND CAN ACTUALLY ANSWER.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT THIS EXISTS FOR — shipped 2026-08-17, live on his phone.
 *
 * The dictation button (A5) posted `{action: 'voice'}`. The serving backend's
 * `handleAction_` knows nine actions and `voice` is not one of them, so every
 * press answered `{ok:false, error:'unknown_action'}` — a dead control on his
 * primary manual-capture path, while he is abroad and the SMS path is silent.
 *
 * The comment above the call was not wrong, which is what made it invisible:
 * `type:'voice'` HAS been in production since Phase 1 — for the three iOS
 * Shortcuts. But 06 §1 reserves the `type` chain for those Shortcuts and forbids
 * the PWA from reusing it, and `doPost` routes on `action` FIRST. The comment
 * described the Shortcut's envelope; the code sent the PWA's.
 *
 * 2,412 assertions did not catch it because `api/mock.js` modelled no action
 * list at all — so nothing on either side ever asked whether the server knew
 * this verb. That is the mock-parity law's own shape, the one this project
 * learned twice in one day: a client certified against a mock that accepts what
 * the real service refuses.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ——— WHY A CAPABILITY READ AND NOT A FLAG.
 *
 * A boolean someone must remember to flip on deploy day is the shape this
 * project keeps paying for — it is `BUILD.ID` not being bumped, one layer up.
 * The server already publishes its own identity on `ping`; the fix is for it to
 * publish its own VERB LIST from the same router that dispatches them, so the
 * answer cannot drift from the truth by anyone forgetting anything.
 *
 * ——— IT FAILS CLOSED, AND THAT IS WHY IT WORKS TODAY.
 *
 * `build.actions` does not exist yet. An absent list therefore means NOT
 * SUPPORTED, never "assume yes" — so the button is hidden the moment this
 * ships, against the backend serving right now, with no server change at all.
 * When Executor 3's V20 adds the verb and the list, the control lights up on its
 * own. There is nothing to remember and nothing to flip.
 *
 * Erring the other way would put the broken button back on his phone.
 */

const KEY = 'masareef.capabilities.v1';

/**
 * THE VERBS `handleAction_` ACTUALLY DISPATCHES — the nine, verbatim.
 *
 * It lives HERE, not in `api/index.js`, for a reason the defect taught: this
 * module is pure, so a suite can read the list in bare node. `api/index.js`
 * touches `import.meta.env` and can only be imported through Vite — which is
 * exactly the kind of friction that leaves a fact untested.
 *
 * `voice` is deliberately ABSENT. When Executor 3's V20 adds the verb, it is
 * added here, and the mock and the gate move together in one edit.
 */
export const SERVER_ACTIONS = [
  'ping', 'summary', 'entries', 'manual', 'fix_category',
  'receipt_extract', 'receipt_confirm', 'batch_confirm', 'header_check',
  // Added by backend 20260817-1180 — the fix for the dictation defect.
  'voice',
];

/**
 * Can the serving backend answer this action?
 *
 * @param build  the `build` object from a `ping` response, or null.
 *
 * STRICT ON PURPOSE. Only a real array containing the exact string counts. A
 * truthy-but-wrong `actions` — a string, an object, `true` — answers NO rather
 * than being coerced, for the same reason `outcomeFor` refuses `{ok:"yes"}`:
 * the failure mode of guessing generously is a control that posts into the void.
 */
export function supportsAction(build, action) {
  if (!build || !action) return false;
  const list = build.actions;
  if (!Array.isArray(list)) return false;
  return list.indexOf(action) !== -1;
}

/**
 * CAN THE SERVING BACKEND ACCEPT THIS CURRENCY? (Planner 4, CONTRACT-06)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY IT WAS BUILT — and the ground truth moved WHILE IT WAS BEING BUILT.
 *
 * Travel mode shipped to his phone at ~15:30 against V19
 * (`deployed/20260816-1011.gs`), whose `handleManual_` hardcoded
 * `currency: 'EGP'` at line 39 and never read the field. «باليورو» → a €41.50
 * dinner → **41.50 EGP** in the column his SUMIF sums, with a ✓ on screen.
 * Planner 4 read his August rows: no damage, because his one EUR row arrived by
 * SMS, which carries its own currency. But the exposure was real.
 *
 * At 17:53 that changed. V20 (`deployed/20260817-1180.gs:45`) is on his book and
 * DOES honour `manual.currency` — verified in the archive, not assumed.
 *
 * ——— SO WHY IS THE GATE STILL HERE?
 *
 * Because the serving build HONOURS both new capabilities and PUBLISHES
 * neither. `buildIdentity_` returns no `actions` and no `currencies`. A backend
 * that can do a thing but cannot say so is indistinguishable, from the wire,
 * from one that cannot — and the client only ever sees the wire.
 *
 * The gate is therefore correct today for a different reason than the one it was
 * written for, and it costs something real until the lists land: it turns OFF a
 * travel mode that currently works. That is a deliberate, ruled trade
 * (PLANNER4-CONTRACT-07) — this rev ships AFTER the publishing cycle, so both
 * the dictation button and the euro toggle light up together rather than one
 * dark control being swapped for another.
 *
 * ——— THE LINE WORTH KEEPING.
 *
 * A client that infers capability from the REPO is wrong by exactly one deploy,
 * every time — the tree is not what his phone talks to. This comment is itself
 * the specimen: it asserted V19 as ground truth and was stale within the hour.
 * Same family as mock parity, and as the archive-vs-declared-id distinction the
 * deploy gate makes.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function supportsCurrency(build, code) {
  if (!build || !code) return false;
  const list = build.currencies;
  if (!Array.isArray(list)) return false;
  return list.indexOf(code) !== -1;
}

/**
 * THE CURRENCY THIS APP MAY ACTUALLY WRITE IN.
 *
 * ——— WHY THIS EXISTS SEPARATELY FROM HIDING THE BUTTON.
 *
 * Hiding the toggle protects a phone that has never used travel mode. It does
 * NOT protect the phone that is already in it — the preference is sticky and
 * lives in localStorage, so a man who flipped to euros before this gate existed
 * would keep writing euros as pounds with the button no longer even visible to
 * flip back. Hiding a control does not undo the state it set.
 *
 * So the ANSWER is gated, not just the affordance: unless the serving backend
 * publishes the code, the effective currency is home, whatever is stored. The
 * stored preference is left alone — it becomes true again the moment the
 * backend can honour it, and nothing silently rewrites a setting he chose.
 */
export function effectiveCurrency(stored, build, home = 'EGP') {
  if (!stored || stored === home) return home;
  return supportsCurrency(build, stored) ? stored : home;
}

/**
 * The last `build` we saw, cached so the answer survives a cold launch.
 *
 * Without this the control would flicker: hidden on the first frame, appearing a
 * second later when `ping` returns. A button that materialises under his thumb
 * is the shape-changing-while-you-reach problem the Inbox and the category grid
 * both avoid — worse here, because it is a button that was not there when he
 * decided where to press.
 */
export function loadBuild() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    return raw && typeof raw === 'object' ? raw : null;
  } catch {
    return null;
  }
}

export function saveBuild(build) {
  try {
    if (build && typeof build === 'object') {
      localStorage.setItem(KEY, JSON.stringify(build));
    }
  } catch { /* a lost cache costs a hidden button, never an expense */ }
  return build || null;
}

/** Test seam. */
export function _reset() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to do */ }
}
