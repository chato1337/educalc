import { create } from 'zustand'

import type { AuthUser } from '@/types/user'

type UiState = {
  drawerOpen: boolean
  selectedInstitutionId: string | null
  setDrawerOpen: (open: boolean) => void
  toggleDrawer: () => void
  setSelectedInstitutionId: (id: string | null) => void
  syncInstitutionFromUser: (user: AuthUser | null) => void
}

export const useUiStore = create<UiState>((set) => ({
  drawerOpen: true,
  selectedInstitutionId: null,
  setDrawerOpen: (open) => set({ drawerOpen: open }),
  toggleDrawer: () => set((s) => ({ drawerOpen: !s.drawerOpen })),
  setSelectedInstitutionId: (id) => set({ selectedInstitutionId: id }),
  syncInstitutionFromUser: (user) =>
    set({
      selectedInstitutionId: user?.institution_id ?? null,
    }),
}))
