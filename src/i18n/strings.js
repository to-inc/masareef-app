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
