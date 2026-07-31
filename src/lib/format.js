/**
 * Number and digit handling.
 *
 * Everything RENDERS in Western digits — that is what his sheet holds and what
 * Fraunces' numerals are cut for. Anything he TYPES may arrive in Arabic-Indic
 * (٠١٢٣٤٥٦٧٨٩) or Persian digits, so normalize on the way in. Mirrors
 * `normalizeDigits_` in backend/Code.gs.
 */
const AR = '٠١٢٣٤٥٦٧٨٩';
const FA = '۰۱۲۳۴۵۶۷۸۹';

export function normalizeDigits(s) {
  return String(s == null ? '' : s).replace(/[٠-٩۰-۹]/g, (d) => {
    const i = AR.indexOf(d);
    return String(i === -1 ? FA.indexOf(d) : i);
  });
}

// Grouped Western digits — 'en-US' is pinned deliberately: the ambient locale on
// an Arabic iPhone would render ١٬٠٤٥ and break parity with his sheet.
export function money(n) {
  const v = Number(n);
  if (!isFinite(v)) return '0';
  return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function moneyRound(n) {
  const v = Number(n);
  return isFinite(v) ? Math.round(v).toLocaleString('en-US') : '0';
}

// Amounts are shown with their currency only when it is NOT EGP — a travel row
// reads "12.5 EUR" exactly as it sits in the Amount column (D8).
export function amountWithCurrency(amount, currency) {
  const base = money(amount);
  return currency && currency !== 'EGP' ? `${base} ${currency}` : base;
}
