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
  MAJORITY_RULE_LABELS,
  MANDATE_ROLE_LABELS,
  MEETING_KIND_LABELS,
  type MajorityRule,
  type MandateRole,
  type MeetingKind,
} from '@/lib/enums'
import { formatDate, formatDateTime, memberDisplayName } from '@/lib/format'

export const metadata: Metadata = { title: 'Gouvernance' }

const MEETING_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Programmée',
  CONVENED: 'Convoquée',
  IN_PROGRESS: 'En cours',
  HELD: 'Tenue',
  MINUTED: 'PV validé',
  CANCELED: 'Annulée',
}

const MEETING_STATUS_TONES: Record<string, Tone> = {
  SCHEDULED: 'brand',
  CONVENED: 'brand',
  IN_PROGRESS: 'warning',
  HELD: 'positive',
  MINUTED: 'positive',
  CANCELED: 'danger',
}

export default async function GovernancePage({ params }: PageProps<'/[org]/gouvernance'>) {
  const { org } = await params
  const { organization, can, hasModule } = await requireOrganization(org)

  if (!hasModule('governance')) {
    return <ModuleDisabled moduleKey="governance" org={org} canManage={can('org.settings')} />
  }
  const orgId = organization.id
  const now = new Date()

  const [meetings, resolutions, mandates] = await Promise.all([
    db.meeting.findMany({
      where: { organizationId: orgId },
      orderBy: { startAt: 'desc' },
      take: 20,
      select: {
        id: true,
        title: true,
        kind: true,
        status: true,
        startAt: true,
        locationName: true,
        quorumBps: true,
        presentCount: true,
        proxyCount: true,
        votingBase: true,
        quorumMet: true,
        minutesApprovedAt: true,
        _count: { select: { resolutions: true, attendees: true } },
      },
    }),
    db.resolution.findMany({
      where: { organizationId: orgId },
      orderBy: [{ createdAt: 'desc' }, { position: 'asc' }],
      take: 15,
      select: {
        id: true,
        number: true,
        title: true,
        majorityRule: true,
        status: true,
        isSecret: true,
        forCount: true,
        againstCount: true,
        abstainCount: true,
        meeting: { select: { title: true, startAt: true } },
      },
    }),
    db.mandate.findMany({
      where: { organizationId: orgId, OR: [{ endDate: null }, { endDate: { gte: now } }] },
      orderBy: { role: 'asc' },
      select: {
        id: true,
        role: true,
        title: true,
        startDate: true,
        endDate: true,
        hasBankSignature: true,
        member: {
          select: { id: true, kind: true, firstName: true, lastName: true, legalName: true },
        },
      },
    }),
  ])

  const nextMeeting = [...meetings].reverse().find((m) => m.startAt >= now)
  const adopted = resolutions.filter((r) => r.status === 'ADOPTED').length

  return (
    <>
      <PageHeader
        title="Gouvernance"
        description="Assemblées générales, résolutions, votes et mandats du bureau."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Réunions enregistrées" value={meetings.length} />
        <Stat
          label="Prochaine réunion"
          value={nextMeeting ? formatDate(nextMeeting.startAt) : '—'}
          hint={nextMeeting?.title ?? 'Aucune programmée'}
        />
        <Stat label="Résolutions adoptées" value={adopted} tone="positive" />
        <Stat
          label="Mandats en cours"
          value={mandates.length}
          hint={`${mandates.filter((m) => m.hasBankSignature).length} avec signature bancaire`}
        />
      </div>

      <Card className="mt-4">
        <CardHeader title="Réunions" description="Assemblées générales, conseils et bureaux." />
        {meetings.length === 0 ? (
          <EmptyState
            title="Aucune réunion"
            description="Programmez une assemblée pour convoquer vos adhérents."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Réunion</Th>
                <Th>Nature</Th>
                <Th>Date</Th>
                <Th>Participation</Th>
                <Th>Quorum</Th>
                <Th>Statut</Th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((meeting) => {
                const attending = meeting.presentCount + meeting.proxyCount
                const rate =
                  meeting.votingBase > 0 ? Math.round((attending / meeting.votingBase) * 100) : null

                return (
                  <tr key={meeting.id} className="hover:bg-surface-muted">
                    <Td>
                      <span className="font-medium text-ink">{meeting.title}</span>
                      <span className="block text-xs text-ink-faint">
                        {meeting.locationName ?? 'Lieu non précisé'} ·{' '}
                        {meeting._count.resolutions} résolution
                        {meeting._count.resolutions > 1 ? 's' : ''}
                      </span>
                    </Td>
                    <Td className="text-ink-soft">
                      {MEETING_KIND_LABELS[meeting.kind as MeetingKind] ?? meeting.kind}
                    </Td>
                    <Td className="text-ink-soft">{formatDateTime(meeting.startAt)}</Td>
                    <Td className="text-ink-soft">
                      {meeting.votingBase > 0 ? (
                        <>
                          <span className="tabular font-medium text-ink">{attending}</span>
                          <span className="tabular"> / {meeting.votingBase}</span>
                          <span className="block text-xs text-ink-faint">
                            dont {meeting.proxyCount} pouvoir{meeting.proxyCount > 1 ? 's' : ''}
                          </span>
                        </>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </Td>
                    <Td>
                      {meeting.quorumMet === null ? (
                        <span className="text-ink-faint">—</span>
                      ) : (
                        <Chip tone={meeting.quorumMet ? 'positive' : 'danger'}>
                          {meeting.quorumMet ? 'Atteint' : 'Non atteint'}
                          {rate !== null ? ` · ${rate} %` : ''}
                        </Chip>
                      )}
                    </Td>
                    <Td>
                      <Chip tone={MEETING_STATUS_TONES[meeting.status] ?? 'neutral'}>
                        {MEETING_STATUS_LABELS[meeting.status] ?? meeting.status}
                      </Chip>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader title="Résolutions" description="Résultats des votes, par assemblée." />
        {resolutions.length === 0 ? (
          <EmptyState title="Aucune résolution soumise au vote" />
        ) : (
          <ul className="divide-y divide-line">
            {resolutions.map((resolution) => {
              const expressed = resolution.forCount + resolution.againstCount
              const total = expressed + resolution.abstainCount
              const share = (count: number) => (total > 0 ? (count / total) * 100 : 0)

              return (
                <li key={resolution.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">
                        <span className="tabular mr-1.5 text-ink-faint">
                          n° {resolution.number}
                        </span>
                        {resolution.title}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {resolution.meeting?.title ?? 'Hors assemblée'} ·{' '}
                        {MAJORITY_RULE_LABELS[resolution.majorityRule as MajorityRule] ??
                          resolution.majorityRule}
                        {resolution.isSecret ? ' · scrutin secret' : ''}
                      </p>
                    </div>
                    <Chip
                      tone={
                        resolution.status === 'ADOPTED'
                          ? 'positive'
                          : resolution.status === 'REJECTED'
                            ? 'danger'
                            : 'neutral'
                      }
                    >
                      {resolution.status === 'ADOPTED'
                        ? 'Adoptée'
                        : resolution.status === 'REJECTED'
                          ? 'Rejetée'
                          : resolution.status === 'OPEN'
                            ? 'Vote ouvert'
                            : 'Brouillon'}
                    </Chip>
                  </div>

                  {total > 0 ? (
                    <>
                      {/* Barre de dépouillement : pour / contre / abstention */}
                      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-neutral-soft">
                        <div
                          className="bg-positive"
                          style={{ width: `${share(resolution.forCount)}%` }}
                        />
                        <div
                          className="bg-danger"
                          style={{ width: `${share(resolution.againstCount)}%` }}
                        />
                        <div
                          className="bg-line-strong"
                          style={{ width: `${share(resolution.abstainCount)}%` }}
                        />
                      </div>
                      <p className="tabular mt-1.5 text-xs text-ink-soft">
                        <span className="font-medium text-positive">{resolution.forCount} pour</span>
                        {' · '}
                        <span className="font-medium text-danger">
                          {resolution.againstCount} contre
                        </span>
                        {' · '}
                        {resolution.abstainCount} abstention
                        {resolution.abstainCount > 1 ? 's' : ''}
                      </p>
                    </>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader title="Bureau et conseil" description="Mandats en cours." />
        {mandates.length === 0 ? (
          <EmptyState title="Aucun mandat enregistré" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Fonction</Th>
                <Th>Titulaire</Th>
                <Th>Début</Th>
                <Th>Fin</Th>
                <Th>Signature bancaire</Th>
              </tr>
            </thead>
            <tbody>
              {mandates.map((mandate) => (
                <tr key={mandate.id}>
                  <Td className="font-medium text-ink">
                    {MANDATE_ROLE_LABELS[mandate.role as MandateRole] ?? mandate.role}
                  </Td>
                  <Td className="text-ink-soft">{memberDisplayName(mandate.member)}</Td>
                  <Td className="text-ink-soft">{formatDate(mandate.startDate)}</Td>
                  <Td className="text-ink-soft">
                    {mandate.endDate ? formatDate(mandate.endDate) : 'Sans terme'}
                  </Td>
                  <Td>
                    {mandate.hasBankSignature ? (
                      <Chip tone="brand">Oui</Chip>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  )
}
