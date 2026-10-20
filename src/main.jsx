import React from 'react';
import { createRoot } from 'react-dom/client';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './styles.css';
import { NIGHT, C, RADIUS, themeChoice } from './theme.js';
import { loadLocale } from './i18n/strings.js';

/**
 * NIGHT (2026-10-18): the theme was decided in theme.js before anything rendered;
 * the page-level pieces follow it here — <html> marked for styles.css, the
 * browser's own chrome colour — and on Auto a change of the phone's setting
 * reloads into the other palette (the language switch's pattern).
 */
document.documentElement.dataset.night = String(NIGHT);
document.querySelector('meta[name="theme-color"]')?.setAttribute('content', C.shell);
document.body.style.background = C.shell;
if (themeChoice() === 'auto' && window.matchMedia) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => { if (mq.matches !== NIGHT) window.location.reload(); };
  if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
}

// The language first, then the app: every screen reads `S` as it loads (i18n/strings.js).
// If either download fails (a first open on a weak line, before the service worker holds them),
// say so in both languages — no strings are loaded yet — instead of a blank screen (audit 2026-10-20).
loadLocale().then(() => import('./App.jsx')).then(({ default: App }) => {
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  );
}).catch(() => {
  createRoot(document.getElementById('root')).render(
    <div style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center', color: C.ink, fontFamily: 'system-ui, sans-serif' }}>
      <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6 }}>The app could not load. Check the connection.<br /><span dir="rtl">التطبيق ما فتحش. اتأكد من النت.</span></p>
      <button onClick={() => window.location.reload()} style={{ minHeight: 56, padding: '0 28px', borderRadius: RADIUS.capsule, border: 'none', background: C.harbor, color: C.onDark, fontSize: 17, fontWeight: 700 }}>
        Try again · <span dir="rtl">جرّب تاني</span>
      </button>
    </div>,
  );
});
