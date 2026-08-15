import { useQuery } from '@tanstack/react-query'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'

import { queryKeys } from '@/api/queryKeys'
import type { Course, Period } from '@/data'
import { fetchDashboardKpis } from '@/features/dashboard/dashboardKpisApi'
import type { DashboardKpisResponse } from '@/features/dashboard/dashboardKpis.types'
import { assignmentsToCourses } from '@/session/courseUtils'
import {
  pickDefaultPeriodId,
  toSessionPeriod,
} from '@/session/periodUtils'
import { useSessionPrefsStore } from '@/session/sessionPrefsStore'
import { useTeacherBootstrap } from '@/session/useTeacherBootstrap'
import type {
  AcademicYear,
  GradeDirector,
  GradingScale,
  Teacher,
} from '@/types/schemas'
import type { MeUser } from '@/types/user'

export type TeacherSessionValue = {
  me: MeUser
  teacher: Teacher | null
  academicYear: AcademicYear | null
  periods: Period[]
  selectedPeriodId: string | null
  setSelectedPeriodId: (id: string) => void
  courses: Course[]
  truncated: boolean
  gradeDirectors: GradeDirector[]
  isDirector: boolean
  gradingScales: GradingScale[]
  kpis: DashboardKpisResponse | undefined
  kpisLoading: boolean
  lastCourseAssignmentId: string | null
  setLastCourseAssignmentId: (id: string) => void
  defaultCourseId: string | null
  displayName: string
  firstName: string
  institutionName: string
}

const TeacherSessionContext = createContext<TeacherSessionValue | null>(null)

export function TeacherSessionProvider({
  me,
  children,
}: {
  me: MeUser
  children: ReactNode
}) {
  const bootstrap = useTeacherBootstrap(me)
  const selectedPeriodId = useSessionPrefsStore((s) => s.selectedPeriodId)
  const lastCourseAssignmentId = useSessionPrefsStore(
    (s) => s.lastCourseAssignmentId,
  )
  const setSelectedPeriodId = useSessionPrefsStore((s) => s.setSelectedPeriodId)
  const setLastCourseAssignmentId = useSessionPrefsStore(
    (s) => s.setLastCourseAssignmentId,
  )

  const periods = useMemo(
    () => bootstrap.periods.map((p) => toSessionPeriod(p)),
    [bootstrap.periods],
  )

  useEffect(() => {
    if (bootstrap.periods.length === 0) return
    const ids = new Set(bootstrap.periods.map((p) => p.id))
    if (!selectedPeriodId || !ids.has(selectedPeriodId)) {
      const next = pickDefaultPeriodId(bootstrap.periods)
      if (next) setSelectedPeriodId(next)
    }
  }, [bootstrap.periods, selectedPeriodId, setSelectedPeriodId])

  const kpisQuery = useQuery({
    queryKey: queryKeys.dashboardKpis(selectedPeriodId),
    queryFn: () => fetchDashboardKpis(selectedPeriodId),
    enabled: Boolean(selectedPeriodId),
  })

  const courses = useMemo(
    () => assignmentsToCourses(bootstrap.assignments, bootstrap.gradeDirectors),
    [bootstrap.assignments, bootstrap.gradeDirectors],
  )

  useEffect(() => {
    if (courses.length === 0) return
    if (
      !lastCourseAssignmentId ||
      !courses.some((c) => c.id === lastCourseAssignmentId)
    ) {
      setLastCourseAssignmentId(courses[0].id)
    }
  }, [courses, lastCourseAssignmentId, setLastCourseAssignmentId])

  const defaultCourseId =
    (lastCourseAssignmentId &&
    courses.some((c) => c.id === lastCourseAssignmentId)
      ? lastCourseAssignmentId
      : courses[0]?.id) ?? null

  const teacher = bootstrap.teacher
  const displayName = teacher?.full_name || me.username
  const firstName = teacher?.first_name || displayName.split(' ')[0] || me.username
  const institutionName = bootstrap.academicYear?.institution_name || ''

  const value: TeacherSessionValue = {
    me,
    teacher,
    academicYear: bootstrap.academicYear,
    periods,
    selectedPeriodId,
    setSelectedPeriodId,
    courses,
    truncated: bootstrap.truncated,
    gradeDirectors: bootstrap.gradeDirectors,
    isDirector: bootstrap.gradeDirectors.length > 0,
    gradingScales: bootstrap.gradingScales,
    kpis: kpisQuery.data,
    kpisLoading: kpisQuery.isLoading,
    lastCourseAssignmentId,
    setLastCourseAssignmentId,
    defaultCourseId,
    displayName,
    firstName,
    institutionName,
  }

  return (
    <TeacherSessionContext.Provider value={value}>
      {children}
    </TeacherSessionContext.Provider>
  )
}

export function useTeacherSession(): TeacherSessionValue {
  const ctx = useContext(TeacherSessionContext)
  if (!ctx) {
    throw new Error('useTeacherSession must be used within TeacherSessionProvider')
  }
  return ctx
}

export function useSessionCourse(courseId: string): Course | undefined {
  const { courses } = useTeacherSession()
  return courses.find((c) => c.id === courseId)
}

export function useBootstrapStatus(me: MeUser | undefined) {
  return useTeacherBootstrap(me)
}
