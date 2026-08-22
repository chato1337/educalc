import { create } from 'zustand'

import type { RollCallOrigin } from '@/features/attendance/rollCallApi'
import type { RollCallStatus } from '@/types/schemas'

export type RollCallMark = {
  status: RollCallStatus | null
  notes: string
}

type Draft = {
  marks: Record<string, RollCallMark>
  fallbackPeriodId: string | null
}

type RollCallDraftState = {
  drafts: Record<string, Draft>
  setMark: (key: string, studentId: string, mark: RollCallMark) => void
  setFallbackPeriodId: (key: string, periodId: string | null) => void
  clearDraft: (key: string) => void
  reset: () => void
}

export function rollCallDraftKey(
  groupId: string,
  date: string,
  origin: RollCallOrigin,
  courseAssignmentId?: string | null,
): string {
  const source =
    origin === 'group' ? 'group' : (courseAssignmentId ?? 'subject')
  return `${groupId}|${date}|${source}`
}

export const useRollCallDraftStore = create<RollCallDraftState>((set) => ({
  drafts: {},
  setMark: (key, studentId, mark) =>
    set((state) => {
      const prev = state.drafts[key] ?? { marks: {}, fallbackPeriodId: null }
      return {
        drafts: {
          ...state.drafts,
          [key]: { ...prev, marks: { ...prev.marks, [studentId]: mark } },
        },
      }
    }),
  setFallbackPeriodId: (key, periodId) =>
    set((state) => {
      const prev = state.drafts[key] ?? { marks: {}, fallbackPeriodId: null }
      return {
        drafts: {
          ...state.drafts,
          [key]: { ...prev, fallbackPeriodId: periodId },
        },
      }
    }),
  clearDraft: (key) =>
    set((state) => {
      const { [key]: _, ...rest } = state.drafts
      return { drafts: rest }
    }),
  reset: () => set({ drafts: {} }),
}))
