'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import type { FormState } from '@/app/(auth)/actions'
import { archiveFee, createFee, updateFee } from '@/app/[org]/cotisations/actions'
import { SubmitButton } from '@/components/submit-button'
import { Alert, Card, CardHeader, Field, Input, Select, Textarea } from '@/components/ui'
import { FEE_PERIOD_LABELS, FEE_PERIODS } from '@/lib/enums'

export type FeeFormValues = {
  id: string
  name: string
  description: string | null
  amountCents: number
  period: string
  categoryId: string | null
  taxDeductible: boolean
  isFreeAmount: boolean
}

export function FeeForm({
  org,
  categories,
  fee,
}: {
  org: string
  categories: { id: string; name: string }[]
  fee?: FeeFormValues
}) {
  const isEdit = fee != null
  const [state, action] = useActionState<FormState, FormData>(isEdit ? updateFee : createFee, null)
  const errors = state?.fieldErrors ?? {}

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <input type="hidden" name="org" value={org} />
        {isEdit ? <input type="hidden" name="id" value={fee.id} /> : null}

        {state?.error ? <Alert>{state.error}</Alert> : null}

        <Card>
          <CardHeader title="Barème" />
          <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Libellé" error={errors.name}>
                <Input
                  name="name"
                  defaultValue={fee?.name ?? ''}
                  placeholder="Cotisation annuelle — membre actif"
                  required
                  autoFocus
                />
              </Field>
            </div>

            <Field label="Montant" hint="En euros, décimales avec la virgule." error={errors.amountCents}>
              <Input
                name="amountCents"
                defaultValue={
                  fee ? (fee.amountCents / 100).toFixed(2).replace('.', ',') : ''
                }
                placeholder="120,00"
                required
              />
            </Field>

            <Field label="Périodicité">
              <Select name="period" defaultValue={fee?.period ?? 'ANNUAL'}>
                {FEE_PERIODS.map((period) => (
                  <option key={period} value={period}>
                    {FEE_PERIOD_LABELS[period]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Catégorie concernée"
              hint="Détermine à qui le barème s'applique lors d'une émission automatique."
            >
              <Select name="categoryId" defaultValue={fee?.categoryId ?? ''}>
                <option value="">Toutes les catégories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="sm:col-span-2">
              <Field label="Description">
                <Textarea name="description" rows={3} defaultValue={fee?.description ?? ''} />
              </Field>
            </div>

            <div className="space-y-3 sm:col-span-2">
              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  name="taxDeductible"
                  defaultChecked={fee?.taxDeductible ?? false}
                  className="mt-0.5 h-4 w-4"
                />
                <span className="text-sm text-ink">
                  Ouvre droit à un reçu fiscal
                  <span className="mt-0.5 block text-xs text-ink-faint">
                    À ne cocher que si l&apos;association est habilitée à en délivrer.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  name="isFreeAmount"
                  defaultChecked={fee?.isFreeAmount ?? false}
                  className="mt-0.5 h-4 w-4"
                />
                <span className="text-sm text-ink">
                  Montant libre
                  <span className="mt-0.5 block text-xs text-ink-faint">
                    Le montant saisi devient alors un minimum suggéré.
                  </span>
                </span>
              </label>
            </div>
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pendingLabel="Enregistrement…">
            {isEdit ? 'Enregistrer' : 'Créer le barème'}
          </SubmitButton>
          <Link href={`/${org}/cotisations`} className="text-sm text-ink-soft hover:text-brand">
            Annuler
          </Link>
        </div>
      </form>

      {isEdit ? (
        <Card className="px-5 py-4">
          <ArchiveFee org={org} id={fee.id} />
        </Card>
      ) : null}
    </div>
  )
}

/**
 * Archivage plutôt que suppression : les appels déjà émis référencent le
 * barème, et le supprimer laisserait des cotisations orphelines.
 */
function ArchiveFee({ org, id }: { org: string; id: string }) {
  const [state, action] = useActionState<FormState, FormData>(archiveFee, null)

  return (
    <details>
      <summary className="cursor-pointer list-none text-sm text-ink-faint hover:text-ink">
        Archiver ce barème
      </summary>

      <form action={action} className="mt-3 space-y-3 border-t border-line pt-3">
        <input type="hidden" name="org" value={org} />
        <input type="hidden" name="id" value={id} />

        {state?.error ? <Alert>{state.error}</Alert> : null}

        <p className="text-sm text-ink-soft">
          Le barème disparaîtra des futures émissions. Les appels déjà émis restent intacts.
        </p>

        <SubmitButton variant="secondary" pendingLabel="Archivage…">
          Confirmer l&apos;archivage
        </SubmitButton>
      </form>
    </details>
  )
}
