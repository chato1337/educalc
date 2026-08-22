import { useLocation, useParams, useSearchParams } from "react-router-dom"
import type { AcademicGradesBulletinQuery } from "@/features/groups/gradesBulletinApi"
import { GroupScreen } from "@/features/groups/GroupScreen"
import { IndicatorsReportScreen } from "@/features/groups/IndicatorsReportScreen"
import { SchoolRecordScreen } from "@/features/groups/SchoolRecordScreen"
import { useStudentQuery } from "@/features/students/studentsApi"
import { todayIso } from "@/session/periodUtils"
import { useTeacherSession } from "@/session/TeacherSessionContext"
import {
  CourseDetailScreen,
  CoursesScreen,
  GradeActivityScreen,
  IndicatorsEditorScreen,
  MoreScreen,
  PeriodGradesScreen,
  PdfViewerScreen,
  RecoveriesScreen,
  RollCallScreen,
  SchemePlanScreen,
  StudentProfileScreen,
  TodayScreen,
} from "@/screens"

import {
  inferGroupTab,
  inferReportPick,
  parseCourseSection,
  parseGroupTab,
  parsePeriodGradesTab,
  parsePlanView,
  parseReportPick,
  parseRollCallOrigin,
  parseStudentProfileTab,
  routes,
} from "./routes"
import { useBreakpoint } from "./useBreakpoint"
import { useAppNav, useLogout } from "./useAppNav"

function useRequiredParam(name: string): string {
  const params = useParams()
  return params[name] ?? ""
}

function useDirectorCourseId() {
  const { courses, defaultCourseId } = useTeacherSession()
  return courses.find((c) => c.isDirectorGroup)?.id ?? defaultCourseId
}

function useStudentDisplayName(studentId: string | undefined) {
  const query = useStudentQuery(studentId ?? null)
  return query.data?.full_name
}

function useBulletinQuery(
  studentId?: string | null,
): AcademicGradesBulletinQuery | null {
  const session = useTeacherSession()
  const yearId = session.academicYear?.id
  const groupId = session.gradeDirectors[0]?.group
  if (!yearId) return null
  if (studentId) {
    return {
      academic_year: yearId,
      student: studentId,
      period_ids: session.selectedPeriodId ?? undefined,
    }
  }
  if (!groupId) return null
  return {
    academic_year: yearId,
    group: groupId,
    period_ids: session.selectedPeriodId ?? undefined,
  }
}

export function TodayPage() {
  const session = useTeacherSession()
  const { go } = useAppNav()
  const selectedPeriodId = session.selectedPeriodId ?? ""
  return (
    <TodayScreen
      selectedPeriodId={selectedPeriodId}
      onSelectPeriod={session.setSelectedPeriodId}
      onGoToRollCall={(courseId) => go(routes.rollCall(courseId))}
      onGoToGradeActivity={(courseId) =>
        go(routes.course(courseId, { section: "activities" }))
      }
      onGoToPeriodGrades={(courseId) => go(routes.periodGrades(courseId))}
      onGoToRecoveries={(courseId) => go(routes.recoveries(courseId))}
      onOpenCourse={(courseId) =>
        go(routes.course(courseId, { section: "attendance" }))
      }
    />
  )
}

export function CoursesPage() {
  const session = useTeacherSession()
  const { go } = useAppNav()
  return (
    <CoursesScreen
      selectedCourseId={null}
      onSelectCourse={(courseId) => go(routes.course(courseId))}
      selectedPeriodId={session.selectedPeriodId ?? ""}
    />
  )
}

export function CourseDetailPage() {
  const courseId = useRequiredParam("courseId")
  const [searchParams] = useSearchParams()
  const { go, replace, back } = useAppNav()
  const isTablet = useBreakpoint()
  const section = parseCourseSection(searchParams.get("section"))
  return (
    <CourseDetailScreen
      courseId={courseId}
      section={section}
      onSectionChange={(next) =>
        replace(routes.course(courseId, { section: next }))
      }
      onGoToRollCall={() => go(routes.rollCall(courseId))}
      onGoToGradeActivity={(activityId) =>
        go(routes.gradeActivity(courseId, activityId))
      }
      onGoToPeriodGrades={() => go(routes.periodGrades(courseId))}
      onGoToRecoveries={() => go(routes.recoveries(courseId))}
      onGoToPlan={() => go(routes.schemePlan(courseId))}
      onSelectStudent={(studentId) =>
        go(routes.courseStudent(courseId, studentId))
      }
      onBack={isTablet ? undefined : back}
    />
  )
}

export function RollCallPage() {
  const courseId = useRequiredParam("courseId")
  const [searchParams] = useSearchParams()
  const { replace, back } = useAppNav()
  const origin = parseRollCallOrigin(searchParams.get("origin"))
  const date = searchParams.get("date") || todayIso()
  return (
    <RollCallScreen
      courseId={courseId}
      origin={origin}
      date={date}
      onOriginChange={(next) =>
        replace(routes.rollCall(courseId, { origin: next, date }))
      }
      onDateChange={(next) =>
        replace(routes.rollCall(courseId, { origin, date: next }))
      }
      onSaved={back}
      onBack={back}
    />
  )
}

export function GradeActivityPage() {
  const courseId = useRequiredParam("courseId")
  const activityId = useRequiredParam("activityId")
  const { go, back } = useAppNav()
  return (
    <GradeActivityScreen
      courseId={courseId}
      activityId={activityId}
      onBack={back}
      onGoToPeriodGrades={() => go(routes.periodGrades(courseId))}
    />
  )
}

export function PeriodGradesPage() {
  const courseId = useRequiredParam("courseId")
  const [searchParams] = useSearchParams()
  const session = useTeacherSession()
  const { go, replace, back } = useAppNav()
  const tab = parsePeriodGradesTab(searchParams.get("tab"))
  return (
    <PeriodGradesScreen
      courseId={courseId}
      periodId={session.selectedPeriodId ?? ""}
      tab={tab}
      onTabChange={(next) =>
        replace(routes.periodGrades(courseId, { tab: next }))
      }
      onBack={back}
      onGoToRecoveries={() => go(routes.recoveries(courseId))}
      onGoToPlan={() => go(routes.schemePlan(courseId))}
    />
  )
}

export function RecoveriesPage() {
  const courseId = useRequiredParam("courseId")
  const { back } = useAppNav()
  return <RecoveriesScreen courseId={courseId} onBack={back} />
}

export function SchemePlanPage() {
  const courseId = useRequiredParam("courseId")
  const [searchParams] = useSearchParams()
  const { replace, back } = useAppNav()
  const phoneView = parsePlanView(searchParams.get("view"))
  return (
    <SchemePlanScreen
      courseId={courseId}
      phoneView={phoneView}
      onPhoneViewChange={(view) =>
        replace(routes.schemePlan(courseId, { view }))
      }
      onBack={back}
    />
  )
}

export function StudentProfilePage() {
  const courseId = useParams().courseId
  const studentId = useRequiredParam("studentId")
  const [searchParams] = useSearchParams()
  const { go, replace, back } = useAppNav()
  const tab = parseStudentProfileTab(searchParams.get("tab"))
  return (
    <StudentProfileScreen
      studentId={studentId}
      courseId={courseId}
      tab={tab}
      onTabChange={(next) =>
        replace(
          courseId
            ? routes.courseStudent(courseId, studentId, { tab: next })
            : routes.groupStudent(studentId, { tab: next }),
        )
      }
      onBack={back}
      onEditIndicator={(sid, cid) => {
        if (cid) go(routes.courseStudentIndicators(cid, sid))
        else if (courseId) go(routes.courseStudentIndicators(courseId, sid))
        else go(routes.groupStudentIndicators(sid))
      }}
    />
  )
}

export function IndicatorsEditorPage() {
  const courseId = useParams().courseId
  const studentId = useRequiredParam("studentId")
  const { back } = useAppNav()
  return (
    <IndicatorsEditorScreen
      studentId={studentId}
      courseId={courseId}
      onBack={back}
    />
  )
}

export function MorePage() {
  const onLogout = useLogout()
  return <MoreScreen onLogout={onLogout} />
}

export function GroupPage() {
  const directorCourseId = useDirectorCourseId()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const { go, replace } = useAppNav()
  const atGroupRoot = pathname === "/group"
  const tab = atGroupRoot
    ? parseGroupTab(searchParams.get("tab"))
    : inferGroupTab(pathname)
  const pick = atGroupRoot
    ? tab === "reports"
      ? parseReportPick(searchParams.get("pick"))
      : null
    : inferReportPick(pathname)
  return (
    <GroupScreen
      tab={tab}
      onTabChange={(next) => replace(routes.group({ tab: next }))}
      pick={pick}
      onPickChange={(next) =>
        replace(routes.group({ tab: "reports", pick: next ?? undefined }))
      }
      onSelectStudent={(studentId) => go(routes.groupStudent(studentId))}
      onGoToRollCall={() => {
        if (!directorCourseId) return
        go(routes.rollCall(directorCourseId, { origin: "group" }))
      }}
      onOpenBulletin={(studentId) => go(routes.groupBulletin(studentId))}
      onOpenIndicatorsReport={(studentId) =>
        go(routes.groupIndicators(studentId))
      }
      onOpenSchoolRecord={(studentId) =>
        go(routes.groupSchoolRecord(studentId))
      }
    />
  )
}

export function BulletinPage() {
  const studentId = useParams().studentId
  const { back } = useAppNav()
  const query = useBulletinQuery(studentId)
  const session = useTeacherSession()
  const director = session.gradeDirectors[0]
  const period = session.periods.find((p) => p.id === session.selectedPeriodId)
  return (
    <PdfViewerScreen
      title={studentId ? "Boletín" : "Boletín del grupo"}
      subtitle={[director?.group_name, period?.name]
        .filter(Boolean)
        .join(" · ")}
      query={query}
      onBack={back}
    />
  )
}

export function IndicatorsReportPage() {
  const studentId = useRequiredParam("studentId")
  const { back } = useAppNav()
  const studentName = useStudentDisplayName(studentId)
  return (
    <IndicatorsReportScreen
      studentId={studentId}
      studentName={studentName}
      onBack={back}
    />
  )
}

export function SchoolRecordPage() {
  const studentId = useRequiredParam("studentId")
  const { back } = useAppNav()
  const studentName = useStudentDisplayName(studentId)
  return (
    <SchoolRecordScreen
      studentId={studentId}
      studentName={studentName}
      onBack={back}
    />
  )
}
