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
  tabCash: 'Cash',
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

  // ——— cash
  cashTitle: 'Cash expense — amount first, then the category',
  cashLog: 'Log the cash',
  currency: 'EGP',

  // ——— receipt
  receiptStart: '📷 Photograph the receipt',
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
  jobFailed: 'Did not work — try again',
  jobCapped: "That's today's limit — it continues tomorrow",
  jobsTitle: (n) => `${n} ${n === 1 ? 'photo' : 'photos'} in line`,
  jobRetry: 'Try again',
  jobsCapped: (n) => `${n} waiting for tomorrow`,
  receiptConfirm: '✓ Log it',
  receiptUnsure: "We're not sure about the marked fields — check them.",
  receiptNotReceipt: 'That photo is not a receipt',
  receiptNotReceiptBody: 'Try again in better light, or enter it yourself.',
  receiptFailed: 'We cannot read the receipt. Enter it yourself.',
  receiptTooLarge: 'The photo is too large. Take another.',
  receiptNoQuota: "Today's attempts are used up. Enter it yourself.",
  receiptNotConfigured: 'Receipt reading is not switched on.',

  receiptCashSteer: 'Card purchases log themselves from the bank text',
  receiptDupSms: 'This purchase may already be logged from the bank text.',
  receiptDupPhoto: 'It looks like you photographed this receipt before.',
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
  logSignoff: 'Every pound has its line. All well, Captain.',
  logDismiss: 'Very good',

  // ——— summary
  periodToday: 'Today',
  periodWeek: 'Week',
  periodMonth: 'Month',
  periodYear: 'Year',
  todayTitle: "Today's expenses — exactly as they sit in the sheet",
  todayEmptyTitle: 'Nothing logged today yet',
  todayEmptyBody: 'Confirm from the Inbox, or log some cash.',
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

  metricAll: 'All expenses',
  metricVisa: 'Card',
  metricCash: 'Cash',

  vs: 'vs',
  cumulativeNote: 'cumulative · ● = same point',
  avg: 'average',
  noComparison: (prev) => `No data for ${prev} to compare against.`,

  comparisonHelp: (prev, unit) =>
    `Grey is ${prev}, and the grey dot is where it stood at this same point — a fair comparison even halfway through ${unit}. Tap any card to recolour the chart.`,

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

  // ——— the manual refresh (D16c). A BUTTON, never a gesture.
  refresh: 'Refresh',
  refreshing: 'Refreshing…',
  refreshFailed: 'Could not refresh — try again',

  offline: 'No network — this is the last saved data',
  lastUpdated: 'Last updated',
  saving: 'Saving…',
  saved: 'Logged ✓',
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
  WEEK_DAYS,
  MONTH_LABELS,
  CAPTAIN_INITIALS,
  // The toggle's own label, always shown in the language it switches TO.
  switchTo: 'عربي',
};
