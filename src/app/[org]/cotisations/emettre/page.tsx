import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/ui'
import { requirePermission } from '@/lib/auth/dal'
import { db } from '@/lib/db'

import { EmitForm } from './emit-form'

export const metadata: Metadata = { title: 'Émettre les appels de cotisation' }

/** `YYYY-MM-DD`, format attendu par `<input type="date">`. */
function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export default async function EmitDuesPage({ params }: PageProps<'/[org]/cotisations/emettre'>) {
  const { org } = await params
  const { organization } = await requirePermission(org, 'dues.write')

  const [categories, fees] = await Promise.all([
    db.memberCategory.findMany({
      where: { organizationId: organization.id, archivedAt: null },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        name: true,
        _count: { select: { members: true } },
      },
    }),
    db.fee.findMany({
      where: { organizationId: organization.id, archivedAt: null },
      orderBy: { amountCents: 'desc' },
      select: { id: true, name: true, amountCents: true },
    }),
  ])

  // L'exercice de l'association sert de période par défaut : c'est le cas de
  // loin le plus fréquent, et l'utilisateur peut toujours l'ajuster.
  const now = new Date()
  const year =
    now.getMonth() + 1 >= organization.fiscalYearStartMonth ? now.getFullYear() : now.getFullYear() - 1

  const periodStart = new Date(
    year,
    organization.fiscalYearStartMonth - 1,
    organization.fiscalYearStartDay,
  )
  const periodEnd = new Date(periodStart)
  periodEnd.setFullYear(periodEnd.getFullYear() + 1)
  periodEnd.setDate(periodEnd.getDate() - 1)

  const dueDate = new Date(periodStart)
  dueDate.setMonth(dueDate.getMonth() + 3)

  return (
    <>
      <Link
        href={`/${org}/cotisations`}
        className="mb-4 inline-block text-sm text-ink-soft hover:text-brand"
      >
        ← Retour aux cotisations
      </Link>

      <PageHeader
        title="Émettre les appels de cotisation"
        description="Génère en une fois l'appel de tous les adhérents concernés par la période."
      />

      <EmitForm
        org={org}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          memberCount: c._count.members,
        }))}
        fees={fees}
        defaults={{
          label: `Cotisation ${periodStart.getFullYear()}`,
          periodStart: isoDay(periodStart),
          periodEnd: isoDay(periodEnd),
          dueDate: isoDay(dueDate),
        }}
      />
    </>
  )
}
