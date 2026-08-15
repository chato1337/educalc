import { Avatar, IconChevronRight, LevelChip } from '@/components'
import type { Course, PerformanceLevel } from '@/data'
import { LEVEL_CONFIG } from '@/data'
import { formatScoreDisplay } from '@/features/grading/activityStatus'
import { useGradesQuery } from '@/features/grades/gradesApi'
import { isLowPerformanceGrade, levelFromGrade } from '@/features/grades/scaleUtils'
import { useEligibleGradesQuery } from '@/features/recoveries/gradeRecoveriesApi'
import { useTeacherSession } from '@/session/TeacherSessionContext'

export function GradesSummarySection({
  course,
  onGoToPeriodGrades,
  onGoToRecoveries,
}: {
  course: Course
  onGoToPeriodGrades: () => void
  onGoToRecoveries: () => void
}) {
  const session = useTeacherSession()
  const periodId = session.selectedPeriodId
  const gradesQuery = useGradesQuery(
    periodId ? { course_assignment: course.id, academic_period: periodId } : null,
  )
  const eligibleQuery = useEligibleGradesQuery(
    periodId ? { course_assignment: course.id, academic_period: periodId } : null,
  )

  const grades = gradesQuery.data ?? []
  const counts: Record<PerformanceLevel, number> = { SP: 0, AL: 0, BS: 0, BJ: 0 }
  for (const g of grades) {
    const level = levelFromGrade(g, session.gradingScales)
    if (level) counts[level] += 1
  }
  const bajos =
    eligibleQuery.data ??
    grades.filter((g) => isLowPerformanceGrade(g, session.gradingScales))

  return (
    <div className="p-4 space-y-4">
      <button
        type="button"
        onClick={onGoToPeriodGrades}
        className="w-full bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors text-left"
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-slate-900">Ver notas del periodo</p>
          <IconChevronRight size={16} />
        </div>
        {gradesQuery.isLoading ? (
          <p className="text-sm text-slate-400 text-center py-2">Cargando notas…</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {(['SP', 'AL', 'BS', 'BJ'] as const).map((level) => (
              <div key={level} className="text-center">
                <p className={`font-mono text-xl font-bold ${LEVEL_CONFIG[level].color}`}>
                  {counts[level]}
                </p>
                <LevelChip level={level} compact />
              </div>
            ))}
          </div>
        )}
      </button>

      {bajos.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Aptos para recuperación
            </p>
            <button
              type="button"
              onClick={onGoToRecoveries}
              className="text-xs text-blue-600 font-semibold hover:underline"
            >
              Ver todos
            </button>
          </div>
          <div className="space-y-1">
            {bajos.slice(0, 3).map((s) => (
              <div
                key={s.id}
                className="bg-white rounded-xl border border-red-100 flex items-center px-3.5 py-3 gap-3"
              >
                <Avatar name={s.student_name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{s.student_name}</p>
                  <p className="font-mono text-xs text-red-600">
                    Nota: {formatScoreDisplay(s.numerical_grade)}
                  </p>
                </div>
                <LevelChip level="BJ" compact />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
