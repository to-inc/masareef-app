/**
 * What a `remove_entry` answer means, in one place (moved here from InboxView,
 * 2026-10, E-011): the duplicate-pair door and the edit sheet's «Remove this
 * row» are the same act on the same server verb, so they read its answer the
 * same way. A row the server removes is MOVED to the sheet's Removed tab,
 * never erased.
 */
export function outcomeForRemove(res, threw) {
  if (threw) return { status: 'offline' };
  if (res && res.ok === true) return { status: 'done' };
  const code = (res && res.error) || 'unknown';
  if (code === 'unknown_action') return { status: 'engine' };
  if (code === 'row_changed') {
    const cur = res && res.current;
    return { status: 'conflict', current: cur && typeof cur === 'object' ? cur : null };
  }
  if (code === 'row_not_found') return { status: 'gone' };
  return { status: 'failed', error: code };
}
