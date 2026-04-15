import { useQuery } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
import { fetchReferenceListResults, type PaginatedList } from '@/api/list'
import { queryKeys } from '@/api/queryKeys'
import { fetchGradingScalesList } from '@/features/operations/gradingScalesApi'
import {
  useAcademicYearsQuery,
  useCampusesForInstitution,
  useGradeLevelsQuery,
} from '@/features/academic-structure/academicQueries'
import type {
  AcademicPeriod,
  CourseAssignment,
  Enrollment,
  Grade,
  GradeDirector,
  Group,
  Student,
  Subject,
  Teacher,
} from '@/types/schemas'

export { useAcademicYearsQuery, useCampusesForInstitution, useGradeLevelsQuery }

export function useAcademicPeriodsForYear(academicYearId: string | null) {
  return useQuery({
    queryKey: queryKeys.academicPeriods(academicYearId, undefined),
    queryFn: async () =>
      fetchReferenceListResults<AcademicPeriod>('/api/academic-periods/', {
        params: academicYearId ? { academic_year: academicYearId } : undefined,
      }),
    enabled: !!academicYearId,
  })
}

export function useGroupsForFilters(
  institutionId: string | null | undefined,
  filters: {
    academic_year?: string | null
    campus?: string | null
    grade_level?: string | null
  },
  search?: string,
  options?: { enabled?: boolean },
) {
  const listParams = {
    academic_year__institution: institutionId ?? undefined,
    academic_year: filters.academic_year ?? undefined,
    campus: filters.campus ?? undefined,
    grade_level: filters.grade_level ?? undefined,
    search: search || undefined,
  }
  return useQuery({
    queryKey: queryKeys.groups(listParams, search),
    queryFn: async () =>
      fetchReferenceListResults<Group>('/api/groups/', { params: listParams }),
    enabled: (options?.enabled ?? true) && !!institutionId,
  })
}

export function useSubjectsForInstitution(institutionId: string | null) {
  return useQuery({
    queryKey: queryKeys.subjects(institutionId, undefined),
    queryFn: async () => {
      const params =
        institutionId != null && institutionId !== ''
          ? { institution: institutionId }
          : undefined
      return fetchReferenceListResults<Subject>('/api/subjects/', { params })
    },
    enabled: institutionId != null && institutionId !== '',
  })
}

export function useTeachersSearch(search: string) {
  return useQuery({
    queryKey: queryKeys.teachers(search),
    queryFn: async () =>
      fetchReferenceListResults<Teacher>('/api/teachers/', {
        params: search ? { search } : undefined,
      }),
  })
}

export function useCourseAssignmentsList(
  params: Record<string, string | undefined>,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.courseAssignments(params),
    queryFn: async () =>
      fetchReferenceListResults<CourseAssignment>('/api/course-assignments/', {
        params,
      }),
    enabled: options?.enabled ?? true,
  })
}

type ForTeacherCourseAssignmentsResponse = {
  results: CourseAssignment[]
  count: number
  truncated?: boolean
}

/** Todas las asignaciones docente–curso del profesor (una petición, una consulta SQL). */
export async function fetchAllCourseAssignmentsForTeacher(
  teacherId: string,
): Promise<CourseAssignment[]> {
  const { data } = await apiClient.get<ForTeacherCourseAssignmentsResponse>(
    '/api/course-assignments/for-teacher/',
    { params: { teacher: teacherId } },
  )
  return data.results
}

export function useTeacherCourseAssignments(
  teacherId: string | null | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['course-assignments', 'teacher-scope', teacherId ?? ''],
    queryFn: () => fetchAllCourseAssignmentsForTeacher(teacherId!),
    enabled: (options?.enabled ?? true) && Boolean(teacherId),
  })
}

const LARGE_PAGE = 500

/** Lista completa de matrículas para filtros fijos (p. ej. un grupo y año). */
export async function fetchAllEnrollments(
  params: Record<string, string | undefined>,
): Promise<Enrollment[]> {
  let offset = 0
  const all: Enrollment[] = []
  for (;;) {
    const { data } = await apiClient.get<PaginatedList<Enrollment>>(
      '/api/enrollments/',
      { params: { ...params, limit: LARGE_PAGE, offset } },
    )
    all.push(...data.results)
    if (!data.next || data.results.length === 0) break
    offset += LARGE_PAGE
    if (offset > 20_000) break
  }
  return all
}

/** Todas las calificaciones que coinciden con filtros (paginado en servidor). */
export async function fetchAllGrades(
  params: Record<string, string | undefined>,
): Promise<Grade[]> {
  let offset = 0
  const all: Grade[] = []
  for (;;) {
    const { data } = await apiClient.get<PaginatedList<Grade>>(
      '/api/grades/',
      { params: { ...params, limit: LARGE_PAGE, offset } },
    )
    all.push(...data.results)
    if (!data.next || data.results.length === 0) break
    offset += LARGE_PAGE
    if (offset > 20_000) break
  }
  return all
}

export function useGradingScalesForInstitution(institutionId: string | null) {
  return useQuery({
    queryKey: queryKeys.gradingScales(institutionId),
    queryFn: async () => {
      const p =
        institutionId != null && institutionId !== ''
          ? { institution: institutionId }
          : undefined
      return fetchGradingScalesList(p)
    },
    enabled: institutionId != null && institutionId !== '',
  })
}

export function useStudentsSearch(appliedSearch: string) {
  return useQuery({
    queryKey: queryKeys.students(appliedSearch),
    queryFn: async () =>
      fetchReferenceListResults<Student>('/api/students/', {
        params: appliedSearch.trim()
          ? { search: appliedSearch.trim() }
          : undefined,
      }),
  })
}

export function useGradeDirectorsList(
  params: Record<string, string | undefined>,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.gradeDirectors(params),
    queryFn: async () =>
      fetchReferenceListResults<GradeDirector>('/api/grade-directors/', {
        params,
      }),
    enabled: options?.enabled ?? true,
  })
}
