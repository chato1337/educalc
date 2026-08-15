import type { StudentActivityScore } from '@/types/schemas'

export type ActivityGradeStatus = 'planned' | 'pending' | 'graded'

export function isScoreFilled(score: string | null | undefined): boolean {
  return score != null && String(score).trim() !== ''
}

export function parseDecimal(value: string | null | undefined): number | null {
  if (value == null || value.trim() === '' || value.trim() === '.') return null
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Serialize keypad input to an OpenAPI decimal. Empty → null (pending, not 0.00). */
export function serializeScore(raw: string): string | null {
  const n = parseDecimal(raw)
  if (n == null) return null
  return n.toFixed(2)
}

export function formatScoreDisplay(score: string | null | undefined): string {
  const n = parseDecimal(score ?? null)
  if (n == null) return '—'
  return n.toFixed(2)
}

export function parseMaxScore(value: string | null | undefined): number {
  return parseDecimal(value) ?? 5
}

export function deriveActivityGradeStatus(
  activityDate: string,
  today: string,
  enrollmentCount: number,
  scores: Pick<StudentActivityScore, 'score'>[],
): ActivityGradeStatus {
  const filled = scores.filter((s) => isScoreFilled(s.score)).length
  if (enrollmentCount > 0 && filled >= enrollmentCount) return 'graded'
  if (activityDate > today && filled === 0) return 'planned'
  return 'pending'
}
