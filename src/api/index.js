/**
 * The single seam between the app and the backend.
 *
 * Everything routes through here so that the transport — which leans on an Apps
 * Script redirect/CORS quirk outside our control — is one contained module if it
 * ever has to change.
 */
import { mockFetchSummary, mockReceiptExtract, mockEntries } from './mock.js';
import * as live from './endpoints.js';

// Vite statically replaces this. Anything other than an explicit 'false' keeps
// the mock on, so a misconfigured build can never quietly reach his real sheet.
export const USING_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

export const fetchSummary = () => (USING_MOCK ? mockFetchSummary() : live.summary());

export const fetchEntries = (ref) => (USING_MOCK ? mockEntries(ref) : live.entries(ref));

export const fixCategory = (args) =>
  USING_MOCK ? Promise.resolve({ ok: true, v: 1, learned: false }) : live.fixCategory(args);

export const postManual = (args) =>
  USING_MOCK ? Promise.resolve({ ok: true, v: 1 }) : live.manual(args);

/**
 * DICTATION (finding A5) — the `voice` action, reached from a text field.
 *
 * The mock answers `{ok:true}` and NOTHING ELSE, which is the mock-parity rule
 * this project learned twice in one day: the server's own answer to `voice` is a
 * bare envelope, so a mock that invented a parsed entry here would certify a
 * client against a response the server has never sent.
 */
export const postVoice = (args) =>
  (USING_MOCK ? Promise.resolve({ ok: true, v: 1 }) : live.voice(args));

export const ping = () => (USING_MOCK ? Promise.resolve({ ok: true, v: 1 }) : live.ping());

export const receiptExtract = (args) =>
  USING_MOCK ? mockReceiptExtract(args) : live.receiptExtract(args);

export const receiptConfirm = (args) =>
  USING_MOCK ? Promise.resolve({ ok: true, v: 1 }) : live.receiptConfirm(args);
