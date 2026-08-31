import Image from 'next/image'

import { cn } from '@/components/ui'

/** Dimensions natives du fichier fourni. */
const NATIVE_WIDTH = 1067
const NATIVE_HEIGHT = 368

/**
 * Part de la hauteur occupée par le mot « GERMA » seul, bandeau
 * « Gérer Mieux Mon Association » et slogan exclus.
 *
 * Valeur relevée sur l'image : le mot s'achève à y=233 et le bandeau reprend
 * à y=239 ; on coupe au milieu de cette séparation noire (236/368) pour ne
 * mordre ni sur les lettres ni sur le bandeau.
 */
const WORDMARK_RATIO = 236 / NATIVE_HEIGHT

/**
 * Logo GERMA.
 *
 * Le fichier fourni est un JPEG à fond noir opaque : on le pose donc sur une
 * plaque noire, dont le raccord est invisible, plutôt que de le laisser
 * découper un rectangle sombre au milieu d'une interface claire. Fournir un
 * PNG détouré permettrait de retirer la plaque.
 *
 * La variante `mark` recadre sur le seul mot « GERMA » : en dessous d'environ
 * 200 px de large, le slogan n'est plus lisible et ne fait qu'ajouter du bruit.
 */
export function Logo({
  width = 200,
  variant = 'full',
  className,
  priority = false,
}: {
  width?: number
  variant?: 'full' | 'mark'
  className?: string
  priority?: boolean
}) {
  const imageHeight = (width * NATIVE_HEIGHT) / NATIVE_WIDTH
  const boxHeight = variant === 'mark' ? imageHeight * WORDMARK_RATIO : imageHeight

  return (
    <span
      className={cn('logo-plaque inline-block overflow-hidden rounded-lg bg-black', className)}
      style={{ width, height: boxHeight }}
    >
      <Image
        src="/germa-logo.jpg"
        alt="GERMA — Gérer Mieux Mon Association"
        width={NATIVE_WIDTH}
        height={NATIVE_HEIGHT}
        priority={priority}
        // Le fichier pèse 44 Ko et vient de /public : le passer par
        // l'optimiseur d'images n'apporterait rien et ajouterait une
        // dépendance à `sharp` en production.
        unoptimized
        className="block"
        style={{ width, height: imageHeight }}
      />
    </span>
  )
}
