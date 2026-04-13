import { apiClient } from '@/api/client'
import { fetchReferenceListResults } from '@/api/list'
import type { components, operations } from '@/types/openapi'

export type GradingScale = components['schemas']['GradingScale']
export type GradingScaleRequest = components['schemas']['GradingScaleRequest']
export type PatchedGradingScaleRequest =
  components['schemas']['PatchedGradingScaleRequest']

/** Query params for GET /api/grading-scales/ (OpenAPI: grading_scales_list). */
export type GradingScalesListParams = NonNullable<
  operations['grading_scales_list']['parameters']['query']
>

export async function fetchGradingScalesList(
  params?: GradingScalesListParams,
): Promise<GradingScale[]> {
  return fetchReferenceListResults<GradingScale>('/api/grading-scales/', {
    params,
  })
}

export async function createGradingScale(
  body: GradingScaleRequest,
): Promise<GradingScale> {
  const { data } = await apiClient.post<GradingScale>(
    '/api/grading-scales/',
    body,
  )
  return data
}

export async function patchGradingScale(
  id: string,
  body: PatchedGradingScaleRequest,
): Promise<GradingScale> {
  const { data } = await apiClient.patch<GradingScale>(
    `/api/grading-scales/${id}/`,
    body,
  )
  return data
}

export async function deleteGradingScale(id: string): Promise<void> {
  await apiClient.delete(`/api/grading-scales/${id}/`)
}
