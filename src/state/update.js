/**
 * v4 P8 (R19, ARCHITECTURE A6) — UPDATES PROMPT, NEVER RELOAD MID-ENTRY.
 *
 * The service worker registers in `prompt` mode: a new build waits instead of
 * taking over. `useUpdatePrompt` reports when one is waiting; the shell shows
 * «نسخة جديدة جاهزة» only while the entry sheet is closed, and «حدّث» applies it
 * (one reload, at a moment he chose). Untouched, the waiting worker takes over
 * at the next cold launch — the old autoUpdate could reload under a half-typed
 * amount.
 *
 * LOOK FOR ONE ON RETURN (PWA audit 2026-11-01). The browser checks for a new
 * worker only on a navigation. A home-screen app iOS keeps in memory is resumed,
 * not navigated, so a fix could sit unseen for days. Coming back to the front
 * asks once — at most hourly, a cheap request for sw.js.
 */
import { useRegisterSW } from 'virtual:pwa-register/react';

export const UPDATE_CHECK_MS = 3600 * 1000;

/** Wires the return-to-front check onto one registration. Returns the unsubscribe. */
export function checkOnReturn(reg, doc = globalThis.document, clock = () => Date.now()) {
  if (!reg || !doc || typeof reg.update !== 'function') return () => {};
  let last = clock();
  const onVisible = () => {
    if (doc.visibilityState !== 'visible' || clock() - last < UPDATE_CHECK_MS) return;
    last = clock();
    try { const p = reg.update(); if (p && p.catch) p.catch(() => {}); } catch { /* offline: next return */ }
  };
  doc.addEventListener('visibilitychange', onVisible);
  return () => doc.removeEventListener('visibilitychange', onVisible);
}

export function useUpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({ onRegisteredSW: (_url, reg) => { checkOnReturn(reg); } });
  return { waiting: needRefresh, apply: () => updateServiceWorker(true) };
}
