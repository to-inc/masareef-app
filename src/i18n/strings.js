/**
 * The active locale — one import site for the whole app (D16b).
 *
 * `S` and its companions are resolved ONCE, at module load, from the persisted
 * language. Every view keeps importing `{ S }` exactly as before, so adding
 * English touched no string reference anywhere in the app; switching language
 * reloads (see `state/lang.js` for why that is the right trade here).
 *
 * ARABIC IS THE DEFAULT. An install that has never been told otherwise — and
 * one whose storage was cleared — speaks Arabic. CLAUDE.md #6.
 */
import { AR_LOCALE } from './strings.ar.js';
import { EN_LOCALE } from './strings.en.js';
import { getLang } from '../state/lang.js';
import { HOME_CURRENCY } from '../state/travel.js';

export const LOCALES = { ar: AR_LOCALE, en: EN_LOCALE };

export const LOCALE = LOCALES[getLang()] || AR_LOCALE;

export const S = LOCALE.S;
export const DIR = LOCALE.dir;

/** Server month names ("July") → the reader's language. */
export const monthName = LOCALE.monthName;

/** His TAB name ("Jul") → the reader's language. Opaque in, readable out. */
export const monthByTab = LOCALE.monthByTab;

/**
 * A category's VALUE → its LABEL (finding M2).
 *
 * The value is the frozen-schema string his dashboard matches on and the only
 * thing that ever reaches the wire; the label is what he reads on the button.
 * In Arabic they differ, in English they are the same string. Every category
 * rendered anywhere in the app goes through here — a view that interpolates
 * `{c}` directly is rendering a wire value at a person, which is the whole
 * finding.
 */
export const categoryLabel = LOCALE.categoryLabel;

export const WEEK_DAYS = LOCALE.WEEK_DAYS;
export const MONTH_LABELS = LOCALE.MONTH_LABELS;

/** Initials, per language — «أ.ع.» / "A.O." (W-6). */
export const CAPTAIN_INITIALS = LOCALE.CAPTAIN_INITIALS;

/**
 * The toggle's label, always written in the language it switches TO — so it
 * reads as an offer rather than as a description of where you are. He never has
 * to understand the current language to find his way out of it.
 */
export const SWITCH_TO = LOCALE.switchTo;

/**
 * THE UNIT A CURRENCY IS WRITTEN AS (HANDOFF:57).
 *
 * Home money wears its MARK — «ج.م» / «E£». Foreign money keeps the code the
 * sheet writes, because that code is what he matches against his statement.
 *
 * It lives here rather than in a view because it is a question about LANGUAGE,
 * and because the first version lived in one view and was therefore missing
 * from three screens: the Week, Month and Year asides kept printing the raw
 * code for a day after Today was fixed. One place to ask.
 *
 * It also fixes a script collision nobody had noticed: the Arabic caption is
 * `بالـ${cur}`, so passing the ISO code rendered «بالـEGP» — an Arabic prefix
 * welded to a Latin abbreviation, in a locale that has a perfectly good mark.
 */
export const unitFor = (currency) => (currency === HOME_CURRENCY ? S.currencyShort : currency);

/**
 * AMOUNTS WEAR THEIR CURRENCY'S MARK (HANDOFF:61, Tarek 2026-10-09): «€», as
 * G06 draws it — on rows and on headline totals alike. Home money is unchanged.
 * Sentences that NAME a unit and the currency chip keep `unitFor` (the code).
 * Only EUR travels today (travel.js CURRENCIES); a third currency adds its mark here.
 */
const MARKS = { EUR: '€' };
export const markUnitFor = (currency) => MARKS[currency] || unitFor(currency);
/** The statement total's unit: the mark, else the currency's word («جنيه»/EGP). */
export const headlineUnitFor = (currency) => MARKS[currency] || S.currencyName(currency);
