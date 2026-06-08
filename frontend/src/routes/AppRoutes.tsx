import { Suspense } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'

import { RoutePageFallback } from '@/components/RoutePageFallback'

import { GenericListPage } from '@/features/admin/GenericListPage'
import { resourceListConfigs } from '@/features/admin/resourceConfig'
import { ActivityGradingLayout } from '@/layouts/ActivityGradingLayout'
import { ActivityPlanningLayout } from '@/layouts/ActivityPlanningLayout'
import { AdminLayout } from '@/layouts/AdminLayout'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import {
  AcademicAreasPage,
  AcademicIndicatorCatalogsPage,
  AcademicIndicatorsPage,
  AcademicIndicatorsReportsPage,
  AcademicPeriodsPage,
  AcademicYearsPage,
  ActivityPlanningCalendarPage,
  ActivityPlanningOverviewPage,
  ActivityPlanningWorkspacePage,
  AttendancesPage,
  BulkLoadHubPage,
  CampusesPage,
  CourseAssignmentsPage,
  DashboardPage,
  DisciplinaryReportsPage,
  EnrollmentsPage,
  GradeDirectorsPage,
  GradeLevelsPage,
  GradesPage,
  GradingSchemeDetailPage,
  GradingSchemesPage,
  GradingConsolidatedReportPage,
  GradingScalesPage,
  GroupRankingsPage,
  GroupsPage,
  InstitutionsPage,
  LoginPage,
  ParentsPage,
  PerformanceSummariesPage,
  SchoolRecordsPage,
  StudentActivityScoresPage,
  StudentDetailPage,
  StudentFormPage,
  StudentGradesSummaryPage,
  StudentGuardiansPage,
  StudentsPage,
  SubjectsPage,
  SuggestedGradesPage,
  TeachersPage,
  UsersPage,
} from '@/routes/lazyPages'

function RedirectLegacyGradingSchemeDetail() {
  const { id } = useParams<{ id: string }>()
  return (
    <Navigate to={`/activity-grading/schemes/${id ?? ''}`} replace />
  )
}

function LoginRoute() {
  return (
    <Suspense fallback={<RoutePageFallback />}>
      <LoginPage />
    </Suspense>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="institutions" element={<InstitutionsPage />} />
          <Route path="campuses" element={<CampusesPage />} />
          <Route
            path="students/bulk-load"
            element={<Navigate to="/bulk-load" replace />}
          />
          <Route path="bulk-load" element={<BulkLoadHubPage />} />
          <Route path="students/new" element={<StudentFormPage />} />
          <Route
            path="students/:id/grades-summary"
            element={<StudentGradesSummaryPage />}
          />
          <Route path="students/:id/edit" element={<StudentFormPage />} />
          <Route path="students/:id" element={<StudentDetailPage />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="teachers" element={<TeachersPage />} />
          <Route path="parents" element={<ParentsPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="student-guardians" element={<StudentGuardiansPage />} />
          <Route path="grade-directors" element={<GradeDirectorsPage />} />
          <Route
            path="groups/:groupId/rankings"
            element={<GroupRankingsPage />}
          />
          <Route path="academic-years" element={<AcademicYearsPage />} />
          <Route path="academic-periods" element={<AcademicPeriodsPage />} />
          <Route path="grade-levels" element={<GradeLevelsPage />} />
          <Route path="groups" element={<GroupsPage />} />
          <Route path="academic-areas" element={<AcademicAreasPage />} />
          <Route path="subjects" element={<SubjectsPage />} />
          <Route path="enrollments" element={<EnrollmentsPage />} />
          <Route
            path="course-assignments"
            element={<CourseAssignmentsPage />}
          />
          <Route path="grading-scales" element={<GradingScalesPage />} />
          <Route path="activity-planning" element={<ActivityPlanningLayout />}>
            <Route index element={<ActivityPlanningOverviewPage />} />
            <Route path="calendar" element={<ActivityPlanningCalendarPage />} />
            <Route path="workspace" element={<ActivityPlanningWorkspacePage />} />
            <Route
              path="workspace/:schemeId"
              element={<ActivityPlanningWorkspacePage />}
            />
          </Route>
          <Route path="activity-grading" element={<ActivityGradingLayout />}>
            <Route index element={<Navigate to="schemes" replace />} />
            <Route path="schemes" element={<GradingSchemesPage />} />
            <Route path="schemes/:id" element={<GradingSchemeDetailPage />} />
            <Route
              path="activity-scores"
              element={<StudentActivityScoresPage />}
            />
            <Route
              path="suggested-grades"
              element={<SuggestedGradesPage />}
            />
          </Route>
          <Route
            path="grading-schemes"
            element={<Navigate to="/activity-grading/schemes" replace />}
          />
          <Route
            path="grading-schemes/:id"
            element={<RedirectLegacyGradingSchemeDetail />}
          />
          <Route path="grades" element={<GradesPage />} />
          <Route
            path="academic-indicator-catalogs"
            element={<AcademicIndicatorCatalogsPage />}
          />
          <Route
            path="academic-indicators"
            element={<AcademicIndicatorsPage />}
          />
          <Route
            path="performance-summaries"
            element={<PerformanceSummariesPage />}
          />
          <Route path="attendances" element={<AttendancesPage />} />
          <Route
            path="disciplinary-reports"
            element={<DisciplinaryReportsPage />}
          />
          <Route path="school-records" element={<SchoolRecordsPage />} />
          <Route
            path="academic-indicators-reports"
            element={<AcademicIndicatorsReportsPage />}
          />
          <Route
            path="reports/grading-consolidated"
            element={<GradingConsolidatedReportPage />}
          />
          {resourceListConfigs.map((config) => (
            <Route
              key={config.path}
              path={config.path}
              element={<GenericListPage config={config} />}
            />
          ))}
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
