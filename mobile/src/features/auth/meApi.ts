import { apiClient } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import { useQuery } from '@tanstack/react-query'
import type { MeUser } from '@/types/user'

export async function fetchMe(): Promise<MeUser> {
  const { data } = await apiClient.get<MeUser>('/api/auth/me/')
  return data
}

export function useMeQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: fetchMe,
    enabled,
    retry: 1,
  })
}
