#!/usr/bin/env node
/**
 * SHARE-SHEET PHOTOS (2026-11-01, board «Masareef on iPhone» Q3·A). The «Masareef»
 * Shortcut parks a photo on the server; the app collects it into its own queue.
 *
 * H1 · an older server (no held_list) is never asked
 * H2 · each held photo lands in the queue as a normal, queued job, then held_done
 * H3 · held_done is only sent AFTER the phone kept the photo
 * H4 · a photo already on the phone is not queued twice (a lost held_done answer)
 * H5 · the reader is started once, and only when something was added
 * H6 · App.jsx collects on open and on return
 */
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0;
const failures = [];
const ok = (c, id, label) => { if (c) { pass++; console.log(`PASS ${id}`); } else failures.push(`${id} ${label}`); };

const fakeQueue = (jobs = [], refuse = false) => {
  const log = [];
  return { log, jobs, q: {
    all: async () => jobs.slice(),
    enqueue: async (j) => { log.push(['enqueue', j.id]); if (refuse) return false; jobs.push({ stage: 'queued', ...j }); return true; },
  } };
};
const fakeApi = (names, log) => ({
  heldList: async () => ({ ok: true, photos: names.map((n) => ({ name: n, day: n.slice(0, 10) })) }),
  heldGet: async ({ name }) => ({ ok: true, name, day: name.slice(0, 10), mediaType: 'image/jpeg', image: Buffer.from('photo:' + name).toString('base64') }),
  heldDone: async ({ name }) => { log.push(['done', name]); return { ok: true }; },
});
const A = '2026-11-01 101500 0a1b2c3d.jpg', B = '2026-11-01 101600 4e5f6a7b.jpg';
const BUILD = { actions: ['ping', 'held_list', 'held_get', 'held_done'] };

const vite = await createServer({ root, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const { pickUpHeld } = await vite.ssrLoadModule('/src/state/heldPhotos.js');
  const { sha256Hex } = await vite.ssrLoadModule('/src/lib/receipt-image.js');

  // H1
  let asked = 0;
  const n0 = await pickUpHeld({ actions: ['ping'] }, { api: { heldList: async () => { asked++; return { ok: true, photos: [] }; } } });
  ok(n0 === 0 && asked === 0, 'H1', `an older server was asked (${asked})`);

  // H2 + H3 + H5
  { const fq = fakeQueue(); let pumps = 0, changes = 0;
    const n = await pickUpHeld(BUILD, { api: fakeApi([A, B], fq.log), q: fq.q, pump: () => pumps++, changed: () => changes++ });
    const hashA = await sha256Hex(new Uint8Array(Buffer.from('photo:' + A)).buffer);
    const j = fq.jobs[0] || {};
    ok(n === 2 && fq.jobs.length === 2 && j.stage === 'queued' && j.id === hashA && j.clientHash === hashA && j.snapDate === '2026-11-01'
      && j.base64 === Buffer.from('photo:' + A).toString('base64'),
      'H2', `held photos become normal queued jobs, hashed like a photo taken in the app, dated the share day — ${JSON.stringify(j).slice(0, 160)}`);
    ok(JSON.stringify(fq.log) === JSON.stringify([['enqueue', hashA], ['done', A], ['enqueue', fq.jobs[1].id], ['done', B]]),
      'H3', `held_done follows the phone keeping each photo — ${JSON.stringify(fq.log)}`);
    ok(pumps === 1 && changes === 1, 'H5', `reader started ${pumps}×, list refreshed ${changes}×`);
  }
  { const fq = fakeQueue([], true); const n = await pickUpHeld(BUILD, { api: fakeApi([A, B], fq.log), q: fq.q, pump: () => {}, changed: () => {} });
    ok(n === 0 && !fq.log.some((e) => e[0] === 'done') && fq.log.length === 1, 'H3b', `a refused store sent held_done or kept going — ${JSON.stringify(fq.log)}`); }

  // H4
  { const hashA = await sha256Hex(new Uint8Array(Buffer.from('photo:' + A)).buffer);
    const fq = fakeQueue([{ id: hashA, stage: 'ready' }]); let pumps = 0;
    const n = await pickUpHeld(BUILD, { api: fakeApi([A], fq.log), q: fq.q, pump: () => pumps++, changed: () => {} });
    ok(n === 0 && fq.jobs.length === 1 && fq.jobs[0].stage === 'ready' && JSON.stringify(fq.log) === JSON.stringify([['done', A]]) && pumps === 0,
      'H4', `a photo already on the phone was queued again or reset — ${JSON.stringify(fq.log)}`); }

  // H6
  const app = readFileSync(join(root, 'src/App.jsx'), 'utf8');
  ok(/supportsAction\(build, 'held_list'\)/.test(app) && /pickUpHeld\(build\)/.test(app) && /addEventListener\('visibilitychange', collect\)/.test(app),
    'H6', 'App.jsx does not collect held photos on open and on return');
} finally {
  await vite.close();
}

if (failures.length) {
  console.log(`❌ held-photos — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ all ${pass} held-photos checks passed · shared photos join the queue, kept before they are released`);
