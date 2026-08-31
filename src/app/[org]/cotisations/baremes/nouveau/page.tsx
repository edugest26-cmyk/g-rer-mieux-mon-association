import type { Metadata } from 'next'
import Link from 'next/link'

import { FeeForm } from '@/app/[org]/cotisations/baremes/fee-form'
import { PageHeader } from '@/components/ui'
import { requirePermission } from '@/lib/auth/dal'
import { db } from '@/lib/db'

export const metadata: Metadata = { title: 'Nouveau barème' }

export default async function NewFeePage({
  params,
}: PageProps<'/[org]/cotisations/baremes/nouveau'>) {
  const { org } = await params
  const { organization } = await requirePermission(org, 'dues.write')

  const categories = await db.memberCategory.findMany({
    where: { organizationId: organization.id, archivedAt: null },
    orderBy: { position: 'asc' },
    select: { id: true, name: true },
  })

  return (
    <>
      <Link
        href={`/${org}/cotisations`}
        className="mb-4 inline-block text-sm text-ink-soft hover:text-brand"
      >
        ← Retour aux cotisations
      </Link>

      <PageHeader
        title="Nouveau barème"
        description="Le tarif proposé aux adhérents lors de l'émission des appels."
      />

      <FeeForm org={org} categories={categories} />
    </>
  )
}
