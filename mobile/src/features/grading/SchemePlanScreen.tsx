import { useMemo, useState } from 'react'

import { getErrorMessage } from '@/api/errors'
import {
  Card,
  EmptyState,
  IconAlert,
  IconBook,
  IconCheck,
  IconClipboard,
  IconPencil,
  IconPlus,
  SectionHeader,
  WriteError,
} from '@/components'
import { formatShortDate, todayIso } from '@/session/periodUtils'
import {
  useSessionCourse,
  useTeacherSession,
} from '@/session/TeacherSessionContext'
import {
  schemeWeightsValid,
  useCourseActivitiesBundle,
  useCreateComponentSegmentMutation,
  useCreateGradingActivityMutation,
  useCreateGradingSchemeMutation,
  useDeleteComponentSegmentMutation,
  useDeleteGradingActivityMutation,
  usePatchComponentSegmentMutation,
  usePatchGradingActivityMutation,
  useValidateWeightsQuery,
  type ComponentSegment,
  type EnrichedActivity,
  type GradingActivity,
  type SubjectComponent,
} from '@/features/grading/gradingApi'
import {
  SEGMENT_TEMPLATES,
  WEIGHT_SUM_TOLERANCE,
  activitiesByDate,
  addMonths,
  calendarGridDays,
  dateToIso,
  formatMonthYear,
  formatWeight,
  parseWeightPercent,
  remainingWeightForComponent,
  segmentWeightTotal,
} from '@/features/grading/planUtils'

export interface SchemePlanProps {
  courseId: string
  onBack: () => void
}

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

type SegmentForm = {
  componentId: string
  editingId: string | null
  name: string
  weight: string
}

type ActivityForm = {
  segmentId: string
  editing: GradingActivity | null
  name: string
  date: string
  maxScore: string
}

function WeightBar({ total }: { total: number }) {
  const pct = Math.min(100, Math.max(0, total))
  const ok = Math.abs(total - 100) <= WEIGHT_SUM_TOLERANCE
  const over = total > 100 + WEIGHT_SUM_TOLERANCE
  const bar =
    ok ? 'bg-emerald-500' : over ? 'bg-red-500' : 'bg-amber-400'
  return (
    <div className="space-y-1">
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <p className={`text-[11px] font-mono ${ok ? 'text-emerald-700' : over ? 'text-red-600' : 'text-amber-700'}`}>
        {formatWeight(total)}% / 100%
      </p>
    </div>
  )
}

export function SchemePlanScreen({ courseId, onBack }: SchemePlanProps) {
  const course = useSessionCourse(courseId)
  const session = useTeacherSession()
  const periodId = session.selectedPeriodId
  const period = session.periods.find((p) => p.id === periodId)

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
  const components = bundleQuery.data?.components ?? []
  const segments = bundleQuery.data?.segments ?? []
  const activities = bundleQuery.data?.activities ?? []
  const weightsQuery = useValidateWeightsQuery(scheme?.id)
  const weightsOk =
    Boolean(weightsQuery.data?.valid) || schemeWeightsValid(scheme)

  const createScheme = useCreateGradingSchemeMutation()
  const createSegment = useCreateComponentSegmentMutation()
  const patchSegment = usePatchComponentSegmentMutation()
  const deleteSegment = useDeleteComponentSegmentMutation()
  const createActivity = useCreateGradingActivityMutation()
  const patchActivity = usePatchGradingActivityMutation()
  const deleteActivity = useDeleteGradingActivityMutation()

  const [phoneTab, setPhoneTab] = useState<'estructura' | 'calendario'>('estructura')
  const [openComponentId, setOpenComponentId] = useState<string | null>(null)
  const [segmentForm, setSegmentForm] = useState<SegmentForm | null>(null)
  const [activityForm, setActivityForm] = useState<ActivityForm | null>(null)
  const [viewMonth, setViewMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')

  const byDate = useMemo(() => activitiesByDate(activities), [activities])
  const gridDays = useMemo(() => calendarGridDays(viewMonth), [viewMonth])

  if (!course) {
    return (
      <div className="flex flex-col h-full bg-[#F1F5F9]">
        <SectionHeader title="Plan" onBack={onBack} />
        <EmptyState
          icon={<IconBook size={24} />}
          title="Curso no encontrado"
          body="Esa asignación ya no está en tu lista."
        />
      </div>
    )
  }

  const busy =
    createScheme.isPending ||
    createSegment.isPending ||
    patchSegment.isPending ||
    deleteSegment.isPending ||
    createActivity.isPending ||
    patchActivity.isPending ||
    deleteActivity.isPending

  async function handleCreateScheme() {
    if (!periodId) return
    setActionError('')
    try {
      await createScheme.mutateAsync({
        course_assignment: courseId,
        academic_period: periodId,
        is_active: true,
      })
    } catch (err) {
      setActionError(getErrorMessage(err, 'No se pudo crear el plan.'))
    }
  }

  async function saveSegment() {
    if (!scheme || !segmentForm) return
    const name = segmentForm.name.trim()
    const weight = parseWeightPercent(segmentForm.weight)
    if (!name) {
      setActionError('El segmento necesita un nombre.')
      return
    }
    if (weight == null || weight <= 0) {
      setActionError('El peso debe ser mayor que 0.')
      return
    }
    const remaining = remainingWeightForComponent(
      segments,
      segmentForm.componentId,
      segmentForm.editingId,
    )
    if (weight > remaining + WEIGHT_SUM_TOLERANCE) {
      setActionError(`El peso no puede superar el ${formatWeight(remaining)}% restante.`)
      return
    }
    setActionError('')
    try {
      if (segmentForm.editingId) {
        await patchSegment.mutateAsync({
          id: segmentForm.editingId,
          body: { name, weight_percent: formatWeight(weight) },
        })
      } else {
        const existing = segments.filter(
          (s) => s.subject_component === segmentForm.componentId,
        )
        await createSegment.mutateAsync({
          grading_scheme: scheme.id,
          subject_component: segmentForm.componentId,
          name,
          weight_percent: formatWeight(weight),
          sort_order: existing.length,
        })
      }
      setSegmentForm(null)
    } catch (err) {
      setActionError(getErrorMessage(err, 'No se pudo guardar el segmento.'))
    }
  }

  async function addTemplate(
    component: SubjectComponent,
    template: (typeof SEGMENT_TEMPLATES)[number],
  ) {
    if (!scheme) return
    const existing = segments.filter((s) => s.subject_component === component.id)
    if (existing.some((s) => s.name.trim().toLowerCase() === template.name.toLowerCase())) {
      return
    }
    const remaining = remainingWeightForComponent(segments, component.id)
    if (remaining <= 0) {
      setActionError('Este componente ya suma 100%.')
      return
    }
    const weight = Math.min(Number(template.defaultWeight), remaining)
    setActionError('')
    try {
      await createSegment.mutateAsync({
        grading_scheme: scheme.id,
        subject_component: component.id,
        name: template.name,
        weight_percent: formatWeight(weight),
        sort_order: existing.length,
      })
    } catch (err) {
      setActionError(getErrorMessage(err, 'No se pudo añadir el segmento.'))
    }
  }

  async function removeSegment(segment: ComponentSegment) {
    if (!window.confirm(`¿Eliminar el segmento “${segment.name}” y sus actividades?`)) return
    setActionError('')
    try {
      await deleteSegment.mutateAsync(segment.id)
      if (activityForm?.segmentId === segment.id) setActivityForm(null)
    } catch (err) {
      setActionError(getErrorMessage(err, 'No se pudo eliminar el segmento.'))
    }
  }

  async function saveActivity() {
    if (!activityForm) return
    const name = activityForm.name.trim()
    if (!name) {
      setActionError('La actividad necesita un nombre.')
      return
    }
    if (!activityForm.date) {
      setActionError('Indica la fecha de la actividad.')
      return
    }
    const max = parseWeightPercent(activityForm.maxScore) ?? 5
    setActionError('')
    try {
      if (activityForm.editing) {
        await patchActivity.mutateAsync({
          id: activityForm.editing.id,
          body: {
            name,
            activity_date: activityForm.date,
            max_score: formatWeight(max),
          },
        })
      } else {
        const existing = activities.filter((a) => a.segment === activityForm.segmentId)
        await createActivity.mutateAsync({
          segment: activityForm.segmentId,
          name,
          activity_date: activityForm.date,
          max_score: formatWeight(max),
          sort_order: existing.length,
        })
      }
      setActivityForm(null)
    } catch (err) {
      setActionError(getErrorMessage(err, 'No se pudo guardar la actividad.'))
    }
  }

  async function removeActivity(activity: GradingActivity) {
    if (!window.confirm(`¿Eliminar “${activity.name}”?`)) return
    setActionError('')
    try {
      await deleteActivity.mutateAsync(activity.id)
    } catch (err) {
      setActionError(getErrorMessage(err, 'No se pudo eliminar la actividad.'))
    }
  }

  function openNewActivity(segmentId: string, date?: string) {
    setActivityForm({
      segmentId,
      editing: null,
      name: '',
      date: date ?? selectedDate ?? todayIso(),
      maxScore: '5.00',
    })
  }

  const structure = (
    <StructurePanel
      components={components}
      segments={segments}
      activities={activities}
      openComponentId={openComponentId}
      onToggleComponent={(id) =>
        setOpenComponentId((cur) => (cur === id ? null : id))
      }
      segmentForm={segmentForm}
      setSegmentForm={setSegmentForm}
      activityForm={activityForm}
      setActivityForm={setActivityForm}
      onAddTemplate={addTemplate}
      onSaveSegment={() => void saveSegment()}
      onDeleteSegment={removeSegment}
      onOpenNewActivity={openNewActivity}
      onEditActivity={(activity) =>
        setActivityForm({
          segmentId: activity.segment,
          editing: activity,
          name: activity.name,
          date: activity.activity_date,
          maxScore: activity.max_score ?? '5.00',
        })
      }
      onSaveActivity={() => void saveActivity()}
      onDeleteActivity={removeActivity}
      busy={busy}
    />
  )

  const calendar = (
    <CalendarPanel
      viewMonth={viewMonth}
      onPrev={() => setViewMonth((d) => addMonths(d, -1))}
      onNext={() => setViewMonth((d) => addMonths(d, 1))}
      gridDays={gridDays}
      byDate={byDate}
      selectedDate={selectedDate}
      onSelectDate={setSelectedDate}
      segments={segments}
      activityForm={activityForm}
      setActivityForm={setActivityForm}
      onOpenNewActivity={openNewActivity}
      onEditActivity={(activity) =>
        setActivityForm({
          segmentId: activity.segment,
          editing: activity,
          name: activity.name,
          date: activity.activity_date,
          maxScore: activity.max_score ?? '5.00',
        })
      }
      onSaveActivity={() => void saveActivity()}
      onDeleteActivity={removeActivity}
      busy={busy}
    />
  )

  return (
    <div className="flex flex-col h-full bg-[#F1F5F9]">
      <SectionHeader
        title="Plan de esquema"
        subtitle={`${course.subject_name} · ${course.group_name}${period ? ` · ${period.name}` : ''}`}
        onBack={onBack}
      />

      {bundleQuery.isLoading && (
        <p className="text-sm text-slate-400 text-center py-10">Cargando plan…</p>
      )}
      {bundleQuery.isError && (
        <p className="text-sm text-red-600 text-center py-6 px-4">
          {getErrorMessage(bundleQuery.error, 'No se pudo cargar el esquema.')}
        </p>
      )}

      {bundleQuery.data && !scheme && (
        <div className="flex-1 overflow-y-auto p-4">
          <EmptyState
            icon={<IconClipboard size={22} />}
            title="Este periodo no tiene esquema"
            body="Crea el plan para definir segmentos, pesos y el calendario de actividades."
          />
          {actionError && (
            <div className="mb-3">
              <WriteError
                message={actionError}
                onRetry={() => void handleCreateScheme()}
                disabled={busy}
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => void handleCreateScheme()}
            disabled={busy || !periodId}
            className="w-full h-11 rounded-xl bg-[#1E3A5F] text-white text-sm font-semibold disabled:opacity-50"
          >
            {createScheme.isPending ? 'Creando…' : 'Crear plan'}
          </button>
        </div>
      )}

      {scheme && (
        <>
          <div className="px-4 pt-3 space-y-2">
            {weightsOk ? (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                <IconCheck size={14} />
                <p className="text-xs font-semibold text-emerald-800">
                  Pesos listos · puedes calificar y aplicar la sugerida
                </p>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                  <IconAlert size={14} />
                  Los pesos no suman 100%
                </p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  {weightsQuery.data?.message ||
                    'Cada componente debe tener segmentos que sumen 100%. El cierre de periodo queda bloqueado hasta entonces.'}
                </p>
              </div>
            )}
            {actionError && <WriteError message={actionError} />}
          </div>

          <div className="md:hidden flex border-b border-slate-200 mt-2 bg-white">
            {([
              { id: 'estructura', label: 'Estructura' },
              { id: 'calendario', label: 'Calendario' },
            ] as const).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setPhoneTab(t.id)}
                className={`flex-1 py-2.5 text-xs font-semibold border-b-2 ${
                  phoneTab === t.id
                    ? 'border-[#1E3A5F] text-[#1E3A5F]'
                    : 'border-transparent text-slate-500'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 md:flex md:flex-row">
            <div
              className={`flex-1 overflow-y-auto md:border-r md:border-slate-200 ${
                phoneTab === 'calendario' ? 'hidden md:block' : ''
              }`}
            >
              {structure}
            </div>
            <div
              className={`flex-1 overflow-y-auto ${
                phoneTab === 'estructura' ? 'hidden md:block' : ''
              }`}
            >
              {calendar}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function StructurePanel({
  components,
  segments,
  activities,
  openComponentId,
  onToggleComponent,
  segmentForm,
  setSegmentForm,
  activityForm,
  setActivityForm,
  onAddTemplate,
  onSaveSegment,
  onDeleteSegment,
  onOpenNewActivity,
  onEditActivity,
  onSaveActivity,
  onDeleteActivity,
  busy,
}: {
  components: SubjectComponent[]
  segments: ComponentSegment[]
  activities: EnrichedActivity[]
  openComponentId: string | null
  onToggleComponent: (id: string) => void
  segmentForm: SegmentForm | null
  setSegmentForm: (form: SegmentForm | null) => void
  activityForm: ActivityForm | null
  setActivityForm: (form: ActivityForm | null) => void
  onAddTemplate: (
    component: SubjectComponent,
    template: (typeof SEGMENT_TEMPLATES)[number],
  ) => void
  onSaveSegment: () => void
  onDeleteSegment: (segment: ComponentSegment) => void
  onOpenNewActivity: (segmentId: string) => void
  onEditActivity: (activity: EnrichedActivity) => void
  onSaveActivity: () => void
  onDeleteActivity: (activity: GradingActivity) => void
  busy: boolean
}) {
  if (components.length === 0) {
    return (
      <p className="text-sm text-slate-400 text-center py-8 px-4">
        Esta asignatura no tiene componentes en el catálogo. Pide a coordinación que los configure.
      </p>
    )
  }

  return (
    <div className="p-4 space-y-3">
      {components
        .slice()
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((component) => {
          const componentSegments = segments
            .filter((s) => s.subject_component === component.id)
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          const total = segmentWeightTotal(segments, component.id)
          const remaining = remainingWeightForComponent(segments, component.id)
          const open = openComponentId === component.id
          const existingNames = new Set(
            componentSegments.map((s) => s.name.trim().toLowerCase()),
          )
          return (
            <Card key={component.id} className="overflow-hidden">
              <button
                type="button"
                onClick={() => onToggleComponent(component.id)}
                className="w-full text-left px-4 py-3"
              >
                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <p className="text-sm font-semibold text-slate-900">{component.name}</p>
                  <span className="font-mono text-[11px] text-slate-400">
                    {component.weight_percent}% asig.
                  </span>
                </div>
                <WeightBar total={total} />
              </button>
              {open && (
                <div className="px-4 pb-4 space-y-3 border-t border-slate-100">
                  <p className="text-[11px] text-slate-400 pt-3">
                    Restante {formatWeight(remaining)}%. Los componentes son de catálogo (solo lectura).
                  </p>
                  {remaining > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {SEGMENT_TEMPLATES.map((template) => {
                        const exists = existingNames.has(template.name.toLowerCase())
                        return (
                          <button
                            key={template.id}
                            type="button"
                            disabled={exists || busy}
                            onClick={() => onAddTemplate(component, template)}
                            className="text-[11px] font-semibold px-2.5 py-1.5 rounded-full border border-slate-200 bg-white text-slate-700 disabled:opacity-40"
                          >
                            {exists ? template.name : `+ ${template.name}`}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {componentSegments.map((segment) => (
                    <div key={segment.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{segment.name}</p>
                          <p className="font-mono text-[11px] text-slate-400">
                            {segment.weight_percent}%
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setSegmentForm({
                                componentId: component.id,
                                editingId: segment.id,
                                name: segment.name,
                                weight: String(segment.weight_percent),
                              })
                            }
                            className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center"
                          >
                            <IconPencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteSegment(segment)}
                            className="w-8 h-8 rounded-lg text-red-500 hover:bg-red-50 text-xs font-bold"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                      {activities
                        .filter((a) => a.segment === segment.id)
                        .map((activity) => (
                          <div
                            key={activity.id}
                            className="flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 py-2"
                          >
                            <button
                              type="button"
                              onClick={() => onEditActivity(activity)}
                              className="flex-1 text-left min-w-0"
                            >
                              <p className="text-xs font-medium text-slate-800 truncate">
                                {activity.name}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {formatShortDate(activity.activity_date)} · máx{' '}
                                {activity.maxScoreNumber.toFixed(1)}
                              </p>
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteActivity(activity)}
                              className="text-red-400 text-xs font-bold w-7 h-7"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      {activityForm?.segmentId === segment.id ? (
                        <ActivityFormFields
                          form={activityForm}
                          onChange={setActivityForm}
                          onSave={onSaveActivity}
                          onCancel={() => setActivityForm(null)}
                          busy={busy}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenNewActivity(segment.id)}
                          className="flex items-center gap-1 text-xs font-semibold text-blue-700"
                        >
                          <IconPlus size={12} /> Actividad
                        </button>
                      )}
                    </div>
                  ))}

                  {segmentForm?.componentId === component.id ? (
                    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-2">
                      <input
                        value={segmentForm.name}
                        onChange={(e) =>
                          setSegmentForm({ ...segmentForm, name: e.target.value })
                        }
                        placeholder="Nombre del segmento"
                        className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-400"
                      />
                      <input
                        value={segmentForm.weight}
                        onChange={(e) =>
                          setSegmentForm({ ...segmentForm, weight: e.target.value })
                        }
                        placeholder={`Peso % (máx ${formatWeight(remainingWeightForComponent(segments, component.id, segmentForm.editingId))})`}
                        inputMode="decimal"
                        className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-400 font-mono"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSegmentForm(null)}
                          className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={onSaveSegment}
                          disabled={busy}
                          className="flex-1 h-10 rounded-xl bg-[#1E3A5F] text-white text-sm font-semibold disabled:opacity-50"
                        >
                          Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    remaining > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setSegmentForm({
                            componentId: component.id,
                            editingId: null,
                            name: '',
                            weight: formatWeight(remaining),
                          })
                        }
                        className="flex items-center gap-1.5 text-xs font-semibold text-blue-700"
                      >
                        <IconPlus size={12} /> Segmento personalizado
                      </button>
                    )
                  )}
                </div>
              )}
            </Card>
          )
        })}
    </div>
  )
}

function CalendarPanel({
  viewMonth,
  onPrev,
  onNext,
  gridDays,
  byDate,
  selectedDate,
  onSelectDate,
  segments,
  activityForm,
  setActivityForm,
  onOpenNewActivity,
  onEditActivity,
  onSaveActivity,
  onDeleteActivity,
  busy,
}: {
  viewMonth: Date
  onPrev: () => void
  onNext: () => void
  gridDays: (Date | null)[]
  byDate: Map<string, GradingActivity[]>
  selectedDate: string | null
  onSelectDate: (iso: string) => void
  segments: ComponentSegment[]
  activityForm: ActivityForm | null
  setActivityForm: (form: ActivityForm | null) => void
  onOpenNewActivity: (segmentId: string, date?: string) => void
  onEditActivity: (activity: GradingActivity) => void
  onSaveActivity: () => void
  onDeleteActivity: (activity: GradingActivity) => void
  busy: boolean
}) {
  const [newSegmentId, setNewSegmentId] = useState('')
  const selectedActivities = selectedDate ? byDate.get(selectedDate) ?? [] : []
  const today = todayIso()

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onPrev} className="w-9 h-9 rounded-full hover:bg-white text-slate-600">
          ‹
        </button>
        <p className="text-sm font-semibold text-slate-800">{formatMonthYear(viewMonth)}</p>
        <button type="button" onClick={onNext} className="w-9 h-9 rounded-full hover:bg-white text-slate-600">
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d) => (
          <span key={d} className="text-[10px] font-semibold text-slate-400 py-1">
            {d}
          </span>
        ))}
        {gridDays.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} />
          const iso = dateToIso(day)
          const count = byDate.get(iso)?.length ?? 0
          const selected = selectedDate === iso
          const isToday = iso === today
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDate(iso)}
              className={`h-11 rounded-lg text-xs font-medium relative ${
                selected
                  ? 'bg-[#1E3A5F] text-white'
                  : isToday
                    ? 'bg-blue-50 text-blue-800'
                    : 'bg-white text-slate-700 border border-slate-100'
              }`}
            >
              {day.getDate()}
              {count > 0 && (
                <span
                  className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                    selected ? 'bg-white' : 'bg-blue-500'
                  }`}
                />
              )}
            </button>
          )
        })}
      </div>

      {selectedDate && (
        <Card className="p-3 space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {formatShortDate(selectedDate)}
          </p>
          {selectedActivities.length === 0 && (
            <p className="text-xs text-slate-400">Sin actividades este día.</p>
          )}
          {selectedActivities.map((activity) => (
            <div key={activity.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onEditActivity(activity)}
                className="flex-1 text-left min-w-0"
              >
                <p className="text-sm font-medium text-slate-800 truncate">{activity.name}</p>
                <p className="text-[11px] text-slate-400">{activity.segment_name}</p>
              </button>
              <button
                type="button"
                onClick={() => onDeleteActivity(activity)}
                className="text-red-400 text-xs font-bold w-7 h-7"
              >
                ×
              </button>
            </div>
          ))}
          {activityForm && activityForm.date === selectedDate ? (
            <ActivityFormFields
              form={activityForm}
              onChange={setActivityForm}
              onSave={onSaveActivity}
              onCancel={() => setActivityForm(null)}
              busy={busy}
              showSegment={false}
            />
          ) : segments.length > 0 ? (
            <div className="flex gap-2">
              <select
                value={newSegmentId}
                onChange={(e) => setNewSegmentId(e.target.value)}
                className="flex-1 h-10 px-2 rounded-lg border border-slate-200 text-xs bg-white"
              >
                <option value="">Segmento…</option>
                {segments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.subject_component_name} · {s.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!newSegmentId}
                onClick={() => onOpenNewActivity(newSegmentId, selectedDate)}
                className="h-10 px-3 rounded-xl bg-[#1E3A5F] text-white text-xs font-semibold disabled:opacity-40"
              >
                Añadir
              </button>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400">Crea un segmento en la estructura para poder añadir actividades.</p>
          )}
        </Card>
      )}
    </div>
  )
}

function ActivityFormFields({
  form,
  onChange,
  onSave,
  onCancel,
  busy,
}: {
  form: ActivityForm
  onChange: (form: ActivityForm) => void
  onSave: () => void
  onCancel: () => void
  busy: boolean
  showSegment?: boolean
}) {
  return (
    <div className="space-y-2">
      <input
        value={form.name}
        onChange={(e) => onChange({ ...form, name: e.target.value })}
        placeholder="Nombre de la actividad"
        className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-400"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={form.date}
          onChange={(e) => onChange({ ...form, date: e.target.value })}
          className="h-10 px-3 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-400"
        />
        <input
          value={form.maxScore}
          onChange={(e) => onChange({ ...form, maxScore: e.target.value })}
          placeholder="Máx."
          inputMode="decimal"
          className="h-10 px-3 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-400 font-mono"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          className="flex-1 h-10 rounded-xl bg-[#1E3A5F] text-white text-sm font-semibold disabled:opacity-50"
        >
          Guardar
        </button>
      </div>
    </div>
  )
}
