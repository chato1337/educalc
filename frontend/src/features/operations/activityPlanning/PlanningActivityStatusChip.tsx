import { Chip, type ChipProps } from '@mui/material'
import { useTranslation } from 'react-i18next'

import {
  planningStatusColor,
  type ActivityPlanningStatus,
} from '@/features/operations/activityPlanning/activityPlanningUtils'

export type PlanningActivityStatusChipProps = {
  status: ActivityPlanningStatus
  size?: ChipProps['size']
}

export function PlanningActivityStatusChip({
  status,
  size = 'small',
}: PlanningActivityStatusChipProps) {
  const { t } = useTranslation()

  return (
    <Chip
      size={size}
      color={planningStatusColor(status)}
      label={t(`activityPlanning.status.${status}`)}
    />
  )
}
