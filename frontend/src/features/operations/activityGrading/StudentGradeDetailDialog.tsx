import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { BreakdownTree } from '@/features/operations/GradingSchemeBreakdownPanel'
import { fetchGradingSchemeBreakdown } from '@/features/operations/gradingApi'

export type StudentGradeDetailDialogProps = {
  open: boolean
  onClose: () => void
  schemeId: string
  studentId: string | null
  studentName: string
  /** Same figure as the row `def` cell, including the display-only 0. */
  headlineGrade: string
}

export function StudentGradeDetailDialog({
  open,
  onClose,
  schemeId,
  studentId,
  studentName,
  headlineGrade,
}: StudentGradeDetailDialogProps) {
  const { t } = useTranslation()
  const breakdownQuery = useQuery({
    queryKey: queryKeys.gradingSchemeBreakdown(schemeId, studentId ?? ''),
    queryFn: () => fetchGradingSchemeBreakdown(schemeId, studentId!),
    enabled: open && Boolean(schemeId && studentId),
  })

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {t('activityGrading.gradeGrid.detailTitle', { name: studentName })}
      </DialogTitle>
      <DialogContent>
        {breakdownQuery.isLoading ? <CircularProgress size={28} /> : null}
        {breakdownQuery.error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {getErrorMessage(breakdownQuery.error)}
          </Alert>
        ) : null}
        {breakdownQuery.data ? (
          <BreakdownTree
            breakdown={breakdownQuery.data}
            headlineGrade={headlineGrade}
          />
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  )
}
