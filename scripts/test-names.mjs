#!/usr/bin/env node
/**
 * EVERY NAME USED IS A NAME THAT EXISTS (2026-10-10).
 *
 * The project has no linter, and on one day two builds shipped that crashed on
 * his phone for the same reason: a name used where it was never defined
 * (`bookHome` inside MonthScreen) and a name used but never imported. Vite builds
 * both happily — the error only happens when that line RUNS. This suite parses
 * every file in src/ and fails on:
 *   · an identifier with no binding in scope and no browser/JS global by that name;
 *   · a relative import of a name the target file does not export.
 * It uses @babel/parser + @babel/traverse, already installed under
 * @vitejs/plugin-react — no new dependency. (A full linter would also catch
 * unused vars and hook-order bugs; worth adding the day one of those bites.)
 */
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GLOBALS = new Set(Object.getOwnPropertyNames(globalThis).concat([
  'window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'fetch', 'requestAnimationFrame',
  'cancelAnimationFrame', 'location', 'history', 'alert', 'confirm', 'prompt', 'matchMedia', 'getComputedStyle',
  'indexedDB', 'IDBKeyRange', 'caches', 'self', 'screen', 'visualViewport', 'innerWidth', 'innerHeight',
  'devicePixelRatio', 'scrollTo', 'open', 'close', 'addEventListener', 'removeEventListener', 'dispatchEvent',
  'postMessage', 'Image', 'Blob', 'File', 'FileReader', 'HTMLCanvasElement', 'HTMLElement', 'Element', 'Node',
  'OffscreenCanvas', 'createImageBitmap', 'ResizeObserver', 'IntersectionObserver', 'MutationObserver',
  'Notification', 'Worker', 'ServiceWorkerRegistration', 'DOMParser', 'XMLSerializer', 'Path2D', 'ImageData',
  'KeyboardEvent', 'PointerEvent', 'TouchEvent', 'CustomEvent', 'print', 'escape', 'unescape',
  'arguments', 'undefined', '__APP_VERSION__', // vite.config.js `define`
]));

let pass = 0;
const failures = [];

/** Problems in one source text: [{ line, msg }]. `exportsOf` resolves relative imports. */
function scan(code, file, exportsOf) {
  const out = [];
  let ast;
  try { ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx'] }); } catch (e) {
    return [{ line: 0, msg: `does not parse: ${e.message}` }];
  }
  traverse(ast, {
    ReferencedIdentifier(p) {
      const n = p.node.name;
      if (p.isJSXIdentifier()) {
        if (/^[a-z]/.test(n)) return;                                   // <div>, not a component
        if (p.parentPath.isJSXMemberExpression() && p.parentPath.node.property === p.node) return;
      }
      if (!p.scope.hasBinding(n) && !GLOBALS.has(n)) out.push({ line: p.node.loc.start.line, msg: `«${n}» is not defined` });
    },
    ImportDeclaration(p) {
      const src = p.node.source.value;
      if (!src.startsWith('.') || !exportsOf) return;
      const base = path.resolve(path.dirname(file), src);
      const target = [base, `${base}.js`, `${base}.jsx`, `${base}/index.js`].find((c) => exportsOf.has(c));
      if (!target) { if (!/\.(css|svg|png|json)$/.test(src)) out.push({ line: p.node.loc.start.line, msg: `no file for «${src}»` }); return; }
      const ex = exportsOf.get(target);
      if (ex.star) return;
      for (const s of p.node.specifiers) {
        const name = s.type === 'ImportDefaultSpecifier' ? 'default' : s.type === 'ImportNamespaceSpecifier' ? null : s.imported.name;
        if (name && !ex.names.has(name)) out.push({ line: s.loc.start.line, msg: `«${name}» is not exported by ${src}` });
      }
    },
  });
  return out;
}

function exportsIn(code) {
  const names = new Set();
  let star = false;
  const ast = parser.parse(code, { sourceType: 'module', plugins: ['jsx'] });
  for (const n of ast.program.body) {
    if (n.type === 'ExportNamedDeclaration') {
      if (n.declaration && n.declaration.declarations) n.declaration.declarations.forEach((d) => Object.keys(t.getBindingIdentifiers(d.id)).forEach((k) => names.add(k)));
      else if (n.declaration && n.declaration.id) names.add(n.declaration.id.name);
      n.specifiers.forEach((s) => names.add(s.exported.name));
    }
    if (n.type === 'ExportDefaultDeclaration') names.add('default');
    if (n.type === 'ExportAllDeclaration') star = true;
  }
  return { names, star };
}

// ——— control first: the scan must catch both of the day's crash shapes.
{
  const seeded = scan("export function A() { return bookHome; }\nimport { nope } from './x.js';",
    path.join(root, 'src/seed.jsx'), new Map([[path.join(root, 'src/x.js'), { names: new Set(['yes']), star: false }]]));
  if (seeded.some((p) => /bookHome/.test(p.msg)) && seeded.some((p) => /nope/.test(p.msg))) pass++;
  else failures.push('control — the scan must flag an undefined name and a missing export in a seeded file');
}

const walk = (d) => readdirSync(d, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.(jsx?|mjs)$/.test(e.name) ? [path.join(d, e.name)] : []));
const files = walk(path.join(root, 'src'));
const exportsOf = new Map(files.map((f) => [f, exportsIn(readFileSync(f, 'utf8'))]));
for (const f of files) {
  const problems = scan(readFileSync(f, 'utf8'), f, exportsOf);
  if (problems.length) problems.forEach((p) => failures.push(`${path.relative(root, f)}:${p.line} ${p.msg}`));
  else pass++;
}

if (failures.length) {
  console.log(`❌ ${failures.length} name problem(s):\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ all ${pass} name checks passed · every identifier in src/ is defined, every relative import exists`);
