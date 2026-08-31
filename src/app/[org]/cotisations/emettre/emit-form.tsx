'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import type { FormState } from '@/app/(auth)/actions'
import { emitDues } from '@/app/[org]/cotisations/actions'
import { SubmitButton } from '@/components/submit-button'
import { Alert, Card, CardHeader, Field, Input, Select } from '@/components/ui'

export function EmitForm({
  org,
  categories,
  fees,
  defaults,
}: {
  org: string
  categories: { id: string; name: string; memberCount: number }[]
  fees: { id: string; name: string; amountCents: number }[]
  defaults: { label: string; periodStart: string; periodEnd: string; dueDate: string }
}) {
  const [state, action] = useActionState<FormState, FormData>(emitDues, null)

  // Ces deux choix commandent l'affichage de champs dépendants.
  const [target, setTarget] = useState<'ALL' | 'CATEGORY'>('ALL')
  const [feeMode, setFeeMode] = useState<'AUTO' | 'FIXED'>('AUTO')

  const errors = state?.fieldErrors ?? {}

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="org" value={org} />

      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.success ? (
        <Alert tone="positive">
          {state.success}{' '}
          <Link href={`/${org}/cotisations`} className="font-medium underline">
            Voir les appels
          </Link>
        </Alert>
      ) : null}

      <Card>
        <CardHeader title="Période" description="Le libellé apparaîtra sur chaque appel." />
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Libellé" error={errors.label}>
              <Input name="label" defaultValue={defaults.label} required />
            </Field>
          </div>

          <Field label="Début de période" error={errors.periodStart}>
            <Input name="periodStart" type="date" defaultValue={defaults.periodStart} required />
          </Field>

          <Field label="Fin de période" error={errors.periodEnd}>
            <Input name="periodEnd" type="date" defaultValue={defaults.periodEnd} required />
          </Field>

          <Field
            label="Date d'échéance"
            hint="Facultative. Sert au repérage des retards et aux relances."
            error={errors.dueDate}
          >
            <Input name="dueDate" type="date" defaultValue={defaults.dueDate} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Destinataires"
          description="Les adhérents démissionnaires, radiés ou décédés ne sont jamais appelés."
        />
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <Field label="Cible">
            <Select
              name="target"
              value={target}
              onChange={(event) => setTarget(event.target.value as 'ALL' | 'CATEGORY')}
            >
              <option value="ALL">Tous les adhérents</option>
              <option value="CATEGORY">Une catégorie seulement</option>
            </Select>
          </Field>

          {target === 'CATEGORY' ? (
            <Field label="Catégorie" error={errors.targetCategoryId}>
              <Select name="targetCategoryId" defaultValue="">
                <option value="">Choisir…</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name} ({category.memberCount})
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <input type="hidden" name="targetCategoryId" value="" />
          )}

          <div className="sm:col-span-2">
            <label className="flex items-start gap-2.5">
              <input type="checkbox" name="includeLapsed" className="mt-0.5 h-4 w-4" />
              <span className="text-sm text-ink">
                Inclure les adhérents dont la cotisation précédente est échue
                <span className="mt-0.5 block text-xs text-ink-faint">
                  Sans cette option, seuls les adhérents à jour et en attente sont appelés.
                </span>
              </span>
            </label>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Montant" />
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <Field label="Barème">
            <Select
              name="feeMode"
              value={feeMode}
              onChange={(event) => setFeeMode(event.target.value as 'AUTO' | 'FIXED')}
            >
              <option value="AUTO">Selon la catégorie de chaque adhérent</option>
              <option value="FIXED">Un barème unique pour tous</option>
            </Select>
          </Field>

          {feeMode === 'FIXED' ? (
            <Field label="Barème appliqué" error={errors.feeId}>
              <Select name="feeId" defaultValue="">
                <option value="">Choisir…</option>
                {fees.map((fee) => (
                  <option key={fee.id} value={fee.id}>
                    {fee.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <input type="hidden" name="feeId" value="" />
          )}

          <div className="sm:col-span-2">
            <p className="text-sm text-ink-faint">
              En mode « selon la catégorie », un adhérent dont la catégorie n&apos;a pas de barème
              est ignoré plutôt qu&apos;appelé à zéro euro. Le compte rendu le signale.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Émission…">Émettre les appels</SubmitButton>
        <Link href={`/${org}/cotisations`} className="text-sm text-ink-soft hover:text-brand">
          Annuler
        </Link>
      </div>

      <p className="text-sm text-ink-faint">
        L&apos;opération peut être relancée sans risque : un adhérent qui a déjà un appel
        chevauchant la période est ignoré, jamais facturé deux fois.
      </p>
    </form>
  )
}
