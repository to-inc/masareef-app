import { useState, useRef } from 'react';
import { C, FONT_DISPLAY, NUMERALS, RADIUS, TAP, TYPE } from '../theme.js';
import { S } from '../i18n/strings.js';
import { money, amountWithCurrency } from '../lib/format.js';
import { SectionLabel, Chip, LATIN, ISOLATE } from '../components/Primitives.jsx';
import { OutcomeNote, CategoryActions } from '../components/CategoryPicker.jsx';
import { cardKey, reconcile, remaining, needsHim, headlineFor, batchable } from '../state/inboxOutcomes.js';
import { findLookalikes } from '../state/duplicates.js';
import { supportsAction, loadBuild } from '../state/capabilities.js';
import { removeEntry } from '../api/index.js';

/**
 * The Inbox is where the 5-second law is won or lost. Each card is one purchase
 * the bank already told us about; the only thing missing is which category it
 * belongs to. If we guessed it, that is ONE tap on a button big enough to hit
 * without looking.
 *
 * WS3-C (2026-08-03): a card also has to SHOW what became of that tap. It used
 * to vanish optimistically and come back on the next refetch with no trace, so
 * "done" and "the write failed" looked identical — see state/inboxOutcomes.js
 * for the field report. `settled` is that record, keyed by `cardKey`, and it is
 * what makes a confirmed card stay confirmed on screen no matter what the
 * server keeps sending.
 */
/**
 * U4 — DUPLICATE PAIRS (06 §3.9, the Owner's ruling 2026-08-27): «show
 * duplicates… choose which one to keep and which one to remove; if we remove
 * one, the other stays; if we keep one, the other stays.»
 *
 * ——— WHERE PAIRS COME FROM. `findLookalikes` — the ONE detector the Book's
 * report card already rides (state/duplicates.js; test-duplicates owns its
 * semantics) — read over the Inbox's own `pending[]`, because those rows carry
 * a server-authored tab + rowHint: the identity §3.9's guard needs. This is a
 * PROJECTION of the detector's groups into pairs, never a second detector.
 *
 * ——— THE HONEST SUBSET, pinned as such. Actionable pairs exist only among
 * pending rows; booked non-pending rows keep the Book's report-only card
 * (docs/09 §4 hands that removal to human hands until the shell can hand this
 * surface today's rows too — a named residual). Groups of 3+ are legible but
 * NOT pairwise-actionable: §3.9 resolves PAIRS, and choosing an arbitrary
 * pair inside a trio would be a guess about which two are the same expense.
 */
export function pairsFrom(pending) {
  const list = Array.isArray(pending) ? pending : [];
  const report = findLookalikes(list.map((p) => (p && p.match) || null));
  const pairs = [];
  const bigGroups = [];
  for (const g of report.groups) {
    const items = g.rows.map((r) => list[r.at]);
    if (g.rows.length === 2) pairs.push({ key: g.key, tier: g.tier, items });
    else bigGroups.push({ key: g.key, tier: g.tier, count: g.rows.length, items });
  }
  return { pairs, bigGroups, unpriced: report.unpriced };
}

/**
 * Which fields DIFFER between the two rows — the card makes exactly these
 * prominent, because the difference is what the decision turns on. Amount,
 * currency and day are equal by the detector's own key, so what can differ is
 * method, the words, and the category.
 */
export function pairDiffs(a, b) {
  const x = a || {};
  const y = b || {};
  const fold = (s) => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();
  const out = [];
  if ((x.method === 'Visa' ? 'Visa' : 'Cash') !== (y.method === 'Visa' ? 'Visa' : 'Cash')) out.push('method');
  if (fold(x.description) !== fold(y.description)) out.push('description');
  if (fold(x.category) !== fold(y.category)) out.push('category');
  return out;
}

/**
 * The server's answer → the pair's state. Strict `ok === true`; a replayed
 * remove answers ok too (`already` — a settled outcome). `unknown_action` is
 * the ENGINE state — the deployed backend has no `remove_entry` yet, and the
 * voice door's era taught what a client does about a verb the server lacks:
 * say so, honestly, and light nothing that can only fail.
 */
export function outcomeForRemove(res, threw) {
  if (threw) return { status: 'offline' };
  if (res && res.ok === true) return { status: 'done' };
  const code = (res && res.error) || 'unknown';
  if (code === 'unknown_action') return { status: 'engine' };
  if (code === 'row_changed') {
    const cur = res && res.current;
    return { status: 'conflict', current: cur && typeof cur === 'object' ? cur : null };
  }
  if (code === 'row_not_found') return { status: 'gone' };
  return { status: 'failed', error: code };
}

export default function InboxView({
  pending, settled = {}, onConfirm, onConfirmMany,
  /**
   * U4 — the serving backend's advertisement (fail closed) and the pairs'
   * outcome seed, both in the house SSR pattern: props defaulting to the live
   * reads, so a suite renders every state without a storage shim and the
   * live app is unmoved.
   */
  build = loadBuild(),
  initialPairOutcomes = null,
  onResolved = null,
}) {
  /**
   * What happened to each PAIR, keyed by the detector's own group key. A
   * `done` outcome carries `removedKey` — the removed row's settle key — and
   * that row leaves the list below, so the headline counts the screen it
   * heads. (The tab badge is App-owned and catches up on its next refetch —
   * a named residual, not a silent one.)
   */
  const [pairOutcomes, setPairOutcomes] = useState(initialPairOutcomes || {});
  const dup = pairsFrom(pending);
  const removedKeys = new Set(
    Object.values(pairOutcomes)
      .filter((o) => o && o.status === 'done' && o.removedKey)
      .map((o) => o.removedKey),
  );
  const rows = reconcile(pending, settled).filter((r) => !removedKeys.has(r.key));

  const canRemove = supportsAction(build, 'remove_entry');
  const resolvePair = async (pair, removeIdx) => {
    const target = pair.items[removeIdx];
    if (!target) return;
    setPairOutcomes((s) => ({ ...s, [pair.key]: { status: 'saving' } }));
    let res = null;
    let threw = false;
    try {
      // The pending row's OWN identity, echoed — tab + rowHint are
      // server-authored, match is the optimistic-concurrency claim. No
      // sourceHash is invented: pending[] carries none (§2.2), and §3.9's
      // guard is «like edit_entry», whose guard is the match itself.
      res = await removeEntry({ tab: target.tab, rowHint: target.rowHint, match: target.match });
    } catch { threw = true; }
    const out = outcomeForRemove(res, threw);
    if (out.status === 'done') {
      out.removedKey = cardKey(target);
      out.removedIdx = removeIdx;
    }
    setPairOutcomes((s) => ({ ...s, [pair.key]: out }));
    if (out.status === 'done' && onResolved) onResolved(pair, target);
  };

  if (rows.length === 0) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 110 }}>
        <div style={{ fontSize: 52 }}>🍵</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 23, fontWeight: 650, color: C.harborInk, marginTop: 10 }}>
          {S.inboxEmptyTitle}
        </div>
        <div style={{ color: C.muted, fontSize: 15.5, marginTop: 8, lineHeight: 1.6, maxWidth: 280, marginInline: 'auto' }}>
          {S.inboxEmptyBody}
        </div>
      </div>
    );
  }

  // The server tags anything older than PENDING_STALE_DAYS. Fresh rows are the
  // daily list; stale ones live behind one card. Burying today's two purchases
  // under forty months-old travel rows would turn a 5-second chore into a
  // backlog — which is the exact friction the whole design exists to prevent.
  const fresh = rows.filter((r) => !r.item.stale);
  const stale = rows.filter((r) => r.item.stale);
  /**
   * THE HEADLINE COUNTS EVERY ROW, INCLUDING THE FOLDED ONES (finding S3).
   *
   * It used to count `fresh` while the tab badge counted all of `pending`, so
   * the app showed a red 4 over a list headed «2 عمليات مستنية». Both numbers
   * were defensible and together they were a contradiction on the home screen —
   * the same class of thing `needsHim` exists to make impossible between the
   * badge, the header and the buttons.
   *
   * Counting everything here is the honest direction rather than teaching the
   * badge to count fresh: the four rows all need him, and the two that are old
   * are folded, not cancelled. The arithmetic is now visible on one screen —
   * two cards, plus «مصاريف قديمة (2)» right under them, equals the four the
   * badge claims.
   */
  const head = headlineFor(rows);
  // The batch's contents, from the shared rule — the button's label counts the
  // very list it will send, so the two cannot disagree.
  const batch = onConfirmMany ? batchable(fresh) : [];
  const HEADLINE = {
    waiting: S.inboxWaiting(head.count),
    saving: S.cardSaving,
    queued: S.cardQueued,
    done: S.inboxAllDone,
  };

  return (
    <div>
      {/* Rendered whenever there is anything at all — a month where every
          outstanding row is old still has a headline, and it still counts them. */}
      {rows.length > 0 && <SectionLabel>{HEADLINE[head.kind]}</SectionLabel>}

      {/**
        * THE BATCH (finding M4). Offered only when it saves him something: at one
        * row it is the same tap as the card's own green button, one row further
        * down, so it is noise. From two it is the difference between an evening
        * pass and a queue.
        *
        * It never appears on rows the app has not earned — `batchable` excludes
        * anything without a server guess (D5) — so this button can only ever do
        * what the green buttons under it would have done.
        */}
      {batch.length > 1 && (
        <button
          className="bigbtn"
          onClick={() => onConfirmMany(batch.map((r) => r.item))}
          style={{
            width: '100%', minHeight: 52, borderRadius: RADIUS.row, marginBottom: 14,
            background: C.harbor, color: C.onDark, fontSize: 17, fontWeight: 700,
          }}
        >
          ✓ {S.inboxBatch(batch.length)}
        </button>
      )}

      {/**
        * U4 — the duplicate pairs, above the ordinary cards: a pair is money
        * possibly counted TWICE, which outranks a missing category. The
        * ordinary case — no pairs — renders nothing at all.
        */}
      {(dup.pairs.length > 0 || dup.bigGroups.length > 0) && (
        <div style={{ marginBottom: 6 }}>
          <SectionLabel>{S.dupPairTitle}</SectionLabel>
          {dup.pairs.map((pair) => (
            <PairCard
              key={pair.key}
              pair={pair}
              outcome={pairOutcomes[pair.key] || null}
              canRemove={canRemove}
              onRemove={(idx) => resolvePair(pair, idx)}
            />
          ))}
          {dup.bigGroups.map((g) => (
            <GroupCard key={g.key} group={g} />
          ))}
        </div>
      )}

      {fresh.map((row) => (
        <PendingCard key={row.key} item={row.item} outcome={row.outcome} onConfirm={onConfirm} />
      ))}
      {stale.length > 0 && <StaleGroup rows={stale} onConfirm={onConfirm} />}
    </div>
  );
}

function StaleGroup({ rows, onConfirm }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 8 }}>
      <button
        className="catchip"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', minHeight: 56, borderRadius: RADIUS.row, padding: '12px 16px',
          background: open ? C.mist : C.card, border: `1px dashed ${C.harbor}`,
          color: C.harborInk, fontSize: 16, fontWeight: 700, textAlign: 'start',
        }}
      >
        {S.inboxOldTitle(remaining(rows) || rows.length)}
        <div style={{ fontSize: 13, fontWeight: 500, color: C.muted, marginTop: 2 }}>
          {open ? S.inboxOldHide : S.inboxOldBody}
        </div>
      </button>
      {open && (
        <div style={{ marginTop: 12 }}>
          {rows.map((row) => (
            <PendingCard key={row.key} item={row.item} outcome={row.outcome} onConfirm={onConfirm} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * ONE PAIR, ONE DECISION (§3.9). Both rows fully legible — day, method,
 * amount, words — with the DIFFERING fields set heavier, because the
 * difference is what the decision turns on. Each row offers «شيل الصف ده»;
 * removing either one IS keeping the other («keep this» and «remove that»
 * are the same decision from opposite ends — the Owner's exact logic), and
 * the body sentence says so in words. The swipe is an affordance; the
 * buttons are the floor. No colour celebrates and nothing counts a streak:
 * resolving a duplicate is bookkeeping.
 */
function PairCard({ pair, outcome, canRemove, onRemove }) {
  const touch = useRef(null);
  const [a, b] = pair.items;
  const diffs = pairDiffs(a && a.match, b && b.match);
  const status = outcome && outcome.status;
  const decided = status === 'done' || status === 'gone' || status === 'engine';
  const offerButtons = canRemove && !decided && status !== 'saving';

  const start = (idx) => (e) => {
    const t = e.touches && e.touches[0];
    touch.current = { idx, x: t ? t.clientX : 0 };
  };
  const end = (idx) => (e) => {
    const t = touch.current;
    touch.current = null;
    if (!t || t.idx !== idx || !offerButtons) return;
    const c = e.changedTouches && e.changedTouches[0];
    if (c && Math.abs(c.clientX - t.x) >= 56) onRemove(idx);
  };

  const advisory = (words) => (
    <div style={{
      marginTop: 8, padding: '9px 11px', borderRadius: RADIUS.inset,
      background: C.sand, border: `1px solid ${C.line}`,
      fontSize: TYPE.label, color: C.ink, lineHeight: 1.5,
    }}>
      {words}
    </div>
  );

  const rowPanel = (item, idx) => {
    const m = (item && item.match) || {};
    const removedThis = status === 'done' && outcome.removedIdx === idx;
    return (
      <div
        key={idx}
        onTouchStart={offerButtons ? start(idx) : undefined}
        onTouchEnd={offerButtons ? end(idx) : undefined}
        style={{
          marginTop: 8, padding: '9px 11px', borderRadius: RADIUS.inset,
          background: C.card, opacity: removedThis ? 0.55 : 1,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
          <span
            dir="auto"
            style={{
              fontSize: TYPE.label, color: C.ink,
              fontWeight: diffs.indexOf('description') !== -1 ? 800 : 600,
              minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...ISOLATE,
            }}
          >
            {m.description || S.dupNoDescription}
          </span>
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: TYPE.label, fontWeight: 700, color: C.ink, flexShrink: 0, ...LATIN, ...NUMERALS }}>
            {amountWithCurrency(m.amount, m.currency)}
          </span>
        </div>
        {/* Row meta — the method chip is the usual difference, and the two
            chips' own skins (mist vs sand) already set the pair apart. */}
        <div style={{ fontSize: TYPE.caption, color: C.muted, marginTop: 4, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip kind={m.method} small label={m.method === 'Visa' ? S.metricVisa : S.metricCash} />
          <span style={LATIN}>{m.date}</span>
        </div>
        {removedThis && (
          <div style={{ fontSize: TYPE.label, color: C.muted, marginTop: 6 }}>{S.dupPairRemoved}</div>
        )}
        {status === 'done' && !removedThis && (
          <div style={{ fontSize: TYPE.label, fontWeight: 700, color: C.settledInk, marginTop: 6 }}>{S.dupPairSurvives}</div>
        )}
        {offerButtons && (
          <button
            onClick={() => onRemove(idx)}
            style={{
              width: '100%', minHeight: TAP, marginTop: 8, borderRadius: RADIUS.inset,
              background: C.shell, border: `1px solid ${C.line}`,
              color: C.ink, fontSize: TYPE.label, fontWeight: 700,
            }}
          >
            {S.dupPairRemove}
          </button>
        )}
      </div>
    );
  };

  return (
    <div style={{
      padding: '13px 15px', borderRadius: RADIUS.row, marginBottom: 10,
      background: C.conflictBg, border: `1px solid ${C.conflictLine}`,
    }}>
      {/* The tier in words — a percentage would invite trust the detector
          has no basis to produce (state/duplicates.js's own law). */}
      <div style={{ color: C.muted, fontSize: TYPE.label, fontWeight: 700 }}>{S.dupTier(pair.tier)}</div>
      <div style={{ color: C.ink, fontSize: TYPE.label, marginTop: 4, lineHeight: 1.55 }}>{S.dupPairBody}</div>
      {rowPanel(a, 0)}
      {rowPanel(b, 1)}
      {status === 'saving' && (
        <div style={{ fontSize: TYPE.label, color: C.muted, marginTop: 8 }}>{S.cardSaving}</div>
      )}
      {status === 'failed' && (
        <div style={{ fontSize: TYPE.label, color: C.conflictInk, marginTop: 8 }}>{S.dupPairFailed}</div>
      )}
      {status === 'offline' && advisory(S.editOffline)}
      {status === 'gone' && (
        <div style={{ fontSize: TYPE.label, color: C.ink, marginTop: 8, lineHeight: 1.5 }}>{S.dupPairGone}</div>
      )}
      {/**
        * The door the server does not have yet — the voice button's own era:
        * the pair is SHOWN (detection is the client's knowledge), the state is
        * said honestly, and no control posts into the void. Fires both when
        * the advertisement is absent (fail closed) and when a stale capability
        * cache let a press through to an `unknown_action` answer.
        */}
      {(!canRemove || status === 'engine') && advisory(S.dupNeedsEngine)}
      {status === 'conflict' && (
        <div style={{
          marginTop: 8, padding: '9px 11px', borderRadius: RADIUS.inset,
          background: C.card, border: `1px solid ${C.conflictLine}`,
        }}>
          <div style={{ fontSize: TYPE.label, fontWeight: 700, color: C.conflictInk }}>{S.editConflict}</div>
          <div style={{ fontSize: TYPE.label, color: C.ink, marginTop: 3 }}>
            {S.cardConflictIs}{' '}
            <span dir="auto" style={ISOLATE}>{outcome.current ? outcome.current.description : ''}</span>{' '}
            <span style={{ fontWeight: 700, ...LATIN, ...NUMERALS }}>
              {outcome.current ? amountWithCurrency(outcome.current.amount, outcome.current.currency) : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Three or more alike: LEGIBLE, counted, and handed to the sheet — §3.9
 * resolves pairs, and an arbitrary pair inside a trio would be a guess about
 * which two are the same expense. No control here acts.
 */
function GroupCard({ group }) {
  return (
    <div style={{
      padding: '13px 15px', borderRadius: RADIUS.row, marginBottom: 10,
      background: C.conflictBg, border: `1px solid ${C.conflictLine}`,
    }}>
      <div style={{ color: C.muted, fontSize: TYPE.label, fontWeight: 700 }}>{S.dupTier(group.tier)}</div>
      <div style={{ color: C.ink, fontSize: TYPE.label, marginTop: 4, lineHeight: 1.55 }}>{S.dupGroupBig(group.count)}</div>
      {group.items.map((item, i) => {
        const m = (item && item.match) || {};
        return (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 6 }}>
            <span dir="auto" style={{ fontSize: TYPE.label, color: C.ink, ...ISOLATE }}>{m.description || S.dupNoDescription}</span>
            <span style={{ fontSize: TYPE.label, fontWeight: 700, color: C.ink, ...LATIN, ...NUMERALS }}>
              {amountWithCurrency(m.amount, m.currency)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PendingCard({ item, outcome, onConfirm }) {
  const p = item.match;

  /**
   * The buttons live in `components/CategoryPicker.jsx` — the SAME component the
   * Recent list uses, because tapping a category here and tapping one there are
   * the same act on the same sheet cell. Two copies would be two places for the
   * outcome states to drift.
   */
  const inert = !needsHim(outcome);

  return (
    <div
      className="card-in"
      style={{
        background: C.card, borderRadius: RADIUS.card, padding: 16, marginBottom: 14,
        opacity: inert ? 0.62 : 1,
        transition: 'opacity .2s ease',
      }}
    >
      {/**
        * THE MERCHANT LEADS (finding M3).
        *
        * The amount used to be set at 30px with the merchant at 17.5px under it.
        * But the question this card asks is "what KIND of purchase was this?",
        * and only the merchant answers it — the amount is context. He is not
        * deciding anything about 860; he is deciding about Nile Star Market.
        *
        * The two also swapped places for a second reason: at 30px the amount
        * plus a 56px guess button plus twenty-seven chips made one card taller
        * than the viewport. Merchant-leading with the amount beside it puts three
        * cards on screen where there were one and a half, which is what makes the
        * evening pass feel like a pass rather than a queue.
        */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        /* A10 (glass audit Tier 2): LATIN -> ISOLATE. HANDOFF:61 reserves direction:ltr for amounts, dates, the status bar and URLs. This is p.description — the bank SMS merchant, often Arabic, which is none of those and reaches this element in Arabic. LATIN's direction:ltr also silently defeated the dir="auto" on the same element. Same defect the file documents at Primitives.jsx:17 as «قهوة60». */
        <div style={{ fontSize: 19, fontWeight: 650, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...ISOLATE }} dir="auto">
          {p.description}
        </div>
        {/* A row he never priced has NO amount. Rendering money(null) as "0"
            would state a figure he never wrote — the same lie the unpriced
            counter exists to prevent. Show the absence instead. */}
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 650, color: C.ink, flexShrink: 0, ...LATIN, ...NUMERALS }}>
          {p.amount == null ? '—' : money(p.amount)}{' '}
          {/* caption (ruling 2): a unit suffix duplicates the amount beside it */}
          {p.amount != null && <span style={{ fontSize: TYPE.caption, color: C.muted, fontWeight: 500 }}>{p.currency}</span>}
        </div>
      </div>

      {/* caption (ruling 2): row meta — method chip, date, travel flag — restates the row */}
      <div style={{ fontSize: TYPE.caption, color: C.muted, marginTop: 5, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip kind={p.method} small label={p.method === 'Visa' ? S.metricVisa : S.metricCash} />
        <span style={LATIN}>{p.date}</span>
        {/* Only a REAL foreign currency is travel. An unpriced row has
            currency null, and `null !== 'EGP'` would mislabel it. */}
        {p.currency && p.currency !== 'EGP' ? <span>{S.travel}</span> : null}
      </div>

      <OutcomeNote outcome={outcome} />

      <CategoryActions guess={item.guess} outcome={outcome} onPick={(c) => onConfirm(item, c)} />

      {/**
        * «الرسالة الأصلية» IS GONE (finding S10).
        *
        * The prototype showed the original bank SMS here, which was a real
        * "show your work" gesture. The row now comes from the sheet instead, so
        * what the disclosure actually revealed was `Aug · #14` — a tab name and
        * a row index. That is a developer's breadcrumb: it names a place he
        * cannot go, in a vocabulary he does not use, and it sat on the card he
        * taps most often in the app.
        *
        * The honest version of the same gesture is «افتح الشيت» at the foot of
        * the book, where it opens the actual file. This card keeps the amount,
        * the merchant and the date — which is everything the sheet row holds.
        */}
    </div>
  );
}

// Re-exported so a caller never has a reason to write its own copy of the key
// rule — one definition, asserted in scripts/test-inbox.mjs.
export { cardKey };
