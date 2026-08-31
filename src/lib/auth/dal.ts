import 'server-only'

import { cache } from 'react'

import { forbidden, notFound, redirect } from 'next/navigation'

import { db } from '@/lib/db'
import { type ModuleKey, parseModules } from '@/lib/modules'
import { type Permission, resolvePermissions } from '@/lib/permissions'

import { readSession, type SessionUser } from './session'

/**
 * Couche d'accès aux données (DAL).
 *
 * Toute lecture ou écriture rattachée à une association doit passer par
 * `requireOrganization()` : c'est le seul endroit où l'on vérifie que
 * l'utilisateur connecté appartient bien au tenant demandé. Les requêtes
 * Prisma qui suivent filtrent ensuite systématiquement sur `organizationId`.
 *
 * Les fonctions sont mémoïsées par `cache()` : un rendu React qui appelle
 * `requireOrganization()` depuis la page et depuis trois composants ne
 * déclenche qu'une seule requête.
 */

export const getSession = cache(async () => {
  return readSession()
})

/** Exige une session valide, sinon renvoie vers la page de connexion. */
export const requireUser = cache(async (): Promise<SessionUser> => {
  const session = await getSession()
  if (!session) {
    redirect('/connexion')
  }
  return session.user
})

/** Associations auxquelles l'utilisateur connecté appartient encore. */
export const getUserOrganizations = cache(async () => {
  const session = await getSession()
  if (!session) return []

  const memberships = await db.membership.findMany({
    where: { userId: session.user.id, leftAt: null },
    select: {
      role: true,
      isDefault: true,
      organization: {
        select: {
          id: true,
          slug: true,
          name: true,
          logoUrl: true,
          kind: true,
          archivedAt: true,
        },
      },
    },
    orderBy: [{ isDefault: 'desc' }, { joinedAt: 'asc' }],
  })

  return memberships
    .filter((m) => !m.organization.archivedAt)
    .map((m) => ({ ...m.organization, role: m.role, isDefault: m.isDefault }))
})

export type OrgContext = {
  organization: {
    id: string
    slug: string
    name: string
    kind: string
    logoUrl: string | null
    currency: string
    locale: string
    timezone: string
    fiscalYearStartMonth: number
    fiscalYearStartDay: number
    enabledModules: string
  }
  membership: { id: string; role: string }
  user: SessionUser
  permissions: Set<Permission>
  can: (permission: Permission) => boolean
  /** Rubriques activées pour cette association. */
  modules: Set<ModuleKey>
  hasModule: (module: ModuleKey) => boolean
}

/**
 * Vérifie que l'utilisateur connecté a accès à l'association `slug` et
 * renvoie le contexte tenant complet.
 *
 * Une association inconnue et une association à laquelle on n'appartient pas
 * donnent toutes deux un 404 : répondre 403 sur la seconde révélerait son
 * existence à un utilisateur qui n'a rien à y faire.
 */
export const requireOrganization = cache(async (slug: string): Promise<OrgContext> => {
  const session = await getSession()
  if (!session) {
    redirect('/connexion')
  }

  const membership = await db.membership.findFirst({
    where: {
      userId: session.user.id,
      leftAt: null,
      organization: { slug, archivedAt: null },
    },
    select: {
      id: true,
      role: true,
      permissions: true,
      organization: {
        select: {
          id: true,
          slug: true,
          name: true,
          kind: true,
          logoUrl: true,
          currency: true,
          locale: true,
          timezone: true,
          fiscalYearStartMonth: true,
          fiscalYearStartDay: true,
          enabledModules: true,
        },
      },
    },
  })

  if (!membership) {
    notFound()
  }

  const permissions = resolvePermissions(membership.role, membership.permissions)
  const modules = parseModules(membership.organization.enabledModules)

  return {
    organization: membership.organization,
    membership: { id: membership.id, role: membership.role },
    user: session.user,
    permissions,
    can: (permission: Permission) => permissions.has(permission),
    modules,
    hasModule: (module: ModuleKey) => modules.has(module),
  }
})

/**
 * Module dont relève chaque famille de permissions.
 *
 * Ce lien évite de répéter le contrôle sur chaque page : demander
 * `dues.write`, c'est nécessairement travailler dans la rubrique Cotisations.
 * Les permissions `org.*` n'appartiennent à aucun module — elles portent sur
 * l'association elle-même.
 */
const MODULE_BY_PERMISSION_PREFIX: Record<string, ModuleKey> = {
  members: 'members',
  dues: 'dues',
  finance: 'finance',
  events: 'events',
  governance: 'governance',
  documents: 'documents',
}

/**
 * Variante de `requireOrganization()` qui exige en plus une permission
 * précise. À appeler en tête de chaque Server Action qui écrit, et de chaque
 * page réservée.
 *
 * Le module correspondant est vérifié au passage : sans cela, désactiver une
 * rubrique masquerait son entrée de menu tout en laissant ses écrans
 * accessibles par leur URL — un trompe-l'œil, pas une désactivation.
 */
export async function requirePermission(
  slug: string,
  permission: Permission,
): Promise<OrgContext> {
  const context = await requireOrganization(slug)

  const rubrique = MODULE_BY_PERMISSION_PREFIX[permission.split('.')[0] ?? '']
  if (rubrique && !context.hasModule(rubrique)) {
    notFound()
  }

  if (!context.can(permission)) {
    forbidden()
  }

  return context
}
