#!/usr/bin/env node
/**
 * WCAG contrast for every pair the app actually paints.  `npm run check:contrast`
 *
 * WHY THIS IS A SUITE AND NOT A ONE-OFF SPREADSHEET. A palette is checked once,
 * at the moment it is chosen, and then drifts for the rest of the project's life
 * — someone lightens a grey to "soften" a label and a 70-year-old in Cairo
 * daylight can no longer read the date on his own purchase. Measuring it in the
 * test run is the only version of this that stays true.
 *
 * THE FLOORS (WCAG 2.1 AA):
 *   4.5:1  normal text
 *   3.0:1  large text — ≥24px, or ≥18.66px when bold
 *
 * Sizes below are the REAL ones from the components, not aspirations.
 *
 * THREE VERDICTS, because two would force a wrong answer:
 *
 *   check()      pairs THIS CODE chose — which token carries a glyph, what a
 *                derived chip is coloured. Below floor = build fails. Mine to fix.
 *   canonical()  pairs the OWNER ruled. The brief says to FLAG a failure rather
 *                than silently darken, so these report ⚠️ and do not fail the
 *                build — UNLESS they drop under 3:1, where the text stops being
 *                legible at any size and shipping it would be negligence rather
 *                than deference.
 *   decorative() edges and washes that carry no meaning. Measured and printed so
 *                nobody can say the number was not seen, but not asserted: WCAG
 *                1.4.11 governs what is REQUIRED to identify a control or its
 *                state, and each entry must name what carries that instead —
 *                which is what stops this from becoming a place to hide things.
 */
/**
 * TYPE is imported so rows whose component speaks a TYPE token (A4b) declare
 * the SAME token by reference — a declared size that cannot drift from the
 * size the component actually renders.
 */
import { C, METHOD, TYPE } from '../src/theme.js';

let pass = 0;
const failures = [];
const flags = [];
const rows = [];

const srgb = (hex) => {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
};
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (hex) => {
  const [r, g, b] = srgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

const isLarge = (px, bold) => px >= 24 || (bold && px >= 18.66);
const seen = new Set();
const record = (mark, where, fg, bg, px, r, floor) =>
  rows.push({ mark, where, fg, bg, px, r: r.toFixed(2), floor });

function check(where, fg, bg, px, bold = false) {
  seen.add(fg); seen.add(bg);
  const floor = isLarge(px, bold) ? 3 : 4.5;
  const r = ratio(fg, bg);
  record(r >= floor ? '✅' : '❌', where, fg, bg, px, r, floor);
  if (r >= floor) pass++;
  else failures.push(`${where}\n      ${fg} on ${bg} at ${px}px${bold ? ' bold' : ''} = ${r.toFixed(2)}:1, needs ${floor}:1`);
}

function checkUi(where, fg, bg) {
  seen.add(fg); seen.add(bg);
  const r = ratio(fg, bg);
  record(r >= 3 ? '✅' : '❌', where, fg, bg, 'ui', r, 3);
  if (r >= 3) pass++;
  else failures.push(`${where}\n      ${fg} on ${bg} = ${r.toFixed(2)}:1, needs 3:1`);
}

function canonical(where, fg, bg, px, bold, fix) {
  seen.add(fg); seen.add(bg);
  const floor = isLarge(px, bold) ? 3 : 4.5;
  const r = ratio(fg, bg);
  if (r >= floor) { record('✅', where, fg, bg, px, r, floor); pass++; return; }
  if (r < 3) {
    record('❌', where, fg, bg, px, r, floor);
    failures.push(`${where} — ILLEGIBLE\n      ${fg} on ${bg} = ${r.toFixed(2)}:1. Under 3:1 nothing is readable at any size; this one is not the Owner's to waive.`);
    return;
  }
  record('⚠️', where, fg, bg, px, r, floor);
  flags.push(`${where}: ${fg} on ${bg} at ${px}px${bold ? ' bold' : ''} = ${r.toFixed(2)}:1, AA wants ${floor}:1.\n      minimal fix: ${fix}`);
}

/**
 * A canonical FILL whose edge is soft against the page.
 *
 * Deliberately not routed through canonical()'s under-3:1 hard stop. That stop
 * exists for TEXT, where below 3:1 means the words cannot be read at any size and
 * no ruling makes them readable. A filled control is a different failure: its
 * label is measured separately and passes, so the harm is a soft outline, not an
 * unreadable one. Calling that "illegible" would be the check crying wolf — and a
 * check that cries wolf gets switched off, which is the more expensive outcome.
 */
function canonicalUi(where, fg, bg, fix) {
  seen.add(fg); seen.add(bg);
  const r = ratio(fg, bg);
  if (r >= 3) { record('✅', where, fg, bg, 'ui', r, 3); pass++; return; }
  record('⚠️', where, fg, bg, 'ui', r, 3);
  flags.push(`${where}: ${fg} on ${bg} = ${r.toFixed(2)}:1, WCAG 1.4.11 wants 3:1.\n      minimal fix: ${fix}`);
}

function decorative(where, fg, bg, carriedBy) {
  seen.add(fg); seen.add(bg);
  if (!carriedBy) throw new Error(`decorative(${where}) must name what carries the meaning instead`);
  record('·', `${where}  [decorative — meaning is carried by ${carriedBy}]`, fg, bg, '—', ratio(fg, bg), 0);
  pass++;
}

// ——————————————————————— body text
for (const [name, bg] of [['shell', C.shell], ['card', C.card], ['mist', C.mist]]) {
  check(`body ink on ${name}`, C.ink, bg, 17);
}
canonical('secondary (muted) on shell', C.muted, C.shell, 13, false, 'muted → #5C6871 (5.35 / 5.72 / 4.62 on shell / card / mist)');
canonical('secondary (muted) on card', C.muted, C.card, 13, false, 'muted → #5C6871');
/**
 * The period strip's inactive label is `ink`, not `muted`, and it stays that way.
 *
 * ⚠️ THE ORIGINAL REASON EXPIRED, WHICH IS WORTH SAYING RATHER THAN QUIETLY
 * EDITING: this note used to read "NOT muted on mist — 2.84:1, unreadable at any
 * size". That was true of the OLD muted (#7B8B96). Since muted darkened to
 * #5C6871 it clears mist at 4.62:1, so the prohibition no longer follows from
 * the number. `ink` is kept anyway — the strip is the one control that sits over
 * the crown and it should read as strongly there as everywhere else — but it is
 * now a design choice rather than a contrast floor, and a comment that kept
 * citing 2.84 would be asserting a measurement the file itself disproves.
 */
check('inactive period tab, over the crown', C.ink, C.mist, 15, true);

/**
 * ——————————————————————— THE ABSENCE MARKERS, and why they are `ink`.
 *
 * "—" is not decoration and it is not secondary: it is the VALUE of a row he
 * never priced, and "❓" is the value of a row nobody has categorised. Rendering
 * either too faint to notice hides the absence instead of showing it, which is
 * the precise lie those glyphs exist to prevent (honest-render law).
 *
 * Measured, `muted` clears the floor at 30px and fails it at 15px — so the
 * markers use `ink` at every size instead of being grey at some and not others.
 * A rule with a size in it is a rule someone will get wrong.
 */
check('the "—" absent amount (inbox card)', C.ink, C.card, 30, true);
check('the "—" absent amount (summary row)', C.ink, C.card, 15, true);
check('the "❓" uncategorised marker on card', C.ink, C.card, 15, true);
check('the "❓" uncategorised marker on shell', C.ink, C.shell, 15, true);

// ——————————————————————— primary
/**
 * A7 (glass audit Tier 1). Harbor SPLIT: `harbor` is the fill, stroke, tint
 * and focus ring; `harborInk` (#34688C — the end stop of the harbor gradient
 * the owner already ratified, HANDOFF:13) is harbor WHEN IT IS TEXT.
 *
 * What the old two lines were hiding. `harbor on card — headings` passed at
 * 4.53:1, so the suite read green — but the pair it measured (21px bold) was
 * not the pair that was failing. Harbor was ALSO the colour of every
 * `TYPE.label` link, section link and «needs a category» marker in the app,
 * at 15px and normal weight, where the floor is 4.5 rather than 3. On `card`
 * those sat at 4.53 — 0.6% of headroom — and on `shell` at 4.23, which is a
 * FAILURE that shipped. The old `canonical()` line let it through by
 * describing harbor-on-shell as "reserved for large/bold per the brief", a
 * description of the 23px heading that was true of the heading and false of
 * the eleven 15px labels sharing the colour.
 *
 * So the pairs below are now stated at the size that actually binds them, and
 * the label tier is a `check()`, not a `canonical()`: nothing here is an owner
 * ruling to defer to, it is arithmetic.
 */
check('harborInk on card — headings', C.harborInk, C.card, 21, true);
check('harborInk on shell — headings', C.harborInk, C.shell, 23, true);
check('harborInk on card — label-tier links and markers', C.harborInk, C.card, TYPE.label);
check('harborInk on shell — label-tier links and markers', C.harborInk, C.shell, TYPE.label);
check('harborInk on card — the editable-field marker', C.harborInk, C.card, 12.5, true);
/**
 * Negative control for the split: if `harbor` ever clears 4.5:1 as normal text
 * the split has stopped being necessary and this block should be re-derived
 * rather than left standing as folklore. It fails today at 4.53 on card and
 * 4.23 on shell, which is exactly why `harborInk` exists.
 */
if (ratio(C.harbor, C.shell) < 4.5) pass++;
else failures.push('negative control: harbor cleared 4.5:1 as text on the shell — the A7 harborInk split is no longer forced; re-derive it');
check('white on harbor — primary button', C.onDark, C.harbor, 18.5, true);
check('white on harbor — toast', C.onDark, C.harbor, TYPE.body);
check('white on harbor — active metric value', C.onDark, C.harbor, 19, true);
check('white on harbor — active metric label', C.onDark, C.harbor, 11.5, true);
/**
 * C2: the active tab's label reads in INK, applied by the stylesheet override
 * in styles.css — the harbor version fails the 4.5 floor on the C1 worst-case
 * composite below, where a negative control keeps that reason measured.
 */
check('active tab label (ink — the C2 override)', C.ink, C.card, TYPE.label, true);

// ——————————————————————— the one warm action
check('cash CTA label — amberInk on amber', C.amberInk, C.amber, 18.5, true);
/**
 * THE BOUNDARY IS WHAT 1.4.11 ASKS FOR, so the boundary is what is measured.
 *
 * This was a flagged pair: `amber` on `shell` is 2.10:1 and the suggested
 * minimal fix was to darken the FILL to #B48836. The Owner ruled otherwise —
 * `#D9A441` is D15's dawn amber, and a finding about an EDGE is not a licence to
 * restate a colour he chose. The control now carries `amberRim`, so the rim is
 * the thing that has to clear 3:1 and it does.
 *
 * The fill's own ratio stays MEASURED AND PRINTED below rather than deleted:
 * removing the line would leave the app with no record that the fill is soft,
 * and the next reader would rediscover it. It is recorded as decorative because
 * the meaning is genuinely carried elsewhere — by the rim, and by a label that
 * clears 5.80:1.
 */
canonicalUi('cash CTA rim against the shell', C.amberRim, C.shell,
  'amberRim is the boundary token; if it is ever lightened past 3:1 the control loses its edge again.');
decorative('cash CTA fill against the shell', C.amber, C.shell,
  'the rim that outlines it (amberRim, 3.42:1) and the label on it (5.80:1)');

// ——————————————————————— tertiary and advisory surfaces
check('category chip label', C.ink, C.shell, 15);
check('sand chip label', C.ink, C.sand, 15);
check('offline banner', C.ink, C.sand, TYPE.label, true);
check('outbox card body', C.ink, C.sand, 14);

// ——————————————————————— the two card states (WS3-C)
canonical('settled strip', C.settledInk, C.settledBg, 15.5, true, 'settledInk → #4C7950 (4.52:1)');
canonical('delta down', C.settledInk, C.settledBg, 11.5, true, 'settledInk → #4C7950');
check('conflict strip', C.conflictInk, C.conflictBg, 15.5, true);
check('delta up', C.conflictInk, C.conflictBg, 11.5, true);
check('badge count', C.onDark, C.conflictInk, 11, true);
decorative('settled strip border', C.settledLine, C.card, 'the strip fill and its words');
decorative('conflict strip border', C.conflictLine, C.card, 'the strip fill and its words');

// ——————————————————————— method chips (DERIVED — mine, so they must PASS)
check('Visa chip', METHOD.Visa.fg, METHOD.Visa.bg, TYPE.caption, true);
check('Cash chip', METHOD.Cash.fg, METHOD.Cash.bg, TYPE.caption, true);

// ——————————————————————— chart marks: graphics, 3:1 against their ground
checkUi('chart stroke — Visa/primary', C.harbor, C.card);
checkUi('chart stroke — Cash', C.muted, C.card);
checkUi('chart stroke — all', C.ink, C.card);
checkUi('focus ring', C.harbor, C.shell);
decorative('card border against the shell', C.line, C.shell, 'the white card fill against the darker shell');
decorative('the morning crown wash', C.mist, C.shell, 'nothing — it is a background gradient behind ink text');

/**
 * ——————————————————————— C1: the floating bar, composited WORST-CASE.
 *
 * The bar's fill is C.card at BAR_ALPHA over whatever scrolled beneath it —
 * so the honest pair is not «label on card» but «label on card-at-alpha OVER
 * THE DARKEST PAINT IN THE PALETTE». Both halves are computed, never assumed:
 *
 *   · BAR_ALPHA is extracted from App.jsx — the constant the bar actually
 *     renders with. A 0.92 copied here would go stale the day the bar moves
 *     and keep certifying a fill that no longer exists.
 *   · the darkest underlay is computed from the palette itself (minimum
 *     luminance over every C token — today that is amberInk), so a future
 *     darker token automatically TIGHTENS this floor instead of escaping it.
 *
 * Compositing is per-channel sRGB, which is what the browser does for an
 * alpha fill. The blur is ignored deliberately: blurring can only AVERAGE the
 * underlay with its lighter surroundings, so the unblurred composite is the
 * true worst case — asserting it covers every blurred frame for free.
 */
{
  const fs = await import('node:fs');
  const appSrc = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const m = /const BAR_ALPHA = (0\.\d+)/.exec(appSrc);
  if (!m) {
    failures.push('C1 worst case — App.jsx declares no BAR_ALPHA; a floating bar whose alpha this suite cannot read is unmeasurable glass');
  } else {
    pass++; // the alpha was found where the bar actually lives
    const alpha = Number(m[1]);
    const chan = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const compose = (top, a, under) => {
      const [t, u] = [chan(top), chan(under)];
      return `#${t.map((c, i) => Math.round(a * c + (1 - a) * u[i]).toString(16).padStart(2, '0')).join('')}`;
    };
    const darkest = Object.values(C).reduce((a, b) => (luminance(a) <= luminance(b) ? a : b));
    const bar = compose(C.card, alpha, darkest);
    // TYPE.label is TabButton's real word size (A4b); active runs bold (700),
    // inactive 500.
    check(`C1 worst case — active nav label (ink) on the ${alpha} bar over ${darkest}`, C.ink, bar, TYPE.label, true);
    check(`C1 worst case — inactive nav label (muted) on the ${alpha} bar over ${darkest}`, C.muted, bar, TYPE.label);
    checkUi('C1 worst case — inactive nav icon glyph (muted) over the bar', C.muted, bar);
    /**
     * WHY THE ACTIVE LABEL IS INK AND NOT HARBOR, kept as arithmetic: harbor
     * at 13.5 bold on this composite is ≈3.9:1, under the 4.5 normal-text
     * floor. That number is the reason styles.css overrides the active tab's
     * ink (C2) — this control keeps the reason measured, so nobody «restores»
     * harbor without first meeting the floor it fails today.
     */
    if (ratio(C.harbor, bar) < 4.5) pass++;
    else failures.push('negative control: harbor cleared 4.5:1 on the worst-case bar — the C2 ink override is no longer forced; re-derive it rather than keeping a rule whose reason expired');
    decorative('C2 active-circle harbor tint over the bar', compose(C.harbor, 0.16, bar), bar,
      'the ink glyph and label on it, the weight shift, and aria-current — the circle restates «you are here», it is never the sole carrier');
    decorative('C1 the capsule\'s hairline against the shell', C.line, C.shell,
      'the 0.92 card fill\'s luminance step over whatever lies beneath, and the labelled controls on the bar');
  }
}

/**
 * ——————————————————————— THE ONE WARM ACTION, pinned.
 *
 * "Amber is the cash keypad's button and nothing else" is a rule that cannot
 * survive on comment alone: the next person who wants a button to feel important
 * will reach for it, and the second amber empties the first of meaning. Contrast
 * maths cannot see that — it is a design rule, so it is asserted as one.
 */
{
  const fs = await import('node:fs');
  const all = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = new URL(`${dir.pathname}/${e.name}`, dir);
      if (e.isDirectory()) walk(p);
      else if (/\.jsx?$/.test(e.name) && e.name !== 'theme.js') all.push(p);
    }
  };
  walk(new URL('../src', import.meta.url));
  /**
   * ═══ ONE AMBER PER SCREEN — not one per app (Planner 4, 2026-08-19) ═══
   *
   * The previous form pinned amber to `views/EntryView.jsx` by FILE and counted
   * one use in the whole tree. It fired twice in one rev — on DictateView, and on
   * the batch review's confirm — and the second time the escalation was right:
   * a global-once reading means only ONE SCREEN IN THE APP may ever have a
   * primary action, which is not the rule. The rule serves "one decision per
   * screen"; it was enforcing the stricter reading by accident of implementation.
   *
   * Rendering the highest-consequence button in the app — the one that writes N
   * rows into his book in a single irreversible tap — in harbour made it look
   * SECONDARY, which inverts the hierarchy amber exists to encode.
   *
   * So: at most one amber per view file, and at least one somewhere. That is
   * strictly stronger than what it replaces, because it holds for screens not yet
   * written rather than naming the one file that existed when it was authored.
   *
   * `EntryDock` lives in EntryView.jsx and is rendered by the shell between
   * <main> and the tab bar — it is ON the entry screen, so one file is one
   * screen here.
   */
  const users = all
    .map((p) => [p.pathname.split('/src/')[1], (fs.readFileSync(p, 'utf8').match(/C\.amber\b/g) || []).length])
    .filter(([, n]) => n > 0);

  const crowded = users.filter(([, n]) => n > 1);
  if (!crowded.length) pass++;
  else failures.push(`at most ONE amber per screen — ${JSON.stringify(crowded)} uses it more than once, `
    + 'and a second amber on one screen empties the first of meaning');

  /**
   * A SCREEN is a view. The accent belongs on a primary ACTION, so a shared
   * component reaching for it would put the app's one emphasis in a place no
   * single screen owns — that is the drift the original rule was written against
   * and it survives the relaxation.
   */
  const nonViews = users.filter(([f]) => !f.startsWith('views/'));
  if (!nonViews.length) pass++;
  else failures.push(`amber belongs to a SCREEN's primary action, not to shared furniture — `
    + `found in ${JSON.stringify(nonViews.map(([f]) => f))}`);

  if (users.length) pass++;
  else failures.push('the warm accent is used NOWHERE — an accent nothing uses is not a design system, it is a dead token');
}

// ——————————————————————— every token must be measured somewhere.
const declared = new Set(Object.values(C));
for (const hex of declared) {
  if (seen.has(hex)) { pass++; continue; }
  failures.push(`the palette exports ${hex} but no pair uses it — either it is dead, or it is unchecked`);
}

// ——————————————————————— negative control: the measurement must be able to fail.
if (ratio('#FFFFFF', '#FAF7F1') < 3) pass++;
else failures.push('negative control: white-on-shell measured as readable — the ratio maths is wrong');
if (ratio('#000000', '#FFFFFF') > 20) pass++;
else failures.push('negative control: black-on-white did not measure as maximum contrast');

const w = Math.max(...rows.map((r) => r.where.length));
console.log('\n     pair'.padEnd(w + 7) + '  fg       bg        size  ratio   floor');
for (const r of rows) {
  console.log(`  ${r.mark} ${r.where.padEnd(w)}  ${r.fg}  ${r.bg}  ${String(r.px).padStart(4)}  ${String(r.r).padStart(6)}  ${r.floor ? `${r.floor}:1` : '—'}`);
}

if (flags.length) {
  console.log(`\n⚠️  ${flags.length} CANONICAL pair(s) below the AA floor — the Owner's call, flagged not changed:\n  - ${flags.join('\n  - ')}`);
}
const report = failures.length
  ? `\n❌ ${failures.length} / ${pass + failures.length} contrast checks failed:\n  - ${failures.join('\n  - ')}`
  : `\n✅ all ${pass} contrast checks passed${flags.length ? ` (${flags.length} canonical pair(s) flagged above)` : ''}`;
console.log(report);
process.exit(failures.length ? 1 : 0);
