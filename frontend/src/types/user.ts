export type AuthUser = {
  id: number
  username: string
  email: string
  role: string | null
  institution_id: string | null
}

export type MeUser = AuthUser & {
  teacher_id: string | null
  parent_id: string | null
}
