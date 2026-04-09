import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { AuthUser } from '@/types/user'

type UiState = {
  drawerOpen: boolean
  selectedInstitutionId: string | null
  themeMode: 'light' | 'dark'
  language: string
  setDrawerOpen: (open: boolean) => void
  toggleDrawer: () => void
  setSelectedInstitutionId: (id: string | null) => void
  setThemeMode: (mode: 'light' | 'dark') => void
  toggleThemeMode: () => void
  setLanguage: (language: string) => void
  syncInstitutionFromUser: (user: AuthUser | null) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      drawerOpen: true,
      selectedInstitutionId: null,
      themeMode: 'light',
      language: 'es',
      setDrawerOpen: (open) => set({ drawerOpen: open }),
      toggleDrawer: () => set((s) => ({ drawerOpen: !s.drawerOpen })),
      setSelectedInstitutionId: (id) => set({ selectedInstitutionId: id }),
      setThemeMode: (mode) => set({ themeMode: mode }),
      toggleThemeMode: () =>
        set((s) => ({ themeMode: s.themeMode === 'dark' ? 'light' : 'dark' })),
      setLanguage: (language) => set({ language }),
      syncInstitutionFromUser: (user) =>
        set({
          selectedInstitutionId: user?.institution_id ?? null,
        }),
    }),
    {
      name: 'edu-calc-ui',
      partialize: (state) => ({
        selectedInstitutionId: state.selectedInstitutionId,
        themeMode: state.themeMode,
        language: state.language,
      }),
    },
  ),
)
