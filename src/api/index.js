/**
 * The single seam between the app and the backend.
 *
 * Everything routes through here so that the transport — which leans on an Apps
 * Script redirect/CORS quirk outside our control — is one contained module if it
 * ever has to change.
 */
import { mockFetchSummary, mockReceiptExtract, mockEntries, mockVoice } from './mock.js';
import * as live from './endpoints.js';

// Vite statically replaces this. Anything other than an explicit 'false' keeps
// the mock on, so a misconfigured build can never quietly reach his real sheet.
import { SERVER_ACTIONS } from '../state/capabilities.js';

/**
 * The mock answers the SERVER's real verb list — including what it does not
 * know. Modelling no list at all is how a dead control passed 2,412 assertions.
 */
export const MOCK_ACTIONS = SERVER_ACTIONS;

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
    build: { id: 'mock', assertions: 0, actions: MOCK_ACTIONS.slice(), complete: true },
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
