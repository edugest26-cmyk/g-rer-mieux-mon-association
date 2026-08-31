'use client'

import { useActionState } from 'react'

import { register, type FormState } from '@/app/(auth)/actions'
import { SubmitButton } from '@/components/submit-button'
import { Alert, Field, Input } from '@/components/ui'
import { PASSWORD_MIN_LENGTH } from '@/lib/auth/password-rules'

export function SignupForm() {
  const [state, action] = useActionState<FormState, FormData>(register, null)

  return (
    <form action={action} className="space-y-4">
      {state?.error ? <Alert>{state.error}</Alert> : null}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Prénom">
          <Input name="firstName" autoComplete="given-name" required autoFocus />
        </Field>
        <Field label="Nom">
          <Input name="lastName" autoComplete="family-name" required />
        </Field>
      </div>

      <Field label="Adresse e-mail">
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="vous@association.fr"
        />
      </Field>

      <Field
        label="Mot de passe"
        hint={`${PASSWORD_MIN_LENGTH} caractères minimum, lettres et chiffres.`}
      >
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
        />
      </Field>

      <Field
        label="Nom de l'association"
        hint="Vous pourrez le modifier, ainsi que le reste, une fois à l'intérieur."
      >
        <Input name="organizationName" required placeholder="Les Amis du Théâtre" />
      </Field>

      <SubmitButton className="w-full" pendingLabel="Création…">
        Créer mon association
      </SubmitButton>
    </form>
  )
}
