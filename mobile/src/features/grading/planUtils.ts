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

export const SEGMENT_WEIGHT_STEP = 5
export const SEGMENT_WEIGHT_MIN = 5

/** Cumulative ends for each segment, last boundary always 100. */
export function boundariesFromWeights(weights: number[]): number[] {
  const boundaries: number[] = []
  let acc = 0
  for (let i = 0; i < weights.length; i += 1) {
    acc += weights[i] ?? 0
    boundaries.push(i === weights.length - 1 ? 100 : acc)
  }
  return boundaries
}

export function weightsFromBoundaries(boundaries: number[]): number[] {
  const weights: number[] = []
  let prev = 0
  for (let i = 0; i < boundaries.length; i += 1) {
    const end = i === boundaries.length - 1 ? 100 : (boundaries[i] ?? 100)
    weights.push(end - prev)
    prev = end
  }
  return weights
}

/** Move handle `handleIndex` (boundary 0..n-2). Neighbors stay put; snap + min weight. */
export function moveBoundary(
  boundaries: number[],
  handleIndex: number,
  rawPosition: number,
  options?: { minWeight?: number; step?: number },
): number[] {
  const minWeight = options?.minWeight ?? SEGMENT_WEIGHT_MIN
  const step = options?.step ?? SEGMENT_WEIGHT_STEP
  if (handleIndex < 0 || handleIndex >= boundaries.length - 1) {
    return boundaries.slice()
  }
  const prev = handleIndex === 0 ? 0 : (boundaries[handleIndex - 1] ?? 0)
  const next = boundaries[handleIndex + 1] ?? 100
  const minPos = prev + minWeight
  const maxPos = next - minWeight
  const lo = Math.ceil(minPos / step - 1e-9) * step
  const hi = Math.floor(maxPos / step + 1e-9) * step
  let nextPos = Math.round(rawPosition / step) * step
  if (lo <= hi) {
    nextPos = Math.min(hi, Math.max(lo, nextPos))
  } else {
    nextPos = Math.min(maxPos, Math.max(minPos, rawPosition))
  }
  const result = boundaries.slice()
  result[handleIndex] = nextPos
  if (result.length > 0) result[result.length - 1] = 100
  return result
}

export function applyBoundaryMove<T extends { weight: number }>(
  items: T[],
  handleIndex: number,
  rawPosition: number,
  options?: { minWeight?: number; step?: number },
): T[] {
  const nextWeights = weightsFromBoundaries(
    moveBoundary(
      boundariesFromWeights(items.map((item) => item.weight)),
      handleIndex,
      rawPosition,
      options,
    ),
  )
  return items.map((item, i) => ({
    ...item,
    weight: nextWeights[i] ?? item.weight,
  }))
}

export function canResizeSegmentWeights(
  segmentCount: number,
  remaining: number,
): boolean {
  return segmentCount >= 2 && remaining <= WEIGHT_SUM_TOLERANCE
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
