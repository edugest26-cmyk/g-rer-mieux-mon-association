import type { Metadata } from 'next'
import Link from 'next/link'

import { Card, CardHeader, Chip, EmptyState, PageHeader, Stat, Table, Td, Th } from '@/components/ui'
import { requireOrganization } from '@/lib/auth/dal'
import { db } from '@/lib/db'
import { EVENT_KIND_LABELS, type EventKind } from '@/lib/enums'
import { formatDate, formatMoneyShort, memberDisplayName } from '@/lib/format'

export const metadata: Metadata = { title: "Aujourd'hui" }

export default async function DashboardPage({ params }: PageProps<'/[org]/tableau-de-bord'>) {
  const { org } = await params
  const { organization, can } = await requireOrganization(org)
  const orgId = organization.id
  const currency = organization.currency

  const now = new Date()

  // Toutes les agrégations partent du même `organizationId` : c'est ce filtre,
  // et lui seul, qui garantit qu'aucune donnée d'une autre association ne
  // remonte dans les chiffres affichés.
  const [
    activeMembers,
    lapsedMembers,
    pendingMembers,
    duesAggregate,
    paidAggregate,
    revenue,
    expense,
    upcomingEvents,
    lateDues,
    nextMeeting,
    expiringDocs,
  ] = await Promise.all([
    db.member.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
    db.member.count({ where: { organizationId: orgId, status: 'LAPSED' } }),
    db.member.count({ where: { organizationId: orgId, status: 'PENDING' } }),
    db.due.aggregate({
      where: { organizationId: orgId, status: { in: ['PENDING', 'PARTIAL', 'PAID'] } },
      _sum: { amountCents: true },
    }),
    db.due.aggregate({
      where: { organizationId: orgId },
      _sum: { paidCents: true },
    }),
    db.transaction.aggregate({
      where: { organizationId: orgId, kind: 'INCOME', status: { in: ['POSTED', 'RECONCILED'] } },
      _sum: { totalCents: true },
    }),
    db.transaction.aggregate({
      where: { organizationId: orgId, kind: 'EXPENSE', status: { in: ['POSTED', 'RECONCILED'] } },
      _sum: { totalCents: true },
    }),
    db.event.findMany({
      where: { organizationId: orgId, startAt: { gte: now }, status: { in: ['PUBLISHED', 'FULL'] } },
      orderBy: { startAt: 'asc' },
      take: 5,
      select: {
        id: true,
        slug: true,
        title: true,
        kind: true,
        startAt: true,
        capacity: true,
        _count: { select: { registrations: { where: { status: 'CONFIRMED' } } } },
      },
    }),
    db.due.findMany({
      where: { organizationId: orgId, status: { in: ['PENDING', 'PARTIAL'] } },
      orderBy: { dueDate: 'asc' },
      take: 6,
      select: {
        id: true,
        label: true,
        amountCents: true,
        paidCents: true,
        dueDate: true,
        member: {
          select: { id: true, kind: true, firstName: true, lastName: true, legalName: true },
        },
      },
    }),
    db.meeting.findFirst({
      where: { organizationId: orgId, startAt: { gte: now } },
      orderBy: { startAt: 'asc' },
      select: { id: true, title: true, kind: true, startAt: true, locationName: true },
    }),
    db.document.count({
      where: {
        organizationId: orgId,
        archivedAt: null,
        expiresAt: { gte: now, lte: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000) },
      },
    }),
  ])

  const expectedCents = duesAggregate._sum.amountCents ?? 0
  const collectedCents = paidAggregate._sum.paidCents ?? 0
  const revenueCents = revenue._sum.totalCents ?? 0
  const expenseCents = expense._sum.totalCents ?? 0
  const balanceCents = revenueCents - expenseCents

  const collectionRate = expectedCents > 0 ? Math.round((collectedCents / expectedCents) * 100) : 0

  return (
    <>
      {/* « Aujourd'hui » et non « Tableau de bord » : le titre doit dire ce
          qu'on vient y chercher, pas nommer un genre de page. */}
      <PageHeader title="Aujourd'hui" description={`Vue d'ensemble de ${organization.name}.`} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Adhérents à jour"
          value={activeMembers}
          hint={
            lapsedMembers + pendingMembers > 0
              ? `${lapsedMembers} échu${lapsedMembers > 1 ? 's' : ''}, ${pendingMembers} en attente`
              : 'Aucun retard'
          }
          tone={lapsedMembers > 0 ? 'warning' : 'positive'}
        />
        <Stat
          label="Cotisations encaissées"
          value={formatMoneyShort(collectedCents, currency)}
          hint={`${collectionRate} % de ${formatMoneyShort(expectedCents, currency)} appelés`}
          tone={collectionRate >= 80 ? 'positive' : 'warning'}
        />
        <Stat
          label="Résultat de l'exercice"
          value={formatMoneyShort(balanceCents, currency)}
          hint={`${formatMoneyShort(revenueCents, currency)} de produits, ${formatMoneyShort(expenseCents, currency)} de charges`}
          tone={balanceCents >= 0 ? 'positive' : 'danger'}
        />
        <Stat
          label="Événements à venir"
          value={upcomingEvents.length}
          hint={
            nextMeeting
              ? `Prochaine réunion le ${formatDate(nextMeeting.startAt)}`
              : 'Aucune réunion programmée'
          }
        />
      </div>

      {expiringDocs > 0 ? (
        <Card className="mt-4 border-warning/30 bg-warning-soft px-5 py-3.5">
          <p className="text-sm text-warning">
            <strong className="font-semibold">{expiringDocs}</strong> document
            {expiringDocs > 1 ? 's arrivent' : ' arrive'} à échéance dans les trois prochains mois.{' '}
            <Link href={`/${org}/documents`} className="font-medium underline">
              Vérifier
            </Link>
          </p>
        </Card>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {can('dues.read') ? (
          <Card>
            <CardHeader
              title="Cotisations en attente"
              description="Les relances à passer en priorité."
              action={
                <Link
                  href={`/${org}/cotisations`}
                  className="text-sm font-medium text-brand hover:underline"
                >
                  Tout voir
                </Link>
              }
            />
            {lateDues.length === 0 ? (
              <EmptyState
                title="Aucune cotisation en attente"
                description="Toutes les cotisations appelées ont été réglées."
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Adhérent</Th>
                    <Th>Échéance</Th>
                    <Th className="text-right">Reste dû</Th>
                  </tr>
                </thead>
                <tbody>
                  {lateDues.map((due) => {
                    const remaining = due.amountCents - due.paidCents
                    const overdue = due.dueDate != null && due.dueDate < now

                    return (
                      <tr key={due.id}>
                        <Td>
                          <Link
                            href={`/${org}/adherents/${due.member.id}`}
                            className="font-medium text-ink hover:text-brand"
                          >
                            {memberDisplayName(due.member)}
                          </Link>
                        </Td>
                        <Td>
                          {due.dueDate ? (
                            <span className={overdue ? 'text-danger' : 'text-ink-soft'}>
                              {formatDate(due.dueDate)}
                            </span>
                          ) : (
                            <span className="text-ink-faint">—</span>
                          )}
                        </Td>
                        <Td className="tabular text-right font-medium">
                          {formatMoneyShort(remaining, currency)}
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            )}
          </Card>
        ) : null}

        {can('events.read') ? (
          <Card>
            <CardHeader
              title="Prochains événements"
              action={
                <Link
                  href={`/${org}/evenements`}
                  className="text-sm font-medium text-brand hover:underline"
                >
                  Tout voir
                </Link>
              }
            />
            {upcomingEvents.length === 0 ? (
              <EmptyState
                title="Aucun événement programmé"
                description="Créez un événement pour ouvrir les inscriptions."
              />
            ) : (
              <ul className="divide-y divide-line">
                {upcomingEvents.map((event) => (
                  <li key={event.id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/${org}/evenements/${event.slug}`}
                        className="block truncate font-medium text-ink hover:text-brand"
                      >
                        {event.title}
                      </Link>
                      <p className="mt-0.5 text-sm text-ink-faint">
                        {formatDate(event.startAt)} ·{' '}
                        {EVENT_KIND_LABELS[event.kind as EventKind] ?? event.kind}
                      </p>
                    </div>
                    <Chip tone={event.capacity && event._count.registrations >= event.capacity ? 'warning' : 'neutral'}>
                      {event._count.registrations}
                      {event.capacity ? ` / ${event.capacity}` : ''} inscrit
                      {event._count.registrations > 1 ? 's' : ''}
                    </Chip>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}
      </div>
    </>
  )
}
