#!/usr/bin/env node
/**
 * The receipt card's duplicate flags, and what a confirm ANSWER means.
 * `npm run check:receipt-dup`
 *
 * D18a: a bank slip is captured rather than refused, and before it is written
 * the server checks HIS BOOK. Three hints reach this card and they are three
 * different questions — an SMS within 6 h, the same photo again, and a row that
 * is actually in the sheet. Only the last one can hand him something to look at.
 *
 * THE ASSERTION THIS FILE EXISTS FOR is the one at the top of the confirm
 * section: `{ok:true, skipped:"book_duplicate"}` is a SUCCESSFUL REQUEST THAT
 * WROTE NOTHING. `if (res.ok)` calls it saved — and the card would close, the
 * job would be deleted from the queue, and the expense would be gone with no
 * error and nothing on screen. That is the one forbidden output, reached
 * through a truthy envelope.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';
import {
  CONFIRM_OUTCOMES, confirmOutcome, dupState, bookFrom, undatedHint, isBlocked,
} from '../src/state/receiptDup.js';

let pass = 0;
const failures = [];
const eq = (a, b, label) => {
  if (Object.is(a, b)) { pass++; return; }
  failures.push(`${label}\n      expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const ok = (c, label) => eq(!!c, true, label);

const MATCH = {
  date: '11/8/2026', description: 'Uber', method: 'Visa',
  category: 'Transportation', amount: 355.96, currency: 'EGP', tab: 'Aug',
};
const withBook = (over = {}) => ({
  ok: true,
  dupBook: { checked: true, reason: null, count: 1, undatedAmountMatch: false, match: MATCH, ...over },
});

// ——————————————————————— what the server DID
eq(CONFIRM_OUTCOMES.length, 3, 'three outcomes — written, blocked, failed');
eq(confirmOutcome({ ok: true }), 'written', 'a plain ok wrote the row');
eq(confirmOutcome({ ok: true, skipped: 'duplicate' }), 'written',
  'clientId idempotency is WRITTEN — that row exists, this tap just already made it');
/**
 * The trap, stated twice on purpose: as an outcome, and as the thing `res.ok`
 * cannot tell you.
 */
eq(confirmOutcome({ ok: true, skipped: 'book_duplicate' }), 'blocked',
  'A BOOK DUPLICATE WROTE NOTHING — it is never "written"');
ok({ ok: true, skipped: 'book_duplicate' }.ok === true,
  'and `res.ok` is TRUE on it, which is exactly why reading `ok` alone loses the expense');
eq(confirmOutcome({ ok: true, skipped: 'something_new' }), 'failed',
  'an unnamed skip fails LOUD rather than landing in written');
eq(confirmOutcome({ ok: false, error: 'bad_amount' }), 'failed', 'a refusal is failed');
eq(confirmOutcome({ ok: 'yes' }), 'failed', 'a truthy-but-not-true ok is not a success');
eq(confirmOutcome(null), 'failed', 'and neither is a dropped response');
eq(confirmOutcome(undefined), 'failed', 'nor a missing one');

// ——————————————————————— the three hints stay three
{
  const d = dupState({ ok: true, dupSms: true, dupReceipt: false, dupBook: null });
  eq(d.sms, true, 'the SMS hint is read');
  eq(d.photo, false, 'the photo hint is its own field');
  eq(d.book, null, 'and no book row means no book flag');

  const b = dupState(withBook());
  ok(!!b.book, 'a book match becomes the book flag');
  eq(b.sms, false, 'without implying the others');
  eq(b.book.match.description, 'Uber', 'and carries the ROW, not just a boolean');
  eq(b.book.count, 1, 'with its count');
}

// ——————————————————————— reading the book answer, from either shape
eq(bookFrom({ ok: true }), null, 'no dupBook at all is no match');
eq(bookFrom({ ok: true, dupBook: { checked: true, match: null } }), null,
  'CHECKED AND CLEAN shows him nothing — we looked and there is nothing to say');
eq(bookFrom({ ok: true, dupBook: { checked: false, reason: 'month_not_cached', match: null } }), null,
  'and COULD-NOT-CHECK also shows him nothing — we have no claim to make about his book');
eq(bookFrom(withBook({ count: 3 })).count, 3, 'the count is passed through…');
eq(bookFrom(withBook({ count: undefined })).count, 1, '…and defaults to one rather than to zero or NaN');
eq(bookFrom({ ok: true, dupBook: { match: 'Uber' } }), null,
  'a match that is not an object is not a row — never rendered as one');

// ——————————————————————— the undated gap (ruling (b))
/**
 * BOTH SIGNALS AT ONCE — and this fixture is the only arrangement in which the
 * `!d.match` guard proves anything. With `undatedAmountMatch:false` (the default
 * everywhere else in this file) a version that ignored the guard returns false
 * too, so the assertion below passed either implementation. A mutation said so.
 *
 * The behaviour it pins: when we have found the actual row, the weaker "there is
 * also something undated" note is noise on top of an answer, and showing both
 * would have him hunting for a second expense that may not exist.
 */
eq(undatedHint(withBook({ undatedAmountMatch: true })), false,
  'WITH A REAL MATCH the weaker undated note is not also shown');
eq(undatedHint(withBook()), false, 'and with neither signal there is nothing to say');
eq(undatedHint({ ok: true, dupBook: { checked: true, match: null, undatedAmountMatch: true } }), true,
  'no match, but a row that month has an unreadable date — REPORTED');
eq(undatedHint({ ok: true, dupBook: { checked: true, match: null, undatedAmountMatch: false } }), false,
  'and not invented when there is none');
eq(undatedHint({ ok: true }), false, 'nor when there is no book answer at all');

// ——————————————————————— what withholds the confirm button
eq(isBlocked({ sms: false, photo: false, book: null }, false), false, 'a clean card confirms directly');
eq(isBlocked({ sms: true, photo: false, book: null }, false), true, 'an SMS hint withholds it');
eq(isBlocked({ sms: false, photo: true, book: null }, false), true, 'so does a repeat photo');
eq(isBlocked({ sms: false, photo: false, book: { match: MATCH, count: 1 } }, false), true,
  'and so does a row already in his book');
eq(isBlocked({ sms: true, photo: true, book: { match: MATCH, count: 1 } }, true), false,
  'ONE acknowledgement releases all three — he is answering a question, not filling a form');
eq(isBlocked(null, false), false, 'a missing hint set does not strand him on a card he cannot submit');

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });

try {
  const src = await readFile(new URL('../src/views/ReceiptView.jsx', import.meta.url), 'utf8');

  /**
   * ——— THE WIRING, asserted at the source, because these live in a handler no
   * render test can reach. The same technique that found the five-week-old
   * `rowHint` blind spot.
   */
  ok(/const outcome = confirmOutcome\(res\)/.test(src),
    'the confirm response is CLASSIFIED, not read as a boolean…');
  ok(!/if \(res\?\.ok\) \{\s*\n\s*const doneId/.test(src),
    '…and the old `if (res.ok)` success branch is gone');
  ok(/outcome === 'blocked'/.test(src), 'a blocked confirm has its own branch…');
  ok(/outcome === 'written'/.test(src), '…distinct from a written one');
  ok(/if \(overrideDup\) payload\.dupAck = true;/.test(src),
    'and `dupAck` is sent ONLY on his acknowledgement — otherwise the server gate is decoration');
  ok(!/payload\.dupAck = true;\s*\n\s*try/.test(src) || /if \(overrideDup\)/.test(src),
    'never unconditionally');

  ok(/setMethod\(isMethod\(res\.defaultMethod\) \? res\.defaultMethod : DEFAULT_METHOD\)/.test(src),
    "the slip's method default comes from the SERVER (D19), validated through the wire vocabulary");
  ok(!/setMethod\('Cash'\)/.test(src), 'the hardcoded Cash default is gone from the extraction path');

  /**
   * ——— AND THE CARD SHOWS HIM THE ROW.
   *
   * A banner that merely says "duplicate" asks him to trust us about his own
   * book. The row is the whole point: on a slip the payee and his description
   * rarely match, which is why the key does not compare them — so he is the one
   * who can tell a real twin from a coincidence.
   */
  const { default: ReceiptView } = await vite.ssrLoadModule('/src/views/ReceiptView.jsx');
  ok(typeof ReceiptView === 'function', 'the view still loads with the dup module wired in');

  const { S } = await vite.ssrLoadModule('/src/i18n/strings.js');
  ok(typeof S.receiptDupBook === 'string' && S.receiptDupBook.length > 0,
    'the book banner has a sentence in the active locale');
  eq(typeof S.receiptDupBookMore, 'function', 'and the twin count is a template, not a bare number');
  ok(/355\.96|355/.test(String(S.receiptDupBookMore(2))) === false,
    'which names how many MORE there are, not the amount');
} finally {
  await vite.close();
}

const report = failures.length
  ? `❌ ${failures.length} / ${pass + failures.length} receipt-dup checks failed:\n  - ${failures.join('\n  - ')}`
  : `✅ all ${pass} receipt-dup checks passed`;
console.log(report);
process.exit(failures.length ? 1 : 0);
