import { apiClient } from '@/api/client'
import type { components, operations } from '@/types/openapi'

export type Institution = components['schemas']['Institution']

type LeftUpload = operations['institutions_bulletin_logo_left_create']
type RightUpload = operations['institutions_bulletin_logo_right_create']

export type BulletinLogoSlot = 'left' | 'right'

const ACCEPTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
])

export function isAcceptedBulletinLogo(file: File): boolean {
  return ACCEPTED_IMAGE_TYPES.has(file.type)
}

export async function fetchInstitution(institutionId: string): Promise<Institution> {
  const { data } = await apiClient.get<Institution>(
    `/api/institutions/${institutionId}/`,
  )
  return data
}

export async function uploadBulletinLogo(
  institutionId: string,
  slot: BulletinLogoSlot,
  file: File,
): Promise<Institution> {
  const body = new FormData()
  body.append('file', file)
  const path =
    slot === 'left'
      ? `/api/institutions/${institutionId}/bulletin-logo-left/`
      : `/api/institutions/${institutionId}/bulletin-logo-right/`
  const { data } = await apiClient.post<
    LeftUpload['responses'][200]['content']['application/json'] |
      RightUpload['responses'][200]['content']['application/json']
  >(path, body)
  return data
}
