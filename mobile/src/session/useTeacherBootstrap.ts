import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import {
  fetchAcademicPeriods,
  fetchAcademicYears,
  fetchGradeDirectorsForTeacher,
  fetchGradingScales,
} from '@/features/academic/academicApi'
import { fetchCourseAssignmentsForTeacher } from '@/features/courses/courseAssignmentsApi'
import { fetchTeacher } from '@/features/people/teachersApi'
import { pickActiveAcademicYear } from '@/session/periodUtils'
import type { MeUser } from '@/types/user'

export function useTeacherBootstrap(me: MeUser | undefined) {
  const teacherId = me?.teacher_id ?? null
  const institutionId = me?.institution_id ?? null
  const enabled = Boolean(teacherId)

  const yearsQuery = useQuery({
    queryKey: queryKeys.academicYears(institutionId),
    queryFn: () => fetchAcademicYears(institutionId),
    enabled,
  })

  const academicYear = pickActiveAcademicYear(yearsQuery.data ?? [])
  const yearId = academicYear?.id ?? null

  const coursesQuery = useQuery({
    queryKey: queryKeys.courseAssignmentsForTeacher(teacherId, yearId),
    queryFn: () => fetchCourseAssignmentsForTeacher(teacherId!, yearId),
    enabled: enabled && Boolean(yearId),
  })

  const periodsQuery = useQuery({
    queryKey: queryKeys.academicPeriods(yearId),
    queryFn: () => fetchAcademicPeriods(yearId!),
    enabled: enabled && Boolean(yearId),
  })

  const directorsQuery = useQuery({
    queryKey: queryKeys.gradeDirectors(teacherId),
    queryFn: () => fetchGradeDirectorsForTeacher(teacherId!),
    enabled,
  })

  const scalesQuery = useQuery({
    queryKey: queryKeys.gradingScales(institutionId),
    queryFn: () => fetchGradingScales(institutionId),
    enabled,
  })

  const teacherQuery = useQuery({
    queryKey: queryKeys.teacher(teacherId ?? ''),
    queryFn: () => fetchTeacher(teacherId!),
    enabled,
  })

  const waitingDependents =
    Boolean(yearId) &&
    (coursesQuery.isPending ||
      periodsQuery.isPending ||
      directorsQuery.isPending ||
      scalesQuery.isPending)

  const error =
    yearsQuery.error ??
    coursesQuery.error ??
    periodsQuery.error ??
    directorsQuery.error ??
    scalesQuery.error ??
    null

  return {
    academicYear,
    assignments: coursesQuery.data?.results ?? [],
    truncated: Boolean(coursesQuery.data?.truncated),
    periods: periodsQuery.data ?? [],
    gradeDirectors: directorsQuery.data ?? [],
    gradingScales: scalesQuery.data ?? [],
    teacher: teacherQuery.data ?? null,
    isLoading: enabled && (yearsQuery.isPending || waitingDependents),
    isError: Boolean(error),
    error,
    refetch: () => {
      void yearsQuery.refetch()
      void coursesQuery.refetch()
      void periodsQuery.refetch()
      void directorsQuery.refetch()
      void scalesQuery.refetch()
      void teacherQuery.refetch()
    },
  }
}
