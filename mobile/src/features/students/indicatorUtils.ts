import { isLowPerformanceGrade, levelFromGrade } from '@/features/grades/scaleUtils'
import type {
  AcademicIndicator,
  AcademicIndicatorCatalog,
  Grade,
  GradingScale,
  OutcomeEnum,
} from '@/types/schemas'

export type IndicatorOutcome = OutcomeEnum

export function catalogMatchesPeriod(
  catalog: AcademicIndicatorCatalog,
  periodNumber: number,
): boolean {
  return catalog.period_number == null || Number(catalog.period_number) === periodNumber
}

export function matchingCatalogs(
  catalogs: AcademicIndicatorCatalog[],
  academicAreaId: string | null | undefined,
  gradeLevelId: string | null | undefined,
  periodNumber: number | null | undefined,
): AcademicIndicatorCatalog[] {
  if (!academicAreaId || !gradeLevelId || periodNumber == null) return []
  return catalogs
    .filter(
      (c) =>
        c.academic_area === academicAreaId &&
        c.grade_level === gradeLevelId &&
        catalogMatchesPeriod(c, periodNumber),
    )
    .sort((a, b) => {
      const aSpecific = a.period_number != null ? 0 : 1
      const bSpecific = b.period_number != null ? 0 : 1
      return aSpecific - bSpecific
    })
}

export function pickCatalog(
  catalogs: AcademicIndicatorCatalog[],
  academicAreaId: string | null | undefined,
  gradeLevelId: string | null | undefined,
  periodNumber: number | null | undefined,
): AcademicIndicatorCatalog | null {
  return matchingCatalogs(catalogs, academicAreaId, gradeLevelId, periodNumber)[0] ?? null
}

export function outcomeFromGrade(
  grade: Grade | null | undefined,
  scales: GradingScale[],
): IndicatorOutcome | null {
  if (!grade) return null
  if (isLowPerformanceGrade(grade, scales)) return 'below_basic'
  const level = levelFromGrade(grade, scales)
  if (level) return 'basic_or_above'
  if (grade.numerical_grade != null && String(grade.numerical_grade).trim() !== '') {
    return 'basic_or_above'
  }
  return null
}

export function outcomeLabel(outcome: string | null | undefined): string | null {
  if (outcome === 'below_basic') return 'Por debajo de básico'
  if (outcome === 'basic_or_above') return 'Básico o superior'
  return null
}

export function catalogTextForOutcome(
  catalog: AcademicIndicatorCatalog | null | undefined,
  outcome: IndicatorOutcome | null | undefined,
): string {
  if (!catalog || !outcome) return ''
  return outcome === 'below_basic'
    ? catalog.achievement_below_basic
    : catalog.achievement_basic_or_above
}

export function performanceLevelText(
  grade: Grade | null | undefined,
  scales: GradingScale[],
): string {
  if (!grade) return ''
  const level = levelFromGrade(grade, scales)
  if (level) return level
  return (grade.performance_level_name ?? '').trim()
}

export function pickIndicatorForCourse(
  rows: AcademicIndicator[],
  courseAssignmentId: string,
  periodId: string,
): AcademicIndicator | null {
  return (
    rows.find(
      (r) => r.course_assignment === courseAssignmentId && r.academic_period === periodId,
    ) ??
    rows.find((r) => r.course_assignment === courseAssignmentId) ??
    null
  )
}
