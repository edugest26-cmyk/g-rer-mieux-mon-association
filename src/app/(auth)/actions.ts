'use server'

import { createHash, randomBytes } from 'node:crypto'

import type { Route } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { z } from 'zod'

import { hashPassword, checkPasswordStrength, verifyPassword } from '@/lib/auth/password'
import { createSession, destroySession, setActiveOrganization } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email/send'
import { passwordResetEmail } from '@/lib/email/templates'
import { slugify } from '@/lib/format'

export type FormState = {
  error?: string
  fieldErrors?: Record<string, string>
  /** Compte rendu affiché après une opération réussie qui ne redirige pas. */
  success?: string
} | null

const loginSchema = z.object({
  email: z.string().email('Adresse e-mail invalide.'),
  password: z.string().min(1, 'Mot de passe requis.'),
  suite: z.string().optional(),
})

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    suite: formData.get('suite') ?? undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Formulaire invalide.' }
  }

  const { email, password, suite } = parsed.data

  const user = await db.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, passwordHash: true, disabledAt: true },
  })

  // Message volontairement identique dans les deux cas : distinguer
  // « compte inconnu » de « mot de passe faux » permettrait d'énumérer
  // les adresses inscrites.
  const invalid = { error: 'Adresse e-mail ou mot de passe incorrect.' }

  if (!user?.passwordHash) {
    // Comparaison factice pour que la réponse prenne le même temps
    // qu'un échec de mot de passe, et ne trahisse pas l'absence de compte.
    await verifyPassword(password, '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva')
    return invalid
  }

  if (user.disabledAt) {
    return { error: 'Ce compte a été désactivé. Contactez un administrateur.' }
  }

  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) return invalid

  const headerList = await headers()
  await createSession(user.id, {
    ipAddress: headerList.get('x-forwarded-for'),
    userAgent: headerList.get('user-agent'),
  })

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

  // `suite` vient de l'URL : on n'accepte qu'un chemin interne, jamais une URL
  // absolue, sous peine d'offrir une redirection ouverte vers un site tiers.
  const target = suite && suite.startsWith('/') && !suite.startsWith('//') ? suite : '/associations'
  redirect(target as Route)
}

const registerSchema = z.object({
  firstName: z.string().min(1, 'Prénom requis.').max(80),
  lastName: z.string().min(1, 'Nom requis.').max(80),
  email: z.string().email('Adresse e-mail invalide.'),
  password: z.string(),
  organizationName: z.string().min(2, "Nom de l'association requis.").max(120),
})

export async function register(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: formData.get('email'),
    password: formData.get('password'),
    organizationName: formData.get('organizationName'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Formulaire invalide.' }
  }

  const { firstName, lastName, organizationName } = parsed.data
  const email = parsed.data.email.toLowerCase().trim()

  const weakness = checkPasswordStrength(parsed.data.password)
  if (weakness) return { error: weakness }

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) {
    return { error: 'Un compte existe déjà avec cette adresse e-mail.' }
  }

  // Le slug sert d'URL : on le rend unique en le suffixant si nécessaire.
  const base = slugify(organizationName) || 'association'
  let slug = base
  for (let attempt = 2; await db.organization.findUnique({ where: { slug }, select: { id: true } }); attempt++) {
    slug = `${base}-${attempt}`
  }

  const passwordHash = await hashPassword(parsed.data.password)

  const user = await db.user.create({
    data: {
      email,
      firstName,
      lastName,
      passwordHash,
      memberships: {
        create: {
          role: 'OWNER',
          isDefault: true,
          organization: {
            create: {
              slug,
              name: organizationName,
              enabledModules: JSON.stringify({
                members: true,
                finance: true,
                events: true,
                governance: true,
                documents: true,
              }),
              subscription: {
                create: {
                  plan: 'FREE',
                  status: 'TRIALING',
                  trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                },
              },
              // Dossiers de GED attendus dans toute association
              documentFolders: {
                create: [
                  { name: 'Statuts et règlement', isSystem: true, position: 0 },
                  { name: 'Procès-verbaux', isSystem: true, position: 1 },
                  { name: 'Comptabilité', isSystem: true, position: 2 },
                ],
              },
            },
          },
        },
      },
    },
    select: { id: true },
  })

  const headerList = await headers()
  await createSession(user.id, {
    ipAddress: headerList.get('x-forwarded-for'),
    userAgent: headerList.get('user-agent'),
  })
  await setActiveOrganization(slug)

  redirect(`/${slug}/tableau-de-bord`)
}

export async function logout(): Promise<void> {
  await destroySession()
  redirect('/connexion')
}

// ── Réinitialisation de mot de passe ─────────────────────────

const RESET_TTL_MINUTES = 30

function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Demande de réinitialisation.
 *
 * La réponse est **identique** que l'adresse existe ou non : distinguer les
 * deux cas transformerait ce formulaire en outil d'énumération des comptes.
 * Le jeton n'est stocké que sous forme de SHA-256, comme les sessions : une
 * fuite de la base ne permet donc pas de forger un lien valide.
 */
export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsedEmail = z
    .string()
    .email('Adresse e-mail invalide.')
    .safeParse(formData.get('email'))

  if (!parsedEmail.success) {
    return { error: parsedEmail.error.issues[0]?.message ?? 'Adresse invalide.' }
  }

  const email = parsedEmail.data.toLowerCase().trim()

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, firstName: true, disabledAt: true },
  })

  if (user && !user.disabledAt) {
    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000)

    // Les demandes précédentes encore valides sont neutralisées : plusieurs
    // liens actifs simultanément multiplieraient les fenêtres d'attaque.
    await db.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    })

    await db.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashResetToken(token), expiresAt },
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const rendered = passwordResetEmail({
      firstName: user.firstName,
      resetUrl: `${baseUrl}/reinitialiser?jeton=${token}`,
      expiresInMinutes: RESET_TTL_MINUTES,
    })

    await sendEmail({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    })
  }

  return {
    success:
      'Si un compte existe pour cette adresse, un lien de réinitialisation vient d’y être envoyé.',
  }
}

const resetSchema = z
  .object({
    token: z.string().min(1, 'Lien invalide.'),
    password: z.string(),
    confirmation: z.string(),
  })
  .refine((d) => d.password === d.confirmation, {
    message: 'Les deux mots de passe diffèrent.',
    path: ['confirmation'],
  })

/**
 * Applique le nouveau mot de passe.
 *
 * Toutes les sessions de l'utilisateur sont révoquées au passage : si le compte
 * a été compromis, changer le mot de passe sans déconnecter l'intrus ne
 * servirait à rien.
 */
export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse({
    token: formData.get('token') ?? '',
    password: formData.get('password') ?? '',
    confirmation: formData.get('confirmation') ?? '',
  })

  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return {
      error: issue?.message ?? 'Formulaire invalide.',
      fieldErrors: issue?.path[0] === 'confirmation' ? { confirmation: issue.message } : undefined,
    }
  }

  const weakness = checkPasswordStrength(parsed.data.password)
  if (weakness) return { error: weakness, fieldErrors: { password: weakness } }

  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(parsed.data.token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  })

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return {
      error: 'Ce lien est expiré ou a déjà été utilisé. Demandez-en un nouveau.',
    }
  }

  const passwordHash = await hashPassword(parsed.data.password)

  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    db.session.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ])

  redirect('/connexion?reinitialise=1')
}
