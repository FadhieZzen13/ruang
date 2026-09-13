import type { ReactNode } from 'react'
import { courseTint } from '../domain/course'

// Small shared pieces the redesigned screens build from. Kept in one file so a
// tag pill or a progress bar looks identical on the tasks list, the wizard and
// the dashboard, without either screen owning the other.

export function TagPill({ label, tint }: { label?: string | null; tint?: ReturnType<typeof courseTint> }) {
  const t = tint ?? courseTint(label)
  const text = t.label || 'No course'
  return (
    <span className="tag-pill" style={{ background: t.pill, color: t.ink }}>
      {text}
    </span>
  )
}

export function Progress({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="progress">
      <span style={{ width: `${Math.max(2, pct)}%`, background: color }} />
    </div>
  )
}

// A chevron that points left, drawn to match the tab icons' stroke language.
export function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

export function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

export function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" />
    </svg>
  )
}

export function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

export function StarIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8z" />
    </svg>
  )
}

export function ClockBadge({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

export function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 13l4 4L19 7" />
    </svg>
  )
}

// A two-option segmented control, pill-track style — the scope switch on the
// tasks list. Generic over the value union so callers stay typed.
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          className={value === o.value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function SegmentedUnderline<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="seg-underline" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          className={value === o.value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function WizardTop({
  back,
  step,
  onBack,
}: {
  back: string
  step: string
  onBack: () => void
}) {
  return (
    <div className="wizard-top">
      <button className="back-link" onClick={onBack}>
        <ChevronLeft /> {back}
      </button>
      <span className="step-pill">{step}</span>
    </div>
  )
}

export function ScreenShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`task-screen ${className}`}>{children}</div>
}
