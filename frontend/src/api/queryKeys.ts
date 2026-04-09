export const queryKeys = {
  me: ['auth', 'me'] as const,
  institutions: (search?: string) => ['institutions', { search }] as const,
  institution: (id: string) => ['institutions', id] as const,
  campuses: (institutionId?: string | null, search?: string) =>
    ['campuses', { institutionId, search }] as const,
  campus: (id: string) => ['campuses', id] as const,
  students: (search?: string) => ['students', { search }] as const,
  student: (id: string) => ['students', id] as const,
  studentGradesSummary: (id: string) => ['students', id, 'grades-summary'] as const,
  groupRankings: (groupId: string) => ['groups', groupId, 'rankings'] as const,
  resourceList: (
    segment: string,
    params: Record<string, string | undefined>,
  ) => ['resource', segment, params] as const,
  academicYears: (institutionId?: string | null) =>
    ['academic-years', { institutionId }] as const,
  academicPeriods: (academicYearId?: string | null, search?: string) =>
    ['academic-periods', { academicYearId, search }] as const,
  gradeLevels: (institutionId?: string | null) =>
    ['grade-levels', { institutionId }] as const,
  groups: (
    filters: Record<string, string | undefined>,
    search?: string,
  ) => ['groups', 'list', filters, search] as const,
  academicAreas: (institutionId?: string | null) =>
    ['academic-areas', { institutionId }] as const,
  subjects: (institutionId?: string | null, search?: string) =>
    ['subjects', { institutionId, search }] as const,
  enrollments: (params: Record<string, string | undefined>) =>
    ['enrollments', params] as const,
  courseAssignments: (params: Record<string, string | undefined>) =>
    ['course-assignments', params] as const,
  grades: (params: Record<string, string | undefined>) =>
    ['grades', params] as const,
  gradingScales: (institutionId?: string | null, search?: string) =>
    ['grading-scales', { institutionId, search: search ?? '' }] as const,
  academicIndicators: (params: Record<string, string | undefined>) =>
    ['academic-indicators', params] as const,
  performanceSummaries: (params: Record<string, string | undefined>) =>
    ['performance-summaries', params] as const,
  attendances: (params: Record<string, string | undefined>) =>
    ['attendances', params] as const,
  disciplinaryReports: (params: Record<string, string | undefined>) =>
    ['disciplinary-reports', params] as const,
  schoolRecords: (params: Record<string, string | undefined>) =>
    ['school-records', params] as const,
  academicIndicatorsReports: (params: Record<string, string | undefined>) =>
    ['academic-indicators-reports', params] as const,
  teachers: (search?: string) => ['teachers', 'list', search] as const,
  gradeDirectors: (params: Record<string, string | undefined>) =>
    ['grade-directors', params] as const,
  /** GET /api/school-records/{student_id}/{academic_year_id}/ */
  schoolRecordComposite: (studentId: string, academicYearId: string) =>
    ['school-records', 'composite', studentId, academicYearId] as const,
  /** GET /api/academic-indicators-reports/{student_id}/{period_id}/ */
  academicIndicatorsReportComposite: (studentId: string, periodId: string) =>
    ['academic-indicators-reports', 'composite', studentId, periodId] as const,
}
