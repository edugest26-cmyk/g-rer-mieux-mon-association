'use client'

import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

import { BUTTON_VARIANTS, cn } from '@/components/ui'

/**
 * Bouton de soumission qui se désactive pendant l'envoi.
 *
 * `useFormStatus` lit l'état du `<form>` parent : le bouton n'a donc besoin
 * ni de props ni d'état remonté depuis la page.
 */
export function SubmitButton({
  children,
  pendingLabel,
  variant = 'primary',
  className,
}: {
  children: ReactNode
  pendingLabel?: string
  variant?: keyof typeof BUTTON_VARIANTS
  className?: string
}) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(BUTTON_VARIANTS[variant], className)}
      aria-busy={pending}
    >
      {pending ? (pendingLabel ?? 'Envoi…') : children}
    </button>
  )
}
