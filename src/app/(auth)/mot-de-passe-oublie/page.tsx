import type { Metadata } from 'next'
import Link from 'next/link'

import { Card } from '@/components/ui'

import { ForgotForm } from './forgot-form'

export const metadata: Metadata = { title: 'Mot de passe oublié' }

export default function ForgotPasswordPage() {
  return (
    <Card className="px-6 py-7">
      <h1 className="text-lg font-semibold tracking-tight text-ink">Mot de passe oublié</h1>
      <p className="mt-1 mb-6 text-sm text-ink-soft">
        Indiquez votre adresse : vous recevrez un lien valable 30 minutes.
      </p>

      <ForgotForm />

      <p className="mt-6 border-t border-line pt-5 text-center text-sm text-ink-soft">
        <Link href="/connexion" className="font-medium text-brand hover:underline">
          Revenir à la connexion
        </Link>
      </p>
    </Card>
  )
}
