import type {
  ComponentSegment,
  GradingActivity,
  GradingScheme,
  StudentActivityScore,
  SubjectComponent,
} from '@/features/operations/gradingApi'

export type ActivityPlanningStatus =
  | 'planned'
  | 'due'
  | 'grading'
  | 'completed'

export type EnrichedPlanningActivity = GradingActivity & {
  status: ActivityPlanningStatus
  gradedCount: number
  pendingCount: number
  segmentLabel: string
  componentLabel: string
}

export type SegmentTemplate = {
  id: string
  name: string
  defaultWeight: string
  description?: string
}

export const SEGMENT_TEMPLATE_IDS = {
  evaluations: 'evaluations',
  workshops: 'workshops',
  presentations: 'presentations',
} as const

export function todayIsoDate(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function deriveActivityStatus(
  activityDate: string,
  today: string,
  enrollmentCount: number,
  scoresForActivity: StudentActivityScore[],
): ActivityPlanningStatus {
  if (activityDate > today) return 'planned'

  const gradedCount = scoresForActivity.filter(
    (s) => s.score != null && s.score !== '',
  ).length
  if (gradedCount === 0) return 'due'
  if (enrollmentCount > 0 && gradedCount >= enrollmentCount) return 'completed'
  return 'grading'
}

export function buildScoresByActivity(
  scores: StudentActivityScore[],
): Map<string, StudentActivityScore[]> {
  const map = new Map<string, StudentActivityScore[]>()
  for (const score of scores) {
    const list = map.get(score.activity) ?? []
    list.push(score)
    map.set(score.activity, list)
  }
  return map
}

export function enrichActivities(params: {
  activities: GradingActivity[]
  segments: ComponentSegment[]
  components: SubjectComponent[]
  scoresByActivity: Map<string, StudentActivityScore[]>
  enrollmentCount: number
  today?: string
}): EnrichedPlanningActivity[] {
  const today = params.today ?? todayIsoDate()
  const segmentById = new Map(params.segments.map((s) => [s.id, s]))
  const componentById = new Map(params.components.map((c) => [c.id, c]))

  return params.activities
    .map((activity) => {
      const segment = segmentById.get(activity.segment)
      const component = segment
        ? componentById.get(segment.subject_component)
        : undefined
      const activityScores = params.scoresByActivity.get(activity.id) ?? []
      const gradedCount = activityScores.filter(
        (s) => s.score != null && s.score !== '',
      ).length
      const pendingCount = Math.max(0, params.enrollmentCount - gradedCount)

      return {
        ...activity,
        segmentLabel: segment?.name ?? activity.segment_name,
        componentLabel:
          component?.name ?? activity.component_name ?? '—',
        status: deriveActivityStatus(
          activity.activity_date,
          today,
          params.enrollmentCount,
          activityScores,
        ),
        gradedCount,
        pendingCount,
      }
    })
    .sort((a, b) => {
      const dateCmp = a.activity_date.localeCompare(b.activity_date)
      if (dateCmp !== 0) return dateCmp
      return (a.sort_order ?? 0) - (b.sort_order ?? 0)
    })
}

export function countActivitiesByStatus(
  activities: EnrichedPlanningActivity[],
): Record<ActivityPlanningStatus, number> {
  return activities.reduce(
    (acc, activity) => {
      acc[activity.status] += 1
      return acc
    },
    { planned: 0, due: 0, grading: 0, completed: 0 },
  )
}

export function segmentWeightTotalForComponent(
  segments: ComponentSegment[],
  componentId: string,
): number {
  return segments
    .filter((s) => s.subject_component === componentId)
    .reduce((sum, s) => sum + Number(s.weight_percent), 0)
}

export function componentNeedsSegments(
  segments: ComponentSegment[],
  componentId: string,
): boolean {
  const total = segmentWeightTotalForComponent(segments, componentId)
  return total < 100 - 0.01
}

export function buildSegmentTemplates(
  labels: Record<
    (typeof SEGMENT_TEMPLATE_IDS)[keyof typeof SEGMENT_TEMPLATE_IDS],
    string
  > & {
    evaluationsHint?: string
    workshopsHint?: string
    presentationsHint?: string
  },
): SegmentTemplate[] {
  return [
    {
      id: SEGMENT_TEMPLATE_IDS.evaluations,
      name: labels.evaluations,
      defaultWeight: '40',
      description: labels.evaluationsHint,
    },
    {
      id: SEGMENT_TEMPLATE_IDS.workshops,
      name: labels.workshops,
      defaultWeight: '35',
      description: labels.workshopsHint,
    },
    {
      id: SEGMENT_TEMPLATE_IDS.presentations,
      name: labels.presentations,
      defaultWeight: '25',
      description: labels.presentationsHint,
    },
  ]
}

export function schemePlanningProgress(params: {
  scheme: GradingScheme
  components: SubjectComponent[]
  segments: ComponentSegment[]
  activities: GradingActivity[]
}): {
  componentsReady: number
  componentsTotal: number
  activitiesCount: number
  structureComplete: boolean
} {
  const componentsTotal = params.components.length
  const componentsReady = params.components.filter((component) =>
    segmentWeightTotalForComponent(params.segments, component.id) >= 100 - 0.01,
  ).length

  return {
    componentsTotal,
    componentsReady,
    activitiesCount: params.activities.length,
    structureComplete:
      params.scheme.subject_component_weights_valid &&
      params.scheme.segment_weights_valid,
  }
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1)
}

export function formatMonthYear(date: Date, locale = 'es-CO'): string {
  return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
}

export function calendarGridDays(viewMonth: Date): (Date | null)[] {
  const first = startOfMonth(viewMonth)
  const startWeekday = (first.getDay() + 6) % 7
  const daysInMonth = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth() + 1,
    0,
  ).getDate()

  const cells: (Date | null)[] = []
  for (let i = 0; i < startWeekday; i += 1) cells.push(null)
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(
      new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day),
    )
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function dateToIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function activitiesForDate(
  activities: EnrichedPlanningActivity[],
  isoDate: string,
): EnrichedPlanningActivity[] {
  return activities.filter((a) => a.activity_date === isoDate)
}

export function planningStatusColor(
  status: ActivityPlanningStatus,
): 'default' | 'info' | 'warning' | 'success' | 'error' {
  switch (status) {
    case 'planned':
      return 'info'
    case 'due':
      return 'warning'
    case 'grading':
      return 'default'
    case 'completed':
      return 'success'
    default:
      return 'default'
  }
}
