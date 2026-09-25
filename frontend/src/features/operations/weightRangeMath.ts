export const WEIGHT_SUM_TOLERANCE = 0.01

export const SEGMENT_WEIGHT_STEP = 5
export const SEGMENT_WEIGHT_MIN = 5

/** Cumulative ends for each segment, last boundary always 100. */
export function boundariesFromWeights(weights: number[]): number[] {
  const boundaries: number[] = []
  let acc = 0
  for (let i = 0; i < weights.length; i += 1) {
    acc += weights[i] ?? 0
    boundaries.push(i === weights.length - 1 ? 100 : acc)
  }
  return boundaries
}

export function weightsFromBoundaries(boundaries: number[]): number[] {
  const weights: number[] = []
  let prev = 0
  for (let i = 0; i < boundaries.length; i += 1) {
    const end = i === boundaries.length - 1 ? 100 : (boundaries[i] ?? 100)
    weights.push(end - prev)
    prev = end
  }
  return weights
}

/** Move handle `handleIndex` (boundary 0..n-2). Neighbors stay put; snap + min weight. */
export function moveBoundary(
  boundaries: number[],
  handleIndex: number,
  rawPosition: number,
  options?: { minWeight?: number; step?: number },
): number[] {
  const minWeight = options?.minWeight ?? SEGMENT_WEIGHT_MIN
  const step = options?.step ?? SEGMENT_WEIGHT_STEP
  if (handleIndex < 0 || handleIndex >= boundaries.length - 1) {
    return boundaries.slice()
  }
  const prev = handleIndex === 0 ? 0 : (boundaries[handleIndex - 1] ?? 0)
  const next = boundaries[handleIndex + 1] ?? 100
  const minPos = prev + minWeight
  const maxPos = next - minWeight
  const lo = Math.ceil(minPos / step - 1e-9) * step
  const hi = Math.floor(maxPos / step + 1e-9) * step
  let nextPos = Math.round(rawPosition / step) * step
  if (lo <= hi) {
    nextPos = Math.min(hi, Math.max(lo, nextPos))
  } else {
    nextPos = Math.min(maxPos, Math.max(minPos, rawPosition))
  }
  const result = boundaries.slice()
  result[handleIndex] = nextPos
  if (result.length > 0) result[result.length - 1] = 100
  return result
}

export function applyBoundaryMove<T extends { weight: number }>(
  items: T[],
  handleIndex: number,
  rawPosition: number,
  options?: { minWeight?: number; step?: number },
): T[] {
  const nextWeights = weightsFromBoundaries(
    moveBoundary(
      boundariesFromWeights(items.map((item) => item.weight)),
      handleIndex,
      rawPosition,
      options,
    ),
  )
  return items.map((item, i) => ({
    ...item,
    weight: nextWeights[i] ?? item.weight,
  }))
}

export function canResizeSegmentWeights(
  segmentCount: number,
  remaining: number,
): boolean {
  return segmentCount >= 2 && remaining <= WEIGHT_SUM_TOLERANCE
}

export function formatWeight(value: number): string {
  return value.toFixed(2)
}
