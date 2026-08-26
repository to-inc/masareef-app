#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK B1 ═══════════
 * «The period control's active indicator becomes a SLIDING harbor pill: a
 *  transform transition at MOTION.move with MOTION.easeOut, guarded by
 *  prefers-reduced-motion (instant jump — content never hidden).»
 *  (chunk-ledger B1; north-star §4.2 «sliding pill … highest leverage — he
 *  switches periods constantly»; nav-F2/F10; MOTION LAW.)
 *
 * WHY BOTH A SOURCE PIN AND A RENDER. The source pin proves the duration and
 * easing are the TOKENS (a raw 260ms where MOTION.move exists is a defect by
 * the ledger's own law); the render proves the pill actually reaches the
 * screen wearing them — N2's lesson, where every pin passed while the ref was
 * never attached. And the reduced-motion branch is exercised for real: a
 * stubbed matchMedia turns the transition off in the rendered HTML, which is
 * the guard doing its work rather than a comment claiming it would.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { MOTION, C, RADIUS } from '../src/theme.js';
import { AR } from '../src/i18n/strings.ar.js';

const MARKER = 'CHUNK-B1-GREEN';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const view = readFileSync(join(root, 'src/views/BookView.jsx'), 'utf8');

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };

// ═══ 1. SOURCE — tokens consumed, guard present, pill declared ═══
{
  const importLine = (view.match(/import \{[^}]*\} from '\.\.\/theme\.js'/) || [''])[0];
  ok(/\bMOTION\b/.test(importLine),
    'B1.1 BookView imports MOTION — durations are vocabulary, never numbers');
  ok(/`transform \$\{MOTION\.move\}ms \$\{MOTION\.easeOut\}`/.test(view),
    'B1.2 the pill\'s transition is transform at MOTION.move with MOTION.easeOut — the tokens, verbatim, at the site');
  ok(!/\b260ms\b/.test(view),
    'B1.3 …and no raw 260ms anywhere in the view — a raw ms where a token exists is a defect');
  ok(/prefers-reduced-motion/.test(view),
    'B1.4 the reduced-motion media query is consulted — the MOTION LAW\'s guard, in this file, not assumed elsewhere');
  ok(/aria-hidden="true"[\s\S]{0,400}?translateX|translateX[\s\S]{0,400}?aria-hidden="true"/.test(view)
    || /aria-hidden/.test(view.slice(view.indexOf('translateX') - 600, view.indexOf('translateX'))),
    'B1.5 the pill is aria-hidden decoration — the buttons\' own aria-pressed remains the semantic truth');
}

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const BookView = (await vite.ssrLoadModule('/src/views/BookView.jsx')).default;
  const payload = () => ({
    today_cairo: { y: 2026, m: 8, d: 17 },
    today: { entries: [], totals: { Visa: 0, Cash: 0 } },
    week: { cur: { Visa: [1], Cash: [1] }, prev: { Visa: [1], Cash: [1] } },
    month: { cur: { Visa: [1], Cash: [1] }, prev: { Visa: [1], Cash: [1] }, names: { cur: 'August', prev: 'July' } },
    year: { cur: { Visa: [1], Cash: [1] }, prev: { Visa: [1], Cash: [1] } },
    monthCats: [], pending: [],
  });
  const render = () => renderToStaticMarkup(createElement(BookView, { data: payload() }));

  // ——— the moving pill, wearing the tokens
  const html = render();
  const pillMatch = html.match(/<div aria-hidden="true"[^>]*style="([^"]*translateX[^"]*)"/);
  const pill = pillMatch ? pillMatch[1] : null;
  ok(!!pill, 'B1.6 a translateX-positioned pill renders inside the period control');
  ok(!!pill && pill.toUpperCase().includes(C.harbor.toUpperCase()),
    'B1.7 …filled harbor — selection is harbor\'s job, and this is selection moving');
  ok(!!pill && pill.includes(`border-radius:${RADIUS.capsule}px`),
    'B1.8 …in the control\'s own capsule radius');
  ok(!!pill && pill.includes(`transition:transform ${MOTION.move}ms ${MOTION.easeOut}`),
    `B1.9 …transitioning transform at MOTION.move=${MOTION.move}ms with MOTION.easeOut — rendered, not merely written`);

  // ——— the buttons stay the semantic control: one pressed, none painted
  ok(new RegExp(`<button[^>]*aria-pressed="true"[^>]*>${AR.periodToday}<`).test(html),
    'B1.10 the active period still says so through aria-pressed — the pill is paint, not state');
  const activeBtn = html.match(new RegExp(`<button[^>]*aria-pressed="true"[^>]*style="([^"]*)"[^>]*>${AR.periodToday}<`))
    || html.match(new RegExp(`<button[^>]*style="([^"]*)"[^>]*aria-pressed="true"[^>]*>${AR.periodToday}<`));
  ok(!!activeBtn && activeBtn[1].includes('background:transparent'),
    'B1.11 the active button paints NO fill of its own — two fills would ghost each other mid-slide');

  // ——— the guard, exercised: reduced motion collapses to an instant jump
  globalThis.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  try {
    const reduced = render();
    const rm = reduced.match(/<div aria-hidden="true"[^>]*style="([^"]*translateX[^"]*)"/);
    ok(!!rm && rm[1].includes('transition:none'),
      'B1.12 under prefers-reduced-motion the transition is NONE — an instant state change, honestly instant');
    ok(!!rm && rm[1].includes('translateX'),
      'B1.13 …and the pill still lands where it belongs — motion collapses, content never hides');
    ok(new RegExp(`<button[^>]*aria-pressed="true"[^>]*>${AR.periodToday}<`).test(reduced),
      'B1.14 …with the pressed state intact — the guard touches motion and nothing else');
  } finally {
    delete globalThis.matchMedia;
  }
} finally {
  await vite.close();
}

if (failures.length) {
  console.log(`❌ CHUNK B1 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · the period pill slides at MOTION.move/easeOut and stands still under reduced motion`);
