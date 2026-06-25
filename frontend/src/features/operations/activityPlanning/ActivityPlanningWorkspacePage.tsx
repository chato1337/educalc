import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom'

import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { PlanningActivityDialog } from '@/features/operations/activityPlanning/PlanningActivityDialog'
import { PlanningActivityStatusChip } from '@/features/operations/activityPlanning/PlanningActivityStatusChip'
import { PlanningSchemeSelector } from '@/features/operations/activityPlanning/PlanningSchemeSelector'
import { PlanningSegmentQuickAdd } from '@/features/operations/activityPlanning/PlanningSegmentQuickAdd'
import {
  usePlanningSchemeBundle,
  usePlanningSchemeSelection,
} from '@/features/operations/activityPlanning/planningQueries'
import {
  segmentWeightTotalForComponent,
  type EnrichedPlanningActivity,
} from '@/features/operations/activityPlanning/activityPlanningUtils'
import {
  deleteGradingActivity,
  formatGradingSchemeOptionLabel,
  type GradingActivity,
} from '@/features/operations/gradingApi'
import { useUiStore } from '@/stores/uiStore'

export function ActivityPlanningWorkspacePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { schemeId: routeSchemeId } = useParams<{ schemeId?: string }>()
  const selectedInstitutionId = useUiStore((s) => s.selectedInstitutionId)
  const queryClient = useQueryClient()

  const {
    schemeId: querySchemeId,
    setSchemeId,
    schemes,
    schemesLoading,
    selectedScheme,
  } = usePlanningSchemeSelection(selectedInstitutionId)

  const effectiveSchemeId = routeSchemeId ?? querySchemeId
  const bundleQuery = usePlanningSchemeBundle(effectiveSchemeId)

  const [activityDialog, setActivityDialog] = useState<{
    segmentId: string
    segmentName: string
    editing?: GradingActivity | null
  } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<EnrichedPlanningActivity | null>(
    null,
  )

  const sortedComponents = useMemo(() => {
    if (!bundleQuery.data) return []
    return [...bundleQuery.data.components].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    )
  }, [bundleQuery.data])

  const segmentsByComponent = useMemo(() => {
    const map = new Map<
      string,
      NonNullable<typeof bundleQuery.data>['segments']
    >()
    if (!bundleQuery.data) return map
    for (const segment of bundleQuery.data.segments) {
      const list = map.get(segment.subject_component) ?? []
      list.push(segment)
      map.set(segment.subject_component, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    }
    return map
  }, [bundleQuery.data])

  const activitiesBySegment = useMemo(() => {
    const map = new Map<string, EnrichedPlanningActivity[]>()
    if (!bundleQuery.data) return map
    for (const activity of bundleQuery.data.enrichedActivities) {
      const list = map.get(activity.segment) ?? []
      list.push(activity)
      map.set(activity.segment, list)
    }
    return map
  }, [bundleQuery.data])

  const deleteMutation = useMutation({
    mutationFn: (activityId: string) => deleteGradingActivity(activityId),
    onSuccess: () => {
      if (effectiveSchemeId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.activityPlanningBundle(effectiveSchemeId),
        })
      }
      setDeleteTarget(null)
    },
  })

  function handleSchemePick(scheme: typeof selectedScheme) {
    setSchemeId(scheme?.id ?? null)
    if (scheme?.id) {
      navigate(`/activity-planning/workspace/${scheme.id}`)
    } else {
      navigate('/activity-planning/workspace')
    }
  }

  if (!routeSchemeId) {
    return (
      <Box className="flex flex-col gap-4">
        <Typography variant="h6">{t('activityPlanning.workspaceTitle')}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t('activityPlanning.workspacePickHint')}
        </Typography>
        <PlanningSchemeSelector
          schemes={schemes}
          loading={schemesLoading}
          value={selectedScheme}
          onChange={handleSchemePick}
          institutionSelected={Boolean(selectedInstitutionId)}
        />
      </Box>
    )
  }

  if (bundleQuery.error) {
    return <Alert severity="error">{getErrorMessage(bundleQuery.error)}</Alert>
  }

  if (bundleQuery.isLoading || !bundleQuery.data) {
    return (
      <Typography color="text.secondary">{t('common.loading')}</Typography>
    )
  }

  const { scheme } = bundleQuery.data

  return (
    <Box className="flex flex-col gap-4">
      <Button
        component={RouterLink}
        to="/activity-planning"
        startIcon={<ArrowBackIcon />}
        sx={{ alignSelf: 'flex-start' }}
      >
        {t('activityPlanning.backToOverview')}
      </Button>

      <Typography variant="h6">{t('activityPlanning.workspaceTitle')}</Typography>
      <Typography variant="body2" color="text.secondary">
        {formatGradingSchemeOptionLabel(scheme)}
      </Typography>

      <Alert severity="info">{t('activityPlanning.workspaceHint')}</Alert>

      {!scheme.subject_component_weights_valid ? (
        <Alert severity="warning">
          {t('gradingSchemes.componentCatalogWeightsInvalid')}
        </Alert>
      ) : null}

      <Stack direction="row" spacing={1} flexWrap="wrap">
        <Chip
          size="small"
          label={
            scheme.segment_weights_valid
              ? t('gradingSchemes.schemeWeightsOk')
              : t('gradingSchemes.schemeWeightsInvalid')
          }
          color={scheme.segment_weights_valid ? 'success' : 'warning'}
        />
        <Button
          component={RouterLink}
          to={`/activity-grading/schemes/${scheme.id}`}
          size="small"
          endIcon={<OpenInNewIcon />}
        >
          {t('activityPlanning.openGradingModule')}
        </Button>
      </Stack>

      {sortedComponents.length === 0 ? (
        <Alert severity="warning">{t('gradingSchemes.noSubjectComponents')}</Alert>
      ) : (
        sortedComponents.map((component) => {
          const componentSegments = segmentsByComponent.get(component.id) ?? []
          const segmentTotal = segmentWeightTotalForComponent(
            bundleQuery.data.segments,
            component.id,
          )
          const segmentsOk = Math.abs(segmentTotal - 100) <= 0.01

          return (
            <Accordion key={component.id} defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems={{ sm: 'center' }}
                  sx={{ width: '100%', pr: 1 }}
                >
                  <Typography fontWeight={600}>{component.name}</Typography>
                  <Chip size="small" label={`${component.weight_percent}%`} />
                  <Chip
                    size="small"
                    color={segmentsOk ? 'success' : 'warning'}
                    label={
                      componentSegments.length === 0
                        ? t('gradingSchemes.noSegmentsYet')
                        : t('gradingSchemes.segmentWeightsSum', {
                            sum: segmentTotal.toFixed(2),
                          })
                    }
                  />
                </Stack>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <PlanningSegmentQuickAdd
                    schemeId={scheme.id}
                    component={component}
                    segments={bundleQuery.data.segments}
                  />

                  {componentSegments.length === 0 ? (
                    <Typography color="text.secondary">
                      {t('activityPlanning.noSegmentsWorkspace')}
                    </Typography>
                  ) : (
                    componentSegments.map((segment) => {
                      const segmentActivities =
                        activitiesBySegment.get(segment.id) ?? []
                      return (
                        <Paper key={segment.id} variant="outlined" sx={{ p: 2 }}>
                          <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1}
                            alignItems={{ sm: 'center' }}
                            justifyContent="space-between"
                            sx={{ mb: 1 }}
                          >
                            <Box>
                              <Typography variant="subtitle1">
                                {segment.name}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {segment.weight_percent}%
                                {segment.description
                                  ? ` · ${segment.description}`
                                  : ''}
                              </Typography>
                            </Box>
                            <Button
                              size="small"
                              startIcon={<AddIcon />}
                              variant="outlined"
                              onClick={() =>
                                setActivityDialog({
                                  segmentId: segment.id,
                                  segmentName: segment.name,
                                })
                              }
                            >
                              {t('gradingSchemes.addActivity')}
                            </Button>
                          </Stack>

                          {segmentActivities.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                              {t('activityPlanning.noActivitiesSegment')}
                            </Typography>
                          ) : (
                            <Stack spacing={1}>
                              {segmentActivities.map((activity) => (
                                <Paper
                                  key={activity.id}
                                  variant="outlined"
                                  sx={{ p: 1.5 }}
                                >
                                  <Stack
                                    direction={{ xs: 'column', sm: 'row' }}
                                    spacing={1}
                                    alignItems={{ sm: 'center' }}
                                    justifyContent="space-between"
                                  >
                                    <Box>
                                      <Typography variant="subtitle2">
                                        {activity.name}
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        color="text.secondary"
                                      >
                                        {activity.activity_date} · max{' '}
                                        {activity.max_score}
                                      </Typography>
                                    </Box>
                                    <Stack direction="row" spacing={0.5}>
                                      <PlanningActivityStatusChip
                                        status={activity.status}
                                      />
                                      <IconButton
                                        size="small"
                                        aria-label={t('gradingSchemes.editActivity')}
                                        onClick={() =>
                                          setActivityDialog({
                                            segmentId: segment.id,
                                            segmentName: segment.name,
                                            editing: activity,
                                          })
                                        }
                                      >
                                        <EditIcon fontSize="small" />
                                      </IconButton>
                                      <IconButton
                                        size="small"
                                        color="error"
                                        aria-label={t('gradingSchemes.deleteEntity')}
                                        onClick={() => setDeleteTarget(activity)}
                                      >
                                        <DeleteOutlineIcon fontSize="small" />
                                      </IconButton>
                                    </Stack>
                                  </Stack>
                                </Paper>
                              ))}
                            </Stack>
                          )}
                        </Paper>
                      )
                    })
                  )}
                </Stack>
              </AccordionDetails>
            </Accordion>
          )
        })
      )}

      {activityDialog ? (
        <PlanningActivityDialog
          open
          onClose={() => setActivityDialog(null)}
          schemeId={scheme.id}
          segmentId={activityDialog.segmentId}
          segmentName={activityDialog.segmentName}
          editing={activityDialog.editing}
        />
      ) : null}

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>{t('gradingSchemes.deleteEntity')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('gradingSchemes.deleteEntityPrompt', {
              name: deleteTarget?.name ?? '',
            })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>
            {t('common.cancel')}
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
            }}
          >
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
