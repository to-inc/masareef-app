#!/usr/bin/env node
/**
 * ═══════════ GATE — P8 · LOADING AND THE UPDATE PROMPT (v4, R19, ARCHITECTURE A6) ═══════════
 *
 * The behaviour itself was proven end-to-end in a real browser against a real
 * service-worker update (a build served, a second build landed over it, the
 * registration checked): a waiting build shows NO prompt while the entry sheet
 * is open, the prompt appears once it closes, and «حدّث» reloads onto the new
 * bundle. A static suite cannot drive a service worker, so this gate pins the
 * wiring that behaviour rests on — each line is one that, changed, brings the
 * mid-entry reload back.
 */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { AR } from '../src/i18n/strings.ar.js';

const MARKER = 'CHUNK-P8-GREEN';
let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) pass++; else failures.push(label); };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const cfg = read('vite.config.js');
const app = read('src/App.jsx');
const upd = read('src/state/update.js');

ok(/registerType: 'prompt'/.test(cfg) && !/registerType: 'autoUpdate'/.test(cfg),
  'P8.1 the service worker registers in PROMPT mode — autoUpdate could reload under a half-typed amount (A6)');
ok(/id: base/.test(cfg) && /theme_color: '#FAF7F1'/.test(cfg), 'P8.2 the manifest carries id: base and the paper theme colour (A6)');
ok(/useRegisterSW/.test(upd) && /updateServiceWorker\(true\)/.test(upd), 'P8.3 the update is applied only through the hook\'s explicit updateServiceWorker(true)');
ok(/\{update\.waiting && !sheetOpen && !undo && <UpdatePrompt onUpdate=\{update\.apply\} \/>\}/.test(app),
  'P8.4 the prompt is mounted only while the entry sheet is CLOSED (and the undo toast has the floor first) — R19');
ok(!/location\.reload\(\)/.test(app), 'P8.5 the shell itself never reloads the page');
ok(/state=\{reading > 0 \? 'busy' : refreshState\}/.test(app), 'P8.6 the pill reads every in-flight read — the startup one too — not only a press');

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const P = await vite.ssrLoadModule('/src/components/Primitives.jsx');
  const pill = (p) => renderToStaticMarkup(createElement(P.RefreshButton, { onPress: () => {}, clock: () => '8:12', ...p }));
  ok(pill({ state: 'busy' }).includes(AR.fetchingSheet), 'P8.7 a first read with nothing saved says «بنجيب من الشيت…»');
  const over = pill({ state: 'busy', savedAt: 1 });
  ok(over.includes(AR.lastUpdated) && over.includes('8:12'), 'P8.8 a read over a saved copy says how old the copy is — «آخر تحديث 8:12»');
  ok(!over.includes('#D9A441'), 'P8.9 the reading dot is not amber — amber is the one save action (ONE-AMBER)');
  const prompt = renderToStaticMarkup(createElement(P.UpdatePrompt, { onUpdate: () => {} }));
  ok(prompt.includes(AR.updateReady) && prompt.includes(AR.updateLater) && prompt.includes(`>${AR.updateNow}</button>`),
    'P8.10 the prompt says a new version is ready, that it will apply itself next time, and offers «حدّث»');
  ok(/min-height:48px/.test(prompt), 'P8.11 «حدّث» stands at the 48pt floor');
} finally { await vite.close(); }

if (failures.length) {
  console.log(`❌ CHUNK P8 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · updates wait for him; the pill says what is on screen while it reads`);
