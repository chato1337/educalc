export const queryKeys = {
  me: ['auth', 'me'] as const,
  teacher: (id: string) => ['teachers', id] as const,
  academicYears: (institutionId?: string | null) =>
    ['academic-years', { institutionId }] as const,
  academicPeriods: (academicYearId?: string | null) =>
    ['academic-periods', { academicYearId }] as const,
  gradingScales: (institutionId?: string | null) =>
    ['grading-scales', { institutionId }] as const,
  courseAssignmentsForTeacher: (
    teacherId?: string | null,
    academicYearId?: string | null,
  ) =>
    [
      'course-assignments',
      'for-teacher',
      teacherId ?? '',
      academicYearId ?? '',
    ] as const,
  gradeDirectors: (teacherId?: string | null) =>
    ['grade-directors', { teacher: teacherId ?? '' }] as const,
  dashboardKpis: (academicPeriodId?: string | null) =>
    ['dashboard', 'kpis', { academicPeriodId }] as const,
  attendances: (params: Record<string, string | boolean | undefined>) =>
    ['attendances', params] as const,
  dailyAttendances: (params: Record<string, string | undefined>) =>
    ['daily-attendances', params] as const,
  rollCallRoster: (
    groupId: string,
    date: string,
    courseAssignmentId?: string | null,
  ) =>
    [
      'daily-attendances',
      'roster',
      groupId,
      date,
      courseAssignmentId ?? 'general',
    ] as const,
  enrollments: (params: Record<string, string | undefined>) =>
    ['enrollments', params] as const,
  gradingSchemes: (params: Record<string, string | undefined>) =>
    ['grading-schemes', params] as const,
  subjectComponents: (subjectId?: string | null) =>
    ['subject-components', { subject: subjectId ?? '' }] as const,
  componentSegments: (schemeId?: string | null) =>
    ['component-segments', { grading_scheme: schemeId ?? '' }] as const,
  gradingActivities: (schemeId?: string | null) =>
    ['grading-activities', { scheme: schemeId ?? '' }] as const,
  studentActivityScores: (params: Record<string, string | undefined>) =>
    ['student-activity-scores', params] as const,
  courseActivitiesBundle: (
    courseAssignmentId?: string | null,
    academicPeriodId?: string | null,
  ) =>
    [
      'grading',
      'course-activities',
      courseAssignmentId ?? '',
      academicPeriodId ?? '',
    ] as const,
  grades: (params: Record<string, string | undefined>) =>
    ['grades', params] as const,
  gradingSchemeValidateWeights: (schemeId?: string | null) =>
    ['grading-schemes', schemeId ?? '', 'validate-weights'] as const,
  gradingSchemeBulkPreview: (schemeId?: string | null) =>
    ['grading-schemes', schemeId ?? '', 'apply-suggestion-bulk-preview'] as const,
  gradeRecoveriesEligible: (params: Record<string, string | boolean | undefined>) =>
    ['grade-recoveries', 'eligible', params] as const,
  gradeRecoveries: (params: Record<string, string | undefined>) =>
    ['grade-recoveries', params] as const,
  student: (id: string) => ['students', id] as const,
  studentGradesSummary: (id: string) =>
    ['students', id, 'grades-summary'] as const,
  studentGuardians: (studentId?: string | null) =>
    ['student-guardians', { student: studentId ?? '' }] as const,
  parent: (id: string) => ['parents', id] as const,
  academicIndicators: (params: Record<string, string | undefined>) =>
    ['academic-indicators', params] as const,
  academicIndicatorCatalogs: (params: Record<string, string | undefined>) =>
    ['academic-indicator-catalogs', params] as const,
  disciplinaryReports: (params: Record<string, string | undefined>) =>
    ['disciplinary-reports', params] as const,
  groupRankings: (groupId: string, periodId?: string | null) =>
    ['groups', groupId, 'rankings', periodId ?? 'all'] as const,
  performanceSummaries: (params: Record<string, string | undefined>) =>
    ['performance-summaries', params] as const,
  academicIndicatorsReportComposite: (studentId: string, periodId: string) =>
    ['academic-indicators-reports', 'composite', studentId, periodId] as const,
  academicIndicatorsReports: (params: Record<string, string | undefined>) =>
    ['academic-indicators-reports', params] as const,
  schoolRecordComposite: (studentId: string, academicYearId: string) =>
    ['school-records', 'composite', studentId, academicYearId] as const,
}
