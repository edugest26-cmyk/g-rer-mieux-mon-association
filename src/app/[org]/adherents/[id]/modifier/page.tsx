import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { MemberForm } from '@/app/[org]/adherents/member-form'
import { PageHeader } from '@/components/ui'
import { requirePermission } from '@/lib/auth/dal'
import { db } from '@/lib/db'
import { memberDisplayName } from '@/lib/format'

export const metadata: Metadata = { title: 'Modifier un adhérent' }

export default async function EditMemberPage(
  props: PageProps<'/[org]/adherents/[id]/modifier'>,
) {
  const { org, id } = await props.params
  const { organization } = await requirePermission(org, 'members.write')

  const [member, categories] = await Promise.all([
    // Le couple `{ id, organizationId }` est ce qui empêche d'ouvrir en
    // modification la fiche d'un adhérent d'une autre association.
    db.member.findFirst({
      where: { id, organizationId: organization.id },
      select: {
        id: true,
        memberNumber: true,
        kind: true,
        status: true,
        civility: true,
        firstName: true,
        lastName: true,
        legalName: true,
        gender: true,
        birthDate: true,
        email: true,
        phone: true,
        mobile: true,
        addressLine1: true,
        addressLine2: true,
        postalCode: true,
        city: true,
        country: true,
        categoryId: true,
        joinedAt: true,
        notes: true,
        acceptsNewsletter: true,
        acceptsPhotos: true,
      },
    }),
    db.memberCategory.findMany({
      where: { organizationId: organization.id, archivedAt: null },
      orderBy: { position: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  if (!member) {
    notFound()
  }

  return (
    <>
      <Link
        href={`/${org}/adherents/${member.id}`}
        className="mb-4 inline-block text-sm text-ink-soft hover:text-brand"
      >
        ← Retour à la fiche
      </Link>

      <PageHeader
        title={`Modifier ${memberDisplayName(member)}`}
        description={`Fiche n° ${member.memberNumber}.`}
      />

      <MemberForm org={org} categories={categories} member={member} />
    </>
  )
}
