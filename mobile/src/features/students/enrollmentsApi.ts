import { useQuery } from '@tanstack/react-query'

import { fetchAllPages } from '@/api/list'
import { queryKeys } from '@/api/queryKeys'
import { useInfiniteList } from '@/api/useInfiniteList'
import type { Enrollment } from '@/types/schemas'

export type { Enrollment }

export type EnrollmentListParams = {
  group?: string
  student?: string
  academic_year: string
  status?: 'active' | 'withdrawn' | 'graduated'
  search?: string
}

export async function fetchEnrollments(
  params: EnrollmentListParams,
): Promise<Enrollment[]> {
  return fetchAllPages<Enrollment>('/api/enrollments/', {
    group: params.group,
    student: params.student,
    academic_year: params.academic_year,
    status: params.status,
  })
}

export function useEnrollmentsQuery(params: EnrollmentListParams | null) {
  return useQuery({
    queryKey: queryKeys.enrollments({
      group: params?.group,
      student: params?.student,
      academic_year: params?.academic_year,
      status: params?.status,
    }),
    queryFn: () => fetchEnrollments(params!),
    enabled: Boolean(
      params?.academic_year && (params.group || params.student),
    ),
  })
}

export function useActiveEnrollmentsQuery(params: EnrollmentListParams | null) {
  return useEnrollmentsQuery(
    params ? { ...params, status: params.status ?? 'active' } : null,
  )
}

export function useActiveEnrollmentsInfiniteQuery(
  params: EnrollmentListParams | null,
) {
  const status = params?.status ?? 'active'
  const listParams = {
    group: params?.group,
    student: params?.student,
    academic_year: params?.academic_year,
    status,
    search: params?.search?.trim() || undefined,
  }
  return useInfiniteList<Enrollment>({
    queryKey: queryKeys.enrollments(listParams),
    url: '/api/enrollments/',
    params: listParams,
    enabled: Boolean(
      params?.academic_year && (params.group || params.student),
    ),
  })
}
