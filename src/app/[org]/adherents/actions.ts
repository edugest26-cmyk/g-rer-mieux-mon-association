'use server'

import type { Route } from 'next'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import type { FormState } from '@/app/(auth)/actions'
import { diffFields, recordAudit } from '@/lib/audit'
import { requirePermission } from '@/lib/auth/dal'
import { db } from '@/lib/db'
import { MEMBER_KINDS, MEMBER_STATUSES } from '@/lib/enums'

/** Champ texte facultatif : une chaîne vide vaut « non renseigné ». */
const optionalText = z
  .string()
  .trim()
  .max(200)
  .transform((value) => (value === '' ? null : value))
  .nullable()

/** Date au format `YYYY-MM-DD` issue d'un `<input type="date">`. */
const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .refine((value) => value === null || !Number.isNaN(Date.parse(value)), {
    message: 'Date invalide.',
  })
  .transform((value) => (value === null ? null : new Date(value)))

const memberSchema = z
  .object({
    kind: z.enum(MEMBER_KINDS),
    status: z.enum(MEMBER_STATUSES),
    memberNumber: z.string().trim().max(30).optional(),

    civility: optionalText,
    firstName: optionalText,
    lastName: optionalText,
    legalName: optionalText,
    gender: optionalText,
    birthDate: optionalDate,

    email: optionalText.refine(
      (value) => value === null || z.string().email().safeParse(value).success,
      { message: 'Adresse e-mail invalide.' },
    ),
    phone: optionalText,
    mobile: optionalText,

    addressLine1: optionalText,
    addressLine2: optionalText,
    postalCode: optionalText,
    city: optionalText,
    country: z.string().trim().min(2).max(2).default('FR'),

    categoryId: optionalText,
    joinedAt: optionalDate,
    notes: z.string().trim().max(5000).transform((v) => (v === '' ? null : v)).nullable(),

    acceptsNewsletter: z.boolean(),
    acceptsPhotos: z.boolean(),
  })
  // Une personne morale n'a pas de nom de famille, une personne physique pas
  // de raison sociale : on exige le bon champ selon le type.
  .refine((data) => data.kind !== 'PERSON' || (data.lastName?.length ?? 0) > 0, {
    message: 'Le nom est requis pour une personne physique.',
    path: ['lastName'],
  })
  .refine((data) => data.kind !== 'ORGANIZATION' || (data.legalName?.length ?? 0) > 0, {
    message: 'La raison sociale est requise pour une personne morale.',
    path: ['legalName'],
  })

function readForm(formData: FormData) {
  return {
    kind: formData.get('kind'),
    status: formData.get('status'),
    memberNumber: (formData.get('memberNumber') as string | null) ?? undefined,
    civility: formData.get('civility') ?? '',
    firstName: formData.get('firstName') ?? '',
    lastName: formData.get('lastName') ?? '',
    legalName: formData.get('legalName') ?? '',
    gender: formData.get('gender') ?? '',
    birthDate: formData.get('birthDate') ?? '',
    email: formData.get('email') ?? '',
    phone: formData.get('phone') ?? '',
    mobile: formData.get('mobile') ?? '',
    addressLine1: formData.get('addressLine1') ?? '',
    addressLine2: formData.get('addressLine2') ?? '',
    postalCode: formData.get('postalCode') ?? '',
    city: formData.get('city') ?? '',
    country: (formData.get('country') as string | null)?.trim() || 'FR',
    categoryId: formData.get('categoryId') ?? '',
    joinedAt: formData.get('joinedAt') ?? '',
    notes: formData.get('notes') ?? '',
    acceptsNewsletter: formData.get('acceptsNewsletter') === 'on',
    acceptsPhotos: formData.get('acceptsPhotos') === 'on',
  }
}

function collectFieldErrors(error: z.ZodError): FormState {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !fieldErrors[key]) {
      fieldErrors[key] = issue.message
    }
  }
  return { error: 'Certains champs doivent être corrigés.', fieldErrors }
}

/**
 * Vérifie que la catégorie choisie appartient bien à l'association courante.
 *
 * Sans ce contrôle, le champ caché du formulaire permettrait de rattacher un
 * adhérent à une catégorie d'une autre association — et de deviner au passage
 * quels identifiants existent ailleurs.
 */
async function resolveCategoryId(
  organizationId: string,
  categoryId: string | null,
): Promise<string | null> {
  if (!categoryId) return null

  const category = await db.memberCategory.findFirst({
    where: { id: categoryId, organizationId },
    select: { id: true },
  })

  return category?.id ?? null
}

/**
 * Attribue le prochain numéro d'adhérent libre, au format `A0001`.
 *
 * La numérotation repose sur le plus grand numéro existant plutôt que sur le
 * nombre d'adhérents : après une suppression, compter les fiches
 * rejouerait un numéro déjà utilisé.
 */
async function nextMemberNumber(organizationId: string): Promise<string> {
  const members = await db.member.findMany({
    where: { organizationId },
    select: { memberNumber: true },
  })

  const highest = members.reduce((max, { memberNumber }) => {
    const digits = memberNumber.match(/(\d+)\s*$/)?.[1]
    const value = digits ? Number.parseInt(digits, 10) : 0
    return value > max ? value : max
  }, 0)

  return `A${String(highest + 1).padStart(4, '0')}`
}

export async function createMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const org = String(formData.get('org') ?? '')
  const { organization, user } = await requirePermission(org, 'members.write')

  const parsed = memberSchema.safeParse(readForm(formData))
  if (!parsed.success) return collectFieldErrors(parsed.error)

  const data = parsed.data
  const memberNumber = data.memberNumber?.trim() || (await nextMemberNumber(organization.id))

  const taken = await db.member.findFirst({
    where: { organizationId: organization.id, memberNumber },
    select: { id: true },
  })
  if (taken) {
    return {
      error: 'Ce numéro d’adhérent est déjà utilisé.',
      fieldErrors: { memberNumber: 'Numéro déjà attribué.' },
    }
  }

  const member = await db.member.create({
    data: {
      organizationId: organization.id,
      memberNumber,
      kind: data.kind,
      status: data.status,
      civility: data.civility,
      firstName: data.firstName,
      lastName: data.lastName,
      legalName: data.legalName,
      gender: data.gender,
      birthDate: data.birthDate,
      email: data.email,
      phone: data.phone,
      mobile: data.mobile,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2,
      postalCode: data.postalCode,
      city: data.city,
      country: data.country,
      categoryId: await resolveCategoryId(organization.id, data.categoryId),
      joinedAt: data.joinedAt ?? new Date(),
      notes: data.notes,
      acceptsNewsletter: data.acceptsNewsletter,
      acceptsPhotos: data.acceptsPhotos,
      consentAt: data.acceptsNewsletter || data.acceptsPhotos ? new Date() : null,
    },
    select: { id: true, memberNumber: true },
  })

  await recordAudit({
    organizationId: organization.id,
    userId: user.id,
    action: 'Création',
    entityType: 'Adhérent',
    entityId: member.id,
    changes: { memberNumber: member.memberNumber },
  })

  revalidatePath(`/${org}/adherents`)
  redirect(`/${org}/adherents/${member.id}` as Route)
}

export async function updateMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const org = String(formData.get('org') ?? '')
  const id = String(formData.get('id') ?? '')
  const { organization, user } = await requirePermission(org, 'members.write')

  // Le filtre sur `organizationId` empêche de modifier la fiche d'un adhérent
  // appartenant à une autre association en changeant l'identifiant du champ caché.
  const existing = await db.member.findFirst({
    where: { id, organizationId: organization.id },
  })

  if (!existing) {
    return { error: "Cet adhérent n'existe pas dans cette association." }
  }

  const parsed = memberSchema.safeParse(readForm(formData))
  if (!parsed.success) return collectFieldErrors(parsed.error)

  const data = parsed.data
  const memberNumber = data.memberNumber?.trim() || existing.memberNumber

  if (memberNumber !== existing.memberNumber) {
    const taken = await db.member.findFirst({
      where: { organizationId: organization.id, memberNumber, id: { not: id } },
      select: { id: true },
    })
    if (taken) {
      return {
        error: 'Ce numéro d’adhérent est déjà utilisé.',
        fieldErrors: { memberNumber: 'Numéro déjà attribué.' },
      }
    }
  }

  const consentsChanged =
    existing.acceptsNewsletter !== data.acceptsNewsletter ||
    existing.acceptsPhotos !== data.acceptsPhotos

  const update = {
    memberNumber,
    kind: data.kind,
    status: data.status,
    civility: data.civility,
    firstName: data.firstName,
    lastName: data.lastName,
    legalName: data.legalName,
    gender: data.gender,
    birthDate: data.birthDate,
    email: data.email,
    phone: data.phone,
    mobile: data.mobile,
    addressLine1: data.addressLine1,
    addressLine2: data.addressLine2,
    postalCode: data.postalCode,
    city: data.city,
    country: data.country,
    categoryId: await resolveCategoryId(organization.id, data.categoryId),
    joinedAt: data.joinedAt ?? existing.joinedAt,
    notes: data.notes,
    acceptsNewsletter: data.acceptsNewsletter,
    acceptsPhotos: data.acceptsPhotos,
    // La date de consentement n'a de sens que si le consentement bouge.
    consentAt: consentsChanged ? new Date() : existing.consentAt,
  }

  await db.member.update({ where: { id }, data: update })

  await recordAudit({
    organizationId: organization.id,
    userId: user.id,
    action: 'Modification',
    entityType: 'Adhérent',
    entityId: id,
    changes: diffFields(existing as unknown as Record<string, unknown>, update),
  })

  revalidatePath(`/${org}/adherents`)
  revalidatePath(`/${org}/adherents/${id}`)
  redirect(`/${org}/adherents/${id}` as Route)
}

/**
 * Radiation d'un adhérent. On ne supprime pas la fiche : ses cotisations, ses
 * règlements et ses votes en assemblée doivent rester consultables.
 */
export async function archiveMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const org = String(formData.get('org') ?? '')
  const id = String(formData.get('id') ?? '')
  const reason = String(formData.get('leaveReason') ?? '').trim()
  const { organization, user } = await requirePermission(org, 'members.write')

  const existing = await db.member.findFirst({
    where: { id, organizationId: organization.id },
    select: { id: true, status: true },
  })

  if (!existing) {
    return { error: "Cet adhérent n'existe pas dans cette association." }
  }

  await db.member.update({
    where: { id },
    data: {
      status: 'RESIGNED',
      leftAt: new Date(),
      leaveReason: reason === '' ? null : reason,
    },
  })

  await recordAudit({
    organizationId: organization.id,
    userId: user.id,
    action: 'Radiation',
    entityType: 'Adhérent',
    entityId: id,
    changes: { status: { de: existing.status, vers: 'RESIGNED' }, motif: reason || null },
  })

  revalidatePath(`/${org}/adherents`)
  revalidatePath(`/${org}/adherents/${id}`)
  redirect(`/${org}/adherents/${id}` as Route)
}
