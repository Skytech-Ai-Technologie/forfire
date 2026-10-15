import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'

export function Notice({
  tone,
  children,
}: {
  tone: 'error' | 'success' | 'info'
  children: ReactNode
}) {
  const toneClass =
    tone === 'error'
      ? 'border-[#efc7bb] bg-[#fff4f0] text-ember-dark'
      : tone === 'success'
        ? 'border-[#cfe0d6] bg-pine-soft text-pine'
        : 'border-line bg-white text-ink'
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-2xl border px-4 py-3 text-sm ${toneClass}`}>
      {children}
    </div>
  )
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <p className="text-muted" role="status">
      {label}
    </p>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="panel px-6 py-10 text-center">
      <h2 className="font-serif text-2xl">{title}</h2>
      {children ? <div className="mt-2 text-sm text-muted">{children}</div> : null}
    </div>
  )
}

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string
  title: string
  children?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="text-sm font-semibold uppercase tracking-[0.14em] text-ember">{eyebrow}</p> : null}
        <h1 className="mt-1 font-serif text-4xl leading-tight">{title}</h1>
      </div>
      {children}
    </div>
  )
}

export function TextField({
  id,
  label,
  hint,
  error,
  ...props
}: {
  id: string
  label: string
  hint?: string
  error?: string
} & InputHTMLAttributes<HTMLInputElement>) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <label className="block text-sm font-semibold" htmlFor={id}>
      {label}
      <input id={id} className="field mt-1 font-normal" aria-invalid={Boolean(error)} aria-describedby={describedBy} {...props} />
      {hint ? (
        <span id={`${id}-hint`} className="mt-1 block font-normal text-muted">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${id}-error`} className="mt-1 block font-normal text-ember-dark">
          {error}
        </span>
      ) : null}
    </label>
  )
}

export function TextAreaField({
  id,
  label,
  hint,
  ...props
}: {
  id: string
  label: string
  hint?: string
} & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block text-sm font-semibold" htmlFor={id}>
      {label}
      <textarea id={id} className="field mt-1 min-h-32 font-normal" aria-describedby={hint ? `${id}-hint` : undefined} {...props} />
      {hint ? (
        <span id={`${id}-hint`} className="mt-1 block font-normal text-muted">
          {hint}
        </span>
      ) : null}
    </label>
  )
}

export function StatusBadge({ value }: { value: string }) {
  return <span className={`badge badge-${value}`}>{value}</span>
}

export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link className="font-semibold text-ember underline-offset-4 hover:underline" to={to}>
      {children}
    </Link>
  )
}
