/**
 * Camera photo → something the vision API can read, cheaply, on Cairo mobile data.
 *
 * A modern iPhone photo is 3–5 MB. Sending that raw would be slow, expensive,
 * and pointless: the model resamples to ~1568px on its long edge anyway, so
 * everything above that is bytes Dad waits for and Tarek pays for, buying zero
 * additional accuracy.
 *
 * Order matters. EXIF orientation must be applied BEFORE scaling, or a photo
 * taken in portrait arrives rotated and the model reads a sideways receipt.
 */
export const TARGET_LONG_EDGE = 1568;
export const SOFT_LIMIT = 600 * 1024;   // aim under this
export const HARD_LIMIT = 1024 * 1024;  // never send more than this

export class ReceiptImageError extends Error {
  constructor(code) {
    super(`receipt-image: ${code}`);
    this.code = code;
  }
}

async function decode(file) {
  // `imageOrientation:'from-image'` bakes EXIF rotation into the bitmap. Older
  // Safari rejects the options bag entirely, so fall back to the plain call —
  // which on those versions already auto-applies EXIF for file sources.
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    try {
      return await createImageBitmap(file);
    } catch {
      throw new ReceiptImageError('decode-failed');
    }
  }
}

function scaleTo(bitmap, longEdge) {
  const scale = Math.min(1, longEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  // Thermal receipts are thin dark text on white; smoothing preserves the
  // strokes far better than nearest-neighbour when downscaling this hard.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas;
}

const toBlob = (canvas, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new ReceiptImageError('encode-failed'))),
      'image/jpeg',
      quality,
    );
  });

async function sha256Hex(arrayBuffer) {
  // Requires a secure context. GitHub Pages is HTTPS and localhost counts, so
  // the only way here is an http:// deployment, which nothing else supports.
  if (!globalThis.crypto?.subtle) throw new ReceiptImageError('no-crypto');
  const digest = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64(bytes) {
  // Chunked: String.fromCharCode(...bytes) on a megabyte blows the call stack.
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Returns `{ base64, clientHash, width, height, bytes, quality }`.
 *
 * `base64` carries NO `data:` prefix — the contract's `receipt_extract` expects
 * raw base64 and the server's 6,000,000-char guard assumes it.
 *
 * `clientHash` is the SHA-256 of the FINAL encoded bytes, which is what makes a
 * retry free: the server caches the extraction under this hash for 6 h, so the
 * same upload never bills a second vision call.
 */
export async function prepareReceipt(file) {
  if (!file || !file.type?.startsWith('image/')) throw new ReceiptImageError('not-an-image');

  const bitmap = await decode(file);
  let canvas = scaleTo(bitmap, TARGET_LONG_EDGE);
  bitmap.close?.();

  // Quality ladder first — dropping quality preserves legibility much better
  // than dropping resolution on text.
  let blob = null;
  let quality = 0.8;
  for (const q of [0.8, 0.7, 0.6, 0.5]) {
    quality = q;
    blob = await toBlob(canvas, q);
    if (blob.size <= SOFT_LIMIT) break;
  }

  // Still oversized (a very large or very noisy photo): step the dimensions down
  // too rather than refusing outright.
  if (blob.size > SOFT_LIMIT) {
    for (const edge of [1280, 1024]) {
      canvas = scaleTo(await decode(file), edge);
      blob = await toBlob(canvas, 0.6);
      quality = 0.6;
      if (blob.size <= SOFT_LIMIT) break;
    }
  }

  if (blob.size > HARD_LIMIT) throw new ReceiptImageError('too-large');

  const buf = await blob.arrayBuffer();
  const clientHash = await sha256Hex(buf);

  /**
   * EXIF-failure detector for the field test.
   *
   * The `imageOrientation:'from-image'` decode is proven on Chromium but NOT on
   * iOS Safari, and if that fallback misbehaves the symptom is silent: the model
   * reads a sideways receipt and extraction quality just… degrades. That surfaces
   * as "the OCR seems unreliable" a week later, which is the hardest possible
   * thing to trace.
   *
   * A receipt is nearly always taller than it is wide. Landscape output on a
   * portrait photo means the rotation was not applied, and this makes that
   * visible on photo ONE instead of statistically over a week.
   */
  const landscape = canvas.width > canvas.height;
  if (landscape) {
    console.warn(
      `[masareef] receipt encoded LANDSCAPE (${canvas.width}×${canvas.height}). ` +
      'If the photo was portrait, EXIF orientation was not applied — extraction ' +
      'quality will degrade silently. See app/README.md.',
    );
  } else {
    console.info(`[masareef] receipt ${canvas.width}×${canvas.height}, ${Math.round(blob.size / 1024)}KB, q${quality}`);
  }

  return {
    base64: bytesToBase64(new Uint8Array(buf)),
    clientHash,
    width: canvas.width,
    height: canvas.height,
    bytes: blob.size,
    quality,
    landscape,
  };
}

/** `snapDate` for the extract call — the day the photo was taken, Cairo. */
export function snapDateISO(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);   // en-CA already yields YYYY-MM-DD
}
