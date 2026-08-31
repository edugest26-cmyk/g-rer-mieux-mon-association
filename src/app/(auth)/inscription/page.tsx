import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Card } from '@/components/ui'
import { getSession } from '@/lib/auth/dal'

import { SignupForm } from './signup-form'

export const metadata: Metadata = { title: 'Créer une association' }

export default async function SignupPage() {
  // Un compte déjà connecté crée une association supplémentaire depuis
  // /associations ; inutile de lui réafficher le formulaire d'inscription.
  if (await getSession()) {
    redirect('/associations')
  }

  return (
    <Card className="px-6 py-7">
      <h1 className="text-lg font-semibold tracking-tight text-ink">Créer votre association</h1>
      <p className="mt-1 mb-6 text-sm text-ink-soft">
        Un mois d&apos;essai, sans carte bancaire.
      </p>

      <SignupForm />

      <p className="mt-6 border-t border-line pt-5 text-center text-sm text-ink-soft">
        Vous avez déjà un compte ?{' '}
        <Link href="/connexion" className="font-medium text-brand hover:underline">
          Se connecter
        </Link>
      </p>
    </Card>
  )
}
