/**
 * Receipt photos captured while offline.
 *
 * IndexedDB rather than localStorage because these are ~500 KB each and
 * localStorage's ~5 MB budget is already holding the snapshot and the outbox.
 *
 * WHAT THIS QUEUE HOLDS is worth being precise about, because it decides where
 * the 6 h age gate belongs:
 *
 *   This queue holds UN-EXTRACTED photos. Extraction writes nothing to the sheet
 *   (contract §3.3), and the row is only ever appended by `receipt_confirm`,
 *   which Dad taps on a card in front of him. So a queued photo can never
 *   silently double-write — the confirm is always a deliberate act.
 *
 *   A `receipt_confirm` that fails after he tapped it DOES append a row, so it
 *   goes into the normal outbox with `ageGated: true` and a `clientId`, exactly
 *   like a cash entry. The §5 exemption remains `fix_category` only.
 *
 * The age rule still applies here, for a different reason: past 6 h the server's
 * `rcpthash_` cache has expired, so re-extracting re-bills the vision call — and
 * a receipt he snapped yesterday is one he may no longer recognise. Old captures
 * therefore wait for a deliberate tap instead of quietly spending money.
 */
const DB_NAME = 'masareef';
const DB_VERSION = 1;
const STORE = 'receipts';
export const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

function openDB() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('no-indexeddb'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('idb-open-failed'));
  });
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const req = fn(store);
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function enqueue(item) {
  try {
    const db = await openDB();
    // `stage` defaults to 'queued': a captured photo is always waiting for the
    // worker, whether it was captured online or off. That single default is what
    // turns this from an offline-only fallback into the normal path (WS4-Q).
    await tx(db, 'readwrite', (s) => s.put({
      stage: 'queued', error: null, extraction: null,
      ...item,
      queuedAt: item.queuedAt ?? Date.now(),
    }));
    db.close();
    return true;
  } catch {
    // Storage unavailable (private mode, quota). Better to tell him the photo
    // did not save than to pretend it did.
    return false;
  }
}

/**
 * Patch one job in place. Used by the worker for every stage transition.
 *
 * Read-modify-write inside ONE transaction: two transitions racing on the same
 * job would otherwise let the older write win and strand a job in `reading`
 * forever, which looks exactly like a job that is simply slow.
 */
export async function update(id, patch) {
  try {
    const db = await openDB();
    const ok = await tx(db, 'readwrite', (s) => {
      const get = s.get(id);
      get.onsuccess = () => {
        if (!get.result) return;                 // already confirmed and removed
        s.put({ ...get.result, ...patch });
      };
      return get;
    });
    db.close();
    return ok !== undefined;
  } catch {
    return false;
  }
}

export async function all() {
  try {
    const db = await openDB();
    const items = await tx(db, 'readonly', (s) => s.getAll());
    db.close();
    return Array.isArray(items) ? items.sort((a, b) => a.queuedAt - b.queuedAt) : [];
  } catch {
    return [];
  }
}

export async function remove(id) {
  try {
    const db = await openDB();
    await tx(db, 'readwrite', (s) => s.delete(id));
    db.close();
  } catch { /* nothing to do */ }
}

/** Fresh captures may be extracted automatically; old ones wait for a tap. */
export async function partition(now = Date.now()) {
  const items = await all();
  return {
    fresh: items.filter((i) => now - i.queuedAt < SIX_HOURS_MS),
    stale: items.filter((i) => now - i.queuedAt >= SIX_HOURS_MS),
  };
}

export async function count() {
  return (await all()).length;
}
