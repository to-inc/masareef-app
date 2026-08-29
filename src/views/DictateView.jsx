import { useState, useRef, useEffect } from 'react';
import { C, TAP, RADIUS, TYPE } from '../theme.js';
import { S } from '../i18n/strings.js';

/**
 * DICTATION (finding A5) — a text field, and the iOS keyboard's own microphone.
 *
 * ——— WHY A TEXT FIELD AND NOT A MICROPHONE BUTTON.
 *
 * The PWA design verified this and it is not a preference: `SpeechRecognition`
 * works in a Safari tab since iOS 14.5 and SILENTLY FAILS in a home-screen
 * installed app — the mic never engages, no error is raised, nothing happens.
 * It is a long-standing unfixed WebKit limitation, and this app is designed to
 * be installed, so an in-app voice button would be a dead control on the only
 * device that matters.
 *
 * Keyboard dictation is not that API. It is ordinary text input: the OS
 * transcribes into the field and the page sees keystrokes. So the control this
 * screen offers is a FIELD, and the microphone he taps is the one already on his
 * keyboard — where he has used it for years.
 *
 * ——— AND IT ADDS NO SERVER SURFACE.
 *
 * The text goes to `type:'voice'`, which has been in production since Phase 1
 * for the Siri Shortcut: it reads the first number as the amount, matches an
 * Arabic keyword for the category, defaults the method to Cash, and falls back
 * to ❓ rather than guessing. Nothing here is new except the way the sentence
 * arrives.
 *
 * ——— THE FIELD IS NEVER PARSED HERE.
 *
 * A second parser on the client would be the two-normalizers hazard in its
 * purest form: two implementations of "what did he say", disagreeing on the
 * Arabic-Indic digits that are the whole reason the server normalises. This
 * screen collects a sentence and posts it. The server decides what it means.
 */
export default function DictateView({ onSend, onCancel, busy }) {
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);
  const field = useRef(null);

  // Focus on open, so the keyboard — and its microphone — is already up.
  useEffect(() => { if (field.current) field.current.focus(); }, []);

  const ready = text.trim().length > 0;

  return (
    <div>
      <div style={{ fontSize: 19, fontWeight: 650, marginBottom: 6 }}>{S.dictateTitle}</div>
      <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.7, margin: '0 0 14px' }}>
        {S.dictateBody}
      </p>

      <textarea
        ref={field}
        value={text}
        onChange={(e) => { setText(e.target.value); setTouched(true); }}
        placeholder={S.dictatePlaceholder}
        rows={3}
        dir="auto"
        style={{
          width: '100%', fontSize: 19, lineHeight: 1.6, padding: '14px 16px',
          borderRadius: RADIUS.row, border: `1px solid ${C.line}`, background: C.card,
          color: C.ink, fontFamily: 'inherit', resize: 'none',
        }}
      />

      {/* Only after he has typed and cleared it — never as a greeting. */}
      {touched && !ready && (
        <div style={{ fontSize: TYPE.label, color: C.conflictInk, marginTop: 8 }}>{S.dictateNeedText}</div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button
          className="bigbtn"
          onClick={() => onSend(text.trim())}
          disabled={!ready || busy}
          style={{
            flex: 2, minHeight: 56, borderRadius: RADIUS.row,
            /**
             * HARBOUR, NOT AMBER. The warm accent is used exactly ONCE in this
             * app — on the entry dock's confirm — and `test-contrast.mjs`
             * enforces that. Two ambers is two "the one important button on the
             * screen", which is none.
             */
            background: ready && !busy ? C.harbor : C.line,
            color: ready && !busy ? C.onDark : C.ink,
            fontSize: TYPE.action, fontWeight: 700,
          }}
        >
          {busy ? S.saving : S.dictateSend}
        </button>
        <button
          className="catchip"
          onClick={onCancel}
          style={{
            flex: 1, minHeight: TAP, borderRadius: RADIUS.row, background: C.card,
            border: `1px solid ${C.line}`, color: C.ink, fontSize: 16, fontWeight: 600,
          }}
        >
          {S.dictateCancel}
        </button>
      </div>
    </div>
  );
}
