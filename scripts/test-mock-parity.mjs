/**
 * MOCK PARITY — the summary mock serves what the DEPLOYED server serves.
 *
 * Two laws, both learned the expensive way (five shipped clients that could
 * not read reality, and one V17 comment that hid a live feature):
 *
 *  · A mock more GENEROUS than the service certifies a client against fields
 *    reality will not send. Optimism goes behind flags that ship OFF.
 *  · A mock more PESSIMISTIC than the service hides a shipped feature from
 *    every dev and every suite. The deployed build (20260825-1463) serves
 *    `foreign`/`prevForeign` on week, month AND year — the «This week 0»
 *    fix — so the mock must serve them UNCONDITIONALLY.
 *
 * `homeAgg`/`prevHomeAgg` (§2.2a, build 20260826-1531) are NOT deployed yet:
 * the mock's default must be ABSENT (not null — absent is the old server,
 * null is 1531 with no home currency; the client is tri-state on this field).
 * `MOCK_HOMEAGG_CURRENCY = false` ships the absent state; `''` reviews the
 * 1531-Dad state (present, null); `'EUR'` reviews the patched-book state.
 *
 * The builders are TRANSCRIBED from Code.gs (`foreignIn_`, `homeAggIn_`) —
 * never composed from memory (the batch-shape lesson) — and their unreachable
 * branches are exercised by DIRECT CALL, the `foreignIn_` precedent.
 */
import { readFile } from 'node:fs/promises';
import { mockSummary, mockForeignIn, mockHomeAggIn } from '../src/api/mock.js';

let pass = 0;
const failures = [];
const ok = (cond, name) => { cond ? pass++ : failures.push(name); };
const eq = (got, want, name) =>
  ok(Object.is(got, want), `${name}\n      expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);

const s = mockSummary();

// ——— foreign/prevForeign: UNCONDITIONAL on all three periods (1463 reality)
for (const period of ['week', 'month', 'year']) {
  const b = s[period];
  ok(b && typeof b.foreign === 'object' && b.foreign !== null,
    `${period}.foreign is served unconditionally — the deployed server sends it and the mock must not hide the surface`);
  ok(b && typeof b.prevForeign === 'object' && b.prevForeign !== null,
    `${period}.prevForeign is served — the comparison's other half`);
  ok(b && typeof b.foreign.count === 'number' && typeof b.foreign.byCurrency === 'object',
    `${period}.foreign carries the server shape {count, byCurrency}`);
}
// The fixture's one materialized foreign row (Café de Flore, 12.5 EUR, today)
// sits in today's window and therefore in ALL THREE current-side aggregates.
for (const period of ['week', 'month', 'year']) {
  eq(s[period].foreign.count, 1, `${period}.foreign counts the fixture's one EUR row`);
  eq(s[period].foreign.byCurrency.EUR, 12.5, `${period}.foreign.byCurrency.EUR carries its sum`);
  eq(s[period].prevForeign.count, 0, `${period}.prevForeign — the fixture's previous ${period} is EGP-only`);
}

// ——— homeAgg default: ABSENT, not null — the deployed server predates §2.2a
for (const period of ['week', 'month', 'year']) {
  ok(!('homeAgg' in s[period]),
    `${period}.homeAgg is ABSENT by default — absent is the 1463 server, null is 1531; the tri-state client must meet the state it will actually meet`);
  ok(!('prevHomeAgg' in s[period]), `${period}.prevHomeAgg is absent by default too`);
}

// ——— the flag ships OFF, in the census the priorities suite sweeps
{
  const src = await readFile(new URL('../src/api/mock.js', import.meta.url), 'utf8');
  const executes = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  ok(/const MOCK_HOMEAGG_CURRENCY = false;/.test(executes),
    'MOCK_HOMEAGG_CURRENCY ships false — boolean, so the file-wide flag sweep sees it');
}

// ——— mockForeignIn, by direct call: the transcribed semantics
{
  const f = mockForeignIn([
    { currency: 'EUR', amount: 10 },
    { currency: 'EUR', amount: 2.505 },
    { currency: 'SEK', amount: 40 },
    { currency: 'EGP', amount: 999 },      // domestic: not foreign
    { currency: 'USD', amount: null },     // counted, unpriced, never summed
    null,
  ]);
  eq(f.count, 4, 'foreign: every non-EGP row is COUNTED, priced or not');
  eq(f.byCurrency.EUR, 12.51, 'foreign: per-currency sums round to 2 places (round2_)');
  eq(f.byCurrency.SEK, 40, 'foreign: currencies never merge');
  ok(!('USD' in f.byCurrency), 'foreign: an unpriced row contributes NO sum — counted but never summed');
}

// ——— mockHomeAggIn, by direct call: the §2.2a partition, transcribed
{
  eq(mockHomeAggIn([{ currency: 'EGP', amount: 5 }], ''), null,
    'homeAgg: an empty home currency yields NULL — absent feature, not a zero');

  const rows = [
    { currency: 'EUR', amount: 20 },                 // native
    { currency: 'EUR', amount: 5, home: 5 },         // native wearing a stray stamp
    { currency: 'EGP', amount: 100, home: 1.87 },    // converted: the RECORDED value participates
    { currency: 'EGP', amount: 300 },                // unstamped: money real, conversion absent
    { currency: 'SEK', amount: 40 },                 // unstamped, another currency
    { currency: null, amount: null },                // unpriced: a bare count
  ];
  const h = mockHomeAggIn(rows, 'EUR');
  eq(h.currency, 'EUR', 'homeAgg names its denomination');
  eq(h.native.count, 2, 'native: home-currency rows, stamped or not');
  eq(h.native.total, 25, 'native: summed at their own parsed amounts');
  eq(h.strayStamps, 1, 'a stamp on a native row is SURFACED, never absorbed');
  eq(h.converted.count, 1, 'converted: the stamped row');
  eq(h.converted.total, 1.87, 'converted participates at the RECORDED home value — never re-derived');
  eq(h.total, 26.87, 'total = native + converted, rounded');
  eq(h.unstamped.count, 2, 'unstamped: real money, conversion absent');
  eq(h.unstamped.total, null, 'unstamped.total stays null — currencies do not add');
  eq(h.unstamped.byCurrency.EGP, 300, 'unstamped.byCurrency carries MONEY SUMS');
  eq(h.unstamped.byCurrency.SEK, 40, '…per currency');
  eq(h.unpriced, 1, 'unpriced: a bare count');
  eq(h.native.count + h.converted.count + h.unstamped.count + h.unpriced, rows.length,
    'THE PARTITION IDENTITY: every row lands in exactly one bucket');
}

// ——— flag-on shape, by direct summary rebuild is not possible without the flag,
// so pin the builder the flag routes through instead: '' nulls, 'EUR' builds.
{
  const h = mockHomeAggIn([], 'EUR');
  ok(h && h.unstamped && h.unstamped.count === 0,
    'an empty window still carries unstamped {count: 0} — «we looked» is a different sentence from null');
}

if (failures.length) {
  console.log(`❌ MOCK PARITY — ${failures.length} / ${pass + failures.length} failed:\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✅ all ${pass} mock-parity checks passed`);
