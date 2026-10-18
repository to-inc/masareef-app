import { S, WEEK_DAYS, categoryLabel } from '../i18n/strings.js';
import { CATEGORIES } from '../lib/constants.js';
import { supportsAction } from './capabilities.js';
import { usageLog } from '../api/index.js';

/**
 * THE USAGE DIARY (Tarek, 2026-10-18: «a logger, to know how I use the app and
 * see what can be improved in the architecture and the experience»).
 *
 * It records ACTIONS, never money: which screen, which control (by its interface
 * words only — anything that is not the app's own text, like a shop name, is
 * written as «[content]», and digits as «#»), taps that hit nothing, rapid repeat
 * taps, how long «New» takes to «Logged», reads, refusals and errors. Kept on the
 * phone and sent once a day to «Usage logs» on his Drive, where the daily check
 * reads it. A fuller version (per-gesture timings, scroll depth) would be worth
 * it only once this one has shown what to look at.
 */
const KEY = 'masareef.usage.v1';
const SENT = 'masareef.usageSent.v1';
const CAP = 3000;
const DAY_MS = 20 * 3600 * 1000;

let memory = [];          // used when storage is refused
const store = () => { try { return globalThis.localStorage || null; } catch { return null; } };
const load = () => { const s = store(); if (!s) return memory; try { return JSON.parse(s.getItem(KEY) || '[]'); } catch { return []; } };
const save = (list) => { const s = store(); if (!s) { memory = list; return; } try { s.setItem(KEY, JSON.stringify(list.slice(-CAP))); } catch { memory = list; } };

let screen = '';
export const currentScreen = () => screen;

/** One event. `data` keeps only short strings and finite numbers. */
export function track(type, data = {}) {
  const e = { t: Date.now(), type, s: screen };
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'number' && Number.isFinite(v)) e[k] = Math.round(v);
    else if (typeof v === 'string') e[k] = v.slice(0, 60);
    else if (typeof v === 'boolean') e[k] = v;
  }
  const list = load(); list.push(e); save(list);
}

/** The Book's period, set by the Book itself so the shell can name «book:week». */
let bookPeriod = 'today';
export const bookScreen = () => `book:${bookPeriod}`;
export function setBookPeriod(p) {
  bookPeriod = p;
  if (screen.startsWith('book')) setScreen(bookScreen());
}

export function setScreen(name) {
  if (!name || name === screen) return;
  screen = name;
  track('screen', { name });
}

// ——— the words a control may be recorded by: the interface's own, nothing else
let known = null;
const norm = (t) => String(t || '').replace(/\s+/g, ' ').trim();
function knownWords() {
  if (known) return known;
  known = new Set();
  for (const v of Object.values(S)) if (typeof v === 'string') known.add(norm(v));
  for (const c of CATEGORIES) { known.add(c); known.add(norm(categoryLabel(c))); }
  for (const d of WEEK_DAYS) known.add(`${d} #`);
  return known;
}
/** A control's name, private by construction. */
export function controlName(el) {
  if (!el) return '';
  const data = [...(el.attributes || [])].map((a) => a.name).find((n) => n.startsWith('data-'));
  if (data) return data;
  const raw = norm(el.getAttribute && (el.getAttribute('aria-label') || '')) || norm(el.textContent);
  if (!raw) return el.tagName ? el.tagName.toLowerCase() : '';
  if (/^[\d\s.,:%+\-−€£$]+$/.test(raw) || /^[٠-٩\s.,٫]+$/.test(raw)) return '#';
  const masked = raw.replace(/\d+/g, '#');
  return knownWords().has(raw) || knownWords().has(masked) ? masked : '[content]';
}

// ——— taps: on a control, on nothing (a «dead» tap), or the same spot again and again
const INTERACTIVE = 'button, a, input, select, textarea, label, summary, [role="button"], [role="tab"], [role="switch"], [role="option"]';
let recent = [];
function onTap(ev) {
  const el = ev.target && ev.target.closest ? ev.target.closest(INTERACTIVE) : null;
  const x = Math.round(ev.clientX || 0), y = Math.round(ev.clientY || 0), now = Date.now();
  recent = recent.filter((r) => now - r.t < 800).concat({ t: now, x, y });
  const close = recent.filter((r) => Math.abs(r.x - x) < 28 && Math.abs(r.y - y) < 28);
  if (close.length === 3) track('rage', { id: controlName(el) || 'nothing', y });
  if (el) track('tap', { id: controlName(el), off: !!el.disabled });
  else {
    const near = ev.target && ev.target.closest ? ev.target.closest('[data-u], section, [role=dialog]') : null;
    track('dead', { tag: ev.target && ev.target.tagName ? ev.target.tagName.toLowerCase() : '', near: near ? controlName(near) : '', y });
  }
}

export function installUsage() {
  if (typeof window === 'undefined' || window.__masareefUsage) return;
  window.__masareefUsage = true;
  document.addEventListener('click', onTap, { capture: true, passive: true });
  window.addEventListener('error', (e) => track('error', { msg: String(e.message || '').slice(0, 80) }));
  window.addEventListener('unhandledrejection', (e) => track('error', { msg: `promise: ${String((e.reason && e.reason.message) || e.reason || '').slice(0, 70)}` }));
  track('open', { standalone: !!(window.navigator && window.navigator.standalone) || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) });
}

export function device() {
  if (typeof window === 'undefined') return {};
  return {
    w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1,
    v: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev',
    lang: document.documentElement.lang || '', ua: (navigator.userAgent || '').slice(0, 120),
  };
}

/**
 * Send the diary once a day when the server can keep it. What was sent leaves
 * the phone's copy; anything recorded meanwhile stays for tomorrow.
 */
export async function flushUsage(build, { now = Date.now(), send = usageLog } = {}) {
  if (!supportsAction(build, 'usage_log')) return false;
  const s = store();
  let last = 0; try { last = Number(s && s.getItem(SENT)) || 0; } catch { last = 0; }
  if (now - last < DAY_MS) return false;
  const events = load();
  if (!events.length) return false;
  const d = new Date(now);
  const batch = `U${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${Math.random().toString(36).slice(2, 5)}`;
  try {
    const r = await send({ events, device: device(), batch });
    if (!r || !r.ok) return false;
    save(load().slice(events.length));
    try { s && s.setItem(SENT, String(now)); } catch { /* sends again tomorrow */ }
    return true;
  } catch { return false; }
}

/** For the suites: the diary as it stands, and a clean slate. */
export const _peek = () => load();
export const _reset = () => { save([]); memory = []; screen = ''; recent = []; try { store() && store().removeItem(SENT); } catch { /* none */ } };
