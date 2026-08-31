'use client'

import { useActionState } from 'react'

import { requestPasswordReset, type FormState } from '@/app/(auth)/actions'
import { SubmitButton } from '@/components/submit-button'
import { Alert, Field, Input } from '@/components/ui'

export function ForgotForm() {
  const [state, action] = useActionState<FormState, FormData>(requestPasswordReset, null)

  // Une fois la demande envoyée, on masque le formulaire : le renvoyer en
  // boucle n'apporterait rien et générerait des liens successifs.
  if (state?.success) {
    return <Alert tone="positive">{state.success}</Alert>
  }

  return (
    <form action={action} className="space-y-4">
      {state?.error ? <Alert>{state.error}</Alert> : null}

      <Field label="Adresse e-mail">
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          placeholder="vous@association.fr"
        />
      </Field>

      <SubmitButton className="w-full" pendingLabel="Envoi…">
        Recevoir un lien de réinitialisation
      </SubmitButton>
    </form>
  )
}
