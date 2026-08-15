import { isAxiosError } from 'axios'
import { useMemo, useState } from 'react'

import { getErrorMessage } from '@/api/errors'
import {
  Avatar,
  AttendanceButton,
  EmptyState,
  IconBook,
  IconCheck,
  SectionHeader,
  WriteError,
} from '@/components'
import type { AttendanceStatus } from '@/data'
import {
  isRollCallStatus,
  useRollCallRosterQuery,
  useSaveRollCallMutation,
  type RollCallOrigin,
  type RollCallRosterStudent,
  type RollCallSaveResponse,
} from '@/features/attendance/rollCallApi'
import {
  rollCallDraftKey,
  useRollCallDraftStore,
  type RollCallMark,
} from '@/features/attendance/rollCallDraftStore'
import { formatLongDate, todayIso } from '@/session/periodUtils'
import {
  useSessionCourse,
  useTeacherSession,
} from '@/session/TeacherSessionContext'
import type { RollCallEntryRequest, RollCallStatus } from '@/types/schemas'

export type { RollCallOrigin }

export interface RollCallProps {
  courseId: string
  origin: RollCallOrigin
  onSaved: () => void
  onBack: () => void
}

const STATUSES: AttendanceStatus[] = ['PRESENT', 'EXCUSED', 'UNEXCUSED']

function rosterErrorMessage(err: unknown): string {
  if (isAxiosError(err) && err.response?.status === 404) {
    return 'Este grupo está fuera de tu alcance.'
  }
  return getErrorMessage(err, 'No se pudo cargar la lista.')
}

function defaultMark(student: RollCallRosterStudent): RollCallMark {
  return {
    status: isRollCallStatus(student.status) ? student.status : 'PRESENT',
    notes: student.notes ?? '',
  }
}

function buildEntries(
  students: RollCallRosterStudent[],
  marks: Record<string, RollCallMark>,
): RollCallEntryRequest[] {
  return students.map((student) => {
    const mark = marks[student.student] ?? defaultMark(student)
    const entry: RollCallEntryRequest = {
      student: student.student,
      status: mark.status,
    }
    if (mark.status === 'EXCUSED') entry.notes = mark.notes.trim()
    return entry
  })
}

export function RollCallScreen({
  courseId,
  origin,
  onSaved,
  onBack,
}: RollCallProps) {
  const course = useSessionCourse(courseId)
  const session = useTeacherSession()
  const [date, setDate] = useState(todayIso)
  const [currentOrigin, setCurrentOrigin] = useState<RollCallOrigin>(origin)
  const [search, setSearch] = useState('')
  const [showExcuseFor, setShowExcuseFor] = useState<string | null>(null)
  const [formError, setFormError] = useState('')
  const [writeFailed, setWriteFailed] = useState(false)
  const [savedResult, setSavedResult] = useState<RollCallSaveResponse | null>(
    null,
  )

  const groupId = course?.groupId ?? ''
  const assignmentId =
    currentOrigin === 'subject' ? courseId : undefined
  const draftKey = rollCallDraftKey(groupId, date, currentOrigin, assignmentId)
  const draft = useRollCallDraftStore((s) => s.drafts[draftKey])
  const setMark = useRollCallDraftStore((s) => s.setMark)
  const setFallbackPeriodId = useRollCallDraftStore((s) => s.setFallbackPeriodId)
  const clearDraft = useRollCallDraftStore((s) => s.clearDraft)

  const rosterQuery = useRollCallRosterQuery(
    groupId
      ? {
          group: groupId,
          date,
          ...(assignmentId ? { course_assignment: assignmentId } : {}),
        }
      : null,
  )
  const saveMutation = useSaveRollCallMutation()

  const roster = rosterQuery.data
  const students = roster?.students ?? []
  const marks = useMemo(() => {
    const merged: Record<string, RollCallMark> = {}
    for (const student of students) {
      merged[student.student] =
        draft?.marks[student.student] ?? defaultMark(student)
    }
    return merged
  }, [students, draft])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return students
    return students.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.document_number.includes(q),
    )
  }, [students, search])

  const counts = useMemo(() => {
    const values = Object.values(marks)
    return {
      PRESENT: values.filter((m) => m.status === 'PRESENT').length,
      EXCUSED: values.filter((m) => m.status === 'EXCUSED').length,
      UNEXCUSED: values.filter((m) => m.status === 'UNEXCUSED').length,
    }
  }, [marks])

  const otherSourcesCount = students.filter((s) => s.other_sources > 0).length
  const missingPeriod = Boolean(roster) && !roster?.academic_period
  const fallbackPeriodId =
    draft?.fallbackPeriodId ?? session.selectedPeriodId ?? null
  const excusedWithoutNotes = students.some((s) => {
    const mark = marks[s.student]
    return mark?.status === 'EXCUSED' && !mark.notes.trim()
  })

  const updateStatus = (studentId: string, status: RollCallStatus) => {
    const prev = marks[studentId]
    setMark(draftKey, studentId, {
      status,
      notes: status === 'PRESENT' ? '' : (prev?.notes ?? ''),
    })
    if (status === 'EXCUSED') setShowExcuseFor(studentId)
    else if (showExcuseFor === studentId) setShowExcuseFor(null)
  }

  const updateNotes = (studentId: string, notes: string) => {
    const prev = marks[studentId]
    setMark(draftKey, studentId, {
      status: prev?.status ?? 'PRESENT',
      notes,
    })
  }

  const handleSave = async () => {
    if (!course || !groupId || students.length === 0) return
    if (missingPeriod && !fallbackPeriodId) {
      setWriteFailed(false)
      setFormError('Esta fecha no cae en un periodo. Elige uno antes de guardar.')
      return
    }
    if (excusedWithoutNotes) {
      const first = students.find((s) => {
        const mark = marks[s.student]
        return mark?.status === 'EXCUSED' && !mark.notes.trim()
      })
      setWriteFailed(false)
      setFormError('La falta con excusa exige un motivo.')
      if (first) setShowExcuseFor(first.student)
      return
    }
    setFormError('')
    setWriteFailed(false)
    try {
      const result = await saveMutation.mutateAsync({
        group: groupId,
        date,
        ...(assignmentId ? { course_assignment: assignmentId } : {}),
        ...(roster?.academic_period
          ? { academic_period: roster.academic_period }
          : fallbackPeriodId
            ? { academic_period: fallbackPeriodId }
            : {}),
        entries: buildEntries(students, marks),
      })
      clearDraft(draftKey)
      setSavedResult(result)
      window.setTimeout(onSaved, 1400)
    } catch (err) {
      setWriteFailed(true)
      setFormError(getErrorMessage(err, 'No se pudo guardar la lista.'))
    }
  }

  if (!course) {
    return (
      <div className="flex flex-col h-full bg-[#F1F5F9]">
        <SectionHeader title="Llamado a lista" onBack={onBack} />
        <EmptyState
          icon={<IconBook size={24} />}
          title="Curso no encontrado"
          body="Esa asignación ya no está en tu lista. Vuelve a Mis cursos."
        />
      </div>
    )
  }

  if (savedResult) {
    return (
      <div className="flex flex-col h-full bg-white items-center justify-center gap-4 p-8">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
          <IconCheck size={32} />
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-slate-900">Lista guardada</p>
          <p className="text-sm text-slate-500 mt-1">
            {savedResult.present_count} presentes · {savedResult.excused_count} CE · {savedResult.unexcused_count} SE
          </p>
          <p className="text-xs text-slate-400 mt-2">
            {savedResult.created} nuevas · {savedResult.updated} actualizadas · {savedResult.students_processed} estudiantes
          </p>
          {savedResult.academic_period_name && (
            <p className="text-xs text-slate-400 mt-1">{savedResult.academic_period_name}</p>
          )}
        </div>
      </div>
    )
  }

  const subtitle =
    currentOrigin === 'group'
      ? `${course.group_name} · ${formatLongDate(date)}`
      : `${course.subject_name} · ${course.group_name} · ${formatLongDate(date)}`

  const canSave =
    !saveMutation.isPending &&
    students.length > 0 &&
    !(missingPeriod && !fallbackPeriodId)

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9]">
      <div className="bg-white border-b border-slate-200">
        <SectionHeader title="Llamado a lista" subtitle={subtitle} onBack={onBack} />
        <div className="px-4 pb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">Origen:</span>
          <button
            type="button"
            onClick={() => {
              setCurrentOrigin('subject')
              setFormError('')
            }}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              currentOrigin === 'subject'
                ? 'bg-[#1E3A5F] text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Por asignatura
          </button>
          {course.isDirectorGroup && (
            <button
              type="button"
              onClick={() => {
                setCurrentOrigin('group')
                setFormError('')
              }}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                currentOrigin === 'group'
                  ? 'bg-[#1E3A5F] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              General del grupo
            </button>
          )}
          <input
            type="date"
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value)
              setFormError('')
            }}
            className="ml-auto h-8 px-2 rounded-lg border border-slate-200 text-xs text-slate-700 outline-none focus:border-blue-400"
          />
        </div>
      </div>

      {otherSourcesCount > 0 && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-2 text-xs text-blue-700">
          <span className="w-4 h-4 rounded-full bg-blue-200 flex items-center justify-center font-bold text-[10px]">
            {otherSourcesCount}
          </span>
          Ya hay otro llamado hoy. El estado consolidado aplica por falta más grave.
        </div>
      )}

      {missingPeriod && (
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
          <p className="text-xs text-amber-800 font-medium mb-2">
            Esta fecha no cae en un periodo. Elige uno para guardar.
          </p>
          <div className="flex gap-2 flex-wrap">
            {session.periods.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setFallbackPeriodId(draftKey, p.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                  fallbackPeriodId === p.id
                    ? 'bg-[#1E3A5F] text-white'
                    : 'bg-white text-amber-800 border border-amber-200'
                }`}
              >
                {p.shortName}
              </button>
            ))}
          </div>
        </div>
      )}

      {roster?.academic_period_name && (
        <div className="px-4 py-1.5 bg-white border-b border-slate-100 text-[11px] text-slate-500">
          Periodo: {roster.academic_period_name}
        </div>
      )}

      <div className="px-4 py-2 bg-white border-b border-slate-100">
        <input
          type="search"
          placeholder="Buscar por nombre o documento…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
        />
      </div>

      {formError && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-100">
          <WriteError
            message={formError}
            onRetry={writeFailed ? () => void handleSave() : undefined}
            disabled={saveMutation.isPending}
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {rosterQuery.isLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
            <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[#1E3A5F] animate-spin" />
            <p className="text-sm">Cargando lista…</p>
          </div>
        )}

        {rosterQuery.isError && (
          <div className="px-2 py-8 text-center">
            <p className="text-sm text-slate-600">{rosterErrorMessage(rosterQuery.error)}</p>
            <button
              type="button"
              onClick={() => void rosterQuery.refetch()}
              className="mt-3 text-sm font-semibold text-blue-700 hover:underline"
            >
              Reintentar
            </button>
          </div>
        )}

        {rosterQuery.isSuccess && students.length === 0 && (
          <EmptyState
            icon={<IconBook size={24} />}
            title="Sin estudiantes"
            body="No hay matrículas activas en este grupo."
          />
        )}

        {rosterQuery.isSuccess && students.length > 0 && (
          <div className="grid grid-cols-1 min-[560px]:grid-cols-2 gap-1.5">
            {filtered.map((s) => {
              const mark = marks[s.student]
              const showNotes = showExcuseFor === s.student || mark?.status === 'EXCUSED'
              return (
                <div key={s.student}>
                  <div className="bg-white rounded-xl border border-slate-200 flex items-center px-3.5 py-3 gap-3">
                    <Avatar name={s.full_name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{s.full_name}</p>
                      <p className="font-mono text-xs text-slate-400">{s.document_number}</p>
                      {s.other_sources > 0 && (
                        <p className="text-[10px] text-blue-600 mt-0.5">
                          Otro origen · consolidado:{' '}
                          {s.consolidated_status === 'EXCUSED'
                            ? 'CE'
                            : s.consolidated_status === 'UNEXCUSED'
                              ? 'SE'
                              : 'P'}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {STATUSES.map((st) => (
                        <AttendanceButton
                          key={st}
                          status={st}
                          active={mark?.status === st}
                          onClick={() => updateStatus(s.student, st)}
                        />
                      ))}
                    </div>
                  </div>
                  {showNotes && mark?.status === 'EXCUSED' && (
                    <div className="bg-amber-50 border border-amber-200 border-t-0 rounded-b-xl px-4 py-3 -mt-1">
                      <p className="text-xs text-amber-700 font-medium mb-1.5">
                        Motivo de la excusa (obligatorio)
                      </p>
                      <input
                        type="text"
                        placeholder="Ej: Certificado médico, diligencia familiar…"
                        value={mark.notes}
                        onChange={(e) => updateNotes(s.student, e.target.value)}
                        className="w-full h-9 px-3 rounded-lg border border-amber-300 text-xs outline-none focus:border-amber-500 bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowExcuseFor(null)}
                        className="mt-2 text-xs text-amber-700 font-semibold hover:underline"
                      >
                        Listo
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="bg-white border-t border-slate-200 px-4 py-3 safe-area-bottom">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-emerald-600 font-semibold">{counts.PRESENT} P</span>
            <span className="text-amber-600 font-semibold">{counts.EXCUSED} CE</span>
            <span className="text-red-600 font-semibold">{counts.UNEXCUSED} SE</span>
          </div>
          <span className="text-xs text-slate-400">{students.length} estudiantes</span>
        </div>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canSave}
          className="w-full h-12 rounded-xl bg-[#1E3A5F] text-white font-semibold text-sm hover:bg-[#2D5A8E] disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
        >
          {saveMutation.isPending ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              Guardando…
            </>
          ) : (
            `Guardar lista — ${students.length} estudiantes`
          )}
        </button>
      </div>
    </div>
  )
}
