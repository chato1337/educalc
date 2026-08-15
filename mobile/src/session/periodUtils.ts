import type { Period } from '@/data'
import type { AcademicPeriod, AcademicYear } from '@/types/schemas'

export function todayIso(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

export function isPeriodCurrent(period: AcademicPeriod, now = new Date()): boolean {
  if (!period.start_date || !period.end_date) return false
  const t = todayIso(now)
  return period.start_date <= t && t <= period.end_date
}

export function toSessionPeriod(period: AcademicPeriod, now = new Date()): Period {
  return {
    id: period.id,
    name: period.name,
    shortName: period.number ? `P${period.number}` : period.name,
    start: formatShortDate(period.start_date),
    end: formatShortDate(period.end_date),
    active: isPeriodCurrent(period, now),
    number: period.number,
  }
}

export function pickActiveAcademicYear(
  years: AcademicYear[],
): AcademicYear | null {
  if (years.length === 0) return null
  const active = years.find((y) => y.is_active)
  if (active) return active
  return [...years].sort((a, b) => b.year - a.year)[0] ?? null
}

export function formatLongDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(date.getTime())) return iso
  const label = date.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function pickDefaultPeriodId(periods: AcademicPeriod[]): string | null {
  if (periods.length === 0) return null
  const current = periods.find((p) => isPeriodCurrent(p))
  if (current) return current.id
  const sorted = [...periods].sort((a, b) => b.number - a.number)
  return sorted[0]?.id ?? null
}
