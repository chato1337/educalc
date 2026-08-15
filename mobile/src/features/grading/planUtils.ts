import type { ComponentSegment, GradingActivity, SubjectComponent } from '@/types/schemas'

export const WEIGHT_SUM_TOLERANCE = 0.01

export const SEGMENT_TEMPLATES = [
  { id: 'evaluations', name: 'Evaluaciones', defaultWeight: '40' },
  { id: 'workshops', name: 'Talleres', defaultWeight: '30' },
  { id: 'presentations', name: 'Exposiciones', defaultWeight: '20' },
  { id: 'homework', name: 'Tareas', defaultWeight: '10' },
] as const

export function parseWeightPercent(value: string | null | undefined): number | null {
  if (value == null || String(value).trim() === '') return null
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function segmentWeightTotal(
  segments: ComponentSegment[],
  componentId: string,
  excludeSegmentId?: string | null,
): number {
  return segments
    .filter(
      (s) =>
        s.subject_component === componentId &&
        (!excludeSegmentId || s.id !== excludeSegmentId),
    )
    .reduce((sum, s) => sum + (parseWeightPercent(s.weight_percent) ?? 0), 0)
}

export function remainingWeightForComponent(
  segments: ComponentSegment[],
  componentId: string,
  excludeSegmentId?: string | null,
): number {
  return Math.max(0, 100 - segmentWeightTotal(segments, componentId, excludeSegmentId))
}

export function componentWeightsValid(components: SubjectComponent[]): boolean {
  if (components.length === 0) return false
  const total = components.reduce(
    (sum, c) => sum + (parseWeightPercent(c.weight_percent) ?? 0),
    0,
  )
  return Math.abs(total - 100) <= WEIGHT_SUM_TOLERANCE
}

export function formatWeight(value: number): string {
  return value.toFixed(2)
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1)
}

export function formatMonthYear(date: Date): string {
  const label = date.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function dateToIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Monday-first month grid with leading/trailing nulls. */
export function calendarGridDays(viewMonth: Date): (Date | null)[] {
  const first = startOfMonth(viewMonth)
  const startWeekday = (first.getDay() + 6) % 7
  const daysInMonth = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth() + 1,
    0,
  ).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < startWeekday; i += 1) cells.push(null)
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day))
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function activitiesByDate(
  activities: GradingActivity[],
): Map<string, GradingActivity[]> {
  const map = new Map<string, GradingActivity[]>()
  for (const activity of activities) {
    const list = map.get(activity.activity_date) ?? []
    list.push(activity)
    map.set(activity.activity_date, list)
  }
  return map
}
