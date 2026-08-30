import { CURRENCIES, HOME_CURRENCY, AWAY_CURRENCY } from './travel.js';
import { foreignLines } from './foreign.js';

/**
 * THE DISPLAY CURRENCY — which unit the screen LEADS with (D23).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE FIELD REPORT THAT RULED IT. «This week 0» over a real 80 EUR week —
 * "this is unacceptable". Every figure on that screen was true. The EGP total
 * was 0 because he had spent nothing in pounds, the euros were named in the
 * aside beneath, and the comparison correctly refused itself. It was still the
 * wrong screen, because it led with the unit his week did not happen in.
 *
 * So the headline's unit follows the LIFE, not the ledger's history.
 *
 * ——— EMPHASIS, NEVER ARITHMETIC. THIS IS THE WHOLE DISCIPLINE OF THIS FILE.
 *
 * «80 EUR · and with it 0 EGP» is TWO TRUE SUMS with the lead swapped. Each
 * currency is summed only over its OWN rows, by the server, in the payload the
 * app already receives. Nothing here converts, and nothing here may: a summary
 * conversion at a render-time rate is Boundary 8, and the Owner rejected it
 * mid-sentence when it was proposed to him.
 *
 * A converted total becomes honest ONLY through D21's stamped `Home` cells — a
 * real rate, recorded at write time, falsifiable afterwards — and that is the
 * BACKEND half of D23, not this one. Until it lands, `leadAndAsides` may only
 * SELECT and ORDER figures that arrived. It can never produce a number that
 * was not in the payload, and the suite asserts exactly that by comparing the
 * set of figures out against the set of figures in.
 *
 * ——— WHY THIS IS NOT `travel.js`, WHICH ALSO HOLDS A CURRENCY.
 *
 * `travel.js` is a WRITE concern: it decides what the keypad RECORDS in his
 * book, and getting it wrong writes 41.50 EGP where €41.50 belongs. This is a
 * READ concern and touches nothing that is stored. They share the list of
 * currencies that exist — one fact, imported rather than retyped — and share
 * nothing else. A display preference that reached the keypad would turn a
 * reading choice into a wrong row, which is the most expensive mistake this
 * codebase knows how to make.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const KEY = 'masareef.display.currency';

/**
 * The same two units the app knows about, imported rather than retyped so a
 * third currency cannot arrive in one list and not the other. The NAME is
 * separate because the meaning is: these are units to READ in, not to write in.
 */
export const DISPLAY_CURRENCIES = CURRENCIES;

/**
 * Re-exported so a READER never has to import from `travel.js`, whose subject is
 * what gets WRITTEN. One import line is a small thing; it is also the whole
 * distance between a display preference and a wrong row in his book.
 */
export { HOME_CURRENCY, AWAY_CURRENCY };

/** Where the toggle goes, named in both directions. */
export const otherDisplayCurrency = (c) => (c === AWAY_CURRENCY ? HOME_CURRENCY : AWAY_CURRENCY);

/**
 * THE DEFAULT IS THE BOOK'S OWN UNIT, and that is deliberate rather than
 * conservative: the sheet is denominated in EGP and Dad's install must be
 * unchanged until the cutover review (docs/07). Tarek's install opts IN with one
 * tap, which is what "per install" means here — the same shape as travel mode
 * and the language switch, and persisted the same way.
 *
 * An unrecognised stored value falls back rather than rendering itself, on the
 * same reasoning as `getLang`: a corrupted preference must not become a unit
 * label on a figure.
 */
/**
 * WHAT AN INSTALL READS IN BEFORE IT IS TOLD (Owner ruling, 2026-08-30).
 *
 * This is NOT `HOME_CURRENCY`, and the difference is the whole point.
 * `HOME_CURRENCY` is a fact about the SHEET: EGP is the currency its sums are
 * kept in, and D8's «foreign money never joins an EGP sum» depends on it. This
 * is a fact about the READER: which unit he wants the screen to answer in.
 *
 * They were the same constant until now, and that is why an install whose money
 * is in euros opened on an EGP screen reading zero — the app defaulted to the
 * sheet's unit rather than the reader's, and then had no way to be told apart.
 */
export const DEFAULT_DISPLAY_CURRENCY = 'EUR';

export function getDisplayCurrency(storage) {
  try {
    const store = storage || (typeof localStorage === 'undefined' ? null : localStorage);
    const v = store && store.getItem(KEY);
    return DISPLAY_CURRENCIES.indexOf(v) === -1 ? DEFAULT_DISPLAY_CURRENCY : v;
  } catch {
    return DEFAULT_DISPLAY_CURRENCY;
  }
}

export function setDisplayCurrency(c, storage) {
  const next = DISPLAY_CURRENCIES.indexOf(c) === -1 ? HOME_CURRENCY : c;
  try {
    const store = storage || (typeof localStorage === 'undefined' ? null : localStorage);
    if (store) store.setItem(KEY, next);
  } catch { /* the choice simply will not persist; nothing else breaks */ }
  return next;
}

/**
 * WHICH FIGURE LEADS, AND WHAT STANDS BESIDE IT.
 *
 * @param egpTotal   the period's EGP sum — the server's, over EGP rows only.
 * @param foreign    `{count, byCurrency}` — the server's, each currency summed
 *                   over its own rows only.
 * @param currency   the install's display choice.
 * @returns `{lead: {currency, amount}, asides: [{currency, amount}]}`
 *
 * ——— A ZERO LEAD IS HONEST **ONLY** BESIDE ITS ASIDE.
 *
 * D23's own worked example contains a zero — «80 EUR · and with it 0 EGP» — and
 * that is the tell: the original defect was never the zero. It was a zero
 * standing ALONE while real money sat outside the frame. So a period with
 * nothing in the chosen unit still leads with that unit's true zero, and the
 * aside carrying the money is not optional. Every currency the period touched
 * is stated, always; only the ORDER moves.
 *
 * The EGP figure is always among the two, even at zero, because it is the
 * book's own unit and its absence would be the same silence in the other
 * direction.
 */
export function leadAndAsides(egpTotal, foreign, currency) {
  const want = DISPLAY_CURRENCIES.indexOf(currency) === -1 ? HOME_CURRENCY : currency;
  const egp = Number(egpTotal);

  const figures = [{ currency: HOME_CURRENCY, amount: isFinite(egp) ? egp : 0 }];
  for (const line of foreignLines(foreign)) {
    // Read through `foreignLines` rather than walking `byCurrency` again — the
    // second reader of one shape is where the two drift apart, and this project
    // has paid for that more than once.
    if (line.currency === HOME_CURRENCY) continue;
    figures.push({ currency: line.currency, amount: line.amount });
  }

  const found = figures.find((f) => f.currency === want);
  const chosen = found || { currency: want, amount: 0 };

  /**
   * THE CHOSEN UNIT LEADS WHENEVER IT HAS MONEY. When it does not, the unit
   * that DOES leads instead, and the chosen one is stated beside it.
   *
   * This used to lead with the chosen unit unconditionally, on the reasoning
   * that «he asked to read in it, and answering in a different unit would be
   * the app overruling the choice». That held while the default WAS the book's
   * unit, because then the chosen unit was the one with the money and this
   * case almost never arose.
   *
   * Making EUR the default (Owner ruling 2026-08-30) made it arise on every
   * EGP-heavy period: August holds 123,110.68 EGP and no euros, and the
   * largest element on the screen read «0 EUR» while the real money sat in an
   * aside. The setting was not lying — the HEADLINE was, by giving the hero to
   * the one figure that had nothing to say.
   *
   * Nothing is hidden either way: every other figure, the chosen unit
   * included, is still stated as an aside. So the choice is still REPORTED,
   * which is what the old reasoning actually cared about. What moves is only
   * which true number is given the hero — and a zero never wins that against a
   * figure. On a genuinely empty period every figure is zero, the chosen unit
   * wins by default, and the screen honestly reads zero.
   */
  const richest = figures
    .filter((f) => Number(f.amount) > 0)
    .sort((a, b) => Number(b.amount) - Number(a.amount))[0];
  const lead = Number(chosen.amount) > 0 || !richest ? chosen : richest;
  const asides = figures.filter((f) => f.currency !== lead.currency);
  if (lead !== chosen && chosen.currency !== lead.currency
    && !asides.some((f) => f.currency === chosen.currency)) {
    // the chosen unit had no line of its own; state its true zero anyway
    asides.push(chosen);
  }
  return { lead, asides };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * THE ALL-IN HOME FIGURE (D27, Owner ruling 2026-08-30: «switches everything
 * into Euro or EGP … anything in either currency translated to the other»).
 *
 * ——— WHY `leadAndAsides` COULD NOT ALREADY DO THIS.
 *
 * That function may only SELECT figures that arrived, and the only EUR figure
 * that arrived was `foreign.byCurrency.EUR` — the sum of rows ALREADY WRITTEN
 * in euros. That is not his euro spending. It is the part of it that happened
 * to be denominated that way. Measured on his own book, 2026-08-30: August held
 * EUR 735.86 of native euros beside 123,120.68 EGP that no euro figure covered
 * at all, so the euro screen showed a quarter of a real ~EUR 2,862 month and
 * called it the month.
 *
 * `homeAgg.total` is the server's sum of `native` + `converted`, every
 * converted row taken at the rate recorded ON ITS OWN ROW at its own date
 * (D21/D27). Nothing here converts anything — Boundary 8 stands, and this file
 * still cannot express a rate. It selects a figure the payload carried, exactly
 * as before; there is simply now a better one in it.
 *
 * ——— THE TRAP THIS FUNCTION EXISTS TO AVOID: DOUBLE COUNTING.
 *
 * The moment those pounds are converted they are INSIDE the euro total. The
 * old aside line — «and with them 123,120 E£» — was true while the two sums
 * were disjoint and becomes a lie the day they are not, because it reads as
 * money BESIDE the headline when it is money WITHIN it.
 *
 * So the partition is honoured exactly as the server states it:
 *   native + converted  → INSIDE `total`. Never restated as an addition.
 *   unstamped           → OUTSIDE it. Real money the total does not cover, and
 *                         therefore the one thing that MUST be stated beside.
 *   unpriced            → not money yet; `unsizedForeign` already says it.
 *
 * A home total that silently omits `unstamped` is the same defect this whole
 * file exists to prevent, in a politer font.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function allInLead(homeAgg, currency) {
  if (!homeAgg || homeAgg.currency !== currency) return null;
  const total = Number(homeAgg.total);
  if (!isFinite(total)) return null;          // tri-state: absent is not zero
  return { currency: homeAgg.currency, amount: total };
}

/**
 * WHAT THE ALL-IN FIGURE DOES NOT COVER — one line per currency, never summed
 * across them, because currencies do not add and `unstamped.total` is `null`
 * for that exact reason.
 *
 * This is the honest remainder: money that is really in his book, really in the
 * period, and has no rate recorded on its row, so no euro figure can include it
 * without inventing one.
 */
export function unconvertedLines(homeAgg) {
  const by = homeAgg && homeAgg.unstamped && homeAgg.unstamped.byCurrency;
  if (!by) return [];
  return Object.keys(by)
    .map((c) => ({ currency: c, amount: Number(by[c]) }))
    .filter((l) => isFinite(l.amount) && l.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

/**
 * THE METHOD CARDS, DENOMINATED IN THE UNIT HE IS READING (D27 · §2.2c).
 *
 * The cards were the last thing on the screen still speaking only pounds, and
 * for a real reason rather than an oversight: the only per-method figures on
 * the wire were the EGP day-totals, so a euro book read «All 0 E£ · Card 0 E£ ·
 * Cash 0 E£» beneath a euro hero. True, useless, and the best the app had.
 *
 * `homeAgg.byMethod` is the same native/converted partition the whole is built
 * from, sliced by method by the SAME server branch that classifies the whole —
 * so «All» equals «Card» plus «Cash» by construction, which is the arithmetic
 * he will do by eye the moment the three sit together.
 *
 * TRI-STATE, DELIBERATELY. A book without `byMethod` — Dad's, and his own until
 * this build is deployed — returns null here and keeps its EGP cards, honestly
 * labelled. A half-deployed book therefore never renders a half-truth.
 */
export function homeMetricTotals(homeAgg, prevHomeAgg, currency) {
  if (!allInLead(homeAgg, currency)) return null;
  if (!homeAgg.byMethod) return null;
  const at = (agg, key) => {
    if (!agg || agg.currency !== currency) return null;
    const n = Number(key === 'all' ? agg.total : (agg.byMethod && agg.byMethod[key] || {}).total);
    return isFinite(n) ? n : null;
  };
  const out = {};
  for (const key of ['all', 'Visa', 'Cash']) {
    out[key] = { now: at(homeAgg, key) || 0, prevAt: at(prevHomeAgg, key) };
  }
  return out;
}
