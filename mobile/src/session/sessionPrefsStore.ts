import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type SessionPrefsState = {
  selectedPeriodId: string | null
  lastCourseAssignmentId: string | null
  setSelectedPeriodId: (id: string) => void
  setLastCourseAssignmentId: (id: string) => void
  reset: () => void
}

export const useSessionPrefsStore = create<SessionPrefsState>()(
  persist(
    (set) => ({
      selectedPeriodId: null,
      lastCourseAssignmentId: null,
      setSelectedPeriodId: (selectedPeriodId) => set({ selectedPeriodId }),
      setLastCourseAssignmentId: (lastCourseAssignmentId) =>
        set({ lastCourseAssignmentId }),
      reset: () =>
        set({ selectedPeriodId: null, lastCourseAssignmentId: null }),
    }),
    { name: 'educalc-teacher-session-prefs' },
  ),
)
