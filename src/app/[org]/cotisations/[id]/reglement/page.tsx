import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Card, CardHeader, Chip, PageHeader, Table, Td, Th } from '@/components/ui'
import { requirePermission } from '@/lib/auth/dal'
import { db } from '@/lib/db'
import {
  DUE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  type DueStatus,
  type PaymentMethod,
} from '@/lib/enums'
import { formatDate, formatMoneyShort, memberDisplayName } from '@/lib/format'

export const metadata: Metadata = { title: 'Enregistrer un règlement' }

import { PaymentForm } from './payment-form'

export default async function DuePaymentPage(
  props: PageProps<'/[org]/cotisations/[id]/reglement'>,
) {
  const { org, id } = await props.params
  const { organization } = await requirePermission(org, 'dues.write')
  const currency = organization.currency

  const [due, bankAccounts, ledgerAccounts] = await Promise.all([
    // Le couple `{ id, organizationId }` empêche d'encaisser sur l'appel
    // d'une autre association.
    db.due.findFirst({
      where: { id, organizationId: organization.id },
      select: {
        id: true,
        label: true,
        amountCents: true,
        paidCents: true,
        status: true,
        periodStart: true,
        periodEnd: true,
        dueDate: true,
        notes: true,
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
        fee: { select: { name: true } },
        payments: {
          orderBy: { date: 'desc' },
          select: { id: true, amountCents: true, date: true, method: true, reference: true },
        },
      },
    }),
    db.bankAccount.findMany({
      where: { organizationId: organization.id, archivedAt: null },
      orderBy: { kind: 'asc' },
      select: { id: true, name: true },
    }),
    db.ledgerAccount.findMany({
      where: { organizationId: organization.id, number: { in: ['512', '756'] } },
      select: { number: true },
    }),
  ])

  if (!due) {
    notFound()
  }

  const remaining = due.amountCents - due.paidCents
  const canPostEntry = ledgerAccounts.length === 2
  const settled = due.status === 'PAID' || due.status === 'WAIVED' || due.status === 'CANCELED'

  return (
    <>
      <Link
        href={`/${org}/cotisations`}
        className="mb-4 inline-block text-sm text-ink-soft hover:text-brand"
      >
        ← Retour aux cotisations
      </Link>

      <PageHeader
        title={due.label}
        description={
          <>
            <Link
              href={`/${org}/adherents/${due.member.id}`}
              className="font-medium text-brand hover:underline"
            >
              {memberDisplayName(due.member)}
            </Link>{' '}
            · n° {due.member.memberNumber}
            {due.fee ? ` · ${due.fee.name}` : ''}
          </>
        }
        action={
          <Chip
            tone={
              due.status === 'PAID'
                ? 'positive'
                : due.status === 'WAIVED' || due.status === 'CANCELED'
                  ? 'neutral'
                  : 'warning'
            }
          >
            {DUE_STATUS_LABELS[due.status as DueStatus] ?? due.status}
          </Chip>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <div className="card px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Appelé</p>
          <p className="tabular mt-1.5 text-xl font-semibold text-ink">
            {formatMoneyShort(due.amountCents, currency)}
          </p>
        </div>
        <div className="card px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Déjà réglé</p>
          <p className="tabular mt-1.5 text-xl font-semibold text-positive">
            {formatMoneyShort(due.paidCents, currency)}
          </p>
        </div>
        <div className="card px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Reste dû</p>
          <p
            className={`tabular mt-1.5 text-xl font-semibold ${remaining > 0 ? 'text-warning' : 'text-positive'}`}
          >
            {formatMoneyShort(remaining, currency)}
          </p>
          {due.dueDate ? (
            <p className="mt-1 text-xs text-ink-faint">Échéance le {formatDate(due.dueDate)}</p>
          ) : null}
        </div>
      </div>

      {settled ? (
        <Card className="px-5 py-6 text-center">
          {/* Sujet féminin : les libellés de statut s'accordent avec « cotisation »,
              pas avec « appel ». */}
          <p className="text-sm text-ink">
            Cette cotisation est{' '}
            {(DUE_STATUS_LABELS[due.status as DueStatus] ?? due.status).toLowerCase()} : il
            n&apos;y a plus rien à encaisser.
          </p>
          {due.notes ? <p className="mt-1 text-sm text-ink-faint">{due.notes}</p> : null}
        </Card>
      ) : (
        <PaymentForm
          org={org}
          dueId={due.id}
          remainingLabel={formatMoneyShort(remaining, currency)}
          // Le champ montant attend une saisie libre : on pré-remplit en euros.
          remainingInput={(remaining / 100).toFixed(2).replace('.', ',')}
          today={new Date().toISOString().slice(0, 10)}
          bankAccounts={bankAccounts}
          canPostEntry={canPostEntry}
        />
      )}

      {due.payments.length > 0 ? (
        <Card className="mt-4">
          <CardHeader title="Règlements déjà enregistrés" />
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Moyen</Th>
                <Th>Référence</Th>
                <Th className="text-right">Montant</Th>
              </tr>
            </thead>
            <tbody>
              {due.payments.map((payment) => (
                <tr key={payment.id}>
                  <Td className="text-ink-soft">{formatDate(payment.date)}</Td>
                  <Td className="text-ink-soft">
                    {PAYMENT_METHOD_LABELS[payment.method as PaymentMethod] ?? payment.method}
                  </Td>
                  <Td className="text-ink-faint">{payment.reference ?? '—'}</Td>
                  <Td className="tabular text-right font-medium">
                    {formatMoneyShort(payment.amountCents, currency)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}
    </>
  )
}
