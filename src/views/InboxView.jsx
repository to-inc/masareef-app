import { useState, useRef } from 'react';
import { C, FONT_DISPLAY, FONT_UI, NUMERALS, RADIUS, TAP, TYPE, glass, unitSize, SHEET } from '../theme.js';
import { S, DIR, unitFor } from '../i18n/strings.js';
import { money2, amountWithCurrency } from '../lib/format.js';
import { SectionLabel, Chip, LATIN, ISOLATE } from '../components/Primitives.jsx';
import { OutcomeNote, CategoryActions } from '../components/CategoryPicker.jsx';
import { cardKey, reconcile, remaining, needsHim, headlineFor } from '../state/inboxOutcomes.js';
import { findLookalikes } from '../state/duplicates.js';
import { supportsAction, loadBuild } from '../state/capabilities.js';
import { removeEntry } from '../api/index.js';
import EditSheet from './EditSheet.jsx';
import { outcomeForRemove } from '../state/removeOutcome.js';

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
export { outcomeForRemove } from '../state/removeOutcome.js';

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
  /**
   * E-002 — the review card's edit door. A pending row carries the SERVER's
   * own tab + rowHint + match, the exact identity EditSheet posts, so this is
   * the Book's door re-used — not a second editor. After a save the list
   * refetches (`onEdited`): the server's re-read is the truth, not a guess.
   */
  onEdited = null,
  initialEditing = null,
  initialStaleOpen = false, // SSR seam: render the older group unfolded
}) {
  const [editing, setEditing] = useState(initialEditing);
  // v4 P6: «سيبها لبعدين» moves a card to the END of the queue; it writes nothing.
  const [skipped, setSkipped] = useState([]);
  // E-011 — rows he removed from the edit sheet leave the list at once; the
  // refetch (`onEdited`) then makes it the server's word, not ours.
  const [removedHere, setRemovedHere] = useState(() => new Set());
  const canEdit = supportsAction(build, 'edit_entry');
  const openEdit = canEdit ? (item) => setEditing(item) : null;
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
  const rows = reconcile(pending, settled).filter((r) => !removedKeys.has(r.key) && !removedHere.has(r.key));

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
        <div data-geometry="empty-state-illustration" style={{ fontSize: 52 }}>🍵</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: TYPE.section, fontWeight: 650, color: C.harborInk, marginTop: 10 }}>
          {S.inboxEmptyTitle}
        </div>
        <div style={{ color: C.muted, fontSize: TYPE.body, marginTop: 8, lineHeight: 1.6, maxWidth: 280, marginInline: 'auto' }}>
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
  /**
   * v4 P6 (R18) — REVIEW ONE AT A TIME. The queue is the fresh rows that still
   * need him, in their own order, with anything he skipped moved to the end.
   * Filing the focus card settles it and the next one slides in. The bulk
   * «file all N» button is DROPPED in focus mode (R18).
   */
  const needing = fresh.filter((r) => needsHim(r.outcome));
  const queue = focusQueue(needing, skipped);
  const current = queue[0] || null;
  const total = fresh.length;
  const position = total - needing.length + 1;
  const head = headlineFor(fresh);
  const FINISHED = { saving: S.cardSaving, queued: S.cardQueued, done: S.reviewDone, waiting: S.reviewDone };

  return (
    <div>
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

      {total > 0 && current && (
        <>
          {/* «1 من 3» and its dots — where he is, never a score. */}
          <div aria-live="polite" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, fontSize: TYPE.label, color: C.muted, fontWeight: 600 }}>
            {S.reviewProgress(Math.min(position, total), total)}
            {total <= 8 && (
              <span aria-hidden style={{ display: 'flex', gap: 5 }}>
                {fresh.map((r, i) => (
                  // geometry exemption (ruling 4): progress dots — a 6px pill, its corner bounded by its height
                  <span key={r.key} style={{ width: i === Math.min(position, total) - 1 ? 18 : 6, height: 6, borderRadius: 3, background: i === Math.min(position, total) - 1 ? C.harbor : SHEET.handle }} />
                ))}
              </span>
            )}
          </div>
          <div style={{ position: 'relative', paddingTop: 22 }}>
            {queue.length > 1 && (
              // The card behind says «more are waiting» — nothing else.
              <div aria-hidden style={{ ...glass('peek'), position: 'absolute', insetInline: 14, top: 34, bottom: -12 }} />
            )}
            <PendingCard
              key={current.key}
              item={current.item}
              outcome={current.outcome}
              onConfirm={onConfirm}
              onOpenEdit={openEdit}
              onSkip={queue.length > 1 ? () => setSkipped((sk) => [...sk.filter((k) => k !== current.key), current.key]) : null}
              focus
            />
          </div>
        </>
      )}
      {total > 0 && !current && (
        <div aria-live="polite" style={{ textAlign: 'center', padding: '40px 0 24px', fontFamily: FONT_DISPLAY, fontSize: TYPE.section, fontWeight: 650, color: C.harborInk }}>
          {FINISHED[head.kind]}
        </div>
      )}

      {stale.length > 0 && <StaleGroup rows={stale} onConfirm={onConfirm} onOpenEdit={openEdit} initialOpen={initialStaleOpen} />}

      {editing && (
        <EditSheet
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { if (onEdited) onEdited(); }}
          canRemove={canRemove}
          onRemoved={(it) => {
            setRemovedHere((s) => new Set(s).add(cardKey(it)));
            setEditing(null);
            if (onEdited) onEdited();
          }}
        />
      )}
    </div>
  );
}

function StaleGroup({ rows, onConfirm, onOpenEdit, initialOpen = false }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <div style={{ marginTop: 14 }}>
      {/* v4 P6: one 56px sand-glass row; the WHOLE row is the target (R3) — the
          chevron is decoration. It opens the drawer of older expenses. */}
      <button
        className="catchip"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{
          ...glass('advisory'), borderRadius: RADIUS.glassWell, width: '100%', minHeight: 56, padding: '8px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, color: C.ink, textAlign: 'start',
        }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: TYPE.label, fontWeight: 700 }}>{S.inboxOldTitle(remaining(rows))}</span>
          <span style={{ fontSize: TYPE.caption, fontWeight: 500, color: C.muted }}>{open ? S.inboxOldHide : S.inboxOldBody}</span>
        </span>
        <span aria-hidden style={{ fontSize: TYPE.row, fontWeight: 700, color: C.muted }}>{open ? '⌄' : DIR === 'rtl' ? '‹' : '›'}</span>
      </button>
      {open && (
        <div style={{ marginTop: 12 }}>
          {rows.map((row) => (
            <PendingCard key={row.key} item={row.item} outcome={row.outcome} onConfirm={onConfirm} onOpenEdit={onOpenEdit} />
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
/** A horizontal swipe of at least 56px that moved at least twice as far across as down. */
export const isSwipe = (dx, dy) => dx >= 56 && dx >= 2 * dy;

function PairCard({ pair, outcome, canRemove, onRemove }) {
  const touch = useRef(null);
  const [a, b] = pair.items;
  const diffs = pairDiffs(a && a.match, b && b.match);
  const status = outcome && outcome.status;
  const decided = status === 'done' || status === 'gone' || status === 'engine';
  const offerButtons = canRemove && !decided && status !== 'saving';

  const start = (idx) => (e) => {
    const t = e.touches && e.touches[0];
    touch.current = { idx, x: t ? t.clientX : 0, y: t ? t.clientY : 0 };
  };
  const end = (idx) => (e) => {
    const t = touch.current;
    touch.current = null;
    if (!t || t.idx !== idx || !offerButtons) return;
    const c = e.changedTouches && e.changedTouches[0];
    // E-006: a swipe is mostly sideways. A diagonal scroll travels as far down
    // as across, and used to remove a row on its way past.
    const dx = c ? Math.abs(c.clientX - t.x) : 0;
    const dy = c ? Math.abs(c.clientY - t.y) : 0;
    if (isSwipe(dx, dy)) onRemove(idx);
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

/**
 * THE REVIEW QUEUE (v4 P6): rows that still need him, in their own order, with
 * the ones he skipped moved to the END in the order he skipped them. Pure — the
 * skip writes nothing anywhere; it only changes what comes next.
 */
export function focusQueue(needing, skipped) {
  return [
    ...needing.filter((r) => !skipped.includes(r.key)),
    ...skipped.map((k) => needing.find((r) => r.key === k)).filter(Boolean),
  ];
}

/**
 * ONE EXPENSE ON A GLASS CARD (v4 P6). Method · date, the shop, the amount with
 * its unit, then the picker (the guess, then «ولا…» and the 2×2 grid). In focus
 * mode the card closes on «سيبها لبعدين» (skip — writes nothing) beside «عدّل».
 */
function PendingCard({ item, outcome, onConfirm, onOpenEdit = null, onSkip = null, focus = false }) {
  const p = item.match;
  // Dimmed only while a write is in flight or queued — a LOGGED card stays at
  // full strength, because it can still be changed (CategoryActions).
  const inert = !!outcome && (outcome.status === 'saving' || outcome.status === 'queued');
  return (
    <div
      className="card-in"
      style={{
        ...glass('card'), position: 'relative', padding: focus ? '26px 22px 18px' : 18, marginBottom: 14,
        opacity: inert ? 0.62 : 1, transition: 'opacity .2s ease',
      }}
    >
      {/* caption (ruling 2): row meta — method chip, date, travel flag — restates the row */}
      <div style={{ fontSize: TYPE.caption, color: C.muted, fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip kind={p.method} small label={p.method === 'Visa' ? S.metricVisa : S.metricCash} />
        <span style={LATIN}>{p.date}</span>
        {/* Only a REAL foreign currency is travel; an unpriced row has currency null. */}
        {p.currency && p.currency !== 'EGP' ? <span>{S.travel}</span> : null}
      </div>
      <div style={{ fontSize: TYPE.section, fontWeight: 650, marginTop: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...ISOLATE }} dir="auto">
        {p.description}
      </div>
      {/* A row he never priced has NO amount: «—», never a «0» he never wrote. */}
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: TYPE.amountReview, fontWeight: 650, lineHeight: 1.1, marginTop: 6, color: C.ink, ...NUMERALS, ...LATIN, textAlign: DIR === 'rtl' ? 'right' : 'left' }}>
        {p.amount == null ? '—' : money2(p.amount)}
        {p.amount != null && (
          <span style={{ fontFamily: FONT_UI, fontSize: unitSize(TYPE.hero), fontWeight: 600, color: C.muted }}> {unitFor(p.currency || 'EGP')}</span>
        )}
      </div>

      <OutcomeNote outcome={outcome} />

      <CategoryActions guess={item.guess} outcome={outcome} onPick={(c) => onConfirm(item, c)} />

      {(onSkip || onOpenEdit) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {onSkip && (
            <button onClick={onSkip}
              style={{ flex: 1, minHeight: TAP, background: 'transparent', color: C.muted, fontSize: TYPE.label, fontWeight: 600, borderRadius: RADIUS.capsule }}>
              {S.reviewSkip}
            </button>
          )}
          {/* E-002 — fix the amount, currency, method, date or wording in place.
              Gated fail-closed on the server advertising `edit_entry` (§3.7). */}
          {onOpenEdit && (
            <button
              onClick={() => onOpenEdit(item)}
              style={{ flex: 1, minHeight: TAP, borderRadius: RADIUS.capsule, background: 'transparent', color: C.harborInk, fontSize: TYPE.label, fontWeight: 700 }}
            >
              {S.editOpen}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export { cardKey };
