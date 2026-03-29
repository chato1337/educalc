/** Base URL without trailing slash. Empty string = same origin (Vite proxy `/api` in dev). */
export function getApiBaseUrl(): string {
  const v = import.meta.env.VITE_API_BASE_URL
  if (typeof v === 'string' && v.trim() !== '') {
    return v.replace(/\/$/, '')
  }
  return ''
}
