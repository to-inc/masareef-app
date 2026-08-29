/**
 * English UI strings — the SAME key set as `strings.ar.js`, for Tarek's install.
 *
 * NOT the default. Arabic is (CLAUDE.md #6): this app is for one man in Cairo who
 * reads Arabic, and English exists because Tarek runs the same build against his
 * own book. `strings.js` picks between them; `scripts/test-i18n.mjs` compares the
 * two key sets and their arities, because a key that exists in one file and not
 * the other renders `undefined` at whoever is reading.
 *
 * REGISTER. The rules that shaped the Arabic apply verbatim: one sentence, one
 * action; no jargon; no error codes; nothing scolds and nothing nags. Where the
 * Arabic is warm and colloquial the English is plain and direct — the same
 * person speaking a different language, not a translation of the words.
 *
 * The log card keeps its own voice: a first officer closing a month's book and
 * handing it up. It states what happened, admits what it could not account for,
 * and signs off. It is the one place this app speaks a full sentence.
 */
export const EN = {
  appName: 'Masareef',

  // ——— tabs
  /**
   * «To review», matching the AR rename (glass redesign, 2026-08-28). The
   * design file specifies the ARABIC label six times and NO English one
   * anywhere, so this is HANDOFF.md's own gloss — «الوارد» → «للمراجعة»
   * (to review) — applied rather than invented. One word to veto.
   */
  tabInbox: 'To review',
  // Not "Cash" any more — the screen behind it takes either method (R-receipts 1).
  tabEntry: 'New',

  // ——— inbox
  inboxEmptyTitle: 'All logged',
  inboxEmptyBody: 'Any card purchase shows up here as soon as the bank texts.',
  inboxWaiting: (n) => `${n} ${n === 1 ? 'purchase' : 'purchases'} waiting — tap a category to log it`,
  inboxOldTitle: (n) => `Older expenses (${n})`,
  inboxOldBody: 'From previous months — still without a category.',
  inboxOldHide: 'Close',
  more: 'More categories…',
  // The button that settles every row we already know, in one tap (M4).
  inboxBatch: (n) => `Log the ${n} we know`,
  travel: '✈ travel',

  // ——— what became of a tap. Every one is the SERVER's answer, never the tap.
  inboxAllDone: 'All logged ✓',
  cardSaving: 'Logging…',
  cardDone: 'Logged ✓',
  cardAlready: 'Already logged ✓',
  cardConflict: 'The category changed in the sheet',
  cardConflictIs: 'now:',
  cardFailed: 'Not logged — tap a category again',
  cardQueued: 'Will log when the network is back',

  // ——— manual entry (cash OR card — see state/entryPayload.js)
  // The old title ("New expense — amount, then the category") is gone: the
  // pinned button now names the missing step itself, and the order on screen
  // changed (S1/S2).
  // Short on purpose: this line shares its row with three buttons (voice,
  // currency, receipt), and a longer heading wrapped and pushed the category
  // chips below the fold.
  entryRepeats: 'Like before',
  entryLog: 'Log it',
  // The pinned button names the step he is missing rather than just greying (S1).
  entryNeedAmount: 'Enter the amount',
  entryNeedCategory: 'Choose a category',
  // The chooser's accessible name. The two labels below are what he READS; the
  // values behind them are 'Cash' and 'Visa' and never meet each other.
  entryMethod: 'How you paid',
  methodCash: 'Cash',
  methodCard: 'Card',
  currency: 'EGP',
  /**
   * THE INLINE UNIT — «E£», beside a row-scale figure.
   *
   * `currency` above is the HERO form and stays: the design file uses the full
   * word beside 34–40px figures and the abbreviation beside 17–22px ones, and
   * it does so 21 times out of 21 with no exception. That size-class rule is
   * REAL but UNSTATED — HANDOFF gives only «AR ج.م · EN E£», which read
   * literally would put the abbreviation on the hero, something the design file
   * (the higher authority) never does. Both forms are needed; neither replaces
   * the other.
   *
   * ⚠️ The SIZE this renders at is still the app's, not the design's. The design
   * sets inline units at 13px; `unitSize()` floors at `TYPE.label` (15) under
   * ruling 5 — «a 12px unit in front of a 70-year-old is the ratio defeating
   * the scale». Hero and display units already match the design exactly (22 and
   * 19); only the floored sizes differ. Lowering a senior floor is an Owner
   * ruling, not an implementation detail, so it is NOT taken here.
   */
  currencyShort: 'E£',
  // ——— travel mode (A4): the currency is named in the log button.
  // Always a STRING, for the same reason as the Arabic: an unmapped code
  // renders as itself rather than as whatever type it arrived as.
  currencyName: (c) => String(({
    EGP: 'EGP', EUR: 'EUR', SEK: 'SEK', NOK: 'NOK', USD: 'USD', GBP: 'GBP',
  }[c]) || c || ''),
  entryCurrency: 'Currency',
  // The button names the currency it switches TO, never the one you are in —
  // the same rule as the language toggle.
  currencyIn: (c) => (c === 'EGP' ? 'In EGP' : 'In EUR'),
  // The heading when there is no shortcut row — in travel mode (A4).
  entryTitleShort: 'New expense',
  // ——— dictation (A5): tap the keyboard's own mic and say it.
  dictateShort: '🎙 Say it',
  dictateTitle: 'Say the expense',
  dictateBody: 'Tap the microphone on your keyboard and say the amount and what it was — like "50 pounds coffee".',
  dictatePlaceholder: '50 coffee',
  dictateSend: 'Log it',
  dictateCancel: 'Cancel',
  dictateNeedText: 'Say or type the expense first',

  // ——— receipt
  receiptStart: '📷 Photograph the receipt',
  // The short form — it sits on the New screen's own label line, costing no
  // vertical space (M1).
  receiptShort: '📷 Receipt',
  receiptIntro: 'Photograph the receipt and we read the amount. Nothing is logged until you agree.',
  receiptReading: 'Reading the receipt…',
  receiptSlow: 'The network is slow. You can wait, or enter it yourself.',
  receiptEnterManually: 'Enter it myself',
  receiptRetake: 'Photograph again',
  receiptCancel: 'Cancel',

  receiptCheck: 'Check and confirm',
  receiptSaw: 'We read:',
  receiptAmount: 'Amount',
  receiptMerchant: 'Shop',
  receiptDate: 'Date',
  receiptCategory: 'Category',
  receiptFromLibrary: 'From photos',
  jobQueued: 'In line',
  jobReading: 'Reading…',
  jobReady: 'Ready — check it',
  // A verdict, not a card to confirm. It used to say "Ready — check it" and
  // there was nothing to check (R-receipts 4).
  jobNotReceipt: 'Not a receipt',
  /**
   * The refusal row's way INTO the full explanation (N1).
   *
   * This button used to be labelled with the verdict itself — the row said
   * «Not a receipt» and then offered a button saying «Not a receipt», which restated the status as
   * though it were an action and spent the card's one affordance saying nothing
   * new. Now that the status line carries the REASON, the button carries what
   * the status cannot fit: the paragraph on the detail screen that says what to
   * do about it.
   */
  jobWhy: 'See why',
  jobReadAgain: 'Read it again',
  /**
   * WHY A REFUSAL WAS A REFUSAL (06 §6 `not_expense_reason`). Returns null for
   * an absent or unrecognised reason so the caller falls back to the generic
   * body — a server that predates the field, or a reason the enum does not name,
   * must not produce an empty paragraph.
   */
  notExpenseReason: (r) => ({
    balance_screen: 'This looks like an account balance, not a purchase. Balances are not expenses — photograph the receipt or the payment confirmation instead.',
    pending_or_declined: 'This payment has not gone through yet, or it was declined. Nothing has left your account, so there is nothing to record.',
    incoming: 'This is money coming IN. This book records what you spent, so incoming transfers and refunds are left out on purpose.',
    menu_or_pricelist: 'This looks like a menu or a price list rather than a bill you paid.',
    other: null,
  }[r] || null),
  /**
   * THE SAME ENUM, AT ROW LENGTH (chunk N1).
   *
   * `notExpenseReason` above is the DETAIL screen's paragraph. This is the queue
   * ROW's version of the same fact: he scans the list, and «Not a receipt» is true of a
   * pending authorization, a balance screen, an incoming transfer and a menu
   * alike — so it distinguishes none of them and answers none of the questions
   * he actually has. For a pending payment the answer is that there is nothing
   * to record YET, which is a different instruction from every other member of
   * that set.
   *
   * Same null convention as its long twin: an unnamed reason returns null and
   * the caller keeps the generic label, because a refusal we cannot explain must
   * not be dressed in an explanation we invented.
   */
  jobNotExpense: (r) => ({
    balance_screen: 'A balance, not a purchase',
    pending_or_declined: 'Pending — not yet money',
    incoming: 'Money in, not an expense',
    menu_or_pricelist: 'A price list, not a bill',
    other: null,
  }[r] || null),
  jobDismissed: 'Closed',
  jobFailed: 'Did not work — try again',
  jobCapped: "That's today's limit — it continues tomorrow",
  jobsTitle: (n) => `${n} ${n === 1 ? 'photo' : 'photos'} in line`,
  jobRetry: 'Try again',
  jobsCapped: (n) => `${n} waiting for tomorrow`,
  // Every job card names itself: the shop once we have read one, the time it
  // was taken until then. "No name… that's terrible UX." — his words.
  jobPhotoAt: (time) => `Photo at ${time}`,
  // When the capture time cannot be read. No time beats an invented one.
  jobPhoto: 'Photo',
  jobThumbAlt: 'The photo',
  jobRemoveTitle: 'Remove this photo',
  receiptConfirm: '✓ Log it',
  receiptUnsure: "We're not sure about the marked fields — check them.",
  receiptNotReceipt: 'That photo is not a receipt',
  receiptNotReceiptBody: 'Try again in better light, or enter it yourself.',
  // The way OUT of the verdict — "I can't even go back" was the finding.
  // Taking either exit settles the job, so it never asks again.
  receiptVerdictClose: 'Close',
  receiptFailed: 'We cannot read the receipt. Enter it yourself.',
  receiptTooLarge: 'The photo is too large. Take another.',
  receiptNoQuota: "Today's attempts are used up. Enter it yourself.",
  receiptNotConfigured: 'Receipt reading is not switched on.',

  receiptCashSteer: 'Card purchases log themselves from the bank text',
  receiptDupSms: 'This purchase may already be logged from the bank text.',
  receiptDupPhoto: 'It looks like you photographed this receipt before.',
  // D18a — the strongest of the three: not a guess about a cache, an actual row
  // in his book, shown to him so he judges it rather than trusting us.
  receiptDupBook: 'Your book already has this:',
  receiptDupBookMore: (n) => `and ${n - 1} more like it that day`,
  // The date cell of some row that month cannot be read, so we cannot tell
  // whether it is this one. Said plainly; it never blocks anything.
  receiptDupUndated: 'One expense that month has no readable date — it may be this one.',
  receiptSaveAnyway: 'Log it anyway',

  receiptQueuedTitle: 'The photo is saved',
  receiptQueuedBody: 'No network right now. We read it as soon as it is back.',

  /**
   * ——— the captain's log. The first-officer register, in English: it reports,
   * it admits, it signs off. No advice, no comparison, nothing to act on.
   */
  logTitle: (month) => `${month}'s book — closed`,
  logCurrency: 'EGP',
  logUnpriced: (n) => `${n} ${n === 1 ? 'expense' : 'expenses'} with no price`,
  logUndated: (n) => `${n} with no clear day`,
  logTo: (initials) => `For Captain ${initials}`,
  // A8 was removed; this took its place — a fact from his own book, once a
  // month, asking nothing.
  logMostOften: (name, times) => `Most visited: ${name} — ${times} times`,
  logSignoff: 'Every pound has its line. All well, Captain.',
  logDismiss: 'Very good',

  // ——— summary
  periodToday: 'Today',
  periodWeek: 'Week',
  periodMonth: 'Month',
  periodYear: 'Year',
  // ——— The Book (M1): Today and Recent became one thing at four zooms.
  tabBook: 'Book',
  todayCount: (n) => `${n} ${n === 1 ? 'thing' : 'things'} today`,
  // Foreign money is counted on its own — never added into the EGP sum (D8).
  travelApart: 'on its own',
  /**
   * The LEADING form. `travelApart` above is a trailing modifier — it is
   * grammatical after its subject ("24.04 EUR — on its own") and ungrammatical
   * in front of one, where the foreign figure lives in the hero and never
   * enters the sentence. That reuse rendered "on its own · and with them 0 E£",
   * which is not a sentence in either language. One slot, one string.
   */
  travelApartLead: 'Counted on its own',

  // ═══ D20 — the statement review screen ═══
  batchCount: (n, total) => `${n} of ${total} will be logged`,
  batchAll: 'Select all',
  batchNone: 'Clear all',
  batchConfirm: (n) => `✓ Log ${n} ${n === 1 ? 'expense' : 'expenses'}`,
  batchNothing: 'Choose what to log',
  sortLabel: 'Sort',
  sortName: (k) => ({ date: 'Date', amount: 'Largest', name: 'Name' }[k] || String(k)),
  rowsLoading: 'Reading the month from your book…',
  rowsLoadFailed: 'Could not read this month right now — pull refresh to try again.',
  dupTitle: (n) => `${n} rows might be the same expense twice`,
  dupBody: 'Same day, same amount, same currency. That happens for real — two coffees in one day are two coffees — so this only points, it never decides.',
  dupTier: (t) => ({
    same: 'Same description',
    similar: 'Nearly the same description',
    different: 'Different descriptions — most likely two real purchases',
  }[t] || null),
  dupUnpriced: (n) => `${n} ${n === 1 ? 'row has' : 'rows have'} no amount, so ${n === 1 ? 'it was' : 'they were'} not compared.`,
  dupNoDescription: '(no description)',
  dupOpenSheet: 'Open the sheet to check them',
  // ═══ U4 — duplicate pairs in the Inbox (06 §3.9, Owner ruling 2026-08-27) ═══
  // «keep this» and «remove that» are the same decision from opposite ends;
  // the removed row goes to the Removed tab and the other one STAYS — said in
  // the words, never implied.
  dupPairTitle: 'Recorded twice?',
  dupPairBody: 'Two rows alike in the book. Choose which one to remove — the other stays as it is.',
  dupPairRemove: 'Remove this row',
  dupPairRemoved: "Removed — moved to the sheet's Removed tab",
  dupPairSurvives: 'and the other stays as it is ✓',
  dupPairFailed: 'It was not removed — try again',
  dupPairGone: 'That row is not in the sheet now — it may already be gone',
  // A door the server does not have yet — the voice button's own era: the
  // state is stated honestly, and no button posts into the void.
  dupNeedsEngine: "The book's engine needs its update first — until it does, review these in the sheet by hand",
  dupGroupBig: (n) => `${n} rows alike — more than a pair, so that review belongs in the sheet`,
  // ═══ U1 — the row edit sheet (06 §3.7; the VR case: booked Cash, was Card) ═══
  editOpen: 'Edit',
  editRowTitle: 'Edit the row',
  editDescription: 'Description',
  editSave: 'Save the change',
  editNothingChanged: 'Nothing changed yet',
  editDone: 'Changed in the sheet ✓',
  // The whole ROW moved — cardConflict is the category's sentence; this is the row's.
  editConflict: 'The row changed in the sheet',
  editConflictUse: "Show the sheet's row",
  editRefused: 'The sheet refused this change',
  editNotFound: 'Could not find the row in the sheet — refresh and look again',
  // No «will send when the network returns» here: nothing replays an edit yet,
  // so that promise would be a lie. The truth: it did not go — try again.
  editOffline: 'The network dropped — it never reached the sheet. Try again.',
  editBadAmount: 'The amount must be a number above zero',
  editBadDate: 'The date must be day/month/year',
  editNeedCurrency: 'Pick the currency with the amount',
  // The refusal names the month it protects — moving a row between months is
  // hand-work in the sheet (docs/09 §4).
  editDateLeavesMonth: (m) => `That date would move the row out of ${m} — moving a row between months happens in the sheet, by hand`,
  batchTooLarge: 'The server takes at most 40 rows per confirm — untick down to 40 and log the rest after.',
  batchOverCap: (n, max) => `${n} ticked — the most in one go is ${max}`,
  batchFailed: 'Could not reach the server — nothing was written. Your ticks are safe; try again.',
  batchSending: 'Logging…',
  batchDeclined: 'Declined — never left your account',
  batchIncoming: 'Money in — not an expense',
  batchPending: 'Still pending',
  batchRoundup: (n) => `Spare change${n ? ` · ${n} movements` : ''}`,
  batchUnclear: 'Could not read it',
  batchNeedCategory: '? category',
  batchDupBook: 'Already in your book',
  batchDupBookIntro: 'Your book already has this:',
  batchDupBatch: 'Same as the one above, in this photo',
  batchDupUnchecked: 'We could not check',
  batchSaveAnyway: 'Log it anyway',
  batchTruncated: (shown, total) => `Showing ${shown} of ${total} — the list is cut off. Photograph the rest.`,
  batchWritten: 'Logged',
  batchSkippedDup: 'Was already logged',
  /**
   * A REFUSAL IS NOT A REPLAY, AND THEY MUST NOT READ THE SAME.
   *
   * `duplicate` means the per-row idempotency key was already seen — WE wrote
   * that row on an earlier attempt, and «was already logged» is exactly true.
   * `book_duplicate` means the server found a matching row in his book and
   * WROTE NOTHING, pending his judgement. One is finished, the other is waiting
   * for him, and collapsing them into one sentence hides an expense that may be
   * real behind a word that says it is handled.
   */
  batchRefusedDup: 'Your book already has one like it — not logged',
  batchRetryPending: 'Will be logged anyway',
  batchErrored: 'Not logged',
  /**
   * NOT named `batchDone` — that key already exists lower in this SAME object
   * (the outbox flush toast), and in a literal the LAST definition silently
   * wins: the three-count header was being shadowed by the one-count toast and
   * rendered «undefined logged ✓» territory while every suite stayed green
   * (verification finding). The dedup check in test-i18n now makes a repeat
   * key a failure, so this class dies with this rename.
   */
  batchSettled: (w, s, e) => `${w} logged ✓${s ? ` · ${s} already there` : ''}${e ? ` · ${e} had trouble` : ''}`,
  batchBack: 'Done — back to the book',
  batchExpired: 'This photo has gone stale — take it again and we will restore your choices',
  batchResnap: '📷 Photograph it again',
  batchDiscard: 'Discard this review',
  /**
   * LEAVING AND DISCARDING ARE DIFFERENT ACTS, and one button used to do both.
   * After a settle the only control was «Done — back to the book», and it
   * DESTROYED the draft — including rows the server had refused and never
   * written. Leaving keeps them; discarding says out loud what it throws away.
   */
  batchLeave: 'Leave it for now',
  batchDiscardWaiting: (n) => `Discard — and with it ${n} ${n === 1 ? 'expense' : 'expenses'} that never reached the book`,
  batchWaiting: (n) => `${n} ${n === 1 ? 'expense' : 'expenses'} not logged yet`,

  // ——— foreign money inside a period: the EGP figure is not the whole period.
  andAlso: 'and with them',
  /**
   * No comparison exists for a unit we have no history in (D23, chunk N1b).
   * The percentage is computed from the EGP series; under a euro headline it
   * would be a confident claim about the ASIDE, read as being about the figure
   * it sits beneath. Said rather than silently dropped — a suppressed
   * comparison that explains itself is the house rule.
   */
  chartUnit: (cur) => `in ${cur}`,
  readInUnit: (cur) => `Read in ${cur}`,
  noCompareInUnit: (cur) => `No ${cur} history to compare against yet`,
  foreignNoCompare: 'This period has foreign spending — an EGP-only comparison would not be true',
  foreignUnsized: (n) => `and ${n} foreign ${n === 1 ? 'expense' : 'expenses'} with no price`,
  /**
   * ——— A7: the foreign-money essay, compressed to ONE line. Every rule that
   * suppresses a comparison (foreign money in the period, a lead unit with no
   * history) used to state its own sentence; this line replaces the stack and
   * the full sentences render only behind its tap. It names neither rule on
   * purpose — it is true under each, and the detail is one tap away.
   */
  whyNoCompare: 'No comparison here — see why',
  /**
   * ——— A7: sections carry NAMES instead of stacked prose (north-star §5:
   * «This month», «By method», «Against July»). `sectionAgainst` takes the
   * LOCALIZED period name it compares against; `sectionByMethod` heads the
   * method cards. Consumers: BookView's Month screen (Against), Charts.jsx's
   * PeriodSummary (By method).
   */
  sectionAgainst: (prev) => `Against ${prev}`,
  sectionByMethod: 'By method',
  // A row with no category is a door wherever it appears (M6).
  rowNeedsCategory: '? tap to file',
  // A2: filed from the merchant memory — he never chose it.
  rowAuto: '· by itself',
  rowAutoTitle: 'This category came from memory, not from you — tap to change it',
  todayNeedCategory: (n) => `${n} ${n === 1 ? 'expense' : 'expenses'} with no category — tap to file them`,
  // The one sentence the week and month lead with (M5).
  lessThan: (prev) => `Less than ${prev} by`,
  moreThan: (prev) => `More than ${prev} by`,
  sameAs: (prev) => `The same as ${prev}`,
  /**
   * ——— E7: the head's words — an observation, never a verdict. «Lighter than
   * July» states what happened and stops: no praise, no blame, no advice
   * (north-star §6.2: we may state «lighter than your usual week» as fact; we
   * may never praise, blame, or advise). The template takes the name of the
   * period the comparison was ACTUALLY computed against — and «than your
   * usual» is deliberately absent: that phrasing is not earned until E6's
   * typical band wires into the head, and BookView's builder refuses it
   * until it is.
   */
  headLighter: (prev) => `Lighter than ${prev}`,
  headHeavier: (prev) => `Heavier than ${prev}`,
  wasThen: 'was',
  /**
   * ——— A4: a method card's prev figure, IN WORDS. A naked «0» under the hero
   * reads as an answer about now; «was 0 — last week» reads as the fact it
   * is. Takes the amount ALREADY FORMATTED (money/moneyRound — this template
   * never invents digits) and the localized period name the header names.
   */
  prevWorded: (amount, prevName) => `was ${amount} — ${prevName}`,
  todayEmptyTitle: 'Nothing logged today yet',
  todayEmptyBody: 'Confirm from the Inbox, or add a new expense.',

  thisWeek: 'This week',
  lastWeek: 'Last week',

  // Short enough for a third of 375px — it used to render as "All expen…",
  // an ellipsis on the label of the app's most important figure (finding S6b).
  metricAll: 'All',
  metricVisa: 'Card',
  metricCash: 'Cash',

  vs: 'vs',
  avg: 'average',
  // Keypad backspace — an aria-label, spoken not seen (A9 residual).
  keypadBackspace: 'Delete',
  // W1 — the chart never draws a zero it does not mean: the true sentence in its place (must contain chartUnit verbatim).
  chartHomeZero: (cur) => `Nothing in ${cur} this period — this chart counts in ${cur} only`,
  noComparison: (prev) => `No data for ${prev} to compare against.`,
  // A period with one point has no shape to draw — the figure stands, the
  // chart waits (M7).
  periodJustStarted: (cur) => `${cur} has only just started — the chart appears after another day.`,

  // Rows whose date cell in his sheet is unreadable. Said plainly, not hidden.
  undatedNote: (n) => `${n} ${n === 1 ? 'expense' : 'expenses'} with no clear day — counted in the month total but not in the chart`,

  // Rows written down but never priced. The total is knowably short, so it must
  // not be presented as if it were complete.
  unpricedNote: (n) => `${n} ${n === 1 ? 'expense' : 'expenses'} with no amount — this total is lower than the truth`,

  // ——— connection / write states
  // ——— the Recent tab (D16). His own rows, and one tap to fix any of them.
  recentMonths: 'Months',
  recentEmpty: 'No expenses in this period',
  recentUndatedNote: (n) => `${n} ${n === 1 ? 'expense' : 'expenses'} with no clear day — they show under Month only`,

  // ——— month accountability (D16d). Every gap on the screen has a name.
  uncategorizedLine: 'Uncategorised ?',
  uncategorizedHint: 'tap to categorise',
  monthTotalLine: 'Month total',

  /**
   * ——— THE PRIORITIES LENS: it states, and never advises.
   *
   * These names are presentation only — categories are the permanent layer, and
   * this map can be re-drawn at any time without touching a single stored value.
   */
  lensTitle: 'By priority',
  lensGroup: (key) => ({
    essentials: 'Essentials',
    health: 'Health',
    joy: 'Joy',
    projects: 'Projects',
  }[key] || String(key)),
  lensRemainder: 'Everything else',

  /**
   * ——— N7: the priority chips over the Book list — the count is a sentence,
   * never a naked badge. Takes the group name exactly as `lensGroup` says it;
   * there is no second copy of those names.
   */
  priorityCount: (n, group) => `${n} ${n === 1 ? 'expense' : 'expenses'} in «${group}»`,
  /**
   * ——— N7: an emptied filter names its own zero («History: 0» style). The
   * generic empty line would claim the PERIOD is empty — it is not; only the
   * filter is. An empty list is a sentence, never a blank.
   */
  priorityEmpty: (group) => `«${group}»: 0 — no expenses of this kind in this period`,

  /**
   * ——— E3: the month's sentence names its window. The comparison is taken at
   * the SAME POINT (prevAt), so «less than July» on the 24th really means
   * «days 1–24 vs July 1–24» — the words now say what the arithmetic did.
   * The second form covers a shorter previous month (February): its whole
   * self is inside the window.
   */
  windowWords: (days, prev) => `days 1–${days} vs ${prev} 1–${days}`,
  windowWordsWholePrev: (days, prev) => `days 1–${days} vs all of ${prev}`,

  // ——— N6: the month picker sheet — the month heading became a door.
  monthPickerTitle: 'Choose the month',
  monthPickerClose: 'Close',

  // ——— the sheet itself, one tap away (A7). The whole promise is that his
  // book is untouched; this is what lets him check rather than take our word.
  openTheSheet: 'Open the sheet ↗',


  // ——— the sheet's address, on the setup screen (A7) — optional.
  setupSheet: 'Sheet link (optional)',
  setupSheetHint: 'Shows the "Open the sheet" button. Leave it empty and no button appears.',

  // ——— the manual refresh (D16c). A BUTTON, never a gesture.
  refresh: 'Refresh',
  refreshing: 'Refreshing…',
  refreshFailed: 'Could not refresh — try again',

  /**
   * ——— S1: the settings sheet behind the cog (Owner ruling 2026-08-27).
   * `settingsTitle` names the cog AND the sheet — one concept, one string
   * (A8's law). The quiet note under the currency control says plainly what
   * the control does, because this is the only place its meaning is stated.
   */
  settingsTitle: 'Settings',
  settingsClose: 'Close',
  settingsLangCurrency: 'Currency & language',
  settingsLanguage: 'Language',
  settingsCurrency: 'Currency',
  settingsCurrencyNote: "Chooses which unit leads the Book's figures — nothing is converted; each currency keeps its own numbers.",

  offline: 'No network — this is the last saved data',
  lastUpdated: 'Last updated',
  saving: 'Saving…',
  saved: 'Logged ✓',
  // The batch's result (M4). Each card still states its own outcome; these
  // summarise the run.
  batchDone: (n) => `${n} logged ✓`,
  batchPartly: (ok, bad) => `${ok} logged · ${bad} need a look`,
  alreadyFixed: 'Already logged ✓',
  queued: 'Will log when the network is back',
  genericError: 'Something went wrong. Try again',
  crashTitle: 'Something stopped',
  crashBody: 'Nothing was lost — every expense is in the sheet as it was. Open it again.',
  crashRetry: 'Open again',

  // ——— outbox
  outboxStaleTitle: 'Still saved — log it?',
  outboxStaleNote: "This was saved here a while ago and we are not sure it arrived. If you cannot find it in the sheet, tap log.",
  outboxSend: 'Log it',
  outboxDrop: 'Discard it',

  // ——— setup
  setupTitle: 'Set up Masareef',
  setupBody: 'Paste the deployment URL (/exec) and the secret. They are stored on this device only, and never sent in any link.',
  setupUrl: '/exec URL',
  setupSecret: 'Secret',
  setupTest: 'Test the connection',
  setupTesting: 'Testing…',
  setupNeedBoth: 'Both the URL and the secret are needed',
  setupBadSecret: 'Wrong secret',
  setupUnreachable: 'Cannot reach it. Check the URL ends in /exec and the deployment is set to Anyone.',
};

/**
 * HIS CATEGORIES, IN ENGLISH — which is to say, unchanged.
 *
 * The Arabic locale maps each frozen value to an Arabic label (finding M2). In
 * English the label IS the value: these are the strings on his own rows, and
 * this install belongs to Tarek, who reads them as written.
 *
 * It exists so the two locales have the same SHAPE. A `categoryLabel` that
 * existed in one file and not the other would render `undefined` on every chip
 * in this app — which is precisely what test-i18n compares key sets to prevent.
 */
const categoryLabel = (c) => (typeof c === 'string' ? c : '');

// The server returns English month names (they mirror his tab names), so in
// English they pass straight through — the lookup exists so that an UNMAPPED
// name still renders as itself rather than blanking.
const monthName = (name) => name || '';

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MONTH_LABELS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/**
 * `prevLog.name` is his TAB name — opaque, echoed, never parsed. In English the
 * three-letter tab is already readable, so it passes through; the map exists so
 * the two locales have the same shape and the same fall-through behaviour.
 */
const MONTH_BY_TAB = {
  Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April',
  May: 'May', Jun: 'June', Jul: 'July', Aug: 'August',
  Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December',
};

const CAPTAIN_INITIALS = 'A.O.';

export const EN_LOCALE = {
  dir: 'ltr',
  lang: 'en',
  S: EN,
  monthName,
  monthByTab: (t) => (typeof t === 'string' ? (MONTH_BY_TAB[t.trim()] || t) : ''),
  categoryLabel,
  WEEK_DAYS,
  MONTH_LABELS,
  CAPTAIN_INITIALS,
  // The toggle's own label, always shown in the language it switches TO.
  switchTo: 'عربي',
};
