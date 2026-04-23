import type { GradingScale } from '@/types/schemas'

export function parseScaleBound(s: string): number | null {
  const n = Number(String(s).trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function formatScaleBoundLabel(n: number): string {
  return new Intl.NumberFormat('es', {
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(n)
}

/** Rango global a partir de todos los niveles de la escala (mínimo de mínimos, máximo de máximos). */
export function getGradingScaleAggregateBounds(
  scales: GradingScale[],
): { min: number; max: number } | null {
  let min: number | null = null
  let max: number | null = null
  for (const s of scales) {
    const lo = parseScaleBound(s.min_score)
    const hi = parseScaleBound(s.max_score)
    if (lo === null || hi === null) continue
    min = min === null ? lo : Math.min(min, lo)
    max = max === null ? hi : Math.max(max, hi)
  }
  if (min === null || max === null) return null
  return { min, max }
}
