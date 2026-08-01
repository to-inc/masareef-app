/**
 * Egyptian Arabic UI strings — the dialect he actually speaks, not MSA.
 *
 * Rules that shaped this file:
 *  - One sentence, one action. No jargon, no error codes, never a red modal.
 *  - Nothing scolds him and nothing nags. There are no streaks here.
 *  - Category names are NEVER translated — they are the frozen sheet schema and
 *    must round-trip byte-identical. They render as Latin inside RTL text via
 *    `unicode-bidi: isolate` (see Chip / category buttons).
 *  - Numbers are always Western digits (see lib/format.js).
 */
export const S = {
  appName: 'مصاريف',

  // ——— tabs
  tabInbox: 'الوارد',
  tabCash: 'كاش',
  tabReceipt: 'فاتورة',
  tabSummary: 'اليوم',

  // ——— inbox
  inboxEmptyTitle: 'كله متسجّل',
  inboxEmptyBody: 'أي شراء بالفيزا هيظهر هنا أول ما البنك يبعت الرسالة.',
  inboxWaiting: (n) => `${n} ${n === 1 ? 'عملية مستنية' : 'عمليات مستنية'} — دوس على النوع عشان يتسجل`,
  inboxOriginal: 'الرسالة الأصلية',
  // Months-old rows live behind one card so today's two purchases aren't buried
  // under forty of them. Nothing is hidden — it opens on a tap.
  inboxOldTitle: (n) => `مصاريف قديمة (${n})`,
  inboxOldBody: 'من شهور فاتت — لسه من غير نوع.',
  inboxOldOpen: 'افتحها',
  inboxOldHide: 'اقفلها',
  more: 'أنواع تانية…',
  travel: '✈ سفر',

  // ——— cash
  cashTitle: 'مصروف كاش — المبلغ الأول، وبعدين النوع',
  cashLog: 'سجّل الكاش',
  currency: 'جنيه',

  // ——— receipt
  receiptStart: '📷 صوّر الفاتورة',
  receiptIntro: 'صوّر الفاتورة وهنقرا المبلغ لوحدنا. مش هيتسجل حاجة غير لما توافق.',
  receiptReading: 'بنقرا الفاتورة…',
  receiptSlow: 'الشبكة بطيئة شوية. تقدر تستنى أو تسجّلها بنفسك.',
  receiptEnterManually: 'أسجّلها بنفسي',
  receiptRetake: 'صوّر تاني',
  receiptCancel: 'إلغاء',

  receiptCheck: 'راجع وأكّد',
  receiptSaw: 'شفنا:',           // precedes raw_total_line, verbatim from the receipt
  receiptAmount: 'المبلغ',
  receiptMerchant: 'المحل',
  receiptDate: 'التاريخ',
  receiptCategory: 'النوع',
  receiptFromLibrary: 'من الصور',
  // WS4-Q — job stages. Words, never percentages: extraction is one opaque call
  // and a progress bar would be a number we invented (honest-render law).
  jobQueued: 'في الدور',
  jobReading: 'بيتقرا…',
  jobReady: 'جاهز — راجعه',
  jobFailed: 'محصلش — جرّب تاني',
  jobCapped: 'وصلنا حد النهاردة — هيكمل بكرة',
  jobsTitle: (n) => `${n} ${n === 1 ? 'صورة' : 'صور'} في الدور`,
  jobRetry: 'جرّب تاني',
  jobsCapped: (n) => `${n} مستنيين حد بكرة`,
  receiptConfirm: '✓ سجّلها',
  receiptUnsure: 'مش متأكدين من اللي عليه علامة — راجعه.',
  receiptNotReceipt: 'الصورة دي مش فاتورة',
  receiptNotReceiptBody: 'جرّب تصوّرها تاني في نور أحسن، أو سجّلها بنفسك.',
  receiptFailed: 'مش قادرين نقرا الفاتورة. سجّلها بنفسك.',
  receiptTooLarge: 'الصورة كبيرة أوي. صوّر تاني.',
  receiptNoQuota: 'خلصت محاولات النهاردة. سجّلها بنفسك.',
  receiptNotConfigured: 'قراءة الفواتير مش مفعّلة.',

  // Receipts default to Cash because the SMS automation already logs every card
  // purchase — this steer is what stops the same expense being counted twice.
  receiptCashSteer: 'الفيزا بتتسجل لوحدها من رسالة البنك',
  receiptDupSms: 'الشراء ده يمكن اتسجل خلاص من رسالة البنك.',
  receiptDupPhoto: 'يظهر إنك صوّرت الفاتورة دي قبل كده.',
  receiptSaveAnyway: 'سجّلها برضه',

  receiptQueuedTitle: 'الصورة اتحفظت',
  receiptQueuedBody: 'مفيش نت دلوقتي. هنقراها أول ما النت يرجع.',
  receiptQueuedCount: (n) => `${n} ${n === 1 ? 'فاتورة محفوظة' : 'فواتير محفوظة'}`,
  receiptStaleTitle: 'فاتورة من فترة',
  receiptStaleBody: 'دي اتصورت من زمان. تحب نقراها دلوقتي؟',
  receiptReadNow: 'اقراها',
  receiptDiscard: 'امسحها',

  // ——— summary
  periodToday: 'النهاردة',
  periodWeek: 'الأسبوع',
  periodMonth: 'الشهر',
  periodYear: 'السنة',
  todayTitle: 'مصاريف النهاردة — زي ما هي في الشيت بالظبط',
  todayEmptyTitle: 'لسه مفيش حاجة اتسجلت النهاردة',
  todayEmptyBody: 'أكّد العمليات من الوارد، أو سجّل كاش.',
  colDate: 'التاريخ',
  colDesc: 'البيان',
  colMethod: 'كاش/فيزا',
  colCategory: 'النوع',
  colAmount: 'المبلغ',

  thisWeek: 'الأسبوع ده',
  lastWeek: 'الأسبوع اللي فات',
  unitWeek: 'الأسبوع',
  unitMonth: 'الشهر',
  unitYear: 'السنة',

  metricAll: 'كل المصاريف',
  metricVisa: 'فيزا',
  metricCash: 'كاش',

  vs: 'مقابل',
  cumulativeNote: 'تراكمي · ● = نفس النقطة',
  avg: 'متوسط',
  // Shown when there is nothing to compare against — better than describing a
  // grey line he cannot see.
  noComparison: (prev) => `مفيش بيانات لـ${prev} للمقارنة.`,

  comparisonHelp: (prev, unit) =>
    `الرمادي هو ${prev}، والنقطة الرمادية مكانه في نفس التوقيت — مقارنة عادلة حتى في نص ${unit}. دوس على أي كارت عشان تبدّل الرسم.`,

  // Rows whose date cell in his sheet is unreadable (10/210/2, 221, 31/0).
  // They count in the month total but belong to no day, so the chart cannot show
  // them. Said plainly rather than hidden.
  undatedNote: (n) => `${n} ${n === 1 ? 'مصروف' : 'مصاريف'} من غير يوم واضح — داخلة في إجمالي الشهر بس مش في الرسم`,

  // Rows he wrote down but never priced. The month total is knowably short, so
  // it must not be presented as if it were complete.
  unpricedNote: (n) => `${n} ${n === 1 ? 'مصروف' : 'مصاريف'} من غير مبلغ — الإجمالي ده أقل من الحقيقة`,

  // ——— connection / write states
  offline: 'مفيش نت — دي آخر بيانات محفوظة',
  lastUpdated: 'آخر تحديث',
  saving: 'جارٍ الحفظ…',
  saved: 'اتسجل ✓',
  alreadyFixed: 'اتسجّلت خلاص ✓',
  queued: 'هيتسجّل أول ما النت يرجع',
  genericError: 'حصلت مشكلة. جرّب تاني',
  crashTitle: 'في حاجة وقفت',
  crashBody: 'مفيش أي حاجة ضاعت — كل المصاريف في الشيت زي ما هي. افتح تاني.',
  crashRetry: 'افتح تاني',

  // ——— outbox
  // Anything older than 6 h has outlived the server's dedupe window, so sending
  // it again could double-write. He decides, we never decide for him.
  outboxStaleTitle: 'لسه محفوظة — تسجلها؟',
  outboxStaleNote: 'دي اتسجلت عندنا من فترة ومش متأكدين وصلت ولا لأ. لو مش لاقيها في الشيت، دوس تسجيل.',
  outboxSend: 'سجّلها',
  outboxDrop: 'امسحها',
  outboxPending: (n) => `${n} ${n === 1 ? 'عملية' : 'عمليات'} مستنية النت`,

  // ——— setup (Tarek-facing, appears only when there are no credentials)
  setupTitle: 'إعداد مصاريف',
  setupBody: 'الصق رابط النشر (/exec) والكلمة السرية. بيتخزنوا على الجهاز ده بس، ومش بيتبعتوا في أي رابط.',
  setupUrl: 'رابط /exec',
  setupSecret: 'الكلمة السرية',
  setupTest: 'اختبار الاتصال',
  setupTesting: 'بنجرّب…',
  setupNeedBoth: 'محتاج الرابط والكلمة السرية',
  setupBadSecret: 'الكلمة السرية غلط',
  setupUnreachable: 'مش قادر يوصل. اتأكد إن الرابط بينتهي بـ /exec وإن النشر Anyone.',
};

// The server returns English month names (they mirror his tab names). Shown in
// Arabic; anything unmapped falls through unchanged rather than blanking.
const MONTHS_AR = {
  January: 'يناير', February: 'فبراير', March: 'مارس', April: 'أبريل',
  May: 'مايو', June: 'يونيو', July: 'يوليو', August: 'أغسطس',
  September: 'سبتمبر', October: 'أكتوبر', November: 'نوفمبر', December: 'ديسمبر',
};

export const monthAr = (name) => MONTHS_AR[name] || name || '';

// Sun-first, matching the server's week windows and Egyptian convention.
export const WEEK_DAYS_AR = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

export const MONTH_LABELS_AR = ['ي', 'ف', 'م', 'أ', 'م', 'ي', 'ي', 'أ', 'س', 'أ', 'ن', 'د'];
