import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { logout } from '@/app/(auth)/actions'
import { Logo } from '@/components/logo'
import { SubmitButton } from '@/components/submit-button'
import { Card, Chip } from '@/components/ui'
import { getUserOrganizations, requireUser } from '@/lib/auth/dal'
import { ORG_KIND_LABELS, ROLE_LABELS, type OrgKind, type Role } from '@/lib/enums'
import { initials } from '@/lib/format'

export const metadata: Metadata = { title: 'Mes associations' }

export default async function OrganizationsPage() {
  const user = await requireUser()
  const organizations = await getUserOrganizations()

  // Un seul rattachement : le choix n'a pas lieu d'être, on entre directement.
  if (organizations.length === 1) {
    redirect(`/${organizations[0]!.slug}/tableau-de-bord`)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="mb-8 inline-block" aria-label="GERMA, accueil">
        <Logo width={132} variant="mark" />
      </Link>

      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            Bonjour {user.firstName}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {organizations.length === 0
              ? "Vous n'êtes rattaché à aucune association."
              : 'Choisissez l’association à gérer.'}
          </p>
        </div>

        <form action={logout}>
          <SubmitButton variant="ghost" pendingLabel="…">
            Se déconnecter
          </SubmitButton>
        </form>
      </div>

      <div className="space-y-3">
        {organizations.map((org) => (
          <Link key={org.id} href={`/${org.slug}/tableau-de-bord`} className="block">
            <Card className="flex items-center gap-4 px-5 py-4 transition-colors hover:border-brand">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-sm font-semibold text-brand-dark">
                {initials(org.name)}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{org.name}</p>
                <p className="truncate text-sm text-ink-faint">
                  {ORG_KIND_LABELS[org.kind as OrgKind] ?? org.kind}
                </p>
              </div>

              <Chip tone="brand">{ROLE_LABELS[org.role as Role] ?? org.role}</Chip>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-6 px-5 py-4">
        <p className="text-sm font-medium text-ink">Créer une autre association</p>
        <p className="mt-1 text-sm text-ink-faint">
          Un même compte peut gérer plusieurs structures, chacune avec ses adhérents et sa
          comptabilité, strictement cloisonnées.
        </p>
        <Link
          href="/associations/nouvelle"
          className="mt-3 inline-block text-sm font-medium text-brand hover:underline"
        >
          Créer une association
        </Link>
      </Card>
    </div>
  )
}
