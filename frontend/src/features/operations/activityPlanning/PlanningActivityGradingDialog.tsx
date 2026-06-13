import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material'
import { useTranslation } from 'react-i18next'

import { ActivityScoresGrid } from '@/features/operations/activityPlanning/ActivityScoresGrid'
import type { GradingActivity } from '@/features/operations/gradingApi'
import type { Enrollment } from '@/types/schemas'

export type PlanningActivityGradingDialogProps = {
  open: boolean
  onClose: () => void
  schemeId: string
  activity: GradingActivity
  enrollments: Enrollment[]
}

export function PlanningActivityGradingDialog({
  open,
  onClose,
  schemeId,
  activity,
  enrollments,
}: PlanningActivityGradingDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t('activityPlanning.gradeActivityTitle', { name: activity.name })}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('gradingSchemes.scoresHint')}
        </Typography>
        <ActivityScoresGrid
          schemeId={schemeId}
          activityId={activity.id}
          maxScore={activity.max_score ?? '5.00'}
          enrollments={enrollments}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  )
}
