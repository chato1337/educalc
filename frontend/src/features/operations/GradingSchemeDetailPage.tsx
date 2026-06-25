import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { GradingSchemeBreakdownPanel } from '@/features/operations/GradingSchemeBreakdownPanel'
import { GradingSchemeScoresPanel } from '@/features/operations/GradingSchemeScoresPanel'
import { GradingSchemeStructurePanel } from '@/features/operations/GradingSchemeStructurePanel'
import { fetchGradingScheme, formatGradingSchemeOptionLabel } from '@/features/operations/gradingApi'
import type { CourseAssignment } from '@/types/schemas'

export function GradingSchemeDetailPage() {
  const { t } = useTranslation()
  const { id = '' } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const tabFromQuery = Number(searchParams.get('tab'))
  const [tab, setTab] = useState(
    Number.isInteger(tabFromQuery) && tabFromQuery >= 0 && tabFromQuery <= 2
      ? tabFromQuery
      : 0,
  )

  useEffect(() => {
    if (
      Number.isInteger(tabFromQuery) &&
      tabFromQuery >= 0 &&
      tabFromQuery <= 2
    ) {
      setTab(tabFromQuery)
    }
  }, [tabFromQuery])

  const {
    data: scheme,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.gradingScheme(id),
    queryFn: () => fetchGradingScheme(id),
    enabled: !!id,
  })

  const { data: courseAssignment } = useQuery({
    queryKey: ['course-assignments', 'detail', scheme?.course_assignment ?? ''],
    queryFn: async () => {
      const { data } = await apiClient.get<CourseAssignment>(
        `/api/course-assignments/${scheme!.course_assignment}/`,
      )
      return data
    },
    enabled: !!scheme?.course_assignment,
  })

  if (!id) {
    return <Alert severity="error">{t('gradingSchemes.invalidId')}</Alert>
  }

  if (error) {
    return <Alert severity="error">{getErrorMessage(error)}</Alert>
  }

  if (isLoading || !scheme) {
    return (
      <Typography color="text.secondary">{t('common.loading')}</Typography>
    )
  }

  return (
    <Box className="flex flex-col gap-4">
      <Button
        component={RouterLink}
        to="/activity-grading/schemes"
        startIcon={<ArrowBackIcon />}
        sx={{ alignSelf: 'flex-start' }}
      >
        {t('gradingSchemes.backToList')}
      </Button>

      <Typography variant="h6">{t('gradingSchemes.detailTitle')}</Typography>
      <Typography variant="body2" color="text.secondary">
        {formatGradingSchemeOptionLabel(scheme)}
      </Typography>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <StackMeta scheme={scheme} teacher={scheme.course_assignment_teacher_name} />
      </Paper>

      <Paper sx={{ width: '100%' }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label={t('gradingSchemes.tabStructure')} />
          <Tab label={t('gradingSchemes.tabScores')} />
          <Tab label={t('gradingSchemes.tabBreakdown')} />
        </Tabs>
        <Box sx={{ p: 2 }}>
          {tab === 0 ? (
            <GradingSchemeStructurePanel
              scheme={scheme}
              subjectId={courseAssignment?.subject ?? ''}
            />
          ) : null}
          {tab === 1 ? (
            <GradingSchemeScoresPanel
              scheme={scheme}
              courseAssignmentId={scheme.course_assignment}
              academicYearId={courseAssignment?.academic_year ?? null}
            />
          ) : null}
          {tab === 2 ? <GradingSchemeBreakdownPanel scheme={scheme} /> : null}
        </Box>
      </Paper>
    </Box>
  )
}

function StackMeta({
  scheme,
  teacher,
}: {
  scheme: {
    is_active?: boolean
    subject_component_weights_valid?: boolean
    segment_weights_valid?: boolean
    course_assignment_teacher_name: string
  }
  teacher: string
}) {
  const { t } = useTranslation()
  const weightsOk =
    scheme.subject_component_weights_valid && scheme.segment_weights_valid
  return (
    <Box className="flex flex-wrap gap-2 items-center">
      <Typography variant="body2" color="text.secondary" sx={{ mr: 2 }}>
        {t('gradingSchemes.teacher')}: {teacher}
      </Typography>
      <Chip
        size="small"
        label={
          scheme.is_active
            ? t('gradingSchemes.activeScheme')
            : t('gradingSchemes.inactiveScheme')
        }
        color={scheme.is_active ? 'success' : 'default'}
        variant="outlined"
      />
      <Chip
        size="small"
        label={
          weightsOk
            ? t('gradingSchemes.weightsOk')
            : t('gradingSchemes.weightsInvalid')
        }
        color={weightsOk ? 'success' : 'warning'}
        variant="outlined"
      />
    </Box>
  )
}
