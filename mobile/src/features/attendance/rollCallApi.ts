import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import { fetchAllPages } from '@/api/list'
import { queryKeys } from '@/api/queryKeys'
import type { components } from '@/types/openapi'
import type {
  DailyAttendance,
  RollCallRoster,
  RollCallSaveRequest,
  RollCallSaveResponse,
  RollCallStatus,
} from '@/types/schemas'

export type {
  DailyAttendance,
  RollCallRoster,
  RollCallSaveRequest,
  RollCallSaveResponse,
  RollCallStatus,
}

export type RollCallRosterStudent =
  components['schemas']['RollCallRosterStudent']
export type RollCallEntryRequest =
  components['schemas']['RollCallEntryRequest']

export type RollCallRosterParams = {
  group: string
  date: string
  course_assignment?: string
}

export type RollCallOrigin = 'subject' | 'group'

export function isRollCallStatus(
  value: string | null | undefined,
): value is RollCallStatus {
  return value === 'PRESENT' || value === 'EXCUSED' || value === 'UNEXCUSED'
}

export async function fetchRollCallRoster(
  params: RollCallRosterParams,
): Promise<RollCallRoster> {
  const { data } = await apiClient.get<RollCallRoster>(
    '/api/daily-attendances/roster/',
    { params },
  )
  return data
}

export async function saveRollCall(
  body: RollCallSaveRequest,
): Promise<RollCallSaveResponse> {
  const { data } = await apiClient.post<RollCallSaveResponse>(
    '/api/daily-attendances/save-roll-call/',
    body,
  )
  return data
}

export async function fetchDailyAttendances(params: {
  group: string
  date?: string
  course_assignment?: string
}): Promise<DailyAttendance[]> {
  const query: Record<string, string | undefined> = {
    group: params.group,
    date: params.date,
    course_assignment: params.course_assignment,
  }
  return fetchAllPages<DailyAttendance>('/api/daily-attendances/', query)
}

export function useRollCallRosterQuery(params: RollCallRosterParams | null) {
  return useQuery({
    queryKey: queryKeys.rollCallRoster(
      params?.group ?? '',
      params?.date ?? '',
      params?.course_assignment,
    ),
    queryFn: () => fetchRollCallRoster(params!),
    enabled: Boolean(params?.group && params?.date),
  })
}

export function useSaveRollCallMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: saveRollCall,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['daily-attendances'] })
      void queryClient.invalidateQueries({ queryKey: ['attendances'] })
    },
  })
}
