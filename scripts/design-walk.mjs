#!/usr/bin/env node
/**
 * THE DESIGN WALK — every screen, both languages, light and Night, measured.
 * `node scripts/design-walk.mjs [outDir]`   (design audit 2026-11-01)
 *
 * Not a gate: it writes a screenshot and a findings line per screen so an audit
 * can be judged from pixels and numbers instead of memory. The gates that came
 * out of it live in test-flows (F12). Measures, per screen:
 *   contrast   pixel-measured, the same method as test-flows F2
 *   tap        every interactive box under 44 pt in either direction
 *   type       every word set under the 15 px floor (TYPE.label)
 *   overflow   a page that scrolls sideways, or a box that leaves the screen
 *   clip       text cut off inside its box (scrollWidth > clientWidth)
 *   glass      (reduced transparency only) a blurred surface still painted see-through
 *   motion     (reduced motion only) any transition/animation still > 10 ms
 */
import { createServer } from 'vite';
import { inflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const OUT = process.argv[2] || 'design-walk-out';
mkdirSync(OUT, { recursive: true });

function decodePng(buf) {
  let p = 8, w = 0, h = 0, ct = 6; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; } else if (type === 'IDAT') idat.push(data); else if (type === 'IEND') break;
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

const server = await createServer({ logLevel: 'error', server: { port: 5320, strictPort: false } });
await server.listen();
const origin = (server.resolvedUrls.local[0]).replace(/\/$/, '');
const url = origin.endsWith(server.config.base.replace(/\/$/, '')) ? origin + '/' : origin + server.config.base;
const browser = await chromium.launch();

const SETUP = { 'masareef.secret': 'test-secret-local', 'masareef.execUrl': 'https://script.google.com/macros/s/TESTMOCK/exec' };
const LONG_AR = 'سوبر ماركت خير زمان فرع مدينة نصر الحي السابع بجوار الجامع';
const draft = (lang) => JSON.stringify({ jobs: [{ sourceHash: 'h1', defaultMethod: 'Visa', entries: [
  { date: '2026-10-16', amount: 4, currency: 'EUR', merchant_display: 'Espresso House', row_status: 'completed', category: 'Eating out', dupBook: { checked: true, match: { date: '16/10/2026', description: 'Espresso House', amount: 4, currency: 'EUR' } } },
  { date: null, amount: 13.25, currency: 'EUR', merchant_display: lang === 'ar' ? LONG_AR : 'K-Citymarket Turku Kauppatori Länsikeskus', row_status: 'completed', category: 'Groceries', dupBook: { checked: false, reason: 'no_date' } },
  { date: '2026-10-17', amount: 1234.5, currency: 'EUR', merchant_display: 'R-kioski', row_status: 'pending', category: 'Groceries' },
] }], settled: null });

async function measure(page, label, { reducedTransparency, reducedMotion } = {}) {
  await page.waitForTimeout(450);
  const items = await page.evaluate(({ rt, rm }) => {
    const vis = (el) => { const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') return false; let op = 1; for (let p = el; p; p = p.parentElement) op *= +getComputedStyle(p).opacity; return op >= 0.9; };
    const onTop = (el, r) => { const h = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2))); return h && (el === h || el.contains(h) || h.contains(el)); };
    const inView = (r) => r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    const name = (el) => (el.getAttribute('aria-label') || el.innerText || el.value || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
    const text = [], taps = [], type = [], clip = [], off = [], glassLeft = [], motionLeft = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('[aria-hidden="true"], svg, [data-scan-skip]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || !inView(r) || !vis(el)) continue;
      const cs = getComputedStyle(el);
      if (rt && cs.backdropFilter && cs.backdropFilter !== 'none' && /gradient/.test(cs.backgroundImage)) glassLeft.push(name(el));   // blur behind a SOLID fill is invisible; a gradient left is see-through glass
      if (rm) { const d = (s) => Math.max(0, ...s.split(',').map((x) => parseFloat(x) * (/ms/.test(x) ? 1 : 1000))); const t = d(cs.transitionDuration), a = cs.animationName !== 'none' ? d(cs.animationDuration) : 0; if (t > 10 || a > 10) motionLeft.push(`${name(el)} ${Math.round(Math.max(t, a))}ms`); }
      const interactive = el.matches('button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=switch]') && !el.disabled;
      if (interactive && onTop(el, r)) {
        // a label wrapping an input, or a parent button, carries the hit area
        const host = el.closest('label') || el;
        const hr = host.getBoundingClientRect();
        if ((hr.height < 43.5 || hr.width < 43.5) && !el.closest('[data-geometry]')) taps.push(`${name(el)} ${Math.round(hr.width)}×${Math.round(hr.height)}`);
      }
      const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ');
      if (!own || own === 'MOCK') continue;
      if (!onTop(el, r)) continue;
      const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700;
      if (size < 14.5 && !el.closest('[data-geometry]')) type.push(`«${own.slice(0, 30)}» ${size}px`);
      if ((el.scrollWidth > el.clientWidth + 1 && /hidden|clip/.test(cs.overflowX + cs.overflow)) || (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1)) clip.push(`«${own.slice(0, 30)}» ${el.scrollWidth}>${el.clientWidth}`);
      if (r.right > innerWidth + 1 || r.left < -1) { let sc = false; for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll') { sc = true; break; } } if (!sc) off.push(`«${own.slice(0, 30)}» ${Math.round(r.left)}…${Math.round(r.right)}`); }
      const m = cs.color.match(/\d+(\.\d+)?/g).map(Number);
      text.push({ text: own.slice(0, 40), color: m.slice(0, 3), alpha: m[3] ?? 1, x: r.left, y: r.top, w: r.width, h: r.height, large: size >= 24 || (bold && size >= 18.66) });
    }
    const hscroll = document.documentElement.scrollWidth > innerWidth + 1 ? `page is ${document.documentElement.scrollWidth}px wide` : null;
    return { text, taps: [...new Set(taps)], type: [...new Set(type)], clip, off, hscroll, glassLeft: [...new Set(glassLeft)].slice(0, 6), motionLeft: [...new Set(motionLeft)].slice(0, 6) };
  }, { rt: !!reducedTransparency, rm: !!reducedMotion });
  const shot = await page.screenshot();
  const png = decodePng(shot);
  const contrast = [];
  for (const it of items.text) {
    if (it.alpha < 0.5) continue;
    const counts = new Map();
    const x0 = Math.max(0, Math.floor(it.x)), y0 = Math.max(0, Math.floor(it.y)), x1 = Math.min(png.w - 1, Math.ceil(it.x + it.w)), y1 = Math.min(png.h - 1, Math.ceil(it.y + it.h));
    for (let y = y0; y <= y1; y += 2) for (let x = x0; x <= x1; x += 2) { const c = png.px(x, y), k = (c[0] >> 3) << 10 | (c[1] >> 3) << 5 | (c[2] >> 3); const e = counts.get(k); if (e) e.n++; else counts.set(k, { n: 1, c }); }
    let bg = null, n = 0; for (const e of counts.values()) if (e.n > n) { n = e.n; bg = e.c; }
    if (!bg) continue;
    const r = ratio(it.color, bg), floor = it.large ? 3 : 4.5;
    if (r < floor - 0.05) contrast.push(`«${it.text}» ${r.toFixed(2)}:1`);
  }
  const file = `${label.replace(/[^\w]+/g, '-')}.png`;
  writeFileSync(`${OUT}/${file}`, shot);
  const { text, ...rest } = items;
  return { label, file, measured: text.length, contrast, ...rest };
}

async function open({ lang, theme, extra = {}, reducedMotion, reducedTransparency }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, colorScheme: theme === 'night' ? 'dark' : 'light', reducedMotion: reducedMotion ? 'reduce' : 'no-preference', serviceWorkers: 'block' });
  await ctx.addInitScript((kv) => { try { if (!sessionStorage.getItem('seeded')) { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); } } catch { /* fresh */ } },
    { ...SETUP, 'masareef.lang': lang, 'masareef.theme': theme, ...extra });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  if (reducedTransparency) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }] }); }
  await page.goto(url);
  await page.waitForSelector('nav button, main', { timeout: 8000 });
  await page.waitForTimeout(800);
  return { ctx, page, errors };
}
const S = async (page, lang) => (await page.evaluate(async (l) => { const m = await import(`/masareef/src/i18n/strings.${l}.js`); const s = m.EN || m.AR || m.default; return { tabInbox: s.tabInbox, tabEntry: s.tabEntry, tabBook: s.tabBook, p: [s.periodToday, s.periodWeek, s.periodMonth, s.periodYear], check: s.checkTitle, waiting: String(typeof s.batchWaiting === 'function' ? s.batchWaiting(3) : s.batchWaiting || 'not logged yet').replace(/\d+/, '').trim().slice(0, 12) }; }, lang));
const tap = (page, txt) => page.evaluate((t) => { const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === t || x.innerText.trim().startsWith(t)); if (b) b.click(); return !!b; }, txt);
const seedPhotos = (page, set) => page.evaluate(async (which) => {
  const c = document.createElement('canvas'); c.width = 300; c.height = 500; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 300, 500); g.fillStyle = '#000'; g.font = '28px monospace'; g.fillText('K-MARKET 13,25', 20, 200);
  const b64 = c.toDataURL('image/jpeg', 0.8).split(',')[1];
  const q = await import('/masareef/src/state/receiptQueue.js');
  for (const j of await q.all()) await q.remove(j.id);
  if (which === 'list') {
    await q.enqueue({ id: 'a1', base64: b64, clientHash: 'a1', snapDate: '2026-10-30', stage: 'ready', queuedAt: Date.now() - 9000, extraction: { ok: true, extraction: { is_receipt: true, merchant_display: 'Smartum', amount: 28.39 } } });
    await q.enqueue({ id: 'a2', base64: b64, clientHash: 'a2', snapDate: '2026-10-30', stage: 'failed', error: 'stalled', retryable: true, queuedAt: Date.now() - 8000 });
    await q.enqueue({ id: 'a3', base64: b64, clientHash: 'a3', snapDate: '2026-10-30', stage: 'queued', queuedAt: Date.now() - 7000 });
  } else if (which === 'notreceipt') {
    await q.enqueue({ id: 'nr', base64: b64, clientHash: 'nr', snapDate: '2026-10-30', stage: 'ready', queuedAt: Date.now() - 9000, extraction: { ok: true, extraction: { is_receipt: false } } });
  } else {
    await q.enqueue({ id: 'r1', base64: b64, clientHash: 'r1', snapDate: '2026-10-30', queuedAt: Date.now() });
  }
  const r = await import('/masareef/src/state/receiptRunner.js'); r.jobsChanged(); if (which === 'read') r.runner().pump();
}, set);

const report = [];
const push = (r, combo) => { report.push({ combo, ...r }); const n = r.contrast.length + r.taps.length + r.type.length + r.clip.length + r.off.length + (r.hscroll ? 1 : 0) + r.glassLeft.length + r.motionLeft.length; console.log(`${n ? '•' : '✓'} ${combo} ${r.label} — ${r.measured} words; contrast ${r.contrast.length} tap ${r.taps.length} type ${r.type.length} clip ${r.clip.length} off ${r.off.length}${r.hscroll ? ' HSCROLL' : ''}${r.glassLeft.length ? ` glass ${r.glassLeft.length}` : ''}${r.motionLeft.length ? ` motion ${r.motionLeft.length}` : ''}`); };

try {
  for (const lang of ['en', 'ar']) for (const theme of ['light', 'night']) {
    const combo = `${lang}-${theme}`;
    // 1. Empty To review (nothing waiting)
    { const { ctx, page } = await open({ lang, theme }); push(await measure(page, `${combo} To review empty`), combo); await ctx.close(); }
    const { ctx, page, errors } = await open({ lang, theme, extra: { 'masareef.batchDraft.v1': draft(lang) } });
    const s = await S(page, lang);
    push(await measure(page, `${combo} To review`), combo);
    await tap(page, s.tabBook); await page.waitForTimeout(1000);
    for (const [i, p] of s.p.entries()) { await tap(page, p); await page.waitForTimeout(1100); push(await measure(page, `${combo} Book ${['Today', 'Week', 'Month', 'Year'][i]}`), combo); }
    await page.evaluate(() => scrollTo(0, 99999)); await page.waitForTimeout(400); push(await measure(page, `${combo} Book Year bottom`), combo); await page.evaluate(() => scrollTo(0, 0));
    await page.evaluate(() => { const f = document.querySelector('[data-book-filter] button, button[data-book-filter]'); if (f) f.click(); }); await page.waitForTimeout(500);
    push(await measure(page, `${combo} Book filter`), combo);
    await page.evaluate(() => document.querySelector('button[aria-haspopup=dialog]').click()); await page.waitForTimeout(900);
    await page.evaluate(() => document.querySelectorAll('[data-settings-group]').forEach((d) => { d.open = true; }));
    push(await measure(page, `${combo} Settings`), combo);
    await page.evaluate(() => document.querySelector('[data-self-check] button').scrollIntoView({ block: 'center' }));
    await page.evaluate(() => document.querySelector('[data-self-check] button').click()); await page.waitForTimeout(1600);
    push(await measure(page, `${combo} Check the app`), combo);
    await page.evaluate(() => { const b = document.querySelector('[data-sheet-body]') || document.querySelector('[role=dialog]'); if (b) b.scrollTop = 99999; }); await page.waitForTimeout(300);
    push(await measure(page, `${combo} Settings bottom`), combo);
    await page.keyboard.press('Escape'); await page.waitForTimeout(500);
    { const hit = await page.evaluate((t) => { const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes(t)); if (b) b.click(); return !!b; }, s.waiting); await page.waitForTimeout(1500);
      if (hit) { push(await measure(page, `${combo} Statement review`), combo); await page.evaluate(() => scrollTo(0, 99999)); await page.waitForTimeout(300); push(await measure(page, `${combo} Statement review bottom`), combo);
        await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Back|←|→/.test((x.getAttribute('aria-label') || '') + x.innerText)); if (b) b.click(); }); await page.waitForTimeout(600); } else console.log('  (no statement-review button)'); }
    await tap(page, s.tabEntry); await page.waitForTimeout(900);
    push(await measure(page, `${combo} New entry`), combo);
    await page.evaluate(() => { const k = document.querySelector('[data-keypad]'); if (k) { const b = [...k.querySelectorAll('button')]; for (const t of ['1', '2', '5']) { const x = b.find((y) => y.innerText.trim() === t || y.innerText.trim() === '١٢٥'['125'.indexOf(t)]); if (x) x.click(); } } }); await page.waitForTimeout(400);
    push(await measure(page, `${combo} New entry typed`), combo);
    await page.evaluate(() => { const c = document.querySelector('[data-entry-close]') || document.querySelector('[role=dialog] button[aria-label]'); if (c) c.click(); }); await page.waitForTimeout(600);
    await tap(page, s.tabBook); await page.waitForTimeout(800);
    await ctx.close();
    // receipt flow
    {
      const { ctx, page } = await open({ lang, theme });
      await seedPhotos(page, 'read');
      await page.waitForFunction(() => document.querySelector('[data-photos-bar]'), null, { timeout: 6000 }).catch(() => {});
      push(await measure(page, `${combo} Photo reading`), combo);
      for (let i = 0; i < 40 && !(await page.$('[data-photo-row]')) && !(await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => /Ready|جاهز/.test(b.innerText)))); i++) await page.waitForTimeout(200);
      await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Ready|جاهز/.test(x.innerText)); if (b) b.click(); }); await page.waitForTimeout(1200);
      push(await measure(page, `${combo} Receipt`), combo);
      const peek = await page.$('[data-photo-peek]'); if (peek) { await peek.click(); await page.waitForTimeout(500); push(await measure(page, `${combo} Photo viewer`), combo); await page.keyboard.press('Escape'); }
      await seedPhotos(page, 'list'); await page.waitForTimeout(400);
      await page.evaluate(() => { const b = document.querySelector('[data-photos-bar] button[aria-expanded="false"]'); if (b) b.click(); }); await page.waitForTimeout(500);
      for (let i = 0; i < 30 && await page.$('[role=status]'); i++) await page.waitForTimeout(250);
      push(await measure(page, `${combo} Photos list`), combo);
      await seedPhotos(page, 'notreceipt'); await page.waitForTimeout(400);
      await page.evaluate(() => { const b = document.querySelector('[data-photos-bar] button[aria-expanded="false"]'); if (b) b.click(); }); await page.waitForTimeout(400);
      await page.evaluate(() => { const r = document.querySelector('[data-photos-list] [data-photo-row] button'); if (r) r.click(); }); await page.waitForTimeout(900);
      push(await measure(page, `${combo} Not a receipt`), combo);
      await page.evaluate(async () => { const q = await import('/masareef/src/state/receiptQueue.js'); for (const j of await q.all()) await q.remove(j.id); });
      await ctx.close();
    }
    if (errors.length) console.log(`  script errors ${combo}: ${errors.slice(0, 3).join(' | ')}`);
  }
  // accessibility fallbacks, once each in both languages
  for (const lang of ['en', 'ar']) {
    { const { ctx, page } = await open({ lang, theme: 'light', reducedTransparency: true, extra: { 'masareef.batchDraft.v1': draft(lang) } }); push(await measure(page, `${lang} reduced-transparency To review`, { reducedTransparency: true }), `${lang}-rt`);
      const s = await S(page, lang); await tap(page, s.tabBook); await page.waitForTimeout(1000); push(await measure(page, `${lang} reduced-transparency Book`, { reducedTransparency: true }), `${lang}-rt`); await ctx.close(); }
    { const { ctx, page } = await open({ lang, theme: 'light', reducedMotion: true }); const s = await S(page, lang); await tap(page, s.tabBook); await page.waitForTimeout(1000); push(await measure(page, `${lang} reduced-motion Book`, { reducedMotion: true }), `${lang}-rm`);
      await tap(page, s.tabEntry); await page.waitForTimeout(800); push(await measure(page, `${lang} reduced-motion New entry`, { reducedMotion: true }), `${lang}-rm`); await ctx.close(); }
  }
  // error state: the language file fails
  { const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); await ctx.addInitScript((kv) => { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); }, { ...SETUP, 'masareef.lang': 'en' });
    const page = await ctx.newPage(); await page.route(/strings\.en\.js/, (r) => r.abort()); await page.goto(url); await page.waitForTimeout(2500); push(await measure(page, 'en Load failed'), 'err'); await ctx.close(); }
  // loading state: the server never answers
  { const { ctx, page } = await open({ lang: 'en', theme: 'light', extra: { 'masareef.mockDelay': '60000' } }); push(await measure(page, 'en Loading'), 'load'); await ctx.close(); }
} finally {
  writeFileSync(`${OUT}/walk.json`, JSON.stringify(report, null, 1));
  await browser.close(); await server.close();
}
