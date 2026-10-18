#!/usr/bin/env node
/**
 * ═══ GATE — THE USAGE DIARY (Tarek, 2026-10-18: «a logger, to know how I use the app») ═══
 * It records actions and never money: a control is named only by the app's own
 * words, digits become «#», anything else «[content]». Sent once a day, only to a
 * server that keeps it; what was sent leaves the phone.
 */
import { createServer } from 'vite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0; const failures = [];
const ok = (c, id, label) => { if (c) { pass++; console.log(`PASS ${id}`); } else failures.push(`${id} ${label}`); };
const el = (text, attrs = {}) => ({
  tagName: 'BUTTON', textContent: text,
  attributes: Object.keys(attrs).map((name) => ({ name })),
  getAttribute: (n) => (n in attrs ? attrs[n] : null),
});

const vite = await createServer({ root, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const U = await vite.ssrLoadModule('/src/state/usage.js');
  const { S } = await vite.ssrLoadModule('/src/i18n/strings.js');

  // U1 — private by construction (control: a shop name, an amount, a typed digit)
  const names = [U.controlName(el('BASTARD BURGERS')), U.controlName(el('20.50 €')), U.controlName(el('7')),
    U.controlName(el(S.thisWeek)), U.controlName(el('', { 'data-photos-shortcut': '' })), U.controlName(el('x', { 'aria-label': S.settingsTitle }))];
  ok(names[0] === '[content]' && names[1] === '#' && names[2] === '#' && names[3] === S.thisWeek
    && names[4] === 'data-photos-shortcut' && names[5] === S.settingsTitle,
    'U1', `a shop name is «[content]», amounts and keys «#», the app's own words kept (${JSON.stringify(names)})`);

  // U2 — events keep only short primitives
  U._reset();
  U.setScreen('book:week');
  U.track('tap', { id: 'x'.repeat(200), n: 3.7, obj: { a: 1 }, ok: true, nan: NaN });
  const ev = U._peek();
  const tap = ev.find((e) => e.type === 'tap');
  ok(ev[0].type === 'screen' && ev[0].name === 'book:week' && tap && tap.id.length === 60 && tap.n === 4 && !('obj' in tap) && !('nan' in tap) && tap.ok === true && tap.s === 'book:week',
    'U2', `screen changes and taps are recorded, trimmed, with the screen they happened on (${JSON.stringify(tap)})`);

  // U3 — sent once a day, only to a server that keeps it; what was sent leaves the phone
  const sent = [];
  const send = async (b) => { sent.push(b); return { ok: true }; };
  const no = await U.flushUsage({ actions: [] }, { send });
  const yes = await U.flushUsage({ actions: ['usage_log'] }, { send, now: 1_800_000_000_000 });
  const again = await U.flushUsage({ actions: ['usage_log'] }, { send, now: 1_800_000_000_000 + 3600_000 });
  ok(!no && yes && !again && sent.length === 1 && sent[0].events.length === 2 && /^U\d{8}[a-z0-9]{3}$/.test(sent[0].batch) && U._peek().length === 0,
    'U3', 'one send a day, never to a server without usage_log; the sent diary leaves the phone');

  // U4 — a failed send keeps everything for tomorrow
  U._reset(); U.track('tap', { id: 'a' });
  const failed = await U.flushUsage({ actions: ['usage_log'] }, { send: async () => ({ ok: false }), now: 1_900_000_000_000 });
  ok(!failed && U._peek().length === 1, 'U4', 'a refused send keeps the diary');
} finally { await vite.close(); }

if (failures.length) { console.log(`❌ usage — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`); process.exit(1); }
console.log(`✅ all ${pass} usage checks passed · actions not money, once a day, only where it is kept`);
