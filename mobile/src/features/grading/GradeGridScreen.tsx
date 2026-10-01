import { useMemo, useRef, useState, type ReactNode } from 'react'

import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { teacherQueryClient } from '@/api/queryClient'
import {
  Avatar,
  EmptyState,
  IconAlert,
  IconArrowLeft,
  IconBook,
  IconClipboard,
  ScoreKeypad,
  WriteError,
} from '@/components'
import {
  formatScoreDisplay,
  isScoreFilled,
  parseMaxScore,
  serializeScore,
} from '@/features/grading/activityStatus'
import {
  displayDef,
  isRowComplete,
  type GradeGridStructure,
} from '@/features/grading/gradeGridMath'
import {
  createStudentActivityScore,
  patchStudentActivityScore,
  schemeWeightsValid,
  useCourseActivitiesBundle,
  type EnrichedActivity,
  type ComponentSegment,
  type SubjectComponent,
} from '@/features/grading/gradingApi'
import {
  useSessionCourse,
  useTeacherSession,
} from '@/session/TeacherSessionContext'
import type { Enrollment, StudentActivityScore } from '@/types/schemas'

export type GradeGridFocus = {
  student?: string
  activity?: string
}

export interface GradeGridProps {
  courseId: string
  periodId: string
  studentId?: string
  activityId?: string
  onFocus: (focus: GradeGridFocus) => void
  onBack: () => void
  onGoToPlan: () => void
}

const SEGMENT_TONES = [
  'border-blue-400 bg-blue-50 text-blue-800',
  'border-amber-400 bg-amber-50 text-amber-800',
  'border-emerald-400 bg-emerald-50 text-emerald-800',
  'border-violet-400 bg-violet-50 text-violet-800',
] as const

type CellValue = {
  score: string | null
  scoreId: string | null
}

type SaveJob = {
  key: string
  studentId: string
  activityId: string
  score: string | null
  previous: CellValue | null
}

function cellKey(studentId: string, activityId: string): string {
  return `${studentId}:${activityId}`
}

function asScore(value: string | number | null | undefined): string | null {
  if (!isScoreFilled(value == null ? null : String(value))) return null
  return String(value).trim()
}

function sortEnrollments(rows: Enrollment[]): Enrollment[] {
  return [...rows].sort((a, b) => a.student_name.localeCompare(b.student_name, 'es'))
}

function bySortOrder<T extends { sort_order?: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}

function buildStructure(
  components: SubjectComponent[],
  segments: ComponentSegment[],
  activities: EnrichedActivity[],
  weightsValid: boolean,
): GradeGridStructure {
  return {
    weightsValid,
    components: bySortOrder(components).map((component) => ({
      id: component.id,
      weightPercent: component.weight_percent,
      sortOrder: component.sort_order ?? 0,
    })),
    segments: bySortOrder(segments).map((segment) => ({
      id: segment.id,
      componentId: segment.subject_component,
      weightPercent: segment.weight_percent,
      sortOrder: segment.sort_order ?? 0,
    })),
    activities: bySortOrder(activities).map((activity) => ({
      id: activity.id,
      segmentId: activity.segment,
      sortOrder: activity.sort_order ?? 0,
    })),
  }
}

function orderActivities(
  components: SubjectComponent[],
  segments: ComponentSegment[],
  activities: EnrichedActivity[],
): EnrichedActivity[] {
  const componentOrder = new Map(
    bySortOrder(components).map((component, index) => [component.id, index]),
  )
  const segmentOrder = new Map(
    bySortOrder(segments).map((segment, index) => [segment.id, index]),
  )
  const segmentComponent = new Map(
    segments.map((segment) => [segment.id, segment.subject_component]),
  )
  return [...activities].sort((a, b) => {
    const aComponent = componentOrder.get(segmentComponent.get(a.segment) ?? '') ?? 9999
    const bComponent = componentOrder.get(segmentComponent.get(b.segment) ?? '') ?? 9999
    if (aComponent !== bComponent) return aComponent - bComponent
    const aSegment = segmentOrder.get(a.segment) ?? 9999
    const bSegment = segmentOrder.get(b.segment) ?? 9999
    if (aSegment !== bSegment) return aSegment - bSegment
    return (a.sort_order ?? 0) - (b.sort_order ?? 0)
  })
}

function serverCells(scores: StudentActivityScore[]): Map<string, CellValue> {
  const map = new Map<string, CellValue>()
  for (const row of scores) {
    map.set(cellKey(row.student, row.activity), {
      score: asScore(row.score),
      scoreId: row.id,
    })
  }
  return map
}

function GridHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string
  subtitle?: string
  onBack: () => void
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-slate-200">
      <button
        type="button"
        onClick={onBack}
        aria-label="Atrás"
        className="min-w-11 min-h-11 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-600"
      >
        <IconArrowLeft size={20} />
      </button>
      <div className="flex-1 min-w-0">
        <h1 className="text-base font-semibold text-slate-900 truncate">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
      </div>
    </div>
  )
}

function Shell({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string
  subtitle?: string
  onBack: () => void
  children: ReactNode
}) {
  return (
    <div className="flex flex-col h-full bg-[#F1F5F9]">
      <GridHeader title={title} subtitle={subtitle} onBack={onBack} />
      {children}
    </div>
  )
}

export function GradeGridScreen({
  courseId,
  periodId,
  studentId,
  activityId,
  onFocus,
  onBack,
  onGoToPlan,
}: GradeGridProps) {
  const course = useSessionCourse(courseId)
  const session = useTeacherSession()
  const period = session.periods.find((item) => item.id === periodId)
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

  const bundle = bundleQuery.data
  const weightsValid = schemeWeightsValid(bundle?.scheme)
  const enrollments = useMemo(
    () => sortEnrollments(bundle?.enrollments ?? []),
    [bundle?.enrollments],
  )
  const ordered = useMemo(
    () =>
      orderActivities(
        bundle?.components ?? [],
        bundle?.segments ?? [],
        bundle?.activities ?? [],
      ),
    [bundle?.components, bundle?.segments, bundle?.activities],
  )
  const structure = useMemo(
    () =>
      buildStructure(
        bundle?.components ?? [],
        bundle?.segments ?? [],
        bundle?.activities ?? [],
        weightsValid,
      ),
    [bundle?.components, bundle?.segments, bundle?.activities, weightsValid],
  )
  const activityIds = useMemo(() => ordered.map((activity) => activity.id), [ordered])
  const server = useMemo(() => serverCells(bundle?.scores ?? []), [bundle?.scores])
  const serverRef = useRef(server)
  serverRef.current = server

  const [overrides, setOverrides] = useState<Record<string, CellValue>>({})
  const overridesRef = useRef(overrides)
  overridesRef.current = overrides
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const queueRef = useRef<SaveJob[]>([])
  const runningRef = useRef(false)

  const readCell = (sid: string, aid: string): CellValue => {
    const key = cellKey(sid, aid)
    return (
      overridesRef.current[key] ??
      serverRef.current.get(key) ?? { score: null, scoreId: null }
    )
  }

  const writeOverride = (key: string, value: CellValue) => {
    const next = { ...overridesRef.current, [key]: value }
    overridesRef.current = next
    setOverrides(next)
  }

  const clearOverride = (key: string) => {
    if (!(key in overridesRef.current)) return
    const next = { ...overridesRef.current }
    delete next[key]
    overridesRef.current = next
    setOverrides(next)
  }

  const scoresFor = (sid: string): Map<string, string | null> => {
    const map = new Map<string, string | null>()
    for (const activity of ordered) {
      const cell = readCell(sid, activity.id)
      map.set(activity.id, asScore(cell.score))
    }
    return map
  }

  const invalidateGrading = () => {
    void teacherQueryClient.invalidateQueries({
      queryKey: queryKeys.courseActivitiesBundle(courseId, periodId),
    })
    void teacherQueryClient.invalidateQueries({
      queryKey: ['student-activity-scores'],
    })
    void teacherQueryClient.invalidateQueries({
      queryKey: queryKeys.dashboardKpis(periodId),
    })
  }

  const processQueue = async () => {
    if (runningRef.current) return
    runningRef.current = true
    setSavingKey(queueRef.current[0]?.key ?? null)
    while (queueRef.current.length > 0) {
      const job = queueRef.current.shift()!
      setSavingKey(job.key)
      try {
        const existingId = readCell(job.studentId, job.activityId).scoreId
        if (job.score === null) {
          if (existingId) {
            await patchStudentActivityScore(existingId, { score: null })
            writeOverride(job.key, { score: null, scoreId: existingId })
          }
        } else if (existingId) {
          await patchStudentActivityScore(existingId, { score: job.score })
          writeOverride(job.key, { score: job.score, scoreId: existingId })
        } else {
          const created = await createStudentActivityScore({
            activity: job.activityId,
            student: job.studentId,
            score: job.score,
          })
          writeOverride(job.key, { score: job.score, scoreId: created.id })
        }
        setDrafts((prev) => {
          if (!(job.key in prev)) return prev
          const next = { ...prev }
          delete next[job.key]
          return next
        })
        setErrors((prev) => {
          if (!prev[job.key]) return prev
          const next = { ...prev }
          delete next[job.key]
          return next
        })
      } catch (err) {
        if (job.previous) writeOverride(job.key, job.previous)
        else clearOverride(job.key)
        setErrors((prev) => ({
          ...prev,
          [job.key]: getErrorMessage(err, 'No se pudo guardar la nota.'),
        }))
      }
    }
    setSavingKey(null)
    runningRef.current = false
    invalidateGrading()
  }

  const enqueueSave = (sid: string, aid: string, raw: string) => {
    const serialized = serializeScore(raw)
    const key = cellKey(sid, aid)
    const current = readCell(sid, aid)
    const currentSerialized = asScore(current.score)
      ? serializeScore(String(current.score))
      : null
    if (serialized === currentSerialized) return
    if (serialized === null && !current.scoreId) return
    const previous = overridesRef.current[key] ?? null
    writeOverride(key, { score: serialized, scoreId: current.scoreId })
    queueRef.current = queueRef.current.filter((job) => job.key !== key)
    queueRef.current.push({
      key,
      studentId: sid,
      activityId: aid,
      score: serialized,
      previous,
    })
    void processQueue()
  }

  const firstPending = (sid: string): string | null => {
    const scores = scoresFor(sid)
    return ordered.find((activity) => !isRowComplete([activity.id], scores))?.id ?? null
  }

  const advance = (sid: string, aid: string) => {
    const index = ordered.findIndex((activity) => activity.id === aid)
    const next = ordered[index + 1]
    if (next) {
      onFocus({ student: sid, activity: next.id })
      return
    }
    const studentIndex = enrollments.findIndex((row) => row.student === sid)
    for (let i = studentIndex + 1; i < enrollments.length; i += 1) {
      const nextStudent = enrollments[i]!
      const pending = firstPending(nextStudent.student)
      if (pending) {
        onFocus({ student: nextStudent.student, activity: pending })
        return
      }
    }
    onFocus({ student: sid })
  }

  const title = period?.name ?? 'Calificar el grupo'
  const courseSubtitle = course
    ? [course.subject_name, course.group_name].filter(Boolean).join(' · ')
    : undefined

  if (!course) {
    return (
      <Shell title="Calificar el grupo" onBack={onBack}>
        <EmptyState
          icon={<IconBook size={24} />}
          title="Curso no encontrado"
          body="Esa asignación ya no está en tu lista. Vuelve a Mis cursos."
        />
      </Shell>
    )
  }

  if (!periodId) {
    return (
      <Shell title={title} subtitle={courseSubtitle} onBack={onBack}>
        <EmptyState
          icon={<IconClipboard size={22} />}
          title="No hay periodos para este año"
          body="Pide a coordinación que configure el periodo lectivo. Sin periodo no se puede calificar el grupo."
        />
      </Shell>
    )
  }

  if (bundleQuery.isLoading) {
    return (
      <Shell title={title} subtitle={courseSubtitle} onBack={onBack}>
        <p className="text-sm text-slate-400 text-center py-12">Cargando malla…</p>
      </Shell>
    )
  }

  if (bundleQuery.isError) {
    return (
      <Shell title={title} subtitle={courseSubtitle} onBack={onBack}>
        <div className="px-6 py-12">
          <WriteError
            message={getErrorMessage(bundleQuery.error, 'No se pudo cargar el esquema.')}
            onRetry={() => void bundleQuery.refetch()}
          />
        </div>
      </Shell>
    )
  }

  if (!bundle?.scheme) {
    return (
      <Shell title={title} subtitle={courseSubtitle} onBack={onBack}>
        <div className="p-4 space-y-3">
          <EmptyState
            icon={<IconClipboard size={22} />}
            title="Este periodo no tiene esquema de actividades"
            body="Crea el plan para definir segmentos, pesos y el calendario. Sin esquema no se puede calificar."
          />
          <button
            type="button"
            onClick={onGoToPlan}
            className="w-full min-h-11 rounded-xl bg-[#1E3A5F] text-white text-sm font-semibold"
          >
            Ir al plan
          </button>
        </div>
      </Shell>
    )
  }

  const focused = enrollments.find((row) => row.student === studentId) ?? null
  const openActivity =
    focused && activityId
      ? ordered.find((activity) => activity.id === activityId) ?? null
      : null
  const visibleCell = (sid: string, aid: string): CellValue =>
    overrides[cellKey(sid, aid)] ?? server.get(cellKey(sid, aid)) ?? {
      score: null,
      scoreId: null,
    }
  const rowScores = (sid: string) => {
    const map = new Map<string, string | null>()
    for (const activity of ordered) {
      map.set(activity.id, asScore(visibleCell(sid, activity.id).score))
    }
    return map
  }
  const filledCount = (sid: string) =>
    ordered.filter((activity) => isScoreFilled(rowScores(sid).get(activity.id))).length

  const toneBySegment = new Map<string, number>()
  bySortOrder(bundle.segments).forEach((segment, index) => {
    toneBySegment.set(segment.id, index % SEGMENT_TONES.length)
  })

  const slots = enrollments.flatMap((row) =>
    ordered.map((activity) => ({ studentId: row.student, activityId: activity.id })),
  )
  const slotIndex = openActivity
    ? slots.findIndex(
        (slot) => slot.studentId === focused?.student && slot.activityId === openActivity.id,
      )
    : -1

  const handleBack = () => {
    if (focused) {
      onFocus({})
      return
    }
    onBack()
  }

  const handleAccept = () => {
    if (!focused || !openActivity) return
    const key = cellKey(focused.student, openActivity.id)
    const raw = drafts[key] ?? visibleCell(focused.student, openActivity.id).score ?? ''
    enqueueSave(focused.student, openActivity.id, raw)
    advance(focused.student, openActivity.id)
  }

  const moveSlot = (delta: number) => {
    const next = slots[slotIndex + delta]
    if (!next) return
    onFocus({ student: next.studentId, activity: next.activityId })
  }

  const keypadValue =
    focused && openActivity
      ? drafts[cellKey(focused.student, openActivity.id)] ??
        visibleCell(focused.student, openActivity.id).score ??
        ''
      : ''

  return (
    <Shell
      title={title}
      subtitle={
        focused
          ? `${focused.student_name} · ${courseSubtitle ?? ''}`
          : courseSubtitle
      }
      onBack={handleBack}
    >
      {!weightsValid && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
          <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
            <IconAlert size={14} />
            Los pesos no suman 100%
          </p>
          <p className="text-[11px] text-amber-700 mt-0.5">
            El promedio queda en 0 hasta corregir los pesos en el plan.
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {!focused && enrollments.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-12 px-6">
            No hay matrículas activas en este grupo.
          </p>
        )}
        {!focused &&
          enrollments.map((row) => {
            const scores = rowScores(row.student)
            const studentError = Object.entries(errors).find(([key]) =>
              key.startsWith(`${row.student}:`),
            )?.[1]
            return (
              <button
                key={row.student}
                type="button"
                onClick={() => onFocus({ student: row.student })}
                className="w-full min-h-11 text-left bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 hover:bg-slate-50"
              >
                <Avatar name={row.student_name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {row.student_name}
                  </p>
                  <p className="font-mono text-xs text-slate-400 truncate">
                    {row.student_document_number}
                  </p>
                  {studentError && (
                    <p className="text-[11px] text-red-600 mt-0.5 truncate">{studentError}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-xs text-slate-500">
                    {filledCount(row.student)}/{ordered.length}
                  </p>
                  <p className="font-mono text-sm font-bold text-slate-900">
                    {displayDef(structure, scores)}
                  </p>
                </div>
              </button>
            )
          })}

        {focused && !openActivity && (
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
            <span className="text-xs font-semibold text-slate-500">def</span>
            <span className="font-mono text-lg font-bold text-slate-900">
              {displayDef(structure, rowScores(focused.student))}
            </span>
          </div>
        )}

        {focused && bundle.segments.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-12 px-6">
            Este esquema no tiene segmentos. El promedio queda en 0.
          </p>
        )}

        {focused &&
          bySortOrder(bundle.components).map((component) => {
            const segments = bySortOrder(bundle.segments).filter(
              (segment) => segment.subject_component === component.id,
            )
            if (segments.length === 0) return null
            return (
              <section key={component.id} className="mb-2">
                <div className="px-4 pt-3 pb-1 flex items-baseline justify-between">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {component.name}
                  </p>
                  <span className="font-mono text-[10px] text-slate-400">
                    {component.weight_percent}%
                  </span>
                </div>
                {segments.map((segment) => {
                  const tone = SEGMENT_TONES[toneBySegment.get(segment.id) ?? 0]!
                  const segmentActivities = ordered.filter(
                    (activity) => activity.segment === segment.id,
                  )
                  return (
                    <div key={segment.id} className="px-3 pb-2">
                      <div className="flex items-center gap-2 px-1 py-1">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${tone}`}>
                          {segment.name}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {segment.weight_percent}%
                        </span>
                      </div>
                      {segmentActivities.length === 0 && (
                        <p className="text-xs text-slate-400 px-1 py-2">
                          Este segmento no tiene actividades.
                        </p>
                      )}
                      {segmentActivities.map((activity) => {
                        const key = cellKey(focused.student, activity.id)
                        const cell = visibleCell(focused.student, activity.id)
                        const shown = asScore(cell.score)
                        const isOpen = openActivity?.id === activity.id
                        const error = errors[key]
                        return (
                          <button
                            key={activity.id}
                            type="button"
                            onClick={() =>
                              onFocus(
                                isOpen
                                  ? { student: focused.student }
                                  : { student: focused.student, activity: activity.id },
                              )
                            }
                            className={`w-full min-h-11 text-left bg-white rounded-xl border px-3 py-2.5 mb-1.5 flex items-center gap-3 ${
                              isOpen
                                ? 'border-blue-400 ring-1 ring-blue-200'
                                : error
                                  ? 'border-red-300'
                                  : 'border-slate-200'
                            }`}
                          >
                            <span className={`w-1 self-stretch rounded-full border ${tone}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {activity.name}
                              </p>
                              {error && (
                                <p className="text-[11px] text-red-600 mt-0.5">{error}</p>
                              )}
                            </div>
                            <span
                              className={`font-mono text-sm font-semibold ${
                                shown ? 'text-slate-900' : 'text-slate-300'
                              }`}
                            >
                              {savingKey === key ? '…' : formatScoreDisplay(shown)}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </section>
            )
          })}
      </div>

      {focused && openActivity && (
        <div className="bg-white border-t border-slate-200">
          <div className="flex items-center justify-between px-4 pt-2">
            <span className="text-xs font-semibold text-slate-500">def</span>
            <span className="font-mono text-lg font-bold text-slate-900">
              {displayDef(structure, rowScores(focused.student))}
            </span>
          </div>
          <div className="flex items-stretch">
            <button
              type="button"
              aria-label="Actividad anterior"
              disabled={slotIndex <= 0}
              onClick={() => moveSlot(-1)}
              className="min-w-11 min-h-11 px-2 text-xl text-slate-700 disabled:text-slate-300"
            >
              ‹
            </button>
            <div className="flex-1 min-w-0">
              <ScoreKeypad
                value={keypadValue}
                maxScore={parseMaxScore(openActivity.max_score)}
                onChange={(value) => {
                  if (!focused || !openActivity) return
                  const key = cellKey(focused.student, openActivity.id)
                  setDrafts((prev) => ({ ...prev, [key]: value }))
                }}
                onClose={handleAccept}
                studentName={`${focused.student_name} · ${openActivity.name}`}
              />
            </div>
            <button
              type="button"
              aria-label="Actividad siguiente"
              disabled={slotIndex < 0 || slotIndex >= slots.length - 1}
              onClick={() => moveSlot(1)}
              className="min-w-11 min-h-11 px-2 text-xl text-slate-700 disabled:text-slate-300"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </Shell>
  )
}
