import type { PerformanceLevel } from '@/data'
import { parseDecimal } from '@/features/grading/activityStatus'
import type { Grade, GradingScale } from '@/types/schemas'

const LEVELS: PerformanceLevel[] = ['SP', 'AL', 'BS', 'BJ']

export function scaleCodeToLevel(
  code: string | null | undefined,
): PerformanceLevel | null {
  const c = (code ?? '').trim().toUpperCase()
  return LEVELS.includes(c as PerformanceLevel) ? (c as PerformanceLevel) : null
}

export function isLowPerformanceScale(scale: GradingScale): boolean {
  return (
    scale.code.trim().toUpperCase() === 'BJ' ||
    scale.name.trim().toLowerCase() === 'bajo'
  )
}

export function levelFromScaleId(
  scaleId: string | null | undefined,
  scales: GradingScale[],
): PerformanceLevel | null {
  if (!scaleId) return null
  const scale = scales.find((s) => s.id === scaleId)
  return scale ? scaleCodeToLevel(scale.code) : null
}

export function levelFromGrade(
  grade: Pick<Grade, 'performance_level' | 'performance_level_name'>,
  scales: GradingScale[],
): PerformanceLevel | null {
  const fromId = levelFromScaleId(grade.performance_level, scales)
  if (fromId) return fromId
  const name = (grade.performance_level_name ?? '').toLowerCase()
  if (name.includes('superior')) return 'SP'
  if (name.includes('alto')) return 'AL'
  if (name.includes('básico') || name.includes('basico')) return 'BS'
  if (name.includes('bajo')) return 'BJ'
  return null
}

export function scaleForScore(
  score: number,
  scales: GradingScale[],
): GradingScale | null {
  return (
    scales.find((s) => {
      const min = parseDecimal(s.min_score)
      const max = parseDecimal(s.max_score)
      if (min == null || max == null) return false
      return score >= min && score <= max
    }) ?? null
  )
}

/** BJ-eligible: BJ/Bajo scale; fallback ≤ 2.99 only when no scale exists. */
export function isLowPerformanceGrade(grade: Grade, scales: GradingScale[]): boolean {
  const n = parseDecimal(grade.numerical_grade)
  if (n == null) return false
  if (grade.performance_level) {
    const scale = scales.find((s) => s.id === grade.performance_level)
    if (scale) return isLowPerformanceScale(scale)
  }
  const low = scales.find(isLowPerformanceScale)
  if (low) {
    const max = parseDecimal(low.max_score)
    return max != null && n <= max
  }
  return n <= 2.99
}
