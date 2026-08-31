'use server'

import { revalidatePath } from 'next/cache'

import type { FormState } from '@/app/(auth)/actions'
import { recordAudit } from '@/lib/audit'
import { requirePermission } from '@/lib/auth/dal'
import { db } from '@/lib/db'
import { MODULES, moduleLabel, serializeModules, type ModuleKey } from '@/lib/modules'

/**
 * Active ou désactive les rubriques de l'association.
 *
 * Désactiver ne supprime rien : les données restent en base et réapparaissent
 * telles quelles à la réactivation. C'est ce qui rend le geste réversible, et
 * donc utilisable sans crainte.
 */
export async function updateModules(_prev: FormState, formData: FormData): Promise<FormState> {
  const org = String(formData.get('org') ?? '')
  const { organization, user } = await requirePermission(org, 'org.settings')

  const selected: ModuleKey[] = MODULES.filter(
    (rubrique) => rubrique.core || formData.get(`rubrique.${rubrique.key}`) === 'on',
  ).map((rubrique) => rubrique.key)

  await db.organization.update({
    where: { id: organization.id },
    data: { enabledModules: serializeModules(selected) },
  })

  await recordAudit({
    organizationId: organization.id,
    userId: user.id,
    action: 'Modules',
    entityType: 'Association',
    entityId: organization.id,
    changes: { actives: selected.map(moduleLabel) },
  })

  // La navigation est rendue par la disposition : toute la section doit être
  // réévaluée, pas seulement la page des réglages.
  revalidatePath(`/${org}`, 'layout')

  const optional = selected.filter((key) => !MODULES.find((m) => m.key === key)?.core).length

  return {
    success: `Rubriques enregistrées : ${optional} activée${optional > 1 ? 's' : ''} en plus des adhérents.`,
  }
}
