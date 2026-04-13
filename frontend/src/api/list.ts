import type { AxiosRequestConfig } from 'axios'

import { apiClient } from '@/api/client'

/** Rows per page for infinite-scroll lists (keep in sync with backend default when possible). */
export const LIST_PAGE_SIZE = 20

/**
 * One-shot fetch for picklists / filters (Autocomplete, etc.): single request, capped payload.
 * Not all options load if the collection is huge; prefer search on the parent field.
 */
const REFERENCE_LIST_LIMIT = 100

/** Matches DRF `LimitOffsetPagination` list responses. */
export type PaginatedList<T> = {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export async function fetchListPage<T>(
  url: string,
  offset: number,
  config?: AxiosRequestConfig,
): Promise<PaginatedList<T>> {
  const { data } = await apiClient.get<PaginatedList<T>>(url, {
    ...config,
    params: { limit: LIST_PAGE_SIZE, offset, ...config?.params },
  })
  return data
}

export async function fetchReferenceListResults<T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T[]> {
  const { data } = await apiClient.get<PaginatedList<T>>(url, {
    ...config,
    params: { limit: REFERENCE_LIST_LIMIT, offset: 0, ...config?.params },
  })
  return data.results
}
