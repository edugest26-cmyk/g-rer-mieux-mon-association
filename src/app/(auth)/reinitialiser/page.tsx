import type { Metadata } from 'next'
import Link from 'next/link'

import { Alert, Card } from '@/components/ui'

import { ResetForm } from './reset-form'

export const metadata: Metadata = { title: 'Nouveau mot de passe' }

export default async function ResetPasswordPage(props: PageProps<'/reinitialiser'>) {
  const searchParams = await props.searchParams
  const raw = searchParams.jeton
  const token = typeof raw === 'string' ? raw : ''

  return (
    <Card className="px-6 py-7">
      <h1 className="text-lg font-semibold tracking-tight text-ink">Nouveau mot de passe</h1>
      <p className="mt-1 mb-6 text-sm text-ink-soft">
        Choisissez un mot de passe que vous n&apos;utilisez nulle part ailleurs.
      </p>

      {token === '' ? (
        <Alert>
          Ce lien est incomplet. Ouvrez-le directement depuis l&apos;e-mail reçu, ou demandez-en un
          nouveau.
        </Alert>
      ) : (
        <ResetForm token={token} />
      )}

      <p className="mt-6 border-t border-line pt-5 text-center text-sm text-ink-soft">
        <Link href="/mot-de-passe-oublie" className="font-medium text-brand hover:underline">
          Demander un nouveau lien
        </Link>
      </p>
    </Card>
  )
}
