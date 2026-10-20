// Node and SSR (the suites): both locales, loaded up front, so `S` is set on import.
// The browser resolves `#locale-preload` to locale-lazy.js instead (package.json "imports").
import { AR_LOCALE } from './strings.ar.js';
import { EN_LOCALE } from './strings.en.js';

export const PRELOADED = { ar: AR_LOCALE, en: EN_LOCALE };
