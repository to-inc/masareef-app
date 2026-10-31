import { useState } from 'react';
import { C, TAP, RADIUS, TYPE, glass } from '../theme.js';
import { S } from '../i18n/strings.js';
import PhotoPeek from './PhotoPeek.jsx';
import { savePhoto } from '../lib/jobThumb.js';
import { retryNow, rereadNow, removeJob } from '../state/receiptRunner.js';

/** Stages still waiting on the app — the ones that get these three actions. */
export const UNFINISHED = ['queued', 'reading', 'failed', 'capped'];

/** Stages with an answer from the server — these get «Read again» (a fresh read). */
export const ANSWERED = ['ready', 'notReceipt'];

/**
 * EVERY PHOTO HAS A WAY OUT (Tarek, 2026-10-31): see it, save it back to the
 * phone, send it again, take it off the list. Not read yet → «Try now» (the
 * server's kept answer is free); already answered → «Read again» (a fresh read).
 * `retry` / `remove` are false where the row already has its own button.
 */
export default function PhotoActions({ job, stage = job && job.stage, retry = true, remove = true, onRetried = null }) {
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
      {retry && (ANSWERED.includes(stage) ? (
        <button data-photo-reread className="catchip" onClick={async () => { await rereadNow(job); onRetried?.(); }} style={chip}>
          {S.jobReadAgain}
        </button>
      ) : (
        <button data-photo-retry className="catchip" onClick={async () => { await retryNow(job); onRetried?.(); }} style={chip}>
          {S.photoTryNow}
        </button>
      ))}
      {remove && (
        <button data-photo-remove className="catchip" onClick={() => removeJob(job)} style={{ ...chip, color: C.muted }}>
          {S.photoRemove}
        </button>
      )}
    </div>
  );
}
