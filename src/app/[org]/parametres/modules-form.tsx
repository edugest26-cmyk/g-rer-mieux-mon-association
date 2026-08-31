'use client'

import { useActionState } from 'react'

import type { FormState } from '@/app/(auth)/actions'
import { updateModules } from '@/app/[org]/parametres/actions'
import { SubmitButton } from '@/components/submit-button'
import { Alert } from '@/components/ui'
import { MODULES, type ModuleKey } from '@/lib/modules'

export function ModulesForm({ org, enabled }: { org: string; enabled: ModuleKey[] }) {
  const [state, action] = useActionState<FormState, FormData>(updateModules, null)
  const active = new Set(enabled)

  return (
    <form action={action} className="space-y-4 px-5 py-5">
      <input type="hidden" name="org" value={org} />

      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.success ? <Alert tone="positive">{state.success}</Alert> : null}

      <p className="text-sm text-ink-soft">
        N&apos;activez que ce dont votre association se sert. Les rubriques décochées
        disparaissent du menu et de leurs adresses ; rien n&apos;est supprimé, tout revient
        intact à la réactivation.
      </p>

      <div className="space-y-3">
        {MODULES.map((rubrique) => (
          <label key={rubrique.key} className="flex items-start gap-2.5">
            <input
              type="checkbox"
              name={`rubrique.${rubrique.key}`}
              defaultChecked={rubrique.core || active.has(rubrique.key)}
              disabled={rubrique.core}
              className="mt-0.5 h-4 w-4"
            />
            <span className="text-sm text-ink">
              {rubrique.label}
              {rubrique.core ? (
                <span className="ml-1.5 text-xs font-normal text-ink-faint">
                  (toujours active)
                </span>
              ) : null}
              <span className="mt-0.5 block text-xs text-ink-faint">{rubrique.description}</span>
            </span>
          </label>
        ))}
      </div>

      <SubmitButton variant="secondary" pendingLabel="Enregistrement…">
        Enregistrer les rubriques
      </SubmitButton>
    </form>
  )
}
