#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK U3 ═══════════
 * «Batch review rows PRE-SELECT Card (06 §3.10.2 — a bank statement's rows are
 *  card/bank movements by definition, the Owner's 2026-08-27 ruling). The
 *  review screen SHOWS the method as a chip on every still-unwritten writable
 *  row, and a tap still overrides — the override rides `edits` into the ONE
 *  wire builder (`toConfirmRows`), which already consults `edited.method`.
 *  Nothing else in the batch flow moves (test-batch's 163 hold it).»
 *
 * THE ONE CLAIM THAT KEEPS THE CHIP HONEST: the chip must state EXACTLY what
 * the wire will send for that row. The view's `effectiveMethod` mirrors the
 * builder's expression (it cannot import it — the builder computes mid-loop),
 * and a mirror is only honest under an oracle that EXECUTES both sides over
 * the whole matrix and fails on the first divergence. That matrix is §1 below;
 * it is the anti-drift pin, not the render.
 *
 * EVERY lookup is guarded and every render is wrapped — a missing export
 * surfaces as a NAMED failure with the run continuing, never a dead process.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { mergeJobs, toConfirmRows, rowKey } from '../src/state/batchDraft.js';
import { METHODS } from '../src/state/entryPayload.js';
import { AR } from '../src/i18n/strings.ar.js';
import { EN } from '../src/i18n/strings.en.js';

const MARKER = 'CHUNK-U3-GREEN';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };
const eq = (a, b, label) => {
  if (Object.is(a, b)) { pass++; return; }
  failures.push(`${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const at = (fn, label) => {
  try { return fn(); } catch (err) { failures.push(`${label}\n      THREW — ${err && err.message}`); return undefined; }
};
const str = (loc, k) =>
  (loc && typeof loc[k] === 'string' && loc[k].length > 0 ? loc[k] : null);

const row = (over = {}) => ({
  date: '2026-08-14', amount: 12.4, currency: 'EUR', row_status: 'completed',
  merchant_display: 'Almond Tree Bakery', payment_hint: 'card', ...over,
});

// ═══ 0. THE WORDS EXIST — both locales, and they differ ═══

ok(str(AR, 'methodCard') !== null && str(EN, 'methodCard') !== null
  && str(AR, 'methodCash') !== null && str(EN, 'methodCash') !== null,
  'U3.1 methodCard/methodCash exist as non-empty strings in BOTH locales');
ok(str(AR, 'methodCard') !== str(AR, 'methodCash'),
  'U3.2 the two method words are two words — a chip that cannot differ states nothing');

// ═══ 1. THE MIRROR AGREEMENT — the chip's answer IS the wire's, executed ═══

let effectiveMethod = null;
let viewMod = null;
const vite = await createServer({
  root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error',
});
try {
  try {
    viewMod = await vite.ssrLoadModule('/src/views/BatchReviewView.jsx');
    effectiveMethod = viewMod.effectiveMethod;
  } catch (err) {
    failures.push(`BatchReviewView THREW while loading — ${err && err.message}`);
  }
  ok(typeof effectiveMethod === 'function',
    'U3.3 the view EXPORTS effectiveMethod — a chip whose rule a suite cannot execute is a chip nobody re-verifies');

  if (typeof effectiveMethod === 'function') {
    let agreements = 0; let checked = 0; const diverged = [];
    for (const hint of ['card', 'cash', 'unknown', undefined]) {
      for (const dm of [null, 'Cash', 'Visa']) {
        for (const edit of [undefined, { method: 'Cash' }, { method: 'Visa' }]) {
          const rows = mergeJobs([{ sourceHash: 'p', defaultMethod: dm, entries: [
            row({ payment_hint: hint }),
          ] }]);
          const key = rowKey(rows[0]);
          const wire = at(
            () => toConfirmRows(rows, { [key]: true }, edit ? { [key]: edit } : {})[0].method,
            `U3.4 wire ${hint}/${dm}/${edit && edit.method}`,
          );
          const chip = at(
            () => effectiveMethod(rows[0], edit),
            `U3.4 chip ${hint}/${dm}/${edit && edit.method}`,
          );
          checked++;
          if (chip === wire && METHODS.indexOf(chip) !== -1) agreements++;
          else diverged.push(`${hint}/${dm}/${edit && edit.method}: chip=${chip} wire=${wire}`);
        }
      }
    }
    eq(agreements, checked,
      `U3.4 the chip states EXACTLY what the wire will send, across the hint × defaultMethod × edit matrix, always a WIRE value (diverged: ${diverged.join(' · ') || 'none'})`);

    // The ruling itself, by name, at the rule:
    eq(at(() => effectiveMethod(mergeJobs([{ sourceHash: 'p', entries: [row({ payment_hint: 'unknown' })] }])[0], undefined), 'U3.5'),
      'Visa',
      'U3.5 an unhinted statement row PRE-SELECTS Card — a bank statement\'s rows are card movements by definition (§3.10.2)');
    eq(at(() => effectiveMethod(mergeJobs([{ sourceHash: 'p', entries: [row({ payment_hint: 'cash' })] }])[0], undefined), 'U3.6'),
      'Cash',
      'U3.6 an explicit cash hint still outranks the ruling\'s default — evidence beats presumption (D19/D25), and the chip says so');
    eq(at(() => effectiveMethod(mergeJobs([{ sourceHash: 'p', entries: [row()] }])[0], { method: 'Cash' }), 'U3.7'),
      'Cash',
      'U3.7 his override IS the chip\'s answer — the tap he took is the method the row will write');
  }

  // ═══ 2. THE CHIP RENDERS — visible without expanding, only where it is live ═══

  const BatchReviewView = viewMod && viewMod.default;
  const render = (props) => {
    try {
      return renderToStaticMarkup(createElement(BatchReviewView, {
        jobs: [], busy: false, onConfirm: () => {}, onResnap: () => {},
        onDiscard: () => {}, onLeave: () => {}, ...props,
      }));
    } catch (err) {
      failures.push(`BatchReviewView THREW while rendering — ${err && err.message}`);
      return '';
    }
  };
  /** The method chips on screen: buttons whose entire text is a method word. */
  const chips = (h) => {
    const out = [];
    const re = /<button[^>]*>([^<]*)<\/button>/g;
    for (let m = re.exec(h); m; m = re.exec(h)) {
      if (m[1] === str(AR, 'methodCard') || m[1] === str(AR, 'methodCash')) out.push(m[1]);
    }
    return out;
  };

  if (typeof BatchReviewView === 'function') {
    const jobs = [{ sourceHash: 'p', entriesTotal: 4, entries: [
      row({ merchant_display: 'Rosewater Coffee', amount: 4.8 }),
      row({ merchant_display: 'Harbour Baths', amount: 163, row_status: 'declined' }),
      row({ merchant_display: 'Old Pier Deli', amount: 8.5, payment_hint: 'cash' }),
      row({ merchant_display: 'Tram Kiosk', amount: 21.3, payment_hint: 'unknown' }),
    ] }];
    const html = render({ jobs });
    const got = chips(html);

    eq(got.length, 3,
      `U3.8 one chip per WRITABLE row, on the collapsed row — the declined row gets none (a method on money that will not move is a control about nothing); got ${JSON.stringify(got)}`);
    eq(got.filter((c) => c === str(AR, 'methodCard')).length, 2,
      'U3.9 the card-hinted and the unhinted rows both read «فيزا» — Card pre-selected, visibly');
    eq(got.filter((c) => c === str(AR, 'methodCash')).length, 1,
      'U3.10 the cash-hinted row reads «كاش» — the chip renders the row\'s OWN answer, not one word for the list');
    eq((html.match(/role="checkbox"/g) || []).length, 3,
      'U3.11 the chip did not disturb the ticks: three checkboxes for three writable rows, and the chip is not one of them');

    // Settled: an answered row's method is frozen; a never-sent row keeps its chip.
    const sent = [{ sourceHash: 'p', index: 0 }, { sourceHash: 'p', index: 2 }];
    const settled = render({ jobs, results: { written: 2, skipped: 0, errored: 0, sent, results: [
      { index: 0, status: 'written' }, { index: 2, status: 'written' },
    ] } });
    eq(chips(settled).length, 1,
      'U3.12 after a settle only the never-sent writable row keeps its chip — a written row\'s method is a fact in his book, not a control');

    const exp = render({ jobs, expired: true });
    eq(chips(exp).length, 0,
      'U3.13 the expired surface offers no method chips — there is no confirmable list to speak for');
  }
} finally {
  await vite.close();
}

// ═══ 3. THE OVERRIDE WIRING — source-pinned where SSR cannot tap ═══

const src = (() => {
  try {
    return readFileSync(join(root, 'src/views/BatchReviewView.jsx'), 'utf8');
  } catch { return null; }
})() || '';

ok(/onMethod=\{\(m\) => setEdits\(\(e\) => \(\{ \.\.\.e, \[rowKey\(r\)\]: \{ \.\.\.\(e\[rowKey\(r\)\] \|\| \{\}\), method: m \} \}\)\)\}/.test(src),
  'U3.14 the chip\'s tap writes `method` into the SAME edits overlay the category picker uses — one draft, one wire builder');
ok(/otherMethod\(/.test(src) && /=> \(m === 'Visa' \? 'Cash' : 'Visa'\)/.test(src),
  'U3.15 the tap FLIPS between the two wire values by name — a two-value chooser needs one tap, not a menu');
ok(/onMethod\(otherMethod\(method\)\)/.test(src),
  'U3.16 …and the flip starts from the row\'s EFFECTIVE method, so the first tap always reverses what he sees');
ok(/effectiveMethod\(row, edit\)/.test(src),
  'U3.17 the rendered chip and the flip read the one effectiveMethod — never a second computation of the default');
ok(/methodLabel\(/.test(src) && !/'فيزا'|'كاش'/.test(src),
  'U3.18 the chip\'s word is a LOOKUP (methodCard/methodCash) — the label is never the value, the value never the label');
{
  const mirror = /const effectiveMethod = \(row, edit\) =>[\s\S]{0,200}payment_hint === 'cash' \? 'Cash' : \(row\.defaultMethod \|\| 'Visa'\)/.test(src)
    || /function effectiveMethod\(row, edit\)[\s\S]{0,220}payment_hint === 'cash' \? 'Cash' : \(row\.defaultMethod \|\| 'Visa'\)/.test(src);
  ok(mirror,
    'U3.19 effectiveMethod mirrors the builder\'s expression verbatim — and §1\'s executed matrix is what keeps the mirror honest');
}
ok(/!settled && writable &&[\s\S]{0,300}onMethod\(otherMethod\(method\)\)/.test(src),
  'U3.20 the chip is GATED on `!settled && writable` in source — the same live/frozen line the tick draws, stated once at the control');

if (failures.length) {
  console.log(`❌ CHUNK U3 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · every writable batch row shows its method pre-selected to Card, the chip agrees with the wire, and one tap overrides`);
