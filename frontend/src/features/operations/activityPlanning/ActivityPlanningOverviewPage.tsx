import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import {
  Alert,
  Box,
  Button,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router-dom'

import { getErrorMessage } from '@/api/errors'
import { PlanningActivityStatusChip } from '@/features/operations/activityPlanning/PlanningActivityStatusChip'
import { PlanningKpiCards } from '@/features/operations/activityPlanning/PlanningKpiCards'
import { PlanningSchemeSelector } from '@/features/operations/activityPlanning/PlanningSchemeSelector'
import {
  usePlanningSchemeBundle,
  usePlanningSchemeSelection,
} from '@/features/operations/activityPlanning/planningQueries'
import { useUiStore } from '@/stores/uiStore'

export function ActivityPlanningOverviewPage() {
  const { t } = useTranslation()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const {
    schemeId,
    setSchemeId,
    schemes,
    schemesLoading,
    selectedScheme,
  } = usePlanningSchemeSelection(selectedInstitutionId)

  const bundleQuery = usePlanningSchemeBundle(schemeId)

  const upcoming = useMemo(() => {
    if (!bundleQuery.data) return []
    return bundleQuery.data.enrichedActivities
      .filter(
        (a) =>
          a.status === 'planned' ||
          a.status === 'due' ||
          a.status === 'grading',
      )
      .slice(0, 8)
  }, [bundleQuery.data])

  return (
    <Box className="flex flex-col gap-4">
      <Typography variant="h6">{t('activityPlanning.overviewTitle')}</Typography>
      <Typography variant="body2" color="text.secondary">
        {t('activityPlanning.overviewHint')}
      </Typography>

      <PlanningSchemeSelector
        schemes={schemes}
        loading={schemesLoading}
        value={selectedScheme}
        onChange={(scheme) => setSchemeId(scheme?.id ?? null)}
        institutionSelected={Boolean(selectedInstitutionId)}
      />

      {!schemeId ? (
        <Alert severity="info">{t('activityPlanning.selectSchemeHint')}</Alert>
      ) : null}

      {bundleQuery.error ? (
        <Alert severity="error">{getErrorMessage(bundleQuery.error)}</Alert>
      ) : null}

      {bundleQuery.isLoading && schemeId ? (
        <Typography color="text.secondary">{t('common.loading')}</Typography>
      ) : null}

      {bundleQuery.data ? (
        <>
          <PlanningKpiCards bundle={bundleQuery.data} />

          {!bundleQuery.data.progress.structureComplete ? (
            <Alert severity="warning">
              {t('activityPlanning.structureIncomplete')}
            </Alert>
          ) : null}

          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button
              component={RouterLink}
              to={`/activity-planning/workspace/${schemeId}`}
              variant="contained"
            >
              {t('activityPlanning.openWorkspace')}
            </Button>
            <Button
              component={RouterLink}
              to={`/activity-planning/calendar?scheme=${schemeId}`}
              variant="outlined"
            >
              {t('activityPlanning.openCalendar')}
            </Button>
            <Button
              component={RouterLink}
              to={`/activity-grading/schemes/${schemeId}`}
              variant="text"
              endIcon={<OpenInNewIcon />}
            >
              {t('activityPlanning.openGradingModule')}
            </Button>
          </Stack>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              {t('activityPlanning.upcomingTitle')}
            </Typography>
            {upcoming.length === 0 ? (
              <Typography color="text.secondary">
                {t('activityPlanning.noUpcoming')}
              </Typography>
            ) : (
              <List dense disablePadding>
                {upcoming.map((activity) => (
                  <ListItem
                    key={activity.id}
                    disableGutters
                    secondaryAction={
                      activity.status !== 'planned' ? (
                        <Button
                          size="small"
                          component={RouterLink}
                          to={`/activity-grading/schemes/${schemeId}`}
                        >
                          {t('activityPlanning.gradeNow')}
                        </Button>
                      ) : null
                    }
                  >
                    <ListItemText
                      primary={activity.name}
                      secondary={`${activity.activity_date} · ${activity.componentLabel} → ${activity.segmentLabel}`}
                    />
                    <PlanningActivityStatusChip status={activity.status} />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </>
      ) : null}
    </Box>
  )
}
