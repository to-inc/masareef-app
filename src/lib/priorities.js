/**
 * THE PRIORITIES LENS — his month, folded into four groups (ratified by Tarek,
 * 2026-08-24; the mapping below is HIS ruling, amended from the Planner's
 * draft).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IT IS, AND THE FOUR LAWS IT INHERITS.
 *
 * A per-install rollup on the Month screen. Pure presentation: no schema, no
 * wire field, no deploy. It sums `monthCats` — numbers the app already receives
 * — and nothing here ever reaches a write.
 *
 *  1. AN EXPLICIT REMAINDER. Every category the map does not name, plus the
 *     uncategorised total, is stated on its own line. The rollup must account
 *     for the month's WHOLE figure or it is «This week 0» in a nicer shirt: a
 *     surface that looks complete while something real is missing from it.
 *  2. IT STATES, AND NEVER ADVISES. Sums only — no comparison, no ranking, no
 *     congratulation, no counsel. That is the `prevLog.mostOften` boundary, and
 *     a trend or judgement surface would need its own ratification.
 *  3. THE MAP IS A CLIENT CONSTANT, freely re-drawable. Categories are the
 *     permanent layer and his book owns them; groups are presentation and this
 *     file owns them. Re-drawing this map can never touch a stored value.
 *  4. THE REMAINDER LINE RENDERS WHENEVER IT IS CARRYING ANYTHING — a figure of
 *     either sign, a named category, or ❓ money. «An empty remainder is a
 *     claim, not a decoration» (docs/05): showing nothing is the app asserting
 *     that everything is placed, and that assertion has to be earned each month.
 *
 * ——— THE MAP PLACES 29 OF HIS 30, AND THE THIRTIETH IS DELIBERATE.
 *
 * `Personal expenses` is left unplaced ON PURPOSE, and the reason is measured
 * rather than assumed: the wire was read on 2026-08-25 and the category has
 * **zero rows in the entire book** (0 of 10 in July, 0 of 60 in August). It is
 * Dad's pattern — the seeded Memory maps ride-hailing there — and unused in this
 * one. Placing an empty category would be a guess dressed as tidiness; if a row
 * ever lands, the remainder names it honestly and he can place it then.
 *
 * ⚠️ TWO EARLIER VERSIONS OF THIS LAW WERE WRONG, and both are worth keeping:
 *  · it read «Donations sits in the remainder until Tarek assigns it». He
 *    assigned it the same evening — Joy — and this file transcribed the struck
 *    clause as «HIS RULING, VERBATIM» because the ruling moved in the hour
 *    between reading it and writing this;
 *  · and the ruling itself once said «the map now places all 30». It placed 26.
 *    Arithmetic done in prose, refuted by counting.
 * Both are the same standing lesson from opposite sides: *a comment that states
 * someone else's current state is a cache with no invalidation* — and a ruling
 * read an hour ago is exactly such a cache.
 *
 * ——— WHY THE ORDER IS FIXED AND NOT SORTED BY SIZE.
 *
 * Law 2, applied where it is easy to miss. Sorting the groups largest-first
 * would be the app RANKING his priorities every month, and re-ranking them
 * whenever a month moved — a claim about what mattered most, dressed as a
 * layout choice. The frame is fixed; only the numbers move.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * HIS RULING, VERBATIM (docs/05, «THE PRIORITIES LENS»).
 *
 * ⚠️ THREE NAMES HERE DO NOT EXIST YET — `Leisure`, `Sports` and `Hobbies` are
 * ruled and queued for the backend cycle that adds them to
 * `CONFIG.EXTRA_CATEGORIES`. Naming them EARLY is safe in a way the category
 * CHIPS are not, and the difference is the whole dark-button rule: a chip offers
 * him a write the server would refuse, while a name in this map only ever
 * matches a sum that is currently zero. When the cycle lands, the numbers appear
 * with no edit here.
 *
 * `InstaPay - Services` and `InstaPay - Purchases` are under Essentials by his
 * ruling, moved there from the draft's Projects.
 */
export const PRIORITY_GROUPS = [
  {
    key: 'essentials',
    names: [
      'Groceries', 'Utilities', 'Internet', 'Telephone', 'Gas',
      'Elect. Recharge', 'Water. Recharge', 'Taxes and fines', 'Car',
      'Transportation', 'Villa', 'omara2 al behar',
      'InstaPay - Services', 'InstaPay - Purchases',
    ],
  },
  /**
   * THE THREE CLUBS ARE HEALTH, PLACED BY THE OWNER 2026-08-25 — «these are
   * actually fitness and health clubs». The Planner would have guessed Joy, and
   * a club reads like leisure from outside his life. Asking beat assuming by one
   * whole group, on a rollup whose entire job is telling him where his month
   * went.
   */
  { key: 'health', names: ['Medical', 'Sports', 'Madinety club', 'Shams club', 'Officers club'] },
  { key: 'joy', names: ['Leisure', 'Hobbies', 'Eating out', 'Vacations', 'Gifts', 'fara7', 'Donations'] },
  { key: 'projects', names: ['Science Pitchers', 'HYS', 'Team'] },
];

/**
 * ONE CATEGORY MAY LIVE IN ONE GROUP.
 *
 * Built once, from the list above, so the two can never disagree — and asserted,
 * because a name accidentally repeated in two groups would be counted TWICE and
 * the remainder would silently absorb the error to keep the total looking right.
 * That is the worst available failure: arithmetic that reconciles while two of
 * its terms are wrong.
 *
 * ——— TRIMMED KEYS, DELIBERATELY. `Elect. Recharge ` is stored in his sheet WITH
 * a trailing space (D13, it is a SUMIF criterion) while this client's list is
 * trimmed everywhere. A map keyed on the untrimmed form would silently drop his
 * electricity out of Essentials and into the remainder — a true total made of a
 * wrong sentence. Both sides are trimmed at the boundary.
 */
const GROUP_OF = new Map();
for (const group of PRIORITY_GROUPS) {
  for (const name of group.names) GROUP_OF.set(String(name).trim(), group.key);
}

/** The map's own view of a category name, on both sides of every lookup. */
export const priorityKey = (name) => String(name == null ? '' : name).trim();

/** Which group a category falls in, or null for the remainder. */
export const groupOf = (name) => GROUP_OF.get(priorityKey(name)) || null;

/**
 * FOLD A MONTH INTO THE FOUR GROUPS.
 *
 * @param cats           `monthCats` — `[{name, now, prev}]`, ALL categories with
 *                       nonzero current-month spend (06 §2.2).
 * @param uncategorized  `month.uncategorized` — `{count, total}`, the ❓ money
 *                       the category list deliberately excludes.
 *
 * ——— IT REFUSES RATHER THAN UNDERSTATES, and that is the fail-direction rule
 * (§6.0) applied to a READ. `uncategorized` is what makes the arithmetic
 * complete: `sum(monthCats.now) + uncategorized.total` is the month, by the
 * contract's own law. Against a server that does not send it, a rollup would
 * still render four confident groups — with his ❓ money silently outside all of
 * them and outside the remainder too. So an absent field returns null and the
 * screen shows nothing at all. This protects the BOOK's truth rather than
 * capture, so it fails CLOSED: the cost is one missing panel for one deploy
 * cycle, and the alternative cost is a number he trusts and should not.
 *
 * The presence of the field is the signal, never its value — a clean month sends
 * `{count: 0, total: 0}` and its arithmetic is perfectly sound.
 */
export function rollup(cats, uncategorized) {
  if (!Array.isArray(cats)) return null;
  if (!uncategorized || typeof uncategorized.total !== 'number') return null;

  const sums = new Map(PRIORITY_GROUPS.map((g) => [g.key, 0]));
  let remainder = uncategorized.total;
  const unmapped = [];

  for (const cat of cats) {
    const amount = Number(cat && cat.now);
    if (!isFinite(amount)) continue;
    const key = groupOf(cat && cat.name);
    if (key) {
      sums.set(key, sums.get(key) + amount);
      continue;
    }
    /**
     * NAMED, NOT MERELY TOTALLED. One of his thirty is unplaced — «Personal
     * expenses», deliberately (see Law 4) — and a remainder that showed only a
     * figure would hide WHICH category the map has not placed, turning the one
     * honest line into a dump. The names are how he re-draws the map, and they
     * are how a category nobody has thought about since 2026 announces itself
     * the first time it takes money.
     */
    remainder += amount;
    unmapped.push(priorityKey(cat && cat.name));
  }

  const groups = PRIORITY_GROUPS.map((g) => ({ key: g.key, total: sums.get(g.key) }));
  return {
    groups,
    remainder: {
      total: remainder,
      names: unmapped,
      uncategorized: uncategorized.total,
    },
    /**
     * The figure the lens accounts for, derived the same way the Month card's
     * own total is: every category plus the ❓ money. It is stated so he can
     * reconcile the four groups against something, which is the entire
     * difference between a rollup and a decoration.
     */
    total: groups.reduce((a, g) => a + g.total, 0) + remainder,
  };
}
