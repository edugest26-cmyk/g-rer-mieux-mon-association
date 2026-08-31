'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import type { FormState } from '@/app/(auth)/actions'
import { recordPayment, waiveDue } from '@/app/[org]/cotisations/actions'
import { SubmitButton } from '@/components/submit-button'
import { Alert, Card, CardHeader, Field, Input, Select } from '@/components/ui'
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from '@/lib/enums'

export function PaymentForm({
  org,
  dueId,
  remainingLabel,
  remainingInput,
  today,
  bankAccounts,
  canPostEntry,
}: {
  org: string
  dueId: string
  remainingLabel: string
  remainingInput: string
  today: string
  bankAccounts: { id: string; name: string }[]
  canPostEntry: boolean
}) {
  const [state, action] = useActionState<FormState, FormData>(recordPayment, null)
  const errors = state?.fieldErrors ?? {}

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <input type="hidden" name="org" value={org} />
        <input type="hidden" name="dueId" value={dueId} />

        {state?.error ? <Alert>{state.error}</Alert> : null}
        {state?.success ? (
          <Alert tone="positive">
            {state.success}{' '}
            <Link href={`/${org}/cotisations`} className="font-medium underline">
              Retour aux cotisations
            </Link>
          </Alert>
        ) : null}

        <Card>
          <CardHeader title="Règlement" />
          <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
            <Field
              label="Montant encaissé"
              hint={`Reste dû : ${remainingLabel}.`}
              error={errors.amountCents}
            >
              <Input name="amountCents" defaultValue={remainingInput} required />
            </Field>

            <Field label="Date" error={errors.date}>
              <Input name="date" type="date" defaultValue={today} required />
            </Field>

            <Field label="Moyen de paiement">
              <Select name="method" defaultValue="TRANSFER">
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {PAYMENT_METHOD_LABELS[method]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Référence" hint="Numéro de chèque, référence de virement…">
              <Input name="reference" />
            </Field>

            {bankAccounts.length > 0 ? (
              <Field label="Compte encaisseur">
                <Select name="bankAccountId" defaultValue={bankAccounts[0]?.id ?? ''}>
                  <option value="">Non précisé</option>
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <input type="hidden" name="bankAccountId" value="" />
            )}

            <div className="sm:col-span-2">
              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  name="postEntry"
                  defaultChecked={canPostEntry}
                  className="mt-0.5 h-4 w-4"
                />
                <span className="text-sm text-ink">
                  Passer l&apos;écriture comptable correspondante
                  <span className="mt-0.5 block text-xs text-ink-faint">
                    {canPostEntry
                      ? 'Débit 512 banque (ou 530 caisse pour les espèces), crédit 756 cotisations.'
                      : 'Les comptes 512 et 756 sont absents du plan comptable : aucune écriture ne sera passée.'}
                  </span>
                </span>
              </label>
            </div>
          </div>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pendingLabel="Enregistrement…">Enregistrer le règlement</SubmitButton>
          <Link href={`/${org}/cotisations`} className="text-sm text-ink-soft hover:text-brand">
            Annuler
          </Link>
        </div>
      </form>

      <Card className="px-5 py-4">
        <WaiveDue org={org} dueId={dueId} />
      </Card>
    </div>
  )
}

/**
 * Exonération, repliée : c'est l'exception, pas le geste courant. Le montant
 * appelé reste visible dans l'historique, seul le statut change.
 */
function WaiveDue({ org, dueId }: { org: string; dueId: string }) {
  const [state, action] = useActionState<FormState, FormData>(waiveDue, null)

  return (
    <details>
      <summary className="cursor-pointer list-none text-sm text-ink-faint hover:text-ink">
        Exonérer cet adhérent de sa cotisation
      </summary>

      <form action={action} className="mt-3 space-y-3 border-t border-line pt-3">
        <input type="hidden" name="org" value={org} />
        <input type="hidden" name="dueId" value={dueId} />

        {state?.error ? <Alert>{state.error}</Alert> : null}

        <Field label="Motif" hint="Conservé sur l'appel et dans le journal d'activité.">
          <Input name="reason" placeholder="Membre d'honneur, situation particulière…" />
        </Field>

        <SubmitButton variant="secondary" pendingLabel="Exonération…">
          Confirmer l&apos;exonération
        </SubmitButton>
      </form>
    </details>
  )
}
