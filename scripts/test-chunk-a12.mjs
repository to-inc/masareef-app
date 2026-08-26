#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK A12 ═══════════  `node scripts/test-chunk-a12.mjs`
 *
 * «Month-axis furniture: labels thin to every 5th day; axis text exempt from
 *  the TYPE floor via the named geometry exemption (an axis is not prose).»
 *  (chunk ledger A12, seat survey 2026-08-25)
 *
 * Plus the two other claims this leaf carries in Charts.jsx:
 *  · A5 (Charts half) — delta/chevron coloring is NEUTRAL regardless of
 *    direction; conflict red never encodes spend direction (it stays reserved
 *    for genuine conflict STATES, like the ❓-money button, and that survival
 *    is asserted too — the doctrine forbids a meaning, not a colour).
 *  · Radii — every `borderRadius` in Charts.jsx is a RADIUS token or sits
 *    under a comment naming the GEOMETRY EXEMPTION (ruling 4).
 *
 * The axis claims are RENDER assertions (a thinning rule that exists only in
 * source text proves nothing about what 31 labels do on a 375px screen); the
 * comment and token claims are source pins, each with a control that proves
 * the detector on seeded input first.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';

const MARKER = 'CHUNK-A12-GREEN';

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };

/** Comment stripper (same construction test-chunk-a6 proved). */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/** From `export function <name>` to the next top-level export. */
const sliceOf = (text, name) => {
  const decl = new RegExp(`^export function ${name}\\b`, 'm').exec(text);
  if (!decl) return '';
  const rest = text.slice(decl.index + 1);
  const next = /^export function /m.exec(rest);
  return text.slice(decl.index, next ? decl.index + 1 + next.index : text.length);
};

/**
 * ——— THE RADII SCANNER.
 *
 * Walks source lines outside comments; a line stating `borderRadius` must
 * either consume a RADIUS token on that line or sit within 25 lines below a
 * comment naming the GEOMETRY EXEMPTION. 25 lines is deliberate slack: the
 * exemption comments this repo writes are paragraphs, and a lookback tight
 * enough to miss one would teach people to shorten the reasoning.
 */
function scanRadii(srcText) {
  const lines = srcText.split('\n');
  let inBlock = false;
  let sites = 0;
  const offenders = [];
  for (let i = 0; i < lines.length; i++) {
    let code = lines[i];
    if (inBlock) {
      const end = code.indexOf('*/');
      if (end === -1) continue;
      code = code.slice(end + 2);
      inBlock = false;
    }
    code = code.replace(/\/\*[\s\S]*?\*\//g, '');
    const open = code.indexOf('/*');
    if (open !== -1) { code = code.slice(0, open); inBlock = true; }
    code = code.replace(/\/\/.*$/, '');
    if (!code.includes('borderRadius')) continue;
    sites++;
    if (/\bRADIUS\.(card|row|capsule|inset)\b/.test(code)) continue;
    const lookback = lines.slice(Math.max(0, i - 25), i).join('\n');
    if (!lookback.includes('GEOMETRY EXEMPTION')) {
      offenders.push(`L${i + 1}: ${lines[i].trim().slice(0, 70)}`);
    }
  }
  return { sites, offenders };
}

// ——— controls: every detector proves itself on seeded input first.
{
  const orphan = scanRadii("const s = { borderRadius: 12 };");
  ok(orphan.sites === 1 && orphan.offenders.length === 1,
    'control — the radii scanner flags a seeded ad-hoc borderRadius');
  const excused = scanRadii("// GEOMETRY EXEMPTION: seeded\nconst s = { borderRadius: 12 };");
  ok(excused.sites === 1 && excused.offenders.length === 0,
    'control — and stands down for one carrying the named exemption');
  const tokened = scanRadii("const s = { borderRadius: RADIUS.card };");
  ok(tokened.sites === 1 && tokened.offenders.length === 0,
    'control — and for one consuming a RADIUS token');
  ok(!stripComments('/* GEOMETRY EXEMPTION */ code()').includes('GEOMETRY EXEMPTION')
    && stripComments('/* GEOMETRY EXEMPTION */ code()').includes('code()'),
    'control — the stripper removes comments and keeps code');
}

/**
 * Axis label slots, read back out of the rendered markup. The label divs are
 * the only elements in PairedBars carrying `margin-top:5px`; each slot is
 * captured with its own font-size so the collision arithmetic below measures
 * what actually rendered, never what the source intended.
 */
const axisSlots = (html) => {
  const out = [];
  const re = /style="([^"]*margin-top:5px[^"]*)"[^>]*>([^<]*)</g;
  let m;
  while ((m = re.exec(html))) {
    const f = /font-size:([\d.]+)px/.exec(m[1]);
    out.push({ font: f ? Number(f[1]) : 0, text: m[2] });
  }
  return out;
};

/**
 * NO COLLISION AT 375px, computed from what rendered.
 *
 * Inner width = 375 − 2·SPACE.gutter (the screen's margins) − 2·12 (the chart
 * card's own side padding, PeriodSummary '14px 12px 10px'). Columns are
 * flex:1 with the axis's own gap; a digit in the UI face runs ≈0.62em. Two
 * adjacent RENDERED labels must keep ≥2px of daylight between their edges.
 */
const collisions = (slots, SPACE) => {
  const inner = 375 - 2 * SPACE.gutter - 2 * 12;
  const gap = slots.length > 8 ? 3 : 6;
  const pitch = (inner - (slots.length - 1) * gap) / slots.length + gap;
  const est = (s) => 0.62 * s.font * s.text.length;
  const rendered = slots.map((s, i) => ({ ...s, i })).filter((s) => s.text.trim() !== '');
  const bad = [];
  for (let k = 1; k < rendered.length; k++) {
    const a = rendered[k - 1], b = rendered[k];
    const clear = (b.i - a.i) * pitch - (est(a) + est(b)) / 2;
    if (clear < 2) bad.push(`«${a.text}»↔«${b.text}» ${clear.toFixed(1)}px`);
  }
  return bad;
};

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { PairedBars, MetricCards, CategoryCompare } = await vite.ssrLoadModule('/src/components/Charts.jsx');
  const { SPACE, TYPE, C } = await vite.ssrLoadModule('/src/theme.js');

  const render = (comp, props) => {
    try {
      return renderToStaticMarkup(createElement(comp, props));
    } catch (err) {
      failures.push(`${comp.name || 'component'} THREW — ${err && err.message}`);
      return '';
    }
  };

  /**
   * ——— (a) THE MONTH AXIS SPEAKS EVERY 5TH DAY.
   *
   * A slot-per-day fixture: 31 days, live on the 18th (deliberately NOT a
   * multiple of 5, so the full 5·k set must be present alongside the • marker).
   */
  const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
  const CUR31 = Array.from({ length: 31 }, (_, i) => (i < 18 ? 10 : null));
  const PREV31 = Array(31).fill(8);
  const month = render(PairedBars, { cur: CUR31, prev: PREV31, labels: DAYS, liveIndex: 17, color: '#2C4356' });
  const slots = axisSlots(month);

  ok(slots.length === 31, `control — the slot extractor sees all 31 axis slots (saw ${slots.length})`);

  const spoken = slots.filter((s) => s.text.trim() !== '' && s.text !== '•').map((s) => s.text);
  ok(spoken.join(',') === '5,10,15,20,25,30',
    `month axis — the day labels are exactly every 5th day (rendered: ${spoken.slice(0, 12).join(',')}${spoken.length > 12 ? '…' : ''})`);
  ok(spoken.length === 6, `month axis — six labels on a 31-day month, no more (counted ${spoken.length})`);
  ok(slots.some((s) => s.text === '•'), 'month axis — the live day still carries its • marker');

  const liveOn20 = axisSlots(render(PairedBars, { cur: CUR31, prev: PREV31, labels: DAYS, liveIndex: 19, color: '#2C4356' }));
  ok(liveOn20.some((s) => s.text === '•') && !liveOn20.some((s) => s.text === '20'),
    'live day landing ON a 5th day — the • marker outranks the furniture; «20» yields');

  const bad = collisions(slots, SPACE);
  ok(bad.length === 0,
    `month axis at 375px — adjacent labels keep ≥2px clear (collide: ${bad.slice(0, 4).join(' · ')}${bad.length > 4 ? ` +${bad.length - 4} more` : ''})`);

  // The other two axes are NOT months of days and must not thin.
  const week = axisSlots(render(PairedBars, {
    cur: [1, 2, 3, null, null, null, null], prev: Array(7).fill(2),
    labels: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'], liveIndex: 2, color: '#2C4356',
  }));
  ok(week.filter((s) => s.text.trim() !== '').length === 7,
    'week axis — all seven day names survive (thinning is month furniture, not a habit)');
  const year = axisSlots(render(PairedBars, {
    cur: Array(12).fill(5), prev: Array(12).fill(4),
    labels: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'], liveIndex: -1, color: '#2C4356',
  }));
  ok(year.filter((s) => s.text.trim() !== '').length === 12,
    'year axis — all twelve month letters survive');

  /**
   * ——— (b) THE EXEMPTION, DOING WORK AND SAYING SO.
   */
  ok(slots.length > 0 && slots[0].font < TYPE.caption,
    `axis text genuinely runs below the TYPE floor (${slots[0] && slots[0].font}px < caption ${TYPE.caption}) — the exemption is load-bearing, not decorative`);

  const src = await readFile(new URL('../src/components/Charts.jsx', import.meta.url), 'utf8');
  const bars = sliceOf(src, 'PairedBars');
  ok(bars.includes('GEOMETRY EXEMPTION') && bars.includes('TYPE floor'),
    'PairedBars carries the NAMED geometry-exemption comment for its axis text (an axis is not prose)');
  ok(!stripComments(bars).includes('GEOMETRY EXEMPTION'),
    'and the exemption is a COMMENT — the name never leaks into executing code');

  const theme = await readFile(new URL('../src/theme.js', import.meta.url), 'utf8');
  ok(theme.includes('GEOMETRY EXEMPTION'),
    'control — the master exemption doctrine still stands in theme.js for the site to cite');

  /**
   * ——— (c) A5, THE CHARTS HALF: DELTAS MOVE WITHOUT A VERDICT.
   *
   * Direction is the GLYPH's job (▲/▼ — and test-book pins their presence);
   * colour must not restate it as a judgment. So: up and down styled
   * IDENTICALLY, and none of the four verdict colours anywhere on a delta.
   */
  const deltaSpans = (html) => {
    const out = [];
    const re = /<span style="([^"]*)"[^>]*>([▲▼]\s*\d+%)<\/span>/g;
    let m;
    while ((m = re.exec(html))) out.push({ style: m[1], text: m[2] });
    return out;
  };
  const verdictHexes = [C.conflictInk, C.conflictBg, C.settledInk, C.settledBg];
  const verdictIn = (style) => verdictHexes.find((h) => style.toLowerCase().includes(h.toLowerCase())) || null;

  const cats = render(CategoryCompare, {
    cats: [{ name: 'Food', now: 200, prev: 100 }, { name: 'Gifts', now: 50, prev: 100 }],
    curName: 'أغسطس', prevName: 'يوليو',
  });
  const catDeltas = deltaSpans(cats);
  ok(catDeltas.length === 2,
    `CategoryCompare — the extractor finds both deltas, one up one down (found ${catDeltas.length})`);
  ok(catDeltas.length === 2 && catDeltas[0].style === catDeltas[1].style,
    'CategoryCompare — ▲ and ▼ are styled IDENTICALLY: the chevron says which way, nothing says how to feel');
  ok(catDeltas.every((d) => !verdictIn(d.style)),
    `CategoryCompare — no verdict colour on a delta (found: ${catDeltas.map((d) => verdictIn(d.style)).filter(Boolean).join(', ') || 'none'})`);

  const metrics = render(MetricCards, {
    metric: 'all', setMetric: () => {},
    computed: { all: { now: 150, prevAt: 100 }, Visa: { now: 50, prevAt: 100 }, Cash: { now: 100, prevAt: 0 } },
  });
  const cardDeltas = deltaSpans(metrics);
  ok(cardDeltas.length === 2,
    `MetricCards — two deltas render (Cash has no comparison and honestly shows none; found ${cardDeltas.length})`);
  ok(cardDeltas.length === 2 && cardDeltas[0].style === cardDeltas[1].style,
    'MetricCards — up and down identical here too: the smaller type is where the last two lies survived');
  ok(cardDeltas.every((d) => !verdictIn(d.style)),
    `MetricCards — no verdict colour on a delta (found: ${cardDeltas.map((d) => verdictIn(d.style)).filter(Boolean).join(', ') || 'none'})`);
  ok(/[▲▼]/.test(metrics),
    'MetricCards — the chevrons themselves survive: direction is information and stays');

  // Positive control: conflict red is a STATE colour and must survive where
  // the state is real — the ❓-money button. The doctrine deletes a meaning,
  // not a colour.
  const withUncat = render(CategoryCompare, {
    cats: [{ name: 'Food', now: 200, prev: 100 }],
    curName: 'أغسطس', prevName: 'يوليو',
    uncategorized: { count: 2, total: 300 }, onUncategorized: () => {},
  });
  ok(withUncat.toLowerCase().includes(C.conflictInk.toLowerCase()),
    'the ❓-money button keeps conflict red — unplaced money IS a conflict, whichever way it moved');
  ok(deltaSpans(withUncat).every((d) => !verdictIn(d.style)),
    'while the delta beside it still carries none');

  ok(src.includes('NEUTRAL DELTAS'),
    'Charts.jsx states the neutral-deltas doctrine (A5) where the next hand will reach for a colour');
  const code = stripComments(src);
  ok(!code.includes('settledInk') && !code.includes('settledBg'),
    'no settled-green reference in Charts code — green-for-down has no site in a chart');

  /**
   * ——— (d) RADII: TOKENS OR THE NAMED EXEMPTION, NOTHING ELSE.
   */
  const { sites, offenders } = scanRadii(src);
  ok(sites >= 6, `the scanner sees Charts' radius furniture at all (found ${sites} sites)`);
  ok(offenders.length === 0,
    `every borderRadius is a RADIUS token or a named geometry exemption (orphans: ${offenders.slice(0, 6).join(' · ')}${offenders.length > 6 ? ` +${offenders.length - 6} more` : ''})`);
  ok(/\bRADIUS\.(card|row|capsule)\b/.test(code),
    'Charts.jsx consumes the RADIUS vocabulary — retokenized, not merely excused');
} finally {
  await vite.close();
}

if (failures.length) {
  console.log(`❌ CHUNK A12 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · the month axis speaks every 5th day; deltas move without a verdict; radii are vocabulary`);
