/**
 * THE LOOKALIKE DETECTOR — rows already in his book that may be the same expense
 * entered twice.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * IT FINDS. IT NEVER FIXES. THAT BOUNDARY IS CONSTITUTIONAL, NOT A PREFERENCE.
 *
 * docs/09 §4: "Row deletion — Humans only, by hand. The backend has no delete
 * capability. It never will." So this module exports no action, takes no
 * callback, and reaches no endpoint. It turns rows into a REPORT; removing a row
 * stays a human editing his own sheet, with the manifest in front of him.
 *
 * That is also why it is safe to be generous about what it surfaces: a detector
 * that cannot act cannot destroy anything by being wrong, so it may suggest
 * freely where an enforcer would have to be timid.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WHY IT CAN ONLY EVER SUGGEST — the honest limit, stated once, up front.
 *
 * Two identical coffees on one day is a REAL pattern, not a data error. So
 * "same date, same amount, same currency" is evidence and never a verdict, and
 * every string this feeds says "these look alike", never "duplicate". It is the
 * same reason `dupBook` flags a receipt instead of blocking it (06 §3.4): the
 * system does not know which of two true-looking rows is the mistake, and the
 * one person who does is holding the phone.
 */
import { twinKey } from './batchDraft.js';
import { parseSheetDate, dayKey } from './recent.js';

/**
 * THE KEY IS `batchDraft`'s, DELIBERATELY — one definition, two callers.
 *
 * date + amount + currency, method excluded. The batch screen asks "are these
 * two rows on my screen the same purchase?" and this asks "are these two rows in
 * my book the same purchase?" — the same question about different populations,
 * so they must not drift into two answers. (The two-normalisers hazard, which
 * this project has paid for at `publicRow_`/`displayRow_` and again at the two
 * `<Delta>` render sites.)
 *
 * What is local here is only the NORMALISATION in front of it: book dates arrive
 * as `d/M/yyyy` text and the same day can be written `1/8/2026` or `01/8/2026`,
 * so the raw string is canonicalised to a day number before keying. An unparsed
 * date falls back to its trimmed literal rather than to `null` — two rows that
 * are both unreadable in the SAME way are still worth showing him.
 */
export function bookKey(entry) {
  if (!entry) return null;
  const parsed = parseSheetDate(entry.date);
  const day = parsed ? dayKey(parsed) : String(entry.date || '').trim();
  if (!day) return null;
  return twinKey({ date: day, amount: entry.amount, currency: entry.currency });
}

/** Case- and whitespace-folded, for comparing descriptions only. */
const fold = (s) => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * HOW ALIKE, IN THREE NAMED TIERS RATHER THAN A SCORE.
 *
 * A percentage would invite him to trust a number this has no basis to produce.
 * Three tiers map to three sentences he can act on:
 *
 *   'same'      — description folds identical. The strongest thing this can say.
 *   'similar'   — one description contains the other (`Uber` vs `Uber trip`),
 *                 which is what the same merchant looks like typed twice.
 *   'different' — same money, same day, different words. Most likely two real
 *                 purchases; shown LAST and never with the others' emphasis.
 *
 * `different` is deliberately still shown. Suppressing it would make the feature
 * quietly incomplete in exactly the way «This week 0» was — and a genuine
 * double-entry typed once as "Lidl" and once as "groceries" lives precisely
 * there.
 */
export function likeness(a, b) {
  const x = fold(a && a.description);
  const y = fold(b && b.description);
  if (!x && !y) return 'same';
  if (x === y) return 'same';
  if (x && y && (x.indexOf(y) !== -1 || y.indexOf(x) !== -1)) return 'similar';
  return 'different';
}

const RANK = { same: 0, similar: 1, different: 2 };

/**
 * Rows in, groups out. A group is 2+ entries sharing a key.
 *
 * ⚠️ UNPRICED ROWS CANNOT GROUP, and that is `twinKey`'s rule rather than a
 * choice made here: a row with no amount has nothing to match on, so treating
 * two of them as the same purchase would be a guess dressed as a finding. They
 * are counted separately (`unpriced`) so the screen can say what it did not
 * examine — a detector that silently skips rows is a check that cannot fail on
 * the population it dropped.
 *
 * Each entry keeps its original position as `at`, because the ONLY action
 * available to him is finding the row in his sheet by hand.
 */
export function findLookalikes(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const groups = new Map();
  let unpriced = 0;
  let examined = 0;

  list.forEach((e, at) => {
    const key = bookKey(e);
    if (!key) { unpriced++; return; }
    examined++;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...e, at });
  });

  const out = [];
  for (const [key, rows] of groups) {
    if (rows.length < 2) continue;
    // The group's tier is its CLOSEST pair — one identical pair inside a group
    // of three is the finding, and averaging would bury it.
    let tier = 'different';
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        const t = likeness(rows[i], rows[j]);
        if (RANK[t] < RANK[tier]) tier = t;
      }
    }
    out.push({ key, tier, rows });
  }

  out.sort((a, b) => {
    if (RANK[a.tier] !== RANK[b.tier]) return RANK[a.tier] - RANK[b.tier];
    if (a.rows.length !== b.rows.length) return b.rows.length - a.rows.length;
    return a.key < b.key ? -1 : 1;
  });

  return { groups: out, unpriced, examined };
}

/**
 * How many rows are implicated, NOT how many groups.
 *
 * A group of three is three rows he has to look at, and reporting "1" would
 * understate the work in front of him. `extra` is what he could conceivably
 * remove — one row per group is the one he is KEEPING, and a count that included
 * it would tell him to delete an expense he made.
 */
export function lookalikeCounts(report) {
  const groups = (report && report.groups) || [];
  const rows = groups.reduce((n, g) => n + g.rows.length, 0);
  const extra = groups.reduce((n, g) => n + g.rows.length - 1, 0);
  return { groups: groups.length, rows, extra };
}
