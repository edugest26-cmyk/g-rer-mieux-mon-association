import Link from 'next/link'

/**
 * Page 403, rendue quand `forbidden()` est appelé — typiquement par
 * `requirePermission()` lorsque le rôle de l'utilisateur ne couvre pas
 * l'action demandée. Elle nomme la cause, pour éviter le classique
 * « ça ne marche pas » remonté au support.
 */
export default function Forbidden() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold text-brand">Accès refusé</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
          Votre rôle ne permet pas d&apos;ouvrir cette page
        </h1>
        <p className="mt-3 text-ink-soft">
          Cette rubrique est réservée à certains rôles au sein de l&apos;association. Demandez à un
          administrateur de vous accorder les droits nécessaires.
        </p>
        <Link
          href="/associations"
          className="mt-6 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-ink hover:bg-brand-dark"
        >
          Revenir à mes associations
        </Link>
      </div>
    </div>
  )
}
