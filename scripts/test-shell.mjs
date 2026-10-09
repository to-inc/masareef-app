#!/usr/bin/env node
/**
 * ═══════════ GATE — THE PWA SHELL (ARCHITECTURE A6, OWNER-RULINGS R14/R19/B8) ═══════════
 * The install coach (P2), the badge and its one permission ask. Icons and the
 * launch images are test-icons.mjs; the update prompt is test-chunk-p8.mjs.
 */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { coachDue, isIosSafari, SNOOZE_MS } from '../src/state/installCoach.js';
import { AR } from '../src/i18n/strings.ar.js';

const MARKER = 'CHUNK-SHELL-GREEN';
let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) pass++; else failures.push(label); };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ——— P2: when the coach shows
const now = 1_000_000_000;
ok(coachDue({ ios: true, standalone: false, state: null, now }), 'S.1 iPhone Safari, never asked → the coach shows (iOS has no install prompt of its own)');
ok(!coachDue({ ios: true, standalone: true, state: null, now }), 'S.2 never inside the installed app');
ok(!coachDue({ ios: false, standalone: false, state: null, now }), 'S.3 never off iOS — other browsers have their own install');
ok(!coachDue({ ios: true, standalone: false, state: { snoozedUntil: now + 1 }, now }), 'S.4 «بعدين» keeps it away…');
ok(coachDue({ ios: true, standalone: false, state: { snoozedUntil: now - 1 }, now }), 'S.5 …until the snooze runs out');
ok(SNOOZE_MS === 14 * 24 * 3600 * 1000, 'S.6 the snooze is 14 days (R19)');
ok(!coachDue({ ios: true, standalone: false, state: { done: true }, now }), 'S.7 «فهمت» retires it — told once is told');
ok(isIosSafari('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'), 'S.8 iPhone Safari is recognised');
ok(!isIosSafari('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1'), 'S.9 Chrome on iPhone is not');

// ——— B8 + R19: the badge
const app = read('src/App.jsx');
ok(/const pendingCount = remaining\(reconcile\(\(data\?\.pending \|\| \[\]\)\.filter\(\(p\) => !p\.stale\), settled\)\);/.test(app),
  'S.10 B8: the badge counts the CURRENT period\'s queue — the old-expenses backlog is not in it');
ok(/useEffect\(\(\) => \{ setBadge\(pendingCount\); \}, \[pendingCount\]\);/.test(app), 'S.11 the icon badge reads that same count');
ok(/<InstallCoach \/>/.test(app), 'S.12 the shell mounts the coach (it decides for itself when to show)');
const setup = read('src/views/SetupView.jsx');
ok(/await askBadgeOnce\(\);\s*onDone\(\);/.test(setup), 'S.13 R19: the ONE permission ask is made from Setup, on his tap, after the book connects');
const badge = read('src/state/badge.js');
ok(/Notification\.permission !== 'default'\) return false/.test(badge), 'S.14 asked at most once — a granted or refused answer is never re-asked');
ok(!/new Notification\(|showNotification\(/.test(read('src/App.jsx') + badge + setup), 'S.15 the app never SENDS a notification (R19)');

// ——— P2 rendered
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const IC = (await vite.ssrLoadModule('/src/components/InstallCoach.jsx')).default;
  const html = renderToStaticMarkup(createElement(IC, { force: true }));
  ok([AR.coachTitle, AR.coachStep1, AR.coachStep2, AR.coachStep3, AR.coachGotIt, AR.coachLater].every((t) => html.includes(t)),
    'S.16 the coach says its three steps and offers «فهمت» and «بعدين»');
  ok((html.match(/min-height:52px/g) || []).length === 2, 'S.17 both answers are 52px targets');
  ok(/role="dialog" aria-modal="true"/.test(html), 'S.18 it is a modal dialog to VoiceOver');
  ok(renderToStaticMarkup(createElement(IC)) === '', 'S.19 off iOS (this test runs in Node) it renders nothing');
} finally { await vite.close(); }

if (failures.length) {
  console.log(`❌ CHUNK SHELL — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · install coach on iOS Safari only; one permission ask; the badge counts this period`);
