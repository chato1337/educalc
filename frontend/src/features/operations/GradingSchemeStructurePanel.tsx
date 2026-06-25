import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { FormDialog, FormDialogContent } from '@/components/FormDialog'
import { RichTextEditor } from '@/components/RichTextEditor'
import { normalizeRichText } from '@/components/richTextUtils'
import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import {
  createComponentSegment,
  createGradingActivity,
  deleteComponentSegment,
  deleteGradingActivity,
  fetchComponentSegmentsForScheme,
  fetchGradingActivitiesForScheme,
  fetchSubjectComponentsForSubject,
  patchComponentSegment,
  patchGradingActivity,
  validateGradingSchemeWeights,
  type ComponentSegment,
  type GradingActivity,
  type GradingScheme,
  type SubjectComponent,
} from '@/features/operations/gradingApi'

const WEIGHT_SUM_TOLERANCE = 0.01

const weightDec = z
  .string()
  .min(1)
  .regex(/^-?\d{0,3}(\.\d{0,2})?$/, 'Formato inválido')

const dialogFormSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().optional(),
  weight_percent: z.string().optional(),
  activity_date: z.string().optional(),
  max_score: z.string().optional(),
  sort_order: z.coerce.number().int().min(0).max(32767).optional(),
})

type DialogFormValues = z.infer<typeof dialogFormSchema>

function parseWeightPercent(value: string | undefined): number | null {
  const parsed = weightDec.safeParse(value ?? '')
  if (!parsed.success) return null
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function segmentWeightTotalForComponent(
  segments: ComponentSegment[],
  componentId: string,
  excludeSegmentId?: string | null,
): number {
  return segments
    .filter(
      (s) =>
        s.subject_component === componentId &&
        (!excludeSegmentId || s.id !== excludeSegmentId),
    )
    .reduce((sum, s) => sum + Number(s.weight_percent), 0)
}

function segmentWeightsValidForComponent(
  segments: ComponentSegment[],
  componentId: string,
): boolean {
  const weights = segments
    .filter((s) => s.subject_component === componentId)
    .map((s) => Number(s.weight_percent))
  if (weights.length === 0) return false
  const total = weights.reduce((sum, w) => sum + w, 0)
  return Math.abs(total - 100) <= WEIGHT_SUM_TOLERANCE
}

function subjectComponentsWeightsValid(components: SubjectComponent[]): boolean {
  if (components.length === 0) return false
  const total = components.reduce(
    (sum, c) => sum + Number(c.weight_percent),
    0,
  )
  return Math.abs(total - 100) <= WEIGHT_SUM_TOLERANCE
}

function validateSegmentWeightInput(
  weightStr: string | undefined,
  componentId: string,
  segments: ComponentSegment[],
  editingId: string | null,
  messages: {
    invalid: string
    max100: string
    exceedsRemaining: (remaining: string) => string
  },
): string | null {
  const weight = parseWeightPercent(weightStr)
  if (weight === null || weight <= 0) return messages.invalid
  if (weight > 100) return messages.max100

  const othersTotal = segmentWeightTotalForComponent(
    segments,
    componentId,
    editingId,
  )
  if (othersTotal + weight > 100 + WEIGHT_SUM_TOLERANCE) {
    return messages.exceedsRemaining(
      Math.max(0, 100 - othersTotal).toFixed(2),
    )
  }
  return null
}

function validateDialogValues(
  dialog: NonNullable<DialogState>,
  values: DialogFormValues,
  segments: ComponentSegment[],
  messages: {
    activityDateRequired: string
    invalidWeight: string
    segmentWeightMax100: string
    segmentWeightExceedsRemaining: (remaining: string) => string
  },
): string | null {
  if (dialog.kind === 'activity') {
    if (!values.activity_date?.trim()) return messages.activityDateRequired
    return null
  }
  return validateSegmentWeightInput(
    values.weight_percent,
    dialog.componentId,
    segments,
    dialog.editing?.id ?? null,
    {
      invalid: messages.invalidWeight,
      max100: messages.segmentWeightMax100,
      exceedsRemaining: messages.segmentWeightExceedsRemaining,
    },
  )
}

type EntityKind = 'segment' | 'activity'

type DialogState =
  | { kind: 'segment'; editing: ComponentSegment | null; componentId: string }
  | {
      kind: 'activity'
      editing: GradingActivity | null
      segmentId: string
    }
  | null

export type GradingSchemeStructurePanelProps = {
  scheme: GradingScheme
  subjectId: string
}

export function GradingSchemeStructurePanel({
  scheme,
  subjectId,
}: GradingSchemeStructurePanelProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<DialogState>(null)
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: EntityKind; id: string; label: string }
    | null
  >(null)
  const [formError, setFormError] = useState<string | null>(null)

  const structureKey = queryKeys.gradingSchemeStructure(scheme.id)

  const { data: components = [], isLoading: componentsLoading } = useQuery({
    queryKey: [...structureKey, 'components', subjectId],
    queryFn: () => fetchSubjectComponentsForSubject(subjectId),
    enabled: !!subjectId,
  })

  const { data: segments = [], isLoading: segmentsLoading } = useQuery({
    queryKey: [...structureKey, 'segments'],
    queryFn: () => fetchComponentSegmentsForScheme(scheme.id),
  })

  const { data: activities = [], isLoading: activitiesLoading } = useQuery({
    queryKey: [...structureKey, 'activities'],
    queryFn: () => fetchGradingActivitiesForScheme(scheme.id),
  })

  const { data: weightsValidation, refetch: refetchWeights } = useQuery({
    queryKey: queryKeys.gradingSchemeValidateWeights(scheme.id),
    queryFn: () => validateGradingSchemeWeights(scheme.id),
  })

  const segmentsByComponent = useMemo(() => {
    const map = new Map<string, ComponentSegment[]>()
    for (const s of segments) {
      const list = map.get(s.subject_component) ?? []
      list.push(s)
      map.set(s.subject_component, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    }
    return map
  }, [segments])

  const activitiesBySegment = useMemo(() => {
    const map = new Map<string, GradingActivity[]>()
    for (const a of activities) {
      const list = map.get(a.segment) ?? []
      list.push(a)
      map.set(a.segment, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    }
    return map
  }, [activities])

  const sortedComponents = useMemo(
    () =>
      [...components].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
      ),
    [components],
  )

  const catalogWeightsValid = useMemo(
    () => subjectComponentsWeightsValid(sortedComponents),
    [sortedComponents],
  )

  const segmentDialogRemaining = useMemo(() => {
    if (dialog?.kind !== 'segment') return null
    const used = segmentWeightTotalForComponent(
      segments,
      dialog.componentId,
      dialog.editing?.id ?? null,
    )
    return Math.max(0, 100 - used)
  }, [dialog, segments])

  const validationMessages = useMemo(
    () => ({
      activityDateRequired: t('gradingSchemes.activityDateRequired'),
      invalidWeight: t('gradingSchemes.invalidWeight'),
      segmentWeightMax100: t('gradingSchemes.segmentWeightMax100'),
      segmentWeightExceedsRemaining: (remaining: string) =>
        t('gradingSchemes.segmentWeightExceedsRemaining', { remaining }),
    }),
    [t],
  )

  const form = useForm<DialogFormValues>({
    resolver: zodResolver(dialogFormSchema) as Resolver<DialogFormValues>,
    defaultValues: {
      name: '',
      description: '',
      weight_percent: '',
      activity_date: '',
      max_score: '5.00',
      sort_order: 0,
    },
  })

  function invalidateStructure() {
    void queryClient.invalidateQueries({ queryKey: structureKey })
    void queryClient.invalidateQueries({
      queryKey: queryKeys.gradingSchemeValidateWeights(scheme.id),
    })
    void queryClient.invalidateQueries({ queryKey: ['grading-schemes'] })
  }

  const saveMutation = useMutation({
    mutationFn: async (values: DialogFormValues) => {
      if (!dialog) return
      const validationError = validateDialogValues(
        dialog,
        values,
        segments,
        validationMessages,
      )
      if (validationError) throw new Error(validationError)
      if (dialog.kind === 'segment') {
        const body = {
          grading_scheme: scheme.id,
          subject_component: dialog.componentId,
          name: values.name,
          description: normalizeRichText(values.description),
          weight_percent: values.weight_percent!,
          sort_order: values.sort_order ?? 0,
        }
        if (dialog.editing) {
          return patchComponentSegment(dialog.editing.id, body)
        }
        return createComponentSegment(body)
      }
      const body = {
        segment: dialog.segmentId,
        name: values.name,
        description: normalizeRichText(values.description),
        activity_date: values.activity_date!,
        max_score: values.max_score?.trim() || undefined,
        sort_order: values.sort_order ?? 0,
      }
      if (dialog.editing) {
        return patchGradingActivity(dialog.editing.id, body)
      }
      return createGradingActivity(body)
    },
    onSuccess: () => {
      invalidateStructure()
      setDialog(null)
      setFormError(null)
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: async (target: NonNullable<typeof deleteTarget>) => {
      if (target.kind === 'segment') return deleteComponentSegment(target.id)
      return deleteGradingActivity(target.id)
    },
    onSuccess: () => {
      invalidateStructure()
      setDeleteTarget(null)
    },
  })

  function openDialog(next: DialogState) {
    setFormError(null)
    setDialog(next)
    if (!next) return
    if (next.kind === 'segment') {
      form.reset({
        name: next.editing?.name ?? '',
        description: next.editing?.description ?? '',
        weight_percent: next.editing?.weight_percent ?? '',
        activity_date: '',
        max_score: '5.00',
        sort_order: next.editing?.sort_order ?? 0,
      })
    } else {
      form.reset({
        name: next.editing?.name ?? '',
        description: next.editing?.description ?? '',
        weight_percent: '',
        activity_date: next.editing?.activity_date ?? '',
        max_score: next.editing?.max_score ?? '5.00',
        sort_order: next.editing?.sort_order ?? 0,
      })
    }
  }

  const loading = componentsLoading || segmentsLoading || activitiesLoading

  return (
    <Box className="flex flex-col gap-3">
      <Alert severity="info">{t('gradingSchemes.componentsReadOnlyHint')}</Alert>

      <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
        <Button
          variant="text"
          size="small"
          onClick={() => void refetchWeights()}
        >
          {t('gradingSchemes.validateWeights')}
        </Button>
        {sortedComponents.length > 0 ? (
          <Chip
            size="small"
            label={
              catalogWeightsValid
                ? t('gradingSchemes.componentCatalogWeightsOk')
                : t('gradingSchemes.componentCatalogWeightsInvalid')
            }
            color={catalogWeightsValid ? 'success' : 'warning'}
            variant="outlined"
          />
        ) : null}
        {weightsValidation ? (
          <Chip
            size="small"
            label={
              (weightsValidation.message ?? '').trim()
                ? weightsValidation.message
                : weightsValidation.valid
                  ? t('gradingSchemes.schemeWeightsOk')
                  : t('gradingSchemes.schemeWeightsInvalid')
            }
            color={weightsValidation.valid ? 'success' : 'warning'}
            variant="outlined"
          />
        ) : null}
      </Stack>

      {loading ? (
        <Typography variant="body2" color="text.secondary">
          {t('common.loading')}
        </Typography>
      ) : sortedComponents.length === 0 ? (
        <Alert severity="warning">{t('gradingSchemes.noSubjectComponents')}</Alert>
      ) : (
        sortedComponents.map((component) => (
          <ComponentAccordion
            key={component.id}
            component={component}
            segments={segmentsByComponent.get(component.id) ?? []}
            activitiesBySegment={activitiesBySegment}
            segmentWeightsValid={segmentWeightsValidForComponent(
              segments,
              component.id,
            )}
            segmentWeightTotal={segmentWeightTotalForComponent(
              segments,
              component.id,
            )}
            onAddSegment={() =>
              openDialog({
                kind: 'segment',
                editing: null,
                componentId: component.id,
              })
            }
            onEditSegment={(segment) =>
              openDialog({
                kind: 'segment',
                editing: segment,
                componentId: component.id,
              })
            }
            onDeleteSegment={(segment) =>
              setDeleteTarget({
                kind: 'segment',
                id: segment.id,
                label: segment.name,
              })
            }
            onAddActivity={(segmentId) =>
              openDialog({
                kind: 'activity',
                editing: null,
                segmentId,
              })
            }
            onEditActivity={(activity, segmentId) =>
              openDialog({
                kind: 'activity',
                editing: activity,
                segmentId,
              })
            }
            onDeleteActivity={(activity) =>
              setDeleteTarget({
                kind: 'activity',
                id: activity.id,
                label: activity.name,
              })
            }
          />
        ))
      )}

      <FormDialog
        open={dialog != null}
        onClose={() => setDialog(null)}
        title={
          dialog?.kind === 'segment'
            ? dialog.editing
              ? t('gradingSchemes.editSegment')
              : t('gradingSchemes.newSegment')
            : dialog?.editing
              ? t('gradingSchemes.editActivity')
              : t('gradingSchemes.newActivity')
        }
      >
        <form
          key={dialog?.kind ?? 'none'}
          onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
        >
          <FormDialogContent className="flex flex-col gap-2 pt-1">
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            <TextField
              label={t('gradingSchemes.name')}
              fullWidth
              required
              {...form.register('name')}
              error={!!form.formState.errors.name}
              helperText={form.formState.errors.name?.message}
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
            {dialog?.kind === 'segment' ? (
              <TextField
                label={t('gradingSchemes.weightPercent')}
                fullWidth
                required
                inputProps={{ min: 0, max: 100, step: 0.01 }}
                {...form.register('weight_percent')}
                error={!!form.formState.errors.weight_percent}
                helperText={
                  form.formState.errors.weight_percent?.message ??
                  (segmentDialogRemaining != null
                    ? t('gradingSchemes.segmentWeightRemainingHint', {
                        remaining: segmentDialogRemaining.toFixed(2),
                      })
                    : undefined)
                }
              />
            ) : (
              <>
                <TextField
                  label={t('gradingSchemes.activityDate')}
                  type="date"
                  fullWidth
                  required
                  InputLabelProps={{ shrink: true }}
                  {...form.register('activity_date')}
                  error={!!form.formState.errors.activity_date}
                  helperText={form.formState.errors.activity_date?.message}
                />
                <TextField
                  label={t('gradingSchemes.maxScore')}
                  fullWidth
                  {...form.register('max_score')}
                />
              </>
            )}
          </FormDialogContent>
          <DialogActions>
            <Button onClick={() => setDialog(null)}>{t('common.cancel')}</Button>
            <Button type="submit" variant="contained" disabled={saveMutation.isPending}>
              {t('common.save')}
            </Button>
          </DialogActions>
        </form>
      </FormDialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>{t('gradingSchemes.deleteEntity')}</DialogTitle>
        <DialogContent>
          {t('gradingSchemes.deleteEntityPrompt', {
            name: deleteTarget?.label ?? '',
          })}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>
            {t('common.cancel')}
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
            onClick={() =>
              deleteTarget && deleteMutation.mutate(deleteTarget)
            }
          >
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

type ComponentAccordionProps = {
  component: SubjectComponent
  segments: ComponentSegment[]
  activitiesBySegment: Map<string, GradingActivity[]>
  segmentWeightsValid: boolean
  segmentWeightTotal: number
  onAddSegment: () => void
  onEditSegment: (segment: ComponentSegment) => void
  onDeleteSegment: (segment: ComponentSegment) => void
  onAddActivity: (segmentId: string) => void
  onEditActivity: (activity: GradingActivity, segmentId: string) => void
  onDeleteActivity: (activity: GradingActivity) => void
}

function ComponentAccordion({
  component,
  segments,
  activitiesBySegment,
  segmentWeightsValid,
  segmentWeightTotal,
  onAddSegment,
  onEditSegment,
  onDeleteSegment,
  onAddActivity,
  onEditActivity,
  onDeleteActivity,
}: ComponentAccordionProps) {
  const { t } = useTranslation()
  const canAddSegment = !segmentWeightsValid || segments.length === 0
  const segmentSumLabel = t('gradingSchemes.segmentWeightsSum', {
    sum: segmentWeightTotal.toFixed(2),
  })

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          sx={{ width: '100%', pr: 1 }}
        >
          <Typography fontWeight={600} sx={{ flex: 1 }}>
            {component.name} ({component.weight_percent}%)
          </Typography>
          {segments.length > 0 ? (
            segmentWeightsValid ? (
              <Chip
                size="small"
                label={t('gradingSchemes.segmentWeightsOk')}
                color="success"
                variant="outlined"
              />
            ) : (
              <Chip
                size="small"
                label={t('gradingSchemes.segmentWeightsInvalidDetail', {
                  sum: segmentWeightTotal.toFixed(2),
                })}
                color="warning"
                variant="outlined"
              />
            )
          ) : (
            <Chip
              size="small"
              label={t('gradingSchemes.noSegmentsYet')}
              color="default"
              variant="outlined"
            />
          )}
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            {segments.length > 0 ? (
              <Typography variant="body2" color="text.secondary">
                {segmentSumLabel}
              </Typography>
            ) : null}
          </Stack>
          {canAddSegment ? (
            <Button size="small" startIcon={<AddIcon />} onClick={onAddSegment}>
              {t('gradingSchemes.addSegment')}
            </Button>
          ) : null}
          {segments.map((segment) => (
            <Box
              key={segment.id}
              sx={{ borderLeft: 3, borderColor: 'divider', pl: 2 }}
            >
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ mb: 1 }}
              >
                <Typography fontWeight={500}>
                  {segment.name} ({segment.weight_percent}%)
                </Typography>
                <IconButton
                  size="small"
                  aria-label={t('common.edit')}
                  onClick={() => onEditSegment(segment)}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={t('common.delete')}
                  onClick={() => onDeleteSegment(segment)}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Stack>
              <Stack spacing={0.5} sx={{ mb: 1 }}>
                {(activitiesBySegment.get(segment.id) ?? []).map((activity) => (
                  <Stack
                    key={activity.id}
                    direction="row"
                    spacing={1}
                    alignItems="center"
                  >
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {activity.name} · {activity.activity_date}
                      {activity.max_score ? ` · máx ${activity.max_score}` : ''}
                    </Typography>
                    <IconButton
                      size="small"
                      aria-label={t('common.edit')}
                      onClick={() => onEditActivity(activity, segment.id)}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={t('common.delete')}
                      onClick={() => onDeleteActivity(activity)}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
              <Button
                size="small"
                variant="text"
                startIcon={<AddIcon />}
                onClick={() => onAddActivity(segment.id)}
              >
                {t('gradingSchemes.addActivity')}
              </Button>
            </Box>
          ))}
        </Stack>
      </AccordionDetails>
    </Accordion>
  )
}
