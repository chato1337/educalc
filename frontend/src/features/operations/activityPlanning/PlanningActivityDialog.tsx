import {
  Alert,
  Button,
  DialogActions,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { FormDialog, FormDialogContent } from '@/components/FormDialog'
import { RichTextEditor } from '@/components/RichTextEditor'
import { normalizeRichText } from '@/components/richTextUtils'
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
  segment: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

export type PlanningSegmentOption = {
  id: string
  name: string
  componentName?: string
}

export type PlanningActivityDialogProps = {
  open: boolean
  onClose: () => void
  schemeId: string
  segmentId?: string
  segmentName?: string
  segments?: PlanningSegmentOption[]
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
  segments,
  editing,
  defaultDate,
  nameSuggestion,
}: PlanningActivityDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const showSegmentPicker =
    !editing && Boolean(segments?.length) && !segmentId
  const hasSegments = Boolean(segmentId || segments?.length)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: {
      name: '',
      description: '',
      activity_date: todayIsoDate(),
      max_score: '5.00',
      sort_order: 0,
      segment: '',
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
      segment: segmentId ?? segments?.[0]?.id ?? '',
    })
  }, [open, editing, defaultDate, nameSuggestion, segmentId, segments, form])

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const effectiveSegmentId = segmentId ?? values.segment
      if (!effectiveSegmentId) {
        throw new Error(t('activityPlanning.selectSegmentRequired'))
      }
      const body = {
        segment: effectiveSegmentId,
        name: values.name,
        description: normalizeRichText(values.description),
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
    <FormDialog
      open={open}
      onClose={onClose}
      title={
        <>
          {editing
            ? t('gradingSchemes.editActivity')
            : t('gradingSchemes.newActivity')}
          {segmentName ? ` · ${segmentName}` : ''}
        </>
      }
    >
      <form
        onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
      >
        <FormDialogContent>
          <Stack spacing={2} sx={{ pt: 1, flex: 1, minHeight: 0 }}>
            {saveMutation.error ? (
              <Alert severity="error">{getErrorMessage(saveMutation.error)}</Alert>
            ) : null}
            {!hasSegments ? (
              <Alert severity="warning">
                {t('activityPlanning.noSegmentsForCreate')}
              </Alert>
            ) : null}
            {showSegmentPicker ? (
              <TextField
                select
                label={t('activityPlanning.selectSegment')}
                required
                fullWidth
                error={Boolean(form.formState.errors.segment)}
                helperText={form.formState.errors.segment?.message}
                {...form.register('segment', { required: true })}
              >
                {segments?.map((segment) => (
                  <MenuItem key={segment.id} value={segment.id}>
                    {segment.componentName
                      ? `${segment.componentName} → ${segment.name}`
                      : segment.name}
                  </MenuItem>
                ))}
              </TextField>
            ) : null}
            <TextField
              label={t('gradingSchemes.name')}
              required
              fullWidth
              error={Boolean(form.formState.errors.name)}
              helperText={form.formState.errors.name?.message}
              {...form.register('name')}
            />
            <Controller
              name="description"
              control={form.control}
              render={({ field }) => (
                <RichTextEditor
                  label={t('gradingSchemes.description')}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                />
              )}
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
          </Stack>
        </FormDialogContent>
        <DialogActions>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={saveMutation.isPending || !hasSegments}
          >
            {t('common.save')}
          </Button>
        </DialogActions>
      </form>
    </FormDialog>
  )
}
