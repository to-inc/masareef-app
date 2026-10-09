/**
 * v4 P8 (R19, ARCHITECTURE A6) — UPDATES PROMPT, NEVER RELOAD MID-ENTRY.
 *
 * The service worker registers in `prompt` mode: a new build waits instead of
 * taking over. `useUpdatePrompt` reports when one is waiting; the shell shows
 * «نسخة جديدة جاهزة» only while the entry sheet is closed, and «حدّث» applies it
 * (one reload, at a moment he chose). Untouched, the waiting worker takes over
 * at the next cold launch — the old autoUpdate could reload under a half-typed
 * amount.
 */
import { useRegisterSW } from 'virtual:pwa-register/react';

export function useUpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();
  return { waiting: needRefresh, apply: () => updateServiceWorker(true) };
}
