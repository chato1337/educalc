import { apiClient } from '@/api/client'
import type { components } from '@/types/openapi'

export type RollCallStatus = components['schemas']['RollCallStatusEnum']
export type RollCallRoster = components['schemas']['RollCallRoster']
export type RollCallRosterStudent =
  components['schemas']['RollCallRosterStudent']
export type RollCallSaveRequest = components['schemas']['RollCallSaveRequest']
export type RollCallSaveResponse =
  components['schemas']['RollCallSaveResponse']
export type DailyAttendance = components['schemas']['DailyAttendance']

export const ROLL_CALL_STATUS = {
  present: 'PRESENT',
  excused: 'EXCUSED',
  unexcused: 'UNEXCUSED',
} as const satisfies Record<string, RollCallStatus>

export type RollCallRosterParams = {
  group: string
  date: string
  course_assignment?: string
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
