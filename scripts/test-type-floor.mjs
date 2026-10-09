#!/usr/bin/env node
/**
 * THE TYPE FLOOR (audit C8c, 2026-09-26; shipped as E-007…E-009).
 *
 * Every `fontSize:` in src/ whose numeric literal is below TYPE.label (15) must
 * be a token, or be DECLARED: a «geometry exemption» comment (any case) within
 * 10 lines above that is about type (says type/font/text/size), or a
 * `data-geometry` attribute on the enclosing tag (within 6 lines above). The
 * audit's 25-line window let radius/thumbnail exemptions excuse text (C3,
 * C12). It never flags 15 and up, and a bare 13 is caught — 13 is
 * TYPE.caption, said by name.
 *
 * Why it exists: every site it found sat behind a condition no fixture takes
 * (savedAt, truncated, a failed OCR job, a batch row), so no render suite saw
 * them; text Dad must read shipped at 10–12.5px.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

let pass = 0;
const failures = [];
const ok = (c, m) => { if (c) pass += 1; else failures.push(m); };

const FLOOR = 15;
function violations(text, file = '<seed>') {
  const lines = text.split('\n');
  const out = [];
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/fontSize:\s*([^,}\n]+)/g)) {
      const nums = (m[1].match(/(?<![\w.])\d+(?:\.\d+)?/g) || []).map(Number);
      if (!nums.some((n) => n < FLOOR)) continue;
      // A declaration must be ABOUT type: a nearby exemption for a corner
      // radius or a thumbnail's box once excused 12.5px text beside it.
      let declared = /data-geometry/.test(lines.slice(Math.max(0, i - 6), i + 1).join('\n'));
      for (let j = i; j >= Math.max(0, i - 10) && !declared; j -= 1) {
        if (/geometry exemption/i.test(lines[j])) {
          declared = /\b(type|font|text|size)\b/i.test(lines.slice(j, i + 1).join(' ').replace(/fontSize/g, ''));
          break;
        }
      }
      if (declared) continue;
      out.push(`${file}:${i + 1}  ${line.trim().slice(0, 90)}`);
    }
  });
  return out;
}

// ——— controls: the oracle must be able to fail, and must honour a declaration
ok(violations('<p style={{ fontSize: 12 }}>x</p>').length === 1, 'control: a seeded fontSize: 12 is caught');
ok(violations('<p style={{ fontSize: 13 }}>x</p>').length === 1, 'control: a seeded bare fontSize: 13 is caught (say TYPE.caption)');
ok(violations('// GEOMETRY exemption (ruling 4): axis tick text, bounded by the column\n<p style={{ fontSize: 11 }}>x</p>').length === 0,
  'control: a declared type exemption is honoured');
ok(violations('// geometry exemption (ruling 4): a 6px corner on a badge\n<p style={{ fontSize: 10 }}>x</p>').length === 1,
  'control: an exemption for a SHAPE does not excuse the text beside it');
ok(violations('<p style={{ fontSize: TYPE.label }}>x</p>').length === 0, 'control: a token passes');
ok(violations('<p style={{ fontSize: 16 }}>x</p>').length === 0, 'control: 15 and up is not this check\'s business');

// ——— the real tree
const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : /\.(jsx?|mjs)$/.test(f) ? [p] : [];
});
const found = walk('src').flatMap((f) => violations(readFileSync(f, 'utf8'), f));
ok(found.length === 0, `text below ${FLOOR}px that is neither a token nor declared:\n    ${found.join('\n    ')}`);

// ——— render pins the scan cannot express (audit C8c's two lockstep pins)
{
  const { createServer } = await import('vite');
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  try {
    const { PairedBars } = await vite.ssrLoadModule('/src/components/Charts.jsx');
    const { TYPE } = await vite.ssrLoadModule('/src/theme.js');
    const labels = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    const html = renderToStaticMarkup(createElement(PairedBars, {
      cur: [100, 200, 300, null, null, null, null, null, null, null, null, null],
      prev: Array(12).fill(50), labels, liveIndex: 2, color: '#123456',
    }));
    const prose = html.match(/<div data-avg-prose="[^"]*" style="([^"]*)">([\s\S]*?)<\/div>/);
    ok(prose && new RegExp(`font-size:${TYPE.label}px`).test(prose[1]) && prose[2].includes('200'),
      `E-008 the chart average is also said at ${TYPE.label}px outside the chart geometry — got ${prose ? prose[1] : 'nothing'}`);
    ok(!/data-geometry[^>]*data-avg-prose|data-avg-prose[^>]*data-geometry/.test(html), 'E-008 …and that line is not itself geometry');
  } finally { await vite.close(); }
  const app = readFileSync('src/App.jsx', 'utf8');
  const footer = app.slice(app.indexOf('{savedAt && ('), app.indexOf('{savedAt && (') + 200);
  ok(/fontSize: TYPE\.label/.test(footer), 'E-007 «Last updated» renders at TYPE.label');
}

if (failures.length) {
  console.log(`❌ type floor — ${failures.length} / ${pass + failures.length} checks failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ all ${pass} type-floor checks passed · no undeclared text below ${FLOOR}px in src/`);
