import { apiClient } from '@/api/client'

import type { DashboardKpisResponse } from './dashboardKpis.types'

export async function fetchDashboardKpis(
  academicPeriodId?: string | null,
): Promise<DashboardKpisResponse> {
  const params: Record<string, string> = {}
  if (academicPeriodId) params.academic_period = academicPeriodId
  const { data } = await apiClient.get<DashboardKpisResponse>(
    '/api/dashboard/kpis/',
    { params: Object.keys(params).length > 0 ? params : undefined },
  )
  return data
}
