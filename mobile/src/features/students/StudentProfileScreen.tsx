import { useMemo, useState } from 'react'

import { getErrorMessage, isNotFoundError } from '@/api/errors'
import {
  Avatar,
  Card,
  EmptyState,
  IconBook,
  IconPencil,
  LevelChip,
  Pill,
  SectionHeader,
} from '@/components'
import { formatScoreDisplay } from '@/features/grading/activityStatus'
import { useAttendancesQuery } from '@/features/attendance/attendancesApi'
import { useGradesQuery } from '@/features/grades/gradesApi'
import { levelFromGrade } from '@/features/grades/scaleUtils'
import { useAcademicIndicatorsQuery } from '@/features/students/academicIndicatorsApi'
import { useDisciplinaryReportsQuery } from '@/features/students/disciplinaryReportsApi'
import { useEnrollmentsQuery } from '@/features/students/enrollmentsApi'
import { useStudentGuardiansQuery } from '@/features/students/studentGuardiansApi'
import {
  documentLabel,
  enrollmentStatusLabel,
  mailtoHref,
  telHref,
} from '@/features/students/studentUtils'
import {
  useStudentGradesSummaryQuery,
  useStudentQuery,
} from '@/features/students/studentsApi'
import { useTeacherSession } from '@/session/TeacherSessionContext'
import type { Attendance, Enrollment, Grade } from '@/types/schemas'

export interface StudentProfileProps {
  studentId: string
  courseId?: string
  onBack: () => void
  onEditIndicator?: (studentId: string, courseId?: string) => void
}

type StudentProfileTab = 'grades' | 'attendance' | 'indicators' | 'disciplinary' | 'family'

const TABS: { id: StudentProfileTab; label: string }[] = [
  { id: 'grades', label: 'Notas' },
  { id: 'attendance', label: 'Asistencia' },
  { id: 'indicators', label: 'Logros' },
  { id: 'disciplinary', label: 'Convivencia' },
  { id: 'family', label: 'Familia' },
]

function pickEnrollment(rows: Enrollment[]): Enrollment | undefined {
  return rows.find((e) => e.status === 'active') ?? rows[0]
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

function outcomeLabel(outcome: string | null | undefined): string | null {
  if (outcome === 'below_basic') return 'Por debajo de básico'
  if (outcome === 'basic_or_above') return 'Básico o superior'
  return null
}

function statusPillColor(
  status: Enrollment['status'],
): 'green' | 'amber' | 'blue' | 'default' {
  if (status === 'active') return 'green'
  if (status === 'withdrawn') return 'amber'
  if (status === 'graduated') return 'blue'
  return 'default'
}

export function StudentProfileScreen({
  studentId,
  courseId,
  onBack,
  onEditIndicator,
}: StudentProfileProps) {
  const session = useTeacherSession()
  const periodId = session.selectedPeriodId
  const period = session.periods.find((p) => p.id === periodId)
  const course = session.courses.find((c) => c.id === courseId)
  const [tab, setTab] = useState<StudentProfileTab>('grades')

  const studentQuery = useStudentQuery(studentId)
  const enrollmentQuery = useEnrollmentsQuery(
    session.academicYear
      ? { student: studentId, academic_year: session.academicYear.id }
      : null,
  )
  const summaryQuery = useStudentGradesSummaryQuery(studentId)
  const gradesQuery = useGradesQuery({ student: studentId })
  const attendancesQuery = useAttendancesQuery(
    periodId ? { student: studentId, academic_period: periodId } : null,
  )
  const indicatorsQuery = useAcademicIndicatorsQuery(
    periodId ? { student: studentId, academic_period: periodId } : null,
  )
  const reportsQuery = useDisciplinaryReportsQuery(
    periodId ? { student: studentId, academic_period: periodId } : null,
  )
  const guardiansQuery = useStudentGuardiansQuery(studentId)

  const student = studentQuery.data
  const enrollment = pickEnrollment(enrollmentQuery.data ?? [])
  const headerError = studentQuery.error
  const outOfScope = isNotFoundError(headerError)

  const subtitle = student
    ? `${documentLabel(student.document_type, student.document_number)}${
        enrollment
          ? ` · Matrícula ${enrollmentStatusLabel(enrollment.status).toLowerCase()}`
          : ''
      }`
    : undefined

  if (studentQuery.isLoading || studentQuery.isPending) {
    return (
      <div className="flex flex-col h-full bg-[#F1F5F9]">
        <SectionHeader title="Estudiante" onBack={onBack} />
        <p className="text-sm text-slate-400 text-center py-10">Cargando ficha…</p>
      </div>
    )
  }

  if (outOfScope || !student) {
    return (
      <div className="flex flex-col h-full bg-[#F1F5F9]">
        <SectionHeader title="Estudiante" onBack={onBack} />
        <EmptyState
          icon={<IconBook size={24} />}
          title="Fuera de tu alcance"
          body={
            outOfScope
              ? 'Este estudiante no está en tus cursos. La API no lo expone.'
              : getErrorMessage(headerError, 'No se pudo cargar la ficha.')
          }
        />
      </div>
    )
  }

  const extras = [
    student.stratum ? `Estrato ${student.stratum}` : null,
    student.sisben ? `SISBEN ${student.sisben}` : null,
    student.disability ? student.disability : null,
    student.health_insurer ? student.health_insurer : null,
  ].filter(Boolean) as string[]

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9]">
      <SectionHeader title={student.full_name} subtitle={subtitle} onBack={onBack} />

      <div className="bg-white border-b border-slate-200 px-4 py-4">
        <div className="flex items-center gap-4 mb-3">
          <Avatar name={student.full_name} size="lg" />
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 truncate">{student.full_name}</p>
            <p className="text-xs text-slate-500">
              {[enrollment?.group_name, enrollment?.campus_name]
                .filter(Boolean)
                .join(' · ') || 'Sin matrícula en este año'}
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {enrollment && (
                <Pill color={statusPillColor(enrollment.status)}>
                  {enrollmentStatusLabel(enrollment.status)}
                </Pill>
              )}
              {student.phone?.trim() && (
                <a
                  href={telHref(student.phone)}
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  Llamar
                </a>
              )}
            </div>
          </div>
        </div>
        {extras.length > 0 && (
          <p className="text-[11px] text-slate-400 mb-3">{extras.join(' · ')}</p>
        )}

        <div className="flex gap-1 -mx-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2 text-[11px] font-semibold rounded-lg transition-colors ${
                tab === t.id
                  ? 'bg-[#EBF2FB] text-[#1E3A5F]'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {tab === 'grades' && (
          <GradesTab
            studentId={studentId}
            courseId={courseId}
            courseLabel={
              course
                ? `${period?.name ?? 'Periodo'} — ${course.subject_name} ${course.group_name}`
                : period?.name ?? 'Periodo'
            }
            periodId={periodId}
            grades={gradesQuery.data ?? []}
            gradesLoading={gradesQuery.isLoading}
            gradesError={gradesQuery.error}
            summary={summaryQuery.data}
            summaryLoading={summaryQuery.isLoading}
            summaryError={summaryQuery.error}
          />
        )}
        {tab === 'attendance' && (
          <AttendanceTab
            periodName={period?.shortName ?? period?.name ?? 'Periodo'}
            rows={attendancesQuery.data ?? []}
            loading={attendancesQuery.isLoading}
            error={attendancesQuery.error}
          />
        )}
        {tab === 'indicators' && (
          <IndicatorsTab
            periodName={period?.shortName ?? period?.name ?? 'Periodo'}
            rows={indicatorsQuery.data ?? []}
            loading={indicatorsQuery.isLoading}
            error={indicatorsQuery.error}
            onEditIndicator={
              onEditIndicator ? () => onEditIndicator(studentId, courseId) : undefined
            }
          />
        )}
        {tab === 'disciplinary' && (
          <DisciplinaryTab
            periodName={period?.shortName ?? period?.name ?? 'Periodo'}
            rows={reportsQuery.data ?? []}
            loading={reportsQuery.isLoading}
            error={reportsQuery.error}
          />
        )}
        {tab === 'family' && (
          <FamilyTab
            studentPhone={student.phone}
            rows={guardiansQuery.data ?? []}
            loading={guardiansQuery.isLoading}
            error={guardiansQuery.error}
          />
        )}
      </div>
    </div>
  )
}

function GradesTab({
  studentId,
  courseId,
  courseLabel,
  periodId,
  grades,
  gradesLoading,
  gradesError,
  summary,
  summaryLoading,
  summaryError,
}: {
  studentId: string
  courseId?: string
  courseLabel: string
  periodId: string | null
  grades: Grade[]
  gradesLoading: boolean
  gradesError: unknown
  summary: ReturnType<typeof useStudentGradesSummaryQuery>['data']
  summaryLoading: boolean
  summaryError: unknown
}) {
  const session = useTeacherSession()
  const periodGrades = useMemo(
    () =>
      grades.filter((g) => !periodId || g.academic_period === periodId),
    [grades, periodId],
  )
  const highlight =
    periodGrades.find((g) => g.course_assignment === courseId) ??
    periodGrades[0]
  const highlightLevel = highlight
    ? levelFromGrade(highlight, session.gradingScales)
    : null

  const periods = summary?.grades_by_period ?? []

  if (gradesLoading && summaryLoading) {
    return <p className="text-sm text-slate-400 text-center py-6">Cargando notas…</p>
  }
  if (gradesError && summaryError) {
    return (
      <p className="text-sm text-red-600 text-center py-4">
        {getErrorMessage(gradesError, 'No se pudieron cargar las notas.')}
      </p>
    )
  }

  return (
    <>
      <Card className="p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          {courseLabel}
        </p>
        {highlight ? (
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="font-mono text-2xl font-bold text-slate-800">
                {formatScoreDisplay(highlight.numerical_grade)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Nota oficial</p>
            </div>
            <div>
              {highlightLevel ? (
                <LevelChip level={highlightLevel} />
              ) : (
                <p className="font-mono text-2xl font-bold text-slate-300">—</p>
              )}
              <p className="text-xs text-slate-500 mt-1">Nivel</p>
            </div>
            <div>
              <p
                className={`font-mono text-2xl font-bold ${
                  highlight.definitive_grade ? 'text-slate-800' : 'text-slate-300'
                }`}
              >
                {formatScoreDisplay(highlight.definitive_grade)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Definitiva</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center py-2">
            Aún no hay nota oficial en este periodo.
          </p>
        )}
      </Card>

      {periodGrades.length > 1 && (
        <Card className="divide-y divide-slate-100">
          {periodGrades.map((g) => {
            const level = levelFromGrade(g, session.gradingScales)
            return (
              <div key={g.id} className="flex items-center px-4 py-3 gap-3">
                <span className="text-xs font-medium text-slate-700 flex-1 min-w-0 truncate">
                  {g.course_assignment_subject_name}
                </span>
                <span className="font-mono text-sm font-semibold text-slate-700">
                  {formatScoreDisplay(g.numerical_grade)}
                </span>
                {level && <LevelChip level={level} compact />}
              </div>
            )
          })}
        </Card>
      )}

      {periods.length > 0 && (
        <Card className="divide-y divide-slate-100">
          {periods.map((block) => {
            const sessionPeriod = session.periods.find(
              (p) => p.id === block.period.id,
            )
            const short = sessionPeriod?.shortName ?? block.period.name
            return (
              <div key={block.period.id} className="flex items-center px-4 py-3 gap-3">
                <span className="text-xs font-semibold text-slate-500 w-10 shrink-0">
                  {short}
                </span>
                <span className="text-xs text-slate-400 flex-1 truncate">
                  {block.grades.length} asig.
                </span>
                <span className="font-mono text-sm font-semibold text-slate-700">
                  {block.average != null ? block.average.toFixed(2) : '—'}
                </span>
              </div>
            )
          })}
        </Card>
      )}
      {studentId && periods.length === 0 && !summaryLoading && !highlight && (
        <p className="text-xs text-slate-400 text-center">
          No hay resumen de notas para este estudiante.
        </p>
      )}
    </>
  )
}

function AttendanceTab({
  periodName,
  rows,
  loading,
  error,
}: {
  periodName: string
  rows: Attendance[]
  loading: boolean
  error: unknown
}) {
  if (loading) {
    return <p className="text-sm text-slate-400 text-center py-6">Cargando asistencia…</p>
  }
  if (error) {
    return (
      <p className="text-sm text-red-600 text-center py-4">
        {getErrorMessage(error, 'No se pudo cargar la asistencia.')}
      </p>
    )
  }

  const general = rows.find((r) => r.is_general) ?? rows[0]
  const bySubject = rows.filter((r) => !r.is_general)
  const ce = general?.excused_absences ?? 0
  const se = general?.unexcused_absences ?? 0

  if (!general && bySubject.length === 0) {
    return (
      <EmptyState
        icon={<IconBook size={24} />}
        title="Sin acumulado"
        body={`No hay filas de asistencia para ${periodName}.`}
      />
    )
  }

  return (
    <>
      <Card className="p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Acumulado {periodName}
          {general?.is_general ? ' · General' : ''}
        </p>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div>
            <p className="font-mono text-2xl font-bold text-amber-600">{ce}</p>
            <p className="text-xs text-slate-500 mt-0.5">Con excusa</p>
          </div>
          <div>
            <p className="font-mono text-2xl font-bold text-red-600">{se}</p>
            <p className="text-xs text-slate-500 mt-0.5">Sin excusa</p>
          </div>
        </div>
      </Card>
      {bySubject.length > 0 && (
        <Card className="divide-y divide-slate-100">
          {bySubject.map((row) => (
            <div key={row.id} className="flex items-center px-4 py-3 gap-3">
              <span className="text-xs font-medium text-slate-700 flex-1 min-w-0 truncate">
                {row.subject_name ?? 'Asignatura'}
              </span>
              {(row.excused_absences ?? 0) > 0 && (
                <span className="font-mono text-xs px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200">
                  {row.excused_absences} CE
                </span>
              )}
              {(row.unexcused_absences ?? 0) > 0 && (
                <span className="font-mono text-xs px-2 py-1 rounded bg-red-50 text-red-700 border border-red-200">
                  {row.unexcused_absences} SE
                </span>
              )}
              {(row.excused_absences ?? 0) === 0 &&
                (row.unexcused_absences ?? 0) === 0 && (
                  <span className="text-xs text-slate-400">0</span>
                )}
            </div>
          ))}
        </Card>
      )}
    </>
  )
}

function IndicatorsTab({
  periodName,
  rows,
  loading,
  error,
  onEditIndicator,
}: {
  periodName: string
  rows: ReturnType<typeof useAcademicIndicatorsQuery>['data']
  loading: boolean
  error: unknown
  onEditIndicator?: () => void
}) {
  if (loading) {
    return <p className="text-sm text-slate-400 text-center py-6">Cargando logros…</p>
  }
  if (error) {
    return (
      <p className="text-sm text-red-600 text-center py-4">
        {getErrorMessage(error, 'No se pudieron cargar los logros.')}
      </p>
    )
  }
  if (!rows || rows.length === 0) {
    return (
      <div className="space-y-3">
        <EmptyState
          icon={<IconPencil size={24} />}
          title="Sin logros en este periodo"
          body={`No hay indicadores cualitativos para ${periodName}. Redacta el logro a partir del catálogo o en texto libre.`}
        />
        {onEditIndicator && (
          <button
            type="button"
            onClick={onEditIndicator}
            className="w-full h-11 rounded-xl bg-[#1E3A5F] text-white text-sm font-semibold"
          >
            Redactar logro
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      {rows.map((row) => {
        const outcome = outcomeLabel(
          typeof row.outcome === 'string' ? row.outcome : null,
        )
        return (
          <Card key={row.id} className="p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              {row.catalog_label || 'Indicador cualitativo'} · {periodName}
            </p>
            {outcome && (
              <p className="text-[11px] text-slate-400 mb-2">{outcome}</p>
            )}
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {row.description?.trim() || 'Sin descripción.'}
            </p>
            <button
              type="button"
              onClick={onEditIndicator}
              disabled={!onEditIndicator}
              className={`mt-3 flex items-center gap-1.5 text-xs font-semibold ${
                onEditIndicator ? 'text-blue-700' : 'text-slate-400 cursor-not-allowed'
              }`}
            >
              <IconPencil size={12} /> Editar logro
            </button>
          </Card>
        )
      })}
    </>
  )
}

function DisciplinaryTab({
  periodName,
  rows,
  loading,
  error,
}: {
  periodName: string
  rows: ReturnType<typeof useDisciplinaryReportsQuery>['data']
  loading: boolean
  error: unknown
}) {
  if (loading) {
    return (
      <p className="text-sm text-slate-400 text-center py-6">Cargando convivencia…</p>
    )
  }
  if (error) {
    return (
      <p className="text-sm text-red-600 text-center py-4">
        {getErrorMessage(error, 'No se pudieron cargar los reportes.')}
      </p>
    )
  }
  if (!rows || rows.length === 0) {
    return (
      <EmptyState
        icon={<IconPencil size={24} />}
        title="Sin reportes"
        body={`No hay bitácora de convivencia en ${periodName}.`}
      />
    )
  }

  return (
    <>
      {rows.map((row) => (
        <Card key={row.id} className="p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs font-semibold text-slate-800">
              {row.created_by_name || 'Docente'}
            </p>
            <p className="text-[10px] text-slate-400">
              {formatReportDate(row.created_at)}
            </p>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {row.report_text?.trim() || 'Sin texto.'}
          </p>
        </Card>
      ))}
    </>
  )
}

function FamilyTab({
  studentPhone,
  rows,
  loading,
  error,
}: {
  studentPhone?: string
  rows: ReturnType<typeof useStudentGuardiansQuery>['data']
  loading: boolean
  error: unknown
}) {
  if (loading) {
    return <p className="text-sm text-slate-400 text-center py-6">Cargando familia…</p>
  }
  if (error) {
    return (
      <p className="text-sm text-red-600 text-center py-4">
        {getErrorMessage(error, 'No se pudieron cargar los acudientes.')}
      </p>
    )
  }

  const phone = studentPhone?.trim()

  return (
    <>
      {phone && (
        <Card className="divide-y divide-slate-100">
          <div className="px-4 py-3.5">
            <p className="text-xs text-slate-500 mb-0.5">Teléfono del estudiante</p>
            <a href={telHref(phone)} className="text-sm font-semibold text-blue-600">
              {phone}
            </a>
          </div>
        </Card>
      )}
      {(!rows || rows.length === 0) && (
        <EmptyState
          icon={<IconBook size={24} />}
          title="Sin acudientes"
          body="No hay padres o acudientes vinculados a este estudiante."
        />
      )}
      {rows?.map(({ guardian, parent }) => {
        const name = parent?.full_name || guardian.parent_name
        const kinship = parent?.kinship?.trim()
        const doc = parent
          ? documentLabel(parent.document_type, parent.document_number)
          : null
        const parentPhone = parent?.phone?.trim()
        const email = parent?.email?.trim()
        return (
          <Card key={guardian.id} className="divide-y divide-slate-100">
            <div className="px-4 py-3.5">
              <p className="text-xs text-slate-500 mb-0.5">
                {guardian.is_primary ? 'Acudiente principal' : 'Acudiente'}
              </p>
              <p className="text-sm font-semibold text-slate-900">{name}</p>
              {(kinship || doc) && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {[kinship, doc].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            {parentPhone && (
              <div className="px-4 py-3.5">
                <p className="text-xs text-slate-500 mb-0.5">Teléfono</p>
                <a
                  href={telHref(parentPhone)}
                  className="text-sm font-semibold text-blue-600"
                >
                  {parentPhone}
                </a>
              </div>
            )}
            {email && (
              <div className="px-4 py-3.5">
                <p className="text-xs text-slate-500 mb-0.5">Correo</p>
                <a
                  href={mailtoHref(email)}
                  className="text-sm font-semibold text-blue-600 break-all"
                >
                  {email}
                </a>
              </div>
            )}
          </Card>
        )
      })}
    </>
  )
}
