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
import { isEmailConfigured } from '@/lib/email/send'
import { DUE_STATUS_LABELS, FEE_PERIOD_LABELS, type DueStatus, type FeePeriod } from '@/lib/enums'
import { formatDate, formatMoneyShort, memberDisplayName } from '@/lib/format'

import { ReminderForm } from './reminder-form'

export const metadata: Metadata = { title: 'Cotisations' }

const STATUS_TONES: Record<DueStatus, Tone> = {
  PAID: 'positive',
  PARTIAL: 'warning',
  PENDING: 'warning',
  WAIVED: 'neutral',
  CANCELED: 'neutral',
}

export default async function DuesPage(props: PageProps<'/[org]/cotisations'>) {
  const { org } = await props.params
  const searchParams = await props.searchParams
  const { organization, can, hasModule } = await requireOrganization(org)

  if (!hasModule('dues')) {
    return <ModuleDisabled moduleKey="dues" org={org} canManage={can('org.settings')} />
  }

  const canWrite = can('dues.write')

  const orgId = organization.id
  const currency = organization.currency
  const status = typeof searchParams.statut === 'string' ? searchParams.statut : ''
  const now = new Date()

  const where = { organizationId: orgId, ...(status ? { status } : {}) }

  const [dues, fees, totals, byStatus] = await Promise.all([
    db.due.findMany({
      where,
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
      take: 100,
      select: {
        id: true,
        label: true,
        amountCents: true,
        paidCents: true,
        status: true,
        dueDate: true,
        periodEnd: true,
        remindersSent: true,
        member: {
          select: { id: true, kind: true, firstName: true, lastName: true, legalName: true },
        },
      },
    }),
    db.fee.findMany({
      where: { organizationId: orgId, archivedAt: null },
      orderBy: { amountCents: 'desc' },
      select: {
        id: true,
        name: true,
        amountCents: true,
        period: true,
        isFreeAmount: true,
        taxDeductible: true,
        category: { select: { name: true } },
        _count: { select: { dues: true } },
      },
    }),
    db.due.aggregate({
      where: { organizationId: orgId },
      _sum: { amountCents: true, paidCents: true },
    }),
    db.due.groupBy({
      by: ['status'],
      where: { organizationId: orgId },
      _count: { _all: true },
      _sum: { amountCents: true, paidCents: true },
    }),
  ])

  const calledCents = totals._sum.amountCents ?? 0
  const collectedCents = totals._sum.paidCents ?? 0
  const outstandingCents = calledCents - collectedCents
  const rate = calledCents > 0 ? Math.round((collectedCents / calledCents) * 100) : 0

  const overdueCount = byStatus
    .filter((row) => row.status === 'PENDING' || row.status === 'PARTIAL')
    .reduce((sum, row) => sum + row._count._all, 0)

  return (
    <>
      <PageHeader
        title="Cotisations"
        description="Appels de cotisation, règlements et relances."
        action={
          canWrite ? (
            <div className="flex items-center gap-4">
              <ReminderForm
                org={org}
                pendingCount={overdueCount}
                emailConfigured={isEmailConfigured()}
              />
              <Link
                href={`/${org}/cotisations/emettre`}
                className="inline-flex items-center rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-brand-ink hover:bg-brand-dark"
              >
                Émettre les appels
              </Link>
            </div>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Appelé" value={formatMoneyShort(calledCents, currency)} />
        <Stat
          label="Encaissé"
          value={formatMoneyShort(collectedCents, currency)}
          hint={`${rate} % du montant appelé`}
          tone="positive"
        />
        <Stat
          label="Reste à recouvrer"
          value={formatMoneyShort(outstandingCents, currency)}
          tone={outstandingCents > 0 ? 'warning' : 'positive'}
        />
        <Stat
          label="Cotisations non soldées"
          value={overdueCount}
          hint={overdueCount > 0 ? 'À relancer' : 'Rien à relancer'}
          tone={overdueCount > 0 ? 'warning' : 'positive'}
        />
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Barèmes en vigueur"
          description="Les tarifs proposés à l'adhésion."
          action={
            canWrite ? (
              <Link
                href={`/${org}/cotisations/baremes/nouveau`}
                className="text-sm font-medium text-brand hover:underline"
              >
                Nouveau barème
              </Link>
            ) : null
          }
        />
        {fees.length === 0 ? (
          <EmptyState
            title="Aucun barème"
            description="Définissez au moins un tarif pour pouvoir appeler des cotisations."
            action={
              canWrite ? (
                <Link
                  href={`/${org}/cotisations/baremes/nouveau`}
                  className="inline-flex items-center rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-brand-ink hover:bg-brand-dark"
                >
                  Créer un barème
                </Link>
              ) : null
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Barème</Th>
                <Th>Catégorie</Th>
                <Th>Périodicité</Th>
                <Th className="text-right">Montant</Th>
                <Th className="text-right">Appels émis</Th>
              </tr>
            </thead>
            <tbody>
              {fees.map((fee) => (
                <tr key={fee.id}>
                  <Td>
                    {canWrite ? (
                      <Link
                        href={`/${org}/cotisations/baremes/${fee.id}`}
                        className="font-medium text-ink hover:text-brand"
                      >
                        {fee.name}
                      </Link>
                    ) : (
                      <span className="font-medium text-ink">{fee.name}</span>
                    )}
                    {fee.taxDeductible ? (
                      <Chip tone="brand" className="ml-2">
                        Reçu fiscal
                      </Chip>
                    ) : null}
                  </Td>
                  <Td className="text-ink-soft">{fee.category?.name ?? 'Toutes'}</Td>
                  <Td className="text-ink-soft">
                    {FEE_PERIOD_LABELS[fee.period as FeePeriod] ?? fee.period}
                  </Td>
                  <Td className="tabular text-right font-medium">
                    {formatMoneyShort(fee.amountCents, currency)}
                    {fee.isFreeAmount ? (
                      <span className="ml-1 text-xs font-normal text-ink-faint">minimum</span>
                    ) : null}
                  </Td>
                  <Td className="tabular text-right text-ink-soft">{fee._count.dues}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Appels de cotisation"
          description={status ? `Filtré sur « ${DUE_STATUS_LABELS[status as DueStatus] ?? status} ».` : undefined}
          action={
            <div className="flex flex-wrap gap-1.5">
              <Link
                href={`/${org}/cotisations`}
                className={`rounded-lg px-2.5 py-1 text-sm ${status === '' ? 'bg-brand-soft font-medium text-brand-dark' : 'text-ink-soft hover:bg-surface-muted'}`}
              >
                Tous
              </Link>
              {(['PENDING', 'PAID', 'WAIVED'] as const).map((s) => (
                <Link
                  key={s}
                  href={`/${org}/cotisations?statut=${s}`}
                  className={`rounded-lg px-2.5 py-1 text-sm ${status === s ? 'bg-brand-soft font-medium text-brand-dark' : 'text-ink-soft hover:bg-surface-muted'}`}
                >
                  {DUE_STATUS_LABELS[s]}
                </Link>
              ))}
            </div>
          }
        />

        {dues.length === 0 ? (
          <EmptyState
            title="Aucun appel de cotisation"
            description="Les appels apparaîtront ici une fois émis."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Adhérent</Th>
                <Th>Période</Th>
                <Th>Échéance</Th>
                <Th className="text-right">Montant</Th>
                <Th className="text-right">Réglé</Th>
                <Th>Statut</Th>
                {canWrite ? <Th className="text-right">Action</Th> : null}
              </tr>
            </thead>
            <tbody>
              {dues.map((due) => {
                const overdue =
                  due.dueDate != null && due.dueDate < now && due.status !== 'PAID' && due.status !== 'WAIVED'

                return (
                  <tr key={due.id} className="hover:bg-surface-muted">
                    <Td>
                      <Link
                        href={`/${org}/adherents/${due.member.id}`}
                        className="font-medium text-ink hover:text-brand"
                      >
                        {memberDisplayName(due.member)}
                      </Link>
                    </Td>
                    <Td className="text-ink-soft">{due.label}</Td>
                    <Td>
                      {due.dueDate ? (
                        <span className={overdue ? 'font-medium text-danger' : 'text-ink-soft'}>
                          {formatDate(due.dueDate)}
                          {overdue && due.remindersSent > 0 ? (
                            <span className="ml-1.5 text-xs font-normal">
                              ({due.remindersSent} relance{due.remindersSent > 1 ? 's' : ''})
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </Td>
                    <Td className="tabular text-right">{formatMoneyShort(due.amountCents, currency)}</Td>
                    <Td className="tabular text-right font-medium">
                      {formatMoneyShort(due.paidCents, currency)}
                    </Td>
                    <Td>
                      <Chip tone={STATUS_TONES[due.status as DueStatus] ?? 'neutral'}>
                        {DUE_STATUS_LABELS[due.status as DueStatus] ?? due.status}
                      </Chip>
                    </Td>
                    {canWrite ? (
                      <Td className="text-right">
                        {/* Rien à encaisser sur un appel soldé, exonéré ou annulé. */}
                        {due.status === 'PENDING' || due.status === 'PARTIAL' ? (
                          <Link
                            href={`/${org}/cotisations/${due.id}/reglement`}
                            className="font-medium text-brand hover:underline"
                          >
                            Régler
                          </Link>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </Td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  )
}
