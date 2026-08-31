import type { Metadata } from 'next'

import { Card, CardHeader, Chip, EmptyState, PageHeader, Stat, Table, Td, Th } from '@/components/ui'
import { ModuleDisabled } from '@/components/module-disabled'
import { requireOrganization } from '@/lib/auth/dal'
import { db } from '@/lib/db'
import { DOCUMENT_VISIBILITY_LABELS, type DocumentVisibility } from '@/lib/enums'
import { formatDate } from '@/lib/format'

export const metadata: Metadata = { title: 'Documents' }

const KIND_LABELS: Record<string, string> = {
  STATUTES: 'Statuts',
  BYLAWS: 'Règlement intérieur',
  MINUTES: 'Procès-verbal',
  REPORT: 'Rapport',
  CONTRACT: 'Contrat',
  INVOICE: 'Facture',
  RECEIPT: 'Reçu',
  INSURANCE: 'Assurance',
  GRANT: 'Subvention',
  PHOTO: 'Photo',
  OTHER: 'Autre',
}

function formatSize(bytes: number): string {
  if (bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

export default async function DocumentsPage({ params }: PageProps<'/[org]/documents'>) {
  const { org } = await params
  const { organization, can, hasModule } = await requireOrganization(org)

  if (!hasModule('documents')) {
    return <ModuleDisabled moduleKey="documents" org={org} canManage={can('org.settings')} />
  }
  const orgId = organization.id
  const now = new Date()
  const inThreeMonths = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

  const [folders, documents, expiring, totalSize] = await Promise.all([
    db.documentFolder.findMany({
      where: { organizationId: orgId },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        name: true,
        isSystem: true,
        _count: { select: { documents: true } },
      },
    }),
    db.document.findMany({
      where: { organizationId: orgId, archivedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 60,
      select: {
        id: true,
        name: true,
        kind: true,
        visibility: true,
        sizeBytes: true,
        version: true,
        expiresAt: true,
        createdAt: true,
        folder: { select: { name: true } },
      },
    }),
    db.document.findMany({
      where: {
        organizationId: orgId,
        archivedAt: null,
        expiresAt: { gte: now, lte: inThreeMonths },
      },
      orderBy: { expiresAt: 'asc' },
      select: { id: true, name: true, expiresAt: true },
    }),
    db.document.aggregate({
      where: { organizationId: orgId, archivedAt: null },
      _sum: { sizeBytes: true },
      _count: { _all: true },
    }),
  ])

  return (
    <>
      <PageHeader
        title="Documents"
        description="Statuts, procès-verbaux, contrats et pièces justificatives."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Documents" value={totalSize._count._all} />
        <Stat label="Dossiers" value={folders.length} />
        <Stat label="Espace utilisé" value={formatSize(totalSize._sum.sizeBytes ?? 0)} />
        <Stat
          label="Échéances proches"
          value={expiring.length}
          hint={expiring.length > 0 ? 'À renouveler sous 3 mois' : 'Rien à renouveler'}
          tone={expiring.length > 0 ? 'warning' : 'positive'}
        />
      </div>

      {expiring.length > 0 ? (
        <Card className="mt-4 bg-warning-soft px-5 py-4">
          <p className="text-sm font-medium text-warning">Documents arrivant à échéance</p>
          <ul className="mt-2 space-y-1">
            {expiring.map((doc) => (
              <li key={doc.id} className="text-sm text-warning">
                {doc.name} — expire le {doc.expiresAt ? formatDate(doc.expiresAt) : '—'}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="mt-4">
        <CardHeader title="Dossiers" />
        {folders.length === 0 ? (
          <EmptyState title="Aucun dossier" />
        ) : (
          <ul className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
            {folders.map((folder) => (
              <li key={folder.id} className="bg-surface px-5 py-3.5">
                <p className="font-medium text-ink">{folder.name}</p>
                <p className="mt-0.5 text-sm text-ink-faint">
                  {folder._count.documents} document{folder._count.documents > 1 ? 's' : ''}
                  {folder.isSystem ? ' · dossier système' : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader title="Tous les documents" />
        {documents.length === 0 ? (
          <EmptyState
            title="Aucun document"
            description="Déposez vos statuts et procès-verbaux pour les garder accessibles au bureau."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Document</Th>
                <Th>Type</Th>
                <Th>Dossier</Th>
                <Th>Visibilité</Th>
                <Th className="text-right">Taille</Th>
                <Th>Ajouté le</Th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-surface-muted">
                  <Td>
                    <span className="font-medium text-ink">{doc.name}</span>
                    {doc.version > 1 ? (
                      <span className="ml-1.5 text-xs text-ink-faint">v{doc.version}</span>
                    ) : null}
                    {doc.expiresAt ? (
                      <span className="block text-xs text-ink-faint">
                        Expire le {formatDate(doc.expiresAt)}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="text-ink-soft">{KIND_LABELS[doc.kind] ?? doc.kind}</Td>
                  <Td className="text-ink-soft">{doc.folder?.name ?? '—'}</Td>
                  <Td>
                    <Chip tone={doc.visibility === 'PUBLIC' ? 'brand' : 'neutral'}>
                      {DOCUMENT_VISIBILITY_LABELS[doc.visibility as DocumentVisibility] ??
                        doc.visibility}
                    </Chip>
                  </Td>
                  <Td className="tabular text-right text-ink-soft">{formatSize(doc.sizeBytes)}</Td>
                  <Td className="text-ink-soft">{formatDate(doc.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  )
}
