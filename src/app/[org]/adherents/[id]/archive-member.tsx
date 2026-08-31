'use client'

import { useActionState } from 'react'

import type { FormState } from '@/app/(auth)/actions'
import { archiveMember } from '@/app/[org]/adherents/actions'
import { SubmitButton } from '@/components/submit-button'
import { Alert, Field, Input } from '@/components/ui'

/**
 * Radiation d'un adhérent.
 *
 * Repliée derrière un `<details>` : c'est une action rare et lourde de
 * conséquences, elle n'a pas à occuper le même niveau visuel que « Modifier ».
 * La fiche n'est jamais supprimée — cotisations, règlements et votes en
 * assemblée doivent rester consultables.
 */
export function ArchiveMember({ org, id, name }: { org: string; id: string; name: string }) {
  const [state, action] = useActionState<FormState, FormData>(archiveMember, null)

  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-sm text-ink-faint hover:text-danger">
        Radier cet adhérent
      </summary>

      <form action={action} className="mt-3 space-y-3 border-t border-line pt-3">
        <input type="hidden" name="org" value={org} />
        <input type="hidden" name="id" value={id} />

        {state?.error ? <Alert>{state.error}</Alert> : null}

        <p className="text-sm text-ink-soft">
          {name} passera en « démissionnaire » et sa date de départ sera enregistrée. Son
          historique de cotisations et de participations reste intact.
        </p>

        <Field label="Motif" hint="Facultatif, conservé dans le journal d'activité.">
          <Input name="leaveReason" placeholder="Démission, déménagement…" />
        </Field>

        <SubmitButton variant="danger" pendingLabel="Radiation…">
          Confirmer la radiation
        </SubmitButton>
      </form>
    </details>
  )
}
