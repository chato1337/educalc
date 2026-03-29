import { apiClient } from '@/api/client'

/** Rutas `POST …/bulk-load/` definidas en OpenAPI (`BulkLoadCsvUploadRequest` o estudiantes). */
export const BULK_LOAD_API_PATHS = [
  '/api/academic-areas/bulk-load/',
  '/api/academic-indicators/bulk-load/',
  '/api/academic-periods/bulk-load/',
  '/api/attendances/bulk-load/',
  '/api/course-assignments/bulk-load/',
  '/api/disciplinary-reports/bulk-load/',
  '/api/grade-directors/bulk-load/',
  '/api/grades/bulk-load/',
  '/api/grading-scales/bulk-load/',
  '/api/parents/bulk-load/',
  '/api/performance-summaries/bulk-load/',
  '/api/student-guardians/bulk-load/',
  '/api/students/bulk-load/',
  '/api/subjects/bulk-load/',
  '/api/teachers/bulk-load/',
] as const

export type BulkLoadApiPath = (typeof BULK_LOAD_API_PATHS)[number]

export type BulkLoadRowError = { row: number; error: string }

/**
 * Cuerpo JSON 200 de los loaders (OpenAPI: object con additionalProperties).
 * Incluye contadores habituales y lista `errors` por fila.
 */
export type BulkLoadStats = {
  rows_processed?: number
  rows_skipped?: number
  created?: number
  updated?: number
  errors?: BulkLoadRowError[]
  [key: string]: unknown
}

export async function postBulkLoadCsv(
  path: BulkLoadApiPath,
  file: File,
): Promise<BulkLoadStats> {
  const body = new FormData()
  body.append('file', file)
  const { data } = await apiClient.post<BulkLoadStats>(path, body)
  return data
}
