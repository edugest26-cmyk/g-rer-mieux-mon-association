import type { Metadata } from 'next'
import Link from 'next/link'

import {
  Card,
  CardHeader,
  Chip,
  EmptyState,
  PageHeader,
  Stat,
  Table,
  Td,
  Th,
  type Tone,
} from '@/components/ui'
import { ModuleDisabled } from '@/components/module-disabled'
import { requireOrganization } from '@/lib/auth/dal'
import { db } from '@/lib/db'
import {
  EVENT_KIND_LABELS,
  EVENT_STATUS_LABELS,
  type EventKind,
  type EventStatus,
} from '@/lib/enums'
import { formatDateTime, formatMoneyShort } from '@/lib/format'

export const metadata: Metadata = { title: 'Événements' }

const STATUS_TONES: Record<EventStatus, Tone> = {
  PUBLISHED: 'positive',
  DRAFT: 'neutral',
  FULL: 'warning',
  CANCELED: 'danger',
  ARCHIVED: 'neutral',
}

export default async function EventsPage({ params }: PageProps<'/[org]/evenements'>) {
  const { org } = await params
  const { organization, can, hasModule } = await requireOrganization(org)

  if (!hasModule('events')) {
    return <ModuleDisabled moduleKey="events" org={org} canManage={can('org.settings')} />
  }
  const canWrite = can('events.write')
  const orgId = organization.id
  const currency = organization.currency
  const now = new Date()

  const [events, registrationTotals, resources, bookings] = await Promise.all([
    db.event.findMany({
      where: { organizationId: orgId },
      orderBy: { startAt: 'desc' },
      take: 50,
      select: {
        id: true,
        slug: true,
        title: true,
        kind: true,
        status: true,
        startAt: true,
        endAt: true,
        capacity: true,
        locationName: true,
        membersOnly: true,
        _count: { select: { registrations: true } },
        registrations: {
          where: { status: { in: ['CONFIRMED', 'ATTENDED'] } },
          select: { quantity: true, amountCents: true, paidCents: true },
        },
      },
    }),
    db.registration.aggregate({
      where: { organizationId: orgId },
      _sum: { amountCents: true, paidCents: true },
      _count: { _all: true },
    }),
    db.resource.findMany({
      where: { organizationId: orgId, archivedAt: null },
      select: {
        id: true,
        name: true,
        kind: true,
        capacity: true,
        _count: { select: { bookings: true } },
      },
    }),
    db.resourceBooking.findMany({
      where: { organizationId: orgId, startAt: { gte: now } },
      orderBy: { startAt: 'asc' },
      take: 8,
      select: {
        id: true,
        title: true,
        startAt: true,
        status: true,
        resource: { select: { name: true } },
      },
    }),
  ])

  const upcoming = events.filter((e) => e.startAt >= now).length
  const ticketingCents = registrationTotals._sum.paidCents ?? 0

  return (
    <>
      <PageHeader
        title="Événements"
        description="Agenda, inscriptions, billetterie et réservation des ressources."
        action={
          canWrite ? (
            <Link
              href={`/${org}/evenements/nouveau`}
              className="inline-flex items-center rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-brand-ink hover:bg-brand-dark"
            >
              Nouvel événement
            </Link>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Événements à venir" value={upcoming} />
        <Stat label="Événements au total" value={events.length} />
        <Stat label="Inscriptions" value={registrationTotals._count._all} />
        <Stat
          label="Billetterie encaissée"
          value={formatMoneyShort(ticketingCents, currency)}
          hint={`sur ${formatMoneyShort(registrationTotals._sum.amountCents ?? 0, currency)} facturés`}
          tone="positive"
        />
      </div>

      <Card className="mt-4">
        <CardHeader title="Agenda" description="Du plus récent au plus ancien." />
        {events.length === 0 ? (
          <EmptyState
            title="Aucun événement"
            description="Créez un événement pour ouvrir les inscriptions à vos adhérents."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Événement</Th>
                <Th>Nature</Th>
                <Th>Date</Th>
                <Th className="text-right">Inscrits</Th>
                <Th className="text-right">Recettes</Th>
                <Th>Statut</Th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const seats = event.registrations.reduce((sum, r) => sum + r.quantity, 0)
                const collected = event.registrations.reduce((sum, r) => sum + r.paidCents, 0)
                const full = event.capacity != null && seats >= event.capacity

                return (
                  <tr key={event.id} className="hover:bg-surface-muted">
                    <Td>
                      <Link
                        href={`/${org}/evenements/${event.slug}`}
                        className="font-medium text-ink hover:text-brand"
                      >
                        {event.title}
                      </Link>
                      <span className="block text-xs text-ink-faint">
                        {event.locationName ?? 'Lieu non précisé'}
                        {event.membersOnly ? ' · réservé aux adhérents' : ' · ouvert au public'}
                      </span>
                    </Td>
                    <Td className="text-ink-soft">
                      {EVENT_KIND_LABELS[event.kind as EventKind] ?? event.kind}
                    </Td>
                    <Td className="text-ink-soft">{formatDateTime(event.startAt)}</Td>
                    <Td className="tabular text-right">
                      <span className={full ? 'font-medium text-warning' : ''}>
                        {seats}
                        {event.capacity ? ` / ${event.capacity}` : ''}
                      </span>
                      {event._count.registrations > seats ? (
                        <span className="block text-xs text-ink-faint">
                          {event._count.registrations - seats} en attente
                        </span>
                      ) : null}
                    </Td>
                    <Td className="tabular text-right font-medium">
                      {collected > 0 ? formatMoneyShort(collected, currency) : '—'}
                    </Td>
                    <Td>
                      <Chip tone={STATUS_TONES[event.status as EventStatus] ?? 'neutral'}>
                        {EVENT_STATUS_LABELS[event.status as EventStatus] ?? event.status}
                      </Chip>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Ressources" description="Salles, véhicules et matériel réservables." />
          {resources.length === 0 ? (
            <EmptyState title="Aucune ressource" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Ressource</Th>
                  <Th>Capacité</Th>
                  <Th className="text-right">Réservations</Th>
                </tr>
              </thead>
              <tbody>
                {resources.map((resource) => (
                  <tr key={resource.id}>
                    <Td className="font-medium text-ink">{resource.name}</Td>
                    <Td className="text-ink-soft">
                      {resource.capacity ? `${resource.capacity} places` : '—'}
                    </Td>
                    <Td className="tabular text-right text-ink-soft">{resource._count.bookings}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Prochaines réservations" />
          {bookings.length === 0 ? (
            <EmptyState title="Aucune réservation à venir" />
          ) : (
            <ul className="divide-y divide-line">
              {bookings.map((booking) => (
                <li key={booking.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{booking.title}</p>
                    <p className="text-sm text-ink-faint">
                      {booking.resource.name} · {formatDateTime(booking.startAt)}
                    </p>
                  </div>
                  <Chip tone={booking.status === 'APPROVED' ? 'positive' : 'warning'}>
                    {booking.status === 'APPROVED' ? 'Confirmée' : 'À valider'}
                  </Chip>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
