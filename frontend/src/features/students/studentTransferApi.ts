import { useQuery } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import { fetchReferenceListResults } from '@/api/list'
import type { components } from '@/types/openapi'
import type { Enrollment } from '@/types/schemas'

export type StudentTransferRequest =
  components['schemas']['StudentTransferRequestRequest']
export type StudentTransferResponse =
  components['schemas']['StudentTransferResponse']
export type StudentTransferErrorCode = components['schemas']['CodeEnum']

export async function fetchActiveEnrollmentsForStudent(
  studentId: string,
): Promise<Enrollment[]> {
  return fetchReferenceListResults<Enrollment>('/api/enrollments/', {
    params: { student: studentId, status: 'active' },
  })
}

export function useActiveEnrollmentsForStudent(
  studentId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['enrollments', 'active-for-student', studentId ?? ''],
    queryFn: () => fetchActiveEnrollmentsForStudent(studentId!),
    enabled: (options?.enabled ?? true) && Boolean(studentId),
  })
}

export async function transferStudent(
  studentId: string,
  body: StudentTransferRequest,
): Promise<StudentTransferResponse> {
  const { data } = await apiClient.post<StudentTransferResponse>(
    `/api/students/${studentId}/transfer/`,
    body,
  )
  return data
}
