/**
 * Egyptian Arabic UI strings — the dialect he actually speaks, not MSA.
 *
 * THE DEFAULT, and that is CLAUDE.md #6 rather than a preference: this app is
 * for one man in Cairo who reads Arabic. `strings.en.js` is the same key set for
 * Tarek's own install; `strings.js` picks between them. A key that exists here
 * and not there renders `undefined` at whoever is reading — which is why
 * scripts/test-i18n.mjs compares the two key sets rather than trusting anyone to
 * remember.
 *
 * Rules that shaped this file:
 *  - One sentence, one action. No jargon, no error codes, never a red modal.
 *  - Nothing scolds him and nothing nags. There are no streaks here.
 *  - Category names are NEVER translated — they are the frozen sheet schema and
 *    must round-trip byte-identical. They render as Latin inside RTL text via
 *    `unicode-bidi: isolate` (see Chip / category buttons).
 *  - Numbers are always Western digits (see lib/format.js).
 */
export const AR = {
  appName: 'مصاريف',

  // ——— tabs
  tabInbox: 'الوارد',
  // مش «كاش» تاني — الشاشة اللي وراه بتاخد كاش أو فيزا (R-receipts 1).
  tabEntry: 'جديد',
  tabReceipt: 'فاتورة',
  tabSummary: 'اليوم',
  tabRecent: 'الأخير',

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
  // الزرار اللي بيقفل الصفوف اللي إحنا عارفينها كلها مرة واحدة (M4).
  inboxBatch: (n) => `سجّل الـ${n} اللي عارفينهم`,
  travel: '✈ سفر',

  // ——— what happened to a card he tapped (WS3-C, 2026-08-03).
  // Every one of these is the SERVER's answer, never the tap. The category name
  // is rendered separately, in a Latin-isolated span, so it never joins an
  // Arabic sentence and comes out reordered.
  inboxAllDone: 'كله اتسجل ✓',
  cardSaving: 'بيتسجل…',
  cardDone: 'اتسجل ✓',
  cardAlready: 'اتسجّلت خلاص ✓',
  // He fixed this row in the sheet himself while it sat in the Inbox. We say
  // what the sheet says now — his edit wins, and he can still change it here.
  cardConflict: 'النوع اتغير في الشيت',
  cardConflictIs: 'دلوقتي:',
  cardFailed: 'مااتسجلش — دوس على النوع تاني',
  cardQueued: 'هيتسجّل أول ما النت يرجع',

  // ——— المصروف اليدوي (كاش أو فيزا — شوف state/entryPayload.js)
  // العنوان القديم «مصروف جديد — المبلغ، وبعدين النوع» اتشال: الزرار المثبّت
  // تحت بقى بيقول الخطوة الناقصة بنفسه، والترتيب على الشاشة اتغيّر (S1/S2).
  // قصيرة عن قصد: السطر ده بيشارك مكانه مع تلات زراير (صوت/عملة/فاتورة)،
  // والعنوان الطويل كان بيلفّ لسطرين ويدفع أنواع المصاريف تحت الطيّة.
  entryRepeats: 'زي قبل كده',
  entryLog: 'سجّل',
  // الزرار المثبّت بيسمّي الخطوة الناقصة بدل ما يبقى رمادي وبس (S1).
  entryNeedAmount: 'اكتب المبلغ',
  entryNeedCategory: 'اختار النوع',
  // اسم المجموعة لقارئ الشاشة. دول اللي بيقراهم؛ القيمة اللي بتتبعت
  // 'Cash' و 'Visa' ومفيش طريق تخلي الكلمة دي تبقى قيمة.
  entryMethod: 'الدفع كان إزاي',
  methodCash: 'كاش',
  methodCard: 'فيزا',
  currency: 'جنيه',
  // ——— وضع السفر (A4): العملة بتتقال بالاسم في زرار التسجيل.
  // Always a STRING — an unmapped code renders as itself rather than as
  // whatever type it arrived as. A currency chip is a button he has to read.
  currencyName: (c) => String(({
    EGP: 'جنيه', EUR: 'يورو', SEK: 'كرونة', NOK: 'كرونة نرويجي',
    USD: 'دولار', GBP: 'جنيه إسترليني',
  }[c]) || c || ''),
  entryCurrency: 'العملة',
  // الزرار بيقول العملة اللي هيحوّل ليها، مش اللي إنت فيها — زي زرار اللغة.
  currencyIn: (c) => (c === 'EGP' ? 'بالجنيه' : 'باليورو'),
  // العنوان لما مفيش صف اختصارات — في وضع السفر (A4).
  entryTitleShort: 'مصروف جديد',
  // ——— الإملاء (A5): دوس على الميكروفون بتاع الكيبورد وقول المبلغ والحاجة.
  dictateShort: '🎙 بالصوت',
  dictateTitle: 'قول المصروف',
  dictateBody: 'دوس على الميكروفون في الكيبورد وقول المبلغ والحاجة — زي «٥٠ جنيه قهوة».',
  dictatePlaceholder: '٥٠ جنيه قهوة',
  dictateSend: 'سجّل',
  dictateCancel: 'إلغاء',
  dictateNeedText: 'اكتب أو قول المصروف الأول',

  // ——— receipt
  receiptStart: '📷 صوّر الفاتورة',
  // النسخة القصيرة — بتقعد جنب عنوان شاشة «جديد» من غير ما تاخد سطر (M1).
  receiptShort: '📷 فاتورة',
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
  // حكم، مش كارت تأكيد. قبل كده كان بيقول «جاهز — راجعه» ومفيش حاجة تتراجع
  // (R-receipts 4).
  jobReadAgain: 'اقرأها تاني',
  notExpenseReason: (r) => ({
    balance_screen: 'دي شاشة رصيد مش عملية شرا. الرصيد مش مصروف — صوّر الفاتورة أو تأكيد الدفع.',
    pending_or_declined: 'الدفعة دي لسه ما تمتش أو اترفضت. مفيش فلوس خرجت، يبقى مفيش حاجة تتسجل.',
    incoming: 'دي فلوس داخلة. الدفتر ده بيسجل اللي اتصرف، فالتحويلات الواردة بتتساب بره عن قصد.',
    menu_or_pricelist: 'دي تبدو منيو أو قايمة أسعار مش فاتورة اتدفعت.',
    other: null,
  }[r] || null),
  jobNotReceipt: 'مش فاتورة',
  jobDismissed: 'اتقفلت',
  jobFailed: 'محصلش — جرّب تاني',
  jobCapped: 'وصلنا حد النهاردة — هيكمل بكرة',
  jobsTitle: (n) => `${n} ${n === 1 ? 'صورة' : 'صور'} في الدور`,
  jobRetry: 'جرّب تاني',
  jobsCapped: (n) => `${n} مستنيين حد بكرة`,
  // كل صورة بتقول هي إيه: اسم المحل لما نقراه، ووقت التصوير لحد ما نقراه.
  jobPhotoAt: (time) => `صورة الساعة ${time}`,
  // لما وقت التصوير مايتقراش. مفيش وقت أحسن من وقت مخترع.
  jobPhoto: 'صورة',
  jobThumbAlt: 'الصورة',
  jobRemove: 'شيلها',
  jobRemoveTitle: 'شيل الصورة دي',
  receiptConfirm: '✓ سجّلها',
  receiptUnsure: 'مش متأكدين من اللي عليه علامة — راجعه.',
  receiptNotReceipt: 'الصورة دي مش فاتورة',
  receiptNotReceiptBody: 'جرّب تصوّرها تاني في نور أحسن، أو سجّلها بنفسك.',
  // طريق الخروج من الحكم — «مش عارف حتى أرجع» كانت الملاحظة. أي خروج بيقفل
  // الشغلانة فمش هتسأل تاني.
  receiptVerdictClose: 'إقفل',
  receiptFailed: 'مش قادرين نقرا الفاتورة. سجّلها بنفسك.',
  receiptTooLarge: 'الصورة كبيرة أوي. صوّر تاني.',
  receiptNoQuota: 'خلصت محاولات النهاردة. سجّلها بنفسك.',
  receiptNotConfigured: 'قراءة الفواتير مش مفعّلة.',

  // Receipts default to Cash because the SMS automation already logs every card
  // purchase — this steer is what stops the same expense being counted twice.
  receiptCashSteer: 'الفيزا بتتسجل لوحدها من رسالة البنك',
  receiptDupSms: 'الشراء ده يمكن اتسجل خلاص من رسالة البنك.',
  receiptDupPhoto: 'يظهر إنك صوّرت الفاتورة دي قبل كده.',
  // D18a — أقوى تلات علامة: دي مش تخمين من الكاش، دي سطر موجود فعلاً في الدفتر،
  // بنوريهوله عشان هو اللي يحكم.
  receiptDupBook: 'الدفتر فيه ده خلاص:',
  receiptDupBookMore: (n) => `و${n - 1} زيها في نفس اليوم`,
  // في سطر في الشهر ده تاريخه مش مقروء، فمش عارفين هو ده ولا لأ. بنقولها
  // بصراحة، ومش بتمنع حاجة.
  receiptDupUndated: 'في مصروف في الشهر ده من غير تاريخ واضح — يمكن يكون هو.',
  receiptSaveAnyway: 'سجّلها برضه',

  receiptQueuedTitle: 'الصورة اتحفظت',
  receiptQueuedBody: 'مفيش نت دلوقتي. هنقراها أول ما النت يرجع.',
  receiptQueuedCount: (n) => `${n} ${n === 1 ? 'فاتورة محفوظة' : 'فواتير محفوظة'}`,
  receiptStaleTitle: 'فاتورة من فترة',
  receiptStaleBody: 'دي اتصورت من زمان. تحب نقراها دلوقتي؟',
  receiptReadNow: 'اقراها',
  receiptDiscard: 'امسحها',

  /**
   * ——— the captain's log (W-6). The ONE place this app speaks a full sentence.
   *
   * Everywhere else the voice is a label on a button. Here it is a first officer
   * closing a month's book and handing it up: it states what happened, admits
   * what it could not account for, and signs off. It gives no advice, makes no
   * comparison, and asks for nothing — a report, not a nudge.
   */
  logTitle: (month) => `دفتر ${month} — مقفول`,
  logCurrency: 'جنيه',
  // Shown ONLY when nonzero. A month with nothing missing says nothing about
  // missing things — the silence is the good news.
  /**
   * DEVIATION from the commissioned string, raised in the report: the brief gave
   * «<n> مصاريف من غير تمن», which reads "1 expenses" at n=1. Every sibling here
   * — unpricedNote, undatedNote, inboxWaiting, jobsTitle — already carries the
   * same singular/plural switch, and this is the one card he reads slowly.
   */
  logUnpriced: (n) => `${n} ${n === 1 ? 'مصروف' : 'مصاريف'} من غير تمن`,
  logUndated: (n) => `${n} من غير يوم محدد`,
  logTo: (initials) => `إلى القبطان ${initials}`,
  // A8 اتشال؛ ده اللي مكانه — حقيقة من دفتره، مرة في الشهر، مش سؤال.
  logMostOften: (name, times) => `أكتر مكان رحته: ${name} — ${times} مرات`,
  logSignoff: 'كل قرش له سطر. تمام يا فندم.',
  // Quiet, and final for this month. Not "close", not "×" — an acknowledgement.
  logDismiss: 'تمام',

  // ——— summary
  periodToday: 'النهاردة',
  periodWeek: 'الأسبوع',
  periodMonth: 'الشهر',
  periodYear: 'السنة',
  // ——— «الدفتر» (M1): «اليوم» و«الأخير» بقوا حاجة واحدة بأربع مستويات.
  tabBook: 'الدفتر',
  todayCount: (n) => `${n} ${n === 1 ? 'حاجة' : 'حاجات'} النهاردة`,
  // الفلوس بعملة تانية بتتعد لوحدها — مش بتتجمع مع الجنيه (D8).
  travelApart: 'لوحدها',

  // ═══ D20 — شاشة مراجعة كشف الحساب ═══
  batchTitle: 'مراجعة الكشف',
  batchCount: (n, total) => `${n} من ${total} هتتسجل`,
  batchAll: 'اختار الكل',
  batchNone: 'شيل الكل',
  batchConfirm: (n) => `✓ سجّل ${n} ${n === 1 ? 'حاجة' : 'حاجات'}`,
  batchNothing: 'اختار اللي عايز تسجله',
  sortLabel: 'رتّب',
  sortName: (k) => ({ date: 'التاريخ', amount: 'الأكبر', name: 'الاسم' }[k] || String(k)),
  rowsLoading: 'بنقرأ الشهر من دفترك…',
  rowsLoadFailed: 'ما قدرناش نقرأ الشهر دلوقتي — اعمل تحديث وجرّب تاني.',
  dupTitle: (n) => `${n} صفوف يمكن يكونوا نفس المصروف مرتين`,
  dupBody: 'نفس اليوم، نفس المبلغ، نفس العملة. ده بيحصل بجد — قهوتين في يوم يبقوا قهوتين — عشان كده احنا بنشاور بس، مش بنقرر.',
  dupTier: (t) => ({
    same: 'نفس الوصف',
    similar: 'وصف قريب جدًا',
    different: 'وصف مختلف — على الأغلب عمليتين حقيقيتين',
  }[t] || null),
  dupUnpriced: (n) => `${n} ${n === 1 ? 'صف' : 'صفوف'} من غير مبلغ، فما اتقارنوش.`,
  dupNoDescription: '(من غير وصف)',
  dupOpenSheet: 'افتح الشيت وراجعهم',
  batchTooLarge: 'السيرفر بياخد ٤٠ صف في المرة — شيل علامات لغاية ٤٠ وسجّل الباقي بعدها.',
  batchOverCap: (n, max) => `${n} متعلمين — أقصى حاجة في مرة واحدة ${max}`,
  batchFailed: 'ما قدرناش نوصل للسيرفر — ما اتكتبش حاجة. اختياراتك محفوظة، جرّب تاني.',
  batchSending: 'بيتسجل…',
  // الصفوف اللي مينفعش تتسجل — بيفضلوا ظاهرين بسببهم مكتوب
  batchDeclined: 'اترفضت — مااتخصمتش',
  batchIncoming: 'فلوس داخلة — مش مصروف',
  batchPending: 'لسه معلّقة',
  batchRoundup: (n) => `فكة متجمعة${n ? ` · ${n} حركات` : ''}`,
  batchUnclear: 'مش واضحة',
  batchNeedCategory: '؟ النوع',
  // التكرار: تلات جمل مختلفة، وده مقصود
  batchDupBook: 'زيها في الدفتر',
  batchDupBookIntro: 'الدفتر فيه دي خلاص:',
  batchDupBatch: 'زي اللي فوق في نفس الصورة',
  batchDupUnchecked: 'ما قدرناش نتأكد',
  batchSaveAnyway: 'سجّلها برضه',
  batchTruncated: (shown, total) => `ظاهر ${shown} من ${total} — الكشف مقصوص. صوّر الباقي وابعته.`,
  // نتيجة كل صف بعد التسجيل — مش حكم واحد على الدفعة
  batchWritten: 'اتسجلت',
  batchSkippedDup: 'كانت متسجلة قبل كده',
  /**
   * الرفض مش إعادة — ولازم ما يتقروش زي بعض.
   *
   * `duplicate` معناها إن الصف ده اتكتب فعلاً في محاولة قبل كده. أما
   * `book_duplicate` فمعناها إن السيرفر لقى صف شبهه في الدفتر و**ما كتبش حاجة**
   * وسايب القرار له. واحدة خلصت والتانية مستنياه، وجمعهم في جملة واحدة بيخبّي
   * مصروف ممكن يكون حقيقي ورا كلمة بتقول إنه اتعمل.
   */
  batchRefusedDup: 'الدفتر فيه زيها — ما اتسجلتش',
  batchRetryPending: 'هتتسجل برضه',
  batchErrored: 'مااتسجلتش',
  batchNotChosen: 'ما اخترتهاش',
  batchSettled: (w, s, e) => `${w} اتسجلوا ✓${s ? ` · ${s} كانوا متسجلين` : ''}${e ? ` · ${e} فيهم مشكلة` : ''}`,
  batchBack: 'خلاص — ارجع للدفتر',
  // الصورة راحت من على السيرفر — تعبه محفوظ، القراية هي اللي بتنتهي
  batchExpired: 'الصورة عدى عليها وقت — صوّرها تاني وهنرجّع اللي اخترته',
  batchResnap: '📷 صوّرها تاني',
  batchDiscard: 'امسح المراجعة',
  /**
   * «سيبها» و«امسحها» فعلين مختلفين، وكان زرار واحد بيعملهم الاتنين: بعد
   * التسجيل ما كانش فيه غير «خلاص — ارجع للدفتر» وهو بيمسح المراجعة كلها —
   * بما فيها الصفوف اللي السيرفر رفضها وما كتبهاش. «سيبها» بتحافظ عليهم،
   * و«امسح» بتقول بصوت عالي هتضيّع إيه.
   */
  batchLeave: 'سيبها دلوقتي',
  batchDiscardWaiting: (n) => `امسح الكشف — ومعاه ${n} ${n === 1 ? 'مصروف' : 'مصاريف'} ما وصلوش الدفتر`,
  // العدّاد اللي بيبان كل يوم — فلوس لسه مادخلتش الدفتر
  batchWaiting: (n) => `${n} ${n === 1 ? 'مصروف' : 'مصاريف'} لسه ما اتسجلوش`,

  // ——— فلوس بعملة تانية جوه الفترة: الرقم بالجنيه مش كل الفترة.
  andAlso: 'ومعاهم',
  foreignNoCompare: 'فيه مصاريف بعملة تانية — المقارنة بالجنيه لوحدها مش هتكون صح',
  foreignUnsized: (n) => `و${n} ${n === 1 ? 'مصروف' : 'مصاريف'} بعملة تانية من غير تمن`,
  // السطر اللي من غير نوع بقى زرار في كل مكان بيظهر فيه (M6).
  rowNeedsCategory: '؟ دوس للنوع',
  // A2: الصف ده اتصنّف لوحده من الذاكرة — مش إنت اللي اخترته.
  rowAuto: '· لوحده',
  rowAutoTitle: 'النوع ده اتحط تلقائي من الذاكرة — دوس لو عايز تغيّره',
  todayNeedCategory: (n) => `${n} ${n === 1 ? 'مصروف' : 'مصاريف'} من غير نوع — دوس تصنّفهم`,
  // الجملة الواحدة اللي بيبتدي بيها الشهر والأسبوع (M5).
  lessThan: (prev) => `أقل من ${prev} بـ`,
  moreThan: (prev) => `أكتر من ${prev} بـ`,
  sameAs: (prev) => `زي ${prev} بالظبط`,
  wasThen: 'كان',
  todayTitle: 'مصاريف النهاردة — زي ما هي في الشيت بالظبط',
  todayEmptyTitle: 'لسه مفيش حاجة اتسجلت النهاردة',
  todayEmptyBody: 'أكّد العمليات من الوارد، أو سجّل مصروف جديد.',
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

  // قصيرة عشان تدخل في تلت الشاشة من غير ما تتقص (S6b).
  metricAll: 'الكل',
  metricVisa: 'فيزا',
  metricCash: 'كاش',

  vs: 'مقابل',
  cumulativeNote: 'تراكمي · ● = نفس النقطة',
  avg: 'متوسط',
  // Shown when there is nothing to compare against — better than describing a
  // grey line he cannot see.
  noComparison: (prev) => `مفيش بيانات لـ${prev} للمقارنة.`,
  // فترة لسه في أولها مفيهاش شكل يترسم — الرقم موجود، الرسم لأ (M7).
  periodJustStarted: (cur) => `${cur} لسه في أوله — الرسم هيبان بعد يوم كمان.`,

  // Rows whose date cell in his sheet is unreadable (10/210/2, 221, 31/0).
  // They count in the month total but belong to no day, so the chart cannot show
  // them. Said plainly rather than hidden.
  undatedNote: (n) => `${n} ${n === 1 ? 'مصروف' : 'مصاريف'} من غير يوم واضح — داخلة في إجمالي الشهر بس مش في الرسم`,

  // Rows he wrote down but never priced. The month total is knowably short, so
  // it must not be presented as if it were complete.
  unpricedNote: (n) => `${n} ${n === 1 ? 'مصروف' : 'مصاريف'} من غير مبلغ — الإجمالي ده أقل من الحقيقة`,

  // ——— connection / write states
  // ——— the Recent tab (D16). His own rows, and one tap to fix any of them.
  recentMonths: 'شهور',
  recentEmpty: 'مفيش مصاريف في الفترة دي',
  recentUndatedNote: (n) => `${n} ${n === 1 ? 'مصروف' : 'مصاريف'} من غير يوم واضح — بيظهروا في الشهر بس`,
  recentEdit: 'غيّر النوع',

  // ——— month accountability (D16d). Every gap on the screen has a name.
  uncategorizedLine: 'غير مصنّف ؟',
  uncategorizedHint: 'دوس عشان تصنّفها',
  monthTotalLine: 'إجمالي الشهر',

  /**
   * ——— عدسة الأولويات: بتقول، وما بتنصحش.
   *
   * الأسماء دي عرض بحت — التصنيفات نفسها هي الطبقة الدايمة، والمجموعات دي
   * ممكن تترسم تاني في أي وقت من غير ما حاجة تتغير في الدفتر. والأسماء
   * العربية دي لطارق يغيّرها لو عايز، زي «هوايات» بالظبط.
   */
  lensTitle: 'حسب الأولويات',
  lensGroup: (key) => ({
    essentials: 'أساسيات',
    health: 'صحة',
    joy: 'متعة',
    projects: 'مشاريع',
  }[key] || String(key)),
  lensRemainder: 'الباقي',

  // ——— الشيت نفسه، على بُعد ضغطة (A7). الوعد كله إن دفتره زي ما هو.
  openTheSheet: 'افتح الشيت ↗',


  // ——— رابط الشيت في شاشة الإعداد (A7) — اختياري.
  setupSheet: 'رابط الشيت (اختياري)',
  setupSheetHint: 'عشان يظهر زرار «افتح الشيت». سيبه فاضي ومش هيظهر.',

  // ——— the manual refresh (D16c). A BUTTON, never a gesture.
  refresh: 'حدّث',
  refreshing: 'بيحدّث…',
  refreshFailed: 'مانفعش يحدّث — جرّب تاني',

  offline: 'مفيش نت — دي آخر بيانات محفوظة',
  lastUpdated: 'آخر تحديث',
  saving: 'جارٍ الحفظ…',
  saved: 'اتسجل ✓',
  // نتيجة الدفعة (M4). كل كارت بيقول لوحده حصله إيه؛ دول بيلخّصوا الجولة.
  batchDone: (n) => `${n} اتسجلوا ✓`,
  batchPartly: (ok, bad) => `${ok} اتسجلوا · ${bad} محتاجين نظرة`,
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

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * HIS CATEGORIES, IN ARABIC — LABELS ONLY (finding M2).
 *
 * ——— THE FINDING. The single most frequent interaction in this app is tapping
 * a category, and until now every one of those taps landed on a Latin-alphabet
 * word inside an Arabic RTL screen, for a man who reads Arabic. «Groceries»,
 * «Eating out», «Personal expenses». CLAUDE.md #6 says Arabic is everywhere;
 * it was everywhere except on the buttons.
 *
 * ——— WHY THIS IS SAFE, and it is the whole design. The frozen-schema law binds
 * the VALUE — the string his dashboard's SUMIF criteria match, which round-trips
 * to the sheet byte-identical. It says nothing about the label on a button.
 * Nothing in this map ever reaches the wire: `state/*Payload.js` build every
 * request from the vocabulary, and `scripts/test-categories.mjs` asserts that no
 * label is a value.
 *
 * ——— WHAT IS DELIBERATELY NOT TRANSLATED.
 *
 * Proper nouns. `Science Pitchers` is a company, `HYS` is a programme; rendering
 * them in Arabic would be inventing names for real things. They map to
 * themselves, which is also the honest fallback for anything unmapped.
 *
 * ——— AND HIS OWN TRANSLITERATIONS ARE THE EVIDENCE THIS WAS WANTED.
 *
 * `omara2 al behar` and `fara7` are Arabic words he typed in Latin letters
 * because a Google Sheet on a phone made that easier than switching keyboards.
 * They are «عمارة البحر» and «فرح». Giving them back their own alphabet is the
 * clearest case in the list — and the reason to show this to him before trusting
 * it is the opposite case: he has read `Groceries` on his own rows for years.
 *
 * TO REVERT: make this map empty. Everything falls through to the Latin value,
 * which is exactly what the English locale does.
 */
const CATEGORY_AR = {
  'Eating out': 'أكل بره',
  Groceries: 'سوبر ماركت',
  Car: 'العربية',
  Gifts: 'هدايا',
  Donations: 'صدقات',
  Internet: 'إنترنت',
  Telephone: 'تليفون',
  Medical: 'دوا وعلاج',
  'Personal expenses': 'مصاريف شخصية',
  'omara2 al behar': 'عمارة البحر',
  'Elect. Recharge': 'شحن كهربا',
  'Water. Recharge': 'شحن مياه',
  Villa: 'الفيلا',
  'Taxes and fines': 'ضرايب ومخالفات',
  Gas: 'غاز',
  'Madinety club': 'نادي مدينتي',
  'Shams club': 'نادي الشمس',
  'Officers club': 'نادي الضباط',
  Vacations: 'أجازات',
  Utilities: 'فواتير البيت',
  fara7: 'فرح',
  Transportation: 'مواصلات',
  'InstaPay - Services': 'إنستاباي — خدمات',
  'InstaPay - Purchases': 'إنستاباي — مشتريات',
  // Proper nouns, left alone on purpose.
  'Science Pitchers': 'Science Pitchers',
  HYS: 'HYS',
  Team: 'الفريق',
  // 2026-08-24 — his own words for the first two; «هوايات» confirmed by him
  // the same sitting (docs/02 round 6). Display only: the WIRE always carries
  // the frozen English value, which is what his dashboard's SUMIF matches.
  Leisure: 'ترفيه/خروجات',
  Sports: 'رياضة',
  Hobbies: 'هوايات',
};

/**
 * A category's LABEL. Anything unmapped falls through as itself — a category
 * added to the server's whitelist before this map knows about it must render as
 * a usable button, not as a blank.
 */
const categoryLabel = (c) => (typeof c === 'string' ? (CATEGORY_AR[c.trim()] || c) : '');

// The server returns English month names (they mirror his tab names). Shown in
// Arabic; anything unmapped falls through unchanged rather than blanking.
const MONTHS_AR = {
  January: 'يناير', February: 'فبراير', March: 'مارس', April: 'أبريل',
  May: 'مايو', June: 'يونيو', July: 'يوليو', August: 'أغسطس',
  September: 'سبتمبر', October: 'أكتوبر', November: 'نوفمبر', December: 'ديسمبر',
};

const monthName = (name) => MONTHS_AR[name] || name || '';

// Sun-first, matching the server's week windows and Egyptian convention.
const WEEK_DAYS = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

const MONTH_LABELS = ['ي', 'ف', 'م', 'أ', 'م', 'ي', 'ي', 'أ', 'س', 'أ', 'ن', 'د'];

/**
 * `prevLog.name` is his TAB name — opaque, echoed from the sheet, never parsed.
 * Anything unrecognised falls through UNCHANGED rather than becoming a blank: a
 * tab he renamed should read as its own name, not as nothing.
 */
const MONTH_BY_TAB = {
  Jan: 'يناير', Feb: 'فبراير', Mar: 'مارس', Apr: 'أبريل',
  May: 'مايو', Jun: 'يونيو', Jul: 'يوليو', Aug: 'أغسطس',
  Sep: 'سبتمبر', Oct: 'أكتوبر', Nov: 'نوفمبر', Dec: 'ديسمبر',
};

/**
 * Who the captain's log is addressed to. Initials, not a full name — it is a log
 * entry, not a letter — and a client constant rather than a server field,
 * because it belongs to the person holding the phone.
 */
const CAPTAIN_INITIALS = 'أ.ع.';

export const AR_LOCALE = {
  dir: 'rtl',
  lang: 'ar',
  S: AR,
  monthName,
  monthByTab: (t) => (typeof t === 'string' ? (MONTH_BY_TAB[t.trim()] || t) : ''),
  categoryLabel,
  WEEK_DAYS,
  MONTH_LABELS,
  CAPTAIN_INITIALS,
  // The toggle's own label, always shown in the language it switches TO.
  switchTo: 'English',
};
