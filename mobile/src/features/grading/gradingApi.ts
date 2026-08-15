import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import { fetchAllPages } from '@/api/list'
import { queryKeys } from '@/api/queryKeys'
import {
  deriveActivityGradeStatus,
  parseMaxScore,
  type ActivityGradeStatus,
} from '@/features/grading/activityStatus'
import { fetchEnrollments } from '@/features/students/enrollmentsApi'
import { todayIso } from '@/session/periodUtils'
import type {
  ApplySuggestionBulkResponse,
  ApplySuggestionResponse,
  ComponentSegment,
  ComponentSegmentRequest,
  Enrollment,
  GradeBreakdown,
  GradingActivity,
  GradingActivityRequest,
  GradingScheme,
  GradingSchemeRequest,
  PatchedComponentSegmentRequest,
  PatchedGradingActivityRequest,
  PatchedStudentActivityScoreRequest,
  StudentActivityScore,
  StudentActivityScoreRequest,
  SubjectComponent,
  ValidateWeights,
} from '@/types/schemas'

export type {
  ComponentSegment,
  GradingActivity,
  GradingScheme,
  StudentActivityScore,
  SubjectComponent,
}

export type EnrichedActivity = GradingActivity & {
  status: ActivityGradeStatus
  gradedCount: number
  pendingCount: number
  maxScoreNumber: number
}

export type CourseActivitiesBundle = {
  scheme: GradingScheme | null
  components: SubjectComponent[]
  segments: ComponentSegment[]
  activities: EnrichedActivity[]
  scores: StudentActivityScore[]
  enrollments: Enrollment[]
  enrollmentCount: number
}

export async function fetchGradingSchemes(params: {
  course_assignment: string
  academic_period: string
}): Promise<GradingScheme[]> {
  return fetchAllPages<GradingScheme>('/api/grading-schemes/', {
    course_assignment: params.course_assignment,
    academic_period: params.academic_period,
  })
}

export async function fetchSubjectComponents(
  subjectId: string,
): Promise<SubjectComponent[]> {
  return fetchAllPages<SubjectComponent>('/api/subject-components/', {
    subject: subjectId,
    ordering: 'sort_order',
  })
}

export async function fetchComponentSegments(
  schemeId: string,
): Promise<ComponentSegment[]> {
  return fetchAllPages<ComponentSegment>('/api/component-segments/', {
    grading_scheme: schemeId,
    ordering: 'sort_order',
  })
}

export async function fetchGradingActivitiesForScheme(
  schemeId: string,
): Promise<GradingActivity[]> {
  return fetchAllPages<GradingActivity>('/api/grading-activities/', {
    segment__grading_scheme: schemeId,
    ordering: 'sort_order',
  })
}

export async function fetchStudentActivityScoresForScheme(
  schemeId: string,
): Promise<StudentActivityScore[]> {
  return fetchAllPages<StudentActivityScore>('/api/student-activity-scores/', {
    activity__segment__grading_scheme: schemeId,
  })
}

export async function fetchStudentActivityScoresForActivity(
  activityId: string,
): Promise<StudentActivityScore[]> {
  return fetchAllPages<StudentActivityScore>('/api/student-activity-scores/', {
    activity: activityId,
  })
}

export async function createStudentActivityScore(
  body: StudentActivityScoreRequest,
): Promise<StudentActivityScore> {
  const { data } = await apiClient.post<StudentActivityScore>(
    '/api/student-activity-scores/',
    body,
  )
  return data
}

export async function patchStudentActivityScore(
  id: string,
  body: PatchedStudentActivityScoreRequest,
): Promise<StudentActivityScore> {
  const { data } = await apiClient.patch<StudentActivityScore>(
    `/api/student-activity-scores/${id}/`,
    body,
  )
  return data
}

function pickScheme(schemes: GradingScheme[]): GradingScheme | null {
  if (schemes.length === 0) return null
  return schemes.find((s) => s.is_active) ?? schemes[0] ?? null
}

function scoresByActivity(
  scores: StudentActivityScore[],
): Map<string, StudentActivityScore[]> {
  const map = new Map<string, StudentActivityScore[]>()
  for (const score of scores) {
    const list = map.get(score.activity) ?? []
    list.push(score)
    map.set(score.activity, list)
  }
  return map
}

function enrichActivities(
  activities: GradingActivity[],
  scores: StudentActivityScore[],
  enrollmentCount: number,
  today: string,
): EnrichedActivity[] {
  const byActivity = scoresByActivity(scores)
  return [...activities]
    .sort((a, b) => {
      const dateCmp = a.activity_date.localeCompare(b.activity_date)
      if (dateCmp !== 0) return dateCmp
      return (a.sort_order ?? 0) - (b.sort_order ?? 0)
    })
    .map((activity) => {
      const activityScores = byActivity.get(activity.id) ?? []
      const gradedCount = activityScores.filter((s) =>
        s.score != null && String(s.score).trim() !== '',
      ).length
      return {
        ...activity,
        status: deriveActivityGradeStatus(
          activity.activity_date,
          today,
          enrollmentCount,
          activityScores,
        ),
        gradedCount,
        pendingCount: Math.max(0, enrollmentCount - gradedCount),
        maxScoreNumber: parseMaxScore(activity.max_score),
      }
    })
}

export async function fetchCourseActivitiesBundle(params: {
  courseAssignmentId: string
  academicPeriodId: string
  groupId: string
  academicYearId: string
  subjectId: string
}): Promise<CourseActivitiesBundle> {
  const schemes = await fetchGradingSchemes({
    course_assignment: params.courseAssignmentId,
    academic_period: params.academicPeriodId,
  })
  const scheme = pickScheme(schemes)
  const enrollments = await fetchEnrollments({
    group: params.groupId,
    academic_year: params.academicYearId,
    status: 'active',
  })
  const enrollmentCount = enrollments.length

  if (!scheme) {
    return {
      scheme: null,
      components: [],
      segments: [],
      activities: [],
      scores: [],
      enrollments,
      enrollmentCount,
    }
  }

  const [components, segments, activities, scores] = await Promise.all([
    fetchSubjectComponents(params.subjectId),
    fetchComponentSegments(scheme.id),
    fetchGradingActivitiesForScheme(scheme.id),
    fetchStudentActivityScoresForScheme(scheme.id),
  ])

  return {
    scheme,
    components,
    segments,
    activities: enrichActivities(activities, scores, enrollmentCount, todayIso()),
    scores,
    enrollments,
    enrollmentCount,
  }
}

export type CourseActivitiesParams = {
  courseAssignmentId: string
  academicPeriodId: string
  groupId: string
  academicYearId: string
  subjectId: string
}

export async function validateGradingSchemeWeights(
  schemeId: string,
): Promise<ValidateWeights> {
  const { data } = await apiClient.get<ValidateWeights>(
    `/api/grading-schemes/${schemeId}/validate-weights/`,
  )
  return data
}

export async function fetchApplySuggestionBulkPreview(
  schemeId: string,
): Promise<ApplySuggestionBulkResponse> {
  const { data } = await apiClient.get<ApplySuggestionBulkResponse>(
    `/api/grading-schemes/${schemeId}/apply-suggestion-bulk-preview/`,
  )
  return data
}

export async function applyGradingSchemeSuggestionBulk(
  schemeId: string,
): Promise<ApplySuggestionBulkResponse> {
  const { data } = await apiClient.post<ApplySuggestionBulkResponse>(
    `/api/grading-schemes/${schemeId}/apply-suggestion-bulk/`,
    { dry_run: false },
  )
  return data
}

export async function applyGradingSchemeSuggestion(
  schemeId: string,
  studentId: string,
): Promise<ApplySuggestionResponse> {
  const { data } = await apiClient.post<ApplySuggestionResponse>(
    `/api/grading-schemes/${schemeId}/apply-suggestion/`,
    { student: studentId },
  )
  return data
}

export async function fetchSuggestedGrade(params: {
  student: string
  course_assignment: string
  academic_period: string
}): Promise<GradeBreakdown> {
  const { data } = await apiClient.get<GradeBreakdown>('/api/grades/suggested/', {
    params,
  })
  return data
}

export function schemeWeightsValid(scheme: GradingScheme | null | undefined): boolean {
  if (!scheme) return false
  return Boolean(scheme.segment_weights_valid && scheme.subject_component_weights_valid)
}

export function useValidateWeightsQuery(schemeId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.gradingSchemeValidateWeights(schemeId),
    queryFn: () => validateGradingSchemeWeights(schemeId!),
    enabled: Boolean(schemeId),
  })
}

export function useApplySuggestionBulkPreviewQuery(
  schemeId: string | null | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.gradingSchemeBulkPreview(schemeId),
    queryFn: () => fetchApplySuggestionBulkPreview(schemeId!),
    enabled: Boolean(schemeId) && enabled,
  })
}

export function useCourseActivitiesBundle(params: CourseActivitiesParams | null) {
  return useQuery({
    queryKey: queryKeys.courseActivitiesBundle(
      params?.courseAssignmentId,
      params?.academicPeriodId,
    ),
    queryFn: () => fetchCourseActivitiesBundle(params!),
    enabled: Boolean(
      params?.courseAssignmentId &&
        params?.academicPeriodId &&
        params?.groupId &&
        params?.academicYearId &&
        params?.subjectId,
    ),
  })
}

export async function createGradingScheme(
  body: GradingSchemeRequest,
): Promise<GradingScheme> {
  const { data } = await apiClient.post<GradingScheme>(
    '/api/grading-schemes/',
    body,
  )
  return data
}

export async function createComponentSegment(
  body: ComponentSegmentRequest,
): Promise<ComponentSegment> {
  const { data } = await apiClient.post<ComponentSegment>(
    '/api/component-segments/',
    body,
  )
  return data
}

export async function patchComponentSegment(
  id: string,
  body: PatchedComponentSegmentRequest,
): Promise<ComponentSegment> {
  const { data } = await apiClient.patch<ComponentSegment>(
    `/api/component-segments/${id}/`,
    body,
  )
  return data
}

export async function deleteComponentSegment(id: string): Promise<void> {
  await apiClient.delete(`/api/component-segments/${id}/`)
}

export async function createGradingActivity(
  body: GradingActivityRequest,
): Promise<GradingActivity> {
  const { data } = await apiClient.post<GradingActivity>(
    '/api/grading-activities/',
    body,
  )
  return data
}

export async function patchGradingActivity(
  id: string,
  body: PatchedGradingActivityRequest,
): Promise<GradingActivity> {
  const { data } = await apiClient.patch<GradingActivity>(
    `/api/grading-activities/${id}/`,
    body,
  )
  return data
}

export async function deleteGradingActivity(id: string): Promise<void> {
  await apiClient.delete(`/api/grading-activities/${id}/`)
}

function invalidatePlanQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['grading'] })
  void queryClient.invalidateQueries({ queryKey: ['grading-schemes'] })
  void queryClient.invalidateQueries({ queryKey: ['component-segments'] })
  void queryClient.invalidateQueries({ queryKey: ['grading-activities'] })
  void queryClient.invalidateQueries({ queryKey: ['student-activity-scores'] })
}

export function useCreateGradingSchemeMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createGradingScheme,
    onSuccess: () => invalidatePlanQueries(queryClient),
  })
}

export function useCreateComponentSegmentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createComponentSegment,
    onSuccess: () => invalidatePlanQueries(queryClient),
  })
}

export function usePatchComponentSegmentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: PatchedComponentSegmentRequest
    }) => patchComponentSegment(id, body),
    onSuccess: () => invalidatePlanQueries(queryClient),
  })
}

export function useDeleteComponentSegmentMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteComponentSegment,
    onSuccess: () => invalidatePlanQueries(queryClient),
  })
}

export function useCreateGradingActivityMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createGradingActivity,
    onSuccess: () => invalidatePlanQueries(queryClient),
  })
}

export function usePatchGradingActivityMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: PatchedGradingActivityRequest
    }) => patchGradingActivity(id, body),
    onSuccess: () => invalidatePlanQueries(queryClient),
  })
}

export function useDeleteGradingActivityMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteGradingActivity,
    onSuccess: () => invalidatePlanQueries(queryClient),
  })
}
