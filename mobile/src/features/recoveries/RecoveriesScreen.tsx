import { useMemo, useState } from 'react'

import { getErrorMessage } from '@/api/errors'
import {
  Avatar,
  EmptyState,
  IconBook,
  IconCheck,
  LevelChip,
  LoadMoreButton,
  SectionHeader,
  WriteError,
} from '@/components'
import {
  flatInfinitePages,
  infiniteListCount,
} from '@/api/useInfiniteList'
import {
  formatScoreDisplay,
  parseDecimal,
  serializeScore,
} from '@/features/grading/activityStatus'
import {
  useCreateGradeRecoveryMutation,
  useEligibleGradesInfiniteQuery,
  useGradeRecoveriesInfiniteQuery,
} from '@/features/recoveries/gradeRecoveriesApi'
import {
  useSessionCourse,
  useTeacherSession,
} from '@/session/TeacherSessionContext'
import type { Grade, GradeRecovery } from '@/types/schemas'

export interface RecoveriesProps {
  courseId: string
  onBack: () => void
}

export function RecoveriesScreen({ courseId, onBack }: RecoveriesProps) {
  const course = useSessionCourse(courseId)
  const session = useTeacherSession()
  const periodId = session.selectedPeriodId ?? undefined
  const eligibleQuery = useEligibleGradesInfiniteQuery(
    course ? { course_assignment: course.id, academic_period: periodId } : null,
  )
  const historyQuery = useGradeRecoveriesInfiniteQuery(
    course
      ? { course_assignment: course.id, academic_period: periodId }
      : null,
  )
  const createMutation = useCreateGradeRecoveryMutation()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [recoveryGrade, setRecoveryGrade] = useState('')
  const [description, setDescription] = useState('')
  const [formError, setFormError] = useState('')
  const [writeFailed, setWriteFailed] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  const eligible = useMemo(
    () =>
      [...flatInfinitePages(eligibleQuery.data)].sort((a, b) =>
        a.student_name.localeCompare(b.student_name, 'es'),
      ),
    [eligibleQuery.data],
  )
  const eligibleTotal = infiniteListCount(eligibleQuery.data)
  const selected = eligible.find((s) => s.id === selectedId)
  const historyByGrade = useMemo(() => {
    const map = new Map<string, GradeRecovery[]>()
    for (const row of flatInfinitePages(historyQuery.data)) {
      const list = map.get(row.grade) ?? []
      list.push(row)
      map.set(row.grade, list)
    }
    return map
  }, [historyQuery.data])

  const currentDefinitive = (grade: Grade) =>
    grade.definitive_grade != null && String(grade.definitive_grade).trim() !== ''
      ? grade.definitive_grade
      : grade.numerical_grade

  const handleSave = async () => {
    if (!selectedId || !selected) return
    const serialized = serializeScore(recoveryGrade)
    if (!serialized || !description.trim()) {
      setFormError('Ingresa la nota de recuperación y la evidencia.')
      return
    }
    const n = parseDecimal(serialized)
    if (n == null || n < 0 || n > 5) {
      setFormError('La nota debe estar entre 0.00 y 5.00.')
      return
    }
    setFormError('')
    setWriteFailed(false)
    try {
      await createMutation.mutateAsync({
        grade: selected.id,
        recovery_grade: serialized,
        description: description.trim(),
      })
      setSavedIds((prev) => new Set(prev).add(selectedId))
      setSelectedId(null)
      setRecoveryGrade('')
      setDescription('')
    } catch (err) {
      setWriteFailed(true)
      setFormError(getErrorMessage(err, 'No se pudo registrar la recuperación.'))
    }
  }

  if (!course) {
    return (
      <div className="flex flex-col h-full bg-[#F1F5F9]">
        <SectionHeader title="Recuperaciones" onBack={onBack} />
        <EmptyState
          icon={<IconBook size={24} />}
          title="Curso no encontrado"
          body="Esa asignación ya no está en tu lista. Vuelve a Mis cursos."
        />
      </div>
    )
  }

  const serializedPreview = serializeScore(recoveryGrade)

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9]">
      <SectionHeader
        title="Recuperaciones"
        subtitle={`${course.subject_name} · ${course.group_name} · ${eligibleTotal || eligible.length} aptos`}
        onBack={onBack}
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-800">
          <p className="font-semibold mb-1">¿Cómo funciona?</p>
          <p>
            La nota de recuperación <strong>reemplaza la definitiva</strong>. La nota oficial del
            periodo no cambia. Se puede recuperar más de una vez.
          </p>
        </div>

        {eligibleQuery.isLoading && (
          <p className="text-sm text-slate-400 text-center py-8">Cargando aptos…</p>
        )}
        {eligibleQuery.isError && (
          <WriteError
            message={getErrorMessage(eligibleQuery.error, 'No se pudieron cargar los aptos.')}
            onRetry={() => void eligibleQuery.refetch()}
          />
        )}
        {!eligibleQuery.isLoading && eligible.length === 0 && (
          <EmptyState
            icon={<IconCheck size={22} />}
            title="Nadie está en Bajo"
            body="No hay calificaciones en escala Baja en este curso y periodo."
          />
        )}

        <div className="space-y-2">
          {eligible.map((s) => {
            const isSaved = savedIds.has(s.id)
            const isSelected = selectedId === s.id
            const history = historyByGrade.get(s.id) ?? []
            const from = currentDefinitive(s)
            return (
              <div key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(isSelected ? null : s.id)
                    setFormError('')
                    setWriteFailed(false)
                    setRecoveryGrade('')
                    setDescription('')
                  }}
                  className={`w-full text-left bg-white rounded-xl border transition-all ${
                    isSelected
                      ? 'border-red-400 ring-1 ring-red-200'
                      : isSaved
                        ? 'border-emerald-300'
                        : 'border-red-100 hover:border-red-300'
                  }`}
                >
                  <div className="flex items-center px-4 py-3.5 gap-3">
                    <Avatar name={s.student_name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {s.student_name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-xs text-red-600">
                          Nota: {formatScoreDisplay(s.numerical_grade)}
                        </span>
                        {s.definitive_grade &&
                          s.definitive_grade !== s.numerical_grade && (
                            <span className="font-mono text-xs text-slate-500">
                              → Def: {formatScoreDisplay(s.definitive_grade)}
                            </span>
                          )}
                      </div>
                    </div>
                    {isSaved ? (
                      <div className="flex items-center gap-1 text-emerald-600">
                        <IconCheck size={14} />
                        <span className="text-xs">Guardada</span>
                      </div>
                    ) : (
                      <LevelChip level="BJ" compact />
                    )}
                  </div>
                </button>

                {isSelected && selected && (
                  <div className="bg-white border border-red-300 border-t-0 rounded-b-xl -mt-1 px-4 pt-4 pb-4">
                    <p className="text-xs font-semibold text-red-800 mb-3">
                      La definitiva pasará de{' '}
                      <span className="font-mono">{formatScoreDisplay(from)}</span>
                      {serializedPreview ? (
                        <>
                          {' '}
                          a{' '}
                          <span className="font-mono">
                            {formatScoreDisplay(serializedPreview)}
                          </span>
                        </>
                      ) : null}
                      . La nota del periodo (numérica) no cambia.
                    </p>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Nota de recuperación (0.00 – 5.00)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={5}
                          step={0.01}
                          placeholder="3.00"
                          value={recoveryGrade}
                          onChange={(e) => setRecoveryGrade(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg border border-slate-200 font-mono text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Evidencia / descripción
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: Taller de recuperación 14-ago-2026"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100"
                        />
                      </div>
                      {formError && (
                        <WriteError
                          message={formError}
                          onRetry={writeFailed ? () => void handleSave() : undefined}
                          disabled={createMutation.isPending}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={
                          createMutation.isPending ||
                          !recoveryGrade ||
                          !description.trim()
                        }
                        className="w-full h-10 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-700 disabled:opacity-40 transition-colors"
                      >
                        {createMutation.isPending
                          ? 'Guardando…'
                          : 'Confirmar recuperación'}
                      </button>
                    </div>
                    {history.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                          Historial
                        </p>
                        <div className="space-y-1.5">
                          {history.map((h) => (
                            <p key={h.id} className="text-xs text-slate-600">
                              <span className="font-mono">
                                {formatScoreDisplay(h.recovery_grade)}
                              </span>
                              {' · '}
                              {h.description}
                              {h.created_at
                                ? ` · ${new Date(h.created_at).toLocaleDateString('es-CO')}`
                                : ''}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          <LoadMoreButton
            hasMore={Boolean(eligibleQuery.hasNextPage || historyQuery.hasNextPage)}
            isLoadingMore={
              eligibleQuery.isFetchingNextPage || historyQuery.isFetchingNextPage
            }
            onLoadMore={() => {
              if (eligibleQuery.hasNextPage) void eligibleQuery.fetchNextPage()
              if (historyQuery.hasNextPage) void historyQuery.fetchNextPage()
            }}
            loaded={eligible.length}
            total={eligibleTotal}
          />
        </div>
      </div>
    </div>
  )
}
