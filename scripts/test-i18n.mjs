#!/usr/bin/env node
/**
 * The two locales, and the rule that Arabic is the default.  `npm run check:i18n`
 *
 * THE FAILURE THIS FILE EXISTS FOR. A key added to one locale and forgotten in
 * the other renders `undefined` at whoever is reading — and it renders it
 * silently, in a language the person who added the key does not read. Nobody is
 * going to catch that by eye. So the two key sets are compared, by name, by
 * type, and by ARITY: `logUnpriced: (n) => …` in one file and
 * `logUnpriced: 'x'` in the other is a crash, not a typo, and an arity mismatch
 * prints "[object Object]" or drops the number entirely.
 *
 * And the law: ARABIC IS THE DEFAULT (CLAUDE.md #6). This app is for one man in
 * Cairo who reads Arabic; English exists because Tarek runs the same build
 * against his own book. Every path that could quietly make English the default —
 * unset storage, a cleared install, a garbage value, a storage that throws —
 * is asserted to land on Arabic.
 */
import { AR_LOCALE } from '../src/i18n/strings.ar.js';
import { EN_LOCALE } from '../src/i18n/strings.en.js';
import { getLang, setLang, otherLang, applyDocumentLang, LANGS } from '../src/state/lang.js';
import { readFile } from 'node:fs/promises';

let pass = 0;
const failures = [];
const eq = (a, b, label) => {
  if (Object.is(a, b)) { pass++; return; }
  failures.push(`${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const ok = (c, label) => eq(!!c, true, label);

const store = (v) => ({ get: () => v, getItem: () => v, setItem(_, x) { v = x; } });

// ——————————————————————— the key sets must be identical
const arKeys = Object.keys(AR_LOCALE.S).sort();
const enKeys = Object.keys(EN_LOCALE.S).sort();
ok(arKeys.length > 100, `the locale is substantial (${arKeys.length} keys) — a trivial one would make the parity check meaningless`);
for (const k of arKeys) {
  if (enKeys.indexOf(k) !== -1) { pass++; continue; }
  failures.push(`"${k}" exists in Arabic and NOT in English — it would render as undefined for an English reader`);
}
for (const k of enKeys) {
  if (arKeys.indexOf(k) !== -1) { pass++; continue; }
  failures.push(`"${k}" exists in English and NOT in Arabic — and Arabic is the language he actually reads`);
}

/**
 * ——————————————————————— SAME TYPE, SAME ARITY.
 *
 * A key that is a template function in one locale and a plain string in the
 * other does not fail loudly: `S.logUnpriced(3)` on a string throws, and
 * `${S.logUnpriced}` on a function prints its SOURCE CODE into the UI. Arity
 * matters for the same reason — `(prev, unit) => …` called as `(prev)` renders
 * "undefined" mid-sentence.
 */
for (const k of arKeys) {
  if (enKeys.indexOf(k) === -1) continue;
  const a = AR_LOCALE.S[k], e = EN_LOCALE.S[k];
  eq(typeof e, typeof a, `"${k}" is the same kind of value in both locales`);
  if (typeof a === 'function' && typeof e === 'function') {
    eq(e.length, a.length, `"${k}" takes the same number of arguments in both locales`);
  }
}

/**
 * ——————————————————————— EVERY TEMPLATE ACTUALLY PRODUCES A STRING.
 * Called with plausible arguments, in both locales — a template that throws or
 * returns undefined is a blank line on his screen.
 */
/**
 * ——— NO KEY DEFINED TWICE. In an object literal the LAST definition silently
 * wins, so a duplicate key is a working feature shadowed by an unrelated one —
 * `batchDone` was defined at line ~245 (three-count settled header) and again
 * at ~335 (one-count outbox toast), and the header rendered the toast's shape
 * while 2,931 assertions stayed green. The runtime object cannot show this
 * (the literal has already collapsed), so the SOURCE is what is checked.
 */
for (const [name, file] of [['ar', '../src/i18n/strings.ar.js'], ['en', '../src/i18n/strings.en.js']]) {
  const src = await readFile(new URL(file, import.meta.url), 'utf8');
  /**
   * Scoped to the `S` literal — the first version scanned the whole file and
   * promptly reddened on `May:` living in BOTH month-name helper maps, which is
   * two keys in two objects and no shadowing at all. A guard that cries wolf on
   * the first healthy file it meets is a guard that gets switched off; the S
   * literal's own closing `};` at column zero is the honest boundary.
   */
  // The literal is `export const AR = {` / `export const EN = {` — verified
  // against the files, not guessed (the first anchor was guessed, found
  // nothing, and the guard reported itself unable to scan, which is at least
  // the honest failure).
  const open = src.indexOf(`export const ${name.toUpperCase()} = {`);
  const close = src.indexOf('\n};', open);
  if (open === -1 || close === -1) { failures.push(`${name}: cannot locate the ${name.toUpperCase()} literal — the dup-key guard has nothing to scan`); continue; }
  const body = src.slice(open, close);
  const seenKeys = new Map();
  for (const m of body.matchAll(/^  ([A-Za-z_$][\w$]*):/gm)) {
    const k = m[1];
    if (seenKeys.has(k)) failures.push(`${name}.S.${k} is defined twice — the second silently shadows the first`);
    else { seenKeys.set(k, 1); pass++; }
  }
}

const ARGS = { 1: [1], 2: ['July', 'the month'] };

/**
 * ——— THE LOOKUPS THAT MAY HONESTLY ANSWER NOTHING.
 *
 * A TEMPLATE must always render — an `undefined` mid-sentence is a blank line on
 * his screen, which is what the loop below exists to prevent. A LOOKUP is a
 * different animal: `notExpenseReason` maps the server's `not_expense_reason`
 * enum (06 §6) to a sentence, and returns `null` for a value it does not name so
 * the caller falls back to the generic body. That null is the contract, not a
 * hole — a server predating the field, or a reason added later, must not produce
 * an empty paragraph.
 *
 * So these are exempted from "always renders" and given a STRICTER pair of
 * checks instead: every value the contract names must produce real words, and an
 * unknown value must produce exactly `null`, because the caller's fallback is
 * unreachable otherwise. Exempting without replacing would be a check switched
 * off; this is a check made sharper.
 */
const NULLABLE_LOOKUPS = {
  /**
   * The three tiers `findLookalikes` can produce. `null` for anything else, so
   * the card renders nothing rather than an empty label — a lookup with no
   * answer says nothing, exactly like `notExpenseReason`. One convention for
   * both; two would be the second quieter implementation this project keeps
   * paying for.
   */
  dupTier: {
    named: ['same', 'similar', 'different'],
    nulls: ['not_a_tier', undefined, null, ''],
  },
  notExpenseReason: {
    // 'other' is deliberately absent: the enum carries it, and it means "no
    // more specific reason", which is exactly when the generic body is right.
    named: ['balance_screen', 'pending_or_declined', 'incoming', 'menu_or_pricelist'],
    nulls: ['other', 'a_reason_invented_next_year', undefined, null, ''],
  },
  /**
   * The queue row's short form of the same enum (N1). Registered here rather
   * than exempted: the row label falls back to the generic «مش فاتورة» on null
   * exactly as the detail body falls back to its generic paragraph, so the null
   * is load-bearing in both and is checked in both.
   */
  jobNotExpense: {
    named: ['balance_screen', 'pending_or_declined', 'incoming', 'menu_or_pricelist'],
    nulls: ['other', 'a_reason_invented_next_year', undefined, null, ''],
  },
};
for (const [name, loc] of [['ar', AR_LOCALE], ['en', EN_LOCALE]]) {
  for (const k of Object.keys(loc.S)) {
    const v = loc.S[k];
    if (typeof v === 'string') { ok(v.length > 0, `${name}.${k} is not an empty string`); continue; }
    if (typeof v !== 'function') { failures.push(`${name}.${k} is neither a string nor a template`); continue; }
    const nullable = NULLABLE_LOOKUPS[k];
    if (nullable) {
      for (const value of nullable.named) {
        let s2; try { s2 = v(value); } catch { s2 = null; }
        ok(typeof s2 === 'string' && s2.length > 0 && !s2.includes('undefined'),
          `${name}.${k}('${value}') says something true in words`);
      }
      for (const value of nullable.nulls) {
        let s2; try { s2 = v(value); } catch { s2 = 'THREW'; }
        ok(s2 === null,
          `${name}.${k}(${JSON.stringify(value)}) is null, so the caller's fallback is reachable`);
      }
      continue;
    }
    let out;
    try { out = v(...(ARGS[v.length] || [1])); } catch (err) { out = null; }
    ok(typeof out === 'string' && out.length > 0 && !out.includes('undefined'),
      `${name}.${k}(…) renders a real string`);
  }
}

/**
 * ——————————————————————— NO ARABIC LEFT IN THE ENGLISH.
 * The way a translation goes half-done is a copy-paste that never got replaced,
 * and it is invisible to anyone reviewing in the other language.
 * (`switchTo` is exempt by design — the toggle is always labelled in the
 * language it switches TO, so the English locale's label is Arabic on purpose.)
 */
const ARABIC = /[؀-ۿ]/;
for (const k of enKeys) {
  const v = EN_LOCALE.S[k];
  const text = typeof v === 'function' ? v(...(ARGS[v.length] || [1])) : v;
  ok(!ARABIC.test(String(text)), `en.${k} carries no untranslated Arabic`);
}
ok(ARABIC.test(EN_LOCALE.switchTo), 'except the toggle label, which is Arabic ON PURPOSE in the English locale');
ok(!ARABIC.test(AR_LOCALE.switchTo), 'and English in the Arabic one — it always names where you are going');

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WHERE THE TOGGLE LIVES (finding S8 — mount RE-CUT by S1, never deleted).
 *
 * The journey: header (D16b) → footer (S8: the second most prominent control
 * on every screen, for a setting Dad changes exactly zero times) → the
 * Settings sheet behind the header's cog (S1, Owner ruling 2026-08-27).
 *
 * The REQUIREMENT is unchanged and is still what this block asserts: out of
 * the header, and reachable from every tab (SetupView only renders when there
 * are NO stored credentials, so its own toggle covers setup alone). What
 * changed is the position that satisfies it: the toggle lives in the sheet,
 * and the WAY IN — the cog — is the thing that must ride every screen.
 */
{
  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  let sheet = '';
  try { sheet = await readFile(new URL('../src/views/SettingsSheet.jsx', import.meta.url), 'utf8'); } catch { /* absent reads as '': the asserts below name it */ }
  const header = app.slice(app.indexOf('<header'), app.indexOf('</header>'));
  ok(header.length > 0, 'the header is findable in the source');
  ok(!/<LangToggle/.test(header), 'the language switch is NOT in the header any more');
  ok(/<LangToggle/.test(sheet), 'it lives in the Settings sheet now (S1) — behind the cog, not on every screen\'s footer');
  ok(!/<LangToggle|<CurrencyToggle/.test(app), 'and the shell mounts no stray toggle of its own — the declutter is real');
  /**
   * The WAY IN rides the header, which renders on every tab — and is NOT
   * behind a tab test: `{tab === 'summary' && <SettingsCog/>}` would satisfy
   * the line above and strand him on the Inbox with no way to switch.
   */
  ok(/<SettingsCog/.test(header) && !/tab === '[a-z]+' &&\s*<SettingsCog/.test(app),
    'the cog is in the header and not gated on one tab — that would strand him wherever he happens to be');
}

// ——————————————————————— the locale envelope
for (const [name, loc] of [['ar', AR_LOCALE], ['en', EN_LOCALE]]) {
  eq(loc.WEEK_DAYS.length, 7, `${name}: seven weekday labels`);
  eq(loc.MONTH_LABELS.length, 12, `${name}: twelve month labels`);
  ok(typeof loc.CAPTAIN_INITIALS === 'string' && loc.CAPTAIN_INITIALS.length > 0, `${name}: the captain has initials`);
  eq(typeof loc.monthName, 'function', `${name}: month names are looked up`);
  eq(typeof loc.monthByTab, 'function', `${name}: and so are tab names`);
  // Opaque in, readable out — and an unrecognised tab renders as ITSELF.
  eq(loc.monthByTab('Q1'), 'Q1', `${name}: an unrecognised tab renders as itself, never blank`);
  eq(loc.monthByTab(null), '', `${name}: and a missing one does not become "null"`);
  eq(loc.monthName(''), '', `${name}: an empty month name stays empty`);
}
eq(AR_LOCALE.dir, 'rtl', 'Arabic is right-to-left');
eq(EN_LOCALE.dir, 'ltr', 'English is left-to-right');
eq(AR_LOCALE.monthByTab('Jul'), 'يوليو', 'Jul reads as يوليو');
eq(EN_LOCALE.monthByTab('Jul'), 'July', 'and as July');
ok(AR_LOCALE.CAPTAIN_INITIALS !== EN_LOCALE.CAPTAIN_INITIALS, 'the initials are written in each language');

/**
 * ——————————————————————— ARABIC IS THE DEFAULT, and it is a law.
 * Every path that could quietly hand an English UI to a man who reads Arabic.
 */
eq(getLang(store(null)), 'ar', 'an install that has never chosen speaks Arabic');
eq(getLang(store(undefined)), 'ar', 'and so does one whose storage was cleared');
eq(getLang(store('fr')), 'ar', 'a value we do not recognise is Arabic, not a guess');
eq(getLang(store('')), 'ar', 'an empty value is Arabic');
eq(getLang({ getItem() { throw new Error('denied'); } }), 'ar',
  'and storage that throws is Arabic — private mode must not switch his language');
eq(getLang(store('en')), 'en', 'but an install that DID choose English gets English');
eq(LANGS.join(','), 'ar,en', 'there are exactly two languages, Arabic first');

{
  const s = store(null);
  eq(setLang('en', s), 'en', 'choosing English is honoured');
  eq(getLang(s), 'en', 'and it persists');
  eq(setLang('klingon', s), 'ar', 'choosing nonsense falls back to Arabic…');
  eq(getLang(s), 'ar', '…and persists THAT, rather than leaving the old value');
}
eq(otherLang('ar'), 'en', 'the toggle offers English from Arabic');
eq(otherLang('en'), 'ar', 'and Arabic from English');

// ——————————————————————— the document is told, so direction is set before paint
{
  const el = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
  applyDocumentLang(EN_LOCALE, { documentElement: el });
  eq(el.attrs.dir, 'ltr', 'English sets the document LTR');
  eq(el.attrs.lang, 'en', 'and names the language, for the screen reader');
  applyDocumentLang(AR_LOCALE, { documentElement: el });
  eq(el.attrs.dir, 'rtl', 'Arabic sets it back to RTL');
  eq(el.attrs.lang, 'ar', 'and says so');
  applyDocumentLang(AR_LOCALE, null);
  pass++;   // reaching here is the assertion: no document, no crash
}

const report = failures.length
  ? `❌ ${failures.length} / ${pass + failures.length} i18n checks failed:\n  - ${failures.join('\n  - ')}`
  : `✅ all ${pass} i18n checks passed`;
console.log(report);
process.exit(failures.length ? 1 : 0);
