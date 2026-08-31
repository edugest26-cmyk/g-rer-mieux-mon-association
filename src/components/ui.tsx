import type { ComponentProps, ReactNode } from 'react'

import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Fusionne des classes Tailwind en laissant la dernière l'emporter. */
export function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(inputs))
}

// ── Surfaces ─────────────────────────────────────────────────

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('card', className)} {...props} />
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-ink-faint">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-1 text-sm text-ink-soft">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

// ── Statuts ──────────────────────────────────────────────────

export type Tone = 'neutral' | 'positive' | 'warning' | 'danger' | 'brand'

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-neutral-soft text-ink-soft',
  positive: 'bg-positive-soft text-positive',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  brand: 'bg-brand-soft text-brand-dark',
}

export function Chip({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}) {
  return <span className={cn('chip', TONE_CLASSES[tone], className)}>{children}</span>
}

// ── Chiffres clés ────────────────────────────────────────────

export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  tone?: Tone
}) {
  const valueTone =
    tone === 'positive'
      ? 'text-positive'
      : tone === 'danger'
        ? 'text-danger'
        : tone === 'warning'
          ? 'text-warning'
          : 'text-ink'

  return (
    <div className="card px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={cn('tabular mt-1.5 text-2xl font-semibold', valueTone)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-faint">{hint}</p> : null}
    </div>
  )
}

// ── Tableaux ─────────────────────────────────────────────────

export function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full border-collapse text-sm', className)} {...props} />
    </div>
  )
}

export function Th({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      className={cn(
        'border-b border-line px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ink-faint',
        className,
      )}
      {...props}
    />
  )
}

export function Td({ className, ...props }: ComponentProps<'td'>) {
  return <td className={cn('border-b border-line px-4 py-3 align-middle', className)} {...props} />
}

// ── États vides ──────────────────────────────────────────────

export function EmptyState({
  title,
  description,
  action,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-faint">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

// ── Formulaires ──────────────────────────────────────────────

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && !error ? <span className="mt-1 block text-xs text-ink-faint">{hint}</span> : null}
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : null}
    </label>
  )
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'block min-h-cible w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink',
        'placeholder:text-ink-faint focus:border-brand focus:outline-none',
        'disabled:cursor-not-allowed disabled:bg-surface-muted',
        className,
      )}
      {...props}
    />
  )
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'block w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink',
        'focus:border-brand focus:outline-none',
        className,
      )}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'block w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink',
        'placeholder:text-ink-faint focus:border-brand focus:outline-none',
        className,
      )}
      {...props}
    />
  )
}

export function Alert({ tone = 'danger', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div
      role="alert"
      className={cn('rounded-lg px-3.5 py-2.5 text-sm', TONE_CLASSES[tone])}
    >
      {children}
    </div>
  )
}

// `min-h-cible` : 44 px, la plus petite cible qu'un doigt atteint sans viser.
// Vaut aussi pour les boutons de tableau, où l'on pointe des présences debout.
const BUTTON_BASE =
  'inline-flex min-h-cible items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60'

export const BUTTON_VARIANTS = {
  primary: cn(BUTTON_BASE, 'bg-brand text-brand-ink hover:bg-brand-dark'),
  secondary: cn(BUTTON_BASE, 'border border-line-strong bg-surface text-ink hover:bg-surface-muted'),
  ghost: cn(BUTTON_BASE, 'text-ink-soft hover:bg-surface-muted hover:text-ink'),
  danger: cn(BUTTON_BASE, 'bg-danger text-signal-ink hover:opacity-90'),
} as const

export function Button({
  variant = 'primary',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: keyof typeof BUTTON_VARIANTS }) {
  return <button className={cn(BUTTON_VARIANTS[variant], className)} {...props} />
}
