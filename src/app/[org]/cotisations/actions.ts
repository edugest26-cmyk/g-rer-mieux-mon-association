'use server'

import type { Route } from 'next'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import type { FormState } from '@/app/(auth)/actions'
import { recordAudit } from '@/lib/audit'
import { requirePermission } from '@/lib/auth/dal'
import { db } from '@/lib/db'
import { isEmailConfigured, sendBatch } from '@/lib/email/send'
import { dueReminderEmail } from '@/lib/email/templates'
import { FEE_PERIODS, PAYMENT_METHODS } from '@/lib/enums'
import { formatMoneyShort, memberDisplayName, parseMoneyToCents } from '@/lib/format'

// ── Utilitaires communs ──────────────────────────────────────

const moneyField = z
  .string()
  .trim()
  .transform((value) => parseMoneyToCents(value))
  .refine((cents): cents is number => cents !== null && cents >= 0, {
    message: 'Montant invalide.',
  })

const dateField = z
  .string()
  .trim()
  .refine((value) => value !== '' && !Number.isNaN(Date.parse(value)), { message: 'Date requise.' })
  .transform((value) => new Date(value))

const optionalDateField = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .refine((value) => value === null || !Number.isNaN(Date.parse(value)), {
    message: 'Date invalide.',
  })
  .transform((value) => (value === null ? null : new Date(value)))

function collectFieldErrors(error: z.ZodError): FormState {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !fieldErrors[key]) fieldErrors[key] = issue.message
  }
  return { error: 'Certains champs doivent être corrigés.', fieldErrors }
}

/**
 * Numéro d'écriture comptable suivant, au format `ECR-2026-0042`.
 *
 * La séquence repart de zéro chaque année civile : c'est la convention la plus
 * courante en comptabilité associative, et elle garde les références lisibles.
 */
async function nextTransactionReference(organizationId: string): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `ECR-${year}-`

  const rows = await db.transaction.findMany({
    where: { organizationId, reference: { startsWith: prefix } },
    select: { reference: true },
  })

  const highest = rows.reduce((max, { reference }) => {
    const value = Number.parseInt(reference.slice(prefix.length), 10)
    return Number.isFinite(value) && value > max ? value : max
  }, 0)

  return `${prefix}${String(highest + 1).padStart(4, '0')}`
}

// ── Barèmes de cotisation ────────────────────────────────────

const feeSchema = z.object({
  name: z.string().trim().min(2, 'Le libellé est requis.').max(120),
  description: z
    .string()
    .trim()
    .max(500)
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  amountCents: moneyField,
  period: z.enum(FEE_PERIODS),
  categoryId: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  taxDeductible: z.boolean(),
  isFreeAmount: z.boolean(),
})

function readFeeForm(formData: FormData) {
  return {
    name: formData.get('name') ?? '',
    description: formData.get('description') ?? '',
    amountCents: formData.get('amountCents') ?? '',
    period: formData.get('period'),
    categoryId: formData.get('categoryId') ?? '',
    taxDeductible: formData.get('taxDeductible') === 'on',
    isFreeAmount: formData.get('isFreeAmount') === 'on',
  }
}

/** Une catégorie venue d'une autre association ne doit jamais être acceptée. */
async function resolveCategoryId(organizationId: string, categoryId: string | null) {
  if (!categoryId) return null
  const category = await db.memberCategory.findFirst({
    where: { id: categoryId, organizationId },
    select: { id: true },
  })
  return category?.id ?? null
}

export async function createFee(_prev: FormState, formData: FormData): Promise<FormState> {
  const org = String(formData.get('org') ?? '')
  const { organization, user } = await requirePermission(org, 'dues.write')

  const parsed = feeSchema.safeParse(readFeeForm(formData))
  if (!parsed.success) return collectFieldErrors(parsed.error)
  const data = parsed.data

  const fee = await db.fee.create({
    data: {
      organizationId: organization.id,
      name: data.name,
      description: data.description,
      amountCents: data.amountCents,
      period: data.period,
      categoryId: await resolveCategoryId(organization.id, data.categoryId),
      taxDeductible: data.taxDeductible,
      isFreeAmount: data.isFreeAmount,
    },
    select: { id: true, name: true },
  })

  await recordAudit({
    organizationId: organization.id,
    userId: user.id,
    action: 'Création',
    entityType: 'Barème',
    entityId: fee.id,
    changes: { name: fee.name, amountCents: data.amountCents },
  })

  revalidatePath(`/${org}/cotisations`)
  redirect(`/${org}/cotisations` as Route)
}

export async function updateFee(_prev: FormState, formData: FormData): Promise<FormState> {
  const org = String(formData.get('org') ?? '')
  const id = String(formData.get('id') ?? '')
  const { organization, user } = await requirePermission(org, 'dues.write')

  const existing = await db.fee.findFirst({ where: { id, organizationId: organization.id } })
  if (!existing) return { error: "Ce barème n'existe pas dans cette association." }

  const parsed = feeSchema.safeParse(readFeeForm(formData))
  if (!parsed.success) return collectFieldErrors(parsed.error)
  const data = parsed.data

  await db.fee.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      amountCents: data.amountCents,
      period: data.period,
      categoryId: await resolveCategoryId(organization.id, data.categoryId),
      taxDeductible: data.taxDeductible,
      isFreeAmount: data.isFreeAmount,
    },
  })

  await recordAudit({
    organizationId: organization.id,
    userId: user.id,
    action: 'Modification',
    entityType: 'Barème',
    entityId: id,
    changes: {
      name: { de: existing.name, vers: data.name },
      amountCents: { de: existing.amountCents, vers: data.amountCents },
    },
  })

  revalidatePath(`/${org}/cotisations`)
  redirect(`/${org}/cotisations` as Route)
}

/**
 * Archive un barème plutôt que de le supprimer : les appels de cotisation
 * déjà émis y font référence, et les faire pointer dans le vide fausserait
 * l'historique comptable.
 */
export async function archiveFee(_prev: FormState, formData: FormData): Promise<FormState> {
  const org = String(formData.get('org') ?? '')
  const id = String(formData.get('id') ?? '')
  const { organization, user } = await requirePermission(org, 'dues.write')

  const existing = await db.fee.findFirst({
    where: { id, organizationId: organization.id },
    select: { id: true, name: true },
  })
  if (!existing) return { error: "Ce barème n'existe pas dans cette association." }

  await db.fee.update({ where: { id }, data: { archivedAt: new Date() } })

  await recordAudit({
    organizationId: organization.id,
    userId: user.id,
    action: 'Archivage',
    entityType: 'Barème',
    entityId: id,
    changes: { name: existing.name },
  })

  revalidatePath(`/${org}/cotisations`)
  redirect(`/${org}/cotisations` as Route)
}

// ── Émission des appels de cotisation ────────────────────────

const emitSchema = z
  .object({
    label: z.string().trim().min(2, 'Le libellé est requis.').max(120),
    periodStart: dateField,
    periodEnd: dateField,
    dueDate: optionalDateField,
    // ALL : tous les adhérents actifs — CATEGORY : une seule catégorie
    target: z.enum(['ALL', 'CATEGORY']),
    targetCategoryId: z
      .string()
      .trim()
      .transform((v) => (v === '' ? null : v))
      .nullable(),
    // AUTO : le barème est déduit de la catégorie de chaque adhérent
    feeMode: z.enum(['AUTO', 'FIXED']),
    feeId: z
      .string()
      .trim()
      .transform((v) => (v === '' ? null : v))
      .nullable(),
    includeLapsed: z.boolean(),
  })
  .refine((d) => d.periodEnd >= d.periodStart, {
    message: 'La fin de période doit suivre son début.',
    path: ['periodEnd'],
  })
  .refine((d) => d.target !== 'CATEGORY' || d.targetCategoryId !== null, {
    message: 'Choisissez une catégorie.',
    path: ['targetCategoryId'],
  })
  .refine((d) => d.feeMode !== 'FIXED' || d.feeId !== null, {
    message: 'Choisissez un barème.',
    path: ['feeId'],
  })

/**
 * Émet en une fois les appels de cotisation d'une période.
 *
 * Deux garde-fous portent tout l'intérêt de cette action :
 *   - un adhérent qui a déjà un appel chevauchant la période est ignoré, ce
 *     qui rend l'opération rejouable sans jamais facturer deux fois ;
 *   - un adhérent sans barème applicable est ignoré plutôt que facturé zéro.
 * Le compte rendu final distingue explicitement ces deux cas.
 */
export async function emitDues(_prev: FormState, formData: FormData): Promise<FormState> {
  const org = String(formData.get('org') ?? '')
  const { organization, user } = await requirePermission(org, 'dues.write')

  const parsed = emitSchema.safeParse({
    label: formData.get('label') ?? '',
    periodStart: formData.get('periodStart') ?? '',
    periodEnd: formData.get('periodEnd') ?? '',
    dueDate: formData.get('dueDate') ?? '',
    target: formData.get('target'),
    targetCategoryId: formData.get('targetCategoryId') ?? '',
    feeMode: formData.get('feeMode'),
    feeId: formData.get('feeId') ?? '',
    includeLapsed: formData.get('includeLapsed') === 'on',
  })

  if (!parsed.success) return collectFieldErrors(parsed.error)
  const data = parsed.data

  // Un adhérent démissionnaire, radié ou décédé n'est jamais appelé.
  const statuses = data.includeLapsed ? ['ACTIVE', 'LAPSED', 'PENDING'] : ['ACTIVE', 'PENDING']

  const categoryId =
    data.target === 'CATEGORY'
      ? await resolveCategoryId(organization.id, data.targetCategoryId)
      : null

  if (data.target === 'CATEGORY' && !categoryId) {
    return { error: 'Catégorie introuvable.', fieldErrors: { targetCategoryId: 'Introuvable.' } }
  }

  const members = await db.member.findMany({
    where: {
      organizationId: organization.id,
      status: { in: statuses },
      leftAt: null,
      ...(categoryId ? { categoryId } : {}),
    },
    select: { id: true, categoryId: true },
  })

  if (members.length === 0) {
    return { error: 'Aucun adhérent ne correspond à ces critères.' }
  }

  // Un seul aller-retour pour connaître les appels déjà émis sur la période.
  const overlapping = await db.due.findMany({
    where: {
      organizationId: organization.id,
      status: { not: 'CANCELED' },
      periodStart: { lte: data.periodEnd },
      periodEnd: { gte: data.periodStart },
    },
    select: { memberId: true },
  })
  const alreadyBilled = new Set(overlapping.map((d) => d.memberId))

  // Barèmes applicables : soit celui imposé, soit un par catégorie.
  const fees = await db.fee.findMany({
    where: { organizationId: organization.id, archivedAt: null },
    select: { id: true, amountCents: true, categoryId: true },
  })

  const fixedFee = data.feeMode === 'FIXED' ? fees.find((f) => f.id === data.feeId) : undefined
  if (data.feeMode === 'FIXED' && !fixedFee) {
    return { error: 'Barème introuvable.', fieldErrors: { feeId: 'Introuvable.' } }
  }

  const feeByCategory = new Map(fees.filter((f) => f.categoryId).map((f) => [f.categoryId!, f]))

  const rows: {
    organizationId: string
    memberId: string
    feeId: string
    label: string
    amountCents: number
    periodStart: Date
    periodEnd: Date
    dueDate: Date | null
  }[] = []

  let skippedBilled = 0
  let skippedNoFee = 0

  for (const member of members) {
    if (alreadyBilled.has(member.id)) {
      skippedBilled++
      continue
    }

    const fee = fixedFee ?? (member.categoryId ? feeByCategory.get(member.categoryId) : undefined)
    if (!fee) {
      skippedNoFee++
      continue
    }

    rows.push({
      organizationId: organization.id,
      memberId: member.id,
      feeId: fee.id,
      label: data.label,
      amountCents: fee.amountCents,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      dueDate: data.dueDate,
    })
  }

  if (rows.length > 0) {
    await db.due.createMany({ data: rows })
  }

  await recordAudit({
    organizationId: organization.id,
    userId: user.id,
    action: 'Émission',
    entityType: 'Appels de cotisation',
    changes: {
      label: data.label,
      emis: rows.length,
      ignoresDejaAppeles: skippedBilled,
      ignoresSansBareme: skippedNoFee,
      total: formatMoneyShort(
        rows.reduce((sum, r) => sum + r.amountCents, 0),
        organization.currency,
      ),
    },
  })

  revalidatePath(`/${org}/cotisations`)

  const parts = [
    `${rows.length} appel${rows.length > 1 ? 's' : ''} émis`,
    `pour ${formatMoneyShort(
      rows.reduce((sum, r) => sum + r.amountCents, 0),
      organization.currency,
    )}`,
  ]
  if (skippedBilled > 0) parts.push(`${skippedBilled} déjà appelé${skippedBilled > 1 ? 's' : ''}`)
  if (skippedNoFee > 0) parts.push(`${skippedNoFee} sans barème applicable`)

  return { success: `${parts.join(', ')}.` }
}

// ── Règlements ───────────────────────────────────────────────

const paymentSchema = z.object({
  amountCents: moneyField.refine((cents) => cents > 0, { message: 'Le montant doit être positif.' }),
  date: dateField,
  method: z.enum(PAYMENT_METHODS),
  reference: z
    .string()
    .trim()
    .max(80)
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  bankAccountId: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  postEntry: z.boolean(),
})

/**
 * Enregistre un règlement sur un appel de cotisation.
 *
 * L'écriture comptable est explicitement demandée par l'utilisateur, jamais
 * générée en silence : produire des écritures à l'insu du trésorier fausserait
 * une comptabilité qu'il est seul à devoir maîtriser. Le rapprochement se fait
 * par numéro de compte du PCG (512 banque, 530 caisse, 756 cotisations).
 */
export async function recordPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const org = String(formData.get('org') ?? '')
  const dueId = String(formData.get('dueId') ?? '')
  const { organization, user } = await requirePermission(org, 'dues.write')

  const due = await db.due.findFirst({
    where: { id: dueId, organizationId: organization.id },
    select: {
      id: true,
      memberId: true,
      label: true,
      amountCents: true,
      paidCents: true,
      status: true,
    },
  })

  if (!due) return { error: "Cet appel de cotisation n'existe pas dans cette association." }
  if (due.status === 'PAID') return { error: 'Cet appel est déjà soldé.' }
  if (due.status === 'CANCELED') return { error: 'Cet appel a été annulé.' }

  const parsed = paymentSchema.safeParse({
    amountCents: formData.get('amountCents') ?? '',
    date: formData.get('date') ?? '',
    method: formData.get('method'),
    reference: formData.get('reference') ?? '',
    bankAccountId: formData.get('bankAccountId') ?? '',
    postEntry: formData.get('postEntry') === 'on',
  })

  if (!parsed.success) return collectFieldErrors(parsed.error)
  const data = parsed.data

  const remaining = due.amountCents - due.paidCents
  if (data.amountCents > remaining) {
    return {
      error: `Le montant dépasse le reste dû (${formatMoneyShort(remaining, organization.currency)}).`,
      fieldErrors: { amountCents: 'Supérieur au reste dû.' },
    }
  }

  const bankAccount = data.bankAccountId
    ? await db.bankAccount.findFirst({
        where: { id: data.bankAccountId, organizationId: organization.id },
        select: { id: true },
      })
    : null

  let transactionId: string | null = null
  let entryNote = ''

  if (data.postEntry) {
    // Les espèces vont en caisse (530), le reste en banque (512).
    const debitNumber = data.method === 'CASH' ? '530' : '512'

    const [debitAccount, creditAccount, fiscalYear] = await Promise.all([
      db.ledgerAccount.findFirst({
        where: { organizationId: organization.id, number: debitNumber },
        select: { id: true },
      }),
      db.ledgerAccount.findFirst({
        where: { organizationId: organization.id, number: '756' },
        select: { id: true },
      }),
      db.fiscalYear.findFirst({
        where: {
          organizationId: organization.id,
          status: 'OPEN',
          startDate: { lte: data.date },
          endDate: { gte: data.date },
        },
        select: { id: true },
      }),
    ])

    if (debitAccount && creditAccount) {
      const transaction = await db.transaction.create({
        data: {
          organizationId: organization.id,
          fiscalYearId: fiscalYear?.id ?? null,
          bankAccountId: bankAccount?.id ?? null,
          reference: await nextTransactionReference(organization.id),
          label: `${due.label} — règlement`,
          date: data.date,
          kind: 'INCOME',
          status: 'POSTED',
          totalCents: data.amountCents,
          lines: {
            create: [
              {
                accountId: debitAccount.id,
                label: 'Encaissement cotisation',
                debitCents: data.amountCents,
                position: 0,
              },
              {
                accountId: creditAccount.id,
                label: 'Cotisations',
                creditCents: data.amountCents,
                position: 1,
              },
            ],
          },
        },
        select: { id: true, reference: true },
      })

      transactionId = transaction.id
      entryNote = ` Écriture ${transaction.reference} passée.`
    } else {
      // On n'invente pas de compte : le règlement est enregistré, l'écriture non.
      entryNote =
        ` Aucune écriture passée : le compte ${debitNumber} ou 756 est absent du plan comptable.`
    }
  }

  const paidCents = due.paidCents + data.amountCents

  await db.$transaction([
    db.payment.create({
      data: {
        organizationId: organization.id,
        memberId: due.memberId,
        dueId: due.id,
        transactionId,
        bankAccountId: bankAccount?.id ?? null,
        amountCents: data.amountCents,
        date: data.date,
        method: data.method,
        status: 'COMPLETED',
        reference: data.reference,
      },
    }),
    db.due.update({
      where: { id: due.id },
      data: {
        paidCents,
        status: paidCents >= due.amountCents ? 'PAID' : 'PARTIAL',
      },
    }),
  ])

  await recordAudit({
    organizationId: organization.id,
    userId: user.id,
    action: 'Règlement',
    entityType: 'Cotisation',
    entityId: due.id,
    changes: {
      montant: formatMoneyShort(data.amountCents, organization.currency),
      moyen: data.method,
      ecriture: transactionId,
    },
  })

  revalidatePath(`/${org}/cotisations`)
  revalidatePath(`/${org}/adherents/${due.memberId}`)
  revalidatePath(`/${org}/finances`)

  return {
    success: `Règlement de ${formatMoneyShort(data.amountCents, organization.currency)} enregistré.${entryNote}`,
  }
}

/**
 * Exonère un adhérent de sa cotisation (membre d'honneur, situation
 * particulière). Le montant appelé reste visible, seul le statut change.
 */
export async function waiveDue(_prev: FormState, formData: FormData): Promise<FormState> {
  const org = String(formData.get('org') ?? '')
  const dueId = String(formData.get('dueId') ?? '')
  const reason = String(formData.get('reason') ?? '').trim()
  const { organization, user } = await requirePermission(org, 'dues.write')

  const due = await db.due.findFirst({
    where: { id: dueId, organizationId: organization.id },
    select: { id: true, memberId: true, status: true, notes: true },
  })

  if (!due) return { error: "Cet appel de cotisation n'existe pas dans cette association." }
  if (due.status === 'PAID') return { error: 'Un appel déjà réglé ne peut pas être exonéré.' }

  await db.due.update({
    where: { id: dueId },
    data: {
      status: 'WAIVED',
      notes: reason === '' ? due.notes : reason,
    },
  })

  await recordAudit({
    organizationId: organization.id,
    userId: user.id,
    action: 'Exonération',
    entityType: 'Cotisation',
    entityId: dueId,
    changes: { de: due.status, vers: 'WAIVED', motif: reason || null },
  })

  revalidatePath(`/${org}/cotisations`)
  revalidatePath(`/${org}/adherents/${due.memberId}`)
  redirect(`/${org}/cotisations` as Route)
}

// ── Relances ─────────────────────────────────────────────────

/**
 * Envoie une relance à chaque adhérent dont la cotisation reste due.
 *
 * Trois précautions :
 *   - `remindersSent` n'est incrémenté que pour les envois **réussis** ; sinon
 *     le compteur mentirait et masquerait les adhérents jamais joints ;
 *   - les adhérents sans adresse e-mail sont comptés à part, pas silencieux —
 *     ce sont eux qu'il faudra relancer par courrier ou par téléphone ;
 *   - l'envoi est séquentiel (voir `sendBatch`). Au-delà de quelques centaines
 *     d'adhérents, il faudra sortir cette tâche de la requête HTTP.
 */
export async function sendDueReminders(_prev: FormState, formData: FormData): Promise<FormState> {
  const org = String(formData.get('org') ?? '')
  const overdueOnly = formData.get('overdueOnly') === 'on'
  const { organization, user } = await requirePermission(org, 'dues.write')

  const dues = await db.due.findMany({
    where: {
      organizationId: organization.id,
      status: { in: ['PENDING', 'PARTIAL'] },
      ...(overdueOnly ? { dueDate: { lt: new Date() } } : {}),
    },
    select: {
      id: true,
      label: true,
      amountCents: true,
      paidCents: true,
      dueDate: true,
      remindersSent: true,
      member: {
        select: {
          id: true,
          kind: true,
          firstName: true,
          lastName: true,
          legalName: true,
          email: true,
          status: true,
        },
      },
    },
  })

  if (dues.length === 0) {
    return { error: 'Aucune cotisation à relancer.' }
  }

  const contactEmail = await db.organization.findUnique({
    where: { id: organization.id },
    select: { email: true },
  })

  const sendable = dues.filter((due) => due.member.email)
  const withoutEmail = dues.length - sendable.length

  const mails = sendable.map((due) => {
    const rendered = dueReminderEmail({
      organizationName: organization.name,
      memberName: memberDisplayName(due.member),
      label: due.label,
      remainingCents: due.amountCents - due.paidCents,
      currency: organization.currency,
      dueDate: due.dueDate,
      reminderCount: due.remindersSent,
      contactEmail: contactEmail?.email ?? null,
    })

    return {
      to: due.member.email!,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      ...(contactEmail?.email ? { replyTo: contactEmail.email } : {}),
    }
  })

  const { sent, failures } = await sendBatch(mails)

  // Seuls les destinataires effectivement joints voient leur compteur avancer.
  const failedAddresses = new Set(failures.map((f) => f.to))
  const succeededIds = sendable
    .filter((due) => !failedAddresses.has(due.member.email!))
    .map((due) => due.id)

  if (succeededIds.length > 0) {
    await db.due.updateMany({
      where: { id: { in: succeededIds } },
      data: { remindersSent: { increment: 1 }, lastReminderAt: new Date() },
    })
  }

  await recordAudit({
    organizationId: organization.id,
    userId: user.id,
    action: 'Relance',
    entityType: 'Cotisations',
    changes: { envoyees: sent, echecs: failures.length, sansEmail: withoutEmail },
  })

  revalidatePath(`/${org}/cotisations`)

  const parts = [`${sent} relance${sent > 1 ? 's' : ''} envoyée${sent > 1 ? 's' : ''}`]
  if (withoutEmail > 0) parts.push(`${withoutEmail} sans adresse e-mail`)
  if (failures.length > 0) parts.push(`${failures.length} en échec`)

  const notice = isEmailConfigured()
    ? ''
    : " Aucun fournisseur n'est configuré : les messages ont été écrits dans le terminal, pas envoyés."

  return { success: `${parts.join(', ')}.${notice}` }
}
