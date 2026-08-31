'use server'

import type { Route } from 'next'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import type { FormState } from '@/app/(auth)/actions'
import { requireUser } from '@/lib/auth/dal'
import { setActiveOrganization } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { ORG_KINDS } from '@/lib/enums'
import { slugify } from '@/lib/format'

const schema = z.object({
  name: z.string().min(2, "Le nom de l'association est requis.").max(120),
  kind: z.enum(ORG_KINDS),
})

/**
 * Création d'une association supplémentaire par un compte déjà connecté.
 *
 * Distinct de l'inscription : le compte existe déjà, seule la structure est
 * à créer, et l'utilisateur en devient propriétaire.
 */
export async function createOrganization(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser()

  const parsed = schema.safeParse({
    name: formData.get('name'),
    kind: formData.get('kind'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Formulaire invalide.' }
  }

  const { name, kind } = parsed.data

  // Le slug sert d'URL : on le suffixe tant qu'il est déjà pris.
  const base = slugify(name) || 'association'
  let slug = base
  for (
    let attempt = 2;
    await db.organization.findUnique({ where: { slug }, select: { id: true } });
    attempt++
  ) {
    slug = `${base}-${attempt}`
  }

  await db.organization.create({
    data: {
      slug,
      name,
      kind,
      enabledModules: JSON.stringify({
        members: true,
        finance: true,
        events: true,
        governance: true,
        documents: true,
      }),
      memberships: {
        create: { userId: user.id, role: 'OWNER' },
      },
      subscription: {
        create: {
          plan: 'FREE',
          status: 'TRIALING',
          trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      },
      documentFolders: {
        create: [
          { name: 'Statuts et règlement', isSystem: true, position: 0 },
          { name: 'Procès-verbaux', isSystem: true, position: 1 },
          { name: 'Comptabilité', isSystem: true, position: 2 },
        ],
      },
    },
  })

  await setActiveOrganization(slug)
  redirect(`/${slug}/tableau-de-bord` as Route)
}
