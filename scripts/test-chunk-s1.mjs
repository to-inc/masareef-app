#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK S1 ═══════════
 * «The header declutters to date · cog · refresh. The cog — an ⚙-class icon
 *  button at the senior TAP floor, aria-labelled via i18n in both locales —
 *  opens a SETTINGS SHEET (B4's one Sheet primitive: RADIUS.sheet lip, pinned
 *  entrance, reduced-motion instant; the MonthSheet wrapper grammar, backdrop
 *  honestly labelled). v1 holds ONE named section — currency & language: the
 *  LANGUAGE control (same contract it has today), the DISPLAY CURRENCY control
 *  (N1b's law verbatim: flips the Book's lead unit instantly, no reload,
 *  persists in masareef.display.currency, reorders figures the payload already
 *  carries and cannot express a rate), and one quiet caption saying plainly
 *  what the display currency does. The sheet closes by backdrop tap AND by an
 *  explicit close affordance. The cog is quiet, never amber.»
 *  (chunk-ledger S1; Owner field ruling 2026-08-27.)
 *
 * N1b'S PINS, RE-CUT NOT DELETED: the toggle's BEHAVIOR pins (test-book + the
 * display state) are untouched and still run; what moved is the MOUNT. The
 * location pin that said «footer» (test-i18n, S8) is re-cut to the sheet, and
 * this oracle re-pins the flip-without-reload law AT the new mount — both as
 * source (no location.reload in App; the flip persists through
 * setDisplayCurrency) and as executed behavior (the storage round-trip).
 *
 * EVERY lookup is guarded and every render is wrapped — a missing file or a
 * missing locale key surfaces as a NAMED failure with the run continuing,
 * never as a dead process (the N1/N1b lesson, twice in one afternoon).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { RADIUS } from '../src/theme.js';
import { AR } from '../src/i18n/strings.ar.js';
import { EN } from '../src/i18n/strings.en.js';
import {
  getDisplayCurrency, setDisplayCurrency, otherDisplayCurrency,
} from '../src/state/display.js';

const MARKER = 'CHUNK-S1-GREEN';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };

/** Guarded read — an absent file is a named failure, never a dead process. */
const src = (p) => {
  try { return readFileSync(join(root, p), 'utf8'); } catch { return null; }
};
/** Guarded locale string — present, a string, non-empty; else null. */
const str = (loc, k) =>
  (loc && typeof loc[k] === 'string' && loc[k].length > 0 ? loc[k] : null);

const app = src('src/App.jsx') || '';
const sheet = src('src/views/SettingsSheet.jsx');

/** A component's own top-level slice (A2/B4b's extractor grammar). */
function componentSlice(text, name) {
  if (!text) return null;
  const decl = new RegExp(`^(?:export )?(?:default )?function ${name}\\b`, 'm').exec(text);
  if (!decl) return null;
  const rest = text.slice(decl.index + 1);
  const next = /^(?:export )?(?:default )?function /m.exec(rest);
  return text.slice(decl.index, next ? decl.index + 1 + next.index : text.length);
}

/** The Sheet call's own style object — `<Sheet` to its style's closing `}}`. */
function sheetStyle(slice) {
  const at = slice ? slice.indexOf('<Sheet') : -1;
  if (at === -1) return null;
  const close = slice.indexOf('}}', at);
  return close === -1 ? null : slice.slice(at, close + 2);
}

// ═══ 1. THE HEADER — date · cog · refresh, and nothing else moved in ═══

const header = app.slice(app.indexOf('<header'), app.indexOf('</header>'));
ok(header.length > 0, 'S1.1 the header is findable in App.jsx');
ok(header.includes('today_cairo'),
  'S1.2 the header still tells the day — the date survives the declutter');
ok(/<SettingsCog/.test(header),
  'S1.3 the cog rides the header — the door into settings is on every screen');
ok(/<RefreshButton/.test(header),
  'S1.4 the refresh button survives beside it (test-refresh\'s machinery untouched)');
{
  const d = header.indexOf('today_cairo');
  const c = header.indexOf('<SettingsCog');
  const r = header.indexOf('<RefreshButton');
  ok(d !== -1 && c !== -1 && r !== -1 && d < c && c < r,
    'S1.5 the ruled order holds: date · cog · refresh');
}
ok(!/<LangToggle|<CurrencyToggle/.test(header),
  'S1.6 the header carries no stray toggles — decluttered is decluttered');

// ═══ 2. THE SHELL — the toggles MOVED; they were not multiplied or lost ═══

ok(!/<LangToggle|<CurrencyToggle/.test(app),
  'S1.7 App.jsx mounts neither toggle any more — both live in the Settings sheet now');
ok(/import SettingsSheet, \{ SettingsCog \} from '\.\/views\/SettingsSheet\.jsx'/.test(app),
  'S1.8 App imports the sheet and its cog from the one new view');
ok(/settingsOpen && !needsSetup[\s\S]{0,120}<SettingsSheet/.test(app),
  'S1.9 the sheet mounts behind its own open state, shell-level — never inside a tab');
ok(!/tab === '[a-z]+' &&\s*[\s\S]{0,60}<Settings(Cog|Sheet)/.test(app),
  'S1.10 neither the cog nor the sheet is gated on a tab — that would strand him wherever he happens to be');
ok(/S\.lastUpdated/.test(app),
  'S1.11 the footer stamp survives the declutter — «آخر تحديث» is not what moved');

// ═══ 3. N1b'S LAW AT THE NEW MOUNT — flip instantly, no reload, persisted ═══

ok(/onFlipCurrency=\{flipDisplayCurrency\}/.test(app),
  'S1.12 the sheet receives the SAME flip the footer toggle had — behavior moved, not rewritten');
ok(/setDisplayCurrencyState\(\(cur\) => setDisplayCurrency\(otherDisplayCurrency\(cur\)\)\)/.test(app),
  'S1.13 the flip persists through setDisplayCurrency — state and storage move together');
ok(!/location\.reload/.test(app),
  'S1.14 NO reload anywhere in the shell — the currency flip re-renders in place; the language toggle\'s reload lives in Primitives, where it belongs');

// The persistence law, EXECUTED (not just described): the round-trip rides
// the ruled key. The mock records what key was written so the claim is about
// `masareef.display.currency` itself, not about any storage happening.
{
  let wroteKey = null; let val = null;
  const storage = {
    getItem: (k) => (k === 'masareef.display.currency' ? val : null),
    setItem: (k, v) => { wroteKey = k; val = v; },
  };
  const out = setDisplayCurrency('EUR', storage);
  ok(out === 'EUR' && wroteKey === 'masareef.display.currency',
    `S1.15 the choice persists under masareef.display.currency (wrote «${wroteKey}»)`);
  ok(getDisplayCurrency(storage) === 'EUR',
    'S1.16 …and reads back — the install keeps its reading unit');
  ok(otherDisplayCurrency('EGP') === 'EUR' && otherDisplayCurrency('EUR') === 'EGP',
    'S1.17 the toggle names where it goes, both directions');
}

// ═══ 4. THE SHEET'S SOURCE — B4 adoption, MonthSheet grammar, quiet ═══

ok(sheet !== null, 'S1.18 src/views/SettingsSheet.jsx exists');
const sh = sheet || '';
ok(/import \{[^}]*\bSheet\b[^}]*\} from '\.\.\/components\/Primitives\.jsx'/.test(sh),
  'S1.19 the view consumes B4\'s Sheet primitive — an adoption, never a hand-rolled twin');
ok(/import \{[^}]*\bLangToggle\b[^}]*\}/.test(sh) && /\bCurrencyToggle\b/.test(sh)
  && /<LangToggle/.test(sh) && /<CurrencyToggle/.test(sh),
  'S1.20 BOTH controls are the Primitives\' own — they moved house; they were not re-implemented');
{
  // The backdrop: a full-screen button, honestly labelled, that closes.
  const backdrop = /aria-label=\{S\.settingsClose\}[\s\S]{0,220}position: 'fixed', inset: 0/.test(sh)
    || /position: 'fixed', inset: 0[\s\S]{0,220}aria-label=\{S\.settingsClose\}/.test(sh);
  ok(backdrop && /onClick=\{onClose\}/.test(sh),
    'S1.21 the backdrop is a BUTTON with an honest name (MonthSheet\'s grammar) — the whole page behind the sheet is the way out');
  ok((sh.match(/onClick=\{onClose\}/g) || []).length >= 2 && /\{S\.settingsClose\}\s*<\/button>/.test(sh),
    'S1.22 …and an EXPLICIT close affordance stands beside it — a visible button he can read, not only a region he must know about');
}
{
  const style = sheetStyle(sh);
  ok(style !== null && !/borderRadius/.test(style),
    'S1.23 the Sheet call restates no radius — the RADIUS.sheet lip is the primitive\'s identity');
}
ok(sheet !== null && !/@keyframes|animation:/.test(sh),
  'S1.24 no hand-rolled entrance — B4\'s sheet-in is the only way this surface arrives');
// The TOKENS, not the word: the file's comments may SAY «never amber» —
// that is doctrine, not paint. What must be absent is the warm fill itself.
ok(sheet !== null && !/C\.amber|amberInk|amberRim|#D9A441/i.test(sh),
  'S1.25 the sheet claims no amber — one warm action per screen stays the keypad\'s');
{
  const cog = componentSlice(sh, 'SettingsCog');
  ok(cog !== null && /minHeight: TAP/.test(cog) && /minWidth: TAP/.test(cog),
    'S1.26 the cog sits at the senior TAP floor in both dimensions');
  ok(cog !== null && /aria-label=\{S\.settingsTitle\}/.test(cog) && /aria-hidden/.test(cog),
    'S1.27 the cog is aria-labelled via i18n and its glyph is decoration — VoiceOver reads the word, never the gear');
  ok(cog !== null && !/amber/i.test(cog),
    'S1.28 the cog is quiet, not amber');
}
ok(/fontSize: TYPE\.label[\s\S]{0,160}\{S\.settingsCurrencyNote\}/.test(sh),
  'S1.29 the caption sits ON the prose floor (TYPE.label) — it states something said nowhere else, so ruling 2\'s caption size is illegal for it');

// ═══ 5. THE WORDS — both locales, guarded, plainly shaped ═══

for (const k of ['settingsTitle', 'settingsClose', 'settingsLangCurrency',
  'settingsLanguage', 'settingsCurrency', 'settingsCurrencyNote']) {
  ok(str(AR, k) !== null && str(EN, k) !== null,
    `S1.30 i18n key «${k}» exists as a non-empty string in BOTH locales`);
}
{
  const arNote = str(AR, 'settingsCurrencyNote') || '';
  const enNote = str(EN, 'settingsCurrencyNote') || '';
  ok(arNote.includes('الدفتر') && /Book/.test(enNote),
    'S1.31 the caption is «which unit leads the Book\'s figures»-shaped — it talks about the Book he reads');
  ok(/تحويل/.test(arNote) && /convert/i.test(enNote),
    'S1.32 …and says plainly that nothing is converted — the control reorders figures; it cannot express a rate');
}

// ═══ 6. RENDERS — the sheet settles as a sheet, with everything inside ═══

const vite = await createServer({
  root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error',
});
try {
  const html = (name, Comp, props) => {
    try {
      return renderToStaticMarkup(createElement(Comp, props));
    } catch (err) {
      failures.push(`${name} THREW while rendering — ${err && err.message}`);
      return '';
    }
  };
  const settled = (h) => h.replace(/<style>[\s\S]*?<\/style>/g, '');

  let SettingsSheet = null; let SettingsCog = null;
  try {
    const mod = await vite.ssrLoadModule('/src/views/SettingsSheet.jsx');
    SettingsSheet = mod.default; SettingsCog = mod.SettingsCog;
  } catch (err) {
    failures.push(`SettingsSheet THREW while loading — ${err && err.message}`);
  }
  ok(typeof SettingsSheet === 'function' && typeof SettingsCog === 'function',
    'S1.33 the sheet and its cog are exported for standalone render — a surface a suite cannot render alone is a surface nobody re-verifies');

  if (typeof SettingsCog === 'function') {
    const c = html('SettingsCog', SettingsCog, { onOpen: () => {} });
    ok(str(AR, 'settingsTitle') !== null && c.includes(`aria-label="${str(AR, 'settingsTitle')}"`),
      'S1.34 the rendered cog carries its Arabic accessible name (the node default locale is the law\'s default: Arabic)');
    ok(/aria-hidden/.test(c),
      'S1.35 the gear glyph renders as decoration');
  }

  if (typeof SettingsSheet === 'function') {
    const noop = () => {};
    const h = html('SettingsSheet', SettingsSheet, {
      displayCurrency: 'EGP', onFlipCurrency: noop, onClose: noop,
    });
    ok(h.includes('class="sheet-in"'),
      'S1.36 the surface arrives as B4\'s one sheet (class="sheet-in")');
    ok(h.includes(`border-radius:${RADIUS.sheet}px`),
      `S1.37 its lip is RADIUS.sheet (${RADIUS.sheet}px) in the rendered style`);
    ok(h.includes('prefers-reduced-motion'),
      'S1.38 the media guard ships WITH the markup — reduced motion means instant, and the promise travels with the surface');
    ok(h !== '' && !settled(h).includes('translateY') && !/opacity:\s*0[;"}]/.test(settled(h)),
      'S1.39 the static render is the SETTLED state — the rise lives only in the keyframes');
    ok(h.includes('role="dialog"') && str(AR, 'settingsTitle') !== null
      && h.includes(`aria-label="${str(AR, 'settingsTitle')}"`),
      'S1.40 the sheet announces itself as a named dialog');
    ok(str(AR, 'settingsLangCurrency') !== null && h.includes(str(AR, 'settingsLangCurrency')),
      'S1.41 the ONE named section renders — currency & language, by name');
    ok(h.includes('>English<') || h.includes('English'),
      'S1.42 the LANGUAGE control is inside, labelled in the language it switches TO (English, under the Arabic default)');
    ok(h.includes('>EGP<') || />\s*EGP\s*</.test(h),
      'S1.43 the CURRENCY control is inside and states the unit he is IN (EGP)');
    {
      const wantAria = typeof AR.readInUnit === 'function' ? AR.readInUnit('EUR') : null;
      ok(wantAria !== null && h.includes(`aria-label="${wantAria}"`),
        'S1.44 …while its accessible name carries the ACTION («اقرا بالـEUR») — the 2026-08-25 currency-control ruling, intact at the new mount');
    }
    ok(str(AR, 'settingsCurrencyNote') !== null && h.includes(str(AR, 'settingsCurrencyNote')),
      'S1.45 the quiet caption renders beside the control it explains');
    {
      const close = str(AR, 'settingsClose');
      const n = close === null ? 0 : h.split(close).length - 1;
      ok(n >= 2,
        `S1.46 BOTH ways out render — the labelled backdrop and the visible close button (found ${n} × «${close}»)`);
    }

    // The lead unit follows the install's choice — the flip has something real
    // to flip. Same sheet, other unit, other aria: nothing is hard-coded.
    const h2 = html('SettingsSheet (EUR)', SettingsSheet, {
      displayCurrency: 'EUR', onFlipCurrency: noop, onClose: noop,
    });
    {
      // The way back is named by the home currency's MARK now, not its ISO
      // code — «اقرا بالـج.م», not «اقرا بالـEGP», which welded a Latin
      // abbreviation into an Arabic sentence. S1.47 is about the control
      // REORDERING rather than hard-coding, and that is unchanged.
      const wantAria = typeof AR.readInUnit === 'function' ? AR.readInUnit(AR.currencyShort) : null;
      ok(h2.includes('EUR') && wantAria !== null && h2.includes(`aria-label="${wantAria}"`),
        'S1.47 with EUR chosen the control states EUR and offers the way back to EGP — the mount reorders, it never hard-codes');
    }
  }
} finally {
  await vite.close();
}

if (failures.length) {
  console.log(`❌ CHUNK S1 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · the header keeps date · cog · refresh, and both reading controls live behind the cog on B4's one sheet`);
