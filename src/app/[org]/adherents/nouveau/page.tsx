import type { Metadata } from 'next'
import Link from 'next/link'

import { MemberForm } from '@/app/[org]/adherents/member-form'
import { PageHeader } from '@/components/ui'
import { requirePermission } from '@/lib/auth/dal'
import { db } from '@/lib/db'

export const metadata: Metadata = { title: 'Nouvel adhérent' }

export default async function NewMemberPage({ params }: PageProps<'/[org]/adherents/nouveau'>) {
  const { org } = await params
  const { organization } = await requirePermission(org, 'members.write')

  const categories = await db.memberCategory.findMany({
    where: { organizationId: organization.id, archivedAt: null },
    orderBy: { position: 'asc' },
    select: { id: true, name: true },
  })

  return (
    <>
      <Link
        href={`/${org}/adherents`}
        className="mb-4 inline-block text-sm text-ink-soft hover:text-brand"
      >
        ← Retour au fichier
      </Link>

      <PageHeader
        title="Nouvel adhérent"
        description="Le numéro d'adhérent est attribué automatiquement si vous le laissez vide."
      />

      <MemberForm org={org} categories={categories} />
    </>
  )
}
