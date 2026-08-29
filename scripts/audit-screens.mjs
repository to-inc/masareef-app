#!/usr/bin/env node
/**
 * EVERY SCREEN, BOTH LANGUAGES, AGAINST THE REAL WIRE.  `npm run audit`
 *
 * Renders each view server-side and reads the OUTPUT for the laws that have
 * bitten this app, rather than trusting that a component which compiles also
 * tells the truth. The fixture is a REAL `action:'summary'` response captured
 * from the test bed on build 20260827-1724 — not a hand-written shape, because
 * a hand-written shape is a guess about the server and this project has been
 * wrong about the server before.
 *
 * WHAT IT CHECKS, and why each one is here rather than in principle:
 *
 *   throws        a screen that cannot render is the loudest possible defect
 *   comments      `/* … *\/` in JSX children renders as text — it shipped
 *   raw ISO code  a figure followed by "EGP" — the home currency has a mark
 *   long form     a figure followed by «جنيه» / "EGP" — same law, other spelling
 *   type floor    a rendered font-size below the label floor that is not a
 *                 sanctioned unit or declared geometry
 *   tap floor     an interactive box declaring less than TAP
 *
 * Every detector carries a positive control. An absence check with no control
 * is a check that cannot fail, which is the shape of every bug this file exists
 * to catch.
 */
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = process.env.MASAREEF_WIRE
  || new URL('./fixtures-wire-summary.json', import.meta.url);

const wire = JSON.parse(readFileSync(FIXTURE, 'utf8'));
const findings = [];
const note = (screen, lang, kind, detail) => findings.push({ screen, lang, kind, detail });
let rendered = 0;

const stub = (lang) => {
  globalThis.localStorage = {
    getItem: (k) => (k === 'masareef.lang' ? lang : null),
    setItem() {}, removeItem() {}, clear() {},
  };
};

// ————————————————————————————————————————————————— detectors (+ controls)
const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const leakedComment = (html) => {
  const t = text(html);
  const i = t.indexOf('/*');
  return i !== -1 && t.indexOf('*/', i + 2) !== -1 ? t.slice(i, i + 60) : null;
};
const rawIso = (html) => (text(html).match(/\d[\s ]*(EGP)\b/) || [])[0] || null;
const longForm = (S) => (html) => (text(html).match(new RegExp(`\\d[\\s\\u00A0]*${S.currency}\\b`)) || [])[0] || null;

/** font-size declarations in the rendered markup, below the prose floor */
/**
 * A SIZE MUST BE A TYPE TOKEN, not merely large enough.
 *
 * The first version only asked «is it below the caption floor», and 13.5px
 * sailed through it twice — a size that is not a rung on the ladder at all,
 * sitting on the two sentences that show when a chart has nothing to draw.
 * The North Star's rule is a positive one: text takes a TYPE token, always.
 * So anything that is not one of the eight rungs is a finding, whether it is
 * above the floor or below it.
 */
const smallType = (html, floor, rungs) => {
  const hits = [];
  const re = /font-size:\s*([\d.]+)px/g;
  let m; while ((m = re.exec(html))) {
    const v = Number(m[1]);
    if (rungs.has(v)) continue;
    // Name the element and its text, so a raw number is never the whole report:
    // an SVG axis label is declared GEOMETRY and exempt, a prose span is not.
    const before = html.slice(Math.max(0, m.index - 220), m.index);
    /**
     * DECLARED GEOMETRY IS EXEMPT — and only DECLARED geometry. The North Star
     * allows a raw px for a picture, an icon or a chart axis, but requires it to
     * be "declared, never merely surviving". A `data-geometry` attribute is that
     * declaration in a form this check can read, which is the difference between
     * a rule and a comment someone has to find.
     */
    const openTag = before.match(/<[^<>]*$/);
    if (openTag && /data-geometry=/.test(openTag[0])) continue;
    const tag = (before.match(/<(\w+)[^<>]*$/) || [])[1] || '?';
    const after = html.slice(m.index, m.index + 220);
    const body = ((after.match(/>([^<>]{1,34})</) || [])[1] || '').trim();
    hits.push(`${v}px <${tag}> ${JSON.stringify(body)}`);
  }
  return hits;
};
/** interactive boxes declaring a min-height under the tap floor */
const smallTaps = (html, tap) => {
  const hits = [];
  const re = /<button[^>]*style="([^"]*)"/g;
  let m; while ((m = re.exec(html))) {
    const mh = /min-height:\s*([\d.]+)px/.exec(m[1]);
    if (mh && Number(mh[1]) < tap) hits.push(Number(mh[1]));
  }
  return hits;
};

const RUNGS0 = new Set([40, 34, 22, 19, 17, 16, 15, 13]);
// positive controls — each detector must fire on a known positive
const CONTROLS = [
  ['leakedComment', leakedComment('<span>/* leaked */</span>') !== null],
  ['leakedComment-neg', leakedComment('<input accept="image/*"/>') === null],
  ['rawIso', rawIso('<b>0 EGP</b>') !== null],
  ['rawIso-neg', rawIso('<b>0 E£</b>') === null],
  ['smallType', smallType('<i style="font-size: 11.5px">x</i>', 15, RUNGS0).length === 1],
  ['smallType-neg', smallType('<i style="font-size: 15px">x</i>', 15, RUNGS0).length === 0],
  ['smallType-geom', smallType('<i data-geometry="axis" style="font-size: 9.5px">x</i>', 15, RUNGS0).length === 0],
  ['smallType-undeclared', smallType('<i style="font-size: 9.5px">x</i>', 15, RUNGS0).length === 1],
  ['smallType-offladder', smallType('<i style="font-size: 13.5px">x</i>', 15, RUNGS0).length === 1],
  ['smallTaps', smallTaps('<button style="min-height: 30px">x</button>', 48).length === 1],
  ['smallTaps-neg', smallTaps('<div style="min-height: 30px">x</div>', 48).length === 0],
];
for (const [name, ok] of CONTROLS) {
  if (!ok) note('(controls)', '—', 'BROKEN-DETECTOR', `${name} failed its positive control`);
}

/**
 * A FRESH SERVER PER LANGUAGE, and this is not tidiness.
 *
 * `LOCALE` is resolved once, at module evaluation, from `localStorage`. Vite's
 * `ssrLoadModule` caches modules, so a second pass over one server re-uses the
 * FIRST language's locale object — the English column renders Arabic and every
 * English assertion is really a second Arabic one. The first version of this
 * file did exactly that, and the giveaway was «بالـج.م» appearing under [en].
 */
for (const lang of ['ar', 'en']) {
  stub(lang);
  const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
  try {
    {
    const S = (await vite.ssrLoadModule('/src/i18n/strings.js')).S;
    const { TYPE, TAP } = await vite.ssrLoadModule('/src/theme.js');
    const RUNGS = new Set(Object.values(TYPE));
    const load = async (p) => (await vite.ssrLoadModule(p));

    /**
     * The pending shape is `{ tab, rowHint, match }` — the ROW lives under
     * `match`. The first version of this fixture passed a flat row and
     * InboxView threw on `item.match.description`. That was the FIXTURE being
     * wrong, not the app, and reporting it as a crash would have been a
     * fabricated defect. Shape taken from the app's own suite, which is
     * parity-checked against the server.
     */
    const match = {
      date: '30/8/2026', description: 'S-MARKET VALLILA', method: 'Visa',
      category: 'Groceries', amount: 24.04, currency: 'EUR',
    };
    const row = { tab: 'Aug', rowHint: '30/8/2026|24.04', match };
    const noop = () => {};
    const SCREENS = [
      ['BookView · today', '/src/views/BookView.jsx', 'default', { data: wire, initialPeriod: 'today' }],
      ['BookView · week', '/src/views/BookView.jsx', 'default', { data: wire, initialPeriod: 'week' }],
      ['BookView · month', '/src/views/BookView.jsx', 'default', { data: wire, initialPeriod: 'month' }],
      ['BookView · year', '/src/views/BookView.jsx', 'default', { data: wire, initialPeriod: 'year' }],
      ['InboxView', '/src/views/InboxView.jsx', 'default', { pending: [row], settled: {}, onConfirm: noop, onConfirmMany: noop }],
      ['InboxView · empty', '/src/views/InboxView.jsx', 'default', { pending: [], settled: {}, onConfirm: noop }],
      ['EntryView', '/src/views/EntryView.jsx', 'default', {
        amount: '24.04', setAmount: noop, desc: 'S-MARKET', setDesc: noop, cat: 'Groceries', setCat: noop,
        method: 'Visa', setMethod: noop, onCamera: noop, currency: 'EUR', setCurrency: noop, onDictate: noop }],
      ['SettingsSheet', '/src/views/SettingsSheet.jsx', 'default', { displayCurrency: 'EUR', onFlipCurrency: noop, onClose: noop }],
      ['SetupView', '/src/views/SetupView.jsx', 'default', { onDone: noop }],
      ['DictateView', '/src/views/DictateView.jsx', 'default', { onSend: noop, onCancel: noop, busy: false }],
      ['ReceiptView', '/src/views/ReceiptView.jsx', 'default', { onSaved: noop, onManual: noop, onBatch: noop }],
      ['BatchReviewView', '/src/views/BatchReviewView.jsx', 'default', {
        jobs: [], expired: [], busy: false, results: null,
        onConfirm: noop, onResnap: noop, onDiscard: noop, onLeave: noop }],
      ['EditSheet', '/src/views/EditSheet.jsx', 'default', { item: row, onClose: noop, onSaved: noop }],
      ['LogCard', '/src/components/LogCard.jsx', 'default', { prevLog: wire.month?.prevLog, todayCairo: wire.today_cairo }],
    ];

    for (const [name, path, key, props] of SCREENS) {
      let html;
      try {
        const mod = await load(path);
        html = renderToStaticMarkup(createElement(mod[key], props));
        rendered += 1;
      } catch (e) {
        note(name, lang, 'THREW', String(e && e.message).slice(0, 150));
        continue;
      }
      const c = leakedComment(html); if (c) note(name, lang, 'LEAKED-COMMENT', c);
      const iso = rawIso(html); if (iso) note(name, lang, 'RAW-ISO-CODE', iso);
      const lf = longForm(S)(html); if (lf) note(name, lang, 'LONG-FORM-UNIT', lf);
      const st = smallType(html, TYPE.caption, RUNGS); if (st.length) note(name, lang, 'NOT-A-TYPE-TOKEN', [...new Set(st)].join(' | '));
      const tp = smallTaps(html, TAP); if (tp.length) note(name, lang, 'TAP-UNDER-FLOOR', [...new Set(tp)].join(', '));
    }
  }
  } finally { await vite.close(); }
}

const byKind = {};
for (const f of findings) (byKind[f.kind] ||= []).push(f);
console.log(`rendered ${rendered} screen-renders across 2 languages`);
for (const k of Object.keys(byKind)) {
  console.log(`\n${k} (${byKind[k].length})`);
  for (const f of byKind[k]) console.log(`  · [${f.lang}] ${f.screen}: ${f.detail}`);
}
if (!findings.length) console.log('\nAUDIT-CLEAN');
process.exit(findings.length ? 1 : 0);
