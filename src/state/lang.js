/**
 * Which language this install speaks (D16b).
 *
 * ARABIC IS THE DEFAULT AND THAT IS A LAW, not a preference — CLAUDE.md #6. The
 * app is for one man in Cairo who reads Arabic; English exists because Tarek
 * runs the same build against his own book. An install that has never been told
 * otherwise speaks Arabic, including one whose storage was wiped.
 *
 * WHY A RELOAD ON SWITCH, and not a React context.
 *
 * `S` is a module-level import in eight files. Threading a context through all
 * of them would touch every string reference in the app and put the 638
 * assertions that read `S` statically at risk — a large diff for a setting one
 * person changes roughly once. A reload re-imports the chosen locale, costs
 * about a second from the service worker's cache, and cannot leave half the
 * screen in the old language. The switch is a Settings action, not a hot path;
 * the 5-second capture law is untouched by it.
 */
const KEY = 'masareef.lang';

/** The only two values this ever holds. Anything else reads as Arabic. */
export const LANGS = ['ar', 'en'];

export function getLang(storage) {
  try {
    const store = storage || (typeof localStorage === 'undefined' ? null : localStorage);
    const v = store && store.getItem(KEY);
    return LANGS.indexOf(v) === -1 ? 'ar' : v;
  } catch {
    // Private mode or a full quota. Falling back to Arabic is the correct
    // failure: it is the default, and it is the language he actually reads.
    return 'ar';
  }
}

export function setLang(lang, storage) {
  const next = LANGS.indexOf(lang) === -1 ? 'ar' : lang;
  try {
    const store = storage || (typeof localStorage === 'undefined' ? null : localStorage);
    if (store) store.setItem(KEY, next);
  } catch { /* the switch simply will not persist; nothing else breaks */ }
  return next;
}

export const otherLang = (lang) => (lang === 'en' ? 'ar' : 'en');

/**
 * Applied to <html> at boot, so the direction is set before first paint rather
 * than flipping under him. index.html ships `dir="rtl" lang="ar"` — the default
 * — and this only ever has to change it for an install that chose English.
 */
export function applyDocumentLang(locale, doc) {
  const d = doc || (typeof document === 'undefined' ? null : document);
  if (!d || !d.documentElement) return;
  d.documentElement.setAttribute('dir', locale.dir);
  d.documentElement.setAttribute('lang', locale.lang);
}
