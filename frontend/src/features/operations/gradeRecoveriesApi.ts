import { apiClient } from '@/api/client'
import type { components, operations } from '@/types/openapi'

export type GradeRecovery = components['schemas']['GradeRecovery']
export type GradeRecoveryCreateRequest =
  components['schemas']['GradeRecoveryCreateRequest']
export type Grade = components['schemas']['Grade']

/** Query params for GET /api/grade-recoveries/eligible/ */
export type GradeRecoveriesEligibleParams = NonNullable<
  operations['grade_recoveries_eligible_list']['parameters']['query']
>

/** Query params for GET /api/grade-recoveries/ */
export type GradeRecoveriesListParams = NonNullable<
  operations['grade_recoveries_list']['parameters']['query']
>

/** URL + API query key for hiding grades that already have a recovery. */
export const HIDE_RECOVERED_QUERY_KEY = 'hide_recovered' as const

export async function createGradeRecovery(
  body: GradeRecoveryCreateRequest,
): Promise<GradeRecovery> {
  const { data } = await apiClient.post<GradeRecovery>(
    '/api/grade-recoveries/',
    body,
  )
  return data
}
