import type { Metadata } from 'next'

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
  ACCOUNT_TYPE_LABELS,
  TRANSACTION_KIND_LABELS,
  TRANSACTION_STATUS_LABELS,
  type AccountType,
  type TransactionKind,
  type TransactionStatus,
} from '@/lib/enums'
import { formatDate, formatMoneyShort } from '@/lib/format'

export const metadata: Metadata = { title: 'Finances' }

const STATUS_TONES: Record<TransactionStatus, Tone> = {
  DRAFT: 'neutral',
  POSTED: 'positive',
  RECONCILED: 'brand',
  CANCELED: 'danger',
}

export default async function FinancePage({ params }: PageProps<'/[org]/finances'>) {
  const { org } = await params
  const { organization, can, hasModule } = await requireOrganization(org)

  if (!hasModule('finance')) {
    return <ModuleDisabled moduleKey="finance" org={org} canManage={can('org.settings')} />
  }
  const orgId = organization.id
  const currency = organization.currency

  const [transactions, bankAccounts, donations, budget, lines] = await Promise.all([
    db.transaction.findMany({
      where: { organizationId: orgId },
      orderBy: { date: 'desc' },
      take: 40,
      select: {
        id: true,
        reference: true,
        label: true,
        date: true,
        kind: true,
        status: true,
        totalCents: true,
        bankAccount: { select: { name: true } },
      },
    }),
    db.bankAccount.findMany({
      where: { organizationId: orgId, archivedAt: null },
      select: { id: true, name: true, kind: true, openingBalanceCents: true },
    }),
    db.donation.aggregate({
      where: { organizationId: orgId },
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
    db.budget.findFirst({
      where: { organizationId: orgId, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        lines: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            label: true,
            plannedCents: true,
            direction: true,
            accountId: true,
          },
        },
      },
    }),
    // Cumul par compte comptable : c'est la base du compte de résultat.
    db.transactionLine.findMany({
      where: {
        transaction: { organizationId: orgId, status: { in: ['POSTED', 'RECONCILED'] } },
      },
      select: {
        debitCents: true,
        creditCents: true,
        accountId: true,
        account: { select: { number: true, name: true, type: true } },
      },
    }),
  ])

  // Agrégation en mémoire : le volume d'écritures d'une association tient
  // largement en RAM, et cela évite un `groupBy` avec jointure par compte.
  const perAccount = new Map<
    string,
    { number: string; name: string; type: string; debit: number; credit: number }
  >()

  for (const line of lines) {
    const key = line.accountId
    const entry = perAccount.get(key) ?? {
      number: line.account.number,
      name: line.account.name,
      type: line.account.type,
      debit: 0,
      credit: 0,
    }
    entry.debit += line.debitCents
    entry.credit += line.creditCents
    perAccount.set(key, entry)
  }

  const accountRows = [...perAccount.values()].sort((a, b) => a.number.localeCompare(b.number))

  // En comptabilité : les produits (7xx) sont au crédit, les charges (6xx) au débit.
  const revenueRows = accountRows.filter((a) => a.type === 'REVENUE')
  const expenseRows = accountRows.filter((a) => a.type === 'EXPENSE')

  const totalRevenue = revenueRows.reduce((sum, a) => sum + a.credit - a.debit, 0)
  const totalExpense = expenseRows.reduce((sum, a) => sum + a.debit - a.credit, 0)
  const result = totalRevenue - totalExpense

  const treasuryCents = bankAccounts.reduce((sum, account) => sum + account.openingBalanceCents, 0) + result

  return (
    <>
      <PageHeader
        title="Finances"
        description="Comptabilité, budget et suivi de trésorerie."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Produits" value={formatMoneyShort(totalRevenue, currency)} tone="positive" />
        <Stat label="Charges" value={formatMoneyShort(totalExpense, currency)} />
        <Stat
          label="Résultat"
          value={formatMoneyShort(result, currency)}
          hint={result >= 0 ? 'Excédent' : 'Déficit'}
          tone={result >= 0 ? 'positive' : 'danger'}
        />
        <Stat
          label="Trésorerie estimée"
          value={formatMoneyShort(treasuryCents, currency)}
          hint={`${donations._count._all} don${donations._count._all > 1 ? 's' : ''} — ${formatMoneyShort(donations._sum.amountCents ?? 0, currency)}`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Produits" description="Comptes de la classe 7." />
          {revenueRows.length === 0 ? (
            <EmptyState title="Aucun produit enregistré" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Compte</Th>
                  <Th className="text-right">Montant</Th>
                </tr>
              </thead>
              <tbody>
                {revenueRows.map((account) => (
                  <tr key={account.number}>
                    <Td>
                      <span className="tabular mr-2 text-ink-faint">{account.number}</span>
                      {account.name}
                    </Td>
                    <Td className="tabular text-right font-medium text-positive">
                      {formatMoneyShort(account.credit - account.debit, currency)}
                    </Td>
                  </tr>
                ))}
                <tr className="bg-surface-muted">
                  <Td className="font-semibold">Total des produits</Td>
                  <Td className="tabular text-right font-semibold">
                    {formatMoneyShort(totalRevenue, currency)}
                  </Td>
                </tr>
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Charges" description="Comptes de la classe 6." />
          {expenseRows.length === 0 ? (
            <EmptyState title="Aucune charge enregistrée" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Compte</Th>
                  <Th className="text-right">Montant</Th>
                </tr>
              </thead>
              <tbody>
                {expenseRows.map((account) => (
                  <tr key={account.number}>
                    <Td>
                      <span className="tabular mr-2 text-ink-faint">{account.number}</span>
                      {account.name}
                    </Td>
                    <Td className="tabular text-right font-medium">
                      {formatMoneyShort(account.debit - account.credit, currency)}
                    </Td>
                  </tr>
                ))}
                <tr className="bg-surface-muted">
                  <Td className="font-semibold">Total des charges</Td>
                  <Td className="tabular text-right font-semibold">
                    {formatMoneyShort(totalExpense, currency)}
                  </Td>
                </tr>
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      {budget ? (
        <Card className="mt-4">
          <CardHeader
            title={budget.name}
            description="Comparaison entre le prévisionnel voté et le réalisé."
          />
          <Table>
            <thead>
              <tr>
                <Th>Poste</Th>
                <Th>Sens</Th>
                <Th className="text-right">Prévu</Th>
                <Th className="text-right">Réalisé</Th>
                <Th className="text-right">Écart</Th>
              </tr>
            </thead>
            <tbody>
              {budget.lines.map((line) => {
                // Le réalisé est rapproché par compte comptable : c'est le seul
                // lien fiable entre une ligne de budget et les écritures.
                const matching = line.accountId ? perAccount.get(line.accountId) : undefined
                const actual = matching
                  ? line.direction === 'REVENUE'
                    ? matching.credit - matching.debit
                    : matching.debit - matching.credit
                  : 0
                // Un écart positif est toujours favorable : plus de produits
                // qu'espéré, ou moins de charges que budgété.
                const gap =
                  line.direction === 'REVENUE' ? actual - line.plannedCents : line.plannedCents - actual

                return (
                  <tr key={line.id}>
                    <Td className="font-medium text-ink">{line.label}</Td>
                    <Td>
                      <Chip tone={line.direction === 'REVENUE' ? 'positive' : 'neutral'}>
                        {line.direction === 'REVENUE' ? 'Produit' : 'Charge'}
                      </Chip>
                    </Td>
                    <Td className="tabular text-right text-ink-soft">
                      {formatMoneyShort(line.plannedCents, currency)}
                    </Td>
                    <Td className="tabular text-right">{formatMoneyShort(actual, currency)}</Td>
                    <Td
                      className={`tabular text-right font-medium ${gap >= 0 ? 'text-positive' : 'text-danger'}`}
                    >
                      {gap >= 0 ? '+' : ''}
                      {formatMoneyShort(gap, currency)}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </Card>
      ) : null}

      <Card className="mt-4">
        <CardHeader title="Écritures" description="Les 40 dernières opérations enregistrées." />
        {transactions.length === 0 ? (
          <EmptyState
            title="Aucune écriture"
            description="Les recettes et dépenses saisies apparaîtront ici."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Référence</Th>
                <Th>Libellé</Th>
                <Th>Date</Th>
                <Th>Nature</Th>
                <Th className="text-right">Montant</Th>
                <Th>Statut</Th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-surface-muted">
                  <Td className="tabular text-ink-faint">{transaction.reference}</Td>
                  <Td>
                    <span className="font-medium text-ink">{transaction.label}</span>
                    {transaction.bankAccount ? (
                      <span className="block text-xs text-ink-faint">
                        {transaction.bankAccount.name}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="text-ink-soft">{formatDate(transaction.date)}</Td>
                  <Td className="text-ink-soft">
                    {TRANSACTION_KIND_LABELS[transaction.kind as TransactionKind] ?? transaction.kind}
                  </Td>
                  <Td
                    className={`tabular text-right font-medium ${transaction.kind === 'INCOME' ? 'text-positive' : 'text-ink'}`}
                  >
                    {transaction.kind === 'INCOME' ? '+' : '−'}
                    {formatMoneyShort(transaction.totalCents, currency)}
                  </Td>
                  <Td>
                    <Chip tone={STATUS_TONES[transaction.status as TransactionStatus] ?? 'neutral'}>
                      {TRANSACTION_STATUS_LABELS[transaction.status as TransactionStatus] ??
                        transaction.status}
                    </Chip>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader title="Comptes" description="Plan comptable mouvementé sur l'exercice." />
        <Table>
          <thead>
            <tr>
              <Th>N°</Th>
              <Th>Intitulé</Th>
              <Th>Type</Th>
              <Th className="text-right">Débit</Th>
              <Th className="text-right">Crédit</Th>
            </tr>
          </thead>
          <tbody>
            {accountRows.map((account) => (
              <tr key={account.number}>
                <Td className="tabular text-ink-faint">{account.number}</Td>
                <Td className="font-medium text-ink">{account.name}</Td>
                <Td className="text-ink-soft">
                  {ACCOUNT_TYPE_LABELS[account.type as AccountType] ?? account.type}
                </Td>
                <Td className="tabular text-right">{formatMoneyShort(account.debit, currency)}</Td>
                <Td className="tabular text-right">{formatMoneyShort(account.credit, currency)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  )
}
