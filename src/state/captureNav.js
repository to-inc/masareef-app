/**
 * WHERE ← GOES FROM A CAPTURE SCREEN (Tarek, 2026-11-02 usage audit: «Let's do it»).
 *
 * The ← on Receipt and «Review the statement» always opened the New sheet. Over
 * 20 Oct – 1 Nov he tapped it 20 times and closed the empty sheet within 4 s on
 * 18 of them, because he had opened the photo from To review. So ← goes back to
 * the screen the photo was opened from; only a capture begun on New returns to New.
 *
 * `from` is the tab that opened it ('inbox', 'book'), or null for the New sheet.
 */
export function captureBack(from) {
  if (from === 'inbox') return { tab: 'inbox', photosOpen: true };
  if (from === 'book') return { tab: 'book', photosOpen: false };
  return { tab: 'entry', photosOpen: null };
}

/**
 * The header's Photos button (same audit): 25 taps on To review, 11 followed at
 * once by a second tap, because a tap while the list was open FOLDED it. It now
 * only opens; folding belongs to the list's own header.
 */
export const photosShortcutTap = () => ({ tab: 'inbox', photosOpen: true, scroll: true });
