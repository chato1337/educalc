import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import { fetchAllPages } from '@/api/list'
import { queryKeys } from '@/api/queryKeys'
import { useInfiniteList } from '@/api/useInfiniteList'
import type { Grade, GradeRecovery, GradeRecoveryCreateRequest } from '@/types/schemas'

export type { GradeRecovery, GradeRecoveryCreateRequest }

export async function fetchEligibleGrades(params: {
  course_assignment: string
  academic_period?: string
}): Promise<Grade[]> {
  const query: Record<string, string | undefined> = {
    course_assignment: params.course_assignment,
    academic_period: params.academic_period,
  }
  return fetchAllPages<Grade>('/api/grade-recoveries/eligible/', query)
}

export async function fetchGradeRecoveries(params: {
  grade?: string
  course_assignment?: string
  academic_period?: string
}): Promise<GradeRecovery[]> {
  const query: Record<string, string | undefined> = {
    grade: params.grade,
    grade__course_assignment: params.course_assignment,
    grade__academic_period: params.academic_period,
    ordering: '-created_at',
  }
  return fetchAllPages<GradeRecovery>('/api/grade-recoveries/', query)
}

export async function createGradeRecovery(
  body: GradeRecoveryCreateRequest,
): Promise<GradeRecovery> {
  const { data } = await apiClient.post<GradeRecovery>(
    '/api/grade-recoveries/',
    body,
  )
  return data
}

export function useEligibleGradesQuery(
  params: { course_assignment: string; academic_period?: string } | null,
) {
  return useQuery({
    queryKey: queryKeys.gradeRecoveriesEligible({
      course_assignment: params?.course_assignment,
      academic_period: params?.academic_period,
    }),
    queryFn: () => fetchEligibleGrades(params!),
    enabled: Boolean(params?.course_assignment),
  })
}

export function useEligibleGradesInfiniteQuery(
  params: { course_assignment: string; academic_period?: string } | null,
) {
  const listParams = {
    course_assignment: params?.course_assignment,
    academic_period: params?.academic_period,
  }
  return useInfiniteList<Grade>({
    queryKey: queryKeys.gradeRecoveriesEligible(listParams),
    url: '/api/grade-recoveries/eligible/',
    params: listParams,
    enabled: Boolean(params?.course_assignment),
  })
}

export function useGradeRecoveriesQuery(
  params: {
    grade?: string
    course_assignment?: string
    academic_period?: string
  } | null,
) {
  return useQuery({
    queryKey: queryKeys.gradeRecoveries({
      grade: params?.grade,
      course_assignment: params?.course_assignment,
      academic_period: params?.academic_period,
    }),
    queryFn: () => fetchGradeRecoveries(params!),
    enabled: Boolean(
      params?.grade || params?.course_assignment || params?.academic_period,
    ),
  })
}

export function useGradeRecoveriesInfiniteQuery(
  params: {
    grade?: string
    course_assignment?: string
    academic_period?: string
  } | null,
) {
  const listParams = {
    grade: params?.grade,
    grade__course_assignment: params?.course_assignment,
    grade__academic_period: params?.academic_period,
    ordering: '-created_at',
  }
  return useInfiniteList<GradeRecovery>({
    queryKey: queryKeys.gradeRecoveries({
      grade: params?.grade,
      course_assignment: params?.course_assignment,
      academic_period: params?.academic_period,
    }),
    url: '/api/grade-recoveries/',
    params: listParams,
    enabled: Boolean(
      params?.grade || params?.course_assignment || params?.academic_period,
    ),
  })
}

export function useCreateGradeRecoveryMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createGradeRecovery,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['grade-recoveries'] })
      void queryClient.invalidateQueries({ queryKey: ['grades'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
