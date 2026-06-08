import {
  Alert,
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Typography,
} from '@mui/material'
import {
  DataGrid,
  type GridColDef,
  type GridRowModel,
} from '@mui/x-data-grid'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { apiClient } from '@/api/client'
import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import {
  dataGridDefaultSx,
  useMuiDataGridLocaleText,
} from '@/hooks/useMuiDataGridLocaleText'
import {
  createStudentActivityScore,
  fetchGradingActivitiesForScheme,
  fetchStudentActivityScoresForActivity,
  patchStudentActivityScore,
  type GradingActivity,
  type GradingScheme,
  type StudentActivityScore,
} from '@/features/operations/gradingApi'
import { fetchAllEnrollments } from '@/features/operations/operationsQueries'

const dec = z
  .string()
  .regex(/^-?\d{0,2}(\.\d{0,2})?$/, 'Formato inválido')
  .optional()
  .or(z.literal(''))

type ScoreRow = GridRowModel & {
  id: string
  studentName: string
  documentNumber: string
  scoreId: string | null
  score: string
  notes: string
  maxScore: string
}

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
  const queryClient = useQueryClient()
  const [selectedActivityId, setSelectedActivityId] = useState<string>('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const dataGridLocaleText = useMuiDataGridLocaleText()

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
    (a) => a.id === selectedActivityId,
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

  const scoresQueryKey = queryKeys.studentActivityScores({
    activity: selectedActivityId || undefined,
  })

  const { data: existingScores = [], isLoading: scoresLoading } = useQuery({
    queryKey: scoresQueryKey,
    queryFn: () => fetchStudentActivityScoresForActivity(selectedActivityId),
    enabled: !!selectedActivityId,
  })

  const scoresByStudent = useMemo(() => {
    const map = new Map<string, StudentActivityScore>()
    for (const s of existingScores) map.set(s.student, s)
    return map
  }, [existingScores])

  const rows = useMemo<ScoreRow[]>(() => {
    const maxScore = selectedActivity?.max_score ?? '5.00'
    return enrollments
      .slice()
      .sort((a, b) => a.student_name.localeCompare(b.student_name, 'es'))
      .map((e) => {
        const existing = scoresByStudent.get(e.student)
        return {
          id: e.student,
          studentName: e.student_name,
          documentNumber: e.student_document_number ?? '',
          scoreId: existing?.id ?? null,
          score: existing?.score ?? '',
          notes: existing?.notes ?? '',
          maxScore,
        }
      })
  }, [enrollments, scoresByStudent, selectedActivity?.max_score])

  const saveMutation = useMutation({
    mutationFn: async (row: ScoreRow) => {
      const trimmed = row.score.trim()
      if (!trimmed) {
        if (row.scoreId) {
          return patchStudentActivityScore(row.scoreId, {
            score: null,
            notes: row.notes.trim() || undefined,
          })
        }
        return
      }
      const body = {
        activity: selectedActivityId,
        student: row.id,
        score: trimmed,
        notes: row.notes.trim() || undefined,
      }
      if (row.scoreId) {
        return patchStudentActivityScore(row.scoreId, body)
      }
      return createStudentActivityScore(body)
    },
    onSuccess: () => {
      setSaveError(null)
      void queryClient.invalidateQueries({ queryKey: scoresQueryKey })
      void queryClient.invalidateQueries({
        queryKey: ['grading-schemes', scheme.id, 'breakdown'],
      })
    },
    onError: (e) => setSaveError(getErrorMessage(e)),
  })

  const processRowUpdate = useCallback(
    async (newRow: ScoreRow, oldRow: ScoreRow) => {
      const parsed = dec.safeParse(newRow.score)
      if (!parsed.success && newRow.score.trim() !== '') {
        setSaveError(t('gradingSchemes.invalidScore'))
        return oldRow
      }
      const max = Number(String(newRow.maxScore).replace(',', '.'))
      const val = Number(String(newRow.score).replace(',', '.'))
      if (
        newRow.score.trim() !== '' &&
        Number.isFinite(max) &&
        Number.isFinite(val) &&
        val > max
      ) {
        setSaveError(
          t('gradingSchemes.scoreAboveMax', { max: newRow.maxScore }),
        )
        return oldRow
      }
      await saveMutation.mutateAsync(newRow)
      return newRow
    },
    [saveMutation, t],
  )

  const columns = useMemo<GridColDef<ScoreRow>[]>(
    () => [
      {
        field: 'studentName',
        headerName: t('gradingSchemes.student'),
        flex: 1,
        minWidth: 160,
        editable: false,
      },
      {
        field: 'documentNumber',
        headerName: t('gradingSchemes.document'),
        width: 130,
        editable: false,
      },
      {
        field: 'score',
        headerName: t('gradingSchemes.score'),
        width: 100,
        editable: true,
      },
      {
        field: 'notes',
        headerName: t('gradingSchemes.notes'),
        flex: 1,
        minWidth: 140,
        editable: true,
      },
    ],
    [t],
  )

  function activityLabel(a: GradingActivity): string {
    return `${a.component_name} › ${a.segment_name} › ${a.name} (${a.activity_date})`
  }

  const loading =
    activitiesLoading || enrollmentsLoading || scoresLoading

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
              onChange={(e) => setSelectedActivityId(String(e.target.value))}
            >
              {sortedActivities.map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {activityLabel(a)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {saveError ? <Alert severity="error">{saveError}</Alert> : null}
      <Alert severity="info" sx={{ mb: 1 }}>
        {t('gradingSchemes.scorePendingHint')}
      </Alert>

          <Paper sx={{ width: '100%', overflow: 'hidden' }}>
            <DataGrid
              rows={rows}
              columns={columns}
              loading={loading}
              autoHeight
              hideFooter
              disableRowSelectionOnClick
              disableColumnMenu
              editMode="cell"
              processRowUpdate={processRowUpdate}
              onProcessRowUpdateError={() => {}}
              localeText={dataGridLocaleText}
              sx={dataGridDefaultSx}
            />
          </Paper>
        </>
      )}
    </Box>
  )
}
