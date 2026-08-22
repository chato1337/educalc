import { matchPath } from "react-router-dom"

import type { RollCallOrigin } from "@/features/attendance/rollCallApi"

import type {
  CourseSection,
  GroupTab,
  PeriodGradesTab,
  PlanView,
  ReportPick,
  StudentProfileTab,
  Tab,
} from "./types"
import {
  COURSE_SECTIONS,
  GROUP_TABS,
  PERIOD_GRADES_TABS,
  PLAN_VIEWS,
  REPORT_PICKS,
  ROLL_CALL_ORIGINS,
  STUDENT_PROFILE_TABS,
} from "./types"

function oneOf<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
): T | undefined {
  if (!value) return undefined
  return (allowed as readonly string[]).includes(value) ? value as T : undefined
}

function qs(params: Record<string, string | undefined | null>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value)
  }
  const serialized = search.toString()
  return serialized ? `?${serialized}` : ""
}

export const routes = {
  login: () => "/login",
  authCallback: () => "/auth/callback",
  today: () => "/today",
  courses: () => "/courses",
  more: () => "/more",
  course: (courseId: string, opts?: { section?: CourseSection }) =>
    `/courses/${courseId}${qs({
      section:
        opts?.section && opts.section !== "attendance"
          ? opts.section
          : undefined,
    })}`,
  rollCall: (
    courseId: string,
    opts?: { origin?: RollCallOrigin; date?: string },
  ) =>
    `/courses/${courseId}/roll-call${qs({
      origin:
        opts?.origin && opts.origin !== "subject" ? opts.origin : undefined,
      date: opts?.date,
    })}`,
  gradeActivity: (courseId: string, activityId: string) =>
    `/courses/${courseId}/activities/${activityId}`,
  periodGrades: (courseId: string, opts?: { tab?: PeriodGradesTab }) =>
    `/courses/${courseId}/period-grades${qs({
      tab: opts?.tab && opts.tab !== "suggested" ? opts.tab : undefined,
    })}`,
  recoveries: (courseId: string) => `/courses/${courseId}/recoveries`,
  schemePlan: (courseId: string, opts?: { view?: PlanView }) =>
    `/courses/${courseId}/plan${qs({
      view: opts?.view && opts.view !== "estructura" ? opts.view : undefined,
    })}`,
  courseStudent: (
    courseId: string,
    studentId: string,
    opts?: { tab?: StudentProfileTab },
  ) =>
    `/courses/${courseId}/students/${studentId}${qs({
      tab: opts?.tab && opts.tab !== "grades" ? opts.tab : undefined,
    })}`,
  courseStudentIndicators: (courseId: string, studentId: string) =>
    `/courses/${courseId}/students/${studentId}/indicators`,
  group: (opts?: { tab?: GroupTab; pick?: ReportPick }) =>
    `/group${qs({
      tab: opts?.tab && opts.tab !== "rollCall" ? opts.tab : undefined,
      pick: opts?.pick,
    })}`,
  groupStudent: (studentId: string, opts?: { tab?: StudentProfileTab }) =>
    `/group/students/${studentId}${qs({
      tab: opts?.tab && opts.tab !== "grades" ? opts.tab : undefined,
    })}`,
  groupStudentIndicators: (studentId: string) =>
    `/group/students/${studentId}/indicators`,
  groupBulletin: (studentId?: string) =>
    studentId ? `/group/bulletin/${studentId}` : "/group/bulletin",
  groupIndicators: (studentId: string) => `/group/indicators/${studentId}`,
  groupSchoolRecord: (studentId: string) => `/group/school-record/${studentId}`,
}

export function parseCourseSection(
  value: string | null | undefined,
): CourseSection {
  return oneOf(value, COURSE_SECTIONS) ?? "attendance"
}

export function parseGroupTab(value: string | null | undefined): GroupTab {
  return oneOf(value, GROUP_TABS) ?? "rollCall"
}

export function parseReportPick(
  value: string | null | undefined,
): ReportPick | null {
  return oneOf(value, REPORT_PICKS) ?? null
}

export function parseStudentProfileTab(
  value: string | null | undefined,
): StudentProfileTab {
  return oneOf(value, STUDENT_PROFILE_TABS) ?? "grades"
}

export function parsePeriodGradesTab(
  value: string | null | undefined,
): PeriodGradesTab {
  return oneOf(value, PERIOD_GRADES_TABS) ?? "suggested"
}

export function parsePlanView(value: string | null | undefined): PlanView {
  return oneOf(value, PLAN_VIEWS) ?? "estructura"
}

export function parseRollCallOrigin(
  value: string | null | undefined,
): RollCallOrigin {
  return oneOf(value, ROLL_CALL_ORIGINS) ?? "subject"
}

export function tabFromPathname(pathname: string): Tab {
  if (pathname === "/courses" || pathname.startsWith("/courses/")) {
    return "courses"
  }
  if (pathname === "/group" || pathname.startsWith("/group/")) return "group"
  if (pathname === "/more" || pathname.startsWith("/more/")) return "more"
  return "today"
}

export function isTabRootPath(pathname: string): boolean {
  return (
    pathname === "/today" ||
    pathname === "/courses" ||
    pathname === "/group" ||
    pathname === "/more"
  )
}

export function phoneShowsTabBar(pathname: string): boolean {
  if (isTabRootPath(pathname)) return true
  return Boolean(matchPath({ path: "/courses/:courseId", end: true }, pathname))
}

export function courseIdFromPathname(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean)
  if (parts[0] === "courses" && parts[1]) return parts[1]
  return null
}

export function inferGroupTab(pathname: string): GroupTab {
  if (
    pathname.startsWith("/group/bulletin") ||
    pathname.startsWith("/group/indicators") ||
    pathname.startsWith("/group/school-record")
  ) {
    return "reports"
  }
  if (pathname.startsWith("/group/students")) return "ranking"
  return "rollCall"
}

export function inferReportPick(pathname: string): ReportPick | null {
  if (pathname.startsWith("/group/bulletin/")) return "bulletin"
  if (pathname.startsWith("/group/indicators/")) return "indicators"
  if (pathname.startsWith("/group/school-record/")) return "record"
  return null
}
