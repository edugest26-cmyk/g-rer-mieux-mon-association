'use server'

import { randomBytes } from 'node:crypto'

import type { Route } from 'next'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import type { FormState } from '@/app/(auth)/actions'
import { recordAudit } from '@/lib/audit'
import { requirePermission } from '@/lib/auth/dal'
import { db } from '@/lib/db'
import { EVENT_KINDS } from '@/lib/enums'
import { parseMoneyToCents, slugify } from '@/lib/format'

// ── Utilitaires communs ──────────────────────────────────────

const optionalText = z
  .string()
  .trim()
  .max(300)
  .transform((v) => (v === '' ? null : v))
  .nullable()

const dateTimeField = z
  .string()
  .trim()
  .refine((v) => v !== '' && !Number.isNaN(Date.parse(v)), { message: 'Date et heure requises.' })
  .transform((v) => new Date(v))

const optionalDateTimeField = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .refine((v) => v === null || !Number.isNaN(Date.parse(v)), { message: 'Date invalide.' })
  .transform((v) => (v === null ? null : new Date(v)))

function collectFieldErrors(error: z.ZodError): FormState {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !fieldErrors[key]) fieldErrors[key] = issue.message
  }
  return { error: 'Certains champs doivent être corrigés.', fieldErrors }
}

/** Slug unique par association : il sert d'URL à l'événement. */
async function uniqueSlug(organizationId: string, title: string, exceptId?: string) {
  const base = slugify(title) || 'evenement'
  let slug = base

  for (let attempt = 2; ; attempt++) {
    const taken = await db.event.findFirst({
      where: { organizationId, slug, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    })
    if (!taken) return slug
    slug = `${base}-${attempt}`
  }
}

// ── Événements ───────────────────────────────────────────────

const eventSchema = z
  .object({
    title: z.string().trim().min(2, 'Le titre est requis.').max(160),
    description: z
      .string()
      .trim()
      .max(4000)
      .transform((v) => (v === '' ? null : v))
      .nullable(),
    kind: z.enum(EVENT_KINDS),
    startAt: dateTimeField,
    endAt: dateTimeField,
    locationName: optionalText,
    locationAddress: optionalText,
    onlineUrl: optionalText,
    capacity: z
      .string()
      .trim()
      .transform((v) => (v === '' ? null : Number.parseInt(v, 10)))
      .nullable()
      .refine((v) => v === null || (Number.isFinite(v) && v > 0), {
        message: 'La jauge doit être un nombre positif.',
      }),
    membersOnly: z.boolean(),
    requiresApproval: z.boolean(),
    registrationClosesAt: optionalDateTimeField,
  })
  .refine((d) => d.endAt >= d.startAt, {
    message: 'La fin doit suivre le début.',
    path: ['endAt'],
  })

function readEventForm(formData: FormData) {
  return {
    title: formData.get('title') ?? '',
    description: formData.get('description') ?? '',
    kind: formData.get('kind'),
    startAt: formData.get('startAt') ?? '',
    endAt: formData.get('endAt') ?? '',
    locationName: formData.get('locationName') ?? '',
    locationAddress: formData.get('locationAddress') ?? '',
    onlineUrl: formData.get('onlineUrl') ?? '',
    capacity: formData.get('capacity') ?? '',
    membersOnly: formData.get('membersOnly') === 'on',
    requiresApproval: formData.get('requiresApproval') === 'on',
    registrationClosesAt: formData.get('registrationClosesAt') ?? '',
  }
}

export async function createEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  const org = String(formData.get('org') ?? '')
  const { organization, user } = await requirePermission(org, 'events.write')

  const parsed = eventSchema.safeParse(readEventForm(formData))
  if (!parsed.success) return collectFieldErrors(parsed.error)
  const data = parsed.data

  const event = await db.event.create({
    data: {
      organizationId: organization.id,
      slug: await uniqueSlug(organization.id, data.title),
      title: data.title,
      description: data.description,
      kind: data.kind,
      // Un événement naît en brouillon : il n'est visible des adhérents
      // qu'une fois publié explicitement.
      status: 'DRAFT',
      startAt: data.startAt,
      endAt: data.endAt,
      locationName: data.locationName,
      locationAddress: data.locationAddress,
      onlineUrl: data.onlineUrl,
      capacity: data.capacity,
      membersOnly: data.membersOnly,
      requiresApproval: data.requiresApproval,
      registrationClosesAt: data.registrationClosesAt,
    },
    select: { id: true, slug: true, title: true },
  })

  await recordAudit({
    organizationId: organization.id,
    userId: user.id,
    action: 'Création',
    entityType: 'Événement',
    entityId: event.id,
    changes: { title: event.title },
  })

  revalidatePath(`/${org}/evenements`)
  redirect(`/${org}/evenements/${event.slug}` as Route)
}

export async function updateEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  const org = String(formData.get('org') ?? '')
  const id = String(formData.get('id') ?? '')
  const { organization, user } = await requirePermission(org, 'events.write')

  const existing = await db.event.findFirst({ where: { id, organizationId: organization.id } })
  if (!existing) return { error: "Cet événement n'existe pas dans cette association." }

  const parsed = eventSchema.safeParse(readEventForm(formData))
  if (!parsed.success) return collectFieldErrors(parsed.error)
  const data = parsed.data

  // Réduire la jauge en dessous des inscriptions déjà confirmées créerait un
  // sur-booking silencieux : on refuse plutôt que de trancher à la place du
  // responsable.
  if (data.capacity !== null) {
    const seats = await db.registration.aggregate({
      where: { eventId: id, status: { in: ['CONFIRMED', 'ATTENDED'] } },
      _sum: { quantity: true },
    })
    const taken = seats._sum.quantity ?? 0
    if (data.capacity < taken) {
      return {
        error: `La jauge ne peut pas descendre sous les ${taken} places déjà confirmées.`,
        fieldErrors: { capacity: `Au moins ${taken}.` },
      }
    }
  }

  const slug =
    existing.title === data.title
      ? existing.slug
      : await uniqueSlug(organization.id, data.title, id)

  await db.event.update({
    where: { id },
    data: {
      slug,
      title: data.title,
      description: data.description,
      kind: data.kind,
      startAt: data.startAt,
      endAt: data.endAt,
      locationName: data.locationName,
      locationAddress: data.locationAddress,
      onlineUrl: data.onlineUrl,
      capacity: data.capacity,
      membersOnly: data.membersOnly,
      requiresApproval: data.requiresApproval,
      registrationClosesAt: data.registrationClosesAt,
    },
  })

  await recordAudit({
    organizationId: organization.id,
    userId: user.id,
    action: 'Modification',
    entityType: 'Événement',
    entityId: id,
    changes: {
      title: { de: existing.title, vers: data.title },
      capacity: { de: existing.capacity, vers: data.capacity },
    },
  })

  revalidatePath(`/${org}/evenements`)
  redirect(`/${org}/evenements/${slug}` as Route)
}

/** Publication, annulation ou archivage depuis la fiche de l'événement. */
export async function setEventStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  const org = String(formData.get('org') ?? '')
  const id = String(formData.get('id') ?? '')
  const status = String(formData.get('status') ?? '')
  const { organization, user } = await requirePermission(org, 'events.write')

  if (!['DRAFT', 'PUBLISHED', 'CANCELED', 'ARCHIVED'].includes(status)) {
    return { error: 'Statut inconnu.' }
  }

  const existing = await db.event.findFirst({
    where: { id, organizationId: organization.id },
    select: { id: true, slug: true, status: true, title: true },
  })
  if (!existing) return { error: "Cet événement n'existe pas dans cette association." }

  await db.event.update({ where: { id }, data: { status } })

  // Annuler l'événement annule les inscriptions : les laisser « confirmées »
  // donnerait des listes de présence pour une soirée qui n'aura pas lieu.
  if (status === 'CANCELED') {
    await db.registration.updateMany({
      where: { eventId: id, status: { in: ['CONFIRMED', 'PENDING', 'WAITLISTED'] } },
      data: { status: 'CANCELED', canceledAt: new Date() },
    })
  }

  await recordAudit({
    organizationId: organization.id,
    userId: user.id,
    action: status === 'PUBLISHED' ? 'Publication' : status === 'CANCELED' ? 'Annulation' : 'Statut',
    entityType: 'Événement',
    entityId: id,
    changes: { title: existing.title, de: existing.status, vers: status },
  })

  revalidatePath(`/${org}/evenements`)
  revalidatePath(`/${org}/evenements/${existing.slug}`)
  return { success: 'Statut mis à jour.' }
}

// ── Tarifs ───────────────────────────────────────────────────

const ticketSchema = z.object({
  name: z.string().trim().min(1, 'Le libellé est requis.').max(80),
  priceCents: z
    .string()
    .trim()
    .transform((v) => (v === '' ? 0 : parseMoneyToCents(v)))
    .refine((c): c is number => c !== null && c >= 0, { message: 'Montant invalide.' }),
  quantity: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : Number.parseInt(v, 10)))
    .nullable()
    .refine((v) => v === null || (Number.isFinite(v) && v > 0), { message: 'Quantité invalide.' }),
})

export async function createTicketType(_prev: FormState, formData: FormData): Promise<FormState> {
  const org = String(formData.get('org') ?? '')
  const eventId = String(formData.get('eventId') ?? '')
  const { organization, user } = await requirePermission(org, 'events.write')

  const event = await db.event.findFirst({
    where: { id: eventId, organizationId: organization.id },
    select: { id: true, slug: true },
  })
  if (!event) return { error: "Cet événement n'existe pas dans cette association." }

  const parsed = ticketSchema.safeParse({
    name: formData.get('name') ?? '',
    priceCents: formData.get('priceCents') ?? '',
    quantity: formData.get('quantity') ?? '',
  })
  if (!parsed.success) return collectFieldErrors(parsed.error)

  const count = await db.ticketType.count({ where: { eventId } })

  const ticket = await db.ticketType.create({
    data: {
      organizationId: organization.id,
      eventId,
      name: parsed.data.name,
      priceCents: parsed.data.priceCents,
      quantity: parsed.data.quantity,
      position: count,
    },
    select: { id: true, name: true },
  })

  await recordAudit({
    organizationId: organization.id,
    userId: user.id,
    action: 'Création',
    entityType: 'Tarif',
    entityId: ticket.id,
    changes: { name: ticket.name, priceCents: parsed.data.priceCents },
  })

  revalidatePath(`/${org}/evenements/${event.slug}`)
  return { success: `Tarif « ${ticket.name} » ajouté.` }
}

// ── Inscriptions ─────────────────────────────────────────────

/**
 * Places déjà prises sur un événement.
 *
 * Seules les inscriptions confirmées ou pointées consomment la jauge : une
 * inscription en liste d'attente, en attente de validation ou annulée n'occupe
 * pas de place.
 */
async function seatsTaken(eventId: string): Promise<number> {
  const result = await db.registration.aggregate({
    where: { eventId, status: { in: ['CONFIRMED', 'ATTENDED'] } },
    _sum: { quantity: true },
  })
  return result._sum.quantity ?? 0
}

const registrationSchema = z
  .object({
    memberId: z
      .string()
      .trim()
      .transform((v) => (v === '' ? null : v))
      .nullable(),
    guestName: optionalText,
    guestEmail: optionalText.refine(
      (v) => v === null || z.string().email().safeParse(v).success,
      { message: 'Adresse e-mail invalide.' },
    ),
    ticketTypeId: z
      .string()
      .trim()
      .transform((v) => (v === '' ? null : v))
      .nullable(),
    quantity: z
      .string()
      .trim()
      .transform((v) => (v === '' ? 1 : Number.parseInt(v, 10)))
      .refine((v) => Number.isFinite(v) && v > 0 && v <= 50, {
        message: 'Entre 1 et 50 places.',
      }),
  })
  .refine((d) => d.memberId !== null || (d.guestName?.length ?? 0) > 0, {
    message: 'Choisissez un adhérent ou saisissez un nom.',
    path: ['guestName'],
  })

export async function registerParticipant(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const org = String(formData.get('org') ?? '')
  const eventId = String(formData.get('eventId') ?? '')
  const { organization, user } = await requirePermission(org, 'events.write')

  const event = await db.event.findFirst({
    where: { id: eventId, organizationId: organization.id },
    select: {
      id: true,
      slug: true,
      status: true,
      capacity: true,
      membersOnly: true,
      requiresApproval: true,
      registrationClosesAt: true,
    },
  })
  if (!event) return { error: "Cet événement n'existe pas dans cette association." }
  if (event.status === 'CANCELED') return { error: 'Cet événement est annulé.' }

  const parsed = registrationSchema.safeParse({
    memberId: formData.get('memberId') ?? '',
    guestName: formData.get('guestName') ?? '',
    guestEmail: formData.get('guestEmail') ?? '',
    ticketTypeId: formData.get('ticketTypeId') ?? '',
    quantity: formData.get('quantity') ?? '',
  })
  if (!parsed.success) return collectFieldErrors(parsed.error)
  const data = parsed.data

  if (event.membersOnly && data.memberId === null) {
    return {
      error: 'Cet événement est réservé aux adhérents.',
      fieldErrors: { guestName: 'Réservé aux adhérents.' },
    }
  }

  if (event.registrationClosesAt && event.registrationClosesAt < new Date()) {
    return { error: 'Les inscriptions sont closes pour cet événement.' }
  }

  // Un identifiant d'adhérent venu d'une autre association ne doit pas passer.
  const member = data.memberId
    ? await db.member.findFirst({
        where: { id: data.memberId, organizationId: organization.id },
        select: { id: true },
      })
    : null

  if (data.memberId && !member) {
    return { error: 'Adhérent introuvable.', fieldErrors: { memberId: 'Introuvable.' } }
  }

  if (member) {
    const already = await db.registration.findFirst({
      where: { eventId, memberId: member.id, status: { not: 'CANCELED' } },
      select: { id: true },
    })
    if (already) {
      return { error: 'Cet adhérent est déjà inscrit à cet événement.' }
    }
  }

  const ticketType = data.ticketTypeId
    ? await db.ticketType.findFirst({
        where: { id: data.ticketTypeId, eventId, organizationId: organization.id },
        select: { id: true, priceCents: true },
      })
    : null

  if (data.ticketTypeId && !ticketType) {
    return { error: 'Tarif introuvable.', fieldErrors: { ticketTypeId: 'Introuvable.' } }
  }

  // La jauge décide du statut : au-delà, on met en liste d'attente plutôt que
  // de refuser — l'inscription est conservée et repêchée en cas de désistement.
  const taken = await seatsTaken(eventId)
  const overCapacity = event.capacity !== null && taken + data.quantity > event.capacity

  const status = overCapacity ? 'WAITLISTED' : event.requiresApproval ? 'PENDING' : 'CONFIRMED'

  const registration = await db.registration.create({
    data: {
      organizationId: organization.id,
      eventId,
      memberId: member?.id ?? null,
      ticketTypeId: ticketType?.id ?? null,
      guestName: member ? null : data.guestName,
      guestEmail: member ? null : data.guestEmail,
      status,
      quantity: data.quantity,
      amountCents: (ticketType?.priceCents ?? 0) * data.quantity,
      ticketCode: `${randomBytes(4).toString('hex').toUpperCase()}`,
    },
    select: { id: true },
  })

  // La jauge vient d'être atteinte : l'événement s'affiche complet.
  if (!overCapacity && event.capacity !== null && taken + data.quantity >= event.capacity) {
    await db.event.update({ where: { id: eventId }, data: { status: 'FULL' } })
  }

  await recordAudit({
    organizationId: organization.id,
    userId: user.id,
    action: 'Inscription',
    entityType: 'Événement',
    entityId: eventId,
    changes: { registrationId: registration.id, statut: status, places: data.quantity },
  })

  revalidatePath(`/${org}/evenements/${event.slug}`)
  revalidatePath(`/${org}/evenements`)

  return {
    success:
      status === 'WAITLISTED'
        ? 'Jauge atteinte : inscription placée en liste d’attente.'
        : status === 'PENDING'
          ? 'Inscription enregistrée, en attente de validation.'
          : 'Inscription confirmée.',
  }
}

/**
 * Annule une inscription et repêche la première personne en liste d'attente.
 *
 * Sans ce repêchage, une place libérée resterait vide alors que des adhérents
 * attendent — le cas le plus courant en pratique.
 */
export async function cancelRegistration(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const org = String(formData.get('org') ?? '')
  const registrationId = String(formData.get('registrationId') ?? '')
  const { organization, user } = await requirePermission(org, 'events.write')

  const registration = await db.registration.findFirst({
    where: { id: registrationId, organizationId: organization.id },
    select: {
      id: true,
      status: true,
      quantity: true,
      event: { select: { id: true, slug: true, capacity: true, status: true } },
    },
  })
  if (!registration) return { error: "Cette inscription n'existe pas dans cette association." }
  if (registration.status === 'CANCELED') return { error: 'Cette inscription est déjà annulée.' }

  await db.registration.update({
    where: { id: registrationId },
    data: { status: 'CANCELED', canceledAt: new Date() },
  })

  let promotedName: string | null = null
  const { event } = registration

  if (event.capacity !== null) {
    const taken = await seatsTaken(event.id)
    let free = event.capacity - taken

    // On repêche dans l'ordre d'inscription, et seulement ceux qui tiennent
    // dans la place libérée : promouvoir une réservation de 4 places sur une
    // seule place libre recréerait un sur-booking.
    const waiting = await db.registration.findMany({
      where: { eventId: event.id, status: 'WAITLISTED' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        quantity: true,
        guestName: true,
        member: { select: { firstName: true, lastName: true, legalName: true, kind: true } },
      },
    })

    for (const candidate of waiting) {
      if (candidate.quantity > free) continue

      await db.registration.update({
        where: { id: candidate.id },
        data: { status: 'CONFIRMED' },
      })
      free -= candidate.quantity

      if (!promotedName) {
        promotedName =
          candidate.member
            ? candidate.member.kind === 'ORGANIZATION'
              ? (candidate.member.legalName ?? 'Adhérent')
              : `${candidate.member.firstName ?? ''} ${candidate.member.lastName ?? ''}`.trim()
            : (candidate.guestName ?? 'Invité')
      }

      if (free <= 0) break
    }

    // Des places sont de nouveau disponibles : l'événement n'est plus complet.
    if (free > 0 && event.status === 'FULL') {
      await db.event.update({ where: { id: event.id }, data: { status: 'PUBLISHED' } })
    }
  }

  await recordAudit({
    organizationId: organization.id,
    userId: user.id,
    action: 'Annulation inscription',
    entityType: 'Événement',
    entityId: event.id,
    changes: { registrationId, repeche: promotedName },
  })

  revalidatePath(`/${org}/evenements/${event.slug}`)
  revalidatePath(`/${org}/evenements`)

  return {
    success: promotedName
      ? `Inscription annulée. ${promotedName} a été repêché de la liste d’attente.`
      : 'Inscription annulée.',
  }
}

/** Pointage des présences le jour de l'événement. */
export async function toggleCheckIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const org = String(formData.get('org') ?? '')
  const registrationId = String(formData.get('registrationId') ?? '')
  const { organization } = await requirePermission(org, 'events.checkin')

  const registration = await db.registration.findFirst({
    where: { id: registrationId, organizationId: organization.id },
    select: { id: true, status: true, event: { select: { slug: true } } },
  })
  if (!registration) return { error: "Cette inscription n'existe pas dans cette association." }

  const present = registration.status === 'ATTENDED'

  await db.registration.update({
    where: { id: registrationId },
    data: present
      ? { status: 'CONFIRMED', checkedInAt: null }
      : { status: 'ATTENDED', checkedInAt: new Date() },
  })

  revalidatePath(`/${org}/evenements/${registration.event.slug}`)
  return { success: present ? 'Présence retirée.' : 'Présence enregistrée.' }
}
