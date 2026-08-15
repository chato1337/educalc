import { useQuery } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import type { SchoolRecord } from '@/types/schemas'

export type { SchoolRecord }

export async function fetchSchoolRecordComposite(
  studentId: string,
  academicYearId: string,
): Promise<SchoolRecord> {
  const { data } = await apiClient.get<SchoolRecord>(
    `/api/school-records/${studentId}/${academicYearId}/`,
  )
  return data
}

export function useSchoolRecordQuery(
  studentId: string | null,
  academicYearId: string | null,
) {
  return useQuery({
    queryKey: queryKeys.schoolRecordComposite(
      studentId ?? '',
      academicYearId ?? '',
    ),
    queryFn: () => fetchSchoolRecordComposite(studentId!, academicYearId!),
    enabled: Boolean(studentId && academicYearId),
  })
}
