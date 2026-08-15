export type DashboardKpiScope =
  | 'global'
  | 'institution'
  | 'teacher'
  | 'parent'
  | 'none'

export type DashboardGradesPeriodKpi = {
  academic_period_id: string
  academic_period_name: string
  academic_year_id: string
  expected_slots: number
  filled_slots: number
  pending_slots: number
  pending_students: number
}

export type DashboardKpisResponse = {
  scope: DashboardKpiScope
  institution_id: string | null
  counts: Record<string, number>
  grades_period: DashboardGradesPeriodKpi | null
}
