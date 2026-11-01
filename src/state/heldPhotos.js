import * as queue from './receiptQueue.js';
import { heldList, heldGet, heldDone } from '../api/index.js';
import { supportsAction } from './capabilities.js';
import { sha256Hex } from '../lib/receipt-image.js';
import { jobsChanged, runner } from './receiptRunner.js';
import { track } from './usage.js';

/**
 * PHOTOS SHARED FROM THE SHARE SHEET (Tarek, 2026-11-01, board «Masareef on iPhone»
 * Q3·A). The «Masareef» Shortcut parks a shared photo on the server (`photo_hold`);
 * here the app collects whatever is waiting and puts each one into its OWN photo
 * queue, so it is read, reviewed and logged exactly like a photo taken in the app.
 *
 * Order matters: the photo is in IndexedDB BEFORE the server is told `held_done`.
 * If the phone refuses to store it, it stays held on the server for next time. If
 * `held_done`'s answer is lost, the next pick-up finds a job already on the phone
 * under the same hash and only repeats `held_done`.
 *
 * Gated on `held_list` in the server's advertised actions, so an older server is
 * never asked. One pick-up at a time: launch and «back to the front» can overlap.
 */
let busy = null;

export function pickUpHeld(build, deps) {
  if (busy) return busy;
  busy = run(build, deps).catch(() => 0).finally(() => { busy = null; });
  return busy;
}

function base64Bytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function run(build, { api = { heldList, heldGet, heldDone }, q = queue, pump = () => runner().pump(), changed = jobsChanged } = {}) {
  if (!supportsAction(build, 'held_list')) return 0;
  const list = await api.heldList().catch(() => null);
  if (!list || list.ok !== true || !Array.isArray(list.photos) || !list.photos.length) return 0;
  const onPhone = new Set((await q.all().catch(() => [])).map((j) => j.id));
  let added = 0;
  for (const p of list.photos) {
    const got = await api.heldGet({ name: p.name }).catch(() => null);
    if (!got || got.ok !== true || typeof got.image !== 'string' || !got.image) continue;
    const clientHash = await sha256Hex(base64Bytes(got.image).buffer);
    if (!onPhone.has(clientHash)) {
      const ok = await q.enqueue({ id: clientHash, base64: got.image, clientHash, snapDate: got.day || p.day, source: 'share' });
      if (!ok) break;          // the phone would not keep it: leave it held on the server
      onPhone.add(clientHash);
      added++;
    }
    await api.heldDone({ name: p.name }).catch(() => {});
  }
  if (added) { changed(); pump(); track('photo', { act: 'shared', n: added }); }
  return added;
}
