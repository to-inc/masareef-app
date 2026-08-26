#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK A2 ═══════════
 * «Plain cards: no border, NO SHADOW — the shell→card luminance step carries
 *  elevation on its own. A `line` border is MEANING (controls, advisory
 *  surfaces, media edges — theme.js's doctrine), never card chrome.»
 *
 * WHY SOURCE PINS AND NOT A RENDER. The law is per-SITE: PriorityLens keeps a
 * bordered card because it is a tappable disclosure, the thumbnail inside
 * JobRow keeps its media edge, the dismiss button under the log keeps its
 * control edge — all inside the very subtrees a rendered-markup sweep would
 * condemn. And half the sites render only under conditions (the Skeleton needs
 * a load in flight, the Lookalikes group needs duplicate rows). The style
 * object in source is the site, unconditionally, so that is what gets pinned.
 *
 * THE ENUMERATION IS THE CHECK. Each pin first proves the site still EXISTS
 * (a `background: C.card` root the extractor can find in that component) —
 * a site that vanished is a failure, not a vacuous pass.
 *
 * THE POSITIVE CONTROL IS WHAT KEEPS THIS SUITE FALSIFIABLE THE OTHER WAY: a
 * tree that lost every border wholesale — meaning-borders included — must go
 * red here, so «borderless» can never be satisfied by deleting the doctrine
 * along with the drift. The Lookalikes wrapper (conflictLine, §3: only
 * conflict/settled/advisory keep borders) is that control.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKER = 'CHUNK-A2-GREEN';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(root, p), 'utf8');

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };

/**
 * The slice runs from the component's own top-level declaration to the next
 * one, because Charts.jsx keeps an enumerated borderless card (CategoryCompare)
 * and a legitimately bordered one (PriorityLens) in the same file — a file-wide
 * pin could not tell the law from the exception.
 */
function componentSlice(text, name) {
  const decl = new RegExp(`^(?:export )?(?:default )?function ${name}\\b`, 'm').exec(text);
  if (!decl) return null;
  const rest = text.slice(decl.index + 1);
  const next = /^(?:export )?(?:default )?function /m.exec(rest);
  return text.slice(decl.index, next ? decl.index + 1 + next.index : text.length);
}

/**
 * The pinned unit is the style OBJECT holding the card's `background: C.card`,
 * extracted by balanced braces — not the component body, which legitimately
 * contains bordered controls and media edges the doctrine protects.
 */
function cardRootStyle(slice) {
  const anchor = slice.indexOf('background: C.card');
  if (anchor === -1) return null;
  let open = -1;
  for (let i = anchor, depth = 0; i >= 0; i--) {
    const ch = slice[i];
    if (ch === '}') depth++;
    else if (ch === '{') { if (depth > 0) depth--; else { open = i; break; } }
  }
  if (open === -1) return null;
  for (let i = open, depth = 0; i < slice.length; i++) {
    const ch = slice[i];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return slice.slice(open, i + 1); }
  }
  return null;
}

// `borderRadius` is geometry, not an edge; every other border-ish property is.
const BORDERED = /\bborder(?!Radius\b)[A-Za-z]*\s*:/;

function pinPlainCard(file, component, label) {
  const slice = componentSlice(src(file), component);
  ok(slice, `${label} — component ${component} exists in ${file}`);
  const style = slice && cardRootStyle(slice);
  ok(style, `${label} — its C.card root is present (the site did not vanish)`);
  if (!style) return;
  ok(!/shadow/i.test(style), `${label} — shadowless: luminance carries elevation, nothing else`);
  ok(!BORDERED.test(style), `${label} — borderless: a plain card taking an edge is the drift A2 exists to catch`);
}

// ——— the enumerated plain-card sites, one pin each
pinPlainCard('src/components/Charts.jsx', 'CategoryCompare', 'A2.1 Charts/CategoryCompare');
pinPlainCard('src/components/Charts.jsx', 'PeriodSummary', 'A2.2 Charts/PeriodSummary');
pinPlainCard('src/components/LogCard.jsx', 'LogCard', 'A2.3 LogCard');
pinPlainCard('src/views/InboxView.jsx', 'PendingCard', 'A2.4 Inbox/PendingCard');
pinPlainCard('src/views/ReceiptView.jsx', 'ReceiptView', 'A2.5 Receipt/main card');
pinPlainCard('src/views/ReceiptView.jsx', 'JobRow', 'A2.6 Receipt/JobRow');
pinPlainCard('src/views/BookView.jsx', 'Lookalikes', 'A2.7 Book/Lookalikes group card');
pinPlainCard('src/App.jsx', 'Skeleton', 'A2.8 App/Skeleton');

// ——— the doctrine the sites answer to must still be stated where the token
//     lives; a future hand reaching for `line` reads WHY before it can misuse it
const theme = src('src/theme.js');
ok(theme.includes('BORDERS THAT MEAN SOMETHING'),
  'A2.9 theme.js — the C.line doctrine comment stands');
ok(theme.includes('A plain content card taking this border again is the drift to catch'),
  'A2.9 theme.js — and it names the exact drift this gate watches for');
ok(theme.includes('conflictLine:') && theme.includes('settledLine:'),
  'A2.9 theme.js — the meaning-border vocabulary (conflictLine/settledLine) exists');

// ——— POSITIVE CONTROL: a state card that KEEPS its border
const lookalikes = componentSlice(src('src/views/BookView.jsx'), 'Lookalikes');
ok(lookalikes && BORDERED.test(lookalikes) && lookalikes.includes('C.conflictLine'),
  'A2.C control — the Lookalikes conflict wrapper still carries its conflictLine border; '
  + 'a tree that shed ALL borders (meaning included) must fail here, not pass');

if (failures.length) {
  console.log(`❌ CHUNK A2 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · plain cards ride luminance; line means something`);
