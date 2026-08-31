import Link from 'next/link'

import { Logo } from '@/components/logo'

const MODULES = [
  {
    title: 'Adhérents et cotisations',
    body: "Fichier complet, catégories, barèmes, appels de cotisation, relances et suivi des règlements. Personnes physiques comme personnes morales.",
  },
  {
    title: 'Comptabilité',
    body: 'Plan comptable associatif, écritures en partie double, budget prévisionnel comparé au réalisé, dons et reçus fiscaux Cerfa.',
  },
  {
    title: 'Événements et billetterie',
    body: 'Agenda, inscriptions avec jauge et liste d’attente, tarifs adhérent, pointage des présences, réservation des salles et du matériel.',
  },
  {
    title: 'Gouvernance',
    body: 'Convocations, feuille de présence, pouvoirs, calcul du quorum, résolutions soumises au vote selon la règle de majorité, procès-verbaux.',
  },
  {
    title: 'Documents',
    body: 'Statuts, règlement intérieur, PV et attestations classés par dossier, avec visibilité par rôle et alertes d’échéance.',
  },
  {
    title: 'Rôles et permissions',
    body: 'Président, trésorier, secrétaire, responsable d’activité : chacun ne voit que ce qui le concerne, avec des permissions ajustables.',
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" aria-label="GERMA, accueil">
            <Logo width={132} variant="mark" priority />
          </Link>

          <nav className="flex items-center gap-2">
            <Link
              href="/connexion"
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-ink-soft hover:bg-surface-muted hover:text-ink"
            >
              Se connecter
            </Link>
            <Link
              href="/inscription"
              className="rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-brand-ink hover:bg-brand-dark"
            >
              Créer une association
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-5xl px-4 py-16 md:py-24">
          <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-ink md:text-4xl">
            Gérer mieux mon association
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-soft">
            Adhérents, cotisations, comptabilité, événements, assemblées générales et documents,
            réunis au même endroit. Sans tableur éparpillé ni classeur perdu au fond d&apos;un
            placard.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/inscription"
              className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-brand-ink hover:bg-brand-dark"
            >
              Commencer gratuitement
            </Link>
            <Link
              href="/connexion"
              className="rounded-lg border border-line-strong bg-surface px-5 py-2.5 text-sm font-medium text-ink hover:bg-surface-muted"
            >
              J&apos;ai déjà un compte
            </Link>
          </div>

          <p className="mt-4 text-sm text-ink-faint">
            Un mois d&apos;essai, sans carte bancaire. Convient aux associations loi 1901, clubs,
            ONG, syndicats et fondations.
          </p>
        </section>

        <section className="border-t border-line bg-surface">
          <div className="mx-auto max-w-5xl px-4 py-16">
            <h2 className="text-xl font-semibold tracking-tight text-ink">
              Tous les modules, dès le départ
            </h2>
            <p className="mt-2 max-w-2xl text-ink-soft">
              Chaque association active ce dont elle a besoin. Les rubriques inutiles disparaissent
              simplement de la navigation.
            </p>

            <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
              {MODULES.map((module) => (
                <div key={module.title} className="bg-surface px-5 py-5">
                  <h3 className="font-medium text-ink">{module.title}</h3>
                  <p className="mt-1.5 text-sm text-ink-soft">{module.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-16">
          <div className="card px-6 py-8 md:px-10 md:py-10">
            <h2 className="text-xl font-semibold tracking-tight text-ink">
              Vos données restent les vôtres
            </h2>
            <p className="mt-2 max-w-2xl text-ink-soft">
              Chaque association est strictement cloisonnée : aucune donnée ne circule d&apos;une
              structure à l&apos;autre. Consentements RGPD, droit à l&apos;image et journal
              d&apos;activité sont suivis pour chaque adhérent.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-6">
          <Logo width={110} variant="mark" />
          <p className="text-sm text-ink-faint">
            Une association bien gérée, un avenir meilleur.
          </p>
        </div>
      </footer>
    </div>
  )
}
