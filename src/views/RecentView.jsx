import { useState, useEffect, useCallback } from 'react';
import { C, FONT_DISPLAY, NUMERALS, TAP } from '../theme.js';
import { S, monthByTab } from '../i18n/strings.js';
import { money } from '../lib/format.js';
import { fetchEntries } from '../api/index.js';
import { Chip, LATIN, SectionLabel } from '../components/Primitives.jsx';
import { OutcomeNote, CategoryActions } from '../components/CategoryPicker.jsx';
import { cardKey, needsHim } from '../state/inboxOutcomes.js';
import {
  FILTERS, monthsFor, filterEntries, undatedIn, sortForDisplay,
} from '../state/recent.js';

/**
 * «الأخير» — his own rows, and one tap to fix any of them (D16).
 *
 * The Inbox only ever shows what nobody has categorised. This is everything: he
 * comes here to find a purchase he remembers, check what it was filed as, and
 * change it. Editing uses the SAME component the Inbox card does — tapping a
 * category here and tapping one there are the same act on the same sheet cell,
 * and two chip sheets would be two places for the outcome states to drift.
 *
 * The edit posts `match` with NO `rowHint`, taking the server's content-scan
 * path by contract (06 §2.4). That is deliberate: a Recent row is identified by
 * what it says, not by where it happened to sit when it was fetched.
 */
export default function RecentView({ todayCairo, settled, onEdit, onBusyChange }) {
  const [filter, setFilter] = useState('today');
  const [browsing, setBrowsing] = useState(null);   // a specific {y,m}, or null
  const [rows, setRows] = useState([]);
  const [tabName, setTabName] = useState('');
  const [undated, setUndated] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const months = browsing ? [browsing] : monthsFor(filter, todayCairo);
      const answers = await Promise.all(months.map((ref) => fetchEntries(ref)));
      const all = answers.flatMap((a) => (a && Array.isArray(a.entries) ? a.entries : []));
      // A month he is browsing shows everything in it; the three filters window
      // the current month (and the previous one, when the week straddles).
      const shown = browsing ? all : filterEntries(all, filter, todayCairo);
      setRows(sortForDisplay(shown));
      setTabName(answers.length === 1 && answers[0] ? answers[0].tab || '' : '');
      /**
       * Counted from the rows ON SCREEN, not from a month's server count: a week
       * spanning two months is assembled from two responses and neither one's
       * figure describes it. For a whole month the two agree.
       */
      setUndated(browsing || filter === 'month' ? 0 : undatedIn(all));
      return true;
    } catch {
      // Losing signal in Cairo is normal. Keep what is on screen and say nothing
      // it cannot back up — the shell's offline banner is the one that speaks.
      return false;
    } finally {
      setLoading(false);
    }
  }, [filter, browsing, todayCairo]);

  useEffect(() => { load(); }, [load]);
  // The header's refresh button reloads THIS view's data while it is showing.
  useEffect(() => { if (onBusyChange) onBusyChange(load); }, [onBusyChange, load]);

  const seg = (key, label, onClick, active) => (
    <button
      key={key}
      onClick={onClick}
      aria-pressed={active}
      style={{
        flex: 1, minHeight: TAP, padding: '11px 0', borderRadius: 999,
        background: active ? C.harbor : 'transparent',
        color: active ? C.onDark : C.ink,
        fontSize: 15, fontWeight: active ? 700 : 600,
      }}
    >
      {label}
    </button>
  );

  const LABEL = { today: S.periodToday, week: S.periodWeek, month: S.periodMonth };

  return (
    <div>
      <div style={{ display: 'flex', background: C.card, border: `1px solid ${C.line}`, borderRadius: 999, padding: 4, marginBottom: 12, gap: 2 }}>
        {FILTERS.map((f) => seg(f, LABEL[f], () => { setBrowsing(null); setFilter(f); }, !browsing && filter === f))}
      </div>

      {/**
        * THE MONTHS BROWSER. Every month of the book's year, enumerated blind —
        * the server answers an empty LIST for months he has not reached, so
        * browsing backwards is never an error (06 §2.4). Month numbers, never
        * constructed tab names: the client does arithmetic, the server names.
        */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 13, color: C.muted, alignSelf: 'center', whiteSpace: 'nowrap', marginInlineEnd: 4 }}>
          {S.recentMonths}
        </span>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
          const active = browsing && browsing.m === m;
          return (
            <button
              key={m}
              className="catchip"
              onClick={() => setBrowsing(active ? null : { y: todayCairo.y, m })}
              aria-pressed={!!active}
              style={{
                minHeight: TAP, padding: '0 14px', borderRadius: 999, whiteSpace: 'nowrap',
                background: active ? C.harbor : C.card,
                border: `1px solid ${active ? C.harbor : C.line}`,
                color: active ? C.onDark : C.ink, fontSize: 15, fontWeight: active ? 700 : 500,
              }}
            >
              {monthByTab(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1])}
            </button>
          );
        })}
      </div>

      {browsing && tabName && <SectionLabel>{monthByTab(tabName)}</SectionLabel>}

      {/* Rows he could not place are named rather than silently dropped. */}
      {undated > 0 && (
        <p style={{
          fontSize: 12.5, color: C.ink, background: C.sand, border: `1px solid ${C.line}`,
          borderRadius: 10, padding: '8px 12px', margin: '0 0 10px', lineHeight: 1.6, textAlign: 'center',
        }}>
          {S.recentUndatedNote(undated)}
        </p>
      )}

      {!loading && rows.length === 0 && (
        <div style={{ textAlign: 'center', paddingTop: 60, color: C.muted, fontSize: 15.5 }}>
          {S.recentEmpty}
        </div>
      )}

      {rows.map((row) => {
        /**
         * The settle key carries the row's CONTENT, because a Recent row has no
         * sheet position — two purchases from the same shop on the same day for
         * the same amount really are indistinguishable, here and in his book.
         * This value is a KEY only; the edit payload never carries a rowHint.
         */
        const item = { tab: tabName || row.date, rowHint: `${row.date}|${row.amount}`, match: row };
        const key = cardKey(item);
        const outcome = settled[key] || null;
        const isOpen = open === key;
        const inert = !needsHim(outcome);

        return (
          <div
            key={key}
            style={{
              background: C.card, border: `1px solid ${C.line}`, borderRadius: 14,
              marginBottom: 8, opacity: inert ? 0.62 : 1, transition: 'opacity .2s ease',
            }}
          >
            <button
              onClick={() => setOpen(isOpen ? null : key)}
              aria-expanded={isOpen}
              style={{
                width: '100%', minHeight: TAP, padding: '12px 14px', textAlign: 'start',
                background: 'transparent', display: 'grid', gap: 4,
                gridTemplateColumns: '1fr auto', alignItems: 'center',
              }}
            >
              <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 600, ...LATIN, overflow: 'hidden', textOverflow: 'ellipsis' }} dir="auto">
                  {row.description}
                </span>
                <span style={{ fontSize: 12.5, color: C.muted, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={LATIN}>{row.date}</span>
                  <Chip kind={row.method} small label={row.method === 'Visa' ? S.metricVisa : S.metricCash} />
                  <span style={{ ...LATIN, color: C.ink }} dir="auto">{row.category || '—'}</span>
                </span>
              </span>
              {/* An unpriced row renders —, never 0: a figure he never wrote. */}
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 17, fontWeight: 650, color: C.ink, ...LATIN, ...NUMERALS }}>
                {row.amount == null ? '—' : money(row.amount)}
                {row.amount != null && row.currency && row.currency !== 'EGP'
                  ? <span style={{ fontSize: 12, color: C.muted }}> {row.currency}</span> : null}
              </span>
            </button>

            {isOpen && (
              <div style={{ padding: '0 14px 14px' }}>
                <OutcomeNote outcome={outcome} />
                <CategoryActions
                  guess={null}
                  outcome={outcome}
                  onPick={(category) => onEdit(item, category)}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
