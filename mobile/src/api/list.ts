import type { AxiosRequestConfig } from 'axios'

import { apiClient } from '@/api/client'

export const LIST_PAGE_SIZE = 20
const REFERENCE_LIST_LIMIT = 100
const LARGE_PAGE = 500

/** Matches DRF `LimitOffsetPagination`. */
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

export async function fetchAllPages<T>(
  url: string,
  params: Record<string, string | undefined>,
): Promise<T[]> {
  let offset = 0
  const all: T[] = []
  for (;;) {
    const { data } = await apiClient.get<PaginatedList<T>>(url, {
      params: { ...params, limit: LARGE_PAGE, offset },
    })
    all.push(...data.results)
    if (!data.next || data.results.length === 0) break
    offset += LARGE_PAGE
    if (offset > 20_000) break
  }
  return all
}
