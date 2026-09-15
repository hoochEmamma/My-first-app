import { MEDIA_TYPES, MediaType, Progress } from '../types';
import { Field } from './ui';
import { numOrUndefined } from '../lib/util';

/** Two inputs (hours + minutes) that read and write a single minutes value. */
function DurationInput({
  minutes,
  onChange,
}: {
  minutes: number | undefined;
  onChange: (minutes: number | undefined) => void;
}) {
  const h = minutes === undefined ? '' : String(Math.floor(minutes / 60));
  const m = minutes === undefined ? '' : String(Math.round(minutes % 60));

  const commit = (nextH: string, nextM: string) => {
    if (nextH.trim() === '' && nextM.trim() === '') return onChange(undefined);
    onChange((Number(nextH) || 0) * 60 + (Number(nextM) || 0));
  };

  return (
    <div className="duration">
      <input type="number" min="0" value={h} placeholder="0" onChange={(e) => commit(e.target.value, m)} />
      <span>h</span>
      <input type="number" min="0" max="59" value={m} placeholder="0" onChange={(e) => commit(h, e.target.value)} />
      <span>m</span>
    </div>
  );
}

export function ProgressEditor({
  type,
  progress,
  onChange,
}: {
  type: MediaType;
  progress: Progress;
  onChange: (progress: Progress) => void;
}) {
  const kind = MEDIA_TYPES[type].progressKind;
  const patch = (p: Partial<Progress>) => onChange({ ...progress, ...p });
  const numField = (key: keyof Progress, value: string) => patch({ [key]: numOrUndefined(value) });
  const str = (v: number | undefined) => (v === undefined ? '' : String(v));

  if (kind === 'binary') {
    return (
      <p className="muted small">
        Movies don't track partial progress — set the status to <strong>Finished</strong> when you've
        watched it.
      </p>
    );
  }

  return (
    <div className="grid-2">
      {kind === 'pages' && (
        <>
          <Field label="Current page">
            <input type="number" min="0" value={str(progress.page)} onChange={(e) => numField('page', e.target.value)} placeholder="0" />
          </Field>
          <Field label="Total pages">
            <input type="number" min="0" value={str(progress.totalPages)} onChange={(e) => numField('totalPages', e.target.value)} placeholder="—" />
          </Field>
        </>
      )}

      {kind === 'episodes' && (
        <>
          <Field label="Season">
            <input type="number" min="0" value={str(progress.season)} onChange={(e) => numField('season', e.target.value)} placeholder="1" />
          </Field>
          <Field label="Episode">
            <input type="number" min="0" value={str(progress.episode)} onChange={(e) => numField('episode', e.target.value)} placeholder="1" />
          </Field>
          <Field label="Total episodes" hint="Across all seasons — used for the progress bar.">
            <input type="number" min="0" value={str(progress.totalEpisodes)} onChange={(e) => numField('totalEpisodes', e.target.value)} placeholder="—" />
          </Field>
        </>
      )}

      {kind === 'duration' && (
        <>
          <Field label="Position">
            <DurationInput minutes={progress.minutes} onChange={(minutes) => patch({ minutes })} />
          </Field>
          <Field label="Total length">
            <DurationInput minutes={progress.totalMinutes} onChange={(totalMinutes) => patch({ totalMinutes })} />
          </Field>
        </>
      )}

      {kind === 'hours' && (
        <>
          <Field label="Hours played">
            <input type="number" min="0" step="0.5" value={str(progress.hours)} onChange={(e) => numField('hours', e.target.value)} placeholder="0" />
          </Field>
          <Field label="Percent complete" hint="Your own estimate — drives the progress bar.">
            <input type="number" min="0" max="100" value={str(progress.percent)} onChange={(e) => numField('percent', e.target.value)} placeholder="—" />
          </Field>
        </>
      )}
    </div>
  );
}
