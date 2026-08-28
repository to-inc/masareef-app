#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK U4 ═══════════   `node scripts/test-chunk-u4.mjs`
 *
 * «The Inbox surfaces duplicate PAIRS from the detector the app already has —
 *  both rows fully legible (date · method · amount · words), differences
 *  prominent, ONE decision resolves the pair and the counterpart ALWAYS
 *  survives («keep this» and «remove that» are the same decision from
 *  opposite ends — the Owner's exact logic). The gesture is an affordance;
 *  BUTTONS exist beside it at the senior floor. «Remove» is §3.9's
 *  `remove_entry` — NOT deployed: the affordance is capability-gated fail
 *  closed, an unknown_action answer renders the honest engine-needs-update
 *  state (the voice door's own era), and the mock serves the §3.9
 *  transcription behind MOCK_HAS_REMOVE_ENTRY=false, its flag-on branch
 *  exercised by direct import.»
 *  (chunk-ledger U4; Owner field ruling 2026-08-27; 06 §3.9 BINDING.)
 *
 * WHERE PAIRS COME FROM — pinned, not re-invented: `findLookalikes` in
 * state/duplicates.js, the ONE detector (test-duplicates owns its semantics).
 * Its population HERE is the Inbox's own `pending[]` — the rows that carry a
 * server-authored tab + rowHint, which is the identity §3.9's guard needs.
 * Booked non-pending rows keep the Book's report-only card (test-book pins it
 * button-free); widening the actionable population is a named residual, not a
 * quiet loosening. Groups of 3+ are LEGIBLE but not pairwise-actionable —
 * §3.9 resolves PAIRS; an arbitrary pair inside a trio would be a guess.
 */
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { AR } from '../src/i18n/strings.ar.js';
import { EN } from '../src/i18n/strings.en.js';
import * as mock from '../src/api/mock.js';

const MARKER = 'CHUNK-U4-GREEN';

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };
const eq = (a, b, label) => ok(Object.is(a, b),
  `${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const text = (html) => String(html).replace(/<[^>]+>/g, ' ')
  .replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ');
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const count = (t, needle) => (needle ? String(t).split(needle).length - 1 : 0);
const kw = (L, key, ...args) => {
  const v = L && L[key];
  if (typeof v === 'string') return v;
  if (typeof v === 'function') { try { return v(...args); } catch { return null; } }
  return null;
};

/* ═══════════ the vocabulary, both locales ═══════════ */
for (const [name, L] of [['ar', AR], ['en', EN]]) {
  for (const key of ['dupPairTitle', 'dupPairBody', 'dupPairRemove', 'dupPairRemoved',
    'dupPairSurvives', 'dupPairFailed', 'dupPairGone', 'dupNeedsEngine']) {
    ok(typeof kw(L, key) === 'string' && kw(L, key).length > 0,
      `U4.k [${name}] locale carries «${key}»`);
  }
  ok(typeof kw(L, 'dupGroupBig', 3) === 'string' && kw(L, 'dupGroupBig', 3).includes('3'),
    `U4.k [${name}] dupGroupBig counts the rows it declines to resolve`);
  // The Owner's clause, present in the words themselves: the other one STAYS.
  const survives = (kw(L, 'dupPairBody') || '') + ' ' + (kw(L, 'dupPairSurvives') || '');
  ok(name === 'ar' ? /فاضل|بيفضل|هيفضل/.test(survives) : /stays/.test(survives),
    `U4.k [${name}] the counterpart-survives clause is stated in words, not implied`);
  // The `u` flag is load-bearing: without it the class decomposes into
  // surrogate halves and matches EVERY emoji in the plane (🍵 included).
  ok(!/[🎉🎊✨🏆🔥]/u.test(Object.values(L).filter((v) => typeof v === 'string').join(' ')),
    `U4.k [${name}] no celebration glyphs anywhere — resolving a duplicate is bookkeeping, not a win (no gamification)`);
}

/* ═══════════ the mock — §3.9 transcribed, behind a flag shipping FALSE ═══ */
{
  const src = await readFile(new URL('../src/api/mock.js', import.meta.url), 'utf8');
  const executes = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  ok(/const MOCK_HAS_REMOVE_ENTRY = false;/.test(executes),
    'U4.m1 MOCK_HAS_REMOVE_ENTRY ships false — remove_entry is NOT on the deployed 20260825-1463, and the census sweep must see the flag');
  {
    const door = executes.slice(executes.indexOf('export function mockRemoveEntry('));
    ok(door.indexOf('MOCK_HAS_REMOVE_ENTRY') !== -1 && door.indexOf('mockRemoveEntryOn(') !== -1,
      'U4.m2 the wired door consults the flag and delegates to the ONE transcription — two removal semantics would be the two-normalisers hazard');
  }

  ok(Array.isArray(mock.MOCK_EXTRA_ACTIONS) && mock.MOCK_EXTRA_ACTIONS.indexOf('edit_entry') !== -1,
    'U4.m3 the deployed-parity amendment list carries edit_entry…');
  ok(Array.isArray(mock.MOCK_EXTRA_ACTIONS) && mock.MOCK_EXTRA_ACTIONS.indexOf('remove_entry') === -1,
    'U4.m4 …and NOT remove_entry while the flag ships false — the advertisement and the answer stay one fact');

  ok(typeof mock.mockRemoveEntry === 'function', 'U4.m5 mockRemoveEntry exists');
  if (typeof mock.mockRemoveEntry === 'function') {
    const refused = await mock.mockRemoveEntry({ tab: 'Aug', rowHint: 14, match: { date: '3/8/2026' } });
    eq(refused && refused.ok, false, 'U4.m6 default-off, the wired door refuses…');
    eq(refused && refused.error, 'unknown_action',
      'U4.m7 …with the deployed doPost’s EXACT sentence — the client must meet the state it will actually meet');
  }

  ok(typeof mock.mockRemoveEntryOn === 'function',
    'U4.m8 the §3.9 transcription is exported for direct call — the flag-on branch is exercised without flipping anything');
  if (typeof mock.mockRemoveEntryOn === 'function') {
    const row = (over = {}) => ({
      date: '3/8/2026', description: 'Allas Sea Pool', method: 'Cash',
      category: 'Leisure', amount: 163, currency: 'EUR', ...over,
    });
    const fresh = () => ({ removed: [], seen: new Map() });

    // ——— the pair's decision: remove ONE, by its server-authored position.
    {
      const state = fresh();
      const rows = [row(), row({ method: 'Visa' })];
      const res = mock.mockRemoveEntryOn(rows, { tab: 'Aug', rowHint: 3, match: row({ method: 'Visa' }) }, state);
      eq(res.ok, true, 'U4.m9 a hinted remove lands');
      eq(state.removed.length, 1, 'U4.m10 exactly ONE row moved to Removed');
      eq(state.removed[0] && state.removed[0].method, 'Visa', 'U4.m11 …the one he named');
      eq(state.removed[0] && state.removed[0].RemovedFrom, 'Aug',
        'U4.m12 …stamped RemovedFrom, §3.9’s own column');
      ok(state.removed[0] && typeof state.removed[0].RemovedAt === 'string' && state.removed[0].RemovedAt.length > 0,
        'U4.m13 …and RemovedAt — never vanished, recoverable by hand');
      eq(rows.length, 2, 'U4.m14 the transcription never mutates the caller’s rows — the wired book drops it, not the fixture');

      // ——— REPLAY IDEMPOTENT, the assertion that protects the counterpart:
      const replay = mock.mockRemoveEntryOn(rows, { tab: 'Aug', rowHint: 3, match: row({ method: 'Visa' }) }, state);
      eq(replay.ok, true, 'U4.m15 a replay is ok — a settled outcome, not an error');
      eq(replay.already, true, 'U4.m16 …and says it already happened');
      eq(state.removed.length, 1,
        'U4.m17 …and the COUNTERPART SURVIVES the replay — the twin is never taken by a retry');
    }

    // ——— stale answers row_changed with the sheet's truth; nothing moves.
    {
      const state = fresh();
      const res = mock.mockRemoveEntryOn([row({ method: 'Visa' })], { tab: 'Aug', match: row() }, state);
      eq(res.error, 'row_changed', 'U4.m18 a stale match refuses…');
      eq(res.current && res.current.method, 'Visa', 'U4.m19 …carrying the current snapshot');
      eq(state.removed.length, 0, 'U4.m20 …and removes nothing');
    }

    // ——— two full twins and no hint: REFUSE — never guess which to take.
    {
      const state = fresh();
      const res = mock.mockRemoveEntryOn([row(), row()], { tab: 'Aug', match: row() }, state);
      eq(res.error, 'row_not_found',
        'U4.m21 identical twins without a position are refused — the counterpart-survives law forbids guessing');
      eq(state.removed.length, 0, 'U4.m22 …so nothing moved');
    }

    eq(mock.mockRemoveEntryOn([], { tab: 'Aug', match: row() }, fresh()).error, 'row_not_found',
      'U4.m23 an empty month has nothing to remove');
  }
}

/* ═══════════ renders — the pairs surface, both locales ═══════════ */
async function sweep(lang, L) {
  globalThis.localStorage = { getItem: () => lang, setItem() {} };
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  try {
    const IV = await vite.ssrLoadModule('/src/views/InboxView.jsx');
    const { cardKey } = await vite.ssrLoadModule('/src/state/inboxOutcomes.js');

    const pendPair = () => ([
      {
        tab: 'Aug', rowHint: 14,
        match: { date: '3/8/2026', description: 'Allas Sea Pool', method: 'Cash', category: '❓', amount: 163, currency: 'EUR' },
        guess: null, stale: false,
      },
      {
        tab: 'Aug', rowHint: 22,
        match: { date: '3/8/2026', description: 'Allas Sea Pool', method: 'Visa', category: '❓', amount: 163, currency: 'EUR' },
        guess: null, stale: false,
      },
    ]);

    // ——— the pure projection: the ONE detector, read as pairs.
    if (typeof IV.pairsFrom === 'function') {
      const rep = IV.pairsFrom(pendPair());
      eq(rep.pairs.length, 1, `U4.p1 [${lang}] two alike pending rows are ONE pair`);
      eq(rep.pairs[0].items.length, 2, `U4.p2 [${lang}] …carrying both pending items whole`);
      eq(rep.pairs[0].items[0] && rep.pairs[0].items[0].rowHint, 14,
        `U4.p3 [${lang}] …with their server-authored positions — the identity §3.9’s guard needs`);
      eq(rep.pairs[0].tier, 'same', `U4.p4 [${lang}] the tier is the detector's own word`);

      const trio = pendPair().concat([{ ...pendPair()[0], rowHint: 30 }]);
      const rep3 = IV.pairsFrom(trio);
      eq(rep3.pairs.length, 0, `U4.p5 [${lang}] three alike rows are NOT a pair…`);
      eq(rep3.bigGroups.length, 1, `U4.p6 [${lang}] …they are a group named for the sheet — §3.9 resolves pairs, and an arbitrary pair inside a trio is a guess`);
      eq(rep3.bigGroups[0].count, 3, `U4.p7 [${lang}] …counted honestly`);

      const unpriced = [{ tab: 'Jul', rowHint: 41, match: { date: '22/7/2026', description: 'Hotel', method: 'Visa', category: '', amount: null, currency: null }, guess: null, stale: true },
        { tab: 'Jul', rowHint: 44, match: { date: '22/7/2026', description: 'Hotel', method: 'Visa', category: '', amount: null, currency: null }, guess: null, stale: true }];
      eq(IV.pairsFrom(unpriced).pairs.length, 0,
        `U4.p8 [${lang}] unpriced rows never pair — nothing to match on is not a match (twinKey's own rule)`);
      eq(IV.pairsFrom(unpriced).unpriced, 2, `U4.p9 [${lang}] …and they are counted as unexamined`);

      const diffs = IV.pairDiffs(pendPair()[0].match, pendPair()[1].match);
      ok(Array.isArray(diffs) && diffs.indexOf('method') !== -1,
        `U4.p10 [${lang}] the differing field is NAMED — method here, which is what the card makes prominent`);
      eq(IV.pairDiffs(pendPair()[0].match, pendPair()[0].match).length, 0,
        `U4.p11 [${lang}] identical rows differ nowhere`);
    } else {
      failures.push(`[${lang}] InboxView exports no pairsFrom`);
    }

    if (typeof IV.outcomeForRemove === 'function') {
      eq(IV.outcomeForRemove({ ok: true }, false).status, 'done', `U4.p12 [${lang}] ok:true resolves`);
      eq(IV.outcomeForRemove({ ok: 'yes' }, false).status, 'failed', `U4.p13 [${lang}] a truthy-but-not-true ok never does`);
      eq(IV.outcomeForRemove({ ok: false, error: 'unknown_action' }, false).status, 'engine',
        `U4.p14 [${lang}] unknown_action is the engine-needs-update state — the voice door's own era, rendered honestly`);
      const conf = IV.outcomeForRemove({ ok: false, error: 'row_changed', current: { method: 'Visa' } }, false);
      eq(conf.status, 'conflict', `U4.p15 [${lang}] row_changed is a conflict…`);
      eq(conf.current && conf.current.method, 'Visa', `U4.p16 [${lang}] …with the truth attached`);
      eq(IV.outcomeForRemove({ ok: false, error: 'row_not_found' }, false).status, 'gone',
        `U4.p17 [${lang}] row_not_found reads as already-gone`);
      eq(IV.outcomeForRemove(undefined, true).status, 'offline', `U4.p18 [${lang}] a throw is offline — a live retry`);
    } else {
      failures.push(`[${lang}] InboxView exports no outcomeForRemove`);
    }

    const render = (props = {}) => {
      try {
        return renderToStaticMarkup(createElement(IV.default, { pending: pendPair(), settled: {}, onConfirm: () => {}, ...props }));
      } catch (err) { failures.push(`[${lang}] InboxView THREW — ${err && err.message}`); return ''; }
    };
    const removeWord = kw(L, 'dupPairRemove') || '∅';

    // The pair CARD's own region: from its section label to the first
    // ordinary pending card — the same rows legitimately render again below
    // as category cards, and counting those would count the wrong surface.
    const pairSegment = (html) => {
      const from = html.indexOf(kw(L, 'dupPairTitle') || '∅');
      if (from === -1) return '';
      const cut = html.indexOf('card-in', from);
      return cut === -1 ? html.slice(from) : html.slice(from, cut);
    };

    // ——— the pair, with the capability: both rows legible, one decision.
    {
      const html = render({ build: { actions: ['remove_entry'] } });
      const t = text(html);
      const seg = text(pairSegment(html));
      ok(t.includes(kw(L, 'dupPairTitle') || '∅'), `U4.r1 [${lang}] the pairs surface announces itself`);
      ok(seg.includes(kw(L, 'dupPairBody') || '∅'),
        `U4.r2 [${lang}] …and states the Owner's rule: choose one, the other stays`);
      ok(seg.includes(kw(L, 'dupTier', 'same') || '∅'),
        `U4.r3 [${lang}] how alike, in the detector's own words — never a percentage`);
      eq(count(seg, '163'), 2, `U4.r4 [${lang}] BOTH amounts are on the card — two rows fully legible`);
      ok(seg.includes(kw(L, 'metricVisa') || '∅') && seg.includes(kw(L, 'metricCash') || '∅'),
        `U4.r5 [${lang}] …with both METHODS visible — the difference the decision turns on`);
      eq(count(seg, '3/8/2026'), 2, `U4.r6 [${lang}] …and both dates`);
      eq(count(html, `>${removeWord}<`), 2,
        `U4.r7 [${lang}] exactly TWO decision buttons — one per row, one decision per pair, nothing else`);
      ok(new RegExp(`<button[^>]*min-height:48px[^>]*>${escapeRe(removeWord)}<`).test(html),
        `U4.r8 [${lang}] the buttons sit at the senior tap floor — the gesture is an affordance, never the only door`);
      ok(/onTouch/i.test(await readFile(new URL('../src/views/InboxView.jsx', import.meta.url), 'utf8')),
        `U4.r9 [${lang}] …and the swipe affordance exists in source beside them`);
      ok(!t.includes(kw(L, 'dupNeedsEngine') || '∅'),
        `U4.r10 [${lang}] no engine sentence while the server has the verb`);
    }

    // ——— without the capability: fail closed, the honest sentence.
    {
      const html = render();
      const t = text(html);
      ok(t.includes(kw(L, 'dupPairTitle') || '∅'),
        `U4.r11 [${lang}] the pair is still SHOWN — detection is the client's own knowledge`);
      eq(count(html, `>${removeWord}<`), 0,
        `U4.r12 [${lang}] but NO remove button — a control that can only answer unknown_action is the dictation defect again`);
      ok(t.includes(kw(L, 'dupNeedsEngine') || '∅'),
        `U4.r13 [${lang}] the honest state stands in its place: the book's engine needs its update`);
    }

    // ——— resolved: the counterpart survives, on screen and in the counts.
    if (typeof IV.pairsFrom === 'function') {
      const pend = pendPair();
      const pk = IV.pairsFrom(pend).pairs[0].key;
      const html = render({
        build: { actions: ['remove_entry'] },
        initialPairOutcomes: { [pk]: { status: 'done', removedKey: cardKey(pend[0]), removedIdx: 0 } },
      });
      const t = text(html);
      ok(t.includes(kw(L, 'dupPairRemoved') || '∅'), `U4.r14 [${lang}] the resolution says what happened — moved to Removed, never vanished`);
      ok(t.includes(kw(L, 'dupPairSurvives') || '∅'), `U4.r15 [${lang}] …and that the other row STAYS — the Owner's clause, on the card`);
      eq(count(html, `>${removeWord}<`), 0, `U4.r16 [${lang}] a resolved pair offers no further decision`);
      ok(t.includes(kw(L, 'inboxWaiting', 1) || '∅') && !t.includes(kw(L, 'inboxWaiting', 2) || '∅'),
        `U4.r17 [${lang}] the headline counts the SCREEN — the removed row leaves the list it is counted by`);

      for (const [status, key] of [['failed', 'dupPairFailed'], ['engine', 'dupNeedsEngine'], ['gone', 'dupPairGone'], ['offline', 'editOffline']]) {
        const h = render({ build: { actions: ['remove_entry'] }, initialPairOutcomes: { [pk]: { status } } });
        ok(text(h).includes(kw(L, key) || '∅'),
          `U4.r18 [${lang}] the «${status}» outcome renders «${key}» — every branch has its sentence`);
      }
      {
        const h = render({
          build: { actions: ['remove_entry'] },
          initialPairOutcomes: { [pk]: { status: 'conflict', current: { date: '3/8/2026', description: 'Allas Sea Pool', method: 'Visa', category: 'Leisure', amount: 170, currency: 'EUR' } } },
        });
        const th = text(h);
        ok(th.includes(kw(L, 'editConflict') || '∅') && th.includes('170'),
          `U4.r19 [${lang}] a stale remove renders the SERVER's row — the conflict grammar, shared with the edit sheet (one concept, one string)`);
      }
    }

    // ——— a trio: legible, named, NOT pairwise-actionable.
    {
      const trio = pendPair().concat([{ ...pendPair()[0], rowHint: 30 }]);
      const html = render({ pending: trio, build: { actions: ['remove_entry'] } });
      const t = text(html);
      ok(t.includes(kw(L, 'dupGroupBig', 3) || '∅'),
        `U4.r20 [${lang}] three alike rows are named as a group for the sheet`);
      eq(count(html, `>${removeWord}<`), 0,
        `U4.r21 [${lang}] …with no remove buttons — an arbitrary pair inside a trio would be a guess`);
    }

    // ——— the ordinary Inbox is silent.
    {
      const html = render({
        pending: [pendPair()[0], { ...pendPair()[1], match: { ...pendPair()[1].match, date: '4/8/2026' } }],
        build: { actions: ['remove_entry'] },
      });
      ok(!text(html).includes(kw(L, 'dupPairTitle') || '∅'),
        `U4.r22 [${lang}] different days raise nothing — the ordinary case is silence`);
    }

    // ——— the wire seam.
    {
      const api = await vite.ssrLoadModule('/src/api/index.js');
      ok(typeof api.removeEntry === 'function', `U4.w1 [${lang}] the api seam exports removeEntry`);
      ok(Array.isArray(api.MOCK_ACTIONS) && api.MOCK_ACTIONS.indexOf('remove_entry') === -1,
        `U4.w2 [${lang}] and MOCK_ACTIONS does NOT advertise it — the deployed server doesn't, so the mock may not (mock-parity law)`);
      const ping = await api.ping();
      ok(ping && ping.build && Array.isArray(ping.build.actions) && ping.build.actions.indexOf('remove_entry') === -1,
        `U4.w3 [${lang}] ping agrees — which is exactly what keeps the buttons dark today, honestly`);
    }
  } finally {
    await vite.close();
  }
}

await sweep('ar', AR);
await sweep('en', EN);

/* ═══════════ source pins ═══════════ */
{
  const iv = await readFile(new URL('../src/views/InboxView.jsx', import.meta.url), 'utf8');
  ok(/findLookalikes[^\n]*from '\.\.\/state\/duplicates\.js'/.test(iv),
    'U4.s1 the pairs ride the ONE detector — findLookalikes, imported, never re-derived');
  ok(!/(function|const)\s+(bookKey|twinKey|likeness)\s*[=(]/.test(iv),
    'U4.s2 …and no second grouping rule exists here to drift from it');
  ok(/supportsAction\(build, 'remove_entry'\)/.test(iv),
    'U4.s3 the decision is gated on the capability advertisement, by name — fail closed');
  ok(/removeEntry\(\{ tab: target\.tab, rowHint: target\.rowHint, match: target\.match \}\)/.test(iv),
    'U4.s4 the wire carries the pending row’s OWN identity — tab and rowHint echoed, match as the concurrency claim; no sourceHash is invented (pending[] carries none — named residual)');
  ok(!/state\/outbox\.js/.test(iv),
    'U4.s5 a remove is never enqueued — replaying a remove against twins is the one replay that could take the counterpart');

  const api = await readFile(new URL('../src/api/index.js', import.meta.url), 'utf8');
  ok(/action: 'remove_entry', tab, rowHint, match/.test(api),
    'U4.s6 api/index.js routes remove_entry with exactly the named fields');
}

if (failures.length) {
  console.log(`❌ CHUNK U4 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · duplicate pairs resolve in the Inbox — one decision, the counterpart always survives, the missing verb states itself honestly`);
