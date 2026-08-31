import 'server-only'

import { formatDate, formatMoneyShort } from '@/lib/format'

/**
 * Gabarits d'e-mails.
 *
 * Chaque gabarit renvoie l'objet, une version HTML et une version texte. La
 * version texte n'est pas une politesse : certains clients de messagerie et la
 * plupart des filtres anti-spam la réclament, et son absence dégrade la
 * délivrabilité.
 *
 * Le HTML est volontairement archaïque — tableaux, styles en ligne, largeur
 * fixe. Les clients de messagerie ne suivent ni flexbox ni les feuilles de
 * style externes ; ce qui fonctionne dans un navigateur casse dans Outlook.
 */

type Rendered = { subject: string; html: string; text: string }

const BRAND = '#1f5fd0'
const INK = '#11161d'
const INK_SOFT = '#4a5462'
const LINE = '#e2e5ea'

/** Neutralise le HTML des données insérées (nom d'association, libellés…). */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function layout(options: {
  organizationName: string
  title: string
  body: string
  action?: { label: string; url: string }
  footer?: string
}): string {
  const org = escapeHtml(options.organizationName)

  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f6f7f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f7f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid ${LINE};border-radius:12px;">
          <tr>
            <td style="padding:20px 28px;border-bottom:1px solid ${LINE};">
              <span style="font:600 16px/1.4 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${INK};">${org}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;font:400 15px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${INK_SOFT};">
              <h1 style="margin:0 0 16px;font:600 20px/1.35 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${INK};">${escapeHtml(options.title)}</h1>
              ${options.body}
              ${
                options.action
                  ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
                       <tr><td style="background-color:${BRAND};border-radius:8px;">
                         <a href="${options.action.url}" style="display:inline-block;padding:11px 20px;font:500 15px/1 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#ffffff;text-decoration:none;">${escapeHtml(options.action.label)}</a>
                       </td></tr>
                     </table>
                     <p style="margin:8px 0 0;font-size:13px;color:#78828f;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br><span style="color:${BRAND};word-break:break-all;">${options.action.url}</span></p>`
                  : ''
              }
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;border-top:1px solid ${LINE};font:400 12px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#78828f;">
              ${escapeHtml(options.footer ?? `Message envoyé par ${options.organizationName} via GERMA.`)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 12px;">${escapeHtml(text)}</p>`
}

// ── Relance de cotisation ────────────────────────────────────

export function dueReminderEmail(input: {
  organizationName: string
  memberName: string
  label: string
  remainingCents: number
  currency: string
  dueDate: Date | null
  reminderCount: number
  contactEmail: string | null
}): Rendered {
  const amount = formatMoneyShort(input.remainingCents, input.currency)
  const overdue = input.dueDate !== null && input.dueDate < new Date()

  // Le ton se durcit d'un cran passé l'échéance, sans jamais devenir comminatoire :
  // il s'agit d'adhérents bénévoles, pas de débiteurs.
  const opening = overdue
    ? `Votre cotisation « ${input.label} » est arrivée à échéance le ${formatDate(input.dueDate!)} et reste due pour ${amount}.`
    : `Votre cotisation « ${input.label} » reste due pour ${amount}${
        input.dueDate ? `, avant le ${formatDate(input.dueDate)}` : ''
      }.`

  const closing =
    'Si vous avez déjà réglé, ce message peut se croiser avec votre paiement : merci de ne pas en tenir compte.'

  const text = [
    `Bonjour ${input.memberName},`,
    '',
    opening,
    '',
    `Vous pouvez régler auprès du trésorier de ${input.organizationName}.`,
    '',
    closing,
    '',
    input.contactEmail ? `Une question ? Écrivez à ${input.contactEmail}.` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return {
    subject: overdue
      ? `Relance : cotisation ${input.label} — ${input.organizationName}`
      : `Votre cotisation ${input.label} — ${input.organizationName}`,
    text,
    html: layout({
      organizationName: input.organizationName,
      title: overdue ? 'Rappel de cotisation' : 'Votre cotisation',
      body: [
        paragraph(`Bonjour ${input.memberName},`),
        paragraph(opening),
        paragraph(`Vous pouvez régler auprès du trésorier de ${input.organizationName}.`),
        `<p style="margin:16px 0 0;font-size:13px;color:#78828f;">${escapeHtml(closing)}</p>`,
      ].join(''),
      footer: input.contactEmail
        ? `Une question ? Écrivez à ${input.contactEmail}.`
        : undefined,
    }),
  }
}

// ── Réinitialisation de mot de passe ─────────────────────────

export function passwordResetEmail(input: {
  firstName: string
  resetUrl: string
  expiresInMinutes: number
}): Rendered {
  const text = [
    `Bonjour ${input.firstName},`,
    '',
    'Vous avez demandé à réinitialiser votre mot de passe GERMA.',
    `Ce lien est valable ${input.expiresInMinutes} minutes et ne peut servir qu'une fois :`,
    '',
    input.resetUrl,
    '',
    "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.",
  ].join('\n')

  return {
    subject: 'Réinitialiser votre mot de passe GERMA',
    text,
    html: layout({
      organizationName: 'GERMA',
      title: 'Réinitialiser votre mot de passe',
      body: [
        paragraph(`Bonjour ${input.firstName},`),
        paragraph('Vous avez demandé à réinitialiser votre mot de passe.'),
        paragraph(
          `Ce lien est valable ${input.expiresInMinutes} minutes et ne peut servir qu'une seule fois.`,
        ),
      ].join(''),
      action: { label: 'Choisir un nouveau mot de passe', url: input.resetUrl },
      footer:
        "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe reste inchangé.",
    }),
  }
}

// ── Invitation à rejoindre une association ───────────────────

export function invitationEmail(input: {
  organizationName: string
  inviterName: string
  roleLabel: string
  acceptUrl: string
  expiresAt: Date
}): Rendered {
  const text = [
    'Bonjour,',
    '',
    `${input.inviterName} vous invite à rejoindre « ${input.organizationName} » sur GERMA,`,
    `avec le rôle de ${input.roleLabel.toLowerCase()}.`,
    '',
    'Pour accepter :',
    input.acceptUrl,
    '',
    `Cette invitation expire le ${formatDate(input.expiresAt)}.`,
  ].join('\n')

  return {
    subject: `Invitation à rejoindre ${input.organizationName}`,
    text,
    html: layout({
      organizationName: input.organizationName,
      title: `${input.inviterName} vous invite`,
      body: [
        paragraph(
          `Vous êtes invité à rejoindre « ${input.organizationName} » sur GERMA, avec le rôle de ${input.roleLabel.toLowerCase()}.`,
        ),
      ].join(''),
      action: { label: "Accepter l'invitation", url: input.acceptUrl },
      footer: `Cette invitation expire le ${formatDate(input.expiresAt)}.`,
    }),
  }
}

// ── Convocation à une assemblée ──────────────────────────────

export function meetingConvocationEmail(input: {
  organizationName: string
  memberName: string
  meetingTitle: string
  meetingKindLabel: string
  startAt: Date
  locationName: string | null
  onlineUrl: string | null
  agenda: string | null
}): Rendered {
  const where = input.locationName ?? input.onlineUrl ?? 'Lieu à préciser'

  const text = [
    `Bonjour ${input.memberName},`,
    '',
    `Vous êtes convoqué à l'${input.meetingKindLabel.toLowerCase()} de ${input.organizationName} :`,
    '',
    `  ${input.meetingTitle}`,
    `  ${formatDate(input.startAt)}`,
    `  ${where}`,
    '',
    input.agenda ? `Ordre du jour :\n${input.agenda}` : '',
    '',
    "En cas d'empêchement, vous pouvez donner pouvoir à un autre adhérent.",
  ]
    .filter(Boolean)
    .join('\n')

  return {
    subject: `Convocation — ${input.meetingTitle}`,
    text,
    html: layout({
      organizationName: input.organizationName,
      title: 'Convocation',
      body: [
        paragraph(`Bonjour ${input.memberName},`),
        paragraph(
          `Vous êtes convoqué à l'${input.meetingKindLabel.toLowerCase()} de ${input.organizationName}.`,
        ),
        `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;border-collapse:collapse;">
           <tr><td style="padding:4px 12px 4px 0;color:#78828f;">Réunion</td><td style="padding:4px 0;color:${INK};font-weight:600;">${escapeHtml(input.meetingTitle)}</td></tr>
           <tr><td style="padding:4px 12px 4px 0;color:#78828f;">Date</td><td style="padding:4px 0;color:${INK};">${escapeHtml(formatDate(input.startAt))}</td></tr>
           <tr><td style="padding:4px 12px 4px 0;color:#78828f;">Lieu</td><td style="padding:4px 0;color:${INK};">${escapeHtml(where)}</td></tr>
         </table>`,
        input.agenda
          ? `<p style="margin:0 0 6px;color:${INK};font-weight:600;">Ordre du jour</p><p style="margin:0 0 12px;white-space:pre-line;">${escapeHtml(input.agenda)}</p>`
          : '',
      ].join(''),
      footer: "En cas d'empêchement, vous pouvez donner pouvoir à un autre adhérent.",
    }),
  }
}
