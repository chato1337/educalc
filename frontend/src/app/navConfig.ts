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
  label: string
  path: string
  icon?: SvgIconComponent
  /** Si no se define, cualquier rol autenticado con perfil puede verlo. */
  rolesAllowed?: readonly AppRole[]
}

export type NavSection = {
  title: string
  items: NavItem[]
}

export const navSections: NavSection[] = [
  {
    title: 'General',
    items: [
      {
        label: 'Inicio',
        path: '/dashboard',
        icon: Dashboard,
        rolesAllowed: ALL_APP_ROLES,
      },
    ],
  },
  {
    title: 'Institución',
    items: [
      {
        label: 'Instituciones',
        path: '/institutions',
        icon: School,
        rolesAllowed: ADMIN_ONLY,
      },
      {
        label: 'Sedes (campus)',
        path: '/campuses',
        icon: LocalLibrary,
        rolesAllowed: STAFF_ROLES,
      },
    ],
  },
  {
    title: 'Estructura académica',
    items: [
      {
        label: 'Años lectivos',
        path: '/academic-years',
        icon: EventNote,
        rolesAllowed: STAFF_ROLES,
      },
      {
        label: 'Períodos',
        path: '/academic-periods',
        icon: DateRange,
        rolesAllowed: STAFF_ROLES,
      },
      {
        label: 'Niveles (grados)',
        path: '/grade-levels',
        icon: Layers,
        rolesAllowed: STAFF_ROLES,
      },
      {
        label: 'Grupos',
        path: '/groups',
        icon: Group,
        rolesAllowed: STAFF_ROLES,
      },
      {
        label: 'Áreas académicas',
        path: '/academic-areas',
        icon: Category,
        rolesAllowed: STAFF_ROLES,
      },
      {
        label: 'Materias (asignaturas)',
        path: '/subjects',
        icon: Subject,
        rolesAllowed: STAFF_ROLES,
      },
    ],
  },
  {
    title: 'Personas',
    items: [
      {
        label: 'Estudiantes',
        path: '/students',
        icon: People,
        rolesAllowed: ALL_APP_ROLES,
      },
      {
        label: 'Carga masiva CSV',
        path: '/students/bulk-load',
        icon: SwapHoriz,
        rolesAllowed: ADMIN_COORDINATOR,
      },
      {
        label: 'Docentes',
        path: '/teachers',
        icon: Person,
        rolesAllowed: STAFF_ROLES,
      },
      {
        label: 'Acudientes',
        path: '/parents',
        icon: FamilyRestroom,
        rolesAllowed: ADMIN_COORDINATOR,
      },
      {
        label: 'Usuarios',
        path: '/users',
        icon: Person,
        rolesAllowed: ADMIN_ONLY,
      },
      {
        label: 'Estudiante–acudiente',
        path: '/student-guardians',
        icon: People,
        rolesAllowed: ADMIN_COORDINATOR,
      },
      {
        label: 'Coordinadores de grado',
        path: '/grade-directors',
        icon: Person,
        rolesAllowed: STAFF_ROLES,
      },
    ],
  },
  {
    title: 'Matrícula y cursos',
    items: [
      {
        label: 'Matrículas',
        path: '/enrollments',
        icon: AssignmentInd,
        rolesAllowed: STAFF_ROLES,
      },
      {
        label: 'Asignación docente–curso',
        path: '/course-assignments',
        icon: Class,
        rolesAllowed: STAFF_ROLES,
      },
    ],
  },
  {
    title: 'Evaluación',
    items: [
      {
        label: 'Calificaciones',
        path: '/grades',
        icon: Grade,
        rolesAllowed: STAFF_ROLES,
      },
      {
        label: 'Escalas de valoración',
        path: '/grading-scales',
        icon: FactCheck,
        rolesAllowed: STAFF_ROLES,
      },
      {
        label: 'Indicadores académicos',
        path: '/academic-indicators',
        icon: Assessment,
        rolesAllowed: STAFF_ROLES,
      },
      {
        label: 'Resúmenes de desempeño',
        path: '/performance-summaries',
        icon: Assessment,
        rolesAllowed: STAFF_ROLES,
      },
    ],
  },
  {
    title: 'Convivencia y asistencia',
    items: [
      {
        label: 'Asistencia',
        path: '/attendances',
        icon: EventAvailable,
        rolesAllowed: STAFF_ROLES,
      },
      {
        label: 'Reportes disciplinarios',
        path: '/disciplinary-reports',
        icon: Gavel,
        rolesAllowed: STAFF_ROLES,
      },
    ],
  },
  {
    title: 'Expedientes e informes',
    items: [
      {
        label: 'Libro final de calificaciones',
        path: '/school-records',
        icon: Book,
        rolesAllowed: STAFF_ROLES,
      },
      {
        label: 'Informes de indicadores',
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
