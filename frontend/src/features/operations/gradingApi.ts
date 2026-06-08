import { apiClient } from '@/api/client'
import { fetchReferenceListResults, type PaginatedList } from '@/api/list'
import type { components } from '@/types/openapi'

export type GradingScheme = components['schemas']['GradingScheme']
export type GradingSchemeRequest = components['schemas']['GradingSchemeRequest']
export type PatchedGradingSchemeRequest =
  components['schemas']['PatchedGradingSchemeRequest']
export type SubjectComponent = components['schemas']['SubjectComponent']
export type SubjectComponentRequest =
  components['schemas']['SubjectComponentRequest']
export type PatchedSubjectComponentRequest =
  components['schemas']['PatchedSubjectComponentRequest']
export type ComponentSegment = components['schemas']['ComponentSegment']
export type ComponentSegmentRequest =
  components['schemas']['ComponentSegmentRequest']
export type PatchedComponentSegmentRequest =
  components['schemas']['PatchedComponentSegmentRequest']
export type GradingActivity = components['schemas']['GradingActivity']
export type GradingActivityRequest =
  components['schemas']['GradingActivityRequest']
export type PatchedGradingActivityRequest =
  components['schemas']['PatchedGradingActivityRequest']
export type StudentActivityScore =
  components['schemas']['StudentActivityScore']
export type StudentActivityScoreRequest =
  components['schemas']['StudentActivityScoreRequest']
export type PatchedStudentActivityScoreRequest =
  components['schemas']['PatchedStudentActivityScoreRequest']
export type GradeBreakdown = components['schemas']['GradeBreakdown']
export type ValidateWeights = components['schemas']['ValidateWeights']
export type ApplySuggestionResponse =
  components['schemas']['ApplySuggestionResponse']

const LARGE_PAGE = 500

async function fetchAllPages<T>(
  url: string,
  params: Record<string, string | undefined>,
): Promise<T[]> {
  let offset = 0
  const all: T[] = []
  for (;;) {
    const { data } = await apiClient.get<PaginatedList<T>>(url, {
      params: { ...params, limit: LARGE_PAGE, offset },
    })
    all.push(...data.results)
    if (!data.next || data.results.length === 0) break
    offset += LARGE_PAGE
    if (offset > 20_000) break
  }
  return all
}

export async function fetchGradingScheme(id: string): Promise<GradingScheme> {
  const { data } = await apiClient.get<GradingScheme>(
    `/api/grading-schemes/${id}/`,
  )
  return data
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

export async function patchGradingScheme(
  id: string,
  body: PatchedGradingSchemeRequest,
): Promise<GradingScheme> {
  const { data } = await apiClient.patch<GradingScheme>(
    `/api/grading-schemes/${id}/`,
    body,
  )
  return data
}

export async function deleteGradingScheme(id: string): Promise<void> {
  await apiClient.delete(`/api/grading-schemes/${id}/`)
}

export async function validateGradingSchemeWeights(
  schemeId: string,
): Promise<ValidateWeights> {
  const { data } = await apiClient.get<ValidateWeights>(
    `/api/grading-schemes/${schemeId}/validate-weights/`,
  )
  return data
}

export async function fetchGradingSchemeBreakdown(
  schemeId: string,
  studentId: string,
): Promise<GradeBreakdown> {
  const { data } = await apiClient.get<GradeBreakdown>(
    `/api/grading-schemes/${schemeId}/breakdown/`,
    { params: { student: studentId } },
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
  const { data } = await apiClient.get<GradeBreakdown>(
    '/api/grades/suggested/',
    { params },
  )
  return data
}

export async function fetchSubjectComponentsForSubject(
  subjectId: string,
): Promise<SubjectComponent[]> {
  return fetchAllPages<SubjectComponent>('/api/subject-components/', {
    subject: subjectId,
    ordering: 'sort_order',
  })
}

/** @deprecated Use fetchSubjectComponentsForSubject */
export async function fetchSubjectComponentsForScheme(
  schemeId: string,
): Promise<SubjectComponent[]> {
  const scheme = await fetchGradingScheme(schemeId)
  const { data: ca } = await apiClient.get<{ subject: string }>(
    `/api/course-assignments/${scheme.course_assignment}/`,
  )
  return fetchSubjectComponentsForSubject(ca.subject)
}

export async function createSubjectComponent(
  body: SubjectComponentRequest,
): Promise<SubjectComponent> {
  const { data } = await apiClient.post<SubjectComponent>(
    '/api/subject-components/',
    body,
  )
  return data
}

export async function patchSubjectComponent(
  id: string,
  body: PatchedSubjectComponentRequest,
): Promise<SubjectComponent> {
  const { data } = await apiClient.patch<SubjectComponent>(
    `/api/subject-components/${id}/`,
    body,
  )
  return data
}

export async function deleteSubjectComponent(id: string): Promise<void> {
  await apiClient.delete(`/api/subject-components/${id}/`)
}

export async function fetchComponentSegmentsForScheme(
  schemeId: string,
): Promise<ComponentSegment[]> {
  return fetchAllPages<ComponentSegment>('/api/component-segments/', {
    grading_scheme: schemeId,
    ordering: 'sort_order',
  })
}

export async function fetchComponentSegmentsForComponent(
  schemeId: string,
  subjectComponentId: string,
): Promise<ComponentSegment[]> {
  return fetchReferenceListResults<ComponentSegment>(
    '/api/component-segments/',
    {
      params: {
        grading_scheme: schemeId,
        subject_component: subjectComponentId,
        ordering: 'sort_order',
      },
    },
  )
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

export async function fetchGradingActivitiesForScheme(
  schemeId: string,
): Promise<GradingActivity[]> {
  return fetchAllPages<GradingActivity>('/api/grading-activities/', {
    segment__grading_scheme: schemeId,
    ordering: 'sort_order',
  })
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

export async function fetchStudentActivityScoresForActivity(
  activityId: string,
): Promise<StudentActivityScore[]> {
  return fetchAllPages<StudentActivityScore>(
    '/api/student-activity-scores/',
    { activity: activityId },
  )
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

export async function deleteStudentActivityScore(id: string): Promise<void> {
  await apiClient.delete(`/api/student-activity-scores/${id}/`)
}
