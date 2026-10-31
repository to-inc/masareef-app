import { useState } from 'react';
import { C, TAP, RADIUS, TYPE, glass } from '../theme.js';
import { S } from '../i18n/strings.js';
import PhotoPeek from './PhotoPeek.jsx';
import { savePhoto } from '../lib/jobThumb.js';
import { retryNow } from '../state/receiptRunner.js';

/** Stages still waiting on the app — the ones that get these three actions. */
export const UNFINISHED = ['queued', 'reading', 'failed', 'capped'];

/**
 * THE WAY OUT FOR A PHOTO THAT HAS NOT BEEN READ (Tarek, 2026-10-31): see it,
 * save it back to the phone, try it now — whether or not it says it failed.
 * `retry` is false where the row already has its own «Try again».
 */
export default function PhotoActions({ job, retry = true, onRetried = null }) {
  const [saved, setSaved] = useState(null);
  if (!job || !job.base64) return null;
  const chip = { ...glass('chip'), minHeight: TAP, padding: '0 14px', borderRadius: RADIUS.capsule, color: C.ink,
    fontSize: TYPE.label, fontWeight: 700, whiteSpace: 'nowrap' };
  const save = async () => setSaved(await savePhoto(job.base64, job.mediaType, `masareef-${job.id.slice(0, 8)}`));
  return (
    <div data-photo-actions style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 8 }}>
      {job.mediaType !== 'application/pdf' && <PhotoPeek base64={job.base64} />}
      <button data-photo-save className="catchip" onClick={save} style={chip}>
        {saved === 'downloaded' || saved === 'shared' ? S.photoSaved : saved === 'failed' ? S.photoSaveFailed : S.photoSave}
      </button>
      {retry && (
        <button data-photo-retry className="catchip" onClick={async () => { await retryNow(job); onRetried?.(); }} style={chip}>
          {S.photoTryNow}
        </button>
      )}
    </div>
  );
}
