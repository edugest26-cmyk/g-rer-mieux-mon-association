'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import type { FormState } from '@/app/(auth)/actions'
import { createEvent, updateEvent } from '@/app/[org]/evenements/actions'
import { SubmitButton } from '@/components/submit-button'
import { Alert, Card, CardHeader, Field, Input, Select, Textarea } from '@/components/ui'
import { EVENT_KIND_LABELS, EVENT_KINDS } from '@/lib/enums'

export type EventFormValues = {
  id: string
  slug: string
  title: string
  description: string | null
  kind: string
  startAt: Date
  endAt: Date
  locationName: string | null
  locationAddress: string | null
  onlineUrl: string | null
  capacity: number | null
  membersOnly: boolean
  requiresApproval: boolean
  registrationClosesAt: Date | null
}

/**
 * `<input type="datetime-local">` attend `YYYY-MM-DDTHH:mm` en heure locale.
 * `toISOString()` décalerait la valeur vers UTC et afficherait une heure fausse.
 */
function toLocalInput(date: Date | null | undefined): string {
  if (!date) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function EventForm({ org, event }: { org: string; event?: EventFormValues }) {
  const isEdit = event != null
  const [state, action] = useActionState<FormState, FormData>(
    isEdit ? updateEvent : createEvent,
    null,
  )
  const errors = state?.fieldErrors ?? {}

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="org" value={org} />
      {isEdit ? <input type="hidden" name="id" value={event.id} /> : null}

      {state?.error ? <Alert>{state.error}</Alert> : null}

      <Card>
        <CardHeader title="L'événement" />
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Titre" error={errors.title}>
              <Input
                name="title"
                defaultValue={event?.title ?? ''}
                placeholder="Concert de printemps"
                required
                autoFocus
              />
            </Field>
          </div>

          <Field label="Nature">
            <Select name="kind" defaultValue={event?.kind ?? 'ACTIVITY'}>
              {EVENT_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {EVENT_KIND_LABELS[kind]}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Jauge"
            hint="Nombre de places. Vide = illimité."
            error={errors.capacity}
          >
            <Input
              name="capacity"
              type="number"
              min={1}
              defaultValue={event?.capacity ?? ''}
              placeholder="Illimité"
            />
          </Field>

          <Field label="Début" error={errors.startAt}>
            <Input
              name="startAt"
              type="datetime-local"
              defaultValue={toLocalInput(event?.startAt)}
              required
            />
          </Field>

          <Field label="Fin" error={errors.endAt}>
            <Input
              name="endAt"
              type="datetime-local"
              defaultValue={toLocalInput(event?.endAt)}
              required
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Description">
              <Textarea name="description" rows={4} defaultValue={event?.description ?? ''} />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Lieu" />
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <Field label="Nom du lieu">
            <Input
              name="locationName"
              defaultValue={event?.locationName ?? ''}
              placeholder="Salle Berlioz"
            />
          </Field>

          <Field label="Adresse">
            <Input name="locationAddress" defaultValue={event?.locationAddress ?? ''} />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Lien de visioconférence" hint="Pour un événement en ligne ou hybride.">
              <Input name="onlineUrl" defaultValue={event?.onlineUrl ?? ''} placeholder="https://…" />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Inscriptions" />
        <div className="space-y-4 px-5 py-5">
          <Field
            label="Clôture des inscriptions"
            hint="Facultative. Passée cette date, plus aucune inscription n'est acceptée."
            error={errors.registrationClosesAt}
          >
            <Input
              name="registrationClosesAt"
              type="datetime-local"
              defaultValue={toLocalInput(event?.registrationClosesAt)}
            />
          </Field>

          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              name="membersOnly"
              defaultChecked={event?.membersOnly ?? true}
              className="mt-0.5 h-4 w-4"
            />
            <span className="text-sm text-ink">
              Réservé aux adhérents
              <span className="mt-0.5 block text-xs text-ink-faint">
                Décochez pour accepter des participants extérieurs.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2.5">
            <input
              type="checkbox"
              name="requiresApproval"
              defaultChecked={event?.requiresApproval ?? false}
              className="mt-0.5 h-4 w-4"
            />
            <span className="text-sm text-ink">
              Chaque inscription doit être validée
              <span className="mt-0.5 block text-xs text-ink-faint">
                Les inscriptions arrivent alors en « à valider » plutôt que confirmées.
              </span>
            </span>
          </label>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Enregistrement…">
          {isEdit ? 'Enregistrer' : 'Créer l’événement'}
        </SubmitButton>
        <Link
          href={isEdit ? `/${org}/evenements/${event.slug}` : `/${org}/evenements`}
          className="text-sm text-ink-soft hover:text-brand"
        >
          Annuler
        </Link>
      </div>

      {!isEdit ? (
        <p className="text-sm text-ink-faint">
          L&apos;événement est créé en brouillon : il ne sera visible qu&apos;une fois publié.
        </p>
      ) : null}
    </form>
  )
}
