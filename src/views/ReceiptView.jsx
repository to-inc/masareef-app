import { useState, useRef, useEffect } from 'react';
import { C, FONT_DISPLAY, TAP } from '../theme.js';
import { S } from '../i18n/strings.js';
import { CATEGORIES, SHORT_LIST } from '../lib/constants.js';
import { money, normalizeDigits } from '../lib/format.js';
import { newClientId } from '../lib/dates.js';
import { prepareReceipt, snapDateISO, ReceiptImageError } from '../lib/receipt-image.js';
import { receiptExtract, receiptConfirm } from '../api/index.js';
import * as queue from '../state/receiptQueue.js';
import { SectionLabel, LATIN } from '../components/Primitives.jsx';

/**
 * Two-phase receipt capture (contract §3.3–§3.4).
 *
 * The rule that shapes every state below: **nothing unconfirmed is ever
 * written.** Phase 1 reads the photo and writes nothing at all; phase 2 appends
 * exactly one row, and only from values Dad has looked at. The model never picks
 * the category — that comes from his own Memory tab or from his tap.
 *
 * States: idle → working (S1) → review (S2 confident / S3 uncertain)
 *                             → notReceipt (S4) → queued (S5, offline).
 */
const ISO_TO_DMY = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${Number(m[3])}/${Number(m[2])}/${m[1]}` : '';
};

// Field-test diagnostics, off unless explicitly switched on.
const debugOn = () => {
  try { return localStorage.getItem('masareef.debug') === '1'; } catch { return false; }
};

const ERROR_TEXT = {
  'image_too_large': S.receiptTooLarge,
  'daily-limit': S.receiptNoQuota,
  'ocr_not_configured': S.receiptNotConfigured,
  'vision_failed': S.receiptFailed,
};

export default function ReceiptView({ onSaved, onManual }) {
  const [stage, setStage] = useState('idle');
  const [slow, setSlow] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [pendingCount, setPendingCount] = useState(0);

  const [shot, setShot] = useState(null);          // { base64, clientHash, snapDate }
  const [extraction, setExtraction] = useState(null);
  const [dup, setDup] = useState({ receipt: false, sms: false });
  const [overrideDup, setOverrideDup] = useState(false);

  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [method, setMethod] = useState('Cash');
  const [category, setCategory] = useState(null);
  const [showAllCats, setShowAllCats] = useState(false);
  const [saving, setSaving] = useState(false);

  const fileRef = useRef(null);
  const slowTimer = useRef(null);

  const refreshQueueCount = () => queue.count().then(setPendingCount);
  useEffect(() => { refreshQueueCount(); }, []);
  useEffect(() => () => clearTimeout(slowTimer.current), []);

  const reset = () => {
    setStage('idle'); setSlow(false); setErrorMsg('');
    setShot(null); setExtraction(null); setDup({ receipt: false, sms: false });
    setOverrideDup(false); setAmount(''); setMerchant(''); setDateStr('');
    setMethod('Cash'); setCategory(null); setShowAllCats(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const applyExtraction = (res, snapDate) => {
    const e = res.extraction;
    setExtraction(e);
    setDup({ receipt: !!res.dupReceipt, sms: !!res.dupSms });
    setAmount(e.amount == null ? '' : String(e.amount));
    setMerchant(e.merchant_display || e.merchant_latin || '');
    // Printed date wins when the server judged it plausible; otherwise the day
    // he took the photo. Either way it is on screen before he confirms.
    setDateStr(ISO_TO_DMY(e.date) || ISO_TO_DMY(snapDate));
    // Receipts default to Cash: the SMS automation already logs every card
    // purchase, so defaulting to Visa would double-count his spending.
    setMethod('Cash');
    setCategory(res.category || null);
    setShowAllCats(!res.category);
    setStage(e.is_receipt ? 'review' : 'notReceipt');
  };

  const onFile = async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;

    setStage('working');
    setSlow(false);
    clearTimeout(slowTimer.current);
    // Escape hatch at 20 s, well inside the 45 s transport timeout — he should
    // never feel trapped watching a spinner.
    slowTimer.current = setTimeout(() => setSlow(true), 20000);

    let prepared;
    try {
      prepared = await prepareReceipt(file);
    } catch (err) {
      clearTimeout(slowTimer.current);
      setErrorMsg(err instanceof ReceiptImageError && err.code === 'too-large'
        ? S.receiptTooLarge : S.receiptFailed);
      setStage('error');
      return;
    }

    const snapDate = snapDateISO();
    setShot({ ...prepared, snapDate });

    try {
      const res = await receiptExtract({
        image: prepared.base64, clientHash: prepared.clientHash, snapDate,
      });
      clearTimeout(slowTimer.current);

      if (res?.ok) { applyExtraction(res, snapDate); return; }
      setErrorMsg(ERROR_TEXT[res?.error] || S.receiptFailed);
      setStage('error');
    } catch {
      // Offline. Keep the photo — re-taking a receipt he has already thrown away
      // is impossible, so losing it is the one unrecoverable outcome here.
      clearTimeout(slowTimer.current);
      const ok = await queue.enqueue({
        id: prepared.clientHash, base64: prepared.base64,
        clientHash: prepared.clientHash, snapDate,
      });
      setErrorMsg(ok ? '' : S.receiptFailed);
      setStage(ok ? 'queued' : 'error');
      refreshQueueCount();
    }
  };

  const save = async () => {
    const amt = Number(normalizeDigits(amount));
    if (!isFinite(amt) || amt <= 0 || !category || saving) return;

    setSaving(true);
    const payload = {
      clientHash: shot?.clientHash,
      clientId: newClientId(),
      amount: amt,
      currency: extraction?.currency && extraction.currency !== 'UNKNOWN' ? extraction.currency : 'EGP',
      method,
      category,
      description: merchant || category,
      merchantLatin: extraction?.merchant_latin || '',
      dateStr,
    };
    try {
      const res = await receiptConfirm(payload);
      if (res?.ok) {
        if (shot?.clientHash) queue.remove(shot.clientHash).then(refreshQueueCount);
        onSaved?.(S.saved);
        reset();
      } else {
        setErrorMsg(S.genericError);
        setStage('error');
      }
    } catch {
      // The row still needs writing — hand it to the outbox, which is age-gated
      // and clientId-idempotent exactly like a cash entry.
      onSaved?.(S.queued, payload);
      reset();
    } finally {
      setSaving(false);
    }
  };

  // ——————————————————————————————— render
  if (stage === 'working') {
    return (
      <Centered>
        <div style={{ fontSize: 46 }}>🧾</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 21, fontWeight: 650, color: C.nile, marginTop: 10 }}>
          {S.receiptReading}
        </div>
        {slow && (
          <>
            <p style={{ color: C.faint, fontSize: 15, marginTop: 10, lineHeight: 1.6, maxWidth: 290 }}>
              {S.receiptSlow}
            </p>
            <button className="bigbtn" onClick={() => { reset(); onManual?.(); }} style={ghostBtn}>
              {S.receiptEnterManually}
            </button>
          </>
        )}
      </Centered>
    );
  }

  if (stage === 'notReceipt') {
    return (
      <Centered>
        <div style={{ fontSize: 46 }}>🤔</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 21, fontWeight: 650, color: C.nile, marginTop: 10 }}>
          {S.receiptNotReceipt}
        </div>
        <p style={{ color: C.faint, fontSize: 15.5, marginTop: 8, lineHeight: 1.6, maxWidth: 290 }}>
          {S.receiptNotReceiptBody}
        </p>
        <button className="bigbtn" onClick={reset} style={primaryBtn}>{S.receiptRetake}</button>
      </Centered>
    );
  }

  if (stage === 'queued') {
    return (
      <Centered>
        <div style={{ fontSize: 46 }}>📥</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 21, fontWeight: 650, color: C.nile, marginTop: 10 }}>
          {S.receiptQueuedTitle}
        </div>
        <p style={{ color: C.faint, fontSize: 15.5, marginTop: 8, lineHeight: 1.6, maxWidth: 290 }}>
          {S.receiptQueuedBody}
        </p>
        <button className="bigbtn" onClick={reset} style={primaryBtn}>{S.receiptRetake}</button>
      </Centered>
    );
  }

  if (stage === 'error') {
    return (
      <Centered>
        <div style={{ fontSize: 46 }}>🌿</div>
        <p style={{ color: C.ink, fontSize: 16.5, marginTop: 12, lineHeight: 1.6, maxWidth: 300 }}>
          {errorMsg || S.receiptFailed}
        </p>
        <button className="bigbtn" onClick={reset} style={primaryBtn}>{S.receiptRetake}</button>
        <button className="catchip" onClick={() => { reset(); onManual?.(); }} style={ghostBtn}>
          {S.receiptEnterManually}
        </button>
      </Centered>
    );
  }

  if (stage === 'review' && extraction) {
    const lowAmount = extraction.amount_confidence === 'low' || extraction.amount == null;
    const lowMerchant = extraction.merchant_confidence === 'low';
    const lowDate = extraction.date_confidence === 'low';
    const anyLow = lowAmount || lowMerchant || lowDate;
    const ready = Number(normalizeDigits(amount)) > 0 && !!category && !saving;
    const blockedByDup = (dup.sms || dup.receipt) && !overrideDup;

    return (
      <div>
        <SectionLabel>{S.receiptCheck}</SectionLabel>

        {/* FIELD-TEST ONLY — enable with localStorage['masareef.debug']='1'.
            Tarek-facing; Dad never sets this flag and never sees this line.
            Exists because iOS Safari's console needs a tethered Mac, which is
            useless mid-field-test, and because a failed EXIF rotation is
            otherwise invisible until extraction quality is statistically bad. */}
        {debugOn() && shot && (
          <div style={{
            fontSize: 12, fontFamily: 'ui-monospace, monospace', direction: 'ltr',
            padding: '6px 10px', borderRadius: 8, marginBottom: 10,
            background: shot.landscape ? '#F7E6E2' : C.paper,
            color: shot.landscape ? C.danger : C.faint,
            border: `1px solid ${shot.landscape ? C.danger : C.line}`,
          }}>
            {shot.width}×{shot.height} · {Math.round(shot.bytes / 1024)}KB · q{shot.quality}
            {shot.landscape ? ' · ⚠ LANDSCAPE — EXIF rotation not applied?' : ' · portrait ✓'}
          </div>
        )}

        {anyLow && (
          <Banner tone="warn">{S.receiptUnsure}</Banner>
        )}
        {dup.sms && <Banner tone="warn">{S.receiptDupSms}</Banner>}
        {dup.receipt && <Banner tone="warn">{S.receiptDupPhoto}</Banner>}

        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, padding: 16 }}>
          <Field label={S.receiptAmount} editable={lowAmount}>
            {lowAmount ? (
              <input
                inputMode="decimal" dir="ltr" value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={inputStyle} autoFocus
              />
            ) : (
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 34, fontWeight: 650, ...LATIN }}>
                {money(amount)} <span style={{ fontSize: 16, color: C.faint }}>{extraction.currency}</span>
              </div>
            )}
          </Field>

          {/* The verbatim line the number came from — he can check our reading
              against the paper in his hand without trusting us. */}
          {extraction.raw_total_line && (
            <div style={{ fontSize: 13, color: C.faint, marginTop: 2, lineHeight: 1.7 }}>
              {S.receiptSaw}{' '}
              <span style={{ background: C.paper, borderRadius: 6, padding: '2px 6px' }} dir="auto">
                {extraction.raw_total_line}
              </span>
            </div>
          )}

          <Field label={S.receiptMerchant} editable={lowMerchant}>
            {lowMerchant ? (
              <input value={merchant} onChange={(e) => setMerchant(e.target.value)} style={inputStyle} dir="auto" />
            ) : (
              <div style={{ fontSize: 17.5, fontWeight: 600 }} dir="auto">{merchant}</div>
            )}
          </Field>

          <Field label={S.receiptDate} editable={lowDate}>
            {lowDate ? (
              <input value={dateStr} onChange={(e) => setDateStr(e.target.value)} style={inputStyle} dir="ltr" />
            ) : (
              <div style={{ fontSize: 16, ...LATIN }}>{dateStr}</div>
            )}
          </Field>

          {/* Cash / Visa. Cash is the default and the steer explains why, so the
              same purchase is not counted twice. */}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            {['Cash', 'Visa'].map((m) => (
              <button
                key={m}
                className="catchip"
                onClick={() => setMethod(m)}
                aria-pressed={method === m}
                style={{
                  flex: 1, minHeight: TAP, borderRadius: 12, fontSize: 16, fontWeight: 700,
                  background: method === m ? (m === 'Visa' ? C.visaBg : C.cashBg) : C.paper,
                  color: method === m ? (m === 'Visa' ? C.visa : C.cash) : C.faint,
                  border: `1px solid ${method === m ? (m === 'Visa' ? C.visa : C.cash) : C.line}`,
                }}
              >
                {m === 'Visa' ? S.metricVisa : S.metricCash}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12.5, color: C.faint, marginTop: 6, textAlign: 'center' }}>
            {S.receiptCashSteer}
          </div>
        </div>

        {/* Category: his Memory tab's answer as one tap, or chips. Never the model's. */}
        {category && !showAllCats && (
          <button className="bigbtn" onClick={() => setShowAllCats(true)} style={{ ...chipStyle, marginTop: 12, width: '100%', background: C.confirm, color: '#fff', fontSize: 18, fontWeight: 700, minHeight: 56 }}>
            ✓ <span style={LATIN} dir="auto">{category}</span>
          </button>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {(showAllCats ? CATEGORIES : SHORT_LIST).filter((c) => c !== category).map((c) => (
            <button
              key={c} className="catchip" onClick={() => { setCategory(c); setShowAllCats(true); }}
              style={{ ...chipStyle, background: C.paper, border: `1px solid ${C.line}` }} dir="auto"
            >
              {c}
            </button>
          ))}
          {!showAllCats && (
            <button className="catchip" onClick={() => setShowAllCats(true)}
              style={{ ...chipStyle, background: 'transparent', border: `1px dashed ${C.brass}`, color: C.brass, fontWeight: 600 }}>
              {S.more}
            </button>
          )}
        </div>

        {blockedByDup ? (
          <button className="bigbtn" onClick={() => setOverrideDup(true)}
            style={{ ...primaryBtn, marginTop: 16, width: '100%', background: C.brass }}>
            {S.receiptSaveAnyway}
          </button>
        ) : (
          <button
            className="bigbtn" disabled={!ready} onClick={save}
            style={{
              marginTop: 16, width: '100%', minHeight: 58, padding: '16px 0', borderRadius: 14,
              background: ready ? C.confirm : C.line, color: ready ? '#fff' : C.faint,
              fontSize: 18.5, fontWeight: 700,
            }}
          >
            {saving ? S.saving : S.receiptConfirm}
          </button>
        )}

        <button className="catchip" onClick={reset} style={{ ...ghostBtn, width: '100%', marginTop: 8 }}>
          {S.receiptCancel}
        </button>
      </div>
    );
  }

  // ——— idle
  return (
    <Centered>
      <div style={{ fontSize: 52 }}>🧾</div>
      <p style={{ color: C.faint, fontSize: 15.5, marginTop: 10, lineHeight: 1.7, maxWidth: 300 }}>
        {S.receiptIntro}
      </p>
      {pendingCount > 0 && (
        <div style={{ fontSize: 14, color: C.brass, fontWeight: 700 }}>
          {S.receiptQueuedCount(pendingCount)}
        </div>
      )}
      <label className="bigbtn" style={{ ...primaryBtn, display: 'inline-block', cursor: 'pointer' }}>
        {S.receiptStart}
        {/* `capture="environment"` opens the native camera directly. Deliberately
            NOT getUserMedia, which has a long-standing standalone-mode bug on
            iOS. UNVERIFIED on a real installed app — WS5 smoke test. */}
        <input
          ref={fileRef} type="file" accept="image/*" capture="environment"
          onChange={onFile} style={{ display: 'none' }}
        />
      </label>
    </Centered>
  );
}

// ——————————————————————————————— small pieces
function Centered({ children }) {
  return (
    <div style={{ textAlign: 'center', paddingTop: 70, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      {children}
    </div>
  );
}

function Field({ label, editable, children }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: editable ? C.warn : C.faint, letterSpacing: '.02em' }}>
        {label}{editable ? ' •' : ''}
      </div>
      {children}
    </div>
  );
}

function Banner({ children }) {
  return (
    <div style={{
      background: C.warnBg, border: `1px solid ${C.brassSoft}`, color: '#7A5B12',
      borderRadius: 12, padding: '10px 14px', fontSize: 14.5, fontWeight: 600,
      marginBottom: 10, lineHeight: 1.6,
    }}>
      {children}
    </div>
  );
}

const primaryBtn = {
  marginTop: 14, minHeight: 58, padding: '16px 30px', borderRadius: 14,
  background: C.nile, color: '#fff', fontSize: 18, fontWeight: 700,
};
const ghostBtn = {
  marginTop: 10, minHeight: TAP, padding: '12px 20px', borderRadius: 12,
  background: 'transparent', border: `1px solid ${C.line}`, color: C.faint,
  fontSize: 15.5, fontWeight: 600,
};
const chipStyle = {
  padding: '11px 15px', minHeight: TAP, borderRadius: 999,
  fontSize: 15, fontWeight: 500, color: C.ink, ...LATIN,
};
const inputStyle = {
  width: '100%', padding: '12px 14px', borderRadius: 12, marginTop: 4,
  border: `1.5px solid ${C.brass}`, background: C.paper, color: C.ink,
  fontSize: 20, fontWeight: 600, outline: 'none',
};
