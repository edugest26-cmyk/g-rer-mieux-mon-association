'use client'

import { useActionState } from 'react'

import type { FormState } from '@/app/(auth)/actions'
import { createOrganization } from '@/app/associations/actions'
import { SubmitButton } from '@/components/submit-button'
import { Alert, Field, Input, Select } from '@/components/ui'
import { ORG_KIND_LABELS, ORG_KINDS } from '@/lib/enums'

export function NewOrgForm() {
  const [state, action] = useActionState<FormState, FormData>(createOrganization, null)

  return (
    <form action={action} className="space-y-4">
      {state?.error ? <Alert>{state.error}</Alert> : null}

      <Field label="Nom de l'association">
        <Input name="name" required autoFocus placeholder="Les Amis du Théâtre" />
      </Field>

      <Field label="Forme juridique">
        <Select name="kind" defaultValue="ASSOCIATION_1901">
          {ORG_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {ORG_KIND_LABELS[kind]}
            </option>
          ))}
        </Select>
      </Field>

      <SubmitButton className="w-full" pendingLabel="Création…">
        Créer l&apos;association
      </SubmitButton>
    </form>
  )
}
