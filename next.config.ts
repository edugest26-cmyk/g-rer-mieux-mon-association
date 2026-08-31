import path from 'node:path'

import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    // Active `forbidden()` / `unauthorized()` et les pages 403/401 associées.
    // Sans ce drapeau, un refus de permission ne peut être signalé qu'en 404,
    // ce qui rend le RBAC illisible pour l'utilisateur comme pour le support.
    authInterrupts: true,
  },
  turbopack: {
    // Ancre la racine au projet : un package-lock.json présent plus haut dans
    // l'arborescence utilisateur ferait autrement remonter Turbopack trop loin.
    root: path.resolve(import.meta.dirname),
  },
  // Vérifie les `href` à la compilation. Les littéraux gabarits construits
  // à partir du slug (`/${org}/adherents`) sont validés tels quels ; seules
  // les chaînes non littérales demandent un cast `as Route`.
  typedRoutes: true,
}

export default nextConfig
