/**
 * Formatage des valeurs affichées.
 *
 * Les montants sont stockés en centimes (entiers) partout dans la base : cela
 * évite les erreurs d'arrondi des flottants, qui deviennent visibles dès qu'on
 * additionne quelques centaines de cotisations.
 */

export function formatMoney(cents: number, currency = 'EUR', locale = 'fr-FR'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(cents / 100)
}

/** Variante compacte pour les tableaux denses : « 1 250 € » plutôt que « 1 250,00 € ». */
export function formatMoneyShort(cents: number, currency = 'EUR', locale = 'fr-FR'): string {
  const hasCents = cents % 100 !== 0
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(cents / 100)
}

/** Convertit une saisie utilisateur (« 12,50 », « 12.50 », « 1 250 ») en centimes. */
export function parseMoneyToCents(input: string): number | null {
  const normalized = input
    .replace(/\s/g, '')
    .replace(/ /g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '')

  if (normalized === '' || normalized === '-') return null

  const value = Number(normalized)
  if (!Number.isFinite(value)) return null

  return Math.round(value * 100)
}

export function formatDate(date: Date | string, locale = 'fr-FR'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

export function formatDateShort(date: Date | string, locale = 'fr-FR'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

export function formatDateTime(date: Date | string, locale = 'fr-FR'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/** Nom d'affichage d'un adhérent, qu'il soit personne physique ou morale. */
export function memberDisplayName(member: {
  kind: string
  firstName: string | null
  lastName: string | null
  legalName: string | null
}): string {
  if (member.kind === 'ORGANIZATION') {
    return member.legalName ?? 'Personne morale sans nom'
  }
  const full = [member.firstName, member.lastName].filter(Boolean).join(' ').trim()
  return full === '' ? 'Adhérent sans nom' : full
}

/** Initiales pour les avatars de repli. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/** Convertit un libellé en identifiant d'URL (slug). */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/** Points de base -> pourcentage lisible (2000 -> « 20 % »). */
export function formatBps(bps: number, locale = 'fr-FR'): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 2,
  }).format(bps / 10000)
}
