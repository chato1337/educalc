import { useQuery } from '@tanstack/react-query'

import { fetchAllPages } from '@/api/list'
import { queryKeys } from '@/api/queryKeys'
import type { Attendance } from '@/types/schemas'

export type AttendanceListParams = {
  group?: string
  student?: string
  academic_period?: string
  course_assignment?: string
  /** `true` = group-level rows (the ones roll call overwrites). */
  generalOnly?: boolean
}

export async function fetchAttendances(
  params: AttendanceListParams,
): Promise<Attendance[]> {
  const query: Record<string, string | undefined> = {
    group: params.group,
    student: params.student,
    academic_period: params.academic_period,
    course_assignment: params.course_assignment,
  }
  if (params.generalOnly) query.course_assignment__isnull = 'true'
  return fetchAllPages<Attendance>('/api/attendances/', query)
}

export function useAttendancesQuery(params: AttendanceListParams | null) {
  return useQuery({
    queryKey: queryKeys.attendances({
      group: params?.group,
      student: params?.student,
      academic_period: params?.academic_period,
      course_assignment: params?.course_assignment,
      generalOnly: params?.generalOnly,
    }),
    queryFn: () => fetchAttendances(params!),
    enabled: Boolean(
      params?.academic_period && (params.group || params.student),
    ),
  })
}

export function summarizeAttendances(
  rows: Attendance[],
  rosterCount = 0,
) {
  let excused = 0
  let unexcused = 0
  const withAbsences: Attendance[] = []
  const withAbsenceStudentIds = new Set<string>()
  for (const row of rows) {
    const ce = row.excused_absences ?? 0
    const se = row.unexcused_absences ?? 0
    excused += ce
    unexcused += se
    if (ce > 0 || se > 0) {
      withAbsences.push(row)
      withAbsenceStudentIds.add(row.student)
    }
  }
  // Group-level Attendance rows only exist for students with absences.
  const withoutAbsences = Math.max(0, rosterCount - withAbsenceStudentIds.size)
  return { excused, unexcused, withoutAbsences, withAbsences }
}
