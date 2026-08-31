import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { EventForm } from '@/app/[org]/evenements/event-form'
import { PageHeader } from '@/components/ui'
import { requirePermission } from '@/lib/auth/dal'
import { db } from '@/lib/db'

export const metadata: Metadata = { title: 'Modifier un événement' }

export default async function EditEventPage(
  props: PageProps<'/[org]/evenements/[slug]/modifier'>,
) {
  const { org, slug } = await props.params
  const { organization } = await requirePermission(org, 'events.write')

  const event = await db.event.findFirst({
    where: { slug, organizationId: organization.id },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      kind: true,
      startAt: true,
      endAt: true,
      locationName: true,
      locationAddress: true,
      onlineUrl: true,
      capacity: true,
      membersOnly: true,
      requiresApproval: true,
      registrationClosesAt: true,
    },
  })

  if (!event) {
    notFound()
  }

  return (
    <>
      <Link
        href={`/${org}/evenements/${event.slug}`}
        className="mb-4 inline-block text-sm text-ink-soft hover:text-brand"
      >
        ← Retour à l&apos;événement
      </Link>

      <PageHeader
        title="Modifier l'événement"
        description="La jauge ne peut pas descendre sous le nombre de places déjà confirmées."
      />

      <EventForm org={org} event={event} />
    </>
  )
}
