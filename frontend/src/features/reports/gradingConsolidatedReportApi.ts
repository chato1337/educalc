import { isAxiosError } from 'axios'

import { apiClient } from '@/api/client'
import type { operations } from '@/types/openapi'

/** Query for GET /api/reports/grading-consolidated/ (OpenAPI: reports_grading_consolidated_retrieve). */
export type GradingConsolidatedCsvQuery =
  operations['reports_grading_consolidated_retrieve']['parameters']['query']

function parseFilenameFromContentDisposition(cd: string): string | null {
  const star = cd.match(/filename\*\s*=\s*UTF-8''([^;\s]+)/i)
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim())
    } catch {
      /* ignore */
    }
  }
  const quoted = cd.match(/filename\s*=\s*"([^"]+)"/i)
  if (quoted?.[1]) return quoted[1].trim()
  const plain = cd.match(/filename\s*=\s*([^;\s]+)/i)
  if (plain?.[1]) return plain[1].replace(/^["']|["']$/g, '').trim()
  return null
}

function buildQueryParams(
  q: GradingConsolidatedCsvQuery,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null) continue
    const s = String(v).trim()
    if (s === '') continue
    out[k] = s
  }
  return out
}

function fallbackFilename(academicYearId: string): string {
  return `consolidado_calificaciones_${academicYearId.slice(0, 8)}.csv`
}

async function detailFromBlob(data: Blob): Promise<string | null> {
  try {
    const text = await data.text()
    const j = JSON.parse(text) as { detail?: unknown }
    return typeof j.detail === 'string' ? j.detail : null
  } catch {
    return null
  }
}

/**
 * Descarga el CSV del consolidado calificados vs pendientes (auditoría interna).
 * En 4xx/5xx con cuerpo JSON, expone `detail` como Error.
 */
export async function downloadGradingConsolidatedCsv(
  params: GradingConsolidatedCsvQuery,
): Promise<void> {
  const ay = params.academic_year?.trim()
  if (!ay) {
    throw new Error('Selecciona un año lectivo.')
  }
  const query = buildQueryParams({ ...params, academic_year: ay })
  try {
    const res = await apiClient.get<Blob>('/api/reports/grading-consolidated/', {
      params: query,
      responseType: 'blob',
    })
    const blob = res.data
    const ctype = String(res.headers['content-type'] ?? '')
    if (ctype.includes('application/json')) {
      const detail = await detailFromBlob(blob)
      throw new Error(detail ?? 'No se pudo generar el archivo.')
    }
    const cdRaw = res.headers['content-disposition']
    const cd = typeof cdRaw === 'string' ? cdRaw : undefined
    const parsed = cd ? parseFilenameFromContentDisposition(cd) : null
    const filename = parsed ?? fallbackFilename(ay)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (e) {
    if (isAxiosError(e) && e.response?.data instanceof Blob) {
      const detail = await detailFromBlob(e.response.data)
      if (detail) throw new Error(detail)
    }
    throw e
  }
}
