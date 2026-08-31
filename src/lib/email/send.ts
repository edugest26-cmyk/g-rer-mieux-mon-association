import 'server-only'

/**
 * Envoi d'e-mails.
 *
 * Aucune dépendance : l'API REST du fournisseur est appelée avec `fetch`. Cela
 * évite un SDK de plus à maintenir, et rend le remplacement du prestataire
 * trivial — seule la fonction `sendViaResend` serait à réécrire.
 *
 * Le transport est choisi par `EMAIL_PROVIDER` :
 *   - `console` (défaut) : rien n'est envoyé, le message est écrit dans le
 *     terminal. C'est le mode de développement : on veut voir le contenu et le
 *     destinataire sans risquer d'écrire à de vrais adhérents.
 *   - `resend` : envoi réel, nécessite `RESEND_API_KEY` et `EMAIL_FROM`.
 */

export type Mail = {
  to: string
  subject: string
  html: string
  /** Version texte, pour les clients qui n'affichent pas le HTML. */
  text: string
  replyTo?: string
}

export type SendResult = { ok: true } | { ok: false; error: string }

function provider(): 'resend' | 'console' {
  return process.env.EMAIL_PROVIDER === 'resend' ? 'resend' : 'console'
}

/** Expéditeur affiché. Doit appartenir à un domaine vérifié chez le prestataire. */
function from(): string {
  return process.env.EMAIL_FROM ?? 'GERMA <onboarding@resend.dev>'
}

async function sendViaResend(mail: Mail): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY absente.' }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: from(),
        to: [mail.to],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
      }),
      // Un prestataire lent ne doit pas bloquer indéfiniment une Server Action.
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      const body = await response.text()
      return { ok: false, error: `HTTP ${response.status} — ${body.slice(0, 200)}` }
    }

    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, error: message }
  }
}

function sendViaConsole(mail: Mail): SendResult {
  console.log(
    [
      '',
      '───────────── E-MAIL (mode console, non envoyé) ─────────────',
      `À       : ${mail.to}`,
      `Objet   : ${mail.subject}`,
      '',
      mail.text,
      '─────────────────────────────────────────────────────────────',
      '',
    ].join('\n'),
  )
  return { ok: true }
}

export async function sendEmail(mail: Mail): Promise<SendResult> {
  // Une adresse vide n'est pas une erreur d'envoi mais une donnée manquante :
  // on le dit clairement plutôt que de laisser le prestataire répondre 422.
  if (!mail.to || !mail.to.includes('@')) {
    return { ok: false, error: 'Adresse destinataire absente ou invalide.' }
  }

  return provider() === 'resend' ? sendViaResend(mail) : sendViaConsole(mail)
}

/**
 * Envoi en lot, séquentiel et tolérant à l'échec.
 *
 * Séquentiel volontairement : les prestataires limitent le débit, et un envoi
 * en parallèle sur 200 adhérents déclencherait un throttling qui ferait perdre
 * des messages. Un échec n'interrompt pas la série — il est collecté et
 * remonté à l'utilisateur, qui saura qui n'a pas été joint.
 */
export async function sendBatch(
  mails: Mail[],
): Promise<{ sent: number; failures: { to: string; error: string }[] }> {
  let sent = 0
  const failures: { to: string; error: string }[] = []

  for (const mail of mails) {
    const result = await sendEmail(mail)
    if (result.ok) {
      sent += 1
    } else {
      failures.push({ to: mail.to, error: result.error })
    }
  }

  return { sent, failures }
}

/** Indique si un envoi réel est configuré, pour l'afficher dans l'interface. */
export function isEmailConfigured(): boolean {
  return provider() === 'resend' && Boolean(process.env.RESEND_API_KEY)
}
