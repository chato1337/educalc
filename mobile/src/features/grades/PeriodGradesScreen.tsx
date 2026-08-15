import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import {
  Avatar,
  Card,
  EmptyState,
  IconAlert,
  IconBook,
  IconCheck,
  IconClipboard,
  LevelChip,
  Pill,
  SectionHeader,
  WriteError,
} from '@/components'
import {
  formatScoreDisplay,
  parseDecimal,
  serializeScore,
} from '@/features/grading/activityStatus'
import {
  applyGradingSchemeSuggestionBulk,
  schemeWeightsValid,
  useApplySuggestionBulkPreviewQuery,
  useCourseActivitiesBundle,
  useValidateWeightsQuery,
} from '@/features/grading/gradingApi'
import { useGradesQuery, usePatchGradeMutation } from '@/features/grades/gradesApi'
import {
  isLowPerformanceGrade,
  levelFromGrade,
  scaleForScore,
} from '@/features/grades/scaleUtils'
import {
  useSessionCourse,
  useTeacherSession,
} from '@/session/TeacherSessionContext'
import type { Grade } from '@/types/schemas'

export interface PeriodGradesProps {
  courseId: string
  periodId: string
  onBack: () => void
  onGoToRecoveries: () => void
  onGoToPlan?: () => void
}

function CourseNotFound({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col h-full bg-[#F1F5F9]">
      <SectionHeader title="Notas" onBack={onBack} />
      <EmptyState
        icon={<IconBook size={24} />}
        title="Curso no encontrado"
        body="Esa asignación ya no está en tu lista. Vuelve a Mis cursos."
      />
    </div>
  )
}

export function PeriodGradesScreen({
  courseId,
  periodId,
  onBack,
  onGoToRecoveries,
  onGoToPlan,
}: PeriodGradesProps) {
  const course = useSessionCourse(courseId)
  const session = useTeacherSession()
  const period = session.periods.find((p) => p.id === periodId)
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'suggested' | 'review'>('suggested')
  const [applyError, setApplyError] = useState('')
  const [appliedOk, setAppliedOk] = useState(false)
  const [reviewFilter, setReviewFilter] = useState<'all' | 'bj'>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const bundleQuery = useCourseActivitiesBundle(
    course?.groupId && course.subjectId && periodId && session.academicYear
      ? {
          courseAssignmentId: course.id,
          academicPeriodId: periodId,
          groupId: course.groupId,
          academicYearId: session.academicYear.id,
          subjectId: course.subjectId,
        }
      : null,
  )
  const scheme = bundleQuery.data?.scheme ?? null
  const weightsOk = schemeWeightsValid(scheme)
  const weightsQuery = useValidateWeightsQuery(scheme?.id)
  const previewQuery = useApplySuggestionBulkPreviewQuery(scheme?.id, weightsOk)
  const gradesQuery = useGradesQuery(
    periodId ? { course_assignment: courseId, academic_period: periodId } : null,
  )

  const applyMutation = useMutation({
    mutationFn: () => applyGradingSchemeSuggestionBulk(scheme!.id),
    onSuccess: () => {
      setAppliedOk(true)
      setApplyError('')
      setTab('review')
      void queryClient.invalidateQueries({ queryKey: ['grades'] })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.gradingSchemeBulkPreview(scheme?.id),
      })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['grade-recoveries'] })
    },
    onError: (err) => {
      setApplyError(getErrorMessage(err, 'No se pudo aplicar la sugerida.'))
    },
  })

  const patchMutation = usePatchGradeMutation()

  const preview = previewQuery.data
  const grades = useMemo(
    () =>
      [...(gradesQuery.data ?? [])].sort((a, b) =>
        a.student_name.localeCompare(b.student_name, 'es'),
      ),
    [gradesQuery.data],
  )
  const suggestedByStudent = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of preview?.applied ?? []) {
      map.set(item.student_id, item.suggested_grade)
    }
    return map
  }, [preview])

  const lowGrades = grades.filter((g) => isLowPerformanceGrade(g, session.gradingScales))
  const visibleGrades =
    reviewFilter === 'bj' ? lowGrades : grades

  const saveEdit = async (grade: Grade) => {
    const serialized = serializeScore(editValue)
    if (serialized == null) return
    const n = parseDecimal(serialized)
    const scale = n != null ? scaleForScore(n, session.gradingScales) : null
    try {
      await patchMutation.mutateAsync({
        id: grade.id,
        body: {
          numerical_grade: serialized,
          performance_level: scale?.id ?? grade.performance_level,
        },
      })
      setEditingId(null)
    } catch {
      /* error is shown next to the button */
    }
  }

  if (!course) return <CourseNotFound onBack={onBack} />

  const loading = bundleQuery.isLoading || gradesQuery.isLoading
  const eligibleCount = preview?.eligible_count ?? 0
  const skipped = preview?.skipped ?? []
  const canApply =
    weightsOk && eligibleCount > 0 && !applyMutation.isPending && !previewQuery.isLoading

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9]">
      <SectionHeader
        title={`Notas · ${period?.name ?? 'Periodo'}`}
        subtitle={`${course.subject_name} · ${course.group_name}`}
        onBack={onBack}
      />

      <div className="bg-white border-b border-slate-200 flex">
        {([{ id: 'suggested', label: 'Aplicar sugerida' }, { id: 'review', label: 'Revisar notas' }] as const).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              tab === t.id ? 'border-[#1E3A5F] text-[#1E3A5F]' : 'border-transparent text-slate-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'suggested' && (
          <div className="p-4 space-y-4">
            {loading && (
              <p className="text-sm text-slate-400 text-center py-8">Cargando esquema…</p>
            )}
            {bundleQuery.isError && (
              <p className="text-sm text-red-600 text-center">
                {getErrorMessage(bundleQuery.error, 'No se pudo cargar el esquema.')}
              </p>
            )}
            {!loading && !scheme && (
              <div className="space-y-3">
                <EmptyState
                  icon={<IconClipboard size={22} />}
                  title="Este periodo no tiene esquema de actividades"
                  body="Sin esquema no hay nota sugerida. Crea el plan de esta asignatura para continuar."
                />
                {onGoToPlan && (
                  <button
                    type="button"
                    onClick={onGoToPlan}
                    className="w-full h-11 rounded-xl bg-[#1E3A5F] text-white text-sm font-semibold"
                  >
                    Ir al plan
                  </button>
                )}
              </div>
            )}

            {scheme && !weightsOk && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                <p className="text-xs font-semibold text-amber-800 mb-1 flex items-center gap-1.5">
                  <IconAlert size={14} />
                  Los pesos no suman 100%
                </p>
                <p className="text-xs text-amber-700">
                  {weightsQuery.data?.message ||
                    'Corrige los pesos de componentes o segmentos antes de aplicar la sugerida.'}
                </p>
                {onGoToPlan && (
                  <button
                    type="button"
                    onClick={onGoToPlan}
                    className="mt-2 text-xs font-semibold text-amber-800 underline"
                  >
                    Ir al plan
                  </button>
                )}
              </div>
            )}

            {scheme && weightsOk && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Card className="p-4 text-center">
                    <p className="font-mono text-3xl font-bold text-emerald-600">
                      {previewQuery.isLoading ? '…' : eligibleCount}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Listos para aplicar</p>
                  </Card>
                  <Card className="p-4 text-center">
                    <p className="font-mono text-3xl font-bold text-amber-600">
                      {previewQuery.isLoading ? '…' : skipped.length}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Con actividades pendientes</p>
                  </Card>
                </div>

                {previewQuery.isError && (
                  <p className="text-sm text-red-600">
                    {getErrorMessage(previewQuery.error, 'No se pudo calcular la vista previa.')}
                  </p>
                )}

                {skipped.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                    <p className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
                      <IconAlert size={14} />
                      No entran al cálculo masivo
                    </p>
                    {skipped.map((s) => (
                      <p key={s.student_id} className="text-xs text-amber-700 py-0.5">
                        · {s.student_name}
                        {s.reason === 'incomplete_scores'
                          ? ` (${s.scored_activities}/${s.total_activities})`
                          : ''}
                      </p>
                    ))}
                  </div>
                )}

                <Card className="p-4">
                  <p className="text-xs font-semibold text-slate-600 mb-2">¿Qué hace “aplicar sugerida”?</p>
                  <div className="space-y-1.5 text-xs text-slate-500">
                    <p>✓ Escribe <span className="font-semibold text-slate-700">nota oficial del periodo</span> (numerical_grade)</p>
                    <p>✓ Asigna nivel de desempeño (BJ / BS / AL / SP)</p>
                    <p className="text-slate-400">✗ No cambia la nota definitiva</p>
                    <p className="text-slate-400">✗ No aplica a estudiantes con actividades pendientes</p>
                  </div>
                </Card>

                {applyError && (
                  <WriteError
                    message={applyError}
                    onRetry={() => applyMutation.mutate()}
                    disabled={applyMutation.isPending}
                  />
                )}

                <button
                  type="button"
                  onClick={() => applyMutation.mutate()}
                  disabled={!canApply || appliedOk}
                  className="w-full h-12 rounded-xl bg-[#1E3A5F] text-white font-semibold text-sm hover:bg-[#2D5A8E] disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                >
                  {applyMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Aplicando…
                    </>
                  ) : appliedOk ? (
                    <>
                      <IconCheck size={16} /> Sugerida aplicada al grupo
                    </>
                  ) : (
                    `Aplicar sugerida — ${eligibleCount} estudiantes`
                  )}
                </button>
              </>
            )}
          </div>
        )}

        {tab === 'review' && (
          <div className="p-3 space-y-1">
            {gradesQuery.isLoading && (
              <p className="text-sm text-slate-400 text-center py-8">Cargando notas…</p>
            )}
            {gradesQuery.isError && (
              <p className="text-sm text-red-600 text-center py-4">
                {getErrorMessage(gradesQuery.error, 'No se pudieron cargar las notas.')}
              </p>
            )}
            {!gradesQuery.isLoading && grades.length === 0 && (
              <EmptyState
                icon={<IconClipboard size={22} />}
                title="Aún no hay notas oficiales"
                body="Aplica la sugerida del periodo o espera a que el grupo esté completo."
              />
            )}
            {grades.length > 0 && (
              <div className="flex gap-2 pb-2">
                <button type="button" onClick={() => setReviewFilter('all')}>
                  <Pill color={reviewFilter === 'all' ? 'blue' : 'default'}>
                    Todos ({grades.length})
                  </Pill>
                </button>
                <button type="button" onClick={() => setReviewFilter('bj')}>
                  <Pill color={reviewFilter === 'bj' ? 'red' : 'default'}>
                    Bajo ({lowGrades.length})
                  </Pill>
                </button>
              </div>
            )}
            {visibleGrades.map((g) => {
              const level = levelFromGrade(g, session.gradingScales)
              const suggested = suggestedByStudent.get(g.student)
              const isEditing = editingId === g.id
              return (
                <div key={g.id} className="bg-white rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(isEditing ? null : g.id)
                      setEditValue(g.numerical_grade ?? '')
                    }}
                    className="w-full text-left flex items-center px-3.5 py-3 gap-3"
                  >
                    <Avatar name={g.student_name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{g.student_name}</p>
                      {suggested != null && suggested !== '' && (
                        <p className="text-[10px] text-slate-400">
                          Sugerida {formatScoreDisplay(suggested)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400">Oficial</p>
                        <p className="font-mono text-sm font-bold text-slate-800">
                          {formatScoreDisplay(g.numerical_grade)}
                        </p>
                      </div>
                      {level && <LevelChip level={level} compact />}
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400">Definitiva</p>
                        <p className={`font-mono text-sm font-bold ${g.definitive_grade ? 'text-slate-800' : 'text-slate-300'}`}>
                          {formatScoreDisplay(g.definitive_grade)}
                        </p>
                      </div>
                    </div>
                  </button>
                  {isEditing && (
                    <div className="px-3.5 pb-3 border-t border-slate-100 pt-3 space-y-2">
                      <p className="text-[11px] text-slate-500">
                        Ajusta la nota oficial. La definitiva no cambia.
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={0}
                          max={5}
                          step={0.01}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1 h-10 px-3 rounded-lg border border-slate-200 font-mono text-sm outline-none focus:border-blue-400"
                        />
                        <button
                          type="button"
                          disabled={patchMutation.isPending || serializeScore(editValue) == null}
                          onClick={() => void saveEdit(g)}
                          className="h-10 px-3 rounded-lg bg-[#1E3A5F] text-white text-xs font-semibold disabled:opacity-40"
                        >
                          {patchMutation.isPending ? '…' : 'Guardar'}
                        </button>
                      </div>
                      {patchMutation.isError && (
                        <WriteError
                          message={getErrorMessage(patchMutation.error, 'No se pudo guardar.')}
                          onRetry={() => void saveEdit(g)}
                          disabled={patchMutation.isPending}
                        />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            <button
              type="button"
              onClick={onGoToRecoveries}
              className="w-full mt-2 h-11 rounded-xl border border-red-200 text-red-700 text-sm font-semibold hover:bg-red-50 transition-colors"
            >
              Gestionar recuperaciones BJ →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
