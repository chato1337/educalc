import { useQuery } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import { fetchAllPages } from '@/api/list'
import { queryKeys } from '@/api/queryKeys'
import type { Parent, StudentGuardian } from '@/types/schemas'

export type { Parent, StudentGuardian }

export type GuardianWithParent = {
  guardian: StudentGuardian
  parent: Parent | null
}

export async function fetchStudentGuardians(
  studentId: string,
): Promise<StudentGuardian[]> {
  return fetchAllPages<StudentGuardian>('/api/student-guardians/', {
    student: studentId,
  })
}

export async function fetchParent(id: string): Promise<Parent> {
  const { data } = await apiClient.get<Parent>(`/api/parents/${id}/`)
  return data
}

export async function fetchGuardiansWithParents(
  studentId: string,
): Promise<GuardianWithParent[]> {
  const guardians = await fetchStudentGuardians(studentId)
  const sorted = [...guardians].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary),
  )
  return Promise.all(
    sorted.map(async (guardian) => {
      try {
        const parent = await fetchParent(guardian.parent)
        return { guardian, parent }
      } catch {
        return { guardian, parent: null }
      }
    }),
  )
}

export function useStudentGuardiansQuery(studentId: string | null) {
  return useQuery({
    queryKey: queryKeys.studentGuardians(studentId),
    queryFn: () => fetchGuardiansWithParents(studentId!),
    enabled: Boolean(studentId),
  })
}
