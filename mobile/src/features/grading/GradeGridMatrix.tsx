import { IconCheck } from '@/components'
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

function columnSpan(column: SegmentColumn): number {
  return Math.max(column.activities.length, 1)
}

function columnGroups(
  components: SubjectComponent[],
  segments: ComponentSegment[],
  activities: EnrichedActivity[],
): ComponentColumn[] {
  const activitiesBySegment = new Map<string, EnrichedActivity[]>()
  for (const activity of activities) {
    const list = activitiesBySegment.get(activity.segment) ?? []
    list.push(activity)
    activitiesBySegment.set(activity.segment, list)
  }
  const toneBySegment = new Map<string, string>()
  ;[...segments]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .forEach((segment, index) => {
      toneBySegment.set(segment.id, SEGMENT_TONES[index % SEGMENT_TONES.length]!)
    })

  return [...components]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((component) => {
      const componentSegments = segments
        .filter((segment) => segment.subject_component === component.id)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((segment) => ({
          segment,
          activities: activitiesBySegment.get(segment.id) ?? [],
          tone: toneBySegment.get(segment.id) ?? SEGMENT_TONES[0]!,
        }))
      return {
        component,
        segments: componentSegments,
        colSpan: componentSegments.reduce((sum, column) => sum + columnSpan(column), 0),
      }
    })
    .filter((group) => group.segments.length > 0)
}

type MatrixColumn =
  | { key: string; kind: 'activity'; activity: EnrichedActivity; tone: string }
  | { key: string; kind: 'empty'; segment: ComponentSegment; tone: string }

function matrixColumns(groups: ComponentColumn[]): MatrixColumn[] {
  return groups.flatMap((group) =>
    group.segments.flatMap((column) =>
      column.activities.length > 0
        ? column.activities.map((activity) => ({
            key: activity.id,
            kind: 'activity' as const,
            activity,
            tone: column.tone,
          }))
        : [
            {
              key: `empty:${column.segment.id}`,
              kind: 'empty' as const,
              segment: column.segment,
              tone: column.tone,
            },
          ],
    ),
  )
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
  onOpenDetail,
  onApplyRow,
  applyDisabled,
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
  onOpenDetail: (studentId: string) => void
  onApplyRow: (studentId: string) => void
  applyDisabled: (studentId: string) => boolean
}) {
  const groups = columnGroups(components, segments, activities)
  const columns = matrixColumns(groups)
  const stickyName =
    'sticky left-0 bg-white border-r border-slate-200 shadow-[4px_0_8px_-6px_rgba(15,23,42,0.35)]'
  const stickyDef =
    'sticky right-0 bg-white border-l border-slate-200 shadow-[-4px_0_8px_-6px_rgba(15,23,42,0.35)]'

  const nameWidth = 200
  const defWidth = 156
  const tableMinWidth = nameWidth + defWidth + columns.length * 72

  return (
    <div className="grade-grid-matrix min-h-0 w-full flex-1 overflow-auto bg-white">
      {groups.length === 0 && (
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
      <table
        className="w-full border-separate border-spacing-0 text-left"
        style={{ minWidth: tableMinWidth, tableLayout: 'fixed' }}
      >
        <colgroup>
          <col style={{ width: nameWidth }} />
          {columns.map((column) => (
            <col key={column.key} />
          ))}
          <col style={{ width: defWidth }} />
        </colgroup>
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
              className={`${stickyDef} top-0 z-40 min-w-[112px] bg-slate-50 px-2 text-center text-xs font-semibold text-slate-500`}
            >
              def
            </th>
          </tr>
          <tr>
            {groups.flatMap((group) =>
              group.segments.map((column) => (
                <th
                  key={column.segment.id}
                  colSpan={columnSpan(column)}
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
            {columns.map((column) =>
              column.kind === 'activity' ? (
                <th
                  key={column.key}
                  className={`border-b border-r border-slate-200 p-0 text-[10px] font-medium ${column.tone}`}
                >
                  <button
                    type="button"
                    title={column.activity.name}
                    onClick={() => onEditActivity(column.activity)}
                    className="block h-11 w-full truncate px-1 text-left"
                  >
                    {column.activity.name}
                  </button>
                </th>
              ) : (
                <th
                  key={column.key}
                  className={`border-b border-r border-slate-200 px-1 text-[10px] font-medium text-slate-400 ${column.tone}`}
                >
                  Sin actividades
                </th>
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
                <p className="truncate text-sm font-medium text-slate-900">
                  {row.student_name}
                </p>
                <p className="truncate font-mono text-[10px] text-slate-400">
                  {row.student_document_number}
                </p>
              </th>
              {columns.map((column) => {
                if (column.kind === 'empty') {
                  return (
                    <td
                      key={column.key}
                      className="h-11 border-b border-r border-slate-100 text-center text-sm text-slate-300"
                    >
                      —
                    </td>
                  )
                }
                const activity = column.activity
                const key = cellKey(row.student, activity.id)
                const score = scoreOf(row.student, activity.id)
                const open =
                  openStudentId === row.student && openActivityId === activity.id
                const error = errors[key]
                return (
                  <td key={column.key} className="h-11 border-b border-r border-slate-100 p-0">
                    <button
                      type="button"
                      title={error || activity.name}
                      onClick={() => onOpenCell(row.student, activity.id)}
                      className={`flex h-11 w-full items-center justify-center font-mono text-sm ${
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
              <td className={`${stickyDef} z-20 h-11 px-1 text-center`}>
                <div className="flex items-center justify-end gap-0.5">
                  <span className="font-mono text-sm font-bold text-slate-900">
                    {displayDef(structure, scoresFor(row.student))}
                  </span>
                  <button
                    type="button"
                    aria-label={`Detalle de ${row.student_name}`}
                    onClick={() => onOpenDetail(row.student)}
                    className="min-h-11 min-w-11 text-[11px] font-semibold text-blue-700"
                  >
                    Ver
                  </button>
                  <button
                    type="button"
                    aria-label={`Aplicar sugerida de ${row.student_name}`}
                    disabled={applyDisabled(row.student)}
                    onClick={() => onApplyRow(row.student)}
                    className="min-h-11 min-w-11 text-emerald-700 disabled:text-slate-300"
                  >
                    <IconCheck size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
