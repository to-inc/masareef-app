#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK S2 ═══════════
 * «Settings gains a DEFAULT METHOD (ships Card per the Owner's 2026-08-27
 *  ruling — «keep card as the default»; Dad's install settable back to Cash at
 *  setup). The default lives in state/settings.js under localStorage, spelled
 *  in the SHEET's value vocabulary (Cash | Visa — the reader-facing words stay
 *  methodCard/methodCash, and the value never holds a label). EntryView's
 *  method chooser INITIALIZES from it; a NON-EGP currency mode FORCES the Card
 *  pre-choice regardless of the setting (euro cash is not his life); a manual
 *  tap still overrides within the entry being composed. The SettingsSheet
 *  control rides the existing section grammar (SectionLabel) and persists
 *  through the one setter.» (chunk-ledger S2; 06 §3.10.3.)
 *
 * TWO DEFAULTS EXIST AND THEY ARE DIFFERENT FACTS — pinned below so nobody
 * «fixes» one into the other: `entryPayload.DEFAULT_METHOD` ('Cash') is the
 * WIRE FLOOR under a bug, mirroring the server's normalizeMethod_ coercion;
 * the SETTING is the chooser's PRE-CHOICE, shipped 'Visa' by Owner ruling.
 *
 * EVERY lookup is guarded and every render is wrapped — a missing file or a
 * missing export surfaces as a NAMED failure with the run continuing, never
 * as a dead process (the N1/N1b lesson).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { METHODS, DEFAULT_METHOD } from '../src/state/entryPayload.js';
import { AR } from '../src/i18n/strings.ar.js';
import { EN } from '../src/i18n/strings.en.js';

const MARKER = 'CHUNK-S2-GREEN';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };
const eq = (a, b, label) => {
  if (Object.is(a, b)) { pass++; return; }
  failures.push(`${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
/** A THROW IS A NAMED FAILURE, NOT A DEAD PROCESS (the test-batch grammar). */
const at = (fn, label) => {
  try { return fn(); } catch (err) { failures.push(`${label}\n      THREW — ${err && err.message}`); return undefined; }
};
const src = (p) => {
  try { return readFileSync(join(root, p), 'utf8'); } catch { return null; }
};
const str = (loc, k) =>
  (loc && typeof loc[k] === 'string' && loc[k].length > 0 ? loc[k] : null);

/** A tiny injectable storage — the display.js suite pattern, key-checked. */
const fakeStore = (seed = {}) => {
  const data = { ...seed };
  return {
    writes: [],
    getItem(k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem(k, v) { this.writes.push(k); data[k] = String(v); },
    removeItem(k) { delete data[k]; },
  };
};

const KEY = 'masareef.settings.defaultMethod';

// ═══ 1. THE STATE MODULE — the setting exists, executed, in the wire vocabulary ═══

let settings = null;
try {
  settings = await import('../src/state/settings.js');
} catch (err) {
  failures.push(`src/state/settings.js failed to load — ${err && err.message}`);
}
const getDM = settings && settings.getDefaultMethod;
const setDM = settings && settings.setDefaultMethod;
const entryDM = settings && settings.entryDefaultMethod;

ok(typeof getDM === 'function' && typeof setDM === 'function' && typeof entryDM === 'function',
  'S2.1 state/settings.js exports getDefaultMethod, setDefaultMethod, entryDefaultMethod');

eq(at(() => getDM(fakeStore()), 'S2.2 shipped default read'), 'Visa',
  'S2.2 the SHIPPED default is Visa — the Owner\'s «keep card as the default», spelled as the sheet spells it');
ok(at(() => METHODS.indexOf(getDM(fakeStore())) !== -1, 'S2.3 vocabulary read') === true,
  'S2.3 the answer is a WIRE value (METHODS) — the setting can never hold a label');

{
  const st = fakeStore();
  eq(at(() => setDM('Cash', st), 'S2.4 setter'), 'Cash',
    'S2.4 Dad\'s install is settable back to Cash — the setter answers the value it kept');
  ok(st.writes.length > 0 && st.writes.every((k) => k === KEY),
    `S2.5 the choice persists under ${KEY} and nowhere else (wrote «${st.writes.join(', ')}»)`);
  eq(at(() => getDM(st), 'S2.6 round-trip'), 'Cash',
    'S2.6 …and reads back — the install keeps its choice');
}
eq(at(() => getDM(fakeStore({ [KEY]: 'Card' })), 'S2.7 corrupt read'), 'Visa',
  'S2.7 a stored LABEL («Card») is not a method — an unrecognised value falls back to the shipped default rather than becoming a pre-choice');
eq(at(() => setDM(EN.methodCard, fakeStore()), 'S2.8 label store'), 'Visa',
  'S2.8 the setter COERCES: the English label can never be stored as the value (the column-swap law, at the setting)');
eq(at(() => getDM(), 'S2.9 storageless read'), 'Visa',
  'S2.9 no localStorage at all (node, private mode) still answers the shipped default without throwing');

// ═══ 2. THE ENTRY PRE-CHOICE — the setting, unless a non-EGP mode forces Card ═══

{
  const cashInstall = () => fakeStore({ [KEY]: 'Cash' });
  eq(at(() => entryDM('EGP', cashInstall()), 'S2.10 home read'), 'Cash',
    'S2.10 at home the pre-choice IS the setting — Dad\'s Cash install pre-chooses Cash');
  eq(at(() => entryDM('EUR', cashInstall()), 'S2.11 away read'), 'Visa',
    'S2.11 a NON-EGP mode FORCES Card over the setting — euro cash is not his life (§3.10.3)');
  eq(at(() => entryDM(undefined, cashInstall()), 'S2.12 absent currency'), 'Cash',
    'S2.12 an absent currency is home (travel.js\'s own reading), so the setting answers');
  const matrix = [];
  for (const cur of ['EGP', 'EUR', undefined, '']) {
    for (const stored of [null, 'Cash', 'Visa', 'garbage']) {
      const st = stored === null ? fakeStore() : fakeStore({ [KEY]: stored });
      matrix.push(at(() => entryDM(cur, st), `S2.13 matrix ${cur}/${stored}`));
    }
  }
  ok(matrix.every((m) => METHODS.indexOf(m) !== -1),
    `S2.13 every pre-choice across the currency × stored matrix is a WIRE value — never a label, never undefined (got ${JSON.stringify(matrix)})`);
}

eq(DEFAULT_METHOD, 'Cash',
  'S2.14 the wire FLOOR under a bug stays Cash — entryPayload mirrors the server\'s coercion; the SETTING is a different fact and did not «fix» it');

// ═══ 3. ENTRYVIEW WIRING — initialize from the setting, force away, tap overrides ═══

const view = src('src/views/EntryView.jsx') || '';
ok(/import \{[^}]*\bentryDefaultMethod\b[^}]*\} from '\.\.\/state\/settings\.js'/.test(view),
  'S2.15 EntryView reads the pre-choice from state/settings.js — one rule, imported, never a second spelling');
ok(/useEffect\(/.test(view) && /setMethod\(entryDefaultMethod\(currency\)\)/.test(view),
  'S2.16 the chooser INITIALIZES through setMethod(entryDefaultMethod(currency)) — the pre-choice is the setting\'s, stated once');
ok(/!amount && !desc && !cat/.test(view),
  'S2.17 the mount init takes the default only on a PRISTINE composition — returning mid-entry never stomps a chosen method');
ok(/\[travelling\]\)/.test(view) && /if \(travelling\) setMethod\(entryDefaultMethod\(currency\)\)/.test(view),
  'S2.18 entering a non-EGP mode FORCES the pre-choice (the effect keys on travelling and re-applies the one rule, which answers Card away)');
ok(!/\[method\]\)/.test(view),
  'S2.19 NO effect re-fires on method — after the force, his tap within the entry being composed stands');
ok(/setMethod\(m\)/.test(view) && !/setMethod\(['"`]/.test(view),
  'S2.20 the tap hands back the vocabulary item itself, never a literal — the override path is untouched');

// ═══ 4. THE SETTINGS SHEET — the control, in the existing section grammar ═══

const sheet = src('src/views/SettingsSheet.jsx') || '';
ok(/import \{[^}]*\bgetDefaultMethod\b[^}]*\bsetDefaultMethod\b[^}]*\} from '\.\.\/state\/settings\.js'/.test(sheet)
  || /import \{[^}]*\bsetDefaultMethod\b[^}]*\bgetDefaultMethod\b[^}]*\} from '\.\.\/state\/settings\.js'/.test(sheet),
  'S2.21 the sheet reads AND writes through state/settings.js — the one keeper of the key');
ok(/import \{[^}]*\bMETHODS\b[^}]*\} from '\.\.\/state\/entryPayload\.js'/.test(sheet),
  'S2.22 the control renders from METHODS, the wire vocabulary — the EntryView chooser\'s own law');
ok(/METHODS\.map\(/.test(sheet),
  'S2.23 both options are generated from the vocabulary, not hand-built');
ok(/setDefaultMethod\(m\)/.test(sheet),
  'S2.24 the tap persists THROUGH the setter — state and storage move together (the S1.13 shape)');
ok(!/'فيزا'|'كاش'/.test(sheet),
  'S2.25 the sheet hardcodes neither Arabic label — the words are i18n lookups (methodCard/methodCash)');
{
  const at1 = sheet.indexOf('METHODS.map');
  const labelBefore = at1 !== -1 && sheet.lastIndexOf('<SectionLabel>', at1) !== -1;
  ok(labelBefore,
    'S2.26 the control sits under a SectionLabel — the sheet\'s existing section grammar, extended not broken');
}

// ═══ 5. RENDERS — the control reads the install's choice; the chooser shows Card ═══

/**
 * The sheet reads the REAL localStorage door (no prop rides in from App —
 * App.jsx is not this chunk's), so the suite provides one. Defined before the
 * vite server so every module that guards for it finds the same store.
 */
const nodeStore = fakeStore();
globalThis.localStorage = nodeStore;

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
  const pressedLabels = (h) => {
    const out = [];
    const re = /aria-pressed="true"[^>]*>([^<]*)</g;
    for (let m = re.exec(h); m; m = re.exec(h)) out.push(m[1]);
    return out;
  };

  let SettingsSheet = null;
  try {
    SettingsSheet = (await vite.ssrLoadModule('/src/views/SettingsSheet.jsx')).default;
  } catch (err) {
    failures.push(`SettingsSheet THREW while loading — ${err && err.message}`);
  }
  let EntryView = null;
  try {
    EntryView = (await vite.ssrLoadModule('/src/views/EntryView.jsx')).default;
  } catch (err) {
    failures.push(`EntryView THREW while loading — ${err && err.message}`);
  }

  const noop = () => {};
  const sheetProps = { displayCurrency: 'EGP', onFlipCurrency: noop, onClose: noop };

  if (typeof SettingsSheet === 'function') {
    nodeStore.removeItem(KEY);
    const fresh = html('SettingsSheet (fresh install)', SettingsSheet, sheetProps);
    ok(str(AR, 'methodCard') !== null && fresh.includes(str(AR, 'methodCard'))
      && str(AR, 'methodCash') !== null && fresh.includes(str(AR, 'methodCash')),
      'S2.27 BOTH method words render in the sheet — he sees the choice, not only the state');
    ok(pressedLabels(fresh).includes(str(AR, 'methodCard')),
      'S2.28 a fresh install shows CARD chosen — the Owner\'s shipped default, visible');
    {
      const inMethods = pressedLabels(fresh)
        .filter((l) => l === str(AR, 'methodCard') || l === str(AR, 'methodCash'));
      eq(inMethods.length, 1,
        'S2.29 exactly one method is pressed — neither «both» nor «none» is a state a chooser may be in');
    }

    nodeStore.setItem(KEY, 'Cash');
    const cash = html('SettingsSheet (Cash install)', SettingsSheet, sheetProps);
    ok(pressedLabels(cash).includes(str(AR, 'methodCash'))
      && !pressedLabels(cash).includes(str(AR, 'methodCard')),
      'S2.30 with Cash stored the control shows CASH chosen — it reads the install\'s choice; nothing is hard-coded');

    nodeStore.setItem(KEY, 'nonsense');
    const junk = html('SettingsSheet (corrupt store)', SettingsSheet, sheetProps);
    ok(pressedLabels(junk).includes(str(AR, 'methodCard')),
      'S2.31 a corrupted store renders the shipped default rather than nothing — the fallback is visible, not silent');

    nodeStore.removeItem(KEY);
    const label = str(AR, 'entryMethod');
    ok(label !== null && fresh.includes(label),
      'S2.32 the control is NAMED in his language via an existing i18n key (a dedicated settingsDefaultMethod key is a reported residual, both locales drafted)');
  }

  if (typeof EntryView === 'function' && typeof entryDM === 'function') {
    const entryProps = (method) => ({
      amount: '', setAmount: noop, desc: '', setDesc: noop, cat: null, setCat: noop,
      method, setMethod: noop,
    });
    const group = (h) => h.slice(h.indexOf('role="group"')).split('</div>')[0];
    const pressed = (h) => {
      const m = group(h).match(/aria-pressed="true"[^>]*>([^<]*)</);
      return m ? m[1] : null;
    };

    nodeStore.removeItem(KEY);
    const shipped = html('EntryView (shipped pre-choice)', EntryView,
      entryProps(at(() => entryDM('EGP'), 'S2.33 pre-choice read')));
    eq(pressed(shipped), str(AR, 'methodCard'),
      'S2.33 the chooser under the shipped setting shows CARD pressed — the pre-choice he actually sees');

    nodeStore.setItem(KEY, 'Cash');
    const dad = html('EntryView (Cash install)', EntryView,
      entryProps(at(() => entryDM('EGP'), 'S2.34 pre-choice read')));
    eq(pressed(dad), str(AR, 'methodCash'),
      'S2.34 Dad\'s Cash install pre-chooses CASH on the same screen — the setting reaches the chooser');

    const away = html('EntryView (away, Cash install)', EntryView, {
      ...entryProps(at(() => entryDM('EUR'), 'S2.35 pre-choice read')), currency: 'EUR',
    });
    eq(pressed(away), str(AR, 'methodCard'),
      'S2.35 in euro mode the pre-choice is CARD even on the Cash install — the force, rendered');
    nodeStore.removeItem(KEY);
  }
} finally {
  await vite.close();
  delete globalThis.localStorage;
}

if (failures.length) {
  console.log(`❌ CHUNK S2 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · the default method is a setting (shipped Card, Dad settable to Cash), the chooser initializes from it, and a non-EGP mode forces Card`);
