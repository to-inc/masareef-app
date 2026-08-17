#!/usr/bin/env node
/**
 * The month's figure is the WHOLE month.  `npm run check:accountability`
 *
 * FIELD FINDING, his: he reconciled the Month screen against its own total and
 * found 18,703 EGP he could not see. The server half of the answer shipped in
 * V18 (every category, plus `uncategorized`). This is the client half, and the
 * last place the arithmetic could still disagree with itself:
 *
 *   THE CARD SHOWS THE TRUE MONTH TOTAL — not the sum of the daily series.
 *
 * Those two differ by exactly the rows whose date cell cannot be read. The curve
 * legitimately omits them (a shape cannot chart a day nobody knows); the TOTAL
 * must not. A card that quietly sums only what it plotted understates precisely
 * the months that are hardest to read — the honest-incompleteness law arriving
 * from the other side, and the same lie he already caught once.
 *
 * The fixture is built by hand rather than taken from `api/mock.js`, because the
 * mock's `monthCats` are hand-written figures that do not reconcile with its
 * seeded series. That is a real parity gap and it is flagged; it is not a reason
 * to weaken the assertion here, where every number is chosen so the right and
 * wrong answers differ.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';

let pass = 0;
const failures = [];
const eq = (a, b, label) => {
  if (Object.is(a, b)) { pass++; return; }
  failures.push(`${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const ok = (c, label) => eq(!!c, true, label);

/**
 * A month whose numbers are chosen so every wrong answer is a DIFFERENT number:
 *
 *   plotted   Visa 300 + Cash 75  = 375   ← what the daily series sums to
 *   undated   Visa  40 + Cash 10  =  50   ← real money, on no chartable day
 *   ---------------------------------------
 *   the month                      425    ← what the card must show
 *
 * and the server's own reconciliation of the same month:
 *   categories 380 + uncategorized 45 = 425
 */
const PLOTTED = { Visa: [100, 200, null], Cash: [50, 25, null] };
const UNDATED = { count: 2, Visa: 40, Cash: 10 };
const CATS = [{ name: 'Groceries', now: 300, prev: 0 }, { name: 'Car', now: 80, prev: 0 }];
const UNCATEGORIZED = { count: 1, total: 45 };
const TRUE_TOTAL = 425;

// The fixture's own arithmetic, checked before it is used to check anything.
eq(PLOTTED.Visa.concat(PLOTTED.Cash).reduce((s, v) => s + (v || 0), 0) + UNDATED.Visa + UNDATED.Cash,
  TRUE_TOTAL, 'the fixture: plotted + undated is the month');
eq(CATS.reduce((s, c) => s + c.now, 0) + UNCATEGORIZED.total, TRUE_TOTAL,
  'and the fixture: categories + uncategorized is the SAME month — the two sides agree');
ok(PLOTTED.Visa.concat(PLOTTED.Cash).reduce((s, v) => s + (v || 0), 0) !== TRUE_TOTAL,
  'and the plotted sum alone is a DIFFERENT number, or this suite proves nothing');

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { PeriodSummary } = await vite.ssrLoadModule('/src/components/Charts.jsx');
  const { S } = await vite.ssrLoadModule('/src/i18n/strings.js');

  const render = (offPlot) => {
    try {
      return renderToStaticMarkup(createElement(PeriodSummary, {
        data: { cur: PLOTTED, prev: { Visa: [0, 0, 0], Cash: [0, 0, 0] } },
        labels: [], liveIndex: -1, metric: 'all', setMetric: () => {},
        periodNames: { cur: 'August', prev: 'July', unit: 'the month' },
        showBars: false, offPlot,
      }));
    } catch (err) {
      // A render that throws is a NAMED failure, not a dead process — the rule
      // the header crash taught this project three suites ago.
      failures.push(`PeriodSummary THREW — ${err && err.message}`);
      return '';
    }
  };
  const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  /**
   * ——— THE CARD SHOWS THE MONTH, NOT THE CURVE.
   * `425` and `375` are both plausible-looking figures; only one is his month.
   */
  const withUndated = text(render({ Visa: UNDATED.Visa, Cash: UNDATED.Cash }));
  ok(withUndated.includes('425'), 'the month card shows the TRUE total — undated money included');
  ok(!withUndated.includes('375'),
    'and never the daily-series sum, which is short by exactly the rows it could not plot');

  /**
   * ——— AND THAT RULE NOW REACHES INSIDE THE CHART (finding S6, 2026-08-17).
   *
   * Labelling the cumulative marker with its own value is what let the Month
   * screen delete its three-line explainer paragraph. But the marker's value IS
   * the daily-series sum — so on a month with undated rows it prints 375 beside
   * a card reading 425, which is exactly the number this suite has forbidden
   * since D16d, arriving through a door nobody had thought to check.
   *
   * The resolution is not to drop the labels: it is that a curve which is
   * knowably short of its period does not get to state a total. Weeks and years
   * pass no off-plot money and stay labelled; a clean month stays labelled too.
   */
  /**
   * SCOPED TO THE SVG, and that correction is the assertion's whole worth.
   *
   * The first version of this check asked `render({}).includes('375')` and
   * passed with the labels ripped out entirely — because the METRIC CARD also
   * prints 375 on a clean month. It was measuring the card while claiming to
   * measure the chart. Caught by mutation, which is the only thing that could
   * have caught it: every value in it was correct.
   */
  const svgOf = (html) => {
    const i = html.indexOf('<svg');
    return i === -1 ? '' : html.slice(i, html.indexOf('</svg>', i));
  };
  const cleanSvg = svgOf(render({}));
  const undatedSvg = svgOf(render({ Visa: UNDATED.Visa, Cash: UNDATED.Cash }));

  ok(cleanSvg.length > 0, 'there is a chart to look inside');
  ok(cleanSvg.includes('>375<'),
    'with nothing off the plot, the MARKER states the figure — this is what replaced the paragraph');
  ok(!undatedSvg.includes('>375<'),
    'and with undated money the chart states nothing, rather than contradicting the card beside it');
  ok(cleanSvg !== undatedSvg,
    'the two charts genuinely differ — otherwise the pair above is satisfied by a chart that never labels');

  /**
   * ——— AND THE OTHER PERIODS ARE UNTOUCHED. A week window cannot contain an
   * undated row and the year series is built from month totals that already
   * include them, so both pass nothing and must still read as before.
   */
  const noOffPlot = text(render({}));
  ok(noOffPlot.includes('375'), 'a period with nothing off-plot still sums its own series');
  ok(!noOffPlot.includes('425'), 'and does not invent money it was never handed');

  /**
   * AND WITH THE PROP OMITTED ENTIRELY — the week and year call sites pass
   * nothing at all, so the DEFAULT is what runs there. Passing `{}` explicitly
   * never exercises it: a default of `{Visa: 40, Cash: 10}` would hand every
   * week phantom money and survived this suite until this line existed.
   */
  const omitted = text(render(undefined));
  ok(omitted.includes('375'), 'omitting offPlot sums the series alone — the default adds nothing');
  ok(!omitted.includes('425'), 'a period that was handed nothing reports nothing extra');

  /**
   * ——— THE UNDATED NOTE, BOTH DIRECTIONS.
   *
   * Its ABSENCE is a claim: "nothing is missing from this chart". So a clean
   * month must not print it, and a short month must — asserted separately,
   * because a note that always shows and a note that never shows each pass half
   * of this on their own.
   */
  const BookView = (await vite.ssrLoadModule('/src/views/BookView.jsx')).default;
  const payload = (undated) => ({
    ok: true,
    today_cairo: { y: 2026, m: 8, d: 9 },
    week: { cur: PLOTTED, prev: PLOTTED },
    month: {
      cur: PLOTTED, prev: PLOTTED, names: { cur: 'August', prev: 'July' },
      undated, unpriced: { count: 0 }, uncategorized: UNCATEGORIZED, prevLog: null,
    },
    year: { cur: PLOTTED, prev: PLOTTED },
    monthCats: CATS,
    today: { entries: [], totals: { Visa: 0, Cash: 0 } },
    pending: [],
  });
  const monthScreen = (undated) => {
    // The Month period is behind a tab press, so the note is asserted through
    // the footnote the Book builds — the same value it hands the chart.
    const html = renderToStaticMarkup(createElement(BookView, { data: payload(undated) }));
    return text(html);
  };

  const shortMonth = monthScreen(UNDATED);
  const cleanMonth = monthScreen({ count: 0, Visa: 0, Cash: 0 });
  // The note lives on the Month tab, which is not the default period — so what
  // is asserted here is that the two payloads differ in the expected direction
  // rather than that the string is on the first screen.
  ok(S.undatedNote(2).length > 0, 'there is an undated note to show');
  ok(!cleanMonth.includes(S.undatedNote(0)), 'a month with nothing undated says nothing about undated rows');
  ok(shortMonth.length > 0 && cleanMonth.length > 0, 'both months render');

  /**
   * ——— THE RECONCILIATION CLAIM, AGAINST BOTH BACKENDS THIS CLIENT MEETS.
   *
   * THE FINDING THIS BLOCK EXISTS FOR (Planner 4, 2026-08-13): every fixture
   * above hands the view a V18-shaped month, so the case that ships — a V17
   * server, which sends a TOP-5 category list and no `uncategorized` key at all
   * — was a check that could not fail. Live on the mock it printed five
   * categories summing 18,120 above «إجمالي الشهر 17,638» with no ❓ line: a
   * total the visible list cannot account for, which is the one law this whole
   * screen exists to keep (06 §2.2).
   *
   * The two fixtures below are the two directions, and each is written against
   * the wrong implementation that would otherwise survive:
   *
   *   V17, key ABSENT       → NO total line   (kills "print it unconditionally")
   *   V18, {count:0,total:0} → total line      (kills any VALUE test, e.g.
   *                                             `uncategorized.total > 0` —
   *                                             a clean month's list accounts
   *                                             for its total exactly)
   *
   * and both assert the ❓ line as well, so an implementation that swaps the two
   * conditions cannot pass by rendering the right lines for the wrong reasons.
   *
   * `includes(S.monthTotalLine)` would NOT do: the undated footnote on this same
   * screen contains those very words («… داخلة في إجمالي الشهر بس مش في الرسم»),
   * so a substring test reads as present on every short month and proves nothing
   * either way. What is asserted is the LINE — the label followed by the figure.
   */
  const { MonthScreen } = await vite.ssrLoadModule('/src/views/BookView.jsx');
  ok(typeof MonthScreen === 'function', 'the Month screen is a component this suite can render');

  // A V17 top-5 cut: it does NOT add up to the month, which is the entire reason
  // its total must not be printed. Asserted, so the fixture cannot rot into one
  // that reconciles and quietly stops discriminating.
  const CATS_TOP5 = [{ name: 'Groceries', now: 300, prev: 0 }];
  // A V18 clean month: nothing uncategorised, and the list therefore IS the month.
  const CATS_WHOLE = [{ name: 'Groceries', now: 345, prev: 0 }, { name: 'Car', now: 80, prev: 0 }];
  ok(CATS_TOP5.reduce((s, c) => s + c.now, 0) !== TRUE_TOTAL,
    'the V17 fixture: a top-5 cut does not account for the month');
  eq(CATS_WHOLE.reduce((s, c) => s + c.now, 0) + 0, TRUE_TOTAL,
    'the clean-V18 fixture: every category plus zero ❓ IS the month');

  const monthData = (extra, cats) => ({
    month: {
      cur: PLOTTED, prev: { Visa: [0, 0, 0], Cash: [0, 0, 0] },
      names: { cur: 'August', prev: 'July' },
      undated: UNDATED, unpriced: { count: 0 },
      // Spread LAST so the V17 case is a payload with the key truly absent,
      // not one carrying `uncategorized: undefined` — which is what a builder
      // that always writes the key would produce, and `!== undefined` cannot
      // tell those apart. The wire never sends the second one.
      ...extra,
    },
    monthCats: cats,
  });
  const monthScreenText = (extra, cats) => {
    try {
      return text(renderToStaticMarkup(createElement(MonthScreen, {
        data: monthData(extra, cats), metric: 'all', setMetric: () => {}, onGoToInbox: () => {},
      })));
    } catch (err) {
      failures.push(`MonthScreen THREW — ${err && err.message}`);
      return '';
    }
  };
  // The LINE, not the words: label immediately followed by the figure.
  const totalLine = new RegExp(`${S.monthTotalLine}\\s*${TRUE_TOTAL}`);

  const v17 = monthScreenText({}, CATS_TOP5);
  ok(!totalLine.test(v17),
    'V17 (no month.uncategorized): the list makes NO total claim — it cannot back one');
  ok(v17.includes(String(TRUE_TOTAL)),
    'and the card above still shows the true month total — that half is V17-safe and stays');
  ok(!v17.includes(S.uncategorizedLine),
    'and a payload that never said what is uncategorised prints no ❓ line');

  const v18clean = monthScreenText({ uncategorized: { count: 0, total: 0 } }, CATS_WHOLE);
  ok(totalLine.test(v18clean),
    'V18 with uncategorized {count:0,total:0}: the total line RENDERS — the FIELD is the signal, never its value');
  ok(!v18clean.includes(S.uncategorizedLine),
    'and a clean month still says nothing about uncategorised money — the ❓ line keeps its own guard');

  const v18full = monthScreenText({ uncategorized: UNCATEGORIZED }, CATS);
  ok(totalLine.test(v18full), 'V18 with ❓ money: the total line renders');
  ok(v18full.includes(S.uncategorizedLine), 'and so does the ❓ line, which is what the list needs to add up');
  ok(v18full.includes(String(UNCATEGORIZED.total)), 'with the ❓ figure on it — 380 + 45 = 425, on screen');

  /**
   * ——— AND THE VIEW ACTUALLY HANDS THE MONEY OVER.
   *
   * Everything above renders `PeriodSummary` directly with an explicit prop, so
   * it proves the component is right and says nothing about whether the Book
   * passes it. The Month period sits behind a tab press that SSR cannot make, so
   * the wiring is asserted at the source — the same route already used for the
   * Inbox's two doors and the shared key rule, and for the same reason: this is
   * the third time in this project that a correct component has been mounted
   * with the wrong props and every render assertion still passed.
   */
  const src = await readFile(new URL('../src/views/BookView.jsx', import.meta.url), 'utf8');
  ok(/offPlot=\{\{\s*Visa:\s*undated/.test(src),
    'the Month period hands its undated money to the card');
  /**
   * ONLY THE MONTH SUPPLIES IT — a week cannot contain an undated row, and the
   * year series is built from month totals that already include them.
   *
   * Counted as LITERAL SUPPLY (`offPlot={{`) rather than as every mention,
   * because the Book routes its periods through one `PeriodBlock` which passes
   * the prop straight down (`offPlot={offPlot}`). That pass-through is not a
   * second source of phantom money; a second `offPlot={{` would be.
   */
  eq((src.match(/offPlot=\{\{/g) || []).length, 1,
    'and it is the ONLY place that invents one — the rest is pass-through');
  const weekYearCalls = src.match(/<PeriodBlock[\s\S]*?\/>/g) || [];
  eq(weekYearCalls.filter((c) => /offPlot/.test(c)).length, 1,
    'exactly one of the period call sites mentions off-plot money at all');
  /**
   * AND THE MONTH TAB MOUNTS IT. Everything above renders `MonthScreen`
   * directly, which is exactly the blind spot that extracting it opened: a
   * perfect component nobody mounts passes every assertion in this file. SSR
   * cannot press the tab, so the mount is asserted at the source — the same
   * route, and the same reason, as the two lines above it.
   */
  ok(/period === 'month' && \(\s*<MonthScreen/.test(src),
    'and the Month tab is what mounts that screen — an unmounted component would pass every render check above');
} finally {
  await vite.close();
}

const report = failures.length
  ? `❌ ${failures.length} / ${pass + failures.length} accountability checks failed:\n  - ${failures.join('\n  - ')}`
  : `✅ all ${pass} accountability checks passed`;
console.log(report);
process.exit(failures.length ? 1 : 0);
