import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import { fetchAllPages } from '@/api/list'
import { queryKeys } from '@/api/queryKeys'
import type { Grade, PatchedGradeRequest } from '@/types/schemas'

export type { Grade, PatchedGradeRequest }

export type GradeListParams = {
  course_assignment?: string
  academic_period?: string
  student?: string
}

export async function fetchGrades(params: GradeListParams): Promise<Grade[]> {
  return fetchAllPages<Grade>('/api/grades/', {
    course_assignment: params.course_assignment,
    academic_period: params.academic_period,
    student: params.student,
  })
}

export async function patchGrade(
  id: string,
  body: PatchedGradeRequest,
): Promise<Grade> {
  const { data } = await apiClient.patch<Grade>(`/api/grades/${id}/`, body)
  return data
}

export function useGradesQuery(params: GradeListParams | null) {
  return useQuery({
    queryKey: queryKeys.grades({
      course_assignment: params?.course_assignment,
      academic_period: params?.academic_period,
      student: params?.student,
    }),
    queryFn: () => fetchGrades(params!),
    enabled: Boolean(
      params && (params.course_assignment || params.student),
    ),
  })
}

export function usePatchGradeMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: PatchedGradeRequest }) =>
      patchGrade(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['grades'] })
      void queryClient.invalidateQueries({ queryKey: ['grade-recoveries'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
