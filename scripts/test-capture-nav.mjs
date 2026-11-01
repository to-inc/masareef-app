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
 */
import { readFileSync } from 'node:fs';
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

if (failures.length) {
  console.log(`❌ capture-nav — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ all ${pass} capture-nav checks passed · ← goes back where the photo came from; Photos only opens`);
