import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import { apiClient } from '@/api/client'
import { fetchReferenceListResults } from '@/api/list'
import { queryKeys } from '@/api/queryKeys'
import { planningSchemeQueryKey } from '@/features/operations/activityPlanning/activityPlanningNav'
import {
  buildScoresByActivity,
  countActivitiesByStatus,
  enrichActivities,
  schemePlanningProgress,
  todayIsoDate,
  type EnrichedPlanningActivity,
} from '@/features/operations/activityPlanning/activityPlanningUtils'
import {
  fetchComponentSegmentsForScheme,
  fetchGradingActivitiesForScheme,
  fetchGradingScheme,
  fetchStudentActivityScoresForScheme,
  fetchSubjectComponentsForSubject,
  type ComponentSegment,
  type GradingActivity,
  type GradingScheme,
  type StudentActivityScore,
  type SubjectComponent,
} from '@/features/operations/gradingApi'
import type { CourseAssignment, Enrollment } from '@/types/schemas'

async function fetchAllEnrollments(
  params: Record<string, string>,
): Promise<Enrollment[]> {
  let offset = 0
  const all: Enrollment[] = []
  for (;;) {
    const { data } = await apiClient.get<{
      results: Enrollment[]
      next: string | null
    }>('/api/enrollments/', {
      params: { ...params, limit: 500, offset },
    })
    all.push(...data.results)
    if (!data.next || data.results.length === 0) break
    offset += 500
    if (offset > 20_000) break
  }
  return all
}

export type PlanningSchemeBundle = {
  scheme: GradingScheme
  courseAssignment: CourseAssignment
  components: SubjectComponent[]
  segments: ComponentSegment[]
  activities: GradingActivity[]
  scores: StudentActivityScore[]
  enrollments: Enrollment[]
  enrichedActivities: EnrichedPlanningActivity[]
  statusCounts: ReturnType<typeof countActivitiesByStatus>
  progress: ReturnType<typeof schemePlanningProgress>
  enrollmentCount: number
  today: string
}

async function loadPlanningSchemeBundle(
  schemeId: string,
): Promise<PlanningSchemeBundle> {
  const scheme = await fetchGradingScheme(schemeId)
  const { data: courseAssignment } = await apiClient.get<CourseAssignment>(
    `/api/course-assignments/${scheme.course_assignment}/`,
  )

  const [components, segments, activities, scores, enrollments] =
    await Promise.all([
      fetchSubjectComponentsForSubject(courseAssignment.subject),
      fetchComponentSegmentsForScheme(schemeId),
      fetchGradingActivitiesForScheme(schemeId),
      fetchStudentActivityScoresForScheme(schemeId),
      fetchAllEnrollments({
        academic_year: courseAssignment.academic_year,
        group: courseAssignment.group,
        status: 'active',
      }),
    ])

  const scoresByActivity = buildScoresByActivity(scores)
  const today = todayIsoDate()
  const enrollmentCount = enrollments.length
  const enrichedActivities = enrichActivities({
    activities,
    segments,
    components,
    scoresByActivity,
    enrollmentCount,
    today,
  })

  return {
    scheme,
    courseAssignment,
    components,
    segments,
    activities,
    scores,
    enrollments,
    enrichedActivities,
    statusCounts: countActivitiesByStatus(enrichedActivities),
    progress: schemePlanningProgress({
      scheme,
      components,
      segments,
      activities,
    }),
    enrollmentCount,
    today,
  }
}

export function usePlanningSchemeBundle(schemeId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.activityPlanningBundle(schemeId ?? ''),
    queryFn: () => loadPlanningSchemeBundle(schemeId!),
    enabled: Boolean(schemeId),
    staleTime: 30_000,
  })
}

export function usePlanningSchemeParam() {
  const [searchParams, setSearchParams] = useSearchParams()
  const schemeId = searchParams.get(planningSchemeQueryKey)

  const setSchemeId = useCallback(
    (next: string | null) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev)
          if (next) params.set(planningSchemeQueryKey, next)
          else params.delete(planningSchemeQueryKey)
          return params
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  return { schemeId, setSchemeId }
}

export function useActiveGradingSchemes(
  institutionId: string | null | undefined,
) {
  return useQuery({
    queryKey: queryKeys.gradingSchemes({
      is_active: 'true',
      course_assignment__group__academic_year__institution:
        institutionId ?? undefined,
    }),
    queryFn: () =>
      fetchReferenceListResults<GradingScheme>('/api/grading-schemes/', {
        params: {
          is_active: 'true',
          course_assignment__group__academic_year__institution:
            institutionId ?? undefined,
        },
      }),
    enabled: Boolean(institutionId),
  })
}

export function usePlanningSchemeSelection(
  institutionId: string | null | undefined,
) {
  const { schemeId, setSchemeId } = usePlanningSchemeParam()
  const schemesQuery = useActiveGradingSchemes(institutionId)

  const selectedScheme = useMemo(
    () => schemesQuery.data?.find((s) => s.id === schemeId) ?? null,
    [schemesQuery.data, schemeId],
  )

  return {
    schemeId,
    setSchemeId,
    schemes: schemesQuery.data ?? [],
    schemesLoading: schemesQuery.isLoading,
    selectedScheme,
  }
}
