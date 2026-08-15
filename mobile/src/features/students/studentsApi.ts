import { useQuery } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import type { Student } from '@/types/schemas'

export type { Student }

/**
 * OpenAPI declares this action as `Student`, but the backend returns
 * `{ student, grades_by_period }` (same as the dashboard KPI: typed by hand).
 */
export type StudentGradesSummaryRow = {
  subject: string
  numerical_grade: number
  performance_level: string | null
}

export type StudentGradesSummaryPeriod = {
  period: {
    id: string
    name: string
    year: number
  }
  grades: StudentGradesSummaryRow[]
  average: number | null
}

export type StudentGradesSummary = {
  student: Student
  grades_by_period: StudentGradesSummaryPeriod[]
}

export async function fetchStudent(id: string): Promise<Student> {
  const { data } = await apiClient.get<Student>(`/api/students/${id}/`)
  return data
}

export async function fetchStudentGradesSummary(
  id: string,
): Promise<StudentGradesSummary> {
  const { data } = await apiClient.get<StudentGradesSummary>(
    `/api/students/${id}/grades-summary/`,
  )
  return data
}

export function useStudentQuery(studentId: string | null) {
  return useQuery({
    queryKey: queryKeys.student(studentId ?? ''),
    queryFn: () => fetchStudent(studentId!),
    enabled: Boolean(studentId),
  })
}

export function useStudentGradesSummaryQuery(studentId: string | null) {
  return useQuery({
    queryKey: queryKeys.studentGradesSummary(studentId ?? ''),
    queryFn: () => fetchStudentGradesSummary(studentId!),
    enabled: Boolean(studentId),
  })
}
