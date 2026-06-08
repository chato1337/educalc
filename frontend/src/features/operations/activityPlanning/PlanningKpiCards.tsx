import {
  Card,
  CardContent,
  Grid,
  Typography,
} from '@mui/material'
import { useTranslation } from 'react-i18next'

import type { PlanningSchemeBundle } from '@/features/operations/activityPlanning/planningQueries'

export type PlanningKpiCardsProps = {
  bundle: PlanningSchemeBundle
}

export function PlanningKpiCards({ bundle }: PlanningKpiCardsProps) {
  const { t } = useTranslation()
  const { statusCounts, progress } = bundle

  const items = [
    {
      label: t('activityPlanning.kpi.planned'),
      value: statusCounts.planned,
      color: 'info.main',
    },
    {
      label: t('activityPlanning.kpi.due'),
      value: statusCounts.due,
      color: 'warning.main',
    },
    {
      label: t('activityPlanning.kpi.grading'),
      value: statusCounts.grading,
      color: 'text.secondary',
    },
    {
      label: t('activityPlanning.kpi.completed'),
      value: statusCounts.completed,
      color: 'success.main',
    },
    {
      label: t('activityPlanning.kpi.structure'),
      value: t('activityPlanning.kpi.structureValue', {
        ready: progress.componentsReady,
        total: progress.componentsTotal,
      }),
      color: progress.structureComplete ? 'success.main' : 'warning.main',
    },
    {
      label: t('activityPlanning.kpi.activities'),
      value: progress.activitiesCount,
      color: 'primary.main',
    },
  ]

  return (
    <Grid container spacing={2}>
      {items.map((item) => (
        <Grid key={item.label} size={{ xs: 12, sm: 6, md: 4 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                {item.label}
              </Typography>
              <Typography variant="h5" sx={{ color: item.color, mt: 0.5 }}>
                {item.value}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  )
}
