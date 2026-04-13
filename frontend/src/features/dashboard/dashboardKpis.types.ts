export type DashboardKpiScope =
  | 'global'
  | 'institution'
  | 'teacher'
  | 'parent'
  | 'none'

export type DashboardKpiCounts = {
  institutions: number
  campuses: number
  academic_years: number
  academic_years_active: number
  grade_levels: number
  academic_areas: number
  subjects: number
  grading_scales: number
  groups: number
  academic_periods: number
  students: number
  teachers: number
  parents: number
  enrollments: number
  enrollments_active: number
  course_assignments: number
  grade_directors: number
  grades: number
  attendances: number
  academic_indicators: number
  performance_summaries: number
  disciplinary_reports: number
  school_records: number
  academic_indicators_reports: number
  student_guardians: number
}

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
  counts: DashboardKpiCounts
  grades_period: DashboardGradesPeriodKpi | null
}
