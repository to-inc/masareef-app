import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { C, TAP, RADIUS, TYPE, glass } from '../theme.js';
import { S } from '../i18n/strings.js';
import { thumbUrl, revokeThumb } from '../lib/jobThumb.js';

/**
 * THE EYE — the photo he is checking, full screen. Tap the picture to zoom (2.5×, then scroll);
 * the object URL lives only while it is open (jobThumb.js: every URL is revoked).
 */
export default function PhotoPeek({ base64, label = null }) {
  const [url, setUrl] = useState(null);
  const [zoom, setZoom] = useState(false);
  const closeRef = useRef(null);
  const open = () => { setZoom(false); setUrl(thumbUrl(base64)); };
  const close = () => { revokeThumb(url); setUrl(null); };
  useEffect(() => {
    if (!url) return undefined;
    if (closeRef.current) closeRef.current.focus({ preventScroll: true });
    const onKey = (e) => { if (e.key === 'Escape') { revokeThumb(url); setUrl(null); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [url]);
  useEffect(() => () => revokeThumb(url), [url]);
  return (
    <>
      <button data-photo-peek className="catchip" onClick={open} aria-label={S.receiptSeePhoto}
        style={{ minHeight: TAP, minWidth: TAP, borderRadius: RADIUS.capsule, ...glass('chip'), color: C.ink,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 14px', fontSize: TYPE.label, fontWeight: 700 }}>
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
        </svg>
        {label || S.receiptPhoto}
      </button>
      {/* Portalled to <body>: a glass ancestor's backdrop-filter is a containing block for
          position:fixed, and the viewer was trapped inside the card (seen 2026-10-20). */}
      {url && createPortal(
        <div role="dialog" aria-modal="true" aria-label={S.receiptSeePhoto} data-photo-view
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(8, 12, 16, 0.94)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 'calc(env(safe-area-inset-top, 0px) + 10px) 14px 10px' }}>
            <button ref={closeRef} onClick={close}
              style={{ minHeight: TAP, padding: '0 20px', borderRadius: RADIUS.capsule, border: 'none', background: C.card, color: C.ink, fontSize: TYPE.label, fontWeight: 700 }}>
              {S.settingsClose}
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch', display: zoom ? 'block' : 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
            <img src={url} alt={S.receiptSeePhoto} onClick={() => setZoom((z) => !z)}
              style={zoom ? { width: '250%', maxWidth: 'none', display: 'block' } : { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
