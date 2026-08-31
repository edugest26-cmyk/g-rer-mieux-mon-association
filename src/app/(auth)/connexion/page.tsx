import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { Alert, Card } from '@/components/ui'
import { getSession } from '@/lib/auth/dal'

import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Connexion' }

export default async function LoginPage(props: PageProps<'/connexion'>) {
  // Vérification réelle de la session — contrairement au proxy, qui ne voit
  // que la présence du cookie. Un cookie périmé aboutit donc au formulaire,
  // et non à une boucle de redirection.
  if (await getSession()) {
    redirect('/associations')
  }

  const searchParams = await props.searchParams
  // `//exemple.com` est un chemin protocole-relatif : l'écarter évite de
  // transformer le paramètre `suite` en redirection ouverte.
  const raw = searchParams.suite
  const suite =
    typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') ? raw : undefined

  return (
    <Card className="px-6 py-7">
      <h1 className="text-lg font-semibold tracking-tight text-ink">Connexion</h1>
      <p className="mt-1 mb-6 text-sm text-ink-soft">
        Accédez à la gestion de votre association.
      </p>

      {searchParams.reinitialise === '1' ? (
        <div className="mb-4">
          <Alert tone="positive">
            Mot de passe enregistré. Connectez-vous avec vos nouveaux identifiants.
          </Alert>
        </div>
      ) : null}

      <LoginForm suite={suite} />

      <p className="mt-4 text-center text-sm">
        <Link href="/mot-de-passe-oublie" className="text-ink-soft hover:text-brand">
          Mot de passe oublié ?
        </Link>
      </p>

      <p className="mt-6 border-t border-line pt-5 text-center text-sm text-ink-soft">
        Pas encore de compte ?{' '}
        <Link href="/inscription" className="font-medium text-brand hover:underline">
          Créer une association
        </Link>
      </p>
    </Card>
  )
}
