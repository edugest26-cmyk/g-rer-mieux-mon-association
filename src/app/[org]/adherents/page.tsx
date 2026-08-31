import type { Metadata } from 'next'
import Link from 'next/link'

import { Card, CardHeader, Chip, EmptyState, PageHeader, Table, Td, Th, type Tone } from '@/components/ui'
import { requireOrganization } from '@/lib/auth/dal'
import { db } from '@/lib/db'
import { MEMBER_STATUS_LABELS, type MemberStatus } from '@/lib/enums'
import { formatDate, memberDisplayName } from '@/lib/format'

import { MemberFilters } from './member-filters'

export const metadata: Metadata = { title: 'Adhérents' }

/** Couleur de la pastille de statut : le vert doit rester rare et signifiant. */
const STATUS_TONES: Record<MemberStatus, Tone> = {
  ACTIVE: 'positive',
  LAPSED: 'warning',
  PENDING: 'brand',
  SUSPENDED: 'warning',
  RESIGNED: 'neutral',
  EXCLUDED: 'danger',
  DECEASED: 'neutral',
}

const PAGE_SIZE = 25

export default async function MembersPage(props: PageProps<'/[org]/adherents'>) {
  const { org } = await props.params
  const searchParams = await props.searchParams
  const { organization, can } = await requireOrganization(org)

  const query = typeof searchParams.q === 'string' ? searchParams.q.trim() : ''
  const status = typeof searchParams.statut === 'string' ? searchParams.statut : ''
  const categoryId = typeof searchParams.categorie === 'string' ? searchParams.categorie : ''
  const page = Math.max(1, Number(searchParams.page) || 1)

  const where = {
    organizationId: organization.id,
    ...(status ? { status } : {}),
    ...(categoryId ? { categoryId } : {}),
    // `mode: 'insensitive'` est indispensable sur PostgreSQL, où `contains`
    // est sensible à la casse : sans lui, chercher « diallo » ne trouverait
    // pas « Diallo ».
    ...(query
      ? {
          OR: [
            { firstName: { contains: query, mode: 'insensitive' as const } },
            { lastName: { contains: query, mode: 'insensitive' as const } },
            { legalName: { contains: query, mode: 'insensitive' as const } },
            { email: { contains: query, mode: 'insensitive' as const } },
            { memberNumber: { contains: query, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [members, total, categories, statusCounts] = await Promise.all([
    db.member.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        memberNumber: true,
        kind: true,
        status: true,
        firstName: true,
        lastName: true,
        legalName: true,
        email: true,
        city: true,
        joinedAt: true,
        category: { select: { name: true, color: true } },
      },
    }),
    db.member.count({ where }),
    db.memberCategory.findMany({
      where: { organizationId: organization.id, archivedAt: null },
      orderBy: { position: 'asc' },
      select: { id: true, name: true },
    }),
    db.member.groupBy({
      by: ['status'],
      where: { organizationId: organization.id },
      _count: { _all: true },
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const counts = new Map(statusCounts.map((row) => [row.status, row._count._all]))

  return (
    <>
      <PageHeader
        title="Adhérents"
        description={`${total} adhérent${total > 1 ? 's' : ''} ${query || status || categoryId ? 'correspondant à la recherche' : 'au total'}.`}
        action={
          can('members.write') ? (
            <Link
              href={`/${org}/adherents/nouveau`}
              className="inline-flex items-center rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-brand-ink hover:bg-brand-dark"
            >
              Nouvel adhérent
            </Link>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(['ACTIVE', 'LAPSED', 'PENDING'] as const).map((s) => (
          <Chip key={s} tone={STATUS_TONES[s]}>
            {counts.get(s) ?? 0} {MEMBER_STATUS_LABELS[s].toLowerCase()}
          </Chip>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Fichier des adhérents"
          action={<MemberFilters categories={categories} />}
        />

        {members.length === 0 ? (
          <EmptyState
            title="Aucun adhérent trouvé"
            description={
              query || status || categoryId
                ? 'Aucun adhérent ne correspond à ces critères. Essayez d’élargir la recherche.'
                : 'Le fichier est vide pour le moment.'
            }
            action={
              // Proposer la création n'a de sens que sur un fichier réellement
              // vide : après une recherche infructueuse, c'est le filtre qu'il
              // faut élargir, pas un adhérent qu'il faut créer.
              !query && !status && !categoryId && can('members.write') ? (
                <Link
                  href={`/${org}/adherents/nouveau`}
                  className="inline-flex items-center rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-brand-ink hover:bg-brand-dark"
                >
                  Créer le premier adhérent
                </Link>
              ) : null
            }
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>N°</Th>
                  <Th>Adhérent</Th>
                  <Th>Catégorie</Th>
                  <Th>Ville</Th>
                  <Th>Adhésion</Th>
                  <Th>Statut</Th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="hover:bg-surface-muted">
                    <Td className="tabular text-ink-faint">{member.memberNumber}</Td>
                    <Td>
                      <Link
                        href={`/${org}/adherents/${member.id}`}
                        className="font-medium text-ink hover:text-brand"
                      >
                        {memberDisplayName(member)}
                      </Link>
                      {member.email ? (
                        <span className="block text-xs text-ink-faint">{member.email}</span>
                      ) : null}
                    </Td>
                    <Td className="text-ink-soft">{member.category?.name ?? '—'}</Td>
                    <Td className="text-ink-soft">{member.city ?? '—'}</Td>
                    <Td className="text-ink-soft">{formatDate(member.joinedAt)}</Td>
                    <Td>
                      <Chip tone={STATUS_TONES[member.status as MemberStatus] ?? 'neutral'}>
                        {MEMBER_STATUS_LABELS[member.status as MemberStatus] ?? member.status}
                      </Chip>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>

            {totalPages > 1 ? (
              <div className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="text-ink-faint">
                  Page {page} sur {totalPages}
                </span>
                <div className="flex gap-2">
                  {page > 1 ? (
                    <Link
                      href={`/${org}/adherents?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(status ? { statut: status } : {}), ...(categoryId ? { categorie: categoryId } : {}), page: String(page - 1) })}`}
                      className="rounded-lg border border-line-strong px-3 py-1.5 hover:bg-surface-muted"
                    >
                      Précédent
                    </Link>
                  ) : null}
                  {page < totalPages ? (
                    <Link
                      href={`/${org}/adherents?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(status ? { statut: status } : {}), ...(categoryId ? { categorie: categoryId } : {}), page: String(page + 1) })}`}
                      className="rounded-lg border border-line-strong px-3 py-1.5 hover:bg-surface-muted"
                    >
                      Suivant
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        )}
      </Card>
    </>
  )
}
