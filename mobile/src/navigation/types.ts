import type { RollCallOrigin } from "@/features/attendance/rollCallApi"

export type { RollCallOrigin }

export type Tab = "today" | "courses" | "group" | "more"
export type CourseSection = "attendance" | "activities" | "grades" | "students"
export type GroupTab = "rollCall" | "ranking" | "disciplinary" | "reports"
export type ReportPick = "bulletin" | "indicators" | "record"
export type StudentProfileTab = "grades" | "attendance" | "indicators" | "disciplinary" | "family"
export type PeriodGradesTab = "suggested" | "review"
export type PlanView = "estructura" | "calendario"

export const TABS: Tab[] = ["today", "courses", "group", "more"]
export const COURSE_SECTIONS: CourseSection[] = [
  "attendance",
  "activities",
  "grades",
  "students",
]
export const GROUP_TABS: GroupTab[] = [
  "rollCall",
  "ranking",
  "disciplinary",
  "reports",
]
export const REPORT_PICKS: ReportPick[] = ["bulletin", "indicators", "record"]
export const STUDENT_PROFILE_TABS: StudentProfileTab[] = [
  "grades",
  "attendance",
  "indicators",
  "disciplinary",
  "family",
]
export const PERIOD_GRADES_TABS: PeriodGradesTab[] = ["suggested", "review"]
export const PLAN_VIEWS: PlanView[] = ["estructura", "calendario"]
export const ROLL_CALL_ORIGINS: RollCallOrigin[] = ["subject", "group"]
