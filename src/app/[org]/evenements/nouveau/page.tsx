import type { Metadata } from 'next'
import Link from 'next/link'

import { EventForm } from '@/app/[org]/evenements/event-form'
import { PageHeader } from '@/components/ui'
import { requirePermission } from '@/lib/auth/dal'

export const metadata: Metadata = { title: 'Nouvel événement' }

export default async function NewEventPage({ params }: PageProps<'/[org]/evenements/nouveau'>) {
  const { org } = await params
  await requirePermission(org, 'events.write')

  return (
    <>
      <Link
        href={`/${org}/evenements`}
        className="mb-4 inline-block text-sm text-ink-soft hover:text-brand"
      >
        ← Retour aux événements
      </Link>

      <PageHeader
        title="Nouvel événement"
        description="Les tarifs et les inscriptions se gèrent ensuite depuis sa fiche."
      />

      <EventForm org={org} />
    </>
  )
}
