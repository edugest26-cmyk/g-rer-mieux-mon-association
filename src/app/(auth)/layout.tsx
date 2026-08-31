import Link from 'next/link'

import { Logo } from '@/components/logo'

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-8" aria-label="GERMA, accueil">
        <Logo width={240} priority />
      </Link>

      <div className="w-full max-w-md">{children}</div>

      <p className="mt-8 text-center text-xs text-ink-faint">
        Adhérents, comptabilité, événements, gouvernance.
      </p>
    </div>
  )
}
