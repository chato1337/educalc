import AddIcon from '@mui/icons-material/Add'
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import {
  buildSegmentTemplates,
  componentNeedsSegments,
  segmentWeightTotalForComponent,
} from '@/features/operations/activityPlanning/activityPlanningUtils'
import {
  createComponentSegment,
  type ComponentSegment,
  type SubjectComponent,
} from '@/features/operations/gradingApi'

export type PlanningSegmentQuickAddProps = {
  schemeId: string
  component: SubjectComponent
  segments: ComponentSegment[]
}

export function PlanningSegmentQuickAdd({
  schemeId,
  component,
  segments,
}: PlanningSegmentQuickAddProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [customName, setCustomName] = useState('')
  const [customWeight, setCustomWeight] = useState('')
  const [error, setError] = useState<string | null>(null)

  const templates = useMemo(
    () =>
      buildSegmentTemplates({
        evaluations: t('activityPlanning.templates.evaluations'),
        workshops: t('activityPlanning.templates.workshops'),
        presentations: t('activityPlanning.templates.presentations'),
        evaluationsHint: t('activityPlanning.templates.evaluationsHint'),
        workshopsHint: t('activityPlanning.templates.workshopsHint'),
        presentationsHint: t('activityPlanning.templates.presentationsHint'),
      }),
    [t],
  )

  const existingNames = useMemo(
    () =>
      new Set(
        segments
          .filter((s) => s.subject_component === component.id)
          .map((s) => s.name.trim().toLowerCase()),
      ),
    [segments, component.id],
  )

  const remainingWeight = useMemo(() => {
    const used = segmentWeightTotalForComponent(segments, component.id)
    return Math.max(0, 100 - used)
  }, [segments, component.id])

  const canAddMore = componentNeedsSegments(segments, component.id)

  const createMutation = useMutation({
    mutationFn: async (params: { name: string; weight: string }) => {
      const weightNum = Number(params.weight.replace(',', '.'))
      if (!Number.isFinite(weightNum) || weightNum <= 0) {
        throw new Error(t('gradingSchemes.invalidWeight'))
      }
      if (weightNum > remainingWeight + 0.01) {
        throw new Error(
          t('gradingSchemes.segmentWeightExceedsRemaining', {
            remaining: remainingWeight.toFixed(2),
          }),
        )
      }
      return createComponentSegment({
        grading_scheme: schemeId,
        subject_component: component.id,
        name: params.name,
        weight_percent: params.weight,
        sort_order: segments.filter((s) => s.subject_component === component.id)
          .length,
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.activityPlanningBundle(schemeId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.gradingSchemeStructure(schemeId),
      })
      setCustomName('')
      setCustomWeight('')
      setError(null)
    },
    onError: (e) => setError(getErrorMessage(e)),
  })

  if (!canAddMore) return null

  return (
    <Box className="flex flex-col gap-2">
      <Typography variant="subtitle2">
        {t('activityPlanning.quickAddSegments')}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {t('gradingSchemes.segmentWeightRemainingHint', {
          remaining: remainingWeight.toFixed(2),
        })}
      </Typography>

      {error ? <Alert severity="error">{error}</Alert> : null}

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {templates.map((template) => {
          const exists = existingNames.has(template.name.toLowerCase())
          return (
            <Card key={template.id} variant="outlined" sx={{ width: 220 }}>
              <CardContent sx={{ pb: 1 }}>
                <Typography variant="subtitle2">{template.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {template.description}
                </Typography>
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  {t('gradingSchemes.weightPercent')}: {template.defaultWeight}%
                </Typography>
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  disabled={exists || createMutation.isPending}
                  onClick={() =>
                    createMutation.mutate({
                      name: template.name,
                      weight: Math.min(
                        Number(template.defaultWeight),
                        remainingWeight,
                      ).toFixed(2),
                    })
                  }
                >
                  {exists
                    ? t('activityPlanning.templateAdded')
                    : t('activityPlanning.addTemplate')}
                </Button>
              </CardActions>
            </Card>
          )
        })}
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
        <TextField
          size="small"
          label={t('gradingSchemes.name')}
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
        />
        <TextField
          size="small"
          label={t('gradingSchemes.weightPercent')}
          value={customWeight}
          onChange={(e) => setCustomWeight(e.target.value)}
          placeholder={remainingWeight.toFixed(2)}
        />
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          disabled={!customName.trim() || createMutation.isPending}
          onClick={() =>
            createMutation.mutate({
              name: customName.trim(),
              weight: customWeight.trim() || remainingWeight.toFixed(2),
            })
          }
        >
          {t('gradingSchemes.addSegment')}
        </Button>
      </Stack>
    </Box>
  )
}
