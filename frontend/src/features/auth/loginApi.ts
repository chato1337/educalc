import { rawClient } from '@/api/rawClient'
import type { AuthUser } from '@/types/user'

export type LoginResponse = {
  access: string
  refresh: string
  user: AuthUser
}

export async function loginRequest(
  username: string,
  password: string,
): Promise<LoginResponse> {
  const { data } = await rawClient.post<LoginResponse>('/api/auth/login/', {
    username,
    password,
  })
  return data
}
