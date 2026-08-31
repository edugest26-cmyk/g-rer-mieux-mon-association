import path from 'node:path'
import process from 'node:process'

import { defineConfig } from 'prisma/config'

// Prisma 7 ne charge plus `.env` tout seul. Node sait le faire nativement
// depuis la 20.12 ; on ignore l'absence du fichier (CI, conteneur, prod)
// où les variables sont déjà présentes dans l'environnement.
try {
  process.loadEnvFile('.env')
} catch {
  // pas de fichier .env : les variables viennent de l'environnement
}

/**
 * Le schéma est éclaté en un fichier par module (`prisma/schema/*.prisma`) :
 * le socle multi-tenant d'un côté, chaque module métier de l'autre. Prisma
 * parcourt le dossier récursivement et recompose un schéma unique.
 *
 * Migrate exige une connexion **directe** à PostgreSQL : elle pose des verrous
 * de session et crée une base fantôme, deux choses qu'un pooler en mode
 * transaction (Supabase, port 6543) ne sait pas relayer. On privilégie donc
 * `DIRECT_URL` ici, tandis que l'application utilise `DATABASE_URL` — qui
 * pointe, elle, sur le pooler. En développement local les deux se confondent.
 */
const migrationUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL

if (!migrationUrl) {
  throw new Error(
    'Ni DIRECT_URL ni DATABASE_URL ne sont définies : impossible de joindre la base.',
  )
}

export default defineConfig({
  schema: path.join('prisma', 'schema'),
  datasource: {
    url: migrationUrl,
  },
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
})
