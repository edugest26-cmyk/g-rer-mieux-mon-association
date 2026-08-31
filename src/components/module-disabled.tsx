import Link from 'next/link'

import { Card, EmptyState, PageHeader } from '@/components/ui'
import { MODULES, type ModuleKey } from '@/lib/modules'

/**
 * Écran affiché quand une rubrique n'est pas activée pour l'association.
 *
 * On le dit plutôt que de renvoyer un 404 : la page existe, c'est un choix de
 * configuration. Et on donne le moyen d'y remédier à qui en a le droit, au
 * lieu de laisser l'utilisateur chercher où cliquer.
 */
export function ModuleDisabled({
  moduleKey,
  org,
  canManage,
}: {
  moduleKey: ModuleKey
  org: string
  canManage: boolean
}) {
  const rubrique = MODULES.find((m) => m.key === moduleKey)
  const label = rubrique?.label ?? moduleKey

  return (
    <>
      <PageHeader title={label} />

      <Card>
        <EmptyState
          title={`La rubrique « ${label} » n'est pas activée`}
          description={
            rubrique?.description
              ? `${rubrique.description} Activez-la si votre association en a l'usage — rien n'est perdu entre-temps.`
              : "Activez cette rubrique si votre association en a l'usage."
          }
          action={
            canManage ? (
              <Link
                href={`/${org}/parametres`}
                className="inline-flex items-center rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-brand-ink hover:bg-brand-dark"
              >
                Ouvrir les réglages
              </Link>
            ) : (
              <p className="text-sm text-ink-faint">
                Demandez à un administrateur de l&apos;activer.
              </p>
            )
          }
        />
      </Card>
    </>
  )
}
