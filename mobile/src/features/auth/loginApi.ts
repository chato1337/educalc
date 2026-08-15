import { rawClient } from '@/api/rawClient'
import type { components } from '@/types/openapi'
import type { AuthUser } from '@/types/user'

export type LoginResponse = components['schemas']['LoginResponse']

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

export function toAuthUser(user: LoginResponse['user']): AuthUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role ?? null,
    institution_id: user.institution_id ?? null,
  }
}
