'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useRef, useTransition } from 'react'

import { Input, Select } from '@/components/ui'
import { MEMBER_STATUS_LABELS, MEMBER_STATUSES } from '@/lib/enums'

/**
 * Filtres du fichier adhérents.
 *
 * L'état vit dans l'URL plutôt que dans le composant : une recherche reste
 * ainsi partageable, retrouvable dans l'historique, et le rendu serveur peut
 * refaire la requête sans état client à réhydrater.
 */
export function MemberFilters({
  categories,
}: {
  categories: { id: string; name: string }[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const debounce = useRef<number | undefined>(undefined)

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())

    if (value) params.set(key, value)
    else params.delete(key)

    // Tout changement de filtre renvoie à la première page : rester en page 4
    // d'un résultat qui n'en compte plus qu'une afficherait une liste vide.
    params.delete('page')

    startTransition(() => {
      router.push(`?${params.toString()}`)
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-pending={pending ? '' : undefined}>
      <Input
        type="search"
        name="q"
        placeholder="Nom, e-mail, n° d'adhérent…"
        defaultValue={searchParams.get('q') ?? ''}
        className="w-56"
        onChange={(event) => {
          const value = event.target.value
          // Laisse le temps de finir de taper avant de relancer la requête
          window.clearTimeout(debounce.current)
          debounce.current = window.setTimeout(() => update('q', value), 350)
        }}
      />

      <Select
        defaultValue={searchParams.get('statut') ?? ''}
        onChange={(event) => update('statut', event.target.value)}
        className="w-auto"
        aria-label="Filtrer par statut"
      >
        <option value="">Tous les statuts</option>
        {MEMBER_STATUSES.map((status) => (
          <option key={status} value={status}>
            {MEMBER_STATUS_LABELS[status]}
          </option>
        ))}
      </Select>

      <Select
        defaultValue={searchParams.get('categorie') ?? ''}
        onChange={(event) => update('categorie', event.target.value)}
        className="w-auto"
        aria-label="Filtrer par catégorie"
      >
        <option value="">Toutes les catégories</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </Select>
    </div>
  )
}
