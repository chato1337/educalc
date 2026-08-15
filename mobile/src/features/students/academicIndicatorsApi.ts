import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import { fetchAllPages } from '@/api/list'
import { queryKeys } from '@/api/queryKeys'
import type {
  AcademicIndicator,
  AcademicIndicatorRequest,
  PatchedAcademicIndicatorRequest,
} from '@/types/schemas'

export type { AcademicIndicator }

export type AcademicIndicatorListParams = {
  student?: string
  academic_period?: string
  course_assignment?: string
}

export async function fetchAcademicIndicators(
  params: AcademicIndicatorListParams,
): Promise<AcademicIndicator[]> {
  return fetchAllPages<AcademicIndicator>('/api/academic-indicators/', {
    student: params.student,
    academic_period: params.academic_period,
    course_assignment: params.course_assignment,
  })
}

export async function createAcademicIndicator(
  body: AcademicIndicatorRequest,
): Promise<AcademicIndicator> {
  const { data } = await apiClient.post<AcademicIndicator>(
    '/api/academic-indicators/',
    body,
  )
  return data
}

export async function patchAcademicIndicator(
  id: string,
  body: PatchedAcademicIndicatorRequest,
): Promise<AcademicIndicator> {
  const { data } = await apiClient.patch<AcademicIndicator>(
    `/api/academic-indicators/${id}/`,
    body,
  )
  return data
}

export function useAcademicIndicatorsQuery(
  params: AcademicIndicatorListParams | null,
) {
  return useQuery({
    queryKey: queryKeys.academicIndicators({
      student: params?.student,
      academic_period: params?.academic_period,
      course_assignment: params?.course_assignment,
    }),
    queryFn: () => fetchAcademicIndicators(params!),
    enabled: Boolean(params?.student || params?.course_assignment),
  })
}

function invalidateIndicators(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['academic-indicators'] })
}

export function useCreateAcademicIndicatorMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createAcademicIndicator,
    onSuccess: () => invalidateIndicators(queryClient),
  })
}

export function usePatchAcademicIndicatorMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: PatchedAcademicIndicatorRequest
    }) => patchAcademicIndicator(id, body),
    onSuccess: () => invalidateIndicators(queryClient),
  })
}
