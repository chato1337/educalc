import { getErrorMessage } from '@/api/errors'
import { EmptyState, IconAlert, IconClipboard } from '@/components'
import type { Course } from '@/data'
import {
  useCourseActivitiesBundle,
  type EnrichedActivity,
  type SubjectComponent,
  type ComponentSegment,
} from '@/features/grading/gradingApi'
import { formatShortDate } from '@/session/periodUtils'
import { useTeacherSession } from '@/session/TeacherSessionContext'

type ActivityGroup = {
  id: string
  name: string
  weightPercent?: string
  segments: Array<{
    id: string
    activities: EnrichedActivity[]
  }>
}

const STATUS_STYLE: Record<EnrichedActivity['status'], string> = {
  pending: 'text-amber-600 bg-amber-50 border-amber-200',
  planned: 'text-slate-500 bg-slate-50 border-slate-200',
  graded: 'text-emerald-600 bg-emerald-50 border-emerald-200',
}

const STATUS_LABEL: Record<EnrichedActivity['status'], string> = {
  pending: 'Por calificar',
  planned: 'Planificada',
  graded: 'Calificada',
}

function groupActivities(
  components: SubjectComponent[],
  segments: ComponentSegment[],
  activities: EnrichedActivity[],
): ActivityGroup[] {
  const bySegment = new Map<string, EnrichedActivity[]>()
  for (const activity of activities) {
    const list = bySegment.get(activity.segment) ?? []
    list.push(activity)
    bySegment.set(activity.segment, list)
  }

  const usedSegmentIds = new Set<string>()
  const groups: ActivityGroup[] = [...components]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((component) => {
      const componentSegments = segments
        .filter((s) => s.subject_component === component.id)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((segment) => {
          usedSegmentIds.add(segment.id)
          return { id: segment.id, activities: bySegment.get(segment.id) ?? [] }
        })
        .filter((row) => row.activities.length > 0)
      return {
        id: component.id,
        name: component.name,
        weightPercent: component.weight_percent,
        segments: componentSegments,
      }
    })
    .filter((group) => group.segments.length > 0)

  const orphanSegments = segments.filter(
    (s) => !usedSegmentIds.has(s.id) && (bySegment.get(s.id)?.length ?? 0) > 0,
  )
  if (orphanSegments.length > 0) {
    groups.push({
      id: 'otros',
      name: 'Otros',
      segments: orphanSegments.map((segment) => ({
        id: segment.id,
        activities: bySegment.get(segment.id) ?? [],
      })),
    })
  }

  const knownSegmentIds = new Set(segments.map((s) => s.id))
  const loose = activities.filter((a) => !knownSegmentIds.has(a.segment))
  if (loose.length > 0) {
    groups.push({
      id: 'sin-componente',
      name: 'Actividades',
      segments: [{ id: 'sin-segmento', activities: loose }],
    })
  }

  return groups
}

function ActivityCard({
  activity,
  enrollmentCount,
  onGoToGradeActivity,
}: {
  activity: EnrichedActivity
  enrollmentCount: number
  onGoToGradeActivity: (id: string) => void
}) {
  const pendingHint =
    activity.pendingCount > 0 && enrollmentCount > 0
      ? `Toca para calificar · ${activity.pendingCount} de ${enrollmentCount} pendientes`
      : 'Toca para calificar'

  return (
    <button
      type="button"
      onClick={() => onGoToGradeActivity(activity.id)}
      className="w-full text-left bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-slate-900 leading-tight">{activity.name}</p>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${STATUS_STYLE[activity.status]}`}>
          {STATUS_LABEL[activity.status]}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span>{activity.segment_name}</span>
        <span>·</span>
        <span>{formatShortDate(activity.activity_date)}</span>
        <span>·</span>
        <span className="font-mono">máx {activity.maxScoreNumber.toFixed(1)}</span>
      </div>
      {activity.status === 'pending' && (
        <div className="mt-2.5 flex items-center gap-1.5 text-xs text-amber-600 font-medium">
          <IconAlert size={12} />
          {pendingHint}
        </div>
      )}
    </button>
  )
}

export function ActivitiesSection({
  course,
  onGoToGradeActivity,
  onGoToPlan,
}: {
  course: Course
  onGoToGradeActivity: (id: string) => void
  onGoToPlan: () => void
}) {
  const session = useTeacherSession()
  const period = session.periods.find((p) => p.id === session.selectedPeriodId)
  const bundleQuery = useCourseActivitiesBundle(
    course.groupId && course.subjectId && session.selectedPeriodId && session.academicYear
      ? {
          courseAssignmentId: course.id,
          academicPeriodId: session.selectedPeriodId,
          groupId: course.groupId,
          academicYearId: session.academicYear.id,
          subjectId: course.subjectId,
        }
      : null,
  )

  const bundle = bundleQuery.data
  const groups = bundle
    ? groupActivities(bundle.components, bundle.segments, bundle.activities)
    : []

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        {period && (
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {period.name}
          </p>
        )}
        <button
          type="button"
          onClick={onGoToPlan}
          className="text-xs font-semibold text-blue-700 hover:underline"
        >
          {bundle?.scheme ? 'Editar plan' : 'Crear plan'}
        </button>
      </div>

      {bundleQuery.isLoading && (
        <p className="text-sm text-slate-400 text-center py-8">Cargando actividades…</p>
      )}

      {bundleQuery.isError && (
        <p className="text-sm text-red-600 text-center py-4">
          {getErrorMessage(bundleQuery.error, 'No se pudieron cargar las actividades.')}
        </p>
      )}

      {bundle && !bundle.scheme && (
        <div className="space-y-3">
          <EmptyState
            icon={<IconClipboard size={22} />}
            title="Este periodo no tiene esquema de actividades"
            body="Crea el plan para definir segmentos, pesos y el calendario. Sin esquema no se puede calificar."
          />
          <button
            type="button"
            onClick={onGoToPlan}
            className="w-full h-11 rounded-xl bg-[#1E3A5F] text-white text-sm font-semibold"
          >
            Crear plan
          </button>
        </div>
      )}

      {bundle?.scheme && bundle.activities.length === 0 && (
        <div className="space-y-3">
          <EmptyState
            icon={<IconClipboard size={22} />}
            title="Aún no hay actividades"
            body="El esquema existe, pero no tiene actividades. Añádelas en el planificador."
          />
          <button
            type="button"
            onClick={onGoToPlan}
            className="w-full h-11 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700"
          >
            Ir al plan
          </button>
        </div>
      )}

      {groups.map((group) => (
        <div key={group.id} className="space-y-2">
          <div className="flex items-baseline justify-between px-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {group.name}
            </p>
            {group.weightPercent != null && group.weightPercent !== '' && (
              <span className="font-mono text-[10px] text-slate-400">
                {group.weightPercent}%
              </span>
            )}
          </div>
          {group.segments.map((segment) => (
            <div key={segment.id} className="space-y-2">
              {segment.activities.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  enrollmentCount={bundle?.enrollmentCount ?? 0}
                  onGoToGradeActivity={onGoToGradeActivity}
                />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
