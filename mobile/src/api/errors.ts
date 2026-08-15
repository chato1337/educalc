import { isAxiosError } from 'axios'

export function isNotFoundError(err: unknown): boolean {
  return isAxiosError(err) && err.response?.status === 404
}

export function isForbiddenError(err: unknown): boolean {
  return isAxiosError(err) && err.response?.status === 403
}

/** No HTTP response, or 5xx / 408 / 429: the write is worth retrying. */
export function isRetriableWriteError(err: unknown): boolean {
  if (!isAxiosError(err)) return err instanceof Error
  const status = err.response?.status
  if (status == null) return true
  if (status >= 500) return true
  return status === 408 || status === 429
}

/** Message from DRF / Django error payloads. */
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
    if (err.response?.status === 403) return 'Esta acción es de coordinación.'
    if (err.response?.status === 401) return 'Usuario o contraseña incorrectos.'
    if (err.message) return err.message
  }
  if (err instanceof Error) return err.message
  return fallback
}
