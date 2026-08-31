import 'server-only'

import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '@/generated/prisma/client'

/**
 * Client Prisma partagé.
 *
 * Depuis Prisma 7 la connexion passe obligatoirement par un *driver adapter*.
 *
 * En production l'application vise le **pooler** de la base (Supabase : port
 * 6543) et non la connexion directe : chaque fonction serverless ouvre sa
 * propre connexion, et PostgreSQL en épuiserait vite le quota sans pooling.
 * Les migrations, elles, exigent la connexion directe — voir prisma.config.ts.
 *
 * En développement, Next.js recharge les modules à chaque édition ; sans le
 * cache sur `globalThis` chaque rechargement ouvrirait un nouveau pool
 * jusqu'à saturer la base.
 */
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL n'est pas définie. Copiez .env.example vers .env avant de démarrer.",
    )
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
