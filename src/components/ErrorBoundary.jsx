import { Component } from 'react';
import { C, FONT_DISPLAY, FONT_UI, RADIUS, TYPE, GLYPH } from '../theme.js';
import { S } from '../i18n/strings.js';

/**
 * Last line of defence for the "never a blank screen" rule.
 *
 * The payload validator catches the malformed data we can anticipate. This
 * catches everything we cannot: any render-time throw anywhere in the tree
 * would otherwise unmount React entirely and leave Dad staring at blank sand
 * with no way back except deleting and reinstalling the app.
 *
 * Deliberately plain: one sentence, one button, no error text, no stack. The
 * detail goes to the console for Tarek; Dad gets a way forward.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false };
  }

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error, info) {
    console.error('masareef crashed:', error, info?.componentStack);
  }

  render() {
    if (!this.state.crashed) return this.props.children;

    return (
      <div
        style={{
          height: '100dvh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 14,
          background: C.shell, fontFamily: FONT_UI, color: C.ink, padding: 28, textAlign: 'center',
        }}
      >
        <div style={{ fontSize: GLYPH.illustration }}>🌿</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: TYPE.section, fontWeight: 650, color: C.harborInk }}>
          {S.crashTitle}
        </div>
        <p style={{ fontSize: 15.5, color: C.muted, lineHeight: 1.7, margin: 0, maxWidth: 300 }}>
          {S.crashBody}
        </p>
        <button
          className="bigbtn"
          onClick={() => window.location.reload()}
          style={{
            marginTop: 6, minHeight: 56, padding: '16px 34px', borderRadius: RADIUS.row,
            background: C.harbor, color: C.onDark, fontSize: 17.5, fontWeight: 700,
          }}
        >
          {S.crashRetry}
        </button>
      </div>
    );
  }
}
