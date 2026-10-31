/**
 * The job card's thumbnail (R-receipts 2).
 *
 * "No name… that's terrible UX." — his walkthrough, looking at a list of
 * identical rows. The photo is the cheapest possible name for a photo, and we
 * already have it: `receiptQueue` stores the prepared base64 JPEG, so the
 * preview costs one object URL and no storage, no re-encode and no network.
 *
 * IT RETURNS `null` RATHER THAN THROWING when the platform cannot make one —
 * server-side rendering, a locked-down browser, a corrupt payload. A card with
 * no thumbnail is a card; a card that throws while rendering takes the whole
 * list with it, and this list is the one place he goes to find out what the app
 * is doing. The absence is visible and honest: no image, never a broken one.
 *
 * EVERY URL MUST BE REVOKED. An object URL pins its Blob for the lifetime of the
 * document, and these are ~500 KB each on a phone that also holds the queue.
 */
export function thumbUrl(base64) {
  if (!base64 || typeof base64 !== 'string') return null;
  const g = globalThis;
  if (typeof g.atob !== 'function' || typeof g.Blob !== 'function') return null;
  if (!g.URL || typeof g.URL.createObjectURL !== 'function') return null;
  try {
    const bin = g.atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return g.URL.createObjectURL(new g.Blob([bytes], { type: 'image/jpeg' }));
  } catch {
    // A truncated or non-base64 payload. The job is still real and still his to
    // cancel or retry — it just has no picture.
    return null;
  }
}

export function revokeThumb(url) {
  if (!url) return;
  try { globalThis.URL?.revokeObjectURL?.(url); } catch { /* already gone */ }
}

/**
 * SAVE IT BACK TO THE PHONE (Tarek, 2026-10-31): a photo the app could not read
 * should never be trapped in it. The share sheet with the file is iOS's «Save
 * Image»; where files cannot be shared, the browser downloads it. Answers
 * 'shared' | 'downloaded' | 'cancelled' | 'failed' — never throws.
 */
export async function savePhoto(base64, mediaType = 'image/jpeg', name = 'receipt') {
  const g = globalThis;
  let blob;
  try {
    const bin = g.atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    blob = new g.Blob([bytes], { type: mediaType || 'image/jpeg' });
  } catch { return 'failed'; }
  const fileName = `${name}.${mediaType === 'application/pdf' ? 'pdf' : 'jpg'}`;
  try {
    const file = new g.File([blob], fileName, { type: blob.type });
    if (g.navigator?.canShare?.({ files: [file] })) {
      await g.navigator.share({ files: [file] });
      return 'shared';
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return 'cancelled';   // he closed the share sheet
  }
  try {
    const url = g.URL.createObjectURL(blob);
    const a = g.document.createElement('a');
    a.href = url; a.download = fileName;
    g.document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => revokeThumb(url), 10000);
    return 'downloaded';
  } catch { return 'failed'; }
}
