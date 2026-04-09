import type { SvgIconComponent } from '@mui/icons-material'
import {
  Assessment,
  AssignmentInd,
  Book,
  Category,
  Class,
  Dashboard,
  DateRange,
  EventNote,
  FactCheck,
  FamilyRestroom,
  Gavel,
  Grade,
  Group,
  Layers,
  LocalLibrary,
  People,
  Person,
  Report,
  School,
  Subject,
  SwapHoriz,
  EventAvailable,
} from '@mui/icons-material'

import type { AppRole } from '@/app/roleMatrix'
import {
  ADMIN_COORDINATOR,
  ADMIN_ONLY,
  ALL_APP_ROLES,
  roleMayAccess,
  STAFF_ROLES,
} from '@/app/roleMatrix'

export type NavItem = {
  labelKey: string
  path: string
  icon?: SvgIconComponent
  /** Si no se define, cualquier rol autenticado con perfil puede verlo. */
  rolesAllowed?: readonly AppRole[]
}

export type NavSection = {
  titleKey: string
  items: NavItem[]
}

export const navSections: NavSection[] = [
  {
    titleKey: 'nav.general',
    items: [
      {
        labelKey: 'nav.home',
        path: '/dashboard',
        icon: Dashboard,
        rolesAllowed: ALL_APP_ROLES,
      },
    ],
  },
  {
    titleKey: 'nav.institutionSection',
    items: [
      {
        labelKey: 'nav.institutions',
        path: '/institutions',
        icon: School,
        rolesAllowed: ADMIN_ONLY,
      },
      {
        labelKey: 'nav.campuses',
        path: '/campuses',
        icon: LocalLibrary,
        rolesAllowed: STAFF_ROLES,
      },
    ],
  },
  {
    titleKey: 'nav.academicStructureSection',
    items: [
      {
        labelKey: 'nav.academicYears',
        path: '/academic-years',
        icon: EventNote,
        rolesAllowed: STAFF_ROLES,
      },
      {
        labelKey: 'nav.academicPeriods',
        path: '/academic-periods',
        icon: DateRange,
        rolesAllowed: STAFF_ROLES,
      },
      {
        labelKey: 'nav.gradeLevels',
        path: '/grade-levels',
        icon: Layers,
        rolesAllowed: STAFF_ROLES,
      },
      {
        labelKey: 'nav.groups',
        path: '/groups',
        icon: Group,
        rolesAllowed: STAFF_ROLES,
      },
      {
        labelKey: 'nav.academicAreas',
        path: '/academic-areas',
        icon: Category,
        rolesAllowed: STAFF_ROLES,
      },
      {
        labelKey: 'nav.subjects',
        path: '/subjects',
        icon: Subject,
        rolesAllowed: STAFF_ROLES,
      },
    ],
  },
  {
    titleKey: 'nav.peopleSection',
    items: [
      {
        labelKey: 'nav.students',
        path: '/students',
        icon: People,
        rolesAllowed: ALL_APP_ROLES,
      },
      {
        labelKey: 'nav.bulkLoadCsv',
        path: '/bulk-load',
        icon: SwapHoriz,
        rolesAllowed: ADMIN_COORDINATOR,
      },
      {
        labelKey: 'nav.teachers',
        path: '/teachers',
        icon: Person,
        rolesAllowed: STAFF_ROLES,
      },
      {
        labelKey: 'nav.parents',
        path: '/parents',
        icon: FamilyRestroom,
        rolesAllowed: ADMIN_COORDINATOR,
      },
      {
        labelKey: 'nav.users',
        path: '/users',
        icon: Person,
        rolesAllowed: ADMIN_ONLY,
      },
      {
        labelKey: 'nav.studentGuardians',
        path: '/student-guardians',
        icon: People,
        rolesAllowed: ADMIN_COORDINATOR,
      },
      {
        labelKey: 'nav.gradeDirectors',
        path: '/grade-directors',
        icon: Person,
        rolesAllowed: STAFF_ROLES,
      },
    ],
  },
  {
    titleKey: 'nav.enrollmentCoursesSection',
    items: [
      {
        labelKey: 'nav.enrollments',
        path: '/enrollments',
        icon: AssignmentInd,
        rolesAllowed: STAFF_ROLES,
      },
      {
        labelKey: 'nav.courseAssignments',
        path: '/course-assignments',
        icon: Class,
        rolesAllowed: STAFF_ROLES,
      },
    ],
  },
  {
    titleKey: 'nav.evaluationSection',
    items: [
      {
        labelKey: 'nav.grades',
        path: '/grades',
        icon: Grade,
        rolesAllowed: STAFF_ROLES,
      },
      {
        labelKey: 'nav.gradingScales',
        path: '/grading-scales',
        icon: FactCheck,
        rolesAllowed: STAFF_ROLES,
      },
      {
        labelKey: 'nav.academicIndicators',
        path: '/academic-indicators',
        icon: Assessment,
        rolesAllowed: STAFF_ROLES,
      },
      {
        labelKey: 'nav.performanceSummaries',
        path: '/performance-summaries',
        icon: Assessment,
        rolesAllowed: STAFF_ROLES,
      },
    ],
  },
  {
    titleKey: 'nav.coexistenceAttendanceSection',
    items: [
      {
        labelKey: 'nav.attendance',
        path: '/attendances',
        icon: EventAvailable,
        rolesAllowed: STAFF_ROLES,
      },
      {
        labelKey: 'nav.disciplinaryReports',
        path: '/disciplinary-reports',
        icon: Gavel,
        rolesAllowed: STAFF_ROLES,
      },
    ],
  },
  {
    titleKey: 'nav.recordsReportsSection',
    items: [
      {
        labelKey: 'nav.schoolRecords',
        path: '/school-records',
        icon: Book,
        rolesAllowed: STAFF_ROLES,
      },
      {
        labelKey: 'nav.academicIndicatorsReports',
        path: '/academic-indicators-reports',
        icon: Report,
        rolesAllowed: STAFF_ROLES,
      },
    ],
  },
]

export function filterNavSectionsForRole(
  sections: NavSection[],
  userRole: AppRole | null,
): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        roleMayAccess(userRole, item.rolesAllowed),
      ),
    }))
    .filter((s) => s.items.length > 0)
}
