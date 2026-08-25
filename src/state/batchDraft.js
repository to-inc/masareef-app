/**
 * THE BATCH REVIEW DRAFT — his ticks and his edits, held on this device.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS SCREEN IS. One photograph of a banking-app transaction LIST becomes
 * N candidate rows; he ticks; one confirm writes them. Reconciliation, not
 * capture — the five-second law governs capture, and the capture already
 * happened when he took the screenshot.
 *
 * WHY THE DRAFT LIVES HERE AND NOT ON THE SERVER (ratified, CONTRACT-04 ②).
 * The extraction the server caches lives SIX HOURS — Apps Script's ceiling, not
 * a chosen number. Fourteen rows ticked one at a time is not six-hour work in
 * the sense that matters: he starts, is interrupted, comes back next morning.
 * If the draft lived only in that cache, every tick would be gone.
 *
 * So the split is by COST: his edits are expensive and are kept here for as long
 * as he likes; the extraction is cheap and is allowed to expire. When it does,
 * one fresh vision call re-reads the photo and his edits re-attach BY INDEX.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * WHAT MAY NEVER LEAVE THIS FILE ON THE WIRE.
 *
 * `row_status` is contract law, and the server re-reads it from its OWN cached
 * extraction (`rcpthash_<sourceHash>` → `entries[index].row_status`). A
 * request-carried status is "the UI is the only guard" wearing server clothes —
 * and the row it would let through is a `declined` one, which is money that
 * never left his account, written into his book with nothing on the screen to
 * notice it by.
 *
 * The client may carry his EDITS — amount, category, description, date, method —
 * because those have always been his (receipt_confirm has worked this way since
 * D10). The distinction is not "client data vs server data"; it is *what he
 * decided* versus *what the machine read*.
 */
/**
 * The vocabulary of HIS edits — what the review screen may overlay on a row.
 * NOT the wire allow-list: `toConfirmRows` builds the request from §3.5's
 * field list explicitly and does not consult this (it did once; the
 * verification pass flagged the leftover as a trap — a constant that LOOKS
 * load-bearing and changes nothing invites someone to "fix" the wire by
 * editing it).
 */
export const EDITABLE_FIELDS = ['amount', 'category', 'description', 'date', 'method'];

/** The six the extractor may emit (06 §3.5). */
export const ROW_STATUSES = ['completed', 'declined', 'pending', 'incoming', 'roundup', 'unclear'];

/**
 * The THREE that may ever become a row in his book.
 *
 * `declined` is absent because the money never left the account. `incoming` is
 * absent because income is out of scope by design. Mirrors the server's
 * `WRITABLE_ROW_STATUSES` — and mirrors it rather than deriving from it, because
 * the server is the enforcer and this copy exists only to avoid OFFERING him a
 * tick the write will refuse. If the two ever disagree the server wins, loudly.
 *
 * ——— `roundup` LEFT THIS LIST (D22, ruled 2026-08-24; docs/04).
 *
 * Revolut's «Spare change» rows are a BTC auto-investment: round-ups are
 * categorically not expenses, so writing one into his book is a wrong number
 * with a ✓ over it. The server dropped it first —
 * `WRITABLE_ROW_STATUSES = ['completed', 'pending', 'unclear']` in build
 * `20260824-1347`, read out of `backend/Code.gs` rather than taken from a
 * report — and this is the mirror following, which is the half docs/05
 * commissioned to this seat.
 *
 * **The row does not disappear and does not lose its figure.** It keeps its
 * amount, its aggregate count and its sentence («فكة متجمعة · N حركات») and
 * loses only the tick, because capture is sacred and he is entitled to SEE
 * what the screenshot said even about money this app may not write. That is
 * the same shape `declined` and `incoming` already have: no tick at all rather
 * than a disabled one, since a control he cannot use is a question about why.
 *
 * ⚠️ THE ONE-CYCLE COST IS DELIBERATE AND ALLOWED. Until that build reaches his
 * book the serving backend still accepts a roundup row, so this mirror costs a
 * tick he could technically have used. §6.0: a guard protecting THE BOOK fails
 * CLOSED, and a closed guard is allowed to cost a feature. The reverse — the app
 * offering a tick the server answers `row_not_writable` — is the dark dictation
 * button, and both halves ship in the same hour anyway.
 */
export const WRITABLE_STATUSES = ['completed', 'pending', 'unclear'];

/**
 * The server's whole-batch cap, mirrored so the confirm button can refuse
 * BEFORE the wire does (`CONFIG.BATCH_MAX_ROWS` in Code.gs; over it the server
 * refuses the ENTIRE batch with no per-row answers). Two 40-row screenshots
 * merge to 80 ticked-by-default rows, so this is reachable by one ordinary
 * evening of Revolut. Mirrored, not derived — the server is the enforcer; this
 * copy exists only so the UI never offers a tap the write will refuse whole.
 */
export const BATCH_MAX_ROWS = 40;

export const isWritable = (status) => WRITABLE_STATUSES.indexOf(status) !== -1;

/**
 * WHICH ROWS ARRIVE TICKED.
 *
 * Only `completed` — a purchase the bank has settled and he almost certainly
 * made. Everything else writable is OFF and tickable by deliberate tap, each for
 * its own reason: `pending` may yet settle, `unclear` is ours to have failed at.
 * (`roundup` used to be the third of those. D22 answered its taxonomy question —
 * a round-up is not an expense — so it is no longer writable at all.)
 *
 * Non-writable rows are not "off" — they have no tick at all. A control he
 * cannot use is a question about why.
 */
export const defaultTicked = (row) => !!row && row.row_status === 'completed';

/**
 * ROW IDENTITY — which photo, and where in it.
 *
 * `sourceHash` is that image's `clientHash`; `index` is its position in that
 * extraction's `entries`. The pair is what lets the server re-read the row's
 * status from its own cache, which is the whole reason a merged batch can be
 * status-checked at all (CONTRACT-04 ①). Without it, a batch assembled from
 * three photos is unverifiable.
 */
export const rowKey = (row) => `${(row && row.sourceHash) || ''}#${row && row.index != null ? row.index : ''}`;

/**
 * TWIN IDENTITY — the same purchase, however it reached the screen.
 *
 * date + amount + currency. METHOD IS EXCLUDED DELIBERATELY: the same purchase
 * can be read as `card` in one capture and `unknown` in another, and a key that
 * disagreed with itself across two photos of one transaction would flag nothing.
 * Same key the book check uses, so "already in your book" and "twice on your
 * screen" are answering the same question.
 *
 * A null amount cannot twin — an unpriced row has nothing to match on, and
 * treating two of them as the same purchase would be a guess.
 */
export function twinKey(row) {
  if (!row || row.amount == null) return null;
  return `${row.date || ''}|${row.amount}|${row.currency || ''}`;
}

/**
 * MERGE THE PHOTOS — at the screen, never at the server (CONTRACT-04 ①).
 *
 * Each photo stays its own extraction and its own vision call; the server never
 * learns two screenshots are related. This is the one list he reads, ordered by
 * date then by the order the rows appeared in their capture.
 *
 * ——— OVERLAP IS THE NORMAL CASE, NOT THE EDGE.
 *
 * He scrolls and snaps, so the same purchase appears in two photos. Twins are
 * FLAGGED, NEVER MERGED and NEVER auto-dropped: two identical real purchases
 * exist (the Recent settle-key lesson), and silently collapsing them would
 * delete an expense he made. The FIRST occurrence keeps its default; every later
 * one is forced OFF and told why, so the safe state needs no action from him and
 * the unsafe one needs a deliberate tap.
 */
export function mergeJobs(jobs) {
  const rows = [];
  (Array.isArray(jobs) ? jobs : []).forEach((job, photoOrder) => {
    if (!job || !Array.isArray(job.entries)) return;
    job.entries.forEach((e, i) => {
      rows.push({
        ...e, sourceHash: job.sourceHash || job.clientHash || '', index: i, photoOrder,
        // The server's per-list method ruling rides the job (D19); stamped per
        // row so the wire builder never has to reach back to a job by hash.
        defaultMethod: job.defaultMethod || null,
      });
    });
  });

  // Date first, then capture order — so he can read down the list against the
  // screenshot in his hand. Rows with no readable date sort last rather than
  // being dropped: an undated row is still an expense he may want.
  /**
   * DATE, THEN THE PHOTO HE SENT, THEN DOWN THAT PHOTO.
   *
   * ——— WHY PHOTO ORDER IS A SORT KEY AND NOT A DETAIL. Found by running it:
   * ordering by `index` alone across photos INTERLEAVES them —
   * `A#0 B#0 A#1 B#1 A#2` — so on a day covered by two captures he can read down
   * neither screenshot. That destroys the only reconciliation this screen exists
   * to let him perform: phone in one hand, bank app in the other, line by line.
   *
   * Rows with no readable date sort LAST rather than being dropped — an undated
   * row is still an expense he may want, and `'￿'` is above every digit.
   */
  rows.sort((a, b) => {
    const da = a.date || '￿';
    const db = b.date || '￿';
    if (da !== db) return da < db ? -1 : 1;
    if (a.photoOrder !== b.photoOrder) return a.photoOrder - b.photoOrder;
    return a.index - b.index;
  });

  const seen = new Map();
  return rows.map((row) => {
    const key = twinKey(row);
    if (!key) return { ...row, twinOf: null };
    if (seen.has(key)) return { ...row, twinOf: seen.get(key) };
    seen.set(key, rowKey(row));
    return { ...row, twinOf: null };
  });
}

/**
 * The ticks a freshly merged list starts with.
 *
 * A twin is OFF regardless of its status: the first copy carries the purchase,
 * and a second tick would write it twice.
 */
export function initialTicks(rows) {
  const ticks = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!isWritable(row.row_status)) continue;       // no tick exists to set
    ticks[rowKey(row)] = row.twinOf ? false : defaultTicked(row);
  }
  return ticks;
}

/**
 * WHAT GOES ON THE WIRE — his edits, the identity, and nothing else.
 *
 * `row_status` is stripped by construction rather than by omission: the payload
 * is BUILT from an allow-list, so a future field added to the row cannot ride
 * along by accident. That is the same shape `manualPayload` uses, and for the
 * same reason — a chooser's label once reached the wire as a method and wrote
 * card money into the Cash column.
 */
/**
 * ISO `yyyy-MM-dd` (how a decorated list row carries its server-resolved date)
 * → Cairo `d/M/yyyy` (the ONLY form `batchRowDate_` parses — it reads
 * `row.dateStr` via `parseCairoDateStr_` and nothing else).
 * An unresolvable date returns null and the field is OMITTED: the server then
 * answers `bad_date` for that row, per row, visibly — never a silently
 * substituted today (§3.5's own rule about dates, applied to ourselves).
 */
export function wireDateStr(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return null;
  return `${Number(m[3])}/${Number(m[2])}/${Number(m[1])}`;
}

/**
 * THE WIRE ROW — §3.5's request shape, field by field, FROM THE SERVER'S READER.
 *
 * ⚠️ THE FIRST VERSION OF THIS BUILDER SENT `EDITABLE_FIELDS` AND NOTHING ELSE,
 * and every gap was a wrong number waiting in his book:
 *   · no `currency` → `batchConfirmRow_` defaults absent currency to EGP, so a
 *     ticked €15.47 row would have been APPENDED AS 15.47 EGP — the exact
 *     corruption the capability advertisement exists to prevent (§2.1), arriving
 *     through a door that advertisement does not guard;
 *   · `date` where the server reads `dateStr` (`d/M/yyyy`) → every row
 *     `bad_date`, nothing written;
 *   · no `description`/`merchantLatin` → the book records the CATEGORY as the
 *     description (server fallback), and Memory learns nothing;
 *   · no `method` → `normalizeMethod_(undefined)` is Cash, filing his card
 *     statement into the wrong column;
 *   · no `dupAck` → the review screen's override button changed a pixel and
 *     nothing else — the server refuses without `dupAck:true`.
 * None of it ever fired only because the response-shape bug upstream kept every
 * confirm from being reachable. The two bugs concealed each other.
 *
 * `row_status` STAYS OFF THE WIRE — contract law (§3.5): the server re-reads it
 * from its own cached extraction; a request-carried status is "the UI is the
 * only guard" wearing server clothes.
 */
export function toConfirmRows(rows, ticks, edits = {}, opts = {}) {
  const overridden = opts.overridden || {};
  const out = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = rowKey(row);
    if (!ticks || ticks[key] !== true) continue;
    if (!isWritable(row.row_status)) continue;       // belt and braces; the server refuses too
    const edited = { ...row, ...(edits[key] || {}) };
    const payload = {
      sourceHash: row.sourceHash,
      index: row.index,
      amount: edited.amount,
      // The row's own currency, always — absent means EGP to the server, and
      // these rows are exactly the ones that are usually NOT in EGP.
      currency: edited.currency || row.currency || 'EGP',
      /**
       * An explicit cash hint on the row wins; otherwise the server's own
       * per-list ruling (defaultMethod, D19). The client composes from what the
       * SERVER said, twice over — it decides nothing here.
       */
      method: edited.method
        || (row.payment_hint === 'cash' ? 'Cash' : (row.defaultMethod || 'Visa')),
      /**
       * `❓` when nobody — Memory or him — has an answer. The server accepts it
       * and the row joins `pending[]`, one tap from fixed in the Inbox (D5).
       * Omitting the field instead would be `bad_category`: a ticked expense
       * REFUSED because it was not yet classified, which inverts capture-is-
       * sacred at the last step.
       */
      category: edited.category || row.category || '❓',
      description: edited.description !== undefined
        ? edited.description : (row.merchant_display || ''),
    };
    const dateStr = wireDateStr(edited.date !== undefined ? edited.date : row.date);
    if (dateStr) payload.dateStr = dateStr;
    if (row.merchant_latin) payload.merchantLatin = row.merchant_latin;
    if (overridden[key]) payload.dupAck = true;
    out.push(payload);
  }
  return out;
}

/**
 * THE OUTCOMES THAT MAY BE ASKED AGAIN — an ALLOW-LIST, by name.
 *
 * `book_duplicate` is the ONLY refusal an override can answer, because `dupAck`
 * is the only thing the server is waiting for: it found a row in his book that
 * matches and refused pending his judgement (§3.3, §3.5). Two identical coffees
 * on one day are two coffees, and only he knows which case this is.
 *
 * The three absent statuses are absent deliberately, and each for its own
 * reason:
 *   · `written` — it is in his book; asking again is asking for a second copy;
 *   · `duplicate` — the per-row idempotency key was already seen, so WE wrote it
 *     on an earlier attempt. It is in his book by our hand, and `dupAck` does
 *     not apply to it. Rendering it as retryable would invite him to write the
 *     same expense twice by tapping the thing that looks like the fix;
 *   · `error` — `bad_date`, `bad_category`, `extraction_expired`: real problems
 *     with real causes, none of which an acknowledgement of a DUPLICATE
 *     addresses. Offering «save anyway» there would be a button that cannot
 *     work, which is worse than no button.
 *
 * An allow-list rather than "everything except written": a status this file has
 * never heard of arrives non-retryable, which is the closed direction, and the
 * book is what a wrong retry costs.
 */
export const RETRYABLE_OUTCOMES = ['book_duplicate'];

export const isRetryable = (outcome) =>
  !!outcome && RETRYABLE_OUTCOMES.indexOf(outcome.status) !== -1;

/**
 * WHICH ANSWER BELONGS TO WHICH ROW — ONE definition, used by every reader.
 *
 * This lived in `BatchReviewView` as a local function while the review screen
 * was the only thing that needed it. It is here now because the unsettled COUNT
 * needs the same mapping, and «the second place always exists and is quieter»
 * is this project's most expensive recurring class — the «This week 0» gate
 * suppressed the headline and the metric cards went on printing their own
 * «▼100%» in smaller type. Two readers of one mapping is exactly that shape,
 * so there is one mapping.
 *
 * ——— TWO SHAPES, AND THE OLDER ONE IS NOT DEAD YET.
 *
 * `byKey` is what `mergeOutcomes` writes and is authoritative: a keyed map
 * survives a SECOND confirm that sends a different, shorter list of rows.
 * A settled object with only `{sent, results}` is the PRE-MERGE shape, and it is
 * still reachable in one real way — a draft saved by the previous build, sitting
 * in localStorage across a deploy, restored by `loadDraft()` on his phone. It is
 * read positionally, exactly as it was, rather than dropped: dropping it would
 * blank every outcome on an upgrade, which is the app forgetting what it told
 * him an hour ago.
 *
 * POSITION IS THE ONLY SOUND KEY FOR THAT SHAPE, and it is guarded. The server
 * answers `{index, status, …}` and does NOT echo `sourceHash` (§3.5, verified
 * against `Code.gs`); `index` alone is per-photo, and two screenshots both have
 * a row 0 — that exact collision already dropped a real expense and reported it
 * as a successful no-op. So the mapping rides on what the server does guarantee:
 * one outcome per row, in request order. If the two lengths disagree the
 * assumption has failed and this returns an EMPTY map rather than sliding
 * answers one place along — a green «written» beside a row that errored is the
 * one forbidden output, and silence is the honest degradation.
 *
 * (Commission F asks the server to echo `sourceHash`; when it does, this can
 * assert instead of assume.)
 */
export function outcomeMap(settled) {
  const out = new Map();
  if (!settled || typeof settled !== 'object') return out;

  if (settled.byKey && typeof settled.byKey === 'object') {
    for (const key of Object.keys(settled.byKey)) {
      if (settled.byKey[key]) out.set(key, settled.byKey[key]);
    }
    return out;
  }

  return pairAnswers(settled.results, settled.sent);
}

/**
 * PAIR EACH ANSWER WITH THE ROW IT ANSWERS — the ONE definition, used by the
 * reader above and by the merge below. Two copies of this question is the
 * hazard that has cost this project the most, and this one decides which row in
 * his book a «written» belongs to.
 *
 * ═══ §3.5a: THE SERVER MAY NOW ECHO `sourceHash`, AND WE ASSERT ON IT ═══
 *
 * Commission F asked for the echo precisely because the positional match rests
 * on a guarantee that is *observable in the implementation and promised
 * nowhere*: one outcome per row, in request order, error paths included. With
 * the echo, identity travels WITH the answer and the client can check rather
 * than trust.
 *
 * ——— PRESENCE-GATED, AND THAT IS THE RULING (Planner 5, post-staging).
 *
 * The echo is contract text; it is not necessarily in the build his phone is
 * talking to tonight. *A client that infers capability from the REPO is wrong
 * by exactly one deploy, every time.* So this reads the echo when EVERY answer
 * carries one and falls back to position — with its length guard intact — when
 * they do not. Nothing here asks whether the repo has the feature; it asks what
 * arrived.
 *
 * ——— AND WHEN THE ECHO IS PRESENT IT IS CHECKED, NOT MERELY BELIEVED.
 *
 * Every echoed key must name a row we actually sent. If one does not, the
 * server is answering about something we did not ask, this function does not
 * understand the response, and it returns NOTHING — §3.5a's own instruction («a
 * mismatch renders NO outcomes rather than sliding answers one place along»).
 * A green «written» beside a row that errored is the one forbidden output, and
 * silence is the honest degradation. Same direction as the length guard it
 * replaces: refuse rather than guess.
 */
export function pairAnswers(results, sent) {
  const out = new Map();
  const list = Array.isArray(results) ? results : [];
  const rows = Array.isArray(sent) ? sent : [];
  if (!list.length || !rows.length) return out;

  /**
   * ALL or NONE. A response where only some rows carry the echo is a shape
   * neither §3.5a nor the positional guarantee describes, so it takes the
   * positional path and its length guard rather than a half-keyed map.
   */
  const echoed = list.every((r) => r && typeof r.sourceHash === 'string' && r.sourceHash);
  if (echoed) {
    const asked = new Set(rows.map((r) => rowKey(r)));
    for (const r of list) {
      // Built through `rowKey`, so the echo is read with the SAME identity
      // function the request was keyed by — never a second spelling of it.
      const key = rowKey(r);
      if (!asked.has(key)) return new Map();
      out.set(key, r);
    }
    return out;
  }

  if (rows.length !== list.length) return out;
  for (let i = 0; i < rows.length; i++) {
    if (list[i]) out.set(rowKey(rows[i]), list[i]);
  }
  return out;
}

/** One row's answer, or null. Null means "nothing is known", never "nothing happened". */
export function outcomeFor(settled, row) {
  return outcomeMap(settled).get(rowKey(row)) || null;
}

/**
 * OUTCOMES ACCUMULATE ACROSS CONFIRMS; THEY NEVER REPLACE.
 *
 * ⚠️ THE DEFECT THIS EXISTS TO PREVENT, AND IT IS A DOUBLE WRITE.
 *
 * A second confirm — the override path below — sends ONLY the refused rows he
 * chose to insist on. Two rows go out, two answers come back. Had the response
 * simply replaced `settled`, the positional mapping would then have covered two
 * rows out of fourteen, every other row would have resolved to «nothing known»,
 * and a row that was WRITTEN a minute ago would have re-rendered as an
 * unanswered, tickable candidate. The next «اختار الكل» writes his whole
 * statement into his book a second time.
 *
 * So the merge is keyed, and the three counts are RECOMPUTED FROM THE MAP rather
 * than added up across responses: a row that answered `book_duplicate` and then
 * `written` is one row that ended written, not one skipped plus one written. A
 * running total would drift further from his book with every override — and it
 * is the number the settled header states out loud.
 */
export function mergeOutcomes(prev, res, sent) {
  const byKey = {};
  for (const [key, outcome] of outcomeMap(prev)) byKey[key] = outcome;

  // Through the ONE pairing definition — echo when the server sends it,
  // position when it does not, nothing at all when neither can be trusted.
  for (const [key, outcome] of pairAnswers(res && res.results, sent)) byKey[key] = outcome;

  let written = 0, skipped = 0, errored = 0;
  for (const key of Object.keys(byKey)) {
    const status = byKey[key] && byKey[key].status;
    if (status === 'written') written++;
    else if (status === 'error') errored++;
    else skipped++;
  }
  return { byKey, written, skipped, errored };
}

/**
 * THE ROWS HE HAS INSISTED ON AFTER A REFUSAL — the second confirm's payload.
 *
 * ⚠️ THE THREAD THIS CLOSES (docs/05, `6139886`): «a `book_duplicate`
 * discovered at CONFIRM time has no dupAck path — the override panel renders
 * only pre-settle, so a row first refused at confirm can only be captured by
 * re-photographing». The pre-settle panel answers the duplicate the client
 * already knew about (`row.dupBook`, from the extraction). But the book moves
 * between the extraction and the confirm — an SMS lands, a Shortcut fires — and
 * the server checks again at write time. That second refusal is the one with no
 * door, and it lands on the rows most likely to be real: the ones that looked
 * clean.
 *
 * It builds through `toConfirmRows` rather than beside it, so §3.5's request
 * shape has exactly ONE builder. A second wire builder is the two-normalizers
 * hazard with money on it: the first one would have kept its `currency` and its
 * `dateStr` and the copy would have quietly lost them, which is how €163 becomes
 * 163 EGP.
 *
 * A refused row rides only if he OVERRODE it — absent an override this returns
 * [], so the retry button cannot exist without a deliberate per-row tap. The
 * override is his judgement, and an app that batches it away has made the
 * judgement for him.
 *
 * ——— AND THE ROWS HE NEVER SENT RIDE TOO, which is a second dead control this
 * closes. A row left unticked at confirm gets no answer, so it keeps its live
 * checkbox after the settle — and until now the footer said only «back to the
 * book», so ticking it did nothing at all. A tickable box on the screen that
 * writes to his book, wired to nothing, is the dark dictation button again.
 * What this returns is therefore exactly what `unsettledCount` calls waiting:
 * refusals he has insisted on, plus rows he has now decided to keep.
 *
 * `written` and `duplicate` can never ride — both are in his book, and a
 * second write is the one thing this screen must never make easy. An `error`
 * row cannot ride either: nothing on this screen fixes a `bad_date`, and a
 * button that cannot work is worse than no button. It still COUNTS as waiting
 * and still says «not logged», because the honest report of an unfixable row is
 * that it is unfixed, not that it is finished.
 */
export function retryRows(rows, settled, overridden, edits = {}, ticks = {}) {
  const answers = outcomeMap(settled);
  const send = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = rowKey(row);
    const answer = answers.get(key);
    if (answer) {
      if (isRetryable(answer) && overridden && overridden[key]) send[key] = true;
      continue;
    }
    if (ticks && ticks[key] === true) send[key] = true;
  }
  return toConfirmRows(rows, send, edits, { overridden });
}

/**
 * RE-ATTACH HIS EDITS AFTER A RE-SNAP (CONTRACT-04 ②).
 *
 * When the six-hour extraction is gone the server answers `extraction_expired`
 * and writes NOTHING. The draft is not dropped and is not sent hoping — the card
 * says so plainly and offers «صوّرها تاني». One fresh vision call re-reads the
 * photo, and his edits come back BY INDEX.
 *
 * Index, not content: the whole point is that the new extraction may read a row
 * slightly differently, and his edit is the correction to exactly that row. The
 * new sourceHash replaces the old one, because the identity the server will
 * status-check against is the NEW extraction's.
 *
 * A shorter re-read drops the edits that have nowhere to land — the alternative
 * is re-attaching an amount to a row that is not the one he corrected.
 */
export function reattachEdits(oldEdits, oldRows, newRows) {
  const byIndex = new Map();
  for (const row of Array.isArray(oldRows) ? oldRows : []) {
    const e = oldEdits && oldEdits[rowKey(row)];
    if (e) byIndex.set(row.index, e);
  }
  const next = {};
  for (const row of Array.isArray(newRows) ? newRows : []) {
    const e = byIndex.get(row.index);
    if (e) next[rowKey(row)] = e;
  }
  return next;
}

/**
 * HOW MANY EXPENSES ARE WAITING, UNLOGGED — the count that must be visible
 * somewhere he passes daily (Planner 4, CONTRACT-10).
 *
 * A pending batch is MONEY MISSING FROM HIS BOOK. §2.2's honest-incompleteness
 * law applies to the app's own queue exactly as it applies to a month's totals:
 * silence here is the same defect as «This week 0» — a screen that looks complete
 * while something real is absent from it.
 *
 * Counts rows that COULD still become entries: writable, and not already
 * settled. A declined row is not waiting for anything, and a row he has
 * deliberately left unticked is still waiting — the decision he has not made is
 * exactly what the count is for.
 */
export function unsettledCount(draft) {
  if (!draft) return 0;
  const rows = Array.isArray(draft.rows) ? draft.rows : [];
  const waiting = rows.filter((r) => isWritable(r && r.row_status));
  if (!draft.settled) return waiting.length;

  /**
   * ——— A SETTLED BATCH IS NOT AUTOMATICALLY A FINISHED ONE, and this is the
   * SECOND RENDER SITE of the rule the first one already enforces.
   *
   * The review screen says per row what happened. This number is what he passes
   * on the Book screen every day, and it used to return 0 the moment a confirm
   * came back — so a batch where ten rows wrote and two were REFUSED read as
   * «nothing waiting», with the two sitting in a draft he has no reason to
   * reopen. That is «This week 0» exactly: a surface that looks complete while
   * something real is absent from it, and it is the quieter of the two places,
   * which is where this class always survives.
   *
   * It counts what the answers say is NOT in his book — a refusal, an error, and
   * a row that was never sent because he left it unticked. `written` and
   * `duplicate` are both in the book (the second by our own earlier write), so
   * both are done.
   *
   * IT FAILS OPEN, deliberately, and that is the fail-direction rule (§6.0): this
   * count protects CAPTURE, so when a refused row might be a real second purchase
   * it is counted as waiting. Over-counting costs him one look at a screen that
   * explains itself; under-counting loses the expense.
   *
   * BUT IT DOES NOT INVENT. A settled marker carrying no per-row answers — the
   * degenerate shape, and the one the older suite pins — yields 0 rather than
   * assuming the whole batch is outstanding: honest rendering cuts both ways, and
   * fabricating N waiting expenses out of an absent answer is the same defect
   * pointing the other direction.
   */
  const answers = outcomeMap(draft.settled);
  if (!answers.size) return 0;
  return waiting.filter((r) => {
    const status = (answers.get(rowKey(r)) || {}).status;
    return status !== 'written' && status !== 'duplicate';
  }).length;
}

/* ——————————————————————— persistence ——————————————————————— */

const KEY = 'masareef.batchDraft.v1';

/**
 * Kept for as long as he likes. There is no age-out here on purpose: the thing
 * that expires is the EXTRACTION, and that expiry is discovered from the
 * server's answer rather than guessed from a clock on this device. A draft the
 * client had quietly binned would be his ticks thrown away by a timer he never
 * saw.
 */
export function loadDraft() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    return raw && typeof raw === 'object' ? raw : null;
  } catch {
    return null;
  }
}

export function saveDraft(draft) {
  try {
    if (draft && typeof draft === 'object') localStorage.setItem(KEY, JSON.stringify(draft));
  } catch { /* a lost draft costs him ticks, never an expense */ }
  return draft || null;
}

export function clearDraft() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to do */ }
}
