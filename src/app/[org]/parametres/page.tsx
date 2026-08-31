import type { Metadata } from 'next'

import { Card, CardHeader, Chip, EmptyState, PageHeader, Table, Td, Th } from '@/components/ui'
import { requirePermission } from '@/lib/auth/dal'
import { db } from '@/lib/db'
import { ORG_KIND_LABELS, PLAN_LABELS, ROLE_LABELS, type OrgKind, type Plan, type Role } from '@/lib/enums'
import { formatDate } from '@/lib/format'

import { ModulesForm } from './modules-form'

export const metadata: Metadata = { title: 'Paramètres' }

export default async function SettingsPage({ params }: PageProps<'/[org]/parametres'>) {
  const { org } = await params

  // Réservé aux rôles qui administrent l'association : `requirePermission`
  // renvoie un 403 pour les autres, sans exposer le contenu de la page.
  const { organization, modules } = await requirePermission(org, 'org.settings')

  const [full, memberships, invitations, subscription, auditLogs] = await Promise.all([
    db.organization.findUniqueOrThrow({
      where: { id: organization.id },
      select: {
        legalName: true,
        email: true,
        phone: true,
        website: true,
        addressLine1: true,
        postalCode: true,
        city: true,
        country: true,
        rnaNumber: true,
        siret: true,
        currency: true,
        timezone: true,
        fiscalYearStartMonth: true,
        fiscalYearStartDay: true,
        createdAt: true,
      },
    }),
    db.membership.findMany({
      where: { organizationId: organization.id, leftAt: null },
      orderBy: { joinedAt: 'asc' },
      select: {
        id: true,
        role: true,
        title: true,
        joinedAt: true,
        user: { select: { email: true, firstName: true, lastName: true, lastLoginAt: true } },
      },
    }),
    db.invitation.findMany({
      where: { organizationId: organization.id, acceptedAt: null, revokedAt: null },
      select: { id: true, email: true, role: true, expiresAt: true },
    }),
    db.orgSubscription.findUnique({
      where: { organizationId: organization.id },
      select: {
        plan: true,
        status: true,
        memberLimit: true,
        currentPeriodEnd: true,
        trialEndsAt: true,
      },
    }),
    db.auditLog.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: {
        id: true,
        action: true,
        entityType: true,
        createdAt: true,
        user: { select: { firstName: true, lastName: true } },
      },
    }),
  ])

  return (
    <>
      <PageHeader
        title="Paramètres"
        description="Identité de l'association, accès et abonnement."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Identité" />
          <dl className="divide-y divide-line text-sm">
            <Row label="Nom" value={organization.name} />
            <Row label="Dénomination légale" value={full.legalName} />
            <Row
              label="Forme juridique"
              value={ORG_KIND_LABELS[organization.kind as OrgKind] ?? organization.kind}
            />
            <Row label="Identifiant RNA" value={full.rnaNumber} />
            <Row label="SIRET" value={full.siret} />
            <Row label="E-mail" value={full.email} />
            <Row label="Téléphone" value={full.phone} />
            <Row label="Site web" value={full.website} />
            <Row
              label="Adresse"
              value={
                full.addressLine1
                  ? `${full.addressLine1}, ${full.postalCode ?? ''} ${full.city ?? ''}`.trim()
                  : null
              }
            />
            <Row label="Adresse du service" value={`/${organization.slug}`} />
            <Row label="Créée le" value={formatDate(full.createdAt)} />
          </dl>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Abonnement" />
            {subscription ? (
              <dl className="divide-y divide-line text-sm">
                <Row
                  label="Formule"
                  value={PLAN_LABELS[subscription.plan as Plan] ?? subscription.plan}
                />
                <Row
                  label="État"
                  value={
                    subscription.status === 'ACTIVE'
                      ? 'Actif'
                      : subscription.status === 'TRIALING'
                        ? "Période d'essai"
                        : subscription.status === 'PAST_DUE'
                          ? 'Paiement en retard'
                          : 'Résilié'
                  }
                />
                <Row label="Plafond d'adhérents" value={String(subscription.memberLimit)} />
                <Row
                  label="Échéance"
                  value={
                    subscription.currentPeriodEnd
                      ? formatDate(subscription.currentPeriodEnd)
                      : subscription.trialEndsAt
                        ? `Essai jusqu'au ${formatDate(subscription.trialEndsAt)}`
                        : null
                  }
                />
              </dl>
            ) : (
              <EmptyState title="Aucun abonnement" />
            )}
          </Card>

          <Card>
            <CardHeader title="Rubriques" description="Ce que votre association utilise." />
            <ModulesForm org={org} enabled={[...modules]} />
          </Card>

          <Card>
            <CardHeader title="Comptabilité" />
            <dl className="divide-y divide-line text-sm">
              <Row label="Devise" value={full.currency} />
              <Row label="Fuseau horaire" value={full.timezone} />
              <Row
                label="Début d'exercice"
                value={`${String(full.fiscalYearStartDay).padStart(2, '0')}/${String(full.fiscalYearStartMonth).padStart(2, '0')}`}
              />
            </dl>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Accès"
          description="Les comptes autorisés à se connecter à cette association."
        />
        <Table>
          <thead>
            <tr>
              <Th>Utilisateur</Th>
              <Th>Rôle</Th>
              <Th>Fonction</Th>
              <Th>Depuis</Th>
              <Th>Dernière connexion</Th>
            </tr>
          </thead>
          <tbody>
            {memberships.map((membership) => (
              <tr key={membership.id}>
                <Td>
                  <span className="font-medium text-ink">
                    {membership.user.firstName} {membership.user.lastName}
                  </span>
                  <span className="block text-xs text-ink-faint">{membership.user.email}</span>
                </Td>
                <Td>
                  <Chip tone="brand">
                    {ROLE_LABELS[membership.role as Role] ?? membership.role}
                  </Chip>
                </Td>
                <Td className="text-ink-soft">{membership.title ?? '—'}</Td>
                <Td className="text-ink-soft">{formatDate(membership.joinedAt)}</Td>
                <Td className="text-ink-soft">
                  {membership.user.lastLoginAt ? formatDate(membership.user.lastLoginAt) : 'Jamais'}
                </Td>
              </tr>
            ))}
            {invitations.map((invitation) => (
              <tr key={invitation.id} className="bg-surface-muted">
                <Td className="text-ink-soft">{invitation.email}</Td>
                <Td>
                  <Chip tone="warning">
                    {ROLE_LABELS[invitation.role as Role] ?? invitation.role}
                  </Chip>
                </Td>
                <Td colSpan={3} className="text-ink-faint">
                  Invitation en attente, expire le {formatDate(invitation.expiresAt)}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card className="mt-4">
        <CardHeader title="Journal d'activité" description="Les quinze dernières opérations." />
        {auditLogs.length === 0 ? (
          <EmptyState
            title="Journal vide"
            description="Les créations et modifications seront tracées ici."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Action</Th>
                <Th>Objet</Th>
                <Th>Auteur</Th>
                <Th>Date</Th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <Td className="font-medium text-ink">{log.action}</Td>
                  <Td className="text-ink-soft">{log.entityType}</Td>
                  <Td className="text-ink-soft">
                    {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Système'}
                  </Td>
                  <Td className="text-ink-soft">{formatDate(log.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  )
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-4 px-5 py-2.5">
      <dt className="w-44 shrink-0 text-ink-faint">{label}</dt>
      <dd className="min-w-0 flex-1 break-words text-ink">{value ?? '—'}</dd>
    </div>
  )
}
