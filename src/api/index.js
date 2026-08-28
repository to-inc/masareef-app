/**
 * The single seam between the app and the backend.
 *
 * Everything routes through here so that the transport — which leans on an Apps
 * Script redirect/CORS quirk outside our control — is one contained module if it
 * ever has to change.
 */
import {
  mockFetchSummary, mockReceiptExtract, mockEntries, mockVoice, mockBatchConfirm,
  mockEditEntry, mockRemoveEntry, MOCK_EXTRA_ACTIONS,
} from './mock.js';
import * as live from './endpoints.js';
import { call } from './client.js';

// Vite statically replaces this. Anything other than an explicit 'false' keeps
// the mock on, so a misconfigured build can never quietly reach his real sheet.
import { SERVER_ACTIONS } from '../state/capabilities.js';
import { CURRENCIES as SERVER_CURRENCIES } from '../state/travel.js';

/**
 * The mock answers the SERVER's real verb list — including what it does not
 * know. Modelling no list at all is how a dead control passed 2,412 assertions.
 *
 * PLUS the deployed-parity amendment (U1, 2026-08-27): the serving 1463
 * dispatches and advertises `edit_entry`, and `SERVER_ACTIONS` — another
 * leaf's file this wave — still reads «the nine plus voice». A mock that
 * withholds a verb the real server answers models the service as LESS capable
 * than it is (the V17 class, the travel-currencies hole). The amendment list
 * lives with the flags it depends on in mock.js; the filter makes the day
 * SERVER_ACTIONS itself learns the verb a no-op, not a double.
 */
export const MOCK_ACTIONS = SERVER_ACTIONS.concat(
  MOCK_EXTRA_ACTIONS.filter((a) => SERVER_ACTIONS.indexOf(a) === -1),
);

export const USING_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

export const fetchSummary = () => (USING_MOCK ? mockFetchSummary() : live.summary());

export const fetchEntries = (ref) => (USING_MOCK ? mockEntries(ref) : live.entries(ref));

export const fixCategory = (args) =>
  USING_MOCK ? Promise.resolve({ ok: true, v: 1, learned: false }) : live.fixCategory(args);

export const postManual = (args) =>
  USING_MOCK ? Promise.resolve({ ok: true, v: 1 }) : live.manual(args);

export const ping = () => (USING_MOCK
  ? Promise.resolve({
    ok: true,
    v: 1,
    /**
     * BOTH advertisements, because the serving backend publishes both
     * (`buildIdentity_`: `actions: KNOWN_ACTIONS.slice()`,
     * `currencies: MANUAL_CURRENCIES.slice()`).
     *
     * `currencies` was missing and travel mode was therefore INVISIBLE under
     * mock while working against a publishing server — the mock modelling the
     * service as LESS capable than it is. Same law as the voice defect, opposite
     * direction, and the cost is that no test could exercise the travel UI at
     * all while the mock withheld the capability it needs.
     */
    build: {
      id: 'mock',
      assertions: 0,
      actions: MOCK_ACTIONS.slice(),
      currencies: SERVER_CURRENCIES.slice(),
      complete: true,
    },
  })
  : live.ping());

/**
 * DICTATION. The mock models the SERVICE — including its refusals (`no_text`,
 * `no_amount`, `skipped:'duplicate'`), and is never more permissive than the
 * server's own parse. A mock with no handler at all is how a dead control
 * passed 2,412 assertions; see `mockVoice` for the full note.
 */
export const postVoice = (args) => (USING_MOCK ? mockVoice(args) : live.voice(args));


export const receiptExtract = (args) =>
  USING_MOCK ? mockReceiptExtract(args) : live.receiptExtract(args);

export const receiptConfirm = (args) =>
  USING_MOCK ? Promise.resolve({ ok: true, v: 1 }) : live.receiptConfirm(args);

/**
 * BATCH CONFIRM. The mock answers PER ROW, including the refusals — a flat
 * `{ok:true}` here would certify a settle screen that has never rendered a
 * `book_duplicate` or an `error` beside a row.
 *
 * This is the fourth time mock parity has been the thing that mattered (the CORS
 * mock accepting what Google refuses · prev-year data the server does not send ·
 * no `voice` handler at all, which let a dead button pass 2,412 assertions). The
 * rule that came out of those: a mock's DEFAULT must match the real service's
 * default, and it may never model the service as more capable — or more
 * uniformly successful — than it is.
 */
export const batchConfirm = (args) =>
  USING_MOCK ? mockBatchConfirm(args) : live.batchConfirm(args);

/**
 * EDIT A BOOKED ROW (06 §3.7) and RESOLVE A DUPLICATE PAIR (06 §3.9).
 *
 * These two live HERE rather than in endpoints.js only because this wave's
 * edit-and-duplicates leaf owns this file and not that one — the discipline is
 * endpoints.js's own, unchanged: named fields destructured and reassembled, so
 * nothing extra can ride onto the wire (the whitelist that once kept an
 * AbortSignal out of a body). Folding them into endpoints.js is a mechanical
 * follow-up for whoever owns it next.
 *
 * `edit_entry`: a Book row's identity is tab + match ONLY — §2.4 hands the
 * client no sheet position (and no sourceHash exists in §3.7 at all), so the
 * body carries no `rowHint` KEY unless a caller genuinely holds a
 * server-authored one (a pending[] row would). Absence, not undefined —
 * fixPayload's law at the second edit door.
 *
 * `remove_entry`: the pending row's OWN identity, echoed — tab and rowHint are
 * server-authored on `pending[]`, and `match` is the optimistic-concurrency
 * claim. NOT deployed: under the mock this answers `unknown_action` exactly as
 * the serving backend would, and the client renders that honestly.
 */
export const editEntry = (args) => {
  if (USING_MOCK) return mockEditEntry(args);
  const { tab, rowHint, match, edits } = args || {};
  const body = { action: 'edit_entry', tab, match, edits };
  if (rowHint !== undefined) body.rowHint = rowHint;
  return call(body, 'write');
};

export const removeEntry = ({ tab, rowHint, match }) =>
  (USING_MOCK ? mockRemoveEntry({ tab, rowHint, match })
    : call({ action: 'remove_entry', tab, rowHint, match }, 'write'));
