import {
  Alert,
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { apiClient } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import { ActivityScoresGrid } from '@/features/operations/activityPlanning/ActivityScoresGrid'
import {
  fetchGradingActivitiesForScheme,
  type GradingActivity,
  type GradingScheme,
} from '@/features/operations/gradingApi'
import { fetchAllEnrollments } from '@/features/operations/operationsQueries'

export type GradingSchemeScoresPanelProps = {
  scheme: GradingScheme
  courseAssignmentId: string
  academicYearId: string | null
}

export function GradingSchemeScoresPanel({
  scheme,
  courseAssignmentId,
  academicYearId,
}: GradingSchemeScoresPanelProps) {
  const { t } = useTranslation()
  const [selectedActivityId, setSelectedActivityId] = useState<string>('')

  const { data: activities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: [...queryKeys.gradingSchemeStructure(scheme.id), 'activities'],
    queryFn: () => fetchGradingActivitiesForScheme(scheme.id),
  })

  const sortedActivities = useMemo(
    () =>
      [...activities].sort((a, b) => {
        const cmp = a.component_name.localeCompare(b.component_name, 'es')
        if (cmp !== 0) return cmp
        const seg = a.segment_name.localeCompare(b.segment_name, 'es')
        if (seg !== 0) return seg
        return (a.sort_order ?? 0) - (b.sort_order ?? 0)
      }),
    [activities],
  )

  useEffect(() => {
    if (selectedActivityId) return
    if (sortedActivities[0]?.id) setSelectedActivityId(sortedActivities[0].id)
  }, [sortedActivities, selectedActivityId])

  const selectedActivity = sortedActivities.find(
    (activity) => activity.id === selectedActivityId,
  )

  const { data: enrollments = [], isLoading: enrollmentsLoading } = useQuery({
    queryKey: queryKeys.enrollments({
      academic_year: academicYearId ?? undefined,
      group: undefined,
      status: 'active',
    }),
    queryFn: async () => {
      const { data: assignment } = await apiClient.get<{
        group: string
      }>(`/api/course-assignments/${courseAssignmentId}/`)
      return fetchAllEnrollments({
        academic_year: academicYearId!,
        group: assignment.group,
        status: 'active',
      })
    },
    enabled: !!academicYearId && !!courseAssignmentId,
  })

  function activityLabel(activity: GradingActivity): string {
    return `${activity.component_name} › ${activity.segment_name} › ${activity.name} (${activity.activity_date})`
  }

  const loading = activitiesLoading || enrollmentsLoading

  return (
    <Box className="flex flex-col gap-3">
      <Typography variant="body2" color="text.secondary">
        {t('gradingSchemes.scoresHint')}
      </Typography>

      {sortedActivities.length === 0 ? (
        <Alert severity="info">{t('gradingSchemes.noActivitiesForScores')}</Alert>
      ) : (
        <>
          <FormControl size="small" sx={{ maxWidth: 480 }}>
            <InputLabel>{t('gradingSchemes.selectActivity')}</InputLabel>
            <Select
              label={t('gradingSchemes.selectActivity')}
              value={selectedActivityId}
              onChange={(event) => setSelectedActivityId(String(event.target.value))}
            >
              {sortedActivities.map((activity) => (
                <MenuItem key={activity.id} value={activity.id}>
                  {activityLabel(activity)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {selectedActivity && !loading ? (
            <ActivityScoresGrid
              schemeId={scheme.id}
              activityId={selectedActivity.id}
              maxScore={selectedActivity.max_score ?? '5.00'}
              enrollments={enrollments}
            />
          ) : null}
        </>
      )}
    </Box>
  )
}
