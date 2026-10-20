import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './styles.css';
import { NIGHT, C, themeChoice } from './theme.js';

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

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
