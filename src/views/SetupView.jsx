import { useState } from 'react';
import { C, FONT_DISPLAY } from '../theme.js';
import { S } from '../i18n/strings.js';
import { LangToggle } from '../components/Primitives.jsx';
import { probe } from '../api/client.js';
import { setCreds } from '../state/secret.js';

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
        setCreds(secret.trim(), url.trim());
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

  const field = {
    width: '100%', padding: '14px 14px', borderRadius: 12,
    border: `1.5px solid ${C.line}`, background: C.card, color: C.ink,
    fontSize: 16, outline: 'none', marginTop: 6,
  };

  return (
    <div style={{ padding: '8px 4px' }}>
      {/* First run: the same one-tap switch, before he has typed anything. */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <LangToggle subtle />
      </div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 650, color: C.harbor }}>
        {S.setupTitle}
      </div>
      <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.7, margin: '8px 0 18px' }}>
        {S.setupBody}
      </p>

      <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.muted }}>
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

      <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: C.muted, marginTop: 14 }}>
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

      {state === 'error' && (
        <div style={{ color: C.conflictInk, fontSize: 14.5, marginTop: 10, lineHeight: 1.6 }}>{error}</div>
      )}

      <button
        className="bigbtn"
        onClick={test}
        disabled={state === 'testing'}
        style={{
          marginTop: 18, width: '100%', minHeight: 56, padding: '16px 0', borderRadius: 14,
          background: state === 'testing' ? C.line : C.harbor,
          color: state === 'testing' ? C.muted : C.onDark,
          fontSize: 17.5, fontWeight: 700,
        }}
      >
        {state === 'testing' ? S.setupTesting : S.setupTest}
      </button>
    </div>
  );
}
