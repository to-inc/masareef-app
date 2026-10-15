#!/usr/bin/env node
/**
 * ═══ GATE — THE REFACTORING UI PASS + TWO DEBUG SENDS (Tarek, 2026-10-16) ═══
 * «Build them all, and apply the debug screenshots.» One check per item, each
 * printed as «PASS <id>» so the ledger can name it. Every check is written to
 * FAIL on the code before this pass (see the controls noted beside each).
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { C } from '../src/theme.js';
import { readProgress, expectedReadMs, recordReadTime } from '../src/state/readTimes.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(root, p), 'utf8');
let pass = 0;
const failures = [];
const ok = (c, id, label) => { if (c) { pass++; console.log(`PASS ${id}`); } else failures.push(`${id} ${label}`); };
const h = (Comp, props) => renderToStaticMarkup(createElement(Comp, props));

// contrast maths (WCAG), for RUI.3
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

const vite = await createServer({ root, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const { S, WEEK_DAYS } = await vite.ssrLoadModule('/src/i18n/strings.js');
  const { PhotosBar, PhotosShortcut } = await vite.ssrLoadModule('/src/views/InboxView.jsx');
  const { TopCategories } = await vite.ssrLoadModule('/src/components/Charts.jsx');
  const { PeriodBlock } = await vite.ssrLoadModule('/src/views/BookView.jsx');
  const { SectionLabel, ReadProgress } = await vite.ssrLoadModule('/src/components/Primitives.jsx');
  const SettingsSheet = (await vite.ssrLoadModule('/src/views/SettingsSheet.jsx')).default;

  // ——— RUI.1 one card, not a card under a card (control: the old bar drew a second glass card when open)
  { const open = h(PhotosBar, { jobs: [], initialOpen: true });
    ok((open.match(/--glass-solid-card/g) || []).length === 1 && /data-photos-list/.test(open),
      'RUI.1', 'the open «Photos» list sits inside the SAME card as its header'); }

  // ——— RUI.2 nothing to draw, no card; a zero last week prints no «was 0» line
  { const zeros = Array(7).fill(0);
    const week = { cur: { Visa: [27, null, null, null, null, null, null], Cash: [0, null, null, null, null, null, null] }, prev: { Visa: zeros, Cash: zeros } };
    const html = h(PeriodBlock, { data: week, labels: WEEK_DAYS, liveIndex: 0, names: { cur: S.thisWeek, prev: S.lastWeek }, showBars: true, displayCurrency: 'EGP' });
    const words = S.periodJustStarted(S.thisWeek);
    ok(html.length > 200 && !html.includes(words) && !/<svg/.test(html),
      'RUI.2a', 'a week with one point draws no chart card («the chart appears after another day»)');
    const text2 = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    ok(!/(was|كان) 0/.test(text2), 'RUI.2b', 'a real zero last week prints no «was 0 — Last week» under the figure'); }

  // ——— RUI.3 grey text clears AA on the palest glass reading (control: #5C6871 → 4.22:1)
  { const worst = Math.min(ratio(C.muted, '#cde0ee'), ratio(C.muted, '#d3e4f0'));
    ok(worst >= 4.5 && ratio('#5C6871', '#cde0ee') < 4.5, 'RUI.3', `muted on chip glass over dawn ≥ 4.5:1 (got ${worst.toFixed(2)})`); }

  // ——— RUI.4 one category is all of it: no «100%»; two keep their shares
  { const one = h(TopCategories, { items: [{ name: 'Eating out', amount: 27 }], unit: '€' });
    const two = h(TopCategories, { items: [{ name: 'Eating out', amount: 27 }, { name: 'Groceries', amount: 9 }], unit: '€' });
    const text = (x) => x.replace(/<[^>]+>/g, ' ');
    ok(!/%/.test(text(one)) && /75%/.test(text(two)), 'RUI.4', 'a single category shows no «100%»; several still show their shares'); }

  // ——— RUI.5 headings lead by weight and ink, no dashed underline (control: DIVIDER's background-image)
  { const lab = h(SectionLabel, { children: 'Where it went' });
    ok(!/background-image/.test(lab) && /font-weight:700/.test(lab) && lab.includes(`color:${C.ink}`), 'RUI.5', 'section headings have no dashed rule, 700 ink'); }

  // ——— RUI.6 a fixed slot for the unit, so a column of amounts ends in one place
  { const book = src('src/views/BookView.jsx');
    ok(/const ROW_UNIT = \{[^}]*minWidth: '2\.2em'/.test(book) && (book.match(/\.\.\.ROW_UNIT/g) || []).length >= 2,
      'RUI.6', 'both list-row amounts give their unit the same fixed slot'); }

  // ——— RUI.7 one strong button on the receipt card: Cancel is a quiet text button
  { const rv = src('src/views/ReceiptView.jsx');
    const cancel = rv.slice(rv.indexOf('data-receipt-cancel'), rv.indexOf('{S.receiptCancel}', rv.indexOf('data-receipt-cancel')));
    ok(cancel.length > 0 && /background: 'transparent'/.test(cancel) && !/ghostBtn/.test(cancel), 'RUI.7', 'the review card\'s Cancel is a text button, not a second slab'); }

  // ——— RUI.8 the photos button carries its own state while a photo is read
  { const busy = h(PhotosShortcut, { jobs: [{ id: 'a', stage: 'reading', queuedAt: Date.now() }], onOpen() {} });
    const idle = h(PhotosShortcut, { jobs: [], onOpen() {} });
    ok(/data-photos-reading/.test(busy) && /aria-busy="true"/.test(busy) && !/data-photos-reading/.test(idle), 'RUI.8', 'a reading photo turns a ring around the button; idle shows none'); }

  // ——— D1 «Make it sticky»: the Settings title row stays at the top while the sheet scrolls
  { const html = h(SettingsSheet, { displayCurrency: 'EGP', onFlipCurrency() {}, onClose() {}, build: { actions: [] } });
    const head = html.slice(html.indexOf('data-settings-head'), html.indexOf('>', html.indexOf('data-settings-head')));
    ok(/position:sticky/.test(head) && /top:-6px/.test(head) && head.includes(`background:${C.card}`), 'D1', 'the Settings title + Close are pinned with a solid band'); }

  // ——— D2 «We need a progress bar»
  { const exp = 10000;
    const ps = [0, 2000, 5000, 10000, 30000, 300000].map((t) => readProgress(t, exp));
    const monotone = ps.every((p, i) => i === 0 || p >= ps[i - 1]);
    ok(monotone && ps[0] === 0 && Math.abs(ps[3] - 0.9) < 0.01 && ps[5] <= 0.95, 'D2a', `the estimate climbs, ~90% at the usual time, never «done» on its own (${ps.map((p) => p.toFixed(2)).join(' ')})`);
    const mem = new Map(); const store = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
    const before = expectedReadMs(store);
    [8000, 20000, 9000].forEach((ms) => recordReadTime(ms, store));
    ok(before === 12000 && expectedReadMs(store) === 9000, 'D2b', 'the usual time is the median of this phone\'s recent reads (12 s before any)');
    const bar = h(ReadProgress, { startedAt: Date.now(), expectedMs: 10000, label: 'Reading' });
    const rv = src('src/views/ReceiptView.jsx'); const inbox = src('src/views/InboxView.jsx');
    ok(/role="progressbar"/.test(bar) && /aria-valuenow="\d+"/.test(bar) && /<ReadProgress startedAt=\{workingSince\.current\}/.test(rv) && /stage === 'reading' && \(/.test(inbox),
      'D2c', 'the bar is on «Reading the receipt…» and under a reading photo in the list'); }
} finally {
  await vite.close();
}

if (failures.length) {
  console.log(`❌ refactor-ui — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ all ${pass} refactor-ui checks passed · one card per idea, no empty card, AA grey, quiet labels, aligned amounts, one strong button, a busy ring, a pinned Settings head, a reading bar`);
