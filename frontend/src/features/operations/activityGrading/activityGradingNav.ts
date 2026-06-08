import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined'
import GradingOutlinedIcon from '@mui/icons-material/GradingOutlined'
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined'
import type { SvgIconComponent } from '@mui/icons-material'

export const ACTIVITY_GRADING_BASE = '/activity-grading'

export type ActivityGradingNavItem = {
  labelKey: string
  path: string
  icon: SvgIconComponent
}

/** Subnavegación del módulo (tabs horizontales + entradas del sidebar). */
export const activityGradingNavItems: ActivityGradingNavItem[] = [
  {
    labelKey: 'activityGrading.nav.schemes',
    path: `${ACTIVITY_GRADING_BASE}/schemes`,
    icon: AccountTreeOutlinedIcon,
  },
  {
    labelKey: 'activityGrading.nav.activityScores',
    path: `${ACTIVITY_GRADING_BASE}/activity-scores`,
    icon: GradingOutlinedIcon,
  },
  {
    labelKey: 'activityGrading.nav.suggestedGrades',
    path: `${ACTIVITY_GRADING_BASE}/suggested-grades`,
    icon: InsightsOutlinedIcon,
  },
]

export function isActivityGradingPath(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, '')
  return (
    normalized === ACTIVITY_GRADING_BASE ||
    normalized.startsWith(`${ACTIVITY_GRADING_BASE}/`)
  )
}

export function activityGradingTabValue(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '')
  if (normalized.startsWith(`${ACTIVITY_GRADING_BASE}/activity-scores`)) {
    return `${ACTIVITY_GRADING_BASE}/activity-scores`
  }
  if (normalized.startsWith(`${ACTIVITY_GRADING_BASE}/suggested-grades`)) {
    return `${ACTIVITY_GRADING_BASE}/suggested-grades`
  }
  return `${ACTIVITY_GRADING_BASE}/schemes`
}
