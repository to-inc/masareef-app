#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK B4b ═══════════
 * «Every ARRIVING advisory surface rides the ONE Sheet (B4's primitive:
 *  RADIUS.sheet lip, MOTION.page entrance at easeSettle, reduced-motion
 *  instant). Surfaces that render WITH their content are STATIC and exempt —
 *  by the Planner's MonthScreen-caveat ruling — and each verdict is
 *  documented at the site.» (chunk-ledger B4b; B4 residual 3.)
 *
 * THE RULED TEST, applied per site and pinned here so the verdicts cannot
 * drift from the code they judge:
 *   · ReceiptView's Banner — ARRIVES. Its dup.book instance mounts MID-FLOW
 *     when the server refuses a confirm (D18a's designed race): the review
 *     card is already painted and the banner appears into it on a state
 *     change. One component, one dress — splitting an arriving twin from a
 *     static twin would be the exact two-hand-rolled-entrances defect B4
 *     exists to kill.
 *   · App's StaleQueueCard — ARRIVES. `staleQueue` is recomputed after every
 *     outbox flush (reconnect, visibilitychange), so a card can appear above
 *     whatever he is reading while the app is open. It is OfflineBanner's
 *     sibling in position and grammar, and OfflineBanner already rides Sheet.
 *   · BatchReviewView's truncation note — STATIC. `truncated` derives from
 *     the jobs prop, which is settled before the view mounts (jobs change
 *     only from ReceiptView, which REPLACES this screen), so the note paints
 *     with the list and can never appear later. Exempt, documented.
 *
 * WHY SOURCE PINS *AND* RENDERS (B4's own reasoning, inherited): the motion
 * exists only at runtime, so consumption of the primitive is pinned in
 * source; the render half proves the settled state ships — class="sheet-in",
 * the RADIUS.sheet lip, the guard riding the markup, no translateY/opacity:0
 * on the element itself.
 *
 * A2'S LAW RIDES ALONG: no hand-rolled boxShadow and no in-file entrance
 * (@keyframes / animation:) anywhere in the three owned files.
 *
 * Every render is guarded — a component that THROWS surfaces as a NAMED
 * failure, never as a dead process (the N1/N1b lesson, house pattern).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { RADIUS } from '../src/theme.js';

const MARKER = 'CHUNK-B4b-GREEN';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(root, p), 'utf8');

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };

const receipt = src('src/views/ReceiptView.jsx');
const app = src('src/App.jsx');
const batch = src('src/views/BatchReviewView.jsx');

/** The component's own top-level slice — same extractor grammar as A2's. */
function componentSlice(text, name) {
  const decl = new RegExp(`^(?:export )?(?:default )?function ${name}\\b`, 'm').exec(text);
  if (!decl) return null;
  const rest = text.slice(decl.index + 1);
  const next = /^(?:export )?(?:default )?function /m.exec(rest);
  return text.slice(decl.index, next ? decl.index + 1 + next.index : text.length);
}

/**
 * The Sheet call's OWN style object — from `<Sheet` to the closing `}}` of its
 * style prop. The pinned claim is about the sheet surface, not about the
 * legitimate RADIUS.row buttons that live inside the card it wraps.
 */
function sheetStyle(slice) {
  const at = slice ? slice.indexOf('<Sheet') : -1;
  if (at === -1) return null;
  const close = slice.indexOf('}}', at);
  return close === -1 ? null : slice.slice(at, close + 2);
}

// ═══ 1. ReceiptView — the Banner ARRIVES, so it rides the Sheet ═══

ok(/import \{[^}]*\bSheet\b[^}]*\} from '\.\.\/components\/Primitives\.jsx'/.test(receipt),
  'B4b.1 ReceiptView imports the Sheet primitive — the adoption is a consumption, not a copy');

const bannerSlice = componentSlice(receipt, 'Banner');
ok(bannerSlice, 'B4b.2 the Banner component still exists in ReceiptView — the advisory surface did not vanish');
ok(bannerSlice && /<Sheet/.test(bannerSlice),
  'B4b.3 Banner mounts the Sheet — the hand-rolled sand box is retired; lip and entrance are the primitive\'s');
{
  const style = sheetStyle(bannerSlice);
  ok(style && style.includes('C.sand') && /border: `1px solid \$\{C\.line\}`/.test(style),
    'B4b.4 Banner keeps its sand fill AND its meaning border — advisory surfaces stay bordered by name (A2\'s doctrine); the sheet did not shed it');
  ok(style && !/borderRadius/.test(style),
    'B4b.5 Banner states no radius of its own — the RADIUS.sheet lip is the primitive\'s identity, never restated at a call site');
}
ok(/B4b VERDICT: ARRIVES[\s\S]{0,1400}function Banner/.test(receipt),
  'B4b.6 the ruled-test verdict is DOCUMENTED at the Banner site (a decided surface reads as decided)');

// ═══ 2. App — the StaleQueueCard ARRIVES, so it rides the Sheet ═══

ok(/import \{[^}]*\bSheet\b[^}]*\} from '\.\/components\/Primitives\.jsx'/.test(app),
  'B4b.7 App imports the Sheet primitive');

const staleSlice = componentSlice(app, 'StaleQueueCard');
ok(staleSlice, 'B4b.8 StaleQueueCard still exists in App.jsx');
ok(staleSlice && /<Sheet/.test(staleSlice),
  'B4b.9 StaleQueueCard mounts the Sheet — the second hand-rolled sand surface is retired');
{
  const style = sheetStyle(staleSlice);
  ok(style && style.includes('C.sand') && /border: `1px solid \$\{C\.line\}`/.test(style),
    'B4b.10 StaleQueueCard keeps sand + the meaning border under the sheet lip');
  ok(style && !/borderRadius/.test(style),
    'B4b.11 StaleQueueCard states no radius on the sheet surface — RADIUS.card is gone from it; the lip is the primitive\'s');
}
ok(/B4b VERDICT: ARRIVES[\s\S]{0,1400}function StaleQueueCard/.test(app),
  'B4b.12 the ruled-test verdict is DOCUMENTED at the StaleQueueCard site');

// ═══ 3. BatchReviewView — the truncation note is STATIC, exempt BY THE TEST ═══

const truncAt = batch.indexOf('{truncated && (');
ok(truncAt !== -1,
  'B4b.13 the truncation note still exists in BatchReviewView — silent truncation stays forbidden');
ok(truncAt !== -1 && /B4b VERDICT: STATIC/.test(batch.slice(Math.max(0, truncAt - 1200), truncAt)),
  'B4b.14 the exemption is DOCUMENTED at the site — the same ruled test the MonthScreen caveat footnote answered, applied honestly');
{
  const truncBlock = truncAt === -1 ? '' : batch.slice(truncAt, batch.indexOf('batchTruncated', truncAt) + 20);
  ok(truncBlock && !/<Sheet/.test(truncBlock),
    'B4b.15 …and a static surface takes NO entrance — a note that renders with its list must not pretend to arrive');
}

// ═══ 4. A2's law rides along — no hand-rolled chrome or motion in the three files ═══

for (const [name, text] of [['ReceiptView', receipt], ['BatchReviewView', batch], ['App', app]]) {
  ok(!/boxShadow|box-shadow/.test(text),
    `B4b.16 ${name} carries no boxShadow — luminance carries elevation (A2); an entrance is motion, not chrome`);
  ok(!/@keyframes|animation:/.test(text),
    `B4b.17 ${name} hand-rolls no entrance of its own — B4's Sheet (and B2's keyed .view-in) are the only ways a surface arrives`);
}

// ═══ 5. RENDERS — the adopted surfaces settle as sheets on paper ═══

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const html = (name, Comp, props, children) => {
    try {
      return renderToStaticMarkup(createElement(Comp, props, children));
    } catch (err) {
      failures.push(`${name} THREW while rendering — ${err && err.message}`);
      return '';
    }
  };
  const settled = (h) => h.replace(/<style>[\s\S]*?<\/style>/g, '');

  // ——— the Banner, exported for exactly this (the CategoryChips precedent)
  let Banner = null;
  try {
    ({ Banner } = await vite.ssrLoadModule('/src/views/ReceiptView.jsx'));
  } catch (err) {
    failures.push(`ReceiptView THREW while loading — ${err && err.message}`);
  }
  ok(typeof Banner === 'function',
    'B4b.18 Banner is exported — an advisory surface a suite cannot render alone is a surface nobody re-verifies');
  if (typeof Banner === 'function') {
    const b = html('Banner', Banner, { tone: 'warn' }, 'اتاخد قبل كده');
    ok(b.includes('اتاخد قبل كده') && b.includes('class="sheet-in"'),
      'B4b.19 Banner renders its warning ON the sheet surface (class="sheet-in")');
    ok(b.includes(`border-radius:${RADIUS.sheet}px`),
      `B4b.20 Banner's lip is RADIUS.sheet in the rendered style (border-radius:${RADIUS.sheet}px) — one step softer than the card it covers`);
    ok(b.includes('1px solid'),
      'B4b.21 the meaning border survives to the rendered markup');
    ok(b.includes('prefers-reduced-motion'),
      'B4b.22 the media guard SHIPS WITH the surface — the markup carries its own <style>, not a hope about a stylesheet');
    ok(b !== '' && !settled(b).includes('translateY') && !/opacity:\s*0[;"}]/.test(settled(b)),
      'B4b.23 the static render is the SETTLED state — the rise lives only in the keyframes; the element hides nothing');
  }

  // ——— the StaleQueueCard, same export-for-render doctrine
  let StaleQueueCard = null;
  try {
    ({ StaleQueueCard } = await vite.ssrLoadModule('/src/App.jsx'));
  } catch (err) {
    failures.push(`App THREW while loading — ${err && err.message}`);
  }
  ok(typeof StaleQueueCard === 'function',
    'B4b.24 StaleQueueCard is exported for standalone render');
  if (typeof StaleQueueCard === 'function') {
    const item = { id: 'x1', payload: { description: 'قهوة', amount: 60, entryDate: '11/8/2026' } };
    const c = html('StaleQueueCard', StaleQueueCard, { item, onSend: () => {}, onDrop: () => {} });
    ok(c.includes('قهوة') && c.includes('class="sheet-in"'),
      'B4b.25 StaleQueueCard renders the stale entry ON the sheet surface');
    ok(c.includes(`border-radius:${RADIUS.sheet}px`),
      'B4b.26 its lip is RADIUS.sheet in the rendered style — RADIUS.card retired on this surface');
    ok((c.match(/<button/g) || []).length === 2,
      'B4b.27 both of his decisions survive the adoption — send it, or drop it; the sheet changed the dress, never the choice');
    ok(c !== '' && !settled(c).includes('translateY') && !/opacity:\s*0[;"}]/.test(settled(c)),
      'B4b.28 settled on paper — no translateY, no opacity:0 outside the keyframes');
  }
} finally {
  await vite.close();
}

if (failures.length) {
  console.log(`❌ CHUNK B4b — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · every arriving advisory surface rides the one Sheet; the static one is ruled static, in writing`);
