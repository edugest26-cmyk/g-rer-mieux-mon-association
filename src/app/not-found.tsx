import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold text-brand">Introuvable</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
          Cette page n&apos;existe pas
        </h1>
        <p className="mt-3 text-ink-soft">
          Le lien est peut-être périmé, ou l&apos;élément a été supprimé.
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
