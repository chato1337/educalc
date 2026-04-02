/** URL del backend sin barra final. Las peticiones siguen usando rutas `/api/...` sobre esta base. */
const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000'

export function getApiBaseUrl(): string {
  const v = import.meta.env.VITE_API_BASE_URL
  if (typeof v === 'string' && v.trim() !== '') {
    return v.replace(/\/$/, '')
  }
  return DEFAULT_API_BASE_URL
}
