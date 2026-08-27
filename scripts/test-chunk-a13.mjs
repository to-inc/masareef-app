#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK A13 ═══════════   `node scripts/test-chunk-a13.mjs`
 *
 * «The year axis speaks full month names to screen readers.» (chunk ledger
 * A13 — charts leaf residual 8: the year chart's tappable month labels take
 * their aria-labels from MONTH_LABELS initials, and in Arabic ي×3, أ×3, م×2
 * collide — a screen reader hears three indistinguishable «ي» buttons.)
 *
 * THE CLAIM, IN THREE PARTS:
 *  · every year-axis button carries a UNIQUE, FULL-WORD accessible name, in
 *    BOTH locales, said through the app's own month vocabulary (monthByTab —
 *    no new i18n key);
 *  · the VISUAL initials do not change — A12's thinning is visual law, and
 *    this chunk touches only the spoken layer;
 *  · the words arrive from the year PeriodBlock CALL SITE (BookView), through
 *    PeriodBlock → PeriodSummary → PairedBars' optional `ariaLabels`, with
 *    the visible label as the fallback where no words are handed down.
 *
 * HOW THE YEAR SCREEN IS REACHED. The year lives behind a tab press SSR
 * cannot make, and three of this project's bugs were correct components
 * mounted with the wrong props — the class a source regex cannot see. So
 * BookView takes an `initialPeriod` seed (initialPriorityFilter's exact
 * pattern, for its exact reason) and this suite renders the REAL screen; the
 * exported PeriodBlock render below it proves the thread, and the source pins
 * hold the call site to the words. Every detector proves itself on seeded
 * input first (the A6/A12/E1 discipline).
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';

const MARKER = 'CHUNK-A13-GREEN';

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };

/** Comment stripper (the construction test-chunk-a6 proved). */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/** From `export function <name>` to the next top-level export (a12's slicer). */
const sliceOf = (text, name) => {
  const decl = new RegExp(`^export (?:const |function )${name}\\b`, 'm').exec(text);
  if (!decl) return '';
  const rest = text.slice(decl.index + 1);
  const next = /^export (?:const|function) /m.exec(rest);
  return text.slice(decl.index, next ? decl.index + 1 + next.index : text.length);
};

/**
 * THE AXIS BUTTONS, in axis order: every <button> carrying BOTH aria-pressed
 * (E1's range controls) and aria-label (the spoken name). On the year screen
 * that set is exactly the twelve axis columns — the metric cards and the
 * period segmented control carry aria-pressed but no aria-label, so they
 * stay out by construction rather than by position. Each comes back with its
 * accessible name and its VISIBLE text (tags stripped), so one pass reads
 * both layers of the same control.
 */
const axisButtons = (html) => {
  const out = [];
  const re = /<button ([^>]*)>([\s\S]*?)<\/button>/g;
  let m;
  while ((m = re.exec(html))) {
    if (!/aria-pressed="/.test(m[1])) continue;
    const al = /aria-label="([^"]*)"/.exec(m[1]);
    if (!al) continue;
    out.push({ label: al[1], text: m[2].replace(/<[^>]+>/g, '').trim() });
  }
  return out;
};

/** The duplicated names, said with their counts — the red run's evidence. */
const dupesIn = (labels) => {
  const seen = new Map();
  for (const l of labels) seen.set(l, (seen.get(l) || 0) + 1);
  return [...seen].filter(([, n]) => n > 1).map(([l, n]) => `«${l}»×${n}`).join(' ');
};

// ——— controls: the extractor proves itself on seeded input first.
{
  const seeded = '<button aria-pressed="false" aria-label="يناير" style="x"><div></div><div>ي</div></button>'
    + '<button aria-pressed="true" style="x">الكل</button>'
    + '<button aria-label="تحديث" style="x">↻</button>';
  const got = axisButtons(seeded);
  ok(got.length === 1 && got[0].label === 'يناير' && got[0].text === 'ي',
    'control — the extractor takes only buttons carrying BOTH aria-pressed and aria-label, and reads both layers');
  ok(dupesIn(['ي', 'ف', 'ي', 'ي']) === '«ي»×3',
    'control — the duplicate reporter counts a seeded collision');
}

/** The server's tab vocabulary (docs/02) — data, not prose; slot i = month i+1. */
const TABS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * ═══ THE RENDER PROOF, ONCE PER LOCALE ═══
 *
 * One vite server per language (e7's sweep pattern — the locale binds at
 * module load, so each language is its own module graph).
 */
async function sweep(lang, anchor) {
  globalThis.localStorage = { getItem: () => lang, setItem() {} };
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  try {
    const mod = await vite.ssrLoadModule('/src/views/BookView.jsx');
    const BookView = mod.default;
    const { PeriodBlock } = mod;
    const { PairedBars } = await vite.ssrLoadModule('/src/components/Charts.jsx');
    const { MONTH_LABELS, monthByTab } = await vite.ssrLoadModule('/src/i18n/strings.js');

    /**
     * The words the axis should SPEAK: the locale's own month vocabulary,
     * index-aligned with the axis. Anchored to one literal per language so a
     * vocabulary that itself degraded to initials could not certify this
     * chunk against itself.
     */
    const expected = TABS.map((t) => monthByTab(t));
    ok(expected[0] === anchor,
      `[${lang}] the vocabulary is real — monthByTab('Jan') is «${anchor}» (got «${expected[0]}»)`);
    ok(new Set(expected).size === 12,
      `[${lang}] the twelve month words are twelve DISTINCT words`);
    ok(expected.every((w, i) => w.length >= 3 && w !== MONTH_LABELS[i]),
      `[${lang}] every word is a FULL word — never the initial the visual layer shows`);

    /**
     * ——— (a) THE REAL SCREEN: BookView, seeded onto the year tab. This is
     * the render he gets, so it is the render the claim is about.
     */
    const LIVE = 7; // August mid-flight: today_cairo m=8 → liveIndex 7
    const payload = {
      today_cairo: { y: 2026, m: 8, d: 17 },
      today: {
        entries: [{ date: '17/8/2026', description: 'Nile Star Market', method: 'Visa', category: 'Groceries', amount: 100, currency: 'EGP' }],
        totals: { Visa: 100, Cash: 0 },
      },
      week: { cur: { Visa: [1], Cash: [1] }, prev: { Visa: [1], Cash: [1] } },
      month: {
        cur: { Visa: [1], Cash: [1] }, prev: { Visa: [1], Cash: [1] },
        names: { cur: 'August', prev: 'July' },
      },
      year: {
        cur: {
          Visa: [110, 120, 130, 140, 150, 160, 170, 180, null, null, null, null],
          Cash: [10, 20, 30, 40, 50, 60, 70, 80, null, null, null, null],
        },
        prev: { Visa: Array(12).fill(100), Cash: Array(12).fill(50) },
      },
      monthCats: [], pending: [],
    };
    let screen = '';
    try {
      screen = renderToStaticMarkup(createElement(BookView, { data: payload, initialPeriod: 'year' }));
    } catch (err) {
      failures.push(`[${lang}] BookView THREW rendering the seeded year screen — ${err && err.message}`);
    }
    const onScreen = axisButtons(screen);
    ok(onScreen.length === 12,
      `[${lang}] A13.1 the seeded year SCREEN carries twelve axis controls — found ${onScreen.length} (initialPeriod seam + call site)`);
    const heard = onScreen.map((b) => b.label);
    ok(onScreen.length === 12 && new Set(heard).size === 12,
      `[${lang}] A13.2 every axis button's accessible name is UNIQUE — a reader must never hear two controls as one (heard: ${dupesIn(heard) || heard.join(' ')})`);
    ok(onScreen.length === 12 && heard.every((l, i) => l === expected[i]),
      `[${lang}] A13.3 each accessible name is the FULL month word, in axis order (got: ${heard.join(' · ') || 'none'})`);
    ok(onScreen.length === 12 && onScreen.every((b, i) => b.text === (i === LIVE ? '•' : MONTH_LABELS[i])),
      `[${lang}] A13.4 the VISUAL layer is untouched — initials on every slot, «•» on the live one (A12's law; got: ${onScreen.map((b) => b.text || '∅').join(' ')})`);

    /**
     * ——— (b) THE THREAD: the exported PeriodBlock hands `ariaLabels` down
     * through PeriodSummary to PairedBars. Rendered with the words this
     * suite built, so a break anywhere in the chain reads as initials here.
     */
    let pb = '';
    try {
      pb = renderToStaticMarkup(createElement(PeriodBlock, {
        data: payload.year, labels: MONTH_LABELS, liveIndex: LIVE,
        names: { cur: '2026', prev: '2025' }, showBars: true, ariaLabels: expected,
      }));
    } catch (err) {
      failures.push(`[${lang}] PeriodBlock THREW — ${err && err.message}`);
    }
    const threaded = axisButtons(pb);
    ok(threaded.length === 12 && threaded.map((b) => b.label).every((l, i) => l === expected[i]),
      `[${lang}] A13.5 PeriodBlock threads ariaLabels through to the axis buttons (got: ${threaded.map((b) => b.label).join(' · ') || 'none'})`);
    ok(threaded.length === 12 && threaded.every((b, i) => b.text === (i === LIVE ? '•' : MONTH_LABELS[i])),
      `[${lang}] A13.6 …and the words live ONLY in the spoken layer — the visible text stays the initials`);

    /**
     * ——— (c) THE FALLBACK: PairedBars handed no words keeps the visible
     * label as the accessible name — the optional prop degrades to exactly
     * the pre-A13 contract, so a week axis (were it ever a control) and any
     * future caller without a vocabulary still name their buttons.
     */
    const bare = renderToStaticMarkup(createElement(PairedBars, {
      cur: payload.year.cur.Visa, prev: payload.year.prev.Visa,
      labels: MONTH_LABELS, liveIndex: LIVE, color: '#2C4356', onRangeTap: () => {},
    }));
    const fallback = axisButtons(bare);
    ok(fallback.length === 12 && fallback.every((b, i) => b.label === MONTH_LABELS[i]),
      `[${lang}] A13.7 without ariaLabels the accessible name falls back to the visible label — the prop is optional, never required`);
  } finally {
    await vite.close();
    delete globalThis.localStorage;
  }
}

await sweep('ar', 'يناير');
await sweep('en', 'January');

/**
 * ═══ SOURCE PINS — what a render cannot see moving ═══
 */
{
  const charts = await readFile(new URL('../src/components/Charts.jsx', import.meta.url), 'utf8');
  const book = await readFile(new URL('../src/views/BookView.jsx', import.meta.url), 'utf8');
  const barsSlice = stripComments(sliceOf(charts, 'PairedBars'));
  const summarySlice = stripComments(sliceOf(charts, 'PeriodSummary'));
  const bookCode = stripComments(book);

  ok(/aria-label=\{\(ariaLabels && ariaLabels\[i\]\) \|\| lb\}/.test(barsSlice),
    'A13.8 PairedBars speaks ariaLabels[i] when handed words and falls back to the visible label — one expression, both halves of the contract');
  ok(/ariaLabels=\{ariaLabels\}/.test(summarySlice),
    'A13.9 PeriodSummary threads ariaLabels to its PairedBars mount');
  ok(/const MONTH_WORDS = MONTH_ABBR\.map\(\(t\) => monthByTab\(t\)\)/.test(bookCode),
    'A13.10 the words are built ONCE, from the app\'s existing month vocabulary (MONTH_ABBR × monthByTab) — no new i18n key');
  const yearSite = (() => {
    const i = bookCode.indexOf("period === 'year' && (");
    return i === -1 ? '' : bookCode.slice(i, i + 500);
  })();
  ok(/ariaLabels=\{MONTH_WORDS\}/.test(yearSite),
    'A13.11 the year PeriodBlock call site passes the full words — the spoken layer arrives from the screen that owns the axis');
  // The week call site stays wordless: its day names are furniture (E1.i),
  // and handing it month words would be the wrong vocabulary on the wrong axis.
  const weekSite = (() => {
    const i = bookCode.indexOf("period === 'week' && (");
    return i === -1 ? '' : bookCode.slice(i, i + 400);
  })();
  ok(weekSite !== '' && !/ariaLabels/.test(weekSite),
    'A13.12 the week call site hands down NO ariaLabels — month words belong to the year axis only');
}

if (failures.length) {
  console.log(`❌ CHUNK A13 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · the year axis speaks full month words in both locales; the visual initials stand unchanged`);
