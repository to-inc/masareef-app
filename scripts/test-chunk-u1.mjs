#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK U1 ═══════════   `node scripts/test-chunk-u1.mjs`
 *
 * «A booked row can be FIXED: the Book list's opened row offers an edit door
 *  (gated on the server advertising `edit_entry`, fail closed), the door opens
 *  a B4 Sheet editing method — the Owner's VR case: a 22.9 EUR pool entry
 *  booked Cash that was really Card — plus amount, currency, description and
 *  date; the wire is §3.7's `edit_entry` with tab + match + edits and NO
 *  fabricated identity (a Book row has no rowHint and no sourceHash — §2.4
 *  carries neither, and absence is sent as absence, never invented); a stale
 *  answer renders the SERVER's truth in the conflict grammar; a refused date
 *  that would leave the tab renders its refusal in words; offline renders a
 *  live retry, never a queued claim the shell cannot honour; and the mock
 *  serves `edit_entry` DEFAULT ON, transcribed from Code.gs — the deployed
 *  20260825-1463 dispatches and advertises the verb.»
 *  (chunk-ledger U1; Owner field ruling 2026-08-27 second message; 06 §3.7
 *  BINDING, §2.4 for what the client actually holds.)
 *
 * WHY OFFLINE IS A RETRY AND NOT A QUEUE — pinned, not preferred: App.jsx's
 * `sendQueued` routes manual / fix_category / receipt_confirm and resolves any
 * OTHER kind `{ok:true}`, which `flush` treats as sent and REMOVES — so an
 * enqueued `edit_entry` would be silently dropped as a success. App.jsx is out
 * of this leaf's OWNS; until the shell can replay the kind, claiming «هيتسجّل
 * أول ما النت يرجع» would be a promise nothing keeps. The tripwire below
 * reddens the day App.jsx learns the verb, so the grammar is revisited then.
 *
 * Guarded lookups throughout — a red test that DIES is not a red test (the
 * twice-in-one-afternoon law); a missing key or module is a NAMED failure.
 */
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { AR } from '../src/i18n/strings.ar.js';
import { EN } from '../src/i18n/strings.en.js';
import { TAP } from '../src/theme.js';
import { cardKey } from '../src/state/inboxOutcomes.js';
import * as mock from '../src/api/mock.js';

const MARKER = 'CHUNK-U1-GREEN';

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };
const eq = (a, b, label) => ok(Object.is(a, b),
  `${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const text = (html) => String(html).replace(/<[^>]+>/g, ' ')
  .replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ');
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Guarded key read — a missing key answers null and fails by NAME, never by death. */
const kw = (L, key, ...args) => {
  const v = L && L[key];
  if (typeof v === 'string') return v;
  if (typeof v === 'function') { try { return v(...args); } catch { return null; } }
  return null;
};
/** The <button …> attributes in front of a given label — for disabled checks. */
const buttonAttrs = (html, label) => {
  if (!label) return null;
  const m = new RegExp(`<button([^>]*)>(?:(?!</button>)[\\s\\S]){0,80}?${escapeRe(label)}`).exec(html);
  return m ? m[1] : null;
};

// ——— controls: the detectors prove themselves on seeded input first.
{
  ok(buttonAttrs('<button disabled="" style="x">حفظ</button>', 'حفظ') !== null
    && /disabled/.test(buttonAttrs('<button disabled="" style="x">حفظ</button>', 'حفظ')),
    'control — the button-attrs detector finds a disabled button');
  ok(!/disabled/.test(buttonAttrs('<button style="x"><span>✓</span>حفظ</button>', 'حفظ') || 'disabled'),
    'control — and reads an enabled one as enabled through nested tags');
}

/* ═══════════ the vocabulary exists, both locales, before anything renders ═══ */
for (const [name, L] of [['ar', AR], ['en', EN]]) {
  for (const key of ['editOpen', 'editRowTitle', 'editDescription', 'editSave', 'editNothingChanged',
    'editDone', 'editConflict', 'editConflictUse', 'editRefused', 'editNotFound', 'editOffline',
    'editBadAmount', 'editBadDate', 'editNeedCurrency', 'dupNeedsEngine']) {
    ok(typeof kw(L, key) === 'string' && kw(L, key).length > 0,
      `U1.k [${name}] locale carries «${key}» — the edit sheet cannot speak without it`);
  }
  ok(typeof kw(L, 'editDateLeavesMonth', 'أغسطس') === 'string' && kw(L, 'editDateLeavesMonth', 'أغسطس').includes('أغسطس'),
    `U1.k [${name}] editDateLeavesMonth NAMES the month it protects — a refusal must name the thing that is wrong`);
}

/* ═══════════ mockEditEntry — §3.7 transcribed from Code.gs, DEFAULT ON ═══ */
{
  ok(typeof mock.mockEditEntry === 'function',
    'mock serves mockEditEntry — the deployed 20260825-1463 dispatches edit_entry, so the mock must too (mock-parity law)');
  ok(typeof mock.mockEditEntryOn === 'function',
    'and exports the transcription for direct call — unreachable branches are exercised the way mockHomeAggIn is');
  ok(typeof mock._resetMockEdits === 'function', 'with a test seam to clear the session edits');

  if (typeof mock.mockEditEntryOn === 'function') {
    const ym = { y: 2026, m: 8 };
    const row = (over = {}) => ({
      date: '11/8/2026', description: 'Allas Sea Pool', method: 'Cash',
      category: 'Leisure', amount: 22.9, currency: 'EUR', ...over,
    });
    const body = (over = {}) => ({
      tab: 'Aug', match: row(), edits: { method: 'Visa' }, ...over,
    });
    const on = (rows, b) => mock.mockEditEntryOn(rows, b, ym);

    // ——— the VR case itself: method Cash → Visa on a booked euro row.
    const vr = on([row()], body());
    eq(vr.ok, true, 'U1.m1 the VR fix lands — a booked Cash row becomes Card');
    eq(vr.entry && vr.entry.method, 'Visa', 'U1.m2 the returned entry is the post-edit snapshot');
    eq(vr.entry && vr.entry.category, 'Leisure', 'U1.m3 category is untouched — fix_category owns that cell (§3.7)');
    eq(vr.entry && vr.entry.amount, 22.9, 'U1.m4 and the money is exactly what it was');
    eq(vr.row, 2, 'U1.m5 the row number is sheet-addressed (header offset), as the server answers');

    // ——— rowHint fast path takes the named row among twins.
    const twins = [row(), row()];
    const hinted = on(twins, body({ rowHint: 3 }));
    eq(hinted.ok, true, 'U1.m6 a valid rowHint addresses its exact row');
    eq(hinted.row, 3, 'U1.m7 …the SECOND twin, not the first — position is identity when it is real');

    // ——— optimistic concurrency: a stale-method claim answers row_changed
    // with truth (§3.7's own first TEST obligation — the edit retires the
    // method from the scan, the surviving fields find the one row, and the
    // claim «change Cash to Visa» meets a row that is already Visa).
    const moved = on([row({ method: 'Visa' })], body());
    eq(moved.ok, false, 'U1.m8 a stale match writes NOTHING');
    eq(moved.error, 'row_changed', 'U1.m9 …and answers row_changed');
    eq(moved.current && moved.current.method, 'Visa',
      'U1.m10 …carrying the SHEET’s current snapshot — the server’s truth, for the client to render');

    // ——— the relaxed scan refuses to guess between changed twins.
    const changedTwins = on([row({ method: 'Visa' }), row({ method: 'Visa' })], body());
    eq(changedTwins.error, 'row_not_found',
      'U1.m11 two candidate twins under a stale match → row_not_found — never an arbitrary row (Code.gs editLocate_ hardening)');

    // ——— bad_edit, every named refusal, before any location.
    eq(on([row()], body({ edits: {} })).error, 'bad_edit', 'U1.m12 an edit that edits nothing is a client bug surfaced');
    eq(on([row()], body({ edits: { category: 'Car' } })).error, 'bad_edit', 'U1.m13 category is not an editable key here');
    eq(on([row()], body({ edits: { method: 'Mastercard' } })).error, 'bad_edit', 'U1.m14 method is raw membership — never coerced at an edit boundary');
    eq(on([row()], body({ edits: { amount: 0 } })).error, 'bad_edit', 'U1.m15 zero is not an amount');
    eq(on([row()], body({ edits: { amount: 1000000 } })).error, 'bad_edit', 'U1.m16 and neither is a million');
    eq(on([row()], body({ edits: { currency: 'EURO' } })).error, 'bad_edit', 'U1.m17 an unknown currency is refused, never folded to EGP');
    eq(on([row()], body({ edits: { description: '   ' } })).error, 'bad_edit', 'U1.m18 a blank description would make the row unaddressable forever');
    eq(on([row()], body({ edits: { description: '=SUM(E2:E9)' } })).error, 'bad_edit', 'U1.m19 a leading = is a live formula in real Sheets — refused');
    eq(on([row()], body({ edits: { date: '30/7/2026' } })).error, 'bad_edit',
      'U1.m20 a date that leaves the tab is REFUSED — a move is append+delete and the backend has no delete');
    eq(on([row()], body({ edits: { currency: 'EGP' }, match: (() => { const m = row(); delete m.currency; return m; })() })).error,
      'bad_edit', 'U1.m21 an edited key with no match counterpart is a claim the client did not make');

    // ——— Arabic-Indic amounts normalize exactly as the server normalizes.
    const arabicAmount = on([row()], body({ edits: { amount: '٢٥' } }));
    eq(arabicAmount.ok, true, 'U1.m22 «٢٥» is heard…');
    eq(arabicAmount.entry && arabicAmount.entry.amount, 25, 'U1.m23 …as 25, the sheet’s own digits');

    // ——— the one-cell guard: amount and currency are ONE cell.
    const unpriced = row({ amount: null, currency: null });
    eq(on([unpriced], { tab: 'Aug', match: unpriced, edits: { amount: 150 } }).error, 'bad_edit',
      'U1.m24 an amount on an unpriced row with no currency riding along → bad_edit (silent-EGP prevention)');
    eq(on([unpriced], { tab: 'Aug', match: unpriced, edits: { currency: 'SEK' } }).error, 'bad_edit',
      'U1.m25 …and its mirror: a currency with no amount would write «null SEK»');
    const priced = on([unpriced], { tab: 'Aug', match: unpriced, edits: { amount: 150, currency: 'SEK' } });
    eq(priced.ok, true, 'U1.m26 both together price the row');
    eq(priced.entry && priced.entry.currency, 'SEK', 'U1.m27 …in the currency he named');

    eq(on([], body()).error, 'row_not_found', 'U1.m28 an empty month has no row to find');
  }

  // ——— the WIRED door persists edits, so a replay meets real concurrency.
  if (typeof mock.mockEditEntry === 'function' && typeof mock._resetMockEdits === 'function') {
    mock._resetMockEdits();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date());
    const get = (t) => Number(today.find((x) => x.type === t).value);
    const m = get('month'); const y = get('year');
    const TAB = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1];
    const nile = { date: `2/${m}/${y}`, description: 'Nile Star Market', method: 'Visa', category: 'Groceries', amount: 612, currency: 'EGP' };
    const first = await mock.mockEditEntry({ tab: TAB, match: nile, edits: { method: 'Cash' } });
    eq(first && first.ok, true, 'U1.m29 the wired mock edits the month the book actually serves');
    eq(first && first.entry && first.entry.method, 'Cash', 'U1.m30 …and answers the re-read row');
    const replay = await mock.mockEditEntry({ tab: TAB, match: nile, edits: { method: 'Cash' } });
    eq(replay && replay.error, 'row_changed',
      'U1.m31 replaying the same claim meets the EDITED sheet — row_changed, exactly as the real service would answer');
    eq(replay && replay.current && replay.current.method, 'Cash', 'U1.m32 …with the current truth attached');
    const badTab = await mock.mockEditEntry({ tab: 'Q1', match: nile, edits: { method: 'Cash' } });
    eq(badTab && badTab.error, 'row_not_found', 'U1.m33 an unknown tab is row_not_found, never a crash');
    mock._resetMockEdits();
  }
}

/* ═══════════ renders — the sheet, the door, both locales ═══════════ */
async function sweep(lang, L) {
  globalThis.localStorage = { getItem: () => lang, setItem() {} };
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  try {
    let ES = null;
    try { ES = await vite.ssrLoadModule('/src/views/EditSheet.jsx'); } catch (err) {
      failures.push(`[${lang}] EditSheet.jsx cannot load — ${err && err.message && err.message.slice(0, 120)}`);
    }

    // ——— the pure halves the taps ride on.
    if (ES && typeof ES.editsBetween === 'function') {
      const match = { date: '11/8/2026', description: 'Allas Sea Pool', method: 'Cash', category: 'Leisure', amount: 22.9, currency: 'EUR' };
      const same = ES.editsBetween(match, { method: 'Cash', amount: '22.9', currency: 'EUR', description: 'Allas Sea Pool', date: '11/8/2026' });
      eq(Object.keys(same.edits).length, 0,
        `U1.p1 [${lang}] an untouched draft builds NO edits — a no-op edit is a client bug the server refuses, so it is never sent`);
      eq(ES.editsBetween(match, { method: 'Visa' }).edits.method, 'Visa',
        `U1.p2 [${lang}] the VR case is one key: method`);
      eq(ES.editsBetween(match, { amount: '٢٥' }).edits.amount, 25,
        `U1.p3 [${lang}] Arabic-Indic amounts normalize before the wire (CLAUDE.md #6)`);
      eq(ES.editsBetween(match, { description: '  Allas Sea Pool  ' }).edits.description, undefined,
        `U1.p4 [${lang}] whitespace is not a change`);
      ok(ES.editsBetween(match, { amount: 'abc' }).invalid.indexOf('amount') !== -1,
        `U1.p5 [${lang}] an unreadable amount is NAMED invalid — never silently dropped from the send`);
      ok(ES.editsBetween(match, { date: '32/13/2026' }).invalid.indexOf('date') !== -1,
        `U1.p6 [${lang}] and so is an unreadable date`);
      eq(ES.dateLeavesMonth('11/8/2026', '30/7/2026'), true,
        `U1.p7 [${lang}] a date into another month is recognised as leaving the tab`);
      eq(ES.dateLeavesMonth('11/8/2026', '12/8/2026'), false,
        `U1.p8 [${lang}] a same-month date is not`);
      eq(ES.dateLeavesMonth('221', '12/8/2026'), false,
        `U1.p9 [${lang}] an unreadable row date makes no local claim — the server judges (§3.7)`);

      const wire = ES.editWirePayload({ tab: 'Aug', rowHint: '11/8/2026|22.9', match }, { method: 'Visa' });
      eq(Object.keys(wire).sort().join(','), 'edits,match,tab',
        `U1.p10 [${lang}] the wire payload is tab+match+edits EXACTLY — §3.7 with what §2.4 actually hands the client`);
      ok(!('rowHint' in wire),
        `U1.p11 [${lang}] the local settle key never reaches the wire — a fabricated position is worse than none (fixPayload's law)`);

      eq(ES.outcomeForEdit({ ok: true, entry: { method: 'Visa' } }, false).status, 'done',
        `U1.p12 [${lang}] ok:true is done`);
      eq(ES.outcomeForEdit({ ok: 'yes' }, false).status, 'failed',
        `U1.p13 [${lang}] a truthy-but-not-true ok is NOT a success (outcomeFor's own strictness)`);
      const conf = ES.outcomeForEdit({ ok: false, error: 'row_changed', current: { method: 'Visa' } }, false);
      eq(conf.status, 'conflict', `U1.p14 [${lang}] row_changed is a conflict…`);
      eq(conf.current && conf.current.method, 'Visa', `U1.p15 [${lang}] …carrying the server's truth to render`);
      eq(ES.outcomeForEdit({ ok: false, error: 'bad_edit' }, false).status, 'refused',
        `U1.p16 [${lang}] bad_edit renders as a refusal, never a silent drop`);
      eq(ES.outcomeForEdit({ ok: false, error: 'row_not_found' }, false).status, 'notfound',
        `U1.p17 [${lang}] row_not_found has its own sentence`);
      eq(ES.outcomeForEdit({ ok: false, error: 'unknown_action' }, false).status, 'engine',
        `U1.p18 [${lang}] a server without the verb is the engine-needs-update state, not a generic failure`);
      eq(ES.outcomeForEdit(undefined, true).status, 'offline',
        `U1.p19 [${lang}] a transport throw is OFFLINE — a live retry, never a queued claim the shell cannot replay`);
    } else if (ES) {
      failures.push(`[${lang}] EditSheet exports no editsBetween — the pure half is missing`);
    }

    // ——— the sheet itself, on the Owner's VR row.
    if (ES && ES.default) {
      const item = {
        tab: 'Aug', rowHint: '11/8/2026|22.9',
        match: { date: '11/8/2026', description: 'Allas Sea Pool', method: 'Cash', category: 'Leisure', amount: 22.9, currency: 'EUR' },
      };
      const sheet = (props = {}) => {
        try {
          return renderToStaticMarkup(createElement(ES.default, { item, onClose: () => {}, ...props }));
        } catch (err) { failures.push(`[${lang}] EditSheet THREW — ${err && err.message}`); return ''; }
      };

      const base = sheet();
      const t0 = text(base);
      ok(t0.includes(kw(L, 'editRowTitle') || '∅'), `U1.r1 [${lang}] the sheet says what it is`);
      ok(base.includes('sheet-in'), `U1.r2 [${lang}] and it is a B4 Sheet — the one primitive, entrance and lip included`);
      ok(t0.includes(kw(L, 'methodCash') || '∅') && t0.includes(kw(L, 'methodCard') || '∅'),
        `U1.r3 [${lang}] BOTH method words are on screen — the headline case is a choice, not a toggle he must decode`);
      ok(/aria-pressed="true"/.test(buttonAttrs(base, kw(L, 'methodCash') || '∅') || ''),
        `U1.r4 [${lang}] the row's own method reads as pressed — the sheet starts from the truth`);
      {
        const mi = base.indexOf(kw(L, 'methodCash') || '∅');
        const ai = base.indexOf(kw(L, 'receiptAmount') || '∅');
        ok(mi !== -1 && ai !== -1 && mi < ai,
          `U1.r5 [${lang}] METHOD LEADS — the Owner's case is the first field, amount and the rest follow`);
      }
      ok(base.includes('value="22.9"'), `U1.r6 [${lang}] the amount field holds the row's own figure`);
      ok(base.includes('Allas Sea Pool'), `U1.r7 [${lang}] and the description its words`);
      ok(base.includes('value="11/8/2026"'), `U1.r8 [${lang}] and the date its day`);
      {
        const attrs = buttonAttrs(base, kw(L, 'editSave') || '∅');
        ok(attrs !== null && /disabled/.test(attrs || ''),
          `U1.r9 [${lang}] with nothing changed the save is disabled…`);
        ok(t0.includes(kw(L, 'editNothingChanged') || '∅'),
          `U1.r10 [${lang}] …and SAYS why — a dead button with no sentence is a mystery, not a state`);
        ok(attrs !== null && /min-height:(4[8-9]|[5-9][0-9])px/.test(attrs || ''),
          `U1.r11 [${lang}] the save sits at or above the senior tap floor (≥48)`);
      }

      const armed = sheet({ initialDraft: { method: 'Visa' } });
      ok(!/disabled/.test(buttonAttrs(armed, kw(L, 'editSave') || '∅') || 'disabled'),
        `U1.r12 [${lang}] one changed field arms the save`);

      const leaves = sheet({ initialDraft: { date: '30/7/2026' } });
      const leavesWords = kw(L, 'editDateLeavesMonth', (lang === 'ar' ? 'أغسطس' : 'August'));
      ok(!!leavesWords && text(leaves).includes(leavesWords),
        `U1.r13 [${lang}] a date that leaves the tab renders its refusal IN WORDS, naming the month — never a silent drop`);
      ok(/disabled/.test(buttonAttrs(leaves, kw(L, 'editSave') || '∅') || ''),
        `U1.r14 [${lang}] …and the save stands down while the claim is unsendable`);

      const conflict = sheet({
        initialStatus: {
          status: 'conflict',
          current: { date: '11/8/2026', description: 'Allas Sea Pool', method: 'Visa', category: 'Leisure', amount: 22.9, currency: 'EUR' },
        },
      });
      const tC = text(conflict);
      ok(tC.includes(kw(L, 'editConflict') || '∅'),
        `U1.r15 [${lang}] row_changed renders the conflict grammar…`);
      ok(tC.includes(kw(L, 'cardConflictIs') || '∅') && tC.includes(kw(L, 'metricVisa') || '∅'),
        `U1.r16 [${lang}] …WITH the server's truth on screen — «now:» and the sheet's own method`);
      ok(tC.includes(kw(L, 'editConflictUse') || '∅'),
        `U1.r17 [${lang}] …and a way to argue from the seen state — adopt the sheet's row, then re-edit`);

      ok(text(sheet({ initialStatus: { status: 'refused' } })).includes(kw(L, 'editRefused') || '∅'),
        `U1.r18 [${lang}] bad_edit renders its refusal`);
      ok(text(sheet({ initialStatus: { status: 'notfound' } })).includes(kw(L, 'editNotFound') || '∅'),
        `U1.r19 [${lang}] row_not_found renders its own sentence`);
      {
        const off = sheet({ initialStatus: { status: 'offline' } });
        ok(text(off).includes(kw(L, 'editOffline') || '∅'),
          `U1.r20 [${lang}] offline says the change did NOT reach the sheet…`);
        ok(off.includes('value="22.9"'),
          `U1.r21 [${lang}] …and keeps his work on screen for the retry — a live state, not a queued promise`);
      }
      ok(text(sheet({ initialStatus: { status: 'done', entry: { ...item.match, method: 'Visa' } } })).includes(kw(L, 'editDone') || '∅'),
        `U1.r22 [${lang}] done says done — after the server did`);
      ok(text(sheet({ initialStatus: { status: 'engine' } })).includes(kw(L, 'dupNeedsEngine') || '∅'),
        `U1.r23 [${lang}] a verb the server lost renders the engine-needs-update state (the voice door's grammar)`);
    } else if (ES) {
      failures.push(`[${lang}] EditSheet has no default export to render`);
    }

    // ——— the DOOR in the Book: present when advertised, absent when not.
    {
      const BV = await vite.ssrLoadModule('/src/views/BookView.jsx');
      const row = { date: '17/8/2026', description: 'Nile Star Market', method: 'Cash', category: 'Groceries', amount: 100, currency: 'EGP' };
      const payload = {
        today_cairo: { y: 2026, m: 8, d: 17 },
        today: { entries: [row], totals: { Visa: 0, Cash: 100 } },
        week: { cur: { Visa: [1], Cash: [1] }, prev: { Visa: [1], Cash: [1] } },
        month: { cur: { Visa: [1], Cash: [1] }, prev: { Visa: [1], Cash: [1] }, names: { cur: 'August', prev: 'July' } },
        year: { cur: { Visa: [1], Cash: [1] }, prev: { Visa: [1], Cash: [1] } },
        monthCats: [], pending: [],
      };
      const openKey = `${cardKey({ tab: 'August', rowHint: '17/8/2026|100', match: row })}:0`;
      const render = (props = {}) => {
        try {
          return renderToStaticMarkup(createElement(BV.default, { data: payload, onEdit: () => {}, ...props }));
        } catch (err) { failures.push(`[${lang}] BookView THREW — ${err && err.message}`); return ''; }
      };
      const doorWord = kw(L, 'editOpen') || '∅';
      const withDoor = render({ build: { actions: ['edit_entry'] }, initialOpenKey: openKey });
      ok(text(withDoor).includes(doorWord),
        `U1.r24 [${lang}] the opened row offers the edit door when the server advertises edit_entry`);
      {
        const attrs = buttonAttrs(withDoor, doorWord);
        ok(attrs !== null && /min-height:48px/.test(attrs || ''),
          `U1.r25 [${lang}] …at the senior tap floor`);
      }
      ok(!text(render({ initialOpenKey: openKey })).includes(doorWord),
        `U1.r26 [${lang}] with NO advertisement the door is absent — fail closed, the dictation button's own law`);
      ok(!text(render({ build: { actions: ['edit_entry'] } })).includes(doorWord),
        `U1.r27 [${lang}] and a closed row shows no door — it lives in the row he opened`);
    }

    // ——— the mock advertises what the deployed server advertises.
    {
      const api = await vite.ssrLoadModule('/src/api/index.js');
      ok(Array.isArray(api.MOCK_ACTIONS) && api.MOCK_ACTIONS.indexOf('edit_entry') !== -1,
        `U1.w1 [${lang}] MOCK_ACTIONS carries edit_entry — 20260825-1463 dispatches AND advertises it; a mock hiding a shipped verb is the V17 class`);
      const ping = await api.ping();
      ok(ping && ping.build && Array.isArray(ping.build.actions) && ping.build.actions.indexOf('edit_entry') !== -1,
        `U1.w2 [${lang}] …and ping serves it, which is what lights the door`);
      ok(typeof api.editEntry === 'function', `U1.w3 [${lang}] the api seam exports editEntry`);
    }
  } finally {
    await vite.close();
  }
}

await sweep('ar', AR);
await sweep('en', EN);

/* ═══════════ source pins ═══════════ */
{
  let es = '';
  try { es = await readFile(new URL('../src/views/EditSheet.jsx', import.meta.url), 'utf8'); } catch { /* named below */ }
  ok(es.length > 0, 'U1.s1 EditSheet.jsx exists');
  ok(/\bSheet\b[^\n]*from '\.\.\/components\/Primitives\.jsx'/.test(es) && /<Sheet\b/.test(es),
    'U1.s2 the sheet is THE Sheet — B4’s one primitive, never a hand-rolled entrance');
  ok(!/@keyframes/.test(es),
    'U1.s3 …and it authors no motion of its own (MOTION rides the primitive, reduced-motion guard included)');
  ok(!/state\/outbox\.js/.test(es),
    'U1.s4 EditSheet never enqueues — App.jsx’s sendQueued would drop an unknown kind as ok:true, a silent loss wearing a ✓');
  ok(new RegExp(`minHeight: TAP`).test(es),
    'U1.s5 its controls ride the TAP token');

  const api = await readFile(new URL('../src/api/index.js', import.meta.url), 'utf8');
  ok(/action: 'edit_entry'/.test(api) && /mockEditEntry/.test(api),
    'U1.s6 api/index.js routes edit_entry — mock by default, the live door behind USING_MOCK');

  const bv = await readFile(new URL('../src/views/BookView.jsx', import.meta.url), 'utf8');
  ok(/supportsAction\(build, 'edit_entry'\)/.test(bv),
    'U1.s7 the Book gates the door on the capability advertisement, by name');
  ok(/from '\.\/EditSheet\.jsx'/.test(bv), 'U1.s8 and mounts the one EditSheet');

  const app = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  ok(!/edit_entry/.test(app),
    'U1.s9 TRIPWIRE — the shell still has no edit_entry replay route; the day this reddens, revisit EditSheet’s offline grammar (queued honesty becomes possible)');
}

if (failures.length) {
  console.log(`❌ CHUNK U1 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · a booked row opens a B4 edit sheet — method first, §3.7 on the wire, conflicts and refusals rendered as the server's truth`);
