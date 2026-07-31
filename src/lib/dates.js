/**
 * Africa/Cairo date helpers.
 *
 * The server's Cairo "today" is authoritative for anything the charts depend on
 * — the client never computes week windows or null boundaries. These helpers
 * exist for one job only: stamping `entryDate` at the moment Dad taps, so an
 * entry that sits in the outbox past midnight still lands on the day he actually
 * spent the money.
 */
export function cairoParts(date = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (t) => Number(p.find((x) => x.type === t).value);
  return { y: get('year'), m: get('month'), d: get('day') };
}

// The sheet's format, exactly: d/M/yyyy with no leading zeros.
export function cairoDateStr(date = new Date()) {
  const { y, m, d } = cairoParts(date);
  return `${d}/${m}/${y}`;
}

// "آخر تحديث 17:05" — Western digits, 24h, Cairo.
export function cairoClock(ms) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(ms));
}

export const newClientId = () =>
  globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `cid-${Date.now()}-${Math.random().toString(16).slice(2)}`;
