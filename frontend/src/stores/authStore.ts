import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { loginRequest } from '@/features/auth/loginApi'
import { useUiStore } from '@/stores/uiStore'
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
      setSession: ({ access, refresh, user }) => {
        set({ access, refresh, user })
        useUiStore.getState().syncInstitutionFromUser(user)
      },
      clearSession: () => {
        set({ access: null, refresh: null, user: null })
        useUiStore.getState().setSelectedInstitutionId(null)
      },
      login: async (username, password) => {
        const data = await loginRequest(username, password)
        set({
          access: data.access,
          refresh: data.refresh,
          user: data.user,
        })
        useUiStore.getState().syncInstitutionFromUser(data.user)
      },
      logout: () => {
        set({ access: null, refresh: null, user: null })
        useUiStore.getState().setSelectedInstitutionId(null)
      },
    }),
    {
      name: 'educalc-auth',
      partialize: (s) => ({
        access: s.access,
        refresh: s.refresh,
        user: s.user,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.user) {
          useUiStore.getState().syncInstitutionFromUser(state.user)
        }
      },
    },
  ),
)
