import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Proxy (ex-Middleware, renommé dans Next.js 16).
 *
 * Il ne fait qu'un contrôle *optimiste* : présence du cookie de session, pour
 * éviter d'afficher un squelette d'application à un visiteur non connecté.
 * La véritable autorisation — session valide, appartenance à l'association,
 * permissions — est faite dans la DAL (`src/lib/auth/dal.ts`), au plus près
 * des données. Le proxy ne touche jamais la base : il s'exécute sur chaque
 * requête et doit rester quasi instantané.
 */

const SESSION_COOKIE = 'germa_session'

/** Routes accessibles sans être connecté. */
const PUBLIC_PATHS = [
  '/',
  '/connexion',
  '/inscription',
  '/mot-de-passe-oublie',
  // Atteinte depuis un lien e-mail : l'utilisateur n'est par définition pas connecté.
  '/reinitialiser',
]

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true
  // Pages publiques d'une association : billetterie et formulaire d'adhésion
  return pathname.startsWith('/public/')
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value)

  if (!hasSession && !isPublic(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/connexion'
    // Mémorise la page demandée pour y revenir après connexion
    url.searchParams.set('suite', pathname)
    return NextResponse.redirect(url)
  }

  // Le proxy ne renvoie délibérément PAS un visiteur porteur d'un cookie hors
  // de /connexion : il ne sait pas si ce cookie est encore valide. Un cookie
  // expiré ou révoqué provoquerait alors une boucle infinie — le proxy
  // renvoyant vers /associations, que la DAL renverrait aussitôt vers
  // /connexion. Cette redirection est faite par la page de connexion
  // elle-même, qui, elle, vérifie vraiment la session.

  return NextResponse.next()
}

export const config = {
  /**
   * Exclut les assets et les routes internes : les faire transiter par le
   * proxy coûterait un aller-retour par image sans rien apporter.
   */
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
