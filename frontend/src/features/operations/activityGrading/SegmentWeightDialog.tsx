import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { getErrorMessage } from '@/api/errors'
import { queryKeys } from '@/api/queryKeys'
import { PlanningSegmentQuickAdd } from '@/features/operations/activityPlanning/PlanningSegmentQuickAdd'
import {
  createComponentSegment,
  patchComponentSegment,
  type ComponentSegment,
  type SubjectComponent,
} from '@/features/operations/gradingApi'
import { SegmentWeightRange } from '@/features/operations/SegmentWeightRange'
import {
  SEGMENT_WEIGHT_MIN,
  SEGMENT_WEIGHT_STEP,
  WEIGHT_SUM_TOLERANCE,
  canResizeSegmentWeights,
  formatWeight,
} from '@/features/operations/weightRangeMath'

type WeightUpdate = { id: string; weight_percent: string }

function snapSegmentWeight(raw: number): number {
  const stepped = Math.round(raw / SEGMENT_WEIGHT_STEP) * SEGMENT_WEIGHT_STEP
  return Math.min(100, Math.max(SEGMENT_WEIGHT_MIN, stepped))
}

function clientXToPercent(clientX: number, rect: DOMRect): number {
  if (rect.width <= 0) return 0
  return ((clientX - rect.left) / rect.width) * 100
}

function SingleSegmentSplitBar({
  name,
  value,
  disabled = false,
  onCommit,
}: {
  name: string
  value: number
  disabled?: boolean
  onCommit: (nextWeight: number) => void
}) {
  const { t } = useTranslation()
  const barRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const draftRef = useRef(value)
  const [draft, setDraft] = useState(value)
  draftRef.current = draft
  const freed = Math.max(0, 100 - draft)

  useEffect(() => {
    if (draggingRef.current) return
    setDraft(value)
    draftRef.current = value
  }, [value])

  function moveTo(rawPercent: number) {
    const next = snapSegmentWeight(rawPercent)
    draftRef.current = next
    setDraft(next)
  }

  function finishDrag() {
    if (!draggingRef.current) return
    draggingRef.current = false
    const next = draftRef.current
    if (Math.abs(next - value) <= WEIGHT_SUM_TOLERANCE) return
    if (100 - next + 1e-9 < SEGMENT_WEIGHT_MIN) {
      draftRef.current = value
      setDraft(value)
      return
    }
    onCommit(next)
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (disabled) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    draggingRef.current = true
    const rect = barRef.current?.getBoundingClientRect()
    if (rect) moveTo(clientXToPercent(event.clientX, rect))
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!draggingRef.current) return
    const rect = barRef.current?.getBoundingClientRect()
    if (!rect) return
    moveTo(clientXToPercent(event.clientX, rect))
  }

  return (
    <Box className="flex flex-col gap-1.5">
      <Typography variant="caption" color="text.secondary">
        {t('activityGrading.gradeGrid.splitHint')}
      </Typography>
      <Box ref={barRef} sx={{ position: 'relative', height: 44, userSelect: 'none' }}>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: 1.5,
            overflow: 'hidden',
            display: 'flex',
          }}
        >
          <Box
            sx={{
              width: `${draft}%`,
              minWidth: 0,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              px: 0.5,
              bgcolor: '#2563eb',
              color: 'common.white',
            }}
          >
            {draft >= 18 ? (
              <Typography
                component="span"
                noWrap
                sx={{ fontSize: 10, fontWeight: 600, lineHeight: 1, maxWidth: '100%' }}
              >
                {name}
              </Typography>
            ) : null}
            <Typography
              component="span"
              sx={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, lineHeight: 1, mt: 0.25 }}
            >
              {formatWeight(draft)}%
            </Typography>
          </Box>
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              px: 0.5,
              bgcolor: (theme) =>
                theme.palette.mode === 'dark'
                  ? 'rgba(255,255,255,0.12)'
                  : 'rgba(15,23,42,0.08)',
              color: 'text.primary',
            }}
          >
            {freed >= 12 ? (
              <Typography
                component="span"
                noWrap
                sx={{ fontSize: 10, fontWeight: 600, lineHeight: 1, maxWidth: '100%' }}
              >
                {t('activityGrading.gradeGrid.splitNew')}
              </Typography>
            ) : null}
            {freed >= 8 ? (
              <Typography
                component="span"
                sx={{
                  fontFamily: 'monospace',
                  fontSize: 11,
                  fontWeight: 600,
                  lineHeight: 1,
                  mt: 0.25,
                }}
              >
                {formatWeight(freed)}%
              </Typography>
            ) : null}
          </Box>
        </Box>
        <Box
          component="button"
          type="button"
          disabled={disabled}
          role="slider"
          aria-valuemin={SEGMENT_WEIGHT_MIN}
          aria-valuemax={100}
          aria-valuenow={draft}
          aria-valuetext={`${formatWeight(draft)}% / ${formatWeight(freed)}%`}
          aria-label={t('grading.weightRange.handle', {
            left: name,
            right: t('activityGrading.gradeGrid.splitNew'),
          })}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onKeyDown={(event) => {
            if (disabled) return
            let delta = 0
            if (event.key === 'ArrowLeft') delta = -SEGMENT_WEIGHT_STEP
            else if (event.key === 'ArrowRight') delta = SEGMENT_WEIGHT_STEP
            else return
            event.preventDefault()
            const next = snapSegmentWeight(draft + delta)
            if (Math.abs(next - draft) <= WEIGHT_SUM_TOLERANCE) return
            setDraft(next)
            draftRef.current = next
            if (100 - next + 1e-9 < SEGMENT_WEIGHT_MIN) return
            onCommit(next)
          }}
          sx={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 32,
            left: `${draft}%`,
            transform: 'translateX(-50%)',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            touchAction: 'none',
            cursor: 'ew-resize',
            border: 0,
            p: 0,
            bgcolor: 'transparent',
            '&:disabled': { cursor: 'not-allowed' },
            '&:focus-visible': {
              outline: '2px solid',
              outlineColor: 'primary.main',
              outlineOffset: 2,
            },
          }}
        >
          <Box
            sx={{
              pointerEvents: 'none',
              width: 20,
              height: 20,
              borderRadius: '50%',
              bgcolor: 'common.white',
              border: 1,
              borderColor: 'divider',
              boxShadow: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              color: 'text.secondary',
              lineHeight: 1,
            }}
          >
            ↔
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

function remainingWeight(segments: ComponentSegment[]): number {
  const total = segments.reduce(
    (sum, segment) => sum + (Number(segment.weight_percent) || 0),
    0,
  )
  return Math.max(0, 100 - total)
}

function useSegmentWeightUpdates(schemeId: string) {
  const queryClient = useQueryClient()
  const segmentsKey = [...queryKeys.gradingSchemeStructure(schemeId), 'segments']

  return useMutation({
    mutationFn: async (updates: WeightUpdate[]) => {
      await Promise.all(
        updates.map((update) =>
          patchComponentSegment(update.id, {
            weight_percent: update.weight_percent,
          }),
        ),
      )
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: segmentsKey })
      const previous = queryClient.getQueryData<ComponentSegment[]>(segmentsKey)
      const nextWeights = new Map(updates.map((update) => [update.id, update.weight_percent]))
      queryClient.setQueryData<ComponentSegment[]>(segmentsKey, (current) => {
        if (!current) return current
        return current.map((segment) => {
          const weight = nextWeights.get(segment.id)
          return weight == null ? segment : { ...segment, weight_percent: weight }
        })
      })
      return { previous }
    },
    onError: (_error, _updates, context) => {
      if (context?.previous) {
        queryClient.setQueryData(segmentsKey, context.previous)
      }
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.gradingSchemeStructure(schemeId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.gradingScheme(schemeId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.gradingSchemeValidateWeights(schemeId),
        }),
        queryClient.invalidateQueries({ queryKey: ['grading-schemes'] }),
        queryClient.invalidateQueries({
          queryKey: ['grading-schemes', schemeId, 'breakdown'],
        }),
      ])
    },
  })
}

export type SegmentWeightDialogProps = {
  open: boolean
  onClose: () => void
  schemeId: string
  component: SubjectComponent | null
  segments: ComponentSegment[]
}

export function SegmentWeightDialog({
  open,
  onClose,
  schemeId,
  component,
  segments,
}: SegmentWeightDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [splitWeight, setSplitWeight] = useState<number | null>(null)
  const [newSegmentName, setNewSegmentName] = useState('')
  const [releaseSegmentId, setReleaseSegmentId] = useState('')
  const [releaseDraft, setReleaseDraft] = useState('')
  const weightMutation = useSegmentWeightUpdates(schemeId)

  const componentSegments = useMemo(
    () =>
      segments
        .filter((segment) => segment.subject_component === component?.id)
        .slice()
        .sort(
          (a, b) =>
            (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
            a.name.localeCompare(b.name, 'es'),
        ),
    [segments, component?.id],
  )

  const remaining = remainingWeight(componentSegments)
  const canResize = canResizeSegmentWeights(componentSegments.length, remaining)
  const canAdd = remaining + 1e-9 >= SEGMENT_WEIGHT_MIN
  const singleSegment =
    componentSegments.length === 1 ? componentSegments[0] : null
  const singleIsFull =
    singleSegment != null &&
    Math.abs((Number(singleSegment.weight_percent) || 0) - 100) <= WEIGHT_SUM_TOLERANCE

  useEffect(() => {
    if (!open) return
    setError(null)
    setSplitWeight(null)
    setNewSegmentName('')
    setReleaseDraft('')
  }, [open, component?.id])

  useEffect(() => {
    if (!open) return
    setReleaseSegmentId((current) =>
      componentSegments.some((segment) => segment.id === current)
        ? current
        : (componentSegments[0]?.id ?? ''),
    )
  }, [open, componentSegments])

  async function saveWeights(updates: WeightUpdate[]) {
    setError(null)
    try {
      await weightMutation.mutateAsync(updates)
    } catch (saveError) {
      setError(getErrorMessage(saveError))
      throw saveError
    }
  }

  function beginSplit(nextWeight: number) {
    if (!singleSegment) return
    const current = Number(singleSegment.weight_percent) || 0
    const freed = current - nextWeight
    if (freed + 1e-9 < SEGMENT_WEIGHT_MIN) return
    setError(null)
    setSplitWeight(nextWeight)
    setNewSegmentName('')
  }

  function cancelSplit() {
    setSplitWeight(null)
    setNewSegmentName('')
  }

  async function confirmSplit() {
    if (!singleSegment || !component || splitWeight == null) return
    const name = newSegmentName.trim()
    if (!name) return
    const current = Number(singleSegment.weight_percent) || 0
    const freed = 100 - splitWeight
    let patched = false
    try {
      await saveWeights([
        { id: singleSegment.id, weight_percent: formatWeight(splitWeight) },
      ])
      patched = true
      await createComponentSegment({
        grading_scheme: schemeId,
        subject_component: component.id,
        name,
        weight_percent: formatWeight(freed),
        sort_order: componentSegments.length,
      })
      await queryClient.invalidateQueries({
        queryKey: queryKeys.gradingSchemeStructure(schemeId),
      })
      setSplitWeight(null)
      setNewSegmentName('')
    } catch (splitError) {
      if (patched) {
        try {
          await saveWeights([
            { id: singleSegment.id, weight_percent: formatWeight(current) },
          ])
        } catch {
          // The first error stays visible; the weight refetch restores the bar.
        }
      }
      setError(getErrorMessage(splitError))
    }
  }

  async function releaseWeight() {
    const segment = componentSegments.find((item) => item.id === releaseSegmentId)
    if (!segment) return
    const parsed = Number(releaseDraft.replace(',', '.'))
    const current = Number(segment.weight_percent)
    if (!Number.isFinite(parsed) || parsed < SEGMENT_WEIGHT_MIN || parsed > 100) {
      setError(t('activityGrading.gradeGrid.releaseMinimum'))
      return
    }
    const nextRemaining = remaining + (current - parsed)
    if (nextRemaining + 1e-9 < SEGMENT_WEIGHT_MIN) {
      setError(t('activityGrading.gradeGrid.releaseMinimum'))
      return
    }
    try {
      await saveWeights([{ id: segment.id, weight_percent: formatWeight(parsed) }])
      setReleaseDraft('')
    } catch {
      // Error stays in the alert; the cache rollback restores the bar.
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {component
          ? t('activityGrading.gradeGrid.weightsTitle', { name: component.name })
          : t('activityGrading.gradeGrid.weightsTitlePlain')}
      </DialogTitle>
      <DialogContent>
        {component ? (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {t('activityGrading.gradeGrid.catalogWeight', {
                weight: component.weight_percent,
              })}
            </Typography>
            {error ? <Alert severity="error">{error}</Alert> : null}
            {canResize ? (
              <SegmentWeightRange
                segments={componentSegments.map((segment) => ({
                  id: segment.id,
                  name: segment.name,
                  weight: Number(segment.weight_percent) || 0,
                }))}
                disabled={weightMutation.isPending}
                onCommit={async (next) => {
                  const updates = next.filter((item) => {
                    const prev = componentSegments.find((segment) => segment.id === item.id)
                    return (
                      Math.abs((Number(prev?.weight_percent) || 0) - item.weight) >
                      WEIGHT_SUM_TOLERANCE
                    )
                  })
                  if (updates.length === 0) return
                  await saveWeights(
                    updates.map((item) => ({
                      id: item.id,
                      weight_percent: formatWeight(item.weight),
                    })),
                  )
                }}
              />
            ) : null}
            {(singleIsFull || splitWeight != null) && singleSegment ? (
              <SingleSegmentSplitBar
                name={singleSegment.name}
                value={splitWeight ?? 100}
                disabled={weightMutation.isPending || splitWeight != null}
                onCommit={beginSplit}
              />
            ) : null}
            {!canAdd && componentSegments.length >= 2 ? (
              <Stack spacing={1}>
                <Alert severity="info">
                  {t('activityGrading.gradeGrid.freeWeightHint')}
                </Alert>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField
                    select
                    fullWidth
                    label={t('activityGrading.gradeGrid.releaseSegment')}
                    value={releaseSegmentId}
                    onChange={(event) => setReleaseSegmentId(event.target.value)}
                  >
                    {componentSegments.map((segment) => (
                      <MenuItem key={segment.id} value={segment.id}>
                        {segment.name} ({segment.weight_percent}%)
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label={t('activityGrading.gradeGrid.releaseWeight')}
                    value={releaseDraft}
                    onChange={(event) => setReleaseDraft(event.target.value)}
                    disabled={weightMutation.isPending}
                    slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                  />
                  <Button
                    variant="outlined"
                    onClick={() => void releaseWeight()}
                    disabled={weightMutation.isPending || !releaseDraft.trim()}
                    sx={{ flexShrink: 0 }}
                  >
                    {t('activityGrading.gradeGrid.releaseAction')}
                  </Button>
                </Stack>
              </Stack>
            ) : null}
            {splitWeight != null && singleSegment ? (
              <Dialog
                open
                onClose={cancelSplit}
                fullWidth
                maxWidth="xs"
              >
                <DialogTitle>{t('activityGrading.gradeGrid.splitNameTitle')}</DialogTitle>
                <DialogContent>
                  <Stack spacing={2} sx={{ pt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('activityGrading.gradeGrid.splitNameHint', {
                        currentName: singleSegment.name,
                        current: formatWeight(splitWeight),
                        next: formatWeight(100 - splitWeight),
                      })}
                    </Typography>
                    <TextField
                      autoFocus
                      required
                      label={t('gradingSchemes.name')}
                      value={newSegmentName}
                      onChange={(event) => setNewSegmentName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && newSegmentName.trim()) {
                          event.preventDefault()
                          void confirmSplit()
                        }
                      }}
                    />
                  </Stack>
                </DialogContent>
                <DialogActions>
                  <Button onClick={cancelSplit} disabled={weightMutation.isPending}>
                    {t('common.cancel')}
                  </Button>
                  <Button
                    variant="contained"
                    onClick={() => void confirmSplit()}
                    disabled={weightMutation.isPending || !newSegmentName.trim()}
                  >
                    {t('gradingSchemes.addSegment')}
                  </Button>
                </DialogActions>
              </Dialog>
            ) : null}
            {canAdd && component ? (
              <PlanningSegmentQuickAdd
                schemeId={schemeId}
                component={component}
                segments={segments}
              />
            ) : null}
          </Stack>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  )
}
