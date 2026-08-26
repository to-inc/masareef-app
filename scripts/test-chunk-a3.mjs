#!/usr/bin/env node
/**
 * ═══════════ GATE — CHUNK A3 ═══════════
 * «Radii audit: every surface uses RADIUS tokens (incl. inset:8); the main
 *  amount display gets a capsule container.» (chunk-ledger A3 + TOKEN RULING 4)
 *
 * WHY A GLOBAL STATIC SCAN AND NOT AN ENUMERATION. A2 pinned enumerated sites
 * because its law is per-site (this card, borderless). A3's law is a VOCABULARY:
 * no borderRadius anywhere in src/ may state a raw value, except furniture
 * carrying the named geometry exemption. An enumeration would hold exactly the
 * sites it lists and bless every new screen's drift by omission — the audit has
 * to sweep whatever files exist on the day it runs.
 *
 * THE EXEMPTION IS PART OF THE LAW, NOT A LOOPHOLE. Ruling 4: furniture whose
 * radius is bounded by its own dimensions (bar caps, hairlines, thumbnails,
 * ~30px controls) states its radius inline WITH A COMMENT NAMING THE EXEMPTION.
 * So the scan accepts a raw radius only where the words «geometry exemption»
 * stand on the same line or within the four lines above it — a decided site
 * reads as decided; a bare number is the drift this audit exists to catch.
 *
 * TWO POSITIVE CONTROLS KEEP IT FALSIFIABLE THE OTHER WAY:
 *   · the BatchReview checkbox (a ~30px control) must KEEP an inline radius
 *     with the named comment — a tree that «cleaned it up» onto a surface token
 *     clamps a checkbox toward a circle, which ruling 4 names as an AFFORDANCE
 *     change, not a style; and
 *   · every RADIUS token must have ≥1 consumer — a tree that satisfied the
 *     scan by deleting radii (or the vocabulary) wholesale must go red here,
 *     never pass by absence.
 *
 * MID-WAVE HONESTY: BookView / Charts / EntryView are being retokenized by
 * their own leaves in parallel, so this suite may stay red on those three files
 * while a3-rest's own files are clean. The per-file breakdown below is printed
 * on every run — red or green — precisely so «whose files are dirty» is a thing
 * a reader sees rather than takes on faith. Global certification at wave end is
 * the Planner's.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKER = 'CHUNK-A3-GREEN';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = join(root, 'src');
const read = (p) => readFileSync(join(root, p), 'utf8');

let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) { pass++; } else { failures.push(label); } };

// ——— walk src/ — every file, so a new view cannot be born outside the audit
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (/\.(jsx?|css)$/.test(entry.name)) out.push(p);
  }
  return out;
}
const files = walk(srcRoot).map((p) => relative(root, p));

/**
 * A radius DECLARATION: `borderRadius:`, any logical variant
 * (`borderEndEndRadius:` …), or CSS `border-radius:`. The colon is what
 * separates a declaration from prose ABOUT one — theme.js's own doctrine
 * comments mention the word and must not count as sites.
 */
const RADIUS_DECL = /border-?[A-Za-z]*[Rr]adius\s*:/;
const EXEMPT = /geometry[\s-]*exemption/i;

const perFile = [];       // { file, sites, token, exempt, bad: [line refs] }
for (const file of files) {
  const lines = read(file).split('\n');
  const rec = { file, sites: 0, token: 0, exempt: 0, bad: [] };
  lines.forEach((ln, i) => {
    if (!RADIUS_DECL.test(ln)) return;
    rec.sites++;
    if (ln.includes('RADIUS.')) { rec.token++; return; }
    const context = lines.slice(Math.max(0, i - 4), i + 1).join('\n');
    if (EXEMPT.test(context)) { rec.exempt++; return; }
    rec.bad.push(`L${i + 1}: ${ln.trim().slice(0, 88)}`);
  });
  if (rec.sites) perFile.push(rec);
}

// ——— the per-file breakdown, printed on EVERY run (see header: mid-wave honesty)
console.log('— A3 radius audit · per-file breakdown —');
for (const r of perFile) {
  const verdict = r.bad.length ? `${r.bad.length} AD-HOC ⚠` : 'clean';
  console.log(`   ${r.file} · ${r.sites} site(s): ${r.token} token · ${r.exempt} exempt · ${verdict}`);
}

// ——— the scan itself ran over a real tree (a walker that found nothing proves nothing)
ok(files.length >= 40, `A3.0 walker — src/ yields ≥40 files (got ${files.length}); a scan over nothing is not a scan`);
ok(perFile.length >= 8, `A3.0 walker — ≥8 radius-bearing files (got ${perFile.length}); the app's surfaces did not all vanish`);

// ——— one check per radius-bearing file: no ad-hoc radius outside the named exemption
for (const r of perFile) {
  ok(r.bad.length === 0,
    `A3 scan — ${r.file} carries ${r.bad.length} ad-hoc radius site(s):\n      ${r.bad.join('\n      ')}`);
}

// ——— the vocabulary stands, at the ruled values, with the exemption stated by name
const theme = read('src/theme.js');
ok(/export const RADIUS = \{ card: 20, row: 16, capsule: 999, inset: 8 \}/.test(theme),
  'A3.V theme.js — RADIUS = { card: 20, row: 16, capsule: 999, inset: 8 } (§3 + ruling 4), verbatim');
ok(theme.includes('GEOMETRY EXEMPTION'),
  'A3.V theme.js — the GEOMETRY EXEMPTION doctrine is stated by name where the tokens live');

// ——— every token consumed: the audit cannot be satisfied by deleting radii wholesale
const allSrc = files.filter((f) => f !== 'src/theme.js').map(read).join('\n');
for (const t of ['card', 'row', 'capsule', 'inset']) {
  const n = (allSrc.match(new RegExp(`RADIUS\\.${t}\\b`, 'g')) || []).length;
  ok(n >= 1, `A3.C consumers — RADIUS.${t} has ≥1 consumer outside theme.js (got ${n}); a vocabulary nobody speaks is not a vocabulary`);
}

// ——— POSITIVE CONTROL: the ~30px checkbox KEEPS its inline radius, named.
//     Ruling 4's own example — mapping it onto a surface token clamps a checkbox
//     toward a circle, an affordance change. A tree that «tidied» it must fail.
const batch = read('src/views/BatchReviewView.jsx');
{
  const at = batch.indexOf("role=\"checkbox\"");
  // FORWARD-only window: the checkbox's own style block follows its role
  // attribute in source. A window reaching backward would sweep in the Row
  // wrapper's legitimate RADIUS.row and flip this control red for a reason
  // that has nothing to do with the checkbox.
  const region = at === -1 ? '' : batch.slice(at, at + 700);
  ok(at !== -1, 'A3.X control — the BatchReview tick checkbox still exists (role="checkbox")');
  ok(region && RADIUS_DECL.test(region) && !/borderRadius:\s*RADIUS\./.test(region),
    'A3.X control — the checkbox radius stays INLINE (geometry), never a surface token that would clamp it');
  ok(EXEMPT.test(region),
    'A3.X control — and it carries the named geometry-exemption comment (a decided site, not a straggler)');
}

// ——— POSITIVE CONTROL 2: the 40×40 thumbnail keeps its media-edge geometry, named
{
  const receipt = read('src/views/ReceiptView.jsx');
  const at = receipt.indexOf('objectFit');
  const region = at === -1 ? '' : receipt.slice(Math.max(0, at - 700), at + 700);
  ok(at !== -1 && RADIUS_DECL.test(region) && EXEMPT.test(region),
    'A3.X control — the JobRow thumbnail (theme.js: «a 40×40 thumbnail is GEOMETRY») keeps an inline radius with the named comment');
}

// ——— THE CAPSULE PIN: the main amount display sits in a capsule container.
//     The anchor is the render of the amount itself — the one part a dead
//     implementation cannot fake by keeping a token reference somewhere else.
{
  const entry = read('src/views/EntryView.jsx');
  const at = entry.indexOf("{amount || '0'}");
  ok(at !== -1, "A3.P amount display — EntryView still renders the main amount ({amount || '0'}); the site did not vanish");
  ok(at !== -1 && entry.slice(Math.max(0, at - 900), at).includes('RADIUS.capsule'),
    'A3.P amount display — its container carries RADIUS.capsule within the enclosing style (the capsule the chunk names)');
}

if (failures.length) {
  console.log(`❌ CHUNK A3 — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ ${MARKER} · ${pass} checks · every radius rides the RADIUS vocabulary; the amount sits in a capsule`);
