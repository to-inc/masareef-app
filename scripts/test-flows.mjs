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
    if (box) { await page.mouse.click(box.vw / 2, box.vh - 6); await page.waitForTimeout(300); }
    ok(!(await page.$('[data-photo-view]')), 'F5b a tap on the dark below the picture closes the viewer');
    await page.evaluate(async () => { const q = await import('/masareef/src/state/receiptQueue.js'); for (const j of await q.all()) await q.remove(j.id); });
    await ctx.close();
  }

  // ═══ F7 — a photo that never finishes reading becomes one he can act on (2026-10-31)
  {
    const { ctx, page, errors } = await openApp();
    const img = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 200; c.height = 300; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 200, 300); return c.toDataURL('image/jpeg', 0.8).split(',')[1]; });
    const stageOf = (id) => page.evaluate(async (k) => { const q = await import('/masareef/src/state/receiptQueue.js'); const j = (await q.all()).find((x) => x.id === k); return j ? `${j.stage}/${j.error || ''}` : 'gone'; }, id);
    // (a) the app was closed mid-read: the job is stored as `reading` and nothing is reading it
    await page.evaluate(async (b64) => {
      const q = await import('/masareef/src/state/receiptQueue.js');
      for (const j of await q.all()) await q.remove(j.id);
      await q.enqueue({ id: 'stuck1', base64: b64, clientHash: 'stuck1', snapDate: '2026-10-30', stage: 'reading', readingAt: Date.now() - 600000, queuedAt: Date.now() - 600000 });
      await q.enqueue({ id: 'wait1', base64: b64, clientHash: 'wait1', snapDate: '2026-10-30', queuedAt: Date.now() });
      (await import('/masareef/src/state/receiptRunner.js')).jobsChanged();
    }, img);
    await page.waitForTimeout(300);
    await clickText(page, /photos? being processed|^Photos/); await page.waitForTimeout(400);
    const rowsWithActions = await page.$$eval('[data-photos-list] [data-photo-row]', (rs) => rs.map((r) => ({
      eye: !!r.querySelector('[data-photo-peek]'), save: !!r.querySelector('[data-photo-save]'), retry: !!r.querySelector('[data-photo-retry]') })));
    ok(rowsWithActions.length === 2 && rowsWithActions.every((r) => r.eye && r.save && r.retry),
      `F7.actions a stuck and a waiting photo each show see · save · try now — ${JSON.stringify(rowsWithActions)}`);
    const dl = page.waitForEvent('download', { timeout: 4000 }).catch(() => null);
    await page.click('[data-photos-list] [data-photo-row] [data-photo-save]');
    const file = await dl;
    ok(!!file && /\.jpg$/.test(file.suggestedFilename()), `F7.save «Save to phone» hands over the photo as a file (download where sharing files is not offered) — ${file && file.suggestedFilename()}`);
    await page.click('[data-photos-list] [data-photo-row] [data-photo-peek]'); await page.waitForTimeout(300);
    ok(!!(await page.$('[data-photo-view]')), 'F7.see the eye opens the stuck photo full screen');
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    // the worker starts: the orphaned read fails (with its reason) instead of blocking the queue
    await page.evaluate(async () => { (await import('/masareef/src/state/receiptRunner.js')).runner().pump(); });
    // (waitForFunction treats an async predicate's Promise as truthy, so poll by hand)
    const until = async (id, re) => { for (let i = 0; i < 40 && !re.test(await stageOf(id)); i++) await page.waitForTimeout(200); };
    await until('wait1', /^ready/);
    const s1 = await stageOf('stuck1'), w1 = await stageOf('wait1');
    ok(s1 === 'failed/stalled' && w1.startsWith('ready'), `F7.orphan a read left by a closed app turns failed/stalled, and the photo behind it is read — ${s1} · ${w1}`);
    await page.waitForTimeout(300);
    const label = await page.evaluate(() => document.body.innerText.includes('Stopped before it finished'));
    ok(label, 'F7.label the stalled photo says «Stopped before it finished — try again»');
    // (c) «Try now» re-sends it: the mock reads it and it turns ready
    await page.evaluate(() => { const r = [...document.querySelectorAll('[data-photos-list] [data-photo-row]')].find((x) => /Stopped before/.test(x.innerText)); r.querySelector('[data-photo-retry]').click(); });
    await until('stuck1', /^ready/);
    ok((await stageOf('stuck1')).startsWith('ready'), `F7.retry «Try now» sends the stalled photo again and it is read — ${await stageOf('stuck1')}`);
    {
      const diary = (type) => page.evaluate(async (t) => (await import('/masareef/src/state/usage.js'))._peek().filter((e) => e.type === t), type);
      const reads = (await diary('read')).map((e) => `${e.stage}/${e.error}`), acts = (await diary('photo')).map((e) => `${e.act}:${e.result || e.error || ''}`);
      ok(reads.includes('failed/stalled') && acts.includes('retry:stalled') && acts.includes('save:downloaded'),
        `F7.diary the usage diary records the stall by its own name, the retry and the save — reads ${JSON.stringify(reads)} · acts ${JSON.stringify(acts)}`);
    }
    // (d) a read that never answers fails once its lease runs out (lease shortened to 400 ms here; 3 min in the app)
    const leased = await page.evaluate(async (b64) => {
      const q = await import('/masareef/src/state/receiptQueue.js');
      const { createWorker } = await import('/masareef/src/state/receiptWorker.js');
      for (const j of await q.all()) await q.remove(j.id);
      await q.enqueue({ id: 'hang1', base64: b64, clientHash: 'hang1', snapDate: '2026-10-30', queuedAt: Date.now() });
      let sent = 0;
      const w = createWorker({ queue: q, leaseMs: 400, extract: () => { sent += 1; return new Promise(() => {}); } });
      const t0 = Date.now(); await w.pump();
      const j = (await q.all()).find((x) => x.id === 'hang1');
      for (const x of await q.all()) await q.remove(x.id);
      return { stage: j && j.stage, error: j && j.error, retryable: j && j.retryable, sent, ms: Date.now() - t0, running: w.isRunning() };
    }, img);
    ok(leased.stage === 'failed' && leased.error === 'stalled' && leased.retryable && leased.sent === 1 && !leased.running && leased.ms < 3000,
      `F7.lease a read that never answers becomes a retryable failure after the lease, and the worker is free again — ${JSON.stringify(leased)}`);
    ok(errors.length === 0, `F7.clean no script errors on the photo list ${errors.slice(0, 2).join(' | ')}`);
    await page.evaluate(async () => { const q = await import('/masareef/src/state/receiptQueue.js'); for (const j of await q.all()) await q.remove(j.id); });
    await ctx.close();
  }

  // ═══ F7n — the photo list with its new buttons reads in light and Night
  for (const theme of ['light', 'night']) {
    const { ctx, page } = await openApp({ theme });
    await page.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 200; c.height = 300; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 200, 300);
      const q = await import('/masareef/src/state/receiptQueue.js');
      for (const j of await q.all()) await q.remove(j.id);
      await q.enqueue({ id: 'n1', base64: c.toDataURL('image/jpeg', 0.8).split(',')[1], clientHash: 'n1', snapDate: '2026-10-30', stage: 'failed', error: 'stalled', retryable: true, queuedAt: Date.now() - 60000 });
      (await import('/masareef/src/state/receiptRunner.js')).jobsChanged();
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => { const b = document.querySelector('[data-photos-bar] button[aria-expanded="false"]'); if (b) b.click(); });
    const scan = await contrastScan(page, `Photos · ${theme}`);
    if (process.env.FLOW_SHOTS) await page.screenshot({ path: `${process.env.FLOW_SHOTS}/photos-${theme}.png` });
    ok(scan.measured >= 5 && scan.bad.length === 0 && !!(await page.$('[data-photo-retry]')),
      `F7n.${theme} the photo list with see · save · try now is readable (${theme}) — ${scan.measured} measured; ${scan.bad.slice(0, 4).join('; ')}`);
    await page.evaluate(async () => { const q = await import('/masareef/src/state/receiptQueue.js'); for (const j of await q.all()) await q.remove(j.id); });
    await ctx.close();
  }

  // ═══ F8 — «Discard» on a review built from MANY statement photos clears all of it, and it stays cleared
  {
    const { ctx, page, errors } = await openApp();
    await page.evaluate(async () => {
      const q = await import('/masareef/src/state/receiptQueue.js');
      for (const j of await q.all()) await q.remove(j.id);
      for (let p = 0; p < 5; p++) {
        const entries = Array.from({ length: 6 }, (_, i) => ({ date: `2026-10-${String(10 + i).padStart(2, '0')}`, amount: 3 + i + p, currency: 'EUR', merchant_display: `Shop ${p}-${i}`, row_status: 'completed', category: 'Groceries' }));
        await q.enqueue({ id: `list${p}`, base64: 'AAAA', clientHash: `list${p}`, snapDate: '2026-10-20', stage: 'ready', queuedAt: Date.now() - 1000 * (10 - p),
          extraction: { ok: true, extraction: { doc_type: 'transaction_list', is_receipt: false, entries }, entriesTotal: 6, defaultMethod: 'Visa' } });
      }
      (await import('/masareef/src/state/receiptRunner.js')).jobsChanged();
    });
    await page.waitForTimeout(400);
    for (let p = 0; p < 5; p++) {   // he opens each statement photo from To review's list
      await page.evaluate(() => { const b = document.querySelector('[data-photos-bar] button[aria-expanded="false"]'); if (b) b.click(); });
      await page.waitForTimeout(250);
      await page.evaluate((k) => document.querySelectorAll('[data-photos-list] [data-photo-row] > button')[k].click(), p);
      await page.waitForTimeout(900);
      await clickText(page, /^To review/); await page.waitForTimeout(500);
    }
    const draftJobs = await page.evaluate(() => (JSON.parse(localStorage.getItem('masareef.batchDraft.v1') || '{}').jobs || []).length);
    await clickText(page, /^Book$/); await page.waitForTimeout(700);
    const waitingBefore = await page.evaluate(() => /(\d+) expenses not logged yet/.exec(document.body.innerText)?.[1] || '0');
    await clickText(page, /not logged yet/); await page.waitForTimeout(1000);
    await clickText(page, /^Discard/); await page.waitForTimeout(900);
    const state = async () => page.evaluate(async () => {
      const q = await import('/masareef/src/state/receiptQueue.js');
      const badge = document.querySelector('[data-photos-shortcut]')?.getAttribute('aria-label') || '';
      return { draft: localStorage.getItem('masareef.batchDraft.v1'), queue: (await q.all()).length, badge, waiting: /not logged yet/.test(document.body.innerText) };
    });
    const after = await state();
    await page.reload(); await page.waitForTimeout(1500);
    await clickText(page, /^Book$/); await page.waitForTimeout(700);
    const reloaded = await state();
    ok(draftJobs === 5 && waitingBefore === '30', `F8.setup a review built from 5 statement photos waits with 30 rows — ${draftJobs} photos · ${waitingBefore} rows`);
    ok(after.draft === null && after.queue === 0 && !/·/.test(after.badge) && !after.waiting,
      `F8.clear one Discard removes the draft AND its photos: no badge, no «not logged yet» — ${JSON.stringify(after)}`);
    ok(reloaded.draft === null && reloaded.queue === 0 && !/·/.test(reloaded.badge) && !reloaded.waiting,
      `F8.reload nothing comes back after a reload — ${JSON.stringify(reloaded)}`);
    {
      const diary = (type) => page.evaluate(async (t) => (await import('/masareef/src/state/usage.js'))._peek().filter((e) => e.type === t), type);
      const d = (await diary('batch')).filter((e) => e.act === 'discard').pop();
      ok(!!d && d.photos === 5 && d.removed === 5 && d.left === 0, `F8.diary the diary records the clear with its count: photos 5 · removed 5 · draft left 0 — ${JSON.stringify(d)}`);
    }
    ok(errors.length === 0, `F8.clean no script errors through open × 5, discard and reload ${errors.slice(0, 2).join(' | ')}`);
    await ctx.close();
  }

  // ═══ F9 — the statement review's ways out are at the TOP; a photo can be read again, fresh (2026-10-31)
  {
    const { ctx, page, errors } = await openApp({ theme: 'night' });
    const seed = () => page.evaluate(async () => {
      const q = await import('/masareef/src/state/receiptQueue.js');
      for (const j of await q.all()) await q.remove(j.id);
      for (let p = 0; p < 2; p++) {
        const entries = Array.from({ length: 4 }, (_, i) => ({ date: `2026-10-${String(16 + i).padStart(2, '0')}`, amount: 4 + i + p, currency: 'EUR', merchant_display: `Shop ${p}-${i}`, row_status: 'completed', category: 'Groceries' }));
        await q.enqueue({ id: `st${p}`, base64: 'AAAA', clientHash: `st${p}`, snapDate: '2026-10-20', stage: 'ready', queuedAt: Date.now() - 1000 * (10 - p),
          extraction: { ok: true, extraction: { doc_type: 'transaction_list', is_receipt: false, entries }, entriesTotal: 4, defaultMethod: 'Visa' } });
      }
      (await import('/masareef/src/state/receiptRunner.js')).jobsChanged();
    });
    const openAll = async () => {
      for (let p = 0; p < 2; p++) {
        await page.evaluate(() => { const b = document.querySelector('[data-photos-bar] button[aria-expanded="false"]'); if (b) b.click(); });
        await page.waitForTimeout(250);
        await page.evaluate((k) => document.querySelectorAll('[data-photos-list] [data-photo-row] > button')[k].click(), p);
        await page.waitForTimeout(900);
        if (p === 0) await clickText(page, /^To review/), await page.waitForTimeout(500);
      }
    };
    const jobsNow = () => page.evaluate(async () => (await (await import('/masareef/src/state/receiptQueue.js')).all()).map((j) => `${j.id}:${j.clientHash}:${j.stage}`));
    await seed(); await page.waitForTimeout(300);
    // ready rows on To review carry see · save · read again · remove
    await page.evaluate(() => { const b = document.querySelector('[data-photos-bar] button[aria-expanded="false"]'); if (b) b.click(); }); await page.waitForTimeout(300);
    const readyRow = await page.$$eval('[data-photos-list] [data-photo-row]', (rs) => rs.map((r) => ['[data-photo-peek]', '[data-photo-save]', '[data-photo-reread]', '[data-photo-remove]'].every((q) => r.querySelector(q))));
    ok(readyRow.length === 2 && readyRow.every(Boolean), `F9.ready a photo ready to check shows see · save · read again · remove — ${JSON.stringify(readyRow)}`);
    await openAll();
    const top = await page.evaluate(() => { const d = document.querySelector('[data-batch-discard-top]'), r = document.querySelector('[data-batch-reread]');
      const vis = (e) => { if (!e) return false; const b = e.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight - 140; };
      return { discard: vis(d), reread: vis(r), untick: [...document.querySelectorAll('button')].some((b) => b.innerText.trim() === 'Untick all') }; });
    ok(top.discard && top.reread && top.untick, `F9.top «Discard this review» and «Read the photos again» are on screen without scrolling; «Clear all» now says «Untick all» — ${JSON.stringify(top)}`);
    await page.click('[data-batch-reread]'); await page.waitForTimeout(400);
    const afterReread = { draft: await page.evaluate(() => localStorage.getItem('masareef.batchDraft.v1')), jobs: await jobsNow(),
      photosOpen: !!(await page.$('[data-photos-list]')) };
    ok(afterReread.draft === null && afterReread.jobs.length === 2 && afterReread.jobs.every((j) => /^st\d:st\d~r1:/.test(j)) && afterReread.photosOpen,
      `F9.reread «Read the photos again» clears the review and sends each photo under a fresh name, then shows the Photos list — ${JSON.stringify(afterReread)}`);
    for (let i = 0; i < 30 && (await jobsNow()).some((j) => /:(queued|reading)$/.test(j)); i++) await page.waitForTimeout(200);
    const read = await jobsNow();
    ok(read.every((j) => !/:(queued|reading)$/.test(j)), `F9.read both photos were read again (the mock answered) — ${JSON.stringify(read)}`);
    await page.evaluate(() => document.querySelector('[data-photos-list] [data-photo-row] [data-photo-remove]').click()); await page.waitForTimeout(400);
    ok((await jobsNow()).length === 1, `F9.remove «Remove» takes a photo off the list — ${JSON.stringify(await jobsNow())}`);
    {
      const diary = (type) => page.evaluate(async (t) => (await import('/masareef/src/state/usage.js'))._peek().filter((e) => e.type === t), type);
      const b = (await diary('batch')).find((e) => e.act === 'reread'), acts = (await diary('photo')).map((e) => e.act);
      ok(!!b && b.photos === 2 && b.found === 2 && acts.filter((a) => a === 'reread').length === 2 && acts.includes('remove'),
        `F9.diary the diary records «Read again» (2 photos, 2 found) and the remove — ${JSON.stringify(b)} · ${JSON.stringify(acts)}`);
    }
    // the top Discard clears a review and its photos too
    await seed(); await page.waitForTimeout(300); await openAll();
    await page.click('[data-batch-discard-top]'); await page.waitForTimeout(600);
    ok(await page.evaluate(() => localStorage.getItem('masareef.batchDraft.v1')) === null && (await jobsNow()).length === 0,
      `F9.discard the top Discard clears the review and its photos — ${JSON.stringify(await jobsNow())}`);
    ok(errors.length === 0, `F9.clean no script errors ${errors.slice(0, 2).join(' | ')}`);
    await ctx.close();
  }

  // ═══ F10 — a LOGGED statement row opens: change its category, or edit the rest (2026-10-31)
  for (const theme of ['night', 'light']) {
    const { ctx, page, errors } = await openApp({ theme });
    const seeded = await page.evaluate(async () => {
      const api = await import('/masareef/src/api/index.js');
      const { cairoParts } = await import('/masareef/src/lib/dates.js');
      const t = cairoParts(new Date());
      const a = await api.fetchEntries({ y: t.y, m: t.m });
      const row = (a.entries || []).find((e) => e && e.date && e.description && e.category && e.category !== '❓');
      if (!row) return null;
      const [d, m, y] = row.date.split('/').map(Number);
      const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const draft = { jobs: [{ sourceHash: 'h9', defaultMethod: 'Visa', entries: [
        { date: iso, amount: Number(row.amount), currency: row.currency || 'EUR', merchant_display: row.description, row_status: 'completed', category: row.category },
        { date: iso, amount: 7.5, currency: 'EUR', merchant_display: 'Second shop', row_status: 'completed', category: 'Groceries' },
      ] }], settled: { byKey: { 'h9#0': { status: 'written', entry: row }, 'h9#1': { status: 'book_duplicate' } }, written: 1, skipped: 1, errored: 0 } };
      localStorage.setItem('masareef.batchDraft.v1', JSON.stringify(draft));
      return row;
    });
    await page.reload(); await page.waitForTimeout(1200);
    await clickText(page, /^Book$/); await page.waitForTimeout(800);
    await clickText(page, /not logged yet/); await page.waitForTimeout(1200);
    await page.click('[data-batch-logged]'); await page.waitForTimeout(300);
    const opened = !!(await page.$('[data-batch-edit-entry]'));
    ok(!!seeded && opened, `F10.${theme}.open tapping a «Logged» row opens it, with «Edit amount, date or card» — row ${seeded && seeded.description} · opened ${opened}`);
    if (theme === 'night') {
      const scan = await contrastScan(page, 'Logged row open');
      if (process.env.FLOW_SHOTS) await page.screenshot({ path: `${process.env.FLOW_SHOTS}/logged-night.png` });
      // The page title is measured by F2; here its glyphs fill a box fitted to them and read as their own ground.
      scan.bad = scan.bad.filter((b) => !b.startsWith('«Review the statement»'));
      ok(scan.bad.length === 0, `F10.night.read the open logged row reads at night — ${scan.bad.slice(0, 3).join('; ')}`);
      const target = await page.evaluate((cur) => {
        const b = [...document.querySelectorAll('[data-batch-logged]')][0].closest('div[style]').parentElement.parentElement.querySelectorAll('button.catchip');
        const pick = [...b].find((x) => !x.hasAttribute('data-batch-edit-entry') && !/✓/.test(x.innerText) && x.innerText.trim() && !/More|…/.test(x.innerText));
        if (pick) pick.click(); return pick && pick.innerText.trim();
      }, seeded && seeded.category);
      let saved = null;
      for (let i = 0; i < 20 && !saved; i++) { await page.waitForTimeout(200); saved = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('masareef.batchDraft.v1') || '{}'); return d.settled && d.settled.byKey['h9#0'].entry.category; }); if (saved === (seeded && seeded.category)) saved = null; }
      ok(!!target && !!saved, `F10.category tapping another category on a logged row changes it in the book and on the review — tapped «${target}», now ${saved}`);
      await page.click('[data-batch-edit-entry]'); await page.waitForTimeout(1200);
      const dlg = await page.evaluate(() => !!document.querySelector('[role=dialog][aria-label="Edit the row"]'));
      ok(dlg, 'F10.edit «Edit amount, date or card» opens the same edit card the Book uses');
      ok(errors.length === 0, `F10.clean no script errors ${errors.slice(0, 2).join(' | ')}`);
    }
    await ctx.close();
  }

  // ═══ F11 — version A: every photo's actions on ONE line; Remove has Undo (Tarek's pick, 2026-10-31)
  for (const [lang, theme] of [['en', 'light'], ['en', 'night'], ['ar', 'night']]) {
    const { ctx, page, errors } = await openApp({ lang, theme });
    await page.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 200; c.height = 300; const g = c.getContext('2d'); g.fillStyle = '#ccc'; g.fillRect(0, 0, 200, 300);
      const b64 = c.toDataURL('image/jpeg', 0.8).split(',')[1];
      const q = await import('/masareef/src/state/receiptQueue.js');
      for (const j of await q.all()) await q.remove(j.id);
      await q.enqueue({ id: 'a1', base64: b64, clientHash: 'a1', snapDate: '2026-10-30', stage: 'ready', queuedAt: Date.now() - 9000, extraction: { ok: true, extraction: { is_receipt: true, merchant_display: 'Smartum', amount: 28.39 } } });
      await q.enqueue({ id: 'a2', base64: b64, clientHash: 'a2', snapDate: '2026-10-30', stage: 'failed', error: 'stalled', retryable: true, queuedAt: Date.now() - 8000 });
      await q.enqueue({ id: 'a3', base64: b64, clientHash: 'a3', snapDate: '2026-10-30', stage: 'queued', queuedAt: Date.now() - 7000 });
      (await import('/masareef/src/state/receiptRunner.js')).jobsChanged();
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => { const b = document.querySelector('[data-photos-bar] button[aria-expanded="false"]'); if (b) b.click(); });
    await page.waitForTimeout(400);
    const strips = await page.$$eval('[data-photos-list] [data-photo-actions]', (ss) => ss.map((st) => {
      const bs = [...st.querySelectorAll('button')]; const tops = new Set(bs.map((b) => Math.round(b.getBoundingClientRect().top)));
      const r = st.getBoundingClientRect();
      return { n: bs.length, oneLine: tops.size === 1, h: Math.round(r.height), fits: r.right <= innerWidth && r.left >= 0, minTap: Math.min(...bs.map((b) => b.getBoundingClientRect().height)),
        clipped: bs.some((b) => { const sp = b.querySelector('span'); return sp && sp.scrollWidth > sp.clientWidth + 1; }) };
    }));
    ok(strips.length === 3 && strips.every((x) => x.oneLine && x.fits && x.h <= 64 && x.minTap >= 44 && x.n === 4 && !x.clipped),
      `F11.${lang}.${theme}.line each photo's four actions sit on ONE line, ≥44 pt tall, words not cut off — ${JSON.stringify(strips)}`);
    // The «receipt is ready» toast floats over the card below; measure once it has gone, not the text it covers.
    for (let i = 0; i < 40 && await page.$('[role=status]'); i++) await page.waitForTimeout(250);
    const scan = await contrastScan(page, `Photos A · ${lang} · ${theme}`);
    if (process.env.FLOW_SHOTS) await page.screenshot({ path: `${process.env.FLOW_SHOTS}/A-${lang}-${theme}.png` });
    ok(scan.bad.length === 0, `F11.${lang}.${theme}.read the strip reads in ${theme} — ${scan.measured} measured; ${scan.bad.slice(0, 3).join('; ')}`);
    if (lang === 'en' && theme === 'light') {
      await page.click('[data-photos-list] [data-photo-row] [data-photo-remove]'); await page.waitForTimeout(400);
      const toast = await page.evaluate(() => [...document.querySelectorAll('[role=status]')].map((e) => e.innerText).join(' | '));
      const n1 = await page.evaluate(async () => (await (await import('/masareef/src/state/receiptQueue.js')).all()).length);
      await clickText(page, /^Undo$/); await page.waitForTimeout(500);
      const back = await page.evaluate(async () => (await (await import('/masareef/src/state/receiptQueue.js')).all()).map((j) => `${j.id}:${j.stage}`));
      ok(/Photo removed/.test(toast) && n1 === 2 && back.includes('a1:ready') && back.length === 3,
        `F11.undo Remove takes the photo off and says «Photo removed · Undo»; Undo puts it back as it was — ${toast} · ${n1} left · back ${JSON.stringify(back)}`);
      ok(errors.length === 0, `F11.clean no script errors ${errors.slice(0, 2).join(' | ')}`);
    }
    await page.evaluate(async () => { const q = await import('/masareef/src/state/receiptQueue.js'); for (const j of await q.all()) await q.remove(j.id); });
    await ctx.close();
  }

  // ═══ F12 — design audit 2026-11-01: ruling 2 says nothing may be readable ONLY at 13 px.
  // Two lines were, and only show in the running app: the «Older expenses» explanation and
  // the book's row that a statement row looks like.
  for (const lang of ['en', 'ar']) {
    const { ctx, page } = await openApp({ lang, extra: { 'masareef.batchDraft.v1': DRAFT } });
    const old = await page.$eval('[data-old-body]', (e) => parseFloat(getComputedStyle(e).fontSize)).catch(() => null);
    await page.evaluate(() => [...document.querySelectorAll('nav button')][2].click()); await page.waitForTimeout(900);
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /not logged yet|ما اتسجلوش/.test(x.innerText)); if (b) b.click(); }); await page.waitForTimeout(1500);
    await page.evaluate(() => { const b = [...document.querySelectorAll('button[aria-expanded]')].find((x) => /Espresso/.test(x.innerText)); if (b) b.click(); }); await page.waitForTimeout(400);
    const dup = await page.$eval('[data-dup-evidence]', (e) => parseFloat(getComputedStyle(e).fontSize)).catch(() => null);
    ok(old >= 15 && dup >= 15, `F12.${lang} «Older expenses» explanation and the look-alike book row are set at ≥15 px — ${old} · ${dup}`);
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
