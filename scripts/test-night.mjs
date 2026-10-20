#!/usr/bin/env node
/**
 * ═══ GATE — NIGHT (Tarek, 2026-10-18: «build … dark mode») ═══
 * The night palette must clear the same contrast floors as the day: text 4.5:1,
 * chart lines 3:1, on the night glass over every stop of the night ground. And
 * without a saved choice the theme is LIGHT for Dad's pound book, Auto for a euro book.
 */
import { createServer } from 'vite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0; const failures = [];
const ok = (c, label) => { if (c) pass++; else failures.push(label); };
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (c) => { const v = c.map((x) => x / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const blend = (top, a, under) => top.map((t, i) => Math.round(t * a + under[i] * (1 - a)));

const mem = new Map([['masareef.theme', 'night']]);
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v) };
const vite = await createServer({ root, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const T = await vite.ssrLoadModule('/src/theme.js');
  const K = await vite.ssrLoadModule('/src/lib/constants.js');
  const N = await vite.ssrLoadModule('/src/lib/night.js');
  const { C, NIGHT, GROUND } = T;
  ok(NIGHT === true && C.ink !== '#2C4356', 'N.1 a saved «night» gives the night palette');
  const pairs = [['ink on card', C.ink, C.card, 4.5], ['muted on card', C.muted, C.card, 4.5], ['muted on shell', C.muted, C.shell, 4.5],
    ['harbor text on card', C.harborInk, C.card, 4.5], ['white on harbor', C.onDark, C.harbor, 4.5],
    ['conflict on its box', C.conflictInk, C.conflictBg, 4.5], ['settled on its box', C.settledInk, C.settledBg, 4.5],
    ['amber button text', C.amberInk, C.amber, 4.5],
    // Audit 2026-10-20: the pairs the night palette broke without a test noticing.
    ['warm text on sand (waiting rows, statement chips)', C.sandInk, C.sand, 4.5],
    ['badge count on its terracotta disc', C.shell, C.conflictInk, 4.5],
    ['white on the Review pill\'s darker stop', C.onDark, C.harborDeep, 4.5],
    ['unticked checkbox edge on card (non-text, 3:1)', C.muted, C.card, 3]];
  for (const [name, fg, bg, floor] of pairs) { const r = ratio(rgb(fg), rgb(bg)); ok(r >= floor, `N.2 ${name} ${r.toFixed(2)}:1 ≥ ${floor}`); }
  // Text on the night glass (its thinnest stop, .40 slate) over every stop of the night ground.
  const stops = [...new Set(GROUND.dawn.match(/#[0-9A-Fa-f]{6}/g))].map(rgb);
  const slate = [30, 44, 56];
  let worstInk = 99, worstMuted = 99;
  for (const st of stops) { const under = blend(slate, 0.40, st); worstInk = Math.min(worstInk, ratio(rgb(C.ink), under)); worstMuted = Math.min(worstMuted, ratio(rgb(C.muted), under)); }
  ok(stops.length >= 3 && worstInk >= 4.5 && worstMuted >= 4.5, `N.3 text on night glass over every ground stop: ink ${worstInk.toFixed(2)}, muted ${worstMuted.toFixed(2)} (≥ 4.5)`);
  for (const m of K.METRICS) { const r = ratio(rgb(m.color), rgb(C.card)); ok(r >= 4.5, `N.4 the ${m.key} series and its heading ${r.toFixed(2)}:1 on night glass`); }
  // The default: light for a pound book, auto for a euro book, light with nothing saved.
  const st = (o) => ({ getItem: (k) => (k in o ? o[k] : null) });
  ok(N.themeChoice(st({})) === 'light'
    && N.themeChoice(st({ 'masareef.snapshot.v1': JSON.stringify({ data: { month: { homeAgg: { currency: 'EGP' } } } }) })) === 'light'
    && N.themeChoice(st({ 'masareef.snapshot.v1': JSON.stringify({ data: { month: { homeAgg: { currency: 'EUR' } } } }) })) === 'auto'
    && N.themeChoice(st({ 'masareef.theme': 'light', 'masareef.snapshot.v1': JSON.stringify({ data: { month: { homeAgg: { currency: 'EUR' } } } }) })) === 'light',
    'N.5 Dad\'s book stays light; his euro book follows the phone; a saved choice wins');
} finally { await vite.close(); }

if (failures.length) { console.log(`❌ night — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`); process.exit(1); }
console.log(`✅ all ${pass} night checks passed · every night pair clears its floor; Dad stays light`);
