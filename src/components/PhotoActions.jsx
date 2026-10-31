import { useState } from 'react';
import { S } from '../i18n/strings.js';
import PhotoPeek from './PhotoPeek.jsx';
import ActionStrip, { StripButton } from './ActionStrip.jsx';
import { savePhoto } from '../lib/jobThumb.js';
import { retryNow, rereadNow, removeJob } from '../state/receiptRunner.js';
import { track } from '../state/usage.js';

/** Stages still waiting on the app. */
export const UNFINISHED = ['queued', 'reading', 'failed', 'capped'];
/** Stages with an answer from the server — these get «Read again» (a fresh read). */
export const ANSWERED = ['ready', 'notReceipt'];

/**
 * EVERY PHOTO HAS A WAY OUT, ON ONE LINE (Tarek, 2026-10-31 — version A): see it ·
 * save it · try now / read again · | remove. `primary` leads the strip where the row has
 * a next step of its own (Check, By hand); `retry` false hides «again» where a retry
 * cannot work; `onRemove` lets a screen do its own removing (the receipt screen closes
 * an open card too). Remove is one tap, so the shell offers «Undo».
 */
export default function PhotoActions({ job, stage = job && job.stage, primary = null, retry = true, onRemove = null, onRetried = null }) {
  const [saved, setSaved] = useState(null);
  if (!job || !job.base64) return null;
  const save = async () => {
    const r = await savePhoto(job.base64, job.mediaType, `masareef-${job.id.slice(0, 8)}`);
    track('photo', { act: 'save', result: r });
    setSaved(r);
  };
  const answered = ANSWERED.includes(stage);
  const again = answered
    ? { key: 'again', icon: 'again', label: primary ? S.photoAgainShort : S.photoReadAgain, attrs: { 'data-photo-reread': '' },
      onTap: async () => { await rereadNow(job); onRetried?.(); } }
    : { key: 'again', icon: 'again', label: S.photoTryNow, tone: stage === 'failed' ? 'lead' : null, attrs: { 'data-photo-retry': '' },
      onTap: async () => { await retryNow(job); onRetried?.(); } };
  const items = [
    primary && { key: 'primary', tone: 'lead', grow: '1.3 1 0', ...primary },
    job.mediaType !== 'application/pdf' && {
      key: 'photo', icon: 'eye', label: S.receiptPhoto,
      render: (it) => <PhotoPeek key="peek" base64={job.base64} trigger={(open) => <StripButton item={{ ...it, onTap: open, attrs: { 'data-photo-peek': '' } }} />} />,
    },
    { key: 'save', icon: 'save', attrs: { 'data-photo-save': '' }, onTap: save,
      label: saved === 'downloaded' || saved === 'shared' ? S.photoSaved : saved === 'failed' ? S.photoSaveFailed : S.photoSaveShort },
    retry && again,
    { key: 'remove', icon: 'trash', label: S.photoRemove, tone: 'muted', sep: true, aria: S.jobRemoveTitle, attrs: { 'data-photo-remove': '' },
      onTap: () => (onRemove ? onRemove(job) : removeJob(job)) },
  ];
  return <ActionStrip data-photo-actions items={items} style={{ marginTop: 8 }} />;
}
