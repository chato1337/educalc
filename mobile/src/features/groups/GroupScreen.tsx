import { useMemo, useState } from 'react'

import { getErrorMessage } from '@/api/errors'
import {
  Avatar,
  Card,
  EmptyState,
  IconCalendar,
  IconChevronRight,
  IconDocument,
  IconPencil,
  LoadMoreButton,
  Pill,
  WriteError,
} from '@/components'
import {
  flatInfinitePages,
  infiniteListCount,
} from '@/api/useInfiniteList'
import { formatScoreDisplay } from '@/features/grading/activityStatus'
import { useRollCallRosterQuery } from '@/features/attendance/rollCallApi'
import { useGroupRankingsQuery } from '@/features/groups/groupRankingsApi'
import { useActiveEnrollmentsQuery } from '@/features/students/enrollmentsApi'
import {
  useCreateDisciplinaryReportMutation,
  useDisciplinaryReportsInfiniteQuery,
  usePatchDisciplinaryReportMutation,
} from '@/features/students/disciplinaryReportsApi'
import { formatLongDate, todayIso } from '@/session/periodUtils'
import { useTeacherSession } from '@/session/TeacherSessionContext'
import type { GroupTab } from '@/session/navStore'
import type { DisciplinaryReport, Enrollment } from '@/types/schemas'

export type { GroupTab }

export interface GroupScreenProps {
  onSelectStudent: (id: string) => void
  onGoToRollCall: () => void
  onOpenBulletin: (studentId?: string) => void
  onOpenIndicatorsReport: (studentId: string, studentName: string) => void
  onOpenSchoolRecord: (studentId: string, studentName: string) => void
  tab?: GroupTab
  onTabChange?: (tab: GroupTab) => void
  initialTab?: GroupTab
}

export function GroupScreen({
  onSelectStudent,
  onGoToRollCall,
  onOpenBulletin,
  onOpenIndicatorsReport,
  onOpenSchoolRecord,
  tab: tabProp,
  onTabChange,
  initialTab = 'rollCall',
}: GroupScreenProps) {
  const session = useTeacherSession()
  const director = session.gradeDirectors[0]
  const date = todayIso()
  const [tabState, setTabState] = useState<GroupTab>(tabProp ?? initialTab)
  const tab = tabProp ?? tabState
  const setTab = onTabChange ?? setTabState

  const rosterQuery = useRollCallRosterQuery(
    director ? { group: director.group, date } : null,
  )
  const enrollmentsQuery = useActiveEnrollmentsQuery(
    director && session.academicYear
      ? { group: director.group, academic_year: session.academicYear.id }
      : null,
  )
  const enrollments = useMemo(
    () =>
      [...(enrollmentsQuery.data ?? [])].sort((a, b) =>
        a.student_name.localeCompare(b.student_name, 'es'),
      ),
    [enrollmentsQuery.data],
  )
  const students = rosterQuery.data?.students ?? []
  const todayCounts = {
    PRESENT: students.filter((s) => s.status === 'PRESENT').length,
    EXCUSED: students.filter((s) => s.status === 'EXCUSED').length,
    UNEXCUSED: students.filter((s) => s.status === 'UNEXCUSED').length,
  }
  const alreadyCalled = students.some((s) => s.status != null)
  const period = session.periods.find((p) => p.id === session.selectedPeriodId)

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9]">
      <div className="bg-white border-b border-slate-200">
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-0.5">
            <Pill color="blue">Director</Pill>
            <h1 className="text-base font-bold text-slate-900">
              Mi grupo{director ? ` · ${director.group_name}` : ''}
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            {director?.campus_name ?? 'Sede'}
            {director ? ` · ${director.academic_year_year}` : ''}
            {enrollments.length > 0
              ? ` · ${enrollments.length} estudiantes`
              : students.length > 0
                ? ` · ${students.length} estudiantes`
                : ''}
          </p>
        </div>
        <div className="flex border-t border-slate-100 overflow-x-auto">
          {(
            [
              { id: 'rollCall', label: 'Llamado' },
              { id: 'ranking', label: 'Ranking' },
              { id: 'disciplinary', label: 'Convivencia' },
              { id: 'reports', label: 'Informes' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
                tab === t.id
                  ? 'border-[#1E3A5F] text-[#1E3A5F]'
                  : 'border-transparent text-slate-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'rollCall' && (
          <RollCallTab
            date={date}
            alreadyCalled={alreadyCalled}
            todayCounts={todayCounts}
            rosterLoading={rosterQuery.isLoading}
            rosterError={rosterQuery.error}
            rosterFailed={rosterQuery.isError}
            onGoToRollCall={onGoToRollCall}
          />
        )}
        {tab === 'ranking' && (
          <RankingTab
            groupId={director?.group ?? null}
            periodId={session.selectedPeriodId}
            periodName={period?.name}
            onSelectStudent={onSelectStudent}
          />
        )}
        {tab === 'disciplinary' && (
          <DisciplinaryTab
            enrollments={enrollments}
            enrollmentsLoading={enrollmentsQuery.isLoading}
            periodId={session.selectedPeriodId}
            periodName={period?.shortName ?? period?.name}
            teacherId={session.teacher?.id}
          />
        )}
        {tab === 'reports' && (
          <ReportsTab
            enrollments={enrollments}
            periodName={period?.name}
            year={session.academicYear?.year}
            groupName={director?.group_name}
            onOpenBulletin={onOpenBulletin}
            onOpenIndicatorsReport={onOpenIndicatorsReport}
            onOpenSchoolRecord={onOpenSchoolRecord}
          />
        )}
      </div>
    </div>
  )
}

function RollCallTab({
  date,
  alreadyCalled,
  todayCounts,
  rosterLoading,
  rosterError,
  rosterFailed,
  onGoToRollCall,
}: {
  date: string
  alreadyCalled: boolean
  todayCounts: { PRESENT: number; EXCUSED: number; UNEXCUSED: number }
  rosterLoading: boolean
  rosterError: unknown
  rosterFailed: boolean
  onGoToRollCall: () => void
}) {
  return (
    <div className="p-4 space-y-4">
      <button
        type="button"
        onClick={onGoToRollCall}
        className="w-full bg-[#1E3A5F] text-white rounded-xl p-4 text-left hover:bg-[#2D5A8E] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <IconCalendar size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">Llamado general del grupo</p>
            <p className="text-xs text-blue-200 truncate">
              Como director · {formatLongDate(date)}
            </p>
          </div>
          <IconChevronRight size={16} />
        </div>
      </button>
      <Card className="p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          {alreadyCalled ? `Lista de hoy — ${formatLongDate(date)}` : 'Lista de hoy'}
        </p>
        {rosterLoading ? (
          <p className="text-sm text-slate-400 text-center py-3">Cargando…</p>
        ) : rosterFailed ? (
          <p className="text-sm text-red-600 text-center py-2">
            {getErrorMessage(rosterError, 'No se pudo cargar el roster.')}
          </p>
        ) : !alreadyCalled ? (
          <p className="text-sm text-slate-400 text-center py-2">
            Aún no hay llamado general hoy.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="font-mono text-xl font-bold text-emerald-600">
                {todayCounts.PRESENT}
              </p>
              <p className="text-xs text-slate-500">Presentes</p>
            </div>
            <div>
              <p className="font-mono text-xl font-bold text-amber-600">
                {todayCounts.EXCUSED}
              </p>
              <p className="text-xs text-slate-500">CE</p>
            </div>
            <div>
              <p className="font-mono text-xl font-bold text-red-600">
                {todayCounts.UNEXCUSED}
              </p>
              <p className="text-xs text-slate-500">SE</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

function RankingTab({
  groupId,
  periodId,
  periodName,
  onSelectStudent,
}: {
  groupId: string | null
  periodId: string | null
  periodName?: string
  onSelectStudent: (id: string) => void
}) {
  const query = useGroupRankingsQuery(groupId, periodId)
  const block =
    query.data?.rankings_by_period.find((b) => b.period.id === periodId) ??
    query.data?.rankings_by_period[0]
  const rows = block?.rankings ?? []

  return (
    <div className="p-4 space-y-1">
      <p className="text-xs text-slate-400 mb-2">
        Promedio del {periodName ?? 'periodo'} · Todas las asignaturas
      </p>
      {query.isLoading && (
        <p className="text-sm text-slate-400 text-center py-4">Cargando ranking…</p>
      )}
      {query.isError && (
        <p className="text-sm text-red-600 text-center py-2">
          {getErrorMessage(query.error, 'No se pudo cargar el ranking.')}
        </p>
      )}
      {!query.isLoading && !query.isError && rows.length === 0 && (
        <EmptyState
          icon={<IconDocument size={24} />}
          title="Sin promedios"
          body="Aún no hay PerformanceSummary para este grupo y periodo. Coordinación debe recalcular el desempeño."
        />
      )}
      {rows.map((s, i) => {
        const place = s.rank ?? i + 1
        return (
          <button
            key={s.student_id}
            type="button"
            onClick={() => onSelectStudent(s.student_id)}
            className="w-full text-left bg-white rounded-xl border border-slate-200 flex items-center px-3.5 py-3 gap-3 hover:border-slate-300 transition-colors"
          >
            <span
              className={`font-mono text-sm font-bold w-6 text-center ${
                place === 1
                  ? 'text-amber-500'
                  : place === 2
                    ? 'text-slate-400'
                    : place === 3
                      ? 'text-amber-700'
                      : 'text-slate-400'
              }`}
            >
              {place}
            </span>
            <Avatar name={s.student_name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {s.student_name}
              </p>
            </div>
            <span className="font-mono text-sm font-bold text-slate-700">
              {formatScoreDisplay(String(s.period_average))}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function formatReportDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function DisciplinaryTab({
  enrollments,
  enrollmentsLoading,
  periodId,
  periodName,
  teacherId,
}: {
  enrollments: Enrollment[]
  enrollmentsLoading: boolean
  periodId: string | null
  periodName?: string
  teacherId?: string
}) {
  const studentIds = useMemo(
    () => new Set(enrollments.map((e) => e.student)),
    [enrollments],
  )
  const reportsQuery = useDisciplinaryReportsInfiniteQuery(
    periodId ? { academic_period: periodId } : null,
  )
  const createMutation = useCreateDisciplinaryReportMutation()
  const patchMutation = usePatchDisciplinaryReportMutation()

  const [composing, setComposing] = useState(false)
  const [studentId, setStudentId] = useState('')
  const [text, setText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formError, setFormError] = useState('')
  const [writeFailed, setWriteFailed] = useState(false)

  const reports = useMemo(() => {
    const rows = flatInfinitePages(reportsQuery.data).filter((r) =>
      studentIds.has(r.student),
    )
    return [...rows].sort(
      (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
    )
  }, [reportsQuery.data, studentIds])
  const reportsTotal = infiniteListCount(reportsQuery.data)

  const resetForm = () => {
    setComposing(false)
    setEditingId(null)
    setStudentId('')
    setText('')
    setFormError('')
    setWriteFailed(false)
  }

  const startEdit = (row: DisciplinaryReport) => {
    setComposing(true)
    setEditingId(row.id)
    setStudentId(row.student)
    setText(row.report_text ?? '')
    setFormError('')
    setWriteFailed(false)
  }

  const handleSave = async () => {
    if (!periodId) return
    if (!studentId || !text.trim()) {
      setWriteFailed(false)
      setFormError('Elige un estudiante y escribe el reporte.')
      return
    }
    setFormError('')
    setWriteFailed(false)
    try {
      if (editingId) {
        await patchMutation.mutateAsync({
          id: editingId,
          body: { report_text: text.trim() },
        })
      } else {
        await createMutation.mutateAsync({
          student: studentId,
          academic_period: periodId,
          report_text: text.trim(),
          created_by: teacherId ?? null,
        })
      }
      resetForm()
    } catch (err) {
      setWriteFailed(true)
      setFormError(getErrorMessage(err, 'No se pudo guardar el reporte.'))
    }
  }

  const busy = createMutation.isPending || patchMutation.isPending

  return (
    <div className="p-4 space-y-3">
      {!composing && (
        <button
          type="button"
          onClick={() => {
            setComposing(true)
            setEditingId(null)
            setStudentId('')
            setText('')
            setFormError('')
          }}
          className="w-full bg-white rounded-xl border border-slate-200 flex items-center px-4 py-3 gap-3 hover:border-slate-300 transition-colors"
        >
          <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
            <IconPencil size={16} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-slate-900">Nuevo reporte</p>
            <p className="text-xs text-slate-500">
              {periodName ? `Bitácora · ${periodName}` : 'Seleccionar estudiante y redactar'}
            </p>
          </div>
          <IconChevronRight size={16} />
        </button>
      )}

      {composing && (
        <Card className="p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {editingId ? 'Editar reporte' : 'Nuevo reporte'}
          </p>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            disabled={Boolean(editingId)}
            className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-400 bg-white disabled:bg-slate-50"
          >
            <option value="">Estudiante…</option>
            {enrollments.map((e) => (
              <option key={e.id} value={e.student}>
                {e.student_name} · {e.student_document_number}
              </option>
            ))}
          </select>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="Texto del reporte de convivencia…"
            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-400 resize-none"
          />
          {formError && (
            <WriteError
              message={formError}
              onRetry={writeFailed ? () => void handleSave() : undefined}
              disabled={busy}
            />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={busy || !periodId}
              className="flex-1 h-10 rounded-xl bg-[#1E3A5F] text-white text-sm font-semibold disabled:opacity-50"
            >
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </Card>
      )}

      {enrollmentsLoading || reportsQuery.isLoading ? (
        <p className="text-sm text-slate-400 text-center py-4">Cargando bitácora…</p>
      ) : reportsQuery.isError ? (
        <div className="px-1 py-2">
          <WriteError
            message={getErrorMessage(reportsQuery.error, 'No se pudieron cargar los reportes.')}
            onRetry={() => void reportsQuery.refetch()}
          />
        </div>
      ) : reports.length === 0 && !composing ? (
        <p className="text-xs text-slate-400 text-center py-4">
          No hay reportes de convivencia en este periodo.
        </p>
      ) : (
        <>
          {reports.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => startEdit(row)}
              className="w-full text-left"
            >
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Avatar name={row.student_name} size="sm" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">
                      {row.student_name}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {row.created_by_name || 'Docente'} · {formatReportDate(row.created_at)}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {row.report_text?.trim() || 'Sin texto.'}
                </p>
              </Card>
            </button>
          ))}
          <LoadMoreButton
            hasMore={Boolean(reportsQuery.hasNextPage)}
            isLoadingMore={reportsQuery.isFetchingNextPage}
            onLoadMore={() => void reportsQuery.fetchNextPage()}
            loaded={flatInfinitePages(reportsQuery.data).length}
            total={reportsTotal}
          />
        </>
      )}
    </div>
  )
}

function ReportsTab({
  enrollments,
  periodName,
  year,
  groupName,
  onOpenBulletin,
  onOpenIndicatorsReport,
  onOpenSchoolRecord,
}: {
  enrollments: Enrollment[]
  periodName?: string
  year?: number
  groupName?: string
  onOpenBulletin: (studentId?: string) => void
  onOpenIndicatorsReport: (studentId: string, studentName: string) => void
  onOpenSchoolRecord: (studentId: string, studentName: string) => void
}) {
  const [mode, setMode] = useState<'menu' | 'indicators' | 'record' | 'student-bulletin'>(
    'menu',
  )

  if (mode !== 'menu') {
    const title =
      mode === 'indicators'
        ? 'Informe de indicadores'
        : mode === 'record'
          ? 'Registro escolar'
          : 'Boletín de un estudiante'
    const onPick =
      mode === 'indicators'
        ? onOpenIndicatorsReport
        : mode === 'record'
          ? onOpenSchoolRecord
          : (id: string) => onOpenBulletin(id)
    return (
      <div className="p-4 space-y-2">
        <button
          type="button"
          onClick={() => setMode('menu')}
          className="text-xs font-semibold text-blue-600 hover:underline"
        >
          ← Volver a informes
        </button>
        <p className="text-xs text-slate-400 mb-2">{title} · Elige un estudiante</p>
        {enrollments.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => onPick(e.student, e.student_name)}
            className="w-full text-left bg-white rounded-xl border border-slate-200 flex items-center px-3.5 py-3 gap-3 hover:border-slate-300"
          >
            <Avatar name={e.student_name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {e.student_name}
              </p>
              <p className="font-mono text-xs text-slate-400">
                {e.student_document_number}
              </p>
            </div>
            <IconChevronRight size={16} />
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      <Card className="divide-y divide-slate-100">
        <button
          type="button"
          onClick={() => onOpenBulletin()}
          className="w-full flex items-center px-4 py-3.5 gap-3 hover:bg-slate-50 transition-colors"
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600">
            <IconDocument size={18} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-slate-900">Boletín del grupo</p>
            <p className="text-xs text-slate-500">
              PDF · {groupName ?? 'Grupo'}
              {periodName ? ` · ${periodName}` : ''}
            </p>
          </div>
          <IconChevronRight size={16} />
        </button>
        <button
          type="button"
          onClick={() => setMode('student-bulletin')}
          className="w-full flex items-center px-4 py-3.5 gap-3 hover:bg-slate-50 transition-colors"
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600">
            <IconDocument size={18} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-slate-900">Boletín de un estudiante</p>
            <p className="text-xs text-slate-500">PDF individual</p>
          </div>
          <IconChevronRight size={16} />
        </button>
        <button
          type="button"
          onClick={() => setMode('indicators')}
          className="w-full flex items-center px-4 py-3.5 gap-3 hover:bg-slate-50 transition-colors"
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600">
            <IconDocument size={18} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-slate-900">Informe de indicadores</p>
            <p className="text-xs text-slate-500">
              Por estudiante{periodName ? ` · ${periodName}` : ''}
            </p>
          </div>
          <IconChevronRight size={16} />
        </button>
        <button
          type="button"
          onClick={() => setMode('record')}
          className="w-full flex items-center px-4 py-3.5 gap-3 hover:bg-slate-50 transition-colors"
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-50 text-amber-600">
            <IconDocument size={18} />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-slate-900">Registro escolar</p>
            <p className="text-xs text-slate-500">
              Anual{year ? ` · ${year}` : ''}
            </p>
          </div>
          <IconChevronRight size={16} />
        </button>
      </Card>
    </div>
  )
}
