import { rawClient } from '@/api/rawClient'
import type { components } from '@/types/openapi'
import type { AuthUser } from '@/types/user'

export type LoginResponse = {
  access: string
  refresh: string
  user: AuthUser
}

export type FaceAuthConfig = components['schemas']['FaceAuthConfig']

export const FACEAUTH_CALLBACK_PATH = '/auth/callback'

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

export async function fetchFaceAuthConfig(): Promise<FaceAuthConfig> {
  const { data } = await rawClient.get<FaceAuthConfig>('/api/auth/faceauth/config/')
  return data
}

export async function faceAuthCallbackRequest(token: string): Promise<LoginResponse> {
  const { data } = await rawClient.post<LoginResponse>(
    '/api/auth/faceauth/callback/',
    { token },
  )
  return data
}

export function getFaceAuthRedirectUri(): string {
  return `${window.location.origin}${FACEAUTH_CALLBACK_PATH}`
}

export function buildFaceAuthLoginUrl(config: FaceAuthConfig): string | null {
  if (!config.enabled || !config.web_url || !config.app_id) return null
  const url = new URL('login', `${config.web_url.replace(/\/$/, '')}/`)
  url.searchParams.set('app_id', config.app_id)
  url.searchParams.set('redirect_uri', getFaceAuthRedirectUri())
  return url.toString()
}
