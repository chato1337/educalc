import { lazy } from 'react'

/** Páginas cargadas bajo demanda para reducir el bundle inicial (Fase 12). */
export const LoginPage = lazy(() =>
  import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage })),
)

export const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({
    default: m.DashboardPage,
  })),
)

export const InstitutionsPage = lazy(() =>
  import('@/features/institutions/InstitutionsPage').then((m) => ({
    default: m.InstitutionsPage,
  })),
)

export const CampusesPage = lazy(() =>
  import('@/features/campuses/CampusesPage').then((m) => ({
    default: m.CampusesPage,
  })),
)

export const BulkLoadPage = lazy(() =>
  import('@/features/students/BulkLoadPage').then((m) => ({
    default: m.BulkLoadPage,
  })),
)

export const StudentFormPage = lazy(() =>
  import('@/features/students/StudentFormPage').then((m) => ({
    default: m.StudentFormPage,
  })),
)

export const StudentGradesSummaryPage = lazy(() =>
  import('@/features/students/StudentGradesSummaryPage').then((m) => ({
    default: m.StudentGradesSummaryPage,
  })),
)

export const StudentDetailPage = lazy(() =>
  import('@/features/students/StudentDetailPage').then((m) => ({
    default: m.StudentDetailPage,
  })),
)

export const StudentsPage = lazy(() =>
  import('@/features/students/StudentsPage').then((m) => ({
    default: m.StudentsPage,
  })),
)

export const TeachersPage = lazy(() =>
  import('@/features/people/TeachersPage').then((m) => ({
    default: m.TeachersPage,
  })),
)

export const ParentsPage = lazy(() =>
  import('@/features/people/ParentsPage').then((m) => ({
    default: m.ParentsPage,
  })),
)

export const UsersPage = lazy(() =>
  import('@/features/people/UsersPage').then((m) => ({
    default: m.UsersPage,
  })),
)

export const StudentGuardiansPage = lazy(() =>
  import('@/features/people/StudentGuardiansPage').then((m) => ({
    default: m.StudentGuardiansPage,
  })),
)

export const GradeDirectorsPage = lazy(() =>
  import('@/features/people/GradeDirectorsPage').then((m) => ({
    default: m.GradeDirectorsPage,
  })),
)

export const GroupRankingsPage = lazy(() =>
  import('@/features/groups/GroupRankingsPage').then((m) => ({
    default: m.GroupRankingsPage,
  })),
)

export const AcademicYearsPage = lazy(() =>
  import('@/features/academic-structure/AcademicYearsPage').then((m) => ({
    default: m.AcademicYearsPage,
  })),
)

export const AcademicPeriodsPage = lazy(() =>
  import('@/features/academic-structure/AcademicPeriodsPage').then((m) => ({
    default: m.AcademicPeriodsPage,
  })),
)

export const GradeLevelsPage = lazy(() =>
  import('@/features/academic-structure/GradeLevelsPage').then((m) => ({
    default: m.GradeLevelsPage,
  })),
)

export const GroupsPage = lazy(() =>
  import('@/features/academic-structure/GroupsPage').then((m) => ({
    default: m.GroupsPage,
  })),
)

export const AcademicAreasPage = lazy(() =>
  import('@/features/academic-structure/AcademicAreasPage').then((m) => ({
    default: m.AcademicAreasPage,
  })),
)

export const SubjectsPage = lazy(() =>
  import('@/features/academic-structure/SubjectsPage').then((m) => ({
    default: m.SubjectsPage,
  })),
)

export const EnrollmentsPage = lazy(() =>
  import('@/features/operations/EnrollmentsPage').then((m) => ({
    default: m.EnrollmentsPage,
  })),
)

export const CourseAssignmentsPage = lazy(() =>
  import('@/features/operations/CourseAssignmentsPage').then((m) => ({
    default: m.CourseAssignmentsPage,
  })),
)

export const GradingScalesPage = lazy(() =>
  import('@/features/operations/GradingScalesPage').then((m) => ({
    default: m.GradingScalesPage,
  })),
)

export const GradesPage = lazy(() =>
  import('@/features/operations/GradesPage').then((m) => ({
    default: m.GradesPage,
  })),
)

export const AcademicIndicatorsPage = lazy(() =>
  import('@/features/operations/AcademicIndicatorsPage').then((m) => ({
    default: m.AcademicIndicatorsPage,
  })),
)

export const PerformanceSummariesPage = lazy(() =>
  import('@/features/operations/PerformanceSummariesPage').then((m) => ({
    default: m.PerformanceSummariesPage,
  })),
)

export const AttendancesPage = lazy(() =>
  import('@/features/operations/AttendancesPage').then((m) => ({
    default: m.AttendancesPage,
  })),
)

export const DisciplinaryReportsPage = lazy(() =>
  import('@/features/operations/DisciplinaryReportsPage').then((m) => ({
    default: m.DisciplinaryReportsPage,
  })),
)

export const SchoolRecordsPage = lazy(() =>
  import('@/features/operations/SchoolRecordsPage').then((m) => ({
    default: m.SchoolRecordsPage,
  })),
)

export const AcademicIndicatorsReportsPage = lazy(() =>
  import('@/features/operations/AcademicIndicatorsReportsPage').then((m) => ({
    default: m.AcademicIndicatorsReportsPage,
  })),
)
