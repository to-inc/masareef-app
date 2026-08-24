import { call } from './client.js';

/**
 * The wire vocabulary (docs/06-api-contract.md §2–§3).
 *
 * Note the envelope split: the PWA always sends `{secret, action, ...}`. The
 * `type` chain (`sms | manual | voice`) belongs exclusively to the three
 * deployed iOS Shortcuts and is never reused here — those are installed on
 * Dad's phone and must keep working untouched forever.
 */

export const ping = () => call({ action: 'ping' }, 'read');

export const summary = () => call({ action: 'summary' }, 'read');

/**
 * One month's rows (06 §2.4). The month is named by NUMBERS — the client never
 * constructs a tab name, and `tabNameFor_` stays server-side where the naming
 * rule belongs. The response echoes the resolved tab for display.
 */
export const entries = ({ y, m }) => call({ action: 'entries', y, m }, 'read');

export const fixCategory = ({ tab, rowHint, match, newCategory }) =>
  call({ action: 'fix_category', tab, rowHint, match, newCategory }, 'write');

export const manual = ({ amount, method, category, description, clientId, entryDate, currency }) =>
  call({ action: 'manual', amount, method, category, description, clientId, entryDate, currency }, 'write');

/**
 * DICTATION (finding A5) — the same `voice` action the Siri Shortcut has always
 * used, reached from a text field instead of from Siri.
 *
 * The PWA design verified that the Web Speech API is silently broken in
 * installed standalone apps and named this as the documented fallback: a plain
 * text field where he taps the iOS keyboard's OWN microphone. Keyboard dictation
 * is just text input, so it works where `SpeechRecognition` does not — and the
 * text lands in the parser that has handled «٥٠ جنيه قهوة» since Phase 1.
 *
 * No new server surface: the endpoint, the Arabic keyword map and the ❓ fallback
 * are the ones already in production.
 */
export const voice = ({ text, clientId }) =>
  call({ action: 'voice', text, clientId }, 'write');

/**
 * WS4 fills these in behind ReceiptView.
 *
 * `signal` is a THIRD argument to `call`, never a body field — the body is
 * assembled from named fields exactly like every other endpoint here, so an
 * AbortSignal cannot ride onto the wire as `"signal":{}` no matter how the
 * caller passes it.
 */
export const receiptExtract = ({ image, clientHash, snapDate, signal }) =>
  call({ action: 'receipt_extract', image, clientHash, snapDate }, 'vision', signal);

export const receiptConfirm = (fields) =>
  call({ action: 'receipt_confirm', ...fields }, 'write');

/**
 * BATCH CONFIRM (D20, 06 §3.5) — one screenshot of a transaction LIST becomes N
 * candidates; this writes only the rows he ticked.
 *
 * ⚠️ `rows` CARRIES NO `row_status`, AND THAT IS CONTRACT LAW RATHER THAN
 * TIDINESS. The server re-reads each row's status from its OWN cached extraction
 * (`rcpthash_<sourceHash>` → `entries[index]`), because a request-carried status
 * is "the UI is the only guard" wearing server clothes — and the row it would
 * wave through is a `declined` one: money that never left his account, written
 * into his book with nothing on screen to notice it by. `toConfirmRows` builds
 * each row from an allow-list for exactly this reason; this function must never
 * "helpfully" widen it.
 *
 * `batchClientId` is the batch's idempotency namespace; the per-row key is
 * `<batchClientId>:<sourceHash>:<index>`, which is why every row names its own
 * photo. A key of `<batchClientId>:<index>` was unique only while a batch meant
 * ONE photo — once rows came from several, two rows collided, the second was
 * answered `duplicate` and never written, and a real expense was dropped and
 * reported as a successful no-op.
 */
export const batchConfirm = ({ batchClientId, clientHash, rows }) =>
  call({ action: 'batch_confirm', batchClientId, clientHash, rows }, 'write');
