import 'server-only'

import { headers } from 'next/headers'

import { db } from '@/lib/db'

/**
 * Journal d'activité.
 *
 * Une association doit pouvoir répondre à « qui a modifié cette fiche, et
 * quand ». On enregistre donc l'auteur, l'objet touché et le détail des champs
 * modifiés — pas seulement le fait qu'une modification a eu lieu.
 *
 * L'écriture du journal ne doit jamais faire échouer l'opération métier
 * qu'elle accompagne : une panne de journalisation ferait sinon perdre la
 * saisie de l'utilisateur.
 */
export async function recordAudit(input: {
  organizationId: string
  userId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  changes?: Record<string, unknown>
}): Promise<void> {
  try {
    const headerList = await headers()

    await db.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        changes: JSON.stringify(input.changes ?? {}),
        ipAddress: headerList.get('x-forwarded-for'),
        userAgent: headerList.get('user-agent'),
      },
    })
  } catch (error) {
    console.error("Échec d'écriture du journal d'activité", error)
  }
}

/**
 * Compare deux états d'un enregistrement et ne retient que les champs ayant
 * réellement changé, sous la forme `{ champ: { de, vers } }`.
 *
 * Sans ce filtrage, chaque enregistrement archiverait la fiche entière et le
 * journal deviendrait illisible dès la deuxième modification.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Record<string, { de: unknown; vers: unknown }> {
  const changes: Record<string, { de: unknown; vers: unknown }> = {}

  for (const [key, next] of Object.entries(after)) {
    const previous = before[key]

    // Les dates ne sont pas comparables par identité : on passe par l'ISO.
    const normalize = (value: unknown) =>
      value instanceof Date ? value.toISOString() : (value ?? null)

    if (normalize(previous) !== normalize(next)) {
      changes[key] = { de: normalize(previous), vers: normalize(next) }
    }
  }

  return changes
}
