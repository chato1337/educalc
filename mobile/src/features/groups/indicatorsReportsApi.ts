import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import { fetchAllPages } from '@/api/list'
import { queryKeys } from '@/api/queryKeys'
import type {
  AcademicIndicatorsReport,
  AcademicIndicatorsReportRequest,
} from '@/types/schemas'

export type { AcademicIndicatorsReport, AcademicIndicatorsReportRequest }

export async function fetchIndicatorsReports(params: {
  student: string
  academic_period: string
}): Promise<AcademicIndicatorsReport[]> {
  return fetchAllPages<AcademicIndicatorsReport>(
    '/api/academic-indicators-reports/',
    {
      student: params.student,
      academic_period: params.academic_period,
    },
  )
}

export async function createIndicatorsReport(
  body: AcademicIndicatorsReportRequest,
): Promise<AcademicIndicatorsReport> {
  const { data } = await apiClient.post<AcademicIndicatorsReport>(
    '/api/academic-indicators-reports/',
    body,
  )
  return data
}

export function useIndicatorsReportsQuery(
  params: { student: string; academic_period: string } | null,
) {
  return useQuery({
    queryKey: queryKeys.academicIndicatorsReports({
      student: params?.student,
      academic_period: params?.academic_period,
    }),
    queryFn: () => fetchIndicatorsReports(params!),
    enabled: Boolean(params?.student && params?.academic_period),
  })
}

export function useCreateIndicatorsReportMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createIndicatorsReport,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['academic-indicators-reports'],
      })
    },
  })
}
