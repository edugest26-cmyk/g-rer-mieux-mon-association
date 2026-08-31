import type { Metadata } from 'next'

import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'GERMA — Gérer Mieux Mon Association',
    template: '%s · GERMA',
  },
  description:
    'Adhérents, cotisations, comptabilité, événements et gouvernance : la gestion complète de votre association, en un seul outil. Une association bien gérée, un avenir meilleur.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="fr" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  )
}
