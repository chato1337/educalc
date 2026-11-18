import { isAxiosError } from 'axios'

import { apiClient } from '@/api/client'
import type { operations } from '@/types/openapi'

/** Query for GET /api/academic-grades/certificate/. */
export type AcademicCertificateQuery =
  operations['academic_grades_certificate_retrieve']['parameters']['query']

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

function fallbackCertificateFilename(params: AcademicCertificateQuery): string {
  if (params.group) return `certificado_grupo_${params.group.slice(0, 8)}.pdf`
  if (params.student) return `certificado_estudiante_${params.student.slice(0, 8)}.pdf`
  return 'certificado.pdf'
}

async function detailFromBlob(data: Blob): Promise<string | null> {
  try {
    const text = await data.text()
    const parsed = JSON.parse(text) as { detail?: unknown }
    return typeof parsed.detail === 'string' ? parsed.detail : null
  } catch {
    return null
  }
}

/**
 * Downloads the student certificate PDF. On 4xx/5xx with a JSON body, surfaces `detail`.
 */
export async function downloadStudentCertificatePdf(
  params: AcademicCertificateQuery,
): Promise<void> {
  const hasStudent = Boolean(params.student)
  const hasGroup = Boolean(params.group)
  if (hasStudent === hasGroup) {
    throw new Error(
      'Indica exactamente uno: estudiante (`student`) o grupo (`group`), más el año lectivo.',
    )
  }
  try {
    const res = await apiClient.get<Blob>('/api/academic-grades/certificate/', {
      params,
      responseType: 'blob',
    })
    const blob = res.data
    const contentType = String(res.headers['content-type'] ?? '')
    if (contentType.includes('application/json')) {
      const detail = await detailFromBlob(blob)
      throw new Error(detail ?? 'No se pudo generar el certificado.')
    }
    const disposition = res.headers['content-disposition']
    const header = typeof disposition === 'string' ? disposition : undefined
    const parsed = header ? parseFilenameFromContentDisposition(header) : null
    const filename = parsed ?? fallbackCertificateFilename(params)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } catch (error) {
    if (isAxiosError(error) && error.response?.data instanceof Blob) {
      const detail = await detailFromBlob(error.response.data)
      if (detail) throw new Error(detail)
    }
    throw error
  }
}
