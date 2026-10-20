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
    // 2026-10-18 (debug a7421763): a straight line timed to the usual read — 95% at that time, then held.
    ok(monotone && ps[0] === 0 && Math.abs(ps[1] - 0.19) < 0.01 && Math.abs(ps[3] - 0.95) < 0.01 && ps[5] === 0.95, 'D2a', `the bar runs straight to 95% at the usual time and holds (${ps.map((p) => p.toFixed(2)).join(' ')})`);
    const mem = new Map(); const store = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
    const before = expectedReadMs(store);
    [8000, 20000, 9000].forEach((ms) => recordReadTime(ms, store));
    ok(before === 12000 && expectedReadMs(store) === 9000, 'D2b', 'the usual time is the median of this phone\'s recent reads (12 s before any)');
    const bar = h(ReadProgress, { startedAt: Date.now(), expectedMs: 10000, label: 'Reading' });
    const rv = src('src/views/ReceiptView.jsx'); const inbox = src('src/views/InboxView.jsx');
    ok(/role="progressbar"/.test(bar) && /aria-valuenow="\d+"/.test(bar) && /<ReadProgress startedAt=\{workingSince\.current\}/.test(rv) && /stage === 'reading' && \(/.test(inbox),
      'D2c', 'the bar is on «Reading the receipt…» and under a reading photo in the list'); }
  // ——— AUTO: a refused or unreadable photo files itself into «Debug screenshots» (2026-10-16)
  { const { shouldFile, fileFailedRead } = await vite.ssrLoadModule('/src/state/autoDebug.js');
    ok(shouldFile({ stage: 'notReceipt' }) && shouldFile({ stage: 'failed', error: 'bad_extraction' })
      && !shouldFile({ stage: 'failed', error: 'offline' }) && !shouldFile({ stage: 'ready' }),
      'AUTO.1', 'refusals and broken reads are filed; offline retries and good reads are not');
    const mem = new Map(); const store = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
    const sent = [];
    const opts = { store, build: { actions: ['debug_shot', 'debug_note'] },
      note: async (b) => { sent.push(['note', b.note, b.batch]); return { ok: true }; },
      shot: async (b) => { sent.push(['shot', b.batch, b.index]); return { ok: true }; } };
    const job = { clientHash: 'abc123def456', base64: 'QUJD', mediaType: 'image/jpeg' };
    const res = { ok: true, extraction: { doc_type: 'not_expense', not_expense_reason: 'pending_or_declined', merchant_display: 'Smartum' } };
    const first = await fileFailedRead(job, { stage: 'notReceipt' }, res, opts);
    const again = await fileFailedRead(job, { stage: 'notReceipt' }, res, opts);
    const off = await fileFailedRead({ ...job, clientHash: 'zzz' }, { stage: 'notReceipt' }, res, { ...opts, build: { actions: [] } });
    ok(first && !again && !off && sent.length === 2 && /pending_or_declined/.test(sent[0][1]) && /Smartum/.test(sent[0][1]) && sent[1][1] === sent[0][2],
      'AUTO.2', `filed once (note + photo in one batch), never twice, never on a server without the verbs (${JSON.stringify(sent)})`); }
  // ——— WEEK (debug ba90a13a, 2026-10-18): Monday weeks, day buttons, a new week opens on last week
  { const { WeekDays } = await vite.ssrLoadModule('/src/views/BookView.jsx');
    const html = h(WeekDays, { today: { y: 2026, m: 10, d: 18 }, pick: 'last', onPick() {} });
    const labels = [...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]);
    ok(labels.length === 16 && labels[0] === S.thisWeek && labels[1] === S.lastWeek && labels[2] === S.dayToday && labels[3] === S.dayYesterday
      && /aria-pressed="true"[^>]*>[^<]*<\/button>/.test(html) && (html.match(/aria-pressed="true"/g) || []).length === 1,
      'W1', `This week · Last week · Today · Yesterday · then two weeks of days, one chosen (${labels.slice(0, 5).join(' | ')} …)`);
    const book = src('src/views/BookView.jsx');
    ok(/const weekStart = data\.week && data\.week\.startDow === 1 \? 1 : 0;/.test(book) && /labels=\{weekLabels\}/.test(book)
      && /liveWeekIndex === 0 && dayPick === null/.test(book) && /filterEntries\(all, period === 'week' \? 'fortnight' : period, today, weekStart\)/.test(book),
      'W2', 'the week follows the server\'s start day, reads the fortnight, and opens on last week on its first day'); }

  // ——— SEND BAR (debug 8a33117f): «2 of 3» is a bar, and no folder sentence under the button
  { const st = src('src/views/SettingsSheet.jsx');
    ok(/data-send-progress/.test(st) && !/debugShotsHelp/.test(st) && !/readUsually/.test(src('src/views/ReceiptView.jsx')),
      'D3', 'sending shows a 1-of-N bar; the «they go to the folder» line and «usually N seconds» are gone'); }
  // ═══ BUILD-ALL (2026-10-18: «yes build all of them») ═══
  { const app = src('src/App.jsx'); const book = src('src/views/BookView.jsx');
    ok(/if \(Date\.now\(\) - lastRead\.current > 60000\) refresh\(\);/.test(app) && /lastRead\.current = Date\.now\(\);/.test(app),
      'E3', 'coming back to the app within a minute does not re-read the summary');
    ok(/if \(data\.month && data\.month\.tab\) \{ setLiveTab\(data\.month\.tab\); return undefined; \}/.test(book),
      'E4', 'the month\'s tab name comes from the summary — no extra call');
    ok(/const BOOK_MONTHS = new Map\(\);/.test(book) && /useRef\(BOOK_MONTHS\)/.test(book) && /BOOK_LAST\.period = p/.test(book) && /@\$\{data\.serverTime/.test(book),
      'E5', 'the Book keeps its rows and period across tab switches; the current month only for the summary it was read beside');
    ok(/res\.build && Array\.isArray\(res\.build\.actions\)/.test(app) && /masareef\.keptSyncedAt/.test(app) && /!\(lastBuildFromSummary\.current\)/.test(app),
      'E9', 'the summary brings the build (ping only as a fallback); the kept list syncs once a day'); }

  { const { enqueueFiles } = await vite.ssrLoadModule('/src/state/receiptRunner.js');
    const { ReceiptImageError } = await vite.ssrLoadModule('/src/lib/receipt-image.js');
    const queued = []; let pumped = 0;
    const prep = { prepareReceipt: async (f) => { if (f.big) throw new ReceiptImageError('too-large'); return { base64: 'QUJD', clientHash: f.name }; },
      prepareDocument: async (f) => ({ base64: 'UERG', clientHash: f.name, mediaType: 'application/pdf' }) };
    const q = { enqueue: async (j) => { queued.push(j); return true; } };
    const r = await enqueueFiles([{ name: 'a', type: 'image/jpeg' }, { name: 'b', type: 'application/pdf' }, { name: 'c', type: 'image/jpeg', big: true }], { prep, q, pump: () => { pumped++; } });
    ok(r.queued === 2 && r.refused === 'too-large' && pumped === 1 && queued[1].mediaType === 'application/pdf' && /^\d{4}-\d{2}-\d{2}$/.test(queued[0].snapDate),
      'UX1', `photos and PDFs are queued and read behind him; a refusal is named (${JSON.stringify(r)})`);
    const app = src('src/App.jsx');
    ok(/closeEntry\(\);\s*showToast\(S\.readingBehind\(n\)\);/.test(app) && /showToast\(S\.photoReady\(fresh\.length\)\)/.test(app),
      'UX1b', 'choosing a receipt closes the sheet at once; a ready receipt is announced'); }

  { const Inbox = (await vite.ssrLoadModule('/src/views/InboxView.jsx')).default;
    const base = { pending: [], settled: {}, onConfirm() {}, photosOpen: false, onPhotosToggle() {} };
    const empty = h(Inbox, { ...base, photos: [] });
    const waiting = h(Inbox, { ...base, photos: [{ id: 'x', stage: 'ready', queuedAt: 1, extraction: { amount: 4 } }] });
    ok(/data-all-logged/.test(empty) && !/data-all-logged/.test(waiting), 'UX4', '«All logged» only when no photo needs him'); }

  { const { JobsList } = await vite.ssrLoadModule('/src/views/ReceiptView.jsx');
    const job = { id: 'n', stage: 'notReceipt', queuedAt: 1, base64: 'QUJD', notExpenseReason: 'other' };
    const html = h(JobsList, { jobs: [job], onReview() {}, onRetry() {}, onCancel() {}, onDebugLog: null, onManual() {} });
    const btns = [...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]).filter((t) => t && t !== '✕');
    ok(btns[0] === S.jobByHand && btns.includes(S.jobReadAgain) && !btns.includes(S.debugLogSend) && !btns.includes(S.jobWhy),
      'UX5', `a failed read leads with «Enter it by hand»; no flag where reads file themselves (${btns.join(' | ')})`); }

  { const html = h(SettingsSheet, { displayCurrency: 'EUR', onFlipCurrency() {}, onClose() {}, build: { actions: ['debug_shot', 'debug_note'] } });
    const groups = (html.match(/<details data-settings-group/g) || []).length;
    ok(groups === 4 && /<details data-settings-group="true" open=""/.test(html) && (html.match(/ open=""/g) || []).length === 1,
      'SET', `Settings is four one-line groups, Currency & language open (${groups})`); }

  { const { CountUp } = await vite.ssrLoadModule('/src/components/Primitives.jsx');
    ok(h(CountUp, { value: 27.5, format: (v) => v.toFixed(2) }) === '27.50', 'M1', 'the figure renders its real value at rest (the roll happens only between values)');
    const css = src('src/styles.css'); const charts = src('src/components/Charts.jsx'); const book = src('src/views/BookView.jsx');
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    ok(/className="bar-rise"/.test(charts) && /className="fill-in"/.test(charts) && /className=\{r\.held \? 'row-land'/.test(book) && /data-week-pill/.test(book) && /\.read-bar::after/.test(css)
      && ['.bar-rise', '.fill-in', '.row-land', '.read-bar::after'].every((c) => reduced.includes(c)),
      'M2-6', 'bars rise, shares fill, a logged row lands, the day pill slides, the reading bar sheens — and Reduce Motion stops all of them'); }

  { const { PriorityIcon } = await vite.ssrLoadModule('/src/views/BookView.jsx');
    const { GLASS } = await import('../src/theme.js');
    ok(/<svg[^>]*stroke-width="1\.8"/.test(h(PriorityIcon, { k: 'joy' })) && !/[🏠🩺🎈🧰]/u.test(src('src/views/BookView.jsx'))
      && GLASS.plate && !GLASS.plate.cast && GLASS.plate.bg === GLASS.card.bg && /glass\('plate'\)/.test(src('src/components/Charts.jsx')),
      'UI', 'line icons replace the emoji; secondary panels sit on the flat «plate» (same glass, no lift)'); }
  // ═══ DEBUG SENDS 18 Oct ═══
  { const book = src('src/views/BookView.jsx'); const charts = src('src/components/Charts.jsx');
    ok(/weekPick=\{typeof dayPick === 'number'/.test(book) && /if \(weekPick == null\) return r && r\.a === r\.b \? null : r;/.test(charts) && /data-pick-card/.test(book) && /S\.pickCount\(picked\.length\)/.test(book),
      'D4', '«Not updating»: a picked day lights its bar and a card says its total and count');
    const html = h(SettingsSheet, { displayCurrency: 'EUR', onFlipCurrency() {}, onClose() {}, build: { actions: [] } });
    ok((html.match(/class="set-chev"/g) || []).length === 4 && /<summary class="catchip"/.test(html) && /\[data-settings-group\]\[open\] \.set-chev/.test(src('src/styles.css')),
      'D5', '«Doesn\'t look like a button»: each group row is a button with a chevron disc that turns when open');
    ok(/backdropFilter: 'none', WebkitBackdropFilter: 'none'/.test(book), 'D6', 'the day buttons draw no dark ring inside the fading rail');
    ok(/Math\.floor\(\(\(e\.clientX - r\.left\) \/ r\.width\) \* 7\)/.test(charts) && /onRangeTap\(i\);/.test(charts), 'U-dead', 'the week\'s line chart picks the day under the finger (the diary\'s dead taps)'); }
  // ═══ THE DAY LEDGER (2026-10-18, «build the day ledger») ═══
  { const { DayHeader } = await vite.ssrLoadModule('/src/views/BookView.jsx');
    const today = { y: 2026, m: 10, d: 18 };
    const amt = (rows) => ({ sum: rows.length * 10, unit: '€' });
    const t = h(DayHeader, { dk: 20261018, rows: [1, 2], today, dayAmount: amt, first: true });
    const yd = h(DayHeader, { dk: 20261017, rows: [1], today, dayAmount: amt });
    const fri = h(DayHeader, { dk: 20261016, rows: [], today, dayAmount: () => null });
    const plain = (x) => x.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    ok(plain(t).startsWith(S.dayToday) && /20 €/.test(plain(t)) && plain(yd).startsWith(S.dayYesterday) && /16/.test(plain(fri)) && !/\b10\b/.test(plain(fri))
      && /position:sticky/.test(t) && /role="heading"/.test(t),
      'L1', `a pinned header names the day — ${plain(t)} | ${plain(yd)} | ${plain(fri)}`);
    const book = src('src/views/BookView.jsx');
    ok(/const header = dayHeaders && \(i === 0 \|\| dk !== prevDk\)/.test(book) && /<Fragment key=\{key\}>/.test(book) && /overflow: 'clip'/.test(book)
      && /dayHeaders=\{period !== 'today' && sortBy === 'date'\}/.test(book),
      'L2', 'the Week and Month lists break into days where the day changes, under headers that can pin');
    const fil = book.slice(book.indexOf('<details data-book-filter'), book.indexOf('</details>', book.indexOf('<details data-book-filter')));
    ok(fil.length > 0 && /PRIORITY_GROUPS\.map/.test(fil) && /\['date', 'amount', 'name'\]\.map/.test(fil) && /S\.filterLabel/.test(fil),
      'L3', 'sort and the four priorities sit behind one «Filter» button that says what is on'); }
  // ═══ «proceed with all» (2026-10-20) ═══
  { const charts = src('src/components/Charts.jsx'); const book = src('src/views/BookView.jsx'); const css = charts;
    ok(/data-tide d=\{/.test(charts) && /fillOpacity="0\.16"/.test(charts) && /strokeDasharray="4 4"/.test(charts) && /\.tide-fill \{ animation: tide-fill/.test(css) && /\.chart-draw, \.tide-fill \{ animation: none; \}/.test(css),
      'T1', 'the tide: the running total as a soft area against last period\'s dashed line; stops under Reduce Motion');
    ok(!/fontSize: TYPE\.section, fontWeight: 650, color: C\.ink, lineHeight: 1\.3, marginTop: 2 \}\}>\s*\{headWords\}/.test(book) && /const firstDayOfWeek = labels\.length === 7 && liveIndex === 0;/.test(book) && /\{firstDayOfWeek \? null : cmpShown \?/.test(book),
      'F1', 'the figure leads; the comparison is one small line under it, and none on a week\'s first day');
    ok(/data-book-reading/.test(book) && /S\.photosBusyTitle\(busy\)/.test(book) && /photoJobs=\{photoJobs\} onOpenPhotos=/.test(src('src/App.jsx')),
      'R1', 'the Book says when a photo is being read, and opens Photos from there'); }
} finally {
  await vite.close();
}

if (failures.length) {
  console.log(`❌ refactor-ui — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ all ${pass} refactor-ui checks passed · one card per idea, no empty card, AA grey, quiet labels, aligned amounts, one strong button, a busy ring, a pinned Settings head, a reading bar`);
