import { apiClient } from '@/api/client'
import type {
  PerformanceSummaryRecalculateByGradeRequest,
  PerformanceSummaryRecalculateByGradeResponse,
  PerformanceSummaryRecalculateByInstitutionRequest,
  PerformanceSummaryRecalculateByInstitutionResponse,
} from '@/types/schemas'

export async function postPerformanceSummaryRecalculateByGrade(
  body: PerformanceSummaryRecalculateByGradeRequest,
): Promise<PerformanceSummaryRecalculateByGradeResponse> {
  const { data } = await apiClient.post<PerformanceSummaryRecalculateByGradeResponse>(
    '/api/performance-summaries/recalculate-by-grade/',
    body,
  )
  return data
}

export async function postPerformanceSummaryRecalculateByInstitution(
  body: PerformanceSummaryRecalculateByInstitutionRequest,
): Promise<PerformanceSummaryRecalculateByInstitutionResponse> {
  const { data } =
    await apiClient.post<PerformanceSummaryRecalculateByInstitutionResponse>(
      '/api/performance-summaries/recalculate-by-institution/',
      body,
    )
  return data
}
