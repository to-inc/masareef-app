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
import { getLang } from '../state/lang.js';
import { PRELOADED } from '#locale-preload';
import { HOME_CURRENCY } from '../state/travel.js';

/**
 * ONLY THE LANGUAGE HE READS IS DOWNLOADED (efficiency audit #11, 2026-10-20).
 * Each locale is its own chunk; main.jsx awaits `loadLocale()` before it imports
 * the app, so every module that reads `S` evaluates after it is set. The bindings
 * below are LIVE (`export let`), which is what makes the late assignment visible
 * to every importer. Under SSR and plain Node (the suites) both locales arrive
 * through `#locale-preload`, so `S` is ready on import exactly as before.
 */
export let LOCALE = null;
export let S = null;
// The direction needs no strings: theme.js reads it before any locale has loaded.
export const DIR = getLang() === 'en' ? 'ltr' : 'rtl';

/** Server month names ("July") → the reader's language. */
export let monthName = null;

/** His TAB name ("Jul") → the reader's language. Opaque in, readable out. */
export let monthByTab = null;

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
export let categoryLabel = null;

export let WEEK_DAYS = null;
export let MONTH_LABELS = null;

/** Initials, per language — «أ.ع.» / "A.O." (W-6). */
export let CAPTAIN_INITIALS = null;

/**
 * The toggle's label, always written in the language it switches TO — so it
 * reads as an offer rather than as a description of where you are. He never has
 * to understand the current language to find his way out of it.
 */
export let SWITCH_TO = null;

function useLocale(L) {
  LOCALE = L; S = L.S; monthName = L.monthName; monthByTab = L.monthByTab;
  categoryLabel = L.categoryLabel; WEEK_DAYS = L.WEEK_DAYS; MONTH_LABELS = L.MONTH_LABELS;
  CAPTAIN_INITIALS = L.CAPTAIN_INITIALS; SWITCH_TO = L.switchTo;
  return L;
}

export const loadLocale = () => (getLang() === 'en'
  ? import('./strings.en.js').then((m) => useLocale(m.EN_LOCALE))
  : import('./strings.ar.js').then((m) => useLocale(m.AR_LOCALE)));

// Node/SSR resolve `#locale-preload` to both locales, so the suites read `S` on import as before.
if (PRELOADED) useLocale(PRELOADED[getLang() === 'en' ? 'en' : 'ar']);

/**
 * THE UNIT A CURRENCY IS WRITTEN AS (HANDOFF:57, :61).
 *
 * Every currency wears its MARK: home money «ج.م» / «E£», the euro «€» (Tarek,
 * 2026-10-09 — rows, headline totals, the currency chip, Settings, charts and
 * read-aloud labels alike). A currency with no mark here keeps its code.
 *
 * It lives here rather than in a view because it is a question about LANGUAGE,
 * and because the first version lived in one view and was therefore missing
 * from three screens: the Week, Month and Year asides kept printing the raw
 * code for a day after Today was fixed. One place to ask.
 *
 * It also fixes a script collision nobody had noticed: the Arabic caption is
 * `بالـ${cur}`, so passing the ISO code rendered «بالـEGP» — an Arabic prefix
 * welded to a Latin abbreviation, in a locale that has a perfectly good mark.
 * Only EUR travels today (travel.js CURRENCIES); a third currency adds its mark here.
 */
const MARKS = { EUR: '€' };
export const unitFor = (currency) => (currency === HOME_CURRENCY ? S.currencyShort : (MARKS[currency] || currency));
/** The statement total's unit: the mark, else the currency's word («جنيه»/EGP). */
export const headlineUnitFor = (currency) => MARKS[currency] || S.currencyName(currency);
