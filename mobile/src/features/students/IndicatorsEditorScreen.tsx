import { useEffect, useMemo, useState } from 'react'

import { getErrorMessage } from '@/api/errors'
import {
  Avatar,
  Card,
  EmptyState,
  IconBook,
  IconCheck,
  IconPencil,
  LevelChip,
  SectionHeader,
  WriteError,
} from '@/components'
import type { Course } from '@/data'
import { formatScoreDisplay } from '@/features/grading/activityStatus'
import { useGradesQuery } from '@/features/grades/gradesApi'
import { levelFromGrade } from '@/features/grades/scaleUtils'
import { useAcademicIndicatorCatalogsQuery } from '@/features/students/academicIndicatorCatalogsApi'
import {
  useAcademicIndicatorsQuery,
  useCreateAcademicIndicatorMutation,
  usePatchAcademicIndicatorMutation,
} from '@/features/students/academicIndicatorsApi'
import { useActiveEnrollmentsQuery } from '@/features/students/enrollmentsApi'
import {
  catalogTextForOutcome,
  outcomeFromGrade,
  outcomeLabel,
  performanceLevelText,
  pickCatalog,
  pickIndicatorForCourse,
  type IndicatorOutcome,
} from '@/features/students/indicatorUtils'
import { documentLabel } from '@/features/students/studentUtils'
import {
  useSessionCourse,
  useTeacherSession,
} from '@/session/TeacherSessionContext'
import type { AcademicIndicatorRequest, Enrollment } from '@/types/schemas'

export interface IndicatorsEditorProps {
  studentId: string
  courseId?: string
  onBack: () => void
}

function sortEnrollments(rows: Enrollment[]): Enrollment[] {
  return [...rows].sort((a, b) => a.student_name.localeCompare(b.student_name, 'es'))
}

export function IndicatorsEditorScreen({
  studentId: initialStudentId,
  courseId,
  onBack,
}: IndicatorsEditorProps) {
  const session = useTeacherSession()
  const periodId = session.selectedPeriodId
  const period = session.periods.find((p) => p.id === periodId)
  const courseFromProp = useSessionCourse(courseId ?? '')
  const [studentId, setStudentId] = useState(initialStudentId)
  const [pickedCourseId, setPickedCourseId] = useState(courseId ?? '')

  const studentEnrollmentQuery = useActiveEnrollmentsQuery(
    session.academicYear
      ? { student: studentId, academic_year: session.academicYear.id }
      : null,
  )
  const studentGroupId =
    studentEnrollmentQuery.data?.[0]?.group ?? courseFromProp?.groupId

  const courseCandidates = useMemo(() => {
    if (courseFromProp) return [courseFromProp]
    return session.courses.filter(
      (c) => !studentGroupId || c.groupId === studentGroupId,
    )
  }, [courseFromProp, session.courses, studentGroupId])

  const course: Course | undefined =
    courseCandidates.find((c) => c.id === pickedCourseId) ?? courseCandidates[0]

  useEffect(() => {
    if (course && pickedCourseId !== course.id) setPickedCourseId(course.id)
  }, [course, pickedCourseId])

  const enrollmentsQuery = useActiveEnrollmentsQuery(
    course?.groupId && session.academicYear
      ? { group: course.groupId, academic_year: session.academicYear.id }
      : null,
  )
  const enrollments = useMemo(
    () => sortEnrollments(enrollmentsQuery.data ?? []),
    [enrollmentsQuery.data],
  )
  const currentEnrollment =
    enrollments.find((e) => e.student === studentId) ??
    studentEnrollmentQuery.data?.[0]

  const catalogsQuery = useAcademicIndicatorCatalogsQuery(
    course?.subjectAcademicAreaId && course.groupGradeLevelId
      ? {
          academic_area: course.subjectAcademicAreaId,
          grade_level: course.groupGradeLevelId,
        }
      : session.me.institution_id
        ? { academic_area__institution: session.me.institution_id }
        : null,
  )
  const catalog = pickCatalog(
    catalogsQuery.data ?? [],
    course?.subjectAcademicAreaId,
    course?.groupGradeLevelId,
    period?.number,
  )

  const indicatorsQuery = useAcademicIndicatorsQuery(
    periodId
      ? { student: studentId, academic_period: periodId }
      : { student: studentId },
  )
  const existing = pickIndicatorForCourse(
    indicatorsQuery.data ?? [],
    course?.id ?? '',
    periodId ?? '',
  )

  const gradesQuery = useGradesQuery(
    course && periodId
      ? {
          student: studentId,
          course_assignment: course.id,
          academic_period: periodId,
        }
      : null,
  )
  const grade = gradesQuery.data?.[0]
  const inferredOutcome = outcomeFromGrade(grade, session.gradingScales)
  const level = grade ? levelFromGrade(grade, session.gradingScales) : null

  const createMutation = useCreateAcademicIndicatorMutation()
  const patchMutation = usePatchAcademicIndicatorMutation()

  const [outcome, setOutcome] = useState<IndicatorOutcome | ''>('')
  const [description, setDescription] = useState('')
  const [dirty, setDirty] = useState(false)
  const [formError, setFormError] = useState('')
  const [writeFailed, setWriteFailed] = useState(false)
  const [savedOk, setSavedOk] = useState(false)

  useEffect(() => {
    setDirty(false)
    setFormError('')
    setWriteFailed(false)
    setSavedOk(false)
  }, [studentId, course?.id, periodId])

  useEffect(() => {
    if (dirty) return
    if (existing) {
      const existingOutcome =
        existing.outcome === 'below_basic' || existing.outcome === 'basic_or_above'
          ? existing.outcome
          : inferredOutcome ?? ''
      setOutcome(existingOutcome)
      setDescription(existing.description ?? '')
      return
    }
    const nextOutcome = inferredOutcome ?? ''
    setOutcome(nextOutcome)
    setDescription(
      nextOutcome ? catalogTextForOutcome(catalog, nextOutcome) : '',
    )
  }, [dirty, existing, inferredOutcome, catalog])

  const idx = enrollments.findIndex((e) => e.student === studentId)
  const prev = idx > 0 ? enrollments[idx - 1] : null
  const next = idx >= 0 && idx < enrollments.length - 1 ? enrollments[idx + 1] : null

  function applyOutcome(nextOutcome: IndicatorOutcome) {
    const prevText = catalogTextForOutcome(catalog, outcome || null)
    const wasCatalog = description.trim() === prevText.trim() || description.trim() === ''
    setOutcome(nextOutcome)
    setDirty(true)
    setSavedOk(false)
    if (wasCatalog) {
      setDescription(catalogTextForOutcome(catalog, nextOutcome))
    }
  }

  async function handleSave() {
    if (!course || !periodId) {
      setWriteFailed(false)
      setFormError('Falta el curso o el periodo.')
      return
    }
    const text = description.trim()
    if (!text) {
      setWriteFailed(false)
      setFormError('Escribe el logro o elige un resultado del catálogo.')
      return
    }
    const catalogText = catalogTextForOutcome(catalog, outcome || null)
    const matchesCatalog = Boolean(catalog && outcome && text === catalogText.trim())
    const body: AcademicIndicatorRequest = {
      student: studentId,
      course_assignment: course.id,
      academic_period: periodId,
      catalog: matchesCatalog ? catalog?.id ?? null : null,
      outcome: outcome || '',
      description: text,
      numerical_grade: grade?.numerical_grade ?? null,
      performance_level: performanceLevelText(grade, session.gradingScales),
    }
    setFormError('')
    setWriteFailed(false)
    try {
      if (existing) {
        await patchMutation.mutateAsync({ id: existing.id, body })
      } else {
        await createMutation.mutateAsync(body)
      }
      setDirty(false)
      setSavedOk(true)
    } catch (err) {
      setWriteFailed(true)
      setFormError(getErrorMessage(err, 'No se pudo guardar el logro.'))
    }
  }

  const busy = createMutation.isPending || patchMutation.isPending
  const studentName = currentEnrollment?.student_name ?? 'Estudiante'
  const subtitle = [
    course ? `${course.subject_name} · ${course.group_name}` : null,
    period?.name,
  ]
    .filter(Boolean)
    .join(' · ')

  if (!course && courseCandidates.length === 0 && !studentEnrollmentQuery.isLoading) {
    return (
      <div className="flex flex-col h-full bg-[#F1F5F9]">
        <SectionHeader title="Logro" onBack={onBack} />
        <EmptyState
          icon={<IconBook size={24} />}
          title="Sin asignatura"
          body="No hay un curso tuyo vinculado a este estudiante para redactar el logro."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9]">
      <SectionHeader title="Logro del periodo" subtitle={subtitle} onBack={onBack} />

      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          disabled={!prev}
          onClick={() => prev && setStudentId(prev.student)}
          className="w-9 h-9 rounded-full text-slate-600 hover:bg-slate-100 disabled:opacity-30"
        >
          ‹
        </button>
        <Avatar name={studentName} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{studentName}</p>
          <p className="text-xs text-slate-500 truncate">
            {currentEnrollment
              ? documentLabel(
                  undefined,
                  currentEnrollment.student_document_number,
                )
              : '—'}
          </p>
        </div>
        <button
          type="button"
          disabled={!next}
          onClick={() => next && setStudentId(next.student)}
          className="w-9 h-9 rounded-full text-slate-600 hover:bg-slate-100 disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {courseCandidates.length > 1 && !courseId && (
          <select
            value={course?.id ?? ''}
            onChange={(e) => {
              setPickedCourseId(e.target.value)
              setDirty(false)
            }}
            className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm bg-white"
          >
            {courseCandidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.subject_name} · {c.group_name}
              </option>
            ))}
          </select>
        )}

        <Card className="p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Nota del periodo
          </p>
          {gradesQuery.isLoading ? (
            <p className="text-xs text-slate-400">Cargando nota…</p>
          ) : grade ? (
            <div className="flex items-center gap-3">
              <p className="font-mono text-2xl font-bold text-slate-800">
                {formatScoreDisplay(grade.numerical_grade)}
              </p>
              {level && <LevelChip level={level} />}
              <p className="text-xs text-slate-400">
                Tras tener nota oficial se sugiere el resultado del catálogo.
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Aún no hay nota oficial. Elige el resultado a mano o escribe el logro libre.
            </p>
          )}
        </Card>

        <Card className="p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Resultado
          </p>
          <div className="grid grid-cols-2 gap-2">
            <OutcomeButton
              active={outcome === 'below_basic'}
              label="Por debajo de básico"
              onClick={() => applyOutcome('below_basic')}
            />
            <OutcomeButton
              active={outcome === 'basic_or_above'}
              label="Básico o superior"
              onClick={() => applyOutcome('basic_or_above')}
            />
          </div>
          {catalog ? (
            <p className="text-[11px] text-slate-400">
              Catálogo {catalog.period_label || catalog.grade_level_name}. Toca un resultado para
              rellenar; puedes editar el tono antes de guardar.
            </p>
          ) : (
            <p className="text-[11px] text-slate-400">
              No hay catálogo para esta área y grado. Escribe el párrafo a mano.
            </p>
          )}
        </Card>

        {catalog && (
          <Card className="p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Textos del catálogo
            </p>
            <div>
              <p className="text-[11px] font-semibold text-red-700 mb-1">Bajo</p>
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                {catalog.achievement_below_basic}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-emerald-700 mb-1">
                Básico o superior
              </p>
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                {catalog.achievement_basic_or_above}
              </p>
            </div>
          </Card>
        )}

        <Card className="p-4 space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Párrafo del logro
          </p>
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              setDirty(true)
              setSavedOk(false)
            }}
            rows={7}
            placeholder="Texto que verá el acudiente en el informe…"
            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-400 resize-none leading-relaxed"
          />
          {outcome && (
            <p className="text-[11px] text-slate-400">
              Vista previa · {outcomeLabel(outcome)}
            </p>
          )}
        </Card>

        {formError && (
          <WriteError
            message={formError}
            onRetry={writeFailed ? () => void handleSave() : undefined}
            disabled={busy}
          />
        )}
        {savedOk && (
          <p className="text-xs text-emerald-700 flex items-center gap-1">
            <IconCheck size={12} /> Logro guardado
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={busy || !periodId || !course}
          className="w-full h-11 rounded-xl bg-[#1E3A5F] text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          <IconPencil size={14} />
          {busy ? 'Guardando…' : existing ? 'Guardar cambios' : 'Guardar logro'}
        </button>
      </div>
    </div>
  )
}

function OutcomeButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[44px] rounded-xl border text-xs font-semibold px-2 py-2 ${
        active
          ? 'bg-[#1E3A5F] text-white border-transparent'
          : 'bg-white text-slate-700 border-slate-200'
      }`}
    >
      {label}
    </button>
  )
}
