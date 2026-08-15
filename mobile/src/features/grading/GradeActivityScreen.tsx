import { useEffect, useMemo, useRef, useState } from 'react'

import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { teacherQueryClient } from '@/api/queryClient'
import {
  Avatar,
  EmptyState,
  IconBook,
  IconCheck,
  ScoreKeypad,
  SectionHeader,
  WriteError,
} from '@/components'
import {
  createStudentActivityScore,
  patchStudentActivityScore,
  useCourseActivitiesBundle,
} from '@/features/grading/gradingApi'
import {
  formatScoreDisplay,
  isScoreFilled,
  serializeScore,
} from '@/features/grading/activityStatus'
import {
  useSessionCourse,
  useTeacherSession,
} from '@/session/TeacherSessionContext'
import type { Enrollment } from '@/types/schemas'

export interface GradeActivityProps {
  courseId: string
  activityId: string
  onBack: () => void
  onGoToPeriodGrades: () => void
}

type SaveJob = {
  studentId: string
  score: string | null
}

function sortEnrollments(rows: Enrollment[]): Enrollment[] {
  return [...rows].sort((a, b) =>
    a.student_name.localeCompare(b.student_name, 'es'),
  )
}

export function GradeActivityScreen({
  courseId,
  activityId,
  onBack,
  onGoToPeriodGrades,
}: GradeActivityProps) {
  const course = useSessionCourse(courseId)
  const session = useTeacherSession()
  const bundleQuery = useCourseActivitiesBundle(
    course?.groupId && course.subjectId && session.selectedPeriodId && session.academicYear
      ? {
          courseAssignmentId: course.id,
          academicPeriodId: session.selectedPeriodId,
          groupId: course.groupId,
          academicYearId: session.academicYear.id,
          subjectId: course.subjectId,
        }
      : null,
  )

  const activity = bundleQuery.data?.activities.find((a) => a.id === activityId)
  const enrollments = useMemo(
    () => sortEnrollments(bundleQuery.data?.enrollments ?? []),
    [bundleQuery.data?.enrollments],
  )
  const scores = bundleQuery.data?.scores ?? []

  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [scoreIds, setScoreIds] = useState<Record<string, string>>({})
  const [persisted, setPersisted] = useState<Set<string>>(new Set())
  const [activeStudent, setActiveStudent] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [batchDone, setBatchDone] = useState(0)
  const [batchTotal, setBatchTotal] = useState(0)
  const [queueBusy, setQueueBusy] = useState(false)

  const queueRef = useRef<SaveJob[]>([])
  const runningRef = useRef(false)
  const scoreIdsRef = useRef(scoreIds)
  scoreIdsRef.current = scoreIds

  useEffect(() => {
    const nextDrafts: Record<string, string> = {}
    const nextIds: Record<string, string> = {}
    const nextPersisted = new Set<string>()
    for (const row of scores) {
      if (row.activity !== activityId) continue
      nextIds[row.student] = row.id
      if (isScoreFilled(row.score)) {
        nextDrafts[row.student] = String(row.score)
        nextPersisted.add(row.student)
      }
    }
    setDrafts((prev) => ({ ...nextDrafts, ...prev }))
    setScoreIds((prev) => ({ ...nextIds, ...prev }))
    setPersisted((prev) => {
      const merged = new Set(prev)
      for (const id of nextPersisted) merged.add(id)
      return merged
    })
  }, [scores, activityId])

  const invalidateGrading = () => {
    void teacherQueryClient.invalidateQueries({
      queryKey: queryKeys.courseActivitiesBundle(
        courseId,
        session.selectedPeriodId,
      ),
    })
    void teacherQueryClient.invalidateQueries({
      queryKey: ['student-activity-scores'],
    })
    void teacherQueryClient.invalidateQueries({
      queryKey: queryKeys.dashboardKpis(session.selectedPeriodId),
    })
  }

  const processQueue = async () => {
    if (runningRef.current) return
    runningRef.current = true
    setQueueBusy(true)
    while (queueRef.current.length > 0) {
      const job = queueRef.current.shift()!
      setSavingId(job.studentId)
      try {
        const existingId = scoreIdsRef.current[job.studentId]
        if (job.score === null) {
          if (existingId) {
            await patchStudentActivityScore(existingId, { score: null })
          }
          setPersisted((prev) => {
            const next = new Set(prev)
            next.delete(job.studentId)
            return next
          })
        } else if (existingId) {
          await patchStudentActivityScore(existingId, { score: job.score })
          setPersisted((prev) => new Set(prev).add(job.studentId))
        } else {
          const created = await createStudentActivityScore({
            activity: activityId,
            student: job.studentId,
            score: job.score,
          })
          setScoreIds((prev) => {
            const next = { ...prev, [job.studentId]: created.id }
            scoreIdsRef.current = next
            return next
          })
          setPersisted((prev) => new Set(prev).add(job.studentId))
        }
        setErrors((prev) => {
          if (!prev[job.studentId]) return prev
          const next = { ...prev }
          delete next[job.studentId]
          return next
        })
      } catch (err) {
        setErrors((prev) => ({
          ...prev,
          [job.studentId]: getErrorMessage(err, 'No se pudo guardar la nota.'),
        }))
      }
      setBatchDone((n) => n + 1)
    }
    setSavingId(null)
    runningRef.current = false
    setQueueBusy(false)
    invalidateGrading()
  }

  const enqueueSave = (studentId: string, raw: string) => {
    const serialized = serializeScore(raw)
    const existingId = scoreIdsRef.current[studentId]
    const current = scores.find(
      (s) => s.activity === activityId && s.student === studentId,
    )
    const currentSerialized = isScoreFilled(current?.score)
      ? serializeScore(String(current?.score))
      : null
    if (serialized === currentSerialized && (serialized !== null || !existingId)) {
      return
    }
    queueRef.current = queueRef.current.filter((j) => j.studentId !== studentId)
    queueRef.current.push({ studentId, score: serialized })
    if (runningRef.current) {
      setBatchTotal((t) => t + 1)
    } else {
      setBatchDone(0)
      setBatchTotal(queueRef.current.length)
    }
    void processQueue()
  }

  const handleStudentTap = (id: string) => {
    setActiveStudent((prev) => (prev === id ? null : id))
  }

  const handleScoreClose = (id: string) => {
    enqueueSave(id, drafts[id] ?? '')
    const idx = enrollments.findIndex((s) => s.student === id)
    const next = enrollments[idx + 1]
    setActiveStudent(next?.student ?? null)
  }

  const retrySave = (id: string) => {
    enqueueSave(id, drafts[id] ?? '')
  }

  const completedCount = enrollments.filter((s) =>
    isScoreFilled(drafts[s.student]),
  ).length
  const persistedCount = enrollments.filter((s) => persisted.has(s.student)).length
  const allPersisted =
    enrollments.length > 0 && persistedCount === enrollments.length && !queueBusy

  if (!course) {
    return (
      <div className="flex flex-col h-full bg-[#F1F5F9]">
        <SectionHeader title="Calificar" onBack={onBack} />
        <EmptyState
          icon={<IconBook size={24} />}
          title="Curso no encontrado"
          body="Esa asignación ya no está en tu lista. Vuelve a Mis cursos."
        />
      </div>
    )
  }

  if (bundleQuery.isLoading) {
    return (
      <div className="flex flex-col h-full bg-[#F1F5F9]">
        <SectionHeader title="Calificar" subtitle={course.subject_name} onBack={onBack} />
        <p className="text-sm text-slate-400 text-center py-12">Cargando lista…</p>
      </div>
    )
  }

  if (bundleQuery.isError) {
    return (
      <div className="flex flex-col h-full bg-[#F1F5F9]">
        <SectionHeader title="Calificar" onBack={onBack} />
        <div className="px-6 py-12">
          <WriteError
            message={getErrorMessage(bundleQuery.error, 'No se pudo cargar la actividad.')}
            onRetry={() => void bundleQuery.refetch()}
          />
        </div>
      </div>
    )
  }

  if (!activity) {
    return (
      <div className="flex flex-col h-full bg-[#F1F5F9]">
        <SectionHeader title="Calificar" onBack={onBack} />
        <EmptyState
          icon={<IconBook size={24} />}
          title="Actividad no encontrada"
          body="Esa actividad no está en el esquema de este periodo."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9]">
      <SectionHeader
        title={activity.name}
        subtitle={`${course.subject_name} · ${course.group_name} · máx ${activity.maxScoreNumber.toFixed(1)}`}
        onBack={onBack}
      />

      <div className="bg-white border-b border-slate-100 px-4 py-2">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span>Progreso</span>
          <span className="font-mono font-semibold text-slate-700">
            {completedCount}/{enrollments.length}
          </span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
            style={{
              width: `${enrollments.length ? (completedCount / enrollments.length) * 100 : 0}%`,
            }}
          />
        </div>
        {queueBusy && (
          <p className="text-[11px] text-slate-500 mt-1.5">
            Guardando {Math.min(batchDone + 1, batchTotal)}/{batchTotal}…
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {enrollments.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">
            No hay matrículas activas en este grupo.
          </p>
        )}
        {enrollments.map((s) => {
          const score = drafts[s.student]
          const isActive = activeStudent === s.student
          const isSaved = persisted.has(s.student) && isScoreFilled(score)
          const isSaving = savingId === s.student
          const error = errors[s.student]
          return (
            <div key={s.student}>
              <button
                type="button"
                onClick={() => handleStudentTap(s.student)}
                className={`w-full text-left bg-white rounded-xl border transition-all ${
                  isActive
                    ? 'border-blue-400 ring-1 ring-blue-200'
                    : error
                      ? 'border-red-300'
                      : isSaved
                        ? 'border-emerald-200'
                        : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center px-3.5 py-3 gap-3">
                  <Avatar name={s.student_name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {s.student_name}
                    </p>
                    <p className="font-mono text-xs text-slate-400">
                      {s.student_document_number}
                    </p>
                    {error && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          retrySave(s.student)
                        }}
                        className="text-[11px] text-red-600 font-medium mt-0.5 hover:underline"
                      >
                        {error} · Reintentar
                      </button>
                    )}
                  </div>
                  <div className="text-right">
                    {isSaving ? (
                      <div className="w-4 h-4 rounded-full border-2 border-slate-200 border-t-slate-500 animate-spin" />
                    ) : isScoreFilled(score) ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-base font-bold text-emerald-600">
                          {formatScoreDisplay(score)}
                        </span>
                        {isSaved && <IconCheck size={14} />}
                      </div>
                    ) : (
                      <span className="font-mono text-slate-300 text-base">—</span>
                    )}
                  </div>
                </div>
              </button>

              {isActive && (
                <div className="bg-white border border-blue-300 border-t-0 rounded-b-xl -mt-1 overflow-hidden">
                  <ScoreKeypad
                    value={drafts[s.student] || ''}
                    maxScore={activity.maxScoreNumber}
                    onChange={(v) =>
                      setDrafts((prev) => ({ ...prev, [s.student]: v }))
                    }
                    onClose={() => handleScoreClose(s.student)}
                    studentName={s.student_name}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {allPersisted && (
        <div className="bg-white border-t border-slate-200 px-4 py-3">
          <button
            type="button"
            onClick={onGoToPeriodGrades}
            className="w-full h-12 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition-colors"
          >
            Ver nota sugerida del periodo →
          </button>
        </div>
      )}
    </div>
  )
}
