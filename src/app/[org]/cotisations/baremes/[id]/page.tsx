import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { FeeForm } from '@/app/[org]/cotisations/baremes/fee-form'
import { PageHeader } from '@/components/ui'
import { requirePermission } from '@/lib/auth/dal'
import { db } from '@/lib/db'

export const metadata: Metadata = { title: 'Modifier un barème' }

export default async function EditFeePage(props: PageProps<'/[org]/cotisations/baremes/[id]'>) {
  const { org, id } = await props.params
  const { organization } = await requirePermission(org, 'dues.write')

  const [fee, categories] = await Promise.all([
    db.fee.findFirst({
      where: { id, organizationId: organization.id },
      select: {
        id: true,
        name: true,
        description: true,
        amountCents: true,
        period: true,
        categoryId: true,
        taxDeductible: true,
        isFreeAmount: true,
        _count: { select: { dues: true } },
      },
    }),
    db.memberCategory.findMany({
      where: { organizationId: organization.id, archivedAt: null },
      orderBy: { position: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  if (!fee) {
    notFound()
  }

  return (
    <>
      <Link
        href={`/${org}/cotisations`}
        className="mb-4 inline-block text-sm text-ink-soft hover:text-brand"
      >
        ← Retour aux cotisations
      </Link>

      <PageHeader
        title="Modifier le barème"
        description={
          fee._count.dues > 0
            ? `${fee._count.dues} appel${fee._count.dues > 1 ? 's' : ''} déjà émis avec ce barème : les modifier ici ne change rien aux montants déjà appelés.`
            : "Ce barème n'a encore servi à aucun appel."
        }
      />

      <FeeForm org={org} categories={categories} fee={fee} />
    </>
  )
}
