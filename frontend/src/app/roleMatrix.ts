/**
 * Roles alineados con `UserProfile` en el backend (`backend/core/models.py`).
 * Login y `GET /api/auth/me/` devuelven `profile.role` en estos valores.
 */
export type AppRole = 'ADMIN' | 'COORDINATOR' | 'TEACHER' | 'PARENT'

export const APP_ROLES: readonly AppRole[] = [
  'ADMIN',
  'COORDINATOR',
  'TEACHER',
  'PARENT',
] as const

/** Visibles para cualquier usuario autenticado con rol conocido. */
export const ALL_APP_ROLES: readonly AppRole[] = APP_ROLES

export const ADMIN_ONLY: readonly AppRole[] = ['ADMIN']

export const ADMIN_COORDINATOR: readonly AppRole[] = ['ADMIN', 'COORDINATOR']

/** Personal docente y dirección (sin acudiente). */
export const STAFF_ROLES: readonly AppRole[] = ['ADMIN', 'COORDINATOR', 'TEACHER']

const ROLE_LABEL_ES: Record<AppRole, string> = {
  ADMIN: 'Administrador',
  COORDINATOR: 'Coordinador',
  TEACHER: 'Docente',
  PARENT: 'Acudiente',
}

export function appRoleLabelEs(role: AppRole): string {
  return ROLE_LABEL_ES[role]
}

/** Lista legible para mensajes de permisos (p. ej. «Administrador, Coordinador»). */
export function formatRolesListEs(roles: readonly AppRole[]): string {
  return roles.map((r) => ROLE_LABEL_ES[r]).join(', ')
}

export function normalizeAppRole(
  raw: string | null | undefined,
): AppRole | null {
  if (raw == null || String(raw).trim() === '') return null
  const u = String(raw).trim().toUpperCase()
  return (APP_ROLES as readonly string[]).includes(u) ? (u as AppRole) : null
}

/**
 * Rol usado en UI cuando falta `profile.role` (usuarios legacy sin perfil).
 * Los acudientes deben tener `PARENT` explícito en backend.
 */
export function resolvedAppRole(raw: string | null | undefined): AppRole {
  return normalizeAppRole(raw) ?? 'TEACHER'
}

export function roleMayAccess(
  userRole: AppRole | null,
  allowed: readonly AppRole[] | undefined,
): boolean {
  if (!allowed || allowed.length === 0) return true
  if (!userRole) return false
  if (userRole === 'ADMIN') return true
  return (allowed as readonly string[]).includes(userRole)
}
