#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK A5 ═══════════
 * «Neutral deltas, the never-assigned doctrine assigned: chevrons identical
 *  ink up or down; conflict red NEVER on spend direction.» (chunk-ledger A5;
 *  north-star §5: «deltas carry no moral color — spending more is
 *  information, not sin»; boundary 4: no colored verdicts on comparisons.)
 *
 * WHY RENDERS AND NOT A SOURCE GREP. The doctrine is about what an UP period
 * and a DOWN period each hand the eye. Rendering the same component twice —
 * once rising, once falling — and demanding byte-identical styling on the
 * delta is the doctrine stated as a diff; where the verdict colors live
 * (`Delta` in Primitives, the Book's own sentence) is an implementation
 * detail the render does not care about.
 *
 * THE POSITIVE CONTROL: ▲ and ▼ must still RENDER. A tree that deleted the
 * deltas wholesale would satisfy «identical ink» by absence — direction is
 * information and stays; only the verdict goes.
 *
 * MID-WAVE HONESTY: BookView's half is this leaf's own. The Charts/Primitives
 * halves are the charts leaf's files, scanned READ-ONLY here — those pins are
 * labelled [cross-file] and may be red until that leaf lands. The Planner
 * certifies globally at wave end.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { C } from '../src/theme.js';
import { AR } from '../src/i18n/strings.ar.js';

const MARKER = 'CHUNK-A5-GREEN';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(root, p), 'utf8');

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };

const VERDICT_HEXES = [C.conflictInk, C.conflictBg, C.settledInk, C.settledBg];
const hasVerdictColor = (style) =>
  VERDICT_HEXES.some((h) => (style || '').toUpperCase().includes(h.toUpperCase()));

/** The style attr of the element whose content matches `re`. */
const styleAround = (html, re) => {
  const m = html.match(new RegExp(`style="([^"]*)"[^>]*>${re}<`));
  return m ? m[1] : null;
};

function componentSlice(text, name) {
  const decl = new RegExp(`^(?:export )?(?:default )?function ${name}\\b`, 'm').exec(text);
  if (!decl) return null;
  const rest = text.slice(decl.index + 1);
  const next = /^(?:export )?(?:default )?function /m.exec(rest);
  return text.slice(decl.index, next ? decl.index + 1 + next.index : text.length);
}

// ═══ 1. SOURCE — the Book's own sentence carries no verdict token ═══
{
  const view = src('src/views/BookView.jsx');
  const block = componentSlice(view, 'PeriodBlock');
  ok(!!block, 'A5.1 PeriodBlock exists in BookView');
  ok(block && !/settledInk|conflictInk/.test(block),
    'A5.2 the comparison sentence names NO verdict ink — down is not a win and up is not a sin');
}

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { PeriodBlock } = await vite.ssrLoadModule('/src/views/BookView.jsx');
  const { MetricCards, CategoryCompare } = await vite.ssrLoadModule('/src/components/Charts.jsx');

  // Same-point comparison: one live day against a full prev — prevAt is 100.
  const week = (todaySpend) => ({
    cur: { Visa: [todaySpend, null], Cash: [0, null] },
    prev: { Visa: [100, 100], Cash: [0, 0] },
  });
  const names = { cur: AR.thisWeek, prev: AR.lastWeek };
  const pb = (d) => renderToStaticMarkup(createElement(PeriodBlock, { data: d, names }));

  // ——— the Book's headline percentage, up vs down
  const upHtml = pb(week(300));    // 300 vs 100 → more
  const downHtml = pb(week(50));   // 50 vs 100 → less
  const upPct = styleAround(upHtml, '\\d+%');
  const downPct = styleAround(downHtml, '\\d+%');
  ok(!!upPct && !!downPct, 'A5.3 both directions render their percentage — the sentence itself survives');
  ok(!!upPct && !hasVerdictColor(upPct),
    `A5.4 the UP percentage wears no conflict red — spending more is information, got ${JSON.stringify(upPct)}`);
  ok(!!downPct && !hasVerdictColor(downPct),
    `A5.5 the DOWN percentage wears no settled green — spending less is not a verdict, got ${JSON.stringify(downPct)}`);
  ok(!!upPct && upPct === downPct,
    `A5.6 up and down are styled IDENTICALLY — direction changes the words, never the ink\n      up:   ${JSON.stringify(upPct)}\n      down: ${JSON.stringify(downPct)}`);
  ok(!!upPct && upPct.toUpperCase().includes(C.ink.toUpperCase()),
    'A5.7 …and the ink is the body ink — a figure, not a signal');

  // ——— [cross-file] the metric cards' chevrons, up vs down
  const computed = (now, prevAt) => ({
    all: { now, prevAt }, Visa: { now, prevAt }, Cash: { now, prevAt },
  });
  const cards = (now, prevAt) => renderToStaticMarkup(createElement(MetricCards, {
    metric: 'all', setMetric: () => {}, computed: computed(now, prevAt),
    periodNames: names, prevName: AR.lastWeek,
  }));
  const cardsUp = cards(200, 100);
  const cardsDown = cards(50, 100);
  const chevUp = styleAround(cardsUp, '▲ 100%');
  const chevDown = styleAround(cardsDown, '▼ 50%');
  ok(!!chevUp, 'A5.8 [cross-file Charts.jsx] the ▲ chevron still renders — neutrality is not deletion');
  ok(!!chevDown, 'A5.9 [cross-file Charts.jsx] and so does ▼ — direction stays information');
  ok(!!chevUp && !hasVerdictColor(chevUp),
    `A5.10 [cross-file] ▲ carries no conflict red/bg — got ${JSON.stringify(chevUp)}`);
  ok(!!chevDown && !hasVerdictColor(chevDown),
    `A5.11 [cross-file] ▼ carries no settled green/bg — got ${JSON.stringify(chevDown)}`);
  ok(!!chevUp && chevUp === chevDown,
    'A5.12 [cross-file] ▲ and ▼ are styled IDENTICALLY — the glyph is the only thing that moves');

  // ——— [cross-file] the category compare rows, same doctrine
  const cat = (now, prev) => renderToStaticMarkup(createElement(CategoryCompare, {
    cats: [{ name: 'Groceries', now, prev }], curName: 'أغسطس', prevName: 'يوليو',
  }));
  const catUp = styleAround(cat(200, 100), '▲ 100%');
  const catDown = styleAround(cat(50, 100), '▼ 50%');
  ok(!!catUp && !!catDown && catUp === catDown && !hasVerdictColor(catUp),
    `A5.13 [cross-file] a category's delta obeys the same doctrine — identical, verdict-free\n      up:   ${JSON.stringify(catUp)}\n      down: ${JSON.stringify(catDown)}`);

  // ——— [cross-file] Charts.jsx source: no direction-conditioned verdict ink,
  //     and the deltas themselves still referenced (the other half of A5.8).
  const charts = src('src/components/Charts.jsx');
  ok(!/direction[^\n]*(conflictInk|settledInk)|conflictInk[^\n]*direction/.test(charts),
    'A5.14 [cross-file] Charts.jsx conditions no verdict ink on a spend direction');
  ok(/\bDelta\b/.test(charts),
    'A5.15 [cross-file] Charts.jsx still renders deltas at all — the doctrine reforms them, it does not erase them');
} finally {
  await vite.close();
}

if (failures.length) {
  console.log(`❌ CHUNK A5 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · deltas are neutral: identical ink up or down, red never means spent-more`);
