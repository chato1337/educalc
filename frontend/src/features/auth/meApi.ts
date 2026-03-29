import { apiClient } from '@/api/client'
import type { MeUser } from '@/types/user'

export async function fetchMe(): Promise<MeUser> {
  const { data } = await apiClient.get<MeUser>('/api/auth/me/')
  return data
}
