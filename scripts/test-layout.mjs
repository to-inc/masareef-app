#!/usr/bin/env node
/**
 * THE BROWSER-LAYOUT GUARD.  `npm run check:layout`
 *
 * ——— WHY IT LIVES OUTSIDE THE SSR BOARD.
 *
 * The ledger-row split — a Latin merchant name («Coffee», «Nile Star Market»)
 * drifting to the row's opposite edge from its own category/method, and
 * colliding with the amount — is a GEOMETRIC defect: two boxes resolving to
 * opposite edges under bidi + CSS grid. `renderToStaticMarkup` produces a
 * string with NO layout, so every other suite is structurally blind to it, and
 * it shipped AUDIT-CLEAN for as long as it shipped. Reasoning about a screenshot
 * missed it too; only a measured `getBoundingClientRect` in a real engine sees
 * it. So this guard boots the real app in headless chromium, at the RTL mobile
 * viewport where the split lives, and measures.
 *
 * ——— THE POSITIVE CONTROL IS ON THE ORACLE ITSELF.
 *
 * After proving the shipped rows are aligned, it re-injects `dir="auto"` onto a
 * description and asserts the split REAPPEARS. A check that cannot fail proves
 * nothing; this one demonstrates, every run, that it can see the very defect it
 * exists for.
 *
 * ——— IT NEEDS A BROWSER, AND SAYS SO.
 *
 * If the chromium binary is absent it FAILS LOUD with the one-line remedy — it
 * never skips. An environment that cannot run the check is a failed
 * verification, not a pass (the honest-render law, applied to the harness).
 */
import { createServer } from 'vite';

let pass = 0;
const failures = [];
const ok = (cond, msg) => { if (cond) pass += 1; else failures.push(msg); };

// The row set the split lives on: Latin-named merchants (the bank prints them
// in Latin), which `dir="auto"` used to resolve LTR and drift to the left.
const LATIN_ROWS = ['Coffee', 'Taqa', 'Uber', 'Café de Flore', 'Nile Star Market'];

// ————————————————————————————————————— boot the REAL app (mock is the default)
const server = await createServer({
  logLevel: 'error',
  // Ephemeral-ish: strictPort false so a running dev server (5173) never clashes.
  server: { port: 5311, strictPort: false },
});
await server.listen();
const origin = (server.resolvedUrls.local[0] || `http://localhost:${server.config.server.port}/`)
  .replace(/\/$/, '');
const url = origin.endsWith(server.config.base.replace(/\/$/, ''))
  ? origin + '/'
  : origin + server.config.base;

// ————————————————————————————————————— chromium, or a loud, honest failure
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('❌ layout guard: the `playwright` package is not installed — run:  npm i -D playwright');
  await server.close();
  process.exit(1);
}

let browser;
try {
  try {
    browser = await chromium.launch();
  } catch (e) {
    console.error('❌ layout guard: chromium is not installed — run:  npx playwright install chromium');
    console.error('   (' + String(e && e.message ? e.message : e).split('\n')[0] + ')');
    await server.close();
    process.exit(1);
  }

  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page.goto(url, { waitUntil: 'networkidle' });

  // Arabic locale (the app default) → RTL, the split's home. Go to the Book tab.
  await page.getByRole('button', { name: /الدفتر|Book/ }).first().click();
  await page.waitForFunction(
    () => [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Coffee')),
    null, { timeout: 5000 },
  );

  // A row's description and its OWN metadata are siblings in the inner block;
  // the split is precisely them resolving to opposite start edges.
  //
  // ⚠️ MEASURE THE TEXT, NOT THE BOX. The description box is stretched to the
  // full column width, so `text-align` moves the GLYPHS inside it while the box
  // edges never move — `getBoundingClientRect()` on the span is blind to the
  // split (the positive control caught exactly this). A Range around the text
  // node gives the tight box the reader actually sees.
  const measure = (names) => page.evaluate((rows) => {
    const dir = getComputedStyle(document.documentElement).direction;
    const startEdge = (r) => (dir === 'rtl' ? Math.round(r.right) : Math.round(r.left));
    const textStart = (el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return startEdge(range.getBoundingClientRect());
    };
    const btns = [...document.querySelectorAll('button')];
    const out = [];
    for (const name of rows) {
      const rb = btns.find((b) => b.textContent.includes(name));
      if (!rb) continue;
      const desc = [...rb.querySelectorAll('span')].find((s) => s.textContent.trim() === name);
      const meta = desc && desc.nextElementSibling; // the category/method line
      if (!desc || !meta) continue;
      out.push({ name, descStart: textStart(desc), metaStart: textStart(meta) });
    }
    return { dir, rows: out };
  }, names);

  const before = await measure(LATIN_ROWS);
  ok(before.dir === 'rtl', `the guard must run RTL to exercise the split (dir=${before.dir})`);
  ok(before.rows.length >= 3,
    `the fixture must render Latin-named rows to measure (got ${before.rows.length})`);
  for (const r of before.rows) {
    ok(Math.abs(r.descStart - r.metaStart) <= 2,
      `[${r.name}] the description and its own metadata must share the row's start edge — `
      + `desc@${r.descStart} vs meta@${r.metaStart}: the row is split`);
  }

  // ——— POSITIVE CONTROL: reintroduce the exact defect, prove the guard sees it.
  const split = await page.evaluate(() => {
    const dir = getComputedStyle(document.documentElement).direction;
    const startEdge = (r) => (dir === 'rtl' ? Math.round(r.right) : Math.round(r.left));
    const textStart = (el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return startEdge(range.getBoundingClientRect());
    };
    const rb = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Coffee'));
    const desc = [...rb.querySelectorAll('span')].find((s) => s.textContent.trim() === 'Coffee');
    desc.setAttribute('dir', 'auto'); // the removed attribute, put back
    const meta = desc.nextElementSibling;
    return { descStart: textStart(desc), metaStart: textStart(meta) };
  });
  ok(Math.abs(split.descStart - split.metaStart) > 20,
    'positive control FAILED: re-adding dir="auto" did not split the Coffee row '
    + `(desc@${split.descStart} vs meta@${split.metaStart}) — the guard cannot detect the defect it exists for`);
} finally {
  if (browser) await browser.close();
  await server.close();
}

const report = failures.length
  ? `❌ layout guard — ${failures.length} / ${pass + failures.length} checks failed:\n  - ${failures.join('\n  - ')}`
  : `✅ layout guard — all ${pass} checks passed · ledger rows hold together, and the split is caught when reintroduced`;
console.log(report);
process.exit(failures.length ? 1 : 0);
