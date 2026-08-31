'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  BarChart3,
  CalendarDays,
  FileText,
  Gavel,
  Home,
  MoreHorizontal,
  Receipt,
  Settings,
  Users,
} from 'lucide-react'

import { cn } from '@/components/ui'
import type { ModuleKey } from '@/lib/modules'
import type { Permission } from '@/lib/permissions'

const ICONS = {
  today: Home,
  members: Users,
  dues: Receipt,
  finance: BarChart3,
  events: CalendarDays,
  governance: Gavel,
  documents: FileText,
  settings: Settings,
} as const

export type NavItem = {
  href: string
  label: string
  /** Libellé court, pour la barre du bas sur mobile. */
  short: string
  icon: keyof typeof ICONS
  /** Permission requise ; l'entrée est masquée si l'utilisateur ne l'a pas. */
  permission?: Permission
  /** Module requis ; l'entrée est masquée si l'association ne l'a pas activé. */
  module?: ModuleKey
  /**
   * Entrée de premier rang : toujours visible, y compris dans la barre du bas
   * sur mobile. Les autres sont regroupées sous « Gestion ».
   */
  principal?: boolean
  /**
   * Nombre à signaler par une pastille.
   *
   * Une seule entrée en porte une, et seulement pour ce qui ne peut pas
   * attendre. Tout marquer d'un point rouge revient à ne rien marquer : on
   * apprend à ne plus les voir, y compris le jour où l'un compte vraiment.
   */
  badge?: number
}

function Badge({ value, label }: { value: number | undefined; label: string }) {
  if (!value || value <= 0) return null

  return (
    <span
      className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-warning px-1.5 text-xs font-semibold text-signal-ink"
      aria-label={`${value} en attente — ${label}`}
    >
      {value > 99 ? '99+' : value}
    </span>
  )
}

function useIsActive() {
  const pathname = usePathname()
  // `startsWith` pour que les sous-pages (fiche adhérent) gardent leur
  // rubrique parente surlignée.
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`)
}

/** Barre latérale, écrans larges. */
export function AppNav({ items }: { items: NavItem[] }) {
  const isActive = useIsActive()
  const principales = items.filter((item) => item.principal)
  const secondaires = items.filter((item) => !item.principal)

  return (
    <nav className="space-y-0.5" aria-label="Navigation principale">
      {principales.map((item) => (
        <NavLink key={item.href} item={item} active={isActive(item.href)} />
      ))}

      {secondaires.length > 0 ? (
        <>
          <span className="block px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Gestion
          </span>
          {secondaires.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </>
      ) : null}
    </nav>
  )
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = ICONS[item.icon]

  return (
    <Link
      href={item.href as Route}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-brand-soft font-medium text-brand-dark'
          : 'text-ink-soft hover:bg-surface-muted hover:text-ink',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="truncate">{item.label}</span>
      <Badge value={item.badge} label={item.label} />
    </Link>
  )
}

/**
 * Barre du bas, mobile : les entrées de premier rang, et un bouton « Plus »
 * pour le reste.
 *
 * Le total des pastilles cachées remonte sur « Plus », sans quoi une relance
 * en retard resterait invisible jusqu'à ce qu'on pense à aller voir.
 */
export function MobileNav({ items }: { items: NavItem[] }) {
  const isActive = useIsActive()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const principales = items.filter((item) => item.principal)
  const secondaires = items.filter((item) => !item.principal)
  const hiddenBadges = secondaires.reduce((sum, item) => sum + (item.badge ?? 0), 0)

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface md:hidden"
        aria-label="Navigation"
      >
        {principales.map((item) => {
          const Icon = ICONS[item.icon]
          const active = isActive(item.href)

          return (
            <Link
              key={item.href}
              href={item.href as Route}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-1 py-2 text-xs',
                active ? 'font-medium text-brand-dark' : 'text-ink-soft',
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
              {item.short}
              {item.badge && item.badge > 0 ? (
                <span className="absolute right-[22%] top-1 h-2 w-2 rounded-full bg-warning" />
              ) : null}
            </Link>
          )
        })}

        {secondaires.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="relative flex flex-1 flex-col items-center gap-1 py-2 text-xs text-ink-soft"
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden />
            Plus
            {hiddenBadges > 0 ? (
              <span className="absolute right-[22%] top-1 h-2 w-2 rounded-full bg-warning" />
            ) : null}
          </button>
        ) : null}
      </nav>

      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Fermer"
            className="absolute inset-0 bg-ink/30"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-line bg-surface px-3 pb-6 pt-4">
            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Gestion
            </p>
            <div className="space-y-0.5">
              {secondaires.map((item) => {
                const Icon = ICONS[item.icon]

                return (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => {
                      router.push(item.href as Route)
                      setOpen(false)
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-ink hover:bg-surface-muted"
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    {item.label}
                    <Badge value={item.badge} label={item.label} />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
