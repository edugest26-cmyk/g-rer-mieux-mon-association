/**
 * Modules activables.
 *
 * Une association de trente adhérents n'a que faire d'un plan comptable ni d'un
 * calcul de quorum. Chaque structure choisit ses rubriques ; les autres
 * disparaissent de la navigation *et* deviennent inaccessibles — masquer un
 * lien sans fermer la page ne serait qu'un trompe-l'œil.
 *
 * Le choix est stocké dans `Organization.enabledModules`, en JSON.
 */

export const MODULES = [
  {
    key: 'members',
    label: 'Adhérents',
    description: 'Fichier des adhérents, catégories, coordonnées et consentements RGPD.',
    /** Le fichier des adhérents ne se désactive pas : c'est l'objet même de l'outil. */
    core: true,
  },
  {
    key: 'dues',
    label: 'Cotisations',
    description: 'Barèmes, appels de cotisation, règlements et relances.',
    core: false,
  },
  {
    key: 'finance',
    label: 'Comptabilité',
    description: 'Plan comptable, écritures, budget, dons et reçus fiscaux.',
    core: false,
  },
  {
    key: 'events',
    label: 'Événements',
    description: 'Agenda, inscriptions, billetterie et réservation de salles.',
    core: false,
  },
  {
    key: 'governance',
    label: 'Gouvernance',
    description: 'Assemblées, présences et pouvoirs, résolutions, votes et mandats.',
    core: false,
  },
  {
    key: 'documents',
    label: 'Documents',
    description: 'Statuts, procès-verbaux et pièces justificatives, classés par dossier.',
    core: false,
  },
] as const

export type ModuleKey = (typeof MODULES)[number]['key']

export const MODULE_KEYS = MODULES.map((m) => m.key) as readonly ModuleKey[]

/** Sélection proposée par défaut à la création : le strict nécessaire. */
export const DEFAULT_MODULES: ModuleKey[] = ['members', 'dues']

export function moduleLabel(key: ModuleKey): string {
  return MODULES.find((m) => m.key === key)?.label ?? key
}

/**
 * Lit la sélection stockée.
 *
 * Une clé **absente** vaut activée : les associations créées avant l'arrivée
 * d'un module continuent ainsi de le voir, plutôt que de le perdre du jour au
 * lendemain. Seul un `false` explicite désactive.
 */
export function parseModules(json: string | null | undefined): Set<ModuleKey> {
  let stored: Record<string, unknown> = {}

  if (json) {
    try {
      const parsed: unknown = JSON.parse(json)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        stored = parsed as Record<string, unknown>
      }
    } catch {
      // JSON illisible : on n'ampute pas l'association de ses rubriques.
    }
  }

  const enabled = new Set<ModuleKey>()

  for (const rubrique of MODULES) {
    if (rubrique.core || stored[rubrique.key] !== false) {
      enabled.add(rubrique.key)
    }
  }

  return enabled
}

/** Sérialise la sélection en écrivant explicitement chaque clé. */
export function serializeModules(keys: Iterable<ModuleKey>): string {
  const selected = new Set(keys)
  const record: Record<string, boolean> = {}

  for (const rubrique of MODULES) {
    record[rubrique.key] = rubrique.core || selected.has(rubrique.key)
  }

  return JSON.stringify(record)
}
