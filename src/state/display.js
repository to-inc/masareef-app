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
