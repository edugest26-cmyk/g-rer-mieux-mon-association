'use client'

import { useActionState } from 'react'

import { resetPassword, type FormState } from '@/app/(auth)/actions'
import { SubmitButton } from '@/components/submit-button'
import { Alert, Field, Input } from '@/components/ui'
import { PASSWORD_MIN_LENGTH } from '@/lib/auth/password-rules'

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState<FormState, FormData>(resetPassword, null)
  const errors = state?.fieldErrors ?? {}

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      {state?.error ? <Alert>{state.error}</Alert> : null}

      <Field
        label="Nouveau mot de passe"
        hint={`${PASSWORD_MIN_LENGTH} caractères minimum, lettres et chiffres.`}
        error={errors.password}
      >
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          autoFocus
          minLength={PASSWORD_MIN_LENGTH}
        />
      </Field>

      <Field label="Confirmation" error={errors.confirmation}>
        <Input name="confirmation" type="password" autoComplete="new-password" required />
      </Field>

      <SubmitButton className="w-full" pendingLabel="Enregistrement…">
        Enregistrer le nouveau mot de passe
      </SubmitButton>

      <p className="text-xs text-ink-faint">
        Toutes vos sessions ouvertes seront fermées : vous devrez vous reconnecter sur vos autres
        appareils.
      </p>
    </form>
  )
}
