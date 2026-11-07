#!/usr/bin/env node
/**
 * BACK AND PHOTOS (2026-11-02 usage audit, Tarek: «Let's do it»).
 *
 * N1 · ← from a photo opened on To review returns to To review, list open
 * N2 · ← from a statement opened on the Book returns to the Book
 * N3 · ← from a capture begun on New returns to the New sheet
 * N4 · the header's Photos button only opens the list, and scrolls to it
 * N5 · App.jsx records where each capture was opened and leaves through captureBack
 * N6 · App.jsx's Photos button no longer folds an open list
 * N7 · the «receipt is ready» toast can be tapped, and opens Photos (audit 2026-10-29)
 * N8 · a plain toast still lets taps through
 * N9 · on the receipt screen a photo's picture-and-name line takes its next step
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0;
const failures = [];
const ok = (c, id, label) => { if (c) { pass++; console.log(`PASS ${id}`); } else failures.push(`${id} ${label}`); };

let nav = {};
try { nav = await import(join(root, 'src/state/captureNav.js')); } catch { /* reported below */ }
const { captureBack = () => ({}), photosShortcutTap = () => ({}) } = nav;

const fromInbox = captureBack('inbox');
ok(fromInbox.tab === 'inbox' && fromInbox.photosOpen === true, 'N1', `from To review ← went to ${JSON.stringify(fromInbox)}`);
ok(captureBack('book').tab === 'book', 'N2', `from the Book ← went to ${JSON.stringify(captureBack('book'))}`);
ok(captureBack(null).tab === 'entry', 'N3', 'from New ← no longer returns to the New sheet');
const t = photosShortcutTap();
ok(t.tab === 'inbox' && t.photosOpen === true && t.scroll === true, 'N4', `Photos button does ${JSON.stringify(t)}`);

const app = readFileSync(join(root, 'src/App.jsx'), 'utf8');
ok(/onOpenPhoto=\{\(job\) => pushDetail\(\(\) => \{ captureFrom\.current = 'inbox'/.test(app)
  && /captureFrom\.current = 'book'; setEntryMode\('batch'\)/.test(app)
  && /const to = captureBack\(captureFrom\.current\)/.test(app)
  && /const leaveCapture = leaveBatch;/.test(app),
  'N5', 'App.jsx does not record the capture origin or does not leave through captureBack');
ok(!/if \(photosOpen && viewTab === 'inbox'\) setPhotosOpen\(false\)/.test(app) && /photosShortcutTap\(\)/.test(app),
  'N6', 'the header Photos button can still fold an open list');

const vite = await createServer({ root, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const { Toast } = await vite.ssrLoadModule('/src/components/Primitives.jsx');
  const tappable = renderToStaticMarkup(createElement(Toast, { message: 'ready', onTap() {} }));
  const plain = renderToStaticMarkup(createElement(Toast, { message: 'saved' }));
  ok(/data-toast-tap/.test(tappable) && /pointer-events:auto/.test(tappable), 'N7', 'a toast with somewhere to go still lets the tap fall through');
  ok(!/data-toast-tap/.test(plain) && !/pointer-events:auto/.test(plain), 'N8', 'a plain toast now catches taps meant for the screen under it');
} finally {
  await vite.close();
}
ok(/showToast\(S\.photoReady\(fresh\.length\), \(\) => openPhotos\(\)\)/.test(app) && /<Toast message=\{toast\} onTap=\{toastTap\.current\} \/>/.test(app),
  'N7', 'App.jsx does not route a tap on the «receipt is ready» toast to Photos');
const rv = readFileSync(join(root, 'src/views/ReceiptView.jsx'), 'utf8');
ok(/<div data-photo-row-hit onClick=\{primary \? primary\.onTap : undefined\}/.test(rv), 'N9', 'the photo line on the receipt screen still does nothing');
const bv = readFileSync(join(root, 'src/views/BatchReviewView.jsx'), 'utf8');
ok(/outstanding > 0 \? onLeave : \(\) => onDiscard\('book'\)/.test(bv)
  && /const to = captureBack\(dest === 'book' \? 'book' : captureFrom\.current\);[\s\S]{0,400}setTab\(to\.tab\);/.test(app),
  'N10', '«Done — back to the book» clears the statement but does not go to the Book');

if (failures.length) {
  console.log(`❌ capture-nav — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ all ${pass} capture-nav checks passed · ← goes back where the photo came from; Photos only opens`);
