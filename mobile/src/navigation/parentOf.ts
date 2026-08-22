import { matchPath } from "react-router-dom"

import { routes } from "./routes"

export function parentOf(pathname: string): string {
  const courseIndicators = matchPath(
    "/courses/:courseId/students/:studentId/indicators",
    pathname,
  )
  if (courseIndicators?.params.courseId && courseIndicators.params.studentId) {
    return routes.courseStudent(
      courseIndicators.params.courseId,
      courseIndicators.params.studentId,
    )
  }

  const courseStudent = matchPath(
    "/courses/:courseId/students/:studentId",
    pathname,
  )
  if (courseStudent?.params.courseId) {
    return routes.course(courseStudent.params.courseId, { section: "students" })
  }

  const gradeActivity = matchPath(
    "/courses/:courseId/activities/:activityId",
    pathname,
  )
  if (gradeActivity?.params.courseId) {
    return routes.course(gradeActivity.params.courseId, {
      section: "activities",
    })
  }

  const rollCall = matchPath("/courses/:courseId/roll-call", pathname)
  if (rollCall?.params.courseId) {
    return routes.course(rollCall.params.courseId, { section: "attendance" })
  }

  const periodGrades = matchPath("/courses/:courseId/period-grades", pathname)
  if (periodGrades?.params.courseId) {
    return routes.course(periodGrades.params.courseId, { section: "grades" })
  }

  const recoveries = matchPath("/courses/:courseId/recoveries", pathname)
  if (recoveries?.params.courseId) {
    return routes.course(recoveries.params.courseId, { section: "grades" })
  }

  const plan = matchPath("/courses/:courseId/plan", pathname)
  if (plan?.params.courseId) {
    return routes.course(plan.params.courseId, { section: "activities" })
  }

  const course = matchPath("/courses/:courseId", pathname)
  if (course) return routes.courses()

  const groupIndicatorsEditor = matchPath(
    "/group/students/:studentId/indicators",
    pathname,
  )
  if (groupIndicatorsEditor?.params.studentId) {
    return routes.groupStudent(groupIndicatorsEditor.params.studentId)
  }

  const groupStudent = matchPath("/group/students/:studentId", pathname)
  if (groupStudent) return routes.group({ tab: "ranking" })

  if (
    matchPath("/group/bulletin/:studentId", pathname) ||
    matchPath("/group/bulletin", pathname) ||
    matchPath("/group/indicators/:studentId", pathname) ||
    matchPath("/group/school-record/:studentId", pathname)
  ) {
    return routes.group({ tab: "reports" })
  }

  return routes.today()
}
