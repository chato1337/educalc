/**
 * Period average shown in the grade grid.
 * Mirrors `compute_suggested_grade`, `_segment_average` and `_weighted_average`
 * in `backend/core/grading_suggestion_service.py`: simple segment mean, weighted
 * mean that drops empty bands and renormalizes, then half-up to 2 decimals.
 * The grid shows this number only when every activity has a score and the
 * scheme weight flags are valid. Otherwise the cell text is "0" and nothing
 * is persisted.
 */

const SCALE = 8
const SCALE_FACTOR = 10n ** BigInt(SCALE)
const CENTS_SHIFT = 10n ** BigInt(SCALE - 2)

export type SuggestedSegmentInput = {
  weightPercent: string
  scores: Array<string | null | undefined>
}

export type SuggestedComponentInput = {
  weightPercent: string
  segments: SuggestedSegmentInput[]
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

/** Divide and quantize to 2 decimals, half away from zero. */
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

function segmentAverage(scores: Array<string | null | undefined>): string | null {
  const values: bigint[] = []
  for (const score of scores) {
    if (score == null || String(score).trim() === '') continue
    const parsed = parseScaled(String(score))
    if (parsed == null) continue
    values.push(parsed)
  }
  if (values.length === 0) return null
  const total = values.reduce((sum, value) => sum + value, 0n)
  return quantizeDiv(total, BigInt(values.length) * CENTS_SHIFT)
}

function weightedAverage(
  items: Array<{ value: string | null; weight: string }>,
): string | null {
  let weightedSum = 0n
  let weightTotal = 0n
  for (const item of items) {
    if (item.value == null) continue
    const value = parseScaled(item.value)
    const weight = parseScaled(item.weight)
    if (value == null || weight == null) continue
    weightedSum += value * weight
    weightTotal += weight
  }
  if (weightTotal <= 0n) return null
  return quantizeDiv(weightedSum, weightTotal * CENTS_SHIFT)
}

export function computeSuggestedGrade(
  components: SuggestedComponentInput[],
): string | null {
  const componentItems = components.map((component) => ({
    value: weightedAverage(
      component.segments.map((segment) => ({
        value: segmentAverage(segment.scores),
        weight: segment.weightPercent,
      })),
    ),
    weight: component.weightPercent,
  }))
  return weightedAverage(componentItems)
}

export function hasScore(score: string | null | undefined): boolean {
  return score != null && String(score).trim() !== ''
}

export function studentRowComplete(
  activityIds: readonly string[],
  scoreByActivity: ReadonlyMap<string, string | null | undefined>,
): boolean {
  if (activityIds.length === 0) return false
  return activityIds.every((activityId) => hasScore(scoreByActivity.get(activityId)))
}

export function schemeWeightsAreValid(scheme: {
  subject_component_weights_valid?: boolean
  segment_weights_valid?: boolean
}): boolean {
  return (
    scheme.subject_component_weights_valid === true &&
    scheme.segment_weights_valid === true
  )
}

/**
 * Text for the `def` cell. "0" is display-only: it is not written to a score
 * or to `Grade`.
 */
export function displayDef(params: {
  weightsValid: boolean
  activityIds: readonly string[]
  scoreByActivity: ReadonlyMap<string, string | null | undefined>
  components: SuggestedComponentInput[]
}): string {
  if (!params.weightsValid) return '0'
  if (!studentRowComplete(params.activityIds, params.scoreByActivity)) return '0'
  return computeSuggestedGrade(params.components) ?? '0'
}

export function groupCanApplySuggestion(params: {
  weightsValid: boolean
  activityCount: number
  scoredCounts: readonly number[]
}): boolean {
  if (!params.weightsValid || params.activityCount === 0) return false
  if (params.scoredCounts.length === 0) return false
  return params.scoredCounts.every((count) => count >= params.activityCount)
}
