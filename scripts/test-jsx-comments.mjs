#!/usr/bin/env node
/**
 * NO COMMENT MAY REACH THE SCREEN.  `npm run check:jsx`
 *
 * WHY THIS EXISTS, stated plainly because it shipped.
 *
 * In JSX, `/* … *\/` is only a comment inside an expression container. In
 * CHILDREN position it is a TEXT NODE, and React renders it. A glass-audit
 * annotation was inserted above two elements — one in `style={{…}}`, where it
 * was a real comment, and one between `<span>` and `{row.description}`, where
 * it was not. The second painted nine lines of source commentary onto the
 * Today screen, above the merchant name, on the Owner's phone.
 *
 * The board had 5,600 assertions and every one passed. Not one of them looked
 * at rendered output for comment syntax, because nothing had ever needed to.
 *
 * Two nets, because each misses what the other catches:
 *
 *   1. RENDER — the real oracle. Render components and assert the HTML string
 *      carries no comment delimiters. This cannot be fooled by formatting.
 *   2. SOURCE — the cheap net, covering files no suite renders yet. A line that
 *      is only a block comment, directly after a line closing a JSX tag, is in
 *      children position.
 *
 * Both carry positive controls, so neither can pass by finding nothing.
 *\/
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sep as require$$sep } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
let pass = 0;
const failures = [];
const ok = (c, m) => { if (c) pass++; else failures.push(m); };

const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : (p.endsWith('.jsx') ? [p] : []);
});
const files = walk(SRC);
const rel = (p) => p.slice(SRC.length + 1);

// ─────────────────────────────────────────────── 1. SOURCE NET
const inChildren = (lines) => {
  const hits = [];
  lines.forEach((l, i) => {
    const s = l.trim();
    if (!(s.startsWith('/*') && s.endsWith('*/'))) return;
    let j = i - 1;
    while (j >= 0 && !lines[j].trim()) j -= 1;
    const prev = j >= 0 ? lines[j].trim() : '';
    // a previous line ending in '>' closed a JSX tag: we are between tags
    if (prev.endsWith('>') && !prev.endsWith('=>')) hits.push(i + 1);
  });
  return hits;
};

const offenders = [];
for (const p of files) {
  for (const n of inChildren(readFileSync(p, 'utf8').split('\n'))) {
    offenders.push(`${rel(p)}:${n}`);
  }
}
ok(offenders.length === 0,
  `block comment in JSX children position — React renders these as text: ${offenders.join(', ')}`);

// positive control for the source net
const CONTROL = ['        <span style={{ fontSize: 16 }}>', '          /* a note */', '          {value}'];
ok(inChildren(CONTROL).length === 1,
  'the source net failed its positive control — it would pass vacuously');
const CONTROL_OK = ['        style={{', '          /* a note */', '          fontSize: 16,'];
ok(inChildren(CONTROL_OK).length === 0,
  'the source net flags comments inside style objects — it would report false positives');

// ─────────────────────────────────────────────── 2. COMPILE NET (the real one)
// Vite compiles JSX the same way the app's build does. A comment in CHILDREN
// position survives compilation as a STRING ARGUMENT to jsx(); a comment inside
// an expression container is discarded. So: compile every .jsx and look for a
// comment delimiter inside a string literal. No props, no fixtures, total
// coverage, and it measures exactly what the browser will be handed.
const { createServer } = await import('vite');
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });

const leakedIn = (code) => {
  // string literals in the compiled module
  const lits = code.match(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g) || [];
  // BOTH delimiters, in that order — a leaked comment is a complete comment.
  // `"image/*"` (a MIME accept type) contains `/*` and is not one; requiring the
  // closing delimiter too is what tells a real leak from a wildcard.
  return lits.filter((l) => { const a = l.indexOf('/*'); return a !== -1 && l.indexOf('*/', a + 2) !== -1; });
};

try {
  let compiled = 0;
  for (const p of files) {
    const url = '/' + p.slice(join(HERE, '..').length + 1).split(require$$sep).join('/');
    let res;
    try { res = await vite.transformRequest(url, { ssr: true }); }
    catch (e) { failures.push(`${rel(p)} failed to compile: ${e.message}`); continue; }
    if (!res || !res.code) continue;
    compiled += 1;
    const leaks = leakedIn(res.code);
    ok(leaks.length === 0,
      `${rel(p)} compiles a comment into rendered text: ${leaks.slice(0, 2).join(' , ').slice(0, 140)}`);
  }
  ok(compiled >= 10, `expected to compile the app's views, only compiled ${compiled}`);

  // POSITIVE CONTROL: compile a fixture that genuinely leaks, and require the
  // detector to fire. Without this, "no leaks found" proves nothing.
  ok(leakedIn('const a = jsx("span", { children: "/* leaked */" });').length === 1,
    'the compile net failed its positive control — it would pass vacuously');
  ok(leakedIn('const a = jsx("span", { children: value });').length === 0,
    'the compile net fires on clean output — it would report false positives');
  ok(leakedIn('const a = jsx("input", { accept: "image/*" });').length === 0,
    'the compile net flags a MIME wildcard as a comment — it would report false positives');
} finally {
  await vite.close();
}

const report = failures.length
  ? `❌ ${failures.length} / ${pass + failures.length} jsx-comment checks failed:\n  - ${failures.join('\n  - ')}`
  : `✅ all ${pass} jsx-comment checks passed`;
console.log(report);
process.exit(failures.length ? 1 : 0);
