#!/usr/bin/env node
/**
 * Tests for the number-rendering primitives.  `npm test`
 *
 * ZERO new dependencies on purpose: `format.js` is plain ESM and this file is
 * `.mjs`, so Node imports it directly. This app had NO executable checks at all
 * — which is precisely why six null-fabrication bugs shipped through it, each
 * caught by a human reading a screen.
 *
 * WHAT THESE PIN, and why it is the primitive rather than the views:
 * every one of those six fixes was made at a CALL SITE. The primitive stayed
 * loaded, so the class kept recurring in new files while each individual fix
 * was correct. Guarding call sites protects the sites you thought of.
 *
 * The call-site guards are deliberately NOT removed (defence in depth, ruled
 * 2026-07-31): they now agree with the primitive instead of compensating for it.
 */
import { money, moneyRound, amountWithCurrency, ABSENT } from '../src/lib/format.js';

let pass = 0;
const failures = [];
const eq = (actual, expected, label) => {
  if (Object.is(actual, expected)) { pass++; return; }
  failures.push(`${label}\n      expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

// ——— THE FOUR ABSENT INPUTS, through every function. ————————————————
// null and '' took route 1 (Number() coerces them to 0, so the old guard was
// never even reached); undefined and NaN took route 2 (they DID reach the
// guard, which answered '0' anyway). Both routes had to close.
for (const [value, name] of [[null, 'null'], [undefined, 'undefined'], ['', "''"], [NaN, 'NaN']]) {
  eq(money(value), ABSENT, `money(${name}) is an absence, never a number`);
  eq(moneyRound(value), ABSENT, `moneyRound(${name}) is an absence`);
  eq(amountWithCurrency(value, 'EGP'), ABSENT, `amountWithCurrency(${name}, 'EGP') is an absence`);
  // The one that matters most: a currency beside a placeholder still asserts
  // that some foreign figure exists. It must be the glyph ALONE.
  eq(amountWithCurrency(value, 'EUR'), ABSENT, `amountWithCurrency(${name}, 'EUR') carries NO currency`);
}
eq(money('   '), ABSENT, 'a whitespace-only string is an absence too');

// ——— A REAL ZERO IS A FACT AND MUST SURVIVE. ————————————————————————
// This is the assertion that stops the fix from becoming its own lie: a day he
// genuinely spent nothing on must read "0", not "—".
eq(money(0), '0', 'a real zero still renders as 0');
eq(moneyRound(0), '0', 'a real rounded zero still renders as 0');
eq(amountWithCurrency(0, 'EGP'), '0', 'a real zero with EGP renders as 0');
eq(amountWithCurrency(0, 'EUR'), '0 EUR', 'a real zero in EUR keeps its currency');
eq(money('0'), '0', 'the STRING "0" is a real zero, not an absence');

// ——— ordinary values are untouched by all of this. ————————————————
eq(money(1234.5), '1,234.5', 'grouping is unchanged');
eq(money(1045.567), '1,045.57', 'two fraction digits max, unchanged');
eq(moneyRound(1234.5), '1,235', 'rounding is unchanged');
eq(moneyRound(-12.4), '-12', 'negatives round as before');
eq(amountWithCurrency(12.5, 'EUR'), '12.5 EUR', 'a travel amount keeps its currency');
eq(amountWithCurrency(12.5, 'EGP'), '12.5', 'EGP is implicit and stays unprinted');
eq(amountWithCurrency(12.5, null), '12.5', 'a null CURRENCY on a real amount is still a real amount');
eq(money('1234.5'), '1,234.5', 'a numeric string is a number');

// ——— the glyph itself ————————————————————————————————————————————
eq(ABSENT, '—', 'the absence glyph is the em dash the views already use');

const report = failures.length
  ? `❌ ${failures.length} / ${pass + failures.length} format assertions failed:\n  - ${failures.join('\n  - ')}`
  : `✅ all ${pass} format assertions passed`;
console.log(report);
process.exit(failures.length ? 1 : 0);
