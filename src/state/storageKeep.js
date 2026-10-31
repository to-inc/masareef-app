/**
 * KEEP WHAT IS ONLY ON THE PHONE (PWA audit 2026-11-01).
 *
 * WebKit evicts a site's storage by least-recent use when the disk is short, and
 * an origin «in persistent mode» is left out of that eviction (webkit.org/blog/14403).
 * It grants `persist()` by heuristics, the first named being «opened as a Home
 * Screen Web App» — which is how this app runs. Until it is granted, the outbox,
 * the photo queue, a statement draft and the secret are all evictable.
 *
 * Asked on every launch: an already-kept origin answers `persisted()` and stops.
 * `null` means the phone cannot say (an older engine) — never «kept».
 */
export async function keepStorage(nav = globalThis.navigator) {
  try {
    const st = nav && nav.storage;
    if (!st || typeof st.persist !== 'function') return null;
    if (typeof st.persisted === 'function' && (await st.persisted())) return true;
    return !!(await st.persist());
  } catch {
    return null;
  }
}

/** Is it kept? Read-only, for «Check the app». */
export async function storageKept(nav = globalThis.navigator) {
  try {
    const st = nav && nav.storage;
    return st && typeof st.persisted === 'function' ? !!(await st.persisted()) : null;
  } catch {
    return null;
  }
}
