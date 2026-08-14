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
import { C, METHOD } from '../src/theme.js';

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
 * NOT `muted` on mist — 2.84:1, which is under 3:1 and therefore unreadable at
 * any size. The only small text that sits over the morning crown is the Today
 * screen's period strip, so its inactive label is `ink`. This composition is
 * mine (the crown is new), so it is a hard check and not a flag.
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
canonical('harbor on shell — headings', C.harbor, C.shell, 23, true, 'reserved for large/bold per the brief; passes there');
check('harbor on card — headings', C.harbor, C.card, 21, true);
check('white on harbor — primary button', C.onDark, C.harbor, 18.5, true);
check('white on harbor — toast', C.onDark, C.harbor, 16.5);
check('white on harbor — active metric value', C.onDark, C.harbor, 19, true);
check('white on harbor — active metric label', C.onDark, C.harbor, 11.5, true);
check('active tab label', C.harbor, C.card, 13.5, true);

// ——————————————————————— the one warm action
check('cash CTA label — amberInk on amber', C.amberInk, C.amber, 18.5, true);
canonicalUi('cash CTA silhouette against the shell', C.amber, C.shell,
  'amber → #B48836 (3.01:1). The LABEL on it is fine at 5.80:1 — it is the button\'s outline against the page that is soft.');

// ——————————————————————— tertiary and advisory surfaces
check('category chip label', C.ink, C.shell, 15);
check('sand chip label', C.ink, C.sand, 15);
check('offline banner', C.ink, C.sand, 14.5, true);
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
check('Visa chip', METHOD.Visa.fg, METHOD.Visa.bg, 13, true);
check('Cash chip', METHOD.Cash.fg, METHOD.Cash.bg, 13, true);

// ——————————————————————— chart marks: graphics, 3:1 against their ground
checkUi('chart stroke — Visa/primary', C.harbor, C.card);
checkUi('chart stroke — Cash', C.muted, C.card);
checkUi('chart stroke — all', C.ink, C.card);
checkUi('focus ring', C.harbor, C.shell);
decorative('card border against the shell', C.line, C.shell, 'the white card fill and its shadow');
decorative('the morning crown wash', C.mist, C.shell, 'nothing — it is a background gradient behind ink text');

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
  const users = all
    .map((p) => [p.pathname.split('/src/')[1], (fs.readFileSync(p, 'utf8').match(/C\.amber\b/g) || []).length])
    .filter(([, n]) => n > 0);
  const total = users.reduce((s, [, n]) => s + n, 0);
  // views/EntryView.jsx — renamed from CashView with R-receipts 1; the rule is
  // unchanged, and the amber is still the one on its submit button.
  if (total === 1 && users[0][0] === 'views/EntryView.jsx') pass++;
  else failures.push(`amber must appear exactly once, in views/EntryView.jsx — found ${total} use(s) in ${JSON.stringify(users.map(([f]) => f))}`);
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
