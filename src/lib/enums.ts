/**
 * Énumérations métier.
 *
 * Les statuts sont stockés en `String` plutôt qu'en `enum` PostgreSQL : c'est
 * ce fichier qui fait foi pour les valeurs admises et leur libellé, ce qui
 * permet d'ajouter un statut sans passer par une migration. Chaque groupe
 * expose :
 *   - le tableau `…_VALUES` (source de vérité, utilisable par Zod)
 *   - le type TypeScript dérivé
 *   - le dictionnaire `…_LABELS` pour l'affichage en français
 */

// ── Socle ────────────────────────────────────────────────────

export const ORG_KINDS = [
  'ASSOCIATION_1901',
  'FONDATION',
  'ONG',
  'SYNDICAT',
  'CLUB',
  'COOPERATIVE',
  'AUTRE',
] as const
export type OrgKind = (typeof ORG_KINDS)[number]
export const ORG_KIND_LABELS: Record<OrgKind, string> = {
  ASSOCIATION_1901: 'Association loi 1901',
  FONDATION: 'Fondation',
  ONG: 'ONG',
  SYNDICAT: 'Syndicat',
  CLUB: 'Club',
  COOPERATIVE: 'Coopérative',
  AUTRE: 'Autre',
}

/** Rôles applicatifs, du plus large au plus restreint. */
export const ROLES = [
  'OWNER',
  'ADMIN',
  'TREASURER',
  'SECRETARY',
  'MANAGER',
  'MEMBER',
  'VIEWER',
] as const
export type Role = (typeof ROLES)[number]
export const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Propriétaire',
  ADMIN: 'Administrateur',
  TREASURER: 'Trésorier',
  SECRETARY: 'Secrétaire',
  MANAGER: 'Responsable',
  MEMBER: 'Adhérent',
  VIEWER: 'Lecteur',
}

export const PLANS = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'] as const
export type Plan = (typeof PLANS)[number]
export const PLAN_LABELS: Record<Plan, string> = {
  FREE: 'Gratuit',
  STARTER: 'Essentiel',
  PRO: 'Pro',
  ENTERPRISE: 'Entreprise',
}

// ── Membres & adhésions ──────────────────────────────────────

export const MEMBER_KINDS = ['PERSON', 'ORGANIZATION'] as const
export type MemberKind = (typeof MEMBER_KINDS)[number]
export const MEMBER_KIND_LABELS: Record<MemberKind, string> = {
  PERSON: 'Personne physique',
  ORGANIZATION: 'Personne morale',
}

export const MEMBER_STATUSES = [
  'PENDING',
  'ACTIVE',
  'LAPSED',
  'SUSPENDED',
  'RESIGNED',
  'EXCLUDED',
  'DECEASED',
] as const
export type MemberStatus = (typeof MEMBER_STATUSES)[number]
export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  PENDING: 'En attente',
  ACTIVE: 'À jour',
  LAPSED: 'Cotisation échue',
  SUSPENDED: 'Suspendu',
  RESIGNED: 'Démissionnaire',
  EXCLUDED: 'Radié',
  DECEASED: 'Décédé',
}

export const FEE_PERIODS = [
  'ANNUAL',
  'SEMESTRIAL',
  'QUARTERLY',
  'MONTHLY',
  'ONE_TIME',
  'LIFETIME',
] as const
export type FeePeriod = (typeof FEE_PERIODS)[number]
export const FEE_PERIOD_LABELS: Record<FeePeriod, string> = {
  ANNUAL: 'Annuelle',
  SEMESTRIAL: 'Semestrielle',
  QUARTERLY: 'Trimestrielle',
  MONTHLY: 'Mensuelle',
  ONE_TIME: 'Ponctuelle',
  LIFETIME: 'À vie',
}

export const DUE_STATUSES = ['PENDING', 'PARTIAL', 'PAID', 'WAIVED', 'CANCELED'] as const
export type DueStatus = (typeof DUE_STATUSES)[number]
export const DUE_STATUS_LABELS: Record<DueStatus, string> = {
  PENDING: 'À régler',
  PARTIAL: 'Partiellement réglée',
  PAID: 'Réglée',
  WAIVED: 'Exonérée',
  CANCELED: 'Annulée',
}

// ── Finances ─────────────────────────────────────────────────

export const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  ASSET: 'Actif',
  LIABILITY: 'Passif',
  EQUITY: 'Fonds propres',
  REVENUE: 'Produits',
  EXPENSE: 'Charges',
}

export const TRANSACTION_KINDS = [
  'INCOME',
  'EXPENSE',
  'TRANSFER',
  'OPENING',
  'CLOSING',
  'ADJUSTMENT',
] as const
export type TransactionKind = (typeof TRANSACTION_KINDS)[number]
export const TRANSACTION_KIND_LABELS: Record<TransactionKind, string> = {
  INCOME: 'Recette',
  EXPENSE: 'Dépense',
  TRANSFER: 'Virement interne',
  OPENING: "À-nouveau d'ouverture",
  CLOSING: 'Écriture de clôture',
  ADJUSTMENT: 'Régularisation',
}

export const TRANSACTION_STATUSES = ['DRAFT', 'POSTED', 'RECONCILED', 'CANCELED'] as const
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number]
export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  DRAFT: 'Brouillon',
  POSTED: 'Validée',
  RECONCILED: 'Rapprochée',
  CANCELED: 'Annulée',
}

export const PAYMENT_METHODS = [
  'CASH',
  'CHECK',
  'TRANSFER',
  'CARD',
  'DIRECT_DEBIT',
  'ONLINE',
  'OTHER',
] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Espèces',
  CHECK: 'Chèque',
  TRANSFER: 'Virement',
  CARD: 'Carte bancaire',
  DIRECT_DEBIT: 'Prélèvement',
  ONLINE: 'Paiement en ligne',
  OTHER: 'Autre',
}

export const DONATION_KINDS = ['MONEY', 'IN_KIND', 'SKILL', 'SECURITIES'] as const
export type DonationKind = (typeof DONATION_KINDS)[number]
export const DONATION_KIND_LABELS: Record<DonationKind, string> = {
  MONEY: 'Don numéraire',
  IN_KIND: 'Don en nature',
  SKILL: 'Mécénat de compétences',
  SECURITIES: 'Don de titres',
}

// ── Événements ───────────────────────────────────────────────

export const EVENT_KINDS = [
  'MEETING',
  'ACTIVITY',
  'TRAINING',
  'COMPETITION',
  'FUNDRAISER',
  'TRIP',
  'SOCIAL',
  'OTHER',
] as const
export type EventKind = (typeof EVENT_KINDS)[number]
export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  MEETING: 'Réunion',
  ACTIVITY: 'Activité',
  TRAINING: 'Formation',
  COMPETITION: 'Compétition',
  FUNDRAISER: 'Collecte de fonds',
  TRIP: 'Sortie',
  SOCIAL: 'Événement convivial',
  OTHER: 'Autre',
}

export const EVENT_STATUSES = ['DRAFT', 'PUBLISHED', 'FULL', 'CANCELED', 'ARCHIVED'] as const
export type EventStatus = (typeof EVENT_STATUSES)[number]
export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  DRAFT: 'Brouillon',
  PUBLISHED: 'Publié',
  FULL: 'Complet',
  CANCELED: 'Annulé',
  ARCHIVED: 'Archivé',
}

export const REGISTRATION_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'WAITLISTED',
  'CANCELED',
  'ATTENDED',
  'NO_SHOW',
] as const
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number]
export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  PENDING: 'À valider',
  CONFIRMED: 'Confirmée',
  WAITLISTED: "Liste d'attente",
  CANCELED: 'Annulée',
  ATTENDED: 'Présent',
  NO_SHOW: 'Absent',
}

// ── Gouvernance ──────────────────────────────────────────────

export const MEETING_KINDS = ['AGO', 'AGE', 'BOARD', 'OFFICE', 'COMMITTEE', 'OTHER'] as const
export type MeetingKind = (typeof MEETING_KINDS)[number]
export const MEETING_KIND_LABELS: Record<MeetingKind, string> = {
  AGO: 'Assemblée générale ordinaire',
  AGE: 'Assemblée générale extraordinaire',
  BOARD: "Conseil d'administration",
  OFFICE: 'Réunion de bureau',
  COMMITTEE: 'Commission',
  OTHER: 'Autre',
}

export const ATTENDEE_STATUSES = [
  'INVITED',
  'PRESENT',
  'REPRESENTED',
  'ABSENT',
  'EXCUSED',
] as const
export type AttendeeStatus = (typeof ATTENDEE_STATUSES)[number]
export const ATTENDEE_STATUS_LABELS: Record<AttendeeStatus, string> = {
  INVITED: 'Convoqué',
  PRESENT: 'Présent',
  REPRESENTED: 'Représenté',
  ABSENT: 'Absent',
  EXCUSED: 'Excusé',
}

/** Règles de majorité, exprimées en points de base des voix exprimées. */
export const MAJORITY_RULES = [
  'SIMPLE',
  'ABSOLUTE',
  'TWO_THIRDS',
  'THREE_QUARTERS',
  'UNANIMOUS',
] as const
export type MajorityRule = (typeof MAJORITY_RULES)[number]
export const MAJORITY_RULE_LABELS: Record<MajorityRule, string> = {
  SIMPLE: 'Majorité simple',
  ABSOLUTE: 'Majorité absolue',
  TWO_THIRDS: 'Majorité des deux tiers',
  THREE_QUARTERS: 'Majorité des trois quarts',
  UNANIMOUS: 'Unanimité',
}

export const VOTE_CHOICES = ['FOR', 'AGAINST', 'ABSTAIN'] as const
export type VoteChoice = (typeof VOTE_CHOICES)[number]
export const VOTE_CHOICE_LABELS: Record<VoteChoice, string> = {
  FOR: 'Pour',
  AGAINST: 'Contre',
  ABSTAIN: 'Abstention',
}

export const MANDATE_ROLES = [
  'PRESIDENT',
  'VICE_PRESIDENT',
  'TREASURER',
  'DEPUTY_TREASURER',
  'SECRETARY',
  'DEPUTY_SECRETARY',
  'BOARD_MEMBER',
  'AUDITOR',
  'OTHER',
] as const
export type MandateRole = (typeof MANDATE_ROLES)[number]
export const MANDATE_ROLE_LABELS: Record<MandateRole, string> = {
  PRESIDENT: 'Président',
  VICE_PRESIDENT: 'Vice-président',
  TREASURER: 'Trésorier',
  DEPUTY_TREASURER: 'Trésorier adjoint',
  SECRETARY: 'Secrétaire',
  DEPUTY_SECRETARY: 'Secrétaire adjoint',
  BOARD_MEMBER: 'Administrateur',
  AUDITOR: 'Commissaire aux comptes',
  OTHER: 'Autre',
}

export const DOCUMENT_VISIBILITIES = ['PRIVATE', 'MEMBERS', 'PUBLIC'] as const
export type DocumentVisibility = (typeof DOCUMENT_VISIBILITIES)[number]
export const DOCUMENT_VISIBILITY_LABELS: Record<DocumentVisibility, string> = {
  PRIVATE: 'Bureau uniquement',
  MEMBERS: 'Tous les adhérents',
  PUBLIC: 'Public',
}
