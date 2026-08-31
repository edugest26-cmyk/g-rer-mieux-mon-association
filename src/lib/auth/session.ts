import 'server-only'

import { createHash, randomBytes } from 'node:crypto'

import { cookies } from 'next/headers'

import { db } from '@/lib/db'

export const SESSION_COOKIE = 'germa_session'
/** Cookie mémorisant la dernière association consultée, pour y revenir au login. */
export const ACTIVE_ORG_COOKIE = 'germa_org'

const SESSION_TTL_DAYS = 30

/**
 * Les sessions sont opaques et stockées en base : le cookie ne porte qu'un
 * secret aléatoire, dont seul le SHA-256 est conservé côté serveur. Une fuite
 * de la base ne permet donc pas de rejouer une session, et une session peut
 * être révoquée immédiatement — ce qu'un JWT autoporteur ne permet pas.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export type SessionUser = {
  id: string
  email: string
  firstName: string
  lastName: string
  avatarUrl: string | null
  isSuperAdmin: boolean
}

/** Crée la session en base et pose le cookie. */
export async function createSession(
  userId: string,
  meta: { ipAddress?: string | null; userAgent?: string | null } = {},
): Promise<void> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)

  await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
    },
  })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
}

/**
 * Relit la session courante. Renvoie `null` si le cookie est absent,
 * inconnu, révoqué ou expiré.
 */
export async function readSession(): Promise<{ sessionId: string; user: SessionUser } | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      revokedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          isSuperAdmin: true,
          disabledAt: true,
        },
      },
    },
  })

  if (!session) return null
  if (session.revokedAt) return null
  if (session.expiresAt.getTime() < Date.now()) return null
  if (session.user.disabledAt) return null

  // On recompose explicitement l'objet exposé plutôt que de propager la ligne
  // utilisateur : seuls ces champs doivent circuler jusqu'aux composants.
  return {
    sessionId: session.id,
    user: {
      id: session.user.id,
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      avatarUrl: session.user.avatarUrl,
      isSuperAdmin: session.user.isSuperAdmin,
    },
  }
}

/** Révoque la session courante et efface le cookie. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (token) {
    // `updateMany` plutôt que `update` : ne lève pas si le jeton est inconnu.
    await db.session.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  cookieStore.delete(SESSION_COOKIE)
}

/** Mémorise l'association active (multi-association pour un même compte). */
export async function setActiveOrganization(slug: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_ORG_COOKIE, slug, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
}

export async function getActiveOrganizationSlug(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(ACTIVE_ORG_COOKIE)?.value ?? null
}
