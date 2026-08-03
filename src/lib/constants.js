/**
 * His categories, VERBATIM (docs/02-data-context.md).
 *
 * Ordered by how often he actually uses them — CLAUDE.md requires most-used
 * first, because ordering is the cheapest way to cut taps.
 *
 * ⚠️ DO NOT "SYNC" THIS WITH THE BACKEND CHARACTER-FOR-CHARACTER.
 * `backend/Code.gs` stores `'Elect. Recharge '` WITH a trailing space, because
 * that is what his dashboard's SUMIF criteria cell contains (D13). This list
 * deliberately stays trimmed: the server's `canonicalCategory_()` matches
 * trimmed input and writes its own stored form, so the client never needs to
 * know. Copying the space here would just put an invisible character into
 * button labels for no benefit.
 *
 * What DOES have to match is the SET — the backend rejects anything outside it,
 * so a wrong or missing entry here is a dead button, never a corrupted sheet.
 *
 * PER-INSTALL EXTRAS (2026-07-31, extended 2026-08-03). The last SIX belong to
 * TAREK's book, not to Dad's: the backend keeps a shared base of 21 and each
 * install declares its own additions in `CONFIG.EXTRA_CATEGORIES` (empty by
 * default, so a fresh paste into Dad's sheet cannot acquire them). This client
 * list is a superset, and that asymmetry is safe by the paragraph above:
 * against Dad's deployment those six chips are simply dead buttons — the server
 * refuses the value and the row lands as ❓, one tap from correct. The reverse —
 * a category the server accepts but the client cannot offer — would be the
 * harmful direction, and is why this list is updated whenever the backend's is.
 *
 * APPEND, NEVER INSERT. `SHORT_LIST` is `slice(0, 6)` and the cash keypad is
 * `slice(0, 12)`, so a name added anywhere but the end silently reorders the
 * one-tap row he has learned the shape of. Asserted in scripts/test-categories.mjs.
 *
 * Never invent, rename, merge or "clean up" these:
 *   `omara2 al behar` = the building by the sea. `fara7` = wedding-related.
 *   `Water. Recharge` keeps its stray dot.
 */
export const CATEGORIES = [
  'Eating out', 'Groceries', 'Car', 'Gifts', 'Donations',
  'Internet', 'Telephone', 'Medical', 'Personal expenses',
  'omara2 al behar', 'Elect. Recharge', 'Water. Recharge',
  'Villa', 'Taxes and fines', 'Gas', 'Madinety club',
  'Shams club', 'Officers club', 'Vacations', 'Utilities', 'fara7',
  // ——— Tarek's book only (see PER-INSTALL EXTRAS above). Trimmed display
  // forms, as everything here is; the server owns the stored form.
  'Transportation', 'InstaPay - Services', 'InstaPay - Purchases',
  /**
   * 2026-08-03, Tarek's ruling. InstaPay transfers that are team/employee fees,
   * split per project — 'Science Pitchers' (Science Pitchers OY) and 'HYS'
   * (Help Yourself with Tarek Omran) — with 'Team' for the people who work
   * across both. Three labels rather than one because his sheet has a single
   * category column and no second dimension to split a project out of later.
   *
   * These are the ones the transfer path will learn: `learnMemory_` binds each
   * bank-masked counterparty to whichever he taps, so it is one tap per person
   * and every later transfer to them arrives already categorised.
   */
  'Science Pitchers', 'HYS', 'Team',
];

// The six that cover most of his spending — shown before "أنواع تانية…".
export const SHORT_LIST = CATEGORIES.slice(0, 6);

/**
 * One-tap descriptions for the cash keypad, from his real cash habits.
 *
 * `category` is a preset only where the mapping is genuinely unambiguous. The
 * rest are deliberately null: D5 says never show a wrong guess, and guessing
 * "Guards" or "Tips" would be exactly that. The client does NOT carry a copy of
 * the merchant-memory table — that lives in the sheet's Memory tab and it
 * LEARNS, so a client-side copy would go stale and start contradicting the
 * server. These eight are fixed strings we control, not merchant lookups.
 */
export const CASH_QUICK = [
  { label: 'Coffee', category: 'Eating out' },
  { label: 'Car wash', category: 'Car' },
  { label: 'Taqa', category: 'Elect. Recharge' },
  { label: 'Talabat', category: 'Groceries' },
  { label: 'Petroleum', category: 'Car' },
  { label: 'Guards', category: null },
  { label: 'Fares', category: null },
  { label: 'Tips', category: null },
];

export const UNKNOWN_CATEGORY = '❓';

export const METRICS = [
  { key: 'all', labelKey: 'metricAll', color: '#1B5742' },
  { key: 'Visa', labelKey: 'metricVisa', color: '#1D4ED8' },
  { key: 'Cash', labelKey: 'metricCash', color: '#B45309' },
];
