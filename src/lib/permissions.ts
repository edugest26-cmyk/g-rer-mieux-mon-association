import type { Role } from '@/lib/enums'

/**
 * Permissions applicatives, au format `domaine.action`.
 *
 * Le rôle porté par une `Membership` détermine un socle de permissions ; le
 * champ JSON `Membership.permissions` permet ensuite d'en ajouter ou d'en
 * retirer au cas par cas, sans inventer un rôle supplémentaire.
 */
export const PERMISSIONS = [
  // Adhérents
  'members.read',
  'members.write',
  'members.delete',
  'members.export',
  // Cotisations
  'dues.read',
  'dues.write',
  // Finances
  'finance.read',
  'finance.write',
  // Validation des écritures et clôture d'exercice
  'finance.post',
  'finance.export',
  // Événements
  'events.read',
  'events.write',
  'events.checkin',
  // Gouvernance
  'governance.read',
  'governance.write',
  'governance.vote',
  // Documents
  'documents.read',
  'documents.write',
  'documents.delete',
  // Administration de l'association
  'org.settings',
  'org.users',
  'org.billing',
  'org.audit',
] as const

export type Permission = (typeof PERMISSIONS)[number]

const ALL: Permission[] = [...PERMISSIONS]

const READ_ONLY: Permission[] = [
  'members.read',
  'dues.read',
  'finance.read',
  'events.read',
  'governance.read',
  'documents.read',
]

/**
 * Socle de permissions par rôle. Un adhérent simple ne voit délibérément ni
 * la comptabilité ni le fichier des membres : seulement ce qui le concerne.
 */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: ALL,

  ADMIN: ALL.filter((p) => p !== 'org.billing'),

  TREASURER: [
    'members.read',
    'dues.read',
    'dues.write',
    'finance.read',
    'finance.write',
    'finance.post',
    'finance.export',
    'events.read',
    'governance.read',
    'documents.read',
    'documents.write',
  ],

  SECRETARY: [
    'members.read',
    'members.write',
    'members.export',
    'dues.read',
    'finance.read',
    'events.read',
    'events.write',
    'events.checkin',
    'governance.read',
    'governance.write',
    'documents.read',
    'documents.write',
  ],

  MANAGER: [
    'members.read',
    'dues.read',
    'events.read',
    'events.write',
    'events.checkin',
    'documents.read',
    'governance.read',
  ],

  MEMBER: ['events.read', 'governance.read', 'governance.vote', 'documents.read'],

  VIEWER: READ_ONLY,
}

type PermissionOverrides = {
  grant?: string[]
  revoke?: string[]
}

/**
 * Calcule les permissions effectives : socle du rôle, moins les retraits,
 * plus les ajouts. Les retraits sont appliqués avant les ajouts pour qu'une
 * permission explicitement accordée l'emporte toujours.
 */
export function resolvePermissions(role: string, overridesJson?: string | null): Set<Permission> {
  const base = ROLE_PERMISSIONS[role as Role] ?? []
  const effective = new Set<Permission>(base)

  if (overridesJson) {
    let overrides: PermissionOverrides = {}
    try {
      overrides = JSON.parse(overridesJson) as PermissionOverrides
    } catch {
      // JSON illisible : on s'en tient au socle du rôle plutôt que de refuser l'accès
      return effective
    }

    for (const p of overrides.revoke ?? []) {
      effective.delete(p as Permission)
    }
    for (const p of overrides.grant ?? []) {
      if ((PERMISSIONS as readonly string[]).includes(p)) {
        effective.add(p as Permission)
      }
    }
  }

  return effective
}

export function roleRank(role: string): number {
  const order: Role[] = ['VIEWER', 'MEMBER', 'MANAGER', 'SECRETARY', 'TREASURER', 'ADMIN', 'OWNER']
  const index = order.indexOf(role as Role)
  return index === -1 ? 0 : index
}
