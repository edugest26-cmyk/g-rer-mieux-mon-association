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
  DUE_STATUS_LABELS,
  MANDATE_ROLE_LABELS,
  MEMBER_KIND_LABELS,
  MEMBER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  REGISTRATION_STATUS_LABELS,
  type DueStatus,
  type MandateRole,
  type MemberKind,
  type MemberStatus,
  type PaymentMethod,
  type RegistrationStatus,
} from '@/lib/enums'
import { formatDate, formatMoneyShort, initials, memberDisplayName } from '@/lib/format'

import { ArchiveMember } from './archive-member'

const STATUS_TONES: Record<MemberStatus, Tone> = {
  ACTIVE: 'positive',
  LAPSED: 'warning',
  PENDING: 'brand',
  SUSPENDED: 'warning',
  RESIGNED: 'neutral',
  EXCLUDED: 'danger',
  DECEASED: 'neutral',
}

export async function generateMetadata(
  props: PageProps<'/[org]/adherents/[id]'>,
): Promise<Metadata> {
  const { org, id } = await props.params
  const { organization } = await requireOrganization(org)

  const member = await db.member.findFirst({
    where: { id, organizationId: organization.id },
    select: { kind: true, firstName: true, lastName: true, legalName: true },
  })

  return { title: member ? memberDisplayName(member) : 'Adhérent' }
}

export default async function MemberPage(props: PageProps<'/[org]/adherents/[id]'>) {
  const { org, id } = await props.params
  const { organization, can } = await requireOrganization(org)
  const currency = organization.currency

  // Le filtre sur `organizationId` est ce qui empêche d'ouvrir la fiche d'un
  // adhérent d'une autre association en devinant son identifiant.
  const member = await db.member.findFirst({
    where: { id, organizationId: organization.id },
    select: {
      id: true,
      memberNumber: true,
      kind: true,
      status: true,
      civility: true,
      firstName: true,
      lastName: true,
      legalName: true,
      birthDate: true,
      email: true,
      emailSecondary: true,
      phone: true,
      mobile: true,
      addressLine1: true,
      addressLine2: true,
      postalCode: true,
      city: true,
      country: true,
      joinedAt: true,
      leftAt: true,
      leaveReason: true,
      notes: true,
      acceptsNewsletter: true,
      acceptsPhotos: true,
      consentAt: true,
      category: { select: { name: true } },
      skills: { select: { id: true, name: true, level: true } },
      dues: {
        orderBy: { periodEnd: 'desc' },
        select: {
          id: true,
          label: true,
          amountCents: true,
          paidCents: true,
          status: true,
          dueDate: true,
        },
      },
      payments: {
        orderBy: { date: 'desc' },
        take: 10,
        select: { id: true, amountCents: true, date: true, method: true, reference: true },
      },
      registrations: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          status: true,
          quantity: true,
          event: { select: { title: true, slug: true, startAt: true } },
        },
      },
      mandates: {
        orderBy: { startDate: 'desc' },
        select: { id: true, role: true, startDate: true, endDate: true },
      },
      donations: {
        orderBy: { date: 'desc' },
        take: 5,
        select: { id: true, amountCents: true, date: true, campaign: true },
      },
    },
  })

  if (!member) {
    notFound()
  }

  const name = memberDisplayName(member)
  const totalPaid = member.payments.reduce((sum, p) => sum + p.amountCents, 0)
  const outstanding = member.dues.reduce(
    (sum, d) => sum + (d.status === 'WAIVED' || d.status === 'CANCELED' ? 0 : d.amountCents - d.paidCents),
    0,
  )

  return (
    <>
      <Link
        href={`/${org}/adherents`}
        className="mb-4 inline-block text-sm text-ink-soft hover:text-brand"
      >
        ← Retour au fichier
      </Link>

      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-sm font-semibold text-brand-dark">
              {initials(name)}
            </span>
            {name}
          </span>
        }
        description={
          <>
            <span className="tabular">{member.memberNumber}</span>
            {' · '}
            {MEMBER_KIND_LABELS[member.kind as MemberKind] ?? member.kind}
            {member.category ? ` · ${member.category.name}` : ''}
          </>
        }
        action={
          <div className="flex items-center gap-3">
            <Chip tone={STATUS_TONES[member.status as MemberStatus] ?? 'neutral'}>
              {MEMBER_STATUS_LABELS[member.status as MemberStatus] ?? member.status}
            </Chip>
            {can('members.write') ? (
              <Link
                href={`/${org}/adherents/${member.id}/modifier`}
                className="inline-flex items-center rounded-lg border border-line-strong bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:bg-surface-muted"
              >
                Modifier
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Coordonnées" />
          <dl className="divide-y divide-line text-sm">
            <Row label="E-mail" value={member.email} />
            <Row label="E-mail secondaire" value={member.emailSecondary} />
            <Row label="Mobile" value={member.mobile} />
            <Row label="Téléphone" value={member.phone} />
            <Row
              label="Adresse"
              value={
                member.addressLine1
                  ? [
                      member.addressLine1,
                      member.addressLine2,
                      [member.postalCode, member.city].filter(Boolean).join(' '),
                    ]
                      .filter(Boolean)
                      .join(', ')
                  : null
              }
            />
            <Row label="Date de naissance" value={member.birthDate ? formatDate(member.birthDate) : null} />
            <Row label="Adhérent depuis" value={formatDate(member.joinedAt)} />
            {member.leftAt ? (
              <Row
                label="Départ"
                value={`${formatDate(member.leftAt)}${member.leaveReason ? ` — ${member.leaveReason}` : ''}`}
              />
            ) : null}
          </dl>

          <div className="border-t border-line px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Consentements
            </p>
            <div className="flex flex-wrap gap-2">
              <Chip tone={member.acceptsNewsletter ? 'positive' : 'neutral'}>
                Lettre d&apos;information {member.acceptsNewsletter ? 'acceptée' : 'refusée'}
              </Chip>
              <Chip tone={member.acceptsPhotos ? 'positive' : 'neutral'}>
                Droit à l&apos;image {member.acceptsPhotos ? 'accordé' : 'refusé'}
              </Chip>
            </div>
            {member.consentAt ? (
              <p className="mt-2 text-xs text-ink-faint">
                Recueilli le {formatDate(member.consentAt)}
              </p>
            ) : null}
          </div>

          {member.skills.length > 0 ? (
            <div className="border-t border-line px-5 py-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Compétences
              </p>
              <div className="flex flex-wrap gap-2">
                {member.skills.map((skill) => (
                  <Chip key={skill.id} tone="brand">
                    {skill.name}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}

          {member.mandates.length > 0 ? (
            <div className="border-t border-line px-5 py-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Mandats
              </p>
              <ul className="space-y-1.5 text-sm">
                {member.mandates.map((mandate) => (
                  <li key={mandate.id}>
                    <span className="font-medium text-ink">
                      {MANDATE_ROLE_LABELS[mandate.role as MandateRole] ?? mandate.role}
                    </span>
                    <span className="block text-xs text-ink-faint">
                      depuis le {formatDate(mandate.startDate)}
                      {mandate.endDate ? `, jusqu'au ${formatDate(mandate.endDate)}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="card px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                Total réglé
              </p>
              <p className="tabular mt-1.5 text-xl font-semibold text-ink">
                {formatMoneyShort(totalPaid, currency)}
              </p>
            </div>
            <div className="card px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                Reste dû
              </p>
              <p
                className={`tabular mt-1.5 text-xl font-semibold ${outstanding > 0 ? 'text-warning' : 'text-positive'}`}
              >
                {formatMoneyShort(outstanding, currency)}
              </p>
            </div>
            <div className="card px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                Participations
              </p>
              <p className="tabular mt-1.5 text-xl font-semibold text-ink">
                {member.registrations.length}
              </p>
            </div>
          </div>

          <Card>
            <CardHeader title="Cotisations" />
            {member.dues.length === 0 ? (
              <EmptyState title="Aucune cotisation appelée" />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Période</Th>
                    <Th>Échéance</Th>
                    <Th className="text-right">Montant</Th>
                    <Th className="text-right">Réglé</Th>
                    <Th>Statut</Th>
                  </tr>
                </thead>
                <tbody>
                  {member.dues.map((due) => (
                    <tr key={due.id}>
                      <Td className="font-medium text-ink">{due.label}</Td>
                      <Td className="text-ink-soft">
                        {due.dueDate ? formatDate(due.dueDate) : '—'}
                      </Td>
                      <Td className="tabular text-right">
                        {formatMoneyShort(due.amountCents, currency)}
                      </Td>
                      <Td className="tabular text-right font-medium">
                        {formatMoneyShort(due.paidCents, currency)}
                      </Td>
                      <Td>
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
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader title="Règlements" description="Les dix derniers mouvements." />
            {member.payments.length === 0 ? (
              <EmptyState title="Aucun règlement enregistré" />
            ) : (
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
                  {member.payments.map((payment) => (
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
            )}
          </Card>

          {member.donations.length > 0 ? (
            <Card>
              <CardHeader title="Dons" />
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Campagne</Th>
                    <Th className="text-right">Montant</Th>
                  </tr>
                </thead>
                <tbody>
                  {member.donations.map((donation) => (
                    <tr key={donation.id}>
                      <Td className="text-ink-soft">{formatDate(donation.date)}</Td>
                      <Td className="text-ink-soft">{donation.campaign ?? '—'}</Td>
                      <Td className="tabular text-right font-medium text-positive">
                        {formatMoneyShort(donation.amountCents, currency)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Participation aux événements" />
            {member.registrations.length === 0 ? (
              <EmptyState title="Aucune inscription" />
            ) : (
              <ul className="divide-y divide-line">
                {member.registrations.map((registration) => (
                  <li key={registration.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{registration.event.title}</p>
                      <p className="text-sm text-ink-faint">
                        {formatDate(registration.event.startAt)}
                        {registration.quantity > 1 ? ` · ${registration.quantity} places` : ''}
                      </p>
                    </div>
                    <Chip
                      tone={
                        registration.status === 'CONFIRMED' || registration.status === 'ATTENDED'
                          ? 'positive'
                          : registration.status === 'CANCELED' || registration.status === 'NO_SHOW'
                            ? 'danger'
                            : 'warning'
                      }
                    >
                      {REGISTRATION_STATUS_LABELS[registration.status as RegistrationStatus] ??
                        registration.status}
                    </Chip>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {member.notes ? (
            <Card>
              <CardHeader title="Notes internes" />
              <p className="whitespace-pre-line px-5 py-4 text-sm text-ink-soft">{member.notes}</p>
            </Card>
          ) : null}

          {/* Radier n'a de sens que sur un adhérent encore en activité. */}
          {can('members.write') && !['RESIGNED', 'EXCLUDED', 'DECEASED'].includes(member.status) ? (
            <Card className="px-5 py-4">
              <ArchiveMember org={org} id={member.id} name={name} />
            </Card>
          ) : null}
        </div>
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-4 px-5 py-2.5">
      <dt className="w-40 shrink-0 text-ink-faint">{label}</dt>
      <dd className="min-w-0 flex-1 break-words text-ink">{value ?? '—'}</dd>
    </div>
  )
}
