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
  /**
   * «للمراجعة», not the old label — the approved glass redesign, 2026-08-28.
   * The rename is not cosmetic: the old word named where things ARRIVE, and
   * this screen is where he DECIDES. The tab was already a review queue; the
   * label had never said so.
   * ⚠️ NOT A FIND-AND-REPLACE. «التحويلات الواردة» further down this file is the
   * ADJECTIVE «incoming» describing transfers, and renaming it would turn a
   * true sentence about money coming in into nonsense. Two different words that
   * merely share a stem.
   */
  tabInbox: 'للمراجعة',
  // مش «كاش» تاني — الشاشة اللي وراه بتاخد كاش أو فيزا (R-receipts 1).
  tabEntry: 'جديد',

  // ——— inbox
  inboxEmptyTitle: 'كله متسجّل',
  inboxEmptyBody: 'أي شراء بالفيزا هيظهر هنا أول ما البنك يبعت الرسالة.',
  inboxWaiting: (n) => `${n} ${n === 1 ? 'عملية مستنية' : 'عمليات مستنية'} — دوس على النوع عشان يتسجل`,
  // Months-old rows live behind one card so today's two purchases aren't buried
  // under forty of them. Nothing is hidden — it opens on a tap.
  inboxOldTitle: (n) => `مصاريف قديمة (${n})`,
  inboxOldBody: 'من شهور فاتت — لسه من غير نوع.',
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
  /**
   * THE INLINE UNIT — «ج.م», beside a row-scale figure.
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
  currencyShort: 'ج.م',
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
  /**
   * The refusal row's way INTO the full explanation (N1).
   *
   * This button used to be labelled with the verdict itself — the row said
   * «مش فاتورة» and then offered a button saying «مش فاتورة», which restated the status as
   * though it were an action and spent the card's one affordance saying nothing
   * new. Now that the status line carries the REASON, the button carries what
   * the status cannot fit: the paragraph on the detail screen that says what to
   * do about it.
   */
  jobWhy: 'اعرف ليه',
  jobReadAgain: 'اقرأها تاني',
  notExpenseReason: (r) => ({
    balance_screen: 'دي شاشة رصيد مش عملية شرا. الرصيد مش مصروف — صوّر الفاتورة أو تأكيد الدفع.',
    pending_or_declined: 'الدفعة دي لسه ما تمتش أو اترفضت. مفيش فلوس خرجت، يبقى مفيش حاجة تتسجل.',
    incoming: 'دي فلوس داخلة. الدفتر ده بيسجل اللي اتصرف، فالتحويلات الواردة بتتساب بره عن قصد.',
    menu_or_pricelist: 'دي تبدو منيو أو قايمة أسعار مش فاتورة اتدفعت.',
    other: null,
  }[r] || null),
  jobNotReceipt: 'مش فاتورة',
  /**
   * THE SAME ENUM, AT ROW LENGTH (chunk N1).
   *
   * `notExpenseReason` above is the DETAIL screen's paragraph. This is the queue
   * ROW's version of the same fact: he scans the list, and «مش فاتورة» is true of a
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
    balance_screen: 'ده رصيد — مش مصروف',
    pending_or_declined: 'لسه ما اتخصمتش',
    incoming: 'فلوس داخلة — مش مصروف',
    menu_or_pricelist: 'قائمة أسعار — مش فاتورة',
    other: null,
  }[r] || null),
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
  /**
   * الصيغة اللي تيجي في الأول. «لوحدها» فوق دي صفة بتيجي بعد الرقم، ولما
   * اتسْتُخدمت في أول الجملة بقى الفاعل ناقص — الرقم الأجنبي فوق في العنوان
   * ومش داخل الجملة أصلاً. سطر واحد، نص مخصوص ليه.
   */
  travelApartLead: 'محسوبة لوحدها',

  // ═══ D20 — شاشة مراجعة كشف الحساب ═══
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
  // ═══ U4 — أزواج التكرار في «للمراجعة» (٠٦ §3.9، حكم المالك 2026-08-27) ═══
  // «سيب واحد وشيل واحد؛ اللي تشيله يروح لتبويب Removed — والتاني بيفضل.»
  // القرار قرار واحد للزوج كله، والجُمل بتقول ده بالنص — مش بالتلميح.
  dupPairTitle: 'متسجلين مرتين؟',
  dupPairBody: 'صفّين شبه بعض في الدفتر. اختار اللي يتشال — والتاني بيفضل زي ما هو.',
  dupPairRemove: 'شيل الصف ده',
  dupPairRemoved: 'اتشال — راح لتبويب Removed في الشيت',
  dupPairSurvives: 'والتاني فاضل زي ما هو ✓',
  dupPairFailed: 'ما اتشالش — جرّب تاني',
  dupPairGone: 'الصف مش موجود في الشيت دلوقتي — يمكن اتشال قبل كده',
  // باب لسه السيرفر ما عندوش — نفس عصر زرار الصوت: الحالة بتتقال بصدق،
  // ومفيش زرار بيبعت في الفاضي.
  dupNeedsEngine: 'دفتر الشيت محتاج تحديث محرّكه الأول — لحد ما يتحدّث، راجعهم في الشيت باليد',
  dupGroupBig: (n) => `${n} صفوف شبه بعض — أكتر من اتنين، فالمراجعة دي في الشيت`,
  // ═══ U1 — شاشة تعديل الصف (٠٦ §3.7؛ حالة الـVR: صف بالكاش وكان بالفيزا) ═══
  editOpen: 'عدّل',
  editRowTitle: 'عدّل الصف',
  editDescription: 'الوصف',
  editSave: 'احفظ التعديل',
  editNothingChanged: 'لسه ما غيّرتش حاجة',
  editDone: 'اتعدل في الشيت ✓',
  // الصف كله اتغير — مش النوع بس (cardConflict بتاعة الفئة؛ دي للصف).
  editConflict: 'الصف اتغير في الشيت',
  editConflictUse: 'اعرض اللي في الشيت',
  editRefused: 'الشيت رفض التعديل ده',
  editNotFound: 'ما لقيناش الصف في الشيت — اعمل تحديث وبص تاني',
  // مفيش «هيتسجّل أول ما النت يرجع» هنا: مفيش حد بيعيد إرسال التعديل لسه،
  // فالوعد ده يبقى كذبة. الحقيقة: ما وصلش، وجرّب تاني.
  editOffline: 'النت قطع — ما وصلش للشيت. جرّب تاني.',
  editBadAmount: 'المبلغ لازم يكون رقم أكبر من صفر',
  editBadDate: 'التاريخ لازم يكون يوم/شهر/سنة',
  editNeedCurrency: 'اختار العملة مع المبلغ',
  // الرفض بيسمّي الشهر اللي بيحمي — نقل صف بين الشهور شغل إيد في الشيت (docs/09 §4).
  editDateLeavesMonth: (m) => `التاريخ ده يطلع الصف من شهر ${m} — نقل صف بين الشهور بيتم في الشيت باليد`,
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
  // فعل الأمر بتاع تنبيه الكشف. قبل كده كان السطر كله هو الزرار، وده صح
  // بس ما كانش شكله زرار.
  batchReview: 'راجعها',

  // ——— فلوس بعملة تانية جوه الفترة: الرقم بالجنيه مش كل الفترة.
  andAlso: 'ومعاهم',
  /**
   * No comparison exists for a unit we have no history in (D23, chunk N1b).
   * The percentage is computed from the EGP series; under a euro headline it
   * would be a confident claim about the ASIDE, read as being about the figure
   * it sits beneath. Said rather than silently dropped — a suppressed
   * comparison that explains itself is the house rule.
   */
  chartUnit: (cur) => `بالـ${cur}`,
  readInUnit: (cur) => `اقرا بالـ${cur}`,
  noCompareInUnit: (cur) => `لسه مفيش تاريخ بالـ${cur} نقارن بيه`,
  foreignNoCompare: 'فيه مصاريف بعملة تانية — المقارنة بالجنيه لوحدها مش هتكون صح',
  foreignUnsized: (n) => `و${n} ${n === 1 ? 'مصروف' : 'مصاريف'} بعملة تانية من غير تمن`,
  // D27 — فلوس الرقم اللي فوق مش شاملها: موجودة فعلًا في الفترة، ومفيش سعر
  // محفوظ على السطر بتاعها، فمفيش إجمالي صادق يقدر يضمها.
  notConverted: 'لسه متحوّلتش',
  /**
   * ——— A7: مقالة الفلوس الأجنبية بقت سطر واحد. كل قاعدة كانت بتمنع المقارنة
   * (فلوس بعملة تانية، أو وحدة قراءة من غير تاريخ) كان ليها جملتها على
   * الشاشة؛ السطر ده بيحل محل الكومة، والجمل الكاملة بتظهر بس ورا ضغطته.
   * مش بيسمّي قاعدة بعينها عن قصد — هو صادق مع الاتنين، والتفصيل على بُعد ضغطة.
   */
  whyNoCompare: 'مفيش مقارنة هنا — اعرف ليه',
  /**
   * ——— A7: الأقسام ليها أسامي بدل الكلام المرصوص (north-star §5).
   * `sectionAgainst` بياخد اسم الفترة اللي بنقارن بيها («مقابل يوليو»)؛
   * `sectionByMethod` فوق كروت طريقة الدفع. المستهلكين: شاشة الشهر في
   * BookView (مقابل)، وPeriodSummary في Charts.jsx (حسب طريقة الدفع).
   */
  sectionAgainst: (prev) => `مقابل ${prev}`,
  sectionByMethod: 'حسب طريقة الدفع',
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
  /**
   * ——— E7: كلام الرأس — ملاحظة، مش حكم. «أخف من يوليو» بتقول اللي حصل
   * وبس: مفيش مدح، مفيش لوم، مفيش نصيحة (north-star §6.2: نقدر نقول «أخف»
   * كحقيقة؛ عمرنا ما نمدح أو نلوم أو ننصح). الصيغة بتاخد اسم الفترة اللي
   * المقارنة اتعملت عليها فعلاً — و«من المعتاد» مش هنا عن قصد: الكلام ده
   * ما اتكسبش غير لما نطاق E6 يتوصّل بالرأس، والبنّاء اللي في BookView
   * بيرفضه لحد ما يتكسب.
   */
  headLighter: (prev) => `أخف من ${prev}`,
  headHeavier: (prev) => `أتقل من ${prev}`,
  wasThen: 'كان',
  /**
   * ——— A4: رقم الفترة اللي فاتت على كارت طريقة الدفع، بالكلام. «0» عريان تحت
   * الرقم الكبير بيتقري كإجابة عن دلوقتي؛ «كان 0 — الأسبوع اللي فات» بيتقري
   * زي ما هو: حقيقة عن زمان. بياخد المبلغ جاهز التنسيق (money/moneyRound —
   * القالب ده عمره ما بيخترع أرقام) واسم الفترة زي ما العنوان بيسميها.
   */
  prevWorded: (amount, prevName) => `كان ${amount} — ${prevName}`,
  todayEmptyTitle: 'لسه مفيش حاجة اتسجلت النهاردة',
  todayEmptyBody: 'أكّد العمليات من «للمراجعة»، أو سجّل مصروف جديد.',

  thisWeek: 'الأسبوع ده',
  lastWeek: 'الأسبوع اللي فات',

  // قصيرة عشان تدخل في تلت الشاشة من غير ما تتقص (S6b).
  metricAll: 'الكل',
  metricVisa: 'فيزا',
  metricCash: 'كاش',

  vs: 'مقابل',
  avg: 'متوسط',
  // زرار المسح في اللوحة — بيتنطق مش بيتشاف (A9).
  keypadBackspace: 'مسح',
  // W1 — الرسمة مترسمش صفر مش صحيح: الجملة الصادقة مكان الخط (لازم تحتوي chartUnit حرفيًا).
  chartHomeZero: (cur) => `مفيش مصاريف بالـ${cur} في الفترة دي — الرسم بيتحسب بالـ${cur} بس`,
  // بتتقال مرة واحدة، بدل تلات كروت كل واحد بيقول نفس الصفر بتلات طرق.
  methodAllZero: (cur) => `مفيش مصاريف بالـ${cur} في الفترة دي نقسّمها حسب الطريقة`,
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

  /**
   * ——— N7: شرائح الأولويات فوق قايمة الدفتر — العدد جملة، مش رقم عريان.
   * بتاخد المبلغ اسم المجموعة زي ما `lensGroup` بيقوله — مفيش نسخة تانية
   * من الأسامي.
   */
  priorityCount: (n, group) => `${n} ${n === 1 ? 'مصروف' : 'مصاريف'} في «${group}»`,
  /**
   * ——— N7: الفلتر الفاضي بيسمّي صفره بنفسه («History: 0»). الرسالة العامة
   * «مفيش مصاريف في الفترة دي» كانت هتدّعي إن الفترة كلها فاضية — وهي مش
   * فاضية، الفلتر بس هو اللي مفيهوش. القايمة الفاضية جملة، مش بياض.
   */
  priorityEmpty: (group) => `«${group}»: 0 — مفيش مصاريف من النوع ده في الفترة دي`,

  /**
   * ——— E3: جملة الشهر بتسمّي شبّاكها. المقارنة بتتاخد عند نفس النقطة
   * (prevAt)، فـ«أقل من يوليو» في نص أغسطس معناها الحقيقي «أيام 1–24 مقابل
   * يوليو 1–24» — والكلام دلوقتي بيقول اللي الحساب عمله. النسخة التانية لما
   * الشهر اللي فات أقصر (فبراير): الشباك بتاعه كله داخل المقارنة.
   */
  windowWords: (days, prev) => `أيام 1–${days} مقابل ${prev} 1–${days}`,
  windowWordsWholePrev: (days, prev) => `أيام 1–${days} مقابل ${prev} كله`,

  // ——— N6: شاشة اختيار الشهر — عنوان الشهر بقى باب.
  monthPickerTitle: 'اختار الشهر',
  monthPickerClose: 'إقفل',

  // ——— الشيت نفسه، على بُعد ضغطة (A7). الوعد كله إن دفتره زي ما هو.
  openTheSheet: 'افتح الشيت ↗',


  // ——— رابط الشيت في شاشة الإعداد (A7) — اختياري.
  setupSheet: 'رابط الشيت (اختياري)',
  setupSheetHint: 'عشان يظهر زرار «افتح الشيت». سيبه فاضي ومش هيظهر.',

  // ——— the manual refresh (D16c). A BUTTON, never a gesture.
  refresh: 'حدّث',
  refreshing: 'بيحدّث…',
  refreshFailed: 'مانفعش يحدّث — جرّب تاني',

  /**
   * ——— S1: شاشة الإعدادات ورا الترس (حكم صاحب البيت 2026-08-27).
   * `settingsTitle` هو اسم الترس واسم الشاشة في نفس الوقت — مفهوم واحد،
   * جملة واحدة (قانون A8). والسطر الهادي تحت زرار العملة بيقول بالبلدي
   * الزرار ده بيعمل إيه — من غير أي كلمة تقنية، لأن ده المكان الوحيد اللي
   * المعنى متقول فيه.
   */
  settingsTitle: 'الإعدادات',
  settingsClose: 'إقفل',
  settingsLangCurrency: 'العملة واللغة',
  settingsLanguage: 'اللغة',
  settingsCurrency: 'العملة',
  settingsCurrencyNote: 'بتحدد أنهي عملة تيجي الأول في أرقام الدفتر — مفيش أي تحويل، كل عملة بأرقامها زي ما هي.',

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
