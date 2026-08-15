import { useQuery } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'

/**
 * OpenAPI declares this action as `Group`, but the backend returns
 * `{ group, rankings_by_period }` (same as grades-summary).
 */
export type GroupRankingRow = {
  student_id: string
  student_name: string
  rank: number | null
  period_average: number
}

export type GroupRankingsPeriod = {
  period: {
    id: string
    name: string
    year: number
  }
  rankings: GroupRankingRow[]
}

export type GroupRankingsResponse = {
  group: { id: string; name?: string }
  rankings_by_period: GroupRankingsPeriod[]
}

export async function fetchGroupRankings(
  groupId: string,
  periodId?: string | null,
): Promise<GroupRankingsResponse> {
  const { data } = await apiClient.get<GroupRankingsResponse>(
    `/api/groups/${groupId}/students-rankings/`,
    { params: periodId ? { period_id: periodId } : undefined },
  )
  return data
}

export function useGroupRankingsQuery(
  groupId: string | null,
  periodId?: string | null,
) {
  return useQuery({
    queryKey: queryKeys.groupRankings(groupId ?? '', periodId),
    queryFn: () => fetchGroupRankings(groupId!, periodId),
    enabled: Boolean(groupId),
  })
}
