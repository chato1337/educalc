import { apiClient } from '@/api/client'
import type { components } from '@/types/openapi'

export type Institution = components['schemas']['Institution']

export type BulletinLogoSlot = 'left' | 'right' | 'rector' | 'secretary'

const SLOT_PATH: Record<BulletinLogoSlot, string> = {
  left: 'bulletin-logo-left',
  right: 'bulletin-logo-right',
  rector: 'rector-signature',
  secretary: 'secretary-signature',
}

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

export type InstitutionProfileInput = {
  name: string
  dane_code: string
  legal_reference: string
  nit: string
  certificate_subtitle: string
  certificate_authorization: string
  rector_name: string
  rector_document_number: string
  secretary_name: string
  secretary_document_number: string
}

export async function updateInstitution(
  institutionId: string,
  body: InstitutionProfileInput,
): Promise<Institution> {
  const { data } = await apiClient.patch<Institution>(
    `/api/institutions/${institutionId}/`,
    body,
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
  const path = `/api/institutions/${institutionId}/${SLOT_PATH[slot]}/`
  const { data } = await apiClient.post<Institution>(path, body)
  return data
}
