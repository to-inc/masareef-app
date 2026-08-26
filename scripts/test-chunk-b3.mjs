#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK B3 ═══════════   `node scripts/test-chunk-b3.mjs`
 *
 * «The cumulative line draws itself ONCE per mount: a stroke-dasharray/
 *  dashoffset animation at MOTION.draw with MOTION.easeOut; a data poke never
 *  re-runs it; prefers-reduced-motion collapses it to the fully-drawn line,
 *  instantly.» (chunk ledger B3 — nav-F6; North Star §3: «Chart draw runs
 *  ONCE per mount»; theme.js MOTION: «a redraw on data refresh is theatre,
 *  and theatre is banned».)
 *
 * WHAT A STATIC RENDER CAN PROVE HERE, and what carries the rest. SSR cannot
 * watch 700ms elapse. What it CAN prove is the entire mechanism:
 *
 *  · the animation is CSS, and a CSS animation restarts only when its element
 *    is recreated or its animation-name changes — so «once per mount, never
 *    per data poke» is proved by pinning both constant: the classed path is
 *    byte-identical (minus `d`) across renders with unrelated data, and the
 *    source shows a literal class and no `key` on the path. Mount identity,
 *    never data identity.
 *  · the hidden state exists ONLY inside @keyframes' from — the path's own
 *    markup carries no dash properties and no inline `animation`, so every
 *    render that does not run the animation (SSR, these suites, reduced
 *    motion) IS the complete line. Honest rendering does not depend on JS.
 *  · the media guard kills the animation by its class, and killing it lands
 *    on the drawn state — an instant state change, content never hidden
 *    (the MOTION LAW's floor).
 *
 * Every detector proves itself on seeded input first (the A6/A12 discipline):
 * an absence check that can flag nothing proves nothing.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';

const MARKER = 'CHUNK-B3-GREEN';

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };

/** Comment stripper (the construction test-chunk-a6 proved). */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

/** Every <path …> tag in a markup string ([^>] crosses newlines on purpose). */
const pathTags = (html) => html.match(/<path\b[^>]*>/g) || [];
/** The live cumulative line — the only 3.2-width stroke in the chart. */
const livePathOf = (html) => pathTags(html).find((t) => t.includes('stroke-width="3.2"')) || null;
/** The grey previous series — the 2.5-width stroke. */
const prevPathOf = (html) => pathTags(html).find((t) => t.includes('stroke-width="2.5"')) || null;
/** The first <style> block's CSS text, '' when there is none. */
const styleOf = (html) => {
  const m = /<style[^>]*>([\s\S]*?)<\/style>/.exec(html);
  return m ? m[1] : '';
};
/** A tag with its d="…" removed — what the animation is allowed to depend on. */
const minusD = (tag) => (tag || '').replace(/ d="[^"]*"/, '');
/** The `.class { animation: name Nms cubic-bezier(…) }` rule, decomposed. */
const drawRule = (css) => {
  const m = /\.([A-Za-z][\w-]*)\s*\{\s*animation:\s*([A-Za-z][\w-]*)\s+([\d.]+)ms\s+(cubic-bezier\([^)]+\))\s*;?\s*\}/.exec(css);
  return m ? { cls: m[1], name: m[2], ms: Number(m[3]), ease: m[4] } : null;
};
/** The body of the reduced-motion media block, '' when there is none. */
const guardOf = (css) => {
  const m = /@media[^{]*prefers-reduced-motion:\s*reduce[^{]*\{([\s\S]*)\}/.exec(css);
  return m ? m[1] : '';
};

// ——— controls: every detector proves itself on seeded input first.
{
  ok(!stripComments('/* ONCE PER MOUNT */ code()').includes('ONCE PER MOUNT')
    && stripComments('/* ONCE PER MOUNT */ code()').includes('code()'),
    'control — the stripper removes comments and keeps code');

  const seededLive = '<svg><path d="M1,2 L3,4" stroke="#123456" stroke-width="3.2" fill="none"/><path d="M0,0" stroke-width="2.5"/></svg>';
  ok(livePathOf(seededLive) != null && livePathOf(seededLive).includes('3.2'),
    'control — the live-path extractor finds a seeded 3.2-width stroke');
  ok(prevPathOf(seededLive) != null && !prevPathOf(seededLive).includes('3.2'),
    'control — and keeps it apart from the 2.5-width grey one');
  ok(minusD(livePathOf(seededLive)) === minusD(livePathOf(seededLive.replace('M1,2 L3,4', 'M9,9 L8,8'))),
    'control — minus-d equality survives a data change and nothing else');

  const seededCss = '.x-draw { animation: x-draw 300ms cubic-bezier(0.2,0,0,1); }';
  const r = drawRule(seededCss);
  ok(r != null && r.ms === 300 && r.cls === 'x-draw' && r.name === 'x-draw',
    'control — the rule decomposer reads class, name and a WRONG duration it could flag');
  ok(drawRule('.x { animation: none; }') == null,
    'control — and does not mistake the guard’s `animation: none` for the draw rule');
  ok(guardOf('@media (prefers-reduced-motion: reduce) { .x { animation: none; } }').includes('animation: none'),
    'control — the media-guard extractor finds a seeded guard');
  ok(guardOf('@media (min-width: 100px) { .x { animation: none; } }') === '',
    'control — and refuses a media block that is not the reduced-motion one');
  ok(/\d\s*ms\b/.test('.y { animation: y 700ms ease; }'),
    'control — the raw-millisecond detector flags a seeded hardcoded duration');
}

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { CumulativeChart, PeriodSummary } = await vite.ssrLoadModule('/src/components/Charts.jsx');
  const { MOTION } = await vite.ssrLoadModule('/src/theme.js');

  ok(Number.isFinite(MOTION.draw) && MOTION.draw > 0 && String(MOTION.easeOut).startsWith('cubic-bezier('),
    'the MOTION vocabulary carries draw and easeOut for this chunk to consume');

  // Fixture A is A6's (24 live days of 7 against a full prev of 13s); fixture B
  // is deliberately unrelated in every way that could leak into the animation —
  // different shape, different magnitudes, and NO comparison series at all.
  const CUR_A = Array.from({ length: 31 }, (_, i) => (i < 24 ? 7 : null));
  const PREV_A = Array(31).fill(13);
  const CUR_B = Array.from({ length: 7 }, (_, i) => (i < 3 ? 55 : null));
  const PREV_B = Array(7).fill(null);

  const chart = (props) => {
    try {
      return renderToStaticMarkup(createElement(CumulativeChart, { cur: CUR_A, prev: PREV_A, color: '#0E3B2E', prevName: 'يوليو', ...props }));
    } catch (err) {
      failures.push(`CumulativeChart THREW — ${err && err.message}`);
      return '';
    }
  };

  const closed = chart({});
  const css = styleOf(closed);
  const rule = drawRule(css);
  const live = livePathOf(closed);

  /**
   * ——— (a) THE DRAW: dashoffset at MOTION.draw with MOTION.easeOut.
   */
  ok(css !== '', 'the chart carries a <style> block — the animation is CSS, where the media guard can reach it');
  ok(rule != null, 'a class rule declares the draw animation (class + name + duration + easing all parse)');
  ok(rule != null && rule.ms === MOTION.draw,
    `the duration is MOTION.draw (${MOTION.draw}ms) — got ${rule && rule.ms}ms`);
  ok(rule != null && rule.ease === MOTION.easeOut,
    `the easing is MOTION.easeOut — got ${rule && rule.ease}`);
  ok(rule != null && css.includes(`@keyframes ${rule.name}`),
    'the animation-name resolves to a @keyframes the same stylesheet defines — the wiring cannot be dead');
  ok(rule != null && !/animation:[^;}]*infinite/.test(css),
    'the draw runs once — no infinite iteration anywhere in the chart’s CSS');

  const fromBlock = (/from\s*\{([^}]*)\}/.exec(css) || [])[1] || '';
  const toBlock = (/to\s*\{([^}]*)\}/.exec(css) || [])[1] || '';
  ok(/stroke-dashoffset:\s*1\b/.test(fromBlock) && /stroke-dasharray:\s*1\b/.test(fromBlock),
    'from — the line starts undrawn via dasharray/dashoffset 1 (pathLength-normalised units)');
  ok(/stroke-dashoffset:\s*0\b/.test(toBlock),
    'to — the destination is dashoffset 0: the drawn line is where the animation ENDS and where every non-animated render already IS');

  /**
   * ——— (b) THE LIVE LINE WEARS IT; the backdrop does not.
   */
  ok(live != null, 'the live cumulative path renders at all');
  ok(live != null && rule != null && live.includes(`class="${rule.cls}"`),
    'the live path carries the draw class — the same class the CSS animates');
  ok(live != null && live.includes('pathLength="1"'),
    'the live path normalises its length to 1, so the fixed keyframe is correct for every data shape without measuring');
  ok(rule != null && (closed.match(new RegExp(`class="${rule.cls}"`, 'g')) || []).length === 1,
    'exactly ONE element draws — the chunk’s claim is singular: the cumulative line, not a scene');
  ok(prevPathOf(closed) != null && rule != null && !prevPathOf(closed).includes(rule.cls),
    'the grey previous series does not animate — it is the backdrop the line draws AGAINST');

  /**
   * ——— (c) HONEST WITHOUT JS: the hidden state lives ONLY inside @keyframes.
   *
   * The suites render statically; so does a browser before hydration and a
   * phone with reduced motion. In all three the path below must already be the
   * complete line — no dash properties, no inline animation, nothing to wait
   * for. This is B3's honest-render clause and its reduced-motion clause
   * stated as one mechanical fact.
   */
  ok(live != null && !/stroke-dashoffset|stroke-dasharray/.test(live),
    'the live path’s own markup carries NO dash properties — statically it is fully drawn');
  ok(live != null && !/animation/.test(live),
    'and no inline animation — inline is where the media guard could not reach it');
  ok(!closed.replace(/<style[^>]*>[\s\S]*?<\/style>/, '').includes('stroke-dashoffset'),
    'stroke-dashoffset exists NOWHERE outside the <style> text — no element in the chart hides statically');
  ok((closed.match(/stroke-dasharray="3 4"/g) || []).length > 0,
    'the gridlines keep their honest static dashes — the scoping outlaws hiding, not dashed furniture');

  /**
   * ——— (d) THE MEDIA GUARD: reduced motion is the drawn line, instantly.
   */
  const guard = guardOf(css);
  ok(guard !== '', 'a prefers-reduced-motion media block exists in the chart’s CSS');
  ok(rule != null && guard.includes(`.${rule.cls}`) && /animation:\s*none/.test(guard),
    'the guard kills the draw by its class with `animation: none` — with (c) above, that IS the fully-drawn line, instantly');

  /**
   * ——— (e) ONCE PER MOUNT, NEVER PER POKE — the render half.
   *
   * A CSS animation restarts only if the element is recreated or the
   * animation-name changes. So: across renders with unrelated data (and with
   * the peek state toggled, and with the label gates closed), the stylesheet
   * and the classed path must be byte-identical minus `d`. Nothing about the
   * animation may derive from data.
   */
  const b = chart({ cur: CUR_B, prev: PREV_B });
  ok(styleOf(b) === css, 'unrelated data — the stylesheet is byte-identical: no duration, name or state leaks in from data');
  ok(minusD(livePathOf(b)) === minusD(live),
    'unrelated data — the classed path is byte-identical minus `d`: a poke patches the line, never the animation');
  ok(minusD(livePathOf(chart({ peekOpen: true }))) === minusD(live) && styleOf(chart({ peekOpen: true })) === css,
    'a state poke (the A6 peek) leaves the animation markup untouched too');
  const unlabelled = chart({ labelled: false });
  ok(rule != null && livePathOf(unlabelled) != null && livePathOf(unlabelled).includes(rule.cls),
    'the label honesty gates do not gate the draw — an unlabelled chart still draws its line');

  /**
   * ——— (f) THE REAL SCREEN mounts it, and no chart means no animation.
   */
  const screen = (() => {
    try {
      return renderToStaticMarkup(createElement(PeriodSummary, {
        data: { cur: { Visa: CUR_A, Cash: Array(31).fill(0) }, prev: { Visa: PREV_A, Cash: Array(31).fill(0) } },
        labels: [], liveIndex: -1, metric: 'all', setMetric: () => {},
        periodNames: { cur: 'أغسطس', prev: 'يوليو', unit: 'الشهر' },
        showBars: false,
      }));
    } catch (err) {
      failures.push(`PeriodSummary THREW — ${err && err.message}`);
      return '';
    }
  })();
  ok(rule != null && styleOf(screen) === css && (livePathOf(screen) || '').includes(rule.cls),
    'the period screen mounts the stylesheet and the classed line — the draw exists where he actually looks');

  const onePoint = (() => {
    try {
      return renderToStaticMarkup(createElement(PeriodSummary, {
        data: { cur: { Visa: [5, null, null, null, null, null, null], Cash: Array(7).fill(null) }, prev: { Visa: Array(7).fill(3), Cash: Array(7).fill(0) } },
        labels: [], liveIndex: 0, metric: 'all', setMetric: () => {},
        periodNames: { cur: 'أغسطس', prev: 'يوليو', unit: 'الأسبوع' },
        showBars: false,
      }));
    } catch (err) {
      failures.push(`PeriodSummary (one point) THREW — ${err && err.message}`);
      return '';
    }
  })();
  ok(rule != null && !onePoint.includes(rule.cls) && styleOf(onePoint) === '',
    'a period with no shape (M7) mounts no chart and therefore no animation — motion never outlives its subject');

  /**
   * ——— (g) THE SOURCE PINS — the two constancies a render cannot see moving.
   */
  const src = await readFile(new URL('../src/components/Charts.jsx', import.meta.url), 'utf8');
  const code = stripComments(src);

  const jsxLive = (src.match(/<path\b[^>]*className="[^"]*"[^>]*\/>/g) || [])
    .find((t) => t.includes('3.2')) || '';
  ok(rule != null && jsxLive.includes(`className="${rule.cls}"`),
    'the draw class is a STRING LITERAL on the live path — an animation-name computed from data is a restart waiting to happen');
  ok(jsxLive !== '' && !/\bkey=/.test(jsxLive),
    'the live path carries no `key` — keying it on data would recreate the element and re-run the draw on every poke');

  // Scanned in COMMENT-STRIPPED code: the doctrine comment above the literal
  // legitimately says «@keyframes» in prose and carries backticks of its own,
  // and a detector that reads comments finds the essay instead of the code.
  const cssLit = (code.match(/`([^`]*@keyframes[^`]*)`/) || [])[1] || '';
  ok(cssLit !== '', 'the stylesheet is a template literal in Charts.jsx CODE (found by its @keyframes)');
  ok(cssLit.includes('${MOTION.draw}ms') && cssLit.includes('${MOTION.easeOut}'),
    'it consumes MOTION.draw and MOTION.easeOut by reference — the tokens, not their values');
  ok(!/\d\s*ms\b/.test(cssLit),
    'no raw millisecond literal anywhere in it — a raw ms where a token exists is a defect (chunk-ledger law)');
  ok(/\bMOTION\b/.test((src.match(/import\s*\{[^}]*\}\s*from\s*'\.\.\/theme\.js'/) || [''])[0]),
    'MOTION arrives from theme.js — the vocabulary, not a local restatement');
  ok(src.includes('ONCE PER MOUNT') && !code.includes('ONCE PER MOUNT'),
    'the once-per-mount doctrine is stated at the site, as a comment — where the next hand reaching for a key will read it');
} finally {
  await vite.close();
}

if (failures.length) {
  console.log(`❌ CHUNK B3 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · the line draws itself once per mount; a poke never re-runs it; reduced motion is the drawn line, instantly`);
