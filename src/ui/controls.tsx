import { useId, type ReactNode } from 'react';
import { MinusIcon, PlusIcon } from './icons';
import styles from './controls.module.css';

export function Card({
  title,
  subtitle,
  aside,
  children,
  testId,
  tour,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  testId?: string;
  /** Lesson spotlight anchor. */
  tour?: string;
}) {
  return (
    <section className={styles.card} data-testid={testId} data-tour={tour}>
      <header className={styles.cardHeader}>
        <div>
          <h2>{title}</h2>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      {children}
    </div>
  );
}

export function Field({
  label,
  value,
  children,
}: {
  label: ReactNode;
  value?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>
        {label}
        {value !== undefined && <span className={styles.fieldValue}>{value}</span>}
      </span>
      {children}
    </div>
  );
}

export function Select<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <select
      className={styles.select}
      aria-label={label}
      value={String(value)}
      onChange={(e) => {
        const opt = options.find((o) => String(o.value) === e.target.value);
        if (opt) onChange(opt.value);
      }}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <input
      className={styles.slider}
      type="range"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ ['--fill' as string]: `${((value - min) / (max - min)) * 100}%` }}
    />
  );
}

export function Stepper({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className={styles.stepper} role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`${label} 줄이기`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        <MinusIcon width={12} height={12} />
      </button>
      <span className="num">{value}</span>
      <button
        type="button"
        aria-label={`${label} 늘리기`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <PlusIcon width={12} height={12} />
      </button>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  stretch = false,
}: {
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (v: T) => void;
  label: string;
  stretch?: boolean;
}) {
  return (
    <div
      className={stretch ? `${styles.segmented} ${styles.stretch}` : styles.segmented}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          className={o.value === value ? styles.segActive : undefined}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A collapsible group, closed by default — keeps rarely used settings out of sight. */
export function Disclosure({
  title,
  children,
  open,
  onToggle,
  tour,
}: {
  title: string;
  children: ReactNode;
  open: boolean;
  onToggle: (open: boolean) => void;
  tour?: string;
}) {
  const id = useId();
  return (
    <section className={styles.disclosure} data-tour={tour}>
      <button
        type="button"
        className={styles.disclosureButton}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => onToggle(!open)}
      >
        {title}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          aria-hidden
          className={open ? styles.chevronOpen : undefined}
        >
          <path
            d="M4 2.5 7.5 6 4 9.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {open && (
        <div id={id} className={styles.disclosureBody}>
          {children}
        </div>
      )}
    </section>
  );
}
