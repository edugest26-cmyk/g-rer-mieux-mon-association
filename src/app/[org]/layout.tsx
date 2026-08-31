import Link from 'next/link'

import { logout } from '@/app/(auth)/actions'
import { AppNav, MobileNav, type NavItem } from '@/components/app-nav'
import { Logo } from '@/components/logo'
import { SubmitButton } from '@/components/submit-button'
import { requireOrganization } from '@/lib/auth/dal'
import { db } from '@/lib/db'
import { ROLE_LABELS, type Role } from '@/lib/enums'
import { initials } from '@/lib/format'

export default async function OrgLayout({ children, params }: LayoutProps<'/[org]'>) {
  const { org } = await params

  // Contrôle d'accès unique pour toute la section : une association inconnue
  // ou à laquelle l'utilisateur n'appartient pas donne un 404 depuis la DAL.
  const { organization, membership, user, can, hasModule } = await requireOrganization(org)

  /*
    L'ordre suit l'année d'une association : on regarde, on s'occupe des
    adhérents, on encaisse, on organise. Les quatre premières entrées restent
    toujours accessibles ; le reste est regroupé sous « Gestion », et tient
    derrière un bouton « Plus » sur mobile.
  */
  const allItems: NavItem[] = [
    {
      href: `/${org}/tableau-de-bord`,
      label: "Aujourd'hui",
      short: 'Accueil',
      icon: 'today',
      principal: true,
    },
    {
      href: `/${org}/adherents`,
      label: 'Adhérents',
      short: 'Adhérents',
      icon: 'members',
      permission: 'members.read',
      module: 'members',
      principal: true,
    },
    {
      href: `/${org}/cotisations`,
      label: 'Cotisations',
      short: 'Cotis.',
      icon: 'dues',
      permission: 'dues.read',
      module: 'dues',
      principal: true,
      badge: await countOverdueDues(organization.id, can('dues.read') && hasModule('dues')),
    },
    {
      href: `/${org}/evenements`,
      label: 'Événements',
      short: 'Agenda',
      icon: 'events',
      permission: 'events.read',
      module: 'events',
      principal: true,
    },
    {
      href: `/${org}/finances`,
      label: 'Comptabilité',
      short: 'Compta',
      icon: 'finance',
      permission: 'finance.read',
      module: 'finance',
    },
    {
      href: `/${org}/gouvernance`,
      label: 'Gouvernance',
      short: 'Gouv.',
      icon: 'governance',
      permission: 'governance.read',
      module: 'governance',
    },
    {
      href: `/${org}/documents`,
      label: 'Documents',
      short: 'Docs',
      icon: 'documents',
      permission: 'documents.read',
      module: 'documents',
    },
    {
      href: `/${org}/parametres`,
      label: 'Réglages',
      short: 'Réglages',
      icon: 'settings',
      permission: 'org.settings',
    },
  ]

  // Une entrée n'apparaît que si l'association a activé la rubrique *et* que
  // le rôle permet de l'ouvrir : afficher un lien qui mène à un refus
  // n'apprend rien d'utile.
  const items = allItems.filter(
    (item) =>
      (!item.permission || can(item.permission)) && (!item.module || hasModule(item.module)),
  )

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="border-b border-line px-4 py-3">
          <Link href="/" aria-label="GERMA, accueil">
            <Logo width={104} variant="mark" />
          </Link>
        </div>

        <div className="border-b border-line px-4 py-4">
          <Link href="/associations" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-xs font-semibold text-brand-dark">
              {initials(organization.name)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink">
                {organization.name}
              </span>
              <span className="block truncate text-xs text-ink-faint">
                {ROLE_LABELS[membership.role as Role] ?? membership.role}
              </span>
            </span>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          <AppNav items={items} />
        </div>

        <div className="border-t border-line px-3 py-3">
          <p className="truncate px-3 pb-2 text-xs text-ink-faint">{user.email}</p>
          <form action={logout}>
            <SubmitButton variant="ghost" className="w-full justify-start" pendingLabel="…">
              Se déconnecter
            </SubmitButton>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* En-tête mobile : l'association et le compte, rien de plus. */}
        <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3 md:hidden">
          <Link href="/associations" className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-xs font-semibold text-brand-dark">
              {initials(organization.name)}
            </span>
            <span className="truncate text-sm font-semibold text-ink">{organization.name}</span>
          </Link>

          <div className="ml-auto shrink-0">
            <form action={logout}>
              <SubmitButton variant="ghost" pendingLabel="…">
                Quitter
              </SubmitButton>
            </form>
          </div>
        </header>

        {/* `pb-20` sur mobile : la barre du bas ne doit pas masquer le contenu. */}
        <main className="mx-auto max-w-6xl px-4 py-6 pb-20 md:px-8 md:py-8 md:pb-8">
          {children}
        </main>
      </div>

      <MobileNav items={items} />
    </div>
  )
}

/**
 * Nombre de cotisations échues et non soldées.
 *
 * C'est la seule pastille de l'application : une cotisation dont l'échéance
 * est passée est la seule chose qu'une association ne peut pas remettre à
 * plus tard sans conséquence.
 */
async function countOverdueDues(organizationId: string, enabled: boolean): Promise<number> {
  if (!enabled) return 0

  return db.due.count({
    where: {
      organizationId,
      status: { in: ['PENDING', 'PARTIAL'] },
      dueDate: { lt: new Date() },
    },
  })
}
