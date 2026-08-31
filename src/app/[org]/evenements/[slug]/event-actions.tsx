'use client'

import { useActionState, useState } from 'react'

import type { FormState } from '@/app/(auth)/actions'
import {
  cancelRegistration,
  createTicketType,
  registerParticipant,
  setEventStatus,
  toggleCheckIn,
} from '@/app/[org]/evenements/actions'
import { SubmitButton } from '@/components/submit-button'
import { Alert, Card, CardHeader, Field, Input, Select } from '@/components/ui'

// ── Statut de l'événement ────────────────────────────────────

export function EventStatusActions({
  org,
  id,
  status,
}: {
  org: string
  id: string
  status: string
}) {
  const [state, action] = useActionState<FormState, FormData>(setEventStatus, null)

  return (
    <div className="space-y-2">
      {state?.error ? <Alert>{state.error}</Alert> : null}

      <div className="flex flex-wrap gap-2">
        {status === 'DRAFT' || status === 'CANCELED' ? (
          <form action={action}>
            <input type="hidden" name="org" value={org} />
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value="PUBLISHED" />
            <SubmitButton pendingLabel="…">Publier</SubmitButton>
          </form>
        ) : null}

        {status !== 'CANCELED' && status !== 'ARCHIVED' ? (
          <form action={action}>
            <input type="hidden" name="org" value={org} />
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value="CANCELED" />
            <SubmitButton variant="secondary" pendingLabel="…">
              Annuler l&apos;événement
            </SubmitButton>
          </form>
        ) : null}
      </div>

      {status !== 'CANCELED' ? (
        <p className="text-xs text-ink-faint">
          Annuler l&apos;événement annule aussi toutes les inscriptions en cours.
        </p>
      ) : null}
    </div>
  )
}

// ── Inscription d'un participant ─────────────────────────────

export function RegistrationForm({
  org,
  eventId,
  members,
  ticketTypes,
  membersOnly,
}: {
  org: string
  eventId: string
  members: { id: string; label: string }[]
  ticketTypes: { id: string; name: string; priceLabel: string }[]
  membersOnly: boolean
}) {
  const [state, action] = useActionState<FormState, FormData>(registerParticipant, null)
  const [isGuest, setIsGuest] = useState(false)
  const errors = state?.fieldErrors ?? {}

  return (
    <form action={action} className="space-y-4 px-5 py-5">
      <input type="hidden" name="org" value={org} />
      <input type="hidden" name="eventId" value={eventId} />

      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.success ? <Alert tone="positive">{state.success}</Alert> : null}

      {!membersOnly ? (
        <Field label="Type de participant">
          <Select
            value={isGuest ? 'GUEST' : 'MEMBER'}
            onChange={(event) => setIsGuest(event.target.value === 'GUEST')}
          >
            <option value="MEMBER">Adhérent</option>
            <option value="GUEST">Participant extérieur</option>
          </Select>
        </Field>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {isGuest && !membersOnly ? (
          <>
            <Field label="Nom du participant" error={errors.guestName}>
              <Input name="guestName" required />
            </Field>
            <Field label="Adresse e-mail" error={errors.guestEmail}>
              <Input name="guestEmail" type="email" />
            </Field>
            <input type="hidden" name="memberId" value="" />
          </>
        ) : (
          <>
            <Field label="Adhérent" error={errors.memberId ?? errors.guestName}>
              <Select name="memberId" defaultValue="" required>
                <option value="">Choisir…</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.label}
                  </option>
                ))}
              </Select>
            </Field>
            <input type="hidden" name="guestName" value="" />
            <input type="hidden" name="guestEmail" value="" />
          </>
        )}

        {ticketTypes.length > 0 ? (
          <Field label="Tarif" error={errors.ticketTypeId}>
            <Select name="ticketTypeId" defaultValue={ticketTypes[0]?.id ?? ''}>
              <option value="">Sans tarif</option>
              {ticketTypes.map((ticket) => (
                <option key={ticket.id} value={ticket.id}>
                  {ticket.name} — {ticket.priceLabel}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <input type="hidden" name="ticketTypeId" value="" />
        )}

        <Field label="Nombre de places" error={errors.quantity}>
          <Input name="quantity" type="number" min={1} max={50} defaultValue={1} />
        </Field>
      </div>

      <SubmitButton pendingLabel="Inscription…">Inscrire</SubmitButton>
    </form>
  )
}

// ── Actions sur une ligne d'inscription ──────────────────────

export function CheckInButton({
  org,
  registrationId,
  present,
}: {
  org: string
  registrationId: string
  present: boolean
}) {
  const [, action] = useActionState<FormState, FormData>(toggleCheckIn, null)

  return (
    <form action={action} className="inline">
      <input type="hidden" name="org" value={org} />
      <input type="hidden" name="registrationId" value={registrationId} />
      <SubmitButton variant={present ? 'secondary' : 'primary'} pendingLabel="…">
        {present ? 'Annuler le pointage' : 'Pointer'}
      </SubmitButton>
    </form>
  )
}

export function CancelRegistrationButton({
  org,
  registrationId,
}: {
  org: string
  registrationId: string
}) {
  const [state, action] = useActionState<FormState, FormData>(cancelRegistration, null)

  return (
    <>
      <form action={action} className="inline">
        <input type="hidden" name="org" value={org} />
        <input type="hidden" name="registrationId" value={registrationId} />
        <SubmitButton variant="ghost" pendingLabel="…">
          Désinscrire
        </SubmitButton>
      </form>
      {state?.success ? (
        <span className="ml-2 text-xs text-positive">{state.success}</span>
      ) : null}
      {state?.error ? <span className="ml-2 text-xs text-danger">{state.error}</span> : null}
    </>
  )
}

// ── Tarifs ───────────────────────────────────────────────────

export function TicketTypeForm({ org, eventId }: { org: string; eventId: string }) {
  const [state, action] = useActionState<FormState, FormData>(createTicketType, null)
  const errors = state?.fieldErrors ?? {}

  return (
    <Card>
      <CardHeader title="Ajouter un tarif" description="Plein tarif, tarif adhérent, gratuit…" />
      <form action={action} className="space-y-4 px-5 py-5">
        <input type="hidden" name="org" value={org} />
        <input type="hidden" name="eventId" value={eventId} />

        {state?.error ? <Alert>{state.error}</Alert> : null}
        {state?.success ? <Alert tone="positive">{state.success}</Alert> : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Libellé" error={errors.name}>
            <Input name="name" placeholder="Plein tarif" required />
          </Field>

          <Field label="Prix" hint="Vide ou 0 pour la gratuité." error={errors.priceCents}>
            <Input name="priceCents" placeholder="12,00" />
          </Field>

          <Field label="Places" hint="Vide = puise dans la jauge." error={errors.quantity}>
            <Input name="quantity" type="number" min={1} />
          </Field>
        </div>

        <SubmitButton variant="secondary" pendingLabel="Ajout…">
          Ajouter le tarif
        </SubmitButton>
      </form>
    </Card>
  )
}
