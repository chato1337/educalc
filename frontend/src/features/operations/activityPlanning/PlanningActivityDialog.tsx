import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { todayIsoDate } from '@/features/operations/activityPlanning/activityPlanningUtils'
import {
  createGradingActivity,
  patchGradingActivity,
  type GradingActivity,
} from '@/features/operations/gradingApi'

const formSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().optional(),
  activity_date: z.string().min(1),
  max_score: z.string().optional(),
  sort_order: z.coerce.number().int().min(0).max(32767).optional(),
})

type FormValues = z.infer<typeof formSchema>

export type PlanningActivityDialogProps = {
  open: boolean
  onClose: () => void
  schemeId: string
  segmentId: string
  segmentName?: string
  editing?: GradingActivity | null
  defaultDate?: string
  nameSuggestion?: string
}

export function PlanningActivityDialog({
  open,
  onClose,
  schemeId,
  segmentId,
  segmentName,
  editing,
  defaultDate,
  nameSuggestion,
}: PlanningActivityDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: {
      name: '',
      description: '',
      activity_date: todayIsoDate(),
      max_score: '5.00',
      sort_order: 0,
    },
  })

  useEffect(() => {
    if (!open) return
    form.reset({
      name: editing?.name ?? nameSuggestion ?? '',
      description: editing?.description ?? '',
      activity_date: editing?.activity_date ?? defaultDate ?? todayIsoDate(),
      max_score: editing?.max_score ?? '5.00',
      sort_order: editing?.sort_order ?? 0,
    })
  }, [open, editing, defaultDate, nameSuggestion, form])

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const body = {
        segment: segmentId,
        name: values.name,
        description: values.description?.trim() || undefined,
        activity_date: values.activity_date,
        max_score: values.max_score?.trim() || undefined,
        sort_order: values.sort_order ?? 0,
      }
      if (editing) return patchGradingActivity(editing.id, body)
      return createGradingActivity(body)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.activityPlanningBundle(schemeId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.gradingSchemeStructure(schemeId),
      })
      onClose()
    },
  })

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {editing
          ? t('gradingSchemes.editActivity')
          : t('gradingSchemes.newActivity')}
        {segmentName ? ` · ${segmentName}` : ''}
      </DialogTitle>
      <form
        onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
      >
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {saveMutation.error ? (
              <Alert severity="error">{getErrorMessage(saveMutation.error)}</Alert>
            ) : null}
            <TextField
              label={t('gradingSchemes.name')}
              required
              fullWidth
              error={Boolean(form.formState.errors.name)}
              helperText={form.formState.errors.name?.message}
              {...form.register('name')}
            />
            <TextField
              label={t('gradingSchemes.description')}
              fullWidth
              multiline
              minRows={2}
              {...form.register('description')}
            />
            <TextField
              label={t('gradingSchemes.activityDate')}
              type="date"
              required
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              error={Boolean(form.formState.errors.activity_date)}
              helperText={form.formState.errors.activity_date?.message}
              {...form.register('activity_date')}
            />
            <TextField
              label={t('gradingSchemes.maxScore')}
              fullWidth
              {...form.register('max_score')}
            />
            <TextField
              label={t('gradingSchemes.sortOrder')}
              type="number"
              fullWidth
              {...form.register('sort_order')}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={saveMutation.isPending}
          >
            {t('common.save')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
