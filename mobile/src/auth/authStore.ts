import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { loginRequest, toAuthUser } from '@/features/auth/loginApi'
import type { AuthUser } from '@/types/user'

type AuthState = {
  access: string | null
  refresh: string | null
  user: AuthUser | null
  setAccessToken: (token: string) => void
  setSession: (payload: {
    access: string
    refresh: string
    user: AuthUser
  }) => void
  clearSession: () => void
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      access: null,
      refresh: null,
      user: null,
      setAccessToken: (access) => set({ access }),
      setSession: ({ access, refresh, user }) => set({ access, refresh, user }),
      clearSession: () => set({ access: null, refresh: null, user: null }),
      login: async (username, password) => {
        const data = await loginRequest(username, password)
        set({
          access: data.access,
          refresh: data.refresh,
          user: toAuthUser(data.user),
        })
      },
      logout: () => set({ access: null, refresh: null, user: null }),
    }),
    {
      name: 'educalc-teacher-auth',
      partialize: (s) => ({
        access: s.access,
        refresh: s.refresh,
        user: s.user,
      }),
    },
  ),
)
