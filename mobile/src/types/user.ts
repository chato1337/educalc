export const ROLE_TEACHER = 'TEACHER'

export type AuthUser = {
  id: number
  username: string
  email: string
  role: string | null
  institution_id: string | null
}

/** GET /api/auth/me/ — OpenAPI declares an empty object; same contract as staff. */
export type MeUser = AuthUser & {
  teacher_id: string | null
  parent_id: string | null
}

export function isTeacherUser(me: MeUser | null | undefined): me is MeUser & {
  teacher_id: string
} {
  return Boolean(me && me.role === ROLE_TEACHER && me.teacher_id)
}
