import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  Card,
  CardHeader,
  Chip,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
  type Tone,
} from '@/components/ui'
import { requireOrganization } from '@/lib/auth/dal'
import { db } from '@/lib/db'
import {
  EVENT_KIND_LABELS,
  EVENT_STATUS_LABELS,
  REGISTRATION_STATUS_LABELS,
  type EventKind,
  type EventStatus,
  type RegistrationStatus,
} from '@/lib/enums'
import { formatDateTime, formatMoneyShort, memberDisplayName } from '@/lib/format'

import {
  CancelRegistrationButton,
  CheckInButton,
  EventStatusActions,
  RegistrationForm,
  TicketTypeForm,
} from './event-actions'

const STATUS_TONES: Record<EventStatus, Tone> = {
  PUBLISHED: 'positive',
  DRAFT: 'neutral',
  FULL: 'warning',
  CANCELED: 'danger',
  ARCHIVED: 'neutral',
}

const REGISTRATION_TONES: Record<RegistrationStatus, Tone> = {
  CONFIRMED: 'positive',
  ATTENDED: 'brand',
  PENDING: 'warning',
  WAITLISTED: 'warning',
  CANCELED: 'neutral',
  NO_SHOW: 'danger',
}

export async function generateMetadata(
  props: PageProps<'/[org]/evenements/[slug]'>,
): Promise<Metadata> {
  const { org, slug } = await props.params
  const { organization } = await requireOrganization(org)

  const event = await db.event.findFirst({
    where: { slug, organizationId: organization.id },
    select: { title: true },
  })

  return { title: event?.title ?? 'Événement' }
}

export default async function EventPage(props: PageProps<'/[org]/evenements/[slug]'>) {
  const { org, slug } = await props.params
  const { organization, can } = await requireOrganization(org)
  const currency = organization.currency
  const canWrite = can('events.write')
  const canCheckIn = can('events.checkin')

  const event = await db.event.findFirst({
    where: { slug, organizationId: organization.id },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      kind: true,
      status: true,
      startAt: true,
      endAt: true,
      locationName: true,
      locationAddress: true,
      onlineUrl: true,
      capacity: true,
      membersOnly: true,
      requiresApproval: true,
      registrationClosesAt: true,
      ticketTypes: {
        where: { archivedAt: null },
        orderBy: { position: 'asc' },
        select: { id: true, name: true, priceCents: true, quantity: true },
      },
      registrations: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          status: true,
          quantity: true,
          amountCents: true,
          paidCents: true,
          guestName: true,
          guestEmail: true,
          ticketCode: true,
          member: {
            select: {
              id: true,
              kind: true,
              firstName: true,
              lastName: true,
              legalName: true,
              memberNumber: true,
            },
          },
          ticketType: { select: { name: true } },
        },
      },
    },
  })

  if (!event) {
    notFound()
  }

  const active = event.registrations.filter((r) => r.status !== 'CANCELED')
  const seats = active
    .filter((r) => r.status === 'CONFIRMED' || r.status === 'ATTENDED')
    .reduce((sum, r) => sum + r.quantity, 0)
  const waitlisted = active.filter((r) => r.status === 'WAITLISTED').length
  const attended = active.filter((r) => r.status === 'ATTENDED').length
  const billed = active.reduce((sum, r) => sum + r.amountCents, 0)
  const collected = active.reduce((sum, r) => sum + r.paidCents, 0)

  // Un adhérent déjà inscrit ne doit pas réapparaître dans la liste de choix.
  const registeredMemberIds = new Set(active.map((r) => r.member?.id).filter(Boolean))

  const selectableMembers = canWrite
    ? (
        await db.member.findMany({
          where: {
            organizationId: organization.id,
            status: { in: ['ACTIVE', 'LAPSED', 'PENDING'] },
            leftAt: null,
          },
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          select: {
            id: true,
            kind: true,
            firstName: true,
            lastName: true,
            legalName: true,
            memberNumber: true,
          },
        })
      )
        .filter((m) => !registeredMemberIds.has(m.id))
        .map((m) => ({ id: m.id, label: `${memberDisplayName(m)} (${m.memberNumber})` }))
    : []

  return (
    <>
      <Link
        href={`/${org}/evenements`}
        className="mb-4 inline-block text-sm text-ink-soft hover:text-brand"
      >
        ← Retour aux événements
      </Link>

      <PageHeader
        title={event.title}
        description={
          <>
            {EVENT_KIND_LABELS[event.kind as EventKind] ?? event.kind} ·{' '}
            {formatDateTime(event.startAt)}
            {event.locationName ? ` · ${event.locationName}` : ''}
            {event.membersOnly ? ' · réservé aux adhérents' : ' · ouvert au public'}
          </>
        }
        action={
          <div className="flex items-center gap-3">
            <Chip tone={STATUS_TONES[event.status as EventStatus] ?? 'neutral'}>
              {EVENT_STATUS_LABELS[event.status as EventStatus] ?? event.status}
            </Chip>
            {canWrite ? (
              <Link
                href={`/${org}/evenements/${event.slug}/modifier`}
                className="inline-flex items-center rounded-lg border border-line-strong bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:bg-surface-muted"
              >
                Modifier
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Places prises</p>
          <p className="tabular mt-1.5 text-2xl font-semibold text-ink">
            {seats}
            {event.capacity ? (
              <span className="text-base font-normal text-ink-faint"> / {event.capacity}</span>
            ) : null}
          </p>
          {event.capacity ? (
            <p className="mt-1 text-xs text-ink-faint">
              {Math.max(0, event.capacity - seats)} place
              {event.capacity - seats > 1 ? 's' : ''} restante
              {event.capacity - seats > 1 ? 's' : ''}
            </p>
          ) : (
            <p className="mt-1 text-xs text-ink-faint">Jauge illimitée</p>
          )}
        </div>

        <div className="card px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
            Liste d&apos;attente
          </p>
          <p
            className={`tabular mt-1.5 text-2xl font-semibold ${waitlisted > 0 ? 'text-warning' : 'text-ink'}`}
          >
            {waitlisted}
          </p>
        </div>

        <div className="card px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Présents</p>
          <p className="tabular mt-1.5 text-2xl font-semibold text-ink">{attended}</p>
          <p className="mt-1 text-xs text-ink-faint">pointés à l&apos;entrée</p>
        </div>

        <div className="card px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Recettes</p>
          <p className="tabular mt-1.5 text-2xl font-semibold text-positive">
            {formatMoneyShort(collected, currency)}
          </p>
          <p className="mt-1 text-xs text-ink-faint">
            sur {formatMoneyShort(billed, currency)} facturés
          </p>
        </div>
      </div>

      {event.description ? (
        <Card className="mt-4 px-5 py-4">
          <p className="whitespace-pre-line text-sm text-ink-soft">{event.description}</p>
        </Card>
      ) : null}

      {canWrite ? (
        <Card className="mt-4 px-5 py-4">
          <EventStatusActions org={org} id={event.id} status={event.status} />
        </Card>
      ) : null}

      {canWrite && event.status !== 'CANCELED' ? (
        <Card className="mt-4">
          <CardHeader
            title="Inscrire un participant"
            description={
              event.capacity !== null && seats >= event.capacity
                ? "La jauge est atteinte : les nouvelles inscriptions iront en liste d'attente."
                : undefined
            }
          />
          <RegistrationForm
            org={org}
            eventId={event.id}
            members={selectableMembers}
            ticketTypes={event.ticketTypes.map((t) => ({
              id: t.id,
              name: t.name,
              priceLabel: formatMoneyShort(t.priceCents, currency),
            }))}
            membersOnly={event.membersOnly}
          />
        </Card>
      ) : null}

      <Card className="mt-4">
        <CardHeader
          title="Inscriptions"
          description={`${active.length} inscription${active.length > 1 ? 's' : ''} en cours.`}
        />
        {event.registrations.length === 0 ? (
          <EmptyState
            title="Aucune inscription"
            description="Les participants inscrits apparaîtront ici."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Participant</Th>
                <Th>Tarif</Th>
                <Th className="text-right">Places</Th>
                <Th className="text-right">Montant</Th>
                <Th>Statut</Th>
                {canWrite || canCheckIn ? <Th className="text-right">Actions</Th> : null}
              </tr>
            </thead>
            <tbody>
              {event.registrations.map((registration) => {
                const name = registration.member
                  ? memberDisplayName(registration.member)
                  : (registration.guestName ?? 'Participant')
                const canceled = registration.status === 'CANCELED'

                return (
                  <tr key={registration.id} className={canceled ? 'opacity-60' : undefined}>
                    <Td>
                      {registration.member ? (
                        <Link
                          href={`/${org}/adherents/${registration.member.id}`}
                          className="font-medium text-ink hover:text-brand"
                        >
                          {name}
                        </Link>
                      ) : (
                        <span className="font-medium text-ink">{name}</span>
                      )}
                      <span className="block text-xs text-ink-faint">
                        {registration.member
                          ? registration.member.memberNumber
                          : (registration.guestEmail ?? 'Participant extérieur')}
                        {registration.ticketCode ? ` · billet ${registration.ticketCode}` : ''}
                      </span>
                    </Td>
                    <Td className="text-ink-soft">{registration.ticketType?.name ?? '—'}</Td>
                    <Td className="tabular text-right">{registration.quantity}</Td>
                    <Td className="tabular text-right">
                      {registration.amountCents > 0
                        ? formatMoneyShort(registration.amountCents, currency)
                        : '—'}
                    </Td>
                    <Td>
                      <Chip tone={REGISTRATION_TONES[registration.status as RegistrationStatus] ?? 'neutral'}>
                        {REGISTRATION_STATUS_LABELS[registration.status as RegistrationStatus] ??
                          registration.status}
                      </Chip>
                    </Td>
                    {canWrite || canCheckIn ? (
                      <Td className="text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {/* Le pointage n'a de sens que sur une inscription active. */}
                          {canCheckIn &&
                          (registration.status === 'CONFIRMED' ||
                            registration.status === 'ATTENDED') ? (
                            <CheckInButton
                              org={org}
                              registrationId={registration.id}
                              present={registration.status === 'ATTENDED'}
                            />
                          ) : null}
                          {canWrite && !canceled ? (
                            <CancelRegistrationButton org={org} registrationId={registration.id} />
                          ) : null}
                        </div>
                      </Td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader title="Tarifs" />
        {event.ticketTypes.length === 0 ? (
          <EmptyState
            title="Aucun tarif"
            description="Sans tarif, les inscriptions sont enregistrées sans montant."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Tarif</Th>
                <Th className="text-right">Prix</Th>
                <Th className="text-right">Places dédiées</Th>
              </tr>
            </thead>
            <tbody>
              {event.ticketTypes.map((ticket) => (
                <tr key={ticket.id}>
                  <Td className="font-medium text-ink">{ticket.name}</Td>
                  <Td className="tabular text-right">
                    {ticket.priceCents === 0
                      ? 'Gratuit'
                      : formatMoneyShort(ticket.priceCents, currency)}
                  </Td>
                  <Td className="tabular text-right text-ink-soft">{ticket.quantity ?? '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {canWrite ? (
        <div className="mt-4">
          <TicketTypeForm org={org} eventId={event.id} />
        </div>
      ) : null}
    </>
  )
}
