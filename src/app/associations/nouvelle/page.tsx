import type { Metadata } from 'next'
import Link from 'next/link'

import { Card } from '@/components/ui'
import { requireUser } from '@/lib/auth/dal'

import { NewOrgForm } from './new-org-form'

export const metadata: Metadata = { title: 'Nouvelle association' }

export default async function NewOrganizationPage() {
  await requireUser()

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Link
        href="/associations"
        className="mb-4 inline-block text-sm text-ink-soft hover:text-brand"
      >
        ← Retour
      </Link>

      <Card className="px-6 py-7">
        <h1 className="text-lg font-semibold tracking-tight text-ink">Nouvelle association</h1>
        <p className="mt-1 mb-6 text-sm text-ink-soft">
          Vous en serez propriétaire. Ses données seront entièrement séparées de vos autres
          structures.
        </p>

        <NewOrgForm />
      </Card>
    </div>
  )
}
