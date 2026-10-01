import { formatScoreDisplay } from '@/features/grading/activityStatus'
import { displayDef, type GradeGridStructure } from '@/features/grading/gradeGridMath'
import type {
  ComponentSegment,
  EnrichedActivity,
  SubjectComponent,
} from '@/features/grading/gradingApi'
import type { Enrollment } from '@/types/schemas'

const SEGMENT_TONES = [
  'bg-blue-50 text-blue-800',
  'bg-amber-50 text-amber-800',
  'bg-emerald-50 text-emerald-800',
  'bg-violet-50 text-violet-800',
] as const

type SegmentColumn = {
  segment: ComponentSegment
  activities: EnrichedActivity[]
  tone: string
}

type ComponentColumn = {
  component: SubjectComponent
  segments: SegmentColumn[]
  colSpan: number
}

function columnGroups(
  components: SubjectComponent[],
  segments: ComponentSegment[],
  activities: EnrichedActivity[],
): ComponentColumn[] {
  const componentById = new Map(components.map((component) => [component.id, component]))
  const segmentById = new Map(segments.map((segment) => [segment.id, segment]))
  const toneBySegment = new Map<string, string>()
  ;[...segments]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .forEach((segment, index) => {
      toneBySegment.set(segment.id, SEGMENT_TONES[index % SEGMENT_TONES.length]!)
    })

  const groups: ComponentColumn[] = []
  for (const activity of activities) {
    const segment = segmentById.get(activity.segment)
    const component = segment
      ? componentById.get(segment.subject_component)
      : undefined
    if (!segment || !component) continue
    let group = groups[groups.length - 1]
    if (!group || group.component.id !== component.id) {
      group = { component, segments: [], colSpan: 0 }
      groups.push(group)
    }
    let column = group.segments[group.segments.length - 1]
    if (!column || column.segment.id !== segment.id) {
      column = {
        segment,
        activities: [],
        tone: toneBySegment.get(segment.id) ?? SEGMENT_TONES[0]!,
      }
      group.segments.push(column)
    }
    column.activities.push(activity)
    group.colSpan += 1
  }
  return groups
}

function cellKey(studentId: string, activityId: string): string {
  return `${studentId}:${activityId}`
}

export function GradeGridMatrix({
  enrollments,
  activities,
  components,
  segments,
  structure,
  scoresFor,
  scoreOf,
  openStudentId,
  openActivityId,
  savingKey,
  errors,
  onOpenCell,
  onAddActivity,
  onEditActivity,
  onEditWeights,
}: {
  enrollments: Enrollment[]
  activities: EnrichedActivity[]
  components: SubjectComponent[]
  segments: ComponentSegment[]
  structure: GradeGridStructure
  scoresFor: (studentId: string) => Map<string, string | null>
  scoreOf: (studentId: string, activityId: string) => string | null
  openStudentId?: string
  openActivityId?: string
  savingKey: string | null
  errors: Record<string, string>
  onOpenCell: (studentId: string, activityId: string) => void
  onAddActivity: (segmentId: string) => void
  onEditActivity: (activity: EnrichedActivity) => void
  onEditWeights: (componentId: string) => void
}) {
  const groups = columnGroups(components, segments, activities)
  const columns = groups.flatMap((group) =>
    group.segments.flatMap((column) => column.activities),
  )
  const stickyName =
    'sticky left-0 bg-white border-r border-slate-200 shadow-[4px_0_8px_-6px_rgba(15,23,42,0.35)]'
  const stickyDef =
    'sticky right-0 bg-white border-l border-slate-200 shadow-[-4px_0_8px_-6px_rgba(15,23,42,0.35)]'

  return (
    <div className="grade-grid-matrix min-h-0 flex-1 overflow-auto">
      {columns.length === 0 && (
        <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-white px-3 py-2">
          {components
            .slice()
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((component) => (
              <button
                key={component.id}
                type="button"
                onClick={() => onEditWeights(component.id)}
                className="min-h-11 rounded-full border border-slate-200 px-3 text-xs font-semibold text-slate-700"
              >
                Pesos · {component.name}
              </button>
            ))}
        </div>
      )}
      <table className="border-separate border-spacing-0 text-left">
        <thead className="sticky top-0 z-30">
          <tr>
            <th
              rowSpan={3}
              className={`${stickyName} top-0 z-40 min-w-[148px] bg-slate-50 px-3 text-xs font-semibold text-slate-500`}
            >
              Estudiante
            </th>
            {groups.map((group) => (
              <th
                key={group.component.id}
                colSpan={group.colSpan}
                className="bg-slate-50 border-b border-r border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600"
              >
                <span className="flex items-center justify-between gap-1">
                  <span className="truncate">
                    {group.component.name}{' '}
                    <span className="font-mono font-normal text-slate-400">
                      {group.component.weight_percent}%
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onEditWeights(group.component.id)}
                    className="min-h-11 shrink-0 px-2 text-[11px] font-semibold text-[#1E3A5F]"
                  >
                    Pesos
                  </button>
                </span>
              </th>
            ))}
            <th
              rowSpan={3}
              className={`${stickyDef} top-0 z-40 min-w-[64px] bg-slate-50 px-2 text-center text-xs font-semibold text-slate-500`}
            >
              def
            </th>
          </tr>
          <tr>
            {groups.flatMap((group) =>
              group.segments.map((column) => (
                <th
                  key={column.segment.id}
                  colSpan={column.activities.length}
                  className={`border-b border-r border-slate-200 px-2 py-1 text-[10px] font-semibold ${column.tone}`}
                >
                  <span className="flex items-center justify-between gap-1">
                    <span className="truncate">
                      {column.segment.name}{' '}
                      <span className="font-mono font-normal opacity-70">
                        {column.segment.weight_percent}%
                      </span>
                    </span>
                    <button
                      type="button"
                      aria-label={`Nueva actividad en ${column.segment.name}`}
                      onClick={() => onAddActivity(column.segment.id)}
                      className="min-h-11 min-w-11 shrink-0 text-base font-semibold"
                    >
                      +
                    </button>
                  </span>
                </th>
              )),
            )}
          </tr>
          <tr>
            {groups.flatMap((group) =>
              group.segments.flatMap((column) =>
                column.activities.map((activity) => (
                  <th
                    key={activity.id}
                    className={`min-w-[72px] w-[72px] max-w-[72px] border-b border-r border-slate-200 p-0 text-[10px] font-medium ${column.tone}`}
                  >
                    <button
                      type="button"
                      title={activity.name}
                      onClick={() => onEditActivity(activity)}
                      className="block h-11 w-full truncate px-1 text-left"
                    >
                      {activity.name}
                    </button>
                  </th>
                )),
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {enrollments.map((row) => (
            <tr key={row.student} className="h-11">
              <th
                scope="row"
                className={`${stickyName} z-20 min-h-11 px-3 py-1.5 text-left font-normal`}
              >
                <p className="max-w-[160px] truncate text-sm font-medium text-slate-900">
                  {row.student_name}
                </p>
                <p className="max-w-[160px] truncate font-mono text-[10px] text-slate-400">
                  {row.student_document_number}
                </p>
              </th>
              {columns.map((activity) => {
                const key = cellKey(row.student, activity.id)
                const score = scoreOf(row.student, activity.id)
                const open =
                  openStudentId === row.student && openActivityId === activity.id
                const error = errors[key]
                return (
                  <td key={activity.id} className="h-11 min-w-[72px] border-b border-r border-slate-100 p-0">
                    <button
                      type="button"
                      title={error || activity.name}
                      onClick={() => onOpenCell(row.student, activity.id)}
                      className={`flex h-11 w-full min-w-[72px] items-center justify-center font-mono text-sm ${
                        open
                          ? 'bg-blue-50 ring-2 ring-inset ring-blue-400'
                          : error
                            ? 'bg-red-50 text-red-700'
                            : 'bg-white text-slate-900'
                      }`}
                    >
                      {savingKey === key
                        ? '…'
                        : score
                          ? formatScoreDisplay(score)
                          : '—'}
                    </button>
                  </td>
                )
              })}
              <td className={`${stickyDef} z-20 h-11 px-2 text-center`}>
                <span className="font-mono text-sm font-bold text-slate-900">
                  {displayDef(structure, scoresFor(row.student))}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
