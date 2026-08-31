'use client'

import { useActionState } from 'react'

import type { FormState } from '@/app/(auth)/actions'
import { sendDueReminders } from '@/app/[org]/cotisations/actions'
import { SubmitButton } from '@/components/submit-button'
import { Alert } from '@/components/ui'

/**
 * Relance groupée des cotisations impayées.
 *
 * Repliée derrière un `<details>` : l'envoi part immédiatement, sans écran de
 * confirmation intermédiaire, et un bouton posé en évidence sur la page se
 * déclencherait trop facilement par mégarde.
 */
export function ReminderForm({
  org,
  pendingCount,
  emailConfigured,
}: {
  org: string
  pendingCount: number
  emailConfigured: boolean
}) {
  const [state, action] = useActionState<FormState, FormData>(sendDueReminders, null)

  return (
    <details>
      <summary className="cursor-pointer list-none text-sm font-medium text-brand hover:underline">
        Relancer les impayés
      </summary>

      <form action={action} className="mt-3 space-y-3 border-t border-line pt-3">
        <input type="hidden" name="org" value={org} />

        {state?.error ? <Alert>{state.error}</Alert> : null}
        {state?.success ? <Alert tone="positive">{state.success}</Alert> : null}

        <p className="text-sm text-ink-soft">
          Un e-mail sera envoyé à chaque adhérent dont la cotisation reste due
          {pendingCount > 0 ? ` (${pendingCount} concernée${pendingCount > 1 ? 's' : ''})` : ''}. Les
          adhérents sans adresse e-mail sont comptés à part : ce sont eux qu&apos;il faudra
          joindre autrement.
        </p>

        <label className="flex items-start gap-2.5">
          <input type="checkbox" name="overdueOnly" defaultChecked className="mt-0.5 h-4 w-4" />
          <span className="text-sm text-ink">
            Uniquement les cotisations dont l&apos;échéance est dépassée
          </span>
        </label>

        {!emailConfigured ? (
          <Alert tone="warning">
            Aucun fournisseur d&apos;e-mail n&apos;est configuré : les messages seront écrits dans
            le terminal du serveur, sans être envoyés. Renseignez <code>EMAIL_PROVIDER</code> et{' '}
            <code>RESEND_API_KEY</code> pour un envoi réel.
          </Alert>
        ) : null}

        <SubmitButton variant="secondary" pendingLabel="Envoi en cours…">
          Envoyer les relances
        </SubmitButton>
      </form>
    </details>
  )
}
