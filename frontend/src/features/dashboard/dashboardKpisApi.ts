import { apiClient } from '@/api/client'

import type { DashboardKpisResponse } from './dashboardKpis.types'

export async function fetchDashboardKpis(
  institutionId?: string | null,
  academicPeriodId?: string | null,
): Promise<DashboardKpisResponse> {
  const params: Record<string, string> = {}
  if (institutionId != null && institutionId !== '') {
    params.institution = institutionId
  }
  if (academicPeriodId != null && academicPeriodId !== '') {
    params.academic_period = academicPeriodId
  }
  const { data } = await apiClient.get<DashboardKpisResponse>(
    '/api/dashboard/kpis/',
    { params: Object.keys(params).length > 0 ? params : undefined },
  )
  return data
}
