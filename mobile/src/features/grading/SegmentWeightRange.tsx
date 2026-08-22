import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react"

import {
  SEGMENT_WEIGHT_MIN,
  SEGMENT_WEIGHT_STEP,
  applyBoundaryMove,
  boundariesFromWeights,
  formatWeight,
} from "@/features/grading/planUtils"

export type SegmentWeightItem = {
  id: string
  name: string
  weight: number
}

const SEGMENT_TINTS = [
  "bg-blue-600",
  "bg-emerald-600",
  "bg-amber-500",
  "bg-violet-600",
  "bg-sky-600",
  "bg-rose-500",
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
  return items.map((item) => `${item.id}:${item.name}:${item.weight.toFixed(2)}`).join("|")
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

  function onPointerDown(handleIndex: number, event: PointerEvent<HTMLButtonElement>) {
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

  function onPointerMove(handleIndex: number, event: PointerEvent<HTMLButtonElement>) {
    if (!draggingRef.current || activeHandleRef.current !== handleIndex) return
    const rect = barRef.current?.getBoundingClientRect()
    if (!rect) return
    moveHandle(handleIndex, clientXToPercent(event.clientX, rect))
  }

  function onKeyDown(handleIndex: number, event: KeyboardEvent<HTMLButtonElement>) {
    if (locked) return
    const left = draft[handleIndex]
    const right = draft[handleIndex + 1]
    if (!left || !right) return
    let delta = 0
    if (event.key === "ArrowLeft") delta = -step
    else if (event.key === "ArrowRight") delta = step
    else if (event.key === "Home") delta = -100
    else if (event.key === "End") delta = 100
    else return
    event.preventDefault()
    const current = boundaries[handleIndex] ?? left.weight
    const next = applyBoundaryMove(draft, handleIndex, current + delta, options)
    emit(next)
    void commitDraft(next)
  }

  if (draft.length < 2) return null

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-slate-500">
        Arrastra los divisores para repartir el 100%.
      </p>
      <div
        ref={barRef}
        className="relative h-11 select-none"
      >
        <div className="absolute inset-0 rounded-xl overflow-hidden flex">
          {draft.map((item, i) => (
            <div
              key={item.id}
              className={`relative min-w-0 h-full flex flex-col items-center justify-center px-1 ${SEGMENT_TINTS[i % SEGMENT_TINTS.length]}`}
              style={{ width: `${Math.max(0, item.weight)}%` }}
            >
              {item.weight >= 18 && (
                <span className="text-[10px] font-semibold text-white/90 truncate max-w-full leading-none">
                  {item.name}
                </span>
              )}
              <span className="font-mono text-[11px] font-semibold text-white leading-none mt-0.5">
                {formatWeight(item.weight)}%
              </span>
            </div>
          ))}
        </div>
        {saving && (
          <div
            className="absolute inset-0 z-20 rounded-xl bg-white/60 flex items-center justify-center"
            aria-busy="true"
            aria-live="polite"
          >
            <div className="w-5 h-5 rounded-full border-2 border-slate-200 border-t-[#1E3A5F] animate-spin" />
          </div>
        )}
        {Array.from({ length: handleCount }, (_, handleIndex) => {
          const left = draft[handleIndex]
          const right = draft[handleIndex + 1]
          const value = boundaries[handleIndex] ?? 0
          const prev = handleIndex === 0 ? 0 : (boundaries[handleIndex - 1] ?? 0)
          const next = boundaries[handleIndex + 1] ?? 100
          return (
            <button
              key={`handle-${left?.id ?? handleIndex}`}
              type="button"
              disabled={locked}
              aria-label={`Divisor entre ${left?.name ?? "segmento"} y ${right?.name ?? "segmento"}`}
              role="slider"
              aria-valuemin={prev + minWeight}
              aria-valuemax={next - minWeight}
              aria-valuenow={value}
              aria-valuetext={`${formatWeight(left?.weight ?? 0)}% / ${formatWeight(right?.weight ?? 0)}%`}
              className="absolute top-0 bottom-0 w-8 -translate-x-1/2 z-10 flex items-center justify-center touch-none cursor-ew-resize disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              style={{ left: `${value}%` }}
              onPointerDown={(e) => onPointerDown(handleIndex, e)}
              onPointerMove={(e) => onPointerMove(handleIndex, e)}
              onPointerUp={() => void finishDrag()}
              onPointerCancel={() => void finishDrag()}
              onKeyDown={(e) => onKeyDown(handleIndex, e)}
            >
              <span className="pointer-events-none w-5 h-5 rounded-full bg-white border border-slate-200 shadow flex items-center justify-center text-[10px] text-slate-500 leading-none">
                ↔
              </span>
            </button>
          )
        })}
      </div>
      {saving ? (
        <p className="text-[10px] font-mono text-slate-400">Guardando…</p>
      ) : !itemsEqual(draft, segments) && activeHandle != null ? (
        <p className="text-[10px] font-mono text-slate-400">Soltar para guardar</p>
      ) : null}
    </div>
  )
}
