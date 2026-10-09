import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './styles.css';

/**
 * E-017: measure what iOS withholds from a home-screen app (see theme.js
 * pinBottom). Only in standalone mode, only a small gap (≤ 80pt — never a
 * keyboard), re-measured on every resize/rotation.
 */
function fitIosGap() {
  const standalone = window.navigator.standalone === true
    || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  const gap = standalone ? Math.round(window.screen.height - window.innerHeight) : 0;
  const portrait = window.innerHeight > window.innerWidth;
  document.documentElement.style.setProperty('--ios-gap', `${portrait && gap > 0 && gap <= 80 ? gap : 0}px`);
}
fitIosGap();
window.addEventListener('resize', fitIosGap);
window.addEventListener('orientationchange', fitIosGap);

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
