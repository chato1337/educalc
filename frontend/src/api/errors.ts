import { isAxiosError } from 'axios'

/** Best-effort message from DRF / Django error payloads. */
export function getErrorMessage(err: unknown, fallback = 'Error desconocido'): string {
  if (isAxiosError(err)) {
    const d = err.response?.data as Record<string, unknown> | string | undefined
    if (typeof d === 'string' && d.trim()) return d
    if (d && typeof d === 'object') {
      if (typeof d.detail === 'string') return d.detail
      if (Array.isArray(d.non_field_errors) && d.non_field_errors[0]) {
        return String(d.non_field_errors[0])
      }
      const firstKey = Object.keys(d)[0]
      if (firstKey) {
        const v = d[firstKey]
        if (Array.isArray(v) && v[0]) return `${firstKey}: ${String(v[0])}`
        if (typeof v === 'string') return `${firstKey}: ${v}`
      }
    }
    if (err.message) return err.message
  }
  if (err instanceof Error) return err.message
  return fallback
}
