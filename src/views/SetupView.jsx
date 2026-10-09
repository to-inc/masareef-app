import { useState } from 'react';
import { C, FONT_DISPLAY, RADIUS, TYPE, glass, GRADIENT, FIELD_EDGE } from '../theme.js';
import { S } from '../i18n/strings.js';
import { LangToggle } from '../components/Primitives.jsx';
import { probe } from '../api/client.js';
import { setCreds } from '../state/secret.js';
import { askBadgeOnce } from '../state/badge.js';

/**
 * First-run credential entry. TAREK-FACING — Dad should never see this screen.
 *
 * It exists because iOS partitions an installed PWA's storage from Safari's: a
 * setup link opened in Safari cannot hand credentials to the home-screen app, so
 * paste-once inside the installed app is the simplest thing that actually works.
 *
 * The pair is validated with a real `ping` BEFORE being stored — storing a typo
 * would leave the app permanently unable to reach the sheet with no clue why.
 * The prefill is dev-only: `import.meta.env` is statically replaced at build
 * time, and `.env.production` carries an empty URL, so the shipped bundle
 * contains neither a URL nor a secret.
 */
const DEV_PREFILL = import.meta.env.DEV ? (import.meta.env.VITE_GAS_URL || '') : '';

export default function SetupView({ onDone }) {
  const [url, setUrl] = useState(DEV_PREFILL);
  const [secret, setSecret] = useState('');
  // Optional (A7). Never a gate: an empty field means no link, not a broken setup.
  const [sheet, setSheet] = useState('');
  const [state, setState] = useState('idle');   // idle | testing | error
  const [error, setError] = useState('');

  const test = async () => {
    if (!url.trim() || !secret.trim()) {
      setState('error');
      setError(S.setupNeedBoth);
      return;
    }
    setState('testing');
    setError('');
    try {
      const res = await probe(url.trim(), secret.trim());
      if (res?.ok) {
        setCreds(secret.trim(), url.trim(), sheet.trim());
        // R19: the ONE permission ask — on this tap, because iOS badges the
        // icon only with it. The app never sends a notification.
        await askBadgeOnce();
        onDone();
        return;
      }
      setState('error');
      setError(res?.error === 'bad_secret' ? S.setupBadSecret : S.setupUnreachable);
    } catch {
      setState('error');
      setError(S.setupUnreachable);
    }
  };

  // G08 (v4 tokens): solid white fields — text he types goes on paper, not glass —
  // with an edge that clears 3:1 against them (WCAG 1.4.11). The old C.line edge
  // measured ~1.3:1: on a phone in daylight the boxes were barely there.
  const field = {
    width: '100%', boxSizing: 'border-box', padding: '14px 14px', borderRadius: RADIUS.row,
    border: `1.5px solid ${FIELD_EDGE}`, background: C.card, color: C.ink,
    fontSize: TYPE.body, outline: 'none', marginTop: 6,
  };

  return (
    <div style={{ padding: '8px 4px' }}>
      {/* First run: the same one-tap switch, before he has typed anything. */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <LangToggle subtle />
      </div>
      {/* G08 (v4): titles are ink at TYPE.title, as on every v4 screen. */}
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: TYPE.title, fontWeight: 650, color: C.ink }}>
        {S.setupTitle}
      </div>
      <p style={{ fontSize: TYPE.label, color: C.muted, lineHeight: 1.7, margin: '8px 0 18px' }}>
        {S.setupBody}
      </p>

      {/* G08: the three fields and the action sit on ONE glass card. */}
      <div style={{ ...glass('card'), padding: '18px 16px 16px' }}>

      <label style={{ display: 'block', fontSize: TYPE.label, fontWeight: 600, color: C.muted }}>
        {S.setupUrl}
        <input
          type="url"
          inputMode="url"
          dir="ltr"
          autoComplete="off"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setState('idle'); }}
          placeholder="https://script.google.com/macros/s/…/exec"
          style={field}
        />
      </label>

      <label style={{ display: 'block', fontSize: TYPE.label, fontWeight: 600, color: C.muted, marginTop: 14 }}>
        {S.setupSecret}
        <input
          type="password"
          dir="ltr"
          autoComplete="off"
          value={secret}
          onChange={(e) => { setSecret(e.target.value); setState('idle'); }}
          style={field}
        />
      </label>

      {/**
        * HIS SHEET'S ADDRESS (finding A7) — optional, and it is the last field
        * on purpose. The two above are what the app cannot work without; this
        * one only decides whether «افتح الشيت» appears at the foot of the Book.
        * It is validated on READ rather than here (state/secret.js accepts only
        * an https docs.google.com/spreadsheets URL), so a typo costs him a
        * missing link rather than a failed setup.
        */}
      <label style={{ display: 'block', fontSize: TYPE.label, fontWeight: 600, color: C.muted, marginTop: 14 }}>
        {S.setupSheet}
        <input
          type="url"
          inputMode="url"
          dir="ltr"
          autoComplete="off"
          placeholder="https://docs.google.com/spreadsheets/…"
          value={sheet}
          onChange={(e) => setSheet(e.target.value)}
          style={field}
        />
        <span style={{ display: 'block', fontSize: TYPE.label, fontWeight: 500, color: C.muted, marginTop: 4, lineHeight: 1.6 }}>
          {S.setupSheetHint}
        </span>
      </label>

      {state === 'error' && (
        <div style={{ color: C.conflictInk, fontSize: TYPE.label, marginTop: 10, lineHeight: 1.6 }}>{error}</div>
      )}

      <button
        className="bigbtn"
        onClick={test}
        disabled={state === 'testing'}
        style={{
          marginTop: 18, width: '100%', minHeight: 56, padding: '16px 0', borderRadius: RADIUS.row,
          background: state === 'testing' ? C.line : GRADIENT.harbor,
          color: state === 'testing' ? C.muted : C.onDark,
          fontSize: TYPE.action, fontWeight: 700,
        }}
      >
        {state === 'testing' ? S.setupTesting : S.setupTest}
      </button>
      <div style={{ fontSize: TYPE.caption, color: C.muted, marginTop: 10, lineHeight: 1.6, textAlign: 'center' }}>
        {S.setupBadgeNote}
      </div>
      </div>
    </div>
  );
}
