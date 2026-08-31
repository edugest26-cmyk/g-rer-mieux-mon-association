'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import type { FormState } from '@/app/(auth)/actions'
import { createMember, updateMember } from '@/app/[org]/adherents/actions'
import { SubmitButton } from '@/components/submit-button'
import { Alert, Card, CardHeader, Field, Input, Select, Textarea } from '@/components/ui'
import {
  MEMBER_KIND_LABELS,
  MEMBER_KINDS,
  MEMBER_STATUS_LABELS,
  MEMBER_STATUSES,
  type MemberKind,
} from '@/lib/enums'

export type MemberFormValues = {
  id: string
  memberNumber: string
  kind: string
  status: string
  civility: string | null
  firstName: string | null
  lastName: string | null
  legalName: string | null
  gender: string | null
  birthDate: Date | null
  email: string | null
  phone: string | null
  mobile: string | null
  addressLine1: string | null
  addressLine2: string | null
  postalCode: string | null
  city: string | null
  country: string
  categoryId: string | null
  joinedAt: Date
  notes: string | null
  acceptsNewsletter: boolean
  acceptsPhotos: boolean
}

/** `<input type="date">` n'accepte que le format `YYYY-MM-DD`. */
function toDateInput(date: Date | null | undefined): string {
  if (!date) return ''
  return date.toISOString().slice(0, 10)
}

export function MemberForm({
  org,
  categories,
  member,
}: {
  org: string
  categories: { id: string; name: string }[]
  member?: MemberFormValues
}) {
  const isEdit = member != null
  const [state, action] = useActionState<FormState, FormData>(
    isEdit ? updateMember : createMember,
    null,
  )

  // Pilote l'affichage des champs propres aux personnes physiques ou morales.
  const [kind, setKind] = useState<MemberKind>((member?.kind as MemberKind) ?? 'PERSON')
  const isOrganization = kind === 'ORGANIZATION'

  const errors = state?.fieldErrors ?? {}

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="org" value={org} />
      {isEdit ? <input type="hidden" name="id" value={member.id} /> : null}

      {state?.error ? <Alert>{state.error}</Alert> : null}

      <Card>
        <CardHeader title="Identité" />
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <Field label="Type d'adhérent">
            <Select
              name="kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as MemberKind)}
            >
              {MEMBER_KINDS.map((value) => (
                <option key={value} value={value}>
                  {MEMBER_KIND_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Numéro d'adhérent"
            hint={isEdit ? undefined : 'Laissez vide pour l’attribuer automatiquement.'}
            error={errors.memberNumber}
          >
            <Input
              name="memberNumber"
              defaultValue={member?.memberNumber ?? ''}
              placeholder="A0024"
            />
          </Field>

          {isOrganization ? (
            <div className="sm:col-span-2">
              <Field label="Raison sociale" error={errors.legalName}>
                <Input
                  name="legalName"
                  defaultValue={member?.legalName ?? ''}
                  placeholder="École de musique du Val"
                />
              </Field>
            </div>
          ) : (
            <>
              <Field label="Civilité">
                <Select name="civility" defaultValue={member?.civility ?? ''}>
                  <option value="">Non précisée</option>
                  <option value="Mme">Madame</option>
                  <option value="M.">Monsieur</option>
                </Select>
              </Field>

              <Field label="Prénom" error={errors.firstName}>
                <Input name="firstName" defaultValue={member?.firstName ?? ''} />
              </Field>

              <Field label="Nom" error={errors.lastName}>
                <Input name="lastName" defaultValue={member?.lastName ?? ''} required />
              </Field>

              <Field label="Date de naissance" error={errors.birthDate}>
                <Input name="birthDate" type="date" defaultValue={toDateInput(member?.birthDate)} />
              </Field>
            </>
          )}

          {/* Conserve la valeur du champ masqué : basculer de type ne doit pas
              effacer silencieusement une saisie déjà faite. */}
          {isOrganization ? (
            <>
              <input type="hidden" name="firstName" value={member?.firstName ?? ''} />
              <input type="hidden" name="lastName" value={member?.lastName ?? ''} />
            </>
          ) : (
            <input type="hidden" name="legalName" value={member?.legalName ?? ''} />
          )}

          <Field label="Catégorie">
            <Select name="categoryId" defaultValue={member?.categoryId ?? ''}>
              <option value="">Sans catégorie</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Statut">
            <Select name="status" defaultValue={member?.status ?? 'PENDING'}>
              {MEMBER_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {MEMBER_STATUS_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Date d'adhésion" error={errors.joinedAt}>
            <Input
              name="joinedAt"
              type="date"
              defaultValue={toDateInput(member?.joinedAt) || toDateInput(new Date())}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Coordonnées" />
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <Field label="Adresse e-mail" error={errors.email}>
            <Input name="email" type="email" defaultValue={member?.email ?? ''} />
          </Field>

          <Field label="Téléphone mobile">
            <Input name="mobile" defaultValue={member?.mobile ?? ''} placeholder="06 12 34 56 78" />
          </Field>

          <Field label="Téléphone fixe">
            <Input name="phone" defaultValue={member?.phone ?? ''} />
          </Field>

          <Field label="Pays" hint="Code à deux lettres." error={errors.country}>
            <Input name="country" defaultValue={member?.country ?? 'FR'} maxLength={2} />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Adresse">
              <Input name="addressLine1" defaultValue={member?.addressLine1 ?? ''} />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Complément d'adresse">
              <Input name="addressLine2" defaultValue={member?.addressLine2 ?? ''} />
            </Field>
          </div>

          <Field label="Code postal">
            <Input name="postalCode" defaultValue={member?.postalCode ?? ''} />
          </Field>

          <Field label="Ville">
            <Input name="city" defaultValue={member?.city ?? ''} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Consentements et notes"
          description="Recueillis au titre du RGPD ; modifiables à tout moment par l'adhérent."
        />
        <div className="space-y-4 px-5 py-5">
          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              name="acceptsNewsletter"
              defaultChecked={member?.acceptsNewsletter ?? false}
              className="mt-0.5 h-4 w-4"
            />
            <span className="text-sm text-ink">
              Accepte de recevoir la lettre d&apos;information
            </span>
          </label>

          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              name="acceptsPhotos"
              defaultChecked={member?.acceptsPhotos ?? false}
              className="mt-0.5 h-4 w-4"
            />
            <span className="text-sm text-ink">
              Autorise la diffusion de son image (photos, vidéos)
            </span>
          </label>

          <Field label="Notes internes" hint="Visibles par le bureau uniquement.">
            <Textarea name="notes" rows={4} defaultValue={member?.notes ?? ''} />
          </Field>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Enregistrement…">
          {isEdit ? 'Enregistrer les modifications' : 'Créer l’adhérent'}
        </SubmitButton>
        <Link
          href={isEdit ? `/${org}/adherents/${member.id}` : `/${org}/adherents`}
          className="text-sm text-ink-soft hover:text-brand"
        >
          Annuler
        </Link>
      </div>
    </form>
  )
}
