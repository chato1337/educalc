import { Box, CircularProgress, Typography } from '@mui/material'
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { useTranslation } from 'react-i18next'

import {
  SEGMENT_WEIGHT_MIN,
  SEGMENT_WEIGHT_STEP,
  applyBoundaryMove,
  boundariesFromWeights,
  formatWeight,
} from '@/features/operations/weightRangeMath'

export type SegmentWeightItem = {
  id: string
  name: string
  weight: number
}

const SEGMENT_TINTS = [
  '#2563eb',
  '#059669',
  '#f59e0b',
  '#7c3aed',
  '#0284c7',
  '#e11d48',
]

function itemsEqual(a: SegmentWeightItem[], b: SegmentWeightItem[]): boolean {
  if (a.length !== b.length) return false
  return a.every(
    (item, i) =>
      item.id === b[i]?.id &&
      item.name === b[i]?.name &&
      Math.abs(item.weight - (b[i]?.weight ?? 0)) < 0.01,
  )
}

function segmentsKey(items: SegmentWeightItem[]): string {
  return items
    .map((item) => `${item.id}:${item.name}:${item.weight.toFixed(2)}`)
    .join('|')
}

function clientXToPercent(clientX: number, rect: DOMRect): number {
  if (rect.width <= 0) return 0
  return ((clientX - rect.left) / rect.width) * 100
}

export function SegmentWeightRange({
  segments,
  minWeight = SEGMENT_WEIGHT_MIN,
  step = SEGMENT_WEIGHT_STEP,
  disabled = false,
  onChange,
  onCommit,
}: {
  segments: SegmentWeightItem[]
  minWeight?: number
  step?: number
  disabled?: boolean
  onChange?: (next: SegmentWeightItem[]) => void
  onCommit?: (next: SegmentWeightItem[]) => void | Promise<void>
}) {
  const { t } = useTranslation()
  const barRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const awaitingServerRef = useRef(false)
  const activeHandleRef = useRef<number | null>(null)
  const [draft, setDraft] = useState(segments)
  const [activeHandle, setActiveHandle] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const draftRef = useRef(draft)
  draftRef.current = draft
  const incomingKey = segmentsKey(segments)

  useEffect(() => {
    if (activeHandleRef.current != null || saving) return
    if (awaitingServerRef.current) {
      if (itemsEqual(segments, draftRef.current)) {
        awaitingServerRef.current = false
      }
      return
    }
    if (!itemsEqual(segments, draftRef.current)) {
      setDraft(segments)
    }
  }, [incomingKey, saving, segments])

  const options = { minWeight, step }
  const boundaries = boundariesFromWeights(draft.map((item) => item.weight))
  const handleCount = Math.max(0, draft.length - 1)

  function emit(next: SegmentWeightItem[]) {
    setDraft(next)
    draftRef.current = next
    onChange?.(next)
  }

  function moveHandle(handleIndex: number, rawPercent: number) {
    emit(applyBoundaryMove(draftRef.current, handleIndex, rawPercent, options))
  }

  async function commitDraft(next: SegmentWeightItem[]) {
    if (saving || itemsEqual(next, segments)) return
    awaitingServerRef.current = true
    setSaving(true)
    try {
      await onCommit?.(next)
    } catch {
      awaitingServerRef.current = false
      setDraft(segments)
    } finally {
      setSaving(false)
    }
  }

  async function finishDrag() {
    if (!draggingRef.current) return
    draggingRef.current = false
    activeHandleRef.current = null
    setActiveHandle(null)
    await commitDraft(draftRef.current)
  }

  const locked = disabled || saving

  function onPointerDown(
    handleIndex: number,
    event: PointerEvent<HTMLButtonElement>,
  ) {
    if (locked) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    draggingRef.current = true
    activeHandleRef.current = handleIndex
    setActiveHandle(handleIndex)
    const rect = barRef.current?.getBoundingClientRect()
    if (rect) moveHandle(handleIndex, clientXToPercent(event.clientX, rect))
  }

  function onPointerMove(
    handleIndex: number,
    event: PointerEvent<HTMLButtonElement>,
  ) {
    if (!draggingRef.current || activeHandleRef.current !== handleIndex) return
    const rect = barRef.current?.getBoundingClientRect()
    if (!rect) return
    moveHandle(handleIndex, clientXToPercent(event.clientX, rect))
  }

  function onKeyDown(
    handleIndex: number,
    event: KeyboardEvent<HTMLButtonElement>,
  ) {
    if (locked) return
    const left = draft[handleIndex]
    const right = draft[handleIndex + 1]
    if (!left || !right) return
    let delta = 0
    if (event.key === 'ArrowLeft') delta = -step
    else if (event.key === 'ArrowRight') delta = step
    else if (event.key === 'Home') delta = -100
    else if (event.key === 'End') delta = 100
    else return
    event.preventDefault()
    const current = boundaries[handleIndex] ?? left.weight
    const next = applyBoundaryMove(draft, handleIndex, current + delta, options)
    emit(next)
    void commitDraft(next)
  }

  if (draft.length < 2) return null

  return (
    <Box className="flex flex-col gap-1.5">
      <Typography variant="caption" color="text.secondary">
        {t('grading.weightRange.hint')}
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
          {draft.map((item, i) => (
            <Box
              key={item.id}
              sx={{
                position: 'relative',
                minWidth: 0,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                px: 0.5,
                width: `${Math.max(0, item.weight)}%`,
                bgcolor: SEGMENT_TINTS[i % SEGMENT_TINTS.length],
                color: 'common.white',
              }}
            >
              {item.weight >= 18 ? (
                <Typography
                  component="span"
                  noWrap
                  sx={{ fontSize: 10, fontWeight: 600, lineHeight: 1, maxWidth: '100%' }}
                >
                  {item.name}
                </Typography>
              ) : null}
              <Typography
                component="span"
                sx={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, lineHeight: 1, mt: 0.25 }}
              >
                {formatWeight(item.weight)}%
              </Typography>
            </Box>
          ))}
        </Box>
        {saving ? (
          <Box
            aria-busy="true"
            aria-live="polite"
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 2,
              borderRadius: 1.5,
              bgcolor: 'rgba(255,255,255,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CircularProgress size={20} />
          </Box>
        ) : null}
        {Array.from({ length: handleCount }, (_, handleIndex) => {
          const left = draft[handleIndex]
          const right = draft[handleIndex + 1]
          const value = boundaries[handleIndex] ?? 0
          const prev = handleIndex === 0 ? 0 : (boundaries[handleIndex - 1] ?? 0)
          const next = boundaries[handleIndex + 1] ?? 100
          return (
            <Box
              key={`handle-${left?.id ?? handleIndex}`}
              component="button"
              type="button"
              disabled={locked}
              aria-label={t('grading.weightRange.handle', {
                left: left?.name ?? t('grading.weightRange.segment'),
                right: right?.name ?? t('grading.weightRange.segment'),
              })}
              role="slider"
              aria-valuemin={prev + minWeight}
              aria-valuemax={next - minWeight}
              aria-valuenow={value}
              aria-valuetext={`${formatWeight(left?.weight ?? 0)}% / ${formatWeight(right?.weight ?? 0)}%`}
              onPointerDown={(event) => onPointerDown(handleIndex, event)}
              onPointerMove={(event) => onPointerMove(handleIndex, event)}
              onPointerUp={() => void finishDrag()}
              onPointerCancel={() => void finishDrag()}
              onKeyDown={(event) => onKeyDown(handleIndex, event)}
              sx={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                width: 32,
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
                left: `${value}%`,
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
          )
        })}
      </Box>
      {saving ? (
        <Typography variant="caption" sx={{ fontFamily: 'monospace' }} color="text.secondary">
          {t('grading.weightRange.saving')}
        </Typography>
      ) : !itemsEqual(draft, segments) && activeHandle != null ? (
        <Typography variant="caption" sx={{ fontFamily: 'monospace' }} color="text.secondary">
          {t('grading.weightRange.releaseToSave')}
        </Typography>
      ) : null}
    </Box>
  )
}
