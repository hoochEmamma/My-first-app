import React, { useEffect, useRef } from 'react';
import { MEDIA_TYPES, MediaType } from '../types';
import { classes } from '../lib/util';

/* ---------------------------------- modal --------------------------------- */

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={classes('modal', wide && 'modal-wide')} ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

/* ---------------------------------- fields -------------------------------- */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

/* --------------------------------- rating --------------------------------- */

/** 0.5–5 stars in half steps. Clicking the current value clears it. */
export function StarRating({
  value,
  onChange,
  readOnly,
  size = 'md',
}: {
  value: number | undefined;
  onChange?: (value: number | undefined) => void;
  readOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const v = value ?? 0;
  const set = (next: number) => {
    if (readOnly || !onChange) return;
    onChange(next === value ? undefined : next);
  };

  return (
    <div className={classes('stars', `stars-${size}`, readOnly && 'stars-readonly')}>
      {[1, 2, 3, 4, 5].map((pos) => {
        const full = v >= pos;
        const half = !full && v >= pos - 0.5;
        return (
          <span key={pos} className="star-wrap">
            <span className={classes('star', full && 'star-full', half && 'star-half')}>★</span>
            {!readOnly && (
              <>
                <button
                  type="button"
                  className="star-hit star-hit-left"
                  onClick={() => set(pos - 0.5)}
                  aria-label={`Rate ${pos - 0.5} stars`}
                />
                <button
                  type="button"
                  className="star-hit star-hit-right"
                  onClick={() => set(pos)}
                  aria-label={`Rate ${pos} stars`}
                />
              </>
            )}
          </span>
        );
      })}
      {value !== undefined && <span className="star-value">{value.toFixed(1)}</span>}
    </div>
  );
}

/* -------------------------------- progress -------------------------------- */

export function ProgressBar({ percent, color }: { percent: number | undefined; color?: string }) {
  if (percent === undefined) return <div className="bar bar-empty" aria-hidden="true" />;
  return (
    <div className="bar" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
      <div className="bar-fill" style={{ width: `${percent}%`, background: color }} />
    </div>
  );
}

/* ---------------------------------- cover --------------------------------- */

export function Cover({
  url,
  type,
  className,
}: {
  url?: string;
  type: MediaType;
  className?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  useEffect(() => setFailed(false), [url]);

  if (!url || failed) {
    return (
      <div className={classes('cover', 'cover-fallback', className)} aria-hidden="true">
        <span>{MEDIA_TYPES[type].icon}</span>
      </div>
    );
  }
  return (
    <img
      className={classes('cover', className)}
      src={url}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

/* ---------------------------------- chips --------------------------------- */

export function Chip({
  active,
  onClick,
  children,
  count,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button type="button" className={classes('chip', active && 'chip-active')} onClick={onClick}>
      {children}
      {count !== undefined && <span className="chip-count">{count}</span>}
    </button>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: string;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}
