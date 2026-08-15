// ─── Types ───────────────────────────────────────────────────────────────────

export type AttendanceStatus = 'PRESENT' | 'EXCUSED' | 'UNEXCUSED'
export type PerformanceLevel = 'SP' | 'AL' | 'BS' | 'BJ'

export interface Course {
  id: string
  subject_name: string
  emphasis: string | null
  group_name: string
  group_grade_level_name: string
  campus_name: string
  academic_year_year: number
  isDirectorGroup: boolean
  groupId?: string
  subjectId?: string
  subjectAcademicAreaId?: string
  groupGradeLevelId?: string
}

export interface Period {
  id: string
  name: string
  shortName: string
  start: string
  end: string
  active: boolean
  number: number
}

export const LEVEL_CONFIG: Record<PerformanceLevel, { label: string; color: string; bg: string; border: string }> = {
  SP: { label: 'Superior', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  AL: { label: 'Alto', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  BS: { label: 'Básico', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  BJ: { label: 'Bajo', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
}

export const ATTENDANCE_CONFIG: Record<AttendanceStatus, { label: string; short: string; color: string; bg: string; activeBg: string; activeColor: string }> = {
  PRESENT: { label: 'Presente', short: 'P', color: 'text-slate-500', bg: 'bg-slate-100', activeBg: 'bg-emerald-500', activeColor: 'text-white' },
  EXCUSED: { label: 'Con excusa', short: 'CE', color: 'text-amber-600', bg: 'bg-amber-50', activeBg: 'bg-amber-500', activeColor: 'text-white' },
  UNEXCUSED: { label: 'Sin excusa', short: 'SE', color: 'text-red-600', bg: 'bg-red-50', activeBg: 'bg-red-500', activeColor: 'text-white' },
}

export function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}
