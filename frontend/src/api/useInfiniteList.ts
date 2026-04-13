import {
  useInfiniteQuery,
  type InfiniteData,
  type QueryKey,
} from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import {
  LIST_PAGE_SIZE,
  type PaginatedList,
} from '@/api/list'

export function flatInfinitePages<T>(
  data: InfiniteData<PaginatedList<T>> | undefined,
): T[] {
  return data?.pages.flatMap((p) => p.results) ?? []
}

type Params = Record<string, string | number | boolean | undefined>

export function useInfiniteList<T>(options: {
  queryKey: QueryKey
  url: string
  params?: Params
  enabled?: boolean
}) {
  const { queryKey, url, params, enabled = true } = options
  return useInfiniteQuery({
    queryKey: [...queryKey, params ?? {}],
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await apiClient.get<PaginatedList<T>>(url, {
        signal,
        params: {
          limit: LIST_PAGE_SIZE,
          offset: pageParam,
          ...params,
        },
      })
      return data
    },
    getNextPageParam: (lastPage, _pages, lastPageParam) => {
      const offset = lastPageParam as number
      const next = offset + lastPage.results.length
      return next < lastPage.count ? next : undefined
    },
    enabled,
  })
}
