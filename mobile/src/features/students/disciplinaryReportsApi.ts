import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import { fetchAllPages } from '@/api/list'
import { queryKeys } from '@/api/queryKeys'
import { useInfiniteList } from '@/api/useInfiniteList'
import type {
  DisciplinaryReport,
  DisciplinaryReportRequest,
  PatchedDisciplinaryReportRequest,
} from '@/types/schemas'

export type { DisciplinaryReport }

export type DisciplinaryReportListParams = {
  student?: string
  academic_period?: string
}

export async function fetchDisciplinaryReports(
  params: DisciplinaryReportListParams,
): Promise<DisciplinaryReport[]> {
  return fetchAllPages<DisciplinaryReport>('/api/disciplinary-reports/', {
    student: params.student,
    academic_period: params.academic_period,
  })
}

export async function createDisciplinaryReport(
  body: DisciplinaryReportRequest,
): Promise<DisciplinaryReport> {
  const { data } = await apiClient.post<DisciplinaryReport>(
    '/api/disciplinary-reports/',
    body,
  )
  return data
}

export async function patchDisciplinaryReport(
  id: string,
  body: PatchedDisciplinaryReportRequest,
): Promise<DisciplinaryReport> {
  const { data } = await apiClient.patch<DisciplinaryReport>(
    `/api/disciplinary-reports/${id}/`,
    body,
  )
  return data
}

export function useDisciplinaryReportsQuery(
  params: DisciplinaryReportListParams | null,
) {
  return useQuery({
    queryKey: queryKeys.disciplinaryReports({
      student: params?.student,
      academic_period: params?.academic_period,
    }),
    queryFn: () => fetchDisciplinaryReports(params!),
    enabled: Boolean(params?.student || params?.academic_period),
  })
}

export function useDisciplinaryReportsInfiniteQuery(
  params: DisciplinaryReportListParams | null,
) {
  const listParams = {
    student: params?.student,
    academic_period: params?.academic_period,
  }
  return useInfiniteList<DisciplinaryReport>({
    queryKey: queryKeys.disciplinaryReports(listParams),
    url: '/api/disciplinary-reports/',
    params: listParams,
    enabled: Boolean(params?.student || params?.academic_period),
  })
}

function invalidateReports(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['disciplinary-reports'] })
}

export function useCreateDisciplinaryReportMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createDisciplinaryReport,
    onSuccess: () => invalidateReports(queryClient),
  })
}

export function usePatchDisciplinaryReportMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: PatchedDisciplinaryReportRequest
    }) => patchDisciplinaryReport(id, body),
    onSuccess: () => invalidateReports(queryClient),
  })
}
