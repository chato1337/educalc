import { Alert, Paper } from '@mui/material'
import {
  DataGrid,
  type GridColDef,
  type GridRowModel,
} from '@mui/x-data-grid'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import {
  dataGridDefaultSx,
  useMuiDataGridLocaleText,
} from '@/hooks/useMuiDataGridLocaleText'
import {
  createStudentActivityScore,
  fetchStudentActivityScoresForActivity,
  patchStudentActivityScore,
  type StudentActivityScore,
} from '@/features/operations/gradingApi'
import type { Enrollment } from '@/types/schemas'

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

export type ActivityScoresGridProps = {
  schemeId: string
  activityId: string
  maxScore: string
  enrollments: Enrollment[]
}

export function ActivityScoresGrid({
  schemeId,
  activityId,
  maxScore,
  enrollments,
}: ActivityScoresGridProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [saveError, setSaveError] = useState<string | null>(null)
  const dataGridLocaleText = useMuiDataGridLocaleText()

  const scoresQueryKey = queryKeys.studentActivityScores({
    activity: activityId,
  })

  const { data: existingScores = [], isLoading: scoresLoading } = useQuery({
    queryKey: scoresQueryKey,
    queryFn: () => fetchStudentActivityScoresForActivity(activityId),
    enabled: !!activityId,
  })

  const scoresByStudent = useMemo(() => {
    const map = new Map<string, StudentActivityScore>()
    for (const score of existingScores) map.set(score.student, score)
    return map
  }, [existingScores])

  const rows = useMemo<ScoreRow[]>(() => {
    return enrollments
      .slice()
      .sort((a, b) => a.student_name.localeCompare(b.student_name, 'es'))
      .map((enrollment) => {
        const existing = scoresByStudent.get(enrollment.student)
        return {
          id: enrollment.student,
          studentName: enrollment.student_name,
          documentNumber: enrollment.student_document_number ?? '',
          scoreId: existing?.id ?? null,
          score: existing?.score ?? '',
          notes: existing?.notes ?? '',
          maxScore,
        }
      })
  }, [enrollments, scoresByStudent, maxScore])

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
        activity: activityId,
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
        queryKey: queryKeys.activityPlanningBundle(schemeId),
      })
      void queryClient.invalidateQueries({
        queryKey: ['grading-schemes', schemeId, 'breakdown'],
      })
    },
    onError: (error) => setSaveError(getErrorMessage(error)),
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

  return (
    <>
      {saveError ? <Alert severity="error">{saveError}</Alert> : null}
      <Alert severity="info" sx={{ mb: 1 }}>
        {t('gradingSchemes.scorePendingHint')}
      </Alert>
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={scoresLoading}
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
  )
}
