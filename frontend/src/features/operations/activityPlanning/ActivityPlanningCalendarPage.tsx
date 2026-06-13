import AddIcon from '@mui/icons-material/Add'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import EditIcon from '@mui/icons-material/Edit'
import GradeIcon from '@mui/icons-material/Grade'
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getErrorMessage } from '@/api/errors'
import { PlanningActivityDialog } from '@/features/operations/activityPlanning/PlanningActivityDialog'
import { PlanningActivityGradingDialog } from '@/features/operations/activityPlanning/PlanningActivityGradingDialog'
import { PlanningActivityStatusChip } from '@/features/operations/activityPlanning/PlanningActivityStatusChip'
import { PlanningSchemeSelector } from '@/features/operations/activityPlanning/PlanningSchemeSelector'
import {
  usePlanningSchemeBundle,
  usePlanningSchemeSelection,
} from '@/features/operations/activityPlanning/planningQueries'
import {
  activitiesForDate,
  addMonths,
  calendarGridDays,
  dateToIso,
  formatMonthYear,
  type EnrichedPlanningActivity,
} from '@/features/operations/activityPlanning/activityPlanningUtils'
import type { GradingActivity } from '@/features/operations/gradingApi'
import { useUiStore } from '@/stores/uiStore'

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

export function ActivityPlanningCalendarPage() {
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
  const [viewMonth, setViewMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [activityDialog, setActivityDialog] = useState<{
    segmentId?: string
    segmentName?: string
    editing?: GradingActivity | null
    defaultDate?: string
  } | null>(null)
  const [gradingActivity, setGradingActivity] =
    useState<EnrichedPlanningActivity | null>(null)

  const gridDays = useMemo(() => calendarGridDays(viewMonth), [viewMonth])
  const segmentOptions = useMemo(() => {
    if (!bundleQuery.data) return []
    const componentById = new Map(
      bundleQuery.data.components.map((component) => [component.id, component]),
    )
    return [...bundleQuery.data.segments]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((segment) => ({
        id: segment.id,
        name: segment.name,
        componentName:
          componentById.get(segment.subject_component)?.name ?? undefined,
      }))
  }, [bundleQuery.data])
  const activitiesByDate = useMemo(() => {
    const map = new Map<string, EnrichedPlanningActivity[]>()
    for (const activity of bundleQuery.data?.enrichedActivities ?? []) {
      const list = map.get(activity.activity_date) ?? []
      list.push(activity)
      map.set(activity.activity_date, list)
    }
    return map
  }, [bundleQuery.data?.enrichedActivities])

  const openCreateDialog = (iso: string) => {
    setSelectedDate(iso)
    setActivityDialog({ defaultDate: iso })
  }

  const selectedDayActivities = useMemo(() => {
    if (!selectedDate || !bundleQuery.data) return []
    return activitiesForDate(bundleQuery.data.enrichedActivities, selectedDate)
  }, [selectedDate, bundleQuery.data])

  return (
    <Box className="flex flex-col gap-4">
      <Typography variant="h6">{t('activityPlanning.calendarTitle')}</Typography>
      <Typography variant="body2" color="text.secondary">
        {t('activityPlanning.calendarHint')}
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

      {schemeId && bundleQuery.data ? (
        <>
          <Stack direction="row" alignItems="center" spacing={1}>
            <IconButton
              aria-label={t('activityPlanning.prevMonth')}
              onClick={() => setViewMonth((d) => addMonths(d, -1))}
            >
              <ChevronLeftIcon />
            </IconButton>
            <Typography variant="subtitle1" sx={{ flex: 1, textAlign: 'center' }}>
              {formatMonthYear(viewMonth)}
            </Typography>
            <IconButton
              aria-label={t('activityPlanning.nextMonth')}
              onClick={() => setViewMonth((d) => addMonths(d, 1))}
            >
              <ChevronRightIcon />
            </IconButton>
          </Stack>

          <Paper variant="outlined" sx={{ p: 1 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                gap: 0.5,
              }}
            >
              {WEEKDAY_KEYS.map((key) => (
                <Typography
                  key={key}
                  variant="caption"
                  color="text.secondary"
                  sx={{ textAlign: 'center', py: 0.5, fontWeight: 600 }}
                >
                  {t(`activityPlanning.weekdays.${key}`)}
                </Typography>
              ))}

              {gridDays.map((day, index) => {
                if (!day) {
                  return <Box key={`empty-${index}`} sx={{ minHeight: 88 }} />
                }
                const iso = dateToIso(day)
                const dayActivities = activitiesByDate.get(iso) ?? []
                const isSelected = selectedDate === iso
                const isToday = iso === bundleQuery.data.today

                return (
                  <Paper
                    key={iso}
                    variant="outlined"
                    onClick={() => setSelectedDate(iso)}
                    sx={{
                      minHeight: 88,
                      p: 0.75,
                      cursor: 'pointer',
                      borderColor: isSelected ? 'primary.main' : undefined,
                      bgcolor: isToday ? 'action.hover' : undefined,
                      '&:hover .calendar-day-add': {
                        opacity: 1,
                      },
                    }}
                  >
                    <Stack
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <Typography variant="caption" fontWeight={isToday ? 700 : 400}>
                        {day.getDate()}
                      </Typography>
                      <IconButton
                        className="calendar-day-add"
                        size="small"
                        aria-label={t('activityPlanning.addActivityOnDay')}
                        disabled={segmentOptions.length === 0}
                        onClick={(event) => {
                          event.stopPropagation()
                          openCreateDialog(iso)
                        }}
                        sx={{
                          opacity: 0.5,
                          p: 0.25,
                          transition: 'opacity 0.15s',
                        }}
                      >
                        <AddIcon sx={{ fontSize: '0.9rem' }} />
                      </IconButton>
                    </Stack>
                    <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                      {dayActivities.slice(0, 2).map((activity) => (
                        <Chip
                          key={activity.id}
                          size="small"
                          label={activity.name}
                          color={
                            activity.status === 'planned'
                              ? 'info'
                              : activity.status === 'due'
                                ? 'warning'
                                : activity.status === 'completed'
                                  ? 'success'
                                  : 'default'
                          }
                          sx={{
                            height: 20,
                            '& .MuiChip-label': {
                              px: 0.5,
                              fontSize: '0.65rem',
                            },
                          }}
                        />
                      ))}
                      {dayActivities.length > 2 ? (
                        <Typography variant="caption" color="text.secondary">
                          +{dayActivities.length - 2}
                        </Typography>
                      ) : null}
                    </Stack>
                  </Paper>
                )
              })}
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              {selectedDate
                ? t('activityPlanning.dayDetail', { date: selectedDate })
                : t('activityPlanning.selectDayHint')}
            </Typography>

            {selectedDate && selectedDayActivities.length === 0 ? (
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                {t('activityPlanning.noActivitiesDay')}
              </Typography>
            ) : null}

            <Stack spacing={1}>
              {selectedDayActivities.map((activity) => (
                <Paper key={activity.id} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    alignItems={{ sm: 'center' }}
                    justifyContent="space-between"
                  >
                    <Box>
                      <Typography variant="subtitle2">{activity.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {activity.componentLabel} → {activity.segmentLabel}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('activityPlanning.gradingProgress', {
                          graded: activity.gradedCount,
                          total: bundleQuery.data.enrollmentCount,
                        })}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <PlanningActivityStatusChip status={activity.status} />
                      <IconButton
                        size="small"
                        aria-label={t('gradingSchemes.editActivity')}
                        onClick={() =>
                          setActivityDialog({
                            segmentId: activity.segment,
                            segmentName: activity.segmentLabel,
                            editing: activity,
                          })
                        }
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<GradeIcon />}
                        onClick={() => setGradingActivity(activity)}
                      >
                        {t('activityPlanning.gradeStudents')}
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>

            {selectedDate ? (
              <Button
                sx={{ mt: 2 }}
                startIcon={<AddIcon />}
                variant="outlined"
                disabled={segmentOptions.length === 0}
                onClick={() => openCreateDialog(selectedDate)}
              >
                {t('gradingSchemes.addActivity')}
              </Button>
            ) : null}
          </Paper>
        </>
      ) : null}

      {gradingActivity && schemeId && bundleQuery.data ? (
        <PlanningActivityGradingDialog
          open
          onClose={() => setGradingActivity(null)}
          schemeId={schemeId}
          activity={gradingActivity}
          enrollments={bundleQuery.data.enrollments}
        />
      ) : null}

      {activityDialog && schemeId ? (
        <PlanningActivityDialog
          open
          onClose={() => setActivityDialog(null)}
          schemeId={schemeId}
          segmentId={activityDialog.segmentId}
          segmentName={activityDialog.segmentName}
          segments={activityDialog.editing ? undefined : segmentOptions}
          editing={activityDialog.editing}
          defaultDate={activityDialog.defaultDate}
        />
      ) : null}
    </Box>
  )
}
