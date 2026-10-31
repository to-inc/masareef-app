#!/usr/bin/env node
/**
 * PWA LIFE ON iOS (audit 2026-11-01) — what keeps the phone's copy alive, and what
 * the app does when iOS resumes it instead of launching it.
 *
 * K · persistent storage is asked for (webkit.org/blog/14403: a home-screen app's
 *     storage in persistent mode is left out of eviction), and «Check the app» says
 *     whether the phone agreed.
 * C · a stalled photo reaches «Check the app» (its error was dropped on the way).
 * U · a resumed app looks for a new build on return, at most hourly.
 * B · a statement re-sent after a lost answer keeps its batch id, so it replays.
 * S · «Copy my setup» (Q1 · B): one code restores the setup with one paste.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(root, p), 'utf8');
let pass = 0;
const failures = [];
const ok = (c, id, label) => { if (c) { pass++; console.log(`PASS ${id}`); } else failures.push(`${id} ${label}`); };

const fakeNav = (kept, grant = true) => {
  const calls = { persist: 0 };
  return { calls, nav: { storage: { persisted: async () => kept, persist: async () => { calls.persist++; return grant; } } } };
};

const vite = await createServer({ root, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const { S } = await vite.ssrLoadModule('/src/i18n/strings.js');

  // ——— K
  let keep = null, kept = null;
  try { ({ keepStorage: keep, storageKept: kept } = await vite.ssrLoadModule('/src/state/storageKeep.js')); } catch { /* absent before the fix */ }
  if (keep) {
    const a = fakeNav(false, true), b = fakeNav(true), c = fakeNav(false, false);
    const ra = await keep(a.nav), rb = await keep(b.nav), rc = await keep(c.nav);
    const none = await keep({}), thrown = await keep({ storage: { persisted: async () => { throw new Error('x'); }, persist: async () => true } });
    ok(ra === true && a.calls.persist === 1 && rb === true && b.calls.persist === 0 && rc === false && none === null && thrown === null,
      'K1', `asks once when not yet kept, never re-asks a kept origin, «cannot say» is null — ${JSON.stringify([ra, rb, rc, none, thrown])}`);
    ok(await kept(fakeNav(true).nav) === true && await kept(fakeNav(false).nav) === false && await kept({}) === null, 'K2', 'storageKept reads, never asks');
  } else { ok(false, 'K1', 'src/state/storageKeep.js is missing — nothing asks iOS to keep the phone\'s copy'); ok(false, 'K2', 'no storageKept'); }
  ok(/^keepStorage\(\);/m.test(src('src/main.jsx')), 'K3', 'main.jsx asks on every launch');

  const sc = await vite.ssrLoadModule('/src/state/selfCheck.js');
  const now = Date.UTC(2026, 10, 1, 12), day = { y: 2026, m: 11, d: 1 };
  const good = { now, phoneDay: day, server: { ok: true, ms: 900, build: 'b', today: day }, photos: [], outbox: [], statement: 0, offline: true, storage: { used: 1, quota: 100 }, figuresAt: now - 60000 };
  const rows = (f) => Object.fromEntries(sc.judge(f, S).map((r) => [r.key, r]));
  ok(rows({ ...good, kept: false }).kept?.tone === 'warn' && rows({ ...good, kept: true }).kept?.tone === 'ok' && !('kept' in rows({ ...good, kept: null }))
    && typeof S.checkKeptNo === 'string' && /home|الأيقونة/.test(S.checkKeptNo),
    'K4', '«Check the app» warns when the phone has not agreed to keep its data, and says nothing when it cannot tell');
  ok(/facts\.kept = await storageKept\(\)/.test(src('src/state/selfCheck.js')), 'K5', 'gatherFacts reads the kept state');

  // ——— C
  const jobs = [{ id: 'a', stage: 'failed', error: 'stalled', queuedAt: now - 60000, base64: 'AAAA' }];
  const facts = sc.photoFacts ? sc.photoFacts(jobs) : null;
  ok(!!facts && rows({ ...good, photos: facts }).photos.tone === 'warn' && !('base64' in facts[0]),
    'C3', 'a stalled photo, as gatherFacts sees it, turns «Check the app» amber (the error used to be dropped, so it read green)');

  // ——— U
  const up = await vite.ssrLoadModule('/src/state/update.js').catch(() => ({}));
  if (up.checkOnReturn) {
    let t = 0, n = 0, vis = 'visible';
    const ls = {};
    const doc = { get visibilityState() { return vis; }, addEventListener: (e, f) => { ls[e] = f; }, removeEventListener: (e) => { delete ls[e]; } };
    const off = up.checkOnReturn({ update: async () => { n++; } }, doc, () => t);
    t = 30 * 60e3; ls.visibilitychange(); const early = n;
    t = 61 * 60e3; vis = 'hidden'; ls.visibilitychange(); const hidden = n;
    vis = 'visible'; ls.visibilitychange(); const late = n;
    ls.visibilitychange(); const again = n;
    off();
    ok(early === 0 && hidden === 0 && late === 1 && again === 1 && !ls.visibilitychange,
      'U1', `a return after an hour looks for a new build once; sooner, or hidden, it does not — ${[early, hidden, late, again]}`);
  } else ok(false, 'U1', 'no checkOnReturn — a resumed app never looks for a new build');
  ok(/onRegisteredSW: \(_url, reg\) => \{ checkOnReturn\(reg\)/.test(src('src/state/update.js')), 'U2', 'the registration is the one watched');

  // ——— B
  const app = src('src/App.jsx');
  ok(/const batchClientId = batch\.batchClientId \|\| newClientId\(\);/.test(app) && /saveDraft\(\{ \.\.\.prev, batchClientId \}\)/.test(app)
    && !/batchClientId: newClientId\(\)/.test(app) && /\[batch\.jobs, batch\.batchClientId\]/.test(app),
    'B1', 'a statement re-sent from the same draft carries the same batch id (a lost answer replays as duplicate, not a second batch)');

  // ——— S
  const sec = await vite.ssrLoadModule('/src/state/secret.js');
  if (sec.setupCode && sec.readSetupCode) {
    const creds = { execUrl: 'https://script.google.com/macros/s/X/exec', secret: 'sé/cret+=' };
    const code = sec.setupCode(creds, 'https://docs.google.com/spreadsheets/d/1/edit');
    const back = sec.readSetupCode(`  ${code}\n`);
    ok(back && back.execUrl === creds.execUrl && back.secret === creds.secret && back.sheetUrl.endsWith('/edit')
      && sec.readSetupCode(sec.setupCode(creds, null)).sheetUrl === '' && sec.setupCode(null) === null && !code.includes('cret'),
      'S1', 'a setup code carries URL, key and sheet and reads back exactly (pasted with stray spaces too); no setup, no code');
    ok([null, '', 'hello', 'masareef-setup:', 'masareef-setup:!!!', 'masareef-setup:' + btoa(encodeURIComponent('{"u":"http://x","s":"k"}')),
      'masareef-setup:' + btoa(encodeURIComponent('{"u":"https://x","s":""}'))].every((t) => sec.readSetupCode(t) === null),
      'S2', 'anything that is not a whole, https code is refused (the boxes keep what he typed)');
  } else { ok(false, 'S1', 'no setupCode / readSetupCode in state/secret.js'); ok(false, 'S2', 'no readSetupCode'); }
  const setup = src('src/views/SetupView.jsx');
  ok((setup.match(/if \(!fromCode\(e\.target\.value\)\)/g) || []).length === 2 && /S\.setupCodeHint/.test(setup),
    'S3', 'pasting the code into the URL or key box fills all three, and the screen says so');
  const ss = await vite.ssrLoadModule('/src/views/SettingsSheet.jsx');
  if (ss.SaveSetup) {
    const on = renderToStaticMarkup(createElement(ss.SaveSetup, { code: 'masareef-setup:SECRETCODE' }));
    const off = renderToStaticMarkup(createElement(ss.SaveSetup, { code: null }));
    ok(on.includes(S.setupCopy) && on.includes(S.setupCopyHint) && !on.includes('SECRETCODE') && off === ''
      && /<SaveSetup \/>/.test(src('src/views/SettingsSheet.jsx')),
      'S4', '«Copy my setup» sits in Settings → Help, never shows the code, and hides with no setup');
    ok(/state === 'failed' && \(\s*<input data-setup-code readOnly/.test(src('src/views/SettingsSheet.jsx')),
      'S5', 'a refused clipboard shows the code to copy by hand, and only then');
  } else ok(false, 'S4', 'no SaveSetup in Settings');
} finally {
  await vite.close();
}

if (failures.length) {
  console.log(`❌ pwa-life — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ all ${pass} pwa-life checks passed · storage kept, the stall reported, updates found on return, statements replay, setup restored by one paste`);
