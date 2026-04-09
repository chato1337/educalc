import { useQuery } from '@tanstack/react-query'

import { apiClient } from '@/api/client'
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
    queryFn: async () => {
      const { data } = await apiClient.get<AcademicPeriod[]>(
        '/api/academic-periods/',
        {
          params: academicYearId ? { academic_year: academicYearId } : undefined,
        },
      )
      return data
    },
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
    academic_year: filters.academic_year ?? undefined,
    campus: filters.campus ?? undefined,
    grade_level: filters.grade_level ?? undefined,
    search: search || undefined,
  }
  return useQuery({
    queryKey: queryKeys.groups(listParams, search),
    queryFn: async () => {
      const { data } = await apiClient.get<Group[]>('/api/groups/', {
        params: listParams,
      })
      return data
    },
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
      const { data } = await apiClient.get<Subject[]>('/api/subjects/', {
        params,
      })
      return data
    },
    enabled: institutionId != null && institutionId !== '',
  })
}

export function useTeachersSearch(search: string) {
  return useQuery({
    queryKey: queryKeys.teachers(search),
    queryFn: async () => {
      const { data } = await apiClient.get<Teacher[]>('/api/teachers/', {
        params: search ? { search } : undefined,
      })
      return data
    },
  })
}

export function useCourseAssignmentsList(
  params: Record<string, string | undefined>,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.courseAssignments(params),
    queryFn: async () => {
      const { data } = await apiClient.get<CourseAssignment[]>(
        '/api/course-assignments/',
        { params },
      )
      return data
    },
    enabled: options?.enabled ?? true,
  })
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
    queryFn: async () => {
      const { data } = await apiClient.get<Student[]>('/api/students/', {
        params: appliedSearch.trim()
          ? { search: appliedSearch.trim() }
          : undefined,
      })
      return data
    },
  })
}

export function useGradeDirectorsList(
  params: Record<string, string | undefined>,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.gradeDirectors(params),
    queryFn: async () => {
      const { data } = await apiClient.get<GradeDirector[]>(
        '/api/grade-directors/',
        { params },
      )
      return data
    },
    enabled: options?.enabled ?? true,
  })
}
