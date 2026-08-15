import { apiClient } from '@/api/client'
import type { components } from '@/types/openapi'

export type CourseAssignment = components['schemas']['CourseAssignment']

export type ForTeacherCourseAssignmentsResponse = {
  results: CourseAssignment[]
  count: number
  truncated?: boolean
}

export async function fetchCourseAssignmentsForTeacher(
  teacherId: string,
  academicYearId?: string | null,
): Promise<ForTeacherCourseAssignmentsResponse> {
  const params: Record<string, string> = { teacher: teacherId }
  if (academicYearId) params.academic_year = academicYearId
  const { data } = await apiClient.get<ForTeacherCourseAssignmentsResponse>(
    '/api/course-assignments/for-teacher/',
    { params },
  )
  return {
    results: data.results ?? [],
    count: data.count ?? data.results?.length ?? 0,
    truncated: Boolean(data.truncated),
  }
}
