/** Backend URL without a trailing slash. Empty = same-origin (Vite proxy in dev). */
export function getApiBaseUrl(): string {
  const v = import.meta.env.VITE_API_BASE_URL
  if (typeof v === 'string') {
    return v.trim().replace(/\/$/, '')
  }
  return ''
}
