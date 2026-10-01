/**
 * Texto de `def` en la malla del docente.
 * Copia `compute_suggested_grade`, `_segment_average` y `_weighted_average`
 * de `backend/core/grading_suggestion_service.py`: promedio simple del
 * segmento, ponderado que descarta tramos vacíos y renormaliza, y half-up
 * a centésimas con enteros (no `Math.round` sobre un float).
 * Con la fila incompleta o pesos inválidos el texto es "0" y no se persiste.
 */

const SCALE = 8
const SCALE_FACTOR = 10n ** BigInt(SCALE)
const CENTS_SHIFT = 10n ** BigInt(SCALE - 2)

export type GradeGridStructure = {
  weightsValid: boolean
  components: Array<{ id: string; weightPercent: string | null; sortOrder: number }>
  segments: Array<{
    id: string
    componentId: string
    weightPercent: string | null
    sortOrder: number
  }>
  activities: Array<{ id: string; segmentId: string; sortOrder: number }>
}

function hasScore(score: string | null | undefined): boolean {
  return score != null && score.trim() !== ''
}

function parseScaled(input: string): bigint | null {
  const normalized = input.trim().replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null
  const negative = normalized.startsWith('-')
  const body = negative ? normalized.slice(1) : normalized
  const [whole, frac = ''] = body.split('.')
  const digits = (frac + '0'.repeat(SCALE)).slice(0, SCALE)
  let value = BigInt(whole || '0') * SCALE_FACTOR + BigInt(digits || '0')
  const extra = frac.slice(SCALE)
  if (extra.length > 0 && extra[0]! >= '5') value += 1n
  return negative ? -value : value
}

function formatCents(cents: bigint): string {
  const negative = cents < 0n
  const abs = negative ? -cents : cents
  const whole = abs / 100n
  const frac = (abs % 100n).toString().padStart(2, '0')
  return `${negative ? '-' : ''}${whole}.${frac}`
}

/** Divide y cuantiza a 2 decimales, half away from zero. */
function quantizeDiv(numerator: bigint, denominator: bigint): string | null {
  if (denominator === 0n) return null
  const negative = (numerator < 0n) !== (denominator < 0n)
  const n = numerator < 0n ? -numerator : numerator
  const d = denominator < 0n ? -denominator : denominator
  const quotient = n / d
  const remainder = n % d
  const rounded = remainder * 2n >= d ? quotient + 1n : quotient
  return formatCents(negative ? -rounded : rounded)
}

function segmentAverage(scores: Array<string | null>): string | null {
  const values: bigint[] = []
  for (const score of scores) {
    if (!hasScore(score)) continue
    const parsed = parseScaled(score as string)
    if (parsed == null) continue
    values.push(parsed)
  }
  if (values.length === 0) return null
  const total = values.reduce((sum, value) => sum + value, 0n)
  return quantizeDiv(total, BigInt(values.length) * CENTS_SHIFT)
}

function weightedAverage(
  items: Array<{ value: string | null; weight: string | null }>,
): string | null {
  let weightedSum = 0n
  let weightTotal = 0n
  for (const item of items) {
    if (item.value == null || item.weight == null) continue
    const value = parseScaled(item.value)
    const weight = parseScaled(item.weight)
    if (value == null || weight == null) continue
    weightedSum += value * weight
    weightTotal += weight
  }
  if (weightTotal <= 0n) return null
  return quantizeDiv(weightedSum, weightTotal * CENTS_SHIFT)
}

function bySortOrder<T extends { sortOrder: number }>(a: T, b: T): number {
  return a.sortOrder - b.sortOrder
}

function activityIdsOf(structure: GradeGridStructure): string[] {
  return [...structure.activities].sort(bySortOrder).map((activity) => activity.id)
}

function computeSuggestedGrade(
  structure: GradeGridStructure,
  scores: ReadonlyMap<string, string | null>,
): string | null {
  const components = [...structure.components].sort(bySortOrder)
  const segments = [...structure.segments].sort(bySortOrder)
  const activities = [...structure.activities].sort(bySortOrder)

  const componentItems = components.map((component) => {
    const segmentItems = segments
      .filter((segment) => segment.componentId === component.id)
      .map((segment) => ({
        value: segmentAverage(
          activities
            .filter((activity) => activity.segmentId === segment.id)
            .map((activity) => scores.get(activity.id) ?? null),
        ),
        weight: segment.weightPercent,
      }))
    return {
      value: weightedAverage(segmentItems),
      weight: component.weightPercent,
    }
  })
  return weightedAverage(componentItems)
}

export function isRowComplete(
  activityIds: readonly string[],
  scores: ReadonlyMap<string, string | null>,
): boolean {
  if (activityIds.length === 0) return false
  return activityIds.every((activityId) => hasScore(scores.get(activityId)))
}

/** Un segmento sin actividades no entra al promedio: la malla no está lista para aplicar. */
export function everySegmentHasActivity(structure: GradeGridStructure): boolean {
  if (structure.segments.length === 0) return false
  const covered = new Set(structure.activities.map((activity) => activity.segmentId))
  return structure.segments.every((segment) => covered.has(segment.id))
}

export function isGridComplete(
  activityIds: readonly string[],
  rows: ReadonlyArray<ReadonlyMap<string, string | null>>,
  weightsValid: boolean,
): boolean {
  if (!weightsValid || rows.length === 0) return false
  return rows.every((scores) => isRowComplete(activityIds, scores))
}

/** "0" o un decimal de 2 cifras. Nunca null. */
export function displayDef(
  structure: GradeGridStructure,
  scores: ReadonlyMap<string, string | null>,
): string {
  if (!structure.weightsValid) return '0'
  if (!everySegmentHasActivity(structure)) return '0'
  if (!isRowComplete(activityIdsOf(structure), scores)) return '0'
  return computeSuggestedGrade(structure, scores) ?? '0'
}
