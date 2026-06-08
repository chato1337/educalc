import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import type { AutocompleteRenderInputParams } from '@mui/material/Autocomplete'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import {
  applyGradingSchemeSuggestion,
  fetchGradingSchemeBreakdown,
  type GradeBreakdown,
  type GradingScheme,
} from '@/features/operations/gradingApi'
import { useStudentsSearch } from '@/features/operations/operationsQueries'
import type { Student } from '@/types/schemas'

export type GradingSchemeBreakdownPanelProps = {
  scheme: GradingScheme
}

function BreakdownTree({ breakdown }: { breakdown: GradeBreakdown }) {
  const { t } = useTranslation()
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1">
        {t('gradingSchemes.suggestedGrade')}:{' '}
        <strong>
          {breakdown.suggested_grade != null && breakdown.suggested_grade !== ''
            ? breakdown.suggested_grade
            : '—'}
        </strong>
      </Typography>
      {breakdown.components.map((component) => (
        <Paper key={component.component_id} variant="outlined" sx={{ p: 2 }}>
          <Typography fontWeight={600}>
            {component.name} ({component.weight_percent}%)
            {component.component_score != null
              ? ` → ${component.component_score}`
              : ''}
          </Typography>
          <Stack spacing={1.5} sx={{ mt: 1, pl: 1 }}>
            {component.segments.map((segment) => (
              <Box key={segment.segment_id}>
                <Typography variant="body2" fontWeight={500}>
                  {segment.name} ({segment.weight_percent}%)
                  {segment.segment_average != null
                    ? ` · prom. ${segment.segment_average}`
                    : ''}
                </Typography>
                <Stack spacing={0.25} sx={{ pl: 2, mt: 0.5 }}>
                  {segment.activities.map((activity) => (
                    <Typography key={activity.activity_id} variant="caption">
                      {activity.name} ({activity.activity_date}):{' '}
                      {activity.score != null && activity.score !== ''
                        ? activity.score
                        : '—'}{' '}
                      / {activity.max_score}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        </Paper>
      ))}
    </Stack>
  )
}

export function GradingSchemeBreakdownPanel({
  scheme,
}: GradingSchemeBreakdownPanelProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [studentSearchInput, setStudentSearchInput] = useState('')
  const [appliedStudentSearch, setAppliedStudentSearch] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [applyMessage, setApplyMessage] = useState<string | null>(null)
  const [applyError, setApplyError] = useState<string | null>(null)

  const { data: studentOptions = [] } = useStudentsSearch(appliedStudentSearch)

  const breakdownQuery = useQuery({
    queryKey: queryKeys.gradingSchemeBreakdown(
      scheme.id,
      selectedStudent?.id ?? '',
    ),
    queryFn: () =>
      fetchGradingSchemeBreakdown(scheme.id, selectedStudent!.id),
    enabled: !!selectedStudent?.id,
  })

  const applyMutation = useMutation({
    mutationFn: () =>
      applyGradingSchemeSuggestion(scheme.id, selectedStudent!.id),
    onSuccess: (data) => {
      setApplyError(null)
      setApplyMessage(
        t('gradingSchemes.applySuccess', {
          grade: data.numerical_grade,
          level: data.performance_level_name ?? '—',
          created: data.created
            ? t('gradingSchemes.gradeCreated')
            : t('gradingSchemes.gradeUpdated'),
        }),
      )
      void queryClient.invalidateQueries({ queryKey: ['grades'] })
    },
    onError: (e) => {
      setApplyMessage(null)
      setApplyError(getErrorMessage(e))
    },
  })

  return (
    <Box className="flex flex-col gap-3">
      <Typography variant="body2" color="text.secondary">
        {t('gradingSchemes.breakdownHint')}
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="flex-start">
        <TextField
          size="small"
          label={t('gradingSchemes.searchStudent')}
          value={studentSearchInput}
          onChange={(e) => setStudentSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setAppliedStudentSearch(studentSearchInput)
          }}
          sx={{ minWidth: 200, flex: 1 }}
        />
        <Button
          variant="outlined"
          onClick={() => setAppliedStudentSearch(studentSearchInput)}
        >
          {t('common.search')}
        </Button>
      </Stack>

      <Autocomplete
        options={studentOptions}
        getOptionKey={(o: Student) => o.id}
        getOptionLabel={(o: Student) => o.full_name}
        value={selectedStudent}
        onChange={(_, v) => {
          setSelectedStudent(v)
          setApplyMessage(null)
          setApplyError(null)
        }}
        renderInput={(params: AutocompleteRenderInputParams) => (
          <TextField
            {...params}
            label={t('gradingSchemes.student')}
            required
          />
        )}
      />

      {breakdownQuery.error ? (
        <Alert severity="error">{getErrorMessage(breakdownQuery.error)}</Alert>
      ) : null}

      {breakdownQuery.isLoading && selectedStudent ? (
        <Typography variant="body2" color="text.secondary">
          {t('common.loading')}
        </Typography>
      ) : null}

      {breakdownQuery.data ? (
        <>
          <BreakdownTree breakdown={breakdownQuery.data} />
          <Button
            variant="contained"
            startIcon={<CheckCircleOutlineIcon />}
            disabled={
              !selectedStudent ||
              applyMutation.isPending ||
              breakdownQuery.data.suggested_grade == null ||
              breakdownQuery.data.suggested_grade === ''
            }
            onClick={() => applyMutation.mutate()}
          >
            {t('gradingSchemes.applySuggestion')}
          </Button>
        </>
      ) : null}

      {applyMessage ? <Alert severity="success">{applyMessage}</Alert> : null}
      {applyError ? <Alert severity="error">{applyError}</Alert> : null}
    </Box>
  )
}
