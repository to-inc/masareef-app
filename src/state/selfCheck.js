/**
 * «CHECK THE APP» — tests that run on HIS phone (Tarek, 2026-10-25: «tests that I can
 * program into the app»). Read-only: one ping, and what the phone already holds.
 *
 * `gatherFacts` collects; `judge` decides. Judging is a pure function so the suite can
 * feed it any state (a stuck photo, a wrong clock) without a phone.
 */
import { ping } from '../api/index.js';
import * as receiptQueue from './receiptQueue.js';
import * as outbox from './outbox.js';
import { loadSnapshot } from './cache.js';
import { loadDraft, mergeJobs, unsettledCount } from './batchDraft.js';
import { cairoParts } from '../lib/dates.js';

const HOUR = 3600 * 1000;

export async function gatherFacts(now = Date.now()) {
  const facts = { now, app: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev', phoneDay: cairoParts(new Date(now)) };
  const t0 = Date.now();
  try {
    const res = await Promise.race([ping(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000))]);
    facts.server = { ok: !!(res && res.ok !== false), ms: Date.now() - t0, build: res && res.build && res.build.id, today: res && res.today };
  } catch (err) {
    facts.server = { ok: false, ms: Date.now() - t0, error: String(err && err.message || err) };
  }
  try { facts.photos = (await receiptQueue.all()).map((j) => ({ stage: j.stage, queuedAt: j.queuedAt })); } catch { facts.photos = null; }
  try { facts.outbox = outbox.all().map((i) => ({ queuedAt: i.queuedAt, blocked: !!i.blocked })); } catch { facts.outbox = null; }
  try {
    const d = loadDraft();
    facts.statement = d ? unsettledCount({ rows: mergeJobs(d.jobs || []), settled: d.settled, leftOut: d.leftOut }) : 0;
  } catch { facts.statement = null; }
  try { facts.offline = !!(navigator.serviceWorker && navigator.serviceWorker.controller); } catch { facts.offline = false; }
  try {
    const e = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null;
    facts.storage = e && e.quota ? { used: e.usage, quota: e.quota } : null;
  } catch { facts.storage = null; }
  try { const s = loadSnapshot(); facts.figuresAt = s ? s.savedAt : null; } catch { facts.figuresAt = null; }
  return facts;
}

const ago = (ms) => (ms < HOUR ? `${Math.max(1, Math.round(ms / 60000))} min` : ms < 48 * HOUR ? `${Math.round(ms / HOUR)} h` : `${Math.round(ms / (24 * HOUR))} d`);

/** Facts → rows of { key, tone: 'ok' | 'warn' | 'bad', text } in the reader's language (S). */
export function judge(f, S) {
  const rows = [];
  const add = (key, tone, text) => rows.push({ key, tone, text });

  if (!f.server || !f.server.ok) add('server', 'bad', S.checkServerDown);
  else add('server', f.server.ms > 8000 ? 'warn' : 'ok', S.checkServerOk(f.server.build || '?', (f.server.ms / 1000).toFixed(1)));

  if (f.server && f.server.ok && f.server.today) {
    const a = f.phoneDay, b = f.server.today;
    const same = a.y === b.y && a.m === b.m && a.d === b.d;
    add('clock', same ? 'ok' : 'bad', same ? S.checkClockOk : S.checkClockOff(`${a.d}/${a.m}/${a.y}`, `${b.d}/${b.m}/${b.y}`));
  }

  if (f.photos === null) add('photos', 'warn', S.checkUnreadable);
  else {
    const stuck = f.photos.filter((p) => (p.stage === 'queued' || p.stage === 'reading') && f.now - p.queuedAt > HOUR).length;
    add('photos', stuck ? 'warn' : 'ok', stuck ? S.checkPhotosStuck(stuck) : S.checkPhotosOk(f.photos.length));
  }

  if (f.outbox === null) add('outbox', 'warn', S.checkUnreadable);
  else if (!f.outbox.length) add('outbox', 'ok', S.checkOutboxEmpty);
  else {
    const oldest = Math.min(...f.outbox.map((i) => i.queuedAt || f.now));
    const blocked = f.outbox.filter((i) => i.blocked).length;
    add('outbox', blocked || f.now - oldest > HOUR ? 'warn' : 'ok', S.checkOutboxWaiting(f.outbox.length, ago(f.now - oldest), blocked));
  }

  if (f.statement) add('statement', 'warn', S.checkStatementWaiting(f.statement));
  else add('statement', 'ok', S.checkStatementNone);

  add('offline', f.offline ? 'ok' : 'warn', f.offline ? S.checkOfflineOk : S.checkOfflineMissing);

  if (f.storage) {
    const pct = Math.round((100 * f.storage.used) / f.storage.quota);
    add('storage', pct > 80 ? 'warn' : 'ok', S.checkStorage(pct));
  }

  if (f.figuresAt) add('figures', f.now - f.figuresAt > 24 * HOUR ? 'warn' : 'ok', S.checkFigures(ago(f.now - f.figuresAt)));

  return rows;
}
