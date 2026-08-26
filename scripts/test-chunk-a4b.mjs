#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK A4b ═══════════
 * «Primitives.jsx finally speaks TYPE: every raw fontSize maps onto a TYPE
 *  token where the role matches and |raw−token| ≤ 1.5, or carries the NAMED
 *  geometry exemption where the text is genuinely furniture; test-contrast's
 *  declared sizes move in lockstep, same commit.» (chunk-ledger A4b; TOKEN
 *  RULINGS 1–2; theme.js «text → a TYPE token, always».)
 *
 * WHY A SCAN *AND* ROLE PINS *AND* RENDERS. The scan alone would be satisfied
 * by mapping every size onto whatever token is numerically nearest — Toast
 * onto label, the tab word onto caption — which is the category error the
 * vocabulary comment in theme.js warns against. So each component is ALSO
 * pinned to the token its ROLE earns, and then rendered, because a source pin
 * proves the code SAYS the thing, never that it happens (N2's lesson).
 *
 * THE RULINGS THIS ORACLE ENCODES (each flagged onward to the Owner):
 *   · Toast → TYPE.body (16). OfflineBanner → TYPE.label (15).
 *   · LangToggle / CurrencyToggle → TYPE.label. caption is ILLEGAL for them
 *     by ruling 2: the toggle's word is the only way out of the state it
 *     names — nothing about it is duplicated elsewhere.
 *   · SectionLabel → TYPE.label (muted prose label, 14 → 15).
 *   · Chip → TYPE.caption BOTH variants — a chip is a chip; the method is
 *     restated by the row it annotates, which is caption's legal scope.
 *   · NeutralDelta → TYPE.caption — a delta is TEXT that restates two figures
 *     the screen already shows; text takes a TYPE token, not an exemption.
 *   · TabButton's WORD → TYPE.label: «icon PLUS word, never icon-only» makes
 *     the word required reading, so it may not sit under the prose floor.
 *   · TabButton's BADGE stays 11 under the NAMED geometry exemption: a count
 *     pill riding the corner of the 50px circle, its size bounded by that
 *     geometry, its count duplicated by the Inbox it points at.
 *
 * Every render is guarded — a component that THROWS surfaces as a NAMED
 * failure, never as a dead process (the N1/N1b lesson, house pattern).
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { TYPE } from '../src/theme.js';

const MARKER = 'CHUNK-A4B-GREEN';
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const src = readFileSync(join(root, 'src/components/Primitives.jsx'), 'utf8');
const contrast = readFileSync(join(root, 'scripts/test-contrast.mjs'), 'utf8');

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };

/** The named-function slice, so a pin cannot match a neighbouring component. */
function componentSlice(text, name) {
  const decl = new RegExp(`^(?:export )?(?:default )?function ${name}\\b`, 'm').exec(text);
  if (!decl) return '';
  const rest = text.slice(decl.index + 1);
  const next = /^(?:export )?(?:default )?function /m.exec(rest);
  return text.slice(decl.index, next ? decl.index + 1 + next.index : text.length);
}

// ═══ 1. THE SCAN — no digit-bearing fontSize without the named exemption ═══
/**
 * A raw size is any `fontSize:` whose EXPRESSION carries a digit — `13`,
 * `16.5`, `small ? 12 : 13`. A token reference (`TYPE.body`, `ICON.control`,
 * `unitSize(size)`, a prop) carries none, so the vocabulary passes without a
 * whitelist this scan would then have to maintain. The one legal escape is
 * the exemption ruling 4 already defined for radii, cited BY NAME within the
 * lines above the site.
 */
const rawFontSizes = (text) => {
  const lines = text.split('\n');
  const offenders = [];
  lines.forEach((line, i) => {
    const m = /fontSize:\s*([^,}\n]+)/.exec(line);
    if (!m || !/\d/.test(m[1])) return;
    const above = lines.slice(Math.max(0, i - 8), i + 1).join('\n');
    if (!/GEOMETRY EXEMPTION/i.test(above)) offenders.push(`L${i + 1}: fontSize: ${m[1].trim()}`);
  });
  return offenders;
};
{
  const offenders = rawFontSizes(src);
  ok(offenders.length === 0,
    `A4b.1 no raw fontSize literal survives in Primitives.jsx outside TYPE/unitSize()/the named exemption — found ${offenders.length}:\n      ${offenders.join('\n      ')}`);
  // Negative control: the scanner must be able to SEE a raw size, or A4b.1 is
  // a scan that passes by blindness rather than by cleanliness.
  ok(rawFontSizes('x\n  style={{ fontSize: 13.5 }}').length === 1
    && rawFontSizes('// GEOMETRY EXEMPTION (ruling 4)\n  style={{ fontSize: 11 }}').length === 0,
    'A4b.2 negative control — the scanner flags a synthetic raw 13.5 and honours a synthetic named exemption');
}

// ═══ 2. ROLE PINS — the token each component EARNS, not the nearest one ═══
ok(/fontSize: TYPE\.body\b/.test(componentSlice(src, 'Toast')),
  'A4b.3 Toast speaks TYPE.body — 16.5 was body prose off by half a pixel');
ok(/fontSize: TYPE\.label\b/.test(componentSlice(src, 'OfflineBanner')),
  'A4b.4 OfflineBanner speaks TYPE.label — an advisory he must read sits ON the prose floor, not under it');
ok(/fontSize: TYPE\.label\b/.test(componentSlice(src, 'LangToggle')),
  'A4b.5 LangToggle speaks TYPE.label — the way out of a language he cannot read is not a caption');
ok(/fontSize: TYPE\.label\b/.test(componentSlice(src, 'CurrencyToggle')),
  'A4b.6 CurrencyToggle speaks TYPE.label — the sibling control rides the sibling token, by role not by copy');
ok(/fontSize: TYPE\.label\b/.test(componentSlice(src, 'SectionLabel')),
  'A4b.7 SectionLabel speaks TYPE.label — a muted heading is prose, and 14 was the drift');
{
  const chip = componentSlice(src, 'Chip');
  ok(/fontSize: TYPE\.caption\b/.test(chip) && !/fontSize:[^,\n]*\?/.test(chip),
    'A4b.8 Chip speaks TYPE.caption in BOTH variants — a chip is a chip; small varies the padding, never the type');
}
ok(/fontSize: TYPE\.caption\b/.test(componentSlice(src, 'NeutralDelta')),
  'A4b.9 NeutralDelta speaks TYPE.caption — a delta is text restating two shown figures, not exempt furniture');
{
  const tab = componentSlice(src, 'TabButton');
  ok(/fontSize: TYPE\.label\b/.test(tab),
    'A4b.10 the tab WORD speaks TYPE.label — «icon PLUS word» makes it required reading, so it takes the prose floor');
  const lines = tab.split('\n');
  const badgeAt = lines.findIndex((l) => /fontSize: 11\b/.test(l));
  ok(badgeAt !== -1 && /GEOMETRY EXEMPTION/i.test(lines.slice(Math.max(0, badgeAt - 8), badgeAt + 1).join('\n')),
    'A4b.11 the badge stays 11 UNDER the named geometry exemption — a count pill bounded by the 50px circle it rides, exempted in words at the site');
}

// ═══ 3. RENDERS — the retokenized sizes actually reach the markup ═══
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const P = await vite.ssrLoadModule('/src/components/Primitives.jsx');
  const html = (name, Comp, props) => {
    try {
      return renderToStaticMarkup(createElement(Comp, props));
    } catch (err) {
      failures.push(`${name} THREW while rendering — ${err && err.message}`);
      return '';
    }
  };
  const px = (n) => `font-size:${n}px`;

  const toast = html('Toast', P.Toast, { message: 'اتسجل ✓' });
  ok(toast.includes(px(TYPE.body)) && !toast.includes(px(16.5)),
    `A4b.12 Toast renders at ${TYPE.body}px — the 16.5 is gone from the markup, not merely from the source`);

  const banner = html('OfflineBanner', P.OfflineBanner, { text: 'الشبكة مقطوعة' });
  ok(banner.includes(px(TYPE.label)) && !banner.includes(px(14.5)),
    `A4b.13 OfflineBanner renders at ${TYPE.label}px, 14.5 gone`);

  const lang = html('LangToggle', P.LangToggle, { subtle: true });
  ok(lang.includes(px(TYPE.label)) && !lang.includes(px(13)),
    `A4b.14 LangToggle renders at ${TYPE.label}px — the size CHANGED, 13 gone`);

  const cur = html('CurrencyToggle', P.CurrencyToggle, { value: 'EGP', other: 'EUR', onFlip: () => {} });
  ok(cur.includes(px(TYPE.label)) && !cur.includes(px(13)),
    `A4b.15 CurrencyToggle renders at ${TYPE.label}px, 13 gone`);

  const section = html('SectionLabel', P.SectionLabel, { children: 'حسب طريقة الدفع' });
  ok(section.includes(px(TYPE.label)) && !section.includes(px(14)),
    `A4b.16 SectionLabel renders at ${TYPE.label}px, 14 gone`);

  const chipSmall = html('Chip(small)', P.Chip, { kind: 'Visa', small: true, label: 'Visa' });
  ok(chipSmall.includes(px(TYPE.caption)) && !chipSmall.includes(px(12)),
    `A4b.17 the SMALL chip renders at ${TYPE.caption}px — 12 grew to the caption floor`);
  ok(html('Chip', P.Chip, { kind: 'Cash', label: 'Cash' }).includes(px(TYPE.caption)),
    `A4b.18 the regular chip renders at ${TYPE.caption}px — same size, now by token`);

  const delta = html('NeutralDelta', P.NeutralDelta, { now: 200, prev: 100 });
  ok(delta.includes(px(TYPE.caption)) && !delta.includes(px(11.5)),
    `A4b.19 NeutralDelta renders at ${TYPE.caption}px, 11.5 gone`);

  const tab = html('TabButton', P.TabButton, { active: false, onClick: () => {}, label: 'الدفتر', icon: '☰', badge: 3 });
  ok(tab.includes(px(TYPE.label)) && !tab.includes(px(13.5)),
    `A4b.20 the tab word renders at ${TYPE.label}px, 13.5 gone`);
  ok(tab.includes(px(11)),
    'A4b.21 …and the exempted badge still renders at 11px — the retokenization did not sweep the furniture it ruled out');
} finally {
  await vite.close();
}

// ═══ 4. LOCKSTEP — test-contrast declares the SAME sizes, by reference ═══
/**
 * «Where test-contrast declares a size for a row you change, update the
 * declared size in the SAME commit» — held by demanding the TOKEN, not a
 * number: a declared TYPE.body cannot drift from the component's TYPE.body.
 */
ok(/'white on harbor — toast', C\.onDark, C\.harbor, TYPE\.body\b/.test(contrast),
  'A4b.22 the toast contrast row declares TYPE.body by reference');
ok(/'offline banner', C\.ink, C\.sand, TYPE\.label\b/.test(contrast),
  'A4b.23 the offline-banner row declares TYPE.label by reference');
ok(/'Visa chip', METHOD\.Visa\.fg, METHOD\.Visa\.bg, TYPE\.caption\b/.test(contrast)
  && /'Cash chip', METHOD\.Cash\.fg, METHOD\.Cash\.bg, TYPE\.caption\b/.test(contrast),
  'A4b.24 both method-chip rows declare TYPE.caption by reference');
ok(/active tab label \(ink — the C2 override\)', C\.ink, C\.card, TYPE\.label\b/.test(contrast)
  && (contrast.match(/C1 worst case — (?:active|inactive) nav label[^\n]*TYPE\.label/g) || []).length === 2,
  'A4b.25 the tab-word rows — the C2 override and BOTH C1 worst-case labels — declare TYPE.label by reference');

// ═══ 5. THE BUMP MUST STILL CLEAR EVERY FLOOR — or the bump loses ═══
{
  const run = spawnSync(process.execPath, [join(here, 'test-contrast.mjs')], { encoding: 'utf8' });
  ok(run.status === 0,
    `A4b.26 test-contrast passes with the retokenized sizes in force (exit ${run.status}) — a bump that broke a floor would lose here`);
}

if (failures.length) {
  console.log(`❌ CHUNK A4b — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · Primitives speaks TYPE: role-matched tokens, one named exemption, contrast in lockstep`);
