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

async function attempt(url, payload, timeoutMs, signal) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  /**
   * A CALLER's signal (receipt cancel, R-receipts 3) folded into this attempt's
   * own controller. `aborted` is checked first because a signal that fired
   * before the call started would otherwise never deliver its event, and the
   * request would go out for a job he has already cancelled.
   */
  const onAbort = () => ctrl.abort();
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener('abort', onAbort);
  }
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
    if (err?.name === 'AbortError') {
      // CANCELLED and TIMEOUT are both AbortError and must never collapse into
      // one name: a timeout is worth retrying and a cancellation is the one
      // thing that must not be (see `call`). Same law as `ignored` vs `error`.
      throw new TransportError(signal?.aborted ? 'cancelled' : 'timeout');
    }
    throw new TransportError('network');
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
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
export async function call(payload, kind = 'read', signal) {
  const creds = getCreds();
  if (!creds) throw new TransportError('no-credentials');

  const timeout = TIMEOUTS[kind] ?? TIMEOUTS.read;
  const body = { ...payload, secret: creds.secret };

  try {
    return await attempt(creds.execUrl, body, timeout, signal);
  } catch (err) {
    /**
     * A CANCELLED CALL IS NEVER RETRIED, and this line is the whole reason the
     * signal is threaded down here rather than handled in the worker.
     *
     * The retry above exists for a blip on mobile data. Replaying a request he
     * has just cancelled would send the image to the vision endpoint a SECOND
     * time — and `receipt_extract` consumes the daily budget on ATTEMPTS, not
     * successes (the WS1 follow-up fix), so cancelling one receipt would cost
     * two of the forty he gets in a day. The abort would have looked like it
     * worked; only the bill would have known.
     */
    if (signal?.aborted) throw err instanceof TransportError ? err : new TransportError('cancelled');
    return attempt(creds.execUrl, body, timeout, signal);
  }
}

/** Setup-time check: verifies a pasted URL+secret pair before we store it. */
export async function probe(execUrl, secret) {
  return attempt(execUrl, { secret, action: 'ping' }, TIMEOUTS.read);
}
