import type { AppRole } from '@/app/roleMatrix'
import {
  ADMIN_COORDINATOR,
  ADMIN_ONLY,
  ALL_APP_ROLES,
  STAFF_ROLES,
} from '@/app/roleMatrix'

type PathRule = { prefix: string; roles: readonly AppRole[] }

function staffPrefixes(): PathRule[] {
  const paths = [
    '/campuses',
    '/academic-years',
    '/academic-periods',
    '/grade-levels',
    '/groups',
    '/academic-areas',
    '/subjects',
    '/teachers',
    '/parents',
    '/student-guardians',
    '/grade-directors',
    '/enrollments',
    '/course-assignments',
    '/grades',
    '/grading-scales',
    '/academic-indicator-catalogs',
    '/academic-indicators',
    '/performance-summaries',
    '/attendances',
    '/disciplinary-reports',
    '/school-records',
    '/academic-indicators-reports',
  ]
  return paths.map((prefix) => ({ prefix, roles: STAFF_ROLES }))
}

/**
 * Reglas más específicas primero (mayor `prefix.length`) para que
 * p. ej. `/students/bulk-load` gane sobre `/students`.
 */
const PATH_RULES: PathRule[] = [
  { prefix: '/students/bulk-load', roles: ADMIN_COORDINATOR },
  { prefix: '/bulk-load', roles: ADMIN_COORDINATOR },
  { prefix: '/institutions', roles: ADMIN_ONLY },
  { prefix: '/users', roles: ADMIN_ONLY },
  { prefix: '/dashboard', roles: ALL_APP_ROLES },
  { prefix: '/students', roles: ALL_APP_ROLES },
  ...staffPrefixes(),
]

/**
 * Roles mínimos para la ruta actual, o `null` si no hay regla (solo autenticación).
 */
export function requiredRolesForPathname(pathname: string): readonly AppRole[] | null {
  const normalized =
    pathname.replace(/\/+$/, '') === '' ? '/' : pathname.replace(/\/+$/, '')
  const matches = PATH_RULES.filter(
    (r) => normalized === r.prefix || normalized.startsWith(`${r.prefix}/`),
  )
  if (matches.length === 0) return null
  matches.sort((a, b) => b.prefix.length - a.prefix.length)
  return matches[0]?.roles ?? null
}
