#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK A6 ═══════════   `node scripts/test-chunk-a6.mjs`
 *
 * «The legend line is deleted; color does the work; the marker explains
 *  itself on tap.» (North Star §5, Phase A)
 *
 * Two halves, and each guards the other:
 *
 *  · ABSENCE. The legend's words — «تراكمي · ● = نفس النقطة» in Arabic,
 *    "cumulative · ● = same point" in English — exist in NO locale value and
 *    NO rendered chart, and Charts.jsx CODE never references
 *    `S.cumulativeNote` again. Before this file nothing pinned that: the
 *    deletion shipped pre-ledger and a returned legend would have gone green
 *    through every suite (A6.gates.md's own red note). The detector is proved
 *    on the deleted line itself first, so the absence checks cannot rot into
 *    ones that match nothing.
 *
 *  · PRESENCE. What the legend used to carry is ON DEMAND now: tapping the
 *    same-point marker reveals the compared period, the day, and the compared
 *    figure; the closed chart carries no chrome beyond an invisible TAP-sized
 *    hit area. SSR cannot tap, so the open state is reached through the
 *    component's own `peekOpen` seam and asserted against its closed twin —
 *    a label that renders always, or never, fails one side or the other.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';

const MARKER = 'CHUNK-A6-GREEN';

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };

/**
 * ——— THE DETECTOR, PROVED ON THE CORPSE.
 *
 * These two strings are the exact values `cumulativeNote` held in each locale
 * before the deletion (git 0747f01). If the word list ever drifts until it no
 * longer matches them, the control below goes red — an absence check that can
 * flag nothing proves nothing.
 */
const AR_LEGEND = 'تراكمي · ● = نفس النقطة';
const EN_LEGEND = 'cumulative · ● = same point';
const LEGEND_WORDS = ['تراكمي', 'نفس النقطة', 'cumulative', 'same point', '●'];
const legendWordIn = (s) => LEGEND_WORDS.find((w) => s.includes(w)) || null;

ok(legendWordIn(AR_LEGEND), 'control — the detector flags the Arabic legend line it exists to keep out');
ok(legendWordIn(EN_LEGEND), 'control — and the English one');

/**
 * Comment-stripper for the source pin. Charts.jsx legitimately RECORDS the
 * deletion in a comment («S.cumulativeNote was removed from BOTH locales…») —
 * that history must stay; what may never come back is CODE that reads the key.
 */
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { PeriodSummary, CumulativeChart } = await vite.ssrLoadModule('/src/components/Charts.jsx');
  const { LOCALES, S } = await vite.ssrLoadModule('/src/i18n/strings.js');
  const { TAP } = await vite.ssrLoadModule('/src/theme.js');

  const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const svgOf = (html) => {
    const i = html.indexOf('<svg');
    return i === -1 ? '' : html.slice(i, html.indexOf('</svg>', i));
  };

  /**
   * ——— (a) THE WORDS ARE IN NEITHER LOCALE.
   *
   * `String(v)` deliberately covers both value shapes: a string is itself, a
   * function stringifies to its SOURCE — so a legend hidden inside
   * `(n) => 'تراكمي …'` is caught the same as a plain value.
   */
  for (const [lang, locale] of Object.entries(LOCALES)) {
    ok(locale && locale.S, `locale "${lang}" exists and carries an S object`);
    ok(!('cumulativeNote' in (locale.S || {})), `locale "${lang}" — the cumulativeNote key stays deleted`);
    const offenders = Object.entries(locale.S || {})
      .map(([k, v]) => [k, legendWordIn(String(v))])
      .filter(([, w]) => w);
    ok(offenders.length === 0,
      `locale "${lang}" — no string value carries a legend word (found: ${offenders.map(([k, w]) => `${k}→"${w}"`).join(', ')})`);
  }

  /**
   * ——— (b) THE MARKER EXPLAINS ITSELF ON TAP — and only on tap.
   *
   * Fixture chosen so every figure is distinct and none is a substring of
   * another: 24 live days of 7 (cum 168), a full previous period of 13/day
   * (same-point figure 13×24 = 312, full-period 403), day «24».
   */
  const CUR = Array.from({ length: 31 }, (_, i) => (i < 24 ? 7 : null));
  const PREV = Array(31).fill(13);
  const chart = (props) => {
    try {
      return renderToStaticMarkup(createElement(CumulativeChart, { cur: CUR, prev: PREV, color: '#0E3B2E', prevName: 'يوليو', ...props }));
    } catch (err) {
      failures.push(`CumulativeChart THREW — ${err && err.message}`);
      return '';
    }
  };

  const closed = chart({});
  const open = chart({ peekOpen: true });

  // The S6 marker labels are prior law and must survive this chunk untouched.
  ok(closed.includes('>168<') && closed.includes('>312<'),
    'closed — both persistent marker figures still render (S6 stands)');

  // No persistent chrome: the calm is the point.
  ok(!closed.includes(S.wasThen) && !closed.includes('يوليو'),
    'closed — no peek label: the chart at rest carries nothing the legend used to say');

  // The invisible hit area: present while closed (it IS the affordance), and
  // never below the senior touch floor once the svg scales down on a phone.
  const hit = (html) => {
    const m = /<rect[^>]*fill="transparent"[^>]*>/.exec(html);
    if (!m) return null;
    const w = /width="([\d.]+)"/.exec(m[0]);
    return w ? Number(w[1]) : null;
  };
  ok(hit(closed) != null, 'closed — an invisible hit area exists at the marker');
  ok((hit(closed) || 0) >= TAP / 0.8,
    `closed — the hit area clears the TAP=${TAP} floor even at the narrowest screen's ~0.8 svg scale`);

  // Open: the compared period and day, and the compared figure, in words he
  // already has (wasThen) and digits the marker already owns.
  ok(text(open).includes('يوليو 24'), 'open — the label names the compared period and day');
  ok(text(open).includes(`${S.wasThen} 312`), 'open — and carries the compared figure');
  ok(open !== closed, 'open and closed genuinely differ — a chart that never changes satisfies neither side honestly');
  ok(!legendWordIn(text(open)) && !open.includes('●'),
    'open — the peek does not resurrect the legend words or the ● glyph');

  // No comparison data → nothing to explain. A peek here would fabricate a
  // «was 0» out of a file that is not connected.
  const noPrev = chart({ prev: Array(31).fill(null), peekOpen: true });
  ok(!noPrev.includes(S.wasThen) && hit(noPrev) == null,
    'no-comparison chart — no peek and no hit area: nothing is explained that does not exist');

  // A chart already forbidden from stating totals (off-plot money short of the
  // period) must not whisper them on tap either — same gate as the S6 labels.
  const unlabelled = chart({ labelled: false, peekOpen: true });
  ok(!unlabelled.includes(S.wasThen) && hit(unlabelled) == null,
    'unlabelled chart — the peek obeys the same honesty gate as the persistent labels');

  /**
   * ——— THE REAL SCREEN. Everything above renders the component directly; the
   * screen must actually mount the affordance and hand it the period name.
   */
  const screen = (() => {
    try {
      return renderToStaticMarkup(createElement(PeriodSummary, {
        data: { cur: { Visa: CUR, Cash: Array(31).fill(0) }, prev: { Visa: PREV, Cash: Array(31).fill(0) } },
        labels: [], liveIndex: -1, metric: 'all', setMetric: () => {},
        periodNames: { cur: 'أغسطس', prev: 'يوليو', unit: 'الشهر' },
        showBars: false,
      }));
    } catch (err) {
      failures.push(`PeriodSummary THREW — ${err && err.message}`);
      return '';
    }
  })();
  ok(svgOf(screen).length > 0, 'the period screen renders a chart to look inside');
  ok(hit(svgOf(screen)) != null, 'and the tap affordance is mounted on the real screen, not only in isolation');
  ok(!legendWordIn(text(screen)) && !screen.includes('●'),
    'rendered screen — no legend word survives anywhere in the markup');

  /**
   * ——— (c) THE SOURCE PINS. SSR cannot tap or listen, so the two behaviours a
   * render cannot reach are pinned where they live — the same route
   * test-accountability already uses for the offPlot wiring.
   */
  const src = await readFile(new URL('../src/components/Charts.jsx', import.meta.url), 'utf8');
  const code = stripComments(src);

  // Stripper controls: it flags seeded code and does not eat real code.
  ok(/cumulativeNote/.test(stripComments('const a = S.cumulativeNote; /* x */')),
    'control — the stripper still flags a code reference to the key');
  ok(code.includes('CumulativeChart') && code.includes('PeriodSummary'),
    'control — the stripper left the actual components in place');

  ok(!/cumulativeNote/.test(code),
    'Charts.jsx CODE never references cumulativeNote — the comment may record the deletion; code may not undo it');
  ok(/prevName=\{periodNames\.prev\}/.test(code),
    'the screen hands the chart its compared-period name');
  ok(/addEventListener\(\s*'pointerdown'/.test(code),
    'outside-tap dismiss exists — the peek closes from anywhere, not only on the marker');
} finally {
  await vite.close();
}

if (failures.length) {
  console.log(`❌ CHUNK A6 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · the legend stays deleted; the marker explains itself on tap`);
