'use client'

import { useActionState } from 'react'

import { login, type FormState } from '@/app/(auth)/actions'
import { SubmitButton } from '@/components/submit-button'
import { Alert, Field, Input } from '@/components/ui'

export function LoginForm({ suite }: { suite?: string }) {
  const [state, action] = useActionState<FormState, FormData>(login, null)

  return (
    <form action={action} className="space-y-4">
      {suite ? <input type="hidden" name="suite" value={suite} /> : null}

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

      <Field label="Mot de passe">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>

      <SubmitButton className="w-full" pendingLabel="Connexion…">
        Se connecter
      </SubmitButton>
    </form>
  )
}
