import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined'
import type { SvgIconComponent } from '@mui/icons-material'

export const ACTIVITY_PLANNING_BASE = '/activity-planning'

export type ActivityPlanningNavItem = {
  labelKey: string
  path: string
  icon: SvgIconComponent
}

/** Subnavegación del módulo de planeación (tabs + sidebar). */
export const activityPlanningNavItems: ActivityPlanningNavItem[] = [
  {
    labelKey: 'activityPlanning.nav.overview',
    path: ACTIVITY_PLANNING_BASE,
    icon: DashboardOutlinedIcon,
  },
  {
    labelKey: 'activityPlanning.nav.calendar',
    path: `${ACTIVITY_PLANNING_BASE}/calendar`,
    icon: CalendarMonthOutlinedIcon,
  },
  {
    labelKey: 'activityPlanning.nav.workspace',
    path: `${ACTIVITY_PLANNING_BASE}/workspace`,
    icon: EditNoteOutlinedIcon,
  },
]

export function isActivityPlanningPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, '')
  return (
    normalized === ACTIVITY_PLANNING_BASE ||
    normalized.startsWith(`${ACTIVITY_PLANNING_BASE}/`)
  )
}

export function activityPlanningTabValue(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '')
  if (normalized.startsWith(`${ACTIVITY_PLANNING_BASE}/calendar`)) {
    return `${ACTIVITY_PLANNING_BASE}/calendar`
  }
  if (
    normalized === `${ACTIVITY_PLANNING_BASE}/workspace` ||
    normalized.startsWith(`${ACTIVITY_PLANNING_BASE}/workspace/`)
  ) {
    return `${ACTIVITY_PLANNING_BASE}/workspace`
  }
  return ACTIVITY_PLANNING_BASE
}

export const planningSchemeQueryKey = 'scheme' as const
