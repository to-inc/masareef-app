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
  tabInbox: 'Inbox',
  // Not "Cash" any more — the screen behind it takes either method (R-receipts 1).
  tabEntry: 'New',
  tabReceipt: 'Receipt',
  tabSummary: 'Today',
  tabRecent: 'Recent',

  // ——— inbox
  inboxEmptyTitle: 'All logged',
  inboxEmptyBody: 'Any card purchase shows up here as soon as the bank texts.',
  inboxWaiting: (n) => `${n} ${n === 1 ? 'purchase' : 'purchases'} waiting — tap a category to log it`,
  inboxOriginal: 'The original row',
  inboxOldTitle: (n) => `Older expenses (${n})`,
  inboxOldBody: 'From previous months — still without a category.',
  inboxOldOpen: 'Open',
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
  // ——— travel mode (A4): the currency is named in the log button.
  // Always a STRING, for the same reason as the Arabic: an unmapped code
  // renders as itself rather than as whatever type it arrived as.
  currencyName: (c) => String(({
    EGP: 'EGP', EUR: 'EUR', SEK: 'SEK', NOK: 'NOK', USD: 'USD', GBP: 'GBP',
  }[c]) || c || ''),
  entryCurrency: 'Currency',
  // The button names the currency it switches TO, never the one you are in —
  // the same rule as the language toggle.
  currencySwitchTo: (c) => (c === 'EGP' ? 'In EGP' : 'In EUR'),
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
  jobRemove: 'Remove',
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
  receiptQueuedCount: (n) => `${n} ${n === 1 ? 'receipt saved' : 'receipts saved'}`,
  receiptStaleTitle: 'A receipt from a while ago',
  receiptStaleBody: 'This was photographed some time back. Read it now?',
  receiptReadNow: 'Read it',
  receiptDiscard: 'Discard it',

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
  wasThen: 'was',
  todayTitle: "Today's expenses — exactly as they sit in the sheet",
  todayEmptyTitle: 'Nothing logged today yet',
  todayEmptyBody: 'Confirm from the Inbox, or add a new expense.',
  colDate: 'Date',
  colDesc: 'Description',
  colMethod: 'Cash/Card',
  colCategory: 'Category',
  colAmount: 'Amount',

  thisWeek: 'This week',
  lastWeek: 'Last week',
  unitWeek: 'the week',
  unitMonth: 'the month',
  unitYear: 'the year',

  // Short enough for a third of 375px — it used to render as "All expen…",
  // an ellipsis on the label of the app's most important figure (finding S6b).
  metricAll: 'All',
  metricVisa: 'Card',
  metricCash: 'Cash',

  vs: 'vs',
  cumulativeNote: 'cumulative · ● = same point',
  avg: 'average',
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
  recentEdit: 'Change category',

  // ——— month accountability (D16d). Every gap on the screen has a name.
  uncategorizedLine: 'Uncategorised ?',
  uncategorizedHint: 'tap to categorise',
  monthTotalLine: 'Month total',

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
  outboxPending: (n) => `${n} ${n === 1 ? 'entry' : 'entries'} waiting for the network`,

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
