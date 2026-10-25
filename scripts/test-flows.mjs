#!/usr/bin/env node
/**
 * THE FLOW GUARD — the real app, tapped like a person taps it.  `npm run check:flows`
 *
 * WHY IT EXISTS (audit 2026-10-25). October's escaped bugs were all invisible to
 * the ~6,800 checks that render pieces as strings or read source text:
 *   · Night text at 1.02:1 (the palette test measured LIGHT tokens only);
 *   · «Don't log it» that recorded nothing (a test checked the onClick's SOURCE);
 *   · the photo viewer trapped inside a glass card (a layout fact, no string shows it);
 *   · a blank screen when a download failed (only a real loader can fail).
 * So this boots the app in headless Chromium on the mock server and checks
 * OUTCOMES on screen: what a person sees after a tap, and whether they can read it.
 *
 * THE CONTRAST SCAN MEASURES PIXELS, NOT CSS. Glass is a gradient over a blurred
 * ground; no computed style names the colour behind a word. A screenshot does:
 * for each text element, the most common pixel in its box is the background it
 * really sits on. A positive control (warm ink on night sand, the 1.02:1 pair)
 * proves every run that the scan can see the failure it exists for.
 */
import { createServer } from 'vite';
import { inflateSync } from 'node:zlib';

let pass = 0;
const failures = [];
const ok = (cond, msg) => { if (cond) { pass += 1; console.log(`PASS ${msg.split(' ')[0]}`); } else failures.push(msg); };

// ——— minimal PNG decoder (8-bit RGB/RGBA, non-interlaced — what Chromium writes)
function decodePng(buf) {
  let p = 8, w = 0, h = 0, ct = 6; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3, stride = w * bpp, raw = inflateSync(Buffer.concat(idat)), out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[dst + x - bpp] : 0, b = y ? out[dst - stride + x] : 0, c = x >= bpp && y ? out[dst - stride + x - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[dst + x] = v & 255;
    }
  }
  return { w, h, px: (x, y) => { const i = y * stride + x * bpp; return [out[i], out[i + 1], out[i + 2]]; } };
}
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// ——— the mock app, in a real browser
const server = await createServer({ logLevel: 'error', server: { port: 5312, strictPort: false } });
await server.listen();
const origin = (server.resolvedUrls.local[0] || `http://localhost:${server.config.server.port}/`).replace(/\/$/, '');
const url = origin.endsWith(server.config.base.replace(/\/$/, '')) ? origin + '/' : origin + server.config.base;

let chromium;
try { ({ chromium } = await import('playwright')); } catch {
  console.error('❌ flow guard: the `playwright` package is not installed — run:  npm i -D playwright');
  await server.close(); process.exit(1);
}
let browser;
try { browser = await chromium.launch(); } catch (e) {
  console.error('❌ flow guard: no chromium binary — run:  npx playwright install chromium'); await server.close(); process.exit(1);
}

const SETUP = { 'masareef.secret': 'test-secret-local', 'masareef.execUrl': 'https://script.google.com/macros/s/TESTMOCK/exec' };
async function openApp({ lang = 'en', theme = 'light', extra = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, colorScheme: theme === 'night' ? 'dark' : 'light', serviceWorkers: 'block' });
  await ctx.addInitScript((kv) => { try { if (!sessionStorage.getItem('seeded')) { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); } } catch { /* fresh */ } },
    { ...SETUP, 'masareef.lang': lang, 'masareef.theme': theme, ...extra });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|TESTMOCK/.test(m.text())) errors.push(m.text()); });
  await page.goto(url);
  await page.waitForSelector('nav button, [role=tablist], main', { timeout: 8000 });
  await page.waitForTimeout(700);   // entrances (320 ms) settle before anything is measured
  return { ctx, page, errors };
}
const clickText = (page, re) => page.evaluate((src) => {
  const rx = new RegExp(src); const b = [...document.querySelectorAll('button')].find((x) => rx.test(x.innerText.trim()));
  if (b) b.click(); return !!b;
}, re.source);

/** Every visible text element's colour against the pixel that is most common in its box. */
async function contrastScan(page, label) {
  await page.waitForTimeout(500);
  const items = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('[aria-hidden="true"], svg, [data-scan-skip]')) continue;
      const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ');
      if (!own || own === 'MOCK') continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 6 || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
      // Only what is on top at the box's centre (a sheet over the page hides the page).
      const hit = document.elementFromPoint(Math.min(innerWidth - 1, r.left + r.width / 2), Math.min(innerHeight - 1, r.top + r.height / 2));
      if (!hit || !(el === hit || el.contains(hit) || hit.contains(el))) continue;
      let op = 1; for (let p = el; p; p = p.parentElement) op *= +getComputedStyle(p).opacity;
      if (op < 0.9) continue;   // a deliberately faded (inert) element is judged by its fade, not here
      const m = cs.color.match(/\d+(\.\d+)?/g).map(Number);
      const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700;
      out.push({ text: own.slice(0, 40), color: m.slice(0, 3), alpha: m[3] ?? 1, x: r.left, y: r.top, w: r.width, h: r.height, large: size >= 24 || (bold && size >= 18.66) });
    }
    return out;
  });
  const png = decodePng(await page.screenshot());
  const bad = [];
  for (const it of items) {
    if (it.alpha < 0.5) continue;
    const counts = new Map();
    const x0 = Math.max(0, Math.floor(it.x)), y0 = Math.max(0, Math.floor(it.y));
    const x1 = Math.min(png.w - 1, Math.ceil(it.x + it.w)), y1 = Math.min(png.h - 1, Math.ceil(it.y + it.h));
    for (let y = y0; y <= y1; y += 2) for (let x = x0; x <= x1; x += 2) {
      const c = png.px(x, y), k = (c[0] >> 3) << 10 | (c[1] >> 3) << 5 | (c[2] >> 3);
      const e = counts.get(k); if (e) e.n++; else counts.set(k, { n: 1, c });
    }
    let bg = null, n = 0; for (const e of counts.values()) if (e.n > n) { n = e.n; bg = e.c; }
    if (!bg) continue;
    const r = ratio(it.color, bg), floor = it.large ? 3 : 4.5;
    if (r < floor - 0.05) bad.push(`«${it.text}» ${r.toFixed(2)}:1 (needs ${floor}) rgb(${it.color}) on rgb(${bg})`);
  }
  return { label, measured: items.length, bad };
}

try {
  // ═══ F1 — it opens, in both languages, with no script errors
  for (const lang of ['en', 'ar']) {
    const { ctx, page, errors } = await openApp({ lang });
    const dir = await page.evaluate(() => document.documentElement.dir || getComputedStyle(document.documentElement).direction);
    ok(errors.length === 0 && dir === (lang === 'ar' ? 'rtl' : 'ltr'), `F1.${lang} the app opens in ${lang} (${dir}) with no script errors ${errors.slice(0, 2).join(' | ')}`);
    await ctx.close();
  }

  // ═══ F2 — every screen readable, light and Night (pixels, not tokens)
  const DRAFT = JSON.stringify({ jobs: [{ sourceHash: 'h1', defaultMethod: 'Visa', entries: [
    { date: '2026-10-16', amount: 4, currency: 'EUR', merchant_display: 'Espresso House', row_status: 'completed', category: 'Eating out', dupBook: { checked: true, match: { date: '16/10/2026', description: 'Espresso House', amount: 4, currency: 'EUR' } } },
    { date: null, amount: 13.25, currency: 'EUR', merchant_display: 'K-Citymarket Turku', row_status: 'completed', category: 'Groceries', dupBook: { checked: false, reason: 'no_date' } },
    { date: '2026-10-17', amount: 6.5, currency: 'EUR', merchant_display: 'R-kioski', row_status: 'pending', category: 'Groceries' },
  ] }], settled: null });
  for (const theme of ['light', 'night']) {
    const { ctx, page } = await openApp({ theme, extra: { 'masareef.batchDraft.v1': DRAFT } });
    const screens = [];
    screens.push(await contrastScan(page, 'To review'));
    await clickText(page, /^Book$/); await page.waitForTimeout(900);
    screens.push(await contrastScan(page, 'Book · Today'));
    await clickText(page, /^Week$/); await page.waitForTimeout(1200);
    screens.push(await contrastScan(page, 'Book · Week'));
    await page.evaluate(() => document.querySelector('button[aria-haspopup=dialog]').click()); await page.waitForTimeout(900);
    await page.evaluate(() => document.querySelectorAll('[data-settings-group]').forEach((d) => { d.open = true; }));
    screens.push(await contrastScan(page, 'Settings'));
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    await clickText(page, /not logged yet/); await page.waitForTimeout(1500);
    screens.push(await contrastScan(page, 'Statement review'));
    for (const s of screens) {
      ok(s.measured >= 5 && s.bad.length === 0, `F2.${theme}.${s.label.replace(/\W+/g, '')} every word on «${s.label}» (${theme}) is readable — ${s.measured} measured; ${s.bad.slice(0, 4).join('; ')}`);
    }
    if (theme === 'night') {
      // positive control: the 1.02:1 pair that shipped (warm ink on night sand) must be caught
      await page.evaluate(() => { const d = document.createElement('div'); d.id = 'pc'; d.style.cssText = 'position:fixed;top:300px;left:20px;z-index:99;padding:12px 16px;background:#3A3122;color:#3d2f0d;font:600 15px system-ui'; d.textContent = 'positive control text'; document.body.appendChild(d); });
      const pc = await contrastScan(page, 'control');
      ok(pc.bad.some((b) => /positive control/.test(b)), 'F2.control the scan catches the warm-ink-on-night-sand pair that shipped at 1.02:1');
    }
    await ctx.close();
  }

  // ═══ F3 — the statement review DOES what its buttons say
  {
    const { ctx, page } = await openApp({ extra: { 'masareef.batchDraft.v1': DRAFT } });
    await clickText(page, /^Book$/); await page.waitForTimeout(800);
    const waiting = () => page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /not logged yet/.test(x.innerText)); const m = b && b.innerText.match(/(\d+)/); return m ? +m[1] : 0; });
    const before = await waiting();
    await clickText(page, /not logged yet/); await page.waitForTimeout(1200);
    const tick = (name) => page.$eval(`[role=checkbox][aria-label="${name}"]`, (e) => e.getAttribute('aria-checked'));
    ok(await tick('Espresso House') === 'false' && await tick('K-Citymarket Turku') === 'false',
      `F3.start a duplicate and an undated row both start unticked — ${await tick('Espresso House')}/${await tick('K-Citymarket Turku')}`);
    await clickText(page, /^Select all$/); await page.waitForTimeout(200);
    ok(await tick('K-Citymarket Turku') === 'false' && await tick('R-kioski') === 'true', 'F3.all «Select all» ticks the dated rows and leaves the undated one (the server would refuse it)');
    await page.evaluate(() => [...document.querySelectorAll('button[aria-expanded]')].find((b) => /Espresso/.test(b.innerText)).click());
    await page.waitForTimeout(300);
    await page.click('[data-batch-discard]'); await page.waitForTimeout(400);
    const left = await page.$eval('[data-batch-left]', (e) => e.innerText).catch(() => null);
    const focus = await page.evaluate(() => document.activeElement && document.activeElement.innerText.slice(0, 20));
    ok(left === 'Left out' && /Espresso/.test(focus || ''), `F3.left «Don't log it» marks the row «Left out» and keeps focus on it — ${left} / ${focus}`);
    await page.fill('[data-batch-date] input', '2026-10-15'); await page.waitForTimeout(300);
    ok(await tick('K-Citymarket Turku') === 'true', 'F3.date picking the undated row\'s day ticks it');
    await page.fill('[data-batch-date] input', '2020-01-01'); await page.waitForTimeout(300);
    ok(await tick('K-Citymarket Turku') === 'false', 'F3.range a day the server would refuse (years back) does not tick the row');
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /Back|←/.test(b.getAttribute('aria-label') || b.innerText)).click());
    await page.waitForTimeout(500);
    await clickText(page, /^Book$/); await page.waitForTimeout(800);
    const after = await waiting();
    ok(before === 3 && after === 2, `F3.count the Book's «not logged yet» drops when a row is left out — ${before} → ${after}`);
    await ctx.close();
  }

  // ═══ F4 — Settings behaves like a dialog
  {
    const { ctx, page } = await openApp();
    await page.evaluate(() => document.querySelector('button[aria-haspopup=dialog]').click()); await page.waitForTimeout(800);
    const opened = await page.evaluate(() => ({ dlg: !!document.querySelector('[role=dialog][aria-modal=true]'), focus: document.activeElement && document.activeElement.innerText }));
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    const closed = await page.evaluate(() => !document.querySelector('[data-settings-head]'));
    ok(opened.dlg && opened.focus === 'Close' && closed, `F4 Settings opens as a dialog with focus on Close, and Escape closes it — ${JSON.stringify(opened)} closed=${closed}`);
    await ctx.close();
  }

  // ═══ F5 — the photo eye fills the SCREEN (it was trapped inside a glass card once)
  {
    const { ctx, page } = await openApp();
    await page.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 300; c.height = 500; const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, 300, 500); g.fillStyle = '#000'; g.font = '28px monospace'; g.fillText('TEST', 100, 200);
      const q = await import('/masareef/src/state/receiptQueue.js');
      for (const j of await q.all()) await q.remove(j.id);
      await q.enqueue({ id: 'flow1', base64: c.toDataURL('image/jpeg', 0.8).split(',')[1], clientHash: 'flow1', snapDate: '2026-10-20' });
      const r = await import('/masareef/src/state/receiptRunner.js'); r.jobsChanged(); r.runner().pump();
    });
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /Ready/.test(b.innerText)), null, { timeout: 8000 });
    await clickText(page, /Ready/); await page.waitForTimeout(1200);
    await page.click('[data-photo-peek]'); await page.waitForTimeout(500);
    const box = await page.$eval('[data-photo-view]', (e) => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight, top: document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest('[data-photo-view]') !== null }; }).catch(() => null);
    ok(!!box && box.w === box.vw && box.h === box.vh && box.top, `F5 the photo viewer covers the whole screen and is on top — ${JSON.stringify(box)}`);
    await page.evaluate(async () => { const q = await import('/masareef/src/state/receiptQueue.js'); for (const j of await q.all()) await q.remove(j.id); });
    await ctx.close();
  }

  // ═══ F6 — a failed download says so instead of a blank screen
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await ctx.addInitScript((kv) => { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); }, { ...SETUP, 'masareef.lang': 'en' });
    const page = await ctx.newPage();
    await page.route(/strings\.en\.js/, (r) => r.abort());
    await page.goto(url); await page.waitForTimeout(2500);
    const text = await page.evaluate(() => document.body.innerText);
    ok(/Try again/.test(text) && /جرّب تاني/.test(text), `F6 when the language file cannot load, a two-language «Try again» shows — «${text.slice(0, 60).replace(/\n/g, ' ')}»`);
    await ctx.close();
  }
} finally {
  await browser.close();
  await server.close();
}

if (failures.length) {
  console.log(`❌ flows — ${failures.length} / ${pass + failures.length} failed:`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`✅ all ${pass} flow checks passed · the real app, tapped and read, in light and Night`);
