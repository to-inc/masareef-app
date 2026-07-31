import { getCreds } from '../state/secret.js';

/**
 * Transport to the Apps Script web app.
 *
 * Two platform facts shape every line here, and both are easy to "tidy up" into
 * a broken app:
 *
 *  1. Apps Script CANNOT answer a CORS preflight. So every call must stay a CORS
 *     *simple request*: POST, and NO custom headers. Setting `Content-Type:
 *     application/json` — the instinctive thing to do — triggers an OPTIONS
 *     preflight that Google never answers, and every request fails. Leaving
 *     headers off makes fetch default to `text/plain;charset=utf-8`, which is
 *     preflight-free. doPost just JSON.parses the body, so the label is
 *     irrelevant to the server.
 *  2. `/exec` 302-redirects to script.googleusercontent.com, which is what
 *     actually serves `Access-Control-Allow-Origin: *`. fetch follows redirects
 *     by default; `redirect:'follow'` is stated explicitly so nobody "hardens"
 *     it to 'error' later.
 *
 * HTTP status is always 200 (ContentService), so callers branch on `body.ok`,
 * never on the status code.
 *
 * Unverified until WS0 deploys: this whole path is asserted from Google's own
 * documented guidance but cannot be exercised against the mock. It is isolated
 * in this one module precisely so swapping it is a contained change.
 */

// Per-endpoint budgets (contract §1). Cold starts of 1–3 s are normal.
export const TIMEOUTS = { read: 30000, write: 20000, vision: 45000 };

export class TransportError extends Error {
  constructor(reason) {
    super(`transport: ${reason}`);
    this.reason = reason;
  }
}

async function attempt(url, payload, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      // Deliberately no `headers` — see note 1 above.
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: ctrl.signal,
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      // Almost always Google's HTML sign-in interstitial, i.e. the deployment is
      // not "Execute as: Me / Anyone". Worth naming distinctly.
      throw new TransportError('not-json');
    }
  } catch (err) {
    if (err instanceof TransportError) throw err;
    throw new TransportError(err?.name === 'AbortError' ? 'timeout' : 'network');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One automatic retry, and ONLY the retry surfaces an error (contract §1) —
 * a single blip on mobile data should cost a second, not an error message.
 *
 * Retries cover transport failures only. A well-formed `{ok:false}` is a real
 * answer from the server and is returned for the caller to branch on; replaying
 * it would not change the outcome. Genuine write retries are the outbox's job,
 * where `clientId` makes them idempotent.
 */
export async function call(payload, kind = 'read') {
  const creds = getCreds();
  if (!creds) throw new TransportError('no-credentials');

  const timeout = TIMEOUTS[kind] ?? TIMEOUTS.read;
  const body = { ...payload, secret: creds.secret };

  try {
    return await attempt(creds.execUrl, body, timeout);
  } catch {
    return attempt(creds.execUrl, body, timeout);
  }
}

/** Setup-time check: verifies a pasted URL+secret pair before we store it. */
export async function probe(execUrl, secret) {
  return attempt(execUrl, { secret, action: 'ping' }, TIMEOUTS.read);
}
